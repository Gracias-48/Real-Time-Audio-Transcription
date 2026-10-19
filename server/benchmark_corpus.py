"""
Offline benchmark runner using Mozilla Common Voice (cv-corpus-27.0-2026-09-11).
Evaluates Faster-Whisper (CUDA or CPU) with our explicit STFT log-Mel front-end
against test.tsv ground-truth transcripts.

Usage:
  .venv\\Scripts\\python benchmark_corpus.py [--limit 50] [--model tiny] [--device cuda]
"""
import argparse
import csv
import os
import re
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from asr import ASRService


def normalize_text(s: str) -> str:
    s = s.lower()
    s = re.sub(r"[^\w\s]", "", s)
    return re.sub(r"\s+", " ", s).strip()


def levenshtein_ops(r_tokens: list[str], h_tokens: list[str]):
    n, m = len(r_tokens), len(h_tokens)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if r_tokens[i - 1] == h_tokens[j - 1] else 1
            dp[i][j] = min(dp[i - 1][j - 1] + cost, dp[i - 1][j] + 1, dp[i][j - 1] + 1)

    i, j = n, m
    S, D, I, C = 0, 0, 0, 0
    while i > 0 or j > 0:
        if i > 0 and j > 0 and dp[i][j] == dp[i - 1][j - 1] + (0 if r_tokens[i - 1] == h_tokens[j - 1] else 1):
            if r_tokens[i - 1] == h_tokens[j - 1]:
                C += 1
            else:
                S += 1
            i -= 1
            j -= 1
        elif i > 0 and dp[i][j] == dp[i - 1][j] + 1:
            D += 1
            i -= 1
        else:
            I += 1
            j -= 1
    return S, D, I, C, n


def load_audio_mp3(path: str, sr: int = 16000) -> np.ndarray:
    import av

    container = av.open(path)
    resampler = av.AudioResampler(format="fltp", layout="mono", rate=sr)
    frames = []
    for frame in container.decode(audio=0):
        for resampled in resampler.resample(frame):
            frames.append(resampled.to_ndarray())
    if not frames:
        return np.zeros(0, dtype=np.float32)
    return np.concatenate(frames, axis=-1).flatten().astype(np.float32)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--tsv", default="../cv-corpus-27.0-2026-09-11/id/test.tsv")
    parser.add_argument("--clips", default="../cv-corpus-27.0-2026-09-11/id/clips")
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--model", default="tiny")
    parser.add_argument("--device", default="auto")
    parser.add_argument("--output", default="cv_benchmark_results.csv")
    args = parser.parse_args()

    tsv_path = os.path.abspath(args.tsv)
    clips_dir = os.path.abspath(args.clips)

    if not os.path.isfile(tsv_path):
        print(f"Error: TSV file not found at {tsv_path}")
        return

    print(f"Loading ASR Service for model '{args.model}'...")
    svc = ASRService(preferred_device=args.device)
    model_obj, device, ctype = svc.get(args.model)
    print(f"Model loaded on {device} ({ctype})")

    results = []
    total_S, total_D, total_I, total_N = 0, 0, 0, 0
    total_latency_ms, total_audio_s = 0.0, 0.0

    with open(tsv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        rows = [r for r in reader if int(r.get("up_votes", 0)) >= 2][: args.limit]

    print(f"Benchmarking {len(rows)} samples from Common Voice...")

    for idx, row in enumerate(rows, 1):
        clip_file = os.path.join(clips_dir, row["path"])
        if not os.path.isfile(clip_file):
            continue

        audio = load_audio_mp3(clip_file)
        audio_dur = len(audio) / 16000

        t0 = time.perf_counter()
        res = svc.transcribe(audio, args.model, final=True)
        latency_ms = (time.perf_counter() - t0) * 1000.0

        ref_norm = normalize_text(row["sentence"])
        hyp_norm = normalize_text(res.text)

        r_words = ref_norm.split()
        h_words = hyp_norm.split()
        S, D, I, C, N = levenshtein_ops(r_words, h_words)
        wer = (S + D + I) / max(N, 1)

        total_S += S
        total_D += D
        total_I += I
        total_N += N
        total_latency_ms += latency_ms
        total_audio_s += audio_dur

        results.append(
            {
                "path": row["path"],
                "reference": row["sentence"],
                "hypothesis": res.text,
                "WER": round(wer, 4),
                "S": S,
                "D": D,
                "I": I,
                "C": C,
                "N": N,
                "latency_ms": round(latency_ms, 1),
                "RTF": round(res.rtf, 3),
            }
        )

        print(f"[{idx}/{len(rows)}] WER={wer:.2f} | Lat={latency_ms:.0f}ms | RTF={res.rtf:.2f}")
        print(f"   Ref: {row['sentence']}")
        print(f"   Hyp: {res.text}")

    macro_wer = (total_S + total_D + total_I) / max(total_N, 1)
    avg_latency = total_latency_ms / max(len(results), 1)
    avg_rtf = (total_latency_ms / 1000.0) / max(total_audio_s, 0.001)

    print("\n================ BENCHMARK SUMMARY ================")
    print(f"Samples Evaluated : {len(results)}")
    print(f"Overall WER       : {macro_wer * 100:.2f}% (S={total_S}, D={total_D}, I={total_I}, N={total_N})")
    print(f"Avg Latency       : {avg_latency:.1f} ms")
    print(f"Global RTF        : {avg_rtf:.3f}")
    print("===================================================\n")

    out_file = os.path.abspath(args.output)
    with open(out_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f, fieldnames=["path", "reference", "hypothesis", "WER", "S", "D", "I", "C", "N", "latency_ms", "RTF"]
        )
        writer.writeheader()
        writer.writerows(results)
    print(f"Detailed CSV results saved to {out_file}")


if __name__ == "__main__":
    main()
