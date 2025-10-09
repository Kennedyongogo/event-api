const express = require("express");
const router = express.Router();
const {
  createTicketType,
  getAllTicketTypes,
  getTicketTypeById,
  getTicketTypesByEvent,
  updateTicketType,
  deleteTicketType,
  checkAvailability,
} = require("../controllers/ticketTypeController");
const {
  authenticateOrganizer,
  authenticateAdmin,
  optionalAuth,
} = require("../middleware/auth");
const { errorHandler } = require("../middleware/errorHandler");

// Public routes
router.get("/event/:event_id", optionalAuth, getTicketTypesByEvent);
router.get("/:id/availability", optionalAuth, checkAvailability);

// Protected routes - Organizer
router.post("/", authenticateOrganizer, createTicketType);
router.put("/:id", authenticateOrganizer, updateTicketType);
router.delete("/:id", authenticateOrganizer, deleteTicketType);

// Protected routes - Admin
router.get("/", authenticateAdmin, getAllTicketTypes);
router.get("/:id", authenticateAdmin, getTicketTypeById);

// Error handling middleware
router.use(errorHandler);

module.exports = router;
