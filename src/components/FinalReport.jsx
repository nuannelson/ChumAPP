import React, { useState } from 'react';
import './FinalReport.css';
import { getChumaLevel } from '../utils/chumaLevels';
import { getClosingRoast } from '../utils/roastQuotes';

export function FinalReport({ totalCoughs, sessionDurationSec, onRestart }) {
  const [copied, setCopied] = useState(false);
  const finalLevel = getChumaLevel(totalCoughs);
  const closingRoast = getClosingRoast(totalCoughs, finalLevel.id);

  const formatTime = (sec) => {
    const mins = Math.floor(sec / 60);
    const remainingSecs = sec % 60;
    return `${mins}m ${remainingSecs}s`;
  };

  const handleCopy = () => {
    const textToCopy = `🔴 ChummAPP Final Report:
Coughs Detected: ${totalCoughs}
Chuma Level: ${finalLevel.name} (${finalLevel.malayalamName})
Roast: "${closingRoast.malayalam}"
"${closingRoast.english}"
Tested with ChummAPP 🔴`;

    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});
  };

  return (
    <div className="final-report-container">
      <div className="report-card">
        <div className="report-header-seal">
          <div className="report-seal-left">
            <div className="report-beacon" />
            <div>
              <div className="report-title-meta">CHUMMAPP BIO-ACOUSTIC DOSSIER</div>
              <strong style={{ fontSize: '1.1rem' }}>Official Chuma Evaluation</strong>
            </div>
          </div>
          <div className="report-classification-stamp">
            VERIFIED FUTILE
          </div>
        </div>

        <div className="report-main-stats">
          <div className="stat-box">
            <span className="stat-label">TOTAL COUGHS RECORDED</span>
            <span id="final-total-coughs" className="stat-value" style={{ color: '#ff334b' }}>
              {totalCoughs}
            </span>
            <span className="stat-subtext">Acoustic transient spikes</span>
          </div>

          <div className="stat-box">
            <span className="stat-label">FINAL CHUMA LEVEL</span>
            <span id="final-chuma-level" className="stat-value level-name" style={{ color: finalLevel.color }}>
              {finalLevel.name}
            </span>
            <span className="stat-subtext malayalam-text" style={{ color: finalLevel.color }}>
              {finalLevel.malayalamName}
            </span>
          </div>

          <div className="stat-box">
            <span className="stat-label">SESSION DURATION</span>
            <span className="stat-value" style={{ fontSize: '2rem' }}>
              {formatTime(sessionDurationSec)}
            </span>
            <span className="stat-subtext">Active monitoring time</span>
          </div>
        </div>

        <div className="closing-roast-banner">
          <div className="roast-banner-tag">
            <span>🔥 OFFICIAL CLOSING ROAST</span>
          </div>
          <div id="final-closing-roast-malayalam" className="closing-malayalam-text malayalam-text">
            "{closingRoast.malayalam}"
          </div>
          <div className="closing-english-text">
            {closingRoast.english}
          </div>
        </div>

        <div className="report-actions">
          <button id="restart-test-btn" className="btn-restart" onClick={onRestart}>
            <span>🔄</span>
            <span>TEST AGAIN / NEW SESSION</span>
          </button>

          <button id="copy-roast-btn" className="btn-copy-roast" onClick={handleCopy}>
            <span>{copied ? '✅' : '📋'}</span>
            <span>{copied ? 'COPIED TO CLIPBOARD!' : 'SHARE YOUR ROAST'}</span>
          </button>
        </div>

        <div className="report-footer-disclaimer">
          CHUMMAPP v2.0 • INTENTIONALLY USELESS COMEDY SYSTEM • ZERO CLINICAL VALIDITY GUARANTEED
        </div>
      </div>
    </div>
  );
}
