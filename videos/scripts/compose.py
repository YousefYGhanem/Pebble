"""The launch film's music, composed in code (so it is entirely Pebble's: no licence to track).

120 BPM, D minor (Dm - Bb - F - C), 13 bars of 2 s = 26 s, laid on the film's own grid (src/launch/cues.ts):
  bar 1      pad and a soft pluck (Pip wakes)
  bar 2      the kick and hats come in (an agent works)
  bars 3-10  the full groove: kick, clap, hats, bass, pad, pluck arpeggio; brighter from bar 5 (music)
  bar 10     a riser into the ending
  bar 11     the drums drop out (the island leaves)
  bars 12-13 one big chord and a chime for the name, ringing out
plus quiet UI sounds on the island's changes and the click (times from the cues).

  uv run --with numpy --with scipy python scripts/compose.py   -> public/audio/launch.wav
"""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
import wave, os

SR = 44100
BPM = 120
BEAT = 60 / BPM
BAR = 4 * BEAT
BARS = 13
N = int(SR * BARS * BAR)
rng = np.random.default_rng(7)


def b(bar, beat=1, frac=0.0):
    return (bar - 1) * BAR + (beat - 1 + frac) * BEAT


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def lp(x, hz, order=2):
    return sosfilt(butter(order, hz / (SR / 2), 'low', output='sos'), x)


def hp(x, hz, order=2):
    return sosfilt(butter(order, hz / (SR / 2), 'high', output='sos'), x)


def env(n, a, d, s, r, hold):
    """ADSR over n samples: attack a, decay d to sustain s, hold, release r (seconds)."""
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), 1.0)
    e = np.where((t >= a) & (t < a + d), 1 - (1 - s) * (t - a) / max(d, 1e-4), e)
    e = np.where((t >= a + d) & (t < hold), s, e)
    e = np.where(t >= hold, s * np.exp(-(t - hold) / max(r, 1e-4)), e)
    return e


def put(out, x, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= out.shape[1]:
        return
    x = x[: out.shape[1] - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    out[0, i:i + len(x)] += x * gain * l * 1.41
    out[1, i:i + len(x)] += x * gain * r * 1.41


def saw(f, n, detune=0.0):
    t = np.arange(n) / SR
    v = np.zeros(n)
    for d in (-detune, 0, detune):
        ph = (t * f * (1 + d) + rng.random()) % 1.0
        v += 2 * ph - 1
    return v / 3


# ---------- instruments ----------

def kick(level=1.0):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 46 + 120 * np.exp(-t * 32)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    click = lp(rng.standard_normal(n), 3000) * np.exp(-t * 180) * 0.25
    return (body + click) * level


def hat(open_=False):
    n = int((0.22 if open_ else 0.06) * SR)
    t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 7500, 3) * np.exp(-t * (14 if open_ else 70))
    return x * 0.35


def clap():
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    noise = sosfilt(butter(2, [900 / (SR / 2), 4200 / (SR / 2)], 'band', output='sos'), rng.standard_normal(n))
    e = np.exp(-t * 18) + 0.6 * np.exp(-np.abs(t - 0.012) * 300) + 0.5 * np.exp(-np.abs(t - 0.024) * 300)
    return noise * e * 0.5


def bass(note, length):
    n = int(length * SR)
    f = midi(note)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.35 * lp(saw(f, n), 400)
    return x * env(n, 0.005, 0.12, 0.7, 0.08, length - 0.06) * 0.55


def pad(notes, length, bright=1200):
    n = int(length * SR)
    x = sum(saw(midi(m), n, 0.004) for m in notes) / len(notes)
    x = lp(x, bright, 2)
    return x * env(n, 0.35, 0.4, 0.8, 0.6, length - 0.2) * 0.42


def pluck(note, bright=3200, level=1.0):
    n = int(0.6 * SR)
    f = midi(note)
    t = np.arange(n) / SR
    x = saw(f, n, 0.002) * 0.6 + 0.4 * np.sin(2 * np.pi * f * 2 * t)
    x = lp(x, bright, 2) * np.exp(-t * 7)
    return x * 0.3 * level


def chime(note):
    n = int(2.6 * SR)
    t = np.arange(n) / SR
    f = midi(note)
    x = sum(a * np.sin(2 * np.pi * f * k * t) * np.exp(-t * (1.6 + k)) for k, a in ((1, 1), (2.01, 0.4), (3.98, 0.15)))
    return x * 0.22


def riser(length):
    n = int(length * SR)
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    # a sweep: the band rises as the level does
    out = np.zeros(n)
    steps = 24
    for k in range(steps):
        a, z = k * n // steps, (k + 1) * n // steps
        lo = 300 + 5000 * (k / steps) ** 2
        out[a:z] = sosfilt(butter(2, [lo / (SR / 2), min(lo * 2.2, 18000) / (SR / 2)], 'band', output='sos'), x[a:z])
    return out * (t / length) ** 2 * 0.35


def pop(freq=900):
    """a soft UI pop: the island changes shape"""
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    f = freq * (1 + 0.6 * np.exp(-t * 40))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 32) * 0.22


def tick():
    """the click on a button"""
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 2000) * np.exp(-t * 160) * 0.35 + np.sin(2 * np.pi * 2200 * t) * np.exp(-t * 120) * 0.15


# ---------- the song ----------

PROG = [  # per bar: (pad chord, bass root) in D minor: Dm, Bb, F, C
    ([62, 65, 69, 74], 38), ([58, 62, 65, 70], 34), ([60, 65, 69, 72], 41), ([60, 64, 67, 72], 36),
]
ARP = [0, 2, 1, 3, 2, 1, 3, 2]  # an index into the chord, per eighth

music = np.zeros((2, N))
fx = np.zeros((2, N))

for bar in range(1, BARS + 1):
    chord, root = PROG[(bar - 1) % 4]
    if bar <= 11:
        put(music, pad(chord, BAR + 0.4, 900 if bar < 5 else 1500), b(bar), 0.9)
    # pluck: sparse in bar 1, an arpeggio from bar 3, brighter from 5 (music)
    if bar == 1:
        for beat, i in ((2, 0), (3, 2), (4, 3)):
            put(music, pluck(chord[i] + 12, 2400, 0.8), b(bar, beat), 1.0, 0.25)
    elif 3 <= bar <= 10:
        for e in range(8):
            note = chord[ARP[e]] + 12
            put(music, pluck(note, 2600 if bar < 5 else 4200, 0.75 if e % 2 else 1.0), b(bar, 1 + e // 2, 0.5 * (e % 2)), 1.0, -0.3 if e % 2 else 0.3)
    # drums
    if 2 <= bar <= 10:
        for beat in range(1, 5):
            put(music, kick(0.8 if bar == 2 else 1.0), b(bar, beat), 0.9)
            put(music, hat(), b(bar, beat, 0.5), 0.8, 0.4)
            if bar >= 3 and beat in (2, 4):
                put(music, clap(), b(bar, beat), 0.8, -0.1)
        if bar >= 5:
            put(music, hat(True), b(bar, 4, 0.5), 0.6, -0.4)
    # bass from bar 3: root on the beat, octave on the "and"
    if 3 <= bar <= 10:
        for beat in range(1, 5):
            put(music, bass(root, BEAT * 0.45), b(bar, beat), 1.0)
            put(music, bass(root + 12, BEAT * 0.3), b(bar, beat, 0.5), 0.55)

# the riser into the ending, the drop to the pad, the big chord and chime for the name
put(fx, riser(BAR), b(10), 0.9)
put(music, pad([50, 57, 62, 65, 69, 74], 2 * BAR + 2.5, 2200), b(12), 1.25)
put(music, bass(26, 2 * BAR), b(12), 1.0)
put(music, kick(1.1), b(12), 1.0)
for i, note in enumerate((74, 81, 86)):
    put(fx, chime(note), b(12, 1 + i, 0.0) + 0.02, 0.9, (-0.3, 0.3, 0.0)[i])

# UI sounds on the film's cues (src/launch/cues.ts)
for at, f in ((b(2), 820), (b(3), 980), (b(4, 3), 760), (b(5), 880), (b(5, 3), 1000), (b(7), 940), (b(8, 2), 1180), (b(9), 900), (b(11), 700)):
    put(fx, pop(f), at, 1.0)
put(fx, tick(), b(4), 1.0)

# ---------- mix ----------

mix = music * 0.8 + fx

# a soft room: a decaying noise impulse, low-passed (stereo, decorrelated)
irn = int(1.8 * SR)
it = np.arange(irn) / SR
for ch in range(2):
    ir = lp(rng.standard_normal(irn), 5000) * np.exp(-it * 3.2) * 0.04
    ir[0] = 1.0
    mix[ch] = fftconvolve(mix[ch], ir)[:N]

mix = hp(mix, 30)
# glue: a gentle tanh, then normalise to -1 dBFS peak
mix = np.tanh(mix * 1.3) / np.tanh(1.3)
mix *= 10 ** (-1 / 20) / np.max(np.abs(mix))
# fade the very end
fade = int(1.2 * SR)
mix[:, -fade:] *= np.linspace(1, 0, fade) ** 2

os.makedirs('public/audio', exist_ok=True)
with wave.open('public/audio/launch.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix.T * 32767).astype('<i2').tobytes())
print('public/audio/launch.wav', round(N / SR, 2), 's')
