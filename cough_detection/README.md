# 🎙️ Noise-Robust Cough Sound Recognition System

A complete Python-based acoustic recognition system designed to detect cough sounds in noisy, real-world environments. The system features two separate programs:

1. **`train.py`**: Audio preprocessing, environmental noise augmentation, deep-learning model training (`CoughCNN`), test evaluation, and model persistence.
2. **`app.py`**: A native desktop testing application with real-time continuous microphone chunk streaming, audio file upload and playback, confidence meters, debounce cooldown, and recent detection logging.

---

> [!CAUTION]
> ### ⚠️ Medical Disclaimer
> **This system is an audio pattern recognition educational and research demonstration, NOT a certified medical diagnostic device.**
> It must never be used to diagnose, treat, monitor, or assess medical conditions (such as COVID-19, asthma, pneumonia, or bronchitis).

---

## 📂 Project Structure

```text
cough_detection/
│
├── dataset/
│   ├── cough/                  # Put your cough audio files here (.wav, .mp3, etc.)
│   └── non_cough/              # Put speech, noise, laughter, music, etc. here
│
├── models/
│   ├── cough_model.pth         # Trained PyTorch neural network weights
│   ├── model_config.json       # Audio specs & normalization parameters
│   ├── confusion_matrix.png    # Evaluation heatmap plot
│   └── training_metrics.json   # Precision, Recall, F1, Accuracy summary
│
├── train.py                    # Deep learning training pipeline
├── app.py                      # Desktop GUI testing & recognition application
├── generate_sample_data.py     # Bootstrap script to generate starter audio data
├── requirements.txt            # Python dependencies
└── README.md                   # Complete documentation & usage guide
```

---

## 🛠️ Step 1: Windows Installation & Setup

### Prerequisites
- Windows 10 or 11
- Python 3.10 to 3.13 installed (accessible via `py` or `python`)
- Working microphone and speakers

### Installation Commands (Command Prompt or PowerShell)

1. Open PowerShell or Command Prompt and navigate to the project folder:
   ```powershell
   cd c:\Users\hp\Desktop\test\cough_detection
   ```

2. (Recommended) Create and activate a clean virtual environment:
   ```powershell
   py -m venv venv
   .\venv\Scripts\Activate.ps1
   ```
   *(If PowerShell displays an execution policy error, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` first).*

3. Install the dependencies from `requirements.txt`:
   ```powershell
   py -m pip install --upgrade pip
   py -m pip install -r requirements.txt
   ```

---

## 📦 Step 2: Dataset Preparation

### Where to Put Your Audio Files
Organize your audio files into the `dataset/` directory:

- **`dataset/cough/`**: Contains cough audio clips.
- **`dataset/non_cough/`**: Contains all non-cough audio (speech, background sounds, distractors).

Supported formats: `.wav`, `.mp3`, `.ogg`, `.flac`, `.m4a`, `.aac`.

### 🛡️ Noise Robustness: Why Non-Cough Diversity Matters
To avoid false positives in real-world environments, the `non_cough` folder **must not** just contain silence. It should actively include:

| Noise Category | Real-world Sounds to Include | Why It's Crucial |
| :--- | :--- | :--- |
| **Vocal Distractors** | Normal speech, group conversation, laughing, sneezing, throat clearing, sighing, heavy breathing | Distinguishes vocal-tract friction and laughter from true explosive cough bursts. |
| **Indoor Ambient Noise** | Keyboard typing, mouse clicks, chair creaks, door slams, footsteps | Prevents sharp mechanical impact sounds from triggering false alarms. |
| **Appliance & HVAC** | Fan drone, air conditioner hum, refrigerator buzz, vacuum cleaner | Teaches the model to ignore continuous stationary background frequencies. |
| **Entertainment & Media**| Television audio, podcasts, acoustic music, electronic beats | Exposes the model to diverse pitch variations and vocal melodies. |
| **Outdoor / Transport** | Traffic rumble, car horns, distant sirens, wind noise | Handles everyday window and commute acoustics. |

### 🚀 Instant Bootstrap (Zero-Download Starter Data)
If you do not have audio recordings immediately available, run the included bootstrap generator:
```powershell
py generate_sample_data.py
```
This synthesizes **30 cough clips** (with explosive transients, glottal resonances, single and double bursts) and **40 diverse non-cough clips** (speech, laughter, sneezes, throat clearing, breathing, keyboard clicks, fan hum, music, and door slams) so you can immediately train and test the system!

### Public Datasets for Production Training
For real production datasets, you can download open scientific cough datasets and place files in `dataset/cough/`:
- **COUGHVID Dataset** (EPFL): Over 25,000 crowdsourced cough recordings.
- **Coswara Dataset** (Indian Institute of Science): Respiratory sounds including shallow and deep coughs.
- **ESC-50 Dataset** (Environmental Sound Classification): Excellent source for diverse `non_cough` environmental sounds.

---

## 🧠 Step 3: Model Architecture & Rationale

### Why `CoughCNN`?
For audio classification on consumer laptops:
1. **Acoustic Signature**: Coughs are short (~200–600ms) explosive acoustic transients with a distinct spectral concentration (between 250 Hz and 3500 Hz), followed by glottal friction dissipation.
2. **2D Time-Frequency Representation**: By converting raw audio to **Log-Mel Spectrograms** (64 mel bands, 16 kHz), audio is converted into a 2D pattern where convolutional filters detect spectral edges and burst envelopes.
3. **Efficiency**: `CoughCNN` consists of 4 convolutional blocks with Batch Normalization, ReLU, Max Pooling, and Dropout (~140K parameters). It trains in under 60 seconds on standard CPU, requires no GPU, and performs inference in **< 15 milliseconds**.

### Real-Time Augmentation Engine
During training, `train.py` injects online environmental augmentations:
- **Additive Ambient Noise**: Mixed with random SNR (8 dB to 22 dB) to simulate rooms of different acoustics.
- **Time Shifting**: Rolling waveform cyclically by ±25% so the model doesn't overfit to cough position.
- **Volume Perturbation**: Random gain scaling (0.6x to 1.4x) to simulate different microphone distances.
- **Subtle Pitch Shift**: ±1.5 semitones to simulate anatomical variations across individuals.
- **SpecAugment**: Random time and frequency masking on spectrograms to build resilience against acoustic nulls.

---

## 🏃 Step 4: Training the Model

Run the training pipeline:
```powershell
py train.py
```

### Optional Command-Line Flags
```powershell
# Custom epochs and batch size
py train.py --epochs 30 --batch_size 16 --lr 0.001

# Disable augmentations (for comparison)
py train.py --no_augment

# Specify custom directories
py train.py --dataset_dir my_data --models_dir saved_models
```

### Training Outputs
After training finishes, the script automatically saves:
- `models/cough_model.pth`: The trained model weights.
- `models/model_config.json`: Audio parameters, dataset mean/std normalization statistics, and metrics.
- `models/confusion_matrix.png`: Heatmap showing True Positive, False Positive, True Negative, and False Negative counts.
- `models/training_metrics.json`: Accuracy, Precision, Recall, and F1-score.

---

## 🖥️ Step 5: Launching the Recognition UI (`app.py`)

Launch the testing desktop application:
```powershell
py app.py
```

### UI Features & Walkthrough
1. **Model Status Indicator**: Displays `MODEL LOADED` in green once `models/cough_model.pth` is detected.
2. **Input Device Selection**:
   - Select your microphone from the **Mic:** dropdown (supports Bluetooth headsets, built-in mic arrays, USB mics, etc.).
   - Click the **🔄** button to refresh available audio devices at any time.
3. **Live Continuous Microphone Test**:
   - Click **▶ Start Microphone Test**.
   - Speak, type, or make environmental sounds — observe the confidence bar remaining low with `✔ NO COUGH DETECTED`.
   - Cough near the microphone — immediately triggers `⚠ COUGH DETECTED` with high confidence.
   - Click **⏹ Stop** when finished.
4. **Debounce / Cooldown Mechanism**:
   - A single cough episode often lasts 0.5–1.0s and may produce multiple acoustic peaks.
   - The built-in **1.5s debounce cooldown** ensures that one coughing fit registers as a single event in the log rather than triggering 10 duplicate alerts.
4. **Audio File Upload & Playback**:
   - Click **📁 Upload Audio File** and select any `.wav` or `.mp3`.
   - The system analyzes the entire file using a sliding window, reports max probability, and logs the result.
   - Click **🔊 Play Audio** to listen to the recording with synchronized playback controls.
5. **Recent Detections Table**:
   - Real-time log showing timestamp, audio source, prediction label, probability percentage, and status notes.

---

## 🔍 Step 6: How Continuous Microphone Detection Works

```text
Microphone Input
       │
       ▼
[Audio Stream (16 kHz)] ──► Frames captured every 250 ms
       │
       ▼
[Rolling Ring Buffer] ──► Maintains latest 1.5 seconds (24,000 samples)
       │
       ▼ (Evaluated every 400 ms)
[RMS Energy Gate] ──► If silent (RMS < 0.003), skip inference to save CPU
       │
       ▼
[Log-Mel Spectrogram] ──► (64 Mel bins x 47 time steps)
       │
       ▼
[Z-Score Normalization] ──► Uses dataset Mean & Std from model_config.json
       │
       ▼
[CoughCNN Inference] ──► Softmax Output -> Cough Probability (0.0 to 1.0)
       │
       ▼
[Debounce Cooldown] ──► If p >= 0.50 and elapsed > 1.5s -> Trigger Alert & Log
```

---

## 🔧 Troubleshooting

### 1. Microphone Error: `No Default Input Device Available`
- **Cause**: Windows privacy settings may be blocking microphone access for Python or apps.
- **Solution**:
  1. Open Windows **Settings** > **Privacy & Security** > **Microphone**.
  2. Ensure **"Microphone access"** is switched **ON**.
  3. Ensure **"Let desktop apps access your microphone"** is switched **ON**.

### 2. `sounddevice.PortAudioError: Error opening InputStream`
- **Cause**: The default audio input device is currently locked or set to an unsupported sample rate.
- **Solution**: Check your Windows Sound Settings (`mmsys.cpl`), ensure your recording device is enabled, and try setting default format to `1 channel, 16 bit, 16000 Hz` or `44100 Hz`.

### 3. File upload fails on `.mp3`
- **Cause**: Soundfile backend might lack MP3 codecs on older Windows systems.
- **Solution**: `train.py` and `app.py` already include automatic fallback to `librosa.load` which decodes MP3 using audioread/ffmpeg. If needed, install `pip install audioread`.

### 4. False Alarms on Heavy Breathing or Sneezing
- **Solution**: Add more samples of heavy breathing, sneezes, and throat clearing into `dataset/non_cough/` and retrain. The model improves dramatically when given specific hard negative examples.

---

## 📈 Suggestions for Improving Accuracy Later

1. **Collect Diverse Real-World Negative Samples**:
   - Record audio in your actual environment (typing, AC hum, television, footsteps) and save them to `dataset/non_cough/`.
2. **Dynamic Threshold Tuning**:
   - In `app.py`, adjust the detection threshold from `0.50` to `0.65` if you prefer higher precision (fewer false positives).
3. **Advanced Architectures**:
   - For an advanced extension, experiment with pre-trained audio foundation models such as **YAMNet** or **AST (Audio Spectrogram Transformer)**.
4. **Multi-Stage Detection (VAD + Classifier)**:
   - Introduce a Voice Activity / Acoustic Event Detector (VAD) to first segment candidate explosive bursts before passing them to the CNN.
