import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  fetchAdminApplications, 
  fetchAdminApplicationById, 
  decideAdminApplication 
} from '../services/api';
import LocationPickerMap from '../components/LocationPickerMap';
import './AdminApplicationsPage.css';

const AdminApplicationsPage = () => {
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState({ totalAll: 0, pending: 0, approved: 0, rejected: 0, needsCorrection: 0 });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters state
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);

  // Detail / Review Modal State
  const [selectedApp, setSelectedApp] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Decision Modal State
  const [decisionType, setDecisionType] = useState(null); // 'APPROVE' | 'REJECT' | 'REQUEST_CORRECTIONS'
  const [decisionReason, setDecisionReason] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState('');
  const [pageNotice, setPageNotice] = useState('');

  const loadApplications = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page: currentPage,
        limit: 10,
        sortBy
      };

      if (selectedStatus) params.status = selectedStatus;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await fetchAdminApplications(params);
      if (res.success) {
        setApplications(res.data.applications || []);
        setStats(res.data.stats || {});
        setPagination(res.data.pagination || { total: 0, page: 1, limit: 10, pages: 1 });
      } else {
        setError(res.error || 'Failed to fetch shop applications');
      }
    } catch {
      setError('An error occurred while communicating with the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, [selectedStatus, sortBy, currentPage]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    loadApplications();
  };

  const handleOpenReview = async (appId) => {
    try {
      setDetailModalOpen(true);
      setLoadingDetail(true);
      setDecisionType(null);
      setDecisionReason('');
      setDecisionError('');
      setPageNotice('');

      const res = await fetchAdminApplicationById(appId);
      if (res.success && res.data?.application) {
        setSelectedApp(res.data.application);
      } else {
        setError('Could not load application details: ' + (res.error || ''));
        setDetailModalOpen(false);
      }
    } catch {
      setError('Error fetching application details.');
      setDetailModalOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleProcessDecision = async () => {
    if (!selectedApp) return;
    setDecisionError('');

    if (decisionType === 'REJECT' && !decisionReason.trim()) {
      setDecisionError('Please enter a specific reason for rejection.');
      return;
    }

    if (decisionType === 'REQUEST_CORRECTIONS' && !decisionReason.trim()) {
      setDecisionError('Please enter the instructions explaining what corrections are required.');
      return;
    }

    try {
      setSubmittingDecision(true);
      const payload = {
        decision: decisionType,
        reason: decisionType === 'REJECT' ? decisionReason.trim() : undefined,
        correctionMessage: decisionType === 'REQUEST_CORRECTIONS' ? decisionReason.trim() : undefined
      };

      const res = await decideAdminApplication(selectedApp._id, payload);
      if (res.success) {
        setPageNotice(`Application for "${selectedApp.shopName}" successfully updated to ${decisionType}!`);
        setDetailModalOpen(false);
        setSelectedApp(null);
        setDecisionType(null);
        setDecisionReason('');
        loadApplications();
      } else {
        setDecisionError(res.error || 'Failed to execute review decision.');
      }
    } catch {
      setDecisionError('An unexpected server error occurred.');
    } finally {
      setSubmittingDecision(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED': return <span className="badge badge-success">Approved</span>;
      case 'PENDING': return <span className="badge badge-orange">Pending Review</span>;
      case 'NEEDS_CORRECTION': return <span className="badge badge-warning">Needs Correction</span>;
      case 'REJECTED': return <span className="badge badge-danger">Rejected</span>;
      default: return <span className="badge badge-navy">{status}</span>;
    }
  };

  return (
    <div className="admin-apps-page-root">
      <div className="container admin-apps-container">
        {/* Navigation Breadcrumb / Header */}
        <div className="admin-page-header">
          <div className="breadcrumb-row">
            <Link to="/admin/dashboard" className="back-link">
              ← Return to Admin Dashboard
            </Link>
            <span className="badge badge-info">Module 3 • Compliance Center</span>
          </div>
          <h1>Shop Owner Application Reviews & Governance</h1>
          <p>
            Verify physical storefront photos, GPS coordinates, and business credentials before approving merchants to sell on EXACTSPARE.
          </p>
        </div>

        {/* Real-Time Stats Overview Cards */}
        <div className="admin-stats-bar">
          <button 
            type="button" 
            className={`stat-pill-btn ${selectedStatus === '' ? 'active' : ''}`}
            onClick={() => { setSelectedStatus(''); setCurrentPage(1); }}
          >
            <span className="pill-label">All Applications</span>
            <span className="pill-count">{stats.totalAll ?? 0}</span>
          </button>

          <button 
            type="button" 
            className={`stat-pill-btn pending-pill ${selectedStatus === 'PENDING' ? 'active' : ''}`}
            onClick={() => { setSelectedStatus('PENDING'); setCurrentPage(1); }}
          >
            <span className="pill-label">Pending Verification</span>
            <span className="pill-count">{stats.pending ?? 0}</span>
          </button>

          <button 
            type="button" 
            className={`stat-pill-btn warning-pill ${selectedStatus === 'NEEDS_CORRECTION' ? 'active' : ''}`}
            onClick={() => { setSelectedStatus('NEEDS_CORRECTION'); setCurrentPage(1); }}
          >
            <span className="pill-label">Needs Correction</span>
            <span className="pill-count">{stats.needsCorrection ?? 0}</span>
          </button>

          <button 
            type="button" 
            className={`stat-pill-btn success-pill ${selectedStatus === 'APPROVED' ? 'active' : ''}`}
            onClick={() => { setSelectedStatus('APPROVED'); setCurrentPage(1); }}
          >
            <span className="pill-label">Approved & Active</span>
            <span className="pill-count">{stats.approved ?? 0}</span>
          </button>

          <button 
            type="button" 
            className={`stat-pill-btn danger-pill ${selectedStatus === 'REJECTED' ? 'active' : ''}`}
            onClick={() => { setSelectedStatus('REJECTED'); setCurrentPage(1); }}
          >
            <span className="pill-label">Rejected</span>
            <span className="pill-count">{stats.rejected ?? 0}</span>
          </button>
        </div>

        {/* Search & Sort Filter Bar */}
        <div className="filters-card">
          <form className="search-filter-form" onSubmit={handleSearchSubmit}>
            <div className="search-input-wrap">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                className="filter-input"
                placeholder="Search by shop name, owner, email, or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-outline filter-search-btn">
              Search
            </button>
          </form>

          <div className="sort-select-wrap">
            <label htmlFor="sort-by-select">Sort By:</label>
            <select
              id="sort-by-select"
              className="filter-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>

        {pageNotice && (
          <div className="auth-alert success-alert fade-in" style={{ borderColor: 'var(--color-status-approved)', color: 'var(--color-status-approved)' }}>
            <span>{pageNotice}</span>
          </div>
        )}

        {error && (
          <div className="auth-alert error-alert fade-in">
            <span>{error}</span>
          </div>
        )}

        {/* Applications Data Table */}
        <div className="apps-table-card">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Shop Name</th>
                <th>Owner Details</th>
                <th>Location</th>
                <th>Category</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center-cell">Loading applications from MongoDB...</td>
                </tr>
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center-cell">
                    No shop applications found matching the selected criteria.
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app._id} className={`status-row-${app.status.toLowerCase()}`}>
                    <td>
                      <strong className="shop-title-text">{app.shopName}</strong>
                      <div className="app-id-sub">ID: {app._id.slice(-6)}</div>
                    </td>
                    <td>
                      <div>{app.ownerFullName}</div>
                      <div className="owner-email-sub">{app.businessEmail}</div>
                      <div className="owner-phone-sub">{app.ownerPhone}</div>
                    </td>
                    <td>
                      <div>{app.city}, {app.state}</div>
                      <div className="coords-sub">[{app.latitude?.toFixed(4)}, {app.longitude?.toFixed(4)}]</div>
                    </td>
                    <td>
                      <span className="tech-chip">{app.shopCategory}</span>
                    </td>
                    <td>{getStatusBadge(app.status)}</td>
                    <td>
                      <div>{new Date(app.submittedAt || app.createdAt).toLocaleDateString()}</div>
                      <div className="time-sub">{new Date(app.submittedAt || app.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline review-btn"
                        onClick={() => handleOpenReview(app._id)}
                      >
                        Inspect & Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {pagination.pages > 1 && (
            <div className="table-pagination-row">
              <span className="pagination-info">
                Page {pagination.page} of {pagination.pages} ({pagination.total} total applications)
              </span>
              <div className="pagination-buttons">
                <button
                  type="button"
                  className="btn btn-outline page-btn"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btn-outline page-btn"
                  disabled={currentPage >= pagination.pages}
                  onClick={() => setCurrentPage(prev => Math.min(pagination.pages, prev + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DETAIL & REVIEW MODAL */}
      {detailModalOpen && (
        <div className="modal-backdrop" onClick={() => setDetailModalOpen(false)}>
          <div className="modal-card review-modal-card fade-in" onClick={(e) => e.stopPropagation()}>
            {loadingDetail || !selectedApp ? (
              <div className="modal-loading-box">
                <p>Loading application record...</p>
              </div>
            ) : (
              <>
                <div className="modal-header">
                  <div>
                    <div className="modal-status-tag">
                      {getStatusBadge(selectedApp.status)}
                      <span className="app-id-tag">Application ID: {selectedApp._id}</span>
                    </div>
                    <h2>{selectedApp.shopName}</h2>
                  </div>
                  <button 
                    type="button" 
                    className="modal-close-btn" 
                    onClick={() => setDetailModalOpen(false)}
                  >
                    ×
                  </button>
                </div>

                <div className="modal-scrollable-body">
                  {/* Shop & Owner Summary Grid */}
                  <div className="review-meta-grid">
                    <div className="meta-card">
                      <h4>Owner Information</h4>
                      <p><strong>Name:</strong> {selectedApp.ownerFullName}</p>
                      <p><strong>Phone:</strong> {selectedApp.ownerPhone}</p>
                      <p><strong>Email:</strong> {selectedApp.businessEmail}</p>
                      <p><strong>Account ID:</strong> {selectedApp.ownerId?._id || selectedApp.ownerId}</p>
                    </div>

                    <div className="meta-card">
                      <h4>Shop Overview</h4>
                      <p><strong>Category:</strong> {selectedApp.shopCategory}</p>
                      <p><strong>Address:</strong> {selectedApp.addressLine}, {selectedApp.city}, {selectedApp.state} - {selectedApp.postalCode}</p>
                      <p><strong>Hours:</strong> {selectedApp.openingHours}</p>
                    </div>
                  </div>

                  {/* Shop Description */}
                  <div className="review-description-box">
                    <h4>Shop Description</h4>
                    <p>{selectedApp.shopDescription}</p>
                  </div>

                  {/* Geolocation Map */}
                  <div className="review-map-box">
                    <h4>Physical Location Verification (OpenStreetMap)</h4>
                    <p className="subtext">
                      Coordinates: Latitude {selectedApp.latitude}, Longitude {selectedApp.longitude}
                    </p>
                    <LocationPickerMap
                      latitude={selectedApp.latitude}
                      longitude={selectedApp.longitude}
                      readOnly={true}
                      height="240px"
                    />
                  </div>

                  {/* Storefront Photographs Gallery */}
                  <div className="review-photos-box">
                    <h4>Storefront Photographs ({selectedApp.shopImagePaths?.length || 0})</h4>
                    {selectedApp.shopImagePaths?.length > 0 ? (
                      <div className="admin-photo-gallery">
                        {selectedApp.shopImagePaths.map((path, idx) => (
                          <a
                            key={idx}
                            href={`http://localhost:5000/${path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="gallery-item"
                          >
                            <img src={`http://localhost:5000/${path}`} alt="Storefront" />
                            <span>View Full Image ↗</span>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="empty-subtext">No storefront photos uploaded.</p>
                    )}
                  </div>

                  {/* Private Verification Documents */}
                  <div className="review-documents-box">
                    <h4>Private Verification Documents ({selectedApp.verificationDocumentPaths?.length || 0})</h4>
                    <p className="subtext">
                      Trade licenses, GST filings, and municipal permits. Confidential; restricted strictly to platform administrators.
                    </p>

                    {selectedApp.verificationDocumentPaths?.length > 0 ? (
                      <div className="documents-inspect-list">
                        {selectedApp.verificationDocumentPaths.map((docPath, idx) => {
                          const filename = docPath.split('/').pop();
                          return (
                            <div key={idx} className="doc-inspect-item">
                              <span className="doc-icon">📑</span>
                              <div className="doc-details">
                                <span className="doc-filename">{filename}</span>
                                <span className="doc-storage-note">Secure Local Storage Path: {docPath}</span>
                              </div>
                              <a
                                href={`http://localhost:5000/api/shop-applications/${selectedApp._id}/documents/${filename}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-outline inspect-doc-btn"
                              >
                                View Private Document ↗
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="empty-subtext">No optional verification documents attached.</p>
                    )}
                  </div>

                  {/* Audit History Timeline */}
                  {selectedApp.statusHistory?.length > 0 && (
                    <div className="review-history-box">
                      <h4>Audit History & Status Timeline</h4>
                      <div className="audit-timeline">
                        {selectedApp.statusHistory.map((h, i) => (
                          <div key={i} className="timeline-item">
                            <span className="timeline-badge">{h.status}</span>
                            <span className="timeline-note">{h.note || 'Status updated'}</span>
                            <span className="timeline-time">{new Date(h.timestamp).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Decision Form */}
                  {selectedApp.status === 'PENDING' && (
                    <div className="decision-action-box">
                      <h4>Administrative Review Action</h4>
                      <p className="subtext">
                        Choose an action below to either verify the merchant, request necessary corrections, or reject the application.
                      </p>

                      <div className="decision-button-toggles">
                        <button
                          type="button"
                          className={`btn ${decisionType === 'APPROVE' ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => { setDecisionType('APPROVE'); setDecisionError(''); }}
                        >
                          ✓ Approve Application
                        </button>

                        <button
                          type="button"
                          className={`btn ${decisionType === 'REQUEST_CORRECTIONS' ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => { setDecisionType('REQUEST_CORRECTIONS'); setDecisionError(''); }}
                        >
                          ⚠️ Request Corrections
                        </button>

                        <button
                          type="button"
                          className={`btn ${decisionType === 'REJECT' ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => { setDecisionType('REJECT'); setDecisionError(''); }}
                        >
                          ✕ Reject Application
                        </button>
                      </div>

                      {decisionType && (
                        <div className="decision-details-form fade-in">
                          {decisionType === 'APPROVE' ? (
                            <div className="approve-confirm-notice">
                              <p>
                                <strong>Ready to Approve:</strong> Approving will immediately create an active <strong>Shop</strong> record in MongoDB and publish the store for customer discovery. The owner will receive an approval notification.
                              </p>
                            </div>
                          ) : (
                            <div className="reason-input-group">
                              <label htmlFor="decisionReason">
                                {decisionType === 'REJECT' ? 'Reason for Rejection *' : 'Instructions for Required Corrections *'}
                              </label>
                              <textarea
                                id="decisionReason"
                                className="form-textarea"
                                rows="3"
                                placeholder={decisionType === 'REJECT' ? 'Provide clear reason for rejection...' : 'Specify what photos, address details, or documents need to be corrected...'}
                                value={decisionReason}
                                onChange={(e) => setDecisionReason(e.target.value)}
                                required
                              />
                            </div>
                          )}

                          {decisionError && (
                            <div className="auth-alert error-alert">
                              <span>{decisionError}</span>
                            </div>
                          )}

                          <div className="decision-submit-row">
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => setDecisionType(null)}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className={`btn ${decisionType === 'REJECT' ? 'btn-danger' : 'btn-primary'}`}
                              disabled={submittingDecision}
                              onClick={handleProcessDecision}
                            >
                              {submittingDecision ? 'Executing Decision...' : `Confirm ${decisionType}`}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedApp.status !== 'PENDING' && (
                    <div className="decision-resolved-box">
                      <p>
                        This application is in <strong>{selectedApp.status}</strong> status. No pending review actions required.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminApplicationsPage;
