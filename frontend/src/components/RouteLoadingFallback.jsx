import React from 'react';
import './RouteLoadingFallback.css';

const RouteLoadingFallback = () => {
  return (
    <div className="route-loading-stage" role="status" aria-live="polite">
      <div className="route-loading-box">
        <div className="route-spin-gear">
          <svg viewBox="0 0 40 40" width="48" height="48" fill="none">
            <circle
              cx="20"
              cy="20"
              r="15"
              stroke="#FF6500"
              strokeWidth="3.5"
              strokeDasharray="18 8"
              className="gear-ring"
            />
            <circle cx="20" cy="20" r="6" fill="#0A192F" />
          </svg>
        </div>
        <span className="route-loading-text">Loading Workspace...</span>
      </div>
    </div>
  );
};

export default RouteLoadingFallback;
