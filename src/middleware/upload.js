const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine upload directory based on file type
    let uploadPath;

    if (
      file.fieldname === "event_image" ||
      file.fieldname === "image" ||
      file.fieldname === "image_url"
    ) {
      uploadPath = path.join(__dirname, "..", "..", "uploads", "events");
    } else if (
      file.fieldname === "logo" ||
      file.fieldname === "organizer_logo"
    ) {
      uploadPath = path.join(__dirname, "..", "..", "uploads", "organizers");
    } else if (
      file.fieldname === "profile_image" ||
      file.fieldname === "profile_images"
    ) {
      uploadPath = path.join(__dirname, "..", "..", "uploads", "profiles");
    } else if (file.fieldname === "qr_code") {
      uploadPath = path.join(__dirname, "..", "..", "uploads", "qrcodes");
    } else if (file.fieldname.startsWith("merchandise_image")) {
      uploadPath = path.join(__dirname, "..", "..", "uploads", "merchandise");
    } else if (
      file.fieldname === "verification_docs"
    ) {
      uploadPath = path.join(__dirname, "..", "..", "uploads", "documents");
    } else {
      uploadPath = path.join(__dirname, "..", "..", "uploads", "misc");
    }

    console.log("📁 Upload destination:", uploadPath);
    console.log("📁 Directory exists:", fs.existsSync(uploadPath));

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
      console.log("📁 Created directory:", uploadPath);
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    const filename = `${file.fieldname}-${uniqueSuffix}${extension}`;
    console.log("📄 Generated filename:", filename);
    cb(null, filename);
  },
});

// File filter to allow only specific file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      ".xlsx",
  };

  if (allowedTypes[file.mimetype]) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type. Allowed types: ${Object.values(allowedTypes).join(
          ", "
        )}`
      ),
      false
    );
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

const imageMaxWidth = (fieldname) => {
  if (fieldname === "profile_image" || fieldname === "profile_images") {
    return 1200;
  }
  if (fieldname === "logo" || fieldname === "organizer_logo") {
    return 1200;
  }
  if (fieldname?.startsWith("merchandise_image")) return 1600;
  return 1920;
};

const optimizeImageFile = async (file) => {
  if (
    !file?.mimetype?.startsWith("image/") ||
    file.mimetype === "image/gif" ||
    file.fieldname === "qr_code"
  ) {
    return;
  }

  const originalPath = file.path;
  const parsed = path.parse(originalPath);
  const finalPath = path.join(parsed.dir, `${parsed.name}.webp`);
  const outputPath =
    path.resolve(finalPath) === path.resolve(originalPath)
      ? path.join(parsed.dir, `${parsed.name}.optimized.webp`)
      : finalPath;

  await sharp(originalPath)
    .rotate()
    .resize({
      width: imageMaxWidth(file.fieldname),
      height: imageMaxWidth(file.fieldname),
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 78, effort: 4 })
    .toFile(outputPath);

  await fs.promises.unlink(originalPath);
  if (outputPath !== finalPath) {
    await fs.promises.rename(outputPath, finalPath);
  }

  file.path = finalPath;
  file.filename = path.basename(finalPath);
  file.mimetype = "image/webp";
  file.size = (await fs.promises.stat(finalPath)).size;
};

const uploadedFiles = (req) => {
  if (req.file) return [req.file];
  if (Array.isArray(req.files)) return req.files;
  if (req.files && typeof req.files === "object") {
    return Object.values(req.files).flat();
  }
  return [];
};

const withImageOptimization = (multerMiddleware) => (req, res, next) => {
  multerMiddleware(req, res, async (error) => {
    if (error) return next(error);
    try {
      await Promise.all(uploadedFiles(req).map(optimizeImageFile));
      next();
    } catch (optimizationError) {
      next(optimizationError);
    }
  });
};

// Middleware for single event image upload (flexible field names)
const uploadEventImage = withImageOptimization(upload.single("event_image"));

// Alternative middleware for single event image upload with "image" field name
const uploadEventImageAlt = withImageOptimization(upload.single("image"));

// Middleware for single organizer logo upload
const uploadOrganizerLogo = withImageOptimization(upload.single("logo"));

// Middleware for single profile picture upload
const uploadProfileImage = withImageOptimization(
  upload.single("profile_image")
);

// Middleware for artist profile gallery (single legacy + multi upload)
const uploadArtistProfileImages = withImageOptimization(
  upload.fields([
    { name: "profile_image", maxCount: 1 },
    { name: "profile_images", maxCount: 10 },
  ])
);

// Middleware for QR code upload
const uploadQRCode = upload.single("qr_code");

// Middleware for multiple documents upload (for verification, KRA, etc.)
const uploadDocuments = upload.array("documents", 10); // Max 10 files

// Middleware for verification documents (organizer registration)
const uploadVerificationDocs = upload.fields([
  { name: "kra_certificate", maxCount: 1 },
  { name: "business_certificate", maxCount: 1 },
  { name: "id_document", maxCount: 2 },
  { name: "bank_statement", maxCount: 1 },
]);

// Middleware for multiple event images (if needed)
const uploadMultipleEventImages = withImageOptimization(
  upload.array("event_images", 5)
); // Max 5 images

// Error handling middleware for multer
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 10MB.",
      });
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Too many files. Maximum is 10 files.",
      });
    }
    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        message: "Unexpected file field.",
      });
    }
  }

  if (error && error.message.includes("Invalid file type")) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  next(error);
};

// Event create/update: cover image + optional merchandise images
const uploadEventForm = withImageOptimization(upload.any());

module.exports = {
  uploadEventImage,
  uploadEventImageAlt,
  uploadEventForm,
  uploadOrganizerLogo,
  uploadProfileImage,
  uploadArtistProfileImages,
  uploadQRCode,
  uploadDocuments,
  uploadVerificationDocs,
  uploadMultipleEventImages,
  handleUploadError,
};
