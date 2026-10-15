import { compareProducts } from '../services/productCompareService.js';
import { logger } from '../utils/logger.js';

/**
 * Handle product comparison request
 * @route POST /api/products/compare
 */
export const compareProductsHandler = async (req, res, next) => {
  try {
    const { productIds } = req.body;

    if (!Array.isArray(productIds)) {
      return res.status(400).json({
        success: false,
        message: 'productIds must be an array of product IDs.'
      });
    }

    if (productIds.length < 2 || productIds.length > 4) {
      return res.status(400).json({
        success: false,
        message: 'Please provide between 2 and 4 product IDs for comparison.'
      });
    }

    const comparisonData = await compareProducts(productIds);

    res.status(200).json({
      success: true,
      ...comparisonData
    });
  } catch (error) {
    if (error.message.includes('comparison') || error.message.includes('required')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    logger.error('Error in compareProductsHandler:', error);
    next(error);
  }
};

export default { compareProductsHandler };
