import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient ID is required'],
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: [
        'APPLICATION_SUBMITTED',
        'APPLICATION_APPROVED',
        'APPLICATION_REJECTED',
        'CORRECTION_REQUESTED',
        'PAYMENT_PENDING_VERIFICATION',
        'PAYMENT_VERIFIED',
        'PAYMENT_REJECTED',
        'SUBSCRIPTION_PENDING_VERIFICATION',
        'SUBSCRIPTION_PENDING_ADMIN',
        'SUBSCRIPTION_ACTIVATED',
        'SUBSCRIPTION_REJECTED',
        'SUBSCRIPTION_EXPIRING',
        'SUBSCRIPTION_EXPIRED',
        'ORDER_PLACED',
        'ORDER_CONFIRMED',
        'ORDER_PROCESSING',
        'ORDER_READY_FOR_DISPATCH',
        'ORDER_SHIPPED',
        'ORDER_DELIVERED',
        'ORDER_CANCELLED',
        'NEW_ORDER_RECEIVED',
        'ORDER_STATUS_UPDATED',
        'REVIEW_SUBMITTED',
        'WISHLIST_ALERT',
        'SHOP_STATUS_UPDATED',
        'ACCOUNT_STATUS_UPDATED',
        'LISTING_MODERATED',
        'SUPPORT_TICKET_REPLY',
        'SUPPORT_TICKET_STATUS',
        'ORDER_TRACKING_UPDATE',
        'PART_ADDED',
        'PART_UPDATED',
        'PART_PUBLISHED',
        'PART_UNPUBLISHED',
        'PART_LOW_STOCK',
        'PART_OUT_OF_STOCK',
        'CUSTOMER_ENQUIRY',
        'SYSTEM'
      ],
      default: 'SYSTEM'
    },
    relatedOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true
    },
    relatedShopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      default: null,
      index: true
    },
    relatedPartId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SparePart',
      default: null,
      index: true
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    notificationKey: {
      type: String,
      default: null
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

notificationSchema.index({ recipientId: 1, isRead: 1 });
notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ notificationKey: 1 }, { sparse: true });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
