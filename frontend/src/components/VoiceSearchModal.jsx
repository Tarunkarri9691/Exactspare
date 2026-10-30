import React, { useState, useEffect, useRef } from 'react';
import './VoiceSearchModal.css';

export default function VoiceSearchModal({ isOpen, onClose, onSearch }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
    }
  }, []);

  const startListening = () => {
    setErrorMsg('');
    setTranscript('');

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMsg('Speech recognition is not supported in this browser. Please use the text search bar.');
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'en-IN, en-US';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMsg('');
      };

      recognition.onresult = (event) => {
        const current = event.resultIndex;
        const text = event.results[current][0].transcript;
        setTranscript(text);
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setErrorMsg('Microphone access was denied. Please allow microphone permission in your browser or type in the search bar.');
        } else if (event.error === 'no-speech') {
          setErrorMsg('No speech detected. Please speak clearly or click "Speak Again".');
        } else if (event.error === 'network') {
          setErrorMsg('Network error occurred during speech processing.');
        } else {
          setErrorMsg(`Voice search error: ${event.error}. You can still use standard text search.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
      setErrorMsg('Could not start microphone. Please check browser permissions.');
    }
  };

  useEffect(() => {
    if (isOpen) {
      startListening();
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      setIsListening(false);
      setTranscript('');
      setErrorMsg('');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (transcript.trim()) {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      onSearch(transcript.trim());
      onClose();
    }
  };

  return (
    <div className="voice-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="voice-modal-title">
      <div className="voice-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="voice-modal-header">
          <div className="voice-header-text">
            <span className="voice-badge">🎙️ Voice Discovery</span>
            <h3 id="voice-modal-title" className="voice-title">Spare Part Voice Search</h3>
          </div>
          <button type="button" className="voice-modal-close" onClick={onClose} aria-label="Close voice search">
            ✕
          </button>
        </div>

        <div className="voice-modal-body">
          {isListening && (
            <div className="voice-pulse-ring-container">
              <div className="pulse-ring ring-1"></div>
              <div className="pulse-ring ring-2"></div>
              <div className="voice-mic-active-bubble">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              </div>
            </div>
          )}

          {!isListening && (
            <button type="button" className="voice-mic-idle-bubble" onClick={startListening} title="Click to speak">
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            </button>
          )}

          <p className="voice-status-text">
            {isListening ? 'Listening... Speak part name, e.g. "Honda Activa Brake Shoe"' : 'Click the microphone to speak again'}
          </p>

          {/* Editable Transcript Field so customer can confirm or correct */}
          <form onSubmit={handleSubmit} className="voice-transcript-box">
            <label htmlFor="voice-edit-transcript" className="voice-transcript-label">
              Recognized Part Query (Edit or Confirm):
            </label>
            <input
              id="voice-edit-transcript"
              type="text"
              className="voice-transcript-input"
              placeholder="Your voice query will appear here..."
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
            />
          </form>

          {errorMsg && (
            <div className="voice-error-banner">
              <span>⚠️ {errorMsg}</span>
            </div>
          )}

          {!isSupported && (
            <p className="voice-hint-muted">
              Tip: Voice recognition works best in modern Chrome, Edge, and Safari browsers. Standard text search is always available.
            </p>
          )}
        </div>

        <div className="voice-modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <div className="voice-footer-right">
            {!isListening && (
              <button type="button" className="btn btn-outline" onClick={startListening}>
                🎙️ Speak Again
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={!transcript.trim()}
              id="btn-voice-search-confirm"
            >
              Search Parts →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
