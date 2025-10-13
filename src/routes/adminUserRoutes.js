const express = require("express");
const router = express.Router();
const {
  createAdmin,
  login,
  getAllAdmins,
  getAdminById,
  updateProfile,
  getDashboardStats,
  deleteAdmin,
  getRevenueAnalytics,
  getEventAnalytics,
  getUserAnalytics,
  getSystemAnalytics,
  getCronStatus,
  triggerEventStatusCron,
  startCronJobs,
  stopCronJobs,
} = require("../controllers/adminUserController");
const { authenticateAdmin, requireSuperAdmin } = require("../middleware/auth");
const {
  uploadProfileImage,
  handleUploadError,
} = require("../middleware/upload");
const { errorHandler } = require("../middleware/errorHandler");

// Public routes
router.post("/login", login);

// Protected routes - Admin authentication required
router.post(
  "/",
  authenticateAdmin,
  requireSuperAdmin,
  uploadProfileImage,
  handleUploadError,
  createAdmin
);

router.get("/dashboard/stats", authenticateAdmin, getDashboardStats);
router.get("/analytics/revenue", authenticateAdmin, getRevenueAnalytics);
router.get("/analytics/events", authenticateAdmin, getEventAnalytics);
router.get("/analytics/users", authenticateAdmin, getUserAnalytics);
router.get("/analytics/system", authenticateAdmin, getSystemAnalytics);

// Cron job management routes
router.get("/cron/status", authenticateAdmin, getCronStatus);
router.post(
  "/cron/trigger/event-status",
  authenticateAdmin,
  triggerEventStatusCron
);
router.post("/cron/start", authenticateAdmin, startCronJobs);
router.post("/cron/stop", authenticateAdmin, stopCronJobs);

router.get("/", authenticateAdmin, getAllAdmins);
router.get("/:id", authenticateAdmin, getAdminById);
router.put(
  "/:id",
  authenticateAdmin,
  uploadProfileImage,
  handleUploadError,
  updateProfile
);
router.delete("/:id", authenticateAdmin, requireSuperAdmin, deleteAdmin);

// Error handling middleware
router.use(errorHandler);

module.exports = router;
