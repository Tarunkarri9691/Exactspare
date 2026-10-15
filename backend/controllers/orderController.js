import crypto from 'crypto';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import SparePart from '../models/SparePart.js';
import Shop from '../models/Shop.js';
import { logger } from '../utils/logger.js';

/**
 * Valid order status progression transitions for shop owners
 */
const VALID_STATUS_TRANSITIONS = {
  PLACED: ['CONFIRMED'],
  CONFIRMED: ['PROCESSING'],
  PROCESSING: ['READY_FOR_DISPATCH'],
  READY_FOR_DISPATCH: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: []
};

/**
 * Customer: Place order from current persistent cart
 * @route POST /api/orders
 */
export const createOrder = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { shippingAddress, paymentMethod = 'COD' } = req.body;

    // 1. Validate shipping address fields
    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        message: 'Shipping delivery address is required.'
      });
    }

    const { fullName, phone, addressLine, city, state, postalCode, instructions } = shippingAddress;

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ success: false, message: 'Full name is required for delivery.' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'Contact phone number is required.' });
    }
    if (!addressLine || !addressLine.trim()) {
      return res.status(400).json({ success: false, message: 'Street address line is required.' });
    }
    if (!city || !city.trim()) {
      return res.status(400).json({ success: false, message: 'City is required.' });
    }
    if (!state || !state.trim()) {
      return res.status(400).json({ success: false, message: 'State is required.' });
    }
    if (!postalCode || !postalCode.trim()) {
      return res.status(400).json({ success: false, message: 'Postal / PIN code is required.' });
    }

    // 2. Validate Payment Method
    if (paymentMethod === 'ONLINE') {
      return res.status(400).json({
        success: false,
        message: 'Online payment gateway is not yet configured. Please select Cash on Delivery (COD).'
      });
    }

    if (paymentMethod !== 'COD') {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method. Supported method: COD'
      });
    }

    // 3. Fetch Customer's Persistent Cart
    const cart = await Cart.findOne({ customerId });
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your shopping cart is empty. Add spare parts before placing an order.'
      });
    }

    // 4. Pre-validate all items before stock deduction
    const validatedItems = [];
    for (const item of cart.items) {
      const product = await SparePart.findById(item.productId).populate('shopId');

      if (!product || product.isArchived || !product.isPublished) {
        return res.status(400).json({
          success: false,
          message: `One or more products in your cart are no longer available for purchase.`
        });
      }

      const shop = product.shopId;
      if (!shop || !shop.isApproved || !shop.isActive) {
        return res.status(400).json({
          success: false,
          message: `The shop for "${product.partName}" is currently not active.`
        });
      }

      if (product.stockQuantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.partName}". Only ${product.stockQuantity} units available.`
        });
      }

      validatedItems.push({
        product,
        shop,
        quantity: item.quantity
      });
    }

    // 5. Atomic Stock Deduction with Compensating Rollback
    const decrementedList = [];
    let deductionFailed = false;
    let failedProductName = '';

    for (const vi of validatedItems) {
      const updated = await SparePart.findOneAndUpdate(
        {
          _id: vi.product._id,
          stockQuantity: { $gte: vi.quantity },
          isArchived: false,
          isPublished: true
        },
        {
          $inc: { stockQuantity: -vi.quantity }
        },
        { new: true }
      );

      if (!updated) {
        deductionFailed = true;
        failedProductName = vi.product.partName;
        break;
      }

      // If stock reached 0, transition status
      if (updated.stockQuantity <= 0) {
        await SparePart.findByIdAndUpdate(vi.product._id, { availabilityStatus: 'OUT_OF_STOCK' });
      }

      decrementedList.push({
        productId: vi.product._id,
        quantity: vi.quantity
      });
    }

    // Rollback if any stock decrement failed
    if (deductionFailed) {
      for (const dec of decrementedList) {
        await SparePart.findByIdAndUpdate(dec.productId, {
          $inc: { stockQuantity: dec.quantity },
          $set: { availabilityStatus: 'IN_STOCK' }
        });
      }

      return res.status(400).json({
        success: false,
        message: `Stock for "${failedProductName}" changed before completing the order. Please review your cart.`
      });
    }

    // 6. Build Snapshot Item Records and Multi-Shop Groups
    const orderItems = [];
    const shopGroupMap = new Map();
    let calculatedSubtotal = 0;

    for (const vi of validatedItems) {
      const unitPrice = vi.product.price; // Server-recalculated price
      const itemSubtotal = unitPrice * vi.quantity;
      calculatedSubtotal += itemSubtotal;

      const shopIdStr = vi.shop._id.toString();
      const ownerId = vi.shop.ownerId;

      orderItems.push({
        productId: vi.product._id,
        partName: vi.product.partName,
        partNumber: vi.product.partNumber,
        manufacturer: vi.product.manufacturer || '',
        vehicleType: vi.product.vehicleType || '',
        imagePath: vi.product.imagePaths && vi.product.imagePaths.length > 0 ? vi.product.imagePaths[0] : null,
        shopId: vi.shop._id,
        shopName: vi.shop.name,
        ownerId,
        unitPrice,
        quantity: vi.quantity,
        subtotal: itemSubtotal
      });

      if (!shopGroupMap.has(shopIdStr)) {
        shopGroupMap.set(shopIdStr, {
          shopId: vi.shop._id,
          shopName: vi.shop.name,
          ownerId,
          itemsSubtotal: 0,
          fulfillmentStatus: 'PLACED',
          statusHistory: [
            {
              status: 'PLACED',
              changedBy: customerId,
              note: 'Order placed by customer',
              changedAt: new Date()
            }
          ]
        });
      }

      shopGroupMap.get(shopIdStr).itemsSubtotal += itemSubtotal;
    }

    const orderShops = Array.from(shopGroupMap.values());
    const deliveryCharge = 0; // Free store dispatch / delivery included
    const totalAmount = calculatedSubtotal + deliveryCharge;

    // 7. Generate Unique Server Order Number
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const orderNumber = `EXS-${datePrefix}-${randomSuffix}`;

    // 8. Create Order Document
    const order = await Order.create({
      orderNumber,
      customerId,
      items: orderItems,
      shops: orderShops,
      shippingAddress: {
        fullName: fullName.trim(),
        phone: phone.trim(),
        addressLine: addressLine.trim(),
        city: city.trim(),
        state: state.trim(),
        postalCode: postalCode.trim(),
        instructions: instructions ? instructions.trim() : ''
      },
      subtotal: calculatedSubtotal,
      deliveryCharge,
      totalAmount,
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      orderStatus: 'PLACED',
      statusHistory: [
        {
          status: 'PLACED',
          changedBy: customerId,
          note: 'Order successfully created with Cash on Delivery',
          changedAt: new Date()
        }
      ]
    });

    // 9. Clear customer's persistent cart
    cart.items = [];
    await cart.save();

    logger.info(`New order created: ${order.orderNumber} for customer ${customerId} (Total: ₹${totalAmount})`);

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully!',
      data: {
        order
      }
    });
  } catch (error) {
    logger.error('Error creating order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to place order. Please try again.'
    });
  }
};

/**
 * Customer: View authenticated customer's orders
 * @route GET /api/orders/my
 */
export const getMyOrders = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;
    const query = { customerId: req.user.id };

    if (status && status !== 'ALL') {
      query.orderStatus = status;
    }

    if (search && search.trim()) {
      query.orderNumber = new RegExp(search.trim(), 'i');
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 0
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching customer orders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch orders.'
    });
  }
};

/**
 * Customer: View details of a specific order
 * @route GET /api/orders/:orderId
 */
export const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID.'
      });
    }

    const order = await Order.findById(orderId).lean();
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    // Enforce ownership: customer can only view their own order
    if (order.customerId.toString() !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. You do not own this order.'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        order
      }
    });
  } catch (error) {
    logger.error('Error retrieving order details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve order details.'
    });
  }
};

/**
 * Customer: Cancel an order and restore stock atomically
 * @route POST /api/orders/:orderId/cancel
 */
export const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason = 'Cancelled by customer' } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID.'
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    // Ownership verification
    if (order.customerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. You cannot cancel an order you did not place.'
      });
    }

    // Check cancellation eligibility: cannot cancel if top-level or any shop is processing/dispatched/delivered/cancelled
    const hasDispatchedOrProcessingShop = order.shops.some((s) =>
      ['PROCESSING', 'READY_FOR_DISPATCH', 'SHIPPED', 'DELIVERED', 'CANCELLED'].includes(s.fulfillmentStatus)
    );

    if (!['PLACED', 'CONFIRMED'].includes(order.orderStatus) || hasDispatchedOrProcessingShop) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled in "${order.orderStatus}" status or once processing or dispatch has begun.`
      });
    }

    // Restore stock atomically for all items
    for (const item of order.items) {
      await SparePart.findByIdAndUpdate(item.productId, {
        $inc: { stockQuantity: item.quantity },
        $set: { availabilityStatus: 'IN_STOCK' }
      });
    }

    // Update order status
    order.orderStatus = 'CANCELLED';
    order.paymentStatus = 'REFUNDED'; // If any payment had been made
    order.cancellation = {
      cancelledAt: new Date(),
      cancelledBy: req.user.id,
      reason: reason.trim()
    };

    order.statusHistory.push({
      status: 'CANCELLED',
      changedBy: req.user.id,
      note: `Cancelled by customer: ${reason.trim()}`,
      changedAt: new Date()
    });

    // Mark each shop suborder as cancelled
    for (const shop of order.shops) {
      shop.fulfillmentStatus = 'CANCELLED';
      shop.statusHistory.push({
        status: 'CANCELLED',
        changedBy: req.user.id,
        note: `Customer requested order cancellation`,
        changedAt: new Date()
      });
    }

    await order.save();

    logger.info(`Order ${order.orderNumber} cancelled by customer ${req.user.id}. Stock restored.`);

    return res.status(200).json({
      success: true,
      message: 'Order cancelled successfully and stock has been restored.',
      data: {
        order
      }
    });
  } catch (error) {
    logger.error('Error cancelling order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel order.'
    });
  }
};

/**
 * Shop Owner: View orders containing products from the owner's shop
 * @route GET /api/owner/orders
 */
export const getOwnerOrders = async (req, res) => {
  try {
    const ownerId = req.user.id;

    // Verify owner has an approved active shop
    const shop = await Shop.findOne({ ownerId });
    if (!shop) {
      return res.status(403).json({
        success: false,
        message: 'No registered shop found for this owner account.'
      });
    }

    const { status, search, page = 1, limit = 10 } = req.query;

    const query = {
      'items.ownerId': ownerId
    };

    if (status && status !== 'ALL') {
      query.orderStatus = status;
    }

    if (search && search.trim()) {
      query.orderNumber = new RegExp(search.trim(), 'i');
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [rawOrders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(query)
    ]);

    // Strict Tenant Isolation: Filter items to only show products belonging to THIS owner
    const sanitizedOrders = rawOrders.map((ord) => {
      const ownerItems = ord.items.filter((item) => item.ownerId.toString() === ownerId);
      const ownerShopInfo = ord.shops.find((s) => s.ownerId.toString() === ownerId);

      return {
        _id: ord._id,
        orderNumber: ord.orderNumber,
        createdAt: ord.createdAt,
        orderStatus: ord.orderStatus,
        paymentMethod: ord.paymentMethod,
        paymentStatus: ord.paymentStatus,
        shippingAddress: ord.shippingAddress,
        items: ownerItems,
        shopFulfillment: ownerShopInfo,
        ownerItemsSubtotal: ownerShopInfo?.itemsSubtotal || ownerItems.reduce((acc, i) => acc + i.subtotal, 0)
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        orders: sanitizedOrders,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 0
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching owner orders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve shop orders.'
    });
  }
};

/**
 * Shop Owner: View detailed view of an order containing products from owner's shop
 * @route GET /api/owner/orders/:orderId
 */
export const getOwnerOrderById = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID.'
      });
    }

    const order = await Order.findById(orderId).lean();
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    // Verify this order actually contains products from this owner
    const hasOwnerItems = order.items.some((item) => item.ownerId.toString() === ownerId);
    if (!hasOwnerItems) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. This order does not contain products from your shop.'
      });
    }

    // Strictly filter out other shops' items
    const ownerItems = order.items.filter((item) => item.ownerId.toString() === ownerId);
    const ownerShopInfo = order.shops.find((s) => s.ownerId.toString() === ownerId);

    const sanitizedOrder = {
      _id: order._id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      orderStatus: order.orderStatus,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      shippingAddress: order.shippingAddress,
      items: ownerItems,
      shopFulfillment: ownerShopInfo,
      statusHistory: order.statusHistory,
      cancellation: order.cancellation
    };

    return res.status(200).json({
      success: true,
      data: {
        order: sanitizedOrder
      }
    });
  } catch (error) {
    logger.error('Error retrieving owner order details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve order details.'
    });
  }
};

/**
 * Shop Owner: Update fulfillment status of an order
 * @route PATCH /api/owner/orders/:orderId/status
 */
export const updateOwnerOrderStatus = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { orderId } = req.params;
    const { status, note = '' } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID.'
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    // Find the shop entry for this owner
    const shopIndex = order.shops.findIndex((s) => s.ownerId.toString() === ownerId);
    if (shopIndex === -1) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. You do not have products in this order.'
      });
    }

    const currentFulfillmentStatus = order.shops[shopIndex].fulfillmentStatus;

    // Check transition validity
    const allowedNext = VALID_STATUS_TRANSITIONS[currentFulfillmentStatus] || [];
    if (!allowedNext.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from "${currentFulfillmentStatus}" to "${status}". Allowed next states: ${allowedNext.join(', ') || 'None'}`
      });
    }

    // Prevent changing from cancelled or delivered
    if (['CANCELLED', 'DELIVERED'].includes(currentFulfillmentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot modify an order that is already ${currentFulfillmentStatus}.`
      });
    }

    // Update shop fulfillment status
    order.shops[shopIndex].fulfillmentStatus = status;
    order.shops[shopIndex].statusHistory.push({
      status,
      changedBy: ownerId,
      note: note.trim() || `Status updated to ${status} by shop owner`,
      changedAt: new Date()
    });

    // Sync top-level order status based on shop statuses
    const allShopStatuses = order.shops.map((s) => s.fulfillmentStatus);
    let aggregatedStatus = order.orderStatus;
    if (allShopStatuses.every((st) => st === 'DELIVERED')) {
      aggregatedStatus = 'DELIVERED';
    } else if (allShopStatuses.every((st) => st === 'CANCELLED')) {
      aggregatedStatus = 'CANCELLED';
    } else if (allShopStatuses.some((st) => st === 'SHIPPED')) {
      aggregatedStatus = 'SHIPPED';
    } else if (allShopStatuses.some((st) => ['READY_FOR_DISPATCH', 'PROCESSING'].includes(st))) {
      aggregatedStatus = 'PROCESSING';
    } else if (allShopStatuses.some((st) => st === 'CONFIRMED')) {
      aggregatedStatus = 'CONFIRMED';
    }

    if (aggregatedStatus !== order.orderStatus) {
      order.orderStatus = aggregatedStatus;
      order.statusHistory.push({
        status: aggregatedStatus,
        changedBy: ownerId,
        note: `Order overall status updated to ${aggregatedStatus}`,
        changedAt: new Date()
      });
    }

    await order.save();

    logger.info(`Owner ${ownerId} updated order ${order.orderNumber} to ${status}`);

    return res.status(200).json({
      success: true,
      message: `Order status updated to ${status}.`,
      data: {
        order
      }
    });
  } catch (error) {
    logger.error('Error updating owner order status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update order status.'
    });
  }
};
