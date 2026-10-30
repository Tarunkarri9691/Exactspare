import express from 'express';
import {
  searchNearbyParts,
  getSearchMetadata,
  getRecentAvailableParts,
  geocodeAddress,
  getDirectionsRoute,
  getSearchSuggestions,
  searchByIdentifier,
  searchByImage
} from '../controllers/searchController.js';
import { uploadSearchImage } from '../utils/upload.js';
import { imageSearchLimiter } from '../middleware/rateLimiter.js';

import { publicCache } from '../middleware/cacheMiddleware.js';

const router = express.Router();

/**
 * Public location-based search and discovery routes
 */
router.get('/nearby-parts', searchNearbyParts);
router.get('/meta', publicCache(60), getSearchMetadata);
router.get('/recent-parts', publicCache(30), getRecentAvailableParts);
router.get('/geocode', geocodeAddress);
router.get('/route', getDirectionsRoute);

/**
 * Module 11: Suggestions, Identifier and Image-based Search
 */
router.get('/suggestions', publicCache(30), getSearchSuggestions);
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
