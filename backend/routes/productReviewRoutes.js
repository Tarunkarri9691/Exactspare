import express from 'express';
import {
  getProductReviews,
  createProductReview
} from '../controllers/reviewController.js';
import {
  authenticateUser,
  authorizeRoles,
  optionalAuthenticateUser
} from '../middleware/authMiddleware.js';

const router = express.Router({ mergeParams: true });

// GET /api/products/:productId/reviews (Public with optional user context for canReview/userReview)
router.get('/:productId/reviews', optionalAuthenticateUser, getProductReviews);

// POST /api/products/:productId/reviews (Verified Customer Purchase only)
router.post(
  '/:productId/reviews',
  authenticateUser,
  authorizeRoles('CUSTOMER'),
  createProductReview
);

export default router;
