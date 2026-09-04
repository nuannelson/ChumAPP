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
