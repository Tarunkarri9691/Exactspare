import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SearchBar.css';

const SearchBar = ({ onCategorySelect }) => {
  const [partQuery, setPartQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [locationQuery, setLocationQuery] = useState('');
  const navigate = useNavigate();

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (partQuery.trim()) params.set('search', partQuery.trim());
    if (selectedCategory && selectedCategory !== 'all') {
      const typeMap = {
        bike: 'Bike',
        car: 'Car',
        scooter: 'Scooter',
        bicycle: 'Bicycle',
        other: 'Other'
      };
      params.set('vehicleType', typeMap[selectedCategory] || selectedCategory);
    }
    navigate(`/parts?${params.toString()}`);
  };

  return (
    <div className="search-section-wrapper">
      <div className="search-badge-container">
        <span className="badge badge-orange">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Live Marketplace Catalog • Verified Retail Parts
        </span>
      </div>

      <form className="search-card-form" onSubmit={handleSearchSubmit}>
        {/* Input 1: Part Search */}
        <div className="search-input-group part-group">
          <label htmlFor="search-part-input" className="search-label">Spare Part / OEM</label>
          <div className="input-with-icon">
            <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              id="search-part-input"
              type="text"
              className="search-input"
              placeholder="e.g. Brake Pads, Oil Filter, Spark Plug..."
              value={partQuery}
              onChange={(e) => setPartQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Input 2: Vehicle Type */}
        <div className="search-input-group category-group">
          <label htmlFor="search-category-select" className="search-label">Vehicle Type</label>
          <div className="input-with-icon">
            <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2.1 11.2 2 11.6 2 12v4c0 .6.4 1 1 1h2"/>
              <circle cx="7" cy="17" r="2"/>
              <circle cx="17" cy="17" r="2"/>
            </svg>
            <select
              id="search-category-select"
              className="search-select"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                if (onCategorySelect) onCategorySelect(e.target.value);
              }}
            >
              <option value="all">All Vehicles</option>
              <option value="bike">Bike (Motorcycle)</option>
              <option value="car">Car / 4-Wheeler</option>
              <option value="scooter">Scooter / Moped</option>
              <option value="bicycle">Bicycle</option>
              <option value="other">Other / Commercial</option>
            </select>
          </div>
        </div>

        {/* Input 3: Location */}
        <div className="search-input-group location-group">
          <label htmlFor="search-location-input" className="search-label">Nearby Location</label>
          <div className="input-with-icon">
            <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <input
              id="search-location-input"
              type="text"
              className="search-input"
              placeholder="City, Pincode or Area..."
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Submit button */}
        <div className="search-action-group">
          <button type="submit" className="btn btn-primary search-submit-btn" id="find-parts-button">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span>Find Parts</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default SearchBar;
