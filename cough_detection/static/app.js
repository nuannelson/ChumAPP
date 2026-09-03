/**
 * ChummAPP — Biometric Cough Recognition & Savage Roast Engine
 * Frontend Controller & Audio Pipeline
 */

// -----------------------------------------------------------------------------
// Roast Database (Malayalam + English Subtitles)
// -----------------------------------------------------------------------------
const ROASTS = [
  {
    mal: "വീട്ടുകാർ ഇപ്പോൾ തന്നെ ഓടാൻ തുടങ്ങിയോ?",
    eng: "Have your family members started fleeing the room yet?"
  },
  {
    mal: "ശ്വാസകോശം സ്പോഞ്ചാണ്... പക്ഷെ നിങ്ങളുടെ ലങ്സ് ഇപ്പോൾ സ്റ്റീൽ കമ്പിയാണ്!",
    eng: "Lungs are supposed to be like sponges, but yours sound like rusty iron scrap!"
  },
  {
    mal: "അയൽക്കാർ പോലീസിനെ വിളിക്കാറായി, ഒന്ന് പതുക്കെ ചുമക്ക് ബ്രോ!",
    eng: "The neighbors are about to dial the police, tone it down bro!"
  },
  {
    mal: "ഇത് ചുമയല്ല, ജെറ്റ് എഞ്ചിൻ ടെസ്റ്റിംഗ് ആണെന്ന് തോന്നുന്നു!",
    eng: "This isn't coughing, it sounds like an ISRO rocket engine test!"
  },
  {
    mal: "ചുമച്ച് ചുമച്ച് ചരിത്രം സൃഷ്ടിക്കാൻ നോക്കുവാണോ?",
    eng: "Are you trying to make world history through sheer coughing?"
  },
  {
    mal: "ഒരു ഗ്ലാസ് ചൂടുവെള്ളം കുടിക്കൂ മനുഷ്യ... ലാപ്ടോപ്പ് വരെ വിറയ്ക്കുന്നു!",
    eng: "Drink a glass of warm water, human... even the laptop is shaking!"
  },
  {
    mal: "കോവിഡ് കാലം കഴിഞ്ഞെങ്കിലും നിങ്ങളുടെ ചുമ കേട്ടാൽ ആളുകൾ മാസ്ക് എടുക്കും!",
    eng: "Even though the pandemic is over, your cough will make people put masks back on!"
  },
  {
    mal: "ഡോക്ടറെ കാണാൻ പോയാൽ ഡോക്ടർ തന്നെ ഓടും!",
    eng: "If you visit a doctor right now, even the doctor will run for their life!"
  },
  {
    mal: "തൊണ്ടയിൽ എന്താ തകരപ്പാട്ടയാണോ വെച്ചിരിക്കുന്നത്?",
    eng: "Did you swallow an entire tin can or what?"
  },
  {
    mal: "അടുത്ത തവണ ചുമക്കുമ്പോൾ റൂമിലുള്ള പൂച്ച വരെ പേടിച്ച് വീട് വിടും!",
    eng: "Next time you cough, even the household cat will pack its bags and leave!"
  },
  {
    mal: "നിങ്ങളുടെ ചുമ കേട്ട് മൈക്രോഫോൺ വരെ ഞെട്ടി!",
    eng: "Even the microphone is in traumatic shock from that frequency burst!"
  },
  {
    mal: "ചുമ ഫൈനൽ ബോസ്! Congratulations. You have achieved absolutely nothing, but ruined everyone's peace.",
    eng: "CHUMA FINAL BOSS! Congratulations, you achieved absolutely nothing except disturbing everyone."
  }
];

const TIERS = [
  { min: 0, max: 2, title: "HEALTHY AMATEUR", mal: "ചുമ തുടക്കക്കാരൻ", next: "CHUMA APPRENTICE", target: 3 },
  { min: 3, max: 5, title: "CHUMA APPRENTICE", mal: "സാധാരണ ചുമക്കാരൻ", next: "CHUMA ENTHUSIAST", target: 6 },
  { min: 6, max: 12, title: "CHUMA ENTHUSIAST", mal: "ചുമ പ്രേമി", next: "CHUMA SPECIALIST", target: 13 },
  { min: 13, max: 24, title: "CHUMA SPECIALIST", mal: "ചുമ സ്പെഷ്യലിസ്റ്റ്", next: "CHUMA MAESTRO", target: 25 },
  { min: 25, max: 49, title: "CHUMA MAESTRO", mal: "ചുമ വിദഗ്ദ്ധൻ", next: "CHUMA FINAL BOSS", target: 50 },
  { min: 50, max: 999999, title: "CHUMA FINAL BOSS", mal: "അന്തിമ ചുമ ദൈവം", next: "MAXIMUM BOSS LEVEL", target: 50 }
];

// -----------------------------------------------------------------------------
// App State
// -----------------------------------------------------------------------------
let isSessionActive = true;
let sessionSeconds = 0;
let sessionTimerInterval = null;
let coughCount = 0;
let lastCoughTimestamp = 0;
const COOLDOWN_MS = 1400; // Debounce cooldown
let currentRoastIdx = 0;

// Audio Context & Analyser
let audioCtx = null;
let analyser = null;
let micSource = null;
let scriptProcessor = null;
let audioStream = null;

// Camera
let videoElement = null;
let cameraStream = null;

// DOM Elements
const elCoughCounter = document.getElementById("coughCounter");
const elTierBadge = document.getElementById("tierBadge");
const elTierMalayalam = document.getElementById("tierMalayalam");
const elNextTierText = document.getElementById("nextTierText");
const elProgressFill = document.getElementById("progressFill");
const elRoastMalayalam = document.getElementById("roastMalayalam");
const elRoastEnglish = document.getElementById("roastEnglish");
const elSessionTimer = document.getElementById("sessionTimer");
const elMicSensitivity = document.getElementById("micSensitivity");
const elSensitivityVal = document.getElementById("sensitivityVal");
const btnToggleSession = document.getElementById("btnToggleSession");
const btnSimulateCough = document.getElementById("btnSimulateCough");

// Modal Elements
const elDossierModal = document.getElementById("dossierModal");
const elModalTotalCoughs = document.getElementById("modalTotalCoughs");
const elModalFinalLevel = document.getElementById("modalFinalLevel");
const elModalFinalLevelMalayalam = document.getElementById("modalFinalLevelMalayalam");
const elModalDuration = document.getElementById("modalDuration");
const elModalClosingMalayalam = document.getElementById("modalClosingMalayalam");
const elModalClosingEnglish = document.getElementById("modalClosingEnglish");
const btnRestartSession = document.getElementById("btnRestartSession");
const btnShareRoast = document.getElementById("btnShareRoast");

// Canvas Elements
const spectrumCanvas = document.getElementById("spectrumCanvas");
const spectrumCtx = spectrumCanvas.getContext("2d");
const elRmsFill = document.getElementById("rmsFill");
const elRmsDot = document.getElementById("rmsDot");
const elRmsVal = document.getElementById("rmsVal");
const elFpsDisplay = document.getElementById("fpsDisplay");
const holoCanvas = document.getElementById("holoCanvas");
const holoCtx = holoCanvas.getContext("2d");

// -----------------------------------------------------------------------------
// Initialization
// -----------------------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  initCamera();
  initAudio();
  startSessionTimer();
  updateTierUI();
  setupEventListeners();
});

function setupEventListeners() {
  elMicSensitivity.addEventListener("input", (e) => {
    elSensitivityVal.textContent = parseFloat(e.target.value).toFixed(2);
  });

  btnToggleSession.addEventListener("click", toggleSession);
  btnSimulateCough.addEventListener("click", () => triggerCoughEvent(true));
  btnRestartSession.addEventListener("click", restartSession);
  btnShareRoast.addEventListener("click", shareRoast);
}

// -----------------------------------------------------------------------------
// Session Timer
// -----------------------------------------------------------------------------
function startSessionTimer() {
  if (sessionTimerInterval) clearInterval(sessionTimerInterval);
  sessionSeconds = 0;
  updateTimerDisplay();

  sessionTimerInterval = setInterval(() => {
    if (isSessionActive) {
      sessionSeconds++;
      updateTimerDisplay();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const m = Math.floor(sessionSeconds / 60).toString().padStart(2, "0");
  const s = (sessionSeconds % 60).toString().padStart(2, "0");
  elSessionTimer.textContent = `REC ${m}:${s}`;
}

function getFormattedDuration(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

// -----------------------------------------------------------------------------
// Camera & Cosmetic HUD
// -----------------------------------------------------------------------------
async function initCamera() {
  videoElement = document.getElementById("webcamVideo");
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 360 } },
      audio: false
    });
    videoElement.srcObject = cameraStream;
    startFpsMonitor();
  } catch (err) {
    console.warn("Camera not accessible, switching to sci-fi holographic radar:", err);
    videoElement.style.display = "none";
    holoCanvas.style.display = "block";
    startHolographicAnimation();
  }
}

let lastFpsTime = performance.now();
let frameCount = 0;

function startFpsMonitor() {
  function checkFps() {
    frameCount++;
    const now = performance.now();
    if (now - lastFpsTime >= 1000) {
      const fps = (frameCount * 1000) / (now - lastFpsTime);
      elFpsDisplay.textContent = `FPS: ${fps.toFixed(1)}`;
      frameCount = 0;
      lastFpsTime = now;
    }
    if (isSessionActive) requestAnimationFrame(checkFps);
  }
  requestAnimationFrame(checkFps);
}

function startHolographicAnimation() {
  let angle = 0;
  function drawHolo() {
    if (!holoCanvas || holoCanvas.style.display === "none") return;
    holoCanvas.width = holoCanvas.clientWidth || 400;
    holoCanvas.height = holoCanvas.clientHeight || 225;

    const w = holoCanvas.width;
    const h = holoCanvas.height;

    holoCtx.fillStyle = "#090c14";
    holoCtx.fillRect(0, 0, w, h);

    // Cyberpunk grid
    holoCtx.strokeStyle = "rgba(255, 45, 85, 0.12)";
    holoCtx.lineWidth = 1;
    for (let x = 0; x < w; x += 30) {
      holoCtx.beginPath();
      holoCtx.moveTo(x, 0);
      holoCtx.lineTo(x, h);
      holoCtx.stroke();
    }
    for (let y = 0; y < h; y += 30) {
      holoCtx.beginPath();
      holoCtx.moveTo(0, y);
      holoCtx.lineTo(w, y);
      holoCtx.stroke();
    }

    // Rotating Radar Sweep
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.42;

    holoCtx.beginPath();
    holoCtx.arc(cx, cy, r, 0, Math.PI * 2);
    holoCtx.strokeStyle = "rgba(255, 45, 85, 0.35)";
    holoCtx.stroke();

    holoCtx.beginPath();
    holoCtx.moveTo(cx, cy);
    holoCtx.arc(cx, cy, r, angle, angle + 0.4);
    holoCtx.closePath();
    holoCtx.fillStyle = "rgba(255, 45, 85, 0.2)";
    holoCtx.fill();

    angle += 0.04;
    requestAnimationFrame(drawHolo);
  }
  requestAnimationFrame(drawHolo);
}

// -----------------------------------------------------------------------------
// Audio Spectrum & Real-Time Mic Analysis
// -----------------------------------------------------------------------------
async function initAudio() {
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.8;

    micSource = audioCtx.createMediaStreamSource(audioStream);
    micSource.connect(analyser);

    // Audio chunk capture for backend PyTorch CoughCNN
    setupBackendStream(micSource);

    drawSpectrumVisualizer();
  } catch (err) {
    console.warn("Microphone access unavailable, using simulated audio:", err);
    startSimulatedSpectrum();
  }
}

// Sends audio chunks to Python Flask backend (/api/predict)
function setupBackendStream(sourceNode) {
  // Capture 1.5s audio buffers using ScriptProcessorNode
  const bufferSize = 4096;
  scriptProcessor = audioCtx.createScriptProcessor(bufferSize, 1, 1);

  let pcmBuffer = [];
  const requiredSamples = 24000; // 1.5s at 16kHz
  let lastInferenceTime = 0;

  scriptProcessor.onaudioprocess = (e) => {
    if (!isSessionActive) return;
    const inputData = e.inputBuffer.getChannelData(0);

    // Append to rolling buffer
    for (let i = 0; i < inputData.length; i++) {
      pcmBuffer.push(inputData[i]);
    }
    if (pcmBuffer.length > requiredSamples) {
      pcmBuffer = pcmBuffer.slice(pcmBuffer.length - requiredSamples);
    }

    const now = Date.now();
    // Evaluate every 500ms
    if (now - lastInferenceTime >= 500 && pcmBuffer.length >= requiredSamples) {
      lastInferenceTime = now;
      sendChunkToAI(pcmBuffer.slice());
    }
  };

  sourceNode.connect(scriptProcessor);
  scriptProcessor.connect(audioCtx.destination);
}

async function sendChunkToAI(samples) {
  // Check RMS energy threshold first
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) sumSq += samples[i] * samples[i];
  const rms = Math.sqrt(sumSq / samples.length);

  const sensitivity = parseFloat(elMicSensitivity.value) || 0.25;
  if (rms < 0.005) return; // Silent room filter

  try {
    const res = await fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio: Array.from(samples), sr: audioCtx.sampleRate })
    });
    if (!res.ok) return;

    const data = await res.json();
    if (data && data.is_cough) {
      // Check confidence against threshold
      if (data.probability >= (1.0 - sensitivity)) {
        triggerCoughEvent(false, data.probability);
      }
    }
  } catch (err) {
    // Backend offline or error
  }
}

function drawSpectrumVisualizer() {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function render() {
    if (!isSessionActive) return;
    requestAnimationFrame(render);

    analyser.getByteFrequencyData(dataArray);

    const w = spectrumCanvas.width;
    const h = spectrumCanvas.height;
    spectrumCtx.clearRect(0, 0, w, h);

    const numBars = 36;
    const barWidth = (w / numBars) - 2;
    let sum = 0;

    for (let i = 0; i < numBars; i++) {
      const val = dataArray[i * 2] || 0;
      sum += val;
      const barHeight = (val / 255) * (h - 10);

      // Color gradient: cyan to amber/red
      let fillStyle;
      if (val > 190) {
        fillStyle = "#ff2d55"; // Red for explosive spike
      } else if (val > 120) {
        fillStyle = "#ffb800"; // Amber
      } else {
        fillStyle = "#00f2fe"; // Cyan
      }

      const x = i * (barWidth + 2);
      const y = h - barHeight - 4;

      spectrumCtx.fillStyle = fillStyle;
      spectrumCtx.shadowBlur = 8;
      spectrumCtx.shadowColor = fillStyle;
      spectrumCtx.fillRect(x, y, barWidth, barHeight);
      spectrumCtx.shadowBlur = 0;
    }

    // Update RMS level
    const avg = sum / numBars;
    const rmsPct = Math.min(100, Math.round((avg / 255) * 100));
    elRmsFill.style.width = `${rmsPct}%`;
    elRmsDot.style.left = `${rmsPct}%`;
    elRmsVal.textContent = `${rmsPct}.0%`;

    // Acoustic spike threshold detection fallback if backend is offline
    const threshold = (parseFloat(elMicSensitivity.value) || 0.25) * 100;
    if (rmsPct > 55 && (avg > 140)) {
      triggerCoughEvent(false, 0.92);
    }
  }

  requestAnimationFrame(render);
}

function startSimulatedSpectrum() {
  function renderSim() {
    if (!isSessionActive) return;
    requestAnimationFrame(renderSim);

    const w = spectrumCanvas.width;
    const h = spectrumCanvas.height;
    spectrumCtx.clearRect(0, 0, w, h);

    const numBars = 36;
    const barWidth = (w / numBars) - 2;

    for (let i = 0; i < numBars; i++) {
      const randomVal = Math.random() * 80;
      const barHeight = (randomVal / 255) * (h - 10);

      spectrumCtx.fillStyle = "#00f2fe";
      const x = i * (barWidth + 2);
      const y = h - barHeight - 4;
      spectrumCtx.fillRect(x, y, barWidth, barHeight);
    }
    elRmsVal.textContent = "8.5%";
  }
  requestAnimationFrame(renderSim);
}

// -----------------------------------------------------------------------------
// Cough Event Trigger, Counter Bump, and Roast Generation
// -----------------------------------------------------------------------------
function triggerCoughEvent(isSimulated = false, confidence = 0.95) {
  const now = Date.now();
  if (!isSimulated && (now - lastCoughTimestamp < COOLDOWN_MS)) {
    return; // Cooldown active
  }
  lastCoughTimestamp = now;

  coughCount++;
  elCoughCounter.textContent = coughCount;

  // Bump visual animation
  elCoughCounter.classList.add("bump");
  setTimeout(() => elCoughCounter.classList.remove("bump"), 250);

  // Update Tier & Progress
  updateTierUI();

  // Cycle to next hilarious roast
  deliverNextRoast();

  // Target box flare animation on HUD
  const targetBox = document.getElementById("targetBox");
  if (targetBox) {
    targetBox.style.borderColor = "#ffffff";
    targetBox.style.boxShadow = "0 0 30px #ff2d55, 0 0 60px #ff2d55";
    setTimeout(() => {
      targetBox.style.borderColor = "rgba(255, 45, 85, 0.6)";
      targetBox.style.boxShadow = "0 0 15px rgba(255, 45, 85, 0.2)";
    }, 400);
  }
}

function updateTierUI() {
  let currentTier = TIERS[0];
  for (const tier of TIERS) {
    if (coughCount >= tier.min) {
      currentTier = tier;
    }
  }

  elTierBadge.textContent = currentTier.title;
  elTierMalayalam.textContent = currentTier.mal;

  if (currentTier.title === "CHUMA FINAL BOSS") {
    elTierBadge.className = "tier-pill tier-boss";
    elNextTierText.textContent = "MAX LEVEL REACHED (ചുമ ദൈവം)";
    elProgressFill.style.width = "100%";
  } else {
    elTierBadge.className = "tier-pill tier-level-1";
    const remaining = Math.max(0, currentTier.target - coughCount);
    elNextTierText.textContent = `${remaining} more to ${currentTier.next}`;

    const progressPct = Math.min(100, Math.round(((coughCount - currentTier.min) / (currentTier.target - currentTier.min)) * 100));
    elProgressFill.style.width = `${Math.max(5, progressPct)}%`;
  }
}

function deliverNextRoast() {
  currentRoastIdx = (currentRoastIdx + 1) % ROASTS.length;
  const roast = ROASTS[currentRoastIdx];

  const roastContainer = document.getElementById("roastContainer");
  roastContainer.style.opacity = 0;
  roastContainer.style.transform = "translateY(6px)";

  setTimeout(() => {
    elRoastMalayalam.textContent = `"${roast.mal}"`;
    elRoastEnglish.textContent = roast.eng;
    roastContainer.style.opacity = 1;
    roastContainer.style.transform = "translateY(0)";
  }, 200);
}

// -----------------------------------------------------------------------------
// Session Controls & Dossier Evaluation Modal (Image 2)
// -----------------------------------------------------------------------------
function toggleSession() {
  if (isSessionActive) {
    // End session & Show Dossier Modal
    isSessionActive = false;
    showDossierEvaluation();
  }
}

function showDossierEvaluation() {
  let currentTier = TIERS[0];
  for (const tier of TIERS) {
    if (coughCount >= tier.min) {
      currentTier = tier;
    }
  }

  elModalTotalCoughs.textContent = coughCount;
  elModalFinalLevel.textContent = currentTier.title;
  elModalFinalLevelMalayalam.textContent = currentTier.mal;
  elModalDuration.textContent = getFormattedDuration(sessionSeconds);

  // Closing roast
  const closingRoast = ROASTS[ROASTS.length - 1]; // "ചുമ ഫൈനൽ ബോസ്! Congratulations..."
  elModalClosingMalayalam.textContent = `"${closingRoast.mal}"`;
  elModalClosingEnglish.textContent = closingRoast.eng;

  elDossierModal.classList.remove("hidden");
}

function restartSession() {
  elDossierModal.classList.add("hidden");
  isSessionActive = true;
  coughCount = 0;
  elCoughCounter.textContent = "0";
  updateTierUI();
  startSessionTimer();
  deliverNextRoast();
}

function shareRoast() {
  const text = `🚨 CHUMMAPP EVALUATION DOSSIER 🚨\nTotal Coughs: ${coughCount}\nFinal Level: ${elTierBadge.textContent} (${elTierMalayalam.textContent})\nDuration: ${getFormattedDuration(sessionSeconds)}\nClosing Roast: ${elModalClosingMalayalam.textContent}\n"Intentionally useless comedy system"`;
  navigator.clipboard.writeText(text).then(() => {
    btnShareRoast.textContent = "✔ COPIED TO CLIPBOARD!";
    setTimeout(() => {
      btnShareRoast.innerHTML = `<span class="btn-icon">📋</span> SHARE YOUR ROAST`;
    }, 2000);
  }).catch(() => {
    alert(text);
  });
}
