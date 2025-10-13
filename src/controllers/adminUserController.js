const {
  AdminUser,
  EventOrganizer,
  Event,
  Payment,
  PublicUser,
  TicketPurchase,
} = require("../models");
const { Op } = require("sequelize");
const bcrypt = require("bcryptjs");
const cronManager = require("../services/cronManager");
const jwt = require("jsonwebtoken");
const config = require("../config/config");
const { sequelize } = require("../models");

// Create admin user
const createAdmin = async (req, res) => {
  try {
    const { full_name, email, password, phone, department, role, permissions } =
      req.body;

    // Check if admin already exists
    const existingAdmin = await AdminUser.findOne({ where: { email } });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: "Admin with this email already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin
    const admin = await AdminUser.create({
      full_name,
      email,
      password: hashedPassword,
      phone,
      department,
      role: role || "super_admin",
      permissions,
    });

    res.status(201).json({
      success: true,
      message: "Admin created successfully",
      data: {
        id: admin.id,
        full_name: admin.full_name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Error creating admin:", error);
    res.status(500).json({
      success: false,
      message: "Error creating admin",
      error: error.message,
    });
  }
};

// Login admin user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find admin
    const admin = await AdminUser.findOne({ where: { email } });
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if active
    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is inactive",
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Update last login
    await admin.update({ lastLogin: new Date() });

    // Generate token
    const token = jwt.sign(
      { id: admin.id, email: admin.email, type: "admin", role: admin.role },
      config.jwtSecret,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        admin: {
          id: admin.id,
          full_name: admin.full_name,
          email: admin.email,
          role: admin.role,
          department: admin.department,
        },
        token,
      },
    });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({
      success: false,
      message: "Error logging in",
      error: error.message,
    });
  }
};

// Get all admins
const getAllAdmins = async (req, res) => {
  try {
    const { page, limit } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    const totalCount = await AdminUser.count();

    const admins = await AdminUser.findAll({
      attributes: { exclude: ["password"] },
      limit: limitNum,
      offset: offset,
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: admins,
      count: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (error) {
    console.error("Error fetching admins:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching admins",
      error: error.message,
    });
  }
};

// Get admin by ID
const getAdminById = async (req, res) => {
  try {
    const { id } = req.params;

    const admin = await AdminUser.findByPk(id, {
      attributes: { exclude: ["password"] },
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    res.status(200).json({
      success: true,
      data: admin,
    });
  } catch (error) {
    console.error("Error fetching admin:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching admin",
      error: error.message,
    });
  }
};

// Update admin profile
const updateProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, phone, department, profile_image, permissions } =
      req.body;

    const admin = await AdminUser.findByPk(id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    await admin.update({
      full_name: full_name || admin.full_name,
      phone: phone || admin.phone,
      department: department || admin.department,
      profile_image: profile_image || admin.profile_image,
      permissions: permissions || admin.permissions,
    });

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: admin.id,
        full_name: admin.full_name,
        email: admin.email,
        phone: admin.phone,
        department: admin.department,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({
      success: false,
      message: "Error updating profile",
      error: error.message,
    });
  }
};

// Get platform dashboard stats
const getDashboardStats = async (req, res) => {
  try {
    // Get date range from query parameters
    const { startDate, endDate } = req.query;

    // Build date filter for createdAt fields
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          [Op.between]: [
            new Date(startDate),
            new Date(endDate + "T23:59:59.999Z"),
          ],
        },
      };
    }

    // Get counts with date filtering
    const totalOrganizers = await EventOrganizer.count({
      where: dateFilter,
    });
    const pendingOrganizers = await EventOrganizer.count({
      where: {
        status: "pending",
        ...dateFilter,
      },
    });
    const totalEvents = await Event.count({
      where: dateFilter,
    });
    const pendingEvents = await Event.count({
      where: {
        status: "pending",
        ...dateFilter,
      },
    });
    const totalTicketsSold = await TicketPurchase.count({
      where: {
        status: "paid",
        ...dateFilter,
      },
    });

    // Calculate revenue with date filtering
    const revenueData = await Payment.findAll({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("amount")), "totalRevenue"],
        [sequelize.fn("SUM", sequelize.col("admin_share")), "adminRevenue"],
        [
          sequelize.fn("SUM", sequelize.col("organizer_share")),
          "organizerRevenue",
        ],
      ],
      where: {
        status: "completed",
        ...dateFilter,
      },
      raw: true,
    });

    const revenue = revenueData[0] || {
      totalRevenue: 0,
      adminRevenue: 0,
      organizerRevenue: 0,
    };

    // Get recent activities with date filtering
    const recentEvents = await Event.findAll({
      limit: 5,
      order: [["createdAt", "DESC"]],
      attributes: ["id", "event_name", "status", "createdAt"],
      where: dateFilter,
      include: [
        {
          model: EventOrganizer,
          as: "organizer",
          attributes: ["organization_name"],
        },
      ],
    });

    const recentPurchases = await TicketPurchase.findAll({
      limit: 5,
      order: [["createdAt", "DESC"]],
      attributes: [
        "id",
        "total_amount",
        "status",
        "createdAt",
        "buyer_name",
        "buyer_email",
      ],
      where: dateFilter,
      include: [
        {
          model: Event,
          as: "event",
          attributes: ["event_name"],
        },
      ],
    });

    res.status(200).json({
      success: true,
      data: {
        dateRange: {
          start: startDate ? new Date(startDate).toISOString() : null,
          end: endDate
            ? new Date(endDate + "T23:59:59.999Z").toISOString()
            : null,
        },
        stats: {
          totalOrganizers,
          pendingOrganizers,
          totalEvents,
          pendingEvents,
          totalTicketsSold,
        },
        revenue: {
          totalRevenue: parseFloat(revenue.totalRevenue || 0).toFixed(2),
          adminRevenue: parseFloat(revenue.adminRevenue || 0).toFixed(2),
          organizerRevenue: parseFloat(revenue.organizerRevenue || 0).toFixed(
            2
          ),
        },
        recentActivities: {
          recentEvents,
          recentPurchases,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard stats",
      error: error.message,
    });
  }
};

// Delete admin
const deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const admin = await AdminUser.findByPk(id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    await admin.destroy();

    res.status(200).json({
      success: true,
      message: "Admin deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting admin:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting admin",
      error: error.message,
    });
  }
};

// Get revenue analytics with date ranges and trends
const getRevenueAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, period = "month" } = req.query;

    // Build date filter - only apply if dates are provided
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          [Op.between]: [
            new Date(startDate),
            new Date(endDate + "T23:59:59.999Z"),
          ],
        },
      };
    }

    // Revenue by period (daily, weekly, monthly) - PostgreSQL compatible
    let groupBy;
    switch (period) {
      case "day":
        groupBy = sequelize.fn("DATE", sequelize.col("createdAt"));
        break;
      case "week":
        groupBy = sequelize.fn(
          "EXTRACT",
          sequelize.literal('WEEK FROM "createdAt"')
        );
        break;
      case "month":
      default:
        groupBy = sequelize.fn(
          "EXTRACT",
          sequelize.literal('MONTH FROM "createdAt"')
        );
        break;
    }

    const revenueByPeriod = await Payment.findAll({
      attributes: [
        [groupBy, "period"],
        [sequelize.fn("SUM", sequelize.col("amount")), "totalRevenue"],
        [sequelize.fn("SUM", sequelize.col("admin_share")), "adminRevenue"],
        [
          sequelize.fn("SUM", sequelize.col("organizer_share")),
          "organizerRevenue",
        ],
        [
          sequelize.fn("COUNT", sequelize.col("Payment.id")),
          "transactionCount",
        ],
      ],
      where: {
        status: "completed",
        ...dateFilter,
      },
      group: [groupBy],
      order: [[groupBy, "ASC"]],
      raw: true,
    });

    // Top performing events by revenue
    const topEvents = await Payment.findAll({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("amount")), "totalRevenue"],
        [
          sequelize.fn("COUNT", sequelize.col("Payment.id")),
          "transactionCount",
        ],
      ],
      include: [
        {
          model: TicketPurchase,
          as: "purchase",
          attributes: [],
          include: [
            {
              model: Event,
              as: "event",
              attributes: ["id", "event_name", "venue"],
            },
          ],
        },
      ],
      where: {
        status: "completed",
        ...dateFilter,
      },
      group: ["purchase.event.id"],
      order: [[sequelize.fn("SUM", sequelize.col("amount")), "DESC"]],
      limit: 10,
      raw: true,
    });

    // Commission breakdown by organizer
    const commissionByOrganizer = await Payment.findAll({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("admin_share")), "totalCommission"],
        [
          sequelize.fn("COUNT", sequelize.col("Payment.id")),
          "transactionCount",
        ],
      ],
      include: [
        {
          model: TicketPurchase,
          as: "purchase",
          attributes: [],
          include: [
            {
              model: Event,
              as: "event",
              attributes: [],
              include: [
                {
                  model: EventOrganizer,
                  as: "organizer",
                  attributes: ["organization_name"],
                },
              ],
            },
          ],
        },
      ],
      where: {
        status: "completed",
        ...dateFilter,
      },
      group: ["purchase.event.organizer.id"],
      order: [[sequelize.fn("SUM", sequelize.col("admin_share")), "DESC"]],
      raw: true,
    });

    res.status(200).json({
      success: true,
      data: {
        period,
        dateRange: {
          start: startDate ? new Date(startDate).toISOString() : null,
          end: endDate
            ? new Date(endDate + "T23:59:59.999Z").toISOString()
            : null,
        },
        revenueByPeriod,
        topEvents,
        commissionByOrganizer,
      },
    });
  } catch (error) {
    console.error("Error fetching revenue analytics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching revenue analytics",
      error: error.message,
    });
  }
};

// Get event performance analytics
const getEventAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter - only apply if dates are provided
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          [Op.between]: [
            new Date(startDate),
            new Date(endDate + "T23:59:59.999Z"),
          ],
        },
      };
    }

    // Event approval rates - get all statuses with counts
    const eventStatsRaw = await Event.findAll({
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      where: dateFilter,
      group: ["status"],
      raw: true,
    });

    // Define all possible event statuses
    const allStatuses = [
      "pending",
      "approved",
      "rejected",
      "completed",
      "cancelled",
    ];

    // Create complete status array with zero counts for missing statuses
    const eventStats = allStatuses.map((status) => {
      const found = eventStatsRaw.find((item) => item.status === status);
      return {
        status,
        count: found ? found.count : "0",
      };
    });

    // Events by category - get all categories with counts
    const eventsByCategoryRaw = await Event.findAll({
      attributes: [
        "category",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      where: dateFilter,
      group: ["category"],
      raw: true,
    });

    // Define all possible event categories
    const allCategories = [
      "Conference",
      "Concert",
      "Sports",
      "Workshop",
      "Seminar",
      "Festival",
      "Exhibition",
      "Other",
    ];

    // Create complete category array with zero counts for missing categories
    const eventsByCategory = allCategories
      .map((category) => {
        const found = eventsByCategoryRaw.find(
          (item) => item.category === category
        );
        return {
          category,
          count: found ? found.count : "0",
        };
      })
      .sort((a, b) => parseInt(b.count) - parseInt(a.count)); // Sort by count descending

    // Average tickets sold per event
    const avgTicketsPerEvent = await TicketPurchase.findAll({
      attributes: [
        [sequelize.fn("AVG", sequelize.col("quantity")), "avgTickets"],
        [sequelize.fn("SUM", sequelize.col("quantity")), "totalTickets"],
      ],
      include: [
        {
          model: Event,
          as: "event",
          attributes: [],
          where: dateFilter,
        },
      ],
      where: { status: "paid" },
      raw: true,
    });

    // Event completion rates
    const completedEvents = await Event.count({
      where: {
        status: "completed",
        ...dateFilter,
      },
    });

    const totalEvents = await Event.count({
      where: dateFilter,
    });

    res.status(200).json({
      success: true,
      data: {
        dateRange: {
          start: startDate ? new Date(startDate).toISOString() : null,
          end: endDate
            ? new Date(endDate + "T23:59:59.999Z").toISOString()
            : null,
        },
        eventStats,
        eventsByCategory,
        avgTicketsPerEvent: {
          avgTickets: avgTicketsPerEvent[0]?.avgTickets || 0,
          totalTickets: avgTicketsPerEvent[0]?.totalTickets || 0,
        },
        completionRate:
          totalEvents > 0
            ? ((completedEvents / totalEvents) * 100).toFixed(2)
            : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching event analytics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching event analytics",
      error: error.message,
    });
  }
};

// Get user analytics
// Get buyer analytics (anonymous purchases)
const getUserAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Purchase trends by date
    const purchaseTrends = await TicketPurchase.findAll({
      attributes: [
        [sequelize.fn("DATE", sequelize.col("createdAt")), "date"],
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        [sequelize.fn("SUM", sequelize.col("total_amount")), "revenue"],
      ],
      where: {
        status: "paid",
        createdAt: {
          [Op.between]: [start, end],
        },
      },
      group: [sequelize.fn("DATE", sequelize.col("createdAt"))],
      order: [[sequelize.fn("DATE", sequelize.col("createdAt")), "ASC"]],
      raw: true,
    });

    // Total unique buyers (by email)
    const uniqueBuyers = await TicketPurchase.count({
      distinct: true,
      col: "buyer_email",
      where: {
        status: "paid",
      },
    });

    // Top buyers by purchase count
    const topBuyers = await TicketPurchase.findAll({
      attributes: [
        "buyer_email",
        "buyer_name",
        [sequelize.fn("COUNT", sequelize.col("id")), "purchaseCount"],
        [sequelize.fn("SUM", sequelize.col("total_amount")), "totalSpent"],
      ],
      where: {
        status: "paid",
        createdAt: {
          [Op.between]: [start, end],
        },
      },
      group: ["buyer_email", "buyer_name"],
      order: [[sequelize.fn("COUNT", sequelize.col("id")), "DESC"]],
      limit: 10,
      raw: true,
    });

    // Total purchases in date range
    const totalPurchases = await TicketPurchase.count({
      where: {
        status: "paid",
        createdAt: {
          [Op.between]: [start, end],
        },
      },
    });

    res.status(200).json({
      success: true,
      data: {
        dateRange: { start, end },
        purchaseTrends,
        uniqueBuyers,
        topBuyers,
        totalPurchases,
      },
    });
  } catch (error) {
    console.error("Error fetching buyer analytics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching buyer analytics",
      error: error.message,
    });
  }
};

// Get system health and performance metrics
const getSystemAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Payment success rates
    const paymentStats = await Payment.findAll({
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      where: {
        createdAt: {
          [Op.between]: [start, end],
        },
      },
      group: ["status"],
      raw: true,
    });

    // Failed transactions
    const failedTransactions = await Payment.count({
      where: {
        status: "failed",
        createdAt: {
          [Op.between]: [start, end],
        },
      },
    });

    // Total transactions
    const totalTransactions = await Payment.count({
      where: {
        createdAt: {
          [Op.between]: [start, end],
        },
      },
    });

    // System uptime (simplified - you might want to implement proper uptime tracking)
    const systemUptime = 99.9; // This would come from your monitoring system

    // Recent errors (you might want to implement an error log table)
    const recentErrors = []; // This would come from your error logging system

    // Database health
    const dbHealth = {
      connectionStatus: "connected",
      responseTime: "< 100ms",
      lastBackup: new Date().toISOString(),
    };

    res.status(200).json({
      success: true,
      data: {
        dateRange: { start, end },
        paymentStats,
        failedTransactions,
        totalTransactions,
        successRate:
          totalTransactions > 0
            ? (
                ((totalTransactions - failedTransactions) / totalTransactions) *
                100
              ).toFixed(2)
            : 100,
        systemUptime,
        recentErrors,
        dbHealth,
      },
    });
  } catch (error) {
    console.error("Error fetching system analytics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching system analytics",
      error: error.message,
    });
  }
};

// Cron Job Management Functions

/**
 * Get cron job status
 */
const getCronStatus = async (req, res) => {
  try {
    const status = cronManager.getStatus();

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("Error getting cron status:", error);
    res.status(500).json({
      success: false,
      message: "Error getting cron status",
      error: error.message,
    });
  }
};

/**
 * Manually trigger event status cron job
 */
const triggerEventStatusCron = async (req, res) => {
  try {
    const result = await cronManager.runCronJob("eventStatus");

    res.status(200).json({
      success: true,
      message: "Event status cron job executed successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error triggering event status cron:", error);
    res.status(500).json({
      success: false,
      message: "Error triggering event status cron",
      error: error.message,
    });
  }
};

/**
 * Start all cron jobs
 */
const startCronJobs = async (req, res) => {
  try {
    cronManager.start();

    res.status(200).json({
      success: true,
      message: "All cron jobs started successfully",
    });
  } catch (error) {
    console.error("Error starting cron jobs:", error);
    res.status(500).json({
      success: false,
      message: "Error starting cron jobs",
      error: error.message,
    });
  }
};

/**
 * Stop all cron jobs
 */
const stopCronJobs = async (req, res) => {
  try {
    cronManager.stop();

    res.status(200).json({
      success: true,
      message: "All cron jobs stopped successfully",
    });
  } catch (error) {
    console.error("Error stopping cron jobs:", error);
    res.status(500).json({
      success: false,
      message: "Error stopping cron jobs",
      error: error.message,
    });
  }
};

module.exports = {
  createAdmin,
  login,
  getAllAdmins,
  getAdminById,
  updateProfile,
  getDashboardStats,
  deleteAdmin,
  getRevenueAnalytics,
  getEventAnalytics,
  getUserAnalytics,
  getSystemAnalytics,
  getCronStatus,
  triggerEventStatusCron,
  startCronJobs,
  stopCronJobs,
};
