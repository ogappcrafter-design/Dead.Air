#!/usr/bin/env python3
"""Post-process generated FLUX images into the shipped texture pack.

Takes the raw model output in --src (one <id>.jpg per manifest asset) and
writes review-ready files under --out, mirroring each asset's manifest path:

* seamless assets get a roll-plus-feather wrap so opposite edges line up
* every asset is fitted to its declared size with a centred cover crop
* PNG assets (the app icons) are saved as PNG, everything else as JPEG

Nothing is written into the repository: --out is a staging root, and the
install step copies the staged tree over the manifest paths.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter
import numpy as np

REPO = Path(__file__).resolve().parents[3]
MANIFEST = Path(__file__).resolve().parent / "manifest.json"


def parse_size(text: str) -> tuple[int, int]:
    w, h = text.lower().split("x")
    return int(w), int(h)


def cover_crop(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    tw, th = size
    w, h = img.size
    scale = max(tw / w, th / h)
    if scale != 1.0:
        img = img.resize((max(tw, round(w * scale)), max(th, round(h * scale))), Image.LANCZOS)
    w, h = img.size
    left = (w - tw) // 2
    top = (h - th) // 2
    return img.crop((left, top, left + tw, top + th))


def feather_mask(size: tuple[int, int], ramp: float = 0.18) -> Image.Image:
    w, h = size
    span = max(1, int(min(w, h) * ramp))
    mask = Image.new("L", size, 255)
    edge = Image.new("L", size, 0)
    px = edge.load()
    for x in range(span):
        v = int(255 * x / span)
        for y in range(h):
            px[x, y] = v
            px[w - 1 - x, y] = v
    px2 = edge.load()
    for y in range(span):
        v = int(255 * y / span)
        for x in range(w):
            px2[x, y] = min(px2[x, y], v)
            px2[x, h - 1 - y] = min(px2[x, h - 1 - y], v)
    return Image.composite(mask, edge, edge.filter(ImageFilter.GaussianBlur(span / 3)))


def make_seamless(img: Image.Image) -> tuple[Image.Image, str]:
    """Keep whichever of the original and a feathered roll scores lower on seam_energy."""
    w, h = img.size
    shifted = ImageChops.offset(img, w // 2, h // 2)
    mask = feather_mask((w, h))
    blended = ImageChops.offset(Image.composite(shifted, img, mask), -(w // 2), -(h // 2))
    raw_score = seam_energy(img)
    blend_score = seam_energy(blended)
    affordable = seam_gap(blended) <= max(seam_gap(img) * 1.2, seam_gap(img) + 2.0)
    if affordable and blend_score < raw_score:
        return blended, f"rolled {raw_score:.1f}->{blend_score:.1f}"
    return img, f"kept original {raw_score:.1f} gap {seam_gap(blended):.1f}"


def seam_energy(img: Image.Image) -> float:
    """Wrap-around edge gap plus the worst line the tile carries relative to its own gradient noise."""
    a = np.asarray(img, dtype=float)
    spikes = []
    for diffs in (np.abs(np.diff(a, axis=0)).mean(axis=(1, 2)), np.abs(np.diff(a, axis=1)).mean(axis=(0, 2))):
        spikes.append(max(0.0, float(diffs.max() - np.median(diffs))))
    return seam_gap(img) + max(spikes)


def seam_gap(img: Image.Image) -> float:
    a = np.asarray(img, dtype=float)
    return float(abs(a[:, 0] - a[:, -1]).mean() + abs(a[0, :] - a[-1, :]).mean()) / 2


def contact_sheet(paths: list[Path], out: Path, tile: int = 420, cols: int = 4) -> Path:
    rows = (len(paths) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tile, rows * tile), (24, 24, 24))
    for i, p in enumerate(paths):
        img = Image.open(p).convert("RGB")
        img.thumbnail((tile - 8, tile - 8), Image.LANCZOS)
        x = (i % cols) * tile + (tile - img.width) // 2
        y = (i // cols) * tile + (tile - img.height) // 2
        sheet.paste(img, (x, y))
    sheet.save(out, quality=88)
    return out


def derive_app_assets(icon: Image.Image, out_root: Path, manifest: dict) -> list[Path]:
    """Build the icon derivatives the store listings need from the generated icon."""
    paths = {a["id"]: Path(a["path"]) for a in manifest["assets"] if a["id"].startswith("app")}
    corners = [icon.getpixel((0, 0)), icon.getpixel((icon.width - 1, 0)), icon.getpixel((0, icon.height - 1))]
    mat = tuple(sorted(c[i] for c in corners)[1] for i in range(3))
    written: list[Path] = []

    adaptive = Image.new("RGB", (1024, 1024), mat)
    inset = icon.copy()
    inset.thumbnail((676, 676), Image.LANCZOS)
    adaptive.paste(inset, ((1024 - inset.width) // 2, (1024 - inset.height) // 2))
    derived = {"app_adaptive_icon": adaptive, "app_favicon": icon.resize((48, 48), Image.LANCZOS)}

    if "app_splash" in paths:
        w, h = parse_size(next(a["size"] for a in manifest["assets"] if a["id"] == "app_splash"))
        splash = Image.new("RGB", (w, h), mat)
        logo = icon.copy()
        logo.thumbnail((int(w * 0.42), int(w * 0.42)), Image.LANCZOS)
        splash.paste(logo, ((w - logo.width) // 2, (h - logo.height) // 2))
        derived["app_splash"] = splash

    for aid, img in derived.items():
        if aid not in paths:
            continue
        dest = out_root / paths[aid]
        dest.parent.mkdir(parents=True, exist_ok=True)
        img.save(dest)
        written.append(dest)
    return written


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--src", required=True, help="directory of raw <id>.jpg model output")
    ap.add_argument("--out", required=True, help="staging root that mirrors manifest paths")
    ap.add_argument("--only", nargs="*", help="restrict to these asset ids")
    ap.add_argument("--sheet", help="also write contact sheets into this directory")
    args = ap.parse_args()

    manifest = json.loads(MANIFEST.read_text())
    src = Path(args.src)
    out_root = Path(args.out)
    wanted = set(args.only or [])
    done: list[Path] = []
    missing: list[str] = []

    for asset in manifest["assets"]:
        aid = asset["id"]
        if wanted and aid not in wanted:
            continue
        raw = src / f"{aid}.jpg"
        if not raw.exists():
            if not aid.startswith("app_"):
                missing.append(aid)
            continue
        img = Image.open(raw).convert("RGB")
        size = parse_size(asset["size"])
        note = ""
        if asset.get("seamless"):
            img = cover_crop(img, size)
            img, note = make_seamless(img)
        else:
            img = cover_crop(img, size)
        dest = out_root / asset["path"]
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.suffix.lower() == ".png":
            img.save(dest)
        else:
            img.save(dest, quality=92)
        done.append(dest)
        print(f"pp   {aid:22s} {size[0]}x{size[1]} {note}")

    if args.sheet:
        sheets = Path(args.sheet)
        sheets.mkdir(parents=True, exist_ok=True)
        groups = {
            "environment": [p for p in done if "/environment/" in str(p)],
            "props": [p for p in done if "/props/" in str(p)],
            "keyart": [p for p in done if "/keyart/" in str(p)],
            "app": [p for p in done if p.parent.name == "assets"],
        }
        for name, paths in groups.items():
            if paths:
                contact_sheet(paths, sheets / f"{name}.jpg")
                print(f"sheet {name}: {len(paths)} images")

    if missing:
        print(f"missing raw output for: {', '.join(missing)}", file=sys.stderr)
    icon = out_root / "assets" / "icon.png"
    if icon.exists():
        for extra in derive_app_assets(Image.open(icon).convert("RGB"), out_root, manifest):
            print(f"pp   {extra.relative_to(out_root).as_posix()}  derived from app_icon")
    print(f"{len(done)} assets staged into {out_root}")
    return 0 if not missing else 1


if __name__ == "__main__":
    raise SystemExit(main())
