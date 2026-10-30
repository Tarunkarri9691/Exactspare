import React, { useState, useEffect } from 'react';
import { useVehicle } from '../context/VehicleContext';
import { fetchSearchMetadata } from '../services/api';
import './VehicleSelectionModal.css';

const VEHICLE_CATEGORIES = [
  { id: 'ALL', label: 'All Vehicles', icon: '🚘' },
  { id: 'Bike', label: 'Bike / Motorcycle', icon: '🏍️' },
  { id: 'Car', label: 'Car / 4-Wheeler', icon: '🚗' },
  { id: 'Scooter', label: 'Scooter / Moped', icon: '🛵' },
  { id: 'Bicycle', label: 'Bicycle', icon: '🚲' },
  { id: 'Other', label: 'Commercial / Other', icon: '🚚' }
];

const DEFAULT_VEHICLE = {
  vehicleType: 'ALL',
  make: '',
  model: '',
  year: '',
  variant: ''
};

export default function VehicleSelectionModal() {
  const { selectedVehicle, updateVehicle, clearVehicle, isModalOpen, closeVehicleModal } = useVehicle();

  const [form, setForm] = useState(() => ({ ...DEFAULT_VEHICLE, ...selectedVehicle }));
  const [metadata, setMetadata] = useState(null);

  // Sync form when modal opens
  useEffect(() => {
    if (isModalOpen) {
      setForm({ ...DEFAULT_VEHICLE, ...selectedVehicle });
      fetchSearchMetadata().then((res) => {
        if (res.success && res.data) {
          setMetadata(res.data);
        }
      });
    }
  }, [isModalOpen, selectedVehicle]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isModalOpen) {
        closeVehicleModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, closeVehicleModal]);

  if (!isModalOpen) return null;

  const handleCategorySelect = (catId) => {
    setForm((prev) => ({ ...prev, vehicleType: catId }));
  };

  const handleApply = (e) => {
    e.preventDefault();
    updateVehicle(form);
    closeVehicleModal();
  };

  const handleReset = () => {
    clearVehicle();
    closeVehicleModal();
  };

  return (
    <div className="veh-modal-backdrop" onClick={closeVehicleModal} role="dialog" aria-modal="true" aria-labelledby="veh-modal-title">
      <div className="veh-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="veh-modal-header">
          <div className="veh-modal-title-row">
            <span className="veh-modal-icon">🚗</span>
            <div>
              <h3 id="veh-modal-title" className="veh-modal-title">Select Your Vehicle</h3>
              <p className="veh-modal-subtitle">Filter genuine spare parts specifically verified for your exact vehicle.</p>
            </div>
          </div>
          <button type="button" className="veh-modal-close" onClick={closeVehicleModal} aria-label="Close vehicle selector">
            ✕
          </button>
        </div>

        <form onSubmit={handleApply} className="veh-modal-body">
          {/* Step 1: Vehicle Category Pills */}
          <div className="veh-modal-field">
            <label className="veh-field-label">Vehicle Category</label>
            <div className="veh-cat-grid">
              {VEHICLE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`veh-cat-btn ${form?.vehicleType === cat.id ? 'active' : ''}`}
                  onClick={() => handleCategorySelect(cat.id)}
                >
                  <span className="veh-cat-icon">{cat.icon}</span>
                  <span className="veh-cat-label">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Make & Model */}
          <div className="veh-inputs-row">
            <div className="veh-modal-field">
              <label htmlFor="veh-modal-make" className="veh-field-label">Make / Brand</label>
              <input
                id="veh-modal-make"
                type="text"
                className="veh-field-input"
                placeholder="e.g. Honda, Hyundai, Maruti, Hero..."
                value={form?.make || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, make: e.target.value }))}
                list="veh-meta-makes"
              />
              {metadata?.makes && (
                <datalist id="veh-meta-makes">
                  {metadata.makes.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              )}
            </div>

            <div className="veh-modal-field">
              <label htmlFor="veh-modal-model" className="veh-field-label">Model</label>
              <input
                id="veh-modal-model"
                type="text"
                className="veh-field-input"
                placeholder="e.g. Activa 6G, Swift, Splendor, Creta..."
                value={form?.model || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
                list="veh-meta-models"
              />
              {metadata?.models && (
                <datalist id="veh-meta-models">
                  {metadata.models.map((mod) => (
                    <option key={mod} value={mod} />
                  ))}
                </datalist>
              )}
            </div>
          </div>

          {/* Step 3: Year & Variant */}
          <div className="veh-inputs-row">
            <div className="veh-modal-field">
              <label htmlFor="veh-modal-year" className="veh-field-label">Manufacturing Year (Optional)</label>
              <input
                id="veh-modal-year"
                type="text"
                className="veh-field-input"
                placeholder="e.g. 2020, 2022..."
                value={form?.year || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, year: e.target.value }))}
              />
            </div>

            <div className="veh-modal-field">
              <label htmlFor="veh-modal-variant" className="veh-field-label">Trim / Variant (Optional)</label>
              <input
                id="veh-modal-variant"
                type="text"
                className="veh-field-input"
                placeholder="e.g. VXI, ZXI, Disc, Deluxe..."
                value={form?.variant || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, variant: e.target.value }))}
              />
            </div>
          </div>

          <div className="veh-modal-footer">
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleReset}
            >
              Clear Vehicle
            </button>
            <div className="veh-footer-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={closeVehicleModal}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                id="btn-apply-vehicle-selection"
              >
                Save & Filter Parts
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
