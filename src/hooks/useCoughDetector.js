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
  cooldownMs = DEFAULT_COOLDOWN_MS,
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
  };
}

export default useCoughDetector;
