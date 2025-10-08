const express = require("express");
const router = express.Router();
const {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  updateProjectProgress,
  deleteProject,
  getProjectStats,
  getProjectsByStatus,
} = require("../controllers/projectController");
const { authenticateToken } = require("../middleware/auth");
const { errorHandler } = require("../middleware/errorHandler");
const {
  uploadBlueprint,
  uploadBlueprints,
  handleUploadError,
} = require("../middleware/upload");

// All routes require authentication
router.use(authenticateToken);

// Project routes
router.get("/", getAllProjects);
router.get("/stats", getProjectStats);
router.get("/status/:status", getProjectsByStatus);
router.get("/:id", getProjectById);

// Project creation with optional blueprint upload
router.post("/", uploadBlueprints, handleUploadError, createProject);

router.put("/:id", uploadBlueprints, handleUploadError, updateProject);
router.put("/:id/progress", updateProjectProgress);
router.delete("/:id", deleteProject);

// Error handling middleware
router.use(errorHandler);

module.exports = router;
