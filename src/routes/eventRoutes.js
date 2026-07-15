const express = require("express");
const router = express.Router();
const {
  createEvent,
  getAllEvents,
  getPublicEvents,
  getPublicEventById,
  getEventById,
  updateEvent,
  approveEvent,
  rejectEvent,
  cancelEvent,
  deleteEvent,
  getEventCategories,
} = require("../controllers/eventController");
const {
  authenticateOrganizer,
  authenticateAdmin,
  authenticateAdminOrOrganizer,
  optionalAuth,
  verifyOrganizerOwnership,
} = require("../middleware/auth");
const { uploadEventForm, handleUploadError } = require("../middleware/upload");
const { errorHandler } = require("../middleware/errorHandler");

// Public routes
router.get("/categories", getEventCategories);
router.get("/public", optionalAuth, getPublicEvents);
router.get("/public/:id", optionalAuth, getPublicEventById);

// Protected routes - Organizer
router.post(
  "/",
  authenticateOrganizer,
  uploadEventForm,
  handleUploadError,
  createEvent
);
router.put(
  "/:id",
  authenticateOrganizer,
  uploadEventForm,
  handleUploadError,
  updateEvent
);
router.put("/:id/cancel", authenticateOrganizer, cancelEvent);

// Protected routes - Admin or Organizer
router.get("/", authenticateAdminOrOrganizer, getAllEvents);

// Protected routes - Admin only
router.put("/:id/approve", authenticateAdmin, approveEvent);
router.put("/:id/reject", authenticateAdmin, rejectEvent);

// Protected routes - Admin or Organizer
router.delete("/:id", authenticateAdminOrOrganizer, deleteEvent);
router.get("/:id", authenticateAdminOrOrganizer, getEventById);

// Error handling middleware
router.use(errorHandler);

module.exports = router;
