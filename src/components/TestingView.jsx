import React, { useState, useEffect } from 'react';
import './TestingView.css';
import { CameraPreview } from './CameraPreview';
import { CoughCounter } from './CoughCounter';
import { AudioVisualizer } from './AudioVisualizer';
import { RoastTicker } from './RoastTicker';

export function TestingView({
  cameraStream,
  cameraStatus,
  coughCount,
  lastCoughTime,
  currentRms,
  analyserNode,
  isDetecting,
  sensitivityThreshold,
  onThresholdChange,
  onSimulateCough,
  onStopTest
}) {
  const [sessionSeconds, setSessionSeconds] = useState(0);

  // Timer loop for active session duration
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="testing-container">
      <header className="testing-header">
        <div className="testing-brand">
          <span className="session-timer-dot" />
          <h2 className="testing-title">
            Chumm<span className="red-accent">APP</span> 🔴
          </h2>
        </div>

        <div className="testing-controls-top">
          <div className="session-timer-pill">
            <span>REC</span>
            <span>{formatTimer(sessionSeconds)}</span>
          </div>

          {/* Tunable Threshold Slider for Demos/Varying Mics */}
          <div className="sensitivity-control-pill" title="Adjust acoustic threshold if room is loud or mic is quiet">
            <span>MIC SENSITIVITY:</span>
            <input
              type="range"
              min="0.05"
              max="0.25"
              step="0.01"
              value={sensitivityThreshold}
              onChange={(e) => onThresholdChange(parseFloat(e.target.value))}
              className="sensitivity-slider"
            />
            <span>{sensitivityThreshold.toFixed(2)}</span>
          </div>

          <button
            id="stop-chuma-test-btn"
            className="btn-stop-test"
            onClick={() => onStopTest(sessionSeconds)}
          >
            <span>⏹</span>
            <span>STOP TEST</span>
          </button>
        </div>
      </header>

      <main className="testing-grid">
        {/* Left Column: Cosmetic Camera + Live Audio Spectrum */}
        <section className="testing-column-left">
          <CameraPreview
            cameraStream={cameraStream}
            cameraStatus={cameraStatus}
          />

          <AudioVisualizer
            analyserNode={analyserNode}
            currentRms={currentRms}
            threshold={sensitivityThreshold}
            isDetecting={isDetecting}
          />
        </section>

        {/* Right Column: Prominent Cough Counter + Malayalam Roast Ticker */}
        <section className="testing-column-right">
          <CoughCounter
            coughCount={coughCount}
            lastCoughTime={lastCoughTime}
          />

          <RoastTicker
            coughCount={coughCount}
            lastCoughTime={lastCoughTime}
          />

          {/* Comedic Simulation Bar for Hackathon Demo Quick Testing */}
          <div className="demo-simulation-bar">
            <span>💡 DEMO TESTING CONTROLS (IN CASE OF SILENT ROOM)</span>
            <button
              id="simulate-cough-btn"
              className="btn-simulate-cough"
              onClick={onSimulateCough}
            >
              + SIMULATE COUGH
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
