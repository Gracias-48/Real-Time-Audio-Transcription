"""
Local Python ASR server for the Lecture Transcriber.

Run:  .venv\\Scripts\\python -m uvicorn app:app --host 127.0.0.1 --port 8765

Endpoints (all bound to localhost; audio never leaves this machine):
  GET  /health      -> server + model status
  WS   /ws/asr      -> request/response transcription  (implements the frontend ASREngine)
                       client -> binary: [uint32 LE header_len][header JSON utf-8][float32 PCM @16k]
                                 header = {"id": int, "final": bool, "model": "tiny.en", "prompt"?: str}
                       server -> text JSON {"id", "text", "ms", "audioS", "rtf", "device"}
  WS   /ws/stream   -> full server-side streaming pipeline
                       client -> text {"type":"start", ...settings}
                                 binary float32 PCM chunks @16 kHz mono (any size)
                                 text {"type":"stop"}
                       server -> {"type":"ready"|"speech_start"|"speech_end"|"partial"|"final"|"error", ...}
"""
from __future__ import annotations

import asyncio
import json
import logging
import struct
import time
from collections import deque
from dataclasses import dataclass, field

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from asr import SAMPLE_RATE, SUPPORTED_MODELS, ASRService
from vad import FRAME, StreamingSileroVAD

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("server")

app = FastAPI(title="Lecture Transcriber - Local ASR server")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

asr = ASRService()
FRAME_MS = FRAME / SAMPLE_RATE * 1000.0  # 32 ms


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "models": list(SUPPORTED_MODELS), "loaded": asr.loaded(), "sampleRate": SAMPLE_RATE}


# --------------------------------------------------------------------------- /ws/asr
@app.websocket("/ws/asr")
async def ws_asr(ws: WebSocket) -> None:
    await ws.accept()
    try:
        while True:
            msg = await ws.receive()
            if msg.get("type") == "websocket.disconnect":
                break
            data = msg.get("bytes")
            if data is None:
                text = msg.get("text") or "{}"
                req = json.loads(text)
                if req.get("type") == "load":
                    model = req.get("model", "tiny.en")
                    try:
                        _, device, ctype = await asyncio.to_thread(asr.get, model)
                        await ws.send_json({"type": "loaded", "model": model, "device": device, "computeType": ctype})
                    except Exception as e:  # noqa: BLE001
                        await ws.send_json({"type": "error", "message": str(e)})
                continue
            (hlen,) = struct.unpack_from("<I", data, 0)
            header = json.loads(data[4 : 4 + hlen].decode("utf-8"))
            pcm_bytes = data[4 + hlen :]
            audio = np.frombuffer(pcm_bytes[: len(pcm_bytes) // 4 * 4], dtype=np.float32)
            try:
                r = await asyncio.to_thread(
                    asr.transcribe, audio, header.get("model", "tiny.en"), bool(header.get("final")), header.get("prompt")
                )
                await ws.send_json(
                    {"id": header.get("id"), "text": r.text, "ms": r.decode_ms, "audioS": r.audio_s, "rtf": r.rtf, "device": r.device}
                )
            except Exception as e:  # noqa: BLE001
                log.exception("transcribe failed")
                await ws.send_json({"id": header.get("id"), "error": str(e)})
    except WebSocketDisconnect:
        pass


# ------------------------------------------------------------------------ /ws/stream
@dataclass
class StreamSettings:
    model: str = "tiny.en"
    threshold: float = 0.5  # VAD positive threshold
    silence_ms: float = 600.0  # redemption: silence that ends an utterance
    min_speech_ms: float = 250.0
    preroll_ms: float = 300.0
    partial_interval_ms: float = 900.0
    max_utterance_s: float = 15.0
    prompt: str | None = None

    @classmethod
    def from_msg(cls, m: dict) -> "StreamSettings":
        s = cls()
        s.model = m.get("model", s.model)
        s.threshold = float(m.get("threshold", s.threshold))
        s.silence_ms = float(m.get("silenceMs", s.silence_ms))
        s.min_speech_ms = float(m.get("minSpeechMs", s.min_speech_ms))
        s.partial_interval_ms = float(m.get("partialIntervalMs", s.partial_interval_ms))
        s.max_utterance_s = float(m.get("maxUtteranceS", s.max_utterance_s))
        s.prompt = m.get("prompt") or None
        return s


@dataclass
class StreamState:
    settings: StreamSettings
    vad: StreamingSileroVAD = field(default_factory=StreamingSileroVAD)
    pending: np.ndarray = field(default_factory=lambda: np.zeros(0, dtype=np.float32))
    samples_in: int = 0  # total samples received (stream clock)
    speaking: bool = False
    utt_id: int = 0
    utt: list[np.ndarray] = field(default_factory=list)
    utt_start_sample: int = 0
    speech_frames: int = 0
    silence_frames: int = 0
    preroll: deque = field(default_factory=lambda: deque(maxlen=10))
    last_partial_t: float = 0.0
    partial_task: asyncio.Task | None = None


class StreamSession:
    def __init__(self, ws: WebSocket, settings: StreamSettings) -> None:
        self.ws = ws
        self.s = StreamState(settings)
        self.s.preroll = deque(maxlen=max(1, int(settings.preroll_ms / FRAME_MS)))
        self.decode_lock = asyncio.Lock()  # FIFO: keeps partial/final ordering
        self.final_tasks: set[asyncio.Task] = set()

    async def send(self, obj: dict) -> None:
        try:
            await self.ws.send_json(obj)
        except Exception:  # noqa: BLE001
            pass

    async def _decode(self, kind: str, utt_id: int, audio: np.ndarray, sample_end: int, start_sample: int) -> None:
        async with self.decode_lock:
            try:
                r = await asyncio.to_thread(asr.transcribe, audio, self.s.settings.model, kind == "final", self.s.settings.prompt)
            except Exception as e:  # noqa: BLE001
                log.exception("decode failed")
                await self.send({"type": "error", "message": str(e)})
                return
            await self.send(
                {
                    "type": kind,
                    "uttId": utt_id,
                    "text": r.text,
                    "decodeMs": r.decode_ms,
                    "audioS": r.audio_s,
                    "rtf": r.rtf,
                    "sampleEnd": sample_end,
                    "startSample": start_sample,
                    "device": r.device,
                }
            )

    def _utt_audio(self) -> np.ndarray:
        return np.concatenate(self.s.utt) if self.s.utt else np.zeros(0, dtype=np.float32)

    def _commit(self, reason: str) -> None:
        s = self.s
        audio = self._utt_audio()
        if s.speech_frames * FRAME_MS >= s.settings.min_speech_ms and len(audio) > 0:
            t = asyncio.create_task(self._decode("final", s.utt_id, audio, s.samples_in, s.utt_start_sample))
            self.final_tasks.add(t)
            t.add_done_callback(self.final_tasks.discard)
        else:
            asyncio.create_task(self.send({"type": "misfire", "uttId": s.utt_id}))
        s.utt = []
        s.speech_frames = 0
        s.silence_frames = 0
        s.utt_id += 1
        s.utt_start_sample = s.samples_in
        log.debug("commit (%s)", reason)

    def _process_frame(self, frame: np.ndarray) -> None:
        s = self.s
        prob = s.vad(frame)
        neg = max(0.05, s.settings.threshold - 0.15)
        if not s.speaking:
            if prob >= s.settings.threshold:
                s.speaking = True
                s.utt = list(s.preroll) + [frame]
                s.preroll.clear()
                s.speech_frames = 1
                s.silence_frames = 0
                s.utt_start_sample = s.samples_in - len(s.utt) * FRAME
                s.last_partial_t = time.perf_counter()
                asyncio.create_task(self.send({"type": "speech_start", "uttId": s.utt_id, "prob": prob}))
            else:
                s.preroll.append(frame)
            return

        s.utt.append(frame)
        if prob >= s.settings.threshold:
            s.speech_frames += 1
            s.silence_frames = 0
        elif prob < neg:
            s.silence_frames += 1

        if s.silence_frames * FRAME_MS >= s.settings.silence_ms:
            s.speaking = False
            asyncio.create_task(self.send({"type": "speech_end", "uttId": s.utt_id}))
            self._commit("silence")
        elif len(s.utt) * FRAME >= s.settings.max_utterance_s * SAMPLE_RATE:
            self._commit("max_length")  # force commit, keep listening

    def _maybe_partial(self) -> None:
        s = self.s
        if not s.speaking or self.decode_lock.locked():
            return  # never overlap decodes: drop this tick
        now = time.perf_counter()
        if (now - s.last_partial_t) * 1000.0 < s.settings.partial_interval_ms:
            return
        audio = self._utt_audio()
        if len(audio) < SAMPLE_RATE * 0.4:
            return
        s.last_partial_t = now
        s.partial_task = asyncio.create_task(self._decode("partial", s.utt_id, audio, s.samples_in, s.utt_start_sample))

    def feed(self, chunk: np.ndarray) -> None:
        s = self.s
        data = np.concatenate([s.pending, chunk]) if len(s.pending) else chunk
        n = len(data) // FRAME
        for i in range(n):
            frame = data[i * FRAME : (i + 1) * FRAME]
            s.samples_in += FRAME
            self._process_frame(frame)
        s.pending = data[n * FRAME :].copy()
        self._maybe_partial()

    async def flush(self) -> None:
        if self.s.speaking:
            self.s.speaking = False
            await self.send({"type": "speech_end", "uttId": self.s.utt_id})
            self._commit("stop")
        if self.final_tasks:
            await asyncio.gather(*list(self.final_tasks), return_exceptions=True)


@app.websocket("/ws/stream")
async def ws_stream(ws: WebSocket) -> None:
    await ws.accept()
    session: StreamSession | None = None
    try:
        while True:
            msg = await ws.receive()
            if msg.get("type") == "websocket.disconnect":
                break
            if msg.get("text") is not None:
                m = json.loads(msg["text"])
                if m.get("type") == "start":
                    settings = StreamSettings.from_msg(m)
                    await ws.send_json({"type": "loading", "model": settings.model})
                    try:
                        _, device, ctype = await asyncio.to_thread(asr.get, settings.model)
                    except Exception as e:  # noqa: BLE001
                        await ws.send_json({"type": "error", "message": str(e)})
                        continue
                    session = StreamSession(ws, settings)
                    await ws.send_json({"type": "ready", "model": settings.model, "device": device, "computeType": ctype})
                elif m.get("type") == "stop" and session:
                    await session.flush()
                    await ws.send_json({"type": "stopped"})
                    session = None
            elif msg.get("bytes") is not None and session:
                b = msg["bytes"]
                session.feed(np.frombuffer(b[: len(b) // 4 * 4], dtype=np.float32).copy())
    except WebSocketDisconnect:
        pass
    except RuntimeError:
        pass
