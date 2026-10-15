import mongoose from 'mongoose';

const adminAuditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Admin ID is required'],
      index: true
    },
    action: {
      type: String,
      required: [true, 'Audit action is required'],
      index: true
    },
    entityType: {
      type: String,
      required: [true, 'Entity type is required'],
      enum: ['SHOP', 'SHOP_APPLICATION', 'USER', 'SPARE_PART', 'REVIEW', 'PLATFORM_CONFIG'],
      index: true
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Entity ID is required'],
      index: true
    },
    reason: {
      type: String,
      trim: true,
      default: ''
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// Indexes for fast administrative querying & filtering
adminAuditLogSchema.index({ createdAt: -1 });
adminAuditLogSchema.index({ action: 1, createdAt: -1 });
adminAuditLogSchema.index({ entityType: 1, createdAt: -1 });
adminAuditLogSchema.index({ adminId: 1, createdAt: -1 });

const AdminAuditLog = mongoose.model('AdminAuditLog', adminAuditLogSchema);

export default AdminAuditLog;
