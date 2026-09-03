import React from 'react';
import './LandingPage.css';
import { CHUMA_LEVELS } from '../utils/chumaLevels';

export function LandingPage({ onStartTest, isCheckingPermissions }) {
  return (
    <div className="landing-container">
      <header className="landing-header">
        <div className="brand-logo">
          <div className="beacon-dot" />
          <h1 className="brand-title">
            Chumm<span className="red-text">APP</span> 🔴
          </h1>
        </div>

        <div className="system-status-pill">
          <span className="blink-dot" />
          <span>ACOUSTIC RADAR: STANDBY</span>
        </div>
      </header>

      <main className="landing-hero">
        <div className="hero-pill-badge">
          <span>⚡ ADVANCED CHUMA DETECTION SYSTEM</span>
          <span>•</span>
          <span>v2.0 HACKATHON MVP</span>
        </div>

        <h2 className="hero-title">
          The World’s Most <br />
          <span className="glow-red">Over-Engineered</span> Cough Counter.
        </h2>

        <p className="hero-subtitle">
          ChummAPP listens intently to every cough, runs biometric acoustic heuristics, assigns you an authoritative Chuma Level, and serves roasted Malayalam commentary.
        </p>

        <div className="hero-malayalam-highlight malayalam-text">
          "ചുമയാണോ നിങ്ങളുടെ മെയിൻ ഹോബി? വരൂ… അളന്നു നോക്കാം!"
        </div>

        <div className="cta-group">
          <button
            id="start-chuma-test-btn"
            className="btn-start-chuma"
            onClick={onStartTest}
            disabled={isCheckingPermissions}
          >
            <span className="btn-beacon" />
            <span>{isCheckingPermissions ? 'INITIALIZING SENSORS...' : 'START CHUMA TEST'}</span>
          </button>

          <div className="permission-clarity-note">
            <span>🎙️ Requires mic (for audio analysis) + 📷 Camera (for dramatic cosmetic effect)</span>
          </div>
        </div>
      </main>

      {/* Chuma Levels strip preview */}
      <section className="levels-preview-strip">
        <div className="strip-label">
          <span>Official Respiratory Rank Classifications</span>
          <span>Heuristic Hierarchy</span>
        </div>
        <div className="level-badges-row">
          {CHUMA_LEVELS.map(lvl => (
            <div key={lvl.id} className="level-badge-item" style={{ borderLeft: `3px solid ${lvl.color}` }}>
              <span className="range">{lvl.min}–{lvl.max === Infinity ? '51+' : lvl.max} Coughs</span>
              <span className="name" style={{ color: lvl.color }}>{lvl.name}</span>
              <span className="malayalam">{lvl.malayalamName}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Feature cards highlighting the joke & tech */}
      <section className="tech-spec-grid">
        <div className="spec-card">
          <div className="spec-card-header">
            <span className="spec-icon">🎙️</span>
            <span className="spec-tag">WEB AUDIO API</span>
          </div>
          <h3>Acoustic Spike Detection</h3>
          <p>Real-time RMS time-domain transient analysis detects sudden bronchial explosive events while ignoring sustained speech.</p>
        </div>

        <div className="spec-card">
          <div className="spec-card-header">
            <span className="spec-icon">🎭</span>
            <span className="spec-tag">100% COSMETIC</span>
          </div>
          <h3>Dramatic HUD Preview</h3>
          <p>Camera feed with biometric targeting overlays provides intense theatrical ambiance without running any computer vision.</p>
        </div>

        <div className="spec-card">
          <div className="spec-card-header">
            <span className="spec-icon">🌶️</span>
            <span className="spec-tag">PURE MALAYALAM</span>
          </div>
          <h3>Savage Roast Engine</h3>
          <p>Authentic Malayalam comedy commentary reacts to each cough in real time. Your lungs will be judged mercilessly.</p>
        </div>
      </section>

      <footer className="landing-footer">
        <p>
          ⚠️ <strong>SATIRE / ENTERTAINMENT ONLY:</strong> ChummAPP is intentionally useless comedy software. It does not provide medical diagnoses, clinical advice, or any actual utility whatsoever. Keep calm and drink Chukku Kaapi.
        </p>
      </footer>
    </div>
  );
}
