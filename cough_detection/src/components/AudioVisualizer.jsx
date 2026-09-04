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
    };

    render();

    return () => {
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
      </div>

      <canvas
        ref={canvasRef}
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
      </div>
    </div>
  );
}
