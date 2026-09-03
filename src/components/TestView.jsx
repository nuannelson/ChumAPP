import React, { useState, useEffect, useCallback } from 'react';
import { Square, Sparkles, Volume2, Mic, AlertCircle, RefreshCw, HandMetal, Info } from 'lucide-react';
import CameraPreview from './CameraPreview';
import AudioVisualizer from './AudioVisualizer';
import { useCoughDetector } from '../hooks/useCoughDetector';
import { getChumaLevel, getRoastComment } from '../utils/chumaData';

export default function TestView({ onStopTest }) {
  const [coughCount, setCoughCount] = useState(0);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [sensitivity, setSensitivity] = useState('high'); // Default to high for optimal laptop mic pickup

  // Callback when cough is detected
  const handleCoughDetected = useCallback(() => {
    setCoughCount(prev => prev + 1);
  }, []);

  // Hook for audio-based cough detection
  const {
    isListening,
    permissionError,
    audioLevel,
    currentThreshold,
    isCoughing,
    startListening,
    stopListening,
    analyserNode,
    triggerManualCough
  } = useCoughDetector({
    onCoughDetected: handleCoughDetected,
    sensitivity
  });

  // Start microphone listening on mount only once
  useEffect(() => {
    startListening();
    const timer = setInterval(() => {
      setSecondsElapsed(prev => prev + 1);
    }, 1000);

    return () => {
      clearInterval(timer);
      stopListening();
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
              {isListening ? 'MIC SURVEILLANCE ACTIVE' : 'CONNECTING MIC...'}
            </span>
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

      {/* Permission Warning if Mic blocked */}
      {permissionError && (
        <div className="permission-error-banner">
          <AlertCircle size={18} />
          <div className="flex-1">
            <strong>Microphone Access Error:</strong> {permissionError}. Please allow microphone permissions in browser settings.
          </div>
          <button onClick={startListening} className="btn-retry-mic">
            <RefreshCw size={14} /> Retry Mic
          </button>
        </div>
      )}

      {/* Main Grid: Left is Video & Audio HUD, Right is Live Cough Counter & Roasts */}
      <div className="test-grid">
        {/* Left Column: Biometric Camera & Visualizer */}
        <div className="test-left-col">
          <div className="camera-box-wrap">
            <CameraPreview isCoughing={isCoughing} />
          </div>

          <div className="audio-box-wrap">
            <AudioVisualizer
              analyserNode={analyserNode}
              isCoughing={isCoughing}
              audioLevel={audioLevel}
              currentThreshold={currentThreshold}
            />
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
                    title="Triggers at 24% volume - Normal coughing"
                  >
                    MEDIUM
                  </button>
                  <button
                    onClick={() => setSensitivity('low')}
                    className={`btn-sens ${sensitivity === 'low' ? 'active' : ''}`}
                    title="Triggers at 38% volume - Forceful coughs only"
                  >
                    LOW
                  </button>
                </div>
              </div>
              <div className="text-[11px] text-zinc-500 font-mono">
                💡 Cough or clear your throat into your mic. When volume crosses the red line, it registers!
              </div>
            </div>

            {/* Manual Cough Simulator for testing/instant demo */}
            <button
              onClick={triggerManualCough}
              className="btn-manual-cough"
              title="Click to simulate a cough event for testing"
            >
              <HandMetal size={14} />
              <span>TEST TRIGGER (SIMULATE)</span>
            </button>
          </div>
        </div>

        {/* Right Column: Giant Live Cough Counter & Malayalam Roast */}
        <div className="test-right-col">
          {/* Cough Counter Card */}
          <div className={`counter-card ${isCoughing ? 'counter-card-pulse' : ''}`}>
            <div className="counter-card-header">
              <span className="font-mono text-xs text-red-400 tracking-wider">
                LIVE PULMONARY DISCHARGE MONITOR
              </span>
              <span className={`pill-pulse ${isCoughing ? 'active' : ''}`}>
                {isCoughing ? '⚡ COUGH DETECTED!' : 'LISTENING TO MIC...'}
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
              *Real-time sarcasm generated by over-engineered quantum AI.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
