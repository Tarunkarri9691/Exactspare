import express from 'express';
import {
  updateReview,
  deleteReview
} from '../controllers/reviewController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticateUser);

router.patch('/:reviewId', updateReview);
router.delete('/:reviewId', deleteReview);

export default router;
