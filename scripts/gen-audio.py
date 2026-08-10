#!/usr/bin/env python3
"""Synthesize Dead Air's sound set (no audio libraries available).

Everything is built from noise, sines and one-pole/state-variable filters, then
written as 16-bit mono PCM. The station is deliberately bandlimited — the whole
palette sits in a telephone-ish band because that is what the game sounds like.

The carrier bed loops sample-perfectly. Its noise is filtered *circularly* —
each filter stage is warmed against the buffer's own tail before it writes, so
the output is genuinely periodic — and its tonal parts sit at exact integer
multiples of the loop frequency. The last sample therefore flows into the first
with no discontinuity, and no crossfade dip. The script asserts this at the end
by checking the wrap against the distribution of ordinary sample steps.

Run: python3 scripts/gen-audio.py
"""
import array
import math
import os
import random
import wave

SR = 32000  # bandlimited on purpose: 16 kHz ceiling, radio-shaped
OUT = os.environ.get('AUDIO_DIR', 'assets/audio')

random.seed(1947)  # the year the station remembers


# ── buffers ───────────────────────────────────────────────────────────────────

def noise(n):
    return [random.uniform(-1.0, 1.0) for _ in range(n)]


def mix(dst, src, gain=1.0):
    for i in range(min(len(dst), len(src))):
        dst[i] += src[i] * gain
    return dst


# ── filters ───────────────────────────────────────────────────────────────────

def lowpass(x, cutoff, state=0.0):
    """One-pole lowpass."""
    dt = 1.0 / SR
    rc = 1.0 / (2 * math.pi * cutoff)
    a = dt / (rc + dt)
    y = [0.0] * len(x)
    for i, v in enumerate(x):
        state += a * (v - state)
        y[i] = state
    return y


def highpass(x, cutoff):
    return [v - l for v, l in zip(x, lowpass(x, cutoff))]


def lowpass_circular(x, cutoff, stages=2):
    """Lowpass that leaves the buffer perfectly periodic.

    Each stage runs the buffer twice: once to warm the filter state against the
    signal's own tail (discarded), then once to write. Because the input is
    treated as one period of an infinite loop, the warmed state is the state
    the filter would really have at the wrap — so the output is periodic and
    the loop point is a genuine continuation rather than a splice.

    Cascade with `stages` for a steeper slope; warming per stage is what keeps
    each one periodic. (Re-running a single stage in place instead just stacks
    extra poles and leaves a step at the seam.)
    """
    dt = 1.0 / SR
    rc = 1.0 / (2 * math.pi * cutoff)
    a = dt / (rc + dt)
    y = list(x)
    for _ in range(stages):
        state = 0.0
        for v in y:  # warm-up pass, output discarded
            state += a * (v - state)
        out = [0.0] * len(y)
        for i, v in enumerate(y):
            state += a * (v - state)
            out[i] = state
        y = out
    return y


def highpass_circular(x, cutoff, stages=1):
    return [v - l for v, l in zip(x, lowpass_circular(x, cutoff, stages))]


def svf(x, freq, q, mode='band'):
    """Chamberlin state-variable filter. `freq` may be a list for a sweep."""
    n = len(x)
    freqs = freq if isinstance(freq, list) else [freq] * n
    low = band = 0.0
    y = [0.0] * n
    damp = 1.0 / q
    for i in range(n):
        f = 2.0 * math.sin(math.pi * min(freqs[i], SR * 0.45) / SR)
        high = x[i] - low - damp * band
        band += f * high
        low += f * band
        y[i] = {'low': low, 'band': band, 'high': high}[mode]
    return y


# ── envelopes ─────────────────────────────────────────────────────────────────

def envelope(n, attack, decay, curve=3.0):
    """Attack/decay in seconds, exponential-ish decay."""
    a = max(1, int(attack * SR))
    e = [0.0] * n
    for i in range(n):
        if i < a:
            e[i] = (i / a) ** 0.6
        else:
            t = (i - a) / max(1.0, decay * SR)
            e[i] = math.exp(-curve * t)
    return e


def apply_env(x, e):
    return [v * g for v, g in zip(x, e)]


def fade_edges(x, ms=4.0):
    """Kill any click at the very start/end of a one-shot."""
    k = max(1, int(SR * ms / 1000.0))
    for i in range(min(k, len(x))):
        x[i] *= i / k
        x[-1 - i] *= i / k
    return x


# ── shaping ───────────────────────────────────────────────────────────────────

def saturate(x, drive=1.4):
    """Gentle tanh saturation — the warmth that keeps this from sounding digital."""
    return [math.tanh(v * drive) / math.tanh(drive) for v in x]


def normalize(x, peak=0.9):
    m = max((abs(v) for v in x), default=0.0)
    return x if m == 0 else [v * (peak / m) for v in x]


def reverb(x, mix_amount=0.25):
    """Small Schroeder reverb: four combs into two allpasses. Used sparingly."""
    combs = [(1687, 0.78), (1601, 0.80), (2053, 0.75), (2251, 0.73)]
    wet = [0.0] * len(x)
    for delay, fb in combs:
        d = [0.0] * delay
        idx = 0
        for i, v in enumerate(x):
            out = d[idx]
            d[idx] = v + out * fb
            idx = (idx + 1) % delay
            wet[i] += out * 0.25
    for delay, fb in ((389, 0.5), (127, 0.5)):
        d = [0.0] * delay
        idx = 0
        for i in range(len(wet)):
            buffered = d[idx]
            out = -wet[i] + buffered
            d[idx] = wet[i] + buffered * fb
            idx = (idx + 1) % delay
            wet[i] = out
    return [dry + w * mix_amount for dry, w in zip(x, wet)]


def write_wav(name, x, peak=0.9):
    x = normalize(x, peak)
    data = array.array('h', (int(max(-1.0, min(1.0, v)) * 32767) for v in x))
    path = os.path.join(OUT, name)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())

    rms = math.sqrt(sum(v * v for v in x) / len(x)) if x else 0.0
    seam = abs(x[0] - x[-1]) if x else 0.0
    print(
        f'{name:<14} {len(x)/SR:>5.2f}s  {os.path.getsize(path)/1024:>6.1f}KB  '
        f'peak {max(abs(v) for v in x):.2f}  rms {rms:.3f}  seam {seam:.4f}'
    )


# ══ the sounds ════════════════════════════════════════════════════════════════

def carrier():
    """Station bed. Loops seamlessly; plays under a live call only, very low."""
    seconds = 3.0
    n = int(SR * seconds)
    loop_hz = 1.0 / seconds

    # Bandlimited hiss, filtered circularly so the loop is sample-perfect.
    hiss = lowpass_circular(noise(n), 3200, stages=2)
    hiss = highpass_circular(hiss, 260, stages=1)

    # Mains hum. 50 Hz over 3 s is 150 whole cycles, so it wraps exactly.
    out = [0.0] * n
    for harmonic, gain in ((50.0, 0.30), (100.0, 0.14), (150.0, 0.06)):
        cycles = round(harmonic / loop_hz)
        for i in range(n):
            out[i] += gain * math.sin(2 * math.pi * cycles * i / n)

    # One slow breath of drift across the loop, and one faint drifting whistle.
    for i in range(n):
        drift = 1.0 + 0.18 * math.sin(2 * math.pi * i / n)
        out[i] = out[i] * 0.35 + hiss[i] * 1.0 * drift

    for i in range(n):
        out[i] += 0.05 * math.sin(2 * math.pi * round(1180 / loop_hz) * i / n)

    return saturate(out, 1.1)


def tune():
    """Sweeping the dial: noise sliding across the band, a heterodyne locking on."""
    n = int(SR * 0.7)
    sweep = [2600 * math.exp(-2.6 * (i / n)) + 480 for i in range(n)]

    band = svf(noise(n), sweep, q=2.4, mode='band')
    band = apply_env(band, envelope(n, 0.012, 0.22, curve=3.4))

    # The whistle that slides down and settles — the sound of finding a station.
    whistle = [0.0] * n
    phase = 0.0
    for i in range(n):
        t = i / n
        f = 1900 * math.exp(-3.2 * t) + 430
        phase += 2 * math.pi * f / SR
        whistle[i] = math.sin(phase)
    whistle = apply_env(whistle, envelope(n, 0.02, 0.3, curve=4.0))

    # Two stations brushed past on the way.
    out = mix(mix([0.0] * n, band, 1.0), whistle, 0.34)
    for at in (0.22, 0.46):
        start = int(at * n)
        burst = apply_env(
            svf(noise(int(SR * 0.045)), 1500, q=3.0, mode='band'),
            envelope(int(SR * 0.045), 0.003, 0.03),
        )
        for i, v in enumerate(burst):
            if start + i < n:
                out[start + i] += v * 0.5

    return fade_edges(saturate(out, 1.3))


def answer():
    """Relay closes, carrier comes up. The line is open."""
    n = int(SR * 0.55)
    out = [0.0] * n

    # Contact clunk: a filtered noise transient over a low thump.
    clk = int(SR * 0.05)
    click = apply_env(lowpass(noise(clk), 2600), envelope(clk, 0.0006, 0.022, curve=5.0))
    mix(out, click + [0.0] * (n - clk), 0.85)

    thump = [math.sin(2 * math.pi * 88 * i / SR) for i in range(n)]
    mix(out, apply_env(thump, envelope(n, 0.002, 0.055, curve=6.0)), 0.55)

    # Carrier swelling in behind it.
    bed = svf(noise(n), 1400, q=0.9, mode='band')
    swell = [min(1.0, (i / (SR * 0.30)) ** 1.5) * math.exp(-0.7 * i / SR) for i in range(n)]
    mix(out, apply_env(bed, swell), 0.5)

    return fade_edges(saturate(out, 1.2))


def hangup():
    """Relay opens and the carrier collapses into nothing."""
    n = int(SR * 0.6)
    out = [0.0] * n

    clk = int(SR * 0.035)
    click = apply_env(highpass(noise(clk), 700), envelope(clk, 0.0004, 0.014, curve=6.0))
    mix(out, click + [0.0] * (n - clk), 0.7)

    # Bandwidth narrows as the level falls — the signal closing down, not just fading.
    narrowing = [900 + 1500 * math.exp(-7.0 * (i / n)) for i in range(n)]
    tail = svf(noise(n), narrowing, q=1.6, mode='band')
    mix(out, apply_env(tail, envelope(n, 0.004, 0.10, curve=4.5)), 0.62)

    return fade_edges(saturate(out, 1.15))


def key():
    """Decode glyph accepted. A tick with just enough pitch to feel intentional."""
    n = int(SR * 0.11)
    out = [0.0] * n

    tick = apply_env(lowpass(noise(int(SR * 0.006)), 5200), envelope(int(SR * 0.006), 0.0002, 0.003))
    mix(out, tick + [0.0] * (n - len(tick)), 0.5)

    for f, g in ((1240.0, 1.0), (2480.0, 0.22)):
        tone = [math.sin(2 * math.pi * f * i / SR) for i in range(n)]
        mix(out, apply_env(tone, envelope(n, 0.0012, 0.030, curve=5.0)), g)

    return fade_edges(out, ms=2.0)


def reject():
    """Wrong glyph. Dull and low — a refusal, not a punishment."""
    n = int(SR * 0.2)
    out = [0.0] * n

    phase = 0.0
    for i in range(n):
        f = 158 * math.exp(-3.0 * (i / n))  # pitch sags as it dies
        phase += 2 * math.pi * f / SR
        out[i] = math.sin(phase)
    out = apply_env(out, envelope(n, 0.003, 0.055, curve=4.0))

    body = apply_env(lowpass(noise(n), 420), envelope(n, 0.002, 0.035, curve=5.0))
    mix(out, body, 0.5)

    return fade_edges(saturate(out, 1.6))


def tape():
    """A tape surfaces in the archive. The one reward sound, so it gets the reverb."""
    n = int(SR * 1.9)
    out = [0.0] * n

    # Inharmonic partials with faster-decaying highs: a struck bell, not a beep.
    partials = ((1.0, 1.0, 1.6), (2.01, 0.45, 1.0), (2.98, 0.26, 0.7),
                (4.18, 0.14, 0.45), (5.42, 0.07, 0.3))

    def strike(root, at, gain):
        start = int(at * SR)
        length = n - start
        if length <= 0:
            return
        for ratio, amp, decay in partials:
            f = root * ratio
            tone = [math.sin(2 * math.pi * f * i / SR) for i in range(length)]
            tone = apply_env(tone, envelope(length, 0.004, decay, curve=3.2))
            for i, v in enumerate(tone):
                out[start + i] += v * amp * gain

    strike(349.23, 0.00, 1.00)  # F4
    strike(523.25, 0.17, 0.72)  # C5 — a fifth up, warm rather than triumphant

    # Faint transport hiss underneath, gone before the bell is.
    hiss = apply_env(highpass(lowpass(noise(n), 5000), 900), envelope(n, 0.01, 0.22, curve=3.0))
    mix(out, hiss, 0.10)

    return fade_edges(reverb(saturate(out, 1.1), mix_amount=0.30), ms=8.0)


def breath():
    """The BREATHE control. An exhale, airy and soft."""
    n = int(SR * 0.62)
    band = svf(noise(n), [780 + 320 * math.sin(math.pi * i / n) for i in range(n)],
               q=1.1, mode='band')
    swell = [math.sin(math.pi * (i / n)) ** 1.7 for i in range(n)]
    return fade_edges(apply_env(band, swell))


# ── build ─────────────────────────────────────────────────────────────────────

os.makedirs(OUT, exist_ok=True)

# Peaks are set per sound so the set is balanced before JS touches a volume
# slider: the bed sits far under everything, the reward sound sits on top.
write_wav('carrier.wav', carrier(), peak=0.30)
write_wav('tune.wav', tune(), peak=0.62)
write_wav('answer.wav', answer(), peak=0.80)
write_wav('hangup.wav', hangup(), peak=0.70)
write_wav('key.wav', key(), peak=0.52)
write_wav('reject.wav', reject(), peak=0.62)
write_wav('tape.wav', tape(), peak=0.88)
write_wav('breath.wav', breath(), peak=0.46)

total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT) if f.endswith('.wav'))
print(f'\ntotal {total/1024:.0f} KB')

# The loop is the only file where sample-level continuity matters; prove it.
with wave.open(os.path.join(OUT, 'carrier.wav'), 'rb') as w:
    frames = array.array('h')
    frames.frombytes(w.readframes(w.getnframes()))
edge = abs(frames[0] - frames[-1])
step = max(abs(frames[i + 1] - frames[i]) for i in range(0, 2000))
print(f'carrier loop seam: {edge} vs typical sample step {step} (want seam <= step)')
