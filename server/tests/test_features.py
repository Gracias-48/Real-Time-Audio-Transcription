"""Parity tests: our explicit STFT log-Mel front-end vs. faster-whisper's reference.

Run:  .venv\\Scripts\\python -m pytest -q   (or: .venv\\Scripts\\python tests\\test_features.py)
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from faster_whisper.feature_extractor import FeatureExtractor  # noqa: E402

from features import hann_window, log_mel_spectrogram, mel_filterbank  # noqa: E402


def _signal(seconds: float = 2.0, sr: int = 16000) -> np.ndarray:
    t = np.arange(int(seconds * sr)) / sr
    rng = np.random.default_rng(0)
    return (0.4 * np.sin(2 * np.pi * 220 * t) + 0.2 * np.sin(2 * np.pi * 1800 * t) + 0.05 * rng.standard_normal(t.shape)).astype(np.float32)


def test_hann_matches_numpy_periodic():
    np.testing.assert_allclose(hann_window(400), np.hanning(401)[:-1], atol=1e-6)


def test_mel_filterbank_matches_reference():
    for n_mels in (80, 128):
        ref = FeatureExtractor.get_mel_filters(16000, 400, n_mels=n_mels)
        np.testing.assert_allclose(mel_filterbank(n_mels=n_mels), ref, rtol=1e-4, atol=1e-6)


def test_log_mel_matches_reference():
    x = _signal()
    ref = FeatureExtractor(feature_size=80)(x, padding=160)
    ours = log_mel_spectrogram(x, n_mels=80, padding=160)
    assert ours.shape == ref.shape
    np.testing.assert_allclose(ours, ref, atol=2e-3)


if __name__ == "__main__":
    test_hann_matches_numpy_periodic()
    test_mel_filterbank_matches_reference()
    test_log_mel_matches_reference()
    print("All feature parity tests passed.")
