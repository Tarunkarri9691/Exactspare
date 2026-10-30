import mongoose from 'mongoose';

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
      enum: ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'NEEDS_CORRECTION']
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
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

const shopApplicationSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner ID is required'],
      index: true
    },
    shopName: {
      type: String,
      required: [true, 'Shop name is required'],
      trim: true,
      minlength: [2, 'Shop name must be at least 2 characters long'],
      maxlength: [120, 'Shop name cannot exceed 120 characters']
    },
    ownerFullName: {
      type: String,
      required: [true, 'Owner full name is required'],
      trim: true
    },
    ownerPhone: {
      type: String,
      required: [true, 'Owner contact phone is required'],
      trim: true
    },
    alternatePhone: {
      type: String,
      default: '',
      trim: true
    },
    ownerBusinessRole: {
      type: String,
      default: 'Proprietor',
      trim: true
    },
    businessPhone: {
      type: String,
      default: '',
      trim: true
    },
    businessEmail: {
      type: String,
      required: [true, 'Business email is required'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid business email']
    },
    yearsInBusiness: {
      type: Number,
      default: 0
    },
    shopDescription: {
      type: String,
      required: [true, 'Shop description is required'],
      trim: true,
      minlength: [10, 'Shop description must be at least 10 characters long'],
      maxlength: [2000, 'Shop description cannot exceed 2000 characters']
    },
    shopCategory: {
      type: String,
      enum: {
        values: ['BIKE', 'CAR', 'SCOOTER', 'BICYCLE', 'MULTI_CATEGORY', 'OTHER'],
        message: 'Invalid shop category'
      },
      default: 'MULTI_CATEGORY'
    },
    addressLine: {
      type: String,
      required: [true, 'Shop address line is required'],
      trim: true
    },
    locality: {
      type: String,
      default: '',
      trim: true
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true
    },
    postalCode: {
      type: String,
      required: [true, 'Postal code is required'],
      trim: true
    },
    country: {
      type: String,
      default: 'India',
      trim: true
    },
    latitude: {
      type: Number,
      required: [true, 'Latitude is required'],
      min: [-90, 'Latitude must be between -90 and 90'],
      max: [90, 'Latitude must be between -90 and 90']
    },
    longitude: {
      type: Number,
      required: [true, 'Longitude is required'],
      min: [-180, 'Longitude must be between -180 and 180'],
      max: [180, 'Longitude must be between -180 and 180']
    },
    openingHours: {
      type: String,
      required: [true, 'Opening hours are required'],
      default: 'Mon-Sat: 09:00 AM - 08:00 PM'
    },
    shopExteriorImagePath: {
      type: String,
      default: ''
    },
    shopInteriorImagePath: {
      type: String,
      default: ''
    },
    shopImagePaths: {
      type: [String],
      default: []
    },
    verificationDocumentPaths: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: {
        values: ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'NEEDS_CORRECTION'],
        message: 'Invalid application status'
      },
      default: 'DRAFT',
      index: true
    },
    paymentStatus: {
      type: String,
      enum: ['UNPAID', 'PENDING_VERIFICATION', 'PAID', 'PAYMENT_FAILED'],
      default: 'UNPAID',
      index: true
    },
    paymentMethod: {
      type: String,
      default: 'UPI_SCANNER'
    },
    paymentUtr: {
      type: String,
      default: '',
      trim: true
    },
    paymentAmount: {
      type: Number,
      default: 499
    },
    paidAt: {
      type: Date,
      default: null
    },
    paymentVerifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    paymentVerifiedAt: {
      type: Date,
      default: null
    },
    paymentRejectionReason: {
      type: String,
      default: ''
    },
    directActivated: {
      type: Boolean,
      default: false
    },
    rejectionReason: {
      type: String,
      default: ''
    },
    correctionMessage: {
      type: String,
      default: ''
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    submittedAt: {
      type: Date,
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Index ownerId and status for rapid querying
shopApplicationSchema.index({ ownerId: 1, status: 1 });
shopApplicationSchema.index({ createdAt: -1 });

const ShopApplication = mongoose.model('ShopApplication', shopApplicationSchema);

export default ShopApplication;
