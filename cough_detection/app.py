"""
app.py — Testing & Recognition Program for Cough Sound Recognition

Features:
- Native, responsive Tkinter Desktop GUI (Zero external server dependencies).
- Loads trained model (models/cough_model.pth) & configuration (models/model_config.json).
- Continuous real-time microphone stream with rolling 1.5s audio window.
- Audio file upload and instant playback testing (.wav, .mp3, .ogg, .flac).
- Visual confidence progress bar (0% - 100%) with dynamic color shifting.
- Distinct prediction badges: "COUGH DETECTED" vs "NO COUGH DETECTED".
- Intelligent debounce/cooldown mechanism to prevent repeated triggers from a single cough.
- Recent detections log table with timestamps and confidence scores.
- Clear medical diagnostic disclaimer.
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
import queue
import threading
from datetime import datetime
from typing import Optional, Tuple

import numpy as np
import soundfile as sf
import librosa
import sounddevice as sd
import torch
import torch.nn as nn
import torch.nn.functional as F

import tkinter as tk
from tkinter import ttk, filedialog, messagebox


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

    def preprocess_chunk(self, audio: np.ndarray) -> torch.Tensor:
        """Standardizes audio length and computes normalized Log-Mel Spectrogram."""
        audio = audio.astype(np.float32)
        # Peak normalization
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

    def predict_chunk(self, audio: np.ndarray) -> Tuple[str, float]:
        """Runs inference on a single audio chunk. Returns (label, cough_probability)."""
        if not self.is_loaded or self.model is None:
            return "NO COUGH DETECTED", 0.0

        # Silence / low energy filter to avoid predicting noise floor
        rms = np.sqrt(np.mean(audio ** 2))
        if rms < 0.003:
            return "NO COUGH DETECTED", 0.0

        tensor = self.preprocess_chunk(audio)
        with torch.no_grad():
            logits = self.model(tensor)
            probs = F.softmax(logits, dim=1).squeeze().numpy()

        p_cough = float(probs[1])
        label = "COUGH DETECTED" if p_cough >= 0.50 else "NO COUGH DETECTED"
        return label, p_cough

    def predict_file(self, file_path: str) -> Tuple[str, float, float, np.ndarray]:
        """
        Runs sliding-window prediction over an entire audio file.
        Returns: (overall_label, max_cough_prob, file_duration, raw_audio)
        """
        try:
            audio, sr = sf.read(file_path, dtype="float32")
        except Exception:
            audio, sr = librosa.load(file_path, sr=self.sample_rate, mono=True)

        if audio.ndim > 1:
            audio = np.mean(audio, axis=1)

        if sr != self.sample_rate:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=self.sample_rate)

        file_duration = len(audio) / self.sample_rate

        # Sliding window over the audio
        window_size = self.target_samples
        hop_size = int(self.sample_rate * 0.5)  # 0.5s stride

        if len(audio) <= window_size:
            label, prob = self.predict_chunk(audio)
            return label, prob, file_duration, audio

        max_prob = 0.0
        for start in range(0, len(audio) - window_size + 1, hop_size):
            chunk = audio[start : start + window_size]
            _, prob = self.predict_chunk(chunk)
            if prob > max_prob:
                max_prob = prob

        label = "COUGH DETECTED" if max_prob >= 0.50 else "NO COUGH DETECTED"
        return label, max_prob, file_duration, audio


# -----------------------------------------------------------------------------
# Main GUI Application (Tkinter)
# -----------------------------------------------------------------------------
class CoughDetectorApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Cough Sound Recognition System")
        self.root.geometry("820x720")
        self.root.minsize(760, 680)
        self.root.configure(bg="#181825")

        # Base directories
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.models_dir = os.path.join(self.base_dir, "models")

        # Engine initialization
        self.engine = AudioInferenceEngine(models_dir=self.models_dir)

        # State variables
        self.is_recording = False
        self.audio_stream = None
        self.msg_queue = queue.Queue()
        self.ring_buffer = np.zeros(self.engine.target_samples, dtype=np.float32)
        self.last_detection_time = 0.0
        self.cooldown_seconds = 1.5  # Debounce cooldown
        self.uploaded_audio = None
        self.is_playing_audio = False

        self._init_styles()
        self._build_ui()

        # Check model status
        if not self.engine.is_loaded:
            self._show_model_missing_banner()

        # Start periodic queue checking for thread-safe UI updates
        self.root.after(50, self._process_queue)

    def _init_styles(self):
        style = ttk.Style()
        style.theme_use("clam")
        style.configure("Treeview",
            background="#1e1e2e",
            foreground="#cdd6f4",
            fieldbackground="#1e1e2e",
            rowheight=26,
            font=("Segoe UI", 9)
        )
        style.configure("Treeview.Heading",
            background="#313244",
            foreground="#cdd6f4",
            font=("Segoe UI", 9, "bold")
        )
        style.map("Treeview", background=[("selected", "#45475a")])

    def _build_ui(self):
        # 1. Header Banner
        header = tk.Frame(self.root, bg="#11111b", padx=20, pady=12)
        header.pack(fill="x", side="top")

        title_label = tk.Label(
            header,
            text="COUGH SOUND RECOGNITION SYSTEM",
            font=("Segoe UI", 16, "bold"),
            fg="#cdd6f4",
            bg="#11111b"
        )
        title_label.pack(anchor="w")

        disclaimer_label = tk.Label(
            header,
            text="Acoustic pattern recognition research tool. Not a medical diagnostic device.",
            font=("Segoe UI", 8, "italic"),
            fg="#f38ba8",
            bg="#11111b"
        )
        disclaimer_label.pack(anchor="w")

        # Model Status Badge in Header
        model_status_text = "MODEL LOADED" if self.engine.is_loaded else "MODEL NOT FOUND (RUN train.py)"
        model_status_color = "#a6e3a1" if self.engine.is_loaded else "#fab387"
        self.model_badge = tk.Label(
            header,
            text=f"• {model_status_text}",
            font=("Segoe UI", 9, "bold"),
            fg=model_status_color,
            bg="#11111b"
        )
        self.model_badge.place(relx=1.0, rely=0.5, anchor="e", x=-20)

        # 2. Main Content Container
        content = tk.Frame(self.root, bg="#181825", padx=20, pady=15)
        content.pack(fill="both", expand=True)

        # 2A. Primary Live Prediction Display Card
        pred_card = tk.Frame(content, bg="#1e1e2e", bd=0, relief="flat", padx=16, pady=16)
        pred_card.pack(fill="x", pady=(0, 15))

        self.badge_label = tk.Label(
            pred_card,
            text="READY FOR AUDIO TEST",
            font=("Segoe UI", 20, "bold"),
            fg="#a6adc8",
            bg="#313244",
            padx=16,
            pady=8
        )
        self.badge_label.pack(pady=(4, 10))

        # Confidence Score & Status Info
        self.prob_label = tk.Label(
            pred_card,
            text="Cough Probability: 0.0%",
            font=("Segoe UI", 13, "bold"),
            fg="#cdd6f4",
            bg="#1e1e2e"
        )
        self.prob_label.pack()

        # Canvas Confidence Meter Bar
        meter_frame = tk.Frame(pred_card, bg="#1e1e2e", pady=8)
        meter_frame.pack(fill="x", padx=30)

        self.meter_canvas = tk.Canvas(meter_frame, height=22, bg="#313244", bd=0, highlightthickness=0)
        self.meter_canvas.pack(fill="x", expand=True)
        self._update_confidence_meter(0.0)

        # Debounce / Cooldown Indicator
        self.debounce_info = tk.Label(
            pred_card,
            text="Debounce Cooldown: 1.5s active",
            font=("Segoe UI", 8),
            fg="#6c7086",
            bg="#1e1e2e"
        )
        self.debounce_info.pack()

        # 2B. Control Panels: Two Columns (Microphone vs File Upload)
        controls_frame = tk.Frame(content, bg="#181825")
        controls_frame.pack(fill="x", pady=(0, 15))

        # Column 1: Microphone Controls
        mic_card = tk.LabelFrame(
            controls_frame,
            text=" Live Microphone Test (Continuous) ",
            font=("Segoe UI", 10, "bold"),
            fg="#cdd6f4",
            bg="#1e1e2e",
            padx=14,
            pady=12,
            relief="flat"
        )
        mic_card.pack(side="left", fill="both", expand=True, padx=(0, 8))

        mic_desc = tk.Label(
            mic_card,
            text="Streams audio continuously in 1.5s windows with debounce.",
            font=("Segoe UI", 8),
            fg="#a6adc8",
            bg="#1e1e2e",
            wraplength=300,
            justify="left"
        )
        mic_desc.pack(anchor="w", pady=(0, 10))

        mic_btn_frame = tk.Frame(mic_card, bg="#1e1e2e")
        mic_btn_frame.pack(fill="x")

        self.btn_start_mic = tk.Button(
            mic_btn_frame,
            text="▶ Start Microphone Test",
            font=("Segoe UI", 10, "bold"),
            bg="#89b4fa",
            fg="#11111b",
            activebackground="#b4befe",
            cursor="hand2",
            relief="flat",
            padx=10,
            pady=6,
            command=self.start_microphone
        )
        self.btn_start_mic.pack(side="left", padx=(0, 6))

        self.btn_stop_mic = tk.Button(
            mic_btn_frame,
            text="⏹ Stop",
            font=("Segoe UI", 10, "bold"),
            bg="#f38ba8",
            fg="#11111b",
            activebackground="#eba0ac",
            cursor="hand2",
            relief="flat",
            state="disabled",
            padx=10,
            pady=6,
            command=self.stop_microphone
        )
        self.btn_stop_mic.pack(side="left")

        # Column 2: File Upload Controls
        file_card = tk.LabelFrame(
            controls_frame,
            text=" Audio File Test & Playback ",
            font=("Segoe UI", 10, "bold"),
            fg="#cdd6f4",
            bg="#1e1e2e",
            padx=14,
            pady=12,
            relief="flat"
        )
        file_card.pack(side="right", fill="both", expand=True, padx=(8, 0))

        self.lbl_file_name = tk.Label(
            file_card,
            text="No audio file loaded (.wav, .mp3, .ogg, .flac)",
            font=("Segoe UI", 8),
            fg="#a6adc8",
            bg="#1e1e2e",
            wraplength=300,
            justify="left"
        )
        self.lbl_file_name.pack(anchor="w", pady=(0, 10))

        file_btn_frame = tk.Frame(file_card, bg="#1e1e2e")
        file_btn_frame.pack(fill="x")

        self.btn_upload = tk.Button(
            file_btn_frame,
            text="📁 Upload Audio File",
            font=("Segoe UI", 10, "bold"),
            bg="#a6e3a1",
            fg="#11111b",
            activebackground="#94e2d5",
            cursor="hand2",
            relief="flat",
            padx=10,
            pady=6,
            command=self.upload_audio_file
        )
        self.btn_upload.pack(side="left", padx=(0, 6))

        self.btn_play = tk.Button(
            file_btn_frame,
            text="🔊 Play Audio",
            font=("Segoe UI", 10, "bold"),
            bg="#cba6f7",
            fg="#11111b",
            activebackground="#f5c2e7",
            cursor="hand2",
            relief="flat",
            state="disabled",
            padx=10,
            pady=6,
            command=self.toggle_audio_playback
        )
        self.btn_play.pack(side="left")

        # 2C. Recent Detections Log Section
        log_card = tk.LabelFrame(
            content,
            text=" Recent Detections Log ",
            font=("Segoe UI", 10, "bold"),
            fg="#cdd6f4",
            bg="#1e1e2e",
            padx=12,
            pady=10,
            relief="flat"
        )
        log_card.pack(fill="both", expand=True)

        columns = ("time", "source", "prediction", "probability", "status")
        self.tree = ttk.Treeview(log_card, columns=columns, show="headings", height=6)
        self.tree.heading("time", text="Timestamp")
        self.tree.heading("source", text="Source")
        self.tree.heading("prediction", text="Prediction")
        self.tree.heading("probability", text="Cough Prob.")
        self.tree.heading("status", text="Notes")

        self.tree.column("time", width=95, anchor="center")
        self.tree.column("source", width=110, anchor="center")
        self.tree.column("prediction", width=160, anchor="center")
        self.tree.column("probability", width=110, anchor="center")
        self.tree.column("status", width=220, anchor="w")

        scrollbar = ttk.Scrollbar(log_card, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)
        self.tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # 3. Status Bar at Bottom
        status_bar = tk.Frame(self.root, bg="#11111b", padx=16, pady=4)
        status_bar.pack(fill="x", side="bottom")

        self.status_msg = tk.Label(
            status_bar,
            text="System Ready.",
            font=("Segoe UI", 8),
            fg="#6c7086",
            bg="#11111b"
        )
        self.status_msg.pack(side="left")

        btn_open_trainer = tk.Button(
            status_bar,
            text="🎙️ Record & Train Tool",
            font=("Segoe UI", 8, "bold"),
            bg="#313244",
            fg="#cdd6f4",
            activebackground="#45475a",
            relief="flat",
            padx=8,
            pady=2,
            cursor="hand2",
            command=self._launch_record_and_train
        )
        btn_open_trainer.pack(side="right", padx=(5, 0))

        btn_reload_model = tk.Button(
            status_bar,
            text="🔄 Reload Model",
            font=("Segoe UI", 8),
            bg="#313244",
            fg="#a6adc8",
            activebackground="#45475a",
            relief="flat",
            padx=6,
            pady=2,
            cursor="hand2",
            command=self._reload_model
        )
        btn_reload_model.pack(side="right")

    def _launch_record_and_train(self):
        script_path = os.path.join(self.base_dir, "record_and_train.py")
        if not os.path.exists(script_path):
            messagebox.showerror("Error", "record_and_train.py not found.")
            return
        import subprocess
        subprocess.Popen([sys.executable, script_path], cwd=self.base_dir)

    def _reload_model(self):
        loaded = self.engine.load_model()
        if loaded:
            self.model_badge.config(text="• MODEL LOADED", fg="#a6e3a1")
            self.status_msg.config(text="Model reloaded successfully.")
            messagebox.showinfo("Model Reloaded", "Latest model weights and config loaded successfully!")
        else:
            self.model_badge.config(text="• MODEL NOT FOUND", fg="#fab387")
            messagebox.showwarning("Warning", "Could not reload model. Ensure train.py has run.")

    def _show_model_missing_banner(self):
        messagebox.showwarning(
            "Model Not Found",
            "Trained model files ('cough_model.pth' / 'model_config.json') were not found in 'models/'.\n\n"
            "Please run 'train.py' first to train and save the model."
        )

    def _update_confidence_meter(self, prob: float):
        self.meter_canvas.delete("all")
        width = self.meter_canvas.winfo_width()
        if width <= 1:
            width = 680  # Default estimate before first render

        fill_width = max(0, min(width, int(width * prob)))

        # Dynamic color transitions: Emerald -> Amber -> Red
        if prob < 0.35:
            color = "#a6e3a1"  # Soft green
        elif prob < 0.65:
            color = "#f9e2af"  # Amber/yellow
        else:
            color = "#f38ba8"  # Crimson red

        self.meter_canvas.create_rectangle(0, 0, fill_width, 22, fill=color, outline="")

    def _update_display(self, label: str, prob: float, note: str = ""):
        pct = prob * 100.0
        self.prob_label.config(text=f"Cough Probability: {pct:.1f}%")
        self._update_confidence_meter(prob)

        if label == "COUGH DETECTED":
            self.badge_label.config(
                text="⚠ COUGH DETECTED",
                fg="#ffffff",
                bg="#f38ba8"  # High-visibility crimson
            )
        else:
            self.badge_label.config(
                text="✔ NO COUGH DETECTED",
                fg="#11111b",
                bg="#a6e3a1"  # Soft emerald green
            )

        if note:
            self.debounce_info.config(text=note)
        else:
            self.debounce_info.config(text="Debounce Cooldown: 1.5s active")

    def _log_detection(self, source: str, label: str, prob: float, note: str = ""):
        now_str = datetime.now().strftime("%H:%M:%S")
        prob_str = f"{prob * 100:.1f}%"
        item_id = self.tree.insert("", 0, values=(now_str, source, label, prob_str, note))
        # Keep only last 50 entries
        children = self.tree.get_children()
        if len(children) > 50:
            for old in children[50:]:
                self.tree.delete(old)

    # -------------------------------------------------------------------------
    # Microphone Streaming & Background Worker
    # -------------------------------------------------------------------------
    def start_microphone(self):
        if not self.engine.is_loaded:
            messagebox.showerror("Error", "Model is not loaded. Train a model first via 'train.py'.")
            return

        if self.is_recording:
            return

        try:
            self.is_recording = True
            self.btn_start_mic.config(state="disabled", bg="#45475a")
            self.btn_stop_mic.config(state="normal", bg="#f38ba8")
            self.status_msg.config(text="Live microphone stream active...")

            # Clear ring buffer
            self.ring_buffer = np.zeros(self.engine.target_samples, dtype=np.float32)

            # Start background processing thread
            self.audio_thread = threading.Thread(target=self._microphone_worker, daemon=True)
            self.audio_thread.start()

        except Exception as e:
            self.is_recording = False
            self.btn_start_mic.config(state="normal", bg="#89b4fa")
            self.btn_stop_mic.config(state="disabled")
            messagebox.showerror("Microphone Error", f"Could not start microphone stream:\n{e}")

    def stop_microphone(self):
        self.is_recording = False
        if self.audio_stream is not None:
            try:
                self.audio_stream.stop()
                self.audio_stream.close()
            except Exception:
                pass
            self.audio_stream = None

        self.btn_start_mic.config(state="normal", bg="#89b4fa")
        self.btn_stop_mic.config(state="disabled")
        self.status_msg.config(text="Microphone stopped.")

    def _microphone_worker(self):
        """
        Background audio worker: records small frames (e.g. 0.25s), updates rolling
        1.5s buffer, and runs inference every 0.4 seconds.
        """
        sr = self.engine.sample_rate
        frame_duration = 0.25  # seconds
        frame_samples = int(sr * frame_duration)

        eval_interval = 0.4  # Run model inference every 400 ms
        last_eval_time = 0.0

        try:
            with sd.InputStream(samplerate=sr, channels=1, dtype="float32", blocksize=frame_samples) as stream:
                self.audio_stream = stream
                while self.is_recording:
                    data, overflowed = stream.read(frame_samples)
                    if not self.is_recording:
                        break

                    chunk = data.flatten()
                    # Slide ring buffer
                    self.ring_buffer = np.roll(self.ring_buffer, -frame_samples)
                    self.ring_buffer[-frame_samples:] = chunk

                    now = time.time()
                    if now - last_eval_time >= eval_interval:
                        last_eval_time = now
                        label, prob = self.engine.predict_chunk(self.ring_buffer)

                        # Check debounce cooldown
                        is_cough = (prob >= 0.50)
                        in_cooldown = (now - self.last_detection_time < self.cooldown_seconds)

                        if is_cough and not in_cooldown:
                            self.last_detection_time = now
                            self.msg_queue.put(("detection", (label, prob, "Cough Event Triggered", True)))
                        elif is_cough and in_cooldown:
                            # Still in cooldown window
                            remaining = self.cooldown_seconds - (now - self.last_detection_time)
                            self.msg_queue.put(("detection", (label, prob, f"Cooldown ({remaining:.1f}s)", False)))
                        else:
                            self.msg_queue.put(("detection", (label, prob, "", False)))

        except Exception as e:
            self.msg_queue.put(("error", str(e)))

    # -------------------------------------------------------------------------
    # Audio File Upload & Playback
    # -------------------------------------------------------------------------
    def upload_audio_file(self):
        if not self.engine.is_loaded:
            messagebox.showerror("Error", "Model is not loaded. Train a model first via 'train.py'.")
            return

        file_types = [
            ("Audio Files", "*.wav *.mp3 *.ogg *.flac *.m4a *.aac"),
            ("WAV Files", "*.wav"),
            ("MP3 Files", "*.mp3"),
            ("All Files", "*.*")
        ]
        file_path = filedialog.askopenfilename(title="Select Audio File", filetypes=file_types)
        if not file_path:
            return

        try:
            filename = os.path.basename(file_path)
            self.lbl_file_name.config(text=f"Loaded: {filename}")
            self.status_msg.config(text=f"Analyzing {filename}...")

            # Run prediction on file
            label, max_prob, duration, audio = self.engine.predict_file(file_path)
            self.uploaded_audio = audio
            self.uploaded_sr = self.engine.sample_rate

            self.btn_play.config(state="normal")
            self._update_display(label, max_prob, f"File: {filename} ({duration:.1f}s)")
            self._log_detection(f"File: {filename}", label, max_prob, f"Duration: {duration:.1f}s")
            self.status_msg.config(text=f"Completed analysis of {filename}.")

        except Exception as e:
            messagebox.showerror("File Error", f"Failed to process audio file:\n{e}")

    def toggle_audio_playback(self):
        if self.uploaded_audio is None:
            return

        if self.is_playing_audio:
            # Stop playback
            sd.stop()
            self.is_playing_audio = False
            self.btn_play.config(text="🔊 Play Audio", bg="#cba6f7")
            self.status_msg.config(text="Playback stopped.")
        else:
            # Start playback
            try:
                sd.play(self.uploaded_audio, self.uploaded_sr)
                self.is_playing_audio = True
                self.btn_play.config(text="⏹ Stop Playback", bg="#f38ba8")
                self.status_msg.config(text="Playing audio file...")

                def check_done():
                    if self.is_playing_audio:
                        # Check if sounddevice is still active
                        status = sd.get_stream()
                        if status and status.active:
                            self.root.after(100, check_done)
                        else:
                            self.is_playing_audio = False
                            self.btn_play.config(text="🔊 Play Audio", bg="#cba6f7")
                            self.status_msg.config(text="Playback finished.")

                self.root.after(100, check_done)
            except Exception as e:
                messagebox.showerror("Playback Error", f"Could not play audio:\n{e}")

    # -------------------------------------------------------------------------
    # Thread-Safe Queue Consumer
    # -------------------------------------------------------------------------
    def _process_queue(self):
        try:
            while not self.msg_queue.empty():
                msg_type, data = self.msg_queue.get_nowait()
                if msg_type == "detection":
                    label, prob, note, trigger_log = data
                    self._update_display(label, prob, note)
                    if trigger_log:
                        self._log_detection("Microphone", label, prob, note)
                elif msg_type == "error":
                    self.stop_microphone()
                    messagebox.showerror("Microphone Stream Error", f"Stream error encountered:\n{data}")
        except Exception:
            pass
        finally:
            self.root.after(50, self._process_queue)


# -----------------------------------------------------------------------------
# Main Application Entry Point
# -----------------------------------------------------------------------------
def main():
    root = tk.Tk()
    app = CoughDetectorApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
