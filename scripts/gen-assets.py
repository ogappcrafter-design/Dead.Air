#!/usr/bin/env python3
"""Generate Dead Air Radio's app assets as real PNGs (no image libraries available).

Everything here is geometry: the DEAD AIR mark is a diamond-in-diamond (the game's
"diamond" glyph), and the wordmark uses a hand-rolled 5x7 bitmap font so the splash
matches the in-game monospace/CRT aesthetic.
"""
import zlib, struct, base64, os

AMBER = (0xFF, 0x8C, 0x00)
BG = (0x05, 0x05, 0x05)


def new(w, h, rgba=(0, 0, 0, 0)):
    return [[list(rgba) for _ in range(w)] for _ in range(h)]


def write_png(path, px):
    h, w = len(px), len(px[0])
    raw = bytearray()
    for row in px:
        raw.append(0)  # filter type 0
        for p in row:
            raw += bytes(p)
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)
    return path


def blend(dst, color, a):
    """Alpha-composite `color` at coverage `a` (0..1) over dst pixel in place."""
    if a <= 0:
        return
    a = min(1.0, a)
    sa = a
    da = dst[3] / 255.0
    oa = sa + da * (1 - sa)
    for i in range(3):
        s = color[i] / 255.0
        d = dst[i] / 255.0
        dst[i] = int(round(((s * sa + d * da * (1 - sa)) / oa if oa else 0) * 255))
    dst[3] = int(round(oa * 255))


def diamond(px, cx, cy, radius, thickness, color, glow=True):
    """|x|+|y| diamond: filled core plus an outline ring, with optional amber glow."""
    h, w = len(px), len(px[0])
    inner_r = radius * 0.34
    ring_out, ring_in = radius, radius - thickness
    for y in range(h):
        for x in range(w):
            d = abs(x + 0.5 - cx) + abs(y + 0.5 - cy)
            cov = 0.0
            if d <= inner_r:                      # solid inner diamond
                cov = 1.0
            elif ring_in <= d <= ring_out:        # outline ring
                cov = 1.0
            # antialias both edges by one pixel of distance
            elif d < inner_r + 1.5:
                cov = max(cov, 1.0 - (d - inner_r) / 1.5)
            elif ring_out < d < ring_out + 1.5:
                cov = max(cov, 1.0 - (d - ring_out) / 1.5)
            elif ring_in - 1.5 < d < ring_in:
                cov = max(cov, 1.0 - (ring_in - d) / 1.5)
            if cov > 0:
                blend(px[y][x], color, cov)
            elif glow and d < radius * 1.55:      # soft signal bloom
                g = (1.0 - (d - ring_out) / (radius * 0.55)) * 0.13
                if g > 0:
                    blend(px[y][x], color, g)


def scanlines(px, period=8, strength=0.10, only_opaque=True):
    for y in range(0, len(px), period):
        for x in range(len(px[0])):
            p = px[y][x]
            if only_opaque and p[3] == 0:
                continue
            for i in range(3):
                p[i] = int(p[i] * (1 - strength))


def vignette(px, strength=0.55):
    h, w = len(px), len(px[0])
    cx, cy = w / 2, h / 2
    maxd = (cx ** 2 + cy ** 2) ** 0.5
    for y in range(h):
        for x in range(w):
            d = (((x - cx) ** 2 + (y - cy) ** 2) ** 0.5) / maxd
            f = max(0.0, (d - 0.45) / 0.55) ** 2 * strength
            p = px[y][x]
            if p[3] == 0:
                continue
            for i in range(3):
                p[i] = int(p[i] * (1 - f))


# ── 5x7 bitmap font, only the glyphs "DEAD AIR" needs ──────────────────────────
FONT = {
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    " ": ["00000"] * 7,
}


def text(px, s, x0, y0, scale, color, tracking=2):
    cursor = x0
    for ch in s:
        rows = FONT[ch]
        for ry, row in enumerate(rows):
            for rx, bit in enumerate(row):
                if bit != "1":
                    continue
                for dy in range(scale):
                    for dx in range(scale):
                        X, Y = cursor + rx * scale + dx, y0 + ry * scale + dy
                        if 0 <= Y < len(px) and 0 <= X < len(px[0]):
                            blend(px[Y][X], color, 1.0)
        cursor += (5 + tracking) * scale
    return cursor


def text_width(s, scale, tracking=2):
    return len(s) * (5 + tracking) * scale - tracking * scale


OUT = os.environ.get("ASSET_DIR", "assets")
os.makedirs(OUT, exist_ok=True)

# ── icon.png — 1024 square, opaque, full CRT treatment ────────────────────────
S = 1024
icon = new(S, S, (*BG, 255))
diamond(icon, S / 2, S / 2, S * 0.34, S * 0.055, AMBER)
vignette(icon)
scanlines(icon, period=8, strength=0.11)
write_png(f"{OUT}/icon.png", icon)

# ── adaptive-icon.png — transparent foreground, glyph inside the 66% safe zone ─
ad = new(S, S)
diamond(ad, S / 2, S / 2, S * 0.235, S * 0.040, AMBER, glow=False)
write_png(f"{OUT}/adaptive-icon.png", ad)

# ── splash.png — transparent, mark over the DEAD AIR wordmark ─────────────────
W, H = 1024, 1024
sp = new(W, H)
diamond(sp, W / 2, H * 0.40, W * 0.15, W * 0.026, AMBER)
scale = 9
word = "DEAD AIR"
tw = text_width(word, scale)
text(sp, word, int((W - tw) / 2), int(H * 0.60), scale, AMBER)
# hairline rule under the wordmark
ry = int(H * 0.60) + 7 * scale + 40
for x in range(int((W - tw) / 2), int((W + tw) / 2)):
    blend(sp[ry][x], (0x44, 0x44, 0x44), 1.0)
write_png(f"{OUT}/splash.png", sp)

# ── favicon.png — 64px, opaque ────────────────────────────────────────────────
F = 64
fav = new(F, F, (*BG, 255))
diamond(fav, F / 2, F / 2, F * 0.36, F * 0.075, AMBER, glow=False)
write_png(f"{OUT}/favicon.png", fav)

# ── scanline tile — 1x3 px, one dark row; RN repeats this for the CRT overlay ─
tile = new(1, 3)
tile[0][0] = [0, 0, 0, 46]
b64 = base64.b64encode(open(write_png("/tmp/_scan.png", tile), "rb").read()).decode()
print("SCANLINE_B64=" + b64)
for f in ("icon.png", "adaptive-icon.png", "splash.png", "favicon.png"):
    print(f"{f}: {os.path.getsize(f'{OUT}/{f}')} bytes")
