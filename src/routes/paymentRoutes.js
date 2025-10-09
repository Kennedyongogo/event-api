const express = require("express");
const router = express.Router();
const {
  initiatePayment,
  mockPayment,
  paymentCallback,
  getAllPayments,
  getPaymentById,
  getRevenueAnalytics,
  refundPayment,
} = require("../controllers/paymentController");
const {
  authenticatePublicUser,
  authenticateAdmin,
  authenticateToken,
} = require("../middleware/auth");
const { errorHandler } = require("../middleware/errorHandler");

// Public routes (Pesapal callback)
router.post("/callback", paymentCallback);

// Mock payment routes (for testing)
router.post("/mock-pay/:id", mockPayment); // Simulate payment completion

// Protected routes - Public user or authenticated
router.post("/initiate", authenticatePublicUser, initiatePayment);
router.get("/:id", authenticateToken, getPaymentById);

// Protected routes - Admin
router.get("/", authenticateAdmin, getAllPayments);
router.get("/analytics/revenue", authenticateAdmin, getRevenueAnalytics);
router.post("/:id/refund", authenticateAdmin, refundPayment);

// Error handling middleware
router.use(errorHandler);

module.exports = router;
