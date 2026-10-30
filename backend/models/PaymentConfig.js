import mongoose from 'mongoose';

const paymentConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'ADMIN_SCANNER'
    },
    upiId: {
      type: String,
      required: true,
      default: 'exactspare.merchant@upi'
    },
    payeeName: {
      type: String,
      required: true,
      default: 'EXACTSPARE Merchant Services'
    },
    registrationFee: {
      type: Number,
      required: true,
      default: 499
    },
    qrCodeImage: {
      type: String,
      default: '' // Can be uploaded or base64 or URL
    },
    instructions: {
      type: String,
      default: 'Scan this Admin QR code with Google Pay, PhonePe, Paytm, or BHIM. Enter your 12-digit UTR/Reference number below to submit for administrative verification.'
    },
    planName: {
      type: String,
      default: 'Merchant Partner Subscription'
    },
    billingDurationDays: {
      type: Number,
      default: 90
    },
    subscriptionFee: {
      type: Number,
      default: 499
    },
    currency: {
      type: String,
      default: 'INR'
    },
    plans: {
      type: [
        {
          planId: { type: String, required: true },
          name: { type: String, required: true },
          amount: { type: Number, required: true },
          billingDurationDays: { type: Number, required: true },
          badge: { type: String, default: '' },
          description: { type: String, default: '' },
          features: { type: [String], default: [] }
        }
      ],
      default: [
        {
          planId: 'quarterly_partner',
          name: 'Merchant Partner Quarterly Plan',
          amount: 499,
          billingDurationDays: 90,
          badge: 'Most Popular',
          description: 'Quarterly subscription for verified shop owners with full catalog, location search, and customer enquiries.',
          features: [
            'Full spare parts catalog listing & search indexing',
            'Customer enquiries & direct phone contacts',
            'Shop location map placement & GPS directions',
            'Order tracking & merchant fulfillment portal',
            'Admin verified trust badge & safety assurance'
          ]
        },
        {
          planId: 'annual_pro',
          name: 'Merchant Partner Annual Pro',
          amount: 1499,
          billingDurationDays: 365,
          badge: 'Best Value',
          description: 'Full 1-year premium merchant subscription with priority search ranking and unlimited part listings.',
          features: [
            'All Quarterly Plan features included for 365 days',
            'Priority placement in local area search results',
            'Unlimited spare parts catalog capacity',
            'Direct customer enquiry SMS / Email dispatch',
            'Dedicated platform merchant support'
          ]
        }
      ]
    },
    isActive: {
      type: Boolean,
      default: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

const PaymentConfig = mongoose.model('PaymentConfig', paymentConfigSchema);

export default PaymentConfig;
