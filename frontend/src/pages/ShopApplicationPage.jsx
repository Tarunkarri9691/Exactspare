import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  createShopApplication, 
  updateShopApplication, 
  fetchMyApplication 
} from '../services/api';
import LocationPickerMap from '../components/LocationPickerMap';
import './ShopApplicationPage.css';

const CATEGORIES = [
  { value: 'MULTI_CATEGORY', label: 'All Vehicles / Multi-Category Spares' },
  { value: 'BIKE', label: 'Motorcycles & Sports Bikes' },
  { value: 'CAR', label: 'Cars & 4-Wheelers' },
  { value: 'SCOOTER', label: 'Scooters & E-Scooters' },
  { value: 'BICYCLE', label: 'Bicycles & Geared Cycles' },
  { value: 'OTHER', label: 'Commercial & Other Vehicles' }
];

const ShopApplicationPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [existingAppId, setExistingAppId] = useState(null);
  const [appStatus, setAppStatus] = useState(null);
  const [adminCorrectionMessage, setAdminCorrectionMessage] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    shopName: '',
    ownerFullName: user?.name || '',
    ownerPhone: user?.phone || '',
    businessEmail: user?.email || '',
    shopDescription: '',
    shopCategory: 'MULTI_CATEGORY',
    addressLine: '',
    city: '',
    state: '',
    postalCode: '',
    latitude: 28.6139,
    longitude: 77.2090,
    openingHours: 'Mon-Sat: 09:00 AM - 08:00 PM'
  });

  // Upload state
  const [shopImageFiles, setShopImageFiles] = useState([]);
  const [shopImagePreviews, setShopImagePreviews] = useState([]);
  const [existingShopImages, setExistingShopImages] = useState([]);

  const [documentFiles, setDocumentFiles] = useState([]);
  const [documentPreviews, setDocumentPreviews] = useState([]);
  const [existingDocuments, setExistingDocuments] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // Load existing application if already drafted or submitted
  useEffect(() => {
    const loadApplication = async () => {
      try {
        setLoadingInitial(true);
        const res = await fetchMyApplication();
        if (res.success && res.hasApplication && res.application) {
          const app = res.application;
          setExistingAppId(app._id);
          setAppStatus(app.status);
          setAdminCorrectionMessage(app.correctionMessage || '');

          setFormData({
            shopName: app.shopName || '',
            ownerFullName: app.ownerFullName || user?.name || '',
            ownerPhone: app.ownerPhone || user?.phone || '',
            businessEmail: app.businessEmail || user?.email || '',
            shopDescription: app.shopDescription || '',
            shopCategory: app.shopCategory || 'MULTI_CATEGORY',
            addressLine: app.addressLine || '',
            city: app.city || '',
            state: app.state || '',
            postalCode: app.postalCode || '',
            latitude: Number(app.latitude) || 28.6139,
            longitude: Number(app.longitude) || 77.2090,
            openingHours: app.openingHours || 'Mon-Sat: 09:00 AM - 08:00 PM'
          });

          setExistingShopImages(app.shopImagePaths || []);
          setExistingDocuments(app.verificationDocumentPaths || []);
        }
      } catch (err) {
        console.error('Error loading existing application:', err);
      } finally {
        setLoadingInitial(false);
      }
    };

    loadApplication();
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLocationChange = ({ latitude, longitude }) => {
    setFormData(prev => ({
      ...prev,
      latitude,
      longitude
    }));
  };

  // File Upload Handlers with Previews
  const handleShopImagesChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (shopImageFiles.length + files.length + existingShopImages.length > 5) {
      setErrorMessage('You can upload a maximum of 5 shop photographs.');
      return;
    }

    const newFiles = [...shopImageFiles, ...files];
    setShopImageFiles(newFiles);

    // Generate previews
    const newPreviews = files.map(file => ({
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(2),
      url: URL.createObjectURL(file)
    }));
    setShopImagePreviews(prev => [...prev, ...newPreviews]);
  };

  const removeSelectedImage = (index) => {
    setShopImageFiles(prev => prev.filter((_, i) => i !== index));
    setShopImagePreviews(prev => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleDocumentsChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (documentFiles.length + files.length + existingDocuments.length > 3) {
      setErrorMessage('You can upload a maximum of 3 verification documents.');
      return;
    }

    const newFiles = [...documentFiles, ...files];
    setDocumentFiles(newFiles);

    const newPreviews = files.map(file => ({
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(2),
      type: file.type.includes('pdf') ? 'PDF' : 'IMAGE'
    }));
    setDocumentPreviews(prev => [...prev, ...newPreviews]);
  };

  const removeSelectedDocument = (index) => {
    setDocumentFiles(prev => prev.filter((_, i) => i !== index));
    setDocumentPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitAction = async (actionType) => {
    setErrorMessage('');
    setSuccessNotice('');
    setValidationErrors([]);

    // Client-side quick check
    if (!formData.shopName.trim()) {
      setErrorMessage('Please enter a shop name.');
      return;
    }

    if (actionType === 'SUBMIT') {
      if (!formData.addressLine.trim() || !formData.city.trim() || !formData.postalCode.trim()) {
        setErrorMessage('Please complete all address fields before submitting.');
        return;
      }
      if (shopImageFiles.length === 0 && existingShopImages.length === 0) {
        setErrorMessage('Please upload at least one storefront photo of your shop.');
        return;
      }
    }

    try {
      setSubmitting(true);

      const data = new FormData();
      Object.keys(formData).forEach(key => {
        data.append(key, formData[key]);
      });
      data.append('action', actionType);

      shopImageFiles.forEach(file => {
        data.append('shopImages', file);
      });

      documentFiles.forEach(file => {
        data.append('verificationDocuments', file);
      });

      let res;
      if (existingAppId) {
        res = await updateShopApplication(existingAppId, data);
      } else {
        res = await createShopApplication(data);
      }

      if (res.success) {
        if (actionType === 'SUBMIT') {
          setSubmittedSuccess(true);
        } else {
          setSuccessNotice('Application draft saved successfully. You can return anytime to submit it.');
          if (res.data?.application?._id) {
            setExistingAppId(res.data.application._id);
          }
        }
      } else {
        setErrorMessage(res.error || 'Failed to process application.');
        if (res.errors) {
          setValidationErrors(res.errors);
        }
      }
    } catch {
      setErrorMessage('An unexpected error occurred while communicating with the server.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="application-page-root">
        <div className="container app-status-loading">
          <div className="auth-spinner">
            <svg viewBox="0 0 32 32" fill="none" className="spin-cog">
              <circle cx="16" cy="16" r="10" stroke="var(--color-orange-primary)" strokeWidth="3" strokeDasharray="3 1.5"/>
              <circle cx="16" cy="16" r="4" fill="var(--color-navy-primary)"/>
            </svg>
          </div>
          <h3>Loading Application Details...</h3>
        </div>
      </div>
    );
  }

  // If application is already PENDING review
  if (appStatus === 'PENDING' && !submittedSuccess) {
    return (
      <div className="application-page-root">
        <div className="container app-message-container">
          <div className="app-status-card pending-card fade-in">
            <div className="status-large-icon pending-icon">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <h2>Application Currently Under Review</h2>
            <p>
              Your shop registration application for <strong>{formData.shopName}</strong> was submitted and is currently being evaluated by our platform administrators.
            </p>
            <div className="status-explanation-box">
              <span className="badge badge-orange">Status: PENDING</span>
              <p>Applications cannot be edited while in review. You will receive an in-app alert once a decision is made.</p>
            </div>
            <div className="status-action-btns">
              <Link to="/owner/dashboard" className="btn btn-primary">
                Return to Owner Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If application is already APPROVED
  if (appStatus === 'APPROVED' && !submittedSuccess) {
    return (
      <div className="application-page-root">
        <div className="container app-message-container">
          <div className="app-status-card approved-card fade-in">
            <div className="status-large-icon approved-icon">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <h2>Shop Application Verified & Approved!</h2>
            <p>
              Your store <strong>{formData.shopName}</strong> is verified and active on the EXACTSPARE network.
            </p>
            <div className="status-action-btns">
              <Link to="/owner/dashboard" className="btn btn-primary">
                Open Owner Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Confirmation screen upon immediate submission
  if (submittedSuccess) {
    return (
      <div className="application-page-root">
        <div className="container app-message-container">
          <div className="app-status-card success-card fade-in">
            <div className="status-large-icon success-icon">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <h2>Application Submitted for Review!</h2>
            <p>
              Thank you for applying to list <strong>{formData.shopName}</strong> on EXACTSPARE.
            </p>
            <p className="subtext">
              Our administrative compliance team will inspect your location, shop photos, and trade verification documents. You can monitor progress on your Owner Dashboard.
            </p>
            <div className="status-action-btns">
              <Link to="/owner/dashboard" className="btn btn-primary">
                Go to Owner Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="application-page-root">
      <div className="container app-form-container">
        <div className="app-header-block">
          <div className="app-badge-row">
            <span className="badge badge-orange">Merchant Verification</span>
            {appStatus === 'NEEDS_CORRECTION' && (
              <span className="badge badge-navy">Re-submission Mode</span>
            )}
          </div>
          <h1 className="app-main-title">
            {existingAppId ? 'Update Shop Registration Application' : 'Register Your Spare Parts Retail Shop'}
          </h1>
          <p className="app-main-subtitle">
            Provide your automotive store details, geolocation pin, storefront photos, and trade verification documents.
          </p>
        </div>

        {/* Correction Feedback Notice */}
        {appStatus === 'NEEDS_CORRECTION' && adminCorrectionMessage && (
          <div className="correction-feedback-card fade-in">
            <div className="feedback-icon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <div className="feedback-body">
              <h4>Administrator Requested Revisions</h4>
              <p>{adminCorrectionMessage}</p>
              <span className="subtext">Please update the requested sections below and click "Submit Application" to resubmit.</span>
            </div>
          </div>
        )}

        {successNotice && (
          <div className="auth-alert success-alert fade-in" style={{ borderColor: 'var(--color-status-approved)', color: 'var(--color-status-approved)' }}>
            <span>{successNotice}</span>
          </div>
        )}

        {errorMessage && (
          <div className="auth-alert error-alert fade-in">
            <span>{errorMessage}</span>
          </div>
        )}

        {validationErrors.length > 0 && (
          <div className="validation-errors-box fade-in">
            <h4>Please resolve the following required fields:</h4>
            <ul>
              {validationErrors.map((err, i) => (
                <li key={i}>{typeof err === 'object' ? err.message || err.field : err}</li>
              ))}
            </ul>
          </div>
        )}

        <form className="app-multisection-form" onSubmit={(e) => e.preventDefault()}>
          {/* SECTION A: OWNER INFORMATION */}
          <section className="form-card-section">
            <div className="section-head">
              <span className="section-number">A</span>
              <div>
                <h3>Owner & Authorized Representative Information</h3>
                <p>Contact person details for official verification and communication.</p>
              </div>
            </div>

            <div className="form-grid-3">
              <div className="form-group">
                <label htmlFor="ownerFullName">Full Legal Name *</label>
                <input
                  id="ownerFullName"
                  name="ownerFullName"
                  type="text"
                  className="form-input"
                  value={formData.ownerFullName}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="ownerPhone">Contact Phone Number *</label>
                <input
                  id="ownerPhone"
                  name="ownerPhone"
                  type="tel"
                  className="form-input"
                  value={formData.ownerPhone}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="businessEmail">Business Email *</label>
                <input
                  id="businessEmail"
                  name="businessEmail"
                  type="email"
                  className="form-input"
                  value={formData.businessEmail}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
          </section>

          {/* SECTION B: SHOP INFORMATION */}
          <section className="form-card-section">
            <div className="section-head">
              <span className="section-number">B</span>
              <div>
                <h3>Shop Details & Address</h3>
                <p>Public store name and physical street address for customer store discovery.</p>
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="shopName">Shop / Store Name *</label>
                <input
                  id="shopName"
                  name="shopName"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Apex Auto Spares & Accessories"
                  value={formData.shopName}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="shopCategory">Vehicle Category Specialization *</label>
                <select
                  id="shopCategory"
                  name="shopCategory"
                  className="form-select"
                  value={formData.shopCategory}
                  onChange={handleInputChange}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="shopDescription">Shop Description & Specialization *</label>
              <textarea
                id="shopDescription"
                name="shopDescription"
                className="form-textarea"
                rows="3"
                placeholder="Describe your inventory, brands offered (Bosch, Brembo, Motul, etc.), and vehicle expertise..."
                value={formData.shopDescription}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="addressLine">Street Address / Shop Number / Landmark *</label>
              <input
                id="addressLine"
                name="addressLine"
                type="text"
                className="form-input"
                placeholder="e.g. Shop #14, Motor Market, Main Ring Road"
                value={formData.addressLine}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-grid-3">
              <div className="form-group">
                <label htmlFor="city">City *</label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Mumbai"
                  value={formData.city}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="state">State / Province *</label>
                <input
                  id="state"
                  name="state"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Maharashtra"
                  value={formData.state}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="postalCode">Postal Code / PIN *</label>
                <input
                  id="postalCode"
                  name="postalCode"
                  type="text"
                  className="form-input"
                  placeholder="e.g. 400001"
                  value={formData.postalCode}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
          </section>

          {/* SECTION C: GEOLOCATION & MAP */}
          <section className="form-card-section">
            <div className="section-head">
              <span className="section-number">C</span>
              <div>
                <h3>Shop Geolocation (Map & Coordinates)</h3>
                <p>Pinpoint your exact shop location so nearby vehicle owners can find your store.</p>
              </div>
            </div>

            <div className="map-wrapper-card">
              <LocationPickerMap
                latitude={formData.latitude}
                longitude={formData.longitude}
                onChange={handleLocationChange}
                height="340px"
              />

              <div className="coordinates-manual-row">
                <div className="form-group">
                  <label htmlFor="latitude">Latitude (Decimal)</label>
                  <input
                    id="latitude"
                    name="latitude"
                    type="number"
                    step="0.000001"
                    className="form-input"
                    value={formData.latitude}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="longitude">Longitude (Decimal)</label>
                  <input
                    id="longitude"
                    name="longitude"
                    type="number"
                    step="0.000001"
                    className="form-input"
                    value={formData.longitude}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
            </div>
          </section>

          {/* SECTION D: BUSINESS INFORMATION */}
          <section className="form-card-section">
            <div className="section-head">
              <span className="section-number">D</span>
              <div>
                <h3>Business Hours</h3>
                <p>Specify operating days and shop opening hours for customer pickup.</p>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="openingHours">Operating Days & Working Hours *</label>
              <input
                id="openingHours"
                name="openingHours"
                type="text"
                className="form-input"
                placeholder="e.g. Mon-Sat: 09:00 AM - 08:30 PM (Sun Closed)"
                value={formData.openingHours}
                onChange={handleInputChange}
                required
              />
            </div>
          </section>

          {/* SECTION E: IMAGES & VERIFICATION DOCUMENTS */}
          <section className="form-card-section">
            <div className="section-head">
              <span className="section-number">E</span>
              <div>
                <h3>Storefront Photographs & Legal Documents</h3>
                <p>Upload storefront photos (publicly viewable upon approval) and optional trade verification documents (strictly private to admins).</p>
              </div>
            </div>

            {/* Shop Photos */}
            <div className="upload-subsection">
              <label className="upload-label">
                Shop Photographs (Max 5 images: JPG, PNG, WebP) *
              </label>
              <p className="upload-subtext">Clear photo showing your shop board, counter, and spare parts shelves.</p>

              <div className="file-input-wrapper">
                <input
                  type="file"
                  id="shop-images-input"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleShopImagesChange}
                  className="file-native-input"
                />
                <label htmlFor="shop-images-input" className="file-dropzone-button">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                  <span>Select Storefront Photos</span>
                </label>
              </div>

              {/* Image Previews */}
              <div className="previews-grid">
                {existingShopImages.map((imgPath, i) => (
                  <div key={`exist-${i}`} className="preview-tile existing-tile">
                    <img 
                      src={`http://localhost:5000/${imgPath}`} 
                      alt="Uploaded shop" 
                      className="preview-img" 
                    />
                    <span className="existing-tag">On File</span>
                  </div>
                ))}

                {shopImagePreviews.map((p, i) => (
                  <div key={`new-${i}`} className="preview-tile">
                    <img src={p.url} alt="Preview" className="preview-img" />
                    <button
                      type="button"
                      className="remove-preview-btn"
                      onClick={() => removeSelectedImage(i)}
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                    <span className="file-size-badge">{p.size} MB</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Verification Documents */}
            <div className="upload-subsection">
              <label className="upload-label">
                Business Verification Documents (Max 3 documents: PDF, JPG, PNG)
              </label>
              <p className="upload-subtext">Trade license, GST registration, or local municipal merchant permit. Kept strictly confidential and inaccessible to public users.</p>

              <div className="file-input-wrapper">
                <input
                  type="file"
                  id="documents-input"
                  multiple
                  accept=".pdf,image/jpeg,image/png"
                  onChange={handleDocumentsChange}
                  className="file-native-input"
                />
                <label htmlFor="documents-input" className="file-dropzone-button doc-dropzone">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  <span>Select Verification Documents (PDF / Image)</span>
                </label>
              </div>

              {/* Document Previews */}
              <div className="documents-list-box">
                {existingDocuments.map((docPath, i) => (
                  <div key={`exist-doc-${i}`} className="doc-item-row">
                    <span className="doc-icon">📄</span>
                    <span className="doc-name">{docPath.split('/').pop()}</span>
                    <span className="existing-tag">On File (Private)</span>
                  </div>
                ))}

                {documentPreviews.map((doc, i) => (
                  <div key={`new-doc-${i}`} className="doc-item-row">
                    <span className="doc-icon">{doc.type === 'PDF' ? '📑' : '🖼️'}</span>
                    <span className="doc-name">{doc.name} ({doc.size} MB)</span>
                    <button
                      type="button"
                      className="remove-doc-btn"
                      onClick={() => removeSelectedDocument(i)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* SUBMISSION ACTION BUTTONS */}
          <div className="app-actions-footer">
            <button
              type="button"
              className="btn btn-outline draft-save-btn"
              onClick={() => handleSubmitAction('SAVE_DRAFT')}
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Save Application Draft'}
            </button>

            <button
              type="button"
              className="btn btn-primary submit-final-btn"
              onClick={() => handleSubmitAction('SUBMIT')}
              disabled={submitting}
              id="submit-shop-application-btn"
            >
              {submitting ? 'Submitting to Administrator...' : 'Submit Application for Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ShopApplicationPage;
