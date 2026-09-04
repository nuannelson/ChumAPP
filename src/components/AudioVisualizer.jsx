<<<<<<< HEAD
import React, { useEffect, useRef } from 'react';
import './AudioVisualizer.css';

export function AudioVisualizer({
  analyserNode,
  currentRms = 0,
  threshold = 0.12,
  isDetecting = false
}) {
  const canvasRef = useRef(null);
  const animIdRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserNode || !isDetecting) return;

    const ctx = canvas.getContext('2d');
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animIdRef.current = requestAnimationFrame(render);
      analyserNode.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Cyber background grid lines
      ctx.fillStyle = '#080a10';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      const barCount = 32;
      const step = Math.floor(bufferLength / barCount);
      const barWidth = (width / barCount) - 2;

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step] || 0;
        const percent = value / 255;
        const barHeight = Math.max(3, percent * (height - 8));
        const x = i * (barWidth + 2);
        const y = height - barHeight;

        // Gradient: emerald to cyber red
        if (percent > 0.6) {
          ctx.fillStyle = '#ff334b';
        } else if (percent > 0.3) {
          ctx.fillStyle = '#f59e0b';
        } else {
          ctx.fillStyle = 'rgba(52, 211, 153, 0.7)';
        }

        ctx.fillRect(x, y, barWidth, barHeight);
      }
=======
import React, { useRef, useEffect } from 'react';

export default function AudioVisualizer({
  analyserNode,
  isCoughing,
  isSpeaking,
  audioLevel = 0,
  currentThreshold = 20
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Dark background with faint grid
      ctx.fillStyle = '#0b0e14';
      ctx.fillRect(0, 0, width, height);

      // Grid lines
      ctx.strokeStyle = 'rgba(255, 45, 85, 0.08)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (analyserNode) {
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserNode.getByteFrequencyData(dataArray);

        // Draw frequency bars
        const barCount = 42;
        const barWidth = (width / barCount) - 3;
        let x = 2;

        for (let i = 0; i < barCount; i++) {
          const index = Math.min(bufferLength - 1, Math.floor(Math.pow(i / barCount, 1.35) * (bufferLength * 0.45)));
          const barHeight = Math.max(4, (dataArray[index] / 255) * (height - 12));

          const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
          if (isCoughing) {
            gradient.addColorStop(0, '#ff2d55');
            gradient.addColorStop(0.5, '#ff3b30');
            gradient.addColorStop(1, '#ffffff');
          } else if (isSpeaking) {
            // Cyan/blue gradient when speaking (speech filter active)
            gradient.addColorStop(0, '#0369a1');
            gradient.addColorStop(0.6, '#0ea5e9');
            gradient.addColorStop(1, '#38bdf8');
          } else {
            gradient.addColorStop(0, '#7f1d1d');
            gradient.addColorStop(0.6, '#ef4444');
            gradient.addColorStop(1, '#ff6b81');
          }

          ctx.fillStyle = gradient;
          ctx.shadowColor = isCoughing ? '#ff2d55' : (isSpeaking ? '#0ea5e9' : 'rgba(239, 68, 68, 0.3)');
          ctx.shadowBlur = isCoughing ? 12 : (isSpeaking ? 6 : 3);

          ctx.fillRect(x, height - barHeight, barWidth, barHeight);
          x += barWidth + 3;
        }

        ctx.shadowBlur = 0;
      } else {
        // Heartbeat idle line
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        for (let x = 0; x < width; x += 10) {
          const y = height / 2 + Math.sin((x + Date.now() / 15) * 0.05) * 6;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      animationId = requestAnimationFrame(render);
>>>>>>> b70dfce39d9d6fdb4fad12552d1882e6f0f22922
    };

    render();

    return () => {
<<<<<<< HEAD
      if (animIdRef.current) {
        cancelAnimationFrame(animIdRef.current);
      }
    };
  }, [analyserNode, isDetecting]);

  const rmsPercent = Math.min(100, Math.round((currentRms / 0.35) * 100));
  const thresholdPercent = Math.min(100, Math.round((threshold / 0.35) * 100));
  const isSpike = currentRms >= threshold;

  return (
    <div className="audio-visualizer-card">
      <div className="visualizer-header">
        <div className="visualizer-title">
          <span className={`visualizer-wave-dot ${isSpike ? 'hot' : ''}`} />
          <span>REAL-TIME ACOUSTIC SPECTRUM</span>
        </div>
        <span>{isSpike ? '⚡ AMPLITUDE SPIKE' : 'SCANNING FREQUENCIES'}</span>
=======
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [analyserNode, isCoughing, isSpeaking]);

  const isAboveThreshold = audioLevel >= currentThreshold;

  return (
    <div className="audio-visualizer-container">
      <div className="visualizer-header">
        <div className="flex items-center gap-2">
          <span className={`status-dot ${isCoughing ? 'coughing' : (isSpeaking ? 'speaking' : 'active')}`}></span>
          <span className="visualizer-title">QUANTUM ACOUSTIC SPECTRUM</span>
        </div>
        <div className="visualizer-stats">
          {isSpeaking && (
            <span className="speech-filter-badge">🗣️ SPEECH FILTER: TALKING</span>
          )}
          <span className="stat-label">INPUT:</span>
          <span className={`stat-val ${isAboveThreshold ? 'text-red-400 font-bold' : ''}`}>
            {audioLevel}%
          </span>
          {isCoughing && (
            <span className="cough-tag-alert">BURST TRIGGERED</span>
          )}
        </div>
>>>>>>> b70dfce39d9d6fdb4fad12552d1882e6f0f22922
      </div>

      <canvas
        ref={canvasRef}
<<<<<<< HEAD
        width={400}
        height={72}
        className="visualizer-canvas"
      />

      <div className="rms-meter-row">
        <span>VOL RMS:</span>
        <div className="rms-meter-track">
          {/* Threshold indicator line */}
          <div
            className="rms-meter-threshold-marker"
            style={{ left: `${thresholdPercent}%` }}
            title={`Threshold: ${threshold}`}
          />
          <div
            className={`rms-meter-bar ${isSpike ? 'spike' : ''}`}
            style={{ width: `${rmsPercent}%` }}
          />
        </div>
        <span>{(currentRms * 100).toFixed(1)}%</span>
=======
        width={420}
        height={76}
        className={`visualizer-canvas ${isCoughing ? 'cough-canvas-flash' : ''}`}
      />

      {/* Real-time Level vs Threshold Indicator Bar */}
      <div className="audio-meter-wrap">
        <div className="audio-meter-track">
          <div
            className={`audio-meter-fill ${isAboveThreshold ? 'meter-above-thresh' : ''}`}
            style={{ width: `${Math.min(100, audioLevel)}%` }}
          />
          <div
            className="audio-meter-threshold-pin"
            style={{ left: `${currentThreshold}%` }}
            title={`Trigger Threshold: ${currentThreshold}%`}
          />
        </div>
        <div className="audio-meter-labels">
          <span className="text-[10px] text-zinc-500 font-mono">0%</span>
          <span className="text-[10px] text-red-400 font-mono">
            TRIGGER THRESHOLD: {currentThreshold}%
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">100%</span>
        </div>
>>>>>>> b70dfce39d9d6fdb4fad12552d1882e6f0f22922
      </div>
    </div>
  );
}
