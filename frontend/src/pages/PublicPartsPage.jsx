import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { searchNearbyParts, fetchSearchMetadata, fetchSearchSuggestions } from '../services/api';
import SearchResultCard from '../components/SearchResultCard';
import SearchResultsMapView from '../components/SearchResultsMapView';
import VehicleSelector from '../components/VehicleSelector';
import LocationSelector from '../components/LocationSelector';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import ImageSearchModal from '../components/ImageSearchModal';
import './PublicPartsPage.css';

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Most Relevant (Best Match)' },
  { value: 'rating_desc', label: 'Highest Rated (★ 5 → 1)' },
  { value: 'distance', label: 'Nearest First (📍 By Distance)' },
  { value: 'price_asc', label: 'Lowest Price First (₹ Low → High)' },
  { value: 'price_desc', label: 'Highest Price First (₹ High → Low)' },
  { value: 'newest', label: 'Recently Added' }
];

const CATEGORIES_LIST = [
  'ALL',
  'Engine',
  'Brakes',
  'Transmission',
  'Suspension',
  'Electrical',
  'Body & Panels',
  'Steering',
  'Exhaust',
  'Lighting',
  'Cooling',
  'Fuel System',
  'Maintenance & Fluids',
  'Accessories',
  'Other'
];

const PublicPartsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Search & Filter State
  const [query, setQuery] = useState(searchParams.get('q') || searchParams.get('search') || '');
  const [partNumber, setPartNumber] = useState(searchParams.get('partNumber') || '');
  const [vehicleType, setVehicleType] = useState(searchParams.get('vehicleType') || 'ALL');
  const [make, setMake] = useState(searchParams.get('make') || '');
  const [model, setModel] = useState(searchParams.get('model') || '');
  const [year, setYear] = useState(searchParams.get('year') || '');
  const [engineDetails, setEngineDetails] = useState('');
  const [category, setCategory] = useState(searchParams.get('category') || 'ALL');
  const [subcategory, setSubcategory] = useState(searchParams.get('subcategory') || '');
  const [manufacturer, setManufacturer] = useState(searchParams.get('manufacturer') || 'ALL');
  const [condition, setCondition] = useState(searchParams.get('condition') || 'ALL');
  const [minRating, setMinRating] = useState(searchParams.get('minRating') || 'ALL');
  const [barcode, setBarcode] = useState(searchParams.get('barcode') || '');
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [inStockOnly, setInStockOnly] = useState(searchParams.get('inStock') === 'true');

  // Scanner & Image Search Modal State
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannerMode, setScannerMode] = useState('all');
  const [showImageSearchModal, setShowImageSearchModal] = useState(false);

  // Suggestions state
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const searchInputWrapRef = useRef(null);

  // Location State
  const initialLat = searchParams.get('latitude') ? parseFloat(searchParams.get('latitude')) : null;
  const initialLng = searchParams.get('longitude') ? parseFloat(searchParams.get('longitude')) : null;
  const [latitude, setLatitude] = useState(initialLat);
  const [longitude, setLongitude] = useState(initialLng);
  const [radiusKm, setRadiusKm] = useState(parseInt(searchParams.get('radiusKm'), 10) || 25);
  const [locationName, setLocationName] = useState(searchParams.get('locationName') || '');

  // Sorting & Pagination
  const [sortBy, setSortBy] = useState(
    searchParams.get('sortBy') || (initialLat && initialLng ? 'distance' : 'newest')
  );
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page'), 10) || 1);

  // UI View Mode (Grid vs Map)
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'map'
  const [showVehicleSelector, setShowVehicleSelector] = useState(false);
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);

  // API Data State
  const [parts, setParts] = useState([]);
  const [shops, setShops] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 12, totalPages: 0 });
  const [locationContext, setLocationContext] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load database metadata for dynamic autocomplete / counts
  useEffect(() => {
    const loadMetadata = async () => {
      const res = await fetchSearchMetadata();
      if (res.success && res.data) {
        setMetadata(res.data);
      }
    };
    loadMetadata();
  }, []);

  // Main Search Execution
  const executeSearch = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params = {
        page: currentPage,
        limit: 12,
        sortBy
      };

      if (query.trim()) params.q = query.trim();
      if (partNumber.trim()) params.partNumber = partNumber.trim();
      if (vehicleType && vehicleType !== 'ALL') params.vehicleType = vehicleType;
      if (make.trim()) params.make = make.trim();
      if (model.trim()) params.model = model.trim();
      if (year.trim()) params.year = year.trim();
      if (category && category !== 'ALL') params.category = category;
      if (subcategory.trim()) params.subcategory = subcategory.trim();
      if (manufacturer && manufacturer !== 'ALL') params.manufacturer = manufacturer;
      if (condition && condition !== 'ALL') params.condition = condition;
      if (minRating && minRating !== 'ALL') params.minRating = minRating;
      if (barcode.trim()) params.barcode = barcode.trim();
      if (minPrice !== '' && !isNaN(minPrice)) params.minPrice = minPrice;
      if (maxPrice !== '' && !isNaN(maxPrice)) params.maxPrice = maxPrice;
      if (inStockOnly) params.inStock = true;

      // Include coordinates if present
      if (latitude !== null && longitude !== null) {
        params.latitude = latitude;
        params.longitude = longitude;
        params.radiusKm = radiusKm;
      }

      const res = await searchNearbyParts(params);

      if (res.success && res.data) {
        setParts(res.data.parts || []);
        setShops(res.data.shops || []);
        setPagination(res.data.pagination || { total: 0, page: 1, limit: 12, totalPages: 0 });
        setLocationContext(res.data.locationContext || null);
      } else {
        setError(res.error || 'Failed to fetch search results.');
        setParts([]);
        setShops([]);
      }
    } catch (err) {
      setError('A connection error occurred while querying spare parts.');
      setParts([]);
      setShops([]);
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    query,
    partNumber,
    vehicleType,
    make,
    model,
    year,
    category,
    subcategory,
    manufacturer,
    condition,
    minRating,
    barcode,
    minPrice,
    maxPrice,
    inStockOnly,
    latitude,
    longitude,
    radiusKm,
    sortBy
  ]);

  // Execute search when state changes
  useEffect(() => {
    executeSearch();
  }, [executeSearch]);

  // Live autocomplete suggestions
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSuggestionsLoading(true);
        const res = await fetchSearchSuggestions(trimmed);
        if (res.success && res.data) {
          setSuggestions(res.data.suggestions || []);
          setShowSuggestions(true);
        }
      } catch {
        // ignore suggestions error
      } finally {
        setSuggestionsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (searchInputWrapRef.current && !searchInputWrapRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Sync state back to URL query parameters
  useEffect(() => {
    const p = new URLSearchParams();
    if (query.trim()) p.set('q', query.trim());
    if (partNumber.trim()) p.set('partNumber', partNumber.trim());
    if (vehicleType !== 'ALL') p.set('vehicleType', vehicleType);
    if (make.trim()) p.set('make', make.trim());
    if (model.trim()) p.set('model', model.trim());
    if (year.trim()) p.set('year', year.trim());
    if (category !== 'ALL') p.set('category', category);
    if (subcategory.trim()) p.set('subcategory', subcategory.trim());
    if (condition !== 'ALL') p.set('condition', condition);
    if (minRating !== 'ALL') p.set('minRating', minRating);
    if (barcode.trim()) p.set('barcode', barcode.trim());
    if (minPrice !== '') p.set('minPrice', minPrice);
    if (maxPrice !== '') p.set('maxPrice', maxPrice);
    if (inStockOnly) p.set('inStock', 'true');
    if (latitude !== null && longitude !== null) {
      p.set('latitude', latitude);
      p.set('longitude', longitude);
      p.set('radiusKm', radiusKm);
      if (locationName) p.set('locationName', locationName);
    }
    p.set('sortBy', sortBy);
    if (currentPage > 1) p.set('page', currentPage);

    setSearchParams(p, { replace: true });
  }, [
    query,
    partNumber,
    vehicleType,
    make,
    model,
    year,
    category,
    subcategory,
    condition,
    minRating,
    barcode,
    minPrice,
    maxPrice,
    inStockOnly,
    latitude,
    longitude,
    radiusKm,
    locationName,
    sortBy,
    currentPage,
    setSearchParams
  ]);

  // Handle Search Input submit
  const handleQuerySubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    executeSearch();
  };

  // Location Change Handler
  const handleLocationChange = (loc) => {
    setLatitude(loc.latitude);
    setLongitude(loc.longitude);
    setLocationName(loc.locationName || '');
    if (loc.radiusKm) setRadiusKm(loc.radiusKm);
    if (sortBy === 'newest') setSortBy('distance');
    setCurrentPage(1);
  };

  // Clear Location Handler
  const handleClearLocation = () => {
    setLatitude(null);
    setLongitude(null);
    setLocationName('');
    if (sortBy === 'distance') setSortBy('newest');
    setCurrentPage(1);
  };

  // Vehicle Selector Change Handler
  const handleVehicleChange = (vData) => {
    if (!vData) return;
    setVehicleType(vData.vehicleType || 'ALL');
    setMake(vData.make || '');
    setModel(vData.model || '');
    setYear(vData.year || '');
    setEngineDetails(vData.engineDetails || '');
    setCurrentPage(1);
  };

  // Reset All Filters
  const handleResetFilters = () => {
    setQuery('');
    setPartNumber('');
    setVehicleType('ALL');
    setMake('');
    setModel('');
    setYear('');
    setEngineDetails('');
    setCategory('ALL');
    setSubcategory('');
    setManufacturer('ALL');
    setCondition('ALL');
    setMinRating('ALL');
    setBarcode('');
    setMinPrice('');
    setMaxPrice('');
    setInStockOnly(false);
    setLatitude(null);
    setLongitude(null);
    setLocationName('');
    setRadiusKm(25);
    setSortBy('newest');
    setCurrentPage(1);
  };

  // Check if any filter is active
  const hasActiveFilters =
    query.trim() ||
    partNumber.trim() ||
    vehicleType !== 'ALL' ||
    make.trim() ||
    model.trim() ||
    year.trim() ||
    category !== 'ALL' ||
    subcategory.trim() ||
    manufacturer !== 'ALL' ||
    condition !== 'ALL' ||
    minRating !== 'ALL' ||
    barcode.trim() ||
    minPrice !== '' ||
    maxPrice !== '' ||
    inStockOnly ||
    latitude !== null;

  return (
    <div className="public-parts-page-root">
      <div className="container public-parts-container">
        {/* Marketplace Header */}
        <div className="parts-hero-banner">
          <div className="hero-header-row">
            <div>
              <span className="badge badge-orange">Location-Based Discovery • Module 5</span>
              <h1 className="parts-hero-title">Find Vehicle Spare Parts in Nearby Shops</h1>
              <p className="parts-hero-subtitle">
                Compare verified local inventory, live stock availability, and straight-line distances from authentic auto spare dealers.
              </p>
            </div>

            {/* View Mode Toggle (Grid vs Interactive Map) */}
            <div className="view-mode-toggle-group">
              <button
                type="button"
                className={`btn-view-toggle ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Card Grid View"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
                <span>Grid</span>
              </button>

              <button
                type="button"
                className={`btn-view-toggle ${viewMode === 'map' ? 'active' : ''}`}
                onClick={() => setViewMode('map')}
                title="Interactive Map View"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
                  <line x1="8" y1="2" x2="8" y2="18"></line>
                  <line x1="16" y1="6" x2="16" y2="22"></line>
                </svg>
                <span>Map ({shops.length} Shops)</span>
              </button>
            </div>
          </div>

          {/* Quick Search Bar */}
          <form className="parts-search-bar-inline" onSubmit={handleQuerySubmit}>
            <div className="search-input-wrap" ref={searchInputWrapRef}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                placeholder="Search part name, OEM code, brand, barcode, or category..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
              />
              {query && (
                <button
                  type="button"
                  className="btn-clear-query"
                  onClick={() => {
                    setQuery('');
                    setSuggestions([]);
                    setShowSuggestions(false);
                    setCurrentPage(1);
                  }}
                >
                  ✕
                </button>
              )}

              {/* Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="search-suggestions-dropdown fade-in">
                  <div className="suggestions-header">
                    <span>Database Suggestions</span>
                    {suggestionsLoading && <span className="suggestions-loader">...</span>}
                  </div>
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="suggestion-item"
                      onClick={() => {
                        setQuery(s.text);
                        setShowSuggestions(false);
                        setCurrentPage(1);
                      }}
                    >
                      <span className="suggestion-type-tag">{s.type}</span>
                      <span className="suggestion-text">{s.text}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" className="btn btn-primary btn-search-trigger">
              Search
            </button>

            <button
              type="button"
              className="btn btn-outline btn-scan-trigger"
              onClick={() => {
                setScannerMode('all');
                setShowScannerModal(true);
              }}
              title="Scan Barcode or QR Code with Camera"
            >
              <span>📷 Scan Code</span>
            </button>

            <button
              type="button"
              className="btn btn-outline btn-img-trigger"
              onClick={() => setShowImageSearchModal(true)}
              title="Search by Product Photograph"
            >
              <span>🖼️ Image Search</span>
            </button>

            <button
              type="button"
              className={`btn btn-outline btn-toggle-vehicle ${showVehicleSelector ? 'active' : ''}`}
              onClick={() => setShowVehicleSelector(!showVehicleSelector)}
            >
              <span>🚗 Vehicle Compatibility</span>
              <span className="arrow-icon">{showVehicleSelector ? '▲' : '▼'}</span>
            </button>
          </form>

          {/* Collapsible Vehicle Selector */}
          {showVehicleSelector && (
            <div className="vehicle-selector-panel fade-in">
              <VehicleSelector
                vehicleType={vehicleType}
                make={make}
                model={model}
                year={year}
                engineDetails={engineDetails}
                availableMakes={metadata?.makes || []}
                availableModels={metadata?.models || []}
                onChange={handleVehicleChange}
                onReset={() => {
                  setVehicleType('ALL');
                  setMake('');
                  setModel('');
                  setYear('');
                  setEngineDetails('');
                  setCurrentPage(1);
                }}
              />
            </div>
          )}

          {/* Location Selector */}
          <LocationSelector
            latitude={latitude}
            longitude={longitude}
            locationName={locationName}
            radiusKm={radiusKm}
            onLocationChange={handleLocationChange}
            onClearLocation={handleClearLocation}
          />
        </div>

        {/* Active Filters Summary Bar */}
        {hasActiveFilters && (
          <div className="active-filters-chips-bar fade-in">
            <span className="filter-label">Active Filters:</span>

            {query && (
              <span className="filter-chip">
                Query: "{query}"
                <button onClick={() => setQuery('')}>✕</button>
              </span>
            )}

            {vehicleType !== 'ALL' && (
              <span className="filter-chip">
                Vehicle: {vehicleType}
                <button onClick={() => setVehicleType('ALL')}>✕</button>
              </span>
            )}

            {make && (
              <span className="filter-chip">
                Make: {make}
                <button onClick={() => setMake('')}>✕</button>
              </span>
            )}

            {model && (
              <span className="filter-chip">
                Model: {model}
                <button onClick={() => setModel('')}>✕</button>
              </span>
            )}

            {category !== 'ALL' && (
              <span className="filter-chip">
                Category: {category}
                <button onClick={() => setCategory('ALL')}>✕</button>
              </span>
            )}

            {subcategory && (
              <span className="filter-chip">
                Subcategory: {subcategory}
                <button onClick={() => setSubcategory('')}>✕</button>
              </span>
            )}

            {condition !== 'ALL' && (
              <span className="filter-chip">
                Condition: {condition}
                <button onClick={() => setCondition('ALL')}>✕</button>
              </span>
            )}

            {minRating !== 'ALL' && (
              <span className="filter-chip">
                Rating: {minRating}+ ★
                <button onClick={() => setMinRating('ALL')}>✕</button>
              </span>
            )}

            {barcode && (
              <span className="filter-chip">
                Barcode: {barcode}
                <button onClick={() => setBarcode('')}>✕</button>
              </span>
            )}

            {inStockOnly && (
              <span className="filter-chip in-stock-chip">
                ✓ In-Stock Only
                <button onClick={() => setInStockOnly(false)}>✕</button>
              </span>
            )}

            {(minPrice || maxPrice) && (
              <span className="filter-chip">
                ₹{minPrice || 0} - ₹{maxPrice || '∞'}
                <button onClick={() => { setMinPrice(''); setMaxPrice(''); }}>✕</button>
              </span>
            )}

            {latitude !== null && (
              <span className="filter-chip location-chip">
                📍 Within {radiusKm} km
                <button onClick={handleClearLocation}>✕</button>
              </span>
            )}

            <button type="button" className="btn-reset-all" onClick={handleResetFilters}>
              Reset All
            </button>
          </div>
        )}

        {/* Results Bar (Count, Sort, Filter Toggle) */}
        <div className="results-controls-row">
          <div className="results-count-wrap">
            <span className="results-count-number">{pagination.total}</span>
            <span className="results-count-label">
              {pagination.total === 1 ? 'compatible spare part' : 'compatible spare parts'} found
            </span>
            {locationContext?.hasLocation && (
              <span className="nearby-location-indicator">
                near <strong>{locationName || `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`}</strong>
              </span>
            )}
          </div>

          <div className="controls-right-wrap">
            {/* Sorting Select */}
            <div className="sort-box">
              <label htmlFor="sort-by-select" className="sort-label">Sort:</label>
              <select
                id="sort-by-select"
                className="sort-select"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setCurrentPage(1);
                }}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.value === 'distance' && latitude === null}
                  >
                    {opt.label} {opt.value === 'distance' && latitude === null ? '(Set Location)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Mobile Filter Toggle */}
            <button
              type="button"
              className="btn-filters-drawer-toggle"
              onClick={() => setShowFiltersDrawer(!showFiltersDrawer)}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" y1="21" x2="4" y2="14"></line>
                <line x1="4" y1="10" x2="4" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12" y2="3"></line>
                <line x1="20" y1="21" x2="20" y2="16"></line>
                <line x1="20" y1="12" x2="20" y2="3"></line>
                <line x1="1" y1="14" x2="7" y2="14"></line>
                <line x1="9" y1="8" x2="15" y2="8"></line>
                <line x1="17" y1="16" x2="23" y2="16"></line>
              </svg>
              <span>Filters</span>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="auth-alert error-alert fade-in">
            <span>{error}</span>
          </div>
        )}

        {/* Main Content Layout (Sidebar + Results / Map) */}
        <div className="parts-content-layout">
          {/* Filter Sidebar */}
          <aside className={`parts-filter-sidebar ${showFiltersDrawer ? 'drawer-open' : ''}`}>
            <div className="sidebar-header-row">
              <h3>Filter Products</h3>
              {showFiltersDrawer && (
                <button
                  type="button"
                  className="btn-close-drawer"
                  onClick={() => setShowFiltersDrawer(false)}
                >
                  ✕
                </button>
              )}
            </div>

            {/* In-Stock Toggle */}
            <div className="filter-group">
              <label className="checkbox-toggle-label">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => {
                    setInStockOnly(e.target.checked);
                    setCurrentPage(1);
                  }}
                />
                <span className="toggle-custom"></span>
                <span className="toggle-text">In-Stock Only</span>
              </label>
            </div>

            {/* Part Category */}
            <div className="filter-group">
              <label className="filter-title">Part Category</label>
              <select
                className="filter-select-input"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setCurrentPage(1);
                }}
              >
                {CATEGORIES_LIST.map((c) => (
                  <option key={c} value={c}>
                    {c === 'ALL' ? 'All Categories' : c}
                  </option>
                ))}
              </select>
            </div>

            {/* Price Range */}
            <div className="filter-group">
              <label className="filter-title">Price Range (₹)</label>
              <div className="price-inputs-pair">
                <input
                  type="number"
                  placeholder="Min ₹"
                  className="price-filter-input"
                  min="0"
                  value={minPrice}
                  onChange={(e) => {
                    setMinPrice(e.target.value);
                    setCurrentPage(1);
                  }}
                />
                <span className="price-separator">-</span>
                <input
                  type="number"
                  placeholder="Max ₹"
                  className="price-filter-input"
                  min="0"
                  value={maxPrice}
                  onChange={(e) => {
                    setMaxPrice(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>

            {/* Manufacturer Brand */}
            {metadata?.manufacturers && metadata.manufacturers.length > 0 && (
              <div className="filter-group">
                <label className="filter-title">Brand / Manufacturer</label>
                <select
                  className="filter-select-input"
                  value={manufacturer}
                  onChange={(e) => {
                    setManufacturer(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="ALL">All Brands</option>
                  {metadata.manufacturers.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Condition Filter */}
            <div className="filter-group">
              <label className="filter-title">Condition</label>
              <select
                className="filter-select-input"
                value={condition}
                onChange={(e) => {
                  setCondition(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="ALL">All Conditions</option>
                <option value="NEW">Brand New</option>
                <option value="USED">Refurbished / Used</option>
              </select>
            </div>

            {/* Customer Rating Filter */}
            <div className="filter-group">
              <label className="filter-title">Customer Rating</label>
              <select
                className="filter-select-input"
                value={minRating}
                onChange={(e) => {
                  setMinRating(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="ALL">All Ratings</option>
                <option value="4">★ 4 Stars & Above</option>
                <option value="3">★ 3 Stars & Above</option>
                <option value="2">★ 2 Stars & Above</option>
              </select>
            </div>

            {/* Subcategory Filter */}
            <div className="filter-group">
              <label className="filter-title">Subcategory</label>
              <input
                type="text"
                className="filter-select-input"
                placeholder="e.g. Brake Pads, Filter..."
                value={subcategory}
                onChange={(e) => {
                  setSubcategory(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            {/* Barcode Filter */}
            <div className="filter-group">
              <label className="filter-title">Exact Barcode / Code</label>
              <input
                type="text"
                className="filter-select-input"
                placeholder="e.g. 8901234567890"
                value={barcode}
                onChange={(e) => {
                  setBarcode(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            {/* Reset Button */}
            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn-outline btn-block btn-reset-sidebar"
                onClick={handleResetFilters}
              >
                Clear All Filters
              </button>
            )}
          </aside>

          {/* Results Main Column */}
          <main className="parts-results-column">
            {/* View Mode: Map View */}
            {viewMode === 'map' && (
              <div className="map-view-container fade-in">
                <SearchResultsMapView
                  shops={shops}
                  userLocation={
                    latitude !== null && longitude !== null
                      ? { latitude, longitude, name: locationName }
                      : null
                  }
                  radiusKm={radiusKm}
                  height="500px"
                />
              </div>
            )}

            {/* Loading Indicator */}
            {loading ? (
              <div className="parts-loading-card">
                <div className="auth-spinner">
                  <svg viewBox="0 0 32 32" fill="none" className="spin-cog">
                    <circle cx="16" cy="16" r="10" stroke="var(--color-orange-primary)" strokeWidth="3" strokeDasharray="3 1.5"/>
                    <circle cx="16" cy="16" r="4" fill="var(--color-navy-primary)"/>
                  </svg>
                </div>
                <h3>Searching Nearby Spare Parts...</h3>
                <p>Querying verified local shops and authentic inventory.</p>
              </div>
            ) : parts.length === 0 ? (
              /* Empty State */
              <div className="parts-empty-state-card fade-in">
                <div className="empty-icon-wrap">
                  <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    <line x1="8" y1="11" x2="14" y2="11"></line>
                  </svg>
                </div>
                <h3>No matching spare parts found nearby</h3>
                <p>
                  No available parts in verified shops matched your current filters
                  {locationName ? ` within ${radiusKm} km of ${locationName}` : ''}.
                </p>
                <div className="empty-state-suggestions">
                  <ul>
                    <li>Try expanding your search radius (e.g. 50 km or 100 km)</li>
                    <li>Change or clear your vehicle selection</li>
                    <li>Try broader keywords like "Brake", "Filter", or "Oil"</li>
                    <li>Browse verified partner shops in your region directly</li>
                  </ul>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginTop: '16px' }}>
                  <button type="button" className="btn btn-primary" onClick={handleResetFilters}>
                    Clear All Filters
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setRadiusKm(50)}
                  >
                    Expand to 50 km Radius
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setShowVehicleSelector(true)}
                  >
                    Change Vehicle
                  </button>
                  <Link to="/shops" className="btn btn-outline">
                    Find Nearby Shops ↗
                  </Link>
                </div>
              </div>
            ) : (
              /* Products Grid View */
              <>
                <div className="parts-grid-display">
                  {parts.map((part) => (
                    <SearchResultCard
                      key={part._id}
                      part={part}
                      userLocation={latitude ? { latitude, longitude } : null}
                    />
                  ))}
                </div>

                {/* Pagination Controls */}
                {pagination.totalPages > 1 && (
                  <div className="parts-pagination-bar">
                    <button
                      type="button"
                      className="pagination-btn"
                      disabled={!pagination.hasPrev}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                      ← Previous
                    </button>

                    <div className="pagination-pages-info">
                      Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong>
                    </div>

                    <button
                      type="button"
                      className="pagination-btn"
                      disabled={!pagination.hasNext}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>

        {/* Barcode & QR Scanner Dialog */}
        <BarcodeScannerModal
          isOpen={showScannerModal}
          onClose={() => setShowScannerModal(false)}
          initialMode={scannerMode}
          onSelectPart={(part) => {
            setShowScannerModal(false);
            setQuery(part.partNumber || part.barcode || part.partName);
            setCurrentPage(1);
          }}
        />

        {/* Visual Image Search Dialog */}
        <ImageSearchModal
          isOpen={showImageSearchModal}
          onClose={() => setShowImageSearchModal(false)}
          onSelectPart={(part) => {
            setShowImageSearchModal(false);
            setQuery(part.partName);
            setCurrentPage(1);
          }}
        />
      </div>
    </div>
  );
};

export default PublicPartsPage;
