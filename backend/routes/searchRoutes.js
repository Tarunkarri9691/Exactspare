import express from 'express';
import {
  searchNearbyParts,
  getSearchMetadata,
  getRecentAvailableParts,
  geocodeAddress,
  getSearchSuggestions,
  searchByIdentifier,
  searchByImage
} from '../controllers/searchController.js';
import { uploadSearchImage } from '../utils/upload.js';
import { imageSearchLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * Public location-based search and discovery routes
 */
router.get('/nearby-parts', searchNearbyParts);
router.get('/meta', getSearchMetadata);
router.get('/recent-parts', getRecentAvailableParts);
router.get('/geocode', geocodeAddress);

/**
 * Module 11: Suggestions, Identifier and Image-based Search
 */
router.get('/suggestions', getSearchSuggestions);
router.get('/identifier', searchByIdentifier);
router.post(
  '/image',
  imageSearchLimiter,
  (req, res, next) => {
    uploadSearchImage(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          status: 'error',
          message: err.message || 'Invalid image upload. Only JPG, PNG, and WebP images up to 5MB are permitted.'
        });
      }
      next();
    });
  },
  searchByImage
);

export default router;
