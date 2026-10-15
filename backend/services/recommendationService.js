import SparePart from '../models/SparePart.js';
import Shop from '../models/Shop.js';

/**
 * Smart Product Recommendations Engine
 * Uses verified MongoDB data to suggest compatible alternatives, similar parts, and maintenance items.
 */
export const getSmartRecommendations = async ({
  productId = null,
  category = '',
  vehicleType = '',
  make = '',
  model = '',
  limit = 4
} = {}) => {
  // Fetch active, approved shops
  const activeShops = await Shop.find({ isApproved: true, isActive: true }).select('_id shopName address city');
  if (activeShops.length === 0) return [];

  const shopIds = activeShops.map((s) => s._id);
  const shopMap = new Map();
  activeShops.forEach((s) => {
    shopMap.set(s._id.toString(), {
      shopName: s.shopName,
      city: s.address?.city || s.city || 'Local Area'
    });
  });

  let targetPart = null;
  let searchCategory = category;
  let searchVehicleType = vehicleType;
  let searchMake = make;
  let searchModel = model;

  // If a base productId is provided, inspect its specifications
  if (productId) {
    targetPart = await SparePart.findById(productId).lean();
    if (targetPart) {
      if (!searchCategory) searchCategory = targetPart.category;
      if (!searchVehicleType) searchVehicleType = targetPart.vehicleType;
      if (!searchMake && targetPart.compatibleMakes?.length > 0) {
        searchMake = targetPart.compatibleMakes[0];
      }
      if (!searchModel && targetPart.compatibleModels?.length > 0) {
        searchModel = targetPart.compatibleModels[0];
      }
    }
  }

  const query = {
    shopId: { $in: shopIds },
    isPublished: true,
    isArchived: false,
    isModerated: false
  };

  // Exclude current product
  if (targetPart) {
    query._id = { $ne: targetPart._id };
  }

  // Same category or vehicle type
  const orConditions = [];
  if (searchCategory) {
    orConditions.push({ category: searchCategory });
  }
  if (searchVehicleType) {
    orConditions.push({ vehicleType: searchVehicleType });
  }
  if (searchModel) {
    orConditions.push({ compatibleModels: { $regex: new RegExp(searchModel, 'i') } });
  }

  if (orConditions.length > 0) {
    query.$or = orConditions;
  }

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 4, 1), 8);
  const recommendations = await SparePart.find(query)
    .sort({ averageRating: -1, stockQuantity: -1, createdAt: -1 })
    .limit(safeLimit)
    .lean();

  return recommendations.map((p) => {
    const shopInfo = shopMap.get(p.shopId.toString()) || { shopName: 'Verified Dealer', city: 'India' };
    
    // Determine recommendation badge/reason
    let recommendationReason = 'Similar Category';
    if (targetPart && p.category === targetPart.category && p.manufacturer !== targetPart.manufacturer) {
      recommendationReason = 'Alternative Brand';
    } else if (searchModel && p.compatibleModels?.some((m) => m.toLowerCase().includes(searchModel.toLowerCase()))) {
      recommendationReason = 'Compatible Alternative';
    } else if (p.averageRating >= 4.0) {
      recommendationReason = 'Top Customer Rated';
    }

    return {
      _id: p._id,
      partName: p.partName,
      slug: p.slug,
      partNumber: p.partNumber,
      category: p.category,
      vehicleType: p.vehicleType,
      manufacturer: p.manufacturer,
      price: p.price,
      stockQuantity: p.stockQuantity,
      availabilityStatus: p.availabilityStatus,
      condition: p.condition || 'NEW',
      image: (p.imagePaths && p.imagePaths.length > 0) ? p.imagePaths[0] : null,
      averageRating: p.averageRating || 0,
      totalReviews: p.totalReviews || 0,
      compatibleMakes: p.compatibleMakes || [],
      compatibleModels: p.compatibleModels || [],
      compatibleYears: p.compatibleYears || [],
      shopName: shopInfo.shopName,
      shopCity: shopInfo.city,
      recommendationReason
    };
  });
};

export default { getSmartRecommendations };
