"""
Streaming Silero VAD (v6 ONNX, bundled with faster-whisper) running on CPU via onnxruntime.

Processes audio frame-by-frame (512 samples = 32 ms @ 16 kHz) and carries the recurrent
state (h, c) plus a 64-sample left context between calls, as the official Silero wrapper does.
"""
from __future__ import annotations

import os

import numpy as np
import onnxruntime
from faster_whisper.utils import get_assets_path

FRAME = 512
CONTEXT = 64


class StreamingSileroVAD:
    def __init__(self) -> None:
        opts = onnxruntime.SessionOptions()
        opts.inter_op_num_threads = 1
        opts.intra_op_num_threads = 1
        opts.log_severity_level = 4
        path = os.path.join(get_assets_path(), "silero_vad_v6.onnx")
        self.session = onnxruntime.InferenceSession(path, providers=["CPUExecutionProvider"], sess_options=opts)
        self.reset()

    def reset(self) -> None:
        self.h = np.zeros((1, 1, 128), dtype=np.float32)
        self.c = np.zeros((1, 1, 128), dtype=np.float32)
        self.context = np.zeros((1, CONTEXT), dtype=np.float32)

    def __call__(self, frame: np.ndarray) -> float:
        """Return speech probability for one 512-sample frame."""
        assert frame.shape[0] == FRAME
        x = np.concatenate([self.context, frame.reshape(1, FRAME).astype(np.float32)], axis=1)
        out, self.h, self.c = self.session.run(None, {"input": x, "h": self.h, "c": self.c})
        self.context = x[:, -CONTEXT:]
        return float(np.asarray(out).reshape(-1)[-1])
