const express = require("express");
const router = express.Router();
const {
  register,
  login,
  getAllOrganizers,
  getOrganizerById,
  updateProfile,
  approveOrganizer,
  suspendOrganizer,
  getDashboardStats,
  getEventsAnalytics,
  getRevenueAnalytics,
  deleteOrganizer,
  forgotPassword,
  changePassword,
} = require("../controllers/eventOrganizerController");
const {
  authenticateOrganizer,
  authenticateAdmin,
  verifyOrganizerOwnership,
} = require("../middleware/auth");
const {
  uploadOrganizerLogo,
  uploadVerificationDocs,
  handleUploadError,
} = require("../middleware/upload");
const { errorHandler } = require("../middleware/errorHandler");

// Public routes
router.post("/register", uploadVerificationDocs, handleUploadError, register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);

// Protected routes - Admin only
router.get("/", authenticateAdmin, getAllOrganizers);
router.put("/:id/approve", authenticateAdmin, approveOrganizer);
router.put("/:id/suspend", authenticateAdmin, suspendOrganizer);
router.delete("/:id", authenticateAdmin, deleteOrganizer);

// Protected routes - Organizer must be authenticated
router.get(
  "/:id",
  authenticateOrganizer,
  verifyOrganizerOwnership("id"),
  getOrganizerById
);
router.put(
  "/:id",
  authenticateOrganizer,
  verifyOrganizerOwnership("id"),
  uploadOrganizerLogo,
  handleUploadError,
  updateProfile
);
router.put(
  "/:id/change-password",
  authenticateOrganizer,
  verifyOrganizerOwnership("id"),
  changePassword
);
router.get(
  "/:id/dashboard",
  authenticateOrganizer,
  verifyOrganizerOwnership("id"),
  getDashboardStats
);
router.get(
  "/:id/analytics/events",
  authenticateOrganizer,
  verifyOrganizerOwnership("id"),
  getEventsAnalytics
);
router.get(
  "/:id/analytics/revenue",
  authenticateOrganizer,
  verifyOrganizerOwnership("id"),
  getRevenueAnalytics
);

// Error handling middleware
router.use(errorHandler);

module.exports = router;
