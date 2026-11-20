#!/usr/bin/env python3
"""render_masters.py — DEA-202 delivery-master + runtime-clip builder for the
Dead Air FMV trailer.

Takes the HyperFrames/OpenMotion export (H.264 + AAC, silent-composition
already carrying the DEA-201 score bed) and produces:

  build/fmv/deadair_fmv_60s_h264.mp4    H.264 high-profile MP4 for social/web
  build/fmv/deadair_fmv_60s_prores.mov  ProRes 4444 MOV for compositing
  godot/assets/fmv/deadair_intro.ogv    Ogg Theora runtime clip for
                                        VideoStreamPlayer (Godot 4 ships only
                                        the Theora decoder)

Usage:
  python3 scripts/fmv/render_masters.py \
      --source "/path/to/Dead Air - FMV Intro & Trailer.mp4" \
      --intro-seconds 15

Verification is part of the script: each artifact is re-probed with ffprobe and
the loudness of the MP4 is measured with ffmpeg's ebur128 filter (−14 LUFS
± 0.3 target, true peak ≤ −1 dBTP).
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
BUILD_DIR = REPO_ROOT / "build" / "fmv"
RUNTIME_CLIP = REPO_ROOT / "godot" / "assets" / "fmv" / "deadair_intro.ogv"

TARGET_LUFS = -14.0
LUFS_TOLERANCE = 0.3
MAX_TRUE_PEAK_DBTP = -1.0


def run(cmd: list[str]) -> str:
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(
            f"command failed ({result.returncode}): {' '.join(cmd)}\n{result.stderr[-2000:]}"
        )
    return result.stdout + result.stderr


def probe(path: Path) -> dict[str, Any]:
    out = run(
        [
            "ffprobe", "-v", "error", "-print_format", "json",
            "-show_format", "-show_streams", str(path),
        ]
    )
    return json.loads(out)


def measure_loudness(path: Path) -> tuple[float, float]:
    out = run(
        [
            "ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
            "-filter_complex", "ebur128=peak=true", "-f", "null", "-",
        ]
    )
    tail = out[-4000:]
    integrated = re.findall(r"I:\s+(-?\d+(?:\.\d+)?) LUFS", tail)
    peak = re.findall(r"Peak:\s+(-?\d+(?:\.\d+)?) dBFS", tail)
    if not integrated or not peak:
        raise RuntimeError("could not parse ebur128 summary")
    return float(integrated[-1]), float(peak[-1])


def encode_h264(source: Path, out: Path) -> None:
    run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
            "-c:v", "libx264", "-preset", "slow", "-crf", "16",
            "-profile:v", "high", "-level", "4.1", "-pix_fmt", "yuv420p",
            "-r", "30", "-g", "60",
            "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2",
            "-movflags", "+faststart", str(out),
        ]
    )


def encode_prores(source: Path, out: Path) -> None:
    # Full-frame composition -> the resulting alpha channel is opaque; the 4444
    # profile is kept so compositing tools get a lossless 4:4:4:4 timeline clip.
    run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
            "-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le",
            "-vendor", "apl0", "-r", "30",
            "-c:a", "pcm_s24le", "-ar", "48000", "-ac", "2", str(out),
        ]
    )


def encode_runtime_clip(source: Path, out: Path, seconds: float) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
            "-t", f"{seconds:g}",
            "-c:v", "libtheora", "-q:v", "6",
            "-c:a", "libvorbis", "-q:a", "5", "-ar", "48000", "-ac", "2",
            str(out),
        ]
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, help="OpenMotion exported MP4")
    parser.add_argument("--intro-seconds", type=float, default=15.0)
    parser.add_argument("--skip-runtime-clip", action="store_true")
    args = parser.parse_args()

    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        print("ffmpeg/ffprobe not found on PATH", file=sys.stderr)
        return 2

    source = Path(args.source).expanduser().resolve()
    if not source.is_file():
        print(f"source not found: {source}", file=sys.stderr)
        return 2

    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    mp4 = BUILD_DIR / "deadair_fmv_60s_h264.mp4"
    mov = BUILD_DIR / "deadair_fmv_60s_prores.mov"

    print(f"[1/4] H.264 MP4 -> {mp4}")
    encode_h264(source, mp4)
    print(f"[2/4] ProRes 4444 MOV -> {mov}")
    encode_prores(source, mov)

    if not args.skip_runtime_clip:
        print(f"[3/4] Godot runtime clip -> {RUNTIME_CLIP}")
        encode_runtime_clip(source, RUNTIME_CLIP, args.intro_seconds)

    print("[4/4] Verifying artifacts")
    report: dict[str, Any] = {}
    lufs, peak = measure_loudness(mp4)
    report["loudness"] = {"integrated_lufs": lufs, "true_peak_dbtp": peak}
    failures: list[str] = []
    if abs(lufs - TARGET_LUFS) > LUFS_TOLERANCE:
        failures.append(f"integrated loudness {lufs} LUFS outside {TARGET_LUFS}±{LUFS_TOLERANCE}")
    if peak > MAX_TRUE_PEAK_DBTP:
        failures.append(f"true peak {peak} dBTP above {MAX_TRUE_PEAK_DBTP}")

    for label, path in (("mp4", mp4), ("mov", mov), ("runtime", RUNTIME_CLIP)):
        if label == "runtime" and args.skip_runtime_clip:
            continue
        info = probe(path)
        video = next(s for s in info["streams"] if s["codec_type"] == "video")
        audio = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
        entry = {
            "path": str(path.relative_to(REPO_ROOT)),
            "bytes": int(info["format"]["size"]),
            "duration_s": float(info["format"]["duration"]),
            "video": {
                "codec": video["codec_name"],
                "width": video["width"],
                "height": video["height"],
                "fps": video["r_frame_rate"],
            },
            "audio": None if audio is None else {
                "codec": audio["codec_name"],
                "channels": audio["channels"],
                "sample_rate": audio["sample_rate"],
            },
        }
        if video["width"] != 1920 or video["height"] != 1080:
            failures.append(f"{label}: {video['width']}x{video['height']} instead of 1920x1080")
        if audio is None:
            failures.append(f"{label}: no audio stream")
        report[label] = entry
        print(f"  {label}: {entry['duration_s']:.3f}s {video['codec_name']} "
              f"{video['width']}x{video['height']} {video['r_frame_rate']}fps "
              f"audio={'none' if audio is None else audio['codec_name']}")

    manifest = BUILD_DIR / "render_manifest.json"
    manifest.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"\nmanifest -> {manifest}")
    print(f"loudness: {lufs} LUFS integrated, {peak} dBTP true peak")

    if failures:
        for f in failures:
            print(f"FAIL: {f}", file=sys.stderr)
        return 1
    print("OK: masters verified")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
