const express = require("express");
const router = express.Router();
const {
  getAllEquipment,
  getEquipmentById,
  createEquipment,
  updateEquipment,
  assignEquipmentToTask,
  releaseEquipmentFromTask,
  updateEquipmentAvailability,
  deleteEquipment,
  getEquipmentByProject,
  getAvailableEquipment,
  getEquipmentByType,
} = require("../controllers/equipmentController");
const { authenticateToken } = require("../middleware/auth");
const { errorHandler } = require("../middleware/errorHandler");

// All routes require authentication
router.use(authenticateToken);

// Equipment routes
router.get("/", getAllEquipment);
router.get("/available", getAvailableEquipment);
router.get("/type/:type", getEquipmentByType);
router.get("/project/:project_id", getEquipmentByProject);
router.get("/:id", getEquipmentById);
router.post("/", createEquipment);
router.put("/:id", updateEquipment);
router.put("/:id/assign", assignEquipmentToTask);
router.put("/:id/release", releaseEquipmentFromTask);
router.put("/:id/availability", updateEquipmentAvailability);
router.delete("/:id", deleteEquipment);

// Error handling middleware
router.use(errorHandler);

module.exports = router;
