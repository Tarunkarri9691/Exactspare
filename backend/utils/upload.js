import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Absolute directory paths
const BASE_UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');
const SHOPS_DIR = path.join(BASE_UPLOADS_DIR, 'shops');
const PARTS_DIR = path.join(BASE_UPLOADS_DIR, 'parts');
const DOCUMENTS_DIR = path.join(BASE_UPLOADS_DIR, 'documents');
const TEMP_DIR = path.join(BASE_UPLOADS_DIR, 'temp');

// Ensure upload directories exist
[SHOPS_DIR, PARTS_DIR, DOCUMENTS_DIR, TEMP_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure Multer Disk Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (
      file.fieldname === 'shopImages' ||
      file.fieldname === 'shopExteriorImage' ||
      file.fieldname === 'shopInteriorImage'
    ) {
      cb(null, SHOPS_DIR);
    } else if (file.fieldname === 'partImages' || file.fieldname === 'images') {
      cb(null, PARTS_DIR);
    } else if (file.fieldname === 'verificationDocuments') {
      cb(null, DOCUMENTS_DIR);
    } else if (file.fieldname === 'image' || file.fieldname === 'searchImage') {
      cb(null, TEMP_DIR);
    } else {
      cb(new Error(`Unexpected upload field: ${file.fieldname}`), null);
    }
  },
  filename: (req, file, cb) => {
    const randomHex = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    const cleanExt = path.extname(file.originalname).toLowerCase();
    let prefix = 'upload';
    if (
      file.fieldname === 'shopImages' ||
      file.fieldname === 'shopExteriorImage' ||
      file.fieldname === 'shopInteriorImage'
    ) prefix = 'shop';
    else if (file.fieldname === 'partImages' || file.fieldname === 'images') prefix = 'part';
    else if (file.fieldname === 'verificationDocuments') prefix = 'doc';
    else if (file.fieldname === 'image' || file.fieldname === 'searchImage') prefix = 'search';

    cb(null, `${prefix}-${timestamp}-${randomHex}${cleanExt}`);
  }
});

// Strict MIME Type & Extension Filter (Supports any standard image format and documents)
const fileFilter = (req, file, cb) => {
  const allowedImageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif', '.heic', '.heif'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (
    file.fieldname === 'shopImages' ||
    file.fieldname === 'shopExteriorImage' ||
    file.fieldname === 'shopInteriorImage' ||
    file.fieldname === 'partImages' ||
    file.fieldname === 'images' ||
    file.fieldname === 'image' ||
    file.fieldname === 'partPhoto' ||
    file.fieldname === 'searchImage'
  ) {
    if (file.mimetype.startsWith('image/') || allowedImageExts.includes(ext)) {
      return cb(null, true);
    }
    return cb(new Error('Invalid image type. Please select a valid photo file (JPG, PNG, WebP, HEIC, etc.).'), false);
  }

  if (file.fieldname === 'verificationDocuments') {
    const allowedDocExts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.avif'];
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/') || allowedDocExts.includes(ext)) {
      return cb(null, true);
    }
    return cb(new Error('Invalid document type. Allowed types: PDF, JPG, PNG, WebP.'), false);
  }

  cb(new Error(`Unknown upload field: ${file.fieldname}`), false);
};

// Multer upload configurations
export const uploadShopApplicationFiles = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 10
  }
}).fields([
  { name: 'shopImages', maxCount: 8 },
  { name: 'shopExteriorImage', maxCount: 1 },
  { name: 'shopInteriorImage', maxCount: 1 },
  { name: 'verificationDocuments', maxCount: 5 }
]);

export const uploadPartImages = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 5 // Max 5 images per spare part
  }
}).array('partImages', 5);

export const uploadShopImages = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5
  }
}).array('shopImages', 5);

export const uploadSearchImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
}).single('image');

export const uploadPartScan = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, PARTS_DIR);
    },
    filename: (req, file, cb) => {
      const randomHex = crypto.randomBytes(8).toString('hex');
      const cleanExt = path.extname(file.originalname).toLowerCase();
      cb(null, `part-${Date.now()}-${randomHex}${cleanExt}`);
    }
  }),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
}).single('partPhoto');


/**
 * Safely delete an uploaded file by relative path without crashing
 * Prevents traversal attacks by resolving against BASE_UPLOADS_DIR
 */
export const deleteUploadedFile = (relativePath) => {
  if (!relativePath || typeof relativePath !== 'string') return;
  try {
    const cleanRel = relativePath.replace(/^\/+/, '').replace(/^uploads[\\/]/, '');
    const absolutePath = path.resolve(BASE_UPLOADS_DIR, cleanRel);

    // Security check: Must reside within BASE_UPLOADS_DIR
    if (!absolutePath.startsWith(BASE_UPLOADS_DIR)) {
      logger.warn(`Blocked attempt to delete file outside uploads directory: ${relativePath}`);
      return;
    }

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
      logger.debug(`Cleaned up file: ${absolutePath}`);
    }
  } catch (err) {
    logger.error(`Error deleting file ${relativePath}:`, err);
  }
};

/**
 * Clean up an array of uploaded files if an operation fails
 */
export const cleanupUploadedFiles = (files = []) => {
  if (!Array.isArray(files)) return;
  files.forEach((file) => {
    if (file && file.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (err) {
        logger.error(`Failed to clean up file ${file.path}:`, err);
      }
    }
  });
};

export { SHOPS_DIR, PARTS_DIR, DOCUMENTS_DIR, TEMP_DIR, BASE_UPLOADS_DIR };
