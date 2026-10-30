import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { fetchAiAssistantResponse, fetchAiStatus, getImageUrl } from '../services/api';
import { useCompare } from '../context/CompareContext';
import { useVehicle } from '../context/VehicleContext';
import './AiAssistantModal.css';

const INITIAL_MESSAGE = {
  id: 'init-msg',
  sender: 'assistant',
  text: "Hello! I am your EXACTSPARE Parts Assistant. Tell me what spare part you need and your vehicle details, and I will find verified, in-stock parts from registered partner shops.",
  followUps: [
    'Brake pads for Honda Activa',
    'Air filter for Maruti Swift',
    'Battery for Royal Enfield Classic 350',
    'Affordable spark plug under 500'
  ],
  products: []
};

const AiAssistantModal = ({ isOpen, onClose, initialQuery = '' }) => {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [providerInfo, setProviderInfo] = useState({ isConfigured: false, provider: 'none' });
  const [alertMsg, setAlertMsg] = useState('');

  const { vehicle } = useVehicle();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const { addToCompare, isInCompare, openCompareModal } = useCompare();

  // Fetch AI status on mount
  useEffect(() => {
    const checkStatus = async () => {
      const res = await fetchAiStatus();
      if (res.success) {
        setProviderInfo(res.data);
      }
    };
    checkStatus();
  }, []);

  // Handle auto-focus and initial query when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
      if (initialQuery && initialQuery.trim()) {
        handleSendMessage(initialQuery.trim());
      }
    }
  }, [isOpen]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputValue).trim();
    if (!query || loading) return;

    setInputValue('');

    // Add user message
    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetchAiAssistantResponse({
        message: query,
        history: messages.slice(-4).map((m) => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text
        })),
        context: {
          vehicle: vehicle?.vehicleType ? vehicle : null
        }
      });

      if (res.success && res.data) {
        const assistantMsg = {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: res.data.response,
          isAiPowered: res.data.isAiPowered,
          providerMode: res.data.providerMode,
          followUps: res.data.followUps || [],
          products: res.data.products || [],
          missingDetails: res.data.missingDetails || []
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        const errorMsg = {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: `⚠️ ${res.error || 'I could not process your query at this moment. Please try searching in the main catalog.'}`,
          followUps: ['Browse all spare parts', 'Find nearby shops'],
          products: []
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err) {
      const errorMsg = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: '⚠️ An unexpected network issue occurred while connecting to the assistant.',
        followUps: [],
        products: []
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleSendMessage();
  };

  const handleClearChat = () => {
    setMessages([INITIAL_MESSAGE]);
  };

  const handleCompare = (product) => {
    const res = addToCompare(product);
    if (res.success) {
      openCompareModal();
    } else {
      setAlertMsg(res.message);
      setTimeout(() => setAlertMsg(''), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ai-modal-backdrop" onClick={onClose}>
      <div className="ai-modal-window" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ai-modal-header">
          <div className="ai-header-info">
            <div className="ai-avatar-icon">🤖</div>
            <div>
              <div className="ai-title-row">
                <h3 className="ai-title">EXACTSPARE Assistant</h3>
                <span className={`ai-mode-tag ${providerInfo.isConfigured ? 'mode-ai' : 'mode-rule'}`}>
                  {providerInfo.isConfigured ? '⚡ AI-Powered' : '🔍 Smart Search'}
                </span>
              </div>
              <span className="ai-status-sub">
                {providerInfo.isConfigured
                  ? `Active Model: ${providerInfo.model || 'Generative AI'}`
                  : 'Verified Catalog Search Engine'}
              </span>
            </div>
          </div>

          <div className="ai-header-controls">
            <button
              className="ai-action-icon-btn"
              onClick={handleClearChat}
              title="Reset Conversation"
            >
              🔄
            </button>
            <button className="ai-action-icon-btn" onClick={onClose} title="Close Assistant">
              ✕
            </button>
          </div>
        </div>

        {/* Global Toast Alert */}
        {alertMsg && (
          <div className="ai-toast-banner">
            {alertMsg}
          </div>
        )}

        {/* Message Thread */}
        <div className="ai-chat-thread">
          {messages.map((msg) => (
            <div key={msg.id} className={`ai-message-row row-${msg.sender}`}>
              {msg.sender === 'assistant' && (
                <div className="ai-msg-avatar">🤖</div>
              )}

              <div className={`ai-msg-bubble bubble-${msg.sender}`}>
                {/* Text Content */}
                <div className="ai-msg-text">
                  {msg.text.split('\n\n').map((para, pIdx) => (
                    <p key={pIdx}>
                      {para.split('**').map((chunk, cIdx) =>
                        cIdx % 2 === 1 ? <strong key={cIdx}>{chunk}</strong> : chunk
                      )}
                    </p>
                  ))}
                </div>

                {/* Missing Details Advice Chip */}
                {msg.missingDetails?.length > 0 && (
                  <div className="missing-details-chip">
                    <span>💡 Missing for exact fitment: <strong>{msg.missingDetails.join(', ')}</strong></span>
                  </div>
                )}

                {/* Verified Product Cards Carousel/List */}
                {msg.products && msg.products.length > 0 && (
                  <div className="ai-products-list">
                    <span className="ai-products-heading">
                      Verified Matching Inventory ({msg.products.length})
                    </span>
                    <div className="ai-products-grid">
                      {msg.products.map((p) => {
                        const inCompare = isInCompare(p._id);
                        return (
                          <div key={p._id} className="ai-part-card">
                            <div className="ai-card-img-wrap">
                              {p.image ? (
                                <img
                                  src={getImageUrl(p.image)}
                                  alt={p.partName}
                                  className="ai-card-img"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="ai-no-img">⚙️</div>
                              )}
                            </div>

                            <div className="ai-card-details">
                              <span className="ai-card-brand">{p.manufacturer}</span>
                              <h5 className="ai-card-name">
                                <Link to={`/parts/${p._id}`} onClick={onClose} title={p.partName}>
                                  {p.partName}
                                </Link>
                              </h5>

                              <div className="ai-card-meta">
                                <span className="ai-card-price">
                                  ₹{p.price?.toLocaleString('en-IN')}
                                </span>
                                <span className="ai-card-stock">
                                  {p.stockQuantity > 0 ? 'In Stock' : 'Out of Stock'}
                                </span>
                              </div>

                              <div className="ai-card-shop">
                                🏬 {p.shopName} · {p.shopCity}
                              </div>

                              <div className="ai-card-actions">
                                <Link
                                  to={`/parts/${p._id}`}
                                  className="btn btn-xs btn-primary"
                                  onClick={onClose}
                                  style={{ textDecoration: 'none' }}
                                >
                                  View Details
                                </Link>
                                <button
                                  className={`btn btn-xs ${inCompare ? 'btn-active-compare' : 'btn-outline'}`}
                                  onClick={() => handleCompare(p)}
                                >
                                  {inCompare ? '✓' : '⚖️ Compare'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Follow-up Prompts */}
                {msg.followUps && msg.followUps.length > 0 && (
                  <div className="ai-followup-chips">
                    {msg.followUps.map((chip, idx) => (
                      <button
                        key={idx}
                        className="ai-followup-chip"
                        onClick={() => handleSendMessage(chip)}
                        disabled={loading}
                      >
                        {chip} ➔
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading Indicator */}
          {loading && (
            <div className="ai-message-row row-assistant">
              <div className="ai-msg-avatar">🤖</div>
              <div className="ai-msg-bubble bubble-assistant ai-typing-indicator">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-label">Checking verified inventory...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form className="ai-modal-input-bar" onSubmit={handleFormSubmit}>
          <input
            ref={inputRef}
            type="text"
            className="ai-input-field"
            placeholder="Ask about parts, compatibility, or prices (e.g. Brake pads for Activa)..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={loading}
            maxLength={500}
          />
          <button
            type="submit"
            className="btn btn-primary ai-send-btn"
            disabled={loading || !inputValue.trim()}
          >
            Send 🚀
          </button>
        </form>
      </div>
    </div>
  );
};

export default AiAssistantModal;
