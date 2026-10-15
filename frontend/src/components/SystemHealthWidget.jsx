import React, { useState, useEffect } from 'react';
import { fetchApiHealth, fetchDatabaseHealth } from '../services/api';
import './SystemHealthWidget.css';

const SystemHealthWidget = () => {
  const [apiStatus, setApiStatus] = useState({ loading: true, data: null, error: null });
  const [dbStatus, setDbStatus] = useState({ loading: true, data: null, error: null });
  const [lastChecked, setLastChecked] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const runHealthChecks = async () => {
    setApiStatus(prev => ({ ...prev, loading: true }));
    setDbStatus(prev => ({ ...prev, loading: true }));

    const [apiRes, dbRes] = await Promise.all([
      fetchApiHealth(),
      fetchDatabaseHealth()
    ]);

    setApiStatus({
      loading: false,
      data: apiRes.success ? apiRes.data : null,
      error: !apiRes.success ? apiRes.error : null
    });

    setDbStatus({
      loading: false,
      data: dbRes.success ? dbRes.data : dbRes.data || null,
      error: !dbRes.success ? dbRes.error : null
    });

    setLastChecked(new Date().toLocaleTimeString());
  };

  useEffect(() => {
    runHealthChecks();
  }, []);

  return (
    <div className="health-widget-card">
      <div className="health-widget-header">
        <div className="health-header-title">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          <h3>Full-Stack System Connectivity Monitor</h3>
        </div>
        <div className="health-header-actions">
          {lastChecked && <span className="last-checked">Checked: {lastChecked}</span>}
          <button 
            type="button" 
            className="btn btn-outline health-refresh-btn" 
            onClick={runHealthChecks}
            disabled={apiStatus.loading || dbStatus.loading}
          >
            {apiStatus.loading || dbStatus.loading ? 'Pinging...' : 'Ping Endpoints'}
          </button>
        </div>
      </div>

      <div className="health-status-grid">
        {/* API Server Status */}
        <div className="status-item">
          <div className="status-item-label">Express Backend (GET /api/health)</div>
          <div className="status-item-value">
            {apiStatus.loading ? (
              <span className="status-badge loading">Checking...</span>
            ) : apiStatus.data ? (
              <span className="status-badge online">
                <span className="pulse-indicator" style={{ backgroundColor: 'var(--color-success)' }}></span>
                Online ({apiStatus.data.version}) • Uptime {apiStatus.data.uptime}
              </span>
            ) : (
              <span className="status-badge offline">
                <span className="pulse-indicator" style={{ backgroundColor: 'var(--color-danger)' }}></span>
                Offline ({apiStatus.error})
              </span>
            )}
          </div>
        </div>

        {/* MongoDB Status */}
        <div className="status-item">
          <div className="status-item-label">MongoDB Driver (GET /api/health/db)</div>
          <div className="status-item-value">
            {dbStatus.loading ? (
              <span className="status-badge loading">Checking...</span>
            ) : dbStatus.data?.database?.isConnected ? (
              <span className="status-badge online">
                <span className="pulse-indicator" style={{ backgroundColor: 'var(--color-success)' }}></span>
                Connected ({dbStatus.data.database.name || 'db'})
              </span>
            ) : (
              <span className="status-badge degraded">
                <span className="pulse-indicator" style={{ backgroundColor: 'var(--color-warning)' }}></span>
                {dbStatus.data?.database?.state || 'Disconnected'} (Start mongod to connect)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible raw response */}
      <div className="health-details-toggle">
        <button 
          type="button" 
          className="toggle-link"
          onClick={() => setDetailsOpen(prev => !prev)}
        >
          {detailsOpen ? 'Hide Diagnostics Response JSON ▲' : 'Inspect Raw Health Response JSON ▼'}
        </button>

        {detailsOpen && (
          <div className="health-raw-box fade-in">
            <pre>
              {JSON.stringify({ apiHealth: apiStatus, dbHealth: dbStatus }, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemHealthWidget;
