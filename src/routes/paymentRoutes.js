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
const { authenticateAdmin } = require("../middleware/auth");
const { errorHandler } = require("../middleware/errorHandler");

// Public routes (no authentication required)
router.post("/callback", paymentCallback); // Pesapal callback
router.post("/mock-pay/:id", mockPayment); // Simulate payment completion
router.post("/initiate", initiatePayment); // Initiate payment (anonymous)
router.get("/:id", getPaymentById); // Get payment by ID

// Protected routes - Admin only
router.get("/", authenticateAdmin, getAllPayments);
router.get("/analytics/revenue", authenticateAdmin, getRevenueAnalytics);
router.post("/:id/refund", authenticateAdmin, refundPayment);

// Error handling middleware
router.use(errorHandler);

module.exports = router;
