#!/usr/bin/env python3
"""Dead Air FMV audio beds -- DEA-201.

Generates two original stems with no third-party samples, so the licence is
ours outright (CC0 / project-owned):

  fmv_static_bed.wav   radio static, tape hiss, crackle, tuning whistle
  fmv_theme_bed.wav    low drone, sub thumps, chase pulse, single piano note

Both are 48 kHz / stereo / 60 s, deterministic (fixed seeds), jointly
normalised to -14 LUFS integrated (ITU-R BS.1770-4, gated) with true peak
<= -1 dBTP, matching the web/social delivery target in DEA-201.

The stems are timed to the trailer beat map recorded on DEA-200:
  boot 0-3 | ON AIR 3-6.5 | booth 6.5-10.5 | Suit teaser 10.5-14
  bunker 14-20 | liminal 20-26 | street 26-31 | chase 31-41.5
  blackout/tuning 41.5-47 | title card 47-60

Usage:
  python3 scripts/fmv/make_audio_bed.py --out scripts/fmv/out

Requires numpy and scipy (the generate step is build-time only; the rendered
WAVs are the deliverable and are imported into the HyperFrames project).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, lfilter, resample_poly, sosfilt, sawtooth

SR = 48_000
DUR = 60.0
N = int(SR * DUR)
TARGET_LUFS = -14.0
TRUE_PEAK_DBTP = -1.0

SEC = {
    "boot": (0.0, 3.0),
    "on_air": (3.0, 6.5),
    "booth": (6.5, 10.5),
    "suit_teaser": (10.5, 14.0),
    "bunker": (14.0, 20.0),
    "liminal": (20.0, 26.0),
    "street": (26.0, 31.0),
    "chase": (31.0, 41.5),
    "blackout": (41.5, 47.0),
    "title": (47.0, 60.0),
}

rng = np.random.default_rng(20261120)


def seconds(n: int) -> np.ndarray:
    return np.arange(n, dtype=np.float64) / SR


def automation(points, n: int = N) -> np.ndarray:
    """Piecewise-linear automation curve with smoothstep easing between points."""
    ts = np.array([p[0] for p in points], dtype=np.float64)
    vs = np.array([p[1] for p in points], dtype=np.float64)
    t = seconds(n)
    out = np.empty(n, dtype=np.float64)
    for i in range(n):
        x = t[i]
        if x <= ts[0]:
            out[i] = vs[0]
        elif x >= ts[-1]:
            out[i] = vs[-1]
        else:
            k = int(np.searchsorted(ts, x) - 1)
            span = ts[k + 1] - ts[k]
            u = 0.0 if span <= 0 else (x - ts[k]) / span
            u = u * u * (3.0 - 2.0 * u)
            out[i] = vs[k] + (vs[k + 1] - vs[k]) * u
    return out


def band_noise(n: int, lo: float, hi: float, order: int = 4, seed: int = 0) -> np.ndarray:
    r = np.random.default_rng(seed)
    white = r.standard_normal(n)
    nyq = SR / 2.0
    sos = butter(order, [lo / nyq, hi / nyq], btype="band", output="sos")
    x = np.asarray(sosfilt(sos, white), dtype=np.float64)
    peak = np.max(np.abs(x)) or 1.0
    return x / peak


def highpass(x: np.ndarray, cutoff: float, order: int = 2) -> np.ndarray:
    sos = butter(order, cutoff / (SR / 2.0), btype="high", output="sos")
    return np.asarray(sosfilt(sos, x), dtype=np.float64)


def lowpass(x: np.ndarray, cutoff: float, order: int = 2) -> np.ndarray:
    sos = butter(order, cutoff / (SR / 2.0), btype="low", output="sos")
    return np.asarray(sosfilt(sos, np.asarray(x, dtype=np.float64)), dtype=np.float64)


def decay_burst(n: int, freq: float, decay: float, drop_to: float | None = None) -> np.ndarray:
    """Sine hit whose pitch can fall (thump) with an exponential amplitude decay."""
    t = seconds(n)
    if drop_to is None:
        phase = 2.0 * np.pi * freq * t
    else:
        glide = np.minimum(t / 0.18, 1.0)
        f = freq + (drop_to - freq) * glide
        phase = 2.0 * np.pi * np.cumsum(f) / SR
    return np.sin(phase) * np.exp(-t / decay)


def build_static() -> tuple[np.ndarray, np.ndarray]:
    left = np.zeros(N)
    right = np.zeros(N)

    # Bedded band-limited static (the "open carrier" hiss), decorrelated L/R.
    hiss_l = band_noise(N, 380.0, 3600.0, seed=11)
    hiss_r = band_noise(N, 380.0, 3600.0, seed=12)

    # Tape hiss: thin high band, always present under the bed.
    tape_l = lowpass(highpass(np.random.default_rng(13).standard_normal(N), 5_200.0), 15_000.0)
    tape_r = lowpass(highpass(np.random.default_rng(14).standard_normal(N), 5_200.0), 15_000.0)
    tape_l /= np.max(np.abs(tape_l))
    tape_r /= np.max(np.abs(tape_r))

    # Crackle: sparse impulses through a short resonant decay.
    def crackle(seed: int, density: float) -> np.ndarray:
        r = np.random.default_rng(seed)
        out = np.zeros(N)
        count = int(density * DUR)
        for _ in range(count):
            idx = r.integers(0, N - 4000)
            amp = r.uniform(0.05, 0.35)
            out[idx:idx + 4000] += decay_burst(4000, r.uniform(900, 4200), 0.004) * amp
        return out

    crack_l = crackle(21, 7.0)
    crack_r = crackle(22, 7.0)

    # Heterodyne whistle: a slow beating carrier high above the bed.
    t = seconds(N)
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * 0.07 * t + 1.1)
    whistle = 0.55 * np.sin(2 * np.pi * (1_260.0 + 32.0 * np.sin(2 * np.pi * 0.043 * t)) * t)
    whistle += 0.45 * np.sin(2 * np.pi * 1_291.0 * t)
    whistle *= lfo

    # Envelope: the bed follows the scene beats, dropping out at cuts.
    bed = automation([
        (0.0, 0.00), (0.35, 0.50), (0.9, 0.10),
        (2.95, 0.00), (3.02, 0.45), (6.4, 0.50),
        (6.55, 0.32), (10.35, 0.34), (10.55, 0.05), (10.85, 0.62),
        (14.0, 0.30), (14.4, 0.28), (19.9, 0.28),
        (20.02, 0.30), (25.9, 0.32),
        (26.05, 0.34), (30.9, 0.34),
        (31.02, 0.48), (41.35, 0.62), (41.55, 0.26),
        (47.0, 0.10), (47.35, 0.30), (52.0, 0.16), (59.6, 0.04), (60.0, 0.0),
    ])

    # Random carrier dropouts inside the quiet scenes.
    mask = np.ones(N)
    r = np.random.default_rng(31)
    for _ in range(180):
        idx = r.integers(0, N - SR // 8)
        width = r.integers(SR // 80, SR // 12)
        mask[idx:idx + width] *= r.uniform(0.15, 0.7)

    left += (hiss_l * 0.75 + tape_l * 0.2 + crack_l + whistle * 0.3) * bed * mask
    right += (hiss_r * 0.75 + tape_r * 0.2 + crack_r + whistle * 0.3) * bed * mask

    # Start-of-trailer CRT power-on thump + ON AIR relay click.
    for t0, amp in ((0.32, 0.55), (3.02, 0.35), (6.5, 0.22), (14.02, 0.3)):
        start = int(t0 * SR)
        length = min(SR, N - start)
        hit = decay_burst(length, 62.0, 0.09, drop_to=38.0) * amp
        left[start:start + length] += hit
        right[start:start + length] += hit

    # Tuning sweep through the blackout: heterodyne slides 2.4 kHz -> 300 Hz.
    a, b = int(SEC["blackout"][0] * SR), int(SEC["blackout"][1] * SR)
    m = b - a
    tt = seconds(m)
    glide = np.exp(-tt / 2.1)
    f = 300.0 + 2_100.0 * glide
    phase = 2 * np.pi * np.cumsum(f) / SR
    sweep_env = automation([(0.0, 0.0), (0.5, 0.55), (3.0, 0.5), (5.2, 0.0)], m)
    sweep = np.sin(phase) * sweep_env
    hiss_sweep = band_noise(m, 600.0, 5000.0, seed=41) * sweep_env * 0.5
    left[a:b] += sweep * 0.35 + hiss_sweep * 0.4
    right[a:b] += np.roll(sweep, 37) * 0.35 + np.roll(hiss_sweep, 53) * 0.4

    return left, right


def build_theme() -> tuple[np.ndarray, np.ndarray]:
    t = seconds(N)

    # Low drone: sub + root/fifth stack with slow independent beating.
    def lfo(rate: float, phase: float) -> np.ndarray:
        return 0.5 + 0.5 * np.sin(2 * np.pi * rate * t + phase)

    sub = np.sin(2 * np.pi * 27.5 * t) * (0.55 + 0.45 * lfo(0.031, 0.0))
    root = np.sin(2 * np.pi * 55.0 * t) * (0.55 + 0.45 * lfo(0.047, 1.7))
    det = np.sin(2 * np.pi * 55.35 * t) * (0.4 + 0.6 * lfo(0.071, 2.9))
    fifth = np.sin(2 * np.pi * 82.5 * t) * (0.35 + 0.65 * lfo(0.053, 4.2))
    octave = np.sin(2 * np.pi * 110.0 * t) * (0.2 + 0.8 * lfo(0.089, 0.6))

    # A filtered saw one octave down keeps the drone from sounding pure sine.
    saw = np.asarray(sawtooth(2 * np.pi * 36.71 * t), dtype=np.float64)
    saw = lowpass(saw, 220.0, order=4)

    drone_env = automation([
        (0.0, 0.00), (3.0, 0.05), (6.5, 0.14), (10.5, 0.34),
        (14.0, 0.42), (20.0, 0.40), (26.0, 0.36), (31.0, 0.52),
        (41.4, 0.68), (41.75, 0.04), (47.15, 0.04), (47.5, 0.55),
        (56.0, 0.45), (59.4, 0.10), (60.0, 0.0),
    ])

    drone = (sub * 0.14 + root * 0.5 + det * 0.35 + fifth * 0.28 + octave * 0.16 + saw * 0.12)
    drone *= drone_env

    # Chase pulse: 2.2 Hz heartbeat kick plus a noise tick on the off-beat.
    pulse_env = automation([(0.0, 0.0), (30.9, 0.0), (31.05, 1.0), (41.2, 1.0), (41.6, 0.0)])
    beat = (t - SEC["chase"][0] + 0.12) % (1.0 / 2.2)
    kick = np.sin(2 * np.pi * 48.0 * np.maximum(beat, 0.0)) * np.exp(-beat / 0.055)
    kick *= pulse_env

    # Sub thumps on the cuts.
    thumps = np.zeros(N)
    for t0, amp in ((3.02, 0.5), (10.55, 0.55), (14.05, 0.6), (20.02, 0.55),
                    (26.05, 0.5), (31.02, 0.7), (34.5, 0.4), (38.0, 0.45), (41.45, 0.8)):
        start = int(t0 * SR)
        length = min(int(0.9 * SR), N - start)
        thumps[start:start + length] += decay_burst(length, 54.0, 0.22, drop_to=33.0) * amp

    # Single piano note on the title card: additive harmonics, hammer noise.
    piano = np.zeros(N)
    start = int((SEC["title"][0] + 0.6) * SR)
    length = N - start
    pt = seconds(length)
    note = np.zeros(length)
    for harm, gain, decay in ((1, 1.0, 3.4), (2, 0.45, 2.0), (3, 0.22, 1.3),
                              (4, 0.12, 0.9), (6, 0.06, 0.55)):
        note += gain * np.sin(2 * np.pi * 220.0 * harm * pt) * np.exp(-pt / decay)
    attack = np.minimum(pt / 0.008, 1.0)
    note *= attack
    hammer = band_noise(length, 1_500.0, 6_000.0, seed=51) * np.exp(-pt / 0.012) * 0.12
    piano[start:] = (note + hammer) * 0.5

    left = drone + kick * 0.5 + thumps * 0.55 + piano
    right = drone * 0.97 + np.roll(kick, 0) * 0.5 + thumps * 0.55 + piano

    # Widen the drone slightly without moving the sub off-centre.
    left += np.roll(drone, 11) * 0.08 - drone * 0.08
    right -= np.roll(drone, 17) * 0.08 - drone * 0.08

    return left, right


def kweight(x: np.ndarray) -> np.ndarray:
    assert SR == 48_000, "K-weighting coefficients below are for 48 kHz"
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
    a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, -1.99004745483398, 0.99007225036621]
    filtered = lfilter(b1, a1, x, axis=0)
    return np.asarray(lfilter(b2, a2, filtered, axis=0), dtype=np.float64)


def integrated_lufs(stereo: np.ndarray) -> float:
    weighted = kweight(stereo)
    block = int(0.4 * SR)
    hop = int(0.1 * SR)
    starts = range(0, len(weighted) - block, hop)
    block_means = np.array([
        np.sum(np.mean(weighted[s:s + block] ** 2, axis=0)) for s in starts
    ])
    with np.errstate(divide="ignore"):
        loud = -0.691 + 10.0 * np.log10(np.maximum(block_means, 1e-20))
    gated = block_means[loud > -70.0]
    if gated.size == 0:
        return -math.inf
    rel = -0.691 + 10.0 * np.log10(np.mean(gated)) - 10.0
    gated = block_means[(loud > -70.0) & (loud > rel)]
    return float(-0.691 + 10.0 * np.log10(np.mean(gated)))


def true_peak_db(stereo: np.ndarray) -> float:
    oversampled = resample_poly(stereo, 4, 1, axis=0)
    return float(20.0 * math.log10(max(np.max(np.abs(oversampled)), 1e-12)))


def compress(stereo: np.ndarray, threshold_db: float = -20.0, ratio: float = 3.0,
             attack_ms: float = 8.0, release_ms: float = 200.0) -> np.ndarray:
    """Peak-following compressor so the mix can reach -14 LUFS under a -1 dBTP ceiling."""
    peak = np.max(np.abs(stereo), axis=1)
    attack = math.exp(-1.0 / (attack_ms / 1000.0 * SR))
    release = math.exp(-1.0 / (release_ms / 1000.0 * SR))
    envelope = np.empty_like(peak)
    state = 0.0
    for i in range(len(peak)):
        coef = attack if peak[i] > state else release
        state = coef * state + (1.0 - coef) * peak[i]
        envelope[i] = state
    over_db = np.maximum(20.0 * np.log10(np.maximum(envelope, 1e-9)) - threshold_db, 0.0)
    gain_db = -over_db * (1.0 - 1.0 / ratio)
    return stereo * (10.0 ** (gain_db / 20.0))[:, None]


def soft_clip(stereo: np.ndarray, knee: float = 0.62, ceiling: float = 0.87) -> np.ndarray:
    """Transparent peak limiter: linear below the knee, tanh shoulder up to the ceiling."""
    magnitude = np.abs(stereo)
    shaped = np.where(
        magnitude > knee,
        knee + (ceiling - knee) * np.tanh((magnitude - knee) / (ceiling - knee)),
        magnitude,
    )
    return np.sign(stereo) * shaped


def master(stems: dict[str, np.ndarray]) -> tuple[np.ndarray, float, dict[str, float]]:
    bus = compress(highpass(np.sum(list(stems.values()), axis=0), 32.0, order=2))
    gain_db = TARGET_LUFS - integrated_lufs(bus)
    master_bus = soft_clip(bus * 10 ** (gain_db / 20.0))
    for _ in range(5):
        delta = TARGET_LUFS - integrated_lufs(master_bus)
        if abs(delta) < 0.15:
            break
        gain_db += delta
        master_bus = soft_clip(bus * 10 ** (gain_db / 20.0))
    master_bus = np.clip(master_bus, -1.0, 1.0)
    return master_bus, gain_db, {
        "gain_db": round(gain_db, 3),
        "integrated_lufs": round(integrated_lufs(master_bus), 2),
        "true_peak_dbtp": round(true_peak_db(master_bus), 2),
    }


def write_wav(path: Path, stereo: np.ndarray) -> str:
    # 16-bit PCM keeps the import portable; dither is irrelevant at these levels.
    pcm = np.clip(stereo, -1.0, 1.0)
    pcm = (pcm * 32767.0).astype(np.int16)
    wavfile.write(path, SR, pcm)
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", default="scripts/fmv/out", help="output directory")
    args = ap.parse_args()

    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)

    static_l, static_r = build_static()
    theme_l, theme_r = build_theme()
    stems = {
        "static": np.stack([static_l, static_r], axis=1),
        "theme": np.stack([theme_l, theme_r], axis=1),
    }
    # Keep the sum inside range before loudness work.
    peak = max(np.max(np.abs(s)) for s in stems.values())
    if peak > 0.95:
        stems = {k: v * (0.95 / peak) for k, v in stems.items()}

    # Sit the drone under the static bed so the carrier stays audible on phone speakers.
    stems["theme"] *= 0.7
    master_bus, gain_db, stats = master(stems)

    manifest = {
        "generator": "scripts/fmv/make_audio_bed.py",
        "seed": 20261120,
        "sample_rate": SR,
        "duration_seconds": DUR,
        "channels": 2,
        "bit_depth": 16,
        "target_lufs": TARGET_LUFS,
        "true_peak_limit_dbtp": TRUE_PEAK_DBTP,
        "measured": stats,
        "license": "Original synthesis, no third-party samples. Project-owned (CC0).",
        "stems": {},
    }
    applied = 10 ** (gain_db / 20.0)
    for name, audio in stems.items():
        premaster = np.clip(audio * applied, -1.0, 1.0)
        path = out / f"fmv_{name}_premaster.wav"
        manifest["stems"][name] = {
            "file": path.name,
            "sha256": write_wav(path, premaster),
            "note": "premaster reference, compressed and limited only in the master",
        }

    master_path = out / "deadair_fmv_audio_60s.wav"
    manifest["master"] = {"file": master_path.name, "sha256": write_wav(master_path, master_bus)}

    (out / "fmv_audio_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
