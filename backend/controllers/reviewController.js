import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Order from '../models/Order.js';
import SparePart from '../models/SparePart.js';
import Notification from '../models/Notification.js';
import { logger } from '../utils/logger.js';

/**
 * Helper to recalculate and persist averageRating and totalReviews on SparePart
 */
export const recalculateProductRatings = async (productId) => {
  try {
    const pId = new mongoose.Types.ObjectId(productId);
    const stats = await Review.aggregate([
      { $match: { productId: pId, moderationStatus: 'APPROVED' } },
      {
        $group: {
          _id: '$productId',
          totalReviews: { $sum: 1 },
          avgRating: { $avg: '$rating' }
        }
      }
    ]);

    if (stats.length > 0) {
      const avg = Math.round(stats[0].avgRating * 10) / 10;
      await SparePart.findByIdAndUpdate(pId, {
        averageRating: avg,
        totalReviews: stats[0].totalReviews
      });
    } else {
      await SparePart.findByIdAndUpdate(pId, {
        averageRating: 0,
        totalReviews: 0
      });
    }
  } catch (err) {
    logger.warn('Error recalculating product ratings:', err.message);
  }
};

/**
 * Customer: Submit a verified purchase review for a spare part
 * @route POST /api/products/:productId/reviews
 */
export const createProductReview = async (req, res) => {
  try {
    const customerId = req.user._id || req.user.id;
    const { productId } = req.params;
    const { rating, title = '', comment } = req.body;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    const product = await SparePart.findById(productId);
    if (!product || product.isArchived) {
      return res.status(404).json({
        success: false,
        message: 'Spare part not found or has been archived'
      });
    }

    // Rule: Shop owners cannot review their own products
    if (product.ownerId.toString() === customerId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Shop owners cannot write reviews for their own products.'
      });
    }

    // Validation: Rating must be an integer between 1 and 5
    const parsedRating = Number(rating);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be an integer between 1 and 5'
      });
    }

    if (!comment || typeof comment !== 'string' || comment.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Review comment must be at least 5 characters long'
      });
    }

    if (comment.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Review comment cannot exceed 1000 characters'
      });
    }

    // Strict Rule: Customer must have purchased and received the product in a DELIVERED order
    const deliveredOrder = await Order.findOne({
      customerId,
      orderStatus: 'DELIVERED',
      'items.productId': product._id
    }).sort({ createdAt: -1 });

    if (!deliveredOrder) {
      return res.status(403).json({
        success: false,
        message: 'You can only review products that you have purchased and received (DELIVERED status).'
      });
    }

    // Rule: Prevent duplicate review for the same product and order
    const existingReview = await Review.findOne({
      productId: product._id,
      customerId,
      orderId: deliveredOrder._id
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product for your order. You can edit your existing review.'
      });
    }

    const newReview = await Review.create({
      productId: product._id,
      customerId,
      orderId: deliveredOrder._id,
      rating: parsedRating,
      title: title.trim(),
      comment: comment.trim(),
      verifiedPurchase: true,
      moderationStatus: 'APPROVED'
    });

    // Recalculate ratings
    await recalculateProductRatings(product._id);

    // Dispatch notification to shop owner
    try {
      await Notification.create({
        recipientId: product.ownerId,
        type: 'REVIEW_SUBMITTED',
        title: 'New Customer Review',
        message: `A verified customer submitted a ${parsedRating}-star review for "${product.partName}".`,
        relatedOrderId: deliveredOrder._id,
        relatedShopId: product.shopId
      });
    } catch (notifErr) {
      logger.warn('Failed to send review notification to owner:', notifErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Thank you! Your verified review has been published.',
      data: {
        review: newReview
      }
    });
  } catch (error) {
    logger.error('Error creating product review:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit review'
    });
  }
};

/**
 * Public: Retrieve reviews and rating summary for a spare part
 * @route GET /api/products/:productId/reviews
 */
export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    const pId = new mongoose.Types.ObjectId(productId);

    // 1. Calculate aggregated summary & rating distribution via MongoDB aggregation
    const [summaryResult, distributionResult] = await Promise.all([
      Review.aggregate([
        { $match: { productId: pId, moderationStatus: 'APPROVED' } },
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            avgRating: { $avg: '$rating' }
          }
        }
      ]),
      Review.aggregate([
        { $match: { productId: pId, moderationStatus: 'APPROVED' } },
        {
          $group: {
            _id: '$rating',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const totalReviews = summaryResult.length > 0 ? summaryResult[0].totalReviews : 0;
    const averageRating =
      summaryResult.length > 0 ? Math.round(summaryResult[0].avgRating * 10) / 10 : 0;

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    distributionResult.forEach((d) => {
      if (d._id >= 1 && d._id <= 5) {
        ratingDistribution[d._id] = d.count;
      }
    });

    // 2. Fetch paginated reviews list
    const reviews = await Review.find({ productId: pId, moderationStatus: 'APPROVED' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('customerId', 'name')
      .lean();

    const formattedReviews = reviews.map((r) => {
      const rawName = r.customerId?.name || 'Verified Customer';
      const parts = rawName.trim().split(' ');
      const displayName =
        parts.length > 1
          ? `${parts[0]} ${parts[parts.length - 1][0]}.`
          : parts[0];

      return {
        _id: r._id,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        verifiedPurchase: r.verifiedPurchase,
        createdAt: r.createdAt,
        reviewerName: displayName,
        isOwnReview: req.user ? r.customerId?._id?.toString() === req.user.id : false
      };
    });

    // 3. If authenticated customer, determine if they are eligible to review
    let canReview = false;
    let userReview = null;

    if (req.user && req.user.role === 'CUSTOMER') {
      const deliveredOrder = await Order.findOne({
        customerId: req.user.id,
        orderStatus: 'DELIVERED',
        'items.productId': pId
      });

      if (deliveredOrder) {
        const existing = await Review.findOne({
          productId: pId,
          customerId: req.user.id,
          orderId: deliveredOrder._id
        });

        if (existing) {
          userReview = existing;
        } else {
          canReview = true;
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          averageRating,
          totalReviews,
          ratingDistribution
        },
        reviews: formattedReviews,
        canReview,
        userReview,
        pagination: {
          page,
          limit,
          total: totalReviews,
          pages: Math.ceil(totalReviews / limit) || 1
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching product reviews:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve reviews'
    });
  }
};

/**
 * Customer: Update own review
 * @route PATCH /api/reviews/:reviewId
 */
export const updateReview = async (req, res) => {
  try {
    const customerId = req.user._id || req.user.id;
    const { reviewId } = req.params;
    const { rating, title, comment } = req.body;

    if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID'
      });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Ownership check: only original reviewer can edit
    if (review.customerId.toString() !== customerId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You cannot modify another customer’s review.'
      });
    }

    if (rating !== undefined) {
      const parsedRating = Number(rating);
      if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Rating must be an integer between 1 and 5'
        });
      }
      review.rating = parsedRating;
    }

    if (title !== undefined) {
      review.title = String(title).trim().substring(0, 100);
    }

    if (comment !== undefined) {
      if (typeof comment !== 'string' || comment.trim().length < 5) {
        return res.status(400).json({
          success: false,
          message: 'Review comment must be at least 5 characters long'
        });
      }
      review.comment = comment.trim().substring(0, 1000);
    }

    await review.save();
    await recalculateProductRatings(review.productId);

    return res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      data: {
        review
      }
    });
  } catch (error) {
    logger.error('Error updating review:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update review'
    });
  }
};

/**
 * Customer or Admin: Delete a review
 * @route DELETE /api/reviews/:reviewId
 */
export const deleteReview = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const userRole = req.user.role;
    const { reviewId } = req.params;

    if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID'
      });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Ownership check: only author or admin can delete
    if (review.customerId.toString() !== userId.toString() && userRole !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You cannot delete another customer’s review.'
      });
    }

    const productId = review.productId;
    await Review.findByIdAndDelete(reviewId);
    await recalculateProductRatings(productId);

    return res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
      data: {
        deletedId: reviewId
      }
    });
  } catch (error) {
    logger.error('Error deleting review:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete review'
    });
  }
};
