<<<<<<< HEAD
import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * TUNABLE CONSTANTS FOR COUGH DETECTION
 * Adjust these constants to tune sensitivity across different microphones.
 */
export const DEFAULT_COUGH_THRESHOLD = 0.11; // Base RMS amplitude spike threshold
export const DEFAULT_SPIKE_DELTA = 0.05;     // Required sharp jump in RMS from prior frame
export const DEFAULT_COOLDOWN_MS = 500;       // Cooldown lockout window in ms
export const MAX_BURST_DURATION_MS = 750;     // Discard sustained loud sounds (talking/music)

export function useCoughDetector({
  audioStream,
  isActive = false,
  threshold = DEFAULT_COUGH_THRESHOLD,
  cooldownMs = DEFAULT_COUGH_THRESHOLD,
  onCough
}) {
  const [coughCount, setCoughCount] = useState(0);
  const [lastCoughTime, setLastCoughTime] = useState(null);
  const [currentRms, setCurrentRms] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);

  // References to Web Audio API instances
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animFrameIdRef = useRef(null);

  // Detection state trackers
  const lastTriggerTimeRef = useRef(0);
  const prevRmsRef = useRef(0);
  const burstStartTimeRef = useRef(null);
  const isAboveThresholdRef = useRef(false);

  // Visualizer data buffer
  const timeDataBufferRef = useRef(null);
  const freqDataBufferRef = useRef(null);

  const resetCount = useCallback(() => {
    setCoughCount(0);
    setLastCoughTime(null);
    setCurrentRms(0);
  }, []);

  // Manual trigger for testing/demo edge cases if needed
  const manualTriggerCough = useCallback(() => {
    const now = Date.now();
    setCoughCount(prev => prev + 1);
    setLastCoughTime(now);
    if (onCough) onCough(now);
  }, [onCough]);

  useEffect(() => {
    if (!isActive || !audioStream) {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      setIsDetecting(false);
      return;
    }

    let isMounted = true;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        console.warn('Web Audio API is not supported in this browser.');
        return;
      }

      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.2; // low smoothing for fast transient detection

      const source = audioCtx.createMediaStreamSource(audioStream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      sourceRef.current = source;

      const bufferLength = analyser.fftSize;
      const timeData = new Float32Array(bufferLength);
      const freqData = new Uint8Array(analyser.frequencyBinCount);
      timeDataBufferRef.current = timeData;
      freqDataBufferRef.current = freqData;

      setIsDetecting(true);

      const processAudio = () => {
        if (!isMounted) return;

        analyser.getFloatTimeDomainData(timeData);
        analyser.getByteFrequencyData(freqData);

        // 1. Calculate Root Mean Square (RMS) amplitude
        let sumSquares = 0;
        for (let i = 0; i < bufferLength; i++) {
          const sample = timeData[i];
          sumSquares += sample * sample;
        }
        const rms = Math.sqrt(sumSquares / bufferLength);
        setCurrentRms(rms);

        const now = Date.now();
        const timeSinceLastTrigger = now - lastTriggerTimeRef.current;
        const delta = rms - prevRmsRef.current;

        // 2. Cough Event Detection Heuristic:
        // A cough is a sharp sudden attack (delta > spikeDelta) crossing the threshold.
        const isSpike = rms >= threshold && delta >= DEFAULT_SPIKE_DELTA;

        if (isSpike) {
          if (!isAboveThresholdRef.current) {
            isAboveThresholdRef.current = true;
            burstStartTimeRef.current = now;
          }
        } else if (rms < threshold * 0.7) {
          isAboveThresholdRef.current = false;
          burstStartTimeRef.current = null;
        }

        // Trigger condition:
        // - In cooldown? Don't re-trigger.
        // - Sound is an onset spike.
        // - Burst hasn't exceeded MAX_BURST_DURATION_MS (to reject continuous loud speech/music).
        if (
          isSpike &&
          timeSinceLastTrigger > (cooldownMs || DEFAULT_COOLDOWN_MS)
        ) {
          const burstDuration = burstStartTimeRef.current ? (now - burstStartTimeRef.current) : 0;
          if (burstDuration < MAX_BURST_DURATION_MS) {
            lastTriggerTimeRef.current = now;
            setCoughCount(prev => prev + 1);
            setLastCoughTime(now);
            if (onCough) onCough(now);
          }
        }

        prevRmsRef.current = rms;
        animFrameIdRef.current = requestAnimationFrame(processAudio);
      };

      // Resume context if suspended by browser policy
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
          if (isMounted) animFrameIdRef.current = requestAnimationFrame(processAudio);
        });
      } else {
        animFrameIdRef.current = requestAnimationFrame(processAudio);
      }
    } catch (err) {
      console.error('Failed to initialize cough detector:', err);
    }

    return () => {
      isMounted = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect();
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      setIsDetecting(false);
    };
  }, [isActive, audioStream, threshold, cooldownMs, onCough]);

  return {
    coughCount,
    lastCoughTime,
    currentRms,
    isDetecting,
    resetCount,
    manualTriggerCough,
    analyserNode: analyserRef.current,
    timeDataBuffer: timeDataBufferRef.current,
    freqDataBuffer: freqDataBufferRef.current
=======
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useCoughDetector Hook
 * Advanced Web Audio API acoustic analyzer with built-in Speech Rejection Filter.
 * Separates cough detection logic from UI.
 * 
 * Differentiates cough from speech using:
 * 1. Attack Transient Speed (rise time < 40ms)
 * 2. Spectral Flatness / Harmonic Peak Ratio (rejects voiced speech vowels)
 * 3. Duration & Decay envelope (rejects sustained speaking phrases)
 */
export function useCoughDetector({
  onCoughCandidate,
  sensitivity = 'high'
} = {}) {
  const [isListening, setIsListening] = useState(false);
  const [permissionError, setPermissionError] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isCoughing, setIsCoughing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // References to maintain persistent state across frames without triggering hook re-runs
  const onCoughCandidateRef = useRef(onCoughCandidate);
  const sensitivityRef = useRef(sensitivity);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const rafIdRef = useRef(null);
  const lastCoughTimeRef = useRef(0);
  const ambientBaselineRef = useRef(5);
  const coughFlashTimeoutRef = useRef(null);
  const speechResetTimeoutRef = useRef(null);
  const lastUiUpdateRef = useRef(0);
  const prevVolumeRef = useRef(0);
  const sustainedSoundFramesRef = useRef(0);

  // Sensitivity configuration
  const sensitivityMap = {
    high: { threshold: 14, minJump: 8, riseMultiplier: 1.6, maxPeakDominance: 5.0 },
    medium: { threshold: 22, minJump: 12, riseMultiplier: 2.0, maxPeakDominance: 4.2 },
    low: { threshold: 34, minJump: 18, riseMultiplier: 2.5, maxPeakDominance: 3.5 }
  };

  const currentConfig = sensitivityMap[sensitivity] || sensitivityMap.high;
  const currentThreshold = currentConfig.threshold;

  useEffect(() => {
    onCoughCandidateRef.current = onCoughCandidate;
  }, [onCoughCandidate]);

  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  // Audio feedback beep
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

  // Trigger cough event
  const triggerCoughEvent = useCallback((metadata = {}) => {
    const now = Date.now();
    // Cooldown debounce: 650ms to prevent duplicate counting on single cough fit
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

    if (onCoughCandidateRef.current) {
      onCoughCandidateRef.current({ timestamp: now, ...metadata });
    }
  }, [playCoughBeep]);

  // Audio analysis frame loop
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const timeData = new Uint8Array(bufferLength);
    const freqData = new Uint8Array(bufferLength);

    analyser.getByteTimeDomainData(timeData);
    analyser.getByteFrequencyData(freqData);

    // 1. Calculate Peak & RMS Volume
    let sumSquares = 0;
    let peak = 0;
    for (let i = 0; i < bufferLength; i++) {
      const norm = (timeData[i] - 128) / 128;
      const absNorm = Math.abs(norm);
      if (absNorm > peak) peak = absNorm;
      sumSquares += norm * norm;
    }
    const rms = Math.sqrt(sumSquares / bufferLength);

    // Mapped volume (0-100 scale)
    const currentVol = Math.min(100, Math.round((rms * 0.5 + peak * 0.5) * 440));

    // Throttle UI update to ~20fps for silky smooth visual performance
    const now = Date.now();
    if (now - lastUiUpdateRef.current > 50) {
      setAudioLevel(currentVol);
      lastUiUpdateRef.current = now;
    }

    const cfg = sensitivityMap[sensitivityRef.current] || sensitivityMap.high;

    // 2. Track background ambient noise slowly when quiet
    if (currentVol < cfg.threshold) {
      ambientBaselineRef.current = ambientBaselineRef.current * 0.95 + currentVol * 0.05;
      sustainedSoundFramesRef.current = 0;
    } else {
      sustainedSoundFramesRef.current += 1;
    }

    // 3. Cough Acoustic Frequency Analysis (200Hz - 2800Hz)
    const sampleRate = audioContextRef.current ? audioContextRef.current.sampleRate : 44100;
    const binWidth = sampleRate / analyser.fftSize;
    const minBin = Math.max(1, Math.floor(200 / binWidth));
    const maxBin = Math.min(bufferLength - 1, Math.ceil(2800 / binWidth));

    let coughBandPower = 0;
    let totalPower = 0;
    let maxBinVal = 0;
    let bandBinCount = 0;

    for (let i = 0; i < bufferLength; i++) {
      const p = freqData[i];
      totalPower += p;
      if (i >= minBin && i <= maxBin) {
        coughBandPower += p;
        bandBinCount += 1;
        if (p > maxBinVal) maxBinVal = p;
      }
    }

    // Calculate spectral characteristics
    const bandRatio = totalPower > 0 ? (coughBandPower / totalPower) : 0;
    const avgBandVal = bandBinCount > 0 ? (coughBandPower / bandBinCount) : 1;
    // Harmonic peak dominance: Speech vowels (aaah, eeh, ooh) concentrate energy in narrow formants
    // while turbulent coughs distribute energy broadly across the band
    const peakDominance = avgBandVal > 0 ? (maxBinVal / avgBandVal) : 0;

    // Attack speed: sudden jump from previous frame
    const suddenRise = currentVol - prevVolumeRef.current;
    prevVolumeRef.current = currentVol;

    // 4. SPEECH REJECTION LOGIC
    // Speech characteristics:
    // a) Sustained sound (> 18-25 consecutive frames ≈ > 300ms without decay)
    // b) High peak dominance (strong harmonic pitch formants of spoken vowels)
    const isVoicedFormant = peakDominance > cfg.maxPeakDominance;
    const isSustainedSpeech = sustainedSoundFramesRef.current > 18;

    if (currentVol >= cfg.threshold && (isVoicedFormant || isSustainedSpeech)) {
      setIsSpeaking(true);
      if (speechResetTimeoutRef.current) clearTimeout(speechResetTimeoutRef.current);
      speechResetTimeoutRef.current = setTimeout(() => {
        setIsSpeaking(false);
      }, 500);
    }

    // 5. COUGH DETECTION CRITERIA
    // a) Volume exceeds the sensitivity threshold
    // b) Explosive transient attack (sudden jump >= minJump)
    // c) Energy in cough band (bandRatio >= 0.18)
    // d) NOT voiced vowel formant (reject speech)
    // e) NOT sustained speech (> 300ms continuous talking)
    const exceedsThreshold = currentVol >= cfg.threshold;
    const isExplosiveAttack = suddenRise >= cfg.minJump || (currentVol >= ambientBaselineRef.current * cfg.riseMultiplier + 6 && suddenRise >= 4);
    const hasCoughSpectrum = bandRatio >= 0.16;
    const isNotVoicedSpeech = !isVoicedFormant && sustainedSoundFramesRef.current <= 14;

    if (exceedsThreshold && isExplosiveAttack && hasCoughSpectrum && isNotVoicedSpeech) {
      triggerCoughEvent({
        volume: currentVol,
        attack: suddenRise,
        peakDominance: peakDominance.toFixed(2),
        bandRatio: (bandRatio * 100).toFixed(0)
      });
    }

    rafIdRef.current = requestAnimationFrame(analyzeAudio);
  }, [triggerCoughEvent]);

  // Start microphone
  const startListening = useCallback(async () => {
    try {
      setPermissionError(null);

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close().catch(() => {});
      }

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

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

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.25;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      setIsListening(true);

      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(analyzeAudio);
    } catch (err) {
      console.error('Microphone initialization failed:', err);
      setPermissionError(err.message || 'Microphone access denied');
      setIsListening(false);
    }
  }, [analyzeAudio]);

  // Stop microphone
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
    if (speechResetTimeoutRef.current) {
      clearTimeout(speechResetTimeoutRef.current);
    }

    setIsListening(false);
    setIsCoughing(false);
    setIsSpeaking(false);
    setAudioLevel(0);
  }, []);

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
    isSpeaking,
    startListening,
    stopListening,
    analyserNode: analyserRef.current,
    triggerManualCough: triggerCoughEvent
>>>>>>> b70dfce39d9d6fdb4fad12552d1882e6f0f22922
  };
}
