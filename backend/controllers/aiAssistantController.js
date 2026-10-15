import { processAssistantMessage, getAiProviderStatus } from '../services/aiProvider.js';
import { searchVerifiedCatalog } from '../services/catalogSearchTool.js';
import { extractSearchIntent } from '../services/nlpSearchFallback.js';
import { logger } from '../utils/logger.js';

/**
 * Handle AI Assistant chat messages
 * @route POST /api/ai/assistant
 */
export const handleAssistantChat = async (req, res, next) => {
  try {
    const { message, history = [], context = {} } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A non-empty text message is required.'
      });
    }

    if (message.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot exceed 500 characters.'
      });
    }

    // 1. Extract search intent from natural language
    const intent = extractSearchIntent(message);

    // Merge any contextual parameters passed from client (e.g. user selected vehicle in UI)
    const searchParams = {
      query: intent.query,
      vehicleType: context.vehicleType || intent.vehicleType,
      make: context.make || intent.make,
      model: context.model || intent.model,
      year: context.year || intent.year,
      category: context.category || intent.category,
      maxPrice: intent.maxPrice,
      inStock: true, // Assistant highlights parts ready to buy
      limit: 6
    };

    // 2. Query MongoDB for real, verified products
    const matchedProducts = await searchVerifiedCatalog(searchParams);

    // 3. Process advice & natural conversational response (AI or rule-based fallback)
    const result = await processAssistantMessage({
      message,
      history,
      matchedProducts
    });

    const payload = {
      isAiPowered: result.isAiPowered,
      providerMode: result.providerMode,
      response: result.response,
      followUps: result.followUps,
      missingDetails: result.missingDetails,
      products: matchedProducts,
      appliedFilters: {
        vehicleType: searchParams.vehicleType || null,
        make: searchParams.make || null,
        model: searchParams.model || null,
        category: searchParams.category || null,
        maxPrice: searchParams.maxPrice || null
      }
    };

    res.status(200).json({
      success: true,
      ...payload,
      data: payload
    });
  } catch (error) {
    logger.error('Error in handleAssistantChat controller:', error);
    next(error);
  }
};

/**
 * Check AI Provider configuration status
 * @route GET /api/ai/status
 */
export const getAssistantStatus = (req, res) => {
  const status = getAiProviderStatus();
  res.status(200).json({
    success: true,
    ...status,
    data: status
  });
};

export default { handleAssistantChat, getAssistantStatus };
