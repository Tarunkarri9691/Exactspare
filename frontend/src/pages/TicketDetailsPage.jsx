import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchSupportTicketDetails, replySupportTicket } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './TicketDetailsPage.css';

const TicketDetailsPage = () => {
  const { ticketId } = useParams();
  const { user } = useAuth();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Reply state
  const [replyMessage, setReplyMessage] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replyError, setReplyError] = useState(null);
  const [replySuccess, setReplySuccess] = useState(null);

  const messagesEndRef = useRef(null);

  const loadTicket = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSupportTicketDetails(ticketId);
      if (res.success && res.data) {
        setTicket(res.data);
      } else {
        setError(res.error || 'Failed to retrieve ticket details.');
      }
    } catch {
      setError('An error occurred while loading this ticket.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  // Scroll to latest message
  useEffect(() => {
    if (ticket?.messages?.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [ticket?.messages]);

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim()) return;

    setReplyError(null);
    setReplySuccess(null);
    setSubmittingReply(true);

    try {
      const res = await replySupportTicket(ticketId, replyMessage.trim());
      if (res.success && res.data) {
        setTicket(res.data);
        setReplyMessage('');
        setReplySuccess('Your reply has been posted successfully.');
        setTimeout(() => setReplySuccess(null), 4000);
      } else {
        setReplyError(res.error || 'Failed to submit reply.');
      }
    } catch {
      setReplyError('Network error while posting reply.');
    } finally {
      setSubmittingReply(false);
    }
  };

  if (loading) {
    return (
      <div className="ticket-details-root">
        <div className="container">
          <div className="ticket-loading-state">
            <div className="ticket-spinner"></div>
            <p>Loading ticket conversation...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="ticket-details-root">
        <div className="container">
          <div className="ticket-error-card">
            <div className="error-icon">⚠️</div>
            <h2>Ticket Not Found</h2>
            <p>{error || 'The requested ticket could not be found or you do not have permission to view it.'}</p>
            <Link to="/support" className="btn btn-primary">
              Back to Support Center
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isClosed = ticket.status === 'CLOSED';
  const isResolved = ticket.status === 'RESOLVED';

  const createdDate = new Date(ticket.createdAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="ticket-details-root">
      <div className="container">
        {/* Breadcrumb */}
        <div className="ticket-breadcrumb">
          <Link to="/">Home</Link>
          <span className="breadcrumb-separator">/</span>
          <Link to="/support">Support Center</Link>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">{ticket.ticketNumber}</span>
        </div>

        {/* Ticket Header Card */}
        <div className="ticket-header-card">
          <div className="ticket-header-left">
            <div className="ticket-meta-tags">
              <span className="ticket-badge-number">{ticket.ticketNumber}</span>
              <span className={`category-tag category-${ticket.category.toLowerCase()}`}>
                {ticket.category}
              </span>
              <span className={`status-pill status-${ticket.status.toLowerCase()}`}>
                {ticket.status.replace(/_/g, ' ')}
              </span>
              <span className={`priority-tag priority-${ticket.priority?.toLowerCase()}`}>
                {ticket.priority} Priority
              </span>
            </div>

            <h1 className="ticket-title">{ticket.subject}</h1>
            <p className="ticket-timestamp-meta">Created on {createdDate}</p>
          </div>

          <div className="ticket-header-right">
            <Link to="/support" className="btn btn-outline-navy btn-sm">
              ← Back to All Tickets
            </Link>
          </div>
        </div>

        {/* Linked Order Banner if present */}
        {ticket.orderId && (
          <div className="linked-order-banner">
            <div className="linked-order-icon">📦</div>
            <div className="linked-order-info">
              <strong>Linked Order #{ticket.orderId.orderNumber}</strong>
              <p>
                Status: <strong>{ticket.orderId.orderStatus}</strong> • Total: ₹
                {ticket.orderId.totalAmount?.toLocaleString('en-IN')}
              </p>
            </div>
            {user?.role === 'SHOP_OWNER' && (
              <Link
                to="/owner/orders"
                className="btn btn-primary btn-sm track-linked-btn"
              >
                View Shop Orders →
              </Link>
            )}
          </div>
        )}

        {/* Main Conversation Thread */}
        <div className="conversation-thread-card">
          <div className="thread-header">
            <h2>Ticket Conversation History</h2>
            <span className="thread-count">{ticket.messages?.length || 0} message(s)</span>
          </div>

          <div className="thread-messages-list">
            {(ticket.messages || []).map((msg, index) => {
              const isSenderCustomer = msg.senderRole === 'CUSTOMER';
              const isCurrentUser = msg.senderId === user?.id || (user?.role === 'CUSTOMER' && isSenderCustomer);
              const msgDate = new Date(msg.createdAt).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={msg._id || index}
                  className={`message-bubble-row ${isCurrentUser ? 'row-current-user' : 'row-other-user'} ${
                    isSenderCustomer ? 'role-customer' : 'role-support'
                  }`}
                >
                  <div className="message-avatar">
                    {isSenderCustomer ? '👤' : '🛡️'}
                  </div>

                  <div className="message-bubble-box">
                    <div className="message-bubble-header">
                      <strong className="sender-display-name">
                        {isCurrentUser ? `${msg.senderName} (You)` : msg.senderName}
                      </strong>
                      <span className={`sender-role-tag ${isSenderCustomer ? 'tag-customer' : 'tag-admin'}`}>
                        {isSenderCustomer ? 'Customer' : 'Support Specialist'}
                      </span>
                      <span className="message-time">{msgDate}</span>
                    </div>

                    <div className="message-bubble-text">
                      {msg.message}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Feedback alerts */}
          {replySuccess && (
            <div className="alert-reply-success">
              <span>✓ {replySuccess}</span>
            </div>
          )}

          {replyError && (
            <div className="alert-reply-error">
              <span>⚠️ {replyError}</span>
            </div>
          )}

          {/* Reply Form Section */}
          <div className="thread-reply-section">
            {isClosed ? (
              <div className="closed-ticket-notice">
                <span className="closed-icon">🔒</span>
                <div>
                  <strong>This ticket is CLOSED</strong>
                  <p>
                    This ticket has been completed and closed by support administrators. If you require further assistance, please open a new ticket.
                  </p>
                </div>
                <Link to="/support" className="btn btn-outline-navy btn-sm">
                  Open New Ticket
                </Link>
              </div>
            ) : (
              <form onSubmit={handleReplySubmit} className="reply-form">
                {isResolved && (
                  <div className="resolved-ticket-hint">
                    ℹ️ This ticket was marked as <strong>RESOLVED</strong>. Sending a reply will automatically reopen it to <strong>IN PROGRESS</strong> for our staff to follow up.
                  </div>
                )}

                <label htmlFor="replyText" className="reply-label">
                  Post Your Reply
                </label>
                <textarea
                  id="replyText"
                  rows={4}
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type your message here to reply to the support team..."
                  className="reply-textarea"
                  maxLength={5000}
                  required
                ></textarea>

                <div className="reply-form-actions">
                  <span className="reply-char-count">{replyMessage.length} / 5000</span>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submittingReply || !replyMessage.trim()}
                  >
                    {submittingReply ? 'Posting Reply...' : 'Send Reply ✉️'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Audit Status History */}
        {ticket.statusHistory && ticket.statusHistory.length > 0 && (
          <div className="ticket-audit-card">
            <h3 className="audit-title">Status Transition Audit Trail</h3>
            <ul className="audit-list">
              {ticket.statusHistory.map((sh, sIdx) => (
                <li key={sIdx} className="audit-item">
                  <span className={`status-pill status-${sh.status.toLowerCase()} status-sm`}>
                    {sh.status.replace(/_/g, ' ')}
                  </span>
                  <span className="audit-note">{sh.note || 'Status updated'}</span>
                  <span className="audit-date">
                    {new Date(sh.changedAt).toLocaleString('en-IN')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketDetailsPage;
