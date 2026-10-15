import { getSmartRecommendations } from '../services/recommendationService.js';
import { logger } from '../utils/logger.js';

/**
 * Retrieve smart product recommendations
 * @route GET /api/recommendations
 */
export const getRecommendations = async (req, res, next) => {
  try {
    const { productId, category, vehicleType, make, model, limit } = req.query;

    const recommendations = await getSmartRecommendations({
      productId: productId || null,
      category: category || '',
      vehicleType: vehicleType || '',
      make: make || '',
      model: model || '',
      limit: limit ? parseInt(limit, 10) : 4
    });

    res.status(200).json({
      success: true,
      count: recommendations.length,
      recommendations
    });
  } catch (error) {
    logger.error('Error fetching recommendations:', error);
    next(error);
  }
};

export default { getRecommendations };
