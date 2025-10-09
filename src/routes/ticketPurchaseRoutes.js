const express = require("express");
const router = express.Router();
const {
  createPurchase,
  getAllPurchases,
  getPurchaseById,
  getUserPurchases,
  updatePurchaseStatus,
  cancelPurchase,
  generateQRCode,
  deletePurchase,
} = require("../controllers/ticketPurchaseController");
const {
  authenticatePublicUser,
  authenticateAdmin,
  authenticateToken,
  verifyUserOwnership,
} = require("../middleware/auth");
const { errorHandler } = require("../middleware/errorHandler");

// Protected routes - Public user
router.post("/", authenticatePublicUser, createPurchase);
router.get(
  "/user/:user_id",
  authenticateToken,
  verifyUserOwnership("user_id"),
  getUserPurchases
);
router.get("/:id", authenticateToken, getPurchaseById);
router.put("/:id/cancel", authenticateToken, cancelPurchase);

// Protected routes - Admin
router.get("/", authenticateAdmin, getAllPurchases);
router.put("/:id/status", authenticateAdmin, updatePurchaseStatus);
router.delete("/:id", authenticateAdmin, deletePurchase);

// QR Code generation (after payment)
router.post("/:id/generate-qr", authenticateToken, generateQRCode);

// Error handling middleware
router.use(errorHandler);

module.exports = router;
