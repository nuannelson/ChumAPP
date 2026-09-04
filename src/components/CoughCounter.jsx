import React, { useEffect, useState } from 'react';
import './CoughCounter.css';
import { getChumaLevel, getLevelProgress } from '../utils/chumaLevels';

export function CoughCounter({ coughCount, lastCoughTime }) {
  const [isBumping, setIsBumping] = useState(false);

  // Trigger bounce effect on each cough increment
  useEffect(() => {
    if (lastCoughTime) {
      setIsBumping(true);
      const timer = setTimeout(() => setIsBumping(false), 300);
      return () => clearTimeout(timer);
    }
  }, [lastCoughTime, coughCount]);

  const level = getChumaLevel(coughCount);
  const { progress, remaining, nextLevel } = getLevelProgress(coughCount);

  return (
    <div className={`counter-card ${isBumping ? 'bump' : ''}`}>
      <div className="counter-header-pill">
        <span className="counter-pulse-dot" />
        <span>ACOUSTIC SPIKE TELEMETRY</span>
      </div>

      <div className="counter-number-wrap">
        <span
          id="live-cough-counter-value"
          className={`counter-giant-number ${isBumping ? 'animating' : ''}`}
        >
          {coughCount}
        </span>
        <span className="counter-unit-tag">COUGHS</span>
      </div>

      <div className="level-badge-container">
        <div
          id="live-chuma-level-badge"
          className="level-pill-badge"
          style={{ color: level.color, borderColor: level.color, backgroundColor: `${level.color}15` }}
        >
          <span>{level.name}</span>
        </div>

        <div className="level-malayalam-subtitle malayalam-text">
          {level.malayalamName}
        </div>
      </div>

      <div className="level-progress-wrapper">
        <div className="progress-meta-labels">
          <span>PROGRESS</span>
          <span>
            {nextLevel ? `${remaining} more to ${nextLevel.name}` : 'MAX LEVEL ACHIEVED'}
          </span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${progress}%`, backgroundColor: level.color, color: level.color }}
          />
        </div>
      </div>
    </div>
  );
}
