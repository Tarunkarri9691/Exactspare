import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  fetchCart as apiFetchCart,
  addToCart as apiAddToCart,
  updateCartItemQty as apiUpdateQty,
  removeFromCart as apiRemoveFromCart,
  clearCart as apiClearCart
} from '../services/api';

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState({
    items: [],
    totalItems: 0,
    subtotal: 0,
    unavailableCount: 0
  });
  const [loading, setLoading] = useState(false);
  const [cartMessage, setCartMessage] = useState(null);

  const refreshCart = useCallback(async () => {
    if (!user || user.role !== 'CUSTOMER') {
      setCart({ items: [], totalItems: 0, subtotal: 0, unavailableCount: 0 });
      return;
    }
    try {
      setLoading(true);
      const res = await apiFetchCart();
      if (res.success && res.data) {
        setCart(res.data);
      }
    } catch {
      // keep fallback
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const addItem = async (productId, quantity = 1) => {
    if (!user) {
      return { success: false, requireAuth: true, message: 'Please log in to add items to your cart.' };
    }
    if (user.role !== 'CUSTOMER') {
      return { success: false, message: 'Only customer accounts can make purchases.' };
    }

    try {
      setLoading(true);
      const res = await apiAddToCart(productId, quantity);
      if (res.success && res.data) {
        setCart(res.data);
        setCartMessage({ type: 'success', text: res.message || 'Added to cart' });
        return { success: true, message: res.message, cart: res.data };
      } else {
        setCartMessage({ type: 'error', text: res.error || 'Failed to add item' });
        return { success: false, error: res.error };
      }
    } finally {
      setLoading(false);
    }
  };

  const updateQty = async (productId, quantity) => {
    try {
      setLoading(true);
      const res = await apiUpdateQty(productId, quantity);
      if (res.success && res.data) {
        setCart(res.data);
        return { success: true, message: res.message };
      } else {
        return { success: false, error: res.error };
      }
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (productId) => {
    try {
      setLoading(true);
      const res = await apiRemoveFromCart(productId);
      if (res.success && res.data) {
        setCart(res.data);
        return { success: true, message: res.message };
      } else {
        return { success: false, error: res.error };
      }
    } finally {
      setLoading(false);
    }
  };

  const clearAll = async () => {
    try {
      setLoading(true);
      const res = await apiClearCart();
      if (res.success) {
        setCart({ items: [], totalItems: 0, subtotal: 0, unavailableCount: 0 });
        return { success: true, message: res.message };
      } else {
        return { success: false, error: res.error };
      }
    } finally {
      setLoading(false);
    }
  };

  const cartCount = cart?.totalItems || 0;

  return (
    <CartContext.Provider
      value={{
        cart,
        cartCount,
        loading,
        cartMessage,
        setCartMessage,
        refreshCart,
        addItem,
        addToCart: addItem,
        updateQty,
        removeItem,
        clearAll
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
