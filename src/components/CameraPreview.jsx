import React, { useEffect, useRef } from 'react';
import './CameraPreview.css';

export function CameraPreview({ cameraStream, cameraStatus }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(err => {
        console.warn('Auto-play error on cosmetic camera stream:', err);
      });
    }
  }, [cameraStream]);

  const hasActiveCamera = cameraStatus === 'granted' && cameraStream;

  return (
    <div className="camera-preview-container">
      {hasActiveCamera ? (
        <>
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="camera-video-element"
          />
          <div className="camera-scanline" />
          
          {/* Purely Cosmetic Biometric HUD */}
          <div className="camera-hud-overlay">
            <div className="hud-top-bar">
              <div className="hud-status-badge">
                <span className="hud-rec-dot" />
                <span>COSMETIC FACIAL HUD [ONLINE]</span>
              </div>
              <span>FPS: 60.0</span>
            </div>

            <div className="hud-center-reticle">
              <span className="hud-corner tl" />
              <span className="hud-corner tr" />
              <span className="hud-corner bl" />
              <span className="hud-corner br" />
              <div className="reticle-crosshair" />
              <span className="reticle-label">TARGET: LARYNX ZONE</span>
            </div>

            <div className="hud-bottom-bar">
              <span>ZERO COMPUTER VISION ACTIVE</span>
              <span>100% FOR SHOW</span>
            </div>
          </div>
        </>
      ) : (
        <div className="camera-fallback-card">
          <div className="fallback-icon">📷❌</div>
          <div className="fallback-title">OPTICAL FEED OFFLINE</div>
          <p className="fallback-desc">
            {cameraStatus === 'denied'
              ? 'Camera permission declined. Acoustic sensors remain 100% active!'
              : 'Optical sensors in standby mode. Acoustic analysis engaged.'}
          </p>
          <div className="fallback-badge">
            Acoustic Telemetry Only
          </div>
        </div>
      )}
    </div>
  );
}
