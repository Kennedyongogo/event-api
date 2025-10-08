const express = require("express");
const router = express.Router();
const {
  generateProjectQuotation,
  getQuotationData,
} = require("../controllers/quotationController");
const { authenticateToken } = require("../middleware/auth");

// Generate PDF quotation for a project
router.get(
  "/project/:projectId/pdf",
  authenticateToken,
  generateProjectQuotation
);

// Get quotation data without PDF generation
router.get("/project/:projectId/data", authenticateToken, getQuotationData);

module.exports = router;
