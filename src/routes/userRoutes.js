const express = require("express");
const router = express.Router();
const {
  register,
  login,
  createUser,
  getAllUsers,
  getUserById,
  updateProfile,
  changePassword,
  approveOrganizer,
  suspendOrganizer,
  deleteUser,
  forgotPassword,
  getOrganizerDashboardStats,
} = require("../controllers/userController");
const {
  getDashboardStats,
  getRevenueAnalytics,
  getEventAnalytics,
  getUserAnalytics,
  getSystemAnalytics,
  getCronStatus,
  triggerEventStatusCron,
  startCronJobs,
  stopCronJobs,
} = require("../controllers/analyticsController");
const {
  authenticateAdmin,
  authenticateOrganizer,
  authenticateAdminOrOrganizer,
  requireSuperAdmin,
  verifyOrganizerOwnership,
} = require("../middleware/auth");
const {
  uploadProfileImage,
  uploadVerificationDocs,
  handleUploadError,
} = require("../middleware/upload");
const { errorHandler } = require("../middleware/errorHandler");

// Public
router.post("/register", uploadVerificationDocs, handleUploadError, register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);

// Admin analytics (must be before /:id)
router.get("/analytics/dashboard", authenticateAdmin, getDashboardStats);
router.get("/analytics/revenue", authenticateAdmin, getRevenueAnalytics);
router.get("/analytics/events", authenticateAdmin, getEventAnalytics);
router.get("/analytics/users", authenticateAdmin, getUserAnalytics);
router.get("/analytics/system", authenticateAdmin, getSystemAnalytics);
router.get("/cron/status", authenticateAdmin, getCronStatus);
router.post(
  "/cron/trigger/event-status",
  authenticateAdmin,
  triggerEventStatusCron
);
router.post("/cron/start", authenticateAdmin, startCronJobs);
router.post("/cron/stop", authenticateAdmin, stopCronJobs);

// Admin user management
router.post(
  "/",
  authenticateAdmin,
  requireSuperAdmin,
  uploadProfileImage,
  handleUploadError,
  createUser
);
router.get("/", authenticateAdmin, getAllUsers);
router.get(
  "/:id",
  authenticateAdminOrOrganizer,
  verifyOrganizerOwnership("id"),
  getUserById
);
router.put(
  "/:id",
  authenticateAdminOrOrganizer,
  verifyOrganizerOwnership("id"),
  uploadProfileImage,
  handleUploadError,
  updateProfile
);
router.put(
  "/:id/change-password",
  authenticateAdminOrOrganizer,
  verifyOrganizerOwnership("id"),
  changePassword
);
router.put("/:id/approve", authenticateAdmin, approveOrganizer);
router.put("/:id/suspend", authenticateAdmin, suspendOrganizer);
router.delete("/:id", authenticateAdmin, requireSuperAdmin, deleteUser);
router.get(
  "/:id/dashboard",
  authenticateOrganizer,
  verifyOrganizerOwnership("id"),
  getOrganizerDashboardStats
);

router.use(errorHandler);

module.exports = router;
