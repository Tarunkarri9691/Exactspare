import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  createShopApplication, 
  updateShopApplication, 
  fetchMyApplication,
  getImageUrl
} from '../services/api';

import LocationPickerMap from '../components/LocationPickerMap';
import CameraCaptureModal from '../components/CameraCaptureModal';
import './ShopApplicationPage.css';

const CATEGORIES = [
  { value: 'MULTI_CATEGORY', label: 'All Vehicles / Multi-Category Spares' },
  { value: 'BIKE', label: 'Motorcycles & Sports Bikes' },
  { value: 'CAR', label: 'Cars & 4-Wheelers' },
  { value: 'SCOOTER', label: 'Scooters & E-Scooters' },
  { value: 'BICYCLE', label: 'Bicycles & Geared Cycles' },
  { value: 'OTHER', label: 'Commercial & Other Vehicles' }
];

const BUSINESS_ROLES = [
  { value: 'Proprietor', label: 'Proprietor / Sole Owner' },
  { value: 'Partner', label: 'Managing Partner / Partner' },
  { value: 'Director', label: 'Managing Director / Director' },
  { value: 'Store Manager', label: 'Authorized Store Manager' },
  { value: 'Authorized Representative', label: 'Authorized Legal Representative' }
];

const STEPS = [
  { id: 1, title: 'Owner Details', short: 'Owner' },
  { id: 2, title: 'Shop Details', short: 'Shop' },
  { id: 3, title: 'Address & Location', short: 'Location' },
  { id: 4, title: 'Shop Images', short: 'Photos' },
  { id: 5, title: 'Verification Documents', short: 'Documents' },
  { id: 6, title: 'Review & Submit', short: 'Review' }
];

const validateClientPhone = (phone, isRequired = true) => {
  if (!phone || typeof phone !== 'string') {
    if (!isRequired) return { valid: true, cleanPhone: '' };
    return { valid: false, message: 'Contact mobile number is required' };
  }
  let clean = phone.trim().replace(/[\s\-\(\)\.]/g, '');
  if (clean.startsWith('+91')) clean = clean.slice(3);
  else if (clean.startsWith('91') && clean.length === 12) clean = clean.slice(2);
  else if (clean.startsWith('0') && clean.length === 11) clean = clean.slice(1);

  if (!clean && !isRequired) return { valid: true, cleanPhone: '' };

  if (!/^\d{10}$/.test(clean)) {
    return { valid: false, message: 'Please enter a genuine 10-digit mobile number' };
  }
  if (!/^[6-9]/.test(clean)) {
    return { valid: false, message: 'Mobile number must start with 6, 7, 8, or 9' };
  }
  if (/^(\d)\1{9}$/.test(clean)) {
    return { valid: false, message: 'Fake or repeating digits (e.g. 9999999999) are not allowed' };
  }
  const dummyNumbers = [
    '1234567890', '0123456789', '9876543210', '9898989898', 
    '9876598765', '9090909090', '9191919191', '8989898989',
    '7878787878', '6767676767', '9898987654', '9876543211',
    '9988776655', '9898987650'
  ];
  if (dummyNumbers.includes(clean)) {
    return { valid: false, message: 'Random or dummy sequence numbers are not allowed. Please enter your real mobile number.' };
  }
  return { valid: true, cleanPhone: clean };
};

const ShopApplicationPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Multi-step navigation state
  const [currentStep, setCurrentStep] = useState(1);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [existingAppId, setExistingAppId] = useState(null);
  const [appStatus, setAppStatus] = useState(null); // 'DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'NEEDS_CORRECTION'
  const [paymentStatus, setPaymentStatus] = useState('UNPAID'); // 'UNPAID', 'PENDING_VERIFICATION', 'PAID', 'PAYMENT_FAILED'
  const [paymentUtr, setPaymentUtr] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(499);
  const [paymentRejectionReason, setPaymentRejectionReason] = useState('');
  const [adminCorrectionMessage, setAdminCorrectionMessage] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittedAtTime, setSubmittedAtTime] = useState(null);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [isDirty, setIsDirty] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    // Section A: Owner Details
    ownerFullName: '',
    ownerPhone: '',
    alternatePhone: '',
    ownerBusinessRole: 'Proprietor',
    businessEmail: '',
    // Section B: Shop Details
    shopName: '',
    shopCategory: 'MULTI_CATEGORY',
    shopDescription: '',
    businessPhone: '',
    yearsInBusiness: '',
    openingHours: 'Mon-Sat: 09:00 AM - 08:00 PM',
    // Section C: Address & Location
    addressLine: '',
    locality: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    latitude: 28.6139,
    longitude: 77.2090
  });

  // Section D: Shop Images
  const [exteriorFile, setExteriorFile] = useState(null);
  const [exteriorPreview, setExteriorPreview] = useState(null);
  const [interiorFile, setInteriorFile] = useState(null);
  const [interiorPreview, setInteriorPreview] = useState(null);
  const [additionalFiles, setAdditionalFiles] = useState([]);
  const [additionalPreviews, setAdditionalPreviews] = useState([]);
  const [existingShopImages, setExistingShopImages] = useState([]);

  // Section E: Verification Documents
  const [documentFiles, setDocumentFiles] = useState([]);
  const [documentPreviews, setDocumentPreviews] = useState([]);
  const [existingDocuments, setExistingDocuments] = useState([]);

  // Terms agreement on review step
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Geolocation detection status
  const [geoDetecting, setGeoDetecting] = useState(false);
  const [geoSuccessMsg, setGeoSuccessMsg] = useState('');

  // Modals & UI States
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraTarget, setCameraTarget] = useState('exterior'); // 'exterior' | 'interior' | 'additional'
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Prompt before unload if unsaved changes exist
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty && !submitting && !savingDraft) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes in your application. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, submitting, savingDraft]);

  // Load existing application if already drafted, pending, or under review
  useEffect(() => {
    const loadApplication = async () => {
      try {
        setLoadingInitial(true);
        const res = await fetchMyApplication();

        if (res.success && res.hasApplication && res.application) {
          const app = res.application;
          setExistingAppId(app._id);
          setAppStatus(app.status);
          setPaymentStatus(app.paymentStatus || 'UNPAID');
          setPaymentUtr(app.paymentUtr || '');
          setPaymentAmount(app.paymentAmount || 499);
          setPaymentRejectionReason(app.paymentRejectionReason || '');
          setAdminCorrectionMessage(app.correctionMessage || '');
          setRejectionReason(app.rejectionReason || '');
          setSubmittedAtTime(app.submittedAt || null);
          setDraftSavedAt(app.updatedAt || app.createdAt || null);

          setFormData({
            ownerFullName: app.ownerFullName || user?.name || '',
            ownerPhone: app.ownerPhone || user?.phone || '',
            alternatePhone: app.alternatePhone || '',
            ownerBusinessRole: app.ownerBusinessRole || 'Proprietor',
            businessEmail: app.businessEmail || user?.email || '',
            shopName: app.shopName || '',
            shopCategory: app.shopCategory || 'MULTI_CATEGORY',
            shopDescription: app.shopDescription || '',
            businessPhone: app.businessPhone || '',
            yearsInBusiness: app.yearsInBusiness !== undefined && app.yearsInBusiness !== null ? String(app.yearsInBusiness) : '',
            openingHours: app.openingHours || 'Mon-Sat: 09:00 AM - 08:00 PM',
            addressLine: app.addressLine || '',
            locality: app.locality || '',
            city: app.city || '',
            state: app.state || '',
            postalCode: app.postalCode || '',
            country: app.country || 'India',
            latitude: Number(app.latitude) || 28.6139,
            longitude: Number(app.longitude) || 77.2090
          });

          setExistingShopImages(app.shopImagePaths || []);
          setExistingDocuments(app.verificationDocumentPaths || []);
        } else {
          // New application: prefill from authenticated account
          setFormData(prev => ({
            ...prev,
            ownerFullName: user?.name || '',
            ownerPhone: user?.phone || '',
            businessEmail: user?.email || ''
          }));
        }
      } catch (err) {
        console.error('Error loading existing application:', err);
      } finally {
        setLoadingInitial(false);
      }
    };

    loadApplication();
  }, [user]);

  // Form input handler
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setIsDirty(true);

    if (name === 'ownerPhone' || name === 'alternatePhone' || name === 'postalCode') {
      const maxLen = name === 'postalCode' ? 6 : 10;
      const sanitized = value.replace(/\D/g, '').slice(0, maxLen);
      setFormData(prev => ({ ...prev, [name]: sanitized }));
      if (fieldErrors[name]) {
        setFieldErrors(prev => ({ ...prev, [name]: null }));
      }
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Location map handler
  const handleLocationChange = ({ latitude, longitude }) => {
    setIsDirty(true);
    setFormData(prev => ({
      ...prev,
      latitude,
      longitude
    }));
    setGeoSuccessMsg(`Pin adjusted to (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
    setTimeout(() => setGeoSuccessMsg(''), 3500);
  };

  // Geolocation detection handler
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Geolocation is not supported by your current browser.');
      return;
    }

    setGeoDetecting(true);
    setErrorMessage('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setFormData(prev => ({
          ...prev,
          latitude: parseFloat(latitude.toFixed(6)),
          longitude: parseFloat(longitude.toFixed(6))
        }));
        setGeoDetecting(false);
        setIsDirty(true);
        setGeoSuccessMsg(`Verified device location detected: ${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E`);
        setTimeout(() => setGeoSuccessMsg(''), 5000);
      },
      (err) => {
        setGeoDetecting(false);
        setErrorMessage(
          err.code === 1 
            ? 'Location access denied. Please allow location access or adjust the map pin manually.'
            : 'Unable to retrieve location. Please adjust the map pin manually.'
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // Exterior Image Upload
  const handleExteriorFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Shop exterior photograph must be a valid image file (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Exterior image exceeds maximum allowed size of 5 MB.');
      return;
    }

    setIsDirty(true);
    setExteriorFile(file);
    if (exteriorPreview) URL.revokeObjectURL(exteriorPreview);
    setExteriorPreview(URL.createObjectURL(file));
    setErrorMessage('');
  };

  // Interior Image Upload
  const handleInteriorFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Shop interior photograph must be a valid image file (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Interior image exceeds maximum allowed size of 5 MB.');
      return;
    }

    setIsDirty(true);
    setInteriorFile(file);
    if (interiorPreview) URL.revokeObjectURL(interiorPreview);
    setInteriorPreview(URL.createObjectURL(file));
    setErrorMessage('');
  };

  // Additional Images Upload
  const handleAdditionalImagesChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const totalNow = additionalFiles.length + files.length + (exteriorFile ? 1 : 0) + (interiorFile ? 1 : 0) + existingShopImages.length;
    if (totalNow > 8) {
      setErrorMessage('You can upload a maximum of 8 shop photographs in total.');
      return;
    }

    const validFiles = [];
    const newPreviews = [];

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setErrorMessage(`File ${file.name} is not a valid image.`);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage(`File ${file.name} exceeds 5 MB limit.`);
        return;
      }
      validFiles.push(file);
      newPreviews.push({
        name: file.name,
        size: (file.size / 1024 / 1024).toFixed(2),
        url: URL.createObjectURL(file)
      });
    }

    setIsDirty(true);
    setAdditionalFiles(prev => [...prev, ...validFiles]);
    setAdditionalPreviews(prev => [...prev, ...newPreviews]);
    setErrorMessage('');
  };

  const removeAdditionalImage = (index) => {
    setIsDirty(true);
    setAdditionalFiles(prev => prev.filter((_, i) => i !== index));
    setAdditionalPreviews(prev => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  // Camera Snapshot Callback
  const handleCapturedPhoto = (file) => {
    setIsDirty(true);
    if (cameraTarget === 'exterior') {
      setExteriorFile(file);
      if (exteriorPreview) URL.revokeObjectURL(exteriorPreview);
      setExteriorPreview(URL.createObjectURL(file));
      setSuccessNotice('Exterior storefront photo captured successfully with camera!');
    } else if (cameraTarget === 'interior') {
      setInteriorFile(file);
      if (interiorPreview) URL.revokeObjectURL(interiorPreview);
      setInteriorPreview(URL.createObjectURL(file));
      setSuccessNotice('Interior storefront photo captured successfully with camera!');
    } else {
      setAdditionalFiles(prev => [...prev, file]);
      setAdditionalPreviews(prev => [...prev, {
        name: file.name,
        size: (file.size / 1024 / 1024).toFixed(2),
        url: URL.createObjectURL(file)
      }]);
      setSuccessNotice('Additional shop photo captured successfully!');
    }
    setTimeout(() => setSuccessNotice(''), 3500);
  };

  // Documents Upload Handler
  const handleDocumentsChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (documentFiles.length + files.length + existingDocuments.length > 5) {
      setErrorMessage('You can upload a maximum of 5 verification documents.');
      return;
    }

    const validFiles = [];
    const newPreviews = [];

    for (const file of files) {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImg = file.type.startsWith('image/');
      if (!isPdf && !isImg) {
        setErrorMessage(`File ${file.name} must be a PDF or Image document.`);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage(`Document ${file.name} exceeds 5 MB.`);
        return;
      }
      validFiles.push(file);
      newPreviews.push({
        name: file.name,
        size: (file.size / 1024 / 1024).toFixed(2),
        type: isPdf ? 'PDF' : 'IMAGE'
      });
    }

    setIsDirty(true);
    setDocumentFiles(prev => [...prev, ...validFiles]);
    setDocumentPreviews(prev => [...prev, ...newPreviews]);
    setErrorMessage('');
  };

  const removeSelectedDocument = (index) => {
    setIsDirty(true);
    setDocumentFiles(prev => prev.filter((_, i) => i !== index));
    setDocumentPreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Section Validation Helpers
  const validateStep = (stepNumber) => {
    const errors = {};

    if (stepNumber === 1) {
      if (!formData.ownerFullName.trim()) {
        errors.ownerFullName = 'Owner full legal name is required';
      }
      const phoneCheck = validateClientPhone(formData.ownerPhone, true);
      if (!phoneCheck.valid) {
        errors.ownerPhone = phoneCheck.message;
      }
      if (formData.alternatePhone) {
        const altCheck = validateClientPhone(formData.alternatePhone, false);
        if (!altCheck.valid) {
          errors.alternatePhone = altCheck.message;
        }
      }
      if (!formData.businessEmail.trim() || !/^\S+@\S+\.\S+$/.test(formData.businessEmail.trim())) {
        errors.businessEmail = 'Valid email address is required';
      }
    }

    if (stepNumber === 2) {
      if (!formData.shopName.trim() || formData.shopName.trim().length < 2) {
        errors.shopName = 'Shop name is required (at least 2 characters)';
      }
      if (!formData.shopDescription.trim() || formData.shopDescription.trim().length < 10) {
        errors.shopDescription = 'Shop description is required (at least 10 characters)';
      }
      if (!formData.openingHours.trim()) {
        errors.openingHours = 'Opening hours and working days are required';
      }
    }

    if (stepNumber === 3) {
      if (!formData.addressLine.trim()) {
        errors.addressLine = 'Street address / premises is required';
      }
      if (!formData.city.trim()) {
        errors.city = 'City is required';
      }
      if (!formData.state.trim()) {
        errors.state = 'State / Province is required';
      }
      if (!formData.postalCode.trim() || !/^\d{6}$/.test(formData.postalCode.trim())) {
        errors.postalCode = 'Valid 6-digit postal PIN code is required';
      }
      const lat = Number(formData.latitude);
      const lng = Number(formData.longitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        errors.latitude = 'Latitude must be between -90 and 90';
      }
      if (isNaN(lng) || lng < -180 || lng > 180) {
        errors.longitude = 'Longitude must be between -180 and 180';
      }
    }

    if (stepNumber === 4) {
      const hasAnyPhoto = exteriorFile || interiorFile || additionalFiles.length > 0 || existingShopImages.length > 0;
      if (!hasAnyPhoto) {
        errors.shopImages = 'Please upload at least one storefront photograph for verification.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setErrorMessage('');
      setCurrentStep(prev => Math.min(prev + 1, 6));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setErrorMessage('Please correct the highlighted fields before proceeding.');
    }
  };

  const handlePrevStep = () => {
    setErrorMessage('');
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Save Draft Action
  const handleSaveDraft = async () => {
    setErrorMessage('');
    setSuccessNotice('');
    setFieldErrors({});

    if (!formData.shopName.trim()) {
      setErrorMessage('Shop name is required to save an application draft.');
      setFieldErrors({ shopName: 'Please provide at least a store name to save draft' });
      return;
    }

    try {
      setSavingDraft(true);
      const data = new FormData();
      Object.keys(formData).forEach(key => {
        if (formData[key] !== undefined && formData[key] !== null) {
          data.append(key, formData[key]);
        }
      });
      data.append('action', 'SAVE_DRAFT');

      if (exteriorFile) data.append('shopExteriorImage', exteriorFile);
      if (interiorFile) data.append('shopInteriorImage', interiorFile);
      additionalFiles.forEach(f => data.append('shopImages', f));
      documentFiles.forEach(f => data.append('verificationDocuments', f));

      let res;
      if (existingAppId) {
        res = await updateShopApplication(existingAppId, data);
      } else {
        res = await createShopApplication(data);
      }

      if (res.success) {
        setIsDirty(false);
        const app = res.data?.application;
        if (app?._id) setExistingAppId(app._id);
        setAppStatus('DRAFT');
        setDraftSavedAt(new Date());
        setSuccessNotice('Draft saved successfully! You can resume and edit this application anytime.');
        setTimeout(() => setSuccessNotice(''), 4500);
      } else {
        setErrorMessage(res.error || 'Failed to save application draft.');
      }
    } catch {
      setErrorMessage('An unexpected network error occurred while saving draft.');
    } finally {
      setSavingDraft(false);
    }
  };

  // Submit Application Action (Sets status to PENDING)
  const handleSubmitApplication = async () => {
    setErrorMessage('');
    setSuccessNotice('');
    setFieldErrors({});

    // Comprehensive client validation across all steps
    let valid = true;
    for (let s = 1; s <= 4; s++) {
      if (!validateStep(s)) {
        valid = false;
        setCurrentStep(s);
        setErrorMessage('Please fill in all required fields before final submission.');
        return;
      }
    }

    if (!agreedToTerms) {
      setErrorMessage('Please check the declaration box to certify that the submitted business information is accurate.');
      return;
    }

    try {
      setSubmitting(true);
      const data = new FormData();
      Object.keys(formData).forEach(key => {
        if (formData[key] !== undefined && formData[key] !== null) {
          data.append(key, formData[key]);
        }
      });
      data.append('action', 'SUBMIT');

      if (exteriorFile) data.append('shopExteriorImage', exteriorFile);
      if (interiorFile) data.append('shopInteriorImage', interiorFile);
      additionalFiles.forEach(f => data.append('shopImages', f));
      documentFiles.forEach(f => data.append('verificationDocuments', f));

      let res;
      if (existingAppId) {
        res = await updateShopApplication(existingAppId, data);
      } else {
        res = await createShopApplication(data);
      }

      if (res.success) {
        setIsDirty(false);
        const app = res.data?.application;
        if (app?._id) setExistingAppId(app._id);
        setAppStatus(app?.status || 'APPROVED');
        setSubmittedAtTime(new Date());
        setSuccessNotice('Shop details registered and directly approved! Please complete your subscription to activate your store.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setErrorMessage(res.error || 'Application submission failed.');
        if (res.errors && Array.isArray(res.errors)) {
          setErrorMessage(`Submission errors: ${res.errors.join(', ')}`);
        }
      }
    } catch {
      setErrorMessage('A server error occurred while submitting your application.');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading Initial State
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
          <p>Connecting securely to EXACTSPARE Merchant Services</p>
        </div>
      </div>
    );
  }

  // HELPER: Render standard status metadata box
  const renderStatusMetadataBox = (mappedStatus, adminFeedbackText) => (
    <div className="status-meta-summary-box" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px 20px', marginBottom: '24px', textAlign: 'left' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
        <div>
          <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Application Reference</span>
          <strong style={{ fontSize: '0.98rem', color: '#0f172a' }}>#EXS-{existingAppId ? existingAppId.slice(-8).toUpperCase() : 'PENDING'}</strong>
        </div>
        <div>
          <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Shop & Owner</span>
          <strong style={{ fontSize: '0.95rem', color: '#0f172a', display: 'block' }}>{formData.shopName || 'Retail Store'}</strong>
          <span style={{ fontSize: '0.82rem', color: '#475569' }}>{formData.ownerFullName}</span>
        </div>
        <div>
          <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Submission Date</span>
          <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>
            {submittedAtTime ? new Date(submittedAtTime).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not yet submitted'}
          </strong>
        </div>
        <div>
          <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Application Status</span>
          <span className={`badge ${
            mappedStatus === 'Approved' ? 'badge-success' :
            mappedStatus === 'Needs Correction' ? 'badge-warning' :
            mappedStatus === 'Rejected' ? 'badge-danger' : 'badge-navy'
          }`} style={{ marginTop: '4px', display: 'inline-block' }}>
            {mappedStatus}
          </span>
        </div>
      </div>
      {adminFeedbackText && (
        <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
          <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Administrative Feedback</span>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.92rem', color: '#334155', lineHeight: '1.5' }}>{adminFeedbackText}</p>
        </div>
      )}
    </div>
  );

  // STATUS VIEW: PENDING ADMIN REVIEW
  if (appStatus === 'PENDING') {
    return (
      <div className="application-page-root">
        <div className="container app-message-container" style={{ maxWidth: '860px' }}>
          <div className="app-status-card pending-review-card fade-in">
            <div className="status-badge-header">
              <span className="badge badge-pending-pulse">● Pending Admin Review</span>
              <span className="app-id-pill">Ref #EXS-{existingAppId?.slice(-8).toUpperCase() || 'PENDING'}</span>
            </div>

            <div className="status-large-icon pending-icon">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>

            <h2>Application Queued for Administrative Review</h2>
            <p className="pending-subtext">
              Your registration application for <strong>{formData.shopName || 'your store'}</strong> has been submitted. Platform administrators are reviewing physical storefront photos, GPS location, and trade credentials.
            </p>

            {renderStatusMetadataBox(
              'Pending Admin Review',
              'Compliance review is in progress. Once verified by administrator, your application decision will be finalized and storefront access unlocked.'
            )}

            {/* Application Review Timeline */}
            <div className="review-timeline-box">
              <h4>Application Verification Timeline</h4>
              <div className="timeline-steps">
                <div className="timeline-step completed">
                  <div className="timeline-dot">✓</div>
                  <div className="timeline-content">
                    <strong>1. Application Submitted</strong>
                    <p>Details and store documents received</p>
                  </div>
                </div>

                <div className="timeline-step in-progress">
                  <div className="timeline-dot">2</div>
                  <div className="timeline-content">
                    <strong>2. Compliance & Physical Location Review</strong>
                    <p>Admin checking storefront photos, GPS coordinates, and credentials</p>
                  </div>
                </div>

                <div className="timeline-step pending">
                  <div className="timeline-dot">3</div>
                  <div className="timeline-content">
                    <strong>3. Storefront Activation</strong>
                    <p>Inventory publishing & customer enquiry access unlocked</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="status-action-btns">
              <Link to="/owner/dashboard" className="btn btn-outline" id="pending-back-to-dash-btn">
                ← Return to Owner Dashboard
              </Link>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={() => window.location.reload()}
              >
                ↻ Refresh Application Status
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STATUS VIEW 5: APPROVED
  if (appStatus === 'APPROVED') {
    return (
      <div className="application-page-root">
        <div className="container app-message-container" style={{ maxWidth: '860px' }}>
          <div className="app-status-card approved-card fade-in">
            <div className="status-large-icon approved-icon">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <h2>Basic Shop Details Registered & Approved!</h2>
            <p>
              Your store <strong>{formData.shopName}</strong> basic details and location coordinates are registered and directly approved.
            </p>

            {renderStatusMetadataBox(
              'Approved',
              'Basic shop details directly approved. To start using your shop, adding spare parts inventory, and receiving customer enquiries, complete your subscription below.'
            )}

            {/* Step 2 Banner: Subscription */}
            <div className="subscription-next-step-box" style={{ background: '#f8fafc', border: '2px solid #ea580c', borderRadius: '12px', padding: '20px 24px', margin: '24px 0', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span className="badge badge-orange" style={{ fontSize: '0.82rem', padding: '4px 10px' }}>Step 2 of 2 Required</span>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Store Subscription & Activation</span>
              </div>
              <h3 style={{ margin: '0 0 8px 0', color: '#0f172a', fontSize: '1.2rem' }}>
                💳 Subscribe to Send Payment to Admin & Unlock Shop
              </h3>
              <p style={{ margin: '0 0 16px 0', color: '#475569', fontSize: '0.94rem', lineHeight: '1.5' }}>
                Select a merchant subscription plan and submit your UPI payment reference. This sends a verification request to the administrator. Once the admin accepts your subscription, your store catalog and inventory tools will be unlocked!
              </p>
              <Link to="/owner/subscription" className="btn btn-primary" id="go-to-sub-from-app-btn" style={{ fontWeight: 700 }}>
                Proceed to Store Subscription & Activation →
              </Link>
            </div>

            <div className="status-action-btns" style={{ marginTop: '16px' }}>
              <Link to="/owner/dashboard" className="btn btn-outline" id="open-approved-dash-btn">
                Open Owner Dashboard →
              </Link>
              <Link to="/owner/shop" className="btn btn-outline">
                View My Shop Profile →
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STATUS VIEW 6: REJECTED (Allows user to inspect reason and reapply)
  if (appStatus === 'REJECTED') {
    return (
      <div className="application-page-root">
        <div className="container app-message-container" style={{ maxWidth: '840px' }}>
          <div className="app-status-card rejected-card fade-in">
            <div className="status-large-icon rejected-icon">
              <svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            </div>
            <h2 style={{ color: '#991b1b', marginBottom: '8px' }}>Shop Application Not Approved</h2>
            <p style={{ color: '#475569', fontSize: '1rem', marginBottom: '20px' }}>
              The registration application for store <strong>{formData.shopName || 'your shop'}</strong> was reviewed and not approved by platform administration.
            </p>

            {renderStatusMetadataBox(
              'Rejected',
              rejectionReason || adminCorrectionMessage || 'Submitted trade documents or verification details did not meet platform safety and compliance requirements.'
            )}

            <div className="rejection-reason-box">
              <strong style={{ color: '#b91c1c', display: 'block', marginBottom: '6px' }}>Recorded Administrative Reason:</strong>
              <p style={{ color: '#7f1d1d', margin: 0, fontSize: '0.95rem', lineHeight: '1.5' }}>
                {rejectionReason || adminCorrectionMessage || 'Submitted trade documents or verification details did not meet platform safety and compliance requirements.'}
              </p>
            </div>

            <div className="permitted-next-steps">
              <strong style={{ color: '#1e293b', display: 'block', marginBottom: '8px' }}>Permitted Next Steps:</strong>
              <ul style={{ color: '#475569', margin: 0, paddingLeft: '20px', fontSize: '0.92rem', lineHeight: '1.6' }}>
                <li>Review the specific rejection reason above and ensure genuine store photographs and valid commercial licenses are ready.</li>
                <li>Contact platform merchant compliance support at <code>support@exactspare.com</code> if you require clarification regarding this decision.</li>
                <li>You may edit your application details, upload updated trade documents, and resubmit for reconsideration.</li>
              </ul>
            </div>

            <div className="status-action-btns">
              <button 
                type="button" 
                onClick={() => {
                  setAppStatus('DRAFT');
                  setCurrentStep(1);
                }} 
                className="btn btn-primary" 
                id="reapply-draft-btn"
              >
                ✎ Edit & Resubmit Application
              </button>
              <Link to="/owner/dashboard" className="btn btn-outline" id="return-owner-dash-btn">
                ← Return to Owner Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE FORM VIEW (DRAFT, NEEDS_CORRECTION, or NEW APPLICATION)
  return (
    <div className="application-page-root">
      <div className="container app-form-container">
        
        {/* Header Block */}
        <div className="app-header-block">
          <div className="app-badge-row">
            <span className="badge badge-orange">Merchant Verification</span>
            {appStatus === 'NEEDS_CORRECTION' && (
              <span className="badge badge-danger">Revisions Requested</span>
            )}
            {appStatus === 'DRAFT' && (
              <span className="badge badge-navy">Draft In Progress</span>
            )}
          </div>
          <h1 className="app-main-title">
            {appStatus === 'NEEDS_CORRECTION' ? 'Update & Resubmit Shop Application' : (existingAppId ? 'Shop Owner Registration Application' : 'Register Your Spare Parts Retail Store')}
          </h1>
          <p className="app-main-subtitle">
            Provide your authentic store information, geolocation pin, clear storefront photographs, and trade verification documents for administrative review.
          </p>
          {draftSavedAt && appStatus === 'DRAFT' && (
            <div className="draft-timestamp-notice">
              <span>Saved draft from: {new Date(draftSavedAt).toLocaleString('en-IN')}</span>
            </div>
          )}
        </div>

        {/* Correction Feedback Notice Banner */}
        {appStatus === 'NEEDS_CORRECTION' && adminCorrectionMessage && (
          <div className="correction-feedback-card fade-in">
            <div className="feedback-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <div className="feedback-body">
              <h4>Administrator Revision Request</h4>
              <p className="feedback-message">{adminCorrectionMessage}</p>
              <span className="subtext">Please review and adjust the requested fields below, then click "Submit Application" to resubmit.</span>
            </div>
          </div>
        )}

        {/* Success Notice */}
        {successNotice && (
          <div className="auth-alert success-alert fade-in">
            <span className="alert-icon">✓</span>
            <span>{successNotice}</span>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="auth-alert error-alert fade-in">
            <span className="alert-icon">⚠</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Step Progress Indicator */}
        <div className="step-progress-wrapper">
          <div className="step-progress-bar">
            {STEPS.map((s) => {
              const isCompleted = currentStep > s.id;
              const isCurrent = currentStep === s.id;
              return (
                <button
                  type="button"
                  key={s.id}
                  className={`step-progress-item ${isCompleted ? 'completed' : ''} ${isCurrent ? 'active' : ''}`}
                  onClick={() => {
                    // Allow navigating backward or to current freely
                    if (s.id <= currentStep) {
                      setCurrentStep(s.id);
                    } else if (validateStep(currentStep)) {
                      setCurrentStep(s.id);
                    }
                  }}
                >
                  <div className="step-circle">
                    {isCompleted ? '✓' : s.id}
                  </div>
                  <span className="step-label">{s.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        <form className="app-multisection-form" onSubmit={(e) => e.preventDefault()}>
          
          {/* STEP 1: OWNER DETAILS */}
          {currentStep === 1 && (
            <section className="form-card-section fade-in">
              <div className="section-head">
                <span className="section-number">A</span>
                <div>
                  <h3>Owner & Authorized Representative Details</h3>
                  <p>Information prefilled from your authenticated account. No passwords are stored in this application.</p>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="ownerFullName">Full Legal Name *</label>
                  <input
                    id="ownerFullName"
                    name="ownerFullName"
                    type="text"
                    className={`form-input ${fieldErrors.ownerFullName ? 'input-error' : ''}`}
                    placeholder="e.g. Rajesh Kumar"
                    value={formData.ownerFullName}
                    onChange={handleInputChange}
                    required
                  />
                  {fieldErrors.ownerFullName && <span className="inline-field-error">{fieldErrors.ownerFullName}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="ownerBusinessRole">Role in Business *</label>
                  <select
                    id="ownerBusinessRole"
                    name="ownerBusinessRole"
                    className="form-select"
                    value={formData.ownerBusinessRole}
                    onChange={handleInputChange}
                  >
                    {BUSINESS_ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="ownerPhone">Mobile Contact Number *</label>
                  <div className="input-with-prefix">
                    <span className="input-prefix">+91</span>
                    <input
                      id="ownerPhone"
                      name="ownerPhone"
                      type="tel"
                      className={`form-input has-prefix ${fieldErrors.ownerPhone ? 'input-error' : ''}`}
                      placeholder="9876543210 (10 digits)"
                      value={formData.ownerPhone}
                      onChange={handleInputChange}
                      maxLength={10}
                      required
                    />
                  </div>
                  {fieldErrors.ownerPhone ? (
                    <span className="inline-field-error">{fieldErrors.ownerPhone}</span>
                  ) : (
                    <span className="field-hint">Must be a genuine 10-digit mobile number (starts with 6, 7, 8, or 9).</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="alternatePhone">Alternate Contact Number (Optional)</label>
                  <div className="input-with-prefix">
                    <span className="input-prefix">+91</span>
                    <input
                      id="alternatePhone"
                      name="alternatePhone"
                      type="tel"
                      className={`form-input has-prefix ${fieldErrors.alternatePhone ? 'input-error' : ''}`}
                      placeholder="e.g. 9812345678"
                      value={formData.alternatePhone}
                      onChange={handleInputChange}
                      maxLength={10}
                    />
                  </div>
                  {fieldErrors.alternatePhone && <span className="inline-field-error">{fieldErrors.alternatePhone}</span>}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="businessEmail">Official Email Address *</label>
                <input
                  id="businessEmail"
                  name="businessEmail"
                  type="email"
                  className={`form-input ${fieldErrors.businessEmail ? 'input-error' : ''}`}
                  placeholder="e.g. store@apexautospares.in"
                  value={formData.businessEmail}
                  onChange={handleInputChange}
                  required
                />
                {fieldErrors.businessEmail && <span className="inline-field-error">{fieldErrors.businessEmail}</span>}
                <span className="field-hint">Used for order alerts, compliance updates, and administrative notifications.</span>
              </div>
            </section>
          )}

          {/* STEP 2: SHOP DETAILS */}
          {currentStep === 2 && (
            <section className="form-card-section fade-in">
              <div className="section-head">
                <span className="section-number">B</span>
                <div>
                  <h3>Shop & Commercial Business Details</h3>
                  <p>Store name, category specialization, description, and operating hours for buyer discovery.</p>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="shopName">Shop / Commercial Store Name *</label>
                  <input
                    id="shopName"
                    name="shopName"
                    type="text"
                    className={`form-input ${fieldErrors.shopName ? 'input-error' : ''}`}
                    placeholder="e.g. Apex Auto Spares & Accessories"
                    value={formData.shopName}
                    onChange={handleInputChange}
                    required
                  />
                  {fieldErrors.shopName && <span className="inline-field-error">{fieldErrors.shopName}</span>}
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
                <label htmlFor="shopDescription">Shop Description & Inventory Expertise *</label>
                <textarea
                  id="shopDescription"
                  name="shopDescription"
                  className={`form-textarea ${fieldErrors.shopDescription ? 'input-error' : ''}`}
                  rows="4"
                  placeholder="Detail your automotive spare parts inventory (OEM, aftermarket, performance), brands stocked (Bosch, Brembo, Motul, Valeo), and vehicle models supported..."
                  value={formData.shopDescription}
                  onChange={handleInputChange}
                  required
                />
                <div className="textarea-footer">
                  {fieldErrors.shopDescription ? (
                    <span className="inline-field-error">{fieldErrors.shopDescription}</span>
                  ) : (
                    <span className="field-hint">Minimum 10 characters. Accurately describe your parts offering.</span>
                  )}
                  <span className="char-count">{formData.shopDescription.length} chars</span>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="businessPhone">Store Landline / Office Number (Optional)</label>
                  <input
                    id="businessPhone"
                    name="businessPhone"
                    type="text"
                    className="form-input"
                    placeholder="e.g. 022-28492019"
                    value={formData.businessPhone}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="yearsInBusiness">Years in Business (Optional)</label>
                  <input
                    id="yearsInBusiness"
                    name="yearsInBusiness"
                    type="number"
                    min="0"
                    max="100"
                    className="form-input"
                    placeholder="e.g. 12"
                    value={formData.yearsInBusiness}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="openingHours">Operating Days & Working Hours *</label>
                <input
                  id="openingHours"
                  name="openingHours"
                  type="text"
                  className={`form-input ${fieldErrors.openingHours ? 'input-error' : ''}`}
                  placeholder="e.g. Mon-Sat: 09:00 AM - 08:30 PM (Sun Closed)"
                  value={formData.openingHours}
                  onChange={handleInputChange}
                  required
                />
                {fieldErrors.openingHours && <span className="inline-field-error">{fieldErrors.openingHours}</span>}
              </div>
            </section>
          )}

          {/* STEP 3: SHOP ADDRESS & LOCATION */}
          {currentStep === 3 && (
            <section className="form-card-section fade-in">
              <div className="section-head">
                <span className="section-number">C</span>
                <div>
                  <h3>Physical Store Address & Verified Geolocation</h3>
                  <p>Accurate street address and verified map pin so customers can find your storefront.</p>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="addressLine">Street Address / Shop Number / Building *</label>
                <input
                  id="addressLine"
                  name="addressLine"
                  type="text"
                  className={`form-input ${fieldErrors.addressLine ? 'input-error' : ''}`}
                  placeholder="e.g. Shop #14, Ground Floor, Motor Parts Commercial Complex"
                  value={formData.addressLine}
                  onChange={handleInputChange}
                  required
                />
                {fieldErrors.addressLine && <span className="inline-field-error">{fieldErrors.addressLine}</span>}
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="locality">Area / Locality / Landmark</label>
                  <input
                    id="locality"
                    name="locality"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Opera House / Near Metro Station"
                    value={formData.locality}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="city">City *</label>
                  <input
                    id="city"
                    name="city"
                    type="text"
                    className={`form-input ${fieldErrors.city ? 'input-error' : ''}`}
                    placeholder="e.g. Mumbai"
                    value={formData.city}
                    onChange={handleInputChange}
                    required
                  />
                  {fieldErrors.city && <span className="inline-field-error">{fieldErrors.city}</span>}
                </div>
              </div>

              <div className="form-grid-3">
                <div className="form-group">
                  <label htmlFor="state">State / Province *</label>
                  <input
                    id="state"
                    name="state"
                    type="text"
                    className={`form-input ${fieldErrors.state ? 'input-error' : ''}`}
                    placeholder="e.g. Maharashtra"
                    value={formData.state}
                    onChange={handleInputChange}
                    required
                  />
                  {fieldErrors.state && <span className="inline-field-error">{fieldErrors.state}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="postalCode">PIN Code *</label>
                  <input
                    id="postalCode"
                    name="postalCode"
                    type="text"
                    className={`form-input ${fieldErrors.postalCode ? 'input-error' : ''}`}
                    placeholder="e.g. 400004 (6 digits)"
                    value={formData.postalCode}
                    onChange={handleInputChange}
                    maxLength={6}
                    required
                  />
                  {fieldErrors.postalCode && <span className="inline-field-error">{fieldErrors.postalCode}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="country">Country</label>
                  <input
                    id="country"
                    name="country"
                    type="text"
                    className="form-input readonly-input"
                    value={formData.country}
                    readOnly
                  />
                </div>
              </div>

              {/* Geolocation Section with Interactive Map */}
              <div className="map-picker-container" style={{ marginTop: '20px' }}>
                <div className="map-picker-header">
                  <div>
                    <h4 style={{ margin: 0, color: 'var(--color-navy-primary)' }}>Interactive Store Geolocation Pin</h4>
                    <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                      Click on the map or drag the orange pin to your exact shop entrance. Coordinates are validated before submission.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm detect-geo-btn"
                    onClick={handleDetectLocation}
                    disabled={geoDetecting}
                    title="Retrieve device GPS coordinates"
                  >
                    {geoDetecting ? '📍 Detecting Location...' : '📍 Use My Geolocation'}
                  </button>
                </div>

                {geoSuccessMsg && (
                  <div className="geo-success-banner fade-in">
                    <span>✓ {geoSuccessMsg}</span>
                  </div>
                )}

                <div className="map-frame" style={{ marginTop: '12px' }}>
                  <LocationPickerMap
                    latitude={formData.latitude}
                    longitude={formData.longitude}
                    onChange={handleLocationChange}
                    height="320px"
                  />
                </div>

                <div className="coordinates-manual-row" style={{ marginTop: '12px' }}>
                  <div className="form-group">
                    <label htmlFor="latitude">Latitude (Decimal) *</label>
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
                    <label htmlFor="longitude">Longitude (Decimal) *</label>
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
          )}

          {/* STEP 4: SHOP IMAGES */}
          {currentStep === 4 && (
            <section className="form-card-section fade-in">
              <div className="section-head">
                <span className="section-number">D</span>
                <div>
                  <h3>Shop Photographs (Exterior, Interior & Gallery)</h3>
                  <p>Upload clear photographs showing your shop sign board, counter, and parts shelves. Max 5MB per image.</p>
                </div>
              </div>

              {fieldErrors.shopImages && (
                <div className="auth-alert error-alert fade-in" style={{ marginBottom: '16px' }}>
                  <span>⚠ {fieldErrors.shopImages}</span>
                </div>
              )}

              {/* Slot 1: Shop Exterior Photo */}
              <div className="photo-upload-slot">
                <div className="slot-info">
                  <label className="slot-title">
                    1. Shop Exterior Photograph <span className="req-star">*</span>
                  </label>
                  <p className="slot-desc">Clear front photograph showing your commercial shop board, entrance, and store name.</p>
                </div>

                <div className="slot-action-area">
                  {exteriorPreview ? (
                    <div className="slot-preview-card">
                      <img src={exteriorPreview} alt="Shop Exterior Preview" className="slot-preview-img" />
                      <div className="slot-meta">
                        <span className="badge badge-orange">Exterior Photo</span>
                        <button
                          type="button"
                          className="btn btn-outline btn-xs remove-slot-btn"
                          onClick={() => {
                            URL.revokeObjectURL(exteriorPreview);
                            setExteriorPreview(null);
                            setExteriorFile(null);
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="slot-upload-buttons">
                      <input
                        type="file"
                        id="exterior-file-input"
                        accept="image/*"
                        onChange={handleExteriorFileChange}
                        className="file-native-input"
                      />
                      <label htmlFor="exterior-file-input" className="file-dropzone-button">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                          <circle cx="8.5" cy="8.5" r="1.5"></circle>
                          <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                        <span>Choose Exterior Photo</span>
                      </label>

                      <button
                        type="button"
                        className="camera-trigger-button"
                        onClick={() => {
                          setCameraTarget('exterior');
                          setShowCameraModal(true);
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                          <circle cx="12" cy="13" r="4"></circle>
                        </svg>
                        <span>📷 Capture Exterior</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Slot 2: Shop Interior Photo */}
              <div className="photo-upload-slot">
                <div className="slot-info">
                  <label className="slot-title">
                    2. Shop Interior Photograph
                  </label>
                  <p className="slot-desc">Photograph showing the interior counter, stock shelves, or spare parts inventory displays.</p>
                </div>

                <div className="slot-action-area">
                  {interiorPreview ? (
                    <div className="slot-preview-card">
                      <img src={interiorPreview} alt="Shop Interior Preview" className="slot-preview-img" />
                      <div className="slot-meta">
                        <span className="badge badge-navy">Interior Photo</span>
                        <button
                          type="button"
                          className="btn btn-outline btn-xs remove-slot-btn"
                          onClick={() => {
                            URL.revokeObjectURL(interiorPreview);
                            setInteriorPreview(null);
                            setInteriorFile(null);
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="slot-upload-buttons">
                      <input
                        type="file"
                        id="interior-file-input"
                        accept="image/*"
                        onChange={handleInteriorFileChange}
                        className="file-native-input"
                      />
                      <label htmlFor="interior-file-input" className="file-dropzone-button">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                          <circle cx="8.5" cy="8.5" r="1.5"></circle>
                          <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                        <span>Choose Interior Photo</span>
                      </label>

                      <button
                        type="button"
                        className="camera-trigger-button"
                        onClick={() => {
                          setCameraTarget('interior');
                          setShowCameraModal(true);
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                          <circle cx="12" cy="13" r="4"></circle>
                        </svg>
                        <span>📷 Capture Interior</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Slot 3: Additional Gallery Photos */}
              <div className="photo-upload-slot">
                <div className="slot-info">
                  <label className="slot-title">
                    3. Additional Shop & Workshop Photos (Optional, up to 5 additional)
                  </label>
                  <p className="slot-desc">Additional photos of your storefront, parts storage, workshop, or team.</p>
                </div>

                <div className="upload-buttons-row">
                  <input
                    type="file"
                    id="additional-images-input"
                    multiple
                    accept="image/*"
                    onChange={handleAdditionalImagesChange}
                    className="file-native-input"
                  />
                  <label htmlFor="additional-images-input" className="file-dropzone-button">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                    <span>Select Additional Photos</span>
                  </label>

                  <button
                    type="button"
                    className="camera-trigger-button"
                    onClick={() => {
                      setCameraTarget('additional');
                      setShowCameraModal(true);
                    }}
                  >
                    <span>📷 Snap Additional Photo</span>
                  </button>
                </div>

                {/* Previews Grid for Additional and Existing */}
                <div className="previews-grid" style={{ marginTop: '14px' }}>
                  {existingShopImages.map((imgPath, i) => (
                    <div key={`exist-${i}`} className="preview-tile existing-tile">
                      <img 
                        src={getImageUrl(imgPath)} 
                        alt="Uploaded shop photo" 
                        className="preview-img" 
                      />
                      <span className="existing-tag">On Record</span>
                    </div>
                  ))}

                  {additionalPreviews.map((p, i) => (
                    <div key={`add-${i}`} className="preview-tile">
                      <img src={p.url} alt="Additional Preview" className="preview-img" />
                      <button
                        type="button"
                        className="remove-preview-btn"
                        onClick={() => removeAdditionalImage(i)}
                        aria-label="Remove photo"
                      >
                        ×
                      </button>
                      <span className="file-size-badge">{p.size} MB</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* STEP 5: VERIFICATION DOCUMENTS */}
          {currentStep === 5 && (
            <section className="form-card-section fade-in">
              <div className="section-head">
                <span className="section-number">E</span>
                <div>
                  <h3>Trade Verification Documents (Private & Encrypted)</h3>
                  <p>Submit business verification documents if required by platform compliance. Restricted strictly to authorized staff.</p>
                </div>
              </div>

              <div className="private-doc-banner">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <div>
                  <strong>Confidential Document Protection:</strong>
                  <p>
                    Verification documents (Trade License, GSTIN Certificate, Shop Act Registration, or Business Card) are kept strictly private. They are NOT accessible through public store listings and can only be inspected by authorized administrators and yourself.
                  </p>
                </div>
              </div>

              <div className="upload-subsection" style={{ marginTop: '20px' }}>
                <label className="upload-label">
                  Attach Documents (PDF, JPG, PNG — Max 5 files, 5MB each)
                </label>
                <p className="upload-subtext">Optional for initial draft, but strongly recommended to expedite verification approval.</p>

                <div className="file-input-wrapper">
                  <input
                    type="file"
                    id="documents-input"
                    multiple
                    accept=".pdf,image/*"
                    onChange={handleDocumentsChange}
                    className="file-native-input"
                  />
                  <label htmlFor="documents-input" className="file-dropzone-button doc-dropzone">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                    <span>Upload Verification Documents (PDF / Image)</span>
                  </label>
                </div>

                {/* Document Previews */}
                <div className="documents-list-box" style={{ marginTop: '16px' }}>
                  {existingDocuments.map((docPath, i) => (
                    <div key={`exist-doc-${i}`} className="doc-item-row">
                      <span className="doc-icon">📄</span>
                      <span className="doc-name">{docPath.split('/').pop()}</span>
                      <span className="existing-tag">On Record (Encrypted)</span>
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

                  {existingDocuments.length === 0 && documentPreviews.length === 0 && (
                    <div className="empty-docs-hint">
                      <span>No documents attached yet. You can attach GST certificate or Trade License now or save draft.</span>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* STEP 6: REVIEW & SUBMIT */}
          {currentStep === 6 && (
            <section className="form-card-section fade-in">
              <div className="section-head">
                <span className="section-number">F</span>
                <div>
                  <h3>Application Summary & Final Review</h3>
                  <p>Please review your entered store details carefully before submitting for administrator verification.</p>
                </div>
              </div>

              <div className="review-summary-blocks">
                {/* Block 1: Owner Details */}
                <div className="summary-block">
                  <div className="summary-block-header">
                    <h4>Owner & Contact Information</h4>
                    <button type="button" className="btn-link-edit" onClick={() => setCurrentStep(1)}>Edit</button>
                  </div>
                  <div className="summary-data-table">
                    <div><span>Owner Name:</span><strong>{formData.ownerFullName}</strong></div>
                    <div><span>Role in Business:</span><strong>{formData.ownerBusinessRole}</strong></div>
                    <div><span>Mobile Phone:</span><strong>+91 {formData.ownerPhone}</strong></div>
                    {formData.alternatePhone && <div><span>Alternate Phone:</span><strong>+91 {formData.alternatePhone}</strong></div>}
                    <div><span>Business Email:</span><strong>{formData.businessEmail}</strong></div>
                  </div>
                </div>

                {/* Block 2: Shop Details */}
                <div className="summary-block">
                  <div className="summary-block-header">
                    <h4>Shop Identity & Category</h4>
                    <button type="button" className="btn-link-edit" onClick={() => setCurrentStep(2)}>Edit</button>
                  </div>
                  <div className="summary-data-table">
                    <div><span>Shop Name:</span><strong>{formData.shopName}</strong></div>
                    <div><span>Category:</span><strong>{CATEGORIES.find(c => c.value === formData.shopCategory)?.label}</strong></div>
                    <div><span>Operating Hours:</span><strong>{formData.openingHours}</strong></div>
                    {formData.yearsInBusiness && <div><span>Years in Business:</span><strong>{formData.yearsInBusiness} years</strong></div>}
                    <div className="span-full"><span>Description:</span><p>{formData.shopDescription}</p></div>
                  </div>
                </div>

                {/* Block 3: Location */}
                <div className="summary-block">
                  <div className="summary-block-header">
                    <h4>Physical Address & Map Pin</h4>
                    <button type="button" className="btn-link-edit" onClick={() => setCurrentStep(3)}>Edit</button>
                  </div>
                  <div className="summary-data-table">
                    <div className="span-full">
                      <span>Address:</span>
                      <strong>{formData.addressLine}, {formData.locality ? `${formData.locality}, ` : ''}{formData.city}, {formData.state} - {formData.postalCode}, {formData.country}</strong>
                    </div>
                    <div><span>Coordinates:</span><strong>{formData.latitude}° N, {formData.longitude}° E</strong></div>
                  </div>
                </div>

                {/* Block 4: Photos & Documents */}
                <div className="summary-block">
                  <div className="summary-block-header">
                    <h4>Attached Files</h4>
                    <button type="button" className="btn-link-edit" onClick={() => setCurrentStep(4)}>Edit</button>
                  </div>
                  <div className="summary-data-table">
                    <div>
                      <span>Exterior Photo:</span>
                      <strong>{exteriorFile ? `✓ 1 Selected (${(exteriorFile.size / 1024 / 1024).toFixed(2)} MB)` : (existingShopImages.length > 0 ? '✓ On file' : 'Not provided')}</strong>
                    </div>
                    <div>
                      <span>Interior Photo:</span>
                      <strong>{interiorFile ? `✓ 1 Selected (${(interiorFile.size / 1024 / 1024).toFixed(2)} MB)` : 'Not provided'}</strong>
                    </div>
                    <div>
                      <span>Additional Photos:</span>
                      <strong>{additionalFiles.length} photo(s) attached</strong>
                    </div>
                    <div>
                      <span>Verification Docs:</span>
                      <strong>{existingDocuments.length + documentFiles.length} document(s) attached</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Declaration Checkbox */}
              <div className="declaration-card" style={{ marginTop: '24px' }}>
                <label className="checkbox-container">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    id="declaration-checkbox"
                  />
                  <span className="checkmark"></span>
                  <span className="declaration-text">
                    I declare and confirm that the information provided in this shop application is genuine and accurate. I understand that submitting this application creates a pending review status and does not automatically approve the store or permit live spare parts inventory publishing until verified by EXACTSPARE platform administration.
                  </span>
                </label>
              </div>
            </section>
          )}

          {/* STEP NAVIGATION & ACTION FOOTER */}
          <div className="app-actions-footer">
            <div className="footer-left">
              {currentStep > 1 && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handlePrevStep}
                  id="step-back-btn"
                >
                  ← Back to {STEPS[currentStep - 2].title}
                </button>
              )}
            </div>

            <div className="footer-right">
              <button
                type="button"
                className="btn btn-outline draft-save-btn"
                onClick={handleSaveDraft}
                disabled={savingDraft || submitting}
                id="save-draft-btn"
              >
                {savingDraft ? 'Saving Draft...' : '💾 Save Draft'}
              </button>

              {currentStep < 6 ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleNextStep}
                  id="step-next-btn"
                >
                  Continue to {STEPS[currentStep].title} →
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary submit-final-btn"
                  onClick={handleSubmitApplication}
                  disabled={submitting || !agreedToTerms}
                  id="submit-shop-application-btn"
                >
                  {submitting ? 'Submitting Application...' : (appStatus === 'NEEDS_CORRECTION' ? '✓ Resubmit Application for Review' : '🚀 Submit Application for Review →')}
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Live Camera Snapshot Modal */}
        <CameraCaptureModal
          isOpen={showCameraModal}
          onClose={() => setShowCameraModal(false)}
          onCapture={handleCapturedPhoto}
          title={
            cameraTarget === 'exterior' 
              ? 'Capture Storefront Exterior' 
              : cameraTarget === 'interior' 
                ? 'Capture Storefront Interior' 
                : 'Capture Additional Shop Photo'
          }
        />
      </div>
    </div>
  );
};

export default ShopApplicationPage;
