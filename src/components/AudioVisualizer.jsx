import React, { useRef, useEffect } from 'react';

export default function AudioVisualizer({ analyserNode, isCoughing, audioLevel = 0, currentThreshold = 20 }) {
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
          } else {
            gradient.addColorStop(0, '#7f1d1d');
            gradient.addColorStop(0.6, '#ef4444');
            gradient.addColorStop(1, '#ff6b81');
          }

          ctx.fillStyle = gradient;
          ctx.shadowColor = isCoughing ? '#ff2d55' : 'rgba(239, 68, 68, 0.4)';
          ctx.shadowBlur = isCoughing ? 12 : 4;

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
    };

    render();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [analyserNode, isCoughing]);

  const isAboveThreshold = audioLevel >= currentThreshold;

  return (
    <div className="audio-visualizer-container">
      <div className="visualizer-header">
        <div className="flex items-center gap-2">
          <span className={`status-dot ${isCoughing ? 'coughing' : 'active'}`}></span>
          <span className="visualizer-title">QUANTUM ACOUSTIC SPECTRUM</span>
        </div>
        <div className="visualizer-stats">
          <span className="stat-label">MIC INPUT:</span>
          <span className={`stat-val ${isAboveThreshold ? 'text-red-400 font-bold' : ''}`}>
            {audioLevel}%
          </span>
          {isCoughing && (
            <span className="cough-tag-alert">COUGH DETECTED!</span>
          )}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={420}
        height={78}
        className={`visualizer-canvas ${isCoughing ? 'cough-canvas-flash' : ''}`}
      />

      {/* Real-time Level vs Threshold Indicator Bar */}
      <div className="audio-meter-wrap">
        <div className="audio-meter-track">
          {/* Level Fill Bar */}
          <div
            className={`audio-meter-fill ${isAboveThreshold ? 'meter-above-thresh' : ''}`}
            style={{ width: `${Math.min(100, audioLevel)}%` }}
          />
          {/* Threshold Marker Pin */}
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
      </div>
    </div>
  );
}
