import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer-root">
      <div className="container footer-content">
        {/* Brand & Purpose */}
        <div className="footer-col footer-col-brand">
          <div className="footer-brand-title">
            <span className="brand-name">EXACT<span className="brand-highlight">SPARE</span></span>
          </div>
          <p className="footer-tagline">
            Find the right vehicle spare parts in nearby shops.
          </p>
          <p className="footer-description">
            Connecting vehicle owners, local spare parts merchants, and mechanics through real-time local inventory matching.
          </p>
          <div className="footer-status-tag">
            <span className="pulse-indicator" style={{ backgroundColor: 'var(--color-success)' }}></span>
            <span>Module 1: Project Foundation Active</span>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="footer-col">
          <h4 className="footer-heading">Platform</h4>
          <ul className="footer-links">
            <li><Link to="/">Home (Categories & Search)</Link></li>
            <li><Link to="/login">Customer Login</Link></li>
            <li><Link to="/register">Create Customer Account</Link></li>
            <li><Link to="/shop-owner">Shop Owner Partner Portal</Link></li>
          </ul>
        </div>

        {/* System Roles */}
        <div className="footer-col">
          <h4 className="footer-heading">System Roles</h4>
          <ul className="footer-links">
            <li><span className="footer-role">Customer</span>: Locate nearby stock & prices</li>
            <li><span className="footer-role">Shop Owner</span>: Register shop & list parts</li>
            <li><span className="footer-role">Admin</span>: Review & verify seller licenses</li>
          </ul>
        </div>

        {/* Technology Stack Info */}
        <div className="footer-col">
          <h4 className="footer-heading">Technology</h4>
          <div className="footer-tech-stack">
            <span className="tech-chip">React.js</span>
            <span className="tech-chip">Vite</span>
            <span className="tech-chip">Node.js</span>
            <span className="tech-chip">Express.js</span>
            <span className="tech-chip">MongoDB</span>
            <span className="tech-chip">Mongoose</span>
          </div>
          <p className="footer-tech-note">
            Built as a robust, decoupled MERN architecture with local storage support.
          </p>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="container footer-bottom-container">
          <p>© {currentYear} EXACTSPARE — Vehicle Spare Parts Finder. All rights reserved.</p>
          <p className="footer-foundation-note">
            Module 1 Foundation Build • Live inventory search & authentication enabled in subsequent modules.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
