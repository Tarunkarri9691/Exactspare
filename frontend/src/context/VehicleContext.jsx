import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { updateUserProfile } from '../services/api';

const DEFAULT_VEHICLE = {
  vehicleType: 'ALL',
  make: '',
  model: '',
  year: '',
  variant: ''
};

const STORAGE_KEY = 'exactspare_selected_vehicle';

const VehicleContext = createContext(null);

export const VehicleProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [selectedVehicle, setSelectedVehicle] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_VEHICLE, ...parsed };
      }
    } catch {
      // Fallback
    }
    return DEFAULT_VEHICLE;
  });

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Sync user's saved vehicle from profile when user logs in
  useEffect(() => {
    if (isAuthenticated && user?.savedVehicle && user.savedVehicle.vehicleType) {
      const profileVehicle = {
        vehicleType: user.savedVehicle.vehicleType || 'ALL',
        make: user.savedVehicle.make || '',
        model: user.savedVehicle.model || '',
        year: user.savedVehicle.year || '',
        variant: user.savedVehicle.variant || ''
      };
      setSelectedVehicle(profileVehicle);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profileVehicle));
      } catch {
        // Safe ignore
      }
    }
  }, [isAuthenticated, user]);

  const updateVehicle = useCallback(async (newVehicle) => {
    const merged = { ...DEFAULT_VEHICLE, ...newVehicle };
    setSelectedVehicle(merged);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // Safe ignore
    }

    // Persist to user profile in backend if authenticated
    if (isAuthenticated && user?.role === 'CUSTOMER') {
      try {
        await updateUserProfile({ savedVehicle: merged });
      } catch {
        // Safe ignore non-blocking sync
      }
    }
  }, [isAuthenticated, user]);

  const clearVehicle = useCallback(async () => {
    setSelectedVehicle(DEFAULT_VEHICLE);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Safe ignore
    }

    if (isAuthenticated && user?.role === 'CUSTOMER') {
      try {
        await updateUserProfile({ savedVehicle: DEFAULT_VEHICLE });
      } catch {
        // Safe ignore non-blocking sync
      }
    }
  }, [isAuthenticated, user]);

  const openVehicleModal = () => setIsModalOpen(true);
  const closeVehicleModal = () => setIsModalOpen(false);

  const hasVehicle = Boolean(
    (selectedVehicle?.vehicleType && selectedVehicle.vehicleType !== 'ALL') ||
    selectedVehicle?.make?.trim() ||
    selectedVehicle?.model?.trim()
  );

  const getVehicleDisplayLabel = () => {
    if (!hasVehicle || !selectedVehicle) return 'Select Vehicle';
    const parts = [];
    if (selectedVehicle?.make) parts.push(selectedVehicle.make);
    if (selectedVehicle?.model) parts.push(selectedVehicle.model);
    if (selectedVehicle?.year) parts.push(`(${selectedVehicle.year})`);
    if (parts.length === 0 && selectedVehicle?.vehicleType && selectedVehicle.vehicleType !== 'ALL') {
      return `${selectedVehicle.vehicleType} Only`;
    }
    return parts.length > 0 ? parts.join(' ') : 'Select Vehicle';
  };

  const safeVehicle = selectedVehicle || DEFAULT_VEHICLE;

  const value = {
    selectedVehicle: safeVehicle,
    vehicle: safeVehicle,
    updateVehicle,
    clearVehicle,
    hasVehicle,
    isVehicleSelected: hasVehicle,
    displayLabel: getVehicleDisplayLabel(),
    isModalOpen,
    openVehicleModal,
    closeVehicleModal
  };

  return (
    <VehicleContext.Provider value={value}>
      {children}
    </VehicleContext.Provider>
  );
};

export const useVehicle = () => {
  const context = useContext(VehicleContext);
  if (!context) {
    throw new Error('useVehicle must be used within a VehicleProvider');
  }
  return context;
};
