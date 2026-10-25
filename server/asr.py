"""
Local Faster-Whisper ASR service (CTranslate2). No network calls except the one-time model
download from the Hugging Face Hub, after which models are read from the local HF cache.
"""
from __future__ import annotations

import logging
import os
import re
import sys
import threading
import time
from dataclasses import dataclass


def _register_cuda_dlls() -> None:
    """On Windows, make pip-installed cuBLAS / cuDNN DLLs visible to CTranslate2."""
    if sys.platform != "win32":
        return
    try:
        import nvidia  # type: ignore
    except ImportError:
        return
    for base in list(getattr(nvidia, "__path__", [])):
        for sub in ("cublas", "cudnn", "cuda_runtime", "cuda_nvrtc"):
            bin_dir = os.path.join(base, sub, "bin")
            if os.path.isdir(bin_dir):
                os.add_dll_directory(bin_dir)
                os.environ["PATH"] = bin_dir + os.pathsep + os.environ.get("PATH", "")


_register_cuda_dlls()

import numpy as np  # noqa: E402
from faster_whisper import WhisperModel  # noqa: E402

from features import WhisperLogMel  # noqa: E402

log = logging.getLogger("asr")

SAMPLE_RATE = 16_000
SUPPORTED_MODELS = ("tiny", "base", "small", "tiny.en", "base.en", "small.en")

# Whisper tends to "hallucinate" these on silence / noise.
_HALLUCINATIONS = {
    "thank you", "thank you.", "thanks for watching", "thanks for watching!",
    "thank you for watching", "thank you for watching.", "you", "bye", "bye.",
    "please subscribe", "subtitles by the amara.org community", ".", "...",
}
_BRACKETED = re.compile(r"\[[^\]]*\]|\([^)]*\)|\*[^*]*\*")


def clean_text(text: str) -> str:
    """Normalise whitespace and drop common Whisper silence hallucinations."""
    t = _BRACKETED.sub(" ", text)
    t = re.sub(r"\s+", " ", t).strip()
    if not t:
        return ""
    if t.lower().strip(" .!?,") in {h.strip(" .!?,") for h in _HALLUCINATIONS}:
        return ""
    # Collapse pathological repetition loops like "the the the the the"
    t = re.sub(r"\b(\w+)(?:\s+\1\b){3,}", r"\1", t, flags=re.IGNORECASE)
    return t


@dataclass
class Result:
    text: str
    decode_ms: float
    audio_s: float
    model: str
    device: str

    @property
    def rtf(self) -> float:
        return (self.decode_ms / 1000.0) / self.audio_s if self.audio_s > 0 else 0.0


class ASRService:
    def __init__(self, preferred_device: str = "auto") -> None:
        self.preferred_device = preferred_device
        self._models: dict[str, tuple[WhisperModel, str, str]] = {}
        self._load_lock = threading.Lock()
        self._decode_lock = threading.Lock()  # one decode at a time on the GPU

    # ---------------------------------------------------------------- loading
    def _try_load(self, name: str, device: str, compute_type: str) -> WhisperModel:
        model = WhisperModel(name, device=device, compute_type=compute_type)
        # Replace the library's front-end with our own explicit STFT log-Mel implementation.
        model.feature_extractor = WhisperLogMel(**model.feat_kwargs)
        # Warm-up decode (initialises CUDA kernels / catches missing DLLs early).
        lang = None if name.endswith(".en") else "id"
        segs, _ = model.transcribe(np.zeros(SAMPLE_RATE, dtype=np.float32), language=lang, beam_size=1)
        list(segs)
        return model

    def get(self, name: str) -> tuple[WhisperModel, str, str]:
        if name not in SUPPORTED_MODELS:
            raise ValueError(f"Unsupported model '{name}'. Choose one of {SUPPORTED_MODELS}.")
        with self._load_lock:
            if name in self._models:
                return self._models[name]
            attempts: list[tuple[str, str]] = []
            if self.preferred_device in ("auto", "cuda"):
                attempts.append(("cuda", "float16"))
            if self.preferred_device in ("auto", "cpu"):
                attempts.append(("cpu", "int8"))
            last_err: Exception | None = None
            for device, ctype in attempts:
                try:
                    t0 = time.perf_counter()
                    model = self._try_load(name, device, ctype)
                    log.info("Loaded %s on %s/%s in %.1fs", name, device, ctype, time.perf_counter() - t0)
                    self._models[name] = (model, device, ctype)
                    return self._models[name]
                except Exception as e:  # noqa: BLE001
                    log.warning("Could not load %s on %s (%s): %s", name, device, ctype, e)
                    last_err = e
            raise RuntimeError(f"Failed to load model {name}: {last_err}")

    def loaded(self) -> dict[str, dict[str, str]]:
        return {k: {"device": v[1], "compute_type": v[2]} for k, v in self._models.items()}

    # --------------------------------------------------------------- decoding
    def transcribe(
        self,
        audio: np.ndarray,
        model_name: str,
        final: bool,
        initial_prompt: str | None = None,
        language: str | None = "id",
        beam_size_final: int = 5,
    ) -> Result:
        model, device, _ = self.get(model_name)
        audio = np.asarray(audio, dtype=np.float32)
        audio_s = len(audio) / SAMPLE_RATE
        is_en_only = model_name.endswith(".en")
        with self._decode_lock:
            t0 = time.perf_counter()
            transcribe_kwargs = dict(
                beam_size=beam_size_final if final else 1,
                best_of=1,
                temperature=[0.0, 0.2] if final else 0.0,
                condition_on_previous_text=False,
                without_timestamps=True,
                vad_filter=False,  # VAD is done upstream
                initial_prompt=initial_prompt or None,
                no_speech_threshold=0.6,
                repetition_penalty=1.1,
            )
            if not is_en_only:
                if language and language != "auto":
                    transcribe_kwargs["language"] = language
                transcribe_kwargs["task"] = "transcribe"
            segments, _info = model.transcribe(audio, **transcribe_kwargs)
            text = " ".join(s.text.strip() for s in segments)
            decode_ms = (time.perf_counter() - t0) * 1000.0
        return Result(clean_text(text), decode_ms, audio_s, model_name, device)
