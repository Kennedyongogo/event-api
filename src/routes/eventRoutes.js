const express = require("express");
const router = express.Router();
const {
  createEvent,
  getAllEvents,
  getPublicEvents,
  getEventById,
  updateEvent,
  approveEvent,
  rejectEvent,
  cancelEvent,
  deleteEvent,
} = require("../controllers/eventController");
const {
  authenticateOrganizer,
  authenticateAdmin,
  authenticateAdminOrOrganizer,
  optionalAuth,
  verifyOrganizerOwnership,
} = require("../middleware/auth");
const { uploadEventImage, handleUploadError } = require("../middleware/upload");
const { errorHandler } = require("../middleware/errorHandler");

// Public routes
router.get("/public", optionalAuth, getPublicEvents);
router.get("/public/:id", optionalAuth, getEventById);

// Protected routes - Organizer
router.post(
  "/",
  authenticateOrganizer,
  uploadEventImage,
  handleUploadError,
  createEvent
);
router.put(
  "/:id",
  authenticateOrganizer,
  uploadEventImage,
  handleUploadError,
  updateEvent
);
router.put("/:id/cancel", authenticateOrganizer, cancelEvent);

// Protected routes - Admin or Organizer
router.get("/", authenticateAdminOrOrganizer, getAllEvents);

// Protected routes - Admin only
router.put("/:id/approve", authenticateAdmin, approveEvent);
router.put("/:id/reject", authenticateAdmin, rejectEvent);
router.delete("/:id", authenticateAdmin, deleteEvent);

// Protected routes - Admin or Organizer
router.get("/:id", authenticateAdminOrOrganizer, getEventById);

// Error handling middleware
router.use(errorHandler);

module.exports = router;
