const multer = require("multer");
const path = require("path");
const fs = require("fs");

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
    } else if (file.fieldname === "profile_image") {
      uploadPath = path.join(__dirname, "..", "..", "uploads", "profiles");
    } else if (file.fieldname === "qr_code") {
      uploadPath = path.join(__dirname, "..", "..", "uploads", "qrcodes");
    } else if (
      file.fieldname === "documents" ||
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

// Middleware for single event image upload (flexible field names)
const uploadEventImage = upload.single("event_image");

// Alternative middleware for single event image upload with "image" field name
const uploadEventImageAlt = upload.single("image");

// Middleware for single organizer logo upload
const uploadOrganizerLogo = upload.single("logo");

// Middleware for single profile picture upload
const uploadProfileImage = upload.single("profile_image");

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
const uploadMultipleEventImages = upload.array("event_images", 5); // Max 5 images

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

module.exports = {
  uploadEventImage,
  uploadEventImageAlt,
  uploadOrganizerLogo,
  uploadProfileImage,
  uploadQRCode,
  uploadDocuments,
  uploadVerificationDocs,
  uploadMultipleEventImages,
  handleUploadError,
};
