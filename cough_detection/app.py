"""
app.py — ChummAPP: Bio-Acoustic Cough Recognition & Savage Roast System

Features:
- Full Cyberpunk Biometric HUD Interface matching user specifications.
- Deep Learning Powered: Loads trained PyTorch model (models/cough_model.pth).
- Acoustic Spike Telemetry & Dynamic Counter: Real-time cough detection with bump animation.
- Tiered Chuma Ranks (Healthy Amateur -> Chuma Final Boss / അന്തിമ ചുമ ദൈവം).
- Live Biometric Roast Stream in Malayalam with English Subtitles.
- Real-Time Acoustic Spectrum Visualizer & Microphone Sensitivity Controls.
- Cosmetic Facial HUD with Target Larynx Zone Box.
- Official Closing Chuma Dossier Modal ("Verified Futile", Total Coughs, Level, Closing Roast).
- Automatically opens browser to http://127.0.0.1:5000 on launch.
"""

import os
# Prevent OpenMP / BLAS threading deadlock on Windows
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

import sys
import json
import time
import argparse
import threading
import webbrowser
from typing import Optional, Tuple

import numpy as np
import soundfile as sf
import librosa
import torch
import torch.nn as nn
import torch.nn.functional as F
from flask import Flask, request, jsonify, send_from_directory


# -----------------------------------------------------------------------------
# Neural Network Architecture (Matches train.py)
# -----------------------------------------------------------------------------
class CoughCNN(nn.Module):
    """
    Lightweight 2D Convolutional Neural Network for Log-Mel Spectrograms.
    Identical architecture to train.py to ensure parameter compatibility.
    """
    def __init__(self, num_classes: int = 2, in_channels: int = 1):
        super(CoughCNN, self).__init__()
        self.conv1 = nn.Conv2d(in_channels, 32, kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm2d(32)
        self.pool1 = nn.MaxPool2d(2, 2)
        self.drop1 = nn.Dropout(0.2)

        self.conv2 = nn.Conv2d(32, 64, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm2d(64)
        self.pool2 = nn.MaxPool2d(2, 2)
        self.drop2 = nn.Dropout(0.2)

        self.conv3 = nn.Conv2d(64, 128, kernel_size=3, padding=1)
        self.bn3 = nn.BatchNorm2d(128)
        self.pool3 = nn.MaxPool2d(2, 2)
        self.drop3 = nn.Dropout(0.3)

        self.conv4 = nn.Conv2d(128, 128, kernel_size=3, padding=1)
        self.bn4 = nn.BatchNorm2d(128)
        self.pool4 = nn.AdaptiveAvgPool2d((2, 2))
        self.drop4 = nn.Dropout(0.3)

        self.fc1 = nn.Linear(128 * 2 * 2, 64)
        self.drop5 = nn.Dropout(0.3)
        self.fc2 = nn.Linear(64, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.drop1(self.pool1(F.relu(self.bn1(self.conv1(x)))))
        x = self.drop2(self.pool2(F.relu(self.bn2(self.conv2(x)))))
        x = self.drop3(self.pool3(F.relu(self.bn3(self.conv3(x)))))
        x = self.drop4(self.pool4(F.relu(self.bn4(self.conv4(x)))))
        x = x.view(x.size(0), -1)
        x = F.relu(self.fc1(x))
        x = self.drop5(x)
        x = self.fc2(x)
        return x


# -----------------------------------------------------------------------------
# Audio Inference Engine
# -----------------------------------------------------------------------------
class AudioInferenceEngine:
    def __init__(self, models_dir: str = "models"):
        self.models_dir = models_dir
        self.model = None
        self.config = {}
        self.is_loaded = False
        self.sample_rate = 16000
        self.duration = 1.5
        self.target_samples = int(self.sample_rate * self.duration)
        self.n_fft = 1024
        self.hop_length = 512
        self.n_mels = 64
        self.fmin = 50
        self.fmax = 8000
        self.norm_mean = -40.0
        self.norm_std = 20.0
        self.classes = ["non_cough", "cough"]

        self.load_model()

    def load_model(self) -> bool:
        weights_path = os.path.join(self.models_dir, "cough_model.pth")
        config_path = os.path.join(self.models_dir, "model_config.json")

        if not os.path.exists(weights_path) or not os.path.exists(config_path):
            self.is_loaded = False
            return False

        try:
            with open(config_path, "r") as f:
                self.config = json.load(f)

            self.sample_rate = self.config.get("sample_rate", 16000)
            self.duration = self.config.get("duration", 1.5)
            self.target_samples = int(self.sample_rate * self.duration)
            self.n_fft = self.config.get("n_fft", 1024)
            self.hop_length = self.config.get("hop_length", 512)
            self.n_mels = self.config.get("n_mels", 64)
            self.fmin = self.config.get("fmin", 50)
            self.fmax = self.config.get("fmax", 8000)
            self.norm_mean = self.config.get("norm_mean", -40.0)
            self.norm_std = self.config.get("norm_std", 20.0)
            self.classes = self.config.get("classes", ["non_cough", "cough"])

            self.model = CoughCNN(num_classes=len(self.classes), in_channels=1)
            state_dict = torch.load(weights_path, map_location=torch.device("cpu"))
            self.model.load_state_dict(state_dict)
            self.model.eval()
            self.is_loaded = True
            return True
        except Exception as e:
            print(f"[ERROR] Failed to load model: {e}")
            self.is_loaded = False
            return False

    def preprocess_chunk(self, audio: np.ndarray, orig_sr: int = 16000) -> torch.Tensor:
        """Standardizes audio length and computes normalized Log-Mel Spectrogram."""
        audio = audio.astype(np.float32)

        # Resample if browser sample rate differs from 16 kHz
        if orig_sr != self.sample_rate and len(audio) > 0:
            try:
                audio = librosa.resample(audio, orig_sr=orig_sr, target_sr=self.sample_rate)
            except Exception:
                pass

        # DC removal & Peak normalization
        audio = audio - np.mean(audio)
        max_val = np.max(np.abs(audio))
        if max_val > 1e-5:
            audio = audio / max_val

        # Fix length
        n = len(audio)
        if n < self.target_samples:
            pad_left = (self.target_samples - n) // 2
            pad_right = self.target_samples - n - pad_left
            audio = np.pad(audio, (pad_left, pad_right), mode="constant")
        elif n > self.target_samples:
            start = (n - self.target_samples) // 2
            audio = audio[start : start + self.target_samples]

        # Log-Mel Spectrogram
        mel = librosa.feature.melspectrogram(
            y=audio,
            sr=self.sample_rate,
            n_fft=self.n_fft,
            hop_length=self.hop_length,
            n_mels=self.n_mels,
            fmin=self.fmin,
            fmax=self.fmax,
            power=2.0
        )
        log_mel = librosa.power_to_db(mel, ref=np.max)

        # Normalize with model config stats
        norm_mel = (log_mel - self.norm_mean) / (self.norm_std + 1e-6)
        tensor = torch.tensor(norm_mel, dtype=torch.float32).unsqueeze(0).unsqueeze(0)
        return tensor

    def predict_chunk(self, audio: np.ndarray, orig_sr: int = 16000) -> Tuple[str, float]:
        """Runs inference on an audio chunk. Returns (label, cough_probability)."""
        if not self.is_loaded or self.model is None:
            return "NO COUGH DETECTED", 0.0

        # Silence check
        rms = np.sqrt(np.mean(audio ** 2))
        if rms < 0.003:
            return "NO COUGH DETECTED", 0.0

        tensor = self.preprocess_chunk(audio, orig_sr=orig_sr)
        with torch.no_grad():
            logits = self.model(tensor)
            probs = F.softmax(logits, dim=1).squeeze().numpy()

        p_cough = float(probs[1])
        label = "COUGH DETECTED" if p_cough >= 0.50 else "NO COUGH DETECTED"
        return label, p_cough

    def predict_file(self, file_path: str) -> Tuple[str, float, float, np.ndarray]:
        """Sliding-window evaluation over audio file."""
        try:
            audio, sr = sf.read(file_path, dtype="float32")
        except Exception:
            audio, sr = librosa.load(file_path, sr=self.sample_rate, mono=True)

        if audio.ndim > 1:
            audio = np.mean(audio, axis=1)

        if sr != self.sample_rate:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=self.sample_rate)

        file_duration = len(audio) / self.sample_rate
        window_size = self.target_samples
        hop_size = int(self.sample_rate * 0.5)

        if len(audio) <= window_size:
            label, prob = self.predict_chunk(audio, orig_sr=self.sample_rate)
            return label, prob, file_duration, audio

        max_prob = 0.0
        for start in range(0, len(audio) - window_size + 1, hop_size):
            chunk = audio[start : start + window_size]
            _, prob = self.predict_chunk(chunk, orig_sr=self.sample_rate)
            if prob > max_prob:
                max_prob = prob

        label = "COUGH DETECTED" if max_prob >= 0.50 else "NO COUGH DETECTED"
        return label, max_prob, file_duration, audio


# -----------------------------------------------------------------------------
# Flask Server & API Handlers
# -----------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
MODELS_DIR = os.path.join(BASE_DIR, "models")

engine = AudioInferenceEngine(models_dir=MODELS_DIR)

flask_app = Flask(__name__, static_folder=STATIC_DIR)


@flask_app.route("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")


@flask_app.route("/static/<path:filename>")
def serve_static(filename):
    return send_from_directory(STATIC_DIR, filename)


@flask_app.route("/api/status", methods=["GET"])
def api_status():
    return jsonify({
        "model_loaded": engine.is_loaded,
        "sample_rate": engine.sample_rate,
        "classes": engine.classes,
        "metrics": engine.config.get("metrics", {})
    })


@flask_app.route("/api/predict", methods=["POST"])
def api_predict():
    data = request.get_json(silent=True)
    if not data or "audio" not in data:
        return jsonify({"error": "No audio payload provided"}), 400

    try:
        raw_samples = np.array(data["audio"], dtype=np.float32)
        orig_sr = int(data.get("sr", 16000))
        label, prob = engine.predict_chunk(raw_samples, orig_sr=orig_sr)

        is_cough = (prob >= 0.50)
        return jsonify({
            "is_cough": bool(is_cough),
            "label": label,
            "probability": float(prob),
            "confidence_percent": round(prob * 100, 1)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def open_browser(port: int):
    time.sleep(1.0)
    webbrowser.open(f"http://127.0.0.1:{port}")


def main():
    parser = argparse.ArgumentParser(description="ChummAPP: Bio-Acoustic Cough Recognition & Savage Roast System")
    parser.add_argument("--port", type=int, default=5000, help="Port to run web server on (default: 5000)")
    parser.add_argument("--no_browser", action="store_true", help="Do not automatically open the web browser")
    args = parser.parse_args()

    print("=" * 70)
    print("      CHUMMAPP — BIO-ACOUSTIC DOSSIER & SAVAGE ROAST ENGINE")
    print("=" * 70)
    print(f"Model Loaded: {'YES (CoughCNN Ready)' if engine.is_loaded else 'NO (Run train.py first)'}")
    print(f"Server starting on: http://127.0.0.1:{args.port}")
    print("Press Ctrl+C to stop the server.")
    print("=" * 70)

    if not args.no_browser:
        threading.Thread(target=open_browser, args=(args.port,), daemon=True).start()

    flask_app.run(host="0.0.0.0", port=args.port, debug=False)


if __name__ == "__main__":
    main()
