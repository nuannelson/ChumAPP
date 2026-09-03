import React from 'react';
import { Activity, ShieldAlert, Cpu, Mic, Eye, Flame, ArrowRight } from 'lucide-react';
import { CHUMA_LEVELS } from '../utils/chumaData';

export default function LandingPage({ onStartTest }) {
  return (
    <div className="landing-container">
      {/* Background glow effects */}
      <div className="bg-glow top-glow" />
      <div className="bg-glow bottom-glow" />

      {/* Hero Header */}
      <div className="landing-hero">
        <div className="badge-pill mb-4">
          <span className="badge-dot"></span>
          <span className="font-mono text-xs text-red-300 tracking-wider">
            QUANTUM BIOMETRIC COUGH SURVEILLANCE SYSTEM
          </span>
        </div>

        <h1 className="brand-title">
          ChummAPP<span className="brand-dot">🔴</span>
        </h1>

        <p className="hero-subtitle">
          The world's most over-engineered, computationally expensive, and completely useless
          AI application that counts your coughs and roasts you in Malayalam.
        </p>

        {/* Disclaimer Warning Box */}
        <div className="disclaimer-banner">
          <ShieldAlert className="disclaimer-icon" size={20} />
          <div className="disclaimer-text">
            <strong>OFFICIAL DISCLAIMER:</strong> 0% Medical Diagnostic Accuracy Guaranteed. 100% Sarcasm Guaranteed. Do not show this to your doctor.
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="hero-cta-wrapper">
          <button onClick={onStartTest} className="btn-primary-glow group">
            <span className="btn-inner">
              <Activity className="btn-icon animate-pulse" size={24} />
              <span>START CHUMA TEST</span>
              <ArrowRight className="btn-arrow" size={20} />
            </span>
          </button>
          <span className="cta-caption font-mono">
            Requires Browser Microphone & Camera Access • 100% Local Processing
          </span>
        </div>
      </div>

      {/* Feature Grid / How It Works */}
      <div className="feature-grid">
        <div className="feature-card">
          <div className="card-icon-wrapper">
            <Mic size={22} className="text-red-400" />
          </div>
          <h3 className="card-title">Acoustic Transient Detection</h3>
          <p className="card-desc">
            High-precision Web Audio FFT spectrum analysis isolates sudden diaphragm convulsions in the 250Hz - 2500Hz band.
          </p>
        </div>

        <div className="feature-card">
          <div className="card-icon-wrapper">
            <Eye size={22} className="text-red-400" />
          </div>
          <h3 className="card-title">Biometric Optical HUD</h3>
          <p className="card-desc">
            Cyberpunk facial targeting reticle and fake aerosol trajectory scanner to monitor your respiratory dignity in real time.
          </p>
        </div>

        <div className="feature-card">
          <div className="card-icon-wrapper">
            <Flame size={22} className="text-red-400" />
          </div>
          <h3 className="card-title">Pure Malayalam Roasts</h3>
          <p className="card-desc">
            Every cough triggers brutal Malayalam commentary. From <em>"തുടക്കക്കാരൻ"</em> all the way to <em>"നിങ്ങളുടെ lungs resignation കൊടുത്തു"</em>.
          </p>
        </div>
      </div>

      {/* Chuma Tier System Preview */}
      <div className="tiers-preview-section">
        <div className="tiers-header">
          <Cpu size={16} className="text-red-400" />
          <span className="font-mono text-xs tracking-wider text-zinc-400">
            OFFICIAL CHUMA LEVEL PROGRESSION HIERARCHY
          </span>
        </div>
        <div className="tiers-list">
          {CHUMA_LEVELS.map((level, idx) => (
            <div key={idx} className="tier-badge-chip">
              <span className="tier-range">{level.min}{level.max > 500 ? '+' : `-${level.max}`}</span>
              <span className="tier-name">{level.title}</span>
              <span className="tier-ml">{level.malayalamTitle}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
