import express from 'express';
import {
  searchNearbyParts,
  getSearchMetadata,
  getRecentAvailableParts,
  geocodeAddress
} from '../controllers/searchController.js';

const router = express.Router();

/**
 * Public location-based search and discovery routes
 */
router.get('/nearby-parts', searchNearbyParts);
router.get('/meta', getSearchMetadata);
router.get('/recent-parts', getRecentAvailableParts);
router.get('/geocode', geocodeAddress);

export default router;
