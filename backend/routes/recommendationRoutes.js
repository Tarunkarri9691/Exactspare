import express from 'express';
import { getRecommendations } from '../controllers/recommendationController.js';

const router = express.Router();

/**
 * Smart Product Recommendations Endpoint
 * GET /api/recommendations
 */
router.get('/', getRecommendations);

export default router;
