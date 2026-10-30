import mongoose from 'mongoose';

const enquiryReplySchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    senderRole: {
      type: String,
      enum: ['OWNER', 'CUSTOMER', 'ADMIN'],
      required: true
    },
    senderName: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const enquirySchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer ID is required'],
      index: true
    },
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop ID is required'],
      index: true
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner ID is required'],
      index: true
    },
    sparePartId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SparePart',
      default: null,
      index: true
    },
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      maxlength: 100
    },
    customerEmail: {
      type: String,
      required: [true, 'Customer email is required'],
      trim: true,
      lowercase: true,
      maxlength: 150
    },
    customerPhone: {
      type: String,
      default: '',
      trim: true,
      maxlength: 30
    },
    subject: {
      type: String,
      required: [true, 'Enquiry subject is required'],
      trim: true,
      minlength: [2, 'Subject must be at least 2 characters'],
      maxlength: [200, 'Subject cannot exceed 200 characters']
    },
    message: {
      type: String,
      required: [true, 'Enquiry message is required'],
      trim: true,
      minlength: [5, 'Message must be at least 5 characters long'],
      maxlength: [2000, 'Message cannot exceed 2000 characters']
    },
    vehicleInfo: {
      make: { type: String, default: '', trim: true, maxlength: 60 },
      model: { type: String, default: '', trim: true, maxlength: 60 },
      year: { type: String, default: '', trim: true, maxlength: 20 },
      variant: { type: String, default: '', trim: true, maxlength: 60 },
      compatibilityQuestion: { type: String, default: '', trim: true, maxlength: 500 }
    },
    status: {
      type: String,
      enum: ['NEW', 'IN_PROGRESS', 'REPLIED', 'CLOSED'],
      default: 'NEW',
      index: true
    },
    isReadByOwner: {
      type: Boolean,
      default: false,
      index: true
    },
    isReadByCustomer: {
      type: Boolean,
      default: true,
      index: true
    },
    replies: [enquiryReplySchema]
  },
  {
    timestamps: true
  }
);

enquirySchema.index({ shopId: 1, createdAt: -1 });
enquirySchema.index({ ownerId: 1, status: 1, createdAt: -1 });
enquirySchema.index({ customerId: 1, createdAt: -1 });

const Enquiry = mongoose.model('Enquiry', enquirySchema);

export default Enquiry;
