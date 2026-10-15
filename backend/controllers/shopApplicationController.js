import path from 'path';
import fs from 'fs';
import ShopApplication from '../models/ShopApplication.js';
import Notification from '../models/Notification.js';
import { DOCUMENTS_DIR } from '../utils/upload.js';
import { logger } from '../utils/logger.js';

/**
 * Validate all required fields for application submission
 */
const validateSubmissionFields = (data, imagePaths = []) => {
  const errors = [];

  if (!data.shopName || data.shopName.trim().length < 2) {
    errors.push('Shop name is required (at least 2 characters)');
  }
  if (!data.ownerFullName || data.ownerFullName.trim().length < 2) {
    errors.push('Owner full name is required');
  }
  if (!data.ownerPhone || data.ownerPhone.trim().length < 7) {
    errors.push('Valid owner phone number is required');
  }
  if (!data.businessEmail || !/^\S+@\S+\.\S+$/.test(data.businessEmail.trim())) {
    errors.push('Valid business email address is required');
  }
  if (!data.shopDescription || data.shopDescription.trim().length < 10) {
    errors.push('Shop description is required (at least 10 characters)');
  }
  if (!data.addressLine || data.addressLine.trim().length === 0) {
    errors.push('Shop street address is required');
  }
  if (!data.city || data.city.trim().length === 0) {
    errors.push('City is required');
  }
  if (!data.state || data.state.trim().length === 0) {
    errors.push('State is required');
  }
  if (!data.postalCode || data.postalCode.trim().length === 0) {
    errors.push('Postal code is required');
  }

  const lat = Number(data.latitude);
  const lng = Number(data.longitude);
  if (isNaN(lat) || lat < -90 || lat > 90) {
    errors.push('Valid latitude between -90 and 90 is required');
  }
  if (isNaN(lng) || lng < -180 || lng > 180) {
    errors.push('Valid longitude between -180 and 180 is required');
  }

  if (!data.openingHours || data.openingHours.trim().length === 0) {
    errors.push('Opening hours are required');
  }

  if (!imagePaths || imagePaths.length === 0) {
    errors.push('At least one shop photograph is required for verification');
  }

  return errors;
};

/**
 * Create a new Shop Owner Application (Draft or Initial Submit)
 * @route POST /api/shop-applications
 */
export const createApplication = async (req, res, next) => {
  try {
    // 1. Check user role
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({
        status: 'error',
        statusCode: 403,
        message: 'Forbidden: Only users with the OWNER role can submit a shop application.'
      });
    }

    // 2. Prevent duplicate active applications
    const existingApp = await ShopApplication.findOne({
      ownerId: req.user._id,
      status: { $in: ['DRAFT', 'PENDING', 'APPROVED', 'NEEDS_CORRECTION'] }
    });

    if (existingApp) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: `You already have an active application (${existingApp.status}). Duplicate applications are not permitted.`,
        applicationId: existingApp._id,
        currentStatus: existingApp.status
      });
    }

    // 3. Extract uploaded files safely
    const shopImages = req.files?.shopImages
      ? req.files.shopImages.map(f => `uploads/shops/${f.filename}`)
      : [];
    const verificationDocuments = req.files?.verificationDocuments
      ? req.files.verificationDocuments.map(f => `uploads/documents/${f.filename}`)
      : [];

    const {
      shopName,
      ownerFullName,
      ownerPhone,
      businessEmail,
      shopDescription,
      shopCategory,
      addressLine,
      city,
      state,
      postalCode,
      latitude,
      longitude,
      openingHours,
      action // 'SUBMIT' or 'SAVE_DRAFT'
    } = req.body;

    const lat = Number(latitude) || 0;
    const lng = Number(longitude) || 0;
    const isSubmitting = action === 'SUBMIT';

    // 4. Validate mandatory fields if user chose to SUBMIT directly
    if (isSubmitting) {
      const validationErrors = validateSubmissionFields(
        { ...req.body, latitude: lat, longitude: lng },
        shopImages
      );
      if (validationErrors.length > 0) {
        return res.status(400).json({
          status: 'error',
          statusCode: 400,
          message: 'Application submission failed validation',
          errors: validationErrors
        });
      }
    } else {
      // Basic minimal check for draft
      if (!shopName || shopName.trim().length < 2) {
        return res.status(400).json({
          status: 'error',
          statusCode: 400,
          message: 'Shop name is required to save an application draft.'
        });
      }
    }

    const applicationStatus = isSubmitting ? 'PENDING' : 'DRAFT';
    const now = new Date();

    const newApplication = await ShopApplication.create({
      ownerId: req.user._id,
      shopName: shopName.trim(),
      ownerFullName: (ownerFullName || req.user.name).trim(),
      ownerPhone: (ownerPhone || req.user.phone).trim(),
      businessEmail: (businessEmail || req.user.email).trim().toLowerCase(),
      shopDescription: (shopDescription || 'Automotive spare parts retail shop').trim(),
      shopCategory: shopCategory || 'MULTI_CATEGORY',
      addressLine: (addressLine || '').trim(),
      city: (city || '').trim(),
      state: (state || '').trim(),
      postalCode: (postalCode || '').trim(),
      latitude: lat,
      longitude: lng,
      openingHours: openingHours || 'Mon-Sat: 09:00 AM - 08:00 PM',
      shopImagePaths: shopImages,
      verificationDocumentPaths: verificationDocuments,
      status: applicationStatus,
      submittedAt: isSubmitting ? now : null,
      statusHistory: [
        {
          status: applicationStatus,
          changedBy: req.user._id,
          note: isSubmitting ? 'Initial application submitted for administrator review' : 'Application draft created',
          timestamp: now
        }
      ]
    });

    if (isSubmitting) {
      await Notification.create({
        recipientId: req.user._id,
        title: 'Application Submitted',
        message: `Your shop application for "${newApplication.shopName}" has been submitted and is currently pending administrator verification.`,
        type: 'APPLICATION_SUBMITTED',
        relatedId: newApplication._id
      });
    }

    logger.info(`Shop application ${isSubmitting ? 'submitted' : 'draft saved'} by user ${req.user.email} (ID: ${newApplication._id})`);

    res.status(201).json({
      status: 'ok',
      statusCode: 201,
      message: isSubmitting 
        ? 'Shop application submitted successfully. It is now awaiting admin review.' 
        : 'Shop application draft saved successfully.',
      application: newApplication
    });
  } catch (error) {
    logger.error('Error creating shop application:', error);
    next(error);
  }
};

/**
 * Get current authenticated owner's application
 * @route GET /api/shop-applications/my
 */
export const getMyApplication = async (req, res, next) => {
  try {
    const application = await ShopApplication.findOne({ ownerId: req.user._id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'ok',
      hasApplication: !!application,
      application
    });
  } catch (error) {
    logger.error('Error fetching owner application:', error);
    next(error);
  }
};

/**
 * Get application by ID (Owner of that application or ADMIN only)
 * @route GET /api/shop-applications/:id
 */
export const getApplicationById = async (req, res, next) => {
  try {
    const application = await ShopApplication.findById(req.params.id)
      .populate('reviewedBy', 'name email');

    if (!application) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Shop application not found.'
      });
    }

    // Role barrier: Only the owner of this application or an ADMIN can view it
    const isOwner = application.ownerId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        status: 'error',
        statusCode: 403,
        message: 'Forbidden: You do not have permission to view another merchant’s application.'
      });
    }

    res.status(200).json({
      status: 'ok',
      application
    });
  } catch (error) {
    logger.error('Error fetching application by ID:', error);
    next(error);
  }
};

/**
 * Update an existing application (Allowed only for DRAFT or NEEDS_CORRECTION)
 * @route PATCH /api/shop-applications/:id
 */
export const updateApplication = async (req, res, next) => {
  try {
    const application = await ShopApplication.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Shop application not found.'
      });
    }

    // Verify ownership
    if (application.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'error',
        statusCode: 403,
        message: 'Forbidden: You cannot modify another owner’s application.'
      });
    }

    // Enforce allowed edit states
    if (application.status === 'PENDING') {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'This application is currently pending administrator review and cannot be modified.'
      });
    }

    if (application.status === 'APPROVED') {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'This application has already been approved. Modifications must be made via store profile settings.'
      });
    }

    // Append any newly uploaded files
    const newShopImages = req.files?.shopImages
      ? req.files.shopImages.map(f => `uploads/shops/${f.filename}`)
      : [];
    const newVerificationDocs = req.files?.verificationDocuments
      ? req.files.verificationDocuments.map(f => `uploads/documents/${f.filename}`)
      : [];

    const updatedImagePaths = [...application.shopImagePaths, ...newShopImages];
    const updatedDocPaths = [...application.verificationDocumentPaths, ...newVerificationDocs];

    const {
      shopName,
      ownerFullName,
      ownerPhone,
      businessEmail,
      shopDescription,
      shopCategory,
      addressLine,
      city,
      state,
      postalCode,
      latitude,
      longitude,
      openingHours,
      action // 'SUBMIT' or 'SAVE_DRAFT'
    } = req.body;

    const lat = latitude !== undefined ? Number(latitude) : application.latitude;
    const lng = longitude !== undefined ? Number(longitude) : application.longitude;
    const isSubmitting = action === 'SUBMIT';

    if (isSubmitting) {
      const payloadToCheck = {
        shopName: shopName || application.shopName,
        ownerFullName: ownerFullName || application.ownerFullName,
        ownerPhone: ownerPhone || application.ownerPhone,
        businessEmail: businessEmail || application.businessEmail,
        shopDescription: shopDescription || application.shopDescription,
        addressLine: addressLine || application.addressLine,
        city: city || application.city,
        state: state || application.state,
        postalCode: postalCode || application.postalCode,
        latitude: lat,
        longitude: lng,
        openingHours: openingHours || application.openingHours
      };

      const validationErrors = validateSubmissionFields(payloadToCheck, updatedImagePaths);
      if (validationErrors.length > 0) {
        return res.status(400).json({
          status: 'error',
          statusCode: 400,
          message: 'Application update failed validation for submission',
          errors: validationErrors
        });
      }
    }

    // Apply updates
    if (shopName) application.shopName = shopName.trim();
    if (ownerFullName) application.ownerFullName = ownerFullName.trim();
    if (ownerPhone) application.ownerPhone = ownerPhone.trim();
    if (businessEmail) application.businessEmail = businessEmail.trim().toLowerCase();
    if (shopDescription) application.shopDescription = shopDescription.trim();
    if (shopCategory) application.shopCategory = shopCategory;
    if (addressLine) application.addressLine = addressLine.trim();
    if (city) application.city = city.trim();
    if (state) application.state = state.trim();
    if (postalCode) application.postalCode = postalCode.trim();
    if (!isNaN(lat)) application.latitude = lat;
    if (!isNaN(lng)) application.longitude = lng;
    if (openingHours) application.openingHours = openingHours;
    application.shopImagePaths = updatedImagePaths;
    application.verificationDocumentPaths = updatedDocPaths;

    const now = new Date();

    if (isSubmitting) {
      application.status = 'PENDING';
      application.submittedAt = now;
      application.rejectionReason = '';
      application.correctionMessage = '';
      application.statusHistory.push({
        status: 'PENDING',
        changedBy: req.user._id,
        note: 'Application resubmitted after owner revisions',
        timestamp: now
      });

      await Notification.create({
        recipientId: req.user._id,
        title: 'Application Resubmitted',
        message: `Your revised application for "${application.shopName}" has been submitted for administrator review.`,
        type: 'APPLICATION_SUBMITTED',
        relatedId: application._id
      });
    }

    await application.save();

    logger.info(`Shop application ${application._id} updated by owner ${req.user.email} (Status: ${application.status})`);

    res.status(200).json({
      status: 'ok',
      message: isSubmitting 
        ? 'Application successfully resubmitted for admin review.' 
        : 'Application draft changes saved.',
      application
    });
  } catch (error) {
    logger.error('Error updating shop application:', error);
    next(error);
  }
};

/**
 * Submit an existing DRAFT or NEEDS_CORRECTION application
 * @route POST /api/shop-applications/:id/submit
 */
export const submitApplication = async (req, res, next) => {
  try {
    const application = await ShopApplication.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Shop application not found.'
      });
    }

    if (application.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'error',
        statusCode: 403,
        message: 'Forbidden: You cannot submit another owner’s application.'
      });
    }

    if (!['DRAFT', 'NEEDS_CORRECTION'].includes(application.status)) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: `Application in '${application.status}' status cannot be submitted.`
      });
    }

    const validationErrors = validateSubmissionFields(application, application.shopImagePaths);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Application is missing mandatory fields required for submission.',
        errors: validationErrors
      });
    }

    const now = new Date();
    application.status = 'PENDING';
    application.submittedAt = now;
    application.statusHistory.push({
      status: 'PENDING',
      changedBy: req.user._id,
      note: 'Application submitted for review',
      timestamp: now
    });

    await application.save();

    await Notification.create({
      recipientId: req.user._id,
      title: 'Application Submitted',
      message: `Your shop application for "${application.shopName}" is now pending admin review.`,
      type: 'APPLICATION_SUBMITTED',
      relatedId: application._id
    });

    res.status(200).json({
      status: 'ok',
      message: 'Application submitted successfully for administrator review.',
      application
    });
  } catch (error) {
    logger.error('Error submitting shop application:', error);
    next(error);
  }
};

/**
 * Secure Verification Document Access
 * Only authorized application owner or ADMIN can retrieve private documents
 * @route GET /api/shop-applications/:id/documents/:filename
 */
export const getSecureDocument = async (req, res, next) => {
  try {
    const { id, filename } = req.params;
    const application = await ShopApplication.findById(id);

    if (!application) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Application not found.'
      });
    }

    const isOwner = application.ownerId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        status: 'error',
        statusCode: 403,
        message: 'Forbidden: You are not authorized to access this private verification document.'
      });
    }

    // Verify document belongs to this application
    const targetRelativePath = `uploads/documents/${filename}`;
    if (!application.verificationDocumentPaths.includes(targetRelativePath)) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'Document record not associated with this application.'
      });
    }

    const filePath = path.join(DOCUMENTS_DIR, path.basename(filename));

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'File not found on server storage.'
      });
    }

    res.sendFile(filePath);
  } catch (error) {
    logger.error('Error serving secure document:', error);
    next(error);
  }
};
