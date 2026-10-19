"""Smoke test: load each model (CUDA -> CPU fallback) and decode a synthetic clip.

Run from server/:  .venv\\Scripts\\python tools\\smoke_test.py [path\\to\\clip.wav]
"""
import os
import sys
import time
import wave

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from asr import ASRService  # noqa: E402


def load_wav(path: str) -> np.ndarray:
    with wave.open(path, "rb") as w:
        assert w.getframerate() == 16000 and w.getnchannels() == 1 and w.getsampwidth() == 2
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0


if __name__ == "__main__":
    svc = ASRService()
    audio = load_wav(sys.argv[1]) if len(sys.argv) > 1 else np.zeros(16000 * 2, dtype=np.float32)
    for name in ("tiny.en", "base.en"):
        t0 = time.perf_counter()
        _, device, ctype = svc.get(name)
        print(f"[{name}] loaded on {device}/{ctype} in {time.perf_counter() - t0:.1f}s")
        for final in (False, True):
            r = svc.transcribe(audio, name, final=final)
            print(f"  final={final} decode={r.decode_ms:.0f}ms audio={r.audio_s:.2f}s RTF={r.rtf:.3f} text={r.text!r}")
