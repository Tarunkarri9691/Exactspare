import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AdminNav from '../components/AdminNav';
import {
  fetchTrustSummaryApi,
  fetchTrustCasesApi,
  fetchTrustCaseDetailsApi,
  updateTrustCaseStatusApi,
  executeTrustActionApi,
  generateAiAdvisoryApi,
  runTrustScanApi
} from '../services/api';
import './AdminTrustSafetyPage.css';

const AdminTrustSafetyPage = () => {
  const [summary, setSummary] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [targetTypeFilter, setTargetTypeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });

  // Inspection Modal & Selected Case
  const [selectedCase, setSelectedCase] = useState(null);
  const [caseLoading, setCaseLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [advisoryLoading, setAdvisoryLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  // Status Change Form
  const [statusChangeValue, setStatusChangeValue] = useState('');
  const [statusChangeReason, setStatusChangeReason] = useState('');
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  // Confirmation Dialog for Consequential Actions
  const [confirmDialog, setConfirmDialog] = useState(null); // { action, title, description, isConsequential }
  const [confirmReason, setConfirmReason] = useState('');
  const [confirmedChecked, setConfirmedChecked] = useState(false);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);

  // Fetch Summary
  const loadSummary = useCallback(async () => {
    try {
      const res = await fetchTrustSummaryApi();
      if (res.success && res.data) {
        setSummary(res.data);
      }
    } catch (err) {
      console.error('Failed to load trust summary:', err);
    }
  }, []);

  // Fetch Cases
  const loadCases = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError('');
      const params = {
        page,
        limit: 20
      };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (severityFilter !== 'ALL') params.severity = severityFilter;
      if (targetTypeFilter !== 'ALL') params.targetType = targetTypeFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await fetchTrustCasesApi(params);

      if (!res.success) {
        throw new Error(res.error || 'Failed to fetch trust cases.');
      }

      setCases(res.data?.cases || []);
      setPagination(res.data?.pagination || { page: 1, limit: 20, total: 0, pages: 1 });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter, targetTypeFilter, searchQuery]);

  useEffect(() => {
    loadSummary();
    loadCases(1);
  }, [loadSummary, loadCases]);

  // Open & Fetch Single Case Details
  const handleOpenCase = async (caseId) => {
    try {
      setCaseLoading(true);
      setActionFeedback(null);
      const res = await fetchTrustCaseDetailsApi(caseId);
      if (res.success && res.data?.trustCase) {
        setSelectedCase(res.data.trustCase);
        setStatusChangeValue(res.data.trustCase.status);
      } else {
        throw new Error(res.error || 'Error loading case details.');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setCaseLoading(false);
    }
  };

  // Close Inspection Modal
  const handleCloseCase = () => {
    setSelectedCase(null);
    setActionFeedback(null);
    setStatusChangeReason('');
    setConfirmDialog(null);
  };

  // Run Platform Trust Scan
  const handleRunScan = async () => {
    try {
      setScanLoading(true);
      setScanResult(null);
      const res = await runTrustScanApi();
      if (res.success && res.data?.results) {
        setScanResult(res.data.results);
        loadSummary();
        loadCases(1);
      } else {
        throw new Error(res.error || 'Scan failed.');
      }
    } catch (err) {
      alert(`Trust scan error: ${err.message}`);
    } finally {
      setScanLoading(false);
    }
  };

  // Status Change Submit
  const handleStatusChangeSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCase) return;
    try {
      setStatusSubmitting(true);
      setActionFeedback(null);
      const res = await updateTrustCaseStatusApi(selectedCase._id, {
        status: statusChangeValue,
        reason: statusChangeReason.trim() || undefined
      });
      if (!res.success) throw new Error(res.error || 'Failed to update status.');

      setActionFeedback({ type: 'success', text: `Status updated to ${statusChangeValue}.` });
      setStatusChangeReason('');
      handleOpenCase(selectedCase._id);
      loadSummary();
      loadCases(pagination.page);
    } catch (err) {
      setActionFeedback({ type: 'error', text: err.message });
    } finally {
      setStatusSubmitting(false);
    }
  };

  // Generate / Refresh AI Advisory
  const handleGenerateAdvisory = async () => {
    if (!selectedCase) return;
    try {
      setAdvisoryLoading(true);
      setActionFeedback(null);
      const res = await generateAiAdvisoryApi(selectedCase._id);
      if (!res.success) throw new Error(res.error || 'Failed to generate advisory.');

      setActionFeedback({ type: 'success', text: 'Advisory analysis updated successfully.' });
      handleOpenCase(selectedCase._id);
    } catch (err) {
      setActionFeedback({ type: 'error', text: err.message });
    } finally {
      setAdvisoryLoading(false);
    }
  };

  // Prompt Confirmation Modal for an Action
  const promptAction = (action, isConsequential, title, description) => {
    setConfirmReason('');
    setConfirmedChecked(false);
    setConfirmDialog({
      action,
      isConsequential,
      title,
      description
    });
  };

  // Execute Confirmed Administrative Action
  const handleExecuteConfirmedAction = async (e) => {
    e.preventDefault();
    if (!selectedCase || !confirmDialog) return;

    if (!confirmReason.trim() || confirmReason.trim().length < 5) {
      alert('A justification reason of at least 5 characters is required.');
      return;
    }

    if (confirmDialog.isConsequential && !confirmedChecked) {
      alert('You must check the confirmation box to proceed with consequential actions.');
      return;
    }

    try {
      setConfirmSubmitting(true);
      const res = await executeTrustActionApi(selectedCase._id, {
        action: confirmDialog.action,
        reason: confirmReason.trim(),
        confirmed: confirmDialog.isConsequential ? confirmedChecked : true
      });
      if (!res.success) throw new Error(res.error || 'Action execution failed.');

      setConfirmDialog(null);
      setActionFeedback({ type: 'success', text: res.message || 'Action executed successfully.' });
      handleOpenCase(selectedCase._id);
      loadSummary();
      loadCases(pagination.page);
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setConfirmSubmitting(false);
    }
  };

  return (
    <div className="admin-trust-page-root">
      <AdminNav />

      <div className="container admin-trust-container">
        {/* Page Header */}
        <div className="admin-trust-header">
          <div>
            <div className="trust-badge-row">
              <span className="badge badge-navy">Platform Governance</span>
              <span className="badge badge-purple">Module 17 Active</span>
            </div>
            <h1 className="admin-trust-title">AI Fraud Detection & Marketplace Trust</h1>
            <p className="admin-trust-subtitle">
              Heuristic anomaly detection, customer complaints, and explainable AI advisory assistance.
            </p>
          </div>

          <div className="admin-trust-header-actions">
            <button
              type="button"
              className="btn btn-primary run-scan-btn"
              onClick={handleRunScan}
              disabled={scanLoading}
            >
              {scanLoading ? (
                <>
                  <span className="scan-spinner">⚙️</span> Scanning Platform...
                </>
              ) : (
                <>
                  <span>⚡</span> Run Trust Engine Scan
                </>
              )}
            </button>
          </div>
        </div>

        {/* Scan Results Notice */}
        {scanResult && (
          <div className="trust-scan-alert">
            <div className="scan-alert-icon">✓</div>
            <div className="scan-alert-content">
              <h4>Trust Scan Completed</h4>
              <p>
                Scanned {scanResult.listingsScanned} active listings ({scanResult.listingCasesCreatedOrUpdated} flagged/updated) and {scanResult.shopsScanned} approved shops ({scanResult.shopCasesCreatedOrUpdated} flagged/updated).
              </p>
            </div>
            <button type="button" className="scan-alert-close" onClick={() => setScanResult(null)}>✕</button>
          </div>
        )}

        {/* KPI Summary Cards */}
        {summary && (
          <div className="trust-kpi-grid">
            <div className="trust-kpi-card">
              <div className="kpi-icon-wrap navy">🛡️</div>
              <div className="kpi-info">
                <span className="kpi-label">Total Trust Cases</span>
                <span className="kpi-num">{summary.totalCases}</span>
              </div>
            </div>

            <div className="trust-kpi-card highlight-card">
              <div className="kpi-icon-wrap orange">⚠️</div>
              <div className="kpi-info">
                <span className="kpi-label">Open / Action Required</span>
                <span className="kpi-num">
                  {(summary.statusCounts?.OPEN || 0) + (summary.statusCounts?.ACTION_REQUIRED || 0)}
                </span>
              </div>
            </div>

            <div className="trust-kpi-card">
              <div className="kpi-icon-wrap red">🚩</div>
              <div className="kpi-info">
                <span className="kpi-label">Customer Reports</span>
                <span className="kpi-num">{summary.totalReports}</span>
              </div>
            </div>

            <div className="trust-kpi-card">
              <div className="kpi-icon-wrap purple">🚫</div>
              <div className="kpi-info">
                <span className="kpi-label">Flagged / Moderated Listings</span>
                <span className="kpi-num">{summary.flaggedListingsCount}</span>
              </div>
            </div>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="trust-toolbar">
          <div className="trust-status-tabs">
            {['ALL', 'OPEN', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'RESOLVED', 'DISMISSED'].map((st) => (
              <button
                key={st}
                type="button"
                className={`trust-tab-btn ${statusFilter === st ? 'active' : ''}`}
                onClick={() => setStatusFilter(st)}
              >
                {st.replace('_', ' ')}
                {summary?.statusCounts && summary.statusCounts[st] !== undefined && (
                  <span className="tab-count-bubble">{summary.statusCounts[st]}</span>
                )}
              </button>
            ))}
          </div>

          <div className="trust-filter-row">
            <div className="filter-select-group">
              <label>Severity:</label>
              <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            <div className="filter-select-group">
              <label>Target:</label>
              <select value={targetTypeFilter} onChange={(e) => setTargetTypeFilter(e.target.value)}>
                <option value="ALL">All Targets</option>
                <option value="PRODUCT">Products / Listings</option>
                <option value="SHOP">Shops</option>
              </select>
            </div>

            <div className="filter-search-group">
              <input
                type="text"
                placeholder="Search by case #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Case List / Table */}
        <div className="trust-cases-card">
          {loading ? (
            <div className="trust-cases-loading">
              <div className="spin-cog">⚙️</div>
              <p>Loading marketplace trust cases...</p>
            </div>
          ) : error ? (
            <div className="trust-error-box">
              <p>{error}</p>
              <button type="button" className="btn btn-outline" onClick={() => loadCases(1)}>
                Retry
              </button>
            </div>
          ) : cases.length === 0 ? (
            <div className="trust-empty-box">
              <span className="empty-icon">🛡️</span>
              <h3>No Trust Cases Found</h3>
              <p>No active trust or fraud signals match the selected filters.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="trust-table">
                <thead>
                  <tr>
                    <th>Case #</th>
                    <th>Target Entity</th>
                    <th>Type</th>
                    <th>Severity</th>
                    <th>Signals & Complaints</th>
                    <th>Status</th>
                    <th>Detected</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => {
                    const isProduct = c.targetType === 'PRODUCT';
                    const targetName = isProduct
                      ? c.productId?.partName || 'Unknown Product'
                      : c.shopId?.name || 'Unknown Shop';
                    const targetSub = isProduct
                      ? `Shop: ${c.shopId?.name || 'N/A'} | SKU: ${c.productId?.partNumber || 'N/A'}`
                      : `Category: ${c.shopId?.category || 'N/A'} | ${c.shopId?.address?.city || ''}`;

                    return (
                      <tr key={c._id} className={`case-row status-${c.status.toLowerCase()}`}>
                        <td className="case-num-cell">
                          <strong>{c.caseNumber}</strong>
                        </td>
                        <td className="case-target-cell">
                          <span className="target-type-icon">{isProduct ? '⚙️' : '🏬'}</span>
                          <div>
                            <div className="target-title">{targetName}</div>
                            <div className="target-meta">{targetSub}</div>
                          </div>
                        </td>
                        <td>
                          <span className="case-type-pill">{c.caseType.replace(/_/g, ' ')}</span>
                        </td>
                        <td>
                          <span className={`severity-badge sev-${c.severity.toLowerCase()}`}>
                            {c.severity}
                          </span>
                        </td>
                        <td className="signals-cell">
                          <span className="signal-count-badge" title="Automated rule signals">
                            ⚡ {c.signals?.length || 0} signals
                          </span>
                          {c.reportCount > 0 && (
                            <span className="report-count-badge" title="Customer reports filed">
                              🚩 {c.reportCount} reports
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`status-pill status-${c.status.toLowerCase()}`}>
                            {c.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="date-cell">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm inspect-btn"
                            onClick={() => handleOpenCase(c._id)}
                          >
                            Inspect Case →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="trust-pagination">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={pagination.page <= 1}
                onClick={() => loadCases(pagination.page - 1)}
              >
                ← Previous
              </button>
              <span className="page-indicator">
                Page {pagination.page} of {pagination.pages} ({pagination.total} cases)
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={pagination.page >= pagination.pages}
                onClick={() => loadCases(pagination.page + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {/* Detailed Case Inspection Drawer / Modal */}
        {selectedCase && (
          <div className="case-modal-overlay" onClick={handleCloseCase}>
            <div className="case-modal-drawer" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="case-drawer-header">
                <div>
                  <div className="case-drawer-breadcrumbs">
                    <span>Marketplace Trust & Safety</span>
                    <span>/</span>
                    <span>Case {selectedCase.caseNumber}</span>
                  </div>
                  <h2 className="case-drawer-title">
                    {selectedCase.targetType === 'PRODUCT' ? 'Listing Anomaly Review' : 'Shop Trust Review'}
                  </h2>
                </div>

                <div className="drawer-header-right">
                  <span className={`status-pill status-${selectedCase.status.toLowerCase()}`}>
                    {selectedCase.status.replace(/_/g, ' ')}
                  </span>
                  <button type="button" className="drawer-close-btn" onClick={handleCloseCase}>
                    ✕
                  </button>
                </div>
              </div>

              {/* Drawer Body */}
              <div className="case-drawer-body">
                {actionFeedback && (
                  <div className={`drawer-feedback-alert ${actionFeedback.type}`}>
                    {actionFeedback.type === 'success' ? '✓ ' : '⚠ '}
                    {actionFeedback.text}
                  </div>
                )}

                {/* Target Entity Card */}
                <div className="drawer-section target-summary-card">
                  <div className="target-card-header">
                    <span className="target-icon-big">
                      {selectedCase.targetType === 'PRODUCT' ? '⚙️' : '🏬'}
                    </span>
                    <div className="target-card-info">
                      <span className="badge badge-navy">{selectedCase.targetType}</span>
                      <h3>
                        {selectedCase.targetType === 'PRODUCT'
                          ? selectedCase.productId?.partName || 'Product Listing'
                          : selectedCase.shopId?.name || 'Shop Storefront'}
                      </h3>
                      {selectedCase.targetType === 'PRODUCT' && selectedCase.productId && (
                        <div className="target-key-specs">
                          <span><strong>Part #:</strong> {selectedCase.productId.partNumber}</span>
                          <span><strong>Price:</strong> ₹{selectedCase.productId.price?.toFixed(2)}</span>
                          <span><strong>Condition:</strong> {selectedCase.productId.condition}</span>
                          <span><strong>Category:</strong> {selectedCase.productId.category}</span>
                          <Link to={`/parts/${selectedCase.productId._id}`} target="_blank" className="view-live-link">
                            View Live Listing ↗
                          </Link>
                        </div>
                      )}
                      {selectedCase.targetType === 'SHOP' && selectedCase.shopId && (
                        <div className="target-key-specs">
                          <span><strong>Shop Name:</strong> {selectedCase.shopId.name}</span>
                          <span><strong>Category:</strong> {selectedCase.shopId.category}</span>
                          <span><strong>City:</strong> {selectedCase.shopId.address?.city}</span>
                          <Link to={`/shops/${selectedCase.shopId._id}`} target="_blank" className="view-live-link">
                            View Live Storefront ↗
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* AI Advisory Analysis Box */}
                <div className="drawer-section ai-advisory-box">
                  <div className="advisory-box-header">
                    <div className="advisory-title-group">
                      <span className="ai-sparkle-icon">
                        {selectedCase.aiAdvisory?.isAiGenerated ? '🤖' : '⚙️'}
                      </span>
                      <div>
                        <h4>
                          {selectedCase.aiAdvisory?.isAiGenerated
                            ? 'Advisory AI Analysis'
                            : 'Explainable Rule Engine Advisory'}
                        </h4>
                        <span className="advisory-provider-tag">
                          Provider: {selectedCase.aiAdvisory?.provider || 'rule_based_engine'} • Generated:{' '}
                          {selectedCase.aiAdvisory?.generatedAt
                            ? new Date(selectedCase.aiAdvisory.generatedAt).toLocaleTimeString()
                            : 'On Demand'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-outline btn-sm refresh-advisory-btn"
                      onClick={handleGenerateAdvisory}
                      disabled={advisoryLoading}
                    >
                      {advisoryLoading ? 'Analyzing...' : '🔄 Refresh Advisory'}
                    </button>
                  </div>

                  <p className="advisory-summary-text">
                    {selectedCase.aiAdvisory?.summary ||
                      'No advisory summary generated yet. Click "Refresh Advisory" to synthesize evidence.'}
                  </p>

                  {selectedCase.aiAdvisory?.inconsistencies?.length > 0 && (
                    <div className="advisory-sub-block">
                      <h5>Identified Observations & Inconsistencies</h5>
                      <ul>
                        {selectedCase.aiAdvisory.inconsistencies.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedCase.aiAdvisory?.suggestedActions?.length > 0 && (
                    <div className="advisory-sub-block">
                      <h5>Recommended Administrative Steps</h5>
                      <ul>
                        {selectedCase.aiAdvisory.suggestedActions.map((action, idx) => (
                          <li key={idx}>{action}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="advisory-disclaimer">
                    <span>ℹ️</span>
                    <small>
                      AI and rule outputs are advisory briefings only. Administrative decisions require human review and authorization. Consequential actions require explicit confirmation.
                    </small>
                  </div>
                </div>

                {/* Explainable Signals Triggered */}
                <div className="drawer-section">
                  <h4 className="section-title">
                    ⚡ Triggered Detection Signals ({selectedCase.signals?.length || 0})
                  </h4>

                  {selectedCase.signals && selectedCase.signals.length > 0 ? (
                    <div className="signals-grid">
                      {selectedCase.signals.map((sig, idx) => (
                        <div key={idx} className={`signal-card sev-${sig.severity.toLowerCase()}`}>
                          <div className="signal-card-top">
                            <span className="signal-name">{sig.name}</span>
                            <span className={`signal-sev-tag sev-${sig.severity.toLowerCase()}`}>
                              {sig.severity}
                            </span>
                          </div>
                          <p className="signal-reason">{sig.reason}</p>
                          <span className="signal-rule-id">Rule: {sig.ruleId}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-items-text">No automated rule signals triggered.</p>
                  )}
                </div>

                {/* Customer Complaints Filed */}
                <div className="drawer-section">
                  <h4 className="section-title">
                    🚩 Customer Reports Filed ({selectedCase.reportIds?.length || 0})
                  </h4>

                  {selectedCase.reportIds && selectedCase.reportIds.length > 0 ? (
                    <div className="reports-list">
                      {selectedCase.reportIds.map((rep) => (
                        <div key={rep._id} className="report-card">
                          <div className="report-card-top">
                            <span className="badge badge-orange">{rep.category}</span>
                            <span className="report-date">{new Date(rep.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="report-desc-text">"{rep.description}"</p>
                          <div className="report-reporter-meta">
                            <span>Reporter: {rep.reporterId?.name || 'Customer'} ({rep.reporterId?.email || 'Confidential'})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-items-text">No customer complaints filed for this target.</p>
                  )}
                </div>

                {/* Action Center */}
                <div className="drawer-section action-center-card">
                  <h4 className="section-title">⚖️ Administrative Action Center</h4>
                  <p className="section-sub">
                    Choose an authorized action. Consequential actions like de-listing or suspending require 2-step confirmation with documented justification.
                  </p>

                  <div className="action-buttons-row">
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() =>
                        promptAction(
                          'REQUEST_CORRECTION',
                          false,
                          'Request Seller Correction',
                          'Send an official notice to the shop owner requesting correction of vehicle compatibility, part number, or price specifications.'
                        )
                      }
                    >
                      <span>📝</span> Request Correction
                    </button>

                    {selectedCase.targetType === 'PRODUCT' && (
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() =>
                          promptAction(
                            'FLAG_LISTING',
                            false,
                            'Flag Listing for Review',
                            'Mark this spare part as moderated in catalog queries pending merchant verification.'
                          )
                        }
                      >
                        <span>🚩</span> Flag Listing
                      </button>
                    )}

                    {selectedCase.targetType === 'PRODUCT' && (
                      <button
                        type="button"
                        className="btn btn-danger-action"
                        onClick={() =>
                          promptAction(
                            'DELIST_PRODUCT',
                            true,
                            'De-list Spare Part from Public Marketplace',
                            'Un-publish this part listing immediately so it cannot be found or purchased by buyers.'
                          )
                        }
                      >
                        <span>🚫</span> De-list Product
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn btn-danger-action"
                      onClick={() =>
                        promptAction(
                          'SUSPEND_SHOP',
                          true,
                          'Suspend Merchant Shop & Account',
                          'Disable the shop storefront, hide all associated inventory listings, and suspend owner merchant privileges pending investigation.'
                        )
                      }
                    >
                      <span>⛔</span> Suspend Shop
                    </button>

                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() =>
                        promptAction(
                          'DISMISS_ALERT',
                          false,
                          'Dismiss Alert as False Positive',
                          'Mark this alert as dismissed if observed data falls within normal operational variance or seller provided legitimate invoice.'
                        )
                      }
                    >
                      <span>✓</span> Dismiss False Positive
                    </button>
                  </div>

                  {/* Status Transition Row */}
                  <form onSubmit={handleStatusChangeSubmit} className="status-transition-form">
                    <div className="status-select-wrap">
                      <label>Update Case Workflow Status:</label>
                      <select
                        value={statusChangeValue}
                        onChange={(e) => setStatusChangeValue(e.target.value)}
                        disabled={statusSubmitting}
                      >
                        <option value="OPEN">Open</option>
                        <option value="UNDER_REVIEW">Under Review</option>
                        <option value="ACTION_REQUIRED">Action Required</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="DISMISSED">Dismissed</option>
                      </select>
                    </div>

                    <div className="status-reason-input">
                      <input
                        type="text"
                        placeholder="Status change justification reason..."
                        value={statusChangeReason}
                        onChange={(e) => setStatusChangeReason(e.target.value)}
                        disabled={statusSubmitting}
                      />
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={statusSubmitting}>
                      {statusSubmitting ? 'Updating...' : 'Update Status'}
                    </button>
                  </form>
                </div>

                {/* Audit Trail History */}
                <div className="drawer-section">
                  <h4 className="section-title">📜 Case Audit Trail</h4>
                  {selectedCase.adminActions && selectedCase.adminActions.length > 0 ? (
                    <div className="audit-timeline">
                      {selectedCase.adminActions.map((act, idx) => (
                        <div key={idx} className="audit-entry">
                          <div className="audit-bullet"></div>
                          <div className="audit-content">
                            <div className="audit-header">
                              <span className="audit-action">{act.action}</span>
                              <span className="audit-time">
                                {new Date(act.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="audit-reason">"{act.reason}"</p>
                            <span className="audit-admin">By: {act.adminName || 'Admin'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-items-text">No administrative actions recorded yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal for Consequential Actions */}
        {confirmDialog && (
          <div className="confirm-modal-overlay" onClick={() => setConfirmDialog(null)}>
            <div className="confirm-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="confirm-modal-header">
                <h3>⚠️ {confirmDialog.title}</h3>
                <button type="button" className="confirm-close" onClick={() => setConfirmDialog(null)}>
                  ✕
                </button>
              </div>

              <form onSubmit={handleExecuteConfirmedAction} className="confirm-modal-body">
                <p className="confirm-desc">{confirmDialog.description}</p>

                {confirmDialog.isConsequential && (
                  <div className="consequential-warning-box">
                    <span>🛑</span>
                    <div>
                      <strong>Consequential Governance Action:</strong>
                      <p>
                        This action has platform-wide impact. It cannot be triggered by AI predictions and requires explicit human confirmation.
                      </p>
                    </div>
                  </div>
                )}

                <div className="confirm-form-group">
                  <label htmlFor="actionReason">Mandatory Justification Reason (min 5 characters):</label>
                  <textarea
                    id="actionReason"
                    rows="3"
                    placeholder="Enter factual platform policy justification..."
                    value={confirmReason}
                    onChange={(e) => setConfirmReason(e.target.value)}
                    required
                    disabled={confirmSubmitting}
                  />
                </div>

                {confirmDialog.isConsequential && (
                  <div className="confirm-checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={confirmedChecked}
                        onChange={(e) => setConfirmedChecked(e.target.checked)}
                        disabled={confirmSubmitting}
                      />
                      <span>
                        I confirm that I have reviewed the evidence and authorize this administrative action under platform policy.
                      </span>
                    </label>
                  </div>
                )}

                <div className="confirm-actions">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setConfirmDialog(null)}
                    disabled={confirmSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-danger-action"
                    disabled={
                      confirmSubmitting ||
                      !confirmReason.trim() ||
                      confirmReason.trim().length < 5 ||
                      (confirmDialog.isConsequential && !confirmedChecked)
                    }
                  >
                    {confirmSubmitting ? 'Executing...' : 'Confirm and Execute'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTrustSafetyPage;
