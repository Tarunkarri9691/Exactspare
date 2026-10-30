import mongoose from 'mongoose';
import User from '../models/User.js';
import Shop from '../models/Shop.js';
import ShopApplication from '../models/ShopApplication.js';
import SparePart from '../models/SparePart.js';
import Order from '../models/Order.js';
import Review from '../models/Review.js';
import Enquiry from '../models/Enquiry.js';
import Report from '../models/Report.js';
import { logger } from '../utils/logger.js';
import { parseDateRange, convertToCsv } from '../utils/analyticsHelper.js';

/**
 * EXACTSPARE MODULE 16 — ADVANCED ADMIN ANALYTICS AND BUSINESS REPORTS
 * High-performance, secure MongoDB aggregations for executive decision-making.
 * All metrics derived exclusively from live database records with zero synthetic data.
 */

/**
 * GET /api/admin/analytics/overview
 * Real MongoDB statistics across all platform collections with optional date filtering.
 */
export const getAnalyticsOverview = async (req, res, next) => {
  try {
    const { startDate, endDate, dateFilter, presetName } = parseDateRange(req.query, 'createdAt');

    // 1. Lifetime Platform Foundation Metrics
    const [
      totalCustomers,
      totalShopOwners,
      totalAdmins,
      totalShops,
      approvedShops,
      pendingApplications,
      rejectedApplications,
      needsCorrectionApplications,
      totalSpareParts,
      publishedParts,
      totalOrdersLifetime,
      awaitingProcessingOrders,
      deliveredOrdersLifetime,
      cancelledOrdersLifetime,
      newCustomerEnquiries,
      totalCustomerEnquiries,
      openReports,
      totalReports
    ] = await Promise.all([
      User.countDocuments({ role: 'CUSTOMER' }),
      User.countDocuments({ role: 'OWNER' }),
      User.countDocuments({ role: 'ADMIN' }),
      Shop.countDocuments(),
      Shop.countDocuments({ isApproved: true, isActive: true }),
      ShopApplication.countDocuments({ status: 'PENDING' }),
      ShopApplication.countDocuments({ status: 'REJECTED' }),
      ShopApplication.countDocuments({ status: 'NEEDS_CORRECTION' }),
      SparePart.countDocuments({ isArchived: false }),
      SparePart.countDocuments({ isArchived: false, isPublished: true }),
      Order.countDocuments(),
      Order.countDocuments({ orderStatus: { $in: ['PLACED', 'CONFIRMED', 'PROCESSING'] } }),
      Order.countDocuments({ orderStatus: 'DELIVERED' }),
      Order.countDocuments({ orderStatus: 'CANCELLED' }),
      Enquiry.countDocuments({ status: 'NEW' }),
      Enquiry.countDocuments({}),
      Report.countDocuments({ status: { $in: ['PENDING', 'INVESTIGATING'] } }),
      Report.countDocuments({})
    ]);

    // 2. Financial Metrics (Filtered by date range if provided, else lifetime)
    const financialMatch = { ...dateFilter };

    const financialStats = await Order.aggregate([
      { $match: financialMatch },
      {
        $group: {
          _id: null,
          periodOrdersCount: { $sum: 1 },
          grossOrderValue: {
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
          cancelledOrderValue: {
            $sum: {
              $cond: [{ $eq: ['$orderStatus', 'CANCELLED'] }, '$totalAmount', 0]
            }
          },
          periodDeliveredCount: {
            $sum: { $cond: [{ $eq: ['$orderStatus', 'DELIVERED'] }, 1, 0] }
          },
          periodCancelledCount: {
            $sum: { $cond: [{ $eq: ['$orderStatus', 'CANCELLED'] }, 1, 0] }
          },
          periodAwaitingCount: {
            $sum: {
              $cond: [
                { $in: ['$orderStatus', ['PLACED', 'CONFIRMED', 'PROCESSING']] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const financials = financialStats[0] || {
      periodOrdersCount: 0,
      grossOrderValue: 0,
      completedRevenue: 0,
      cancelledOrderValue: 0,
      periodDeliveredCount: 0,
      periodCancelledCount: 0,
      periodAwaitingCount: 0
    };

    return res.status(200).json({
      success: true,
      data: {
        filter: {
          preset: presetName,
          startDate: startDate ? startDate.toISOString() : null,
          endDate: endDate ? endDate.toISOString() : null
        },
        users: {
          total: totalCustomers + totalShopOwners + totalAdmins,
          customers: totalCustomers,
          shopOwners: totalShopOwners,
          administrators: totalAdmins
        },
        shops: {
          total: totalShops,
          approvedAndActive: approvedShops,
          approved: approvedShops,
          pendingApplications,
          rejectedApplications,
          needsCorrectionApplications,
          requiringCorrections: needsCorrectionApplications
        },
        inventory: {
          total: totalSpareParts,
          published: publishedParts,
          unpublished: Math.max(0, totalSpareParts - publishedParts)
        },
        enquiries: {
          total: totalCustomerEnquiries,
          newEnquiries: newCustomerEnquiries
        },
        compliance: {
          totalReports,
          openReports
        },
        orders: {
          total: startDate || endDate ? financials.periodOrdersCount : totalOrdersLifetime,
          totalLifetime: totalOrdersLifetime,
          totalInPeriod: startDate || endDate ? financials.periodOrdersCount : totalOrdersLifetime,
          awaitingProcessing: startDate || endDate ? financials.periodAwaitingCount : awaitingProcessingOrders,
          delivered: startDate || endDate ? financials.periodDeliveredCount : deliveredOrdersLifetime,
          cancelled: startDate || endDate ? financials.periodCancelledCount : cancelledOrdersLifetime
        },
        revenue: {
          currency: 'INR',
          grossOrderValue: financials.grossOrderValue,
          totalGrossValue: financials.grossOrderValue,
          completedRevenue: financials.completedRevenue,
          cancelledOrderValue: financials.cancelledOrderValue,
          pendingCodRevenue: 0,
          disclaimer:
            'Gross order value represents total non-cancelled customer orders. Completed order value represents delivered and confirmed payments. This does not represent profit as shop costs, merchant payouts, and taxes are not deducted.'
        },
        lastRefreshedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({
        success: false,
        status: 'error',
        statusCode: 400,
        message: error.message
      });
    }
    logger.error('Error fetching admin analytics overview:', error.message);
    next(error);
  }
};

/**
 * GET /api/admin/analytics/sales
 * Aggregated sales reporting with date range and grouping periods.
 */
export const getSalesAnalytics = async (req, res, next) => {
  try {
    const { period = 'daily' } = req.query;
    const { startDate, endDate, dateFilter, presetName } = parseDateRange(req.query, 'createdAt');

    const matchStage = {
      orderStatus: { $ne: 'CANCELLED' },
      ...dateFilter
    };

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

      // Top-selling products based on actual completed or non-cancelled orders
      Order.aggregate([
        { $match: matchStage },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            partName: { $first: '$items.partName' },
            partNumber: { $first: '$items.partNumber' },
            shopName: { $first: '$items.shopName' },
            shopId: { $first: '$items.shopId' },
            unitsSold: { $sum: '$items.quantity' },
            totalSales: { $sum: '$items.subtotal' }
          }
        },
        { $sort: { unitsSold: -1 } },
        { $limit: 10 }
      ]),

      // Top shops by sales volume (attributing only items belonging to each shop)
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
        { $limit: 10 }
      ])
    ]);

    const summary = summaryStats[0] || {
      totalOrders: 0,
      grossOrderValue: 0,
      completedRevenue: 0
    };

    const averageOrderValue =
      summary.totalOrders > 0 ? Math.round(summary.grossOrderValue / summary.totalOrders) : 0;

    return res.status(200).json({
      success: true,
      data: {
        filter: {
          preset: presetName,
          period,
          startDate: startDate ? startDate.toISOString() : null,
          endDate: endDate ? endDate.toISOString() : null
        },
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
    if (error.statusCode === 400) {
      return res.status(400).json({
        success: false,
        status: 'error',
        statusCode: 400,
        message: error.message
      });
    }
    logger.error('Error fetching sales analytics:', error.message);
    next(error);
  }
};

/**
 * GET /api/admin/analytics/orders
 * Order status distribution, timeline, and fulfillment metrics.
 */
export const getOrderAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate, dateFilter, presetName } = parseDateRange(req.query, 'createdAt');
    const matchStage = { ...dateFilter };

    const [statusDistribution, paymentMethodStats, paymentStatusStats, timelineStats] =
      await Promise.all([
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
        ]),

        // Orders over time (daily breakdown)
        Order.aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              total: { $sum: 1 },
              delivered: {
                $sum: { $cond: [{ $eq: ['$orderStatus', 'DELIVERED'] }, 1, 0] }
              },
              cancelled: {
                $sum: { $cond: [{ $eq: ['$orderStatus', 'CANCELLED'] }, 1, 0] }
              },
              grossValue: {
                $sum: { $cond: [{ $ne: ['$orderStatus', 'CANCELLED'] }, '$totalAmount', 0] }
              }
            }
          },
          { $sort: { _id: 1 } },
          {
            $project: {
              date: '$_id',
              total: 1,
              delivered: 1,
              cancelled: 1,
              grossValue: 1
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
        filter: {
          preset: presetName,
          startDate: startDate ? startDate.toISOString() : null,
          endDate: endDate ? endDate.toISOString() : null
        },
        totalOrders: totalOrdersCount,
        statusDistribution: statusMap,
        statusDetails: statusDistribution,
        paymentMethods: paymentMethodStats,
        paymentStatuses: paymentStatusStats,
        timeline: timelineStats
      }
    });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({
        success: false,
        status: 'error',
        statusCode: 400,
        message: error.message
      });
    }
    logger.error('Error fetching order analytics:', error.message);
    next(error);
  }
};

/**
 * GET /api/admin/analytics/inventory
 * Comprehensive inventory insights from real SparePart records:
 * - Low-stock products (stock <= 5 and > 0)
 * - Out-of-stock products (stock <= 0)
 * - Published vs unpublished counts
 * - Category distributions
 * - Top-selling parts based on delivered orders
 */
export const getInventoryAnalytics = async (req, res, next) => {
  try {
    const [
      stockStats,
      categoryBreakdown,
      vehicleTypeBreakdown,
      lowStockList,
      outOfStockList,
      topDeliveredParts
    ] = await Promise.all([
      // Aggregated stock counts
      SparePart.aggregate([
        { $match: { isArchived: false } },
        {
          $group: {
            _id: null,
            totalParts: { $sum: 1 },
            publishedCount: {
              $sum: { $cond: [{ $eq: ['$isPublished', true] }, 1, 0] }
            },
            unpublishedCount: {
              $sum: { $cond: [{ $eq: ['$isPublished', false] }, 1, 0] }
            },
            inStockCount: {
              $sum: { $cond: [{ $gt: ['$stockQuantity', 0] }, 1, 0] }
            },
            outOfStockCount: {
              $sum: { $cond: [{ $lte: ['$stockQuantity', 0] }, 1, 0] }
            },
            lowStockCount: {
              $sum: {
                $cond: [
                  {
                    $and: [{ $gt: ['$stockQuantity', 0] }, { $lte: ['$stockQuantity', 5] }]
                  },
                  1,
                  0
                ]
              }
            },
            totalInventoryValue: {
              $sum: { $multiply: ['$price', '$stockQuantity'] }
            }
          }
        }
      ]),

      // Category breakdown with inventory health metrics
      SparePart.aggregate([
        { $match: { isArchived: false } },
        {
          $group: {
            _id: '$category',
            partCount: { $sum: 1 },
            publishedCount: {
              $sum: { $cond: [{ $eq: ['$isPublished', true] }, 1, 0] }
            },
            lowStockCount: {
              $sum: {
                $cond: [
                  {
                    $and: [{ $gt: ['$stockQuantity', 0] }, { $lte: ['$stockQuantity', 5] }]
                  },
                  1,
                  0
                ]
              }
            },
            outOfStockCount: {
              $sum: { $cond: [{ $lte: ['$stockQuantity', 0] }, 1, 0] }
            },
            avgPrice: { $avg: '$price' },
            totalStockQuantity: { $sum: '$stockQuantity' }
          }
        },
        { $sort: { partCount: -1 } }
      ]),

      // Vehicle type breakdown
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

      // Low-stock products list with IDs for admin navigation
      SparePart.find({
        isArchived: false,
        stockQuantity: { $gt: 0, $lte: 5 }
      })
        .select('partName partNumber category price stockQuantity isPublished shopId')
        .populate('shopId', 'name')
        .sort({ stockQuantity: 1 })
        .limit(20)
        .lean(),

      // Out-of-stock products list with IDs for admin navigation
      SparePart.find({
        isArchived: false,
        stockQuantity: { $lte: 0 }
      })
        .select('partName partNumber category price stockQuantity isPublished shopId')
        .populate('shopId', 'name')
        .sort({ updatedAt: -1 })
        .limit(20)
        .lean(),

      // Top-selling parts based strictly on DELIVERED completed orders
      Order.aggregate([
        { $match: { orderStatus: 'DELIVERED' } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            partName: { $first: '$items.partName' },
            partNumber: { $first: '$items.partNumber' },
            shopName: { $first: '$items.shopName' },
            shopId: { $first: '$items.shopId' },
            unitsDelivered: { $sum: '$items.quantity' },
            completedRevenue: { $sum: '$items.subtotal' }
          }
        },
        { $sort: { unitsDelivered: -1 } },
        { $limit: 10 }
      ])
    ]);

    const stockSummary = stockStats[0] || {
      totalParts: 0,
      publishedCount: 0,
      unpublishedCount: 0,
      inStockCount: 0,
      outOfStockCount: 0,
      lowStockCount: 0,
      totalInventoryValue: 0
    };

    return res.status(200).json({
      success: true,
      data: {
        summary: stockSummary,
        categories: categoryBreakdown,
        vehicleTypes: vehicleTypeBreakdown,
        lowStockProducts: lowStockList.map((p) => ({
          _id: p._id,
          partName: p.partName,
          partNumber: p.partNumber,
          category: p.category,
          price: p.price,
          stockQuantity: p.stockQuantity,
          isPublished: p.isPublished,
          shopId: p.shopId?._id || p.shopId,
          shopName: p.shopId?.name || 'Unknown'
        })),
        outOfStockProducts: outOfStockList.map((p) => ({
          _id: p._id,
          partName: p.partName,
          partNumber: p.partNumber,
          category: p.category,
          price: p.price,
          stockQuantity: p.stockQuantity,
          isPublished: p.isPublished,
          shopId: p.shopId?._id || p.shopId,
          shopName: p.shopId?.name || 'Unknown'
        })),
        topCompletedParts: topDeliveredParts
      }
    });
  } catch (error) {
    logger.error('Error fetching inventory analytics:', error.message);
    next(error);
  }
};

/**
 * Backward compatibility alias for legacy product analytics
 */
export const getProductAnalytics = getInventoryAnalytics;

/**
 * GET /api/admin/analytics/shops
 * Shop growth, approval status, and performance analytics with multi-shop attribution.
 */
export const getShopAnalytics = async (req, res, next) => {
  try {
    const [
      allShops,
      shopStatusBreakdown,
      applicationStatusBreakdown,
      partsCountByShop,
      orderStatsByShop
    ] = await Promise.all([
      // Fetch registered shops
      Shop.find()
        .select('name category address.city address.state isApproved isActive createdAt')
        .sort({ createdAt: -1 })
        .lean(),

      // Shop approval & active status breakdown
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

      // Shop applications status breakdown
      ShopApplication.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),

      // Number of published parts per shop
      SparePart.aggregate([
        { $match: { isArchived: false, isPublished: true } },
        {
          $group: {
            _id: '$shopId',
            publishedCount: { $sum: 1 }
          }
        }
      ]),

      // Order performance aggregated per shop from Order.shops
      // Correctly isolates shop itemsSubtotal to avoid double-counting multi-shop orders
      Order.aggregate([
        { $unwind: '$shops' },
        {
          $group: {
            _id: '$shops.shopId',
            totalOrderCount: { $sum: 1 },
            completedOrdersCount: {
              $sum: { $cond: [{ $eq: ['$shops.fulfillmentStatus', 'DELIVERED'] }, 1, 0] }
            },
            cancelledOrdersCount: {
              $sum: { $cond: [{ $eq: ['$shops.fulfillmentStatus', 'CANCELLED'] }, 1, 0] }
            },
            attributableOrderValue: {
              $sum: {
                $cond: [
                  { $ne: ['$shops.fulfillmentStatus', 'CANCELLED'] },
                  '$shops.itemsSubtotal',
                  0
                ]
              }
            },
            completedRevenue: {
              $sum: {
                $cond: [
                  { $eq: ['$shops.fulfillmentStatus', 'DELIVERED'] },
                  '$shops.itemsSubtotal',
                  0
                ]
              }
            }
          }
        }
      ])
    ]);

    // Map parts count and order metrics to each shop
    const partsMap = new Map();
    partsCountByShop.forEach((p) => {
      if (p._id) partsMap.set(p._id.toString(), p.publishedCount);
    });

    const ordersMap = new Map();
    orderStatsByShop.forEach((o) => {
      if (o._id) ordersMap.set(o._id.toString(), o);
    });

    const performanceTable = allShops.map((shop) => {
      const sId = shop._id.toString();
      const stats = ordersMap.get(sId) || {
        totalOrderCount: 0,
        completedOrdersCount: 0,
        cancelledOrdersCount: 0,
        attributableOrderValue: 0,
        completedRevenue: 0
      };

      return {
        _id: shop._id,
        shopName: shop.name,
        category: shop.category,
        city: shop.address?.city || 'N/A',
        state: shop.address?.state || 'N/A',
        isApproved: shop.isApproved,
        isActive: shop.isActive,
        createdAt: shop.createdAt,
        publishedPartsCount: partsMap.get(sId) || 0,
        totalOrders: stats.totalOrderCount,
        completedOrders: stats.completedOrdersCount,
        cancelledOrders: stats.cancelledOrdersCount,
        attributableOrderValue: stats.attributableOrderValue,
        completedRevenue: stats.completedRevenue
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        shopStatus: shopStatusBreakdown,
        applicationStatus: applicationStatusBreakdown,
        shops: performanceTable
      }
    });
  } catch (error) {
    logger.error('Error fetching shop analytics:', error.message);
    next(error);
  }
};

/**
 * GET /api/admin/analytics/customers
 * Customer engagement, registrations over time, and account statuses.
 */
export const getCustomerAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate, dateFilter, presetName } = parseDateRange(req.query, 'createdAt');

    const [
      customerStatusBreakdown,
      verificationStats,
      registrationsOverTime,
      purchasingStats
    ] = await Promise.all([
      // Account statuses
      User.aggregate([
        { $match: { role: 'CUSTOMER' } },
        {
          $group: {
            _id: '$accountStatus',
            count: { $sum: 1 }
          }
        }
      ]),

      // Email verification status
      User.aggregate([
        { $match: { role: 'CUSTOMER' } },
        {
          $group: {
            _id: '$isEmailVerified',
            count: { $sum: 1 }
          }
        }
      ]),

      // New customer registrations over time
      User.aggregate([
        { $match: { role: 'CUSTOMER', ...dateFilter } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            registrations: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            date: '$_id',
            registrations: 1
          }
        }
      ]),

      // Customer purchasing behavior from Orders
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

    const orderFreq = purchasingStats[0] || {
      totalCustomersWithOrders: 0,
      repeatBuyers: 0,
      averageLifetimeSpend: 0
    };

    return res.status(200).json({
      success: true,
      data: {
        filter: {
          preset: presetName,
          startDate: startDate ? startDate.toISOString() : null,
          endDate: endDate ? endDate.toISOString() : null
        },
        statuses: customerStatusBreakdown,
        emailVerification: verificationStats,
        registrationsTimeline: registrationsOverTime,
        purchasingBehavior: {
          customersWithPurchases: orderFreq.totalCustomersWithOrders,
          repeatBuyers: orderFreq.repeatBuyers,
          repeatBuyerPercentage:
            orderFreq.totalCustomersWithOrders > 0
              ? Math.round((orderFreq.repeatBuyers / orderFreq.totalCustomersWithOrders) * 100)
              : 0,
          averageLifetimeSpend: Math.round(orderFreq.averageLifetimeSpend || 0)
        }
      }
    });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({
        success: false,
        status: 'error',
        statusCode: 400,
        message: error.message
      });
    }
    logger.error('Error fetching customer analytics:', error.message);
    next(error);
  }
};

/* =========================================================================
   CSV REPORT EXPORT HANDLERS (STRICT ADMIN AUTHORIZATION & SECURE FORMATTING)
   ========================================================================= */

/**
 * GET /api/admin/reports/orders.csv
 * Exports customer orders with date range filtering and formula injection mitigation.
 */
export const exportOrdersCsv = async (req, res, next) => {
  try {
    const { dateFilter, presetName } = parseDateRange(req.query, 'createdAt');

    const orders = await Order.find(dateFilter)
      .populate('customerId', 'name email phone')
      .sort({ createdAt: -1 })
      .lean();

    const columns = [
      { key: 'orderNumber', label: 'Order Number' },
      {
        key: 'createdAt',
        label: 'Order Date',
        format: (val) => (val ? new Date(val).toLocaleString('en-IN') : 'N/A')
      },
      {
        key: 'customerName',
        label: 'Customer Name',
        format: (_, row) => row.customerId?.name || row.shippingAddress?.fullName || 'N/A'
      },
      {
        key: 'customerEmail',
        label: 'Customer Email',
        format: (_, row) => row.customerId?.email || 'N/A'
      },
      {
        key: 'orderStatus',
        label: 'Order Status'
      },
      {
        key: 'paymentMethod',
        label: 'Payment Method'
      },
      {
        key: 'paymentStatus',
        label: 'Payment Status'
      },
      {
        key: 'itemCount',
        label: 'Items Count',
        format: (_, row) => (row.items ? row.items.length : 0)
      },
      {
        key: 'subtotal',
        label: 'Subtotal (INR)',
        format: (val) => Number(val || 0).toFixed(2)
      },
      {
        key: 'deliveryCharge',
        label: 'Delivery Charge (INR)',
        format: (val) => Number(val || 0).toFixed(2)
      },
      {
        key: 'totalAmount',
        label: 'Total Amount (INR)',
        format: (val) => Number(val || 0).toFixed(2)
      },
      {
        key: 'destinationCity',
        label: 'Destination City',
        format: (_, row) => row.shippingAddress?.city || 'N/A'
      }
    ];

    const csvContent = convertToCsv(orders, columns);
    const filename = `exactspare-orders-${presetName}-${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({
        success: false,
        status: 'error',
        statusCode: 400,
        message: error.message
      });
    }
    logger.error('Error generating orders CSV report:', error.message);
    next(error);
  }
};

/**
 * GET /api/admin/reports/inventory.csv
 * Exports complete inventory and stock status with formula injection defense.
 */
export const exportInventoryCsv = async (req, res, next) => {
  try {
    const parts = await SparePart.find({ isArchived: false })
      .populate('shopId', 'name')
      .sort({ category: 1, stockQuantity: 1 })
      .lean();

    const columns = [
      { key: 'partNumber', label: 'Part Number / SKU' },
      { key: 'partName', label: 'Part Name' },
      { key: 'category', label: 'Category' },
      { key: 'vehicleType', label: 'Vehicle Type' },
      { key: 'manufacturer', label: 'Manufacturer' },
      {
        key: 'shopName',
        label: 'Shop Name',
        format: (_, row) => row.shopId?.name || 'N/A'
      },
      {
        key: 'price',
        label: 'Unit Price (INR)',
        format: (val) => Number(val || 0).toFixed(2)
      },
      { key: 'stockQuantity', label: 'Stock Quantity' },
      {
        key: 'stockStatus',
        label: 'Stock Status',
        format: (_, row) => {
          if (row.stockQuantity <= 0) return 'OUT_OF_STOCK';
          if (row.stockQuantity <= 5) return 'LOW_STOCK';
          return 'IN_STOCK';
        }
      },
      {
        key: 'isPublished',
        label: 'Published Status',
        format: (val) => (val ? 'PUBLISHED' : 'UNPUBLISHED')
      },
      {
        key: 'averageRating',
        label: 'Average Rating',
        format: (val) => (val ? Number(val).toFixed(1) : 'Unrated')
      },
      {
        key: 'createdAt',
        label: 'Listed Date',
        format: (val) => (val ? new Date(val).toLocaleDateString('en-IN') : 'N/A')
      }
    ];

    const csvContent = convertToCsv(parts, columns);
    const filename = `exactspare-inventory-${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    logger.error('Error generating inventory CSV report:', error.message);
    next(error);
  }
};

/**
 * GET /api/admin/reports/shops.csv
 * Exports registered merchant shops with approval status and contact details.
 */
export const exportShopsCsv = async (req, res, next) => {
  try {
    const [shops, partsCounts, orderStats] = await Promise.all([
      Shop.find()
        .populate('ownerId', 'name email phone')
        .sort({ createdAt: -1 })
        .lean(),

      SparePart.aggregate([
        { $match: { isArchived: false, isPublished: true } },
        { $group: { _id: '$shopId', count: { $sum: 1 } } }
      ]),

      Order.aggregate([
        { $unwind: '$shops' },
        {
          $group: {
            _id: '$shops.shopId',
            ordersCount: { $sum: 1 },
            completedCount: {
              $sum: { $cond: [{ $eq: ['$shops.fulfillmentStatus', 'DELIVERED'] }, 1, 0] }
            },
            revenue: {
              $sum: {
                $cond: [
                  { $ne: ['$shops.fulfillmentStatus', 'CANCELLED'] },
                  '$shops.itemsSubtotal',
                  0
                ]
              }
            }
          }
        }
      ])
    ]);

    const partsMap = new Map();
    partsCounts.forEach((p) => {
      if (p._id) partsMap.set(p._id.toString(), p.count);
    });

    const ordersMap = new Map();
    orderStats.forEach((o) => {
      if (o._id) ordersMap.set(o._id.toString(), o);
    });

    const enrichedShops = shops.map((s) => {
      const sId = s._id.toString();
      const stats = ordersMap.get(sId) || { ordersCount: 0, completedCount: 0, revenue: 0 };
      return {
        ...s,
        publishedCount: partsMap.get(sId) || 0,
        ordersCount: stats.ordersCount,
        completedCount: stats.completedCount,
        revenue: stats.revenue
      };
    });

    const columns = [
      { key: 'name', label: 'Shop Name' },
      { key: 'category', label: 'Category' },
      {
        key: 'ownerName',
        label: 'Owner Name',
        format: (_, row) => row.ownerId?.name || 'N/A'
      },
      {
        key: 'ownerEmail',
        label: 'Owner Email',
        format: (_, row) => row.ownerId?.email || 'N/A'
      },
      {
        key: 'ownerPhone',
        label: 'Owner Phone',
        format: (_, row) => row.ownerId?.phone || row.contact?.phone || 'N/A'
      },
      {
        key: 'city',
        label: 'City',
        format: (_, row) => row.address?.city || 'N/A'
      },
      {
        key: 'state',
        label: 'State',
        format: (_, row) => row.address?.state || 'N/A'
      },
      {
        key: 'isApproved',
        label: 'Approval Status',
        format: (val) => (val ? 'APPROVED' : 'PENDING_APPROVAL')
      },
      {
        key: 'isActive',
        label: 'Active Status',
        format: (val) => (val ? 'ACTIVE' : 'DEACTIVATED')
      },
      { key: 'publishedCount', label: 'Published Parts Count' },
      { key: 'ordersCount', label: 'Attributed Orders' },
      { key: 'completedCount', label: 'Completed Deliveries' },
      {
        key: 'revenue',
        label: 'Attributable Revenue (INR)',
        format: (val) => Number(val || 0).toFixed(2)
      },
      {
        key: 'createdAt',
        label: 'Registration Date',
        format: (val) => (val ? new Date(val).toLocaleDateString('en-IN') : 'N/A')
      }
    ];

    const csvContent = convertToCsv(enrichedShops, columns);
    const filename = `exactspare-shops-${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    logger.error('Error generating shops CSV report:', error.message);
    next(error);
  }
};

/**
 * GET /api/admin/reports/customers.csv
 * Exports registered customers summary without exposing passwords, hashes, or tokens.
 */
export const exportCustomersCsv = async (req, res, next) => {
  try {
    const { dateFilter, presetName } = parseDateRange(req.query, 'createdAt');

    // Never select passwordHash, reset tokens, or verification tokens
    const customers = await User.find({ role: 'CUSTOMER', ...dateFilter })
      .select('name email phone role accountStatus isEmailVerified createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const columns = [
      { key: 'name', label: 'Customer Name' },
      { key: 'email', label: 'Email Address' },
      { key: 'phone', label: 'Phone Number' },
      { key: 'accountStatus', label: 'Account Status' },
      {
        key: 'isEmailVerified',
        label: 'Email Verified',
        format: (val) => (val ? 'VERIFIED' : 'UNVERIFIED')
      },
      {
        key: 'createdAt',
        label: 'Registration Date',
        format: (val) => (val ? new Date(val).toLocaleString('en-IN') : 'N/A')
      }
    ];

    const csvContent = convertToCsv(customers, columns);
    const filename = `exactspare-customers-${presetName}-${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({
        success: false,
        status: 'error',
        statusCode: 400,
        message: error.message
      });
    }
    logger.error('Error generating customers CSV report:', error.message);
    next(error);
  }
};
