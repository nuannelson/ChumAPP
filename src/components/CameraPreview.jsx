import React, { useRef, useEffect, useState } from 'react';
import { Camera, CameraOff, ShieldAlert, Crosshair, Zap } from 'lucide-react';

export default function CameraPreview({ isCoughing }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [scanPulse, setScanPulse] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          }
        });

        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasCamera(true);
        setCameraError(null);
      } catch (err) {
        console.warn('Camera stream error:', err);
        if (mounted) {
          setCameraError(err.message || 'Camera permission denied or camera unavailable');
          setHasCamera(false);
        }
      }
    }

    setupCamera();

    const interval = setInterval(() => {
      setScanPulse(prev => (prev + 1) % 100);
    }, 500);

    return () => {
      mounted = false;
      clearInterval(interval);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className={`camera-hud-frame ${isCoughing ? 'cough-impact-active' : ''}`}>
      {/* Video Feed or Fallback */}
      {hasCamera ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="camera-video-element"
        />
      ) : (
        <div className="camera-fallback-screen">
          <CameraOff size={42} className="text-red-500 mb-2 opacity-70" />
          <div className="font-mono text-xs text-red-400">
            {cameraError ? 'OPTICAL SENSOR OFFLINE' : 'INITIALIZING BIOMETRIC OPTICS...'}
          </div>
          <p className="text-[11px] text-zinc-500 max-w-xs mt-1 text-center font-mono">
            {cameraError ? cameraError : 'Audio analysis will continue regardless.'}
          </p>
        </div>
      )}

      {/* Cyberpunk HUD Overlays */}
      <div className="camera-overlay-layer">
        {/* Scanner Laser Bar */}
        <div className="laser-scan-line" />

        {/* Reticle Target Box */}
        <div className="hud-reticle-box">
          <div className="reticle-corner top-left"></div>
          <div className="reticle-corner top-right"></div>
          <div className="reticle-corner bottom-left"></div>
          <div className="reticle-corner bottom-right"></div>
          <Crosshair className="reticle-center-icon" size={20} />
          <span className="reticle-label">TARGET: LUNGS LOCKED</span>
        </div>

        {/* Top telemetry banner */}
        <div className="hud-header-bar">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-red-400">
            <span className="hud-rec-dot"></span>
            <span>AI SURVEILLANCE v4.09</span>
          </div>
          <div className="font-mono text-[10px] text-zinc-400">
            SCAN_PULSE: {120 + (scanPulse % 30)} Hz
          </div>
        </div>

        {/* Bottom telemetry indicators */}
        <div className="hud-footer-bar">
          <div className="hud-stat-pill">
            <Zap size={11} className="text-amber-400" />
            <span>AEROSOL CONE: ARMED</span>
          </div>
          <div className="hud-stat-pill">
            <span>BIO-STATUS: {isCoughing ? '⚡ DISRUPTION' : 'MONITORED'}</span>
          </div>
        </div>

        {/* Cough Impact Alert Banner */}
        {isCoughing && (
          <div className="cough-impact-banner">
            <ShieldAlert size={18} />
            <span>RESPIRATORY CONVULSION DETECTED</span>
          </div>
        )}
      </div>
    </div>
  );
}
