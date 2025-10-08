const express = require("express");
const router = express.Router();
const {
  getAllMaterials,
  getMaterialById,
  createMaterial,
  updateMaterial,
  updateMaterialUsage,
  deleteMaterial,
  getMaterialsByProject,
  getMaterialUsageSummary,
} = require("../controllers/materialController");
const { authenticateToken } = require("../middleware/auth");
const { errorHandler } = require("../middleware/errorHandler");

// All routes require authentication
router.use(authenticateToken);

// Material routes
router.get("/", getAllMaterials);
router.get("/summary", getMaterialUsageSummary);
router.get("/project/:project_id", getMaterialsByProject);
router.get("/:id", getMaterialById);
router.post("/", createMaterial);
router.put("/:id", updateMaterial);
router.put("/:id/usage", updateMaterialUsage);
router.delete("/:id", deleteMaterial);

// Error handling middleware
router.use(errorHandler);

module.exports = router;
