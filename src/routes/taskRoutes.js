const express = require("express");
const router = express.Router();
const {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  getTasksByProject,
  getOverdueTasks,
  getTaskProgressUpdates,
} = require("../controllers/taskController");
const { authenticateToken } = require("../middleware/auth");
const { errorHandler } = require("../middleware/errorHandler");

// All routes require authentication
router.use(authenticateToken);

// Task routes
router.get("/", getAllTasks);
router.get("/overdue", getOverdueTasks);
router.get("/project/:project_id", getTasksByProject);
router.get("/:id", getTaskById);
router.get("/:id/progress-updates", getTaskProgressUpdates);
router.post("/", createTask);
router.put("/:id", updateTask);
router.put("/:id/status", updateTaskStatus);
router.delete("/:id", deleteTask);

// Error handling middleware
router.use(errorHandler);

module.exports = router;
