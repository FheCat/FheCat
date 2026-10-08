# The arena announcer: public/arena/voice/*.mp3, the lines src/arena/sound.ts plays.
#
# Spoken by Kokoro-82M (Apache-2.0, voice bm_lewis) and run through an arena PA: trimmed, EQ'd,
# a little drive and a hall behind it, then MP3 (64 kbps mono, 24 kHz). The clips are committed;
# this only needs running again to change a line.
#
#   python3 -m venv .venv && .venv/bin/pip install kokoro-onnx soundfile scipy lameenc
#   # from huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX: onnx/model.onnx and voices/bm_lewis.bin
#   .venv/bin/python scripts/arena-voice.py <model.onnx> <bm_lewis.bin> public/arena/voice
import io
import os
import sys
import tempfile

import lameenc
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro
from scipy.signal import butter, lfilter, sosfilt

LINES = {
    'arena': 'Blind Arena!',
    'locked': 'Tactics sealed!',
    'fight': 'Fight!',
    'ko': 'Knockout!',
    'challenger': 'Challenger wins!',
    'defender': 'Defender wins!',
    'sealed': 'Sealed victory!',
    'youwin': 'You win!',
    'youlose': 'You lose!',
}


def trim(x, sr, db=-42):
    env = np.abs(x)
    idx = np.where(env > 10 ** (db / 20) * env.max())[0]
    return x[max(0, idx[0] - int(0.015 * sr)) : min(len(x), idx[-1] + int(0.03 * sr))]


def peaking(x, sr, f, gain_db, q=1.0):
    a_ = 10 ** (gain_db / 40)
    w = 2 * np.pi * f / sr
    al = np.sin(w) / (2 * q)
    b = np.array([1 + al * a_, -2 * np.cos(w), 1 - al * a_])
    a = np.array([1 + al / a_, -2 * np.cos(w), 1 - al / a_])
    return lfilter(b / a[0], a / a[0], x)


def hall(x, sr, mix=0.2, decay=0.82):
    """Schroeder reverb: four combs in parallel, two allpasses in series, a darker tail."""
    n = len(x) + int(0.9 * sr)
    xin = np.concatenate([x, np.zeros(n - len(x))])
    y = np.zeros(n)
    for ms, g in [(29.7, decay), (37.1, decay - 0.02), (41.1, decay - 0.03), (43.7, decay - 0.05)]:
        d = int(ms * sr / 1000)
        c = np.zeros(n)
        for i in range(n):
            c[i] = xin[i] + (g * c[i - d] if i >= d else 0)
        y += c / 4
    for ms, g in [(5.0, 0.7), (1.7, 0.7)]:
        d = int(ms * sr / 1000)
        a = np.zeros(n)
        for i in range(n):
            a[i] = -g * y[i] + (y[i - d] + g * a[i - d] if i >= d else 0)
        y = a
    y = sosfilt(butter(2, 3500, 'low', fs=sr, output='sos'), y)
    w = xin + mix * y / (np.abs(y).max() + 1e-9) * np.abs(x).max()
    w = w[: np.where(np.abs(w) > 0.004 * np.abs(w).max())[0][-1] + 1]
    fade = int(0.12 * sr)
    w[-fade:] *= np.linspace(1, 0, fade)
    return w


def pa(x, sr):
    x = trim(x, sr)
    x = sosfilt(butter(2, 90, 'high', fs=sr, output='sos'), x)
    x = peaking(x, sr, 220, 2.0, 0.8)  # chest
    x = peaking(x, sr, 3000, 3.5, 1.0)  # presence
    x = sosfilt(butter(4, 9500, 'low', fs=sr, output='sos'), x)
    x = x / np.abs(x).max()
    x = np.tanh(1.8 * x) / np.tanh(1.8)  # a little drive, like a stadium PA
    x = hall(x, sr)
    return 0.89 * x / np.abs(x).max()  # -1 dBFS


def main(model, voice, out):
    voices = os.path.join(tempfile.mkdtemp(), 'voices.npz')
    np.savez(voices, bm_lewis=np.fromfile(voice, dtype=np.float32).reshape(-1, 1, 256))
    k = Kokoro(model, voices)
    os.makedirs(out, exist_ok=True)
    for key, text in LINES.items():
        audio, sr = k.create(text, voice='bm_lewis', speed=0.92, lang='en-us')
        # Through 16-bit PCM first, as the committed clips were made.
        wav = io.BytesIO()
        sf.write(wav, audio, sr, format='WAV')
        wav.seek(0)
        audio, sr = sf.read(wav)
        x = pa(audio, sr)
        enc = lameenc.Encoder()
        enc.set_bit_rate(64)
        enc.set_in_sample_rate(sr)
        enc.set_channels(1)
        enc.set_quality(2)
        mp3 = enc.encode((x * 32767).astype(np.int16).tobytes()) + enc.flush()
        with open(os.path.join(out, f'{key}.mp3'), 'wb') as f:
            f.write(mp3)
        print(f'{key:11s} {text:18s} {len(x) / sr:4.2f}s {len(mp3) / 1024:5.1f} KB')


if __name__ == '__main__':
    main(*sys.argv[1:4])
