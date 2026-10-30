import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminNav from '../components/AdminNav';
import { 
  fetchAdminApplications, 
  fetchAdminApplicationById
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

  // Detail Modal State
  const [selectedApp, setSelectedApp] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED': return <span className="badge badge-success">✓ Directly Approved</span>;
      case 'PENDING': return <span className="badge badge-success">✓ Registered</span>;
      case 'NEEDS_CORRECTION': return <span className="badge badge-warning">Needs Correction</span>;
      case 'REJECTED': return <span className="badge badge-danger">Rejected</span>;
      default: return <span className="badge badge-navy">✓ Registered</span>;
    }
  };

  return (
    <div className="admin-apps-page-root">
      <AdminNav />
      <div className="container admin-apps-container">
        {/* Navigation Breadcrumb / Header */}
        <div className="admin-page-header">
          <div className="breadcrumb-row">
            <Link to="/admin/dashboard" className="back-link">
              ← Return to Admin Dashboard
            </Link>
            <span className="badge badge-info">Registry • Merchant Onboarding</span>
          </div>
          <h1>Shop Owner Applications Registry</h1>
          <p>
            Registry of all merchant applications. Shop owner basic details are directly registered and approved. Subscriptions to unlock and activate stores are managed in the Subscriptions Portal.
          </p>
        </div>

        {/* Quick Link Banner to Subscriptions Portal */}
        <div className="admin-sub-portal-banner">
          <div className="banner-info-left">
            <span className="banner-icon-badge">💳</span>
            <div>
              <h3>Merchant Subscriptions & Store Activation</h3>
              <p>
                When a shop owner completes basic registration, they submit a subscription payment. Review, accept, or reject merchant subscription requests in the Subscriptions Portal to unlock their stores.
              </p>
            </div>
          </div>
          <Link to="/admin/subscriptions" className="btn btn-primary" id="open-subs-portal-link">
            Open Subscriptions Portal →
          </Link>
        </div>

        {/* Real-Time Stats Overview Cards */}
        <div className="admin-stats-bar">
          <button 
            type="button" 
            className={`stat-pill-btn ${selectedStatus === '' ? 'active' : ''}`}
            onClick={() => { setSelectedStatus(''); setCurrentPage(1); }}
          >
            <span className="pill-label">All Registered Applications</span>
            <span className="pill-count">{stats.totalAll ?? 0}</span>
          </button>

          <button 
            type="button" 
            className={`stat-pill-btn success-pill ${selectedStatus === 'APPROVED' ? 'active' : ''}`}
            onClick={() => { setSelectedStatus('APPROVED'); setCurrentPage(1); }}
          >
            <span className="pill-label">Directly Approved</span>
            <span className="pill-count">{stats.approved ?? stats.totalAll ?? 0}</span>
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
                <th>Application Status</th>
                <th>Registered Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center-cell">Loading registered applications...</td>
                </tr>
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center-cell">
                    No shop applications found matching the selected criteria.
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app._id} className="status-row-approved">
                    <td>
                      <strong className="shop-title-text">{app.shopName}</strong>
                      <div className="app-id-sub">Ref: #EXS-{app._id.slice(-6).toUpperCase()}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{app.ownerFullName}</div>
                      <div className="owner-email-sub">{app.businessEmail}</div>
                      <div className="owner-phone-sub">📞 {app.ownerPhone}</div>
                    </td>
                    <td>
                      <div>{app.city}, {app.state}</div>
                      <div className="coords-sub">[{app.latitude?.toFixed(4)}, {app.longitude?.toFixed(4)}]</div>
                    </td>
                    <td>
                      <span className="tech-chip">{app.shopCategory}</span>
                    </td>
                    <td>
                      {getStatusBadge(app.status)}
                      <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>
                        Auto-approved upon registration
                      </div>
                    </td>
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
                        Inspect Details
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

      {/* DETAIL INSPECT MODAL */}
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
                  {/* Status Banner */}
                  <div className="decision-resolved-box" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <strong style={{ color: '#166534', fontSize: '1rem', display: 'block' }}>✓ Directly Registered & Approved</strong>
                        <p style={{ margin: '4px 0 0', color: '#15803d', fontSize: '0.9rem' }}>
                          Basic store details are approved. Storefront usage and part listing are unlocked once the owner's subscription is accepted in the Subscriptions Portal.
                        </p>
                      </div>
                      <Link
                        to={`/admin/subscriptions?search=${encodeURIComponent(selectedApp.ownerFullName || selectedApp.shopName)}`}
                        className="btn btn-primary btn-sm"
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        Check Subscriptions Portal →
                      </Link>
                    </div>
                  </div>

                  {/* Shop & Owner Summary Grid */}
                  <div className="review-meta-grid">
                    <div className="meta-card">
                      <h4>Owner Information</h4>
                      <p><strong>Name:</strong> {selectedApp.ownerFullName}</p>
                      <p><strong>Phone:</strong> {selectedApp.ownerPhone}</p>
                      <p><strong>Email:</strong> {selectedApp.businessEmail}</p>
                      <p><strong>Role:</strong> {selectedApp.ownerBusinessRole || 'Proprietor'}</p>
                      <p><strong>Account ID:</strong> {selectedApp.ownerId?._id || selectedApp.ownerId}</p>
                    </div>

                    <div className="meta-card">
                      <h4>Shop Overview</h4>
                      <p><strong>Category:</strong> {selectedApp.shopCategory}</p>
                      <p><strong>Address:</strong> {selectedApp.addressLine}, {selectedApp.city}, {selectedApp.state} - {selectedApp.postalCode}</p>
                      <p><strong>Hours:</strong> {selectedApp.openingHours}</p>
                      <p><strong>Years in Business:</strong> {selectedApp.yearsInBusiness || '1+'}</p>
                    </div>
                  </div>

                  {/* Shop Description */}
                  <div className="review-description-box">
                    <h4>Shop Description</h4>
                    <p>{selectedApp.shopDescription}</p>
                  </div>

                  {/* Geolocation Map */}
                  <div className="review-map-box">
                    <h4>Physical Location (OpenStreetMap)</h4>
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
                        {selectedApp.shopImagePaths.map((imgPath, idx) => (
                          <a
                            key={idx}
                            href={`http://localhost:5000/${imgPath}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="gallery-item"
                          >
                            <img src={`http://localhost:5000/${imgPath}`} alt="Storefront" />
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
                      Trade licenses, GST filings, and municipal permits uploaded by merchant.
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
                                <span className="doc-storage-note">Secure Path: {docPath}</span>
                              </div>
                              <a
                                href={`http://localhost:5000/api/shop-applications/${selectedApp._id}/documents/${filename}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-outline inspect-doc-btn"
                              >
                                View Document ↗
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
                      <h4>Registration Timeline</h4>
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
                </div>

                <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setDetailModalOpen(false)}
                  >
                    Close
                  </button>
                  <Link 
                    to={`/admin/subscriptions?search=${encodeURIComponent(selectedApp.ownerFullName || selectedApp.shopName)}`}
                    className="btn btn-primary"
                  >
                    Manage Subscription in Subscriptions Portal →
                  </Link>
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
