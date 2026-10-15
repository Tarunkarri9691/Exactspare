import mongoose from 'mongoose';
import User from '../models/User.js';
import Shop from '../models/Shop.js';
import ShopApplication from '../models/ShopApplication.js';
import SparePart from '../models/SparePart.js';
import Order from '../models/Order.js';
import Review from '../models/Review.js';
import { logger } from '../utils/logger.js';

/**
 * GET /api/admin/analytics/overview
 * Real MongoDB statistics across all platform collections
 */
export const getAnalyticsOverview = async (req, res, next) => {
  try {
    const [
      totalCustomers,
      totalShopOwners,
      totalAdmins,
      totalShops,
      approvedShops,
      pendingApplications,
      rejectedApplications,
      totalSpareParts,
      publishedParts,
      totalOrders,
      awaitingProcessingOrders,
      deliveredOrders,
      cancelledOrders,
      financialStats
    ] = await Promise.all([
      User.countDocuments({ role: 'CUSTOMER' }),
      User.countDocuments({ role: 'OWNER' }),
      User.countDocuments({ role: 'ADMIN' }),
      Shop.countDocuments(),
      Shop.countDocuments({ isApproved: true, isActive: true }),
      ShopApplication.countDocuments({ status: 'PENDING' }),
      ShopApplication.countDocuments({ status: 'REJECTED' }),
      SparePart.countDocuments({ isArchived: false }),
      SparePart.countDocuments({ isArchived: false, isPublished: true }),
      Order.countDocuments(),
      Order.countDocuments({ orderStatus: { $in: ['PLACED', 'CONFIRMED', 'PROCESSING'] } }),
      Order.countDocuments({ orderStatus: 'DELIVERED' }),
      Order.countDocuments({ orderStatus: 'CANCELLED' }),
      Order.aggregate([
        {
          $group: {
            _id: null,
            totalGrossValue: {
              $sum: {
                $cond: [{ $ne: ['$orderStatus', 'CANCELLED'] }, '$totalAmount', 0]
              }
            },
            completedRevenue: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ['$orderStatus', 'DELIVERED'] },
                      { $and: [{ $eq: ['$paymentStatus', 'PAID'] }, { $ne: ['$orderStatus', 'CANCELLED'] }] }
                    ]
                  },
                  '$totalAmount',
                  0
                ]
              }
            },
            pendingCodRevenue: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$paymentMethod', 'COD'] },
                      { $ne: ['$paymentStatus', 'PAID'] },
                      { $in: ['$orderStatus', ['PLACED', 'CONFIRMED', 'PROCESSING', 'READY_FOR_DISPATCH', 'SHIPPED']] }
                    ]
                  },
                  '$totalAmount',
                  0
                ]
              }
            }
          }
        }
      ])
    ]);

    const financials = financialStats[0] || {
      totalGrossValue: 0,
      completedRevenue: 0,
      pendingCodRevenue: 0
    };

    return res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalCustomers + totalShopOwners + totalAdmins,
          customers: totalCustomers,
          shopOwners: totalShopOwners,
          administrators: totalAdmins
        },
        shops: {
          total: totalShops,
          approvedAndActive: approvedShops,
          pendingApplications,
          rejectedApplications
        },
        inventory: {
          total: totalSpareParts,
          published: publishedParts,
          unpublishedOrHidden: Math.max(0, totalSpareParts - publishedParts)
        },
        orders: {
          total: totalOrders,
          awaitingProcessing: awaitingProcessingOrders,
          delivered: deliveredOrders,
          cancelled: cancelledOrders
        },
        revenue: {
          currency: 'INR',
          totalGrossValue: financials.totalGrossValue,
          completedRevenue: financials.completedRevenue,
          pendingCodRevenue: financials.pendingCodRevenue
        },
        lastRefreshedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching admin analytics overview:', error.message);
    next(error);
  }
};

/**
 * GET /api/admin/analytics/sales
 * Aggregated sales reporting with date range and grouping periods
 */
export const getSalesAnalytics = async (req, res, next) => {
  try {
    const { from, to, period = 'daily' } = req.query;

    const matchStage = {
      orderStatus: { $ne: 'CANCELLED' }
    };

    if (from || to) {
      matchStage.createdAt = {};
      if (from) {
        const fromDate = new Date(from);
        if (!isNaN(fromDate.getTime())) matchStage.createdAt.$gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        if (!isNaN(toDate.getTime())) {
          toDate.setHours(23, 59, 59, 999);
          matchStage.createdAt.$lte = toDate;
        }
      }
    }

    // Determine group format based on period
    let dateFormat = '%Y-%m-%d';
    if (period === 'weekly') {
      dateFormat = '%Y-W%U';
    } else if (period === 'monthly') {
      dateFormat = '%Y-%m';
    }

    const [timelineData, summaryStats, topProducts, topShops] = await Promise.all([
      // Sales over time grouped by period
      Order.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
            orderCount: { $sum: 1 },
            grossOrderValue: { $sum: '$totalAmount' },
            completedRevenue: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ['$orderStatus', 'DELIVERED'] },
                      { $eq: ['$paymentStatus', 'PAID'] }
                    ]
                  },
                  '$totalAmount',
                  0
                ]
              }
            }
          }
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            date: '$_id',
            orderCount: 1,
            grossOrderValue: 1,
            completedRevenue: 1,
            averageOrderValue: {
              $cond: [
                { $gt: ['$orderCount', 0] },
                { $round: [{ $divide: ['$grossOrderValue', '$orderCount'] }, 2] },
                0
              ]
            }
          }
        }
      ]),

      // Summary totals for the matched filter range
      Order.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            grossOrderValue: { $sum: '$totalAmount' },
            completedRevenue: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ['$orderStatus', 'DELIVERED'] },
                      { $eq: ['$paymentStatus', 'PAID'] }
                    ]
                  },
                  '$totalAmount',
                  0
                ]
              }
            }
          }
        }
      ]),

      // Top-selling products
      Order.aggregate([
        { $match: matchStage },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            partName: { $first: '$items.partName' },
            partNumber: { $first: '$items.partNumber' },
            shopName: { $first: '$items.shopName' },
            unitsSold: { $sum: '$items.quantity' },
            totalSales: { $sum: '$items.subtotal' }
          }
        },
        { $sort: { unitsSold: -1 } },
        { $limit: 5 }
      ]),

      // Top shops by sales volume
      Order.aggregate([
        { $match: matchStage },
        { $unwind: '$shops' },
        {
          $group: {
            _id: '$shops.shopId',
            shopName: { $first: '$shops.shopName' },
            orderCount: { $sum: 1 },
            totalRevenue: { $sum: '$shops.itemsSubtotal' }
          }
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 5 }
      ])
    ]);

    const summary = summaryStats[0] || {
      totalOrders: 0,
      grossOrderValue: 0,
      completedRevenue: 0
    };

    const averageOrderValue = summary.totalOrders > 0
      ? Math.round(summary.grossOrderValue / summary.totalOrders)
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          currency: 'INR',
          totalOrders: summary.totalOrders,
          grossOrderValue: summary.grossOrderValue,
          completedRevenue: summary.completedRevenue,
          averageOrderValue
        },
        timeline: timelineData,
        topProducts,
        topShops
      }
    });
  } catch (error) {
    logger.error('Error fetching sales analytics:', error.message);
    next(error);
  }
};

/**
 * GET /api/admin/analytics/orders
 * Order status distribution and fulfillment metrics
 */
export const getOrderAnalytics = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const matchStage = {};

    if (from || to) {
      matchStage.createdAt = {};
      if (from) {
        const fromDate = new Date(from);
        if (!isNaN(fromDate.getTime())) matchStage.createdAt.$gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        if (!isNaN(toDate.getTime())) {
          toDate.setHours(23, 59, 59, 999);
          matchStage.createdAt.$lte = toDate;
        }
      }
    }

    const [statusDistribution, paymentMethodStats, paymentStatusStats] = await Promise.all([
      // Order status distribution
      Order.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$orderStatus',
            count: { $sum: 1 },
            totalValue: { $sum: '$totalAmount' }
          }
        }
      ]),

      // Payment method breakdown (COD vs ONLINE)
      Order.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$paymentMethod',
            count: { $sum: 1 },
            totalValue: { $sum: '$totalAmount' }
          }
        }
      ]),

      // Payment status breakdown
      Order.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$paymentStatus',
            count: { $sum: 1 },
            totalValue: { $sum: '$totalAmount' }
          }
        }
      ])
    ]);

    // Format status distribution into a normalized object
    const statusMap = {
      PLACED: 0,
      CONFIRMED: 0,
      PROCESSING: 0,
      READY_FOR_DISPATCH: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      CANCELLED: 0
    };

    let totalOrdersCount = 0;
    statusDistribution.forEach((s) => {
      if (s._id in statusMap) {
        statusMap[s._id] = s.count;
      }
      totalOrdersCount += s.count;
    });

    return res.status(200).json({
      success: true,
      data: {
        totalOrders: totalOrdersCount,
        statusDistribution: statusMap,
        statusDetails: statusDistribution,
        paymentMethods: paymentMethodStats,
        paymentStatuses: paymentStatusStats
      }
    });
  } catch (error) {
    logger.error('Error fetching order analytics:', error.message);
    next(error);
  }
};

/**
 * GET /api/admin/analytics/products
 * Product catalog distributions, categories, vehicle types, stock status
 */
export const getProductAnalytics = async (req, res, next) => {
  try {
    const [
      categoryBreakdown,
      vehicleTypeBreakdown,
      stockStatusBreakdown,
      moderationBreakdown,
      topRatedProducts
    ] = await Promise.all([
      // Category distribution
      SparePart.aggregate([
        { $match: { isArchived: false } },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            avgPrice: { $avg: '$price' }
          }
        },
        { $sort: { count: -1 } }
      ]),

      // Vehicle type distribution
      SparePart.aggregate([
        { $match: { isArchived: false } },
        {
          $group: {
            _id: '$vehicleType',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]),

      // Stock and availability
      SparePart.aggregate([
        { $match: { isArchived: false } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            inStock: {
              $sum: { $cond: [{ $gt: ['$stockQuantity', 0] }, 1, 0] }
            },
            outOfStock: {
              $sum: { $cond: [{ $lte: ['$stockQuantity', 0] }, 1, 0] }
            },
            lowStock: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gt: ['$stockQuantity', 0] },
                      { $lte: ['$stockQuantity', 5] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]),

      // Moderation status
      SparePart.aggregate([
        { $match: { isArchived: false } },
        {
          $group: {
            _id: '$isModerated',
            count: { $sum: 1 }
          }
        }
      ]),

      // Top rated spare parts
      SparePart.find({ isArchived: false, totalReviews: { $gt: 0 } })
        .sort({ averageRating: -1, totalReviews: -1 })
        .limit(5)
        .select('partName partNumber category price averageRating totalReviews')
    ]);

    return res.status(200).json({
      success: true,
      data: {
        categories: categoryBreakdown,
        vehicleTypes: vehicleTypeBreakdown,
        stockStatus: stockStatusBreakdown[0] || { total: 0, inStock: 0, outOfStock: 0, lowStock: 0 },
        moderation: moderationBreakdown,
        topRated: topRatedProducts
      }
    });
  } catch (error) {
    logger.error('Error fetching product analytics:', error.message);
    next(error);
  }
};

/**
 * GET /api/admin/analytics/shops
 * Shop growth, approval status, and performance analytics
 */
export const getShopAnalytics = async (req, res, next) => {
  try {
    const [shopStatusBreakdown, applicationStatusBreakdown, topShopsByInventory] = await Promise.all([
      Shop.aggregate([
        {
          $group: {
            _id: {
              isApproved: '$isApproved',
              isActive: '$isActive'
            },
            count: { $sum: 1 }
          }
        }
      ]),

      ShopApplication.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),

      SparePart.aggregate([
        { $match: { isArchived: false } },
        {
          $group: {
            _id: '$shopId',
            partCount: { $sum: 1 },
            totalStock: { $sum: '$stockQuantity' }
          }
        },
        { $sort: { partCount: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'shops',
            localField: '_id',
            foreignField: '_id',
            as: 'shop'
          }
        },
        { $unwind: '$shop' },
        {
          $project: {
            shopId: '$_id',
            shopName: '$shop.name',
            city: '$shop.address.city',
            partCount: 1,
            totalStock: 1
          }
        }
      ])
    ]);

    return res.status(200).json({
      success: true,
      data: {
        shopStatus: shopStatusBreakdown,
        applicationStatus: applicationStatusBreakdown,
        topShopsByInventory
      }
    });
  } catch (error) {
    logger.error('Error fetching shop analytics:', error.message);
    next(error);
  }
};

/**
 * GET /api/admin/analytics/customers
 * Customer engagement, repeat order rates, and account statuses
 */
export const getCustomerAnalytics = async (req, res, next) => {
  try {
    const [customerStatusBreakdown, orderFrequencyStats] = await Promise.all([
      User.aggregate([
        { $match: { role: 'CUSTOMER' } },
        {
          $group: {
            _id: '$accountStatus',
            count: { $sum: 1 }
          }
        }
      ]),

      Order.aggregate([
        { $match: { orderStatus: { $ne: 'CANCELLED' } } },
        {
          $group: {
            _id: '$customerId',
            orderCount: { $sum: 1 },
            lifetimeSpend: { $sum: '$totalAmount' }
          }
        },
        {
          $group: {
            _id: null,
            totalCustomersWithOrders: { $sum: 1 },
            repeatBuyers: {
              $sum: { $cond: [{ $gt: ['$orderCount', 1] }, 1, 0] }
            },
            averageLifetimeSpend: { $avg: '$lifetimeSpend' }
          }
        }
      ])
    ]);

    const orderFreq = orderFrequencyStats[0] || {
      totalCustomersWithOrders: 0,
      repeatBuyers: 0,
      averageLifetimeSpend: 0
    };

    return res.status(200).json({
      success: true,
      data: {
        statuses: customerStatusBreakdown,
        purchasingBehavior: {
          customersWithPurchases: orderFreq.totalCustomersWithOrders,
          repeatBuyers: orderFreq.repeatBuyers,
          repeatBuyerPercentage: orderFreq.totalCustomersWithOrders > 0
            ? Math.round((orderFreq.repeatBuyers / orderFreq.totalCustomersWithOrders) * 100)
            : 0,
          averageLifetimeSpend: Math.round(orderFreq.averageLifetimeSpend || 0)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching customer analytics:', error.message);
    next(error);
  }
};
