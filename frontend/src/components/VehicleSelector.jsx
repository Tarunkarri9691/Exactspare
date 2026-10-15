import React from 'react';
import './VehicleSelector.css';

const VEHICLE_CATEGORIES = [
  { id: 'ALL', label: 'All Vehicles', icon: '🚘' },
  { id: 'Bike', label: 'Bike / Motorcycle', icon: '🏍️' },
  { id: 'Car', label: 'Car / 4-Wheeler', icon: '🚗' },
  { id: 'Scooter', label: 'Scooter / Moped', icon: '🛵' },
  { id: 'Bicycle', label: 'Bicycle / Cycle', icon: '🚲' },
  { id: 'Other', label: 'Commercial / Other', icon: '🚚' }
];

const VehicleSelector = ({
  vehicleType = 'ALL',
  make = '',
  model = '',
  year = '',
  engineDetails = '',
  availableMakes = [],
  availableModels = [],
  onChange,
  onReset,
  compact = false
}) => {
  const isBicycle = vehicleType === 'Bicycle';

  const handleFieldChange = (field, value) => {
    if (onChange) {
      onChange({
        vehicleType: field === 'vehicleType' ? value : vehicleType,
        make: field === 'make' ? value : make,
        model: field === 'model' ? value : model,
        year: field === 'year' ? value : year,
        engineDetails: field === 'engineDetails' ? value : engineDetails
      });
    }
  };

  const hasVehicleSelected = vehicleType !== 'ALL' || make.trim() || model.trim() || year.trim();

  return (
    <div className={`vehicle-selector-card ${compact ? 'compact-mode' : ''}`}>
      <div className="selector-header">
        <div className="selector-title-wrap">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2.1 11.2 2 11.6 2 12v4c0 .6.4 1 1 1h2"/>
            <circle cx="7" cy="17" r="2"/>
            <circle cx="17" cy="17" r="2"/>
          </svg>
          <span className="selector-title">Vehicle Compatibility Selector</span>
        </div>

        {hasVehicleSelected && (
          <button
            type="button"
            className="btn-clear-selector"
            onClick={onReset}
            title="Reset vehicle filter"
          >
            Clear Selection
          </button>
        )}
      </div>

      {/* Vehicle Type Radio / Grid Pills */}
      <div className="vehicle-types-pills">
        {VEHICLE_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`vehicle-pill ${vehicleType === cat.id ? 'active' : ''}`}
            onClick={() => handleFieldChange('vehicleType', cat.id)}
          >
            <span className="pill-icon">{cat.icon}</span>
            <span className="pill-label">{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Compatibility Inputs */}
      <div className="compatibility-inputs-grid">
        {/* Make / Manufacturer */}
        <div className="input-field-group">
          <label htmlFor="veh-make-input" className="field-label">Make / Brand</label>
          <div className="field-input-wrap">
            <input
              id="veh-make-input"
              type="text"
              className="field-input"
              placeholder="e.g. Honda, Maruti, Yamaha, Hero..."
              value={make}
              onChange={(e) => handleFieldChange('make', e.target.value)}
              list="known-makes-list"
            />
            {availableMakes.length > 0 && (
              <datalist id="known-makes-list">
                {availableMakes.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            )}
          </div>
        </div>

        {/* Model */}
        <div className="input-field-group">
          <label htmlFor="veh-model-input" className="field-label">Vehicle Model</label>
          <div className="field-input-wrap">
            <input
              id="veh-model-input"
              type="text"
              className="field-input"
              placeholder="e.g. Swift, Activa, Splendor, i20..."
              value={model}
              onChange={(e) => handleFieldChange('model', e.target.value)}
              list="known-models-list"
            />
            {availableModels.length > 0 && (
              <datalist id="known-models-list">
                {availableModels.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            )}
          </div>
        </div>

        {/* Model Year */}
        <div className="input-field-group">
          <label htmlFor="veh-year-input" className="field-label">Model Year</label>
          <div className="field-input-wrap">
            <input
              id="veh-year-input"
              type="text"
              className="field-input"
              placeholder="e.g. 2019, 2022..."
              value={year}
              onChange={(e) => handleFieldChange('year', e.target.value)}
            />
          </div>
        </div>

        {/* Engine / CC (Disabled for Bicycles) */}
        <div className="input-field-group">
          <label htmlFor="veh-engine-input" className="field-label">
            Engine / Variant {isBicycle && <span className="label-note">(N/A for Bicycles)</span>}
          </label>
          <div className="field-input-wrap">
            <input
              id="veh-engine-input"
              type="text"
              className={`field-input ${isBicycle ? 'disabled-field' : ''}`}
              placeholder={isBicycle ? 'Not applicable for bicycles' : 'e.g. 1.2L DualJet, 110cc, 350cc...'}
              value={isBicycle ? '' : engineDetails}
              disabled={isBicycle}
              onChange={(e) => handleFieldChange('engineDetails', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Compatibility Status Indicator */}
      {hasVehicleSelected && (
        <div className="compatibility-summary-bar">
          <div className="summary-badge-wrap">
            {make && model ? (
              <span className="badge badge-green">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Filtering by: {make} {model} {year ? `(${year})` : ''}
              </span>
            ) : (
              <span className="badge badge-orange">
                Filtering by Category: {vehicleType !== 'ALL' ? vehicleType : 'All Vehicles'}
              </span>
            )}
          </div>
          <span className="compatibility-note">
            Only products verified to match these specifications will be flagged as compatible.
          </span>
        </div>
      )}
    </div>
  );
};

export default VehicleSelector;
