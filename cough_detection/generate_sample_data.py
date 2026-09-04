"""
generate_sample_data.py
Generates a rich starter dataset of synthetic audio samples for:
- dataset/cough/
- dataset/non_cough/

This allows immediate end-to-end testing of train.py and app.py without
requiring external dataset downloads. It synthesizes realistic acoustic
signatures for coughs and diverse background/distractor sounds.
"""

import os
import math
import numpy as np
import soundfile as sf

SAMPLE_RATE = 16000
DURATION = 1.5  # seconds
TOTAL_SAMPLES = int(SAMPLE_RATE * DURATION)


def ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)


def normalize(audio: np.ndarray) -> np.ndarray:
    max_val = np.max(np.abs(audio))
    if max_val > 0:
        return audio / max_val * 0.85
    return audio


def create_bandpass_noise(duration: float, low_freq: float, high_freq: float, sr: int = SAMPLE_RATE) -> np.ndarray:
    """Generates bandpass-filtered noise using frequency-domain masking."""
    n = int(duration * sr)
    white = np.random.normal(0, 1, n)
    fft = np.fft.rfft(white)
    freqs = np.fft.rfftfreq(n, 1.0 / sr)
    mask = (freqs >= low_freq) & (freqs <= high_freq)
    fft[~mask] = 0.0
    filtered = np.fft.irfft(fft, n)
    return filtered


def generate_cough(num_bursts: int = 1, sr: int = SAMPLE_RATE) -> np.ndarray:
    """
    Synthesizes a realistic cough waveform:
    1. Sharp explosive pressure burst (sudden acoustic transient, 30-60 ms).
    2. Glottal vocal tract friction with formant resonances (300-2500 Hz).
    3. Exponential envelope decay.
    4. Optional secondary cough burst (double-cough).
    """
    audio = np.zeros(TOTAL_SAMPLES, dtype=np.float32)
    start_idx = int(sr * np.random.uniform(0.1, 0.3))

    for b in range(num_bursts):
        burst_dur = np.random.uniform(0.22, 0.38)
        burst_samples = int(burst_dur * sr)
        if start_idx + burst_samples >= TOTAL_SAMPLES:
            burst_samples = TOTAL_SAMPLES - start_idx

        # 1. Explosive initial transient
        transient_samples = int(0.04 * sr)
        transient = np.random.normal(0, 1.0, transient_samples)
        t_env = np.linspace(1.0, 0.1, transient_samples) ** 2
        transient = transient * t_env

        # 2. Resonant turbulent friction
        noise_part = create_bandpass_noise(burst_dur, 250, 3200, sr)[:burst_samples]
        
        # Vocal formant harmonic resonance
        t = np.linspace(0, burst_dur, burst_samples, endpoint=False)
        formant1 = np.sin(2 * np.pi * np.random.uniform(350, 480) * t) * 0.4
        formant2 = np.sin(2 * np.pi * np.random.uniform(1100, 1400) * t) * 0.25
        friction = (noise_part + formant1 + formant2)

        # Envelope: rapid attack (10ms) followed by exponential decay
        attack_len = int(0.015 * sr)
        decay_len = burst_samples - attack_len
        attack_env = np.linspace(0, 1.0, attack_len)
        decay_env = np.exp(-np.linspace(0, 5.0, decay_len))
        envelope = np.concatenate([attack_env, decay_env])[:burst_samples]

        combined = friction * envelope
        # Add transient at start
        t_len = min(len(transient), burst_samples)
        combined[:t_len] += transient[:t_len] * 0.8

        audio[start_idx : start_idx + burst_samples] += combined
        # Next burst spacing (120-220ms)
        start_idx += burst_samples + int(sr * np.random.uniform(0.12, 0.22))

    # Add soft background room hiss
    audio += np.random.normal(0, 0.015, TOTAL_SAMPLES)
    return normalize(audio)


def generate_speech(sr: int = SAMPLE_RATE) -> np.ndarray:
    """Synthesizes human speech-like harmonic vocalizations."""
    t = np.linspace(0, DURATION, TOTAL_SAMPLES, endpoint=False)
    f0 = np.random.uniform(120, 260)  # fundamental voice frequency
    # Voice harmonics
    voice = (
        np.sin(2 * np.pi * f0 * t) * 0.5 +
        np.sin(2 * np.pi * 2 * f0 * t) * 0.35 +
        np.sin(2 * np.pi * 3 * f0 * t) * 0.2 +
        np.sin(2 * np.pi * 4 * f0 * t) * 0.1
    )
    # Speech syllable cadence envelope (3-5 syllables per second)
    syllables = np.abs(np.sin(2 * np.pi * np.random.uniform(2.5, 4.5) * t)) ** 2
    audio = voice * syllables + np.random.normal(0, 0.02, TOTAL_SAMPLES)
    return normalize(audio)


def generate_laugh(sr: int = SAMPLE_RATE) -> np.ndarray:
    """Synthesizes laughter: rhythmic staccato vowel bursts ('ha-ha-ha')."""
    t = np.linspace(0, DURATION, TOTAL_SAMPLES, endpoint=False)
    f0 = np.random.uniform(280, 420)
    vowel = np.sin(2 * np.pi * f0 * t) + 0.4 * np.sin(2 * np.pi * 2 * f0 * t)
    # Staccato modulation at ~5 Hz
    modulation = np.clip(np.sin(2 * np.pi * 5.2 * t), 0, 1) ** 2.5
    audio = vowel * modulation + np.random.normal(0, 0.02, TOTAL_SAMPLES)
    return normalize(audio)


def generate_sneeze(sr: int = SAMPLE_RATE) -> np.ndarray:
    """Synthesizes sneeze: gradual inhalation ramp + violent high-freq dispersion."""
    audio = np.zeros(TOTAL_SAMPLES, dtype=np.float32)
    # Inhalation (0.4s)
    inhale_len = int(0.4 * sr)
    inhale_noise = create_bandpass_noise(0.4, 500, 2000, sr)
    inhale_env = np.linspace(0.05, 0.6, inhale_len)
    audio[int(0.1 * sr) : int(0.1 * sr) + inhale_len] = inhale_noise * inhale_env

    # Sneeze explosion (higher frequencies than cough, ~1500 - 6000 Hz)
    burst_idx = int(0.55 * sr)
    burst_dur = 0.35
    burst_samples = int(burst_dur * sr)
    burst_noise = create_bandpass_noise(burst_dur, 1200, 6000, sr)
    t = np.linspace(0, burst_dur, burst_samples, endpoint=False)
    burst_env = np.exp(-t * 9.0)
    audio[burst_idx : burst_idx + burst_samples] += burst_noise * burst_env
    return normalize(audio)


def generate_throat_clearing(sr: int = SAMPLE_RATE) -> np.ndarray:
    """Synthesizes throat clearing: sustained low-frequency roughness/rasp without explosive start."""
    t = np.linspace(0, DURATION, TOTAL_SAMPLES, endpoint=False)
    dur = 0.6
    n = int(dur * sr)
    rasp = create_bandpass_noise(dur, 120, 800, sr)
    # Low frequency rumble modulation
    mod = 0.5 + 0.5 * np.sin(2 * np.pi * 40 * t[:n])
    audio = np.zeros(TOTAL_SAMPLES, dtype=np.float32)
    env = np.sin(np.linspace(0, np.pi, n)) ** 0.8
    audio[int(0.3 * sr) : int(0.3 * sr) + n] = rasp * mod * env
    return normalize(audio)


def generate_breathing(sr: int = SAMPLE_RATE) -> np.ndarray:
    """Synthesizes calm inhalation and exhalation (gentle low-pass noise)."""
    t = np.linspace(0, DURATION, TOTAL_SAMPLES, endpoint=False)
    noise = create_bandpass_noise(DURATION, 100, 900, sr)
    cycle = (np.sin(2 * np.pi * 0.6 * t) ** 2) * 0.4
    return normalize(noise * cycle)


def generate_keyboard(sr: int = SAMPLE_RATE) -> np.ndarray:
    """Synthesizes typing: short impulsive clicks."""
    audio = np.random.normal(0, 0.01, TOTAL_SAMPLES)
    num_clicks = np.random.randint(4, 9)
    for _ in range(num_clicks):
        pos = np.random.randint(int(0.05 * sr), TOTAL_SAMPLES - int(0.05 * sr))
        click_len = int(0.015 * sr)
        click = np.random.normal(0, 1.0, click_len) * np.exp(-np.linspace(0, 8, click_len))
        audio[pos : pos + click_len] += click * 0.7
    return normalize(audio)


def generate_fan_room_noise(sr: int = SAMPLE_RATE) -> np.ndarray:
    """Continuous low-frequency fan drone / air conditioner hum."""
    t = np.linspace(0, DURATION, TOTAL_SAMPLES, endpoint=False)
    hum = (
        np.sin(2 * np.pi * 60 * t) * 0.4 +
        np.sin(2 * np.pi * 120 * t) * 0.25 +
        np.sin(2 * np.pi * 180 * t) * 0.15
    )
    pink = create_bandpass_noise(DURATION, 50, 1200, sr) * 0.4
    return normalize(hum + pink)


def generate_traffic_noise(sr: int = SAMPLE_RATE) -> np.ndarray:
    """Low rumbling road noise with pitch fluctuations."""
    t = np.linspace(0, DURATION, TOTAL_SAMPLES, endpoint=False)
    rumble = create_bandpass_noise(DURATION, 40, 350, sr)
    car_pass = np.sin(np.linspace(0, np.pi, TOTAL_SAMPLES)) ** 2
    return normalize(rumble * car_pass)


def generate_music(sr: int = SAMPLE_RATE) -> np.ndarray:
    """Synthesizes musical chords and melody with sustained decay."""
    t = np.linspace(0, DURATION, TOTAL_SAMPLES, endpoint=False)
    chords = [
        (261.63, 329.63, 392.00),  # C major
        (220.00, 261.63, 329.63),  # A minor
        (174.61, 220.00, 261.63),  # F major
        (196.00, 246.94, 293.66),  # G major
    ]
    chord = chords[np.random.randint(len(chords))]
    audio = np.zeros(TOTAL_SAMPLES)
    for freq in chord:
        audio += np.sin(2 * np.pi * freq * t) * 0.3
        audio += np.sin(2 * np.pi * 2 * freq * t) * 0.1
    env = np.exp(-t * 0.8)
    return normalize(audio * env)


def generate_door_slam(sr: int = SAMPLE_RATE) -> np.ndarray:
    """Low-frequency transient thud followed by room reverberation."""
    audio = np.zeros(TOTAL_SAMPLES, dtype=np.float32)
    pos = int(0.2 * sr)
    thud_len = int(0.3 * sr)
    t = np.linspace(0, 0.3, thud_len, endpoint=False)
    thud = np.sin(2 * np.pi * 75 * t) * np.exp(-t * 18.0)
    noise = create_bandpass_noise(0.3, 80, 800, sr) * np.exp(-t * 12.0)
    audio[pos : pos + thud_len] = thud * 0.8 + noise * 0.4
    return normalize(audio)


def generate_all():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    cough_dir = os.path.join(base_dir, "dataset", "cough")
    non_cough_dir = os.path.join(base_dir, "dataset", "non_cough")

    ensure_dir(cough_dir)
    ensure_dir(non_cough_dir)

    print("Generating starter dataset...")

    # 1. Generate Cough samples (single and double coughs)
    num_coughs = 30
    for i in range(1, num_coughs + 1):
        bursts = 1 if (i % 3 != 0) else 2
        audio = generate_cough(num_bursts=bursts)
        filename = os.path.join(cough_dir, f"cough_{i:03d}.wav")
        sf.write(filename, audio, SAMPLE_RATE)

    print(f"Generated {num_coughs} cough samples in {cough_dir}")

    # 2. Generate Non-Cough samples across realistic classes
    generators = [
        ("speech", generate_speech, 5),
        ("laugh", generate_laugh, 4),
        ("sneeze", generate_sneeze, 4),
        ("throat_clearing", generate_throat_clearing, 4),
        ("breathing", generate_breathing, 4),
        ("keyboard", generate_keyboard, 4),
        ("fan_noise", generate_fan_room_noise, 4),
        ("traffic", generate_traffic_noise, 4),
        ("music", generate_music, 4),
        ("door_slam", generate_door_slam, 4),
    ]

    total_non_cough = 0
    for category_name, gen_func, count in generators:
        for i in range(1, count + 1):
            audio = gen_func()
            filename = os.path.join(non_cough_dir, f"{category_name}_{i:02d}.wav")
            sf.write(filename, audio, SAMPLE_RATE)
            total_non_cough += 1

    print(f"Generated {total_non_cough} non-cough samples in {non_cough_dir}")
    print("Dataset generation complete! You can now run train.py.")


if __name__ == "__main__":
    generate_all()
