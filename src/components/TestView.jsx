import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Square, Sparkles, AlertCircle, RefreshCw, HandMetal, ShieldCheck, Eye, Mic, Cpu, Zap } from 'lucide-react';
import CameraPreview from './CameraPreview';
import AudioVisualizer from './AudioVisualizer';
import { useCoughDetector } from '../hooks/useCoughDetector';
import { getChumaLevel, getRoastComment } from '../utils/chumaData';

export default function TestView({ onStopTest }) {
  const [coughCount, setCoughCount] = useState(0);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [sensitivity, setSensitivity] = useState('high');
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [detectionMode, setDetectionMode] = useState('multimodal'); // 'multimodal' | 'audio_only'

  // Multimodal status indicators for UI
  const [multimodalStatus, setMultimodalStatus] = useState({
    lastAudioBurst: false,
    lastVisualConvulsion: false,
    fusionConfirmed: false
  });

  const lastFaceMotionTimeRef = useRef(0);
  const pendingAudioCandidateRef = useRef(null);
  const statusTimeoutRef = useRef(null);

  // Increment cough counter and flash HUD verification
  const registerConfirmedCough = useCallback((source = 'multimodal') => {
    setCoughCount(prev => prev + 1);

    setMultimodalStatus({
      lastAudioBurst: true,
      lastVisualConvulsion: source === 'multimodal',
      fusionConfirmed: true
    });

    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    statusTimeoutRef.current = setTimeout(() => {
      setMultimodalStatus({
        lastAudioBurst: false,
        lastVisualConvulsion: false,
        fusionConfirmed: false
      });
    }, 600);
  }, []);

  // Called when video motion engine detects sudden head/mouth convulsion
  const handleFaceMotionDetected = useCallback(({ motionScore, timestamp }) => {
    lastFaceMotionTimeRef.current = timestamp;

    // Check if an acoustic candidate was recently waiting for visual confirmation
    if (pendingAudioCandidateRef.current) {
      const timeDiff = timestamp - pendingAudioCandidateRef.current.timestamp;
      if (timeDiff <= 400) {
        // Matched! Confirm multimodal cough
        pendingAudioCandidateRef.current = null;
        registerConfirmedCough('multimodal');
      }
    }
  }, [registerConfirmedCough]);

  // Called when audio engine detects an acoustic cough candidate
  const handleAudioCandidate = useCallback(({ timestamp, ...meta }) => {
    // If camera is inactive or audio-only mode is selected, confirm immediately via acoustic engine
    if (!isCameraActive || detectionMode === 'audio_only') {
      registerConfirmedCough('audio');
      return;
    }

    // In Multimodal mode: Check if a facial convulsion occurred within the last 400ms
    const recentVisualDiff = timestamp - lastFaceMotionTimeRef.current;
    if (recentVisualDiff <= 400) {
      // Coincident audio burst + video convulsion!
      registerConfirmedCough('multimodal');
      return;
    }

    // Otherwise, hold candidate for 350ms waiting for the following head jolt
    pendingAudioCandidateRef.current = { timestamp, meta };
    setTimeout(() => {
      if (pendingAudioCandidateRef.current && pendingAudioCandidateRef.current.timestamp === timestamp) {
        pendingAudioCandidateRef.current = null;
      }
    }, 350);
  }, [isCameraActive, detectionMode, registerConfirmedCough]);

  // Hook for audio-based detection
  const {
    isListening,
    permissionError,
    audioLevel,
    currentThreshold,
    isCoughing,
    isSpeaking,
    startListening,
    stopListening,
    analyserNode,
    triggerManualCough
  } = useCoughDetector({
    onCoughCandidate: handleAudioCandidate,
    sensitivity
  });

  // Start microphone listening on mount
  useEffect(() => {
    startListening();
    const timer = setInterval(() => {
      setSecondsElapsed(prev => prev + 1);
    }, 1000);

    return () => {
      clearInterval(timer);
      stopListening();
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Current Chuma Level and Roast
  const currentLevel = getChumaLevel(coughCount);
  const currentRoast = getRoastComment(coughCount);

  const handleStop = () => {
    stopListening();
    onStopTest(coughCount, secondsElapsed);
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="test-view-container">
      {/* Top HUD Status Bar */}
      <div className="test-hud-navbar">
        <div className="flex items-center gap-3">
          <div className="brand-badge-mini">
            ChummAPP<span className="text-red-500">🔴</span>
          </div>
          <div className="status-live-pill">
            <span className="live-dot"></span>
            <span className="font-mono text-xs text-red-400">
              {isListening ? 'SURVEILLANCE ACTIVE' : 'CONNECTING...'}
            </span>
          </div>
        </div>

        {/* Multimodal Mode Selector */}
        <div className="flex items-center gap-2">
          <div className="detection-mode-toggle">
            <button
              onClick={() => setDetectionMode('multimodal')}
              className={`btn-mode ${detectionMode === 'multimodal' ? 'active' : ''}`}
              title="Requires BOTH audio cough burst AND video facial/head convulsion to eliminate speaking false positives"
            >
              <ShieldCheck size={13} />
              <span>MULTIMODAL AI (AUDIO + VIDEO)</span>
            </button>
            <button
              onClick={() => setDetectionMode('audio_only')}
              className={`btn-mode ${detectionMode === 'audio_only' ? 'active' : ''}`}
              title="Acoustic only with speech-rejection filter"
            >
              <Mic size={13} />
              <span>AUDIO ONLY</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="timer-badge font-mono text-sm">
            <span className="text-zinc-500 mr-1">T+:</span>
            <span className="text-white font-bold">{formatTime(secondsElapsed)}</span>
          </div>

          <button onClick={handleStop} className="btn-stop-test">
            <Square size={16} fill="currentColor" />
            <span>STOP TEST</span>
          </button>
        </div>
      </div>

      {/* Permission Warning */}
      {permissionError && (
        <div className="permission-error-banner">
          <AlertCircle size={18} />
          <div className="flex-1">
            <strong>Microphone Access Error:</strong> {permissionError}. Please allow microphone in your browser address bar.
          </div>
          <button onClick={startListening} className="btn-retry-mic">
            <RefreshCw size={14} /> Retry Mic
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="test-grid">
        {/* Left Column: Camera Preview & Audio Spectrum */}
        <div className="test-left-col">
          <div className="camera-box-wrap">
            <CameraPreview
              isCoughing={isCoughing}
              onFaceMotionDetected={handleFaceMotionDetected}
              isCameraActive={isCameraActive}
              onToggleCamera={() => setIsCameraActive(!isCameraActive)}
            />
          </div>

          <div className="audio-box-wrap">
            <AudioVisualizer
              analyserNode={analyserNode}
              isCoughing={isCoughing}
              isSpeaking={isSpeaking}
              audioLevel={audioLevel}
              currentThreshold={currentThreshold}
            />
          </div>

          {/* Multimodal Telemetry Status Bar */}
          <div className="multimodal-telemetry-card">
            <div className="telemetry-header">
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-400">
                <Cpu size={14} className="text-red-400" />
                <span>AI SENSOR FUSION ENGINE</span>
              </div>
              <span className={`fusion-badge ${multimodalStatus.fusionConfirmed ? 'confirmed' : ''}`}>
                {multimodalStatus.fusionConfirmed ? '⚡ MULTIMODAL MATCH CONFIRMED' : (detectionMode === 'multimodal' ? 'ARMED: DUAL-SENSOR LOCK' : 'ACOUSTIC MODE')}
              </span>
            </div>

            <div className="telemetry-badges-grid">
              <div className={`telem-chip ${isCoughing ? 'active' : ''}`}>
                <span className="telem-dot"></span>
                <span className="font-mono text-[10px]">ACOUSTIC TRANSIENT: {isCoughing ? 'BURST' : 'IDLE'}</span>
              </div>

              <div className={`telem-chip ${isSpeaking ? 'speaking-active' : ''}`}>
                <span className="telem-dot"></span>
                <span className="font-mono text-[10px]">SPEECH FILTER: {isSpeaking ? 'SUPPRESSED (TALKING)' : 'CLEARED'}</span>
              </div>

              <div className={`telem-chip ${multimodalStatus.lastVisualConvulsion ? 'active' : ''}`}>
                <span className="telem-dot"></span>
                <span className="font-mono text-[10px]">FACIAL CONVULSION: {multimodalStatus.lastVisualConvulsion ? 'CONFIRMED' : 'MONITORED'}</span>
              </div>
            </div>
          </div>

          {/* Sensitivity & Demo Tools */}
          <div className="controls-panel">
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-zinc-400">MIC SENSITIVITY:</span>
                <div className="sensitivity-buttons">
                  <button
                    onClick={() => setSensitivity('high')}
                    className={`btn-sens ${sensitivity === 'high' ? 'active' : ''}`}
                    title="Triggers at 14% volume - Best for standard laptop microphones"
                  >
                    HIGH (RECOMMENDED)
                  </button>
                  <button
                    onClick={() => setSensitivity('medium')}
                    className={`btn-sens ${sensitivity === 'medium' ? 'active' : ''}`}
                    title="Triggers at 22% volume - Normal coughing"
                  >
                    MEDIUM
                  </button>
                  <button
                    onClick={() => setSensitivity('low')}
                    className={`btn-sens ${sensitivity === 'low' ? 'active' : ''}`}
                    title="Triggers at 34% volume - Forceful coughs only"
                  >
                    LOW
                  </button>
                </div>
              </div>
              <div className="text-[11px] text-zinc-500 font-mono">
                💡 Talking is automatically suppressed by the Speech Filter. Cough or clear your throat to trigger!
              </div>
            </div>

            {/* Manual Cough Simulator */}
            <button
              onClick={() => registerConfirmedCough('manual')}
              className="btn-manual-cough"
              title="Click to simulate a cough event"
            >
              <HandMetal size={14} />
              <span>TEST TRIGGER (SIMULATE)</span>
            </button>
          </div>
        </div>

        {/* Right Column: Giant Live Cough Counter & Malayalam Roast */}
        <div className="test-right-col">
          {/* Cough Counter Card */}
          <div className={`counter-card ${isCoughing || multimodalStatus.fusionConfirmed ? 'counter-card-pulse' : ''}`}>
            <div className="counter-card-header">
              <span className="font-mono text-xs text-red-400 tracking-wider">
                LIVE PULMONARY DISCHARGE MONITOR
              </span>
              <span className={`pill-pulse ${isCoughing || multimodalStatus.fusionConfirmed ? 'active' : ''}`}>
                {isCoughing || multimodalStatus.fusionConfirmed ? '⚡ COUGH VERIFIED!' : 'LISTENING...'}
              </span>
            </div>

            <div className="counter-display">
              <div className="counter-big-number">
                {coughCount}
              </div>
              <div className="counter-unit font-mono">
                COUGHS DETECTED
              </div>
            </div>

            {/* Live Chuma Level Badge */}
            <div className="live-level-wrapper">
              <span className="font-mono text-[10px] text-zinc-400 block mb-1">
                CURRENT CHUMA RANK
              </span>
              <div
                className="live-level-badge"
                style={{
                  borderColor: currentLevel.color,
                  boxShadow: `0 0 15px ${currentLevel.color}33`
                }}
              >
                <div className="level-eng" style={{ color: currentLevel.color }}>
                  {currentLevel.title}
                </div>
                <div className="level-ml">
                  {currentLevel.malayalamTitle}
                </div>
              </div>
            </div>
          </div>

          {/* Live Malayalam Roast Box */}
          <div className="live-roast-card">
            <div className="roast-top">
              <Sparkles size={16} className="text-red-400" />
              <span className="font-mono text-xs text-red-300 font-semibold tracking-wider">
                LIVE MALAYALAM ROAST ENGINE
              </span>
            </div>

            <div className="roast-bubble">
              <div className="roast-ml-text">
                "{currentRoast.ml}"
              </div>
              <div className="roast-en-text">
                "{currentRoast.en}"
              </div>
            </div>

            <div className="roast-footer font-mono text-[11px] text-zinc-500">
              *Speech filter active. Only legitimate coughs qualify for roasts.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
