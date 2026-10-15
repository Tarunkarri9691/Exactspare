import mongoose from 'mongoose';
import crypto from 'crypto';

const sparePartSchema = new mongoose.Schema(
  {
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop reference is required'],
      index: true
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner reference is required'],
      index: true
    },
    partName: {
      type: String,
      required: [true, 'Part name is required'],
      trim: true,
      maxlength: [120, 'Part name cannot exceed 120 characters']
    },
    slug: {
      type: String,
      trim: true,
      index: true
    },
    description: {
      type: String,
      required: [true, 'Part description is required'],
      trim: true,
      maxlength: [3000, 'Description cannot exceed 3000 characters']
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true
    },
    subcategory: {
      type: String,
      trim: true,
      default: ''
    },
    vehicleType: {
      type: String,
      required: [true, 'Vehicle type is required'],
      enum: {
        values: ['Bike', 'Car', 'Scooter', 'Bicycle', 'Other'],
        message: '{VALUE} is not a valid vehicle type. Allowed types: Bike, Car, Scooter, Bicycle, Other.'
      }
    },
    compatibleMakes: {
      type: [String],
      default: []
    },
    compatibleModels: {
      type: [String],
      default: []
    },
    compatibleYears: {
      type: [String],
      default: []
    },
    engineDetails: {
      type: String,
      trim: true,
      default: ''
    },
    manufacturer: {
      type: String,
      required: [true, 'Manufacturer/brand name is required'],
      trim: true
    },
    partNumber: {
      type: String,
      required: [true, 'Part number or SKU is required'],
      trim: true,
      index: true
    },
    condition: {
      type: String,
      enum: {
        values: ['NEW', 'USED'],
        message: 'Condition must be either NEW or USED'
      },
      default: 'NEW'
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative']
    },
    stockQuantity: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      min: [0, 'Stock quantity cannot be negative'],
      default: 1
    },
    imagePaths: {
      type: [String],
      default: []
    },
    availabilityStatus: {
      type: String,
      enum: ['IN_STOCK', 'OUT_OF_STOCK', 'DISCONTINUED'],
      default: 'IN_STOCK',
      index: true
    },
    isPublished: {
      type: Boolean,
      default: true,
      index: true
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Pre-save hook: auto-compute availabilityStatus & generate slug
sparePartSchema.pre('save', function (next) {
  // Stock availability logic
  if (this.stockQuantity <= 0) {
    this.availabilityStatus = 'OUT_OF_STOCK';
  } else if (this.availabilityStatus !== 'DISCONTINUED') {
    this.availabilityStatus = 'IN_STOCK';
  }

  // Slug generation
  if (!this.slug || this.isModified('partName')) {
    const baseSlug = this.partName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const randomSuffix = crypto.randomBytes(3).toString('hex');
    this.slug = `${baseSlug}-${randomSuffix}`;
  }

  next();
});

// Compound indexes for performant search & filtering
sparePartSchema.index({ shopId: 1, isArchived: 1, isPublished: 1 });
sparePartSchema.index({ vehicleType: 1, category: 1, availabilityStatus: 1, isPublished: 1, isArchived: 1 });
sparePartSchema.index({ partName: 'text', partNumber: 'text', manufacturer: 'text', description: 'text' });

const SparePart = mongoose.model('SparePart', sparePartSchema);

export default SparePart;
