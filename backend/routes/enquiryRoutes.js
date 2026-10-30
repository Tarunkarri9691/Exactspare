import express from 'express';
import {
  createEnquiry,
  getOwnerEnquiries,
  getCustomerEnquiries,
  getEnquiryById,
  updateEnquiryStatus,
  replyToEnquiry
} from '../controllers/enquiryController.js';
import { authenticateUser, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Enforce authentication on all enquiry endpoints
router.use(authenticateUser);

// Customer submits an enquiry for a shop / spare part
router.post('/', createEnquiry);

// Shop Owner retrieves enquiries addressed to their shop
router.get('/owner', authorizeRoles('OWNER'), getOwnerEnquiries);

// Customer views their own submitted enquiries
router.get('/my', getCustomerEnquiries);

// Retrieve a single enquiry by ID (with authorization check)
router.get('/:id', getEnquiryById);

// Owner updates enquiry status (NEW, IN_PROGRESS, REPLIED, CLOSED)
router.patch('/:id/status', authorizeRoles('OWNER'), updateEnquiryStatus);

// Owner or Customer adds a reply message to the enquiry thread
router.post('/:id/reply', replyToEnquiry);

export default router;
