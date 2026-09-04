<<<<<<< HEAD
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
=======
import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import TestView from './components/TestView';
import ReportModal from './components/ReportModal';

export default function App() {
  const [viewState, setViewState] = useState('landing'); // 'landing' | 'testing' | 'report'
  const [finalCount, setFinalCount] = useState(0);
  const [testDuration, setTestDuration] = useState(0);

  const handleStartTest = () => {
    setFinalCount(0);
    setTestDuration(0);
    setViewState('testing');
  };

  const handleStopTest = (count, durationSeconds) => {
    setFinalCount(count);
    setTestDuration(durationSeconds);
    setViewState('report');
  };

  const handleRestart = () => {
    setViewState('landing');
  };

  return (
    <div className="app-root">
      <main className="app-main-content">
        {viewState === 'landing' && (
          <LandingPage onStartTest={handleStartTest} />
        )}

        {viewState === 'testing' && (
          <TestView onStopTest={handleStopTest} />
        )}

        {viewState === 'report' && (
          <ReportModal
            coughCount={finalCount}
            testDurationSeconds={testDuration}
            onRestart={handleRestart}
          />
        )}
      </main>

      {/* Global Sarcastic Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <div className="font-mono text-xs text-zinc-500">
            CHUMMAPP🔴 &copy; {new Date().getFullYear()} • 100% USELESS HACKATHON MVP • ZERO MEDICAL DIAGNOSTIC VALUE
          </div>
          <div className="font-mono text-[11px] text-zinc-600">
            POWERED BY OVER-ENGINEERED WEB AUDIO API & LOCAL BIOMETRICS
          </div>
        </div>
      </footer>
    </div>
  );
}
>>>>>>> b70dfce39d9d6fdb4fad12552d1882e6f0f22922
