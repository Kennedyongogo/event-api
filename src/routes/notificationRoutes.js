const express = require("express");
const router = express.Router();
const {
  getAllNotifications,
  getNotificationById,
  createNotification,
  updateNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getNotificationsByRecipient,
  getUnreadNotificationCount,
  getNotificationsByType,
  createBulkNotifications,
} = require("../controllers/notificationController");
const { authenticateToken } = require("../middleware/auth");
const { errorHandler } = require("../middleware/errorHandler");

// All routes require authentication
router.use(authenticateToken);

// Notification routes
router.get("/", getAllNotifications);
router.get("/count/unread", getUnreadNotificationCount);
router.get("/type/:type", getNotificationsByType);
router.get(
  "/recipient/:recipient_type/:recipient_id",
  getNotificationsByRecipient
);
router.get("/:id", getNotificationById);
router.post("/", createNotification);
router.post("/bulk", createBulkNotifications);
router.put("/:id", updateNotification);
router.put("/:id/read", markNotificationAsRead);
router.put("/read-all", markAllNotificationsAsRead);
router.delete("/:id", deleteNotification);

// Error handling middleware
router.use(errorHandler);

module.exports = router;
