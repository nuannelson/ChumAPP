import React, { useEffect, useState } from 'react';
import './RoastTicker.css';
import { getRoastForCount } from '../utils/roastQuotes';
import { getChumaLevel } from '../utils/chumaLevels';

export function RoastTicker({ coughCount, lastCoughTime }) {
  const [currentRoast, setCurrentRoast] = useState(() => {
    const level = getChumaLevel(0);
    return getRoastForCount(0, level.id);
  });
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const level = getChumaLevel(coughCount);
    const newRoast = getRoastForCount(coughCount, level.id);
    setIsUpdating(true);
    setCurrentRoast(newRoast);

    const timer = setTimeout(() => setIsUpdating(false), 350);
    return () => clearTimeout(timer);
  }, [coughCount, lastCoughTime]);

  return (
    <div className="roast-ticker-card">
      <div className="roast-header">
        <div className="roast-pill">
          <span className="roast-chili-icon">🌶️</span>
          <span>LIVE BIOMETRIC ROAST STREAM</span>
        </div>
        <div className="roast-language-tag">
          MALAYALAM + ENGLISH SUBTITLES
        </div>
      </div>

      <div className="roast-content-box">
        <div
          id="roast-malayalam-text"
          className={`roast-malayalam-quote malayalam-text ${isUpdating ? 'fade-in' : ''}`}
        >
          "{currentRoast.malayalam}"
        </div>
        <div className="roast-english-sub">
          {currentRoast.english}
        </div>
      </div>
    </div>
  );
}
