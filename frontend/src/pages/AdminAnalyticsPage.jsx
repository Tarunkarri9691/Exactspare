import React, { useState, useEffect } from 'react';
import AdminNav from '../components/AdminNav';
import { fetchAdminSalesAnalytics, fetchAdminOrderAnalytics } from '../services/api';
import './AdminAnalyticsPage.css';

const AdminAnalyticsPage = () => {
  const [period, setPeriod] = useState('daily');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [salesData, setSalesData] = useState(null);
  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAnalytics = async () => {
    setLoading(true);
    setError('');
    const params = { period };
    if (fromDate) params.from = fromDate;
    if (toDate) params.to = toDate;

    try {
      const [salesRes, orderRes] = await Promise.all([
        fetchAdminSalesAnalytics(params),
        fetchAdminOrderAnalytics(params)
      ]);

      if (salesRes.success) {
        setSalesData(salesRes.data);
      } else {
        setError(salesRes.error || 'Failed to fetch sales analytics');
      }

      if (orderRes.success) {
        setOrderData(orderRes.data);
      }
    } catch (err) {
      setError('An unexpected error occurred while loading analytics reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const handleApplyFilter = (e) => {
    e.preventDefault();
    loadAnalytics();
  };

  const handleResetFilter = () => {
    setFromDate('');
    setToDate('');
    setPeriod('daily');
  };

  const formatCurrency = (val) => {
    return `₹${Number(val || 0).toLocaleString('en-IN')}`;
  };

  const summary = salesData?.summary || {
    totalRevenue: 0,
    grossOrderValue: 0,
    confirmedRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0
  };

  const timeline = salesData?.timeline || [];
  const topProducts = salesData?.topProducts || [];
  const topShops = salesData?.topShops || [];
  const statusDist = orderData?.statusDistribution || [];

  // Calculate SVG Trend Line Path
  const maxRevenue = Math.max(...timeline.map((t) => t.revenue || 0), 100);
  const svgWidth = 650;
  const svgHeight = 220;
  const padding = 35;

  const points = timeline.map((item, index) => {
    const x =
      padding +
      (timeline.length > 1
        ? (index / (timeline.length - 1)) * (svgWidth - padding * 2)
        : (svgWidth - padding * 2) / 2);
    const y =
      svgHeight -
      padding -
      ((item.revenue || 0) / maxRevenue) * (svgHeight - padding * 2);
    return { x, y, ...item };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="admin-analytics-page">
      <AdminNav />

      <div className="container admin-analytics-container">
        {/* Header */}
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">Sales & Order Reports</h1>
            <p className="admin-page-subtitle">
              Comprehensive financial intelligence, sales trends, and order fulfillment breakdown across EXACTSPARE.
            </p>
          </div>
          <button className="btn btn-outline admin-refresh-btn" onClick={loadAnalytics} disabled={loading}>
            <span>🔄</span> {loading ? 'Refreshing...' : 'Refresh Reports'}
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="analytics-filter-card">
          <form className="analytics-filter-form" onSubmit={handleApplyFilter}>
            <div className="filter-group">
              <label>Aggregation Period</label>
              <div className="period-pills">
                <button
                  type="button"
                  className={`period-pill ${period === 'daily' ? 'active' : ''}`}
                  onClick={() => setPeriod('daily')}
                >
                  Daily
                </button>
                <button
                  type="button"
                  className={`period-pill ${period === 'weekly' ? 'active' : ''}`}
                  onClick={() => setPeriod('weekly')}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  className={`period-pill ${period === 'monthly' ? 'active' : ''}`}
                  onClick={() => setPeriod('monthly')}
                >
                  Monthly
                </button>
              </div>
            </div>

            <div className="filter-group">
              <label htmlFor="analytics-from-date">From Date</label>
              <input
                id="analytics-from-date"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="filter-date-input"
              />
            </div>

            <div className="filter-group">
              <label htmlFor="analytics-to-date">To Date</label>
              <input
                id="analytics-to-date"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="filter-date-input"
              />
            </div>

            <div className="filter-actions">
              <button type="submit" className="btn btn-primary filter-submit-btn" disabled={loading}>
                Apply Range
              </button>
              {(fromDate || toDate) && (
                <button
                  type="button"
                  className="btn btn-ghost filter-reset-btn"
                  onClick={handleResetFilter}
                  disabled={loading}
                >
                  Reset
                </button>
              )}
            </div>
          </form>
        </div>

        {error && (
          <div className="analytics-error-banner">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Financial KPI Summary Cards */}
        <div className="analytics-kpi-grid">
          <div className="kpi-card highlight-revenue">
            <span className="kpi-label">Completed Sales Revenue</span>
            <span className="kpi-value">{formatCurrency(summary.completedRevenue || summary.totalRevenue)}</span>
            <span className="kpi-note">Delivered & confirmed collected sales</span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">Gross Order Value (GMV)</span>
            <span className="kpi-value">{formatCurrency(summary.grossOrderValue)}</span>
            <span className="kpi-note">Total value of all non-cancelled orders</span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">Total Valid Orders</span>
            <span className="kpi-value">{summary.totalOrders || 0}</span>
            <span className="kpi-note">Excludes cancelled & unplaced carts</span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">Average Order Value (AOV)</span>
            <span className="kpi-value">{formatCurrency(summary.averageOrderValue)}</span>
            <span className="kpi-note">Mean basket size per transaction</span>
          </div>
        </div>

        {/* Trend Chart & Order Distribution */}
        <div className="analytics-charts-grid">
          {/* Sales Trends SVG Chart */}
          <div className="chart-panel sales-trend-panel">
            <div className="chart-header">
              <div>
                <h3 className="chart-title">Sales Trend ({period.toUpperCase()})</h3>
                <p className="chart-subtitle">Completed revenue progression over the selected timeline</p>
              </div>
            </div>

            <div className="chart-body">
              {timeline.length === 0 ? (
                <div className="chart-empty-state">
                  <span>📉</span>
                  <p>No sales activity recorded for the specified date range.</p>
                </div>
              ) : (
                <div className="svg-chart-wrapper">
                  <svg
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    className="trend-svg"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FF6B00" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#FF6B00" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Grid lines */}
                    <line x1={padding} y1={padding} x2={svgWidth - padding} y2={padding} stroke="#E2E8F0" strokeDasharray="3 3" />
                    <line x1={padding} y1={svgHeight / 2} x2={svgWidth - padding} y2={svgHeight / 2} stroke="#E2E8F0" strokeDasharray="3 3" />
                    <line x1={padding} y1={svgHeight - padding} x2={svgWidth - padding} y2={svgHeight - padding} stroke="#CBD5E1" />

                    {/* Area fill */}
                    {points.length > 1 && (
                      <polygon
                        points={`${points[0].x},${svgHeight - padding} ${polylinePoints} ${points[points.length - 1].x},${svgHeight - padding}`}
                        fill="url(#trendGradient)"
                      />
                    )}

                    {/* Polyline */}
                    <polyline
                      fill="none"
                      stroke="#FF6B00"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={polylinePoints}
                    />

                    {/* Data Points */}
                    {points.map((p, idx) => (
                      <g key={idx} className="chart-point-group">
                        <circle cx={p.x} cy={p.y} r="5" fill="#0A192F" stroke="#FF6B00" strokeWidth="2.5" />
                        <title>{`${p.label || p._id}: ${formatCurrency(p.revenue)} (${p.orders} orders)`}</title>
                      </g>
                    ))}
                  </svg>

                  {/* X Axis labels */}
                  <div className="chart-x-labels">
                    {points.map((p, idx) => (
                      <span key={idx} className="x-label-text">
                        {p.label || p._id}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Orders by Status Distribution */}
          <div className="chart-panel status-dist-panel">
            <div className="chart-header">
              <div>
                <h3 className="chart-title">Orders by Status</h3>
                <p className="chart-subtitle">Current distribution of customer orders</p>
              </div>
            </div>

            <div className="chart-body">
              {statusDist.length === 0 ? (
                <div className="chart-empty-state">
                  <span>📦</span>
                  <p>No orders available in this period.</p>
                </div>
              ) : (
                <div className="status-bars-list">
                  {statusDist.map((item) => {
                    const totalAll = statusDist.reduce((acc, curr) => acc + (curr.count || 0), 0) || 1;
                    const percent = Math.round(((item.count || 0) / totalAll) * 100);
                    return (
                      <div key={item._id} className="status-bar-item">
                        <div className="status-bar-header">
                          <span className={`status-tag status-${item._id.toLowerCase()}`}>
                            {item._id.replace('_', ' ')}
                          </span>
                          <span className="status-count-meta">
                            <strong>{item.count}</strong> orders ({percent}%) · {formatCurrency(item.totalAmount)}
                          </span>
                        </div>
                        <div className="status-progress-track">
                          <div
                            className={`status-progress-fill fill-${item._id.toLowerCase()}`}
                            style={{ width: `${percent}%` }}
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

        {/* Top-Selling Spare Parts & Top Performing Shops */}
        <div className="analytics-rankings-grid">
          {/* Top Selling Spare Parts */}
          <div className="ranking-card">
            <div className="ranking-header">
              <h3 className="ranking-title">Top-Selling Spare Parts</h3>
              <span className="badge badge-accent">By Revenue</span>
            </div>
            <div className="ranking-body">
              {topProducts.length === 0 ? (
                <div className="ranking-empty">No spare parts sales data found.</div>
              ) : (
                <div className="ranking-table-wrapper">
                  <table className="ranking-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Part Name</th>
                        <th>Part Number</th>
                        <th>Units Sold</th>
                        <th>Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProducts.map((prod, idx) => (
                        <tr key={prod.partId || idx}>
                          <td className="rank-col">{idx + 1}</td>
                          <td className="name-col">
                            <strong>{prod.partName || 'Unknown Part'}</strong>
                          </td>
                          <td className="code-col">{prod.partNumber || '—'}</td>
                          <td className="units-col">{prod.unitsSold || 0}</td>
                          <td className="revenue-col">{formatCurrency(prod.totalRevenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Top Performing Shops */}
          <div className="ranking-card">
            <div className="ranking-header">
              <h3 className="ranking-title">Shop Performance Comparisons</h3>
              <span className="badge badge-accent">By Revenue</span>
            </div>
            <div className="ranking-body">
              {topShops.length === 0 ? (
                <div className="ranking-empty">No shop sales performance recorded yet.</div>
              ) : (
                <div className="ranking-table-wrapper">
                  <table className="ranking-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Shop Name</th>
                        <th>City</th>
                        <th>Completed Orders</th>
                        <th>Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topShops.map((shop, idx) => (
                        <tr key={shop.shopId || idx}>
                          <td className="rank-col">{idx + 1}</td>
                          <td className="name-col">
                            <strong>{shop.shopName || 'Shop'}</strong>
                          </td>
                          <td className="city-col">{shop.city || '—'}</td>
                          <td className="orders-col">{shop.orderCount || 0}</td>
                          <td className="revenue-col">{formatCurrency(shop.totalRevenue)}</td>
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
    </div>
  );
};

export default AdminAnalyticsPage;
