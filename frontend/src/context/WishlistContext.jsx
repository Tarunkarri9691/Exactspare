import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useCart } from './CartContext';
import {
  fetchWishlist as apiFetchWishlist,
  addToWishlistApi as apiAddToWishlist,
  removeFromWishlistApi as apiRemoveFromWishlist,
  moveWishlistToCartApi as apiMoveToCart
} from '../services/api';

const WishlistContext = createContext(null);

export const WishlistProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const { refreshCart } = useCart();
  const [wishlistItems, setWishlistItems] = useState([]);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [wishlistFeedback, setWishlistFeedback] = useState(null);

  const refreshWishlist = useCallback(async () => {
    if (!isAuthenticated || !user || user.role !== 'CUSTOMER') {
      setWishlistItems([]);
      setWishlistCount(0);
      return;
    }

    try {
      setLoading(true);
      const res = await apiFetchWishlist();
      if (res.success) {
        setWishlistItems(res.data || []);
        setWishlistCount(res.count || 0);
      }
    } catch {
      // keep fallback
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    refreshWishlist();
  }, [refreshWishlist]);

  const isItemInWishlist = useCallback(
    (productId) => {
      if (!productId || !wishlistItems.length) return false;
      const targetId = typeof productId === 'object' ? productId._id?.toString() : productId.toString();
      return wishlistItems.some((item) => {
        const itemPid = item.productId?._id
          ? item.productId._id.toString()
          : item.productId?.toString();
        return itemPid === targetId;
      });
    },
    [wishlistItems]
  );

  const addToWishlist = async (productId) => {
    if (!isAuthenticated || !user) {
      return { success: false, requireAuth: true, message: 'Please log in to save items to your wishlist.' };
    }
    if (user.role !== 'CUSTOMER') {
      return { success: false, message: 'Only customer accounts can maintain a wishlist.' };
    }

    try {
      const res = await apiAddToWishlist(productId);
      if (res.success) {
        await refreshWishlist();
        setWishlistFeedback({ type: 'success', text: 'Added to your wishlist!' });
        return { success: true, message: res.message };
      } else {
        setWishlistFeedback({ type: 'error', text: res.error || 'Failed to add to wishlist' });
        return { success: false, error: res.error };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const removeFromWishlist = async (productId) => {
    if (!isAuthenticated || !user) return { success: false };

    try {
      const res = await apiRemoveFromWishlist(productId);
      if (res.success) {
        setWishlistItems((prev) =>
          prev.filter((item) => {
            const itemPid = item.productId?._id
              ? item.productId._id.toString()
              : item.productId?.toString();
            return itemPid !== productId.toString();
          })
        );
        setWishlistCount((c) => Math.max(0, c - 1));
        return { success: true, message: res.message };
      } else {
        return { success: false, error: res.error };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const toggleWishlist = async (productId) => {
    if (isItemInWishlist(productId)) {
      return await removeFromWishlist(productId);
    } else {
      return await addToWishlist(productId);
    }
  };

  const moveItemToCart = async (productId, quantity = 1) => {
    try {
      const res = await apiMoveToCart(productId, quantity);
      if (res.success) {
        await refreshWishlist();
        if (refreshCart) {
          await refreshCart();
        }
        return { success: true, message: res.message, cart: res.cart };
      } else {
        return { success: false, error: res.error };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  return (
    <WishlistContext.Provider
      value={{
        wishlistItems,
        wishlistCount,
        loading,
        wishlistFeedback,
        isItemInWishlist,
        addToWishlist,
        removeFromWishlist,
        toggleWishlist,
        moveItemToCart,
        refreshWishlist
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};
