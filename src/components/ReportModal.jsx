import React, { useState } from 'react';
import { Award, AlertTriangle, RotateCcw, Share2, Check, Flame, ShieldAlert, Cpu, HeartPulse } from 'lucide-react';
import { getChumaLevel, getRoastComment, generateBogusMetrics } from '../utils/chumaData';

export default function ReportModal({ coughCount, testDurationSeconds, onRestart }) {
  const [copied, setCopied] = useState(false);

  const level = getChumaLevel(coughCount);
  const roast = getRoastComment(coughCount);
  const metrics = generateBogusMetrics(coughCount, testDurationSeconds);

  const handleShare = () => {
    const text = `🔴 ChummAPP Final Report:
I coughed ${coughCount} times!
Level: ${level.title} (${level.malayalamTitle})
Roast: "${roast.ml}"
Threat Level: ${level.threatLevel}
Try ChummAPP now!`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="report-container">
      {/* Background radial effects */}
      <div className="report-card">
        {/* Header Ribbon */}
        <div className="report-header">
          <div className="flex items-center gap-2">
            <span className="report-dot"></span>
            <span className="font-mono text-xs tracking-widest text-red-400">
              OFFICIAL BIOMETRIC AUDIT REPORT #CHUMA-{Math.floor(1000 + Math.random() * 9000)}
            </span>
          </div>
          <span className="font-mono text-[11px] text-zinc-500">
            DURATION: {metrics.durationFormatted}
          </span>
        </div>

        {/* Big Main Result */}
        <div className="report-main-section">
          <div className="cough-count-badge-wrap">
            <div className="report-count-number">{coughCount}</div>
            <div className="report-count-label">TOTAL COUGHS REGISTERED</div>
          </div>

          <div className="level-award-box" style={{ borderColor: level.color }}>
            <div className="award-tag font-mono text-xs" style={{ color: level.color }}>
              <Award size={16} className="inline mr-1" />
              OFFICIAL CHUMA RANK
            </div>
            <h2 className="award-title" style={{ color: level.color }}>
              {level.title}
            </h2>
            <div className="award-ml-title">
              {level.malayalamTitle}
            </div>
            <p className="award-desc">
              {level.description}
            </p>
          </div>
        </div>

        {/* Featured Malayalam Roast */}
        <div className="roast-highlight-box">
          <div className="roast-header-bar">
            <Flame size={18} className="text-red-400" />
            <span className="font-mono text-xs text-red-300 font-semibold tracking-wider">
              AI MALAYALAM ROAST VERDICT
            </span>
          </div>
          <blockquote className="roast-malayalam-quote">
            "{roast.ml}"
          </blockquote>
          <p className="roast-english-sub">
            Translation: "{roast.en}"
          </p>
        </div>

        {/* Bogus AI Telemetry Grid */}
        <div className="metrics-grid">
          <div className="metric-box">
            <div className="metric-label">
              <HeartPulse size={14} className="text-red-400" />
              <span>LUNG RESIGNATION RISK</span>
            </div>
            <div className="metric-val text-red-400">{metrics.lungResignationRisk}</div>
          </div>

          <div className="metric-box">
            <div className="metric-label">
              <AlertTriangle size={14} className="text-amber-400" />
              <span>AEROSOL CONE VELOCITY</span>
            </div>
            <div className="metric-val text-amber-300">{metrics.aerosolVelocity}</div>
          </div>

          <div className="metric-box">
            <div className="metric-label">
              <Cpu size={14} className="text-blue-400" />
              <span>UNNECESSARY AI COMPUTE</span>
            </div>
            <div className="metric-val text-blue-300">{metrics.unnecessaryComputePower}</div>
          </div>

          <div className="metric-box">
            <div className="metric-label">
              <ShieldAlert size={14} className="text-emerald-400" />
              <span>CALORIES WASTED</span>
            </div>
            <div className="metric-val text-emerald-300">{metrics.wastedCalories}</div>
          </div>
        </div>

        {/* Sarcastic Footer Message */}
        <div className="report-mock-verdict">
          "Congratulations. You have achieved absolutely nothing."
        </div>

        {/* Actions */}
        <div className="report-actions">
          <button onClick={onRestart} className="btn-restart">
            <RotateCcw size={18} />
            <span>TEST AGAIN (RE-CHUMA)</span>
          </button>

          <button onClick={handleShare} className="btn-share">
            {copied ? <Check size={18} className="text-emerald-400" /> : <Share2 size={18} />}
            <span>{copied ? 'COPIED TO CLIPBOARD!' : 'SHARE ROAST'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
