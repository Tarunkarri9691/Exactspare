import React, { useState, useEffect } from 'react';
import AdminNav from '../components/AdminNav';
import { fetchAdminAuditLogs } from '../services/api';
import './AdminAuditLogsPage.css';

const AdminAuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [error, setError] = useState('');

  // Selected Log for Metadata Inspection Modal
  const [selectedLog, setSelectedLog] = useState(null);

  const loadLogs = async (page = 1) => {
    setLoading(true);
    setError('');
    const params = { page, limit: 12 };
    if (actionFilter) params.action = actionFilter;
    if (entityFilter) params.entityType = entityFilter;
    if (fromDate) params.from = fromDate;
    if (toDate) params.to = toDate;

    const res = await fetchAdminAuditLogs(params);
    if (res.success) {
      setLogs(res.data);
      setPagination(res.pagination);
    } else {
      setError(res.error || 'Failed to fetch audit log trail');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLogs(1);
  }, [actionFilter, entityFilter]);

  const handleApplyFilter = (e) => {
    e.preventDefault();
    loadLogs(1);
  };

  const handleResetFilter = () => {
    setActionFilter('');
    setEntityFilter('');
    setFromDate('');
    setToDate('');
  };

  return (
    <div className="admin-audit-page">
      <AdminNav />

      <div className="container admin-audit-container">
        {/* Header */}
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">Platform Audit Trail & Security Logs</h1>
            <p className="admin-page-subtitle">
              Immutable, chronological records of administrative decisions, compliance actions, and account state modifications.
            </p>
          </div>
          <button className="btn btn-outline" onClick={() => loadLogs(pagination.page)} disabled={loading}>
            🔄 Refresh Audit Logs
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="admin-alert alert-error">
            <span>⚠️</span> {error}
            <button className="alert-close" onClick={() => setError('')}>✕</button>
          </div>
        )}

        {/* Filters and Date Range Bar */}
        <div className="admin-filter-bar">
          <form className="audit-filter-form" onSubmit={handleApplyFilter}>
            <div className="filter-group">
              <label>Entity Type</label>
              <select
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
                className="admin-select"
              >
                <option value="">All Entities</option>
                <option value="SHOP">Shop</option>
                <option value="USER">User Account</option>
                <option value="SPARE_PART">Spare Part</option>
                <option value="REVIEW">Review</option>
                <option value="SHOP_APPLICATION">Shop Application</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Action</label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="admin-select"
              >
                <option value="">All Actions</option>
                <option value="SHOP_ACTIVATED">Shop Activated</option>
                <option value="SHOP_DEACTIVATED">Shop Deactivated</option>
                <option value="USER_SUSPENDED">User Suspended</option>
                <option value="USER_REACTIVATED">User Reactivated</option>
                <option value="PART_MODERATED">Part Moderated</option>
                <option value="REVIEW_MODERATED">Review Moderated</option>
                <option value="APPLICATION_APPROVED">Application Approved</option>
                <option value="APPLICATION_REJECTED">Application Rejected</option>
              </select>
            </div>

            <div className="filter-group">
              <label>From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="admin-date-input"
              />
            </div>

            <div className="filter-group">
              <label>To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="admin-date-input"
              />
            </div>

            <div className="filter-actions-inline">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                Filter
              </button>
              {(fromDate || toDate || actionFilter || entityFilter) && (
                <button type="button" className="btn btn-ghost" onClick={handleResetFilter}>
                  Reset
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Audit Log Table Card */}
        <div className="admin-card table-card">
          {loading ? (
            <div className="admin-loading-state">
              <span className="spinner">⌛</span> Loading security audit entries...
            </div>
          ) : logs.length === 0 ? (
            <div className="admin-empty-state">
              <span>🛡️</span>
              <h3>No Audit Entries Found</h3>
              <p>No audit log records match the selected criteria.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Administrator</th>
                    <th>Action</th>
                    <th>Entity Type</th>
                    <th>Target ID</th>
                    <th>Reason / Justification</th>
                    <th className="text-right">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log._id}>
                      <td>
                        <div className="timestamp-cell">
                          <strong>
                            {new Date(log.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </strong>
                          <span className="subtext">
                            {new Date(log.createdAt).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-actor-cell">
                          <strong>{log.adminId?.name || 'Administrator'}</strong>
                          <span className="subtext">{log.adminId?.email || '—'}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`audit-action-tag action-${(log.action || '').toLowerCase()}`}>
                          {log.action?.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <span className="entity-tag">{log.entityType}</span>
                      </td>
                      <td>
                        <code className="entity-id-code">
                          {log.entityId ? `${String(log.entityId).substring(0, 10)}...` : '—'}
                        </code>
                      </td>
                      <td className="reason-cell">
                        <span className="reason-text" title={log.reason}>
                          {log.reason || 'No reason provided'}
                        </span>
                      </td>
                      <td className="text-right">
                        <button
                          className="btn btn-sm btn-ghost inspect-btn"
                          onClick={() => setSelectedLog(log)}
                        >
                          👁️ Meta
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="admin-pagination">
              <span className="pagination-info">
                Showing page {pagination.page} of {pagination.pages} ({pagination.total} total audit records)
              </span>
              <div className="pagination-controls">
                <button
                  className="btn btn-sm btn-ghost"
                  disabled={pagination.page <= 1}
                  onClick={() => loadLogs(pagination.page - 1)}
                >
                  ◀ Prev
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => loadLogs(pagination.page + 1)}
                >
                  Next ▶
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Audit Log Metadata Modal */}
        {selectedLog && (
          <div className="modal-backdrop" onClick={() => setSelectedLog(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>🛡️ Audit Record: {selectedLog.action}</h3>
                <button className="modal-close-btn" onClick={() => setSelectedLog(null)}>✕</button>
              </div>

              <div className="modal-body">
                <div className="inspect-meta-grid">
                  <div className="meta-item">
                    <span className="meta-lbl">Admin</span>
                    <span className="meta-val">
                      {selectedLog.adminId?.name} ({selectedLog.adminId?.email})
                    </span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-lbl">Timestamp</span>
                    <span className="meta-val">
                      {new Date(selectedLog.createdAt).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-lbl">Entity Type</span>
                    <span className="meta-val">{selectedLog.entityType}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-lbl">Target ID</span>
                    <span className="meta-val">
                      <code>{selectedLog.entityId}</code>
                    </span>
                  </div>
                  <div className="meta-item full-width">
                    <span className="meta-lbl">Reason / Context</span>
                    <span className="meta-val">{selectedLog.reason || 'None provided'}</span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="meta-lbl">Security Metadata Payload</label>
                  <pre className="audit-meta-json">
                    {JSON.stringify(selectedLog.metadata || {}, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setSelectedLog(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAuditLogsPage;
