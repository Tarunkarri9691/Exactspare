import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchMySupportTickets, createSupportTicket, fetchMyOrders } from '../services/api';
import './CustomerSupportPage.css';

const TICKET_CATEGORIES = ['Order', 'Payment', 'Shop', 'Product', 'Other'];

const STATUS_FILTERS = [
  { label: 'All Tickets', value: 'ALL' },
  { label: 'Open', value: 'OPEN' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Closed', value: 'CLOSED' }
];

const CustomerSupportPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Tickets list state
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Modal / Create Ticket state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    category: 'Order',
    subject: '',
    message: '',
    orderId: '',
    priority: 'NORMAL'
  });

  // Handle URL query parameters (e.g. from Order Tracking Page: /support?orderId=...&category=Order)
  useEffect(() => {
    const preOrderId = searchParams.get('orderId');
    const preCategory = searchParams.get('category');
    const preSubject = searchParams.get('subject');

    if (preOrderId || preCategory || preSubject) {
      setFormData((prev) => ({
        ...prev,
        orderId: preOrderId || prev.orderId,
        category: preCategory && TICKET_CATEGORIES.includes(preCategory) ? preCategory : prev.category,
        subject: preSubject || prev.subject
      }));
      setCreateModalOpen(true);
    }
  }, [searchParams]);

  // Load customer tickets
  const loadTickets = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: 10
      };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (categoryFilter !== 'ALL') params.category = categoryFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await fetchMySupportTickets(params);
      if (res.success && res.data) {
        setTickets(res.data.tickets || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      } else {
        setError(res.error || 'Failed to retrieve support tickets.');
      }
    } catch {
      setError('An unexpected error occurred while loading tickets.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, searchQuery]);

  useEffect(() => {
    loadTickets(1);
  }, [loadTickets]);

  // Fetch recent customer orders for the dropdown in create modal
  const fetchOrdersForDropdown = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetchMyOrders({ limit: 20 });
      if (res.success && res.data?.orders) {
        setCustomerOrders(res.data.orders);
      }
    } catch {
      // Non-critical dropdown fallback
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleOpenCreateModal = () => {
    setCreateError(null);
    setCreateModalOpen(true);
    fetchOrdersForDropdown();
  };

  const handleCloseCreateModal = () => {
    setCreateModalOpen(false);
    setCreateError(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateError(null);

    if (!formData.subject.trim() || formData.subject.trim().length < 3) {
      setCreateError('Subject must be at least 3 characters long.');
      return;
    }

    if (!formData.message.trim() || formData.message.trim().length < 5) {
      setCreateError('Description / message must be at least 5 characters.');
      return;
    }

    setCreateLoading(true);
    try {
      const payload = {
        category: formData.category,
        subject: formData.subject.trim(),
        message: formData.message.trim(),
        priority: formData.priority,
        orderId: formData.orderId && formData.orderId !== '' ? formData.orderId : null
      };

      const res = await createSupportTicket(payload);
      if (res.success && res.data) {
        setCreateModalOpen(false);
        setFormData({
          category: 'Order',
          subject: '',
          message: '',
          orderId: '',
          priority: 'NORMAL'
        });
        // Reload list and navigate to details
        loadTickets(1);
        navigate(`/support/tickets/${res.data._id}`);
      } else {
        setCreateError(res.error || 'Failed to submit support ticket.');
      }
    } catch {
      setCreateError('An error occurred while creating ticket.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadTickets(1);
  };

  return (
    <div className="support-page-root">
      <div className="container">
        {/* Breadcrumb */}
        <div className="support-breadcrumb">
          <Link to="/">Home</Link>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Customer Support Center</span>
        </div>

        {/* Hero Support Banner */}
        <div className="support-header-hero">
          <div className="hero-text-side">
            <span className="badge badge-orange">EXACTSPARE Helpdesk</span>
            <h1 className="support-heading">Customer Support Center</h1>
            <p className="support-lead">
              Get assistance with your vehicle spare part orders, shop verifications, payment queries, or product inquiries.
            </p>
          </div>

          <div className="hero-action-side">
            <button
              type="button"
              className="btn btn-primary btn-lg create-ticket-btn"
              onClick={handleOpenCreateModal}
            >
              <span className="btn-icon">➕</span> Open New Support Ticket
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="support-filter-bar">
          <form className="support-search-form" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              placeholder="Search by ticket # or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <button type="submit" className="btn btn-navy search-btn">
              Search
            </button>
            {searchQuery && (
              <button
                type="button"
                className="btn btn-outline-navy clear-search-btn"
                onClick={() => {
                  setSearchQuery('');
                  loadTickets(1);
                }}
              >
                Clear
              </button>
            )}
          </form>

          <div className="filter-dropdowns">
            <div className="filter-group">
              <label>Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="select-field"
              >
                {STATUS_FILTERS.map((sf) => (
                  <option key={sf.value} value={sf.value}>
                    {sf.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Category:</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="select-field"
              >
                <option value="ALL">All Categories</option>
                {TICKET_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="support-alert-error">
            <span>⚠️ {error}</span>
            <button type="button" onClick={() => loadTickets(pagination.page)}>Retry</button>
          </div>
        )}

        {/* Ticket List Section */}
        {loading ? (
          <div className="support-loading-box">
            <div className="support-spinner"></div>
            <p>Loading your support tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="support-empty-state">
            <div className="empty-icon">📂</div>
            <h3>No Support Tickets Found</h3>
            <p>
              {statusFilter !== 'ALL' || categoryFilter !== 'ALL' || searchQuery
                ? 'No tickets match your active filter criteria. Try resetting filters.'
                : 'You have not submitted any customer support inquiries yet.'}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenCreateModal}
            >
              Create Your First Ticket
            </button>
          </div>
        ) : (
          <div className="tickets-list-grid">
            {tickets.map((ticket) => {
              const lastMessage = ticket.messages && ticket.messages.length > 0
                ? ticket.messages[ticket.messages.length - 1]
                : null;

              const updatedDate = new Date(ticket.updatedAt || ticket.createdAt).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div key={ticket._id} className="ticket-card">
                  <div className="ticket-card-top">
                    <div className="ticket-id-category">
                      <span className="ticket-number-tag">{ticket.ticketNumber}</span>
                      <span className={`category-tag category-${ticket.category.toLowerCase()}`}>
                        {ticket.category}
                      </span>
                    </div>
                    <span className={`status-pill status-${ticket.status.toLowerCase()}`}>
                      {ticket.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <h3 className="ticket-subject">
                    <Link to={`/support/tickets/${ticket._id}`}>{ticket.subject}</Link>
                  </h3>

                  {ticket.orderId && (
                    <div className="ticket-linked-order">
                      <span>🔗 Linked Order Ref: </span>
                      <span className="linked-order-badge">
                        #{ticket.orderId.orderNumber || (typeof ticket.orderId === 'string' ? ticket.orderId.slice(-6) : 'N/A')}
                      </span>
                    </div>
                  )}

                  {lastMessage && (
                    <p className="ticket-last-snippet">
                      <strong>{lastMessage.senderRole === 'CUSTOMER' ? 'You' : lastMessage.senderName}:</strong>{' '}
                      {lastMessage.message}
                    </p>
                  )}

                  <div className="ticket-card-footer">
                    <div className="ticket-meta-info">
                      <span>💬 {ticket.messages?.length || 1} message(s)</span>
                      <span>•</span>
                      <span>Updated {updatedDate}</span>
                    </div>

                    <Link
                      to={`/support/tickets/${ticket._id}`}
                      className="btn btn-outline-navy btn-sm view-convo-btn"
                    >
                      View Conversation & Reply →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="support-pagination">
            <button
              type="button"
              className="btn btn-outline-navy btn-sm"
              disabled={pagination.page <= 1}
              onClick={() => loadTickets(pagination.page - 1)}
            >
              Previous
            </button>
            <span className="page-indicator">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} tickets)
            </span>
            <button
              type="button"
              className="btn btn-outline-navy btn-sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => loadTickets(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        )}

        {/* Create Ticket Modal */}
        {createModalOpen && (
          <div className="modal-backdrop">
            <div className="create-ticket-modal-card">
              <div className="modal-header">
                <div>
                  <h2 className="modal-title">Open Support Ticket</h2>
                  <p className="modal-desc">
                    Our support team and technicians will review your request and respond promptly.
                  </p>
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={handleCloseCreateModal}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {createError && (
                <div className="modal-error-alert">
                  <span>⚠️ {createError}</span>
                </div>
              )}

              <form onSubmit={handleCreateSubmit} className="create-ticket-form">
                <div className="form-row-two">
                  <div className="form-group">
                    <label htmlFor="category">Category *</label>
                    <select
                      id="category"
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="form-control"
                      required
                    >
                      {TICKET_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="priority">Priority</label>
                    <select
                      id="priority"
                      name="priority"
                      value={formData.priority}
                      onChange={handleInputChange}
                      className="form-control"
                    >
                      <option value="LOW">Low</option>
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                </div>

                {/* Optional Order Linkage */}
                <div className="form-group">
                  <label htmlFor="orderId">Link to Order (Optional)</label>
                  <select
                    id="orderId"
                    name="orderId"
                    value={formData.orderId}
                    onChange={handleInputChange}
                    className="form-control"
                  >
                    <option value="">-- No Order Linked --</option>
                    {customerOrders.map((ord) => (
                      <option key={ord._id} value={ord._id}>
                        Order #{ord.orderNumber} (₹{ord.totalAmount?.toLocaleString('en-IN')}) - {ord.orderStatus}
                      </option>
                    ))}
                  </select>
                  <small className="form-hint">
                    Linking an order helps our staff verify parts and shop dispatch status instantly.
                  </small>
                </div>

                <div className="form-group">
                  <label htmlFor="subject">Subject *</label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    placeholder="Brief summary of the issue or inquiry"
                    value={formData.subject}
                    onChange={handleInputChange}
                    className="form-control"
                    maxLength={200}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="message">Detailed Description *</label>
                  <textarea
                    id="message"
                    name="message"
                    placeholder="Please describe your query in detail, including part names, vehicle details, or error messages..."
                    value={formData.message}
                    onChange={handleInputChange}
                    className="form-control"
                    rows={5}
                    maxLength={5000}
                    required
                  ></textarea>
                  <span className="char-count">{formData.message.length} / 5000</span>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-outline-navy"
                    onClick={handleCloseCreateModal}
                    disabled={createLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={createLoading}
                  >
                    {createLoading ? 'Submitting...' : 'Submit Support Ticket'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerSupportPage;
