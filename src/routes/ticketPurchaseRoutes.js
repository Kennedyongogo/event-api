const express = require("express");
const router = express.Router();
const {
  createPurchase,
  getAllPurchases,
  getPurchaseById,
  getPurchasesByEmail,
  updatePurchaseStatus,
  cancelPurchase,
  generateQRCode,
  deletePurchase,
} = require("../controllers/ticketPurchaseController");
const { authenticateAdmin } = require("../middleware/auth");
const { errorHandler } = require("../middleware/errorHandler");

// Public routes (no authentication required)
router.post("/", createPurchase); // Anonymous purchase
router.get("/by-email", getPurchasesByEmail); // Get purchases by email
router.get("/:id", getPurchaseById); // Get specific purchase
router.put("/:id/cancel", cancelPurchase); // Cancel purchase
router.post("/:id/generate-qr", generateQRCode); // Generate QR code

// Protected routes - Admin only
router.get("/", authenticateAdmin, getAllPurchases);
router.put("/:id/status", authenticateAdmin, updatePurchaseStatus);
router.delete("/:id", authenticateAdmin, deletePurchase);

// Error handling middleware
router.use(errorHandler);

module.exports = router;
