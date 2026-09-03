import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useCoughDetector Hook
 * Robust Web Audio API acoustic analyzer for cough detection.
 * Keeps cough detection completely separate from UI.
 * Uses refs to prevent re-render loops and ensure stable audio streams.
 */
export function useCoughDetector({ onCoughDetected, sensitivity = 'high' } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [permissionError, setPermissionError] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isCoughing, setIsCoughing] = useState(false);

  // References to keep callbacks and configs stable without triggering effect re-runs
  const onCoughDetectedRef = useRef(onCoughDetected);
  const sensitivityRef = useRef(sensitivity);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const rafIdRef = useRef(null);
  const lastCoughTimeRef = useRef(0);
  const ambientBaselineRef = useRef(5); // Baseline volume on 0-100 scale
  const coughFlashTimeoutRef = useRef(null);
  const lastUiUpdateRef = useRef(0);
  const prevVolumeRef = useRef(0);

  // Sensitivity configuration
  const sensitivityMap = {
    high: { threshold: 12, riseMultiplier: 1.6, minJump: 5 },
    medium: { threshold: 20, riseMultiplier: 2.0, minJump: 8 },
    low: { threshold: 32, riseMultiplier: 2.5, minJump: 12 }
  };

  const currentConfig = sensitivityMap[sensitivity] || sensitivityMap.high;
  const currentThreshold = currentConfig.threshold;

  // Keep refs up-to-date
  useEffect(() => {
    onCoughDetectedRef.current = onCoughDetected;
  }, [onCoughDetected]);

  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  // Play futuristic beep blip on detected cough
  const playCoughBeep = useCallback(() => {
    try {
      const ctx = audioContextRef.current;
      if (!ctx || ctx.state === 'closed') return;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.14);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } catch (e) {
      console.warn('Audio feedback error:', e);
    }
  }, []);

  // Trigger cough detection event
  const triggerCoughEvent = useCallback(() => {
    const now = Date.now();
    // Debounce cooldown: 650ms to prevent duplicate triggers from a single cough burst
    if (now - lastCoughTimeRef.current < 650) {
      return;
    }
    lastCoughTimeRef.current = now;

    setIsCoughing(true);
    playCoughBeep();

    if (coughFlashTimeoutRef.current) {
      clearTimeout(coughFlashTimeoutRef.current);
    }
    coughFlashTimeoutRef.current = setTimeout(() => {
      setIsCoughing(false);
    }, 400);

    if (onCoughDetectedRef.current) {
      onCoughDetectedRef.current();
    }
  }, [playCoughBeep]);

  // Audio analysis frame function
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const timeData = new Uint8Array(bufferLength);
    const freqData = new Uint8Array(bufferLength);

    analyser.getByteTimeDomainData(timeData);
    analyser.getByteFrequencyData(freqData);

    // 1. Calculate Peak & RMS volume
    let sumSquares = 0;
    let peak = 0;
    for (let i = 0; i < bufferLength; i++) {
      const norm = (timeData[i] - 128) / 128;
      const absNorm = Math.abs(norm);
      if (absNorm > peak) peak = absNorm;
      sumSquares += norm * norm;
    }
    const rms = Math.sqrt(sumSquares / bufferLength);

    // Generous volume mapping (0-100) calibrated for typical laptop built-in microphones
    const currentVol = Math.min(100, Math.round((rms * 0.5 + peak * 0.5) * 450));

    // Throttle UI state update to ~15-20fps for smooth visual meter without React overhead
    const now = Date.now();
    if (now - lastUiUpdateRef.current > 50) {
      setAudioLevel(currentVol);
      lastUiUpdateRef.current = now;
    }

    // 2. Track background ambient noise slowly (only when relatively quiet)
    const cfg = sensitivityMap[sensitivityRef.current] || sensitivityMap.high;
    if (currentVol < cfg.threshold) {
      ambientBaselineRef.current = ambientBaselineRef.current * 0.94 + currentVol * 0.06;
    }

    // 3. Cough Frequency Band Analysis (180Hz - 2800Hz)
    const sampleRate = audioContextRef.current ? audioContextRef.current.sampleRate : 44100;
    const binWidth = sampleRate / analyser.fftSize;
    const minBin = Math.max(1, Math.floor(180 / binWidth));
    const maxBin = Math.min(bufferLength - 1, Math.ceil(2800 / binWidth));

    let coughBandPower = 0;
    let totalPower = 0;
    for (let i = 0; i < bufferLength; i++) {
      const p = freqData[i];
      totalPower += p;
      if (i >= minBin && i <= maxBin) {
        coughBandPower += p;
      }
    }

    const bandRatio = totalPower > 0 ? (coughBandPower / totalPower) : 0;
    const suddenRise = currentVol - prevVolumeRef.current;
    prevVolumeRef.current = currentVol;

    // Cough detection criteria:
    // a) Volume exceeds the sensitivity threshold
    // b) Sudden transient rise OR volume significantly above running baseline
    // c) Audio has energy in human vocal/cough frequency range (not pure high-frequency screech)
    const exceedsThreshold = currentVol >= cfg.threshold;
    const isSuddenSpike = suddenRise >= cfg.minJump || currentVol >= (ambientBaselineRef.current * cfg.riseMultiplier + 4);
    const hasVocalBand = bandRatio >= 0.15;

    if (exceedsThreshold && isSuddenSpike && hasVocalBand) {
      triggerCoughEvent();
    }

    rafIdRef.current = requestAnimationFrame(analyzeAudio);
  }, [triggerCoughEvent]);

  // Start listening to microphone
  const startListening = useCallback(async () => {
    try {
      setPermissionError(null);

      // Stop any existing stream before starting fresh
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close().catch(() => {});
      }

      // Initialize AudioContext
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      // Request microphone stream with fallback
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: true
          }
        });
      } catch (err) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      mediaStreamRef.current = stream;

      // Create AnalyserNode
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      setIsListening(true);

      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      // Start the analysis loop
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(analyzeAudio);
    } catch (err) {
      console.error('Microphone initialization failed:', err);
      setPermissionError(err.message || 'Microphone access denied');
      setIsListening(false);
    }
  }, [analyzeAudio]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (coughFlashTimeoutRef.current) {
      clearTimeout(coughFlashTimeoutRef.current);
    }

    setIsListening(false);
    setIsCoughing(false);
    setAudioLevel(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    isListening,
    permissionError,
    audioLevel,
    currentThreshold,
    isCoughing,
    startListening,
    stopListening,
    analyserNode: analyserRef.current,
    triggerManualCough: triggerCoughEvent
  };
}
