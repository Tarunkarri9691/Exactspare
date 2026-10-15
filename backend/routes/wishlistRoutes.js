import express from 'express';
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  moveWishlistItemToCart
} from '../controllers/wishlistController.js';
import { authenticateUser, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Wishlist endpoints are restricted to authenticated Customers
router.use(authenticateUser);
router.use(authorizeRoles('CUSTOMER'));

router.get('/', getWishlist);
router.post('/items', addToWishlist);
router.delete('/items/:productId', removeFromWishlist);
router.post('/items/:productId/move-to-cart', moveWishlistItemToCart);

export default router;
