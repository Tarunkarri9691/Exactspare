import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchMyApplication, fetchMyNotifications, markNotificationRead } from '../services/api';
import './OwnerDashboardPage.css';

const OwnerDashboardPage = () => {
  const { user } = useAuth();
  const [appData, setAppData] = useState({ loading: true, hasApp: false, application: null });
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadOwnerData = async () => {
    setAppData(prev => ({ ...prev, loading: true }));
    const [appRes, notifRes] = await Promise.all([
      fetchMyApplication(),
      fetchMyNotifications()
    ]);

    if (appRes.success) {
      setAppData({
        loading: false,
        hasApp: appRes.hasApplication,
        application: appRes.application
      });
    } else {
      setAppData(prev => ({ ...prev, loading: false }));
    }

    if (notifRes.success) {
      setNotifications(notifRes.notifications);
      setUnreadCount(notifRes.unreadCount);
    }
  };

  useEffect(() => {
    loadOwnerData();
  }, []);

  const handleMarkRead = async (id) => {
    await markNotificationRead(id);
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const app = appData.application;

  return (
    <div className="dashboard-page-root">
      <div className="container dashboard-container">
        {/* Welcome Header */}
        <div className="dashboard-welcome-card owner-welcome-card">
          <div className="welcome-info">
            <div className="welcome-badge-row">
              <span className="badge badge-orange">Role: {user?.role}</span>
              <span className="badge badge-success">Account: {user?.accountStatus || 'ACTIVE'}</span>
            </div>
            <h1 className="welcome-title">Shop Owner Portal — {user?.name}</h1>
            <p className="welcome-subtitle">
              Manage your automotive retail store registration, administrative verification, and spare parts catalog.
            </p>
          </div>
          <div className="user-contact-mini">
            <div className="contact-detail-item">
              <span className="contact-label">Owner Email:</span>
              <span className="contact-val">{user?.email}</span>
            </div>
            <div className="contact-detail-item">
              <span className="contact-label">Contact Phone:</span>
              <span className="contact-val">{user?.phone}</span>
            </div>
          </div>
        </div>

        {/* In-App Notifications Bar */}
        {notifications.length > 0 && (
          <div className="owner-notifications-card fade-in">
            <div className="notifications-header">
              <div className="notif-title-row">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <h3>Recent Application Alerts</h3>
                {unreadCount > 0 && (
                  <span className="badge badge-orange">{unreadCount} New</span>
                )}
              </div>
            </div>
            <div className="notifications-list">
              {notifications.slice(0, 3).map(n => (
                <div key={n._id} className={`notification-item ${!n.isRead ? 'unread' : ''}`}>
                  <div className="notif-content">
                    <strong>{n.title}</strong>
                    <p>{n.message}</p>
                    <span className="notif-time">{new Date(n.createdAt).toLocaleString()}</span>
                  </div>
                  {!n.isRead && (
                    <button
                      type="button"
                      className="mark-read-btn"
                      onClick={() => handleMarkRead(n._id)}
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Real Application State Card */}
        <div className="dashboard-section">
          <div className="section-title-row">
            <h2>Shop Registration & Approval Status</h2>
            <span className="badge badge-navy">Authoritative Backend State</span>
          </div>

          {appData.loading ? (
            <div className="app-status-loading-card">
              <p>Checking registration status in database...</p>
            </div>
          ) : !appData.hasApp ? (
            // State 1: No application yet
            <div className="application-status-card no-app-card">
              <div className="status-indicator-col">
                <div className="status-bubble gray-bubble">!</div>
              </div>
              <div className="status-main-col">
                <div className="status-tag-row">
                  <span className="badge badge-navy">NOT SUBMITTED</span>
                </div>
                <h3>Start Your Shop Registration</h3>
                <p>
                  You haven't submitted a shop application yet. Apply now to list your store, upload your storefront photos, and begin selling spare parts to local vehicle owners.
                </p>
                <div className="status-action-row">
                  <Link to="/owner/application" className="btn btn-primary" id="start-shop-application-btn">
                    Start Shop Application →
                  </Link>
                </div>
              </div>
            </div>
          ) : app.status === 'DRAFT' ? (
            // State 2: DRAFT
            <div className="application-status-card draft-card">
              <div className="status-indicator-col">
                <div className="status-bubble blue-bubble">✎</div>
              </div>
              <div className="status-main-col">
                <div className="status-tag-row">
                  <span className="badge badge-info">STATUS: DRAFT</span>
                  <span className="app-id-tag">ID: {app._id}</span>
                </div>
                <h3>{app.shopName} (Application In Draft)</h3>
                <p>
                  Your shop registration is currently saved as a draft. You can continue updating your store details, photos, and location coordinates before submitting for administrative approval.
                </p>
                <div className="guidance-box">
                  <strong>Next Action Required:</strong> Complete mandatory details and submit for review.
                </div>
                <div className="status-action-row">
                  <Link to="/owner/application" className="btn btn-primary">
                    Continue & Submit Application →
                  </Link>
                </div>
              </div>
            </div>
          ) : app.status === 'PENDING' ? (
            // State 3: PENDING
            <div className="application-status-card pending-review-card">
              <div className="status-indicator-col">
                <div className="status-bubble orange-bubble">⏳</div>
              </div>
              <div className="status-main-col">
                <div className="status-tag-row">
                  <span className="badge badge-orange">STATUS: PENDING REVIEW</span>
                  <span className="app-id-tag">ID: {app._id}</span>
                </div>
                <h3>{app.shopName}</h3>
                <p>
                  Your application has been received and is waiting for review by the platform compliance administrator.
                </p>
                <div className="app-meta-grid">
                  <div><strong>Submitted At:</strong> {new Date(app.submittedAt || app.createdAt).toLocaleString()}</div>
                  <div><strong>Category:</strong> {app.shopCategory}</div>
                  <div><strong>City:</strong> {app.city}, {app.state}</div>
                  <div><strong>Photos Uploaded:</strong> {app.shopImagePaths?.length || 0} file(s)</div>
                </div>
                <div className="guidance-box pending-box">
                  <strong>Status Guidance:</strong> Applications cannot be modified while in review. The administrator will inspect your storefront photos and location coordinates. You will receive an in-app alert when a decision is published.
                </div>
              </div>
            </div>
          ) : app.status === 'NEEDS_CORRECTION' ? (
            // State 4: NEEDS_CORRECTION
            <div className="application-status-card correction-card">
              <div className="status-indicator-col">
                <div className="status-bubble amber-bubble">⚠️</div>
              </div>
              <div className="status-main-col">
                <div className="status-tag-row">
                  <span className="badge badge-orange">STATUS: CORRECTIONS REQUESTED</span>
                  <span className="app-id-tag">ID: {app._id}</span>
                </div>
                <h3>{app.shopName} — Revisions Required</h3>
                <div className="admin-feedback-banner">
                  <strong>Administrator Feedback:</strong>
                  <p>{app.correctionMessage || 'Please update your shop details and resubmit.'}</p>
                </div>
                <div className="guidance-box">
                  <strong>Next Action Required:</strong> Open your application, make the requested changes, and click "Submit Application".
                </div>
                <div className="status-action-row">
                  <Link to="/owner/application" className="btn btn-primary">
                    Update Details & Resubmit Application →
                  </Link>
                </div>
              </div>
            </div>
          ) : app.status === 'APPROVED' ? (
            // State 5: APPROVED
            <div className="application-status-card approved-verified-card">
              <div className="status-indicator-col">
                <div className="status-bubble green-bubble">✓</div>
              </div>
              <div className="status-main-col">
                <div className="status-tag-row">
                  <span className="badge badge-success">STATUS: APPROVED & ACTIVE</span>
                  <span className="app-id-tag">ID: {app._id}</span>
                </div>
                <h3>{app.shopName}</h3>
                <p className="verified-success-text">
                  Congratulations! Your retail store has passed compliance verification and is active on the EXACTSPARE network.
                </p>
                <div className="app-meta-grid">
                  <div><strong>Category:</strong> {app.shopCategory}</div>
                  <div><strong>Store Address:</strong> {app.addressLine}, {app.city}, {app.state} - {app.postalCode}</div>
                  <div><strong>Hours:</strong> {app.openingHours}</div>
                  <div><strong>Verified On:</strong> {new Date(app.reviewedAt || app.updatedAt).toLocaleDateString()}</div>
                </div>
                <div className="approved-perks-box">
                  <span className="perk-chip">✓ Public Discovery Active</span>
                  <span className="perk-chip">✓ Verified Vendor Badge</span>
                  <span className="perk-chip">✓ Inventory Integration Enabled</span>
                </div>
                <div className="status-action-row" style={{ marginTop: '18px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <Link to="/owner/inventory" className="btn btn-primary">
                    Manage Spare-Part Inventory →
                  </Link>
                  <Link to="/owner/inventory/new" className="btn btn-outline-navy">
                    + Add New Spare Part
                  </Link>
                  <Link to="/owner/shop" className="btn btn-outline">
                    Shop Profile Settings
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            // State 6: REJECTED
            <div className="application-status-card rejected-card">
              <div className="status-indicator-col">
                <div className="status-bubble red-bubble">✕</div>
              </div>
              <div className="status-main-col">
                <div className="status-tag-row">
                  <span className="badge badge-danger">STATUS: REJECTED</span>
                  <span className="app-id-tag">ID: {app._id}</span>
                </div>
                <h3>Application for {app.shopName} Was Rejected</h3>
                <div className="admin-feedback-banner error-banner">
                  <strong>Rejection Reason:</strong>
                  <p>{app.rejectionReason || 'Application failed platform compliance criteria.'}</p>
                </div>
                <div className="guidance-box">
                  <strong>Guidance:</strong> Please review the reason above. You may prepare a new application addressing the identified issues or reach out to platform support.
                </div>
                <div className="status-action-row">
                  <Link to="/owner/application" className="btn btn-outline">
                    View Application Record
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Inventory Management Section */}
        <div className="dashboard-section">
          <div className="section-title-row">
            <h2>Inventory & Spare Part Stock Management</h2>
            <span className="badge badge-info">Module 4 Ready</span>
          </div>

          <div className="inventory-preview-card">
            <div className="inventory-preview-icon">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
              </svg>
            </div>
            {app?.status === 'APPROVED' ? (
              <>
                <h3>Store Inventory Pipeline is Unlocked</h3>
                <p>
                  Your store is approved. In <strong>Module 4</strong>, you will manage spare parts catalog uploads, OEM number indexing, stock quantities, and customer order inquiries.
                </p>
                <div className="status-pill-row">
                  <span className="tech-chip">Catalog Manager</span>
                  <span className="tech-chip">OEM Lookup</span>
                  <span className="tech-chip">Stock Adjustments</span>
                </div>
              </>
            ) : (
              <>
                <h3>Inventory Catalog is Locked Pending Approval</h3>
                <p>
                  To ensure quality control and prevent unverified listings, shop inventory publishing requires an APPROVED application status. Once verified, you will be able to list parts across Bike, Car, Scooter, Bicycle, and Commercial categories.
                </p>
                <div className="status-pill-row">
                  <span className="tech-chip">Awaiting Compliance</span>
                  <span className="tech-chip">Trade License Audit</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OwnerDashboardPage;
