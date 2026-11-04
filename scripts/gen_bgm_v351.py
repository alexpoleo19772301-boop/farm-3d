#!/usr/bin/env python3
"""Compose cozy workshop BGM for Винтики v3.5.1 (original CC0).
Melodic kalimba lead + warm pads/bass + soft percussion, 90 BPM, seamless loop.
"""
import numpy as np
from pathlib import Path

SR = 44100
BPM = 90
BEAT = 60.0 / BPM          # 0.666...s
BAR = 4 * BEAT             # 2.666...s
BARS = 32
DUR = BARS * BAR           # ~85.33s
N = int(round(DUR * SR))
TWO_PI = 2 * np.pi

rng = np.random.default_rng(351)

def env_adsr(n, a=0.01, d=0.08, s=0.55, r=0.25, peak=1.0):
    e = np.zeros(n, dtype=np.float64)
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    ns = max(0, n - na - nd - nr)
    i = 0
    if na:
        e[i:i+na] = np.linspace(0, peak, na, endpoint=False); i += na
    if nd:
        e[i:i+nd] = np.linspace(peak, peak * s, nd, endpoint=False); i += nd
    if ns:
        e[i:i+ns] = peak * s; i += ns
    if nr and i < n:
        end = min(n, i + nr)
        e[i:end] = np.linspace(peak * s if ns or nd else peak, 0, end - i, endpoint=True)
    return e

def midi_hz(m):
    return 440.0 * (2.0 ** ((m - 69) / 12.0))

def place(buf, start, wave):
    i0 = int(start)
    i1 = min(len(buf), i0 + len(wave))
    if i0 >= len(buf) or i1 <= i0:
        return
    buf[i0:i1] += wave[: i1 - i0]

def soft_sine(freq, dur, amp=0.2, a=0.02, d=0.1, s=0.5, r=0.3):
    n = max(1, int(dur * SR))
    t = np.arange(n) / SR
    # slight detune chorus
    w = (np.sin(TWO_PI * freq * t)
         + 0.35 * np.sin(TWO_PI * freq * 1.003 * t + 0.2)
         + 0.15 * np.sin(TWO_PI * freq * 0.997 * t))
    return w * env_adsr(n, a, d, s, r) * amp

def kalimba(freq, dur, amp=0.35):
    """Inharmonic plucked / kalimba-like tone."""
    n = max(1, int(dur * SR))
    t = np.arange(n) / SR
    # partials with slight inharmonicity + fast-decaying overtones
    parts = [
        (1.0, 1.00, 0.55),
        (0.55, 2.01, 0.22),
        (0.28, 3.05, 0.14),
        (0.14, 4.12, 0.09),
        (0.08, 5.30, 0.06),
    ]
    w = np.zeros(n)
    for a0, mul, tau in parts:
        w += a0 * np.sin(TWO_PI * freq * mul * t) * np.exp(-t / max(tau * dur, 1e-3))
    # soft click transient
    click_n = int(0.004 * SR)
    w[:click_n] += 0.25 * rng.normal(0, 1, click_n) * np.linspace(1, 0, click_n)
    e = env_adsr(n, a=0.002, d=0.05, s=0.35, r=max(0.15, dur * 0.45), peak=1.0)
    return w * e * amp

def soft_bass(freq, dur, amp=0.28):
    n = max(1, int(dur * SR))
    t = np.arange(n) / SR
    # round sine + sub
    w = np.sin(TWO_PI * freq * t) * 0.85 + np.sin(TWO_PI * (freq * 0.5) * t) * 0.25
    # gentle lowpass via cumulative (cheap)
    w = np.cumsum(w)
    w = w / (np.max(np.abs(w)) + 1e-9)
    return w * env_adsr(n, a=0.03, d=0.12, s=0.7, r=0.35) * amp

def pad_chord(freqs, dur, amp=0.12):
    n = max(1, int(dur * SR))
    t = np.arange(n) / SR
    w = np.zeros(n)
    for f in freqs:
        w += np.sin(TWO_PI * f * t)
        w += 0.4 * np.sin(TWO_PI * f * 1.002 * t + 0.4)
        w += 0.25 * np.sin(TWO_PI * f * 0.5 * t)  # soft fifth/sub
    w /= max(len(freqs), 1)
    return w * env_adsr(n, a=0.25, d=0.3, s=0.65, r=0.5) * amp

def noise_hit(dur, amp=0.08, band='high'):
    n = max(1, int(dur * SR))
    x = rng.normal(0, 1, n)
    if band == 'high':
        # differentiate = brighten
        x = np.diff(x, prepend=x[0])
    else:
        x = np.cumsum(x)
        x = x / (np.max(np.abs(x)) + 1e-9)
    return x * env_adsr(n, a=0.001, d=0.03, s=0.15, r=0.08) * amp

def soft_kick(dur=0.28, amp=0.22):
    n = max(1, int(dur * SR))
    t = np.arange(n) / SR
    f = 90 * np.exp(-t * 12) + 40
    phase = np.cumsum(f) / SR * TWO_PI
    w = np.sin(phase)
    return w * env_adsr(n, a=0.002, d=0.08, s=0.2, r=0.15) * amp

# --- Harmony: C major cozy loop ---
# Progression per 4 bars: I – vi – IV – V   (C – Am – F – G)
# then I – V – vi – IV as second half variation each 8 bars

CHORD_MIDI = {
    'C':  [60, 64, 67],       # C E G
    'Am': [57, 60, 64],       # A C E
    'F':  [53, 57, 60],       # F A C
    'G':  [55, 59, 62],       # G B D
    'Em': [52, 55, 59],       # E G B
    'Dm': [50, 53, 57],       # D F A
}

# 32 bars of chords (1 chord / bar)
PROG = (
    ['C', 'Am', 'F', 'G'] * 2 +          # 8
    ['C', 'G', 'Am', 'F'] * 2 +          # 16
    ['C', 'Am', 'Dm', 'G'] * 2 +         # 24
    ['F', 'G', 'Em', 'Am'] + ['F', 'G', 'C', 'C']  # 32
)
assert len(PROG) == 32

# Lead melody (MIDI), notes as (bar, beat_in_bar, midi, dur_beats)
# Clear memorable motifs
MELODY = []

def add_phrase(bar0, notes):
    """notes: list of (beat_offset_from_bar0, midi, dur_beats)"""
    for beat, m, d in notes:
        MELODY.append((bar0 + beat / 4.0, m, d))  # store as bar-float start? better absolute beat
# Use absolute beats from start
def mel(abs_beat, midi, dur_beats):
    MELODY.append((abs_beat, midi, dur_beats))

# Phrase A (bars 0-3): rising sunny motif
# | E G A G | E D C - | E G C' A | G E D - |
for b in (0, 8, 16):  # repeat motif
    mel(b*4 + 0, 76, 1)   # E5
    mel(b*4 + 1, 79, 1)   # G5
    mel(b*4 + 2, 81, 1)   # A5
    mel(b*4 + 3, 79, 1)   # G5
    mel(b*4 + 4, 76, 1)   # E5
    mel(b*4 + 5, 74, 1)   # D5
    mel(b*4 + 6, 72, 2)   # C5
    mel(b*4 + 8, 76, 1)
    mel(b*4 + 9, 79, 1)
    mel(b*4 + 10, 84, 1)  # C6
    mel(b*4 + 11, 81, 1)
    mel(b*4 + 12, 79, 1)
    mel(b*4 + 13, 76, 1)
    mel(b*4 + 14, 74, 2)

# Phrase B answer (bars 4-7, 12-15, 20-23): softer descent
for b in (4, 12, 20):
    mel(b*4 + 0, 72, 1)   # C5
    mel(b*4 + 1, 74, 1)   # D
    mel(b*4 + 2, 76, 1)   # E
    mel(b*4 + 3, 74, 1)
    mel(b*4 + 4, 72, 1)
    mel(b*4 + 5, 69, 1)   # A4
    mel(b*4 + 6, 67, 2)   # G4
    mel(b*4 + 8, 69, 1)
    mel(b*4 + 9, 72, 1)
    mel(b*4 + 10, 74, 1)
    mel(b*4 + 11, 76, 1)
    mel(b*4 + 12, 74, 1)
    mel(b*4 + 13, 72, 1)
    mel(b*4 + 14, 71, 1)  # B4 leading
    mel(b*4 + 15, 72, 1)

# Final 8 bars (24-31): gentle variation + resolution
mel(24*4 + 0, 77, 1)  # F5
mel(24*4 + 1, 76, 1)
mel(24*4 + 2, 74, 1)
mel(24*4 + 3, 72, 1)
mel(24*4 + 4, 74, 1)
mel(24*4 + 5, 76, 1)
mel(24*4 + 6, 79, 2)
mel(24*4 + 8, 76, 1)
mel(24*4 + 9, 74, 1)
mel(24*4 + 10, 72, 1)
mel(24*4 + 11, 71, 1)
mel(24*4 + 12, 69, 1)
mel(24*4 + 13, 71, 1)
mel(24*4 + 14, 72, 2)

mel(28*4 + 0, 72, 1)
mel(28*4 + 1, 74, 1)
mel(28*4 + 2, 76, 1)
mel(28*4 + 3, 79, 1)
mel(28*4 + 4, 81, 1)
mel(28*4 + 5, 79, 1)
mel(28*4 + 6, 76, 2)
mel(28*4 + 8, 74, 1)
mel(28*4 + 9, 76, 1)
mel(28*4 + 10, 74, 1)
mel(28*4 + 11, 72, 1)
mel(28*4 + 12, 71, 1)
mel(28*4 + 13, 72, 1)
mel(28*4 + 14, 72, 2)  # resolve C

mix = np.zeros(N, dtype=np.float64)

# Pads + bass per bar
for bi, name in enumerate(PROG):
    t0 = bi * BAR
    chord = CHORD_MIDI[name]
    freqs = [midi_hz(m) for m in chord]
    # pad whole bar with slight overlap
    place(mix, t0 * SR, pad_chord(freqs, BAR * 1.05, amp=0.09))
    # bass root on beats 1 and 3
    root = midi_hz(chord[0] - 12)
    place(mix, t0 * SR, soft_bass(root, BEAT * 1.6, amp=0.22))
    place(mix, (t0 + 2 * BEAT) * SR, soft_bass(root * (1.5 if name in ('G', 'Dm') else 1.0), BEAT * 1.4, amp=0.16))
    # soft off-beat guitar-ish plucks on chord tones
    for k, beat in enumerate((1.0, 2.5, 3.5)):
        m = chord[k % 3]
        place(mix, (t0 + beat * BEAT) * SR, kalimba(midi_hz(m - 12), BEAT * 0.9, amp=0.07))

# Lead kalimba melody
for abs_beat, m, dur_b in MELODY:
    t0 = abs_beat * BEAT
    place(mix, t0 * SR, kalimba(midi_hz(m), dur_b * BEAT * 0.95, amp=0.38))

# Soft percussion: kick on 1, soft brush on 2&4, light shaker 16ths occasionally
for bi in range(BARS):
    t0 = bi * BAR
    place(mix, t0 * SR, soft_kick(0.3, amp=0.14))
    place(mix, (t0 + 2 * BEAT) * SR, soft_kick(0.22, amp=0.08))
    for beat in (1.0, 3.0):
        place(mix, (t0 + beat * BEAT) * SR, noise_hit(0.09, amp=0.035, band='high'))
    if bi % 2 == 1:
        place(mix, (t0 + 1.5 * BEAT) * SR, noise_hit(0.06, amp=0.025, band='high'))
    # very soft woodblock-ish every 4 bars
    if bi % 4 == 0:
        place(mix, (t0 + 3.0 * BEAT) * SR, kalimba(midi_hz(84), 0.12, amp=0.06))

# Stereo-ish widening later; for mono first apply reverb (Schroeder-ish)
def simple_reverb(x, delays_ms=(29, 37, 53, 67), decays=(0.28, 0.24, 0.2, 0.17), wet=0.28):
    y = x.copy()
    for d_ms, dec in zip(delays_ms, decays):
        d = int(d_ms * SR / 1000)
        echo = np.zeros_like(x)
        echo[d:] = x[:-d] * dec
        y += echo
    # one longer wash
    d2 = int(0.12 * SR)
    wash = np.zeros_like(x)
    wash[d2:] = x[:-d2] * 0.18
    # cheap lowpass wash
    wash = np.convolve(wash, np.ones(64) / 64, mode='same')
    y += wash
    return (1 - wet) * x + wet * y

mix = simple_reverb(mix, wet=0.32)

# Soft tape-ish saturation
mix = np.tanh(mix * 1.15) * 0.92

# Seamless loop crossfade: last 40ms <-> first 40ms
xf = int(0.04 * SR)
if xf > 0:
    fade = np.linspace(0, 1, xf)
    head = mix[:xf].copy()
    tail = mix[-xf:].copy()
    mix[-xf:] = tail * (1 - fade) + head * fade
    # also blend start slightly toward end for continuity
    mix[:xf] = head * fade + tail * (1 - fade) * 0.0 + head * (1)  # keep head; tail already blended
    # Better classic approach: only blend end into start material
    mix[-xf:] = tail * (1 - fade) + head * fade

# Normalize to ~-16 LUFS-ish peak ~0.55
peak = np.max(np.abs(mix)) + 1e-9
mix = mix / peak * 0.55

# Very gentle high rolloff
k = 120
ker = np.ones(k) / k
mix_lp = np.convolve(mix, ker, mode='same')
mix = 0.82 * mix + 0.18 * mix_lp

peak = np.max(np.abs(mix)) + 1e-9
mix = mix / peak * 0.52

out_dir = Path('/workspace/farm-3d/www/assets/audio')
out_dir.mkdir(parents=True, exist_ok=True)
pcm = np.int16(np.clip(mix, -1, 1) * 32767)

# write raw wav via scipy-less wave module
import wave, struct
wav_path = out_dir / 'music_vintiki.wav'
with wave.open(str(wav_path), 'w') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', wav_path, 'dur', DUR, 'samples', N)

# also OGG via ffmpeg
ogg_path = out_dir / 'music_vintiki.ogg'
import subprocess
subprocess.check_call([
    'ffmpeg', '-y', '-i', str(wav_path),
    '-c:a', 'libvorbis', '-q:a', '5', str(ogg_path)
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print('wrote', ogg_path)

# 20s preview mp3 for QA
prev_dir = Path('/workspace/farm-3d/shots/v351')
prev_dir.mkdir(parents=True, exist_ok=True)
prev = prev_dir / 'music-preview.mp3'
# take first 20s
subprocess.check_call([
    'ffmpeg', '-y', '-i', str(wav_path), '-t', '20',
    '-codec:a', 'libmp3lame', '-qscale:a', '3', str(prev)
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print('wrote', prev)

# also keep theme ogg updated as alias copy
subprocess.check_call(['ffmpeg', '-y', '-i', str(wav_path), '-c:a', 'libvorbis', '-q:a', '5',
                       str(out_dir / 'music_theme.ogg')],
                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print('done')
