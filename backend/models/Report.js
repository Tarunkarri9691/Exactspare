import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporter reference is required'],
      index: true
    },
    targetType: {
      type: String,
      required: [true, 'Target type is required'],
      enum: {
        values: ['PRODUCT', 'SHOP'],
        message: 'Target type must be either PRODUCT or SHOP'
      },
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
      required: [true, 'Associated shop reference is required'],
      index: true
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null
    },
    category: {
      type: String,
      required: [true, 'Report category is required'],
      enum: {
        values: [
          'INCORRECT_INFO',
          'SUSPECTED_COUNTERFEIT',
          'MISLEADING_PRICING',
          'INCORRECT_COMPATIBILITY',
          'UNRESPONSIVE_SHOP',
          'OTHER'
        ],
        message: 'Invalid report category'
      },
      index: true
    },
    description: {
      type: String,
      required: [true, 'Please provide detailed explanation for the report'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters long'],
      maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    evidenceUrls: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: {
        values: ['PENDING', 'INVESTIGATING', 'ACTIONED', 'DISMISSED'],
        message: 'Invalid report status'
      },
      default: 'PENDING',
      index: true
    },
    adminNotes: {
      type: String,
      trim: true,
      default: ''
    },
    assignedAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    resolvedAt: {
      type: Date,
      default: null
    },
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TrustCase',
      default: null,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Composite index to check for duplicate reports within a recent window
reportSchema.index({ reporterId: 1, targetType: 1, productId: 1, shopId: 1, createdAt: -1 });
reportSchema.index({ status: 1, createdAt: -1 });

const Report = mongoose.model('Report', reportSchema);

export default Report;
