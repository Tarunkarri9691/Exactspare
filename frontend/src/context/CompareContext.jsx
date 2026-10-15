import React, { createContext, useContext, useState, useEffect } from 'react';

const CompareContext = createContext();

const STORAGE_KEY = 'exactspare_compare_items';

export const CompareProvider = ({ children }) => {
  const [compareItems, setCompareItems] = useState(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(compareItems));
    } catch (e) {
      console.warn('Failed to persist compare items:', e);
    }
  }, [compareItems]);

  const addToCompare = (product) => {
    if (!product || !product._id) return { success: false, message: 'Invalid product' };

    if (compareItems.some((item) => item._id === product._id)) {
      return { success: false, message: 'Part is already in comparison list.' };
    }

    if (compareItems.length >= 4) {
      return { success: false, message: 'You can compare a maximum of 4 spare parts simultaneously.' };
    }

    setCompareItems((prev) => [...prev, product]);
    return { success: true, message: `Added "${product.partName}" to comparison.` };
  };

  const removeFromCompare = (productId) => {
    setCompareItems((prev) => prev.filter((item) => item._id !== productId));
  };

  const clearCompare = () => {
    setCompareItems([]);
  };

  const isInCompare = (productId) => {
    return compareItems.some((item) => item._id === productId);
  };

  const openCompareModal = () => setIsCompareModalOpen(true);
  const closeCompareModal = () => setIsCompareModalOpen(false);

  return (
    <CompareContext.Provider
      value={{
        compareItems,
        compareCount: compareItems.length,
        addToCompare,
        removeFromCompare,
        clearCompare,
        isInCompare,
        isCompareModalOpen,
        openCompareModal,
        closeCompareModal
      }}
    >
      {children}
    </CompareContext.Provider>
  );
};

export const useCompare = () => {
  const context = useContext(CompareContext);
  if (!context) {
    throw new Error('useCompare must be used within a CompareProvider');
  }
  return context;
};

export default CompareContext;
