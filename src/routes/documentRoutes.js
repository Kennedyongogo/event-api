const express = require("express");
const router = express.Router();
const {
  getAllDocuments,
  getDocumentById,
  createDocument,
  uploadDocuments,
  updateDocument,
  deleteDocument,
  getDocumentsByType,
  getDocumentsByCategory,
  getDocumentsByFileType,
  getDocumentsByUploader,
  getDocumentStatistics,
} = require("../controllers/documentController");
const { authenticateToken } = require("../middleware/auth");
const { errorHandler } = require("../middleware/errorHandler");
const {
  uploadGeneralDocuments: uploadMiddleware,
  handleUploadError,
} = require("../middleware/upload");

// All routes require authentication
router.use(authenticateToken);

// Document routes
router.get("/", getAllDocuments);
router.get("/stats", getDocumentStatistics);
router.get("/type/:document_type", getDocumentsByType);
router.get("/category/:category", getDocumentsByCategory);
router.get("/file-type/:file_type", getDocumentsByFileType);
router.get("/uploader/:admin_id", getDocumentsByUploader);
router.get("/:id", getDocumentById);

// File upload routes
router.post("/upload", uploadMiddleware, handleUploadError, uploadDocuments);
router.post("/", createDocument); // For URL-based documents

router.put("/:id", updateDocument);
router.delete("/:id", deleteDocument);

// Error handling middleware
router.use(errorHandler);

module.exports = router;
