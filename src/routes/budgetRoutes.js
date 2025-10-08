const express = require("express");
const router = express.Router();
const {
  getAllBudgets,
  getBudgetById,
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgetsByProject,
  getBudgetSummaryByProject,
  getBudgetsByType,
  getBudgetsByCategory,
  getAvailableResourcesForTask,
  getTotalBudgetForTask,
} = require("../controllers/budgetController");
const { authenticateToken } = require("../middleware/auth");
const { errorHandler } = require("../middleware/errorHandler");

// All routes require authentication
router.use(authenticateToken);

// Budget routes
router.get("/", getAllBudgets);
router.get("/summary/:project_id", getBudgetSummaryByProject);
router.get("/type/:type", getBudgetsByType);
router.get("/category/:category", getBudgetsByCategory);
router.get("/project/:project_id", getBudgetsByProject);
router.get("/:id", getBudgetById);
router.get("/resources/task/:task_id", getAvailableResourcesForTask);
router.get("/total/task/:task_id", getTotalBudgetForTask);
router.post("/", createBudget);
router.put("/:id", updateBudget);
router.delete("/:id", deleteBudget);

// Error handling middleware
router.use(errorHandler);

module.exports = router;
