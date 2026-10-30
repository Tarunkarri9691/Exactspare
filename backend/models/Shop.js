import mongoose from 'mongoose';

const shopSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner ID is required'],
      unique: true,
      index: true
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShopApplication',
      required: false,
      sparse: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Shop name is required'],
      trim: true
    },
    category: {
      type: String,
      enum: ['BIKE', 'CAR', 'SCOOTER', 'BICYCLE', 'MULTI_CATEGORY', 'OTHER'],
      default: 'MULTI_CATEGORY'
    },
    description: {
      type: String,
      required: [true, 'Shop description is required']
    },
    address: {
      addressLine: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      location: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point'
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          required: true
        }
      }
    },
    contact: {
      phone: { type: String, required: true },
      email: { type: String, required: true }
    },
    openingHours: {
      type: String,
      default: 'Mon-Sat: 09:00 AM - 08:00 PM'
    },
    images: {
      type: [String],
      default: []
    },
    isApproved: {
      type: Boolean,
      default: true,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    deactivationReason: {
      type: String,
      default: ''
    },
    deactivatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deactivatedAt: {
      type: Date
    },
    approvedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual aliases to support flattened and nested field conventions
shopSchema.virtual('shopName')
  .get(function () { return this.name; })
  .set(function (v) { this.name = v; });

shopSchema.virtual('imagePaths')
  .get(function () { return this.images; })
  .set(function (v) { this.images = v; });

shopSchema.virtual('phone')
  .get(function () { return this.contact?.phone; })
  .set(function (v) {
    if (!this.contact) this.contact = {};
    this.contact.phone = v;
  });

shopSchema.virtual('email')
  .get(function () { return this.contact?.email; })
  .set(function (v) {
    if (!this.contact) this.contact = {};
    this.contact.email = v;
  });

shopSchema.virtual('addressLine')
  .get(function () { return this.address?.addressLine; })
  .set(function (v) {
    if (!this.address) this.address = {};
    this.address.addressLine = v;
  });

shopSchema.virtual('city')
  .get(function () { return this.address?.city; })
  .set(function (v) {
    if (!this.address) this.address = {};
    this.address.city = v;
  });

shopSchema.virtual('state')
  .get(function () { return this.address?.state; })
  .set(function (v) {
    if (!this.address) this.address = {};
    this.address.state = v;
  });

shopSchema.virtual('postalCode')
  .get(function () { return this.address?.postalCode; })
  .set(function (v) {
    if (!this.address) this.address = {};
    this.address.postalCode = v;
  });

// 2dsphere index for geospatial radius queries (Module 3/4/6)
shopSchema.index({ 'address.location': '2dsphere' });
shopSchema.index({ isApproved: 1, isActive: 1 });

const Shop = mongoose.model('Shop', shopSchema);

export default Shop;
