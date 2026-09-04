<<<<<<< HEAD
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
=======
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, CameraOff, Crosshair, Zap, Eye, EyeOff, FlipHorizontal, RefreshCw } from 'lucide-react';

export default function CameraPreview({
  isCoughing,
  onFaceMotionDetected,
  isCameraActive = true,
  onToggleCamera
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const prevFrameDataRef = useRef(null);
  const animFrameRef = useRef(null);
  const onFaceMotionDetectedRef = useRef(onFaceMotionDetected);

  const [hasCamera, setHasCamera] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [scanPulse, setScanPulse] = useState(0);
  const [faceMotionLevel, setFaceMotionLevel] = useState(0);
  const [isFaceConvulsing, setIsFaceConvulsing] = useState(false);

  // Video Preview Options
  const [showHud, setShowHud] = useState(true);
  const [isMirrored, setIsMirrored] = useState(true);

  useEffect(() => {
    onFaceMotionDetectedRef.current = onFaceMotionDetected;
  }, [onFaceMotionDetected]);

  // Connect stream to video element whenever stream or videoRef is ready
  const attachStreamToVideo = useCallback(() => {
    if (videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(err => {
        console.warn('Video play error:', err);
      });
    }
  }, []);

  // Set up camera stream
  const startCamera = useCallback(async () => {
    if (!isCameraActive) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      setHasCamera(false);
      setIsInitializing(false);
      return;
    }

    setIsInitializing(true);
    setCameraError(null);

    try {
      // Try with preferred front-facing constraints first
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          }
        });
      } catch (e1) {
        // Fallback to generic video constraint
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      streamRef.current = stream;
      setHasCamera(true);
      setCameraError(null);
      setIsInitializing(false);

      // Attach immediately to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(console.warn);
      }
    } catch (err) {
      console.warn('Camera access error:', err);
      setCameraError(err.message || 'Camera permission denied or camera not found');
      setHasCamera(false);
      setIsInitializing(false);
    }
  }, [isCameraActive]);

  useEffect(() => {
    let mounted = true;
    startCamera();

    const interval = setInterval(() => {
      setScanPulse(prev => (prev + 1) % 100);
    }, 500);

    return () => {
      mounted = false;
      clearInterval(interval);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [startCamera]);

  // Ensure stream stays attached whenever hasCamera or isCameraActive updates
  useEffect(() => {
    if (hasCamera && isCameraActive) {
      attachStreamToVideo();
    }
  }, [hasCamera, isCameraActive, attachStreamToVideo]);

  // Real-time Video Facial Motion Analysis Loop
  useEffect(() => {
    if (!hasCamera || !isCameraActive) return;

    const sampleWidth = 100;
    const sampleHeight = 75;
    const canvas = document.createElement('canvas');
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    let convulsionTimeout = null;

    const analyzeVideoMotion = () => {
      const video = videoRef.current;
      if (video && video.readyState >= 2 && !video.paused) {
        try {
          ctx.drawImage(video, 0, 0, sampleWidth, sampleHeight);
          // Focus on lower face / mouth region
          const startX = Math.floor(sampleWidth * 0.2);
          const startY = Math.floor(sampleHeight * 0.3);
          const roiWidth = Math.floor(sampleWidth * 0.6);
          const roiHeight = Math.floor(sampleHeight * 0.55);

          const frameData = ctx.getImageData(startX, startY, roiWidth, roiHeight);
          const data = frameData.data;

          if (prevFrameDataRef.current) {
            const prev = prevFrameDataRef.current;
            let totalDiff = 0;
            const pixelCount = data.length / 4;

            for (let i = 0; i < data.length; i += 4) {
              const currLum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
              const prevLum = 0.299 * prev[i] + 0.587 * prev[i + 1] + 0.114 * prev[i + 2];
              const diff = Math.abs(currLum - prevLum);
              if (diff > 14) {
                totalDiff += diff;
              }
            }

            const motionScore = Math.min(100, Math.round((totalDiff / (pixelCount * 255)) * 950));
            setFaceMotionLevel(motionScore);

            // Convulsion threshold: > 24% sudden movement
            if (motionScore >= 24) {
              setIsFaceConvulsing(true);
              if (convulsionTimeout) clearTimeout(convulsionTimeout);
              convulsionTimeout = setTimeout(() => {
                setIsFaceConvulsing(false);
              }, 450);

              if (onFaceMotionDetectedRef.current) {
                onFaceMotionDetectedRef.current({
                  motionScore,
                  timestamp: Date.now()
                });
              }
            }
          }

          prevFrameDataRef.current = new Uint8ClampedArray(data);
        } catch (e) {
          // Ignore transient canvas errors
        }
      }

      animFrameRef.current = requestAnimationFrame(analyzeVideoMotion);
    };

    animFrameRef.current = requestAnimationFrame(analyzeVideoMotion);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (convulsionTimeout) clearTimeout(convulsionTimeout);
    };
  }, [hasCamera, isCameraActive]);

  return (
    <div className="camera-outer-wrapper">
      {/* Video Preview Toolbar Options */}
      <div className="camera-options-toolbar">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleCamera}
            className={`btn-cam-opt ${isCameraActive ? 'active' : 'inactive'}`}
            title="Toggle Video Camera On/Off"
          >
            {isCameraActive ? <Camera size={13} /> : <CameraOff size={13} />}
            <span>{isCameraActive ? 'CAM: ON' : 'CAM: OFF'}</span>
          </button>

          {isCameraActive && hasCamera && (
            <>
              <button
                onClick={() => setShowHud(!showHud)}
                className={`btn-cam-opt ${showHud ? 'active' : ''}`}
                title="Toggle Cyberpunk Biometric HUD overlay"
              >
                {showHud ? <Eye size={13} /> : <EyeOff size={13} />}
                <span>{showHud ? 'HUD: ON' : 'HUD: OFF'}</span>
              </button>

              <button
                onClick={() => setIsMirrored(!isMirrored)}
                className={`btn-cam-opt ${isMirrored ? 'active' : ''}`}
                title="Flip Camera Horizontally"
              >
                <FlipHorizontal size={13} />
                <span>{isMirrored ? 'MIRROR' : 'NORMAL'}</span>
              </button>
            </>
          )}

          {cameraError && (
            <button
              onClick={startCamera}
              className="btn-cam-opt active text-red-300"
              title="Retry Camera Access"
            >
              <RefreshCw size={13} />
              <span>RETRY CAM</span>
            </button>
          )}
        </div>

        {isCameraActive && hasCamera && (
          <div className="motion-indicator-pill">
            <span className="text-[10px] text-zinc-400 font-mono">FACE MOTION:</span>
            <span className={`font-mono text-xs font-bold ${faceMotionLevel >= 24 ? 'text-amber-400' : 'text-zinc-300'}`}>
              {faceMotionLevel}%
            </span>
          </div>
        )}
      </div>

      {/* Camera Video Display Frame */}
      <div className={`camera-hud-frame ${isCoughing || isFaceConvulsing ? 'cough-impact-active' : ''}`}>
        {/* Video Element - ALWAYS kept in DOM and wired to ref for guaranteed streaming */}
        <video
          ref={(node) => {
            videoRef.current = node;
            if (node && streamRef.current && node.srcObject !== streamRef.current) {
              node.srcObject = streamRef.current;
              node.play().catch(console.warn);
            }
          }}
          autoPlay
          playsInline
          muted
          className={`camera-video-element ${isMirrored ? 'mirrored' : ''}`}
          style={{
            display: hasCamera && isCameraActive ? 'block' : 'none'
          }}
        />

        {/* Fallback Display if Camera is Off or Unavailable */}
        {(!hasCamera || !isCameraActive) && (
          <div className="camera-fallback-screen">
            <CameraOff size={38} className="text-red-500 mb-2 opacity-60" />
            <div className="font-mono text-xs text-red-400">
              {isInitializing
                ? 'INITIALIZING CAMERA SENSOR...'
                : !isCameraActive
                ? 'CAMERA DISABLED (CLICK "CAM: ON" ABOVE)'
                : cameraError
                ? `CAMERA BLOCKED: ${cameraError}`
                : 'CAMERA SENSOR OFFLINE'}
            </div>
            <p className="text-[11px] text-zinc-500 max-w-xs mt-1.5 text-center font-mono">
              {!isCameraActive
                ? 'Facial convulsion verification is paused. Audio detection remains active.'
                : 'Check browser camera permissions (lock icon in address bar).'}
            </p>
            {cameraError && (
              <button onClick={startCamera} className="btn-retry-cam-inline mt-2">
                <RefreshCw size={12} /> Allow & Retry Camera
              </button>
            )}
          </div>
        )}

        {/* Biometric Cyberpunk HUD Overlays (Toggleable) */}
        {hasCamera && isCameraActive && showHud && (
          <div className="camera-overlay-layer">
            <div className="laser-scan-line" />

            {/* Target Reticle Box over mouth and head */}
            <div className={`hud-reticle-box ${isFaceConvulsing ? 'reticle-convulsion-active' : ''}`}>
              <div className="reticle-corner top-left"></div>
              <div className="reticle-corner top-right"></div>
              <div className="reticle-corner bottom-left"></div>
              <div className="reticle-corner bottom-right"></div>
              <Crosshair className="reticle-center-icon" size={20} />
              <span className="reticle-label">
                {isFaceConvulsing ? '⚡ CONVULSION DETECTED' : 'TARGET: LUNGS LOCKED'}
              </span>
            </div>

            {/* Top telemetry bar */}
            <div className="hud-header-bar">
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-red-400">
                <span className="hud-rec-dot"></span>
                <span>AI VISION RECOGNITION</span>
              </div>
              <div className="font-mono text-[10px] text-zinc-400">
                MOTION_RATE: {faceMotionLevel}%
              </div>
            </div>

            {/* Bottom telemetry indicators */}
            <div className="hud-footer-bar">
              <div className="hud-stat-pill">
                <Zap size={11} className={faceMotionLevel >= 24 ? 'text-amber-400' : 'text-zinc-500'} />
                <span>MOUTH/DIAPHRAGM: {faceMotionLevel >= 24 ? 'CONVULSED' : 'STABLE'}</span>
              </div>
              <div className="hud-stat-pill">
                <span>SENSOR: {isCoughing ? '⚡ COUGH SPIKE' : 'SCANNING'}</span>
              </div>
            </div>

            {/* Cough Impact Alert Banner */}
            {(isCoughing || isFaceConvulsing) && (
              <div className="cough-impact-banner">
                <Zap size={16} className="text-amber-300" />
                <span>RESPIRATORY CONVULSION DETECTED</span>
              </div>
            )}
          </div>
        )}
      </div>
>>>>>>> b70dfce39d9d6fdb4fad12552d1882e6f0f22922
    </div>
  );
}
