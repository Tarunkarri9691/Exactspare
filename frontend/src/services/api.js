import axios from 'axios';

// Reads VITE_API_BASE_URL (standard) or VITE_API_URL with safe local development fallback
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000/api';

export const BACKEND_URL = API_BASE_URL.replace(/\/api\/?$/, '');

/**
 * Universal image URL resolver for uploaded parts and shop photos
 */
export const getImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${BACKEND_URL}/${path.replace(/^\/+/, '')}`;
};

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
    const errorMsg =
      error.response?.data?.message ||
      (!error.response ? 'Cannot connect to backend server. Please verify the backend is running.' : 'Registration failed');
    return {
      success: false,
      error: errorMsg,
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
    const errorMsg =
      error.response?.data?.message ||
      (!error.response ? 'Cannot connect to backend server. Please verify the backend is running on port 5000.' : 'Login failed. Please check your credentials.');
    return {
      success: false,
      error: errorMsg,
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

export const upgradeToOwnerApi = async () => {
  try {
    const response = await apiClient.post('/users/upgrade-to-owner');
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to switch to shop owner role.',
      statusCode: error.response?.status
    };
  }
};

/**
 * Module 14: Password Reset & Email Verification Services
 */
export const forgotPassword = async (email) => {
  try {
    const response = await apiClient.post('/auth/forgot-password', { email });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to submit password reset request. Please try again.',
      errors: error.response?.data?.errors,
      statusCode: error.response?.status
    };
  }
};

export const resetPassword = async ({ token, password, confirmPassword }) => {
  try {
    const response = await apiClient.post('/auth/reset-password', {
      token,
      password,
      confirmPassword
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to reset password. The link may have expired.',
      errors: error.response?.data?.errors,
      statusCode: error.response?.status
    };
  }
};

export const changePassword = async ({ currentPassword, newPassword, confirmPassword }) => {
  try {
    const response = await apiClient.post('/auth/change-password', {
      currentPassword,
      newPassword,
      confirmPassword
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to update password.',
      errors: error.response?.data?.errors,
      statusCode: error.response?.status
    };
  }
};

export const verifyEmail = async (token) => {
  try {
    const response = await apiClient.post('/auth/verify-email', { token });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Email verification link is invalid or expired.',
      statusCode: error.response?.status
    };
  }
};

export const resendEmailVerification = async (email) => {
  try {
    const response = await apiClient.post('/auth/resend-verification', email ? { email } : {});
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to resend verification link.',
      statusCode: error.response?.status
    };
  }
};

/**
 * User Profile & Preferences Endpoints
 */
export const fetchUserProfile = async () => {
  try {
    const response = await apiClient.get('/users/profile');
    return {
      success: true,
      data: response.data?.profile || response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch user profile'
    };
  }
};

export const updateUserProfile = async (profileData) => {
  try {
    const response = await apiClient.patch('/users/profile', profileData);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to update user profile'
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
 * Payment Scanner & Direct Portal Activation
 */
export const fetchPaymentScannerConfig = async () => {
  try {
    const response = await apiClient.get('/shop-applications/scanner-config');
    return {
      success: true,
      config: response.data.config
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch payment scanner configuration'
    };
  }
};

export const payAndActivateShop = async (payload = {}) => {
  try {
    const response = await apiClient.post('/shop-applications/pay-and-activate', payload);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to confirm scanner payment and activate portal',
      statusCode: error.response?.status
    };
  }
};

export const fetchAdminScannerConfig = async () => {
  try {
    const response = await apiClient.get('/admin/shop-applications/scanner/config');
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch admin scanner details'
    };
  }
};

export const updateAdminScannerConfig = async (configData) => {
  try {
    const response = await apiClient.put('/admin/shop-applications/scanner/config', configData);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to update admin scanner configuration'
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

export const verifyAdminApplicationPayment = async (id) => {
  try {
    const response = await apiClient.patch(`/admin/shop-applications/${id}/verify-payment`);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to verify payment reference'
    };
  }
};

export const rejectAdminApplicationPayment = async (id, reason) => {
  try {
    const response = await apiClient.patch(`/admin/shop-applications/${id}/reject-payment`, { reason });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to reject payment reference'
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
 * Delete a specific storefront photograph
 */
export const deleteShopImageApi = async (imagePath) => {
  try {
    const response = await apiClient.delete('/shops/my/images', {
      data: { imagePath }
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to delete shop photograph'
    };
  }
};

/**
 * Update authenticated owner's shop location & GPS coordinates
 */
export const updateMyShopLocationApi = async (locationData) => {
  try {
    const response = await apiClient.patch('/shops/my/location', locationData);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to update shop location',
      errors: error.response?.data?.errors,
      statusCode: error.response?.status
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
 * Auto-fill spare part details from an uploaded photograph
 */
export const autoFillPartFromImageApi = async (file) => {
  try {
    const formData = new FormData();
    formData.append('partPhoto', file);

    const response = await apiClient.post('/parts/auto-fill-from-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return {
      success: true,
      data: response.data?.data,
      message: response.data?.message
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to auto-fill part details from photo',
      statusCode: error.response?.status
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

/**
 * Fetch real driving route between customer origin and shop destination
 * Integrates backend OSRM proxy with direct fallback and caching
 */
export const fetchDirectionsRoute = async ({ originLat, originLng, destLat, destLng }) => {
  try {
    // 1. Try backend proxy first
    const response = await apiClient.get('/search/route', {
      params: { originLat, originLng, destLat, destLng },
      timeout: 10000
    });
    if (response.data?.success && response.data?.data) {
      return {
        success: true,
        data: response.data.data
      };
    }
  } catch (backendErr) {
    // 2. Direct fallback to public OSRM router
    try {
      const osrmBase = 'https://router.project-osrm.org';
      const fallbackUrl = `${osrmBase}/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true`;
      const fallbackRes = await axios.get(fallbackUrl, { timeout: 8000 });
      if (fallbackRes.data?.code === 'Ok' && Array.isArray(fallbackRes.data.routes) && fallbackRes.data.routes.length > 0) {
        const route = fallbackRes.data.routes[0];
        const distanceMeters = route.distance;
        const durationSeconds = route.duration;
        return {
          success: true,
          data: {
            provider: 'OSRM (Open Source Routing Machine)',
            distanceKm: Math.round((distanceMeters / 1000) * 10) / 10,
            distanceMeters: Math.round(distanceMeters),
            durationMinutes: Math.round(durationSeconds / 60),
            durationSeconds: Math.round(durationSeconds),
            geometry: route.geometry,
            waypoints: fallbackRes.data.waypoints || [],
            steps: route.legs?.[0]?.steps?.map(step => ({
              name: step.name || 'Road',
              distanceMeters: Math.round(step.distance),
              durationSeconds: Math.round(step.duration),
              instruction: step.maneuver?.type || 'turn'
            })) || []
          }
        };
      }
    } catch {
      // fallback failed
    }

    return {
      success: false,
      error: backendErr.response?.data?.message || 'Unable to calculate road route between origin and shop.'
    };
  }
};

/**
 * ========================================================
 * MODULE 6 — CART & ORDER API SERVICES
 * ========================================================
 */

/**
 * Fetch authenticated customer's shopping cart
 */
export const fetchCart = async () => {
  try {
    const response = await apiClient.get('/cart');
    return {
      success: true,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch cart'
    };
  }
};

/**
 * Add an item to shopping cart
 */
export const addToCart = async (productId, quantity = 1) => {
  try {
    const response = await apiClient.post('/cart/items', { productId, quantity });
    return {
      success: true,
      message: response.data?.message || 'Item added to cart',
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to add item to cart',
      statusCode: error.response?.status
    };
  }
};

/**
 * Update quantity of a cart item
 */
export const updateCartItemQty = async (productId, quantity) => {
  try {
    const response = await apiClient.patch(`/cart/items/${productId}`, { quantity });
    return {
      success: true,
      message: response.data?.message,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to update quantity',
      statusCode: error.response?.status
    };
  }
};

/**
 * Remove an item from cart
 */
export const removeFromCart = async (productId) => {
  try {
    const response = await apiClient.delete(`/cart/items/${productId}`);
    return {
      success: true,
      message: response.data?.message,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to remove item'
    };
  }
};

/**
 * Clear all items from cart
 */
export const clearCart = async () => {
  try {
    const response = await apiClient.delete('/cart');
    return {
      success: true,
      message: response.data?.message,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to clear cart'
    };
  }
};

/**
 * Place a new order from cart
 */
export const placeOrder = async (orderPayload) => {
  try {
    const response = await apiClient.post('/orders', orderPayload);
    return {
      success: true,
      message: response.data?.message || 'Order placed successfully',
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to place order',
      errors: error.response?.data?.errors,
      statusCode: error.response?.status
    };
  }
};

/**
 * Fetch customer orders list
 */
export const fetchMyOrders = async (params = {}) => {
  try {
    const response = await apiClient.get('/orders/my', { params });
    return {
      success: true,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to retrieve orders'
    };
  }
};

/**
 * Fetch customer order details by ID
 */
export const fetchOrderDetails = async (orderId) => {
  try {
    const response = await apiClient.get(`/orders/${orderId}`);
    return {
      success: true,
      data: response.data?.data?.order
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to retrieve order details',
      statusCode: error.response?.status
    };
  }
};

/**
 * Customer cancel eligible order
 */
export const cancelCustomerOrder = async (orderId, reason = '') => {
  try {
    const response = await apiClient.post(`/orders/${orderId}/cancel`, { reason });
    return {
      success: true,
      message: response.data?.message,
      data: response.data?.data?.order
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to cancel order',
      statusCode: error.response?.status
    };
  }
};

/**
 * MODULE 13: Live Order-Status Tracking Endpoint
 * Fetches order milestone progression, timestamps, shop fulfillments, and shipping status
 */
export const fetchOrderTracking = async (orderId) => {
  try {
    const response = await apiClient.get(`/orders/${orderId}/tracking`);
    return {
      success: true,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to retrieve order tracking information',
      statusCode: error.response?.status
    };
  }
};

/**
 * Shop Owner: Fetch orders containing owner's shop items
 */
export const fetchOwnerOrders = async (params = {}) => {
  try {
    const response = await apiClient.get('/owner/orders', { params });
    return {
      success: true,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to retrieve shop orders'
    };
  }
};

/**
 * Shop Owner: Fetch detailed view of an order
 */
export const fetchOwnerOrderDetails = async (orderId) => {
  try {
    const response = await apiClient.get(`/owner/orders/${orderId}`);
    return {
      success: true,
      data: response.data?.data?.order
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to retrieve order details'
    };
  }
};

/**
 * Shop Owner: Update order fulfillment status
 */
export const updateOwnerOrderStatus = async (orderId, status, note = '') => {
  try {
    const response = await apiClient.patch(`/owner/orders/${orderId}/status`, { status, note });
    return {
      success: true,
      message: response.data?.message,
      data: response.data?.data?.order
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to update order status',
      statusCode: error.response?.status
    };
  }
};

/**
 * ========================================================
 * MODULE 7: NOTIFICATIONS, WISHLIST, REVIEWS & RATINGS
 * ========================================================
 */

/**
 * Notifications APIs
 */
export const fetchNotifications = async (params = {}) => {
  try {
    const response = await apiClient.get('/notifications', { params });
    return {
      success: true,
      data: response.data?.data?.notifications || [],
      unreadCount: response.data?.unreadCount || 0,
      pagination: response.data?.data?.pagination || { page: 1, pages: 1, total: 0 }
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch notifications'
    };
  }
};

export const fetchUnreadNotificationCount = async () => {
  try {
    const response = await apiClient.get('/notifications/unread-count');
    return {
      success: true,
      unreadCount: response.data?.data?.unreadCount ?? 0
    };
  } catch (error) {
    return {
      success: false,
      unreadCount: 0,
      error: error.response?.data?.message || 'Failed to get unread count'
    };
  }
};

export const markNotificationAsRead = async (notificationId) => {
  try {
    const response = await apiClient.patch(`/notifications/${notificationId}/read`);
    return {
      success: true,
      message: response.data?.message,
      data: response.data?.data?.notification
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to mark notification as read'
    };
  }
};

export const markAllNotificationsAsRead = async () => {
  try {
    const response = await apiClient.patch('/notifications/read-all');
    return {
      success: true,
      message: response.data?.message,
      modifiedCount: response.data?.data?.modifiedCount
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to mark all as read'
    };
  }
};

export const deleteNotificationApi = async (notificationId) => {
  try {
    const response = await apiClient.delete(`/notifications/${notificationId}`);
    return {
      success: true,
      message: response.data?.message
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to delete notification'
    };
  }
};

/**
 * Customer Wishlist APIs
 */
export const fetchWishlist = async () => {
  try {
    const response = await apiClient.get('/wishlist');
    return {
      success: true,
      data: response.data?.data?.items || [],
      count: response.data?.count || 0,
      unavailableItemsCount: response.data?.data?.unavailableItemsCount || 0
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch wishlist'
    };
  }
};

export const addToWishlistApi = async (productId) => {
  try {
    const response = await apiClient.post('/wishlist/items', { productId });
    return {
      success: true,
      message: response.data?.message,
      count: response.data?.data?.count || 0
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to add item to wishlist'
    };
  }
};

export const removeFromWishlistApi = async (productId) => {
  try {
    const response = await apiClient.delete(`/wishlist/items/${productId}`);
    return {
      success: true,
      message: response.data?.message,
      count: response.data?.data?.count || 0
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to remove item from wishlist'
    };
  }
};

export const moveWishlistToCartApi = async (productId, quantity = 1) => {
  try {
    const response = await apiClient.post(`/wishlist/items/${productId}/move-to-cart`, { quantity });
    return {
      success: true,
      message: response.data?.message,
      cart: response.data?.data?.cart,
      wishlistCount: response.data?.data?.wishlistCount
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to move item to cart'
    };
  }
};

/**
 * Product Reviews & Ratings APIs
 */
export const fetchProductReviews = async (productId, params = {}) => {
  try {
    const response = await apiClient.get(`/products/${productId}/reviews`, { params });
    return {
      success: true,
      reviews: response.data?.data?.reviews || [],
      summary: response.data?.data?.summary || {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        verifiedCount: 0
      },
      pagination: response.data?.data?.pagination || { page: 1, pages: 1, total: 0 }
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to load product reviews',
      reviews: [],
      summary: {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        verifiedCount: 0
      }
    };
  }
};

export const submitProductReview = async (productId, reviewData) => {
  try {
    const response = await apiClient.post(`/products/${productId}/reviews`, reviewData);
    return {
      success: true,
      message: response.data?.message,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to submit review'
    };
  }
};

export const updateProductReview = async (reviewId, updateData) => {
  try {
    const response = await apiClient.patch(`/reviews/${reviewId}`, updateData);
    return {
      success: true,
      message: response.data?.message,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to update review'
    };
  }
};

export const deleteProductReview = async (reviewId) => {
  try {
    const response = await apiClient.delete(`/reviews/${reviewId}`);
    return {
      success: true,
      message: response.data?.message,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to delete review'
    };
  }
};

/**
 * ========================================================
 * MODULE 8: ADMIN ANALYTICS, REPORTS & PLATFORM MANAGEMENT
 * ========================================================
 */

/**
 * Admin Analytics Endpoints
 */
export const fetchAdminAnalyticsOverview = async (params = {}) => {
  try {
    const response = await apiClient.get('/admin/analytics/overview', { params });
    return {
      success: true,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch analytics overview'
    };
  }
};

export const fetchAdminSalesAnalytics = async (params = {}) => {
  try {
    const response = await apiClient.get('/admin/analytics/sales', { params });
    return {
      success: true,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch sales analytics'
    };
  }
};

export const fetchAdminOrderAnalytics = async (params = {}) => {
  try {
    const response = await apiClient.get('/admin/analytics/orders', { params });
    return {
      success: true,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch order analytics'
    };
  }
};

export const fetchAdminProductAnalytics = async (params = {}) => {
  try {
    const response = await apiClient.get('/admin/analytics/products', { params });
    return {
      success: true,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch product analytics'
    };
  }
};

export const fetchAdminShopAnalytics = async (params = {}) => {
  try {
    const response = await apiClient.get('/admin/analytics/shops', { params });
    return {
      success: true,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch shop analytics'
    };
  }
};

export const fetchAdminInventoryAnalytics = async (params = {}) => {
  try {
    const response = await apiClient.get('/admin/analytics/inventory', { params });
    return {
      success: true,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch inventory analytics'
    };
  }
};

export const fetchAdminCustomerAnalytics = async (params = {}) => {
  try {
    const response = await apiClient.get('/admin/analytics/customers', { params });
    return {
      success: true,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch customer analytics'
    };
  }
};

/**
 * Downloads a CSV report file directly from backend report endpoints
 * @param {'orders'|'inventory'|'shops'|'customers'} reportType
 * @param {Object} params - Query params such as from, to, preset
 */
export const downloadAdminReportCsv = async (reportType, params = {}) => {
  try {
    const response = await apiClient.get(`/admin/reports/${reportType}.csv`, {
      params,
      responseType: 'blob'
    });

    const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    // Extract filename from Content-Disposition header if available
    const disposition = response.headers['content-disposition'];
    let filename = `exactspare-${reportType}-report-${Date.now()}.csv`;
    if (disposition) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    return { success: true, filename };
  } catch (error) {
    let errMsg = 'Failed to download CSV report';
    if (error.response?.data instanceof Blob) {
      try {
        const text = await error.response.data.text();
        const json = JSON.parse(text);
        if (json.message) errMsg = json.message;
      } catch {
        // fallback
      }
    } else if (error.response?.data?.message) {
      errMsg = error.response.data.message;
    }
    return { success: false, error: errMsg };
  }
};

/**
 * Admin Shop Management Endpoints
 */
export const fetchAdminShops = async (params = {}) => {
  try {
    const response = await apiClient.get('/admin/shops', { params });
    return {
      success: true,
      data: response.data?.data?.shops || [],
      pagination: response.data?.data?.pagination || { page: 1, pages: 1, total: 0 }
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to load shops'
    };
  }
};

export const fetchAdminShopDetails = async (shopId) => {
  try {
    const response = await apiClient.get(`/admin/shops/${shopId}`);
    return {
      success: true,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to load shop details'
    };
  }
};

export const updateAdminShopStatus = async (shopId, isActive, reason = '') => {
  try {
    const response = await apiClient.patch(`/admin/shops/${shopId}/status`, { isActive, reason });
    return {
      success: true,
      message: response.data?.message,
      data: response.data?.data?.shop
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to update shop status'
    };
  }
};

export const fetchAdminShopParts = async (shopId, params = {}) => {
  try {
    const response = await apiClient.get(`/admin/shops/${shopId}/parts`, { params });
    return {
      success: true,
      data: response.data?.data?.parts || [],
      pagination: response.data?.data?.pagination || { page: 1, pages: 1, total: 0 }
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch shop inventory'
    };
  }
};

/**
 * Admin User Management Endpoints
 */
export const fetchAdminUsers = async (params = {}) => {
  try {
    const response = await apiClient.get('/admin/users', { params });
    return {
      success: true,
      data: response.data?.data?.users || response.data?.users || [],
      pagination: response.data?.data?.pagination || { page: 1, pages: 1, total: 0 }
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to load users'
    };
  }
};

export const fetchAdminUserDetails = async (userId) => {
  try {
    const response = await apiClient.get(`/admin/users/${userId}`);
    return {
      success: true,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to load user details'
    };
  }
};

export const updateAdminUserStatus = async (userId, accountStatus, reason = '') => {
  try {
    const response = await apiClient.patch(`/admin/users/${userId}/status`, { accountStatus, reason });
    return {
      success: true,
      message: response.data?.message,
      data: response.data?.data?.user
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to update user status'
    };
  }
};

/**
 * Admin Spare Part Moderation Endpoints
 */
export const fetchAdminParts = async (params = {}) => {
  try {
    const response = await apiClient.get('/admin/parts', { params });
    return {
      success: true,
      data: response.data?.data?.parts || [],
      pagination: response.data?.data?.pagination || { page: 1, pages: 1, total: 0 }
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to load spare parts'
    };
  }
};

export const moderateAdminPart = async (partId, isPublished, reason = '') => {
  try {
    const response = await apiClient.patch(`/admin/parts/${partId}/moderate`, { isPublished, reason });
    return {
      success: true,
      message: response.data?.message,
      data: response.data?.data?.part
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to moderate spare part'
    };
  }
};

/**
 * Admin Review Moderation Endpoints
 */
export const fetchAdminReviews = async (params = {}) => {
  try {
    const response = await apiClient.get('/admin/reviews', { params });
    return {
      success: true,
      data: response.data?.data?.reviews || [],
      pagination: response.data?.data?.pagination || { page: 1, pages: 1, total: 0 }
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to load reviews'
    };
  }
};

export const moderateAdminReview = async (reviewId, moderationStatus, reason = '') => {
  try {
    const response = await apiClient.patch(`/admin/reviews/${reviewId}/moderate`, { moderationStatus, reason });
    return {
      success: true,
      message: response.data?.message,
      data: response.data?.data?.review
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to moderate review'
    };
  }
};

/**
 * Admin Audit Logs Endpoint
 */
export const fetchAdminAuditLogs = async (params = {}) => {
  try {
    const response = await apiClient.get('/admin/audit-logs', { params });
    return {
      success: true,
      data: response.data?.data?.logs || [],
      pagination: response.data?.data?.pagination || { page: 1, pages: 1, total: 0 }
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch audit logs'
    };
  }
};

/**
 * Module 10: AI Assistant, Smart Recommendations & Product Comparison
 */

export const fetchAiAssistantResponse = async ({ message, history = [], context = {} }) => {
  try {
    const response = await apiClient.post('/ai/assistant', { message, history, context });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Assistant service is temporarily unavailable.'
    };
  }
};

export const fetchAiStatus = async () => {
  try {
    const response = await apiClient.get('/ai/status');
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to check AI status'
    };
  }
};

export const fetchRecommendations = async (params = {}) => {
  try {
    const response = await apiClient.get('/recommendations', { params });
    return {
      success: true,
      recommendations: response.data?.recommendations || []
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch recommendations',
      recommendations: []
    };
  }
};

export const compareProducts = async (productIds = []) => {
  try {
    const response = await apiClient.post('/products/compare', { productIds });
    return {
      success: true,
      products: response.data?.products || [],
      metrics: response.data?.metrics || {}
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to compare products',
      products: []
    };
  }
};

/**
 * Module 11: Advanced Search, Barcode/QR Scanning & Image Search APIs
 */

export const fetchSearchSuggestions = async (query = '') => {
  if (!query || !query.trim()) return { success: true, data: { suggestions: [] } };
  try {
    const response = await apiClient.get('/search/suggestions', { params: { q: query.trim() } });
    return {
      success: true,
      data: response.data?.data || { suggestions: [] }
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch suggestions',
      data: { suggestions: [] }
    };
  }
};

export const searchByIdentifier = async (code = '') => {
  try {
    const response = await apiClient.get('/search/identifier', { params: { code } });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to search by identifier'
    };
  }
};

export const fetchPartByBarcode = async (barcode = '') => {
  try {
    const response = await apiClient.get(`/products/barcode/${encodeURIComponent(barcode)}`);
    return {
      success: true,
      data: response.data?.part || null
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'No spare part found matching barcode'
    };
  }
};

export const searchByImage = async (formData) => {
  try {
    const response = await apiClient.post('/search/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to process image search'
    };
  }
};

/**
 * ========================================================
 * MODULE 13 — CUSTOMER SUPPORT & ADMIN DASHBOARD APIS
 * ========================================================
 */

/**
 * Customer: Create a new support ticket
 */
export const createSupportTicket = async (ticketData) => {
  try {
    const response = await apiClient.post('/support/tickets', ticketData);
    return {
      success: true,
      message: response.data?.message || 'Support ticket created',
      data: response.data?.data?.ticket
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to submit support ticket',
      errors: error.response?.data?.errors,
      statusCode: error.response?.status
    };
  }
};

/**
 * Customer: Fetch list of customer's own support tickets
 */
export const fetchMySupportTickets = async (params = {}) => {
  try {
    const response = await apiClient.get('/support/tickets/my', { params });
    return {
      success: true,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to load support tickets',
      statusCode: error.response?.status
    };
  }
};

/**
 * Customer / Admin: Fetch specific ticket details & conversation thread
 */
export const fetchSupportTicketDetails = async (ticketId) => {
  try {
    const response = await apiClient.get(`/support/tickets/${ticketId}`);
    return {
      success: true,
      data: response.data?.data?.ticket
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to load ticket details',
      statusCode: error.response?.status
    };
  }
};

/**
 * Customer: Post a reply to an existing open ticket
 */
export const replySupportTicket = async (ticketId, message) => {
  try {
    const response = await apiClient.post(`/support/tickets/${ticketId}/messages`, { message });
    return {
      success: true,
      message: response.data?.message || 'Reply posted successfully',
      data: response.data?.data?.ticket
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to post reply',
      statusCode: error.response?.status
    };
  }
};

/**
 * Admin: Fetch all tickets with filters, pagination, and status counts
 */
export const fetchAdminSupportTickets = async (params = {}) => {
  try {
    const response = await apiClient.get('/admin/support/tickets', { params });
    return {
      success: true,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to retrieve admin tickets',
      statusCode: error.response?.status
    };
  }
};

/**
 * Admin: Update ticket status
 */
export const updateAdminSupportTicketStatus = async (ticketId, status, note = '') => {
  try {
    const response = await apiClient.patch(`/admin/support/tickets/${ticketId}/status`, { status, note });
    return {
      success: true,
      message: response.data?.message || 'Ticket status updated',
      data: response.data?.data?.ticket
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to update ticket status',
      statusCode: error.response?.status
    };
  }
};

/**
 * Admin: Post an administrative reply to a ticket
 */
export const replyAdminSupportTicket = async (ticketId, message, updateStatus = null) => {
  try {
    const response = await apiClient.post(`/admin/support/tickets/${ticketId}/messages`, { message, updateStatus });
    return {
      success: true,
      message: response.data?.message || 'Admin reply sent successfully',
      data: response.data?.data?.ticket
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to send admin reply',
      statusCode: error.response?.status
    };
  }
};

/**
 * Admin: Assign a support ticket to an administrator
 */
export const assignAdminSupportTicket = async (ticketId, assignedTo) => {
  try {
    const response = await apiClient.patch(`/admin/support/tickets/${ticketId}/assign`, { assignedTo });
    return {
      success: true,
      message: response.data?.message || 'Ticket assignment updated',
      data: response.data?.data?.ticket
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to assign ticket',
      statusCode: error.response?.status
    };
  }
};

/**
 * ========================================================
 * MODULE 17: AI FRAUD DETECTION & MARKETPLACE TRUST APIS
 * ========================================================
 */

/**
 * Customer: Submit product report
 */
export const submitProductReportApi = async (productId, data) => {
  try {
    const response = await apiClient.post(`/reports/products/${productId}`, data);
    return {
      success: true,
      message: response.data?.message,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to submit product report',
      statusCode: error.response?.status
    };
  }
};

/**
 * Customer: Submit shop report
 */
export const submitShopReportApi = async (shopId, data) => {
  try {
    const response = await apiClient.post(`/reports/shops/${shopId}`, data);
    return {
      success: true,
      message: response.data?.message,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to submit shop report',
      statusCode: error.response?.status
    };
  }
};

/**
 * Customer: Get user's own reports
 */
export const fetchMyReportsApi = async () => {
  try {
    const response = await apiClient.get('/reports/my-reports');
    return {
      success: true,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch customer reports'
    };
  }
};

/**
 * Admin: Get Trust Dashboard Summary
 */
export const fetchTrustSummaryApi = async () => {
  try {
    const response = await apiClient.get('/admin/trust/summary');
    return {
      success: true,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch trust summary'
    };
  }
};

/**
 * Admin: List trust cases
 */
export const fetchTrustCasesApi = async (params = {}) => {
  try {
    const response = await apiClient.get('/admin/trust/cases', { params });
    return {
      success: true,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch trust cases'
    };
  }
};

/**
 * Admin: Get single trust case details
 */
export const fetchTrustCaseDetailsApi = async (caseId) => {
  try {
    const response = await apiClient.get(`/admin/trust/cases/${caseId}`);
    return {
      success: true,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch case details'
    };
  }
};

/**
 * Admin: Update trust case workflow status
 */
export const updateTrustCaseStatusApi = async (caseId, payload) => {
  try {
    const response = await apiClient.patch(`/admin/trust/cases/${caseId}/status`, payload);
    return {
      success: true,
      message: response.data?.message,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to update case status'
    };
  }
};

/**
 * Admin: Execute confirmed administrative action
 */
export const executeTrustActionApi = async (caseId, payload) => {
  try {
    const response = await apiClient.post(`/admin/trust/cases/${caseId}/actions`, payload);
    return {
      success: true,
      message: response.data?.message,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to execute administrative action'
    };
  }
};

/**
 * Admin: Generate or refresh AI advisory briefing
 */
export const generateAiAdvisoryApi = async (caseId) => {
  try {
    const response = await apiClient.post(`/admin/trust/cases/${caseId}/generate-ai-advisory`);
    return {
      success: true,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to generate advisory'
    };
  }
};

/**
 * Admin: Trigger platform-wide trust scan
 */
export const runTrustScanApi = async () => {
  try {
    const response = await apiClient.post('/admin/trust/scan');
    return {
      success: true,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to run platform trust scan'
    };
  }
};

/**
 * ========================================================
 * MODULE 6: CUSTOMER ENQUIRIES & OWNER COMMUNICATION
 * ========================================================
 */

/**
 * Submit a customer enquiry for a shop and optional spare part
 */
export const createEnquiryApi = async (payload) => {
  try {
    const response = await apiClient.post('/enquiries', payload);
    return {
      success: true,
      message: response.data?.message || 'Enquiry submitted successfully',
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to submit enquiry',
      errors: error.response?.data?.errors,
      statusCode: error.response?.status
    };
  }
};

/**
 * Fetch enquiries submitted to the authenticated owner's shop
 */
export const fetchOwnerEnquiries = async (params = {}) => {
  try {
    const response = await apiClient.get('/enquiries/owner', { params });
    return {
      success: true,
      data: response.data?.data || [],
      pagination: response.data?.pagination,
      stats: response.data?.stats
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch shop enquiries',
      statusCode: error.response?.status
    };
  }
};

/**
 * Fetch enquiries submitted by the authenticated customer
 */
export const fetchCustomerEnquiries = async (params = {}) => {
  try {
    const response = await apiClient.get('/enquiries/my', { params });
    return {
      success: true,
      data: response.data?.data || [],
      pagination: response.data?.pagination
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch your enquiries',
      statusCode: error.response?.status
    };
  }
};

/**
 * Fetch a single enquiry by ID
 */
export const fetchEnquiryById = async (id) => {
  try {
    const response = await apiClient.get(`/enquiries/${id}`);
    return {
      success: true,
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch enquiry details',
      statusCode: error.response?.status
    };
  }
};

/**
 * Update the status of an enquiry (Owner only)
 */
export const updateEnquiryStatusApi = async (id, status) => {
  try {
    const response = await apiClient.patch(`/enquiries/${id}/status`, { status });
    return {
      success: true,
      message: response.data?.message || 'Status updated successfully',
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to update enquiry status',
      statusCode: error.response?.status
    };
  }
};

/**
 * Post a reply to an enquiry thread (Owner or Customer)
 */
export const replyToEnquiryApi = async (id, message) => {
  try {
    const response = await apiClient.post(`/enquiries/${id}/reply`, { message });
    return {
      success: true,
      message: response.data?.message || 'Reply sent successfully',
      data: response.data?.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to send reply',
      statusCode: error.response?.status
    };
  }
};

/**
 * ============================================================================
 * SHOP OWNER SUBSCRIPTION & UPI PAYMENT INTEGRATION
 * ============================================================================
 */

export const fetchSubscriptionConfig = async () => {
  try {
    const response = await apiClient.get('/subscriptions/config');
    return {
      success: true,
      config: response.data?.config
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch subscription configuration'
    };
  }
};

export const fetchMySubscription = async () => {
  try {
    const response = await apiClient.get('/subscriptions/my');
    return {
      success: true,
      overallStatus: response.data?.overallStatus || 'NOT_SUBSCRIBED',
      currentSubscription: response.data?.currentSubscription || null,
      expiryStageInfo: response.data?.expiryStageInfo || null,
      daysRemaining: response.data?.daysRemaining ?? null,
      history: response.data?.history || [],
      config: response.data?.config || null
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch subscription status'
    };
  }
};

export const submitSubscriptionPayment = async (payload) => {
  try {
    const response = await apiClient.post('/subscriptions/submit', payload);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to submit subscription payment reference',
      statusCode: error.response?.status
    };
  }
};

export const fetchAdminSubscriptions = async (params = {}) => {
  try {
    const response = await apiClient.get('/subscriptions/admin', { params });
    return {
      success: true,
      subscriptions: response.data?.subscriptions || [],
      pagination: response.data?.pagination || { total: 0, page: 1, limit: 15, pages: 1 },
      stats: response.data?.stats || { totalAll: 0, pending: 0, active: 0, expiringSoon: 0, expired: 0, rejected: 0 }
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch subscription payments'
    };
  }
};

export const runAdminManualExpiryCheck = async () => {
  try {
    const response = await apiClient.post('/subscriptions/admin/run-expiry-check');
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to run manual expiry check'
    };
  }
};

export const verifyAdminSubscription = async (id) => {
  try {
    const response = await apiClient.patch(`/subscriptions/admin/${id}/verify`);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to verify subscription payment'
    };
  }
};

export const rejectAdminSubscription = async (id, reason) => {
  try {
    const response = await apiClient.patch(`/subscriptions/admin/${id}/reject`, { reason });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to reject subscription payment'
    };
  }
};

export default apiClient;


