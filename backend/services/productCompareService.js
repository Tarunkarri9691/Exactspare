import SparePart from '../models/SparePart.js';
import Shop from '../models/Shop.js';

/**
 * Product Comparison Service
 * Compares 2 to 4 products from real MongoDB inventory fields with zero fabricated specs.
 */
export const compareProducts = async (productIds = []) => {
  if (!Array.isArray(productIds) || productIds.length < 2 || productIds.length > 4) {
    throw new Error('Comparison requires between 2 and 4 product IDs.');
  }

  // Fetch active, approved shops
  const activeShops = await Shop.find({ isApproved: true, isActive: true }).select('_id name shopName address city');
  const shopMap = new Map();
  activeShops.forEach((s) => {
    shopMap.set(s._id.toString(), {
      shopName: s.name || s.shopName || 'Verified Dealer',
      city: s.address?.city || s.city || 'Local Area'
    });
  });

  // Query MongoDB
  const parts = await SparePart.find({
    _id: { $in: productIds },
    isPublished: true,
    isArchived: false,
    isModerated: false
  }).lean();

  if (parts.length < 2) {
    throw new Error('At least 2 published, active spare parts are required for comparison.');
  }

  const formattedProducts = parts.map((p) => {
    const shopInfo = shopMap.get(p.shopId.toString()) || { shopName: 'Verified Dealer', city: 'India' };
    return {
      _id: p._id,
      partName: p.partName,
      slug: p.slug,
      partNumber: p.partNumber || 'Not provided',
      manufacturer: p.manufacturer || 'Not provided',
      category: p.category || 'Not provided',
      vehicleType: p.vehicleType || 'Not provided',
      condition: p.condition || 'NEW',
      price: p.price,
      stockQuantity: p.stockQuantity,
      availabilityStatus: p.availabilityStatus,
      averageRating: p.averageRating || 0,
      totalReviews: p.totalReviews || 0,
      image: (p.imagePaths && p.imagePaths.length > 0) ? p.imagePaths[0] : null,
      compatibleMakes: p.compatibleMakes || [],
      compatibleModels: p.compatibleModels || [],
      compatibleYears: p.compatibleYears || [],
      shopName: shopInfo.shopName,
      shopCity: shopInfo.city
    };
  });

  // Calculate comparison summary metrics
  const prices = formattedProducts.map((p) => p.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceDifference = maxPrice - minPrice;

  const lowestPricePart = formattedProducts.find((p) => p.price === minPrice);
  const highestRatedPart = [...formattedProducts].sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0))[0];

  return {
    products: formattedProducts,
    metrics: {
      count: formattedProducts.length,
      totalCompared: formattedProducts.length,
      lowestPrice: minPrice,
      highestPrice: maxPrice,
      priceDifference,
      lowestPriceId: lowestPricePart?._id ? lowestPricePart._id.toString() : null,
      lowestPricedPartId: lowestPricePart?._id ? lowestPricePart._id.toString() : null,
      highestRatedPartId: (highestRatedPart?.averageRating > 0 && highestRatedPart?._id) ? highestRatedPart._id.toString() : null
    }
  };
};

export default { compareProducts };
