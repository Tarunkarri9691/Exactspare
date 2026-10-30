import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVehicle } from '../context/VehicleContext';
import { fetchUserProfile, updateUserProfile } from '../services/api';
import './CustomerSettingsPage.css';

export default function CustomerSettingsPage() {
  const { user, logout, refreshUser } = useAuth();
  const { selectedVehicle, openVehicleModal, clearVehicle } = useVehicle();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [defaultCity, setDefaultCity] = useState(user?.defaultLocation?.city || '');
  const [defaultPin, setDefaultPin] = useState(user?.defaultLocation?.postalCode || '');

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchUserProfile().then((res) => {
      if (res.success && res.data) {
        if (res.data.name) setName(res.data.name);
        if (res.data.phone) setPhone(res.data.phone);
        if (res.data.defaultLocation?.city) setDefaultCity(res.data.defaultLocation.city);
        if (res.data.defaultLocation?.postalCode) setDefaultPin(res.data.defaultLocation.postalCode);
      }
    });
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (!name.trim() || name.trim().length < 2) {
      setErrorMsg('Full name must be at least 2 characters long.');
      return;
    }

    if (phone.trim() && !/^[0-9+()\- ]{7,20}$/.test(phone.trim())) {
      setErrorMsg('Please enter a valid phone number.');
      return;
    }

    setSaving(true);
    try {
      const res = await updateUserProfile({
        name: name.trim(),
        phone: phone.trim(),
        defaultLocation: {
          city: defaultCity.trim(),
          postalCode: defaultPin.trim()
        }
      });

      if (res.success) {
        setSuccessMsg('Account profile and preferences saved successfully!');
        if (refreshUser) refreshUser();
      } else {
        setErrorMsg(res.error || 'Failed to update profile settings.');
      }
    } catch {
      setErrorMsg('Network error while saving settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="settings-page-root">
      <div className="container settings-container">
        {/* Header */}
        <div className="settings-header">
          <div>
            <span className="badge badge-navy">Customer Workspace</span>
            <h1 className="settings-title">Account & Preferences Settings</h1>
            <p className="settings-subtitle">
              Manage your personal profile, vehicle garage, default search location, and account security.
            </p>
          </div>
          <button type="button" className="btn btn-outline-white btn-logout-danger" onClick={handleLogout}>
            Sign Out
          </button>
        </div>

        {successMsg && (
          <div className="alert-banner alert-banner-success fade-in">
            <span>✓ {successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="alert-banner alert-banner-danger fade-in">
            <span>⚠️ {errorMsg}</span>
          </div>
        )}

        <div className="settings-grid">
          {/* Left Column: Personal Profile */}
          <div className="settings-card">
            <div className="settings-card-head">
              <h3>Personal Profile</h3>
              <p>Your identity details across customer orders and shop communications.</p>
            </div>

            <form onSubmit={handleSaveProfile} className="settings-form">
              <div className="form-group">
                <label htmlFor="settings-name" className="form-label">Full Name</label>
                <input
                  id="settings-name"
                  type="text"
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="settings-email" className="form-label">Email Address</label>
                <div className="input-readonly-row">
                  <input
                    id="settings-email"
                    type="email"
                    className="form-control"
                    value={user?.email || ''}
                    disabled
                  />
                  {user?.isEmailVerified ? (
                    <span className="badge-verified">✓ Verified</span>
                  ) : (
                    <span className="badge-unverified">Unverified</span>
                  )}
                </div>
                <span className="field-hint">Email address is your primary account login identifier.</span>
              </div>

              <div className="form-group">
                <label htmlFor="settings-phone" className="form-label">Mobile Number</label>
                <input
                  id="settings-phone"
                  type="text"
                  className="form-control"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 9876543210"
                />
                <span className="field-hint">Used by nearby shops for order collection updates.</span>
              </div>

              <div className="settings-form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="settings-city" className="form-label">Preferred City</label>
                  <input
                    id="settings-city"
                    type="text"
                    className="form-control"
                    value={defaultCity}
                    onChange={(e) => setDefaultCity(e.target.value)}
                    placeholder="e.g. Mumbai, Pune, Delhi..."
                  />
                </div>
                <div className="form-group" style={{ width: '130px' }}>
                  <label htmlFor="settings-pin" className="form-label">Postal Code</label>
                  <input
                    id="settings-pin"
                    type="text"
                    className="form-control"
                    value={defaultPin}
                    onChange={(e) => setDefaultPin(e.target.value)}
                    placeholder="e.g. 400001"
                    maxLength={10}
                  />
                </div>
              </div>

              <div className="settings-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                  id="btn-save-customer-settings"
                >
                  {saving ? 'Saving Preferences...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Vehicle Compatibility & Security */}
          <div className="settings-sidebar-col">
            {/* Active Vehicle Card */}
            <div className="settings-card">
              <div className="settings-card-head">
                <h3>Vehicle Garage</h3>
                <p>Saved vehicle used for automatic spare-part compatibility matching.</p>
              </div>

              <div className="vehicle-current-display">
                <div className="vehicle-avatar">
                  {selectedVehicle?.vehicleType === 'Bike' ? '🏍️' :
                   selectedVehicle?.vehicleType === 'Scooter' ? '🛵' :
                   selectedVehicle?.vehicleType === 'Bicycle' ? '🚲' :
                   selectedVehicle?.vehicleType === 'Other' ? '🚚' : '🚗'}
                </div>
                <div className="vehicle-details">
                  <h4>
                    {selectedVehicle?.make || selectedVehicle?.model
                      ? `${selectedVehicle.make} ${selectedVehicle.model}`
                      : 'No Vehicle Configured'}
                  </h4>
                  <p>
                    Category: <strong>{selectedVehicle?.vehicleType || 'All Vehicles'}</strong>
                    {selectedVehicle?.year ? ` • Year: ${selectedVehicle.year}` : ''}
                    {selectedVehicle?.variant ? ` • Trim: ${selectedVehicle.variant}` : ''}
                  </p>
                </div>
              </div>

              <div className="vehicle-actions-row">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={openVehicleModal}
                >
                  Change Vehicle
                </button>
                {Boolean(selectedVehicle?.make || (selectedVehicle?.vehicleType && selectedVehicle.vehicleType !== 'ALL')) && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={clearVehicle}
                  >
                    Reset to All
                  </button>
                )}
              </div>
            </div>

            {/* Account Security Card */}
            <div className="settings-card">
              <div className="settings-card-head">
                <h3>Account Security</h3>
                <p>Manage your password credentials and session authentication.</p>
              </div>

              <div className="security-options-list">
                <div className="security-item">
                  <div>
                    <strong>Password</strong>
                    <p>Change your secure login password</p>
                  </div>
                  <Link to="/change-password" className="btn btn-outline btn-sm">
                    Update Password →
                  </Link>
                </div>

                <div className="security-item">
                  <div>
                    <strong>Customer Support</strong>
                    <p>Have issues with an order or product?</p>
                  </div>
                  <Link to="/support" className="btn btn-outline btn-sm">
                    Open Ticket →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
