import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { searchByIdentifier } from '../services/api';
import './BarcodeScannerModal.css';

const BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39
];

const QR_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE
];

const ALL_FORMATS = [...BARCODE_FORMATS, ...QR_FORMATS];

export default function BarcodeScannerModal({ isOpen, onClose, onSelectPart, initialMode = 'all' }) {
  const navigate = useNavigate();
  const [scanMode, setScanMode] = useState(initialMode); // 'all', 'barcode', 'qr'
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [urlWarning, setUrlWarning] = useState(null);

  const scannerRef = useRef(null);
  const isScanningRef = useRef(false);
  const lastScannedCodeRef = useRef('');
  const lastScannedTimeRef = useRef(0);
  const containerId = 'exactspare-reader-container';

  // Stop camera stream safely
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (isScanningRef.current) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.warn('Scanner stop error:', err);
      } finally {
        scannerRef.current = null;
        isScanningRef.current = false;
        setIsCameraActive(false);
      }
    }
  }, []);

  // Handle scanned text
  const handleScannedValue = useCallback(async (decodedText) => {
    if (!decodedText || typeof decodedText !== 'string') return;
    const cleanText = decodedText.trim();
    if (!cleanText) return;

    // Debounce duplicate scans within 3 seconds
    const now = Date.now();
    if (lastScannedCodeRef.current === cleanText && now - lastScannedTimeRef.current < 3000) {
      return;
    }
    lastScannedCodeRef.current = cleanText;
    lastScannedTimeRef.current = now;

    // Stop scanner once detected
    await stopScanner();

    // Check if decoded value is a URL
    if (/^https?:\/\//i.test(cleanText)) {
      try {
        const parsedUrl = new URL(cleanText);
        const isCurrentHost = parsedUrl.hostname === window.location.hostname;
        const partMatch = parsedUrl.pathname.match(/\/(?:parts|product)\/([a-zA-Z0-9_-]+)/i);

        if (isCurrentHost && partMatch && partMatch[1]) {
          // Internal recognized EXACTSPARE product URL
          lookupIdentifier(partMatch[1]);
          return;
        } else {
          // Arbitrary external URL - NEVER automatically navigate or download
          setUrlWarning({
            url: cleanText,
            domain: parsedUrl.hostname,
            path: parsedUrl.pathname
          });
          setScanResult(null);
          return;
        }
      } catch {
        // Fallback to identifier lookup
      }
    }

    setUrlWarning(null);
    lookupIdentifier(cleanText);
  }, [stopScanner]);

  // Lookup identifier against actual MongoDB inventory
  const lookupIdentifier = async (code) => {
    if (!code) return;
    setIsSearching(true);
    setSearchError('');
    setScanResult(null);

    try {
      const res = await searchByIdentifier(code);
      if (res.success && res.data) {
        setScanResult(res.data);
      } else {
        setSearchError(res.error || `No exact match found for identifier "${code}".`);
        setScanResult({ notFound: true, queryCode: code });
      }
    } catch {
      setSearchError('Network error while searching for spare part identifier.');
    } finally {
      setIsSearching(false);
    }
  };

  // Start Camera scanning on explicit user action
  const startScanner = async () => {
    setCameraError('');
    setUrlWarning(null);
    setSearchError('');
    setScanResult(null);

    // Verify browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access is not supported by your browser or requires a secure (HTTPS or localhost) connection. Please enter the code manually below.');
      return;
    }

    try {
      // First ensure previous scanner is cleared
      await stopScanner();

      let formats = ALL_FORMATS;
      if (scanMode === 'barcode') formats = BARCODE_FORMATS;
      else if (scanMode === 'qr') formats = QR_FORMATS;

      const html5QrCode = new Html5Qrcode(containerId, {
        formatsToSupport: formats,
        verbose: false
      });
      scannerRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: scanMode === 'barcode' ? { width: 300, height: 160 } : { width: 220, height: 220 },
        aspectRatio: 1.0
      };

      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          handleScannedValue(decodedText);
        },
        () => {
          // Frame scan error (no barcode detected yet) - ignore harmless frame ticks
        }
      );

      isScanningRef.current = true;
      setIsCameraActive(true);
    } catch (err) {
      console.error('Camera start error:', err);
      let msg = 'Failed to access camera.';
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission')) {
        msg = 'Camera permission was denied. Please allow camera access in your browser settings to scan spare-part barcodes or QR codes.';
      } else if (err.name === 'NotFoundError' || err.message?.includes('NotFound')) {
        msg = 'No camera device found on this system. You can enter the barcode or part number manually below.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Camera is currently in use by another application. Please close other camera tabs and try again.';
      } else if (err.message) {
        msg = `Camera initialization error: ${err.message}`;
      }
      setCameraError(msg);
      setIsCameraActive(false);
      isScanningRef.current = false;
    }
  };

  // Manual code submission
  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    stopScanner();
    setUrlWarning(null);
    lookupIdentifier(manualCode.trim());
  };

  // Close modal and cleanup
  const handleClose = useCallback(async () => {
    await stopScanner();
    setScanResult(null);
    setSearchError('');
    setUrlWarning(null);
    setManualCode('');
    onClose();
  }, [stopScanner, onClose]);

  // Clean up scanner on unmount or when modal is closed
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
    }
    return () => {
      stopScanner();
    };
  }, [isOpen, stopScanner]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <div className="scanner-modal-backdrop" onClick={handleClose} role="dialog" aria-modal="true" aria-labelledby="scanner-dialog-title">
      <div className="scanner-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="scanner-modal-header">
          <div className="scanner-header-title">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--color-orange-primary)" strokeWidth="2">
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
              <rect x="7" y="7" width="10" height="10" rx="1" />
            </svg>
            <h2 id="scanner-dialog-title">Barcode & QR Part Scanner</h2>
          </div>
          <button type="button" className="scanner-close-btn" onClick={handleClose} aria-label="Close Scanner">
            ✕
          </button>
        </div>

        {/* Scan Mode Selector */}
        <div className="scanner-mode-tabs">
          <button
            type="button"
            className={`scanner-tab-btn ${scanMode === 'all' ? 'active' : ''}`}
            onClick={() => {
              stopScanner();
              setScanMode('all');
            }}
          >
            All Formats
          </button>
          <button
            type="button"
            className={`scanner-tab-btn ${scanMode === 'barcode' ? 'active' : ''}`}
            onClick={() => {
              stopScanner();
              setScanMode('barcode');
            }}
          >
            Barcode (EAN/UPC/Code 128)
          </button>
          <button
            type="button"
            className={`scanner-tab-btn ${scanMode === 'qr' ? 'active' : ''}`}
            onClick={() => {
              stopScanner();
              setScanMode('qr');
            }}
          >
            QR Code
          </button>
        </div>

        {/* Camera Viewfinder Area */}
        <div className="scanner-viewfinder-wrapper">
          <div id={containerId} className="scanner-video-box"></div>

          {!isCameraActive && (
            <div className="scanner-idle-overlay">
              <div className="scanner-idle-icon">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
              <p>Camera is currently idle. Click below to grant camera access and start scanning.</p>
              <button
                type="button"
                className="btn btn-primary scanner-start-btn"
                onClick={startScanner}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                Start Camera Scan
              </button>
            </div>
          )}

          {isCameraActive && (
            <div className="scanner-active-controls">
              <span className="scanner-live-badge">● Live Scanner Active</span>
              <button
                type="button"
                className="btn btn-secondary scanner-stop-btn"
                onClick={stopScanner}
              >
                Stop Camera
              </button>
            </div>
          )}
        </div>

        {/* Camera Permission / Device Error */}
        {cameraError && (
          <div className="scanner-error-alert" role="alert">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <strong>Camera Access Notice:</strong>
              <p>{cameraError}</p>
            </div>
          </div>
        )}

        {/* Safe External URL Warning for QR codes */}
        {urlWarning && (
          <div className="scanner-warning-box">
            <div className="scanner-warning-head">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--color-orange-primary)" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <h4>External Link Detected</h4>
            </div>
            <p className="scanner-warning-desc">
              For your safety, EXACTSPARE never automatically opens external websites or downloads files from QR codes.
            </p>
            <div className="scanner-raw-url">
              <code>{urlWarning.url}</code>
            </div>
            <div className="scanner-warning-actions">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  navigator.clipboard?.writeText(urlWarning.url);
                }}
              >
                Copy Text
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setUrlWarning(null);
                  lookupIdentifier(urlWarning.url);
                }}
              >
                Search As Part Identifier
              </button>
            </div>
          </div>
        )}

        {/* Searching Indicator */}
        {isSearching && (
          <div className="scanner-searching-state">
            <div className="auth-spinner">
              <div className="spin-ring"></div>
            </div>
            <span>Verifying code against approved shop inventory...</span>
          </div>
        )}

        {/* Result: Found Part */}
        {scanResult && !scanResult.notFound && (
          <div className="scanner-result-card fade-in">
            <div className="scanner-result-badge">
              ✓ Verified Database Match ({scanResult.matchedBy || 'Identifier'})
            </div>
            <div className="scanner-result-body">
              {scanResult.imagePaths?.[0] ? (
                <img
                  src={scanResult.imagePaths[0].startsWith('http') ? scanResult.imagePaths[0] : `http://localhost:5000${scanResult.imagePaths[0]}`}
                  alt={scanResult.partName}
                  className="scanner-result-thumb"
                />
              ) : (
                <div className="scanner-result-thumb-placeholder">Part</div>
              )}
              <div className="scanner-result-info">
                <h4>{scanResult.partName}</h4>
                <p className="scanner-result-meta">
                  <span>Part #: <strong>{scanResult.partNumber}</strong></span>
                  {scanResult.barcode && <span> | Barcode: <strong>{scanResult.barcode}</strong></span>}
                </p>
                <p className="scanner-result-shop">
                  Shop: <strong>{scanResult.shopId?.shopName || 'Approved Shop'}</strong>
                </p>
                <div className="scanner-result-price-row">
                  <span className="scanner-result-price">₹{scanResult.price}</span>
                  <span className={`scanner-stock-tag ${scanResult.stockQuantity > 0 ? 'in-stock' : 'out-stock'}`}>
                    {scanResult.stockQuantity > 0 ? `${scanResult.stockQuantity} in stock` : 'Out of stock'}
                  </span>
                </div>
              </div>
            </div>
            <div className="scanner-result-footer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  handleClose();
                  if (onSelectPart) onSelectPart(scanResult);
                  else navigate(`/parts/${scanResult._id}`);
                }}
              >
                View Full Part Details →
              </button>
            </div>
          </div>
        )}

        {/* Result: Not Found in DB */}
        {scanResult && scanResult.notFound && (
          <div className="scanner-not-found-card fade-in">
            <div className="scanner-not-found-head">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
              <h4>No Exact Match Found</h4>
            </div>
            <p>
              Scanned code <code>{scanResult.queryCode}</code> did not match any barcode, SKU, or MPN in the current published inventory.
            </p>
            <div className="scanner-not-found-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  handleClose();
                  navigate(`/parts?search=${encodeURIComponent(scanResult.queryCode)}`);
                }}
              >
                Search Marketplace for "{scanResult.queryCode}"
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setScanResult(null);
                  startScanner();
                }}
              >
                Scan Another Code
              </button>
            </div>
          </div>
        )}

        {/* Search Error Notice */}
        {searchError && !scanResult && (
          <div className="scanner-error-text">
            <span>{searchError}</span>
          </div>
        )}

        {/* Manual Code Input Option */}
        <div className="scanner-manual-section">
          <div className="scanner-divider">
            <span>OR ENTER MANUALLY</span>
          </div>
          <form className="scanner-manual-form" onSubmit={handleManualSubmit}>
            <input
              type="text"
              className="form-input scanner-manual-input"
              placeholder="Enter barcode, SKU, MPN, or part number..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              aria-label="Enter barcode or part number manually"
              maxLength={100}
            />
            <button
              type="submit"
              className="btn btn-primary scanner-manual-btn"
              disabled={!manualCode.trim() || isSearching}
            >
              Verify Code
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
