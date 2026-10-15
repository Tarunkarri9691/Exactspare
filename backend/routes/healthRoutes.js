import express from 'express';
import { getHealth, getDatabaseHealth } from '../controllers/healthController.js';

const router = express.Router();

/**
 * Health check routes
 * GET /api/health     - General API health
 * GET /api/health/db  - MongoDB connection health
 */
router.get('/', getHealth);
router.get('/db', getDatabaseHealth);

export default router;
