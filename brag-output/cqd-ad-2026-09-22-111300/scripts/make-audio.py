#!/usr/bin/env python3
"""Deterministic original CQD ad score, tactile edit cues, and aligned PCM stems.

Requires Python + numpy and ffmpeg. No samples, external assets, or voice.
Example: python make-audio.py --batch-click 6.0 --completion 14.0
"""
import argparse
import json
import math
import re
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np


def arguments():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--manual-clicks", default="0.35,1.35,2.35")
    p.add_argument("--batch-click", type=float, default=6.0)
    p.add_argument("--completion", type=float, default=14.0)
    p.add_argument("--cta", type=float, default=16.5)
    p.add_argument("--target-lufs", type=float, default=-16.0)
    p.add_argument("--out", type=Path,
                   default=Path(__file__).resolve().parents[1] / "composition/assets")
    return p.parse_args()


SR = 48000
DURATION = 22.0
BPM = 120
N = round(DURATION * SR)
RNG = np.random.default_rng(20260922)


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def put(track, signal, start, gain=1, pan=0):
    i = round(start * SR)
    if i < 0 or i >= N:
        return
    signal = signal[: N - i]
    if signal.ndim == 1:
        angle = (pan + 1) * math.pi / 4
        signal = np.column_stack((signal * math.cos(angle), signal * math.sin(angle)))
    track[i:i + len(signal)] += signal * gain


def sine_note(midi, duration, decay=3.5, pan_width=0.003):
    t = np.arange(round(duration * SR)) / SR
    f = hz(midi)
    env = (1 - np.exp(-t / 0.006)) * np.exp(-t * decay)
    env *= np.clip((duration - t) / 0.055, 0, 1)
    # Soft mallet with the upper partial decaying first; no bell/sparkle effect.
    note = []
    for detune in (-pan_width, pan_width):
        phase = 2 * np.pi * f * (1 + detune) * t
        wave_ = np.sin(phase) + 0.20 * np.sin(2 * phase) * np.exp(-t * 4)
        wave_ += 0.065 * np.sin(3 * phase) * np.exp(-t * 8)
        note.append(wave_ * env)
    return np.column_stack(note)


def pad(midis, duration, attack=0.20, release=0.75):
    t = np.arange(round(duration * SR)) / SR
    env = np.minimum(t / attack, 1) * np.minimum((duration - t) / release, 1)
    env = np.sin(np.clip(env, 0, 1) * np.pi / 2) ** 1.4
    channels = []
    for channel in (0, 1):
        sig = np.zeros(len(t))
        for j, m in enumerate(midis):
            f = hz(m)
            detune = (-1 if channel == 0 else 1) * (0.0011 + j * 0.00015)
            phase = 2 * np.pi * f * (1 + detune) * t + j * 0.29
            sig += np.sin(phase) + 0.12 * np.sin(2 * phase) + 0.025 * np.sin(3 * phase)
        channels.append(sig / math.sqrt(len(midis)) * env)
    return np.column_stack(channels)


def bass(midi, duration):
    t = np.arange(round(duration * SR)) / SR
    ph = 2 * np.pi * hz(midi) * t
    env = (1 - np.exp(-t / 0.009)) * np.exp(-1.6 * t)
    env *= np.clip((duration - t) / 0.085, 0, 1)
    return (np.sin(ph) + 0.23 * np.sin(2 * ph) + 0.07 * np.sin(3 * ph)) * env


def kick():
    t = np.arange(round(0.36 * SR)) / SR
    # A short warm body, lower transient energy than club percussion.
    phase = 2 * np.pi * (48 * t + 1.4 * (1 - np.exp(-t * 40)))
    env = np.exp(-t * 14) * np.minimum(t / 0.002, 1)
    return np.sin(phase) * env


def textured_percussion(duration, decay, bright=False):
    t = np.arange(round(duration * SR)) / SR
    noise = RNG.normal(0, 1, len(t))
    if bright:
        noise = noise - np.convolve(noise, np.ones(12) / 12, mode="same")
    else:
        noise = np.convolve(noise, np.ones(5) / 5, mode="same")
    return noise * np.exp(-t * decay) * np.minimum(t / 0.0008, 1)


def tactile_click():
    t = np.arange(round(0.060 * SR)) / SR
    # Two subtransients recreate a restrained physical mouse press/release.
    sig = np.zeros(len(t))
    for delay, gain in ((0.0, 1.0), (0.014, 0.34)):
        u = np.maximum(t - delay, 0)
        env = (t >= delay) * (1 - np.exp(-u * 4200)) * np.exp(-u * 220)
        sig += gain * env * (0.55 * np.sin(2 * np.pi * 920 * u)
                             + 0.27 * np.sin(2 * np.pi * 1710 * u)
                             + 0.18 * RNG.normal(0, 1, len(t)))
    return sig


def add_room(track, amount=0.12):
    dry = track.copy()
    for delay, gain in ((0.043, 0.36), (0.083, 0.25), (0.139, 0.17), (0.219, 0.12)):
        offset = round(delay * SR)
        track[offset:] += dry[:-offset, ::-1] * gain * amount


def write_pcm(path, signal):
    with wave.open(str(path), "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(3)
        f.setframerate(SR)
        pcm = np.rint(np.clip(signal, -1, 1) * 8388607).astype(np.int32).reshape(-1)
        packed = np.column_stack((pcm & 255, (pcm >> 8) & 255, (pcm >> 16) & 255))
        f.writeframes(packed.astype(np.uint8).tobytes())


def measure(path):
    proc = subprocess.run([
        "ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
        "-af", "loudnorm=I=-16:TP=-1:LRA=9:print_format=json", "-f", "null", "-"
    ], capture_output=True, text=True, check=True)
    match = re.search(r'\{\s*"input_i".*?\}', proc.stderr, re.S)
    if not match:
        raise RuntimeError("ffmpeg did not return loudness measurements")
    raw = json.loads(match.group())
    return {"integrated_lufs": float(raw["input_i"]),
            "true_peak_dbtp": float(raw["input_tp"]),
            "loudness_range_lu": float(raw["input_lra"])}


def main():
    args = arguments()
    manual = [float(s.strip()) for s in args.manual_clicks.split(",") if s.strip()]
    for cue in manual + [args.batch_click, args.completion, args.cta]:
        if not 0 <= cue < DURATION:
            raise ValueError(f"Cue outside composition: {cue}")
    args.out.mkdir(parents=True, exist_ok=True)
    music = np.zeros((N, 2), dtype=np.float64)
    fx = np.zeros_like(music)
    pads = np.zeros_like(music)
    keys = np.zeros_like(music)
    rhythm = np.zeros_like(music)

    # Harmonically related, voice-led progression; a C major resolution gives
    # the CTA confidence while the Am9 opening keeps a hint of friction.
    chord_map = [
        (0.0, 3.5, [57, 60, 64, 71]),      # Am9
        (3.0, 2.8, [55, 60, 64, 69]),      # suspended C6/G: reveal space
        (5.0, 2.6, [53, 57, 60, 64]),      # Fmaj7
        (7.0, 2.6, [55, 59, 62, 69]),      # Gadd9
        (9.0, 2.6, [57, 60, 64, 71]),      # Am9
        (11.0, 3.5, [53, 57, 60, 64]),     # Fmaj7
        (14.0, 3.0, [55, 60, 64, 67]),     # C/G benefit
        (args.cta, 22.0-args.cta, [48, 55, 60, 64, 69]),
    ]
    for start, duration, chord in chord_map:
        put(pads, pad(chord, duration, attack=0.16 if start < 14 else 0.35),
            start, 0.065 if start < 5 else 0.080)

    # Opening: three intentional syncopated phrases, not a metronome.
    for start, m, gain in ((0.0, 64, .074), (.375, 71, .050), (.75, 69, .062),
                           (1.25, 64, .053), (1.875, 72, .062), (2.5, 71, .055)):
        put(keys, sine_note(m, .7, 5.2), start, gain)
    for start in (0.0, 1.0, 2.0):
        put(rhythm, kick(), start, .14)
    put(rhythm, bass(33, 1.45), 0, .17)
    put(rhythm, bass(40, 1.0), 1.5, .11)

    # No rhythmic hits from 3–5; reveal can breathe.
    put(keys, sine_note(72, 1.5, 3.2), 3.0, .043)

    # Main five-bar groove. Alternating syncopation and a restrained high
    # percussion layer provide movement without competing with the interface.
    bar_roots = [(5, 29, [69, 72, 76, 72]),
                 (7, 31, [71, 74, 76, 74]),
                 (9, 33, [72, 76, 79, 76]),
                 (11, 29, [69, 72, 76, 72]),
                 (13, 36, [67, 72, 76, 79])]
    for bar, root, notes in bar_roots:
        for offset, vel in ((0, .17), (.75, .095), (1.25, .13)):
            put(rhythm, bass(root, .48 if offset else .65), bar + offset, vel)
        for offset, vel in ((0, .17), (1.0, .15), (1.75, .095)):
            if bar + offset < 14:
                put(rhythm, kick(), bar + offset, vel)
        for j, off in enumerate((0.25, .875, 1.25, 1.625)):
            if bar + off < 14.0:
                put(keys, sine_note(notes[j], .7, 5.5), bar + off,
                    .048 if j % 2 else .062)
        for off in (.25, .75, 1.25, 1.75):
            if bar + off < 14.0:
                put(rhythm, textured_percussion(.065, 65, True), bar + off,
                    .013 if off in (.25, 1.25) else .018, pan=(-.18 if off < 1 else .18))
        for off in (.5, 1.5):
            if bar + off < 14:
                put(rhythm, textured_percussion(.12, 38), bar + off, .039)

    # Benefit lands with a low chord, not a notification jingle.
    put(keys, sine_note(64, 1.6, 2.7), args.completion, .058)
    put(keys, sine_note(67, 1.6, 2.7), args.completion + .02, .040)
    put(rhythm, bass(36, 1.8), 14.0, .15)
    put(rhythm, kick(), 14, .12)
    put(keys, sine_note(72, 1.0, 3.5), 15.0, .038)

    # CTA chord sustained through the closing hold. Sparse echoes maintain
    # life, while the final two seconds are deliberately free of percussion.
    put(rhythm, bass(36, 3.2), args.cta, .19)
    put(rhythm, kick(), args.cta, .14)
    for start, midi, gain in ((17.0, 76, .060), (17.75, 72, .045),
                              (18.5, 79, .049), (19.25, 76, .035)):
        put(keys, sine_note(midi, 2.1, 2.6), start, gain)
    for start in (17.5, 18.5, 19.5):
        put(rhythm, kick(), start, .080)

    add_room(keys, .24)
    add_room(pads, .18)
    # Broad musical duck around the verified interaction. This does not alter
    # any SFX cue time; it just clears attention for the one batch click.
    clock = np.arange(N) / SR
    duck = 1 - .46 * np.exp(-((clock - args.batch_click) / .12) ** 2)
    music = (pads + keys + rhythm) * duck[:, None]
    # Remove accumulated near-DC residue; a gentle memoryless bus saturation
    # controls crest factor without pumping the demonstration.
    music -= np.mean(music, axis=0)
    music = np.tanh(music * 1.15) / 1.15

    for cue in manual:
        put(fx, tactile_click(), cue, .115)
    put(fx, tactile_click(), args.batch_click, .185)
    # Completion accent is musical and lives in music, not a fictional app SFX.
    end_fade = np.clip((DURATION - clock) / .2, 0, 1)
    start_fade = np.clip(clock / .012, 0, 1)
    for track in (music, fx):
        track *= (end_fade * start_fade)[:, None]

    mix = music + fx
    with tempfile.TemporaryDirectory(prefix="cqd-audio-") as td:
        raw = Path(td) / "raw.wav"
        write_pcm(raw, mix)
        before = measure(raw)
    gain_db = min(args.target_lufs - before["integrated_lufs"],
                  -1.2 - before["true_peak_dbtp"])
    gain = 10 ** (gain_db / 20)
    for name, track in (("music.wav", music), ("sfx.wav", fx), ("soundtrack.wav", mix)):
        write_pcm(args.out / name, track * gain)
    after = measure(args.out / "soundtrack.wav")
    cues = {"duration_seconds": DURATION, "tempo_bpm": BPM,
            "sample_rate": SR, "manual_clicks": manual,
            "batch_click": args.batch_click, "completion_music_accent": args.completion,
            "cta_resolve": args.cta,
            "sections": [{"start": 0, "end": 3, "purpose": "Opening tension; sparse syncopated motif"},
                         {"start": 3, "end": 5, "purpose": "Reveal pullback; no drum hits"},
                         {"start": 5, "end": 14, "purpose": "Proof groove; attention clears for batch click"},
                         {"start": 14, "end": 16.5, "purpose": "Benefit resolves; percussion reduces"},
                         {"start": 16.5, "end": 22, "purpose": "CTA sustained major chord; 200ms final fade"}],
            "beats": [i / 2 for i in range(44)]}
    provenance = {"origin": "Original deterministic procedural composition and synthesized tactile SFX",
                  "composer": "Codex for CQD launch ad", "seed": 20260922,
                  "external_samples": [], "voice": False,
                  "source_recording_audio_used": False,
                  "license_notes": "No third-party music or sampled recordings used.",
                  "encoding": "Stereo 48kHz 24-bit PCM WAV", "frames": N,
                  "mastering": "Common constant gain applied to both stems, preserving exact stem sum; no time stretching",
                  "applied_gain_db": round(gain_db, 4), "measurements": after,
                  "sfx_note": "Tactile editorial clicks align to visible interactions; completion chord is score, not a product sound.",
                  "perceptual_review": "Structure and signal measurements checked; subjective listening review belongs to final audiovisual review."}
    (args.out / "music-cues.json").write_text(json.dumps(cues, indent=2) + "\n")
    (args.out / "audio-provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
    print(json.dumps({"output": str(args.out), "measurements": after,
                      "gain_db": round(gain_db, 4), "duration": DURATION}, indent=2))


if __name__ == "__main__":
    main()
