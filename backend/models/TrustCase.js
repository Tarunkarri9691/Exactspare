import mongoose from 'mongoose';

const signalSchema = new mongoose.Schema(
  {
    ruleId: {
      type: String,
      required: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM'
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    detectedAt: {
      type: Date,
      default: Date.now
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { _id: true }
);

const adminActionHistorySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        'STATUS_CHANGE',
        'REQUEST_CORRECTION',
        'FLAG_LISTING',
        'DELIST_PRODUCT',
        'RESTORE_PRODUCT',
        'SUSPEND_SHOP',
        'RESTORE_SHOP',
        'DISMISS_ALERT',
        'MANUAL_NOTE'
      ]
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    adminName: {
      type: String,
      required: true
    },
    reason: {
      type: String,
      required: [true, 'Action justification reason is required'],
      trim: true
    },
    confirmed: {
      type: Boolean,
      default: false
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const trustCaseSchema = new mongoose.Schema(
  {
    caseNumber: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    caseType: {
      type: String,
      required: true,
      enum: ['LISTING_ANOMALY', 'SHOP_TRUST_ALERT', 'USER_REPORT', 'COMPOSITE_ALERT'],
      default: 'LISTING_ANOMALY',
      index: true
    },
    targetType: {
      type: String,
      required: true,
      enum: ['PRODUCT', 'SHOP'],
      index: true
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SparePart',
      default: null,
      index: true
    },
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      index: true
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    status: {
      type: String,
      enum: ['OPEN', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'RESOLVED', 'DISMISSED'],
      default: 'OPEN',
      index: true
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
      index: true
    },
    signals: [signalSchema],
    reportIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Report'
      }
    ],
    reportCount: {
      type: Number,
      default: 0
    },
    aiAdvisory: {
      summary: { type: String, default: '' },
      inconsistencies: { type: [String], default: [] },
      suggestedActions: { type: [String], default: [] },
      provider: { type: String, default: 'none' }, // 'gemini' | 'openai' | 'rule_based_engine'
      isAiGenerated: { type: Boolean, default: false },
      generatedAt: { type: Date, default: null }
    },
    adminActions: [adminActionHistorySchema],
    resolutionNotes: {
      type: String,
      trim: true,
      default: ''
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    resolvedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Performance indexes for admin filtering
trustCaseSchema.index({ status: 1, severity: 1, createdAt: -1 });
trustCaseSchema.index({ targetType: 1, status: 1 });
trustCaseSchema.index({ shopId: 1, status: 1 });
trustCaseSchema.index({ productId: 1, status: 1 });

const TrustCase = mongoose.model('TrustCase', trustCaseSchema);

export default TrustCase;
