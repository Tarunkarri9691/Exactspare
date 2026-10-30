import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchUserProfile, updateUserProfile, changePassword } from '../services/api';
import './OwnerSettingsPage.css';

export default function OwnerSettingsPage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const outletContext = useOutletContext() || {};

  // Merchant Profile State
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email] = useState(user?.email || '');

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState('');
  const [passwordErrorMsg, setPasswordErrorMsg] = useState('');

  // Notification Preferences State
  const [notifyOrders, setNotifyOrders] = useState(() => {
    const saved = localStorage.getItem('exactspare_owner_notify_orders');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [notifyLowStock, setNotifyLowStock] = useState(() => {
    const saved = localStorage.getItem('exactspare_owner_notify_lowstock');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [notifyInquiries, setNotifyInquiries] = useState(() => {
    const saved = localStorage.getItem('exactspare_owner_notify_inquiries');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [prefSavedMsg, setPrefSavedMsg] = useState('');

  // Logout modal state
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // General Page State
  const [loading, setLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const [profileErrorMsg, setProfileErrorMsg] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchUserProfile()
      .then((res) => {
        if (res.success && res.data) {
          if (res.data.name) setName(res.data.name);
          if (res.data.phone) setPhone(res.data.phone);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSuccessMsg('');
    setProfileErrorMsg('');

    if (!name.trim() || name.trim().length < 2) {
      setProfileErrorMsg('Full legal name must be at least 2 characters long.');
      return;
    }

    if (phone.trim() && !/^[0-9+()\- ]{7,20}$/.test(phone.trim())) {
      setProfileErrorMsg('Please enter a valid phone number (at least 7 to 15 digits).');
      return;
    }

    try {
      setSavingProfile(true);
      const res = await updateUserProfile({
        name: name.trim(),
        phone: phone.trim()
      });

      if (res.success) {
        setProfileSuccessMsg('Store representative profile updated successfully!');
        if (refreshUser) await refreshUser();
        setTimeout(() => setProfileSuccessMsg(''), 4000);
      } else {
        setProfileErrorMsg(res.error || 'Failed to update profile settings.');
      }
    } catch {
      setProfileErrorMsg('An unexpected error occurred while saving profile settings.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordSuccessMsg('');
    setPasswordErrorMsg('');

    if (!currentPassword) {
      setPasswordErrorMsg('Please enter your current account password.');
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setPasswordErrorMsg('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg('New password and confirmation do not match.');
      return;
    }

    try {
      setChangingPassword(true);
      const res = await changePassword({
        currentPassword,
        newPassword,
        confirmPassword
      });

      if (res.success) {
        setPasswordSuccessMsg('Account password changed successfully! Your merchant session is secured.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordSuccessMsg(''), 5000);
      } else {
        setPasswordErrorMsg(res.error || 'Failed to update account password. Please verify current password.');
      }
    } catch {
      setPasswordErrorMsg('An unexpected network error occurred while updating password.');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSavePreferences = () => {
    localStorage.setItem('exactspare_owner_notify_orders', JSON.stringify(notifyOrders));
    localStorage.setItem('exactspare_owner_notify_lowstock', JSON.stringify(notifyLowStock));
    localStorage.setItem('exactspare_owner_notify_inquiries', JSON.stringify(notifyInquiries));
    setPrefSavedMsg('Notification preferences saved successfully!');
    setTimeout(() => setPrefSavedMsg(''), 3500);
  };

  const handleConfirmLogout = () => {
    logout();
    navigate('/login');
  };

  const shop = outletContext.shop;
  const isApproved = outletContext.isApproved;
  const appStatus = outletContext.applicationStatus;

  return (
    <div className="owner-settings-root">
      <div className="container owner-settings-container">
        {/* Navigation Breadcrumb */}
        <div className="settings-breadcrumb">
          <Link to="/owner/dashboard">← Back to Owner Dashboard</Link>
        </div>

        {/* Header */}
        <div className="settings-header-card">
          <div className="settings-header-text">
            <div className="settings-badge-row">
              <span className="badge badge-orange">Merchant Settings</span>
              <span className="badge badge-navy">Role: OWNER</span>
              {isApproved && <span className="badge badge-green">✓ Verified Merchant</span>}
            </div>
            <h1 className="settings-title">Shop Owner Settings & Preferences</h1>
            <p className="settings-subtitle">
              Manage your personal merchant profile, change account password securely, configure notification alerts, and view storefront operational status.
            </p>
          </div>
        </div>

        <div className="settings-grid">
          {/* Section 1: Merchant Profile Details */}
          <div className="settings-card">
            <div className="settings-card-head">
              <div className="head-icon">👤</div>
              <div>
                <h3>Authorized Representative Profile</h3>
                <p>Personal credentials associated with your merchant account.</p>
              </div>
            </div>

            {profileSuccessMsg && (
              <div className="settings-alert alert-success fade-in">
                <span>✓ {profileSuccessMsg}</span>
              </div>
            )}

            {profileErrorMsg && (
              <div className="settings-alert alert-error fade-in">
                <span>⚠️ {profileErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="settings-form">
              <div className="form-group">
                <label htmlFor="owner-name-input">Full Legal Name *</label>
                <input
                  type="text"
                  id="owner-name-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Owner / Representative Full Name"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="owner-email-input">
                  Registered Account Email <span className="label-sub">(Verified)</span>
                </label>
                <input
                  type="email"
                  id="owner-email-input"
                  value={email || user?.email || ''}
                  disabled
                  className="input-disabled"
                />
                <span className="input-hint">Email is linked to platform security and cannot be changed directly.</span>
              </div>

              <div className="form-group">
                <label htmlFor="owner-phone-input">Contact Mobile Number</label>
                <input
                  type="tel"
                  id="owner-phone-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 9876543210"
                />
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingProfile || loading}
                  id="save-owner-profile-btn"
                >
                  {savingProfile ? 'Saving Changes...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Section 2: Storefront & Account Status */}
          <div className="settings-card">
            <div className="settings-card-head">
              <div className="head-icon">🏬</div>
              <div>
                <h3>Storefront & Account Status</h3>
                <p>Public business details visible to vehicle owners.</p>
              </div>
            </div>

            <div className="store-summary-content">
              {shop ? (
                <div className="store-details-box">
                  <div className="store-title-row">
                    <h4>{shop.name || shop.shopName}</h4>
                    <span className={`store-status-badge ${isApproved ? 'badge-approved' : 'badge-pending'}`}>
                      {isApproved ? '✓ Verified & Active' : 'Verification In Progress'}
                    </span>
                  </div>
                  <div className="store-meta-list">
                    <div><strong>Category:</strong> {shop.category || 'Multi-Category'}</div>
                    <div><strong>Store Address:</strong> {shop.address?.addressLine || 'Shop address configured'}, {shop.address?.city || ''}</div>
                    <div><strong>Operating Hours:</strong> {shop.openingHours || 'Mon-Sat: 09:00 AM - 08:00 PM'}</div>
                    <div><strong>Catalog Visibility:</strong> {isApproved ? 'Publicly Searchable' : 'Unpublished until Approval'}</div>
                  </div>
                  <div className="store-action-row" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <Link to="/owner/shop" className="btn btn-outline-navy btn-sm">
                      Manage Store Details & Photos →
                    </Link>
                    <Link to="/owner/location" className="btn btn-outline btn-sm">
                      📍 Adjust Store GPS Location →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="store-empty-box">
                  <p>No active shop storefront registered yet.</p>
                  <p className="subtext">
                    Current Application Status: <strong>{appStatus || 'NOT_SUBMITTED'}</strong>
                  </p>
                  <Link to="/owner/shop" className="btn btn-primary btn-sm">
                    Open Shop Profile →
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: In-Page Change Password */}
          <div className="settings-card">
            <div className="settings-card-head">
              <div className="head-icon">🔐</div>
              <div>
                <h3>Change Account Password</h3>
                <p>Update your merchant password using your existing password.</p>
              </div>
            </div>

            {passwordSuccessMsg && (
              <div className="settings-alert alert-success fade-in">
                <span>✓ {passwordSuccessMsg}</span>
              </div>
            )}

            {passwordErrorMsg && (
              <div className="settings-alert alert-error fade-in">
                <span>⚠️ {passwordErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="settings-form">
              <div className="form-group">
                <label htmlFor="owner-current-password">Current Password *</label>
                <input
                  type={showPasswordFields ? 'text' : 'password'}
                  id="owner-current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="owner-new-password">New Password *</label>
                <input
                  type={showPasswordFields ? 'text' : 'password'}
                  id="owner-new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters (letters & numbers)"
                  minLength={8}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="owner-confirm-password">Confirm New Password *</label>
                <input
                  type={showPasswordFields ? 'text' : 'password'}
                  id="owner-confirm-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  minLength={8}
                  required
                />
              </div>

              <div className="password-toggle-row">
                <label className="checkbox-label-inline">
                  <input
                    type="checkbox"
                    checked={showPasswordFields}
                    onChange={(e) => setShowPasswordFields(e.target.checked)}
                  />
                  <span>Show Passwords</span>
                </label>
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={changingPassword}
                  id="owner-change-password-btn"
                >
                  {changingPassword ? 'Verifying & Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>

          {/* Section 4: Merchant Notification Channels */}
          <div className="settings-card">
            <div className="settings-card-head">
              <div className="head-icon">🔔</div>
              <div>
                <h3>Notification Preferences</h3>
                <p>Select which operational events trigger platform alerts.</p>
              </div>
            </div>

            {prefSavedMsg && (
              <div className="settings-alert alert-success fade-in">
                <span>✓ {prefSavedMsg}</span>
              </div>
            )}

            <div className="preferences-list">
              <label className="pref-item">
                <input
                  type="checkbox"
                  checked={notifyOrders}
                  onChange={(e) => setNotifyOrders(e.target.checked)}
                />
                <div>
                  <strong>New Customer Orders</strong>
                  <p>Receive notifications when a customer purchases spare parts from your shop.</p>
                </div>
              </label>

              <label className="pref-item">
                <input
                  type="checkbox"
                  checked={notifyLowStock}
                  onChange={(e) => setNotifyLowStock(e.target.checked)}
                />
                <div>
                  <strong>Low Stock Inventory Alerts</strong>
                  <p>Notify when spare parts drop below recommended threshold (≤ 3 units).</p>
                </div>
              </label>

              <label className="pref-item">
                <input
                  type="checkbox"
                  checked={notifyInquiries}
                  onChange={(e) => setNotifyInquiries(e.target.checked)}
                />
                <div>
                  <strong>Customer Compatibility Inquiries</strong>
                  <p>Notify when customers ask questions regarding vehicle part fitment.</p>
                </div>
              </label>

              <div className="form-actions" style={{ marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-outline-navy"
                  onClick={handleSavePreferences}
                >
                  Save Notification Preferences
                </button>
              </div>
            </div>
          </div>

          {/* Section 5: Account Session & Logout */}
          <div className="settings-card" style={{ gridColumn: '1 / -1' }}>
            <div className="settings-card-head">
              <div className="head-icon">🚪</div>
              <div>
                <h3>Merchant Session & Logout</h3>
                <p>Securely end your shop owner session on this device.</p>
              </div>
            </div>

            <div className="logout-card-content">
              <div>
                <strong>Active Session: {user?.email}</strong>
                <p className="session-hint">
                  Signing out clears your stored credentials from this browser. You can log back in at any time with your email and password.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setShowLogoutConfirm(true)}
                id="owner-logout-btn"
              >
                Sign Out of Merchant Portal
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="modal-backdrop fade-in">
          <div className="modal-card">
            <h3>Confirm Merchant Sign Out</h3>
            <p>
              Are you sure you want to log out of your EXACTSPARE Shop Owner account? Any unsaved edits will be discarded.
            </p>
            <div className="modal-actions-row">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmLogout}
              >
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
