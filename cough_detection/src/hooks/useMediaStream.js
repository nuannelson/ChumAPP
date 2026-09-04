import { useState, useCallback, useRef, useEffect } from 'react';

export function useMediaStream() {
  const [micStream, setMicStream] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [micStatus, setMicStatus] = useState('idle'); // 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported'
  const [cameraStatus, setCameraStatus] = useState('idle'); // 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported'
  const [errorMessage, setErrorMessage] = useState(null);

  const micStreamRef = useRef(null);
  const cameraStreamRef = useRef(null);

  const stopAllStreams = useCallback(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
      setMicStream(null);
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
      setCameraStream(null);
    }
    setMicStatus('idle');
    setCameraStatus('idle');
  }, []);

  const requestPermissions = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicStatus('unsupported');
      setCameraStatus('unsupported');
      setErrorMessage('Your browser does not support WebRTC / MediaDevices APIs. Please use Chrome, Edge, or Firefox.');
      return false;
    }

    setErrorMessage(null);

    // 1. Request Microphone (Mandatory for detection)
    setMicStatus('requesting');
    let micSuccess = false;
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      micStreamRef.current = audioStream;
      setMicStream(audioStream);
      setMicStatus('granted');
      micSuccess = true;
    } catch (err) {
      console.warn('Microphone permission denied or unavailable:', err);
      setMicStatus('denied');
      setErrorMessage('Microphone access is required for acoustic cough telemetry. Please allow microphone permission to continue.');
      return false;
    }

    // 2. Request Camera (Cosmetic only as per MVP spec)
    // If user denies or device has no camera, we DO NOT fail the session.
    setCameraStatus('requesting');
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });
      cameraStreamRef.current = videoStream;
      setCameraStream(videoStream);
      setCameraStatus('granted');
    } catch (videoErr) {
      console.warn('Camera permission denied or camera missing (cosmetic only, continuing):', videoErr);
      setCameraStatus('denied');
      // No failure, cosmetic camera placeholder will be shown
    }

    return micSuccess;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllStreams();
    };
  }, [stopAllStreams]);

  return {
    micStream,
    cameraStream,
    micStatus,
    cameraStatus,
    errorMessage,
    requestPermissions,
    stopAllStreams
  };
}
