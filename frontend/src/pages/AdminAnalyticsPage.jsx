import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AdminNav from '../components/AdminNav';
import {
  fetchAdminAnalyticsOverview,
  fetchAdminSalesAnalytics,
  fetchAdminOrderAnalytics,
  fetchAdminInventoryAnalytics,
  fetchAdminShopAnalytics,
  fetchAdminCustomerAnalytics,
  downloadAdminReportCsv
} from '../services/api';
import './AdminAnalyticsPage.css';

/**
 * EXACTSPARE MODULE 16 — ADVANCED ADMIN ANALYTICS AND BUSINESS REPORTS
 * Real-time operational intelligence, financial trends, multi-shop fulfillment,
 * inventory insights, and formula-injection-safe CSV exports.
 */
const AdminAnalyticsPage = () => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'inventory' | 'shops' | 'reports'

  // Date filter state
  const [preset, setPreset] = useState('30days'); // 'today' | '7days' | '30days' | '90days' | 'custom'
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [period, setPeriod] = useState('daily'); // 'daily' | 'weekly' | 'monthly'

  // Data states
  const [overviewData, setOverviewData] = useState(null);
  const [salesData, setSalesData] = useState(null);
  const [orderData, setOrderData] = useState(null);
  const [inventoryData, setInventoryData] = useState(null);
  const [shopData, setShopData] = useState(null);
  const [customerData, setCustomerData] = useState(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingReport, setDownloadingReport] = useState(null);
  const [downloadSuccess, setDownloadSuccess] = useState('');
  const [downloadError, setDownloadError] = useState('');

  // Tooltip hover state for SVG trend lines
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const loadAllAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    setDownloadSuccess('');
    setDownloadError('');

    const params = { period };
    if (preset === 'custom') {
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
    } else if (preset) {
      params.preset = preset;
    }

    try {
      const [
        overviewRes,
        salesRes,
        orderRes,
        inventoryRes,
        shopRes,
        customerRes
      ] = await Promise.all([
        fetchAdminAnalyticsOverview(params),
        fetchAdminSalesAnalytics(params),
        fetchAdminOrderAnalytics(params),
        fetchAdminInventoryAnalytics(params),
        fetchAdminShopAnalytics(params),
        fetchAdminCustomerAnalytics(params)
      ]);

      if (overviewRes.success) setOverviewData(overviewRes.data);
      if (salesRes.success) setSalesData(salesRes.data);
      if (orderRes.success) setOrderData(orderRes.data);
      if (inventoryRes.success) setInventoryData(inventoryRes.data);
      if (shopRes.success) setShopData(shopRes.data);
      if (customerRes.success) setCustomerData(customerRes.data);

      if (!overviewRes.success && overviewRes.error) {
        setError(overviewRes.error);
      }
    } catch {
      setError('A network or server error occurred while retrieving platform analytics.');
    } finally {
      setLoading(false);
    }
  }, [preset, fromDate, toDate, period]);

  useEffect(() => {
    loadAllAnalytics();
  }, [loadAllAnalytics]);

  const handlePresetChange = (newPreset) => {
    setPreset(newPreset);
    if (newPreset !== 'custom') {
      setFromDate('');
      setToDate('');
    }
  };

  const handleApplyCustomFilter = (e) => {
    e.preventDefault();
    if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
      setError('"From Date" cannot be after "To Date".');
      return;
    }
    loadAllAnalytics();
  };

  const handleResetFilter = () => {
    setPreset('30days');
    setFromDate('');
    setToDate('');
    setPeriod('daily');
  };

  // CSV Report Downloader
  const handleDownloadCsv = async (reportType, title) => {
    setDownloadingReport(reportType);
    setDownloadSuccess('');
    setDownloadError('');

    const params = {};
    if (preset === 'custom') {
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
    } else if (preset) {
      params.preset = preset;
    }

    const result = await downloadAdminReportCsv(reportType, params);
    if (result.success) {
      setDownloadSuccess(`Successfully exported ${title} (${result.filename}).`);
    } else {
      setDownloadError(result.error || `Failed to export ${title}.`);
    }
    setDownloadingReport(null);
  };

  // Safe data extraction
  const users = overviewData?.users || {};
  const shopsOverview = overviewData?.shops || {};
  const ordersOverview = overviewData?.orders || {};
  const revenueOverview = overviewData?.revenue || {};
  const timeline = salesData?.timeline || [];
  const topProducts = salesData?.topProducts || [];
  const statusDist = orderData?.statusDistribution || {};
  const orderTimeline = orderData?.timeline || [];
  const customerTimeline = customerData?.registrationsTimeline || [];
  const stockSummary = inventoryData?.summary || {};
  const categoryBreakdown = inventoryData?.categories || [];
  const lowStockProducts = inventoryData?.lowStockProducts || [];
  const outOfStockProducts = inventoryData?.outOfStockProducts || [];
  const topCompletedParts = inventoryData?.topCompletedParts || [];
  const shopPerformanceList = shopData?.shops || [];

  // SVG Trend Line Calculation
  const maxRevenue = Math.max(...timeline.map((t) => t.grossOrderValue || t.completedRevenue || 0), 100);
  const svgWidth = 720;
  const svgHeight = 220;
  const paddingX = 45;
  const paddingY = 30;

  const points = timeline.map((item, index) => {
    const x =
      paddingX +
      (timeline.length > 1
        ? (index / (timeline.length - 1)) * (svgWidth - paddingX * 2)
        : (svgWidth - paddingX * 2) / 2);
    const yGross =
      svgHeight -
      paddingY -
      ((item.grossOrderValue || 0) / maxRevenue) * (svgHeight - paddingY * 2);
    const yCompleted =
      svgHeight -
      paddingY -
      ((item.completedRevenue || 0) / maxRevenue) * (svgHeight - paddingY * 2);
    return {
      x,
      yGross,
      yCompleted,
      date: item.date,
      orderCount: item.orderCount,
      grossOrderValue: item.grossOrderValue,
      completedRevenue: item.completedRevenue
    };
  });

  const polylineGross = points.map((p) => `${p.x},${p.yGross}`).join(' ');
  const polylineCompleted = points.map((p) => `${p.x},${p.yCompleted}`).join(' ');

  return (
    <div className="admin-analytics-page">
      <AdminNav />

      <div className="container admin-analytics-container">
        {/* Header Section */}
        <div className="admin-page-header">
          <div>
            <div className="admin-title-badge-row">
              <span className="badge badge-navy">Module 16</span>
              <span className="badge badge-orange">Executive Analytics</span>
              <span className="badge badge-success">Live MongoDB Data</span>
            </div>
            <h1 className="admin-page-title">Advanced Admin Analytics & Reports</h1>
            <p className="admin-page-subtitle">
              Calculated exclusively from real database records. Multi-shop order attribution, stock intelligence, and sanitized exports.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="btn btn-outline admin-refresh-btn"
              onClick={loadAllAnalytics}
              disabled={loading}
            >
              <span className={loading ? 'spin-icon' : ''}>🔄</span>
              <span>{loading ? 'Refreshing...' : 'Refresh Live Data'}</span>
            </button>
          </div>
        </div>

        {/* Global Filter Bar */}
        <div className="analytics-filter-card">
          <div className="filter-card-header">
            <div className="filter-title-group">
              <span className="filter-icon">📅</span>
              <span className="filter-title">Date Range & Aggregation Filters</span>
            </div>
            <div className="filter-preset-pills">
              <button
                type="button"
                className={`preset-pill ${preset === 'today' ? 'active' : ''}`}
                onClick={() => handlePresetChange('today')}
              >
                Today
              </button>
              <button
                type="button"
                className={`preset-pill ${preset === '7days' ? 'active' : ''}`}
                onClick={() => handlePresetChange('7days')}
              >
                Last 7 Days
              </button>
              <button
                type="button"
                className={`preset-pill ${preset === '30days' ? 'active' : ''}`}
                onClick={() => handlePresetChange('30days')}
              >
                Last 30 Days
              </button>
              <button
                type="button"
                className={`preset-pill ${preset === '90days' ? 'active' : ''}`}
                onClick={() => handlePresetChange('90days')}
              >
                Last 90 Days
              </button>
              <button
                type="button"
                className={`preset-pill ${preset === 'custom' ? 'active' : ''}`}
                onClick={() => handlePresetChange('custom')}
              >
                Custom Range
              </button>
            </div>
          </div>

          {preset === 'custom' && (
            <form className="custom-date-form" onSubmit={handleApplyCustomFilter}>
              <div className="filter-input-pair">
                <div className="filter-input-group">
                  <label htmlFor="analytics-from">From Date</label>
                  <input
                    id="analytics-from"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="filter-date-input"
                    required
                  />
                </div>
                <div className="filter-input-group">
                  <label htmlFor="analytics-to">To Date</label>
                  <input
                    id="analytics-to"
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="filter-date-input"
                    required
                  />
                </div>
              </div>

              <div className="filter-actions-group">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  Apply Filter
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleResetFilter}
                  disabled={loading}
                >
                  Reset
                </button>
              </div>
            </form>
          )}

          <div className="filter-status-banner">
            <span className="status-indicator-dot" />
            <span>
              Active Filter: <strong>{preset === 'custom' ? `${fromDate || 'Start'} to ${toDate || 'End'}` : preset.toUpperCase()}</strong>
              {' '}· Revenue calculated without cancelled orders · Zero synthetic metrics
            </span>
          </div>
        </div>

        {error && (
          <div className="analytics-alert-banner alert-error">
            <span>⚠️</span> <span>{error}</span>
          </div>
        )}

        {downloadSuccess && (
          <div className="analytics-alert-banner alert-success">
            <span>✅</span> <span>{downloadSuccess}</span>
          </div>
        )}

        {downloadError && (
          <div className="analytics-alert-banner alert-error">
            <span>❌</span> <span>{downloadError}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="analytics-nav-tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <span>📊</span> Executive Overview & Trends
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            <span>📦</span> Inventory Insights ({stockSummary.lowStockCount || 0} Low Stock)
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'shops' ? 'active' : ''}`}
            onClick={() => setActiveTab('shops')}
          >
            <span>🏬</span> Shop Performance ({shopPerformanceList.length} Shops)
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <span>📥</span> Export Business Reports (CSV)
          </button>
        </div>

        {/* =========================================================================
            TAB 1: EXECUTIVE OVERVIEW & TRENDS
            ========================================================================= */}
        {activeTab === 'overview' && (
          <div className="tab-pane-content">
            {/* Top Operational Metrics Grid */}
            <div className="kpi-summary-grid">
              {/* Customers */}
              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-icon">👥</span>
                  <span className="kpi-title">Customers</span>
                </div>
                <div className="kpi-value">{users.customers || 0}</div>
                <div className="kpi-subtext">Registered platform buyers</div>
              </div>

              {/* Shop Owners */}
              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-icon">👔</span>
                  <span className="kpi-title">Shop Owners</span>
                </div>
                <div className="kpi-value">{users.shopOwners || 0}</div>
                <div className="kpi-subtext">Merchant partner accounts</div>
              </div>

              {/* Approved Shops */}
              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-icon">🏬</span>
                  <span className="kpi-title">Approved Shops</span>
                </div>
                <div className="kpi-value highlight-green">{shopsOverview.approvedAndActive || 0}</div>
                <div className="kpi-subtext">Active & verified storefronts</div>
              </div>

              {/* Pending Applications */}
              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-icon">📑</span>
                  <span className="kpi-title">Pending Applications</span>
                </div>
                <div className="kpi-value highlight-orange">{shopsOverview.pendingApplications || 0}</div>
                <div className="kpi-subtext">Awaiting admin review</div>
              </div>

              {/* Published Parts */}
              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-icon">⚙️</span>
                  <span className="kpi-title">Published Parts</span>
                </div>
                <div className="kpi-value">{overviewData?.inventory?.published || 0}</div>
                <div className="kpi-subtext">Active listings in catalog</div>
              </div>

              {/* Total Orders */}
              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-icon">🛒</span>
                  <span className="kpi-title">Total Orders</span>
                </div>
                <div className="kpi-value">{ordersOverview.totalInPeriod || ordersOverview.totalLifetime || 0}</div>
                <div className="kpi-subtext">Placed across selected period</div>
              </div>

              {/* Orders Processing */}
              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-icon">⏳</span>
                  <span className="kpi-title">Awaiting Processing</span>
                </div>
                <div className="kpi-value highlight-blue">{ordersOverview.awaitingProcessing || 0}</div>
                <div className="kpi-subtext">Placed, Confirmed, or Processing</div>
              </div>

              {/* Delivered Orders */}
              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-icon">🚚</span>
                  <span className="kpi-title">Delivered Orders</span>
                </div>
                <div className="kpi-value highlight-green">{ordersOverview.delivered || 0}</div>
                <div className="kpi-subtext">Successfully fulfilled</div>
              </div>

              {/* Cancelled Orders */}
              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-icon">🚫</span>
                  <span className="kpi-title">Cancelled Orders</span>
                </div>
                <div className="kpi-value highlight-red">{ordersOverview.cancelled || 0}</div>
                <div className="kpi-subtext">Excluded from sales revenue</div>
              </div>

              {/* Gross Order Value */}
              <div className="kpi-card highlight-card">
                <div className="kpi-card-header">
                  <span className="kpi-icon">📈</span>
                  <span className="kpi-title">Gross Order Value (GMV)</span>
                </div>
                <div className="kpi-value">{formatCurrency(revenueOverview.grossOrderValue)}</div>
                <div className="kpi-subtext">Total non-cancelled order value</div>
              </div>

              {/* Completed Order Value */}
              <div className="kpi-card highlight-card primary">
                <div className="kpi-card-header">
                  <span className="kpi-icon">💰</span>
                  <span className="kpi-title">Completed Revenue</span>
                </div>
                <div className="kpi-value highlight-orange">{formatCurrency(revenueOverview.completedRevenue)}</div>
                <div className="kpi-subtext">Delivered & confirmed collected sales</div>
              </div>
            </div>

            {/* Financial Disclaimer Banner */}
            <div className="financial-disclaimer-card">
              <span className="disclaimer-icon">ℹ️</span>
              <div className="disclaimer-text">
                <strong>Financial Definition Note:</strong> Gross Order Value represents the total volume of all non-cancelled orders placed by customers in the period. Completed Revenue represents funds collected from confirmed and delivered fulfillments. Order value is not presented as profit because merchant costs, shop payouts, platform commissions, and return reserves are not deducted.
              </div>
            </div>

            {/* Chart Grid: Trend Line & Status Distribution */}
            <div className="charts-two-col-grid">
              {/* Sales & Orders Trend Over Time */}
              <div className="chart-panel">
                <div className="chart-panel-header">
                  <div>
                    <h3 className="panel-title">Revenue & GMV Progression Over Time</h3>
                    <p className="panel-subtitle">Gross order value vs completed revenue ({period.toUpperCase()})</p>
                  </div>
                  <div className="chart-legend-row">
                    <span className="legend-item">
                      <span className="legend-dot orange" /> Completed Revenue
                    </span>
                    <span className="legend-item">
                      <span className="legend-dot blue" /> Gross Order Value
                    </span>
                  </div>
                </div>

                <div className="chart-panel-body">
                  {timeline.length === 0 ? (
                    <div className="empty-chart-box">
                      <span>📉</span>
                      <p>No order transactions found for this date range.</p>
                    </div>
                  ) : (
                    <div className="svg-container-box">
                      <svg
                        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                        className="interactive-svg-chart"
                        preserveAspectRatio="none"
                      >
                        <defs>
                          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#FF6500" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#FF6500" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Grid lines */}
                        <line x1={paddingX} y1={paddingY} x2={svgWidth - paddingX} y2={paddingY} stroke="#E2E8F0" strokeDasharray="3 3" />
                        <line x1={paddingX} y1={svgHeight / 2} x2={svgWidth - paddingX} y2={svgHeight / 2} stroke="#E2E8F0" strokeDasharray="3 3" />
                        <line x1={paddingX} y1={svgHeight - paddingY} x2={svgWidth - paddingX} y2={svgHeight - paddingY} stroke="#CBD5E1" strokeWidth="1.5" />

                        {/* Area fill for completed revenue */}
                        {points.length > 1 && (
                          <polygon
                            points={`${points[0].x},${svgHeight - paddingY} ${polylineCompleted} ${points[points.length - 1].x},${svgHeight - paddingY}`}
                            fill="url(#areaGradient)"
                          />
                        )}

                        {/* Line 1: Gross Order Value (Navy/Slate) */}
                        <polyline
                          fill="none"
                          stroke="#1E3E62"
                          strokeWidth="2"
                          strokeDasharray="4 2"
                          points={polylineGross}
                        />

                        {/* Line 2: Completed Revenue (Vibrant Orange) */}
                        <polyline
                          fill="none"
                          stroke="#FF6500"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={polylineCompleted}
                        />

                        {/* Interactive Data Dots */}
                        {points.map((p, idx) => (
                          <g
                            key={idx}
                            className="svg-point-trigger"
                            onMouseEnter={() => setHoveredPoint(p)}
                            onMouseLeave={() => setHoveredPoint(null)}
                          >
                            <circle cx={p.x} cy={p.yCompleted} r="5" fill="#0B192C" stroke="#FF6500" strokeWidth="2.5" />
                          </g>
                        ))}
                      </svg>

                      {/* Tooltip Overlay */}
                      {hoveredPoint && (
                        <div
                          className="chart-hover-tooltip"
                          style={{
                            left: `${(hoveredPoint.x / svgWidth) * 100}%`,
                            top: `${(hoveredPoint.yCompleted / svgHeight) * 100 - 20}%`
                          }}
                        >
                          <strong>{hoveredPoint.date}</strong>
                          <div>Completed: {formatCurrency(hoveredPoint.completedRevenue)}</div>
                          <div>Gross: {formatCurrency(hoveredPoint.grossOrderValue)}</div>
                          <div>Orders: {hoveredPoint.orderCount}</div>
                        </div>
                      )}

                      {/* X-axis labels */}
                      <div className="chart-x-axis-row">
                        {points.map((p, idx) => (
                          <span key={idx} className="axis-label-tick">
                            {p.date}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Status Distribution */}
              <div className="chart-panel">
                <div className="chart-panel-header">
                  <div>
                    <h3 className="panel-title">Order Status Distribution</h3>
                    <p className="panel-subtitle">Pipeline breakdown of order fulfillment</p>
                  </div>
                </div>

                <div className="chart-panel-body">
                  {Object.values(statusDist).every((v) => v === 0) ? (
                    <div className="empty-chart-box">
                      <span>📦</span>
                      <p>No orders recorded in this period.</p>
                    </div>
                  ) : (
                    <div className="status-progress-list">
                      {Object.entries(statusDist).map(([statusKey, count]) => {
                        const totalOrders = Object.values(statusDist).reduce((a, b) => a + b, 0) || 1;
                        const percentage = Math.round((count / totalOrders) * 100);

                        return (
                          <div key={statusKey} className="status-progress-row">
                            <div className="progress-info-line">
                              <span className={`status-pill status-${statusKey.toLowerCase()}`}>
                                {statusKey.replace(/_/g, ' ')}
                              </span>
                              <span className="count-percentage">
                                <strong>{count}</strong> orders ({percentage}%)
                              </span>
                            </div>
                            <div className="progress-track-bg">
                              <div
                                className={`progress-bar-fill fill-${statusKey.toLowerCase()}`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Registrations Timeline & Top-Selling Parts */}
            <div className="charts-two-col-grid" style={{ marginTop: '1.5rem' }}>
              {/* Customer Registrations Over Time */}
              <div className="chart-panel">
                <div className="chart-panel-header">
                  <div>
                    <h3 className="panel-title">Customer Registrations Timeline</h3>
                    <p className="panel-subtitle">New customer signups over the selected period</p>
                  </div>
                </div>

                <div className="chart-panel-body">
                  {customerTimeline.length === 0 ? (
                    <div className="empty-chart-box">
                      <span>👥</span>
                      <p>No new customer accounts created in this period.</p>
                    </div>
                  ) : (
                    <div className="bar-chart-container">
                      {customerTimeline.map((item, idx) => {
                        const maxReg = Math.max(...customerTimeline.map((c) => c.registrations), 1);
                        const barHeight = Math.round((item.registrations / maxReg) * 120);

                        return (
                          <div key={idx} className="bar-column">
                            <div className="bar-count-label">{item.registrations}</div>
                            <div
                              className="bar-fill"
                              style={{ height: `${Math.max(barHeight, 8)}px` }}
                              title={`${item.date}: ${item.registrations} customers`}
                            />
                            <div className="bar-date-label">{item.date}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Top-Selling Spare Parts */}
              <div className="chart-panel">
                <div className="chart-panel-header">
                  <div>
                    <h3 className="panel-title">Top-Selling Spare Parts</h3>
                    <p className="panel-subtitle">Ranked by actual completed items sold</p>
                  </div>
                </div>

                <div className="chart-panel-body">
                  {topProducts.length === 0 ? (
                    <div className="empty-chart-box">
                      <span>⚙️</span>
                      <p>No completed spare parts sales recorded yet.</p>
                    </div>
                  ) : (
                    <div className="responsive-table-box">
                      <table className="analytics-data-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Part Details</th>
                            <th>Shop</th>
                            <th>Units Sold</th>
                            <th>Gross Sales</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topProducts.map((prod, idx) => (
                            <tr key={prod._id || idx}>
                              <td className="rank-num">{idx + 1}</td>
                              <td>
                                <strong>{prod.partName || 'Part'}</strong>
                                <div className="table-sub-code">{prod.partNumber}</div>
                              </td>
                              <td>{prod.shopName || 'Shop'}</td>
                              <td><strong>{prod.unitsSold}</strong></td>
                              <td>{formatCurrency(prod.totalSales)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: INVENTORY INSIGHTS
            ========================================================================= */}
        {activeTab === 'inventory' && (
          <div className="tab-pane-content">
            {/* Inventory Health Cards */}
            <div className="kpi-summary-grid">
              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-icon">📦</span>
                  <span className="kpi-title">Total Catalog Items</span>
                </div>
                <div className="kpi-value">{stockSummary.totalParts || 0}</div>
                <div className="kpi-subtext">Unarchived spare parts</div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-icon">✅</span>
                  <span className="kpi-title">In Stock</span>
                </div>
                <div className="kpi-value highlight-green">{stockSummary.inStockCount || 0}</div>
                <div className="kpi-subtext">Quantity &gt; 0</div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-icon">⚠️</span>
                  <span className="kpi-title">Low Stock Alert</span>
                </div>
                <div className="kpi-value highlight-orange">{stockSummary.lowStockCount || 0}</div>
                <div className="kpi-subtext">Quantity between 1 and 5</div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-icon">❌</span>
                  <span className="kpi-title">Out of Stock</span>
                </div>
                <div className="kpi-value highlight-red">{stockSummary.outOfStockCount || 0}</div>
                <div className="kpi-subtext">Quantity = 0 or marked out</div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-icon">📢</span>
                  <span className="kpi-title">Published vs Unpublished</span>
                </div>
                <div className="kpi-value">
                  {stockSummary.publishedCount || 0} / {stockSummary.unpublishedCount || 0}
                </div>
                <div className="kpi-subtext">Active vs Hidden listings</div>
              </div>

              <div className="kpi-card highlight-card">
                <div className="kpi-card-header">
                  <span className="kpi-icon">💎</span>
                  <span className="kpi-title">Total Catalog Value</span>
                </div>
                <div className="kpi-value">{formatCurrency(stockSummary.totalInventoryValue)}</div>
                <div className="kpi-subtext">Sum of (price × quantity)</div>
              </div>
            </div>

            {/* Low-Stock & Out-of-Stock Tables */}
            <div className="charts-two-col-grid" style={{ marginTop: '1.5rem' }}>
              {/* Low Stock Alerts */}
              <div className="chart-panel">
                <div className="chart-panel-header">
                  <div>
                    <h3 className="panel-title">Low Stock Alerts (1 – 5 Units)</h3>
                    <p className="panel-subtitle">Immediate attention recommended for merchant restock</p>
                  </div>
                  <span className="badge badge-warning">{lowStockProducts.length} Items</span>
                </div>

                <div className="chart-panel-body">
                  {lowStockProducts.length === 0 ? (
                    <div className="empty-chart-box">
                      <span>✅</span>
                      <p>All active products have adequate stock levels.</p>
                    </div>
                  ) : (
                    <div className="responsive-table-box">
                      <table className="analytics-data-table">
                        <thead>
                          <tr>
                            <th>Part</th>
                            <th>Shop</th>
                            <th>Price</th>
                            <th>Stock</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lowStockProducts.map((p) => (
                            <tr key={p._id}>
                              <td>
                                <strong>{p.partName}</strong>
                                <div className="table-sub-code">{p.partNumber} · {p.category}</div>
                              </td>
                              <td>{p.shopName}</td>
                              <td>{formatCurrency(p.price)}</td>
                              <td>
                                <span className="stock-badge low-stock">{p.stockQuantity} Left</span>
                              </td>
                              <td>
                                <Link to={`/admin/moderation/parts`} className="table-action-link">
                                  Inspect →
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Out of Stock Items */}
              <div className="chart-panel">
                <div className="chart-panel-header">
                  <div>
                    <h3 className="panel-title">Out-of-Stock Items (0 Units)</h3>
                    <p className="panel-subtitle">Products unavailable for customer purchase</p>
                  </div>
                  <span className="badge badge-error">{outOfStockProducts.length} Items</span>
                </div>

                <div className="chart-panel-body">
                  {outOfStockProducts.length === 0 ? (
                    <div className="empty-chart-box">
                      <span>✅</span>
                      <p>No products are currently out of stock.</p>
                    </div>
                  ) : (
                    <div className="responsive-table-box">
                      <table className="analytics-data-table">
                        <thead>
                          <tr>
                            <th>Part</th>
                            <th>Shop</th>
                            <th>Price</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {outOfStockProducts.map((p) => (
                            <tr key={p._id}>
                              <td>
                                <strong>{p.partName}</strong>
                                <div className="table-sub-code">{p.partNumber} · {p.category}</div>
                              </td>
                              <td>{p.shopName}</td>
                              <td>{formatCurrency(p.price)}</td>
                              <td>
                                <span className="stock-badge out-of-stock">Depleted</span>
                              </td>
                              <td>
                                <Link to={`/admin/moderation/parts`} className="table-action-link">
                                  Inspect →
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Category Breakdown Table */}
            <div className="chart-panel" style={{ marginTop: '1.5rem' }}>
              <div className="chart-panel-header">
                <div>
                  <h3 className="panel-title">Catalog Distribution Grouped by Category</h3>
                  <p className="panel-subtitle">Real-time health breakdown across spare parts categories</p>
                </div>
              </div>

              <div className="chart-panel-body">
                {categoryBreakdown.length === 0 ? (
                  <div className="empty-chart-box">
                    <span>📦</span>
                    <p>No categories configured in catalog.</p>
                  </div>
                ) : (
                  <div className="responsive-table-box">
                    <table className="analytics-data-table">
                      <thead>
                        <tr>
                          <th>Category Name</th>
                          <th>Total Parts</th>
                          <th>Published</th>
                          <th>Low Stock</th>
                          <th>Out of Stock</th>
                          <th>Total Stock Units</th>
                          <th>Average Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryBreakdown.map((c) => (
                          <tr key={c._id || 'unknown'}>
                            <td><strong>{c._id || 'Uncategorized'}</strong></td>
                            <td>{c.partCount}</td>
                            <td><span className="badge badge-success">{c.publishedCount}</span></td>
                            <td>{c.lowStockCount > 0 ? <span className="badge badge-warning">{c.lowStockCount}</span> : '0'}</td>
                            <td>{c.outOfStockCount > 0 ? <span className="badge badge-error">{c.outOfStockCount}</span> : '0'}</td>
                            <td>{c.totalStockQuantity} units</td>
                            <td>{formatCurrency(c.avgPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: SHOP PERFORMANCE
            ========================================================================= */}
        {activeTab === 'shops' && (
          <div className="tab-pane-content">
            <div className="chart-panel">
              <div className="chart-panel-header">
                <div>
                  <h3 className="panel-title">Merchant Shop Performance Matrix</h3>
                  <p className="panel-subtitle">
                    Order volume, fulfillment status, and order value strictly attributed per shop items (multi-shop safe).
                  </p>
                </div>
                <div className="shop-matrix-stats">
                  <span className="badge badge-navy">Total Shops: {shopPerformanceList.length}</span>
                </div>
              </div>

              <div className="chart-panel-body">
                {shopPerformanceList.length === 0 ? (
                  <div className="empty-chart-box">
                    <span>🏬</span>
                    <p>No merchant shops registered on the platform.</p>
                  </div>
                ) : (
                  <div className="responsive-table-box">
                    <table className="analytics-data-table">
                      <thead>
                        <tr>
                          <th>Shop Name</th>
                          <th>Location</th>
                          <th>Approval Status</th>
                          <th>Published Parts</th>
                          <th>Attributed Orders</th>
                          <th>Delivered</th>
                          <th>Cancelled</th>
                          <th>Attributable GMV</th>
                          <th>Completed Revenue</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shopPerformanceList.map((shop) => (
                          <tr key={shop._id}>
                            <td>
                              <strong>{shop.shopName}</strong>
                              <div className="table-sub-code">{shop.category}</div>
                            </td>
                            <td>{shop.city}, {shop.state}</td>
                            <td>
                              <span className={`status-badge ${shop.isApproved ? 'badge-approved' : 'badge-pending'}`}>
                                {shop.isApproved ? 'Approved' : 'Pending'}
                              </span>
                              {!shop.isActive && <span className="badge badge-error" style={{ marginLeft: '4px' }}>Inactive</span>}
                            </td>
                            <td><strong>{shop.publishedPartsCount}</strong></td>
                            <td>{shop.totalOrders}</td>
                            <td><span className="highlight-green">{shop.completedOrders}</span></td>
                            <td>{shop.cancelledOrders > 0 ? <span className="highlight-red">{shop.cancelledOrders}</span> : '0'}</td>
                            <td>{formatCurrency(shop.attributableOrderValue)}</td>
                            <td><strong className="highlight-orange">{formatCurrency(shop.completedRevenue)}</strong></td>
                            <td>
                              <Link to={`/admin/shops/${shop._id}`} className="table-action-link">
                                Manage Shop →
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: REPORT EXPORTS (CSV)
            ========================================================================= */}
        {activeTab === 'reports' && (
          <div className="tab-pane-content">
            <div className="export-center-header">
              <div>
                <h3 className="panel-title">Business Intelligence Export Center</h3>
                <p className="panel-subtitle">
                  Generate sanitized, audit-ready CSV exports. Formula injection mitigated (CWE-1236). Passwords and tokens excluded.
                </p>
              </div>
            </div>

            <div className="report-cards-grid">
              {/* Report 1: Orders */}
              <div className="report-card">
                <div className="report-card-icon">🛒</div>
                <div className="report-card-body">
                  <h4 className="report-title">Customer Orders Master Report</h4>
                  <p className="report-desc">
                    Comprehensive order transactions including order numbers, dates, customer details, payment methods, status history, and totals.
                  </p>
                  <div className="report-meta">
                    <span>Format: CSV (UTF-8 BOM)</span>
                    <span>Filter: {preset.toUpperCase()}</span>
                  </div>
                </div>
                <div className="report-card-footer">
                  <button
                    type="button"
                    className="btn btn-primary export-btn"
                    onClick={() => handleDownloadCsv('orders', 'Orders Report')}
                    disabled={downloadingReport === 'orders'}
                  >
                    {downloadingReport === 'orders' ? 'Exporting...' : '📥 Download Orders CSV'}
                  </button>
                </div>
              </div>

              {/* Report 2: Inventory */}
              <div className="report-card">
                <div className="report-card-icon">📦</div>
                <div className="report-card-body">
                  <h4 className="report-title">Inventory & Stock Health Report</h4>
                  <p className="report-desc">
                    Complete spare-part catalog listing SKU numbers, manufacturers, vehicle types, categories, prices, and live stock statuses.
                  </p>
                  <div className="report-meta">
                    <span>Format: CSV (UTF-8 BOM)</span>
                    <span>Scope: All Active Parts</span>
                  </div>
                </div>
                <div className="report-card-footer">
                  <button
                    type="button"
                    className="btn btn-primary export-btn"
                    onClick={() => handleDownloadCsv('inventory', 'Inventory Report')}
                    disabled={downloadingReport === 'inventory'}
                  >
                    {downloadingReport === 'inventory' ? 'Exporting...' : '📥 Download Inventory CSV'}
                  </button>
                </div>
              </div>

              {/* Report 3: Shops */}
              <div className="report-card">
                <div className="report-card-icon">🏬</div>
                <div className="report-card-body">
                  <h4 className="report-title">Merchant Shops & Applications Report</h4>
                  <p className="report-desc">
                    Registered partner shops, owner contact info, verification states, published part counts, and attributable revenue totals.
                  </p>
                  <div className="report-meta">
                    <span>Format: CSV (UTF-8 BOM)</span>
                    <span>Scope: All Platform Shops</span>
                  </div>
                </div>
                <div className="report-card-footer">
                  <button
                    type="button"
                    className="btn btn-primary export-btn"
                    onClick={() => handleDownloadCsv('shops', 'Shops Report')}
                    disabled={downloadingReport === 'shops'}
                  >
                    {downloadingReport === 'shops' ? 'Exporting...' : '📥 Download Shops CSV'}
                  </button>
                </div>
              </div>

              {/* Report 4: Customers */}
              <div className="report-card">
                <div className="report-card-icon">👥</div>
                <div className="report-card-body">
                  <h4 className="report-title">Customer Registrations Report</h4>
                  <p className="report-desc">
                    Registered customer roster with email verification status and account states. Passwords, hashes, and tokens strictly excluded.
                  </p>
                  <div className="report-meta">
                    <span>Format: CSV (UTF-8 BOM)</span>
                    <span>Filter: {preset.toUpperCase()}</span>
                  </div>
                </div>
                <div className="report-card-footer">
                  <button
                    type="button"
                    className="btn btn-primary export-btn"
                    onClick={() => handleDownloadCsv('customers', 'Customer Registrations Report')}
                    disabled={downloadingReport === 'customers'}
                  >
                    {downloadingReport === 'customers' ? 'Exporting...' : '📥 Download Customers CSV'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAnalyticsPage;
