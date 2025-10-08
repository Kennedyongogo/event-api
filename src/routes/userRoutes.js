const express = require("express");
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  changePassword,
  setPassword,
  deleteUser,
  loginUser,
  getUsersByType,
} = require("../controllers/userController");
const { authenticateToken } = require("../middleware/auth");
const { errorHandler } = require("../middleware/errorHandler");

// Public routes
router.post("/login", loginUser);
router.post("/", createUser); // Allow user registration

// Protected routes (require authentication)
router.get("/", authenticateToken, getAllUsers);
router.get("/type/:type", authenticateToken, getUsersByType);
router.get("/:id", authenticateToken, getUserById);
router.put("/:id", authenticateToken, updateUser);
router.put("/:id/change-password", authenticateToken, changePassword);
router.put("/:id/set-password", authenticateToken, setPassword);
router.delete("/:id", authenticateToken, deleteUser);

// Error handling middleware
router.use(errorHandler);

module.exports = router;
