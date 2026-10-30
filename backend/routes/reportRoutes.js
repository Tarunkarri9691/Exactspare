import express from 'express';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { reportProduct, reportShop, getMyReports } from '../controllers/reportController.js';

const router = express.Router();

// All reporting routes require an authenticated user
router.use(authenticateUser);

// Customer report endpoints
router.post('/products/:productId', reportProduct);
router.post('/shops/:shopId', reportShop);
router.get('/my-reports', getMyReports);

export default router;
