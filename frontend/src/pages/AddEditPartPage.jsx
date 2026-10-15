import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchMyApprovedShop,
  fetchPartByIdApi,
  createPartApi,
  updatePartApi
} from '../services/api';
import './AddEditPartPage.css';

const CATEGORIES = [
  'Engine',
  'Brakes',
  'Transmission',
  'Suspension',
  'Electrical',
  'Body & Panels',
  'Steering',
  'Exhaust',
  'Lighting',
  'Cooling',
  'Fuel System',
  'Maintenance & Fluids',
  'Accessories',
  'Other'
];

const VEHICLE_TYPES = ['Bike', 'Car', 'Scooter', 'Bicycle', 'Other'];

const AddEditPartPage = () => {
  const { id } = useParams(); // If present, edit mode; else create mode
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [shopApproved, setShopApproved] = useState(false);
  const [shopStatusMessage, setShopStatusMessage] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    partName: '',
    description: '',
    category: 'Engine',
    subcategory: '',
    vehicleType: 'Car',
    compatibleMakes: '',
    compatibleModels: '',
    compatibleYears: '',
    engineDetails: '',
    manufacturer: '',
    partNumber: '',
    barcode: '',
    manufacturerPartNumber: '',
    condition: 'NEW',
    price: '',
    stockQuantity: '1',
    isPublished: true
  });

  // Images state
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [existingImages, setExistingImages] = useState([]);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [successNotice, setSuccessNotice] = useState('');

  useEffect(() => {
    const initPage = async () => {
      try {
        setLoadingInitial(true);
        // 1. Verify owner shop approval
        const shopRes = await fetchMyApprovedShop();
        if (!shopRes.success || !shopRes.data?.isApproved) {
          setShopApproved(false);
          setShopStatusMessage(
            shopRes.data?.message || 'Your shop must be approved by an administrator before you can publish spare parts.'
          );
          setLoadingInitial(false);
          return;
        }

        setShopApproved(true);

        // 2. If in Edit mode, load existing part data
        if (isEditMode) {
          const partRes = await fetchPartByIdApi(id);
          if (partRes.success && partRes.data?.part) {
            const p = partRes.data.part;
            setFormData({
              partName: p.partName || '',
              description: p.description || '',
              category: p.category || 'Engine',
              subcategory: p.subcategory || '',
              vehicleType: p.vehicleType || 'Car',
              compatibleMakes: Array.isArray(p.compatibleMakes) ? p.compatibleMakes.join(', ') : '',
              compatibleModels: Array.isArray(p.compatibleModels) ? p.compatibleModels.join(', ') : '',
              compatibleYears: Array.isArray(p.compatibleYears) ? p.compatibleYears.join(', ') : '',
              engineDetails: p.engineDetails || '',
              manufacturer: p.manufacturer || '',
              partNumber: p.partNumber || '',
              barcode: p.barcode || '',
              manufacturerPartNumber: p.manufacturerPartNumber || '',
              condition: p.condition || 'NEW',
              price: String(p.price ?? ''),
              stockQuantity: String(p.stockQuantity ?? ''),
              isPublished: p.isPublished ?? true
            });
            setExistingImages(p.imagePaths || []);
          } else {
            setErrorMessage(partRes.error || 'Failed to fetch spare part listing for editing.');
          }
        }
      } catch {
        setErrorMessage('Failed to initialize spare part form.');
      } finally {
        setLoadingInitial(false);
      }
    };

    initPage();
  }, [id, isEditMode]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear specific field error on change
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleFileSelection = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const totalCount = existingImages.length + selectedFiles.length + files.length;
    if (totalCount > 5) {
      setErrorMessage('You can upload a maximum of 5 images per spare part listing.');
      return;
    }

    const newFiles = [...selectedFiles, ...files];
    setSelectedFiles(newFiles);

    const newPreviews = files.map((file) => ({
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(2),
      url: URL.createObjectURL(file)
    }));
    setFilePreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFilePreviews((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const removeExistingImage = (imgPath) => {
    setExistingImages((prev) => prev.filter((img) => img !== imgPath));
  };

  const validateForm = () => {
    const errs = {};
    if (!formData.partName.trim()) errs.partName = 'Part name is required.';
    if (!formData.description.trim()) errs.description = 'Description is required.';
    if (!formData.category) errs.category = 'Category is required.';
    if (!formData.vehicleType) errs.vehicleType = 'Vehicle type is required.';
    if (!formData.manufacturer.trim()) errs.manufacturer = 'Manufacturer/brand is required.';
    if (!formData.partNumber.trim()) errs.partNumber = 'Part number is required.';

    const priceNum = parseFloat(formData.price);
    if (isNaN(priceNum) || priceNum < 0) {
      errs.price = 'Please enter a valid price in INR (₹0 or greater).';
    }

    const stockNum = parseInt(formData.stockQuantity, 10);
    if (isNaN(stockNum) || stockNum < 0) {
      errs.stockQuantity = 'Stock quantity cannot be negative.';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (publishChoice) => {
    setErrorMessage('');
    setSuccessNotice('');

    if (!validateForm()) {
      setErrorMessage('Please correct the highlighted fields before saving.');
      return;
    }

    try {
      setSubmitting(true);

      const data = new FormData();
      data.append('partName', formData.partName.trim());
      data.append('description', formData.description.trim());
      data.append('category', formData.category);
      data.append('subcategory', formData.subcategory.trim());
      data.append('vehicleType', formData.vehicleType);
      data.append('manufacturer', formData.manufacturer.trim());
      data.append('partNumber', formData.partNumber.trim());
      data.append('barcode', formData.barcode ? formData.barcode.trim() : '');
      data.append('manufacturerPartNumber', formData.manufacturerPartNumber ? formData.manufacturerPartNumber.trim() : '');
      data.append('condition', formData.condition);
      data.append('price', parseFloat(formData.price));
      data.append('stockQuantity', parseInt(formData.stockQuantity, 10));
      data.append('engineDetails', formData.engineDetails.trim());
      data.append('isPublished', publishChoice);

      // Parse arrays
      const makesArr = formData.compatibleMakes.split(',').map((s) => s.trim()).filter(Boolean);
      const modelsArr = formData.compatibleModels.split(',').map((s) => s.trim()).filter(Boolean);
      const yearsArr = formData.compatibleYears.split(',').map((s) => s.trim()).filter(Boolean);

      data.append('compatibleMakes', JSON.stringify(makesArr));
      data.append('compatibleModels', JSON.stringify(modelsArr));
      data.append('compatibleYears', JSON.stringify(yearsArr));

      // Append new files
      selectedFiles.forEach((file) => {
        data.append('partImages', file);
      });

      // Append retained existing images in edit mode
      if (isEditMode) {
        data.append('existingImages', JSON.stringify(existingImages));
      }

      let res;
      if (isEditMode) {
        res = await updatePartApi(id, data);
      } else {
        res = await createPartApi(data);
      }

      if (res.success) {
        setSuccessNotice(
          isEditMode
            ? 'Spare part listing updated successfully!'
            : 'New spare part listing published to inventory!'
        );
        setTimeout(() => {
          navigate('/owner/inventory');
        }, 1200);
      } else {
        setErrorMessage(res.error || 'Failed to save spare part listing.');
        if (res.errors) {
          const serverErrs = {};
          res.errors.forEach((e) => {
            if (typeof e === 'string') serverErrs.general = e;
            else if (e.field) serverErrs[e.field] = e.message;
          });
          setFieldErrors(serverErrs);
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
      <div className="add-part-page-root">
        <div className="container app-status-loading">
          <div className="auth-spinner">
            <svg viewBox="0 0 32 32" fill="none" className="spin-cog">
              <circle cx="16" cy="16" r="10" stroke="var(--color-orange-primary)" strokeWidth="3" strokeDasharray="3 1.5"/>
              <circle cx="16" cy="16" r="4" fill="var(--color-navy-primary)"/>
            </svg>
          </div>
          <h3>Loading Listing Form...</h3>
        </div>
      </div>
    );
  }

  // If Shop is not approved, block publishing
  if (!shopApproved) {
    return (
      <div className="add-part-page-root">
        <div className="container unapproved-shop-notice-container">
          <div className="app-status-card warning-card fade-in">
            <div className="status-large-icon warning-icon">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </div>
            <h2>Shop Verification Required</h2>
            <p>{shopStatusMessage}</p>
            <div className="status-action-btns">
              <Link to="/owner/dashboard" className="btn btn-primary">
                Return to Owner Dashboard
              </Link>
              <Link to="/owner/application" className="btn btn-outline">
                View Application Status
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="add-part-page-root">
      <div className="container add-part-container">
        {/* Navigation Breadcrumb */}
        <div className="part-form-breadcrumb">
          <Link to="/owner/inventory">← Back to Inventory</Link>
        </div>

        {/* Form Header */}
        <div className="part-form-header">
          <span className="badge badge-orange">{isEditMode ? 'Modify Listing' : 'New Listing'}</span>
          <h1 className="part-form-title">
            {isEditMode ? 'Edit Spare Part Listing' : 'Add New Spare Part to Inventory'}
          </h1>
          <p className="part-form-subtitle">
            Provide comprehensive part specifications, compatible vehicle makes & models, inventory quantity, and storefront photographs.
          </p>
        </div>

        {/* Global Notices */}
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

        <form className="part-multisection-form" onSubmit={(e) => e.preventDefault()}>
          {/* SECTION A: BASIC INFORMATION */}
          <section className="form-card-section">
            <div className="section-head">
              <span className="section-number">A</span>
              <div>
                <h3>Basic Part Information</h3>
                <p>Essential naming and catalog identification for customers and technicians.</p>
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="partName">Part Name *</label>
                <input
                  id="partName"
                  name="partName"
                  type="text"
                  className={`form-input ${fieldErrors.partName ? 'input-error' : ''}`}
                  placeholder="e.g. Brembo Ceramic Front Brake Pads"
                  value={formData.partName}
                  onChange={handleInputChange}
                  required
                />
                {fieldErrors.partName && <span className="field-error-msg">{fieldErrors.partName}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="partNumber">Part Number / SKU / OEM ID *</label>
                <input
                  id="partNumber"
                  name="partNumber"
                  type="text"
                  className={`form-input ${fieldErrors.partNumber ? 'input-error' : ''}`}
                  placeholder="e.g. P 28 076N or OEM-45022-S04"
                  value={formData.partNumber}
                  onChange={handleInputChange}
                  required
                />
                {fieldErrors.partNumber && <span className="field-error-msg">{fieldErrors.partNumber}</span>}
              </div>
            </div>

            <div className="form-grid-3">
              <div className="form-group">
                <label htmlFor="category">Category *</label>
                <select
                  id="category"
                  name="category"
                  className="form-input form-select"
                  value={formData.category}
                  onChange={handleInputChange}
                >
                  {CATEGORIES.filter((c) => c !== 'ALL').map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="subcategory">Subcategory (Optional)</label>
                <input
                  id="subcategory"
                  name="subcategory"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Brake Pads, Calipers, Rotors"
                  value={formData.subcategory}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="manufacturer">Manufacturer / Brand *</label>
                <input
                  id="manufacturer"
                  name="manufacturer"
                  type="text"
                  className={`form-input ${fieldErrors.manufacturer ? 'input-error' : ''}`}
                  placeholder="e.g. Bosch, Brembo, Denso, OEM"
                  value={formData.manufacturer}
                  onChange={handleInputChange}
                  required
                />
                {fieldErrors.manufacturer && <span className="field-error-msg">{fieldErrors.manufacturer}</span>}
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="barcode">Barcode / UPC / EAN / Code 128 (Optional)</label>
                <input
                  id="barcode"
                  name="barcode"
                  type="text"
                  className="form-input"
                  placeholder="e.g. 8901234567890"
                  value={formData.barcode}
                  onChange={handleInputChange}
                />
                <span className="field-hint">Enables instant barcode/QR camera scanning in search.</span>
              </div>

              <div className="form-group">
                <label htmlFor="manufacturerPartNumber">Manufacturer Part Number / MPN (Optional)</label>
                <input
                  id="manufacturerPartNumber"
                  name="manufacturerPartNumber"
                  type="text"
                  className="form-input"
                  placeholder="e.g. MPN-88219 or OEM-ALT-102"
                  value={formData.manufacturerPartNumber}
                  onChange={handleInputChange}
                />
                <span className="field-hint">Original manufacturer part number if different from SKU.</span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="description">Detailed Description & Specifications *</label>
              <textarea
                id="description"
                name="description"
                rows="4"
                className={`form-input form-textarea ${fieldErrors.description ? 'input-error' : ''}`}
                placeholder="Describe material specifications, dimensions, installation notes, and warranty details..."
                value={formData.description}
                onChange={handleInputChange}
                required
              />
              {fieldErrors.description && <span className="field-error-msg">{fieldErrors.description}</span>}
            </div>
          </section>

          {/* SECTION B: VEHICLE COMPATIBILITY */}
          <section className="form-card-section">
            <div className="section-head">
              <span className="section-number">B</span>
              <div>
                <h3>Vehicle Compatibility</h3>
                <p>Define which vehicles, models, and engine variants this spare part supports.</p>
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="vehicleType">Target Vehicle Type *</label>
                <select
                  id="vehicleType"
                  name="vehicleType"
                  className="form-input form-select"
                  value={formData.vehicleType}
                  onChange={handleInputChange}
                >
                  {VEHICLE_TYPES.filter((v) => v !== 'ALL').map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="compatibleMakes">Compatible Makes (comma-separated)</label>
                <input
                  id="compatibleMakes"
                  name="compatibleMakes"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Honda, Toyota, Maruti Suzuki"
                  value={formData.compatibleMakes}
                  onChange={handleInputChange}
                />
                <span className="field-hint">Separate multiple manufacturer brands with commas.</span>
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="compatibleModels">Compatible Models (comma-separated)</label>
                <input
                  id="compatibleModels"
                  name="compatibleModels"
                  type="text"
                  className="form-input"
                  placeholder="e.g. City, Civic, Corolla, Swift"
                  value={formData.compatibleModels}
                  onChange={handleInputChange}
                />
                <span className="field-hint">List applicable vehicle models separated by commas.</span>
              </div>

              <div className="form-group">
                <label htmlFor="compatibleYears">Supported Year Range (comma-separated)</label>
                <input
                  id="compatibleYears"
                  name="compatibleYears"
                  type="text"
                  className="form-input"
                  placeholder="e.g. 2018, 2019, 2020, 2021, 2022"
                  value={formData.compatibleYears}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="engineDetails">Engine & Trim Details (Optional)</label>
              <input
                id="engineDetails"
                name="engineDetails"
                type="text"
                className="form-input"
                placeholder="e.g. 1.5L i-VTEC Petrol / 1.8L Dual VVT-i / 150cc 4-Stroke (Not required for bicycles)"
                value={formData.engineDetails}
                onChange={handleInputChange}
              />
            </div>
          </section>

          {/* SECTION C: PRICING AND INVENTORY */}
          <section className="form-card-section">
            <div className="section-head">
              <span className="section-number">C</span>
              <div>
                <h3>Pricing & Stock Inventory</h3>
                <p>Set retail price in Indian Rupees (₹) and available warehouse quantity.</p>
              </div>
            </div>

            <div className="form-grid-3">
              <div className="form-group">
                <label htmlFor="price">Selling Price (₹ INR) *</label>
                <div className="price-input-wrapper">
                  <span className="currency-prefix">₹</span>
                  <input
                    id="price"
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    className={`form-input price-input ${fieldErrors.price ? 'input-error' : ''}`}
                    placeholder="e.g. 3450"
                    value={formData.price}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                {fieldErrors.price && <span className="field-error-msg">{fieldErrors.price}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="stockQuantity">Available Stock Quantity *</label>
                <input
                  id="stockQuantity"
                  name="stockQuantity"
                  type="number"
                  min="0"
                  step="1"
                  className={`form-input ${fieldErrors.stockQuantity ? 'input-error' : ''}`}
                  placeholder="e.g. 10"
                  value={formData.stockQuantity}
                  onChange={handleInputChange}
                  required
                />
                {fieldErrors.stockQuantity && <span className="field-error-msg">{fieldErrors.stockQuantity}</span>}
                <span className="field-hint">Items with 0 quantity automatically show as OUT OF STOCK.</span>
              </div>

              <div className="form-group">
                <label htmlFor="condition">Part Condition *</label>
                <select
                  id="condition"
                  name="condition"
                  className="form-input form-select"
                  value={formData.condition}
                  onChange={handleInputChange}
                >
                  <option value="NEW">NEW (Brand New OEM / Aftermarket)</option>
                  <option value="USED">USED (Tested Pre-owned / Refurbished)</option>
                </select>
              </div>
            </div>
          </section>

          {/* SECTION D: PRODUCT IMAGES */}
          <section className="form-card-section">
            <div className="section-head">
              <span className="section-number">D</span>
              <div>
                <h3>Product Photographs</h3>
                <p>Upload clear photographs of the spare part, packaging, and label (up to 5 images).</p>
              </div>
            </div>

            {/* Existing Images (Edit mode) */}
            {existingImages.length > 0 && (
              <div className="existing-images-block">
                <label>Current Product Photographs:</label>
                <div className="image-previews-grid">
                  {existingImages.map((imgPath, index) => (
                    <div key={imgPath} className="preview-card existing-card">
                      <img src={imgPath} alt={`Existing ${index + 1}`} />
                      <button
                        type="button"
                        className="btn-remove-thumb"
                        title="Remove image"
                        onClick={() => removeExistingImage(imgPath)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* File Upload Dropzone */}
            <div className="file-upload-dropzone">
              <input
                id="partImagesInput"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="file-input-hidden"
                onChange={handleFileSelection}
                disabled={existingImages.length + selectedFiles.length >= 5}
              />
              <label htmlFor="partImagesInput" className="dropzone-label">
                <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <span className="dropzone-text">Click to choose product photographs</span>
                <span className="dropzone-hint">
                  Supports JPG, PNG, and WebP up to 5MB each ({existingImages.length + selectedFiles.length}/5 photos chosen)
                </span>
              </label>
            </div>

            {/* Selected File Previews */}
            {filePreviews.length > 0 && (
              <div className="image-previews-grid">
                {filePreviews.map((preview, index) => (
                  <div key={index} className="preview-card fade-in">
                    <img src={preview.url} alt={preview.name} />
                    <div className="preview-overlay">
                      <span className="preview-filename">{preview.name} ({preview.size} MB)</span>
                    </div>
                    <button
                      type="button"
                      className="btn-remove-thumb"
                      title="Remove image"
                      onClick={() => removeSelectedFile(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Form Actions / Publishing Bar */}
          <div className="form-footer-actions">
            <Link to="/owner/inventory" className="btn btn-outline">
              Cancel & Exit
            </Link>

            <div className="footer-submit-group">
              <button
                type="button"
                className="btn btn-outline-navy"
                disabled={submitting}
                onClick={() => handleSubmit(false)}
              >
                {submitting ? 'Saving...' : 'Save as Draft'}
              </button>

              <button
                type="button"
                className="btn btn-primary publish-btn"
                disabled={submitting}
                onClick={() => handleSubmit(true)}
              >
                {submitting
                  ? 'Saving Listing...'
                  : isEditMode
                  ? 'Update & Publish Listing'
                  : 'Publish to Marketplace'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEditPartPage;
