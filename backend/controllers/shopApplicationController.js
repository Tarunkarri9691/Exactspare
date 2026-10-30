import path from 'path';
import fs from 'fs';
import ShopApplication from '../models/ShopApplication.js';
import Shop from '../models/Shop.js';
import User from '../models/User.js';
import PaymentConfig from '../models/PaymentConfig.js';
import Notification from '../models/Notification.js';
import Subscription from '../models/Subscription.js';
import { DOCUMENTS_DIR } from '../utils/upload.js';
import { logger } from '../utils/logger.js';
import { validateStrictPhoneNumber } from '../utils/validation.js';

/**
 * Strict UPI UTR Validator:
 * - Real UPI transaction references are 12 digits (or standard banking UTR prefixed with UPI)
 * - Rejects repeating digits (000000000000, 111111111111, etc.)
 * - Rejects dummy sequences (123456789012, 987654321098, etc.)
 */
export const validateStrictUtr = (utr) => {
  if (!utr || typeof utr !== 'string') {
    return { valid: false, message: 'UPI UTR / Reference number is required for direct payment activation' };
  }
  const clean = utr.trim();
  const is12Digit = /^\d{12}$/.test(clean);
  const isPrefix12 = /^UPI\d{12}$/i.test(clean);

  if (!is12Digit && !isPrefix12) {
    return { valid: false, message: 'UPI UTR / Reference Number must be a genuine 12-digit transaction number (e.g. 429108392102)' };
  }

  const digits = clean.replace(/^UPI/i, '');
  if (/^(\d)\1{11}$/.test(digits)) {
    return { valid: false, message: 'Invalid dummy UTR: Repeating digits are not allowed' };
  }

  const dummyUtrs = ['123456789012', '987654321098', '012345678901', '112233445566', '000000000000'];
  if (dummyUtrs.includes(digits)) {
    return { valid: false, message: 'Dummy sequence UTR numbers are not allowed. Please enter your real UPI payment reference.' };
  }

  return { valid: true, cleanUtr: clean };
};

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

  // Strict Phone Validation (No random numbers, no fake repeated digits)
  const phoneCheck = validateStrictPhoneNumber(data.ownerPhone);
  if (!phoneCheck.valid) {
    errors.push(phoneCheck.message || 'Please provide a genuine 10-digit mobile number (starting with 6, 7, 8, or 9). Random or fake numbers are not allowed.');
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

    // 3. Extract uploaded files safely (including exterior and interior photos)
    const directShopImages = req.files?.shopImages
      ? req.files.shopImages.map(f => `uploads/shops/${f.filename}`)
      : [];
    const exteriorImages = req.files?.shopExteriorImage
      ? req.files.shopExteriorImage.map(f => `uploads/shops/${f.filename}`)
      : [];
    const interiorImages = req.files?.shopInteriorImage
      ? req.files.shopInteriorImage.map(f => `uploads/shops/${f.filename}`)
      : [];
    const shopImages = [...directShopImages, ...exteriorImages, ...interiorImages];
    const verificationDocuments = req.files?.verificationDocuments
      ? req.files.verificationDocuments.map(f => `uploads/documents/${f.filename}`)
      : [];

    const {
      shopName,
      ownerFullName,
      ownerPhone,
      alternatePhone,
      ownerBusinessRole,
      businessPhone,
      businessEmail,
      yearsInBusiness,
      shopDescription,
      shopCategory,
      addressLine,
      locality,
      city,
      state,
      postalCode,
      country,
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

    const paymentUtr = (req.body.paymentUtr || req.body.utr || '').trim();
    const hasPaymentUtr = isSubmitting && Boolean(paymentUtr);

    if (isSubmitting) {
      const phoneToValidate = (ownerPhone || req.user.phone || '').trim();
      const phoneValidation = validateStrictPhoneNumber(phoneToValidate);
      if (!phoneValidation.valid) {
        return res.status(400).json({
          status: 'error',
          statusCode: 400,
          message: phoneValidation.message || 'Please enter a genuine 10-digit mobile number. Random or fake numbers are not allowed.'
        });
      }

      if (hasPaymentUtr) {
        const utrValidation = validateStrictUtr(paymentUtr);
        if (!utrValidation.valid) {
          return res.status(400).json({
            status: 'error',
            statusCode: 400,
            message: utrValidation.message
          });
        }

        // Strict anti-duplicate check: prevent using the same UTR multiple times
        const duplicateUtr = await ShopApplication.findOne({
          paymentUtr: paymentUtr,
          paymentStatus: { $in: ['PAID', 'PENDING_VERIFICATION'] }
        });
        if (duplicateUtr) {
          return res.status(400).json({
            status: 'error',
            statusCode: 400,
            message: `This UPI UTR / Transaction Reference Number (${paymentUtr}) has already been used for another shop application. Duplicate UTR reuse is strictly prevented. Please provide your unique payment reference.`
          });
        }
      }
    }

    const applicationStatus = isSubmitting ? 'APPROVED' : 'DRAFT';
    const now = new Date();

    const newApplication = await ShopApplication.create({
      ownerId: req.user._id,
      shopName: shopName.trim(),
      ownerFullName: (ownerFullName || req.user.name).trim(),
      ownerPhone: (ownerPhone || req.user.phone).trim(),
      alternatePhone: (alternatePhone || '').trim(),
      ownerBusinessRole: (ownerBusinessRole || 'Proprietor').trim(),
      businessPhone: (businessPhone || '').trim(),
      businessEmail: (businessEmail || req.user.email).trim().toLowerCase(),
      yearsInBusiness: Number(yearsInBusiness) || 0,
      shopDescription: (shopDescription || 'Automotive spare parts retail shop').trim(),
      shopCategory: shopCategory || 'MULTI_CATEGORY',
      addressLine: (addressLine || '').trim(),
      locality: (locality || '').trim(),
      city: (city || '').trim(),
      state: (state || '').trim(),
      postalCode: (postalCode || '').trim(),
      country: (country || 'India').trim(),
      latitude: lat,
      longitude: lng,
      openingHours: openingHours || 'Mon-Sat: 09:00 AM - 08:00 PM',
      shopExteriorImagePath: exteriorImages[0] || '',
      shopInteriorImagePath: interiorImages[0] || '',
      shopImagePaths: shopImages,
      verificationDocumentPaths: verificationDocuments,
      status: applicationStatus,
      paymentStatus: 'UNPAID',
      paymentMethod: 'UPI_SCANNER',
      paymentUtr: paymentUtr || '',
      paymentAmount: Number(req.body.paymentAmount) || 499,
      paidAt: null,
      directActivated: isSubmitting,
      submittedAt: isSubmitting ? now : null,
      reviewedAt: isSubmitting ? now : null,
      reviewedBy: null,
      statusHistory: [
        {
          status: applicationStatus,
          changedBy: req.user._id,
          note: isSubmitting 
            ? 'Basic details submitted and directly approved. Awaiting merchant subscription.' 
            : 'Application draft created',
          timestamp: now
        }
      ]
    });

    if (isSubmitting) {
      // Check if owner already has an active subscription
      const activeSub = await Subscription.findOne({
        ownerId: req.user._id,
        status: 'ACTIVE',
        expiryDate: { $gt: now }
      });

      // Directly create or update the Shop record
      await Shop.findOneAndUpdate(
        { ownerId: req.user._id },
        {
          ownerId: req.user._id,
          applicationId: newApplication._id,
          name: newApplication.shopName,
          category: newApplication.shopCategory,
          description: newApplication.shopDescription,
          address: {
            addressLine: newApplication.addressLine,
            city: newApplication.city,
            state: newApplication.state,
            postalCode: newApplication.postalCode,
            location: {
              type: 'Point',
              coordinates: [lng, lat]
            }
          },
          contact: {
            phone: newApplication.ownerPhone,
            email: newApplication.businessEmail
          },
          openingHours: newApplication.openingHours,
          images: newApplication.shopImagePaths,
          isApproved: true,
          isActive: !!activeSub,
          approvedAt: now
        },
        { upsert: true, new: true }
      );

      await Notification.create({
        recipientId: req.user._id,
        title: 'Shop Details Directly Approved!',
        message: `Your basic shop details for "${newApplication.shopName}" have been directly registered and approved. Please subscribe to activate your shop and inventory.`,
        type: 'APPLICATION_APPROVED',
        relatedId: newApplication._id
      });
    }

    logger.info(`Shop application ${isSubmitting ? 'submitted and directly approved' : 'draft saved'} by user ${req.user.email} (ID: ${newApplication._id})`);

    res.status(201).json({
      status: 'ok',
      statusCode: 201,
      message: isSubmitting 
        ? 'Shop details registered and directly approved! Please complete your subscription to activate your shop.' 
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
    const newExteriorImages = req.files?.shopExteriorImage
      ? req.files.shopExteriorImage.map(f => `uploads/shops/${f.filename}`)
      : [];
    const newInteriorImages = req.files?.shopInteriorImage
      ? req.files.shopInteriorImage.map(f => `uploads/shops/${f.filename}`)
      : [];
    const newVerificationDocs = req.files?.verificationDocuments
      ? req.files.verificationDocuments.map(f => `uploads/documents/${f.filename}`)
      : [];

    const updatedImagePaths = [...application.shopImagePaths, ...newShopImages, ...newExteriorImages, ...newInteriorImages];
    const updatedDocPaths = [...application.verificationDocumentPaths, ...newVerificationDocs];

    const {
      shopName,
      ownerFullName,
      ownerPhone,
      alternatePhone,
      ownerBusinessRole,
      businessPhone,
      businessEmail,
      yearsInBusiness,
      shopDescription,
      shopCategory,
      addressLine,
      locality,
      city,
      state,
      postalCode,
      country,
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
        alternatePhone: alternatePhone !== undefined ? alternatePhone : application.alternatePhone,
        ownerBusinessRole: ownerBusinessRole || application.ownerBusinessRole,
        businessPhone: businessPhone !== undefined ? businessPhone : application.businessPhone,
        businessEmail: businessEmail || application.businessEmail,
        yearsInBusiness: yearsInBusiness !== undefined ? yearsInBusiness : application.yearsInBusiness,
        shopDescription: shopDescription || application.shopDescription,
        shopCategory: shopCategory || application.shopCategory,
        addressLine: addressLine || application.addressLine,
        locality: locality !== undefined ? locality : application.locality,
        city: city || application.city,
        state: state || application.state,
        postalCode: postalCode || application.postalCode,
        country: country || application.country,
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
    if (alternatePhone !== undefined) application.alternatePhone = alternatePhone.trim();
    if (ownerBusinessRole) application.ownerBusinessRole = ownerBusinessRole.trim();
    if (businessPhone !== undefined) application.businessPhone = businessPhone.trim();
    if (businessEmail) application.businessEmail = businessEmail.trim().toLowerCase();
    if (yearsInBusiness !== undefined && yearsInBusiness !== '') application.yearsInBusiness = Number(yearsInBusiness) || 0;
    if (shopDescription) application.shopDescription = shopDescription.trim();
    if (shopCategory) application.shopCategory = shopCategory;
    if (addressLine) application.addressLine = addressLine.trim();
    if (locality !== undefined) application.locality = locality.trim();
    if (city) application.city = city.trim();
    if (state) application.state = state.trim();
    if (postalCode) application.postalCode = postalCode.trim();
    if (country) application.country = country.trim();
    if (newExteriorImages.length > 0) application.shopExteriorImagePath = newExteriorImages[0];
    if (newInteriorImages.length > 0) application.shopInteriorImagePath = newInteriorImages[0];
    if (!isNaN(lat)) application.latitude = lat;
    if (!isNaN(lng)) application.longitude = lng;
    if (openingHours) application.openingHours = openingHours;
    application.shopImagePaths = updatedImagePaths;
    application.verificationDocumentPaths = updatedDocPaths;

    const now = new Date();

    const paymentUtr = (req.body.paymentUtr || req.body.utr || '').trim();
    const hasPaymentUtr = isSubmitting && Boolean(paymentUtr);

    if (isSubmitting) {
      if (hasPaymentUtr) {
        const utrValidation = validateStrictUtr(paymentUtr);
        if (!utrValidation.valid) {
          return res.status(400).json({
            status: 'error',
            statusCode: 400,
            message: utrValidation.message
          });
        }

        // Strict anti-duplicate check: prevent using the same UTR multiple times
        const duplicateUtr = await ShopApplication.findOne({
          paymentUtr: paymentUtr,
          paymentStatus: { $in: ['PAID', 'PENDING_VERIFICATION'] },
          _id: { $ne: application._id }
        });
        if (duplicateUtr) {
          return res.status(400).json({
            status: 'error',
            statusCode: 400,
            message: `This UPI UTR / Transaction Reference Number (${paymentUtr}) has already been used for another shop application. Duplicate UTR reuse is strictly prevented. Please provide your unique payment reference.`
          });
        }

        application.paymentStatus = 'PENDING_VERIFICATION';
        application.paymentMethod = req.body.paymentMethod || 'UPI_SCANNER';
        application.paymentUtr = paymentUtr;
        application.paymentAmount = Number(req.body.paymentAmount) || 499;
      }

      application.status = 'APPROVED';
      application.submittedAt = now;
      application.reviewedAt = now;
      application.directActivated = true;
      application.rejectionReason = '';
      application.correctionMessage = '';
      application.statusHistory.push({
        status: 'APPROVED',
        changedBy: req.user._id,
        note: 'Application details updated and directly approved',
        timestamp: now
      });

      // Check if owner already has an active subscription
      const activeSub = await Subscription.findOne({
        ownerId: req.user._id,
        status: 'ACTIVE',
        expiryDate: { $gt: now }
      });

      // Directly sync the Shop record
      await Shop.findOneAndUpdate(
        { ownerId: req.user._id },
        {
          ownerId: req.user._id,
          applicationId: application._id,
          name: application.shopName,
          category: application.shopCategory,
          description: application.shopDescription,
          address: {
            addressLine: application.addressLine,
            city: application.city,
            state: application.state,
            postalCode: application.postalCode,
            location: {
              type: 'Point',
              coordinates: [application.longitude, application.latitude]
            }
          },
          contact: {
            phone: application.ownerPhone,
            email: application.businessEmail
          },
          openingHours: application.openingHours,
          images: application.shopImagePaths,
          isApproved: true,
          isActive: !!activeSub,
          approvedAt: now
        },
        { upsert: true, new: true }
      );

      await Notification.create({
        recipientId: req.user._id,
        title: 'Shop Details Directly Approved!',
        message: `Your updated shop details for "${application.shopName}" have been directly approved. Please subscribe to activate your shop and inventory.`,
        type: 'APPLICATION_APPROVED',
        relatedId: application._id
      });
    }

    await application.save();

    logger.info(`Shop application ${application._id} updated and directly approved by owner ${req.user.email}`);

    res.status(200).json({
      status: 'ok',
      message: isSubmitting 
        ? 'Application details updated and directly approved! Please complete your subscription to activate your shop.'
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
    application.status = 'APPROVED';
    application.submittedAt = now;
    application.reviewedAt = now;
    application.directActivated = true;
    application.statusHistory.push({
      status: 'APPROVED',
      changedBy: req.user._id,
      note: 'Application submitted and directly approved',
      timestamp: now
    });

    const activeSub = await Subscription.findOne({
      ownerId: req.user._id,
      status: 'ACTIVE',
      expiryDate: { $gt: now }
    });

    await Shop.findOneAndUpdate(
      { ownerId: req.user._id },
      {
        ownerId: req.user._id,
        applicationId: application._id,
        name: application.shopName,
        category: application.shopCategory,
        description: application.shopDescription,
        address: {
          addressLine: application.addressLine,
          city: application.city,
          state: application.state,
          postalCode: application.postalCode,
          location: {
            type: 'Point',
            coordinates: [application.longitude, application.latitude]
          }
        },
        contact: {
          phone: application.ownerPhone,
          email: application.businessEmail
        },
        openingHours: application.openingHours,
        images: application.shopImagePaths,
        isApproved: true,
        isActive: !!activeSub,
        approvedAt: now
      },
      { upsert: true, new: true }
    );

    await application.save();

    await Notification.create({
      recipientId: req.user._id,
      title: 'Shop Details Directly Approved!',
      message: `Your shop application for "${application.shopName}" has been directly approved. Please subscribe to activate your shop and inventory.`,
      type: 'APPLICATION_APPROVED',
      relatedId: application._id
    });

    res.status(200).json({
      status: 'ok',
      message: 'Application submitted and directly approved! Please complete your subscription to activate your shop.',
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

/**
 * Retrieve Active Admin Payment Scanner Configuration
 * @route GET /api/shop-applications/scanner-config
 */
export const getPaymentScannerConfig = async (req, res, next) => {
  try {
    let config = await PaymentConfig.findOne({ key: 'ADMIN_SCANNER' });
    if (!config) {
      config = await PaymentConfig.create({
        key: 'ADMIN_SCANNER',
        upiId: 'exactspare.merchant@upi',
        payeeName: 'EXACTSPARE Merchant Services',
        registrationFee: 499,
        instructions: 'Scan this Admin QR code with Google Pay, PhonePe, Paytm, or BHIM. Enter your 12-digit UTR/Reference number below to activate your Shop Owner Portal immediately without waiting for admin approval.',
        isActive: true
      });
    }

    const upiUri = `upi://pay?pa=${encodeURIComponent(config.upiId)}&pn=${encodeURIComponent(config.payeeName)}&am=${config.registrationFee}&cu=INR&tn=${encodeURIComponent('Shop Registration Onboarding')}`;

    res.status(200).json({
      status: 'ok',
      config: {
        upiId: config.upiId,
        payeeName: config.payeeName,
        registrationFee: config.registrationFee,
        instructions: config.instructions,
        upiUri,
        qrCodeImage: config.qrCodeImage || null,
        isActive: config.isActive
      }
    });
  } catch (error) {
    logger.error('Error fetching payment scanner config:', error);
    next(error);
  }
};

/**
 * Pay via Scanner / Direct Payment and Immediately Activate Shop Owner Portal
 * Directly approves application, creates/updates active Shop record, and opens owner access
 * @route POST /api/shop-applications/pay-and-activate
 * @route POST /api/shop-applications/:id/pay-and-activate
 */
export const payAndActivateApplication = async (req, res, next) => {
  try {
    const applicationId = req.params.id || req.body.applicationId;
    let application = null;

    if (applicationId) {
      application = await ShopApplication.findById(applicationId);
    } else {
      application = await ShopApplication.findOne({ ownerId: req.user._id })
        .sort({ createdAt: -1 });
    }

    if (!application) {
      return res.status(404).json({
        status: 'error',
        statusCode: 404,
        message: 'No shop application found for your merchant account. Please fill out shop details first.'
      });
    }

    if (application.ownerId.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        status: 'error',
        statusCode: 403,
        message: 'Forbidden: You cannot pay or activate another owner’s application.'
      });
    }

    // Idempotency check:
    if (application.paymentStatus === 'PAID') {
      const existingShop = await Shop.findOne({ applicationId: application._id });
      return res.status(200).json({
        status: 'ok',
        message: 'Payment has already been confirmed and verified.',
        application,
        shop: existingShop
      });
    }

    const { utr, paymentUtr, paymentAmount, paymentMethod } = req.body;
    let finalUtr = (utr || paymentUtr || '').trim();

    if (!finalUtr) {
      finalUtr = `DIR-APP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const now = new Date();

    // Payment is recorded as PENDING_VERIFICATION; genuine admin verification is required
    application.paymentStatus = 'PENDING_VERIFICATION';
    if (application.status === 'DRAFT') {
      application.status = 'PENDING';
    }
    application.paymentMethod = paymentMethod || 'UPI_SCANNER';
    application.paymentUtr = finalUtr;
    application.paymentAmount = Number(paymentAmount) || 499;
    application.paymentRejectionReason = '';
    application.directActivated = false;

    if (!application.submittedAt) {
      application.submittedAt = now;
    }

    application.statusHistory.push({
      status: application.status,
      changedBy: req.user._id,
      note: `Payment reference (${finalUtr}) submitted via ${application.paymentMethod}. Awaiting administrative verification.`,
      timestamp: now
    });

    await application.save();

    logger.info(`Shop application ${application._id} payment submitted for verification by ${req.user.email} (UTR: ${finalUtr})`);

    res.status(200).json({
      status: 'ok',
      message: 'Payment reference submitted successfully. Payment is pending administrative verification.',
      application
    });
  } catch (error) {
    logger.error('Error in direct payment approval:', error);
    next(error);
  }
};

