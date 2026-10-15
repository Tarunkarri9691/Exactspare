import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true, // Crucial for HttpOnly cookie session transmission
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Health Endpoints
 */
export const fetchApiHealth = async () => {
  try {
    const response = await apiClient.get('/health');
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Cannot reach API server'
    };
  }
};

export const fetchDatabaseHealth = async () => {
  try {
    const response = await apiClient.get('/health/db');
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    if (error.response && error.response.data) {
      return {
        success: false,
        data: error.response.data,
        error: error.response.data.message || 'Database unavailable'
      };
    }
    return {
      success: false,
      error: error.message || 'Cannot query database health'
    };
  }
};

/**
 * Authentication Endpoints
 */
export const registerUser = async (userData) => {
  try {
    const response = await apiClient.post('/auth/register', userData);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Registration failed',
      errors: error.response?.data?.errors || null,
      statusCode: error.response?.status
    };
  }
};

export const loginUser = async (credentials) => {
  try {
    const response = await apiClient.post('/auth/login', credentials);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Login failed. Please check your credentials.',
      statusCode: error.response?.status
    };
  }
};

export const logoutUser = async () => {
  try {
    const response = await apiClient.post('/auth/logout');
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Logout failed'
    };
  }
};

export const fetchCurrentUser = async () => {
  try {
    const response = await apiClient.get('/auth/me');
    return {
      success: true,
      data: response.data.user
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Unauthenticated',
      statusCode: error.response?.status
    };
  }
};

/**
 * Role-Protected Dashboard Endpoints
 */
export const fetchCustomerDashboardData = async () => {
  try {
    const response = await apiClient.get('/customer/dashboard-data');
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch customer data'
    };
  }
};

export const fetchOwnerDashboardData = async () => {
  try {
    const response = await apiClient.get('/owner/dashboard-data');
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch owner data'
    };
  }
};

export const fetchAdminDashboardData = async () => {
  try {
    const response = await apiClient.get('/admin/dashboard-data');
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch admin dashboard statistics'
    };
  }
};

export const fetchAdminUsersList = async () => {
  try {
    const response = await apiClient.get('/admin/users');
    return {
      success: true,
      data: response.data.users
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch users list'
    };
  }
};

/**
 * Module 3: Shop Owner Application Endpoints
 */
export const createShopApplication = async (formData) => {
  try {
    const response = await apiClient.post('/shop-applications', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to create shop application',
      errors: error.response?.data?.errors || null,
      applicationId: error.response?.data?.applicationId,
      currentStatus: error.response?.data?.currentStatus
    };
  }
};

export const fetchMyApplication = async () => {
  try {
    const response = await apiClient.get('/shop-applications/my');
    return {
      success: true,
      hasApplication: response.data.hasApplication,
      application: response.data.application
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch application'
    };
  }
};

export const fetchApplicationById = async (id) => {
  try {
    const response = await apiClient.get(`/shop-applications/${id}`);
    return {
      success: true,
      application: response.data.application
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch application details'
    };
  }
};

export const updateShopApplication = async (id, formData) => {
  try {
    const response = await apiClient.patch(`/shop-applications/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to update application',
      errors: error.response?.data?.errors || null
    };
  }
};

export const submitShopApplication = async (id) => {
  try {
    const response = await apiClient.post(`/shop-applications/${id}/submit`);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to submit application',
      errors: error.response?.data?.errors || null
    };
  }
};

/**
 * Module 3: Admin Review Endpoints
 */
export const fetchAdminApplications = async (params = {}) => {
  try {
    const response = await apiClient.get('/admin/shop-applications', { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch applications'
    };
  }
};

export const fetchAdminApplicationById = async (id) => {
  try {
    const response = await apiClient.get(`/admin/shop-applications/${id}`);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch application details'
    };
  }
};

export const decideAdminApplication = async (id, payload) => {
  try {
    const response = await apiClient.patch(`/admin/shop-applications/${id}/decision`, payload);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to submit review decision'
    };
  }
};

/**
 * Module 3: Public Shop Endpoints
 */
export const fetchPublicShops = async (params = {}) => {
  try {
    const response = await apiClient.get('/shops', { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch approved shops'
    };
  }
};

/**
 * Module 3: In-App Notifications
 */
export const fetchMyNotifications = async () => {
  try {
    const response = await apiClient.get('/notifications/my');
    return {
      success: true,
      notifications: response.data.notifications || [],
      unreadCount: response.data.unreadCount || 0
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch notifications'
    };
  }
};

export const markNotificationRead = async (id) => {
  try {
    const response = await apiClient.patch(`/notifications/${id}/read`);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to mark notification as read'
    };
  }
};

export const markAllNotificationsRead = async () => {
  try {
    const response = await apiClient.patch('/notifications/read-all');
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to mark notifications read'
    };
  }
};

/**
 * ========================================================
 * MODULE 4: SHOP MANAGEMENT & SPARE-PART INVENTORY
 * ========================================================
 */

/**
 * Fetch authenticated owner's approved shop
 */
export const fetchMyApprovedShop = async () => {
  try {
    const response = await apiClient.get('/shops/my');
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch shop details',
      statusCode: error.response?.status
    };
  }
};

/**
 * Update authenticated owner's shop information
 */
export const updateMyApprovedShop = async (shopData) => {
  try {
    const response = await apiClient.patch('/shops/my', shopData);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to update shop details',
      errors: error.response?.data?.errors
    };
  }
};

/**
 * Upload additional/replacement shop photographs
 */
export const uploadShopImagesApi = async (formData) => {
  try {
    const response = await apiClient.post('/shops/my/images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to upload shop photographs'
    };
  }
};

/**
 * Fetch owner's spare-part inventory with filters, search, and stats
 */
export const fetchMyInventory = async (params = {}) => {
  try {
    const response = await apiClient.get('/parts/my', { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch inventory'
    };
  }
};

/**
 * Create a new spare part listing (multipart/form-data)
 */
export const createPartApi = async (formData) => {
  try {
    const response = await apiClient.post('/parts', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to create spare part listing',
      errors: error.response?.data?.errors,
      statusCode: error.response?.status
    };
  }
};

/**
 * Fetch a single spare part by ID (public or owner)
 */
export const fetchPartByIdApi = async (id) => {
  try {
    const response = await apiClient.get(`/parts/${id}`);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch spare part details',
      statusCode: error.response?.status
    };
  }
};

/**
 * Update an existing spare part listing
 */
export const updatePartApi = async (id, formData) => {
  try {
    // If formData is an instance of FormData, send multipart header
    const isFormData = typeof FormData !== 'undefined' && formData instanceof FormData;
    const config = isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};

    const response = await apiClient.patch(`/parts/${id}`, formData, config);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to update spare part listing',
      errors: error.response?.data?.errors
    };
  }
};

/**
 * Safely delete / archive a spare part listing
 */
export const deletePartApi = async (id) => {
  try {
    const response = await apiClient.delete(`/parts/${id}`);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to delete spare part listing'
    };
  }
};

/**
 * Upload additional images for an existing spare part
 */
export const uploadPartImagesApi = async (id, formData) => {
  try {
    const response = await apiClient.post(`/parts/${id}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to upload product images'
    };
  }
};

/**
 * Delete a single image from a spare part listing
 */
export const deletePartImageApi = async (id, imageFilename) => {
  try {
    const response = await apiClient.delete(`/parts/${id}/images/${imageFilename}`);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to remove image'
    };
  }
};


/**
 * Fetch single verified public shop by ID
 */
export const fetchPublicShopById = async (id) => {
  try {
    const response = await apiClient.get(`/shops/${id}`);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch shop details'
    };
  }
};

/**
 * Fetch public published spare parts marketplace catalogue
 */
export const fetchPublicParts = async (params = {}) => {
  try {
    const response = await apiClient.get('/parts', { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch spare parts catalogue'
    };
  }
};

/**
 * =========================================================
 * MODULE 5: LOCATION-BASED SPARE-PART SEARCH APIS
 * =========================================================
 */

/**
 * Search nearby spare parts with geospatial radius and multi-criteria filters
 * @param {Object} params - Query parameters (q, partNumber, vehicleType, make, model, year, category, latitude, longitude, radiusKm, minPrice, maxPrice, inStock, sortBy, page, limit)
 */
export const searchNearbyParts = async (params = {}) => {
  try {
    const response = await apiClient.get('/search/nearby-parts', { params });
    return {
      success: true,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to search nearby spare parts'
    };
  }
};

/**
 * Fetch dynamic search metadata from real database records (categories with counts, vehicle types, makes, models)
 */
export const fetchSearchMetadata = async () => {
  try {
    const response = await apiClient.get('/search/meta');
    return {
      success: true,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch search metadata'
    };
  }
};

/**
 * Fetch recently added available spare parts from real database records
 */
export const fetchRecentAvailableParts = async (limit = 8) => {
  try {
    const response = await apiClient.get('/search/recent-parts', { params: { limit } });
    return {
      success: true,
      data: response.data?.data || []
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch recently added parts'
    };
  }
};

/**
 * Resolve an address, city, or postal code to geographical coordinates using OpenStreetMap geocoder
 */
export const geocodeAddress = async (query) => {
  try {
    const response = await apiClient.get('/search/geocode', { params: { q: query } });
    return {
      success: true,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Could not resolve coordinates for this location'
    };
  }
};

export default apiClient;

