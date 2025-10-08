const express = require("express");
const router = express.Router();
const {
  getPublicProjects,
  getPublicProjectById,
  searchPublicProjects,
} = require("../controllers/projectController");
const { errorHandler } = require("../middleware/errorHandler");

// Public project routes (no authentication required)
router.get("/", getPublicProjects);
router.get("/search", searchPublicProjects);
router.get("/:id", getPublicProjectById);

// Error handling middleware
router.use(errorHandler);

module.exports = router;
