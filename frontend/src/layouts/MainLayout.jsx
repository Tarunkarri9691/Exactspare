import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import AiAssistantModal from '../components/AiAssistantModal';
import ProductCompareModal from '../components/ProductCompareModal';
import VehicleSelectionModal from '../components/VehicleSelectionModal';
import './MainLayout.css';

const MainLayout = () => {
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isHomePage = location.pathname === '/';
  const isLoginPage = location.pathname === '/login';

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  // Human-readable portal/page label for context
  const getContextLabel = (path) => {
    if (path.startsWith('/customer/settings') || path.startsWith('/settings')) return 'Customer Settings';
    if (path.startsWith('/customer')) return 'Customer Portal';
    if (path.startsWith('/owner')) return 'Shop Owner Portal';
    if (path.startsWith('/admin')) return 'Admin Management Portal';
    if (path.startsWith('/shop-application')) return 'Shop Registration & Activation';
    if (path.startsWith('/parts')) return 'Spare Parts Catalog';
    if (path.includes('/directions')) return 'Shop Directions & Navigation';
    if (path.startsWith('/shops')) return 'Local Shops Directory';
    if (path.startsWith('/wishlist')) return 'Saved Wishlist';
    if (path.startsWith('/support')) return 'Customer Support';
    if (path.startsWith('/login')) return 'Sign In';
    if (path.startsWith('/register')) return 'Account Registration';
    return 'EXACTSPARE';
  };

  return (
    <div className="layout-root">
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>
      <Navbar onOpenAi={() => setIsAiModalOpen(true)} />
      
      {!isHomePage && !isLoginPage && (
        <aside className="global-back-nav-bar" role="navigation" aria-label="Page navigation back bar">
          <div className="container global-back-container">
            <button
              type="button"
              className="global-back-btn"
              onClick={handleBack}
              title="Return to previous page"
              id="global-back-button"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="back-arrow-icon">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              <span>Back</span>
            </button>
            <div className="global-back-context">
              <span className="context-crumb-divider">/</span>
              <span className="context-crumb-label">{getContextLabel(location.pathname)}</span>
            </div>
          </div>
        </aside>
      )}

      <main id="main-content" className="layout-main">
        <Outlet />
      </main>

      {/* Global Vehicle Selection Modal */}
      <VehicleSelectionModal />

      {/* Global AI Assistant Modal */}
      <AiAssistantModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
      />

      {/* Global Comparison Tray and Modal */}
      <ProductCompareModal />
    </div>
  );
};

export default MainLayout;
