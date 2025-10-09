const express = require("express");
const router = express.Router();
const {
  register,
  login,
  getAllUsers,
  getUserById,
  updateProfile,
  changePassword,
  deleteUser,
} = require("../controllers/publicUserController");
const {
  authenticatePublicUser,
  authenticateAdmin,
  verifyUserOwnership,
} = require("../middleware/auth");
const {
  uploadProfileImage,
  handleUploadError,
} = require("../middleware/upload");
const { errorHandler } = require("../middleware/errorHandler");

// Public routes
router.post("/register", register);
router.post("/login", login);

// Protected routes - Admin only
router.get("/", authenticateAdmin, getAllUsers);

// Protected routes - User must be authenticated
router.get(
  "/:id",
  authenticatePublicUser,
  verifyUserOwnership("id"),
  getUserById
);
router.put(
  "/:id",
  authenticatePublicUser,
  verifyUserOwnership("id"),
  uploadProfileImage,
  handleUploadError,
  updateProfile
);
router.put(
  "/:id/change-password",
  authenticatePublicUser,
  verifyUserOwnership("id"),
  changePassword
);
router.delete(
  "/:id",
  authenticatePublicUser,
  verifyUserOwnership("id"),
  deleteUser
);

// Error handling middleware
router.use(errorHandler);

module.exports = router;
