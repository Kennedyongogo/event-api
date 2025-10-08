const express = require("express");
const router = express.Router();
const {
  getAllProgressUpdates,
  getProgressUpdateById,
  createProgressUpdate,
  updateProgressUpdate,
  deleteProgressUpdate,
  getProgressUpdatesByTask,
  getLatestProgressUpdates,
  getProgressTimeline,
  uploadProgressUpdateImages,
} = require("../controllers/progressUpdateController");
const { authenticateToken } = require("../middleware/auth");
const { errorHandler } = require("../middleware/errorHandler");
const { uploadProgressImages } = require("../middleware/upload");

// All routes require authentication
router.use(authenticateToken);

// Progress Update routes
router.get("/", getAllProgressUpdates);
router.get("/latest", getLatestProgressUpdates);
router.get("/timeline/:task_id", getProgressTimeline);
router.get("/task/:task_id", getProgressUpdatesByTask);
router.get("/:id", getProgressUpdateById);
router.post("/", uploadProgressImages, createProgressUpdate);
router.post(
  "/:id/upload-images",
  uploadProgressImages,
  uploadProgressUpdateImages
);
router.put("/:id", uploadProgressImages, updateProgressUpdate);
router.delete("/:id", deleteProgressUpdate);

// Error handling middleware
router.use(errorHandler);

module.exports = router;
