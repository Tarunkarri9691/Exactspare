import crypto from 'crypto';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import SparePart from '../models/SparePart.js';
import Shop from '../models/Shop.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import emailService from '../services/emailService.js';
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
 * Helper to dispatch notification once and prevent duplicate alerts
 */
export const sendOrderNotificationOnce = async ({
  recipientId,
  type,
  title,
  message,
  relatedOrderId,
  relatedShopId = null
}) => {
  try {
    const existing = await Notification.findOne({
      recipientId,
      type,
      relatedOrderId
    });

    if (existing) {
      logger.info(`Duplicate notification suppressed: ${type} for order ${relatedOrderId} to user ${recipientId}`);
      return existing;
    }

    return await Notification.create({
      recipientId,
      type,
      title,
      message,
      relatedOrderId,
      relatedShopId
    });
  } catch (err) {
    logger.warn('Failed to dispatch order notification:', err.message);
    return null;
  }
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
              updatedBy: customerId,
              note: 'Order placed by customer',
              customerSafeMessage: 'Order placed and logged in our system.',
              timestamp: new Date(),
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
          updatedBy: customerId,
          note: 'Order successfully created with Cash on Delivery',
          customerSafeMessage: 'Order successfully created with Cash on Delivery',
          timestamp: new Date(),
          changedAt: new Date()
        }
      ]
    });

    // 9. Clear customer's persistent cart
    cart.items = [];
    await cart.save();

    // 10. Dispatch in-app notifications (deduplicated)
    try {
      // Notify Customer
      await sendOrderNotificationOnce({
        recipientId: customerId,
        type: 'ORDER_PLACED',
        title: 'Order Placed Successfully',
        message: `Your spare parts order #${order.orderNumber} for ₹${totalAmount.toLocaleString('en-IN')} has been placed successfully via Cash on Delivery.`,
        relatedOrderId: order._id
      });

      // Notify each involved shop owner
      for (const s of order.shops) {
        await sendOrderNotificationOnce({
          recipientId: s.ownerId,
          type: 'NEW_ORDER_RECEIVED',
          title: 'New Order Received',
          message: `New customer order #${order.orderNumber} contains items from ${s.shopName} (Subtotal: ₹${s.itemsSubtotal.toLocaleString('en-IN')}).`,
          relatedOrderId: order._id,
          relatedShopId: s.shopId
        });
      }

      // Send Order Confirmation Email (failsafe, never throws)
      if (req.user && req.user.email) {
        emailService.sendOrderConfirmationEmail(order, req.user.email, req.user.name).catch((emErr) => {
          logger.warn(`Failed to dispatch order confirmation email: ${emErr.message}`);
        });
      }
    } catch (notifErr) {
      logger.warn('Failed to dispatch order placement notification:', notifErr.message);
    }


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
      updatedBy: req.user.id,
      note: `Cancelled by customer: ${reason.trim()}`,
      customerSafeMessage: `Order cancelled by customer. Reason: ${reason.trim()}`,
      timestamp: new Date(),
      changedAt: new Date()
    });

    // Mark each shop suborder as cancelled
    for (const shop of order.shops) {
      shop.fulfillmentStatus = 'CANCELLED';
      shop.statusHistory.push({
        status: 'CANCELLED',
        changedBy: req.user.id,
        updatedBy: req.user.id,
        note: `Customer requested order cancellation`,
        customerSafeMessage: `Order cancelled: ${reason.trim()}`,
        timestamp: new Date(),
        changedAt: new Date()
      });
    }

    await order.save();

    // Dispatch cancellation notifications (deduplicated)
    try {
      await sendOrderNotificationOnce({
        recipientId: order.customerId,
        type: 'ORDER_CANCELLED',
        title: 'Order Cancelled',
        message: `Your order #${order.orderNumber} has been cancelled successfully and reserved inventory was restored.`,
        relatedOrderId: order._id
      });

      for (const s of order.shops) {
        await sendOrderNotificationOnce({
          recipientId: s.ownerId,
          type: 'ORDER_CANCELLED',
          title: 'Order Cancelled by Customer',
          message: `Customer cancelled order #${order.orderNumber} containing parts from ${s.shopName}.`,
          relatedOrderId: order._id,
          relatedShopId: s.shopId
        });
      }
    } catch (notifErr) {
      logger.warn('Failed to dispatch cancellation notifications:', notifErr.message);
    }

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

    // Customer-safe description for each status milestone
    const STATUS_MESSAGES = {
      CONFIRMED: 'Order confirmed by shop partner. Inventory allocated.',
      PROCESSING: 'Order is being processed and packaged.',
      READY_FOR_DISPATCH: 'Order packaging completed. Ready for dispatch.',
      SHIPPED: 'Order dispatched and handed over for delivery.',
      DELIVERED: 'Order successfully delivered.'
    };

    const customerMessage = note.trim() || STATUS_MESSAGES[status] || `Fulfillment status updated to ${status}.`;

    // Update shop fulfillment status
    order.shops[shopIndex].fulfillmentStatus = status;
    order.shops[shopIndex].statusHistory.push({
      status,
      changedBy: ownerId,
      updatedBy: ownerId,
      note: note.trim() || `Status updated to ${status} by shop owner`,
      customerSafeMessage: customerMessage,
      timestamp: new Date(),
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
        updatedBy: ownerId,
        note: `Order overall status updated to ${aggregatedStatus}`,
        customerSafeMessage: STATUS_MESSAGES[aggregatedStatus] || `Overall order status progressed to ${aggregatedStatus}.`,
        timestamp: new Date(),
        changedAt: new Date()
      });
    }

    await order.save();

    // Dispatch status update notification to customer (deduplicated)
    try {
      const shopName = order.shops[shopIndex]?.shopName || 'Shop';
      await sendOrderNotificationOnce({
        recipientId: order.customerId,
        type: `ORDER_${status}`,
        title: `Order Update: ${status.replace(/_/g, ' ')}`,
        message: `Your order #${order.orderNumber} fulfillment status was updated to "${status.replace(/_/g, ' ')}" by ${shopName}.`,
        relatedOrderId: order._id,
        relatedShopId: order.shops[shopIndex]?.shopId
      });

      // Send status update email to customer
      User.findById(order.customerId)
        .then((customer) => {
          if (customer && customer.email) {
            emailService.sendOrderStatusEmail(order, customer.email, customer.name, status).catch((err) => {
              logger.warn(`Failed to dispatch order status email: ${err.message}`);
            });
          }
        })
        .catch(() => {});
    } catch (notifErr) {
      logger.warn('Failed to dispatch status update notification:', notifErr.message);
    }


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

/**
 * Customer / Shop Owner / Admin: Order Tracking Endpoint
 * @route GET /api/orders/:orderId/tracking
 */
export const getOrderTracking = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID.'
      });
    }

    const order = await Order.findById(orderId)
      .populate('statusHistory.changedBy', 'name role')
      .populate('statusHistory.updatedBy', 'name role')
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    // Role-based Access Control & Isolation
    if (userRole === 'CUSTOMER') {
      if (order.customerId.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access forbidden. You can only track your own orders.'
        });
      }
    } else if (userRole === 'OWNER') {
      const hasShopItems = order.items.some((i) => i.ownerId.toString() === userId);
      if (!hasShopItems) {
        return res.status(403).json({
          success: false,
          message: 'Access forbidden. This order does not contain items from your shop.'
        });
      }
    } else if (userRole !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to track this order.'
      });
    }

    // Standard lifecycle milestones
    const MILESTONES = [
      { key: 'PLACED', title: 'Order Placed', description: 'Order was placed by customer and logged in our system.' },
      { key: 'CONFIRMED', title: 'Order Confirmed', description: 'Partner shop confirmed inventory availability.' },
      { key: 'PROCESSING', title: 'Processing', description: 'Spare parts are being packaged and prepared.' },
      { key: 'READY_FOR_DISPATCH', title: 'Ready for Dispatch', description: 'Package is sealed and ready for courier pickup / local dispatch.' },
      { key: 'SHIPPED', title: 'Shipped', description: 'Package has been dispatched for delivery.' },
      { key: 'DELIVERED', title: 'Delivered', description: 'Package successfully delivered to the customer.' }
    ];

    const isCancelled = order.orderStatus === 'CANCELLED';

    // Map actual timestamps from statusHistory
    const milestoneStatusMap = {};
    if (Array.isArray(order.statusHistory)) {
      order.statusHistory.forEach((entry) => {
        if (!milestoneStatusMap[entry.status]) {
          milestoneStatusMap[entry.status] = {
            timestamp: entry.timestamp || entry.changedAt,
            message: entry.customerSafeMessage || entry.note || `Status marked as ${entry.status}`,
            updatedByRole: entry.changedBy?.role || 'SYSTEM'
          };
        }
      });
    }

    const currentStatusIndex = MILESTONES.findIndex((m) => m.key === order.orderStatus);

    const timeline = MILESTONES.map((m, idx) => {
      const isReached = isCancelled
        ? !!milestoneStatusMap[m.key]
        : (currentStatusIndex !== -1 && idx <= currentStatusIndex) || !!milestoneStatusMap[m.key];
      const isCurrent = !isCancelled && order.orderStatus === m.key;
      const historyInfo = milestoneStatusMap[m.key] || null;

      return {
        key: m.key,
        title: m.title,
        description: m.description,
        isCompleted: isReached && !isCurrent,
        isCurrent: isCurrent,
        timestamp: historyInfo?.timestamp || null,
        message: historyInfo?.message || null
      };
    });

    // Sanitize shop fulfillment info
    let shopsData = order.shops || [];
    let itemsData = order.items || [];

    if (userRole === 'OWNER') {
      // Isolation: Shop owners see only their fulfillment info
      shopsData = shopsData.filter((s) => s.ownerId.toString() === userId);
      itemsData = itemsData.filter((i) => i.ownerId.toString() === userId);
    }

    const formattedHistory = (order.statusHistory || []).map((h) => ({
      status: h.status,
      timestamp: h.timestamp || h.changedAt,
      customerSafeMessage: h.customerSafeMessage || h.note || `Order status updated to ${h.status}`,
      updatedBy: userRole === 'ADMIN' ? (h.changedBy?.name || 'System') : undefined
    }));

    return res.status(200).json({
      success: true,
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        orderStatus: order.orderStatus,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        isCancelled,
        cancellation: isCancelled ? {
          cancelledAt: order.cancellation?.cancelledAt || order.updatedAt,
          reason: order.cancellation?.reason || 'Order cancelled'
        } : null,
        trackingMode: 'ORDER_STATUS_TRACKING',
        trackingDisclaimer: 'Milestone-based internal order tracking. Real-time GPS or third-party courier telemetry is not integrated.',
        timeline,
        statusHistory: formattedHistory,
        shippingAddress: {
          fullName: order.shippingAddress.fullName,
          city: order.shippingAddress.city,
          state: order.shippingAddress.state,
          postalCode: order.shippingAddress.postalCode,
          addressLine: order.shippingAddress.addressLine
        },
        shops: shopsData.map((s) => ({
          shopId: s.shopId,
          shopName: s.shopName,
          fulfillmentStatus: s.fulfillmentStatus,
          statusHistory: (s.statusHistory || []).map((sh) => ({
            status: sh.status,
            timestamp: sh.timestamp || sh.changedAt,
            customerSafeMessage: sh.customerSafeMessage || sh.note || ''
          }))
        })),
        items: itemsData.map((it) => ({
          _id: it._id,
          partName: it.partName,
          partNumber: it.partNumber,
          quantity: it.quantity,
          shopName: it.shopName,
          unitPrice: it.unitPrice,
          subtotal: it.subtotal,
          imagePath: it.imagePath
        }))
      }
    });
  } catch (error) {
    logger.error('Error fetching order tracking info:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve order tracking information.'
    });
  }
};

