import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AiAssistantModal from '../components/AiAssistantModal';
import ProductCompareModal from '../components/ProductCompareModal';
import './MainLayout.css';

const MainLayout = () => {
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  return (
    <div className="layout-root">
      <Navbar onOpenAi={() => setIsAiModalOpen(true)} />
      
      <main className="layout-main">
        <Outlet />
      </main>

      {/* Persistent Floating AI Trigger Button */}
      <button
        className="floating-ai-trigger-btn"
        onClick={() => setIsAiModalOpen(true)}
        title="Ask AI Vehicle Parts Assistant"
        aria-label="Open AI Assistant"
      >
        <span className="ai-trigger-icon">🤖</span>
        <span className="ai-trigger-text">Ask AI Parts Assistant</span>
      </button>

      {/* Global AI Assistant Modal */}
      <AiAssistantModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
      />

      {/* Global Comparison Tray and Modal */}
      <ProductCompareModal />

      <Footer />
    </div>
  );
};

export default MainLayout;
