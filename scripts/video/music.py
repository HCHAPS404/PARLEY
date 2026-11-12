"""
Original, copyright-free soundtrack for the Parley demo — synthesized from
scratch (no samples, no third-party audio), so there is nothing to license.

    uv run --with numpy scripts/video/music.py <seconds> <out.wav>

Ambient-corporate bed, 100 BPM, Cmaj7 – Am9 – Fmaj7 – G6sus progression:
warm detuned-saw pads + soft pluck arpeggio with ping-pong delay + sub bass,
a felt kick and airy hats that enter after the intro, synthetic-plate reverb,
gentle tanh glue. Energy rises over the first ~20 s and resolves at the end.
"""
import sys
import wave

import numpy as np

SR = 48_000
BPM = 100
BEAT = 60 / BPM
BAR = 4 * BEAT
rng = np.random.default_rng(7)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


# chord voicings (MIDI), two bars each
PROG = [
    [48, 55, 59, 64, 67],  # Cmaj7  C G B E G
    [45, 52, 55, 60, 71],  # Am9    A E G C B
    [41, 48, 52, 57, 64],  # Fmaj7  F C E A E
    [43, 50, 55, 57, 62],  # G6sus  G D G A D
]
ARP = [  # pluck notes per chord (octave up, rising/falling motif)
    [72, 76, 79, 83, 79, 76, 74, 76],
    [69, 72, 76, 79, 76, 72, 71, 72],
    [65, 69, 72, 76, 72, 69, 67, 69],
    [67, 71, 74, 79, 74, 71, 69, 74],
]


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    b = 1 - a
    for i in range(len(x)):  # small loop only used on short buffers
        acc = b * x[i] + a * acc
        y[i] = acc
    return y


def onepole_fast(x, cutoff):
    """Vectorised one-pole via FFT-domain response (fine for long pads)."""
    n = len(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    h = 1 / np.sqrt(1 + (f / cutoff) ** 4)  # ~2-pole slope, zero phase
    return np.fft.irfft(np.fft.rfft(x) * h, n)


def saw(freq, t, phase=0.0):
    return 2 * ((freq * t + phase) % 1.0) - 1


def env_adsr(n, a, r):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    na, nr = min(na, n // 2), min(nr, n // 2)
    e[:na] = np.linspace(0, 1, na) ** 2
    e[n - nr:] *= np.linspace(1, 0, nr) ** 2
    return e


def render(seconds):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    L = np.zeros(n)
    R = np.zeros(n)

    def add(sig, start, gain=1.0, pan=0.0):
        s = int(start * SR)
        if s >= n:
            return
        e = min(n, s + len(sig))
        seg = sig[: e - s] * gain
        L[s:e] += seg * np.cos((pan + 1) * np.pi / 4)
        R[s:e] += seg * np.sin((pan + 1) * np.pi / 4)

    # global energy automation: 0→1 over 18 s, hold, fall over last 6 s
    energy = np.clip(t / 18, 0.25, 1.0) * np.clip((seconds - t) / 6, 0, 1)

    chord_len = 2 * BAR
    k = 0
    while k * chord_len < seconds:
        start = k * chord_len
        ch = PROG[k % 4]
        dur = chord_len + 1.2  # overlap tails for legato
        m = int(dur * SR)
        tt = np.arange(m) / SR
        # --- pad: 3 detuned saws per note, stereo spread
        padL = np.zeros(m)
        padR = np.zeros(m)
        for note in ch:
            f = midi(note)
            for det, side in ((-0.12, -1), (0.0, 0), (0.12, 1)):
                v = saw(f * 2 ** (det / 12), tt, rng.random())
                if side <= 0:
                    padL += v
                if side >= 0:
                    padR += v
        e = env_adsr(m, 1.4, 1.6)
        padL = onepole_fast(padL * e, 2300) * 0.016
        padR = onepole_fast(padR * e, 2300) * 0.016
        s = int(start * SR)
        ee = min(n, s + m)
        L[s:ee] += padL[: ee - s]
        R[s:ee] += padR[: ee - s]

        # --- sub bass: root, pulsing on quarters
        root = midi(ch[0] - 12)
        for q in range(8):
            qs = start + q * BEAT
            mm = int(BEAT * SR)
            tq = np.arange(mm) / SR
            b = np.sin(2 * np.pi * root * tq) * (1 - np.exp(-tq * 60)) * np.exp(-tq * 2.2)
            add(b * 0.085, qs)

        # --- pluck arpeggio on eighths (enters after 4 s)
        if start >= 4 * BAR / 2:
            for i in range(16):
                ps = start + i * BEAT / 2
                note = ARP[k % 4][i % 8]
                f = midi(note)
                mm = int(0.9 * SR)
                tp = np.arange(mm) / SR
                v = (np.sin(2 * np.pi * f * tp) + 0.35 * np.sin(4 * np.pi * f * tp)
                     + 0.12 * saw(f, tp)) * np.exp(-tp * 6.5) * (1 - np.exp(-tp * 400))
                g = 0.085 * (0.85 + 0.3 * rng.random())
                pan = -0.35 if i % 2 else 0.35
                add(v, ps, g, pan)
                add(v * 0.45, ps + 3 * BEAT / 4, g, -pan)  # ping-pong delay
                add(v * 0.2, ps + 3 * BEAT / 2, g, pan)
        k += 1

    # --- drums after the intro
    beat_i = 0
    while beat_i * BEAT < seconds:
        bt = beat_i * BEAT
        if bt >= 4 * BAR and bt < seconds - 2 * BAR:
            mm = int(0.35 * SR)
            tk = np.arange(mm) / SR
            f = 48 + 90 * np.exp(-tk * 28)
            kick = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tk * 9)
            add(kick * 0.17, bt)
        if bt >= 8 * BAR and bt < seconds - 2 * BAR:
            mm = int(0.09 * SR)
            th = np.arange(mm) / SR
            noise = rng.standard_normal(mm)
            hat = (noise - lowpass(noise, 6000)) * np.exp(-th * 55)
            add(hat * 0.09, bt + BEAT / 2, 1.0, 0.25)
        beat_i += 1

    L *= energy * 0.6 + 0.4 * np.clip(energy * 4, 0, 1)
    R *= energy * 0.6 + 0.4 * np.clip(energy * 4, 0, 1)

    # --- synthetic plate reverb (exponentially decaying stereo noise IR)
    ir_len = int(2.8 * SR)
    ti = np.arange(ir_len) / SR
    decay = np.exp(-ti * 2.4)
    irL = rng.standard_normal(ir_len) * decay
    irR = rng.standard_normal(ir_len) * decay
    irL = onepole_fast(irL, 5000)
    irR = onepole_fast(irR, 5000)
    irL /= np.sqrt((irL**2).sum())
    irR /= np.sqrt((irR**2).sum())
    size = 1 << int(np.ceil(np.log2(n + ir_len)))

    def conv(x, ir):
        return np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:n]

    wetL, wetR = conv(L, irL), conv(R, irR)
    L = L * 0.78 + wetL * 0.42
    R = R * 0.78 + wetR * 0.42

    # --- master: high-pass rumble, glue, fades, normalize to -1 dBFS
    def hp(x, fc=60):
        f = np.fft.rfftfreq(len(x), 1 / SR)
        h = 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** 4)
        return np.fft.irfft(np.fft.rfft(x) * h, len(x))

    L, R = hp(L), hp(R)
    fade_in = np.clip(t / 2.5, 0, 1)
    fade_out = np.clip((seconds - t) / 3.5, 0, 1)
    L *= fade_in * fade_out
    R *= fade_in * fade_out
    L, R = np.tanh(L * 1.4) / 1.4, np.tanh(R * 1.4) / 1.4
    peak = max(np.abs(L).max(), np.abs(R).max(), 1e-9)
    g = 10 ** (-1 / 20) / peak
    return L * g, R * g


def main():
    seconds = float(sys.argv[1])
    out = sys.argv[2]
    L, R = render(seconds)
    pcm = (np.stack([L, R], 1) * 32767).astype(np.int16)
    with wave.open(out, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"wrote {out} ({seconds:.1f}s)")


if __name__ == "__main__":
    main()
