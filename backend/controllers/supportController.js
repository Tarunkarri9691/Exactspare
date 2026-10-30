import crypto from 'crypto';
import mongoose from 'mongoose';
import SupportTicket from '../models/SupportTicket.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { logger } from '../utils/logger.js';

const VALID_CATEGORIES = ['Order', 'Payment', 'Shop', 'Product', 'Other'];
const VALID_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

/**
 * Customer: Create a support ticket
 * @route POST /api/support/tickets
 */
export const createTicket = async (req, res) => {
  try {
    const customerId = req.user.id;
    const customerName = req.user.name || 'Customer';
    const { category, subject, message, description, orderId, priority = 'NORMAL' } = req.body;

    const ticketMessage = (message || description || '').trim();

    // 1. Validate Category
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Permitted categories: ${VALID_CATEGORIES.join(', ')}`
      });
    }

    // 2. Validate Subject
    if (!subject || subject.trim().length < 3 || subject.trim().length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Subject is required and must be between 3 and 200 characters.'
      });
    }

    // 3. Validate Message Content
    if (!ticketMessage || ticketMessage.length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Message / description is required and must be at least 5 characters.'
      });
    }

    // 4. Validate Optional Linked Order
    let validatedOrderId = null;
    if (orderId && orderId !== '' && orderId !== 'none') {
      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid order ID format.'
        });
      }

      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'The linked order could not be found.'
        });
      }

      // Strict Ownership Check: Customers may only link their own orders
      if (order.customerId.toString() !== customerId) {
        return res.status(403).json({
          success: false,
          message: 'Access forbidden. You cannot link a support ticket to an order placed by another user.'
        });
      }

      validatedOrderId = order._id;
    }

    // 5. Generate Unique Ticket Number
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    const ticketNumber = `TKT-${datePrefix}-${randSuffix}`;

    // 6. Create Support Ticket
    const newTicket = await SupportTicket.create({
      ticketNumber,
      customerId,
      orderId: validatedOrderId,
      category,
      subject: subject.trim(),
      priority: ['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(priority) ? priority : 'NORMAL',
      status: 'OPEN',
      messages: [
        {
          senderId: customerId,
          senderRole: 'CUSTOMER',
          senderName: customerName,
          message: ticketMessage,
          createdAt: new Date()
        }
      ],
      statusHistory: [
        {
          status: 'OPEN',
          changedBy: customerId,
          note: 'Ticket created by customer',
          changedAt: new Date()
        }
      ]
    });

    logger.info(`Customer ${customerId} created support ticket ${ticketNumber}`);

    // Populate relations for response
    const populatedTicket = await SupportTicket.findById(newTicket._id)
      .populate('orderId', 'orderNumber orderStatus totalAmount')
      .lean();

    return res.status(201).json({
      success: true,
      message: 'Support ticket submitted successfully.',
      data: {
        ticket: populatedTicket
      }
    });
  } catch (error) {
    logger.error('Error creating support ticket:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create support ticket.'
    });
  }
};

/**
 * Customer: Get own support tickets
 * @route GET /api/support/tickets/my
 */
export const getMyTickets = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { status, category, search, page = 1, limit = 10 } = req.query;

    const query = { customerId };

    if (status && status !== 'ALL' && VALID_STATUSES.includes(status)) {
      query.status = status;
    }

    if (category && category !== 'ALL' && VALID_CATEGORIES.includes(category)) {
      query.category = category;
    }

    if (search && search.trim()) {
      query.$or = [
        { ticketNumber: new RegExp(search.trim(), 'i') },
        { subject: new RegExp(search.trim(), 'i') }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [tickets, total] = await Promise.all([
      SupportTicket.find(query)
        .populate('orderId', 'orderNumber orderStatus totalAmount')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      SupportTicket.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        tickets,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 0
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching customer tickets:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve support tickets.'
    });
  }
};

/**
 * Customer / Admin: Get ticket details and conversation thread
 * @route GET /api/support/tickets/:ticketId
 */
export const getTicketById = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket ID format.'
      });
    }

    const ticket = await SupportTicket.findById(ticketId)
      .populate('customerId', 'name email phone')
      .populate('orderId', 'orderNumber orderStatus totalAmount createdAt')
      .populate('assignedTo', 'name email')
      .populate('statusHistory.changedBy', 'name role')
      .lean();

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found.'
      });
    }

    // Strict Ownership Check: Only owning customer or administrator
    if (userRole !== 'ADMIN' && ticket.customerId._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. You do not have permission to view this ticket.'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        ticket
      }
    });
  } catch (error) {
    logger.error('Error fetching ticket details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve ticket details.'
    });
  }
};

/**
 * Customer: Reply to an open ticket
 * @route POST /api/support/tickets/:ticketId/messages
 */
export const replyTicketCustomer = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const customerId = req.user.id;
    const customerName = req.user.name || 'Customer';
    const { message } = req.body;

    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket ID.'
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty.'
      });
    }

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found.'
      });
    }

    // Ownership check
    if (ticket.customerId.toString() !== customerId) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. You cannot reply to another customer’s ticket.'
      });
    }

    // Prevent replying to closed tickets
    if (ticket.status === 'CLOSED') {
      return res.status(400).json({
        success: false,
        message: 'This support ticket has been closed. Please open a new ticket if you require further assistance.'
      });
    }

    // Add message
    ticket.messages.push({
      senderId: customerId,
      senderRole: 'CUSTOMER',
      senderName: customerName,
      message: message.trim(),
      createdAt: new Date()
    });

    // If ticket was resolved, customer reply reopens it to IN_PROGRESS
    if (ticket.status === 'RESOLVED') {
      ticket.status = 'IN_PROGRESS';
      ticket.statusHistory.push({
        status: 'IN_PROGRESS',
        changedBy: customerId,
        note: 'Customer replied to resolved ticket; reopened to In Progress',
        changedAt: new Date()
      });
    }

    await ticket.save();

    const populatedTicket = await SupportTicket.findById(ticket._id)
      .populate('customerId', 'name email')
      .populate('orderId', 'orderNumber orderStatus totalAmount')
      .populate('assignedTo', 'name email')
      .lean();

    return res.status(200).json({
      success: true,
      message: 'Reply posted successfully.',
      data: {
        ticket: populatedTicket
      }
    });
  } catch (error) {
    logger.error('Error replying to ticket:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to post reply.'
    });
  }
};

/**
 * Admin: Get all tickets with filtering, search, and pagination
 * @route GET /api/admin/support/tickets
 */
export const getAllTicketsAdmin = async (req, res) => {
  try {
    const { status, category, search, assignedTo, page = 1, limit = 15 } = req.query;

    const query = {};

    if (status && status !== 'ALL' && VALID_STATUSES.includes(status)) {
      query.status = status;
    }

    if (category && category !== 'ALL' && VALID_CATEGORIES.includes(category)) {
      query.category = category;
    }

    if (assignedTo && assignedTo !== 'ALL') {
      if (assignedTo === 'UNASSIGNED') {
        query.assignedTo = null;
      } else if (mongoose.Types.ObjectId.isValid(assignedTo)) {
        query.assignedTo = assignedTo;
      }
    }

    if (search && search.trim()) {
      const term = search.trim();
      // Search by ticketNumber, subject, or customer name/email
      const matchedUsers = await User.find({
        $or: [
          { name: new RegExp(term, 'i') },
          { email: new RegExp(term, 'i') }
        ]
      }).select('_id');

      const userIds = matchedUsers.map((u) => u._id);

      query.$or = [
        { ticketNumber: new RegExp(term, 'i') },
        { subject: new RegExp(term, 'i') },
        { customerId: { $in: userIds } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
    const skip = (pageNum - 1) * limitNum;

    const [tickets, total, counts] = await Promise.all([
      SupportTicket.find(query)
        .populate('customerId', 'name email phone')
        .populate('orderId', 'orderNumber orderStatus totalAmount')
        .populate('assignedTo', 'name email')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      SupportTicket.countDocuments(query),
      SupportTicket.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const statusCounts = {
      TOTAL: 0,
      OPEN: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      CLOSED: 0
    };

    counts.forEach((c) => {
      if (statusCounts[c._id] !== undefined) {
        statusCounts[c._id] = c.count;
      }
      statusCounts.TOTAL += c.count;
    });

    return res.status(200).json({
      success: true,
      data: {
        tickets,
        counts: statusCounts,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 0
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching admin tickets:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve support tickets.'
    });
  }
};

/**
 * Admin: Update ticket status
 * @route PATCH /api/admin/support/tickets/:ticketId/status
 */
export const updateTicketStatusAdmin = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const adminId = req.user.id;
    const { status, note = '' } = req.body;

    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket ID.'
      });
    }

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Permitted statuses: ${VALID_STATUSES.join(', ')}`
      });
    }

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found.'
      });
    }

    const previousStatus = ticket.status;
    ticket.status = status;

    ticket.statusHistory.push({
      status,
      changedBy: adminId,
      note: note.trim() || `Status updated from ${previousStatus} to ${status} by administrator`,
      changedAt: new Date()
    });

    await ticket.save();

    // Dispatch in-app notification to customer
    try {
      await Notification.create({
        recipientId: ticket.customerId,
        type: 'SUPPORT_TICKET_STATUS',
        title: `Ticket Status Updated: ${ticket.ticketNumber}`,
        message: `Your support ticket #${ticket.ticketNumber} ("${ticket.subject}") status has been updated to "${status.replace(/_/g, ' ')}".`,
        relatedId: ticket._id
      });
    } catch (notifErr) {
      logger.warn('Failed to notify customer of ticket status update:', notifErr.message);
    }

    logger.info(`Admin ${adminId} updated ticket ${ticket.ticketNumber} status to ${status}`);

    const populatedTicket = await SupportTicket.findById(ticket._id)
      .populate('customerId', 'name email phone')
      .populate('orderId', 'orderNumber orderStatus totalAmount')
      .populate('assignedTo', 'name email')
      .populate('statusHistory.changedBy', 'name role')
      .lean();

    return res.status(200).json({
      success: true,
      message: `Ticket status updated to ${status}.`,
      data: {
        ticket: populatedTicket
      }
    });
  } catch (error) {
    logger.error('Error updating ticket status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update ticket status.'
    });
  }
};

/**
 * Admin: Reply to a ticket
 * @route POST /api/admin/support/tickets/:ticketId/messages
 */
export const replyTicketAdmin = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const adminId = req.user.id;
    const adminName = req.user.name || 'EXACTSPARE Support';
    const { message, updateStatus = null } = req.body;

    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket ID.'
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Reply message cannot be empty.'
      });
    }

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found.'
      });
    }

    // Add message
    ticket.messages.push({
      senderId: adminId,
      senderRole: 'ADMIN',
      senderName: adminName,
      message: message.trim(),
      createdAt: new Date()
    });

    // Automatically transition OPEN to IN_PROGRESS unless specified otherwise
    if (updateStatus && VALID_STATUSES.includes(updateStatus)) {
      ticket.status = updateStatus;
      ticket.statusHistory.push({
        status: updateStatus,
        changedBy: adminId,
        note: `Status updated to ${updateStatus} alongside admin reply`,
        changedAt: new Date()
      });
    } else if (ticket.status === 'OPEN') {
      ticket.status = 'IN_PROGRESS';
      ticket.statusHistory.push({
        status: 'IN_PROGRESS',
        changedBy: adminId,
        note: 'Admin replied; ticket progressed to In Progress',
        changedAt: new Date()
      });
    }

    await ticket.save();

    // Dispatch notification to customer
    try {
      await Notification.create({
        recipientId: ticket.customerId,
        type: 'SUPPORT_TICKET_REPLY',
        title: `New Reply: Ticket #${ticket.ticketNumber}`,
        message: `An administrator has replied to your support ticket #${ticket.ticketNumber} ("${ticket.subject}").`,
        relatedId: ticket._id
      });
    } catch (notifErr) {
      logger.warn('Failed to notify customer of admin reply:', notifErr.message);
    }

    const populatedTicket = await SupportTicket.findById(ticket._id)
      .populate('customerId', 'name email phone')
      .populate('orderId', 'orderNumber orderStatus totalAmount')
      .populate('assignedTo', 'name email')
      .populate('statusHistory.changedBy', 'name role')
      .lean();

    return res.status(200).json({
      success: true,
      message: 'Support reply sent successfully.',
      data: {
        ticket: populatedTicket
      }
    });
  } catch (error) {
    logger.error('Error in admin ticket reply:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send admin reply.'
    });
  }
};

/**
 * Admin: Assign ticket to an administrator
 * @route PATCH /api/admin/support/tickets/:ticketId/assign
 */
export const assignTicketAdmin = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const adminId = req.user.id;
    const { assignedTo } = req.body;

    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket ID.'
      });
    }

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found.'
      });
    }

    let targetAdmin = null;
    if (assignedTo && assignedTo !== 'none') {
      if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid assigned administrator ID.'
        });
      }

      targetAdmin = await User.findOne({ _id: assignedTo, role: 'ADMIN' });
      if (!targetAdmin) {
        return res.status(400).json({
          success: false,
          message: 'Selected user is not an administrator.'
        });
      }
    }

    ticket.assignedTo = targetAdmin ? targetAdmin._id : null;
    ticket.statusHistory.push({
      status: ticket.status,
      changedBy: adminId,
      note: targetAdmin
        ? `Ticket assigned to administrator ${targetAdmin.name}`
        : 'Ticket unassigned',
      changedAt: new Date()
    });

    await ticket.save();

    const populatedTicket = await SupportTicket.findById(ticket._id)
      .populate('customerId', 'name email phone')
      .populate('orderId', 'orderNumber orderStatus totalAmount')
      .populate('assignedTo', 'name email')
      .populate('statusHistory.changedBy', 'name role')
      .lean();

    return res.status(200).json({
      success: true,
      message: targetAdmin ? `Ticket assigned to ${targetAdmin.name}` : 'Ticket unassigned.',
      data: {
        ticket: populatedTicket
      }
    });
  } catch (error) {
    logger.error('Error assigning ticket:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update ticket assignment.'
    });
  }
};
