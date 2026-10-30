import mongoose from 'mongoose';

const subscriptionHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
      enum: ['NOT_SUBSCRIBED', 'PENDING_VERIFICATION', 'ACTIVE', 'EXPIRED', 'PAYMENT_FAILED']
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    note: {
      type: String,
      default: ''
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const subscriptionSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner ID is required'],
      index: true
    },
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      default: null,
      index: true
    },
    planId: {
      type: String,
      required: [true, 'Plan ID is required'],
      default: 'quarterly_partner'
    },
    planName: {
      type: String,
      required: [true, 'Plan name is required'],
      default: 'Merchant Partner Quarterly Plan'
    },
    amount: {
      type: Number,
      required: [true, 'Subscription amount is required'],
      default: 499
    },
    currency: {
      type: String,
      default: 'INR'
    },
    billingDurationDays: {
      type: Number,
      required: [true, 'Billing duration in days is required'],
      default: 90
    },
    internalRef: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    paymentMethod: {
      type: String,
      enum: ['UPI_QR', 'GOOGLE_PAY', 'PHONEPE', 'PAYTM', 'BHIM_UPI', 'OTHER_UPI'],
      default: 'UPI_QR'
    },
    paymentUtr: {
      type: String,
      default: '',
      trim: true,
      index: true
    },
    status: {
      type: String,
      enum: ['NOT_SUBSCRIBED', 'PENDING_VERIFICATION', 'ACTIVE', 'EXPIRED', 'PAYMENT_FAILED'],
      default: 'NOT_SUBSCRIBED',
      index: true
    },
    verificationMethod: {
      type: String,
      enum: ['MANUAL_ADMIN', 'BANK_RECONCILIATION', 'PROVIDER_API', 'DIRECT_PAYMENT', 'INSTANT_APPROVAL'],
      default: 'DIRECT_PAYMENT'
    },
    startDate: {
      type: Date,
      default: null
    },
    expiryDate: {
      type: Date,
      default: null,
      index: true
    },
    submittedAt: {
      type: Date,
      default: null
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    verifiedAt: {
      type: Date,
      default: null
    },
    rejectionReason: {
      type: String,
      default: '',
      trim: true
    },
    notes: {
      type: String,
      default: ''
    },
    history: {
      type: [subscriptionHistorySchema],
      default: []
    },
    remindersSent: {
      type: [String],
      default: []
    },
    lastReminderAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for fast owner lookups and status queries
subscriptionSchema.index({ ownerId: 1, createdAt: -1 });
subscriptionSchema.index({ status: 1, createdAt: -1 });
subscriptionSchema.index({ paymentUtr: 1, status: 1 });

const Subscription = mongoose.model('Subscription', subscriptionSchema);

export default Subscription;
