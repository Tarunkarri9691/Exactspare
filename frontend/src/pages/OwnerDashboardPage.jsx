import React, { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  fetchMyApplication, 
  fetchMyNotifications, 
  markNotificationRead,
  fetchMyInventory,
  fetchOwnerOrders,
  fetchOwnerEnquiries,
  fetchMySubscription,
  getImageUrl 
} from '../services/api';
import './OwnerDashboardPage.css';

const OwnerDashboardPage = () => {
  const { user } = useAuth();
  const [appData, setAppData] = useState({ loading: true, hasApp: false, application: null });
  const [subData, setSubData] = useState({ loading: true, overallStatus: 'NOT_SUBSCRIBED', subscription: null, config: null });
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [inventoryStats, setInventoryStats] = useState({
    totalParts: 0,
    publishedCount: 0,
    draftCount: 0,
    inStockCount: 0,
    lowStockCount: 0,
    outOfStockCount: 0
  });
  const [recentParts, setRecentParts] = useState([]);
  const [orderStats, setOrderStats] = useState({ totalOrders: 0, pendingOrders: 0, completedOrders: 0 });
  const [recentEnquiries, setRecentEnquiries] = useState([]);

  const loadOwnerData = async () => {
    setAppData(prev => ({ ...prev, loading: true }));
    setSubData(prev => ({ ...prev, loading: true }));
    try {
      const [appRes, notifRes, invRes, ordRes, enqRes, subRes] = await Promise.all([
        fetchMyApplication().catch(() => ({ success: false })),
        fetchMyNotifications().catch(() => ({ success: false })),
        fetchMyInventory({ limit: 5 }).catch(() => ({ success: false })),
        fetchOwnerOrders().catch(() => ({ success: false })),
        fetchOwnerEnquiries({ limit: 4 }).catch(() => ({ success: false })),
        fetchMySubscription().catch(() => ({ success: false }))
      ]);

      if (subRes && subRes.success) {
        setSubData({
          loading: false,
          overallStatus: subRes.overallStatus || 'NOT_SUBSCRIBED',
          subscription: subRes.currentSubscription,
          config: subRes.config,
          expiryStageInfo: subRes.expiryStageInfo || null,
          daysRemaining: subRes.daysRemaining ?? null
        });
      } else {
        setSubData(prev => ({ ...prev, loading: false }));
      }

      if (appRes && appRes.success) {
        setAppData({
          loading: false,
          hasApp: appRes.hasApplication,
          application: appRes.application
        });
      } else {
        setAppData(prev => ({ ...prev, loading: false }));
      }

      if (notifRes && notifRes.success) {
        const notifList = Array.isArray(notifRes.notifications)
          ? notifRes.notifications
          : notifRes.data?.notifications || [];
        setNotifications(notifList);
        setUnreadCount(notifRes.unreadCount ?? notifRes.data?.unreadCount ?? 0);
      }

      if (invRes && invRes.success && invRes.data) {
        const stats = invRes.data.stats || invRes.stats || {};
        const parts = Array.isArray(invRes.data.parts) ? invRes.data.parts : (invRes.parts || []);
        setInventoryStats({
          totalParts: stats.totalParts ?? parts.length ?? 0,
          publishedCount: stats.publishedCount ?? 0,
          draftCount: stats.draftCount ?? 0,
          inStockCount: stats.inStockCount ?? 0,
          lowStockCount: stats.lowStockCount ?? 0,
          outOfStockCount: stats.outOfStockCount ?? 0
        });
        setRecentParts(parts.slice(0, 4));
      }

      if (ordRes && ordRes.success && ordRes.data) {
        const orders = ordRes.data.orders || [];
        const pending = orders.filter(o => ['PENDING', 'ACCEPTED', 'PROCESSING'].includes(o.status)).length;
        const completed = orders.filter(o => ['DELIVERED', 'COMPLETED'].includes(o.status)).length;
        setOrderStats({
          totalOrders: ordRes.data.pagination?.total || orders.length,
          pendingOrders: pending,
          completedOrders: completed
        });
      }

      if (enqRes && enqRes.success && Array.isArray(enqRes.data)) {
        setRecentEnquiries(enqRes.data.slice(0, 4));
      }
    } catch {
      setAppData(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    loadOwnerData();
  }, []);

  const handleMarkRead = async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const outletContext = useOutletContext() || {};
  const shop = outletContext.shop;
  const app = appData.application || {};
  const storeName = shop?.name || shop?.shopName || app?.shopName || (user?.name ? `${user.name}'s Shop` : 'Auto Spares Shop');
  const storeCategory = shop?.category || app?.shopCategory || 'MULTI_CATEGORY';
  const storeCity = shop?.address?.city || app?.city || 'Verified';
  const storeAddress = shop?.address?.addressLine ? `${shop.address.addressLine}, ${shop.address.city || ''}, ${shop.address.state || ''} - ${shop.address.postalCode || ''}` : (app?.addressLine ? `${app.addressLine}, ${app.city}, ${app.state} - ${app.postalCode}` : 'Main Road, Hyderabad, Telangana - 500001');
  const storeHours = shop?.openingHours || app?.openingHours || 'Mon-Sat: 09:00 AM - 08:00 PM';
  const storePhone = shop?.contact?.phone || app?.ownerPhone || user?.phone || 'Configured';

  return (
    <div className="dashboard-page-root">
      <div className="container dashboard-container">
        {/* Welcome Header */}
        <div className="dashboard-welcome-card owner-welcome-card">
          <div className="welcome-info">
            <div className="welcome-badge-row">
              <span className="badge badge-orange">Role: {user?.role}</span>
              <span className="badge badge-success">Account: {user?.accountStatus || 'ACTIVE'}</span>
              <span className={`badge ${shop?.isActive ? 'badge-green' : 'badge-navy'}`}>
                Shop: {shop?.isActive ? 'Live & Active' : 'Details Directly Approved'}
              </span>
              <span className={`badge ${subData.overallStatus === 'ACTIVE' ? 'badge-green' : subData.overallStatus === 'PENDING_VERIFICATION' ? 'badge-warning' : 'badge-orange'}`} id="dashboard-sub-badge">
                Subscription: {subData.overallStatus === 'ACTIVE' ? 'Accepted & Active' : subData.overallStatus === 'PENDING_VERIFICATION' ? 'Pending Admin Acceptance' : 'Awaiting Subscription'}
              </span>
            </div>
            <h1 className="welcome-title">Shop Owner Portal — {user?.name}</h1>
            <p className="welcome-subtitle">
              Manage your automotive retail store registration, subscription, spare parts catalog, store location coordinates, and customer alerts.
            </p>
          </div>
          <div className="user-contact-mini">
            <div className="contact-detail-item">
              <span className="contact-label">Owner Email:</span>
              <span className="contact-val">{user?.email}</span>
            </div>
            <div className="contact-detail-item">
              <span className="contact-label">Contact Phone:</span>
              <span className="contact-val">{user?.phone || 'Not provided'}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions Bar */}
        <div className="owner-quick-actions-bar">
          <div className="quick-actions-title">
            <span className="qa-icon">⚡</span>
            <span>Quick Actions</span>
          </div>
          <div className="quick-actions-grid">
            <Link to="/owner/subscription" className="quick-action-btn" id="qa-subscription">
              <span className="qa-btn-icon">💳</span>
              <span className="qa-btn-label">
                Subscription
                {subData.overallStatus === 'ACTIVE' && <span className="qa-badge" style={{ background: '#16a34a' }}>Active</span>}
                {subData.overallStatus === 'PENDING_VERIFICATION' && <span className="qa-badge" style={{ background: '#d97706' }}>Pending</span>}
                {subData.overallStatus === 'NOT_SUBSCRIBED' && <span className="qa-badge" style={{ background: '#ea580c' }}>Subscribe</span>}
              </span>
            </Link>
            <Link to="/owner/shop" className="quick-action-btn" id="qa-shop-details">
              <span className="qa-btn-icon">🏬</span>
              <span className="qa-btn-label">Edit Shop Details</span>
            </Link>
            <Link to="/owner/location" className="quick-action-btn" id="qa-shop-location">
              <span className="qa-btn-icon">📍</span>
              <span className="qa-btn-label">Shop Location</span>
            </Link>
            <Link to="/owner/inventory/add" className="quick-action-btn" id="qa-add-part">
              <span className="qa-btn-icon">➕</span>
              <span className="qa-btn-label">Add Spare Part</span>
            </Link>
            <Link to="/owner/inventory" className="quick-action-btn" id="qa-manage-inv">
              <span className="qa-btn-icon">📦</span>
              <span className="qa-btn-label">Manage Inventory</span>
            </Link>
            <Link to="/owner/notifications" className="quick-action-btn" id="qa-view-notif">
              <span className="qa-btn-icon">🔔</span>
              <span className="qa-btn-label">
                View Notifications
                {unreadCount > 0 && <span className="qa-badge">{unreadCount}</span>}
              </span>
            </Link>
            <Link to="/owner/settings" className="quick-action-btn" id="qa-settings">
              <span className="qa-btn-icon">⚙️</span>
              <span className="qa-btn-label">Settings</span>
            </Link>
          </div>
        </div>

        {/* Store Subscription & Plan Card */}
        <div className="dashboard-section" style={{ marginTop: '24px' }}>
          <div className="section-title-row">
            <h2>Store Subscription & Payment Status</h2>
            <span className="badge badge-orange">Independent Merchant Activation</span>
          </div>

          {subData.loading ? (
            <div className="app-status-loading-card">
              <p>Checking subscription record in database...</p>
            </div>
          ) : subData.overallStatus === 'ACTIVE' ? (
            <div className={`application-status-card ${subData.expiryStageInfo ? 'correction-card' : 'verified-card'} fade-in`}>
              <div className="status-indicator-col">
                <div className={`status-bubble ${subData.expiryStageInfo ? 'amber-bubble' : 'green-bubble'}`}>
                  {subData.expiryStageInfo ? '⚠️' : '✓'}
                </div>
              </div>
              <div className="status-main-col">
                <div className="status-tag-row">
                  <span className={`badge ${subData.expiryStageInfo ? 'badge-orange' : 'badge-green'}`}>
                    {subData.expiryStageInfo ? `EXPIRING SOON (${subData.daysRemaining} DAY${subData.daysRemaining === 1 ? '' : 'S'} LEFT)` : 'STATUS: ACTIVE PARTNER'}
                  </span>
                  {subData.subscription?.planId && (
                    <span className="badge badge-navy">{subData.subscription.planName || subData.subscription.planId}</span>
                  )}
                  {subData.subscription?.paymentUtr && (
                    <span className="app-id-tag">UTR: {subData.subscription.paymentUtr}</span>
                  )}
                </div>

                {/* Expiry Stage Specific Notification Banner */}
                {subData.expiryStageInfo ? (
                  <div className="admin-feedback-banner" style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#92400e', marginBottom: '14px' }}>
                    <strong>Subscription Expiry Notice:</strong>
                    <p style={{ margin: '4px 0 0', fontWeight: '700', fontSize: '1.05rem', color: '#b45309' }}>
                      {subData.expiryStageInfo.message}
                    </p>
                  </div>
                ) : null}

                <h3>{subData.subscription?.planName || 'Merchant Partner Subscription'} ({subData.expiryStageInfo ? 'Expiring Soon' : 'Active'})</h3>
                <p>
                  Your store has authorized access to publish spare parts inventory, receive verified customer enquiries, and list on the EXACTSPARE map directory.
                </p>
                <div
                  className="guidance-box"
                  style={{
                    background: subData.expiryStageInfo ? '#fff7ed' : '#f0fdf4',
                    borderColor: subData.expiryStageInfo ? '#fed7aa' : '#bbf7d0',
                    color: subData.expiryStageInfo ? '#9a3412' : '#166534'
                  }}
                >
                  <strong>Actual Expiry Date:</strong>{' '}
                  {subData.subscription?.expiryDate
                    ? new Date(subData.subscription.expiryDate).toLocaleDateString()
                    : 'Active'}{' '}
                  {subData.daysRemaining !== null && `(${subData.daysRemaining} day(s) remaining)`}.
                </div>
                <div className="status-action-row">
                  <Link
                    to="/owner/subscription"
                    className={`btn ${subData.expiryStageInfo ? 'btn-primary' : 'btn-outline'}`}
                    id={subData.expiryStageInfo ? 'renew-subscription-btn' : 'manage-sub-btn'}
                  >
                    {subData.expiryStageInfo ? 'Renew Subscription →' : 'View Subscription & Payment Methods →'}
                  </Link>
                </div>
              </div>
            </div>
          ) : subData.overallStatus === 'PENDING_VERIFICATION' ? (
            <div className="application-status-card pending-card fade-in">
              <div className="status-indicator-col">
                <div className="status-bubble amber-bubble">⏳</div>
              </div>
              <div className="status-main-col">
                <div className="status-tag-row">
                  <span className="badge badge-warning">STATUS: PAYMENT SENT TO ADMIN (AWAITING ACCEPTANCE)</span>
                  {subData.subscription?.paymentUtr && (
                    <span className="app-id-tag">UTR: {subData.subscription.paymentUtr}</span>
                  )}
                </div>
                <h3>Subscription Payment Sent to Admin — Awaiting Admin Acceptance</h3>
                <p>
                  You submitted payment reference <code>{subData.subscription?.paymentUtr || '—'}</code> for the {subData.subscription?.planName || 'Merchant Partner Plan'} (₹{subData.subscription?.amount || 499}). The request has been sent to the administrator.
                </p>
                <div className="guidance-box" style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}>
                  <strong>Shop Activation Note:</strong> Your basic shop details are directly approved. As soon as the administrator reviews and accepts your subscription payment, your shop will be unlocked to add parts and publish inventory.
                </div>
                <div className="status-action-row">
                  <Link to="/owner/subscription" className="btn btn-primary" id="check-sub-status-btn">
                    Check Payment Verification Status →
                  </Link>
                </div>
              </div>
            </div>
          ) : subData.overallStatus === 'PAYMENT_FAILED' ? (
            <div className="application-status-card correction-card fade-in">
              <div className="status-indicator-col">
                <div className="status-bubble red-bubble">✕</div>
              </div>
              <div className="status-main-col">
                <div className="status-tag-row">
                  <span className="badge badge-danger">STATUS: PAYMENT VERIFICATION FAILED</span>
                  {subData.subscription?.paymentUtr && (
                    <span className="app-id-tag">Rejected UTR: {subData.subscription.paymentUtr}</span>
                  )}
                </div>
                <h3>Payment Verification Rejected</h3>
                <div className="admin-feedback-banner">
                  <strong>Administrator Feedback:</strong>
                  <p>{subData.subscription?.rejectionReason || 'The submitted transaction reference could not be reconciled with our bank account.'}</p>
                </div>
                <div className="guidance-box">
                  <strong>Next Action Required:</strong> Please verify your 12-digit UPI UTR number and resubmit your payment reference to activate your subscription.
                </div>
                <div className="status-action-row">
                  <Link to="/owner/subscription" className="btn btn-primary" id="resubmit-sub-btn">
                    Resubmit Payment Reference →
                  </Link>
                </div>
              </div>
            </div>
          ) : subData.overallStatus === 'EXPIRED' ? (
            <div className="application-status-card correction-card fade-in">
              <div className="status-indicator-col">
                <div className="status-bubble red-bubble">⚠️</div>
              </div>
              <div className="status-main-col">
                <div className="status-tag-row">
                  <span className="badge badge-danger">STATUS: SUBSCRIPTION EXPIRED</span>
                </div>
                <h3>Merchant Subscription Expired</h3>
                <div className="admin-feedback-banner" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b', marginBottom: '14px' }}>
                  <strong>Interruption Alert:</strong>
                  <p style={{ margin: '4px 0 0', fontWeight: '700', fontSize: '1.05rem', color: '#b91c1c' }}>
                    Your EXACTSPARE subscription has expired. Renew your subscription to restore subscription-based access.
                  </p>
                </div>
                <div className="guidance-box" style={{ background: '#fff7ed', borderColor: '#fed7aa', color: '#9a3412' }}>
                  <strong>Actual Expiry Date:</strong>{' '}
                  {subData.subscription?.expiryDate
                    ? new Date(subData.subscription.expiryDate).toLocaleDateString()
                    : 'Expired'}. All catalog editing, part publishing, and public search listing remain suspended until your renewal payment is verified.
                </div>
                <div className="status-action-row">
                  <Link to="/owner/subscription" className="btn btn-primary" id="renew-sub-btn">
                    Renew Subscription →
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            // NOT_SUBSCRIBED
            <div className="application-status-card no-app-card fade-in">
              <div className="status-indicator-col">
                <div className="status-bubble orange-bubble">💳</div>
              </div>
              <div className="status-main-col">
                <div className="status-tag-row">
                  <span className="badge badge-navy">NOT SUBSCRIBED</span>
                  <span className="badge badge-orange">Step 2: Subscription Activation</span>
                </div>
                <h3>Choose a Subscription Plan to Activate Your Shop</h3>
                <p>
                  Your basic shop details are registered and directly approved. To unlock your store, publish spare parts, and receive customer enquiries, subscribe to a merchant plan and submit your payment reference to the admin.
                </p>
                <div className="guidance-box" style={{ background: '#f8fafc', borderColor: '#e2e8f0', color: '#475569' }}>
                  <strong>How It Works:</strong> Submit your 12-digit UPI UTR number in the Subscription portal. A notification is sent to the admin. Once the admin accepts your payment, your shop is ready to use!
                </div>
                <div className="status-action-row">
                  <Link to="/owner/subscription" className="btn btn-primary" id="subscribe-plan-btn">
                    Choose Subscription Plan & Subscribe →
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Real Operational Command Center */}
        <div className="dashboard-section" style={{ marginTop: '24px' }}>
          <div className="owner-active-command-center fade-in">
            {/* 5 Real Inventory Operational Metric Cards */}
            <div className="owner-metrics-grid">
              {/* 1. Total Parts */}
              <div className="owner-metric-card metric-card-inv">
                <div className="metric-header">
                  <span className="metric-icon">📦</span>
                  <span className="metric-badge badge-navy">Catalog</span>
                </div>
                <div className="metric-val">{inventoryStats.totalParts}</div>
                <div className="metric-label">Total Spare Parts</div>
                <div className="metric-sub">
                  {inventoryStats.inStockCount} In Stock · {inventoryStats.lowStockCount} Low
                </div>
                <Link to="/owner/inventory" className="metric-action-link">
                  Manage Inventory →
                </Link>
              </div>

              {/* 2. Published Parts */}
              <div className="owner-metric-card metric-card-published">
                <div className="metric-header">
                  <span className="metric-icon">🟢</span>
                  <span className="metric-badge badge-success">Live</span>
                </div>
                <div className="metric-val" style={{ color: '#16a34a' }}>{inventoryStats.publishedCount}</div>
                <div className="metric-label">Published Parts</div>
                <div className="metric-sub">
                  Visible to customers in search
                </div>
                <Link to="/owner/inventory?publication=PUBLISHED" className="metric-action-link">
                  View Published →
                </Link>
              </div>

              {/* 3. Unpublished Parts */}
              <div className="owner-metric-card metric-card-draft">
                <div className="metric-header">
                  <span className="metric-icon">📝</span>
                  <span className="metric-badge badge-orange">Drafts</span>
                </div>
                <div className="metric-val" style={{ color: '#d97706' }}>{inventoryStats.draftCount}</div>
                <div className="metric-label">Unpublished Parts</div>
                <div className="metric-sub">
                  Internal catalog drafts
                </div>
                <Link to="/owner/inventory?publication=DRAFT" className="metric-action-link">
                  Review Drafts →
                </Link>
              </div>

              {/* 4. Out of Stock Parts */}
              <div className="owner-metric-card metric-card-outofstock">
                <div className="metric-header">
                  <span className="metric-icon">⚠️</span>
                  <span className="metric-badge badge-danger">Out of Stock</span>
                </div>
                <div className="metric-val" style={{ color: '#dc2626' }}>{inventoryStats.outOfStockCount}</div>
                <div className="metric-label">Out-of-Stock Items</div>
                <div className="metric-sub">
                  Items needing replenishment
                </div>
                <Link to="/owner/inventory?availability=OUT_OF_STOCK" className="metric-action-link">
                  Update Stock →
                </Link>
              </div>

              {/* 5. Store Discovery & Location */}
              <div className="owner-metric-card metric-card-status">
                <div className="metric-header">
                  <span className="metric-icon">📍</span>
                  <span className="metric-badge badge-success">✓ Mapped</span>
                </div>
                <div className="metric-val" style={{ fontSize: '1.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {storeCity}
                </div>
                <div className="metric-label">Store Location</div>
                <div className="metric-sub">
                  GPS radius discovery active
                </div>
                <Link to="/owner/location" className="metric-action-link">
                  Adjust Map Pin →
                </Link>
              </div>
            </div>

            {/* Main Store Identity & Status Card */}
            <div className="application-status-card approved-verified-card" style={{ marginTop: '20px' }}>
              <div className="status-indicator-col">
                <div className="status-bubble green-bubble">✓</div>
              </div>
              <div className="status-main-col">
                <div className="status-tag-row">
                  <span className="badge badge-success">STATUS: LIVE & ACTIVE</span>
                  <span className="badge badge-orange">VERIFIED VENDOR</span>
                  {shop?._id && <span className="app-id-tag">STORE ID: {shop._id}</span>}
                </div>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '6px' }}>{storeName}</h3>
                <p className="verified-success-text">
                  Your retail store is officially registered, verified, and discoverable by local customers on EXACTSPARE.
                </p>

                <div className="app-meta-grid" style={{ marginTop: '14px' }}>
                  <div><strong>Store Category:</strong> {storeCategory}</div>
                  <div><strong>Store Address:</strong> {storeAddress}</div>
                  <div><strong>Operating Hours:</strong> {storeHours}</div>
                  <div><strong>Contact Phone:</strong> {storePhone}</div>
                </div>

                <div className="status-action-row" style={{ marginTop: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <Link to="/owner/inventory" className="btn btn-primary" style={{ fontWeight: 700 }}>
                    📦 Manage Inventory Catalog →
                  </Link>
                  <Link to="/owner/inventory/add" className="btn btn-outline" style={{ fontWeight: 700, borderColor: '#ea580c', color: '#ea580c' }}>
                    ➕ Add Spare Part
                  </Link>
                  <Link to="/owner/location" className="btn btn-outline-navy" style={{ fontWeight: 700 }}>
                    📍 Shop Location & Coordinates
                  </Link>
                  <Link to="/owner/shop" className="btn btn-outline" style={{ fontWeight: 600 }}>
                    🏬 Shop Profile
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard 2-Column Section: Recent Inventory & Customer Enquiries */}
        <div className="dashboard-grid-2col" style={{ marginTop: '28px' }}>
          {/* Column A: Recent Inventory Updates */}
          <div className="dashboard-card recent-inv-card">
            <div className="card-header-row">
              <div className="card-title-group">
                <span className="card-icon">📦</span>
                <h3>Recent Inventory Updates</h3>
              </div>
              <Link to="/owner/inventory" className="card-header-link">
                View All ({inventoryStats.totalParts}) →
              </Link>
            </div>

            {recentParts.length === 0 ? (
              <div className="dash-empty-state">
                <span className="dash-empty-icon">🏷️</span>
                <h4>No spare parts in inventory yet</h4>
                <p>Add your first spare part to start selling to vehicle owners in your region.</p>
                <Link to="/owner/inventory/add" className="btn btn-primary btn-sm" style={{ marginTop: '12px' }}>
                  + Add First Spare Part
                </Link>
              </div>
            ) : (
              <div className="recent-parts-list">
                {recentParts.map((part) => (
                  <div key={part._id} className="recent-part-item">
                    <div className="part-thumb-wrap">
                      {part.imagePaths && part.imagePaths.length > 0 ? (
                        <img 
                          src={getImageUrl(part.imagePaths[0])} 
                          alt={part.partName} 
                          className="part-thumb-img"
                        />
                      ) : (
                        <div className="part-thumb-fallback">⚙️</div>
                      )}
                    </div>
                    <div className="part-info-wrap">
                      <div className="part-name-row">
                        <h4 className="part-name">{part.partName}</h4>
                        <span className={`status-pill ${part.isPublished ? 'pill-published' : 'pill-draft'}`}>
                          {part.isPublished ? 'Published' : 'Draft'}
                        </span>
                      </div>
                      <div className="part-meta-row">
                        <span>P/N: <code>{part.partNumber}</code></span>
                        <span>·</span>
                        <span>{part.category}</span>
                        <span>·</span>
                        <strong className="part-price">₹{Number(part.price || 0).toLocaleString('en-IN')}</strong>
                      </div>
                    </div>
                    <div className="part-actions-wrap">
                      <Link to={`/owner/inventory/${part._id}/edit`} className="btn-link-edit" title="Edit part details">
                        Edit
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Column B: Recent Customer Enquiries */}
          <div className="dashboard-card customer-enquiries-card">
            <div className="card-header-row">
              <div className="card-title-group">
                <span className="card-icon">💬</span>
                <h3>Customer Enquiries</h3>
              </div>
              <Link to="/owner/enquiries" className="card-header-link">
                View Enquiries Inbox →
              </Link>
            </div>

            {recentEnquiries.length > 0 ? (
              <div className="dash-enquiries-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                {recentEnquiries.map((enq) => (
                  <div
                    key={enq._id}
                    style={{
                      background: 'var(--color-surface-subtle, #f8fafc)',
                      border: '1px solid var(--color-border, #e2e8f0)',
                      borderRadius: '8px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '13.5px', color: 'var(--color-navy-primary, #0f172a)' }}>
                        {enq.customerName}
                      </strong>
                      <span
                        className="badge"
                        style={{
                          fontSize: '10.5px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontWeight: 700,
                          background: enq.status === 'NEW' ? '#ffedd5' : '#e0f2fe',
                          color: enq.status === 'NEW' ? '#c2410c' : '#0369a1'
                        }}
                      >
                        {enq.status}
                      </span>
                    </div>
                    {enq.sparePartId && (
                      <span style={{ fontSize: '12px', color: 'var(--color-text-muted, #64748b)' }}>
                        ⚙️ {enq.sparePartId.partName}
                      </span>
                    )}
                    <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      "{enq.subject}"
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '11px', color: '#94a3b8' }}>
                      <span>{new Date(enq.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                      <Link to="/owner/enquiries" style={{ color: '#ea580c', fontWeight: 600, textDecoration: 'none' }}>
                        Reply →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dash-empty-state">
                <span className="dash-empty-icon">📫</span>
                <h4>No customer enquiries received yet</h4>
                <p>
                  Inquiries and compatibility questions sent by vehicle owners regarding your spare parts catalog will appear here.
                </p>
                <Link to="/owner/inventory" className="btn btn-outline btn-sm" style={{ marginTop: '12px' }}>
                  Check Published Parts
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent Notifications Section */}
        <div className="dashboard-card recent-notifs-card" style={{ marginTop: '24px' }}>
          <div className="card-header-row">
            <div className="card-title-group">
              <span className="card-icon">🔔</span>
              <h3>Recent Store Notifications</h3>
              {unreadCount > 0 && (
                <span className="badge badge-orange">{unreadCount} Unread</span>
              )}
            </div>
            <Link to="/owner/notifications" className="card-header-link">
              View All Notifications →
            </Link>
          </div>

          {notifications.length === 0 ? (
            <div className="dash-empty-state">
              <span className="dash-empty-icon">🔕</span>
              <h4>No notifications right now</h4>
              <p>You will be notified whenever there are application updates, catalog changes, or low-stock alerts.</p>
            </div>
          ) : (
            <div className="dash-notif-list">
              {notifications.slice(0, 4).map((n) => (
                <div key={n._id} className={`dash-notif-item ${n.isRead ? 'read' : 'unread'}`}>
                  <div className="dash-notif-icon">
                    {n.type?.includes('STOCK') ? '⚠️' : n.type?.includes('PART') ? '📦' : n.type?.includes('APPLICATION') ? '🏬' : '🔔'}
                  </div>
                  <div className="dash-notif-body">
                    <div className="dash-notif-top">
                      <strong>{n.title}</strong>
                      <span className="dash-notif-date">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="dash-notif-msg">{n.message}</p>
                  </div>
                  {!n.isRead && (
                    <button
                      type="button"
                      className="btn-mark-read-mini"
                      onClick={() => handleMarkRead(n._id)}
                      title="Mark as read"
                    >
                      ✓
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OwnerDashboardPage;
