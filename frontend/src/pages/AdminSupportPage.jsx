import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchAdminSupportTickets,
  updateAdminSupportTicketStatus,
  replyAdminSupportTicket,
  assignAdminSupportTicket,
  fetchAdminUsers
} from '../services/api';
import './AdminSupportPage.css';

const TICKET_CATEGORIES = ['Order', 'Payment', 'Shop', 'Product', 'Other'];
const STATUS_OPTIONS = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

const AdminSupportPage = () => {
  const [tickets, setTickets] = useState([]);
  const [counts, setCounts] = useState({ TOTAL: 0, OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Ticket in Drawer / Panel
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [adminReplyText, setAdminReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Admin users list for assignment
  const [adminUsers, setAdminUsers] = useState([]);
  const messagesEndRef = useRef(null);

  // Load Admin Users for assignment selector
  useEffect(() => {
    const loadAdmins = async () => {
      try {
        const res = await fetchAdminUsers({ role: 'ADMIN', limit: 50 });
        if (res.success && res.data?.users) {
          setAdminUsers(res.data.users);
        }
      } catch {
        // non-blocking
      }
    };
    loadAdmins();
  }, []);

  const loadTickets = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: 15
      };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (categoryFilter !== 'ALL') params.category = categoryFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await fetchAdminSupportTickets(params);
      if (res.success && res.data) {
        setTickets(res.data.tickets || []);
        if (res.data.counts) setCounts(res.data.counts);
        if (res.data.pagination) setPagination(res.data.pagination);

        // Keep selectedTicket updated if currently viewing one
        if (selectedTicket) {
          const updatedSelected = (res.data.tickets || []).find((t) => t._id === selectedTicket._id);
          if (updatedSelected) {
            setSelectedTicket(updatedSelected);
          }
        }
      } else {
        setError(res.error || 'Failed to retrieve support tickets.');
      }
    } catch {
      setError('An error occurred while loading tickets.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, searchQuery, selectedTicket?._id]);

  useEffect(() => {
    loadTickets(1);
  }, [statusFilter, categoryFilter]);

  // Scroll to bottom of conversation inside drawer
  useEffect(() => {
    if (selectedTicket?.messages?.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedTicket?.messages]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadTickets(1);
  };

  const handleSelectTicket = (ticket) => {
    setSelectedTicket(ticket);
    setAdminReplyText('');
    setActionSuccess(null);
    setActionError(null);
  };

  const handleCloseDrawer = () => {
    setSelectedTicket(null);
    setAdminReplyText('');
    setActionSuccess(null);
    setActionError(null);
  };

  // Status update
  const handleStatusChange = async (newStatus) => {
    if (!selectedTicket || newStatus === selectedTicket.status) return;

    setStatusUpdating(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await updateAdminSupportTicketStatus(
        selectedTicket._id,
        newStatus,
        `Status updated to ${newStatus} by administrator`
      );

      if (res.success && res.data) {
        setSelectedTicket(res.data);
        setActionSuccess(`Ticket status updated to ${newStatus}. Customer notified.`);
        // Refresh ticket list in background
        loadTickets(pagination.page);
        setTimeout(() => setActionSuccess(null), 4000);
      } else {
        setActionError(res.error || 'Failed to update ticket status.');
      }
    } catch {
      setActionError('Network error while updating status.');
    } finally {
      setStatusUpdating(false);
    }
  };

  // Admin reply
  const handleAdminReplySubmit = async (e) => {
    e.preventDefault();
    if (!adminReplyText.trim() || !selectedTicket) return;

    setReplyLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await replyAdminSupportTicket(
        selectedTicket._id,
        adminReplyText.trim(),
        selectedTicket.status === 'OPEN' ? 'IN_PROGRESS' : null
      );

      if (res.success && res.data) {
        setSelectedTicket(res.data);
        setAdminReplyText('');
        setActionSuccess('Support response dispatched and customer notified.');
        loadTickets(pagination.page);
        setTimeout(() => setActionSuccess(null), 4000);
      } else {
        setActionError(res.error || 'Failed to submit response.');
      }
    } catch {
      setActionError('Network error while sending reply.');
    } finally {
      setReplyLoading(false);
    }
  };

  // Assign admin
  const handleAssignChange = async (assignedAdminId) => {
    if (!selectedTicket) return;

    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await assignAdminSupportTicket(
        selectedTicket._id,
        assignedAdminId || 'none'
      );

      if (res.success && res.data) {
        setSelectedTicket(res.data);
        setActionSuccess('Ticket assignment updated.');
        loadTickets(pagination.page);
        setTimeout(() => setActionSuccess(null), 4000);
      } else {
        setActionError(res.error || 'Failed to assign ticket.');
      }
    } catch {
      setActionError('Network error while updating assignment.');
    }
  };

  return (
    <div className="admin-support-root">
      <div className="container-fluid admin-support-container">
        {/* Breadcrumb */}
        <div className="admin-breadcrumb">
          <Link to="/admin/dashboard">Admin Dashboard</Link>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Customer Support Desk</span>
        </div>

        {/* Page Top Header */}
        <div className="admin-page-header">
          <div>
            <h1 className="admin-main-title">Support Ticket Management</h1>
            <p className="admin-subtitle">
              Respond to customer inquiries, resolve disputes, and maintain service level standards.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline-navy btn-sm"
            onClick={() => loadTickets(pagination.page)}
            title="Refresh tickets"
          >
            🔄 Refresh Tickets
          </button>
        </div>

        {/* Status Counters Row */}
        <div className="status-kpi-grid">
          <div
            className={`kpi-card ${statusFilter === 'ALL' ? 'kpi-active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            <span className="kpi-label">Total Tickets</span>
            <span className="kpi-number">{counts.TOTAL || 0}</span>
          </div>

          <div
            className={`kpi-card kpi-open ${statusFilter === 'OPEN' ? 'kpi-active' : ''}`}
            onClick={() => setStatusFilter('OPEN')}
          >
            <span className="kpi-label">Open</span>
            <span className="kpi-number">{counts.OPEN || 0}</span>
          </div>

          <div
            className={`kpi-card kpi-in_progress ${statusFilter === 'IN_PROGRESS' ? 'kpi-active' : ''}`}
            onClick={() => setStatusFilter('IN_PROGRESS')}
          >
            <span className="kpi-label">In Progress</span>
            <span className="kpi-number">{counts.IN_PROGRESS || 0}</span>
          </div>

          <div
            className={`kpi-card kpi-resolved ${statusFilter === 'RESOLVED' ? 'kpi-active' : ''}`}
            onClick={() => setStatusFilter('RESOLVED')}
          >
            <span className="kpi-label">Resolved</span>
            <span className="kpi-number">{counts.RESOLVED || 0}</span>
          </div>

          <div
            className={`kpi-card kpi-closed ${statusFilter === 'CLOSED' ? 'kpi-active' : ''}`}
            onClick={() => setStatusFilter('CLOSED')}
          >
            <span className="kpi-label">Closed</span>
            <span className="kpi-number">{counts.CLOSED || 0}</span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="admin-filter-bar">
          <form className="admin-search-form" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              placeholder="Search by ticket #, customer name, subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="admin-search-input"
            />
            <button type="submit" className="btn btn-navy search-btn">
              Search
            </button>
            {searchQuery && (
              <button
                type="button"
                className="btn btn-outline-navy clear-btn"
                onClick={() => {
                  setSearchQuery('');
                  loadTickets(1);
                }}
              >
                Clear
              </button>
            )}
          </form>

          <div className="admin-filters-right">
            <div className="filter-select-wrap">
              <label>Category:</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="admin-select"
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

        {error && (
          <div className="admin-alert-error">
            <span>⚠️ {error}</span>
            <button type="button" onClick={() => loadTickets(pagination.page)}>Retry</button>
          </div>
        )}

        {/* Main Content Area: Split List / Drawer View */}
        <div className="admin-support-layout">
          {/* Tickets Table */}
          <div className="admin-table-card">
            {loading ? (
              <div className="admin-loading-box">
                <div className="admin-spinner"></div>
                <p>Loading support tickets...</p>
              </div>
            ) : tickets.length === 0 ? (
              <div className="admin-empty-box">
                <p>No tickets match the selected criteria.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="admin-tickets-table">
                  <thead>
                    <tr>
                      <th>Ticket #</th>
                      <th>Category</th>
                      <th>Customer</th>
                      <th>Subject & Preview</th>
                      <th>Status</th>
                      <th>Assigned To</th>
                      <th>Last Updated</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => {
                      const isSelected = selectedTicket?._id === t._id;
                      const customerName = t.customerId?.name || 'Customer';
                      const customerEmail = t.customerId?.email || '';

                      return (
                        <tr
                          key={t._id}
                          className={`ticket-row ${isSelected ? 'row-active' : ''}`}
                          onClick={() => handleSelectTicket(t)}
                        >
                          <td className="tkt-col-num">
                            <span className="tkt-badge">{t.ticketNumber}</span>
                          </td>
                          <td>
                            <span className={`cat-pill cat-${t.category.toLowerCase()}`}>
                              {t.category}
                            </span>
                          </td>
                          <td className="cust-col">
                            <strong>{customerName}</strong>
                            <span className="cust-email">{customerEmail}</span>
                          </td>
                          <td className="subject-col">
                            <div className="subject-line">{t.subject}</div>
                            {t.orderId && (
                              <span className="linked-order-tag">
                                🔗 Order #{t.orderId.orderNumber || t.orderId}
                              </span>
                            )}
                          </td>
                          <td>
                            <span className={`status-pill status-${t.status.toLowerCase()}`}>
                              {t.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="assign-col">
                            {t.assignedTo ? (
                              <span className="assigned-name">{t.assignedTo.name}</span>
                            ) : (
                              <span className="unassigned-text">Unassigned</span>
                            )}
                          </td>
                          <td className="date-col">
                            {new Date(t.updatedAt || t.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-outline-navy btn-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectTicket(t);
                              }}
                            >
                              Manage
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="admin-pagination-bar">
                <button
                  type="button"
                  className="btn btn-outline-navy btn-sm"
                  disabled={pagination.page <= 1}
                  onClick={() => loadTickets(pagination.page - 1)}
                >
                  Previous
                </button>
                <span>
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
          </div>

          {/* Ticket Inspection & Reply Drawer */}
          {selectedTicket && (
            <div className="admin-drawer-card">
              <div className="drawer-top-bar">
                <div className="drawer-tkt-meta">
                  <span className="drawer-tkt-num">{selectedTicket.ticketNumber}</span>
                  <span className={`cat-pill cat-${selectedTicket.category.toLowerCase()}`}>
                    {selectedTicket.category}
                  </span>
                </div>
                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={handleCloseDrawer}
                  aria-label="Close panel"
                >
                  ✕
                </button>
              </div>

              <h2 className="drawer-subject">{selectedTicket.subject}</h2>

              {/* Customer Details Summary */}
              <div className="drawer-customer-box">
                <div className="cust-info-item">
                  <span className="info-label">Customer:</span>
                  <strong>{selectedTicket.customerId?.name || 'Customer'}</strong>
                </div>
                <div className="cust-info-item">
                  <span className="info-label">Email:</span>
                  <span>{selectedTicket.customerId?.email || '—'}</span>
                </div>
                {selectedTicket.customerId?.phone && (
                  <div className="cust-info-item">
                    <span className="info-label">Phone:</span>
                    <span>{selectedTicket.customerId.phone}</span>
                  </div>
                )}
                {selectedTicket.orderId && (
                  <div className="cust-info-item">
                    <span className="info-label">Linked Order:</span>
                    <span className="order-link-tag">
                      #{selectedTicket.orderId.orderNumber || (typeof selectedTicket.orderId === 'string' ? selectedTicket.orderId.slice(-6) : 'Ref')}
                    </span>
                  </div>
                )}
              </div>

              {/* Status and Assignment Control Bars */}
              <div className="drawer-controls-row">
                <div className="control-item">
                  <label>Status:</label>
                  <select
                    value={selectedTicket.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={statusUpdating}
                    className="drawer-select status-select"
                  >
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="control-item">
                  <label>Assignee:</label>
                  <select
                    value={selectedTicket.assignedTo?._id || selectedTicket.assignedTo || ''}
                    onChange={(e) => handleAssignChange(e.target.value)}
                    className="drawer-select"
                  >
                    <option value="">Unassigned</option>
                    {adminUsers.map((adm) => (
                      <option key={adm.id || adm._id} value={adm.id || adm._id}>
                        {adm.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Alerts */}
              {actionSuccess && (
                <div className="drawer-alert-success">
                  <span>✓ {actionSuccess}</span>
                </div>
              )}
              {actionError && (
                <div className="drawer-alert-error">
                  <span>⚠️ {actionError}</span>
                </div>
              )}

              {/* Conversation Messages */}
              <div className="drawer-messages-wrapper">
                <h3 className="drawer-section-title">
                  Conversation ({selectedTicket.messages?.length || 0})
                </h3>

                <div className="drawer-messages-list">
                  {(selectedTicket.messages || []).map((msg, mIdx) => {
                    const isAdmin = msg.senderRole === 'ADMIN';

                    return (
                      <div
                        key={msg._id || mIdx}
                        className={`admin-bubble ${isAdmin ? 'admin-bubble-staff' : 'admin-bubble-customer'}`}
                      >
                        <div className="bubble-top">
                          <strong className="bubble-author">
                            {isAdmin ? `🛡️ ${msg.senderName} (Staff)` : `👤 ${msg.senderName}`}
                          </strong>
                          <span className="bubble-time">
                            {new Date(msg.createdAt).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <div className="bubble-body">{msg.message}</div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Reply Form */}
              <div className="drawer-reply-area">
                <form onSubmit={handleAdminReplySubmit}>
                  <label className="reply-area-label">Reply to Customer</label>
                  <textarea
                    rows={4}
                    placeholder="Type official support response to customer..."
                    value={adminReplyText}
                    onChange={(e) => setAdminReplyText(e.target.value)}
                    className="admin-reply-textarea"
                    required
                  ></textarea>

                  <div className="drawer-reply-footer">
                    <span className="drawer-char-count">{adminReplyText.length} chars</span>
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={replyLoading || !adminReplyText.trim()}
                    >
                      {replyLoading ? 'Sending...' : 'Send Customer Response ✉️'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Status Audit History in Drawer */}
              {selectedTicket.statusHistory && selectedTicket.statusHistory.length > 0 && (
                <div className="drawer-audit-box">
                  <h4 className="audit-box-title">Audit Trail</h4>
                  <ul className="drawer-audit-list">
                    {selectedTicket.statusHistory.map((sh, sIdx) => (
                      <li key={sIdx}>
                        <strong>{sh.status}</strong>: {sh.note}{' '}
                        <span className="audit-time">
                          ({new Date(sh.changedAt).toLocaleString('en-IN')})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSupportPage;
