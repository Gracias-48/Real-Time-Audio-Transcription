"""
Explicit, from-scratch acoustic front-end: STFT -> power spectrum -> Mel filterbank -> log.

This module re-implements the exact Log-Mel spectrogram that Whisper was trained on,
step by step and with plain NumPy, so that every stage of the signal-processing pipeline
is visible (and gradable) instead of being hidden inside a library:

    1. Framing      : 25 ms windows (n_fft = 400 samples @ 16 kHz), 10 ms hop (160 samples)
    2. Windowing    : periodic Hann window to reduce spectral leakage
    3. FFT          : real FFT per frame -> complex spectrum (201 bins, 0..8 kHz)
    4. Power        : |X(f)|^2
    5. Mel filterbank: 80 (or 128) triangular Slaney-style filters
    6. Log compression: log10(max(mel, 1e-10))
    7. Dynamic-range clamp: max(log_spec, max - 8)  (80 dB)  and scale: (x + 4) / 4

`WhisperLogMel` subclasses faster-whisper's FeatureExtractor only to keep the same
attribute contract (n_samples, hop_length, time_per_frame, ...). Its `__call__` is fully
replaced by our own implementation, so faster-whisper decodes *our* features.
`tests/test_features.py` checks numerical parity against the reference implementation.
"""
from __future__ import annotations

import numpy as np
from faster_whisper.feature_extractor import FeatureExtractor

SAMPLE_RATE = 16_000
N_FFT = 400  # 25 ms
HOP_LENGTH = 160  # 10 ms


def hz_to_mel_slaney(f: np.ndarray) -> np.ndarray:
    """Slaney mel scale: linear below 1 kHz, logarithmic above."""
    f = np.asarray(f, dtype=np.float64)
    f_sp = 200.0 / 3.0
    mels = f / f_sp
    min_log_hz = 1000.0
    min_log_mel = min_log_hz / f_sp
    logstep = np.log(6.4) / 27.0
    log_region = f >= min_log_hz
    mels = np.where(log_region, min_log_mel + np.log(np.maximum(f, 1e-10) / min_log_hz) / logstep, mels)
    return mels


def mel_to_hz_slaney(m: np.ndarray) -> np.ndarray:
    m = np.asarray(m, dtype=np.float64)
    f_sp = 200.0 / 3.0
    freqs = m * f_sp
    min_log_hz = 1000.0
    min_log_mel = min_log_hz / f_sp
    logstep = np.log(6.4) / 27.0
    log_region = m >= min_log_mel
    freqs = np.where(log_region, min_log_hz * np.exp(logstep * (m - min_log_mel)), freqs)
    return freqs


def mel_filterbank(sr: int = SAMPLE_RATE, n_fft: int = N_FFT, n_mels: int = 80) -> np.ndarray:
    """Triangular Slaney-normalised Mel filterbank, shape (n_mels, n_fft // 2 + 1)."""
    fft_freqs = np.fft.rfftfreq(n_fft, d=1.0 / sr)
    mel_min, mel_max = hz_to_mel_slaney(0.0), hz_to_mel_slaney(sr / 2)
    mel_points = np.linspace(mel_min, mel_max, n_mels + 2)
    hz_points = mel_to_hz_slaney(mel_points)

    fdiff = np.diff(hz_points)
    ramps = hz_points[:, None] - fft_freqs[None, :]
    lower = -ramps[:-2] / fdiff[:-1, None]
    upper = ramps[2:] / fdiff[1:, None]
    weights = np.maximum(0.0, np.minimum(lower, upper))
    enorm = 2.0 / (hz_points[2 : n_mels + 2] - hz_points[:n_mels])  # equal-area normalisation
    return (weights * enorm[:, None]).astype(np.float32)


def hann_window(n: int) -> np.ndarray:
    """Periodic Hann window (same as torch.hann_window(n, periodic=True))."""
    k = np.arange(n, dtype=np.float64)
    return (0.5 - 0.5 * np.cos(2.0 * np.pi * k / n)).astype(np.float32)


def stft_power(waveform: np.ndarray, n_fft: int = N_FFT, hop: int = HOP_LENGTH) -> np.ndarray:
    """Centered STFT power spectrogram, shape (n_fft // 2 + 1, n_frames)."""
    x = np.asarray(waveform, dtype=np.float32)
    pad = n_fft // 2
    x = np.pad(x, (pad, pad), mode="reflect")  # center=True, reflect padding
    n_frames = 1 + (len(x) - n_fft) // hop
    # Framing via strides (no copy): frames[t] = x[t*hop : t*hop + n_fft]
    frames = np.lib.stride_tricks.as_strided(
        x, shape=(n_frames, n_fft), strides=(x.strides[0] * hop, x.strides[0])
    )
    windowed = frames * hann_window(n_fft)
    spectrum = np.fft.rfft(windowed, n=n_fft, axis=-1)  # (frames, bins), complex
    power = (spectrum.real**2 + spectrum.imag**2).astype(np.float32)
    return power.T


def log_mel_spectrogram(waveform: np.ndarray, n_mels: int = 80, padding: int = 0) -> np.ndarray:
    """Whisper-style normalised log-Mel spectrogram, shape (n_mels, n_frames)."""
    x = np.asarray(waveform, dtype=np.float32)
    if padding:
        x = np.pad(x, (0, padding))
    power = stft_power(x)[:, :-1]  # Whisper drops the last frame
    mel = mel_filterbank(n_mels=n_mels) @ power
    log_spec = np.log10(np.maximum(mel, 1e-10))
    log_spec = np.maximum(log_spec, log_spec.max() - 8.0)  # 80 dB dynamic range
    return ((log_spec + 4.0) / 4.0).astype(np.float32)


class WhisperLogMel(FeatureExtractor):
    """Drop-in feature extractor for faster-whisper backed by our own STFT log-Mel code."""

    def __init__(self, feature_size: int = 80, **kwargs):
        super().__init__(feature_size=feature_size, **kwargs)
        self.n_mels = feature_size
        self.calls = 0
        self.last_shape: tuple[int, ...] | None = None

    def __call__(self, waveform: np.ndarray, padding: int = 160, chunk_length: int | None = None):
        if chunk_length is not None:
            self.n_samples = chunk_length * self.sampling_rate
            self.nb_max_frames = self.n_samples // self.hop_length
        feats = log_mel_spectrogram(waveform, n_mels=self.n_mels, padding=padding)
        self.calls += 1
        self.last_shape = feats.shape
        return feats
