const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine upload directory based on file type
    let uploadPath;
    if (file.fieldname === "blueprint" || file.fieldname === "blueprints") {
      uploadPath = path.join(__dirname, "..", "..", "uploads", "projects");
    } else if (file.fieldname === "documents") {
      uploadPath = path.join(
        __dirname,
        "..",
        "..",
        "uploads",
        "projectdocuments"
      );
    } else if (file.fieldname === "general_documents") {
      uploadPath = path.join(__dirname, "..", "..", "uploads", "documents");
    } else if (file.fieldname === "profile_picture") {
      uploadPath = path.join(__dirname, "..", "..", "uploads", "documents");
    } else if (
      file.fieldname === "progress_images" ||
      file.fieldname === "images"
    ) {
      uploadPath = path.join(
        __dirname,
        "..",
        "..",
        "uploads",
        "progress-updates"
      );
    } else {
      uploadPath = path.join(__dirname, "..", "..", "uploads", "documents");
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

// Middleware for single file upload (blueprint)
const uploadBlueprint = upload.single("blueprint");

// Middleware for multiple blueprint files upload
const uploadBlueprints = upload.fields([
  { name: "blueprints", maxCount: 10 },
  { name: "documents", maxCount: 10 },
]); // Max 10 blueprint files and 10 document files

// Middleware for multiple file upload (documents)
const uploadDocuments = upload.array("documents", 10); // Max 10 files

// Middleware for general document uploads (goes to documents folder)
const uploadGeneralDocuments = upload.array("general_documents", 10); // Max 10 files

// Middleware for single profile picture upload
const uploadProfilePicture = upload.single("profile_picture");

// Middleware for progress update images upload
const uploadProgressImages = upload.array("progress_images", 10); // Max 10 progress images

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
  }

  if (error.message.includes("Invalid file type")) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  next(error);
};

module.exports = {
  uploadBlueprint,
  uploadBlueprints,
  uploadDocuments,
  uploadGeneralDocuments,
  uploadProfilePicture,
  uploadProgressImages,
  handleUploadError,
};
