import React from 'react';
import './ErrorModal.css';

export function ErrorModal({ type = 'mic', message, onRetry, onDismiss }) {
  const isUnsupported = type === 'unsupported';

  return (
    <div className="error-modal-backdrop">
      <div className="error-modal-card">
        <div className="error-icon-box">
          {isUnsupported ? '⚠️' : '🎙️'}
        </div>

        <h3 className="error-title">
          {isUnsupported ? 'Browser Incompatible' : 'Microphone Access Denied'}
        </h3>

        <p className="error-message">
          {message || (isUnsupported
            ? 'Your browser does not support the Web Audio API or MediaDevices needed for acoustic cough telemetry.'
            : 'ChummAPP requires microphone access to detect your acoustic cough spikes in real time. Processing is 100% local — nothing leaves your device.')}
        </p>

        {!isUnsupported && (
          <div className="error-instructions">
            <div>💡 <strong>How to fix:</strong></div>
            <div>1. Click the site settings icon (lock 🔒) in your browser address bar.</div>
            <div>2. Switch <strong>Microphone</strong> to <strong>Allow</strong>.</div>
            <div>3. Click "Retry Permission" below.</div>
          </div>
        )}

        <div className="error-modal-actions">
          {!isUnsupported && (
            <button id="retry-mic-btn" className="btn-retry-perm" onClick={onRetry}>
              RETRY PERMISSION
            </button>
          )}
          <button id="dismiss-error-btn" className="btn-cancel-perm" onClick={onDismiss}>
            BACK TO HOME
          </button>
        </div>
      </div>
    </div>
  );
}
