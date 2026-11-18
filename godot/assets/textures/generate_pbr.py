#!/usr/bin/env python3
"""Derive tangent-space normal and roughness maps from the albedo textures.

This is a deterministic, offline pass: height is the blurred luminance of the
albedo, normals come from its Sobel gradients, and roughness is driven by local
contrast so flat areas read rougher and detailed areas catch more specular.

Usage:
    python3 godot/assets/textures/generate_pbr.py [--size 1024] [--strength 2.5]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ENV_DIR = Path(__file__).resolve().parent / "environment"
SKIP_SUFFIXES = ("_normal.jpg", "_roughness.jpg")


def load_height(path: Path, size: int) -> np.ndarray:
    image = Image.open(path).convert("L").resize((size, size), Image.LANCZOS)
    return np.asarray(image, dtype=np.float32) / 255.0


def normal_map(height: np.ndarray, strength: float) -> Image.Image:
    smooth = np.asarray(
        Image.fromarray((height * 255).astype(np.uint8)).filter(
            ImageFilter.GaussianBlur(radius=2)
        ),
        dtype=np.float32,
    ) / 255.0
    dy, dx = np.gradient(smooth)
    nx = -dx * strength
    ny = dy * strength
    nz = np.ones_like(nx)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    nx, ny, nz = nx / length, ny / length, nz / length
    rgb = np.stack([nx, ny, nz], axis=-1) * 0.5 + 0.5
    return Image.fromarray((rgb * 255).clip(0, 255).astype(np.uint8), "RGB")


def roughness_map(height: np.ndarray) -> Image.Image:
    dy, dx = np.gradient(height)
    detail = np.sqrt(dx * dx + dy * dy)
    # Normalise contrast, then invert: flat surfaces rough, detailed ones smoother.
    scale = np.percentile(detail, 95) or 1.0
    detail = np.clip(detail / scale, 0.0, 1.0)
    rough = np.clip(0.92 - 0.42 * detail, 0.0, 1.0)
    return Image.fromarray((rough * 255).astype(np.uint8), "L")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--size", type=int, default=1024)
    parser.add_argument("--strength", type=float, default=2.5)
    args = parser.parse_args()

    sources = sorted(
        p for p in ENV_DIR.glob("*.jpg") if not p.name.endswith(SKIP_SUFFIXES)
    )
    if not sources:
        print(f"no albedo textures found in {ENV_DIR}", file=sys.stderr)
        return 1

    for path in sources:
        height = load_height(path, args.size)
        normal_map(height, args.strength).save(
            path.with_name(f"{path.stem}_normal.jpg"), quality=92
        )
        roughness_map(height).save(
            path.with_name(f"{path.stem}_roughness.jpg"), quality=92
        )
        print(f"pbr {path.name}")

    print(f"{len(sources)} textures processed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
