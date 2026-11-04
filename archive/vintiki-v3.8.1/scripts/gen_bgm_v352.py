#!/usr/bin/env python3
"""Quiet unobtrusive ambient BGM for Винтики v3.5.2 (original CC0).
Soft warm pads + sparse felt-piano notes. No drums, no bass thump, no bright lead.
~60 BPM feel, ~150s seamless loop, heavily low-passed, gentle.
"""
import numpy as np
import wave
import subprocess
from pathlib import Path

SR = 44100
DUR = 150.0  # 2.5 minutes
N = int(DUR * SR)
TWO_PI = 2 * np.pi
rng = np.random.default_rng(352)

def midi_hz(m):
    return 440.0 * (2.0 ** ((m - 69) / 12.0))

def one_pole_lpf(x, cutoff_hz):
    """Simple low-pass for warm/dark tone."""
    if cutoff_hz <= 0:
        return x
    rc = 1.0 / (TWO_PI * cutoff_hz)
    dt = 1.0 / SR
    a = dt / (rc + dt)
    y = np.zeros_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += a * (v - acc)
        y[i] = acc
    return y

def env_asr(n, attack, release, sustain=1.0):
    e = np.ones(n, dtype=np.float64) * sustain
    na = min(n, int(attack * SR))
    nr = min(n, int(release * SR))
    if na > 0:
        e[:na] = np.linspace(0, sustain, na, endpoint=False)
    if nr > 0:
        e[-nr:] = np.linspace(sustain, 0, nr, endpoint=True)
    return e

def place(buf, start_s, wave):
    i0 = int(start_s * SR)
    if i0 >= len(buf):
        return
    i1 = min(len(buf), i0 + len(wave))
    buf[i0:i1] += wave[: i1 - i0]

def warm_pad(freqs, dur, amp=0.08, cutoff=520):
    n = max(1, int(dur * SR))
    t = np.arange(n) / SR
    w = np.zeros(n)
    for f in freqs:
        # detuned sine stack (very soft, no buzz)
        w += np.sin(TWO_PI * f * t)
        w += 0.45 * np.sin(TWO_PI * f * 1.002 * t + 0.3)
        w += 0.30 * np.sin(TWO_PI * f * 0.998 * t + 1.1)
        w += 0.18 * np.sin(TWO_PI * (f * 0.5) * t)  # gentle sub octave, quiet
    w /= max(len(freqs), 1)
    w *= env_asr(n, attack=2.8, release=3.5, sustain=1.0)
    w = one_pole_lpf(w, cutoff)
    w = one_pole_lpf(w, cutoff * 0.85)  # darker
    return w * amp

def felt_piano(freq, dur=2.8, amp=0.045):
    """Soft felt / muted piano: quick soft attack, long quiet decay, dark."""
    n = max(1, int(dur * SR))
    t = np.arange(n) / SR
    # fundamental + quiet 2nd, almost no sparkle
    w = (np.sin(TWO_PI * freq * t)
         + 0.22 * np.sin(TWO_PI * freq * 2.0 * t) * np.exp(-t * 2.2)
         + 0.08 * np.sin(TWO_PI * freq * 3.0 * t) * np.exp(-t * 4.0))
    # hammer felt: tiny soft noise blip, heavily filtered
    click_n = int(0.006 * SR)
    click = rng.normal(0, 1, click_n) * np.linspace(1, 0, click_n)
    click = one_pole_lpf(np.pad(click, (0, n - click_n)), 800)[:n]
    w = w * np.exp(-t * 0.55) + click * 0.04
    w *= env_asr(n, attack=0.02, release=min(1.2, dur * 0.4), sustain=1.0)
    w = one_pole_lpf(w, 900)
    w = one_pole_lpf(w, 700)
    return w * amp

def soft_bell(freq, dur=3.5, amp=0.028):
    """Very soft distant bell — sparse color, not bright."""
    n = max(1, int(dur * SR))
    t = np.arange(n) / SR
    w = (np.sin(TWO_PI * freq * t) * np.exp(-t * 0.7)
         + 0.15 * np.sin(TWO_PI * freq * 2.01 * t) * np.exp(-t * 1.4))
    w *= env_asr(n, attack=0.05, release=1.5, sustain=1.0)
    w = one_pole_lpf(w, 1100)
    return w * amp

# Chord palette — slow ambient changes (Cmaj7 / Am9 / Fmaj7 / Gsus / Em7)
# MIDI notes mid register, no low boom
CHORDS = [
    [60, 64, 67, 71],       # Cmaj7  C E G B
    [57, 60, 64, 71],       # Am add9-ish A C E B
    [53, 57, 60, 64],       # Fmaj7  F A C E
    [55, 60, 62, 67],       # Gsus2  G C D G
    [52, 55, 59, 62],       # Em7    E G B D
    [50, 53, 57, 60],       # Dm7    D F A C
]

# ~12.5s per chord → 12 chords over 150s
CHORD_DUR = 12.5
SEQ = [0, 1, 2, 3, 0, 1, 5, 4, 2, 3, 1, 0]  # 12 steps

mix = np.zeros(N, dtype=np.float64)

# Overlapping pads (each chord starts early / rings into next)
for i, ci in enumerate(SEQ):
    t0 = i * CHORD_DUR
    freqs = [midi_hz(m) for m in CHORDS[ci]]
    # slightly quieter octave-down layer already in pad via 0.5f
    place(mix, t0, warm_pad(freqs, CHORD_DUR + 5.0, amp=0.07, cutoff=480))
    # second quieter layer detuned darker
    place(mix, t0 + 0.4, warm_pad([f * 0.997 for f in freqs], CHORD_DUR + 4.5, amp=0.04, cutoff=400))

# Sparse felt-piano / soft bell notes — irregular, no motif
# Pool of gentle mid notes
NOTE_POOL = [60, 62, 64, 67, 69, 71, 72, 74, 76]  # C4..E5
# place ~1 note every 3.5–6.5s, random from pool, never same twice in a row
t = 2.5
last = None
while t < DUR - 4:
    choices = [m for m in NOTE_POOL if m != last]
    m = int(rng.choice(choices))
    last = m
    if rng.random() < 0.72:
        place(mix, t, felt_piano(midi_hz(m), dur=2.6 + rng.random() * 1.2, amp=0.038 + rng.random() * 0.012))
    else:
        place(mix, t, soft_bell(midi_hz(m), dur=3.0 + rng.random(), amp=0.022 + rng.random() * 0.01))
    # occasional soft dyad (quiet)
    if rng.random() < 0.18:
        m2 = m + int(rng.choice([3, 4, 7]))
        place(mix, t + 0.35, felt_piano(midi_hz(m2), dur=2.2, amp=0.02))
    t += 3.5 + rng.random() * 3.0

# Global darkening LPF (vectorized approx via FFT high-cut)
# Use repeated one-pole in chunks for speed on full mix — downsample filter via cumsum trick
def butter_lite(x, passes=4, cutoff=600):
    y = x
    for _ in range(passes):
        y = one_pole_lpf(y, cutoff)
    return y

print('filtering…')
mix = butter_lite(mix, passes=3, cutoff=550)

# Soft limiting / normalize to quiet peak (~0.28) so game vol 0.09 stays gentle
peak = np.max(np.abs(mix)) + 1e-12
mix = mix / peak
mix = np.tanh(mix * 0.9) * 0.95
peak = np.max(np.abs(mix)) + 1e-12
mix = mix / peak * 0.28  # quiet master

# Seamless loop crossfade 1.5s
xf = int(1.5 * SR)
fade = np.linspace(0, 1, xf)
head = mix[:xf].copy()
tail = mix[-xf:].copy()
mix[-xf:] = tail * (1 - fade) + head * fade

# Final peak check — soft ceiling
peak = np.max(np.abs(mix)) + 1e-12
if peak > 0.30:
    mix *= 0.28 / peak

pcm = np.int16(np.clip(mix, -1, 1) * 32767)
out_dir = Path('/workspace/farm-3d/www/assets/audio')
wav_path = out_dir / '_bgm_build.wav'
with wave.open(str(wav_path), 'w') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

ogg = out_dir / 'music_vintiki.ogg'
theme = out_dir / 'music_theme.ogg'
prev_dir = Path('/workspace/farm-3d/shots/v352'); prev_dir.mkdir(parents=True, exist_ok=True)
prev = prev_dir / 'music-preview.mp3'

for dest in (ogg, theme):
    subprocess.check_call(['ffmpeg', '-y', '-i', str(wav_path), '-c:a', 'libvorbis', '-q:a', '5', str(dest)],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
subprocess.check_call(['ffmpeg', '-y', '-i', str(wav_path), '-t', '20', '-codec:a', 'libmp3lame', '-qscale:a', '3', str(prev)],
                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
wav_path.unlink(missing_ok=True)
print('dur', DUR, 'peak', float(np.max(np.abs(mix))), 'rms', float(np.sqrt(np.mean(mix**2))))
print('wrote', ogg, theme, prev)
