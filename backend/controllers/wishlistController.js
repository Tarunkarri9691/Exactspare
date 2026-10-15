import mongoose from 'mongoose';
import Wishlist from '../models/Wishlist.js';
import SparePart from '../models/SparePart.js';
import Cart from '../models/Cart.js';
import { logger } from '../utils/logger.js';

/**
 * Customer: Retrieve current customer's wishlist with real-time stock and status revalidation
 * @route GET /api/wishlist
 */
export const getWishlist = async (req, res) => {
  try {
    const customerId = req.user._id || req.user.id;

    let wishlist = await Wishlist.findOne({ customerId })
      .populate({
        path: 'items.productId',
        select: 'partName partNumber price stockQuantity availabilityStatus imagePaths vehicleType category condition isPublished isArchived shopId',
        populate: {
          path: 'shopId',
          select: 'name isApproved isActive address'
        }
      });

    if (!wishlist) {
      wishlist = await Wishlist.create({ customerId, items: [] });
    }

    // Process items: evaluate product validity, availability, and active shop status
    const formattedItems = [];
    for (const item of wishlist.items) {
      const product = item.productId;
      if (!product || product.isArchived) {
        // Product no longer exists or was archived
        continue;
      }

      const shop = product.shopId;
      const isShopValid = shop && shop.isApproved && shop.isActive;
      const isProductPublished = product.isPublished;
      const isInStock = product.stockQuantity > 0 && product.availabilityStatus !== 'OUT_OF_STOCK';

      formattedItems.push({
        _id: item._id,
        productId: {
          _id: product._id,
          partName: product.partName,
          partNumber: product.partNumber,
          price: product.price,
          stockQuantity: product.stockQuantity,
          availabilityStatus: product.availabilityStatus,
          imagePaths: product.imagePaths,
          vehicleType: product.vehicleType,
          category: product.category,
          condition: product.condition,
          shopId: shop
            ? {
                _id: shop._id,
                name: shop.name,
                city: shop.address?.city,
                state: shop.address?.state
              }
            : null
        },
        isAvailable: isShopValid && isProductPublished && isInStock,
        addedAt: item.addedAt
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Wishlist retrieved successfully',
      data: {
        wishlistId: wishlist._id,
        items: formattedItems,
        totalItems: formattedItems.length
      }
    });
  } catch (error) {
    logger.error('Error fetching wishlist:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve wishlist'
    });
  }
};

/**
 * Customer: Add a spare part to wishlist
 * @route POST /api/wishlist/items
 */
export const addToWishlist = async (req, res) => {
  try {
    const customerId = req.user._id || req.user.id;
    const { productId } = req.body;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid product ID is required'
      });
    }

    // Verify product exists and is active
    const product = await SparePart.findById(productId);
    if (!product || product.isArchived) {
      return res.status(404).json({
        success: false,
        message: 'Spare part not found or has been archived'
      });
    }

    let wishlist = await Wishlist.findOne({ customerId });
    if (!wishlist) {
      wishlist = new Wishlist({ customerId, items: [] });
    }

    // Check if already in wishlist
    const exists = wishlist.items.some(
      (item) => item.productId.toString() === productId.toString()
    );

    if (exists) {
      return res.status(200).json({
        success: true,
        message: 'Item is already in your wishlist',
        data: {
          totalItems: wishlist.items.length
        }
      });
    }

    wishlist.items.push({
      productId,
      addedAt: new Date()
    });

    await wishlist.save();

    return res.status(201).json({
      success: true,
      message: 'Product added to your wishlist',
      data: {
        totalItems: wishlist.items.length
      }
    });
  } catch (error) {
    logger.error('Error adding to wishlist:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add item to wishlist'
    });
  }
};

/**
 * Customer: Remove a spare part from wishlist
 * @route DELETE /api/wishlist/items/:productId
 */
export const removeFromWishlist = async (req, res) => {
  try {
    const customerId = req.user._id || req.user.id;
    const { productId } = req.params;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid product ID is required'
      });
    }

    const wishlist = await Wishlist.findOne({ customerId });
    if (!wishlist) {
      return res.status(200).json({
        success: true,
        message: 'Item removed from wishlist',
        data: { totalItems: 0 }
      });
    }

    wishlist.items = wishlist.items.filter(
      (item) => item.productId.toString() !== productId.toString()
    );

    await wishlist.save();

    return res.status(200).json({
      success: true,
      message: 'Item removed from wishlist',
      data: {
        totalItems: wishlist.items.length
      }
    });
  } catch (error) {
    logger.error('Error removing from wishlist:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove item from wishlist'
    });
  }
};

/**
 * Customer: Move a product from wishlist directly to shopping cart
 * @route POST /api/wishlist/items/:productId/move-to-cart
 */
export const moveWishlistItemToCart = async (req, res) => {
  try {
    const customerId = req.user._id || req.user.id;
    const { productId } = req.params;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid product ID is required'
      });
    }

    // Verify product exists and is in stock
    const product = await SparePart.findById(productId);
    if (!product || product.isArchived) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (product.stockQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Product is currently out of stock and cannot be moved to cart'
      });
    }

    // 1. Add to customer's cart
    let cart = await Cart.findOne({ customerId });
    if (!cart) {
      cart = new Cart({ customerId, items: [] });
    }

    const cartItemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId.toString()
    );

    if (cartItemIndex > -1) {
      cart.items[cartItemIndex].quantity = Math.min(
        product.stockQuantity,
        cart.items[cartItemIndex].quantity + 1
      );
    } else {
      cart.items.push({ productId, quantity: 1 });
    }

    await cart.save();

    // 2. Remove from wishlist
    const wishlist = await Wishlist.findOne({ customerId });
    if (wishlist) {
      wishlist.items = wishlist.items.filter(
        (item) => item.productId.toString() !== productId.toString()
      );
      await wishlist.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Item moved to cart successfully',
      data: {
        wishlistTotal: wishlist?.items.length || 0,
        cartTotal: cart.items.reduce((sum, i) => sum + i.quantity, 0)
      }
    });
  } catch (error) {
    logger.error('Error moving wishlist item to cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to move item to cart'
    });
  }
};
