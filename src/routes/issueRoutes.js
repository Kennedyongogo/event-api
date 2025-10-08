const express = require("express");
const router = express.Router();
const {
  getIssueCategories,
  getAllIssues,
  getIssueById,
  createIssue,
  updateIssue,
  updateIssueStatus,
  deleteIssue,
  getIssuesByProject,
  getIssuesByStatus,
  getIssuesByEmail,
  getIssueStatistics,
} = require("../controllers/issueController");
const { authenticateToken } = require("../middleware/auth");
const { errorHandler } = require("../middleware/errorHandler");

// Public routes (for users to report issues)
router.post("/", createIssue);
router.get("/categories", getIssueCategories);

// Protected routes (require authentication)
router.get("/", authenticateToken, getAllIssues);
router.get("/stats", authenticateToken, getIssueStatistics);
router.get("/status/:status", authenticateToken, getIssuesByStatus);
router.get("/email/:email", authenticateToken, getIssuesByEmail);
router.get("/project/:project_id", authenticateToken, getIssuesByProject);
router.get("/:id", authenticateToken, getIssueById);
router.put("/:id", authenticateToken, updateIssue);
router.put("/:id/status", authenticateToken, updateIssueStatus);
router.delete("/:id", authenticateToken, deleteIssue);

// Error handling middleware
router.use(errorHandler);

module.exports = router;
