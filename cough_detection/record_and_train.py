"""
record_and_train.py — GUI Application to Record Audio and Train the Model

Features:
- Live Microphone Recording: Record custom cough and background noise samples directly from the GUI.
- Audio Sample Preview & Playback: Listen to newly recorded audio before keeping or discarding it.
- Dataset Counter & File Explorer: Live stats on cough and non-cough samples, with quick folder access.
- One-Click Model Training: Train the deep learning model directly inside the GUI with configurable epochs, batch size, and augmentations.
- Real-Time Training Progress: Interactive progress bar and live scrolling log console.
- Visual Confusion Matrix Display: Automatically displays the evaluation heatmap after training.
- Quick Launch: One-click button to open the recognition testing app (app.py).
"""

import os
# Prevent OpenMP / BLAS threading deadlock on Windows
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

import sys
import time
import queue
import threading
import subprocess
from datetime import datetime
from typing import Optional

import numpy as np
import soundfile as sf
import sounddevice as sd
from PIL import Image, ImageTk

import tkinter as tk
from tkinter import ttk, messagebox

# Import training pipeline functions
from train import run_training, discover_dataset, SAMPLE_RATE, DURATION


class RecordAndTrainApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Cough Dataset Recorder & Model Trainer")
        self.root.geometry("860x780")
        self.root.minsize(800, 720)
        self.root.configure(bg="#181825")

        # Directories
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.dataset_dir = os.path.join(self.base_dir, "dataset")
        self.cough_dir = os.path.join(self.dataset_dir, "cough")
        self.non_cough_dir = os.path.join(self.dataset_dir, "non_cough")
        self.models_dir = os.path.join(self.base_dir, "models")

        os.makedirs(self.cough_dir, exist_ok=True)
        os.makedirs(self.non_cough_dir, exist_ok=True)
        os.makedirs(self.models_dir, exist_ok=True)

        # State variables
        self.is_recording = False
        self.is_training = False
        self.last_recorded_audio = None
        self.last_recorded_path = None
        self.msg_queue = queue.Queue()
        self.cm_photo = None  # To retain reference to Tk image
        self.selected_device_idx = None
        self.input_device_map = {}

        self._build_ui()
        self._refresh_dataset_counts()
        self._refresh_audio_devices()

        # Start background queue polling
        self.root.after(60, self._process_queue)

    def _build_ui(self):
        # 1. Header Banner
        header = tk.Frame(self.root, bg="#11111b", padx=20, pady=12)
        header.pack(fill="x", side="top")

        title_lbl = tk.Label(
            header,
            text="DATASET RECORDER & MODEL TRAINER",
            font=("Segoe UI", 16, "bold"),
            fg="#cdd6f4",
            bg="#11111b"
        )
        title_lbl.pack(anchor="w")

        sub_lbl = tk.Label(
            header,
            text="Record real-world cough and ambient noise samples, expand your dataset, and train the model directly.",
            font=("Segoe UI", 9),
            fg="#a6adc8",
            bg="#11111b"
        )
        sub_lbl.pack(anchor="w")

        # 2. Main Content Canvas with Scrollbar
        container = tk.Frame(self.root, bg="#181825")
        container.pack(fill="both", expand=True, padx=16, pady=10)

        # 2A. Dataset Summary & Management Card
        summary_card = tk.LabelFrame(
            container,
            text=" Current Dataset Status ",
            font=("Segoe UI", 10, "bold"),
            fg="#cdd6f4",
            bg="#1e1e2e",
            padx=14,
            pady=10,
            relief="flat"
        )
        summary_card.pack(fill="x", pady=(0, 10))

        counts_frame = tk.Frame(summary_card, bg="#1e1e2e")
        counts_frame.pack(fill="x")

        self.lbl_cough_count = tk.Label(
            counts_frame,
            text="Cough Samples: 0",
            font=("Segoe UI", 11, "bold"),
            fg="#f38ba8",
            bg="#1e1e2e",
            padx=10
        )
        self.lbl_cough_count.pack(side="left")

        self.lbl_non_cough_count = tk.Label(
            counts_frame,
            text="Non-Cough Samples: 0",
            font=("Segoe UI", 11, "bold"),
            fg="#a6e3a1",
            bg="#1e1e2e",
            padx=10
        )
        self.lbl_non_cough_count.pack(side="left")

        self.lbl_total_count = tk.Label(
            counts_frame,
            text="Total: 0",
            font=("Segoe UI", 11, "bold"),
            fg="#89b4fa",
            bg="#1e1e2e",
            padx=10
        )
        self.lbl_total_count.pack(side="left")

        btn_open_folder = tk.Button(
            counts_frame,
            text="📂 Open Dataset Folder",
            font=("Segoe UI", 8, "bold"),
            bg="#313244",
            fg="#cdd6f4",
            relief="flat",
            padx=8,
            pady=3,
            cursor="hand2",
            command=self._open_dataset_folder
        )
        btn_open_folder.pack(side="right", padx=5)

        btn_refresh = tk.Button(
            counts_frame,
            text="🔄 Refresh",
            font=("Segoe UI", 8, "bold"),
            bg="#313244",
            fg="#cdd6f4",
            relief="flat",
            padx=8,
            pady=3,
            cursor="hand2",
            command=self._refresh_dataset_counts
        )
        btn_refresh.pack(side="right")

        # 2B. Audio Recorder Card
        record_card = tk.LabelFrame(
            container,
            text=" 🎙️ Record Custom Audio Sample ",
            font=("Segoe UI", 10, "bold"),
            fg="#cdd6f4",
            bg="#1e1e2e",
            padx=14,
            pady=10,
            relief="flat"
        )
        record_card.pack(fill="x", pady=(0, 10))

        # Input device selector row
        device_row = tk.Frame(record_card, bg="#1e1e2e")
        device_row.pack(fill="x", pady=(0, 8))

        tk.Label(device_row, text="Input Device:", font=("Segoe UI", 9, "bold"), fg="#cdd6f4", bg="#1e1e2e").pack(side="left", padx=(0, 8))
        self.device_var = tk.StringVar()
        self.device_combo = ttk.Combobox(device_row, textvariable=self.device_var, state="readonly", width=44)
        self.device_combo.pack(side="left", padx=(0, 8), fill="x", expand=True)
        self.device_combo.bind("<<ComboboxSelected>>", self._on_device_selected)

        btn_refresh_dev = tk.Button(
            device_row,
            text="🔄 Refresh Devices",
            font=("Segoe UI", 8, "bold"),
            bg="#313244",
            fg="#cdd6f4",
            activebackground="#45475a",
            relief="flat",
            padx=8,
            pady=2,
            cursor="hand2",
            command=self._refresh_audio_devices
        )
        btn_refresh_dev.pack(side="left")

        # Class selector radiobuttons
        class_frame = tk.Frame(record_card, bg="#1e1e2e")
        class_frame.pack(fill="x", pady=(0, 8))

        tk.Label(class_frame, text="Target Class:", font=("Segoe UI", 9, "bold"), fg="#cdd6f4", bg="#1e1e2e").pack(side="left", padx=(0, 10))
        self.target_class_var = tk.StringVar(value="cough")

        r1 = tk.Radiobutton(
            class_frame,
            text="Cough  (Positive)",
            variable=self.target_class_var,
            value="cough",
            font=("Segoe UI", 9, "bold"),
            fg="#f38ba8",
            bg="#1e1e2e",
            selectcolor="#313244",
            activebackground="#1e1e2e",
            activeforeground="#f38ba8"
        )
        r1.pack(side="left", padx=(0, 15))

        r2 = tk.Radiobutton(
            class_frame,
            text="Non-Cough  (Speech, Noise, Sneeze, Breathing, Ambient)",
            variable=self.target_class_var,
            value="non_cough",
            font=("Segoe UI", 9, "bold"),
            fg="#a6e3a1",
            bg="#1e1e2e",
            selectcolor="#313244",
            activebackground="#1e1e2e",
            activeforeground="#a6e3a1"
        )
        r2.pack(side="left")

        # Duration and custom tag
        config_row = tk.Frame(record_card, bg="#1e1e2e")
        config_row.pack(fill="x", pady=(0, 10))

        tk.Label(config_row, text="Duration:", font=("Segoe UI", 9), fg="#a6adc8", bg="#1e1e2e").pack(side="left", padx=(0, 5))
        self.duration_var = tk.StringVar(value="1.5")
        duration_cb = ttk.Combobox(config_row, textvariable=self.duration_var, values=["1.5", "2.0", "3.0"], width=5, state="readonly")
        duration_cb.pack(side="left", padx=(0, 15))
        tk.Label(config_row, text="seconds", font=("Segoe UI", 8), fg="#6c7086", bg="#1e1e2e").pack(side="left", padx=(0, 20))

        tk.Label(config_row, text="Label/Tag:", font=("Segoe UI", 9), fg="#a6adc8", bg="#1e1e2e").pack(side="left", padx=(0, 5))
        self.tag_entry = tk.Entry(config_row, font=("Segoe UI", 9), bg="#313244", fg="#cdd6f4", insertbackground="#cdd6f4", width=18, relief="flat")
        self.tag_entry.insert(0, "custom")
        self.tag_entry.pack(side="left")

        # Record action buttons and status
        action_row = tk.Frame(record_card, bg="#1e1e2e")
        action_row.pack(fill="x", pady=4)

        self.btn_record = tk.Button(
            action_row,
            text="🎙️ Record Audio Sample",
            font=("Segoe UI", 10, "bold"),
            bg="#f38ba8",
            fg="#11111b",
            activebackground="#eba0ac",
            cursor="hand2",
            relief="flat",
            padx=12,
            pady=6,
            command=self.record_sample
        )
        self.btn_record.pack(side="left", padx=(0, 8))

        self.btn_listen = tk.Button(
            action_row,
            text="🔊 Playback Last",
            font=("Segoe UI", 9, "bold"),
            bg="#89b4fa",
            fg="#11111b",
            activebackground="#b4befe",
            cursor="hand2",
            relief="flat",
            state="disabled",
            padx=10,
            pady=6,
            command=self.play_last_recording
        )
        self.btn_listen.pack(side="left", padx=(0, 8))

        self.btn_test_ai = tk.Button(
            action_row,
            text="🤖 Test with AI Model",
            font=("Segoe UI", 9, "bold"),
            bg="#cba6f7",
            fg="#11111b",
            activebackground="#f5c2e7",
            cursor="hand2",
            relief="flat",
            state="disabled",
            padx=10,
            pady=6,
            command=self.test_last_recording_with_ai
        )
        self.btn_test_ai.pack(side="left", padx=(0, 8))

        self.btn_discard = tk.Button(
            action_row,
            text="🗑️ Discard",
            font=("Segoe UI", 9, "bold"),
            bg="#45475a",
            fg="#cdd6f4",
            activebackground="#585b70",
            cursor="hand2",
            relief="flat",
            state="disabled",
            padx=10,
            pady=6,
            command=self.discard_last_recording
        )
        self.btn_discard.pack(side="left")

        self.record_status_lbl = tk.Label(
            record_card,
            text="Ready to record.",
            font=("Segoe UI", 8),
            fg="#a6adc8",
            bg="#1e1e2e"
        )
        self.record_status_lbl.pack(anchor="w", pady=(6, 0))

        # 2C. Model Training Card
        train_card = tk.LabelFrame(
            container,
            text=" 🚀 Train Model ",
            font=("Segoe UI", 10, "bold"),
            fg="#cdd6f4",
            bg="#1e1e2e",
            padx=14,
            pady=10,
            relief="flat"
        )
        train_card.pack(fill="both", expand=True)

        # Hyperparameters row
        param_row = tk.Frame(train_card, bg="#1e1e2e")
        param_row.pack(fill="x", pady=(0, 8))

        tk.Label(param_row, text="Epochs:", font=("Segoe UI", 9), fg="#a6adc8", bg="#1e1e2e").pack(side="left", padx=(0, 5))
        self.epochs_var = tk.StringVar(value="15")
        epoch_spin = tk.Spinbox(param_row, from_=1, to=100, textvariable=self.epochs_var, width=5, bg="#313244", fg="#cdd6f4", relief="flat")
        epoch_spin.pack(side="left", padx=(0, 15))

        tk.Label(param_row, text="Batch Size:", font=("Segoe UI", 9), fg="#a6adc8", bg="#1e1e2e").pack(side="left", padx=(0, 5))
        self.batch_var = tk.StringVar(value="16")
        batch_cb = ttk.Combobox(param_row, textvariable=self.batch_var, values=["8", "16", "32"], width=4, state="readonly")
        batch_cb.pack(side="left", padx=(0, 15))

        self.augment_var = tk.BooleanVar(value=True)
        chk_aug = tk.Checkbutton(
            param_row,
            text="Enable Data Augmentations (Noise, Shift, Gain)",
            variable=self.augment_var,
            font=("Segoe UI", 9),
            fg="#cdd6f4",
            bg="#1e1e2e",
            selectcolor="#313244",
            activebackground="#1e1e2e"
        )
        chk_aug.pack(side="left", padx=(0, 15))

        self.btn_train = tk.Button(
            param_row,
            text="⚡ Start Training",
            font=("Segoe UI", 10, "bold"),
            bg="#a6e3a1",
            fg="#11111b",
            activebackground="#94e2d5",
            cursor="hand2",
            relief="flat",
            padx=12,
            pady=5,
            command=self.start_training
        )
        self.btn_train.pack(side="right")

        # Training progress bar
        self.progress_bar = ttk.Progressbar(train_card, orient="horizontal", mode="determinate")
        self.progress_bar.pack(fill="x", pady=(0, 6))

        # Training log console
        log_frame = tk.Frame(train_card, bg="#11111b")
        log_frame.pack(fill="both", expand=True)

        self.log_text = tk.Text(
            log_frame,
            height=7,
            bg="#11111b",
            fg="#cdd6f4",
            insertbackground="#cdd6f4",
            font=("Consolas", 9),
            bd=0,
            padx=8,
            pady=6
        )
        log_scroll = ttk.Scrollbar(log_frame, orient="vertical", command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=log_scroll.set)
        self.log_text.pack(side="left", fill="both", expand=True)
        log_scroll.pack(side="right", fill="y")

        # 3. Bottom Action Bar
        bottom_bar = tk.Frame(self.root, bg="#11111b", padx=16, pady=8)
        bottom_bar.pack(fill="x", side="bottom")

        self.status_lbl = tk.Label(
            bottom_bar,
            text="Ready.",
            font=("Segoe UI", 8),
            fg="#6c7086",
            bg="#11111b"
        )
        self.status_lbl.pack(side="left")

        btn_launch_app = tk.Button(
            bottom_bar,
            text="🚀 Open Recognition Tester (app.py)",
            font=("Segoe UI", 9, "bold"),
            bg="#89b4fa",
            fg="#11111b",
            relief="flat",
            padx=10,
            pady=4,
            cursor="hand2",
            command=self._launch_app_py
        )
        btn_launch_app.pack(side="right")

        btn_view_cm = tk.Button(
            bottom_bar,
            text="📊 View Confusion Matrix",
            font=("Segoe UI", 9),
            bg="#313244",
            fg="#cdd6f4",
            relief="flat",
            padx=8,
            pady=4,
            cursor="hand2",
            command=self._show_confusion_matrix_dialog
        )
        btn_view_cm.pack(side="right", padx=8)

    # -------------------------------------------------------------------------
    # Dataset Management Helpers
    # -------------------------------------------------------------------------
    def _refresh_dataset_counts(self):
        valid_exts = {".wav", ".mp3", ".ogg", ".flac", ".m4a"}
        cough_files = [f for f in os.listdir(self.cough_dir) if os.path.splitext(f.lower())[1] in valid_exts] if os.path.exists(self.cough_dir) else []
        non_cough_files = [f for f in os.listdir(self.non_cough_dir) if os.path.splitext(f.lower())[1] in valid_exts] if os.path.exists(self.non_cough_dir) else []

        n_c = len(cough_files)
        n_nc = len(non_cough_files)
        total = n_c + n_nc

        self.lbl_cough_count.config(text=f"Cough Samples: {n_c}")
        self.lbl_non_cough_count.config(text=f"Non-Cough Samples: {n_nc}")
        self.lbl_total_count.config(text=f"Total: {total}")

    def _open_dataset_folder(self):
        try:
            os.startfile(self.dataset_dir)
        except Exception as e:
            messagebox.showinfo("Dataset Path", f"Dataset directory:\n{self.dataset_dir}")

    def _refresh_audio_devices(self):
        try:
            devices = sd.query_devices()
            hostapis = sd.query_hostapis()
            self.input_device_map = {}
            display_list = ["Default System Input Device"]
            self.input_device_map["Default System Input Device"] = None

            for idx, dev in enumerate(devices):
                if dev.get("max_input_channels", 0) > 0:
                    api_idx = dev.get("hostapi", 0)
                    api_name = hostapis[api_idx]["name"] if api_idx < len(hostapis) else ""
                    name = f"[{idx}] {dev['name']} ({api_name})"
                    display_list.append(name)
                    self.input_device_map[name] = idx

            self.device_combo["values"] = display_list
            if display_list:
                self.device_combo.current(0)
                self.selected_device_idx = None
        except Exception as e:
            self.device_combo["values"] = ["Default System Input Device"]
            self.device_combo.current(0)
            self.selected_device_idx = None

    def _on_device_selected(self, event=None):
        selected_text = self.device_var.get()
        self.selected_device_idx = self.input_device_map.get(selected_text, None)
        dev_desc = selected_text if self.selected_device_idx is not None else "Default System Input Device"
        self.status_lbl.config(text=f"Selected input device: {dev_desc}")

    # -------------------------------------------------------------------------
    # Recording Logic
    # -------------------------------------------------------------------------
    def record_sample(self):
        if self.is_recording:
            return

        try:
            dur = float(self.duration_var.get())
        except ValueError:
            dur = 1.5

        target_class = self.target_class_var.get()
        tag = self.tag_entry.get().strip() or "sample"
        # Sanitize tag
        tag = "".join(c for c in tag if c.isalnum() or c in ("_", "-"))

        target_folder = self.cough_dir if target_class == "cough" else self.non_cough_dir
        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{tag}_{timestamp_str}.wav"
        save_path = os.path.join(target_folder, filename)

        self.is_recording = True
        self.btn_record.config(state="disabled", bg="#45475a")
        self.btn_listen.config(state="disabled")
        self.btn_discard.config(state="disabled")
        self.record_status_lbl.config(text=f"🔴 RECORDING NOW ({dur:.1f}s)... Speak or make sound near microphone!", fg="#f38ba8")
        self.status_lbl.config(text="Recording audio...")

        def _record_worker():
            try:
                num_frames = int(dur * SAMPLE_RATE)
                audio = sd.rec(num_frames, samplerate=SAMPLE_RATE, channels=1, dtype="float32", device=self.selected_device_idx)
                sd.wait()
                audio = audio.flatten()

                # Save file
                sf.write(save_path, audio, SAMPLE_RATE)
                self.msg_queue.put(("record_done", (save_path, audio, target_class, filename)))
            except Exception as e:
                self.msg_queue.put(("record_error", str(e)))

        threading.Thread(target=_record_worker, daemon=True).start()

    def play_last_recording(self):
        if self.last_recorded_audio is None:
            return
        try:
            sd.play(self.last_recorded_audio, SAMPLE_RATE)
            self.status_lbl.config(text="Playing back recorded sample...")
        except Exception as e:
            messagebox.showerror("Playback Error", f"Could not play audio:\n{e}")

    def discard_last_recording(self):
        if not self.last_recorded_path or not os.path.exists(self.last_recorded_path):
            return

        confirm = messagebox.askyesno("Confirm Discard", f"Delete the last recorded file?\n{os.path.basename(self.last_recorded_path)}")
        if confirm:
            try:
                os.remove(self.last_recorded_path)
                self.record_status_lbl.config(text=f"Discarded {os.path.basename(self.last_recorded_path)}.", fg="#a6adc8")
                self.btn_listen.config(state="disabled")
                self.btn_test_ai.config(state="disabled")
                self.btn_discard.config(state="disabled")
                self.last_recorded_path = None
                self.last_recorded_audio = None
                self._refresh_dataset_counts()
            except Exception as e:
                messagebox.showerror("Error", f"Failed to delete file:\n{e}")

    def test_last_recording_with_ai(self):
        if not self.last_recorded_path or not os.path.exists(self.last_recorded_path):
            messagebox.showinfo("Test", "No recorded audio sample found.")
            return

        from app import AudioInferenceEngine
        engine = AudioInferenceEngine(models_dir=self.models_dir)
        if not engine.is_loaded:
            messagebox.showwarning("Model Not Loaded", "Trained model not found in models/. Please train the model first!")
            return

        label, prob, dur, _ = engine.predict_file(self.last_recorded_path)
        color = "#f38ba8" if label == "COUGH DETECTED" else "#a6e3a1"
        self.record_status_lbl.config(
            text=f"AI Prediction: {label} (Cough Probability: {prob*100:.1f}%)",
            fg=color
        )
        self.status_lbl.config(text=f"AI evaluated {os.path.basename(self.last_recorded_path)}: {label} ({prob*100:.1f}%)")

    # -------------------------------------------------------------------------
    # Model Training Logic
    # -------------------------------------------------------------------------
    def start_training(self):
        if self.is_training:
            return

        try:
            epochs = int(self.epochs_var.get())
            if epochs < 1:
                epochs = 15
        except ValueError:
            epochs = 15

        try:
            batch_size = int(self.batch_var.get())
        except ValueError:
            batch_size = 16

        augment = self.augment_var.get()

        # Check dataset size
        file_paths, labels = discover_dataset(self.dataset_dir)
        c_count = sum(1 for l in labels if l == 1)
        nc_count = sum(1 for l in labels if l == 0)

        if c_count < 2 or nc_count < 2:
            messagebox.showwarning(
                "Insufficient Data",
                f"Training requires at least 2 samples per class.\n"
                f"Current: {c_count} Cough, {nc_count} Non-Cough.\n\n"
                "Please record more samples or run 'py generate_sample_data.py' to bootstrap data."
            )
            return

        self.is_training = True
        self.btn_train.config(state="disabled", bg="#45475a")
        self.progress_bar["value"] = 0
        self.log_text.delete("1.0", tk.END)
        self._append_log(f"Starting model training ({epochs} epochs, batch size {batch_size}, augment={augment})...\n")
        self.status_lbl.config(text="Model training in progress...")

        def _progress_cb(epoch, total_epochs, train_loss, train_acc, val_loss, val_acc):
            pct = int((epoch / total_epochs) * 100)
            self.msg_queue.put(("train_progress", (epoch, total_epochs, pct, train_loss, train_acc, val_loss, val_acc)))

        def _log_cb(msg):
            self.msg_queue.put(("train_log", msg))

        def _train_worker():
            try:
                metrics = run_training(
                    dataset_dir=self.dataset_dir,
                    models_dir=self.models_dir,
                    epochs=epochs,
                    batch_size=batch_size,
                    lr=0.001,
                    augment=augment,
                    progress_callback=_progress_cb,
                    log_callback=_log_cb,
                )
                self.msg_queue.put(("train_complete", metrics))
            except Exception as e:
                self.msg_queue.put(("train_error", str(e)))

        threading.Thread(target=_train_worker, daemon=True).start()

    def _append_log(self, text: str):
        self.log_text.insert(tk.END, text + "\n")
        self.log_text.see(tk.END)

    def _show_confusion_matrix_dialog(self):
        cm_path = os.path.join(self.models_dir, "confusion_matrix.png")
        if not os.path.exists(cm_path):
            messagebox.showinfo("Confusion Matrix", "No confusion matrix found. Train a model first!")
            return

        top = tk.Toplevel(self.root)
        top.title("Confusion Matrix Evaluation")
        top.geometry("540x480")
        top.configure(bg="#181825")

        try:
            img = Image.open(cm_path)
            img = img.resize((500, 400), Image.Resampling.LANCZOS)
            self.cm_photo = ImageTk.PhotoImage(img)
            lbl = tk.Label(top, image=self.cm_photo, bg="#181825")
            lbl.pack(pady=10)
        except Exception as e:
            tk.Label(top, text=f"Could not render image: {e}", fg="#f38ba8", bg="#181825").pack(pady=20)

    def _launch_app_py(self):
        app_script = os.path.join(self.base_dir, "app.py")
        if not os.path.exists(app_script):
            messagebox.showerror("Error", "app.py not found.")
            return
        try:
            subprocess.Popen([sys.executable, app_script], cwd=self.base_dir)
            self.status_lbl.config(text="Launched recognition tester (app.py).")
        except Exception as e:
            messagebox.showerror("Launch Error", f"Failed to launch app.py:\n{e}")

    # -------------------------------------------------------------------------
    # Thread-Safe Queue Consumer
    # -------------------------------------------------------------------------
    def _process_queue(self):
        try:
            while not self.msg_queue.empty():
                mtype, data = self.msg_queue.get_nowait()

                if mtype == "record_done":
                    save_path, audio, target_class, filename = data
                    self.is_recording = False
                    self.last_recorded_audio = audio
                    self.last_recorded_path = save_path
                    self.btn_record.config(state="normal", bg="#f38ba8")
                    self.btn_listen.config(state="normal")
                    self.btn_test_ai.config(state="normal")
                    self.btn_discard.config(state="normal")
                    self.record_status_lbl.config(
                        text=f"✔ Saved: {filename} to {target_class}/",
                        fg="#a6e3a1"
                    )
                    self.status_lbl.config(text=f"Saved {filename}")
                    self._refresh_dataset_counts()

                elif mtype == "record_error":
                    self.is_recording = False
                    self.btn_record.config(state="normal", bg="#f38ba8")
                    self.record_status_lbl.config(text=f"Recording error: {data}", fg="#f38ba8")
                    messagebox.showerror("Microphone Error", f"Failed to record audio:\n{data}")

                elif mtype == "train_progress":
                    epoch, total_epochs, pct, t_loss, t_acc, v_loss, v_acc = data
                    self.progress_bar["value"] = pct
                    self.status_lbl.config(text=f"Training epoch {epoch}/{total_epochs} (Val Acc: {v_acc:.1f}%)...")

                elif mtype == "train_log":
                    self._append_log(str(data))

                elif mtype == "train_complete":
                    metrics = data
                    self.is_training = False
                    self.btn_train.config(state="normal", bg="#a6e3a1")
                    self.progress_bar["value"] = 100
                    acc = metrics.get("test_accuracy", 0.0)
                    f1 = metrics.get("f1_score", 0.0) * 100.0
                    self.status_lbl.config(text=f"Training Complete! Test Accuracy: {acc:.1f}%, F1: {f1:.1f}%")
                    messagebox.showinfo(
                        "Training Complete",
                        f"Model training and evaluation finished successfully!\n\n"
                        f"Test Accuracy: {acc:.2f}%\n"
                        f"Test F1-Score: {f1:.2f}%\n\n"
                        "The updated model is saved to 'models/cough_model.pth' and ready for testing!"
                    )
                    self._show_confusion_matrix_dialog()

                elif mtype == "train_error":
                    self.is_training = False
                    self.btn_train.config(state="normal", bg="#a6e3a1")
                    self.status_lbl.config(text="Training failed.")
                    messagebox.showerror("Training Error", f"Training encountered an error:\n{data}")

        except Exception:
            pass
        finally:
            self.root.after(60, self._process_queue)


def main():
    root = tk.Tk()
    app = RecordAndTrainApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
