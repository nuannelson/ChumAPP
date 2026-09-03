import React, { useState } from 'react';
import { Activity, ShieldAlert, Cpu, Mic, Eye, EyeOff, Flame, ArrowRight, Camera } from 'lucide-react';
import { CHUMA_LEVELS } from '../utils/chumaData';
import CameraPreview from './CameraPreview';

export default function LandingPage({ onStartTest }) {
  const [showWebcamPreview, setShowWebcamPreview] = useState(false);

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

        {/* Primary Action Buttons */}
        <div className="hero-cta-wrapper">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button onClick={onStartTest} className="btn-primary-glow group">
              <span className="btn-inner">
                <Activity className="btn-icon animate-pulse" size={22} />
                <span>START CHUMA TEST</span>
                <ArrowRight className="btn-arrow" size={18} />
              </span>
            </button>

            <button
              onClick={() => setShowWebcamPreview(!showWebcamPreview)}
              className="btn-secondary-cam"
              title="Test and preview your webcam before starting"
            >
              <Camera size={18} className="text-red-400" />
              <span>{showWebcamPreview ? 'HIDE CAMERA PREVIEW' : 'PREVIEW WEBCAM'}</span>
            </button>
          </div>

          <span className="cta-caption font-mono mt-2">
            Requires Browser Microphone & Camera Access • 100% Local In-Browser Processing
          </span>
        </div>

        {/* Interactive Camera Preview Panel on Landing Page */}
        {showWebcamPreview && (
          <div className="landing-webcam-box animate-fadeIn">
            <div className="landing-webcam-header">
              <div className="flex items-center gap-2">
                <span className="live-dot"></span>
                <span className="font-mono text-xs text-red-400 font-bold">
                  OPTICAL SENSOR CALIBRATION (LIVE PREVIEW)
                </span>
              </div>
              <button
                onClick={() => setShowWebcamPreview(false)}
                className="text-zinc-500 hover:text-zinc-300 font-mono text-xs"
              >
                CLOSE ✕
              </button>
            </div>
            <div className="landing-camera-embed">
              <CameraPreview isCoughing={false} isCameraActive={true} />
            </div>
            <div className="text-[11px] text-zinc-500 font-mono mt-2 text-center">
              Target your face in the reticle. Involuntary head nods and mouth opening will be measured during coughing.
            </div>
          </div>
        )}
      </div>

      {/* Feature Grid / How It Works */}
      <div className="feature-grid">
        <div className="feature-card">
          <div className="card-icon-wrapper">
            <Mic size={22} className="text-red-400" />
          </div>
          <h3 className="card-title">Acoustic Transient Detection</h3>
          <p className="card-desc">
            High-precision Web Audio FFT spectrum analysis isolates sudden diaphragm convulsions in the 250Hz - 2500Hz band and filters out normal talking.
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
