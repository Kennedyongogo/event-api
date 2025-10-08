const { Notification } = require("../models");

// Get all notifications
const getAllNotifications = async (req, res) => {
  try {
    const { recipient_type, recipient_id, read_status, page, limit } =
      req.query;

    let whereClause = {};
    if (recipient_type) {
      whereClause.recipient_type = recipient_type;
    }
    if (recipient_id) {
      whereClause.recipient_id = recipient_id;
    }
    if (read_status !== undefined) {
      whereClause.read_status = read_status === "true";
    }

    // Parse pagination parameters
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const totalCount = await Notification.count({ where: whereClause });

    // Get paginated notifications
    const notifications = await Notification.findAll({
      where: whereClause,
      order: [["createdAt", "DESC"]],
      limit: limitNum,
      offset: offset,
    });

    res.status(200).json({
      success: true,
      data: notifications,
      count: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching notifications",
      error: error.message,
    });
  }
};

// Get notification by ID
const getNotificationById = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findByPk(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    console.error("Error fetching notification:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching notification",
      error: error.message,
    });
  }
};

// Create new notification
const createNotification = async (req, res) => {
  try {
    const { recipient_type, recipient_id, title, message, read_status } =
      req.body;

    const validRecipientTypes = ["admin", "user"];
    if (!validRecipientTypes.includes(recipient_type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid recipient type",
      });
    }

    const notification = await Notification.create({
      recipient_type,
      recipient_id,
      title,
      message,
      read_status: read_status || false,
    });

    res.status(201).json({
      success: true,
      message: "Notification created successfully",
      data: notification,
    });
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({
      success: false,
      message: "Error creating notification",
      error: error.message,
    });
  }
};

// Update notification
const updateNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const notification = await Notification.findByPk(id);
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    // Validate recipient type if being updated
    if (updateData.recipient_type) {
      const validRecipientTypes = ["admin", "user"];
      if (!validRecipientTypes.includes(updateData.recipient_type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid recipient type",
        });
      }
    }

    await notification.update(updateData);

    res.status(200).json({
      success: true,
      message: "Notification updated successfully",
      data: notification,
    });
  } catch (error) {
    console.error("Error updating notification:", error);
    res.status(500).json({
      success: false,
      message: "Error updating notification",
      error: error.message,
    });
  }
};

// Mark notification as read
const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findByPk(id);
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    await notification.update({ read_status: true });

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({
      success: false,
      message: "Error marking notification as read",
      error: error.message,
    });
  }
};

// Mark all notifications as read for recipient
const markAllNotificationsAsRead = async (req, res) => {
  try {
    const { recipient_type, recipient_id } = req.body;

    const validRecipientTypes = ["admin", "user"];
    if (!validRecipientTypes.includes(recipient_type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid recipient type",
      });
    }

    await Notification.update(
      { read_status: true },
      {
        where: {
          recipient_type,
          recipient_id,
          read_status: false,
        },
      }
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({
      success: false,
      message: "Error marking all notifications as read",
      error: error.message,
    });
  }
};

// Delete notification
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findByPk(id);
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    await notification.destroy();

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting notification",
      error: error.message,
    });
  }
};

// Get notifications by recipient
const getNotificationsByRecipient = async (req, res) => {
  try {
    const { recipient_type, recipient_id } = req.params;
    const { limit = 20, offset = 0, unread_only = false } = req.query;

    let whereClause = {
      recipient_type,
      recipient_id,
    };

    if (unread_only === "true") {
      whereClause.read_status = false;
    }

    const notifications = await Notification.findAndCountAll({
      where: whereClause,
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.status(200).json({
      success: true,
      data: notifications.rows,
      count: notifications.count,
      total_pages: Math.ceil(notifications.count / limit),
    });
  } catch (error) {
    console.error("Error fetching notifications by recipient:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching notifications by recipient",
      error: error.message,
    });
  }
};

// Get unread notification count
const getUnreadNotificationCount = async (req, res) => {
  try {
    const { recipient_type, recipient_id } = req.params;

    const count = await Notification.count({
      where: {
        recipient_type,
        recipient_id,
        read_status: false,
      },
    });

    res.status(200).json({
      success: true,
      data: { unread_count: count },
    });
  } catch (error) {
    console.error("Error fetching unread notification count:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching unread notification count",
      error: error.message,
    });
  }
};

// Get notifications by type
const getNotificationsByType = async (req, res) => {
  try {
    const { recipient_type } = req.params;

    const validRecipientTypes = ["admin", "user"];
    if (!validRecipientTypes.includes(recipient_type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid recipient type",
      });
    }

    const notifications = await Notification.findAll({
      where: { recipient_type },
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: notifications,
      count: notifications.length,
    });
  } catch (error) {
    console.error("Error fetching notifications by type:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching notifications by type",
      error: error.message,
    });
  }
};

// Bulk create notifications
const createBulkNotifications = async (req, res) => {
  try {
    const { notifications } = req.body;

    if (!Array.isArray(notifications) || notifications.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Notifications array is required",
      });
    }

    // Validate all notifications
    const validRecipientTypes = ["admin", "user"];
    for (const notification of notifications) {
      if (!validRecipientTypes.includes(notification.recipient_type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid recipient type in notifications",
        });
      }
    }

    const createdNotifications = await Notification.bulkCreate(notifications);

    res.status(201).json({
      success: true,
      message: "Bulk notifications created successfully",
      data: createdNotifications,
      count: createdNotifications.length,
    });
  } catch (error) {
    console.error("Error creating bulk notifications:", error);
    res.status(500).json({
      success: false,
      message: "Error creating bulk notifications",
      error: error.message,
    });
  }
};

module.exports = {
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
};
