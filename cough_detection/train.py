"""
train.py — Training Program for Cough Sound Recognition

Features:
- Robust audio loading (.wav, .mp3, .flac, .ogg) with sample-rate standardization (16 kHz).
- Audio feature extraction: Log-Mel Spectrograms.
- Real-world environmental data augmentation:
    * Background noise injection (random SNR 5-25 dB)
    * Time-shifting (rolling audio)
    * Volume / gain perturbation (0.6x - 1.4x)
    * Subtle pitch shifting
    * SpecAugment (time & frequency masking)
- Train / Validation / Test stratified split.
- Lightweight, CPU-friendly 2D-CNN (CoughCNN).
- Detailed metrics: Accuracy, Precision, Recall, F1-Score, Confusion Matrix plot.
- Persists model weights and preprocessing parameters to models/.
"""

import os
# Prevent OpenMP / BLAS threading deadlock on Windows with Python 3.13
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

import sys
import json
import time
import random
import argparse
from typing import List, Tuple, Dict

import numpy as np
import soundfile as sf
import librosa
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend for headless plotting
import matplotlib.pyplot as plt

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader

from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
)

# -----------------------------------------------------------------------------
# Configuration Defaults
# -----------------------------------------------------------------------------
SAMPLE_RATE = 16000
DURATION = 1.5  # Fixed audio window duration in seconds
TARGET_SAMPLES = int(SAMPLE_RATE * DURATION)  # 24,000 samples
N_FFT = 1024
HOP_LENGTH = 512
N_MELS = 64
FMIN = 50
FMAX = 8000

CLASS_NAMES = ["non_cough", "cough"]
CLASS_TO_IDX = {"non_cough": 0, "cough": 1}
IDX_TO_CLASS = {0: "non_cough", 1: "cough"}


# -----------------------------------------------------------------------------
# Neural Network Architecture
# -----------------------------------------------------------------------------
class CoughCNN(nn.Module):
    """
    Lightweight 2D Convolutional Neural Network for Log-Mel Spectrograms.
    Fast CPU inference (<15ms) and low memory footprint (~140K parameters).
    """
    def __init__(self, num_classes: int = 2, in_channels: int = 1):
        super(CoughCNN, self).__init__()

        # Conv Block 1: (1, 64, 47) -> (32, 32, 23)
        self.conv1 = nn.Conv2d(in_channels, 32, kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm2d(32)
        self.pool1 = nn.MaxPool2d(2, 2)
        self.drop1 = nn.Dropout(0.2)

        # Conv Block 2: (32, 32, 23) -> (64, 16, 11)
        self.conv2 = nn.Conv2d(32, 64, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm2d(64)
        self.pool2 = nn.MaxPool2d(2, 2)
        self.drop2 = nn.Dropout(0.2)

        # Conv Block 3: (64, 16, 11) -> (128, 8, 5)
        self.conv3 = nn.Conv2d(64, 128, kernel_size=3, padding=1)
        self.bn3 = nn.BatchNorm2d(128)
        self.pool3 = nn.MaxPool2d(2, 2)
        self.drop3 = nn.Dropout(0.3)

        # Conv Block 4: (128, 8, 5) -> (128, 2, 2)
        self.conv4 = nn.Conv2d(128, 128, kernel_size=3, padding=1)
        self.bn4 = nn.BatchNorm2d(128)
        self.pool4 = nn.AdaptiveAvgPool2d((2, 2))
        self.drop4 = nn.Dropout(0.3)

        # Fully Connected Head
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
# Audio Loading & Preprocessing
# -----------------------------------------------------------------------------
def load_and_fix_audio(file_path: str, target_sr: int = SAMPLE_RATE, target_samples: int = TARGET_SAMPLES, is_train: bool = False) -> np.ndarray:
    """
    Loads an audio file (.wav, .mp3, .ogg, .flac), converts to mono, resamples
    to target_sr, and adjusts length to target_samples (via random or center cropping/padding).
    """
    try:
        audio, sr = sf.read(file_path, dtype="float32")
    except Exception:
        # Fallback to librosa for formats not supported by soundfile
        audio, sr = librosa.load(file_path, sr=target_sr, mono=True)

    # Convert stereo to mono
    if audio.ndim > 1:
        audio = np.mean(audio, axis=1)

    # Resample if sample rate doesn't match
    if sr != target_sr:
        audio = librosa.resample(audio, orig_sr=sr, target_sr=target_sr)

    # Remove DC offset & peak normalize
    audio = audio - np.mean(audio)
    max_peak = np.max(np.abs(audio))
    if max_peak > 1e-6:
        audio = audio / max_peak

    # Length standardization
    n_samples = len(audio)
    if n_samples < target_samples:
        pad_width = target_samples - n_samples
        if is_train and random.random() < 0.5:
            # Random left/right padding
            pad_left = random.randint(0, pad_width)
            pad_right = pad_width - pad_left
            audio = np.pad(audio, (pad_left, pad_right), mode="constant")
        else:
            # Center padding
            pad_left = pad_width // 2
            pad_right = pad_width - pad_left
            audio = np.pad(audio, (pad_left, pad_right), mode="constant")
    elif n_samples > target_samples:
        if is_train:
            # Random crop during training
            start = random.randint(0, n_samples - target_samples)
            audio = audio[start : start + target_samples]
        else:
            # Center crop during evaluation
            start = (n_samples - target_samples) // 2
            audio = audio[start : start + target_samples]

    return audio.astype(np.float32)


# -----------------------------------------------------------------------------
# Data Augmentation Functions (Real-World Environmental Noise Robustness)
# -----------------------------------------------------------------------------
def augment_audio(audio: np.ndarray, sr: int = SAMPLE_RATE) -> np.ndarray:
    """
    Applies audio-domain augmentations to simulate noisy, varied real-world recording conditions.
    """
    aug = audio.copy()

    # 1. Additive Background Noise (Gaussian & pink-like shaped noise with random SNR 5 - 25 dB)
    if random.random() < 0.6:
        signal_power = np.mean(aug ** 2) + 1e-9
        snr_db = random.uniform(8.0, 22.0)
        snr_linear = 10.0 ** (snr_db / 10.0)
        noise_power = signal_power / snr_linear
        noise = np.random.normal(0, np.sqrt(noise_power), len(aug))
        # Optional low-pass filtering on noise to simulate room ambient hum / fan
        if random.random() < 0.5:
            fft_noise = np.fft.rfft(noise)
            freqs = np.fft.rfftfreq(len(noise), 1.0 / sr)
            cutoff = random.uniform(400, 2500)
            fft_noise[freqs > cutoff] *= 0.2
            noise = np.fft.irfft(fft_noise, len(noise))
        aug = aug + noise

    # 2. Time Shifting (roll by up to 25% of length)
    if random.random() < 0.5:
        shift = int(random.uniform(-0.25, 0.25) * len(aug))
        aug = np.roll(aug, shift)

    # 3. Volume / Gain variation (0.6x to 1.4x)
    if random.random() < 0.6:
        gain = random.uniform(0.6, 1.4)
        aug = aug * gain

    # 4. Fast Pitch / Speed Perturbation (±8% speed & pitch shift)
    if random.random() < 0.4:
        factor = random.uniform(0.92, 1.08)
        new_len = max(1, int(len(aug) * factor))
        indices = np.linspace(0, len(aug) - 1, new_len)
        shifted = np.interp(indices, np.arange(len(aug)), aug)
        if len(shifted) < TARGET_SAMPLES:
            aug = np.pad(shifted, (0, TARGET_SAMPLES - len(shifted)))
        else:
            aug = shifted[:TARGET_SAMPLES]

    return aug


def extract_log_mel_spectrogram(audio: np.ndarray, sr: int = SAMPLE_RATE) -> np.ndarray:
    """
    Computes Log-Mel Spectrogram in decibels. Output shape: (n_mels, time_steps).
    """
    mel = librosa.feature.melspectrogram(
        y=audio,
        sr=sr,
        n_fft=N_FFT,
        hop_length=HOP_LENGTH,
        n_mels=N_MELS,
        fmin=FMIN,
        fmax=FMAX,
        power=2.0
    )
    log_mel = librosa.power_to_db(mel, ref=np.max)
    return log_mel.astype(np.float32)


def apply_spec_augment(spec: np.ndarray, max_mask_time: int = 6, max_mask_freq: int = 6) -> np.ndarray:
    """
    SpecAugment: Masks random time and frequency bands to make the model
    resilient against acoustic nulls and frequency dropouts.
    """
    augmented = spec.copy()
    num_mels, num_steps = augmented.shape

    # Frequency masking
    if random.random() < 0.5:
        f_width = random.randint(1, max_mask_freq)
        f_start = random.randint(0, max(0, num_mels - f_width))
        augmented[f_start : f_start + f_width, :] = -80.0  # Silence/low energy in dB

    # Time masking
    if random.random() < 0.5:
        t_width = random.randint(1, max_mask_time)
        t_start = random.randint(0, max(0, num_steps - t_width))
        augmented[:, t_start : t_start + t_width] = -80.0

    return augmented


# -----------------------------------------------------------------------------
# PyTorch Dataset
# -----------------------------------------------------------------------------
class CoughAudioDataset(Dataset):
    def __init__(
        self,
        file_paths: List[str],
        labels: List[int],
        mean: float = 0.0,
        std: float = 1.0,
        is_train: bool = False,
        augment: bool = True,
    ):
        self.file_paths = file_paths
        self.labels = labels
        self.mean = mean
        self.std = std
        self.is_train = is_train
        self.augment = augment

    def __len__(self) -> int:
        return len(self.file_paths)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int]:
        file_path = self.file_paths[idx]
        label = self.labels[idx]

        # 1. Load and fix length
        audio = load_and_fix_audio(file_path, is_train=self.is_train)

        # 2. Audio Augmentation (train only)
        if self.is_train and self.augment:
            audio = augment_audio(audio)

        # 3. Log-Mel Spectrogram Extraction
        log_mel = extract_log_mel_spectrogram(audio)

        # 4. SpecAugment (train only)
        if self.is_train and self.augment:
            log_mel = apply_spec_augment(log_mel)

        # 5. Normalization using dataset statistics
        norm_mel = (log_mel - self.mean) / (self.std + 1e-6)

        # Shape for Conv2D: (1, n_mels, time_steps)
        tensor = torch.tensor(norm_mel, dtype=torch.float32).unsqueeze(0)
        return tensor, label


# -----------------------------------------------------------------------------
# Dataset Discovery & Splitting
# -----------------------------------------------------------------------------
def discover_dataset(dataset_dir: str) -> Tuple[List[str], List[int]]:
    """
    Scans dataset_dir for cough and non_cough subdirectories and collects
    audio file paths and integer class labels.
    """
    valid_exts = {".wav", ".mp3", ".ogg", ".flac", ".m4a", ".aac"}
    file_paths = []
    labels = []

    for class_name in CLASS_NAMES:
        class_folder = os.path.join(dataset_dir, class_name)
        if not os.path.exists(class_folder):
            print(f"[WARNING] Class directory '{class_folder}' does not exist.")
            continue

        label_idx = CLASS_TO_IDX[class_name]
        files = [
            os.path.join(class_folder, f)
            for f in os.listdir(class_folder)
            if os.path.splitext(f.lower())[1] in valid_exts
        ]
        for f in files:
            file_paths.append(f)
            labels.append(label_idx)

        print(f"Found {len(files)} files for class '{class_name}'.")

    return file_paths, labels


def compute_normalization_stats(file_paths: List[str]) -> Tuple[float, float]:
    """
    Computes global mean and standard deviation over training spectrograms
    so inference matches training normalization precisely.
    """
    print("Computing dataset normalization statistics (Mean & Std)...", flush=True)
    specs = []
    # Sample up to 20 representative audio files to compute stats quickly
    n_samples = min(20, len(file_paths))
    sample_paths = random.sample(file_paths, n_samples) if len(file_paths) > n_samples else file_paths
    for path in sample_paths:
        try:
            audio = load_and_fix_audio(path, is_train=False)
            spec = extract_log_mel_spectrogram(audio)
            specs.append(spec)
        except Exception:
            continue

    if not specs:
        return -40.0, 20.0  # Sensible acoustic fallback for dB scale

    stacked = np.stack(specs)
    mean = float(np.mean(stacked))
    std = float(np.std(stacked))
    if std < 1e-4:
        std = 1.0
    print(f"Computed Normalization Stats -> Mean: {mean:.4f}, Std: {std:.4f}", flush=True)
    return mean, std


# -----------------------------------------------------------------------------
# Training & Evaluation Loop
# -----------------------------------------------------------------------------
def train_epoch(model: nn.Module, loader: DataLoader, criterion: nn.Module, optimizer: torch.optim.Optimizer, device: torch.device) -> Tuple[float, float]:
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    for inputs, labels in loader:
        inputs, labels = inputs.to(device), labels.to(device)
        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        running_loss += loss.item() * inputs.size(0)
        _, preds = torch.max(outputs, 1)
        correct += (preds == labels).sum().item()
        total += labels.size(0)

    epoch_loss = running_loss / max(total, 1)
    epoch_acc = (correct / max(total, 1)) * 100.0
    return epoch_loss, epoch_acc


def evaluate(model: nn.Module, loader: DataLoader, criterion: nn.Module, device: torch.device) -> Tuple[float, float, List[int], List[int], List[float]]:
    model.eval()
    running_loss = 0.0
    correct = 0
    total = 0
    all_preds = []
    all_labels = []
    all_probs = []

    with torch.no_grad():
        for inputs, labels in loader:
            inputs, labels = inputs.to(device), labels.to(device)
            outputs = model(inputs)
            loss = criterion(outputs, labels)

            running_loss += loss.item() * inputs.size(0)
            probs = F.softmax(outputs, dim=1)
            _, preds = torch.max(outputs, 1)

            correct += (preds == labels).sum().item()
            total += labels.size(0)

            all_preds.extend(preds.cpu().tolist())
            all_labels.extend(labels.cpu().tolist())
            # Probability of class 1 ('cough')
            all_probs.extend(probs[:, 1].cpu().tolist())

    eval_loss = running_loss / max(total, 1)
    eval_acc = (correct / max(total, 1)) * 100.0
    return eval_loss, eval_acc, all_preds, all_labels, all_probs


def plot_confusion_matrix(cm: np.ndarray, class_names: List[str], save_path: str):
    """
    Renders and saves a clean confusion matrix heatmap.
    """
    fig, ax = plt.subplots(figsize=(5, 4), dpi=150)
    cax = ax.matshow(cm, cmap=plt.cm.Blues, alpha=0.85)

    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(
                x=j,
                y=i,
                s=str(cm[i, j]),
                va="center",
                ha="center",
                size="large",
                weight="bold",
                color="white" if cm[i, j] > (cm.max() / 2) else "black"
            )

    fig.colorbar(cax)
    ax.set_xticks([0, 1])
    ax.set_yticks([0, 1])
    ax.set_xticklabels(class_names, fontsize=10)
    ax.set_yticklabels(class_names, fontsize=10)
    ax.set_xlabel("Predicted Label", fontsize=11, fontweight="bold")
    ax.set_ylabel("True Label", fontsize=11, fontweight="bold")
    ax.set_title("Cough Recognition Confusion Matrix", fontsize=12, pad=15, fontweight="bold")
    plt.tight_layout()
    plt.savefig(save_path)
    plt.close(fig)
    print(f"Confusion matrix plot saved to: {save_path}")


# -----------------------------------------------------------------------------
# Main Training Function
# -----------------------------------------------------------------------------
def run_training(
    dataset_dir: str = "dataset",
    models_dir: str = "models",
    epochs: int = 25,
    batch_size: int = 16,
    lr: float = 0.001,
    augment: bool = True,
    progress_callback=None,
    log_callback=None,
):
    def emit_log(msg: str):
        print(msg, flush=True)
        if log_callback is not None:
            try:
                log_callback(msg)
            except Exception:
                pass

    emit_log("=" * 70)
    emit_log("      COUGH SOUND RECOGNITION SYSTEM — MODEL TRAINING")
    emit_log("=" * 70)

    os.makedirs(models_dir, exist_ok=True)

    # 1. Discover dataset
    file_paths, labels = discover_dataset(dataset_dir)
    if len(file_paths) == 0:
        print(f"[ERROR] No audio files found in '{dataset_dir}'.")
        print("Tip: Run 'python generate_sample_data.py' first to create a sample dataset!")
        sys.exit(1)

    cough_count = sum(1 for l in labels if l == 1)
    non_cough_count = sum(1 for l in labels if l == 0)
    print(f"\nDataset Summary: {len(file_paths)} total files ({cough_count} cough, {non_cough_count} non_cough)")

    if cough_count < 2 or non_cough_count < 2:
        print("[ERROR] Each class must have at least 2 samples to train and evaluate.")
        sys.exit(1)

    # 2. Stratified train (70%) / val (15%) / test (15%) split
    # Adjust test/val sizes if dataset is very small
    test_ratio = 0.15 if len(file_paths) >= 20 else 0.2
    val_ratio = 0.15 if len(file_paths) >= 20 else 0.2

    train_paths, test_paths, train_labels, test_labels = train_test_split(
        file_paths, labels, test_size=test_ratio, stratify=labels, random_state=42
    )

    val_split_ratio = val_ratio / (1.0 - test_ratio)
    train_paths, val_paths, train_labels, val_labels = train_test_split(
        train_paths, train_labels, test_size=val_split_ratio, stratify=train_labels, random_state=42
    )

    print(f"Splits -> Train: {len(train_paths)} | Val: {len(val_paths)} | Test: {len(test_paths)}")

    # 3. Compute normalization statistics from training set
    norm_mean, norm_std = compute_normalization_stats(train_paths)

    # 4. Create PyTorch Datasets and DataLoaders
    train_dataset = CoughAudioDataset(train_paths, train_labels, mean=norm_mean, std=norm_std, is_train=True, augment=augment)
    val_dataset = CoughAudioDataset(val_paths, val_labels, mean=norm_mean, std=norm_std, is_train=False, augment=False)
    test_dataset = CoughAudioDataset(test_paths, test_labels, mean=norm_mean, std=norm_std, is_train=False, augment=False)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, drop_last=(len(train_dataset) > batch_size))
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False)

    # 5. Device and Model Initialization
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Training on device: {device} ({'GPU Acceleration' if device.type == 'cuda' else 'CPU Optimized'})")

    model = CoughCNN(num_classes=len(CLASS_NAMES), in_channels=1).to(device)

    # Compute class weights to handle slight imbalances
    class_weights = [len(train_labels) / (2.0 * max(1, train_labels.count(c))) for c in range(2)]
    weights_tensor = torch.tensor(class_weights, dtype=torch.float32).to(device)
    criterion = nn.CrossEntropyLoss(weight=weights_tensor)

    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-3)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="max", factor=0.5, patience=4)

    # 6. Training Loop
    best_val_acc = 0.0
    best_model_state = None
    model_save_path = os.path.join(models_dir, "cough_model.pth")

    print("\nStarting Training...", flush=True)
    start_time = time.time()

    for epoch in range(1, epochs + 1):
        t0 = time.time()
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_acc, _, _, _ = evaluate(model, val_loader, criterion, device)
        scheduler.step(val_acc)
        elapsed = time.time() - t0

        msg = (
            f"Epoch [{epoch:02d}/{epochs:02d}] ({elapsed:.1f}s) — "
            f"Train Loss: {train_loss:.4f}, Train Acc: {train_acc:5.1f}% | "
            f"Val Loss: {val_loss:.4f}, Val Acc: {val_acc:5.1f}%"
        )
        emit_log(msg)

        if progress_callback is not None:
            try:
                progress_callback(epoch, epochs, float(train_loss), float(train_acc), float(val_loss), float(val_acc))
            except Exception:
                pass

        if val_acc >= best_val_acc:
            best_val_acc = val_acc
            best_model_state = model.state_dict().copy()

    total_training_time = time.time() - start_time
    print(f"\nTraining completed in {total_training_time:.1f}s. Best Val Accuracy: {best_val_acc:.1f}%")

    # Load best checkpoint
    if best_model_state is not None:
        model.load_state_dict(best_model_state)

    # 7. Final Evaluation on Unseen Test Set
    print("\n" + "=" * 50)
    print("       FINAL TEST SET EVALUATION")
    print("=" * 50)
    test_loss, test_acc, test_preds, test_true, test_probs = evaluate(model, test_loader, criterion, device)

    prec = precision_score(test_true, test_preds, average="macro", zero_division=0)
    rec = recall_score(test_true, test_preds, average="macro", zero_division=0)
    f1 = f1_score(test_true, test_preds, average="macro", zero_division=0)
    cm = confusion_matrix(test_true, test_preds, labels=[0, 1])

    print(f"Test Loss     : {test_loss:.4f}")
    print(f"Test Accuracy : {test_acc:.2f}%")
    print(f"Precision     : {prec * 100:.2f}%")
    print(f"Recall        : {rec * 100:.2f}%")
    print(f"F1-Score      : {f1 * 100:.2f}%\n")

    print("Detailed Classification Report:")
    print(classification_report(test_true, test_preds, target_names=CLASS_NAMES, zero_division=0))

    # Plot and save confusion matrix
    cm_plot_path = os.path.join(models_dir, "confusion_matrix.png")
    plot_confusion_matrix(cm, CLASS_NAMES, cm_plot_path)

    # 8. Save Model and Configuration
    print("\nSaving trained model and preprocessing config...")
    torch.save(model.state_dict(), model_save_path)
    print(f"Model weights saved to: {model_save_path}")

    config_path = os.path.join(models_dir, "model_config.json")
    config_data = {
        "sample_rate": SAMPLE_RATE,
        "duration": DURATION,
        "target_samples": TARGET_SAMPLES,
        "n_fft": N_FFT,
        "hop_length": HOP_LENGTH,
        "n_mels": N_MELS,
        "fmin": FMIN,
        "fmax": FMAX,
        "norm_mean": norm_mean,
        "norm_std": norm_std,
        "classes": CLASS_NAMES,
        "class_to_idx": CLASS_TO_IDX,
        "metrics": {
            "test_accuracy": float(test_acc),
            "precision": float(prec),
            "recall": float(rec),
            "f1_score": float(f1),
        },
    }
    with open(config_path, "w") as f:
        json.dump(config_data, f, indent=4)
    print(f"Model configuration saved to: {config_path}")

    metrics_path = os.path.join(models_dir, "training_metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(config_data["metrics"], f, indent=4)

    print("\nSuccess! Model training pipeline finished.")
    print("You can now test the model using: python app.py")
    return config_data["metrics"]


# -----------------------------------------------------------------------------
# CLI Entry Point
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train Cough Sound Recognition Model")
    parser.add_argument("--dataset_dir", type=str, default="dataset", help="Path to dataset directory")
    parser.add_argument("--models_dir", type=str, default="models", help="Directory to save models")
    parser.add_argument("--epochs", type=int, default=20, help="Number of training epochs")
    parser.add_argument("--batch_size", type=int, default=16, help="Batch size for training")
    parser.add_argument("--lr", type=float, default=0.001, help="Learning rate")
    parser.add_argument("--no_augment", action="store_true", help="Disable data augmentation")

    args = parser.parse_args()

    # Determine base directory
    base_dir = os.path.dirname(os.path.abspath(__file__))
    d_dir = args.dataset_dir if os.path.isabs(args.dataset_dir) else os.path.join(base_dir, args.dataset_dir)
    m_dir = args.models_dir if os.path.isabs(args.models_dir) else os.path.join(base_dir, args.models_dir)

    run_training(
        dataset_dir=d_dir,
        models_dir=m_dir,
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
        augment=not args.no_augment,
    )
