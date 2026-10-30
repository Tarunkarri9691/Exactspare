import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  loginUser as apiLogin, 
  registerUser as apiRegister, 
  logoutUser as apiLogout, 
  fetchCurrentUser 
} from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Restore session from HttpOnly cookie on application load or page refresh
  const checkAuthStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchCurrentUser();
      if (res.success && res.data) {
        setUser(res.data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Handle user login
  const login = async (credentials) => {
    setAuthError(null);
    const res = await apiLogin(credentials);
    if (res.success && res.data?.user) {
      setUser(res.data.user);
      return { success: true, user: res.data.user };
    } else {
      setAuthError(res.error);
      return { success: false, error: res.error };
    }
  };

  // Handle user registration
  const register = async (userData) => {
    setAuthError(null);
    const res = await apiRegister(userData);
    if (res.success && res.data?.user) {
      setUser(res.data.user);
      return { success: true, user: res.data.user };
    } else {
      setAuthError(res.error);
      return { 
        success: false, 
        error: res.error, 
        errors: res.errors 
      };
    }
  };

  // Handle user logout
  const logout = async () => {
    await apiLogout();
    setUser(null);
    setAuthError(null);
  };

  const value = {
    user,
    loading,
    authError,
    isAuthenticated: !!user,
    role: user?.role || null,
    login,
    register,
    logout,
    refreshUser: checkAuthStatus,
    updateUser: setUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
