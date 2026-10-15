import mongoose from 'mongoose';

const wishlistItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SparePart',
      required: true,
      index: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const wishlistSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    items: [wishlistItemSchema]
  },
  {
    timestamps: true
  }
);

const Wishlist = mongoose.model('Wishlist', wishlistSchema);

export default Wishlist;
