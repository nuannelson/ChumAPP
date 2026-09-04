import React, { useState, useCallback } from 'react';
import './App.css';
import { LandingPage } from './components/LandingPage';
import { TestingView } from './components/TestingView';
import { FinalReport } from './components/FinalReport';
import { ErrorModal } from './components/ErrorModal';
import { useMediaStream } from './hooks/useMediaStream';
import { useCoughDetector, DEFAULT_COUGH_THRESHOLD } from './hooks/useCoughDetector';

export function App() {
  const [currentScreen, setCurrentScreen] = useState('landing'); // 'landing' | 'testing' | 'report'
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [sessionDurationSec, setSessionDurationSec] = useState(0);
  const [sensitivityThreshold, setSensitivityThreshold] = useState(DEFAULT_COUGH_THRESHOLD);

  const {
    micStream,
    cameraStream,
    micStatus,
    cameraStatus,
    errorMessage,
    requestPermissions,
    stopAllStreams
  } = useMediaStream();

  const handleCoughDetected = useCallback((_timestamp) => {
    // Subtle audio blip or visual pulse handled by CoughCounter
  }, []);

  const {
    coughCount,
    lastCoughTime,
    currentRms,
    isDetecting,
    resetCount,
    manualTriggerCough,
    analyserNode
  } = useCoughDetector({
    audioStream: micStream,
    isActive: currentScreen === 'testing',
    threshold: sensitivityThreshold,
    onCough: handleCoughDetected
  });

  const handleStartTest = async () => {
    setIsCheckingPermissions(true);
    resetCount();
    const micGranted = await requestPermissions();
    setIsCheckingPermissions(false);

    if (micGranted) {
      setCurrentScreen('testing');
    } else {
      setShowErrorModal(true);
    }
  };

  const handleStopTest = (duration) => {
    setSessionDurationSec(duration);
    stopAllStreams();
    setCurrentScreen('report');
  };

  const handleRestart = () => {
    stopAllStreams();
    resetCount();
    setCurrentScreen('landing');
  };

  const handleRetryPermissions = async () => {
    setShowErrorModal(false);
    await handleStartTest();
  };

  const handleDismissModal = () => {
    setShowErrorModal(false);
    stopAllStreams();
    setCurrentScreen('landing');
  };

  return (
    <div className="app-wrapper">
      {currentScreen === 'landing' && (
        <LandingPage
          onStartTest={handleStartTest}
          isCheckingPermissions={isCheckingPermissions}
        />
      )}

      {currentScreen === 'testing' && (
        <TestingView
          cameraStream={cameraStream}
          cameraStatus={cameraStatus}
          coughCount={coughCount}
          lastCoughTime={lastCoughTime}
          currentRms={currentRms}
          analyserNode={analyserNode}
          isDetecting={isDetecting}
          sensitivityThreshold={sensitivityThreshold}
          onThresholdChange={setSensitivityThreshold}
          onSimulateCough={manualTriggerCough}
          onStopTest={handleStopTest}
        />
      )}

      {currentScreen === 'report' && (
        <FinalReport
          totalCoughs={coughCount}
          sessionDurationSec={sessionDurationSec}
          onRestart={handleRestart}
        />
      )}

      {showErrorModal && (
        <ErrorModal
          type={micStatus === 'unsupported' ? 'unsupported' : 'mic'}
          message={errorMessage}
          onRetry={handleRetryPermissions}
          onDismiss={handleDismissModal}
        />
      )}
    </div>
  );
}

export default App;
