const express = require("express");
const router = express.Router();
const {
  getAllLabor,
  getLaborById,
  createLabor,
  updateLabor,
  deleteLabor,
  getLaborByTask,
  getLaborByWorkerType,
  getLaborCostSummaryByTask,
  getTotalTaskCost,
} = require("../controllers/laborController");

// Get all labor
router.get("/", getAllLabor);

// Get labor by ID
router.get("/:id", getLaborById);

// Create new labor
router.post("/", createLabor);

// Update labor
router.put("/:id", updateLabor);

// Delete labor
router.delete("/:id", deleteLabor);

// Get labor by task
router.get("/task/:task_id", getLaborByTask);

// Get labor by worker type
router.get("/type/:worker_type", getLaborByWorkerType);

// Get labor cost summary by task
router.get("/summary/task/:task_id", getLaborCostSummaryByTask);

// Get total task cost (Materials + Equipment + Labor + Budget)
router.get("/total-cost/task/:task_id", getTotalTaskCost);

module.exports = router;
