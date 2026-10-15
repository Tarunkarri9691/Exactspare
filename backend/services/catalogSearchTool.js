import SparePart from '../models/SparePart.js';
import Shop from '../models/Shop.js';

/**
 * Escapes characters for safe regular expression querying
 */
const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Tool for AI Assistant and Recommendation Engine:
 * Queries MongoDB strictly for verified, published spare parts from approved, active shops.
 */
export const searchVerifiedCatalog = async ({
  query = '',
  vehicleType = '',
  make = '',
  model = '',
  year = '',
  category = '',
  maxPrice = null,
  inStock = false,
  limit = 6
} = {}) => {
  // 1. Fetch all approved & active shop IDs
  const activeShops = await Shop.find({
    isApproved: true,
    isActive: true
  }).select('_id shopName address city');

  if (activeShops.length === 0) {
    return [];
  }

  const shopIds = activeShops.map((s) => s._id);
  const shopMap = new Map();
  activeShops.forEach((s) => {
    shopMap.set(s._id.toString(), {
      shopName: s.shopName,
      city: s.address?.city || s.city || 'Local Area'
    });
  });

  // 2. Build MongoDB query
  const filter = {
    shopId: { $in: shopIds },
    isPublished: true,
    isArchived: false,
    isModerated: false
  };

  // Text / Keyword Search
  if (query && query.trim()) {
    const cleanQuery = escapeRegex(query.trim());
    filter.$or = [
      { partName: { $regex: cleanQuery, $options: 'i' } },
      { partNumber: { $regex: cleanQuery, $options: 'i' } },
      { category: { $regex: cleanQuery, $options: 'i' } },
      { description: { $regex: cleanQuery, $options: 'i' } }
    ];
  }

  // Vehicle Type Filter
  if (vehicleType && ['Bike', 'Car', 'Scooter', 'Bicycle', 'Other'].includes(vehicleType)) {
    filter.vehicleType = vehicleType;
  }

  // Make Filter
  if (make && make.trim()) {
    filter.compatibleMakes = { $regex: new RegExp(`^${escapeRegex(make.trim())}$`, 'i') };
  }

  // Model Filter
  if (model && model.trim()) {
    filter.compatibleModels = { $regex: new RegExp(escapeRegex(model.trim()), 'i') };
  }

  // Year Filter
  if (year && String(year).trim()) {
    filter.compatibleYears = String(year).trim();
  }

  // Category Filter
  if (category && category.trim()) {
    filter.category = { $regex: new RegExp(escapeRegex(category.trim()), 'i') };
  }

  // Max Price
  if (maxPrice !== null && !isNaN(maxPrice) && Number(maxPrice) > 0) {
    filter.price = { $lte: Number(maxPrice) };
  }

  // In Stock Filter
  if (inStock) {
    filter.stockQuantity = { $gt: 0 };
    filter.availabilityStatus = 'IN_STOCK';
  }

  // 3. Execute Query with limit
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 6, 1), 12);
  const parts = await SparePart.find(filter)
    .sort({ averageRating: -1, stockQuantity: -1, price: 1 })
    .limit(safeLimit)
    .lean();

  // 4. Transform into standardized product card objects
  return parts.map((p) => {
    const shopInfo = shopMap.get(p.shopId.toString()) || { shopName: 'Verified Dealer', city: 'India' };
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
      shopCity: shopInfo.city
    };
  });
};

export default { searchVerifiedCatalog };
