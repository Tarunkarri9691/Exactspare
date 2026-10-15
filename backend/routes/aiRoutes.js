import express from 'express';
import { handleAssistantChat, getAssistantStatus } from '../controllers/aiAssistantController.js';
import { aiLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * AI Assistant Chat Endpoint
 * POST /api/ai/assistant
 */
router.post('/assistant', aiLimiter, handleAssistantChat);

/**
 * AI Provider Configuration & Health Status
 * GET /api/ai/status
 */
router.get('/status', getAssistantStatus);

export default router;
