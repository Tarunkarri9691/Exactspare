import mongoose from 'mongoose';
import Cart from '../models/Cart.js';
import SparePart from '../models/SparePart.js';
import Shop from '../models/Shop.js';
import { logger } from '../utils/logger.js';

/**
 * Helper to populate and sanitize cart items with live database prices and stock
 */
const getPopulatedCartData = async (customerId) => {
  let cart = await Cart.findOne({ customerId });
  if (!cart) {
    cart = await Cart.create({ customerId, items: [] });
  }

  // Populate product and shop details
  await cart.populate({
    path: 'items.productId',
    populate: {
      path: 'shopId',
      select: 'name address contact isApproved isActive'
    }
  });

  const validItems = [];
  let subtotal = 0;
  let totalItems = 0;
  let hasModified = false;

  for (const item of cart.items) {
    const product = item.productId;

    // Check if product was deleted, archived, or unpublished
    if (!product || product.isArchived || !product.isPublished) {
      hasModified = true;
      continue;
    }

    // Check if shop is approved and active
    const shop = product.shopId;
    if (!shop || !shop.isApproved || !shop.isActive) {
      hasModified = true;
      continue;
    }

    // Live quantity adjustment if stock decreased below current cart quantity
    let currentQty = item.quantity;
    if (currentQty > product.stockQuantity) {
      currentQty = Math.max(1, product.stockQuantity);
      hasModified = true;
    }

    const unitPrice = product.price;
    const itemSubtotal = unitPrice * currentQty;
    subtotal += itemSubtotal;
    totalItems += currentQty;

    validItems.push({
      productId: product._id,
      partName: product.partName,
      partNumber: product.partNumber,
      manufacturer: product.manufacturer,
      category: product.category,
      vehicleType: product.vehicleType,
      imagePath: product.imagePaths && product.imagePaths.length > 0 ? product.imagePaths[0] : null,
      unitPrice,
      quantity: currentQty,
      subtotal: itemSubtotal,
      availableStock: product.stockQuantity,
      isOutOfStock: product.stockQuantity <= 0,
      shop: {
        _id: shop._id,
        name: shop.name,
        city: shop.address?.city,
        state: shop.address?.state
      }
    });
  }

  // Persist cleaned-up items if invalid products were removed or quantities adjusted
  if (hasModified) {
    cart.items = validItems.map((vi) => ({
      productId: vi.productId,
      quantity: vi.quantity
    }));
    await cart.save();
  }

  return {
    items: validItems,
    subtotal,
    deliveryCharge: 0,
    totalAmount: subtotal,
    totalItems
  };
};

/**
 * Fetch authenticated customer's cart
 * @route GET /api/cart
 */
export const getCart = async (req, res) => {
  try {
    const cartData = await getPopulatedCartData(req.user.id);
    return res.status(200).json({
      success: true,
      data: cartData
    });
  } catch (error) {
    logger.error('Error fetching cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve shopping cart.'
    });
  }
};

/**
 * Add a spare part to customer's cart
 * @route POST /api/cart/items
 */
export const addItemToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid product ID is required.'
      });
    }

    const nQty = parseInt(quantity, 10);
    if (isNaN(nQty) || nQty < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive integer.'
      });
    }

    // Verify product exists and is available
    const product = await SparePart.findById(productId).populate('shopId');
    if (!product || product.isArchived || !product.isPublished) {
      return res.status(404).json({
        success: false,
        message: 'Spare part not found or is no longer listed for sale.'
      });
    }

    if (!product.shopId || !product.shopId.isApproved || !product.shopId.isActive) {
      return res.status(400).json({
        success: false,
        message: 'The shop offering this product is currently inactive.'
      });
    }

    if (product.stockQuantity < 1) {
      return res.status(400).json({
        success: false,
        message: `"${product.partName}" is currently out of stock.`
      });
    }

    let cart = await Cart.findOne({ customerId: req.user.id });
    if (!cart) {
      cart = await Cart.create({ customerId: req.user.id, items: [] });
    }

    const existingIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId.toString()
    );

    if (existingIndex > -1) {
      const newTotal = cart.items[existingIndex].quantity + nQty;
      if (newTotal > product.stockQuantity) {
        return res.status(400).json({
          success: false,
          message: `Cannot add ${nQty} more. Only ${product.stockQuantity} units available in stock (${cart.items[existingIndex].quantity} already in cart).`
        });
      }
      cart.items[existingIndex].quantity = newTotal;
    } else {
      if (nQty > product.stockQuantity) {
        return res.status(400).json({
          success: false,
          message: `Cannot add ${nQty} units. Only ${product.stockQuantity} units available in stock.`
        });
      }
      cart.items.push({ productId: product._id, quantity: nQty });
    }

    await cart.save();

    const cartData = await getPopulatedCartData(req.user.id);
    return res.status(200).json({
      success: true,
      message: `"${product.partName}" added to cart.`,
      data: cartData
    });
  } catch (error) {
    logger.error('Error adding item to cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add item to cart.'
    });
  }
};

/**
 * Update quantity of an item in the cart
 * @route PATCH /api/cart/items/:productId
 */
export const updateCartItemQuantity = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid product ID is required.'
      });
    }

    const nQty = parseInt(quantity, 10);
    if (isNaN(nQty) || nQty < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1.'
      });
    }

    const product = await SparePart.findById(productId);
    if (!product || product.isArchived || !product.isPublished) {
      return res.status(404).json({
        success: false,
        message: 'Product no longer available.'
      });
    }

    if (nQty > product.stockQuantity) {
      return res.status(400).json({
        success: false,
        message: `Cannot set quantity to ${nQty}. Only ${product.stockQuantity} units available in stock.`
      });
    }

    const cart = await Cart.findOne({ customerId: req.user.id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found.'
      });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId.toString()
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart.'
      });
    }

    cart.items[itemIndex].quantity = nQty;
    await cart.save();

    const cartData = await getPopulatedCartData(req.user.id);
    return res.status(200).json({
      success: true,
      message: 'Cart quantity updated.',
      data: cartData
    });
  } catch (error) {
    logger.error('Error updating cart quantity:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update item quantity.'
    });
  }
};

/**
 * Remove an item from customer's cart
 * @route DELETE /api/cart/items/:productId
 */
export const removeCartItem = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid product ID is required.'
      });
    }

    const cart = await Cart.findOne({ customerId: req.user.id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found.'
      });
    }

    cart.items = cart.items.filter(
      (item) => item.productId.toString() !== productId.toString()
    );
    await cart.save();

    const cartData = await getPopulatedCartData(req.user.id);
    return res.status(200).json({
      success: true,
      message: 'Item removed from cart.',
      data: cartData
    });
  } catch (error) {
    logger.error('Error removing item from cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove item from cart.'
    });
  }
};

/**
 * Clear all items from customer's cart
 * @route DELETE /api/cart
 */
export const clearCart = async (req, res) => {
  try {
    await Cart.findOneAndUpdate(
      { customerId: req.user.id },
      { $set: { items: [] } },
      { upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Cart cleared successfully.',
      data: {
        items: [],
        subtotal: 0,
        deliveryCharge: 0,
        totalAmount: 0,
        totalItems: 0
      }
    });
  } catch (error) {
    logger.error('Error clearing cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear cart.'
    });
  }
};
