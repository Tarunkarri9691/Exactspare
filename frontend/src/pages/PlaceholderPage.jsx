import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './PlaceholderPage.css';

const PAGE_CONFIGS = {
  '/login': {
    title: 'Customer & Merchant Login',
    subtitle: 'Access your EXACTSPARE account, saved spare parts, and nearby shop orders.',
    targetModule: 'Module 2: Authentication & User Profiles',
    badgeText: 'Planned for Module 2',
    roleTag: 'Role: Customer / Shop Owner / Admin',
    fields: ['Email or Phone Number', 'Account Password'],
    actionButtonText: 'Sign In (Disabled in Module 1)',
    explanation: 'Authentication, password encryption, JWT issuance, and session management will be implemented in Module 2.'
  },
  '/register': {
    title: 'Create EXACTSPARE Account',
    subtitle: 'Sign up to discover nearby vehicle spare parts and reserve stock.',
    targetModule: 'Module 2: User Onboarding & Roles',
    badgeText: 'Planned for Module 2',
    roleTag: 'Role: Customer',
    fields: ['Full Name', 'Mobile Number', 'Email Address', 'Vehicle Model / Type', 'Create Password'],
    actionButtonText: 'Register (Disabled in Module 1)',
    explanation: 'Customer user registration, schema validation, and secure authentication are part of Module 2.'
  },
  '/shop-owner': {
    title: 'Shop Owner Partner Application',
    subtitle: 'Register your retail store, upload spare parts inventory, and receive local customer inquiries.',
    targetModule: 'Module 4: Shop Owner Onboarding & Inventory',
    badgeText: 'Planned for Module 4',
    roleTag: 'Role: Shop Owner',
    fields: ['Shop / Business Legal Name', 'Owner Contact Person', 'Store Address & Pincode', 'GST / Trade License ID', 'Supported Vehicle Categories'],
    actionButtonText: 'Submit Application (Disabled in Module 1)',
    explanation: 'Store registration forms, local document uploads, inventory spreadsheets, and admin review workflows will be built in Modules 4 and 5.'
  }
};

const PlaceholderPage = () => {
  const location = useLocation();
  const config = PAGE_CONFIGS[location.pathname] || {
    title: 'Feature Under Construction',
    subtitle: 'This feature is part of the planned roadmap for EXACTSPARE.',
    targetModule: 'Upcoming Module',
    badgeText: 'Module Roadmap',
    roleTag: 'All Roles',
    fields: ['Sample Field 1', 'Sample Field 2'],
    actionButtonText: 'Submit (Disabled)',
    explanation: 'This capability will be unlocked in later phases of development.'
  };

  return (
    <div className="placeholder-page-root">
      <div className="container placeholder-container">
        <div className="placeholder-card">
          <div className="placeholder-badge-wrap">
            <span className="badge badge-orange">{config.badgeText}</span>
            <span className="badge badge-navy">{config.roleTag}</span>
          </div>

          <h1 className="placeholder-title">{config.title}</h1>
          <p className="placeholder-subtitle">{config.subtitle}</p>

          <div className="placeholder-alert-box">
            <div className="alert-icon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <div className="alert-content">
              <h4>Module 1 Foundation Scope</h4>
              <p>
                <strong>{config.targetModule}</strong> will activate this section. At this stage, authentication and form submissions are purposely disabled to preserve architecture integrity.
              </p>
              <p className="alert-explanation">{config.explanation}</p>
            </div>
          </div>

          {/* Wireframe Mock Form with explicit Disabled state */}
          <div className="mock-form-wireframe">
            <div className="wireframe-watermark">
              <span>UI SPECIFICATION PREVIEW • DISABLED</span>
            </div>
            <div className="mock-fields-list">
              {config.fields.map((field, idx) => (
                <div key={idx} className="mock-field-item">
                  <label className="mock-label">{field}</label>
                  <input 
                    type="text" 
                    className="mock-input" 
                    placeholder={`[Upcoming] Enter ${field}`} 
                    disabled 
                  />
                </div>
              ))}
            </div>

            <button type="button" className="btn btn-secondary mock-submit-btn" disabled>
              {config.actionButtonText}
            </button>
          </div>

          <div className="placeholder-footer">
            <Link to="/" className="btn btn-primary">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              <span>Back to Home & Categories</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlaceholderPage;
