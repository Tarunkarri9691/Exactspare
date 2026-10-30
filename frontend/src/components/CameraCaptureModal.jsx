import React, { useState, useRef, useEffect } from 'react';
import './CameraCaptureModal.css';

const CameraCaptureModal = ({ isOpen, onClose, onCapture, title = 'Take Photo with Camera' }) => {
  const [stream, setStream] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [capturedUrl, setCapturedUrl] = useState('');
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (back) or 'user' (front)
  const [cameraError, setCameraError] = useState('');
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Start Camera Stream
  const startCamera = async (mode = facingMode) => {
    setIsLoadingCamera(true);
    setCameraError('');

    // Stop any existing stream
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser or environment.');
      }

      const constraints = {
        video: {
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.warn('Primary camera mode failed, falling back to any video device:', err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
        }
      } catch (fallbackErr) {
        setCameraError(
          fallbackErr.name === 'NotAllowedError'
            ? 'Camera access was denied. Please allow camera permissions in your browser.'
            : 'Could not connect to camera. Please make sure your camera is connected and not in use by another app.'
        );
      }
    } finally {
      setIsLoadingCamera(false);
    }
  };

  // Stop camera stream completely
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (capturedUrl) {
      URL.revokeObjectURL(capturedUrl);
      setCapturedUrl('');
    }
    setCapturedBlob(null);
    setCameraError('');
  };

  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Flip between front and back camera
  const handleToggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Capture Snapshot from Video Frame
  const handleSnapPhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setCapturedBlob(blob);
        setCapturedUrl(url);
      },
      'image/jpeg',
      0.92
    );
  };

  // Retake photo
  const handleRetake = () => {
    if (capturedUrl) {
      URL.revokeObjectURL(capturedUrl);
      setCapturedUrl('');
    }
    setCapturedBlob(null);
  };

  // Confirm photo and return file to parent
  const handleConfirmPhoto = () => {
    if (!capturedBlob) return;
    const filename = `camera-snap-${Date.now()}.jpg`;
    const file = new File([capturedBlob], filename, { type: 'image/jpeg' });
    onCapture(file);
    handleCloseModal();
  };

  const handleCloseModal = () => {
    stopCamera();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="camera-modal-backdrop" onClick={handleCloseModal}>
      <div className="camera-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="camera-modal-header">
          <div className="camera-modal-title-group">
            <span className="camera-icon-badge">📷</span>
            <h3>{title}</h3>
          </div>
          <button type="button" className="camera-close-btn" onClick={handleCloseModal} aria-label="Close camera">
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="camera-modal-body">
          {cameraError ? (
            <div className="camera-error-box">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <p>{cameraError}</p>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => startCamera(facingMode)}>
                Try Again
              </button>
            </div>
          ) : (
            <div className="camera-viewport-container">
              {/* Live Video Feed */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`camera-video-stream ${capturedUrl ? 'hidden-stream' : ''}`}
                onLoadedMetadata={() => videoRef.current?.play().catch(() => {})}
              />

              {/* Still Photo Preview after Capture */}
              {capturedUrl && (
                <img src={capturedUrl} alt="Captured preview" className="camera-captured-preview" />
              )}

              {/* Hidden Canvas for Drawing */}
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {/* Viewfinder Target Overlay */}
              {!capturedUrl && !isLoadingCamera && (
                <div className="camera-target-crosshairs">
                  <div className="crosshair-corner top-left"></div>
                  <div className="crosshair-corner top-right"></div>
                  <div className="crosshair-corner bottom-left"></div>
                  <div className="crosshair-corner bottom-right"></div>
                  <span className="camera-live-tag">LIVE CAMERA</span>
                </div>
              )}

              {isLoadingCamera && (
                <div className="camera-loading-overlay">
                  <div className="camera-spinner"></div>
                  <span>Starting camera...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Controls Footer */}
        <div className="camera-modal-footer">
          {!cameraError && (
            <>
              {!capturedUrl ? (
                <div className="camera-action-controls">
                  <button
                    type="button"
                    className="btn btn-outline-navy camera-switch-btn"
                    onClick={handleToggleFacingMode}
                    title="Flip between front and rear camera"
                  >
                    🔄 Flip Camera
                  </button>

                  <button
                    type="button"
                    className="btn-shutter-capture"
                    onClick={handleSnapPhoto}
                    disabled={isLoadingCamera || !stream}
                    title="Capture photo now"
                  >
                    <span className="shutter-inner-circle"></span>
                  </button>

                  <button type="button" className="btn btn-outline camera-cancel-btn" onClick={handleCloseModal}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="camera-review-controls">
                  <button type="button" className="btn btn-outline" onClick={handleRetake}>
                    🔄 Retake Photo
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleConfirmPhoto}>
                    ✔ Use This Photo
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraCaptureModal;
