const express = require("express");
const router = express.Router();
const {
  getAllAdmins,
  getAdminById,
  createAdmin,
  updateAdmin,
  changePassword,
  deleteAdmin,
  loginAdmin,
  getDashboardStats,
  getProjectsByDate,
  getTasksByDate,
} = require("../controllers/adminController");
const { authenticateToken } = require("../middleware/auth");
const { errorHandler } = require("../middleware/errorHandler");
const {
  uploadProfilePicture,
  handleUploadError,
} = require("../middleware/upload");

// Public routes
router.post(
  "/login",
  (req, res, next) => {
    console.log("🚀 LOGIN ROUTE HIT:", {
      method: req.method,
      url: req.url,
      body: req.body,
      timestamp: new Date().toISOString(),
    });
    next();
  },
  loginAdmin
);
router.post("/", uploadProfilePicture, handleUploadError, createAdmin); // Allow admin creation without authentication

// Protected routes (require authentication)
router.get("/dashboard/stats", authenticateToken, getDashboardStats);
router.get("/projects/by-date", authenticateToken, getProjectsByDate);
router.get("/tasks/by-date", authenticateToken, getTasksByDate);
router.get("/", authenticateToken, getAllAdmins);
router.get("/:id", authenticateToken, getAdminById);
router.put(
  "/:id",
  authenticateToken,
  uploadProfilePicture,
  handleUploadError,
  updateAdmin
);
router.put("/:id/change-password", authenticateToken, changePassword);
router.delete("/:id", authenticateToken, deleteAdmin);

// Error handling middleware
router.use(errorHandler);

module.exports = router;
