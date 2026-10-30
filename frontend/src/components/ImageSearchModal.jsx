import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchByImage, getImageUrl } from '../services/api';
import './ImageSearchModal.css';

export default function ImageSearchModal({ isOpen, onClose, onSelectPart }) {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [suggestedTerms, setSuggestedTerms] = useState([]);
  const [identifiedInfo, setIdentifiedInfo] = useState(null);
  const [customKeyword, setCustomKeyword] = useState('');

  const fileInputRef = useRef(null);

  // Clear preview and file
  const handleRemoveImage = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl('');
    setUploadError('');
    setSearchResults(null);
    setSuggestedTerms([]);
    setIdentifiedInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Close and cleanup
  const handleClose = () => {
    handleRemoveImage();
    onClose();
  };

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setSearchResults(null);
    setSuggestedTerms([]);
    setIdentifiedInfo(null);

    // Validate size (5MB max)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadError(`Image file size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the maximum limit of 5MB. Please choose a smaller image.`);
      return;
    }

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Invalid image format. Only JPEG, PNG, and WebP images are supported.');
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleAnalyzeImage = async () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    setUploadError('');
    setSearchResults(null);

    try {
      const res = await searchByImage(selectedFile);
      if (res.success && res.data) {
        setSearchResults(res.data.parts || []);
        setSuggestedTerms(res.data.suggestedTerms || []);
        setIdentifiedInfo(res.data.analysis || null);
      } else {
        setUploadError(res.error || 'Failed to identify spare part from the image.');
      }
    } catch {
      setUploadError('Network error while processing visual spare-part search.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="img-modal-backdrop" onClick={handleClose} role="dialog" aria-modal="true" aria-labelledby="img-dialog-title">
      <div className="img-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="img-modal-header">
          <div className="img-header-title">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--color-orange-primary)" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <h2 id="img-dialog-title">Visual Spare-Part Search</h2>
          </div>
          <button type="button" className="img-close-btn" onClick={handleClose} aria-label="Close Image Search">
            ✕
          </button>
        </div>

        <p className="img-modal-subtitle">
          Upload or capture a photograph of your vehicle spare part. Our vision system will analyze visible features and find matching items in actual inventory.
        </p>

        {/* Upload / Drop Area */}
        {!previewUrl ? (
          <div
            className="img-drop-zone"
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
            />
            <div className="img-drop-icon">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="img-drop-prompt">
              <strong>Click to browse</strong> or drag & drop a part photo
            </p>
            <span className="img-drop-formats">JPEG, PNG, or WebP up to 5MB</span>
          </div>
        ) : (
          <div className="img-preview-container">
            <div className="img-preview-frame">
              <img src={previewUrl} alt="Selected spare part preview" className="img-preview-img" />
              <button
                type="button"
                className="img-remove-btn"
                onClick={handleRemoveImage}
                title="Remove this photograph"
              >
                ✕ Remove
              </button>
            </div>
            <div className="img-file-details">
              <span>{selectedFile?.name}</span>
              <span>({(selectedFile?.size / 1024).toFixed(0)} KB)</span>
            </div>

            {!searchResults && !isAnalyzing && (
              <button
                type="button"
                className="btn btn-primary img-submit-btn"
                onClick={handleAnalyzeImage}
              >
                Identify Part & Search Inventory
              </button>
            )}
          </div>
        )}

        {/* Error Alert */}
        {uploadError && (
          <div className="img-error-alert" role="alert">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{uploadError}</span>
          </div>
        )}

        {/* Analyzing Spinner */}
        {isAnalyzing && (
          <div className="img-analyzing-state">
            <div className="spin-ring"></div>
            <div>
              <strong>Analyzing part photograph...</strong>
              <p>Scanning visible contours, manufacturer markings, and categories against MongoDB catalog.</p>
            </div>
          </div>
        )}

        {/* Identification Suggestions & Inventory Results */}
        {searchResults !== null && (
          <div className="img-results-section fade-in">
            {/* Visual AI Suggestion Badge */}
            <div className="img-ai-banner">
              <div className="img-ai-banner-head">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--color-orange-primary)" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                <span>Visual Analysis Suggestion (Non-Guaranteed):</span>
              </div>
              <div className="img-suggested-tags">
                {suggestedTerms.map((term, i) => (
                  <button
                    key={i}
                    type="button"
                    className="img-tag-btn"
                    onClick={() => {
                      setCustomKeyword(term);
                    }}
                  >
                    🔍 {term}
                  </button>
                ))}
              </div>
              {identifiedInfo?.confidence && (
                <span className="img-confidence-note">
                  Confidence: {identifiedInfo.confidence}
                </span>
              )}
            </div>

            {/* Confirm or Correct Detected Part Name */}
            <div className="img-confirm-search-box" style={{ margin: '14px 0', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <label htmlFor="confirm-img-keyword" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Confirm or Correct Detected Part Name:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  id="confirm-img-keyword"
                  type="text"
                  className="form-input"
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  placeholder="e.g. Brake Pads, Spark Plug, Air Filter..."
                  value={customKeyword || identifiedInfo?.probablePartName || ''}
                  onChange={(e) => setCustomKeyword(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    const finalQuery = (customKeyword || identifiedInfo?.probablePartName || '').trim();
                    if (finalQuery) {
                      handleClose();
                      navigate(`/parts?search=${encodeURIComponent(finalQuery)}`);
                    }
                  }}
                >
                  Search Catalog →
                </button>
              </div>
            </div>

            {/* Actual Inventory Matches */}
            <h4 className="img-matches-heading">
              Matching Inventory ({searchResults.length} found)
            </h4>

            {searchResults.length === 0 ? (
              <div className="img-no-matches">
                <p>No exact catalog matches were found for the detected visual attributes.</p>
                <div className="img-manual-search-box">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter part name or number manually..."
                    value={customKeyword}
                    onChange={(e) => setCustomKeyword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={!customKeyword.trim()}
                    onClick={() => {
                      handleClose();
                      navigate(`/parts?search=${encodeURIComponent(customKeyword.trim())}`);
                    }}
                  >
                    Search
                  </button>
                </div>
              </div>
            ) : (
              <div className="img-parts-list">
                {searchResults.map((part) => (
                  <div key={part._id} className="img-part-card">
                    {part.imagePaths?.[0] ? (
                      <img
                        src={getImageUrl(part.imagePaths[0])}
                        alt={part.partName}
                        className="img-part-thumb"
                      />
                    ) : (
                      <div className="img-part-thumb-placeholder">Part</div>
                    )}
                    <div className="img-part-details">
                      <h5>{part.partName}</h5>
                      <span className="img-part-meta">
                        Part #: <strong>{part.partNumber}</strong> | {part.category}
                      </span>
                      <span className="img-part-shop">
                        Shop: <strong>{part.shopId?.shopName || 'Approved Shop'}</strong>
                      </span>
                    </div>
                    <div className="img-part-action">
                      <span className="img-part-price">₹{part.price}</span>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          handleClose();
                          if (onSelectPart) onSelectPart(part);
                          else navigate(`/parts/${part._id}`);
                        }}
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
