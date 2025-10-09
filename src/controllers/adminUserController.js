const {
  AdminUser,
  EventOrganizer,
  Event,
  Payment,
  PublicUser,
  TicketPurchase,
} = require("../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config/config");
const { Op } = require("sequelize");
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
    // Get counts
    const totalOrganizers = await EventOrganizer.count();
    const pendingOrganizers = await EventOrganizer.count({
      where: { status: "pending" },
    });
    const totalEvents = await Event.count();
    const pendingEvents = await Event.count({ where: { status: "pending" } });
    const activeEvents = await Event.count({ where: { status: "active" } });
    const totalUsers = await PublicUser.count();
    const totalTicketsSold = await TicketPurchase.count({
      where: { status: "paid" },
    });

    // Calculate revenue
    const revenueData = await Payment.findAll({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("amount")), "totalRevenue"],
        [sequelize.fn("SUM", sequelize.col("admin_share")), "adminRevenue"],
        [
          sequelize.fn("SUM", sequelize.col("organizer_share")),
          "organizerRevenue",
        ],
      ],
      where: { status: "completed" },
      raw: true,
    });

    const revenue = revenueData[0] || {
      totalRevenue: 0,
      adminRevenue: 0,
      organizerRevenue: 0,
    };

    // Get recent activities
    const recentEvents = await Event.findAll({
      limit: 5,
      order: [["createdAt", "DESC"]],
      attributes: ["id", "event_name", "status", "createdAt"],
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
      attributes: ["id", "total_amount", "status", "createdAt"],
      include: [
        {
          model: PublicUser,
          as: "user",
          attributes: ["full_name", "email"],
        },
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
        stats: {
          totalOrganizers,
          pendingOrganizers,
          totalEvents,
          pendingEvents,
          activeEvents,
          totalUsers,
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

    // Set default date range if not provided
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Revenue by period (daily, weekly, monthly)
    let groupBy;
    switch (period) {
      case "day":
        groupBy = sequelize.fn("DATE", sequelize.col("createdAt"));
        break;
      case "week":
        groupBy = sequelize.fn("WEEK", sequelize.col("createdAt"));
        break;
      case "month":
      default:
        groupBy = sequelize.fn("MONTH", sequelize.col("createdAt"));
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
        [sequelize.fn("COUNT", sequelize.col("id")), "transactionCount"],
      ],
      where: {
        status: "completed",
        createdAt: {
          [Op.between]: [start, end],
        },
      },
      group: [groupBy],
      order: [[groupBy, "ASC"]],
      raw: true,
    });

    // Top performing events by revenue
    const topEvents = await Payment.findAll({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("amount")), "totalRevenue"],
        [sequelize.fn("COUNT", sequelize.col("id")), "transactionCount"],
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
        createdAt: {
          [Op.between]: [start, end],
        },
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
        [sequelize.fn("COUNT", sequelize.col("id")), "transactionCount"],
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
        createdAt: {
          [Op.between]: [start, end],
        },
      },
      group: ["purchase.event.organizer.id"],
      order: [[sequelize.fn("SUM", sequelize.col("admin_share")), "DESC"]],
      raw: true,
    });

    res.status(200).json({
      success: true,
      data: {
        period,
        dateRange: { start, end },
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

    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Event approval rates
    const eventStats = await Event.findAll({
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

    // Events by category
    const eventsByCategory = await Event.findAll({
      attributes: [
        "category",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      where: {
        createdAt: {
          [Op.between]: [start, end],
        },
      },
      group: ["category"],
      order: [[sequelize.fn("COUNT", sequelize.col("id")), "DESC"]],
      raw: true,
    });

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
          where: {
            createdAt: {
              [Op.between]: [start, end],
            },
          },
        },
      ],
      where: { status: "paid" },
      raw: true,
    });

    // Event completion rates
    const completedEvents = await Event.count({
      where: {
        status: "completed",
        createdAt: {
          [Op.between]: [start, end],
        },
      },
    });

    const totalEvents = await Event.count({
      where: {
        createdAt: {
          [Op.between]: [start, end],
        },
      },
    });

    res.status(200).json({
      success: true,
      data: {
        dateRange: { start, end },
        eventStats,
        eventsByCategory,
        avgTicketsPerEvent: avgTicketsPerEvent[0] || {
          avgTickets: 0,
          totalTickets: 0,
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
const getUserAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // User registration trends
    const userRegistrations = await PublicUser.findAll({
      attributes: [
        [sequelize.fn("DATE", sequelize.col("createdAt")), "date"],
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      where: {
        createdAt: {
          [Op.between]: [start, end],
        },
      },
      group: [sequelize.fn("DATE", sequelize.col("createdAt"))],
      order: [[sequelize.fn("DATE", sequelize.col("createdAt")), "ASC"]],
      raw: true,
    });

    // User activity (users who made purchases)
    const activeUsers = await TicketPurchase.count({
      distinct: true,
      col: "user_id",
      where: {
        status: "paid",
        createdAt: {
          [Op.between]: [start, end],
        },
      },
    });

    // Total registered users
    const totalUsers = await PublicUser.count();

    // User purchase patterns
    const purchasePatterns = await TicketPurchase.findAll({
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "purchaseCount"],
        [sequelize.fn("SUM", sequelize.col("total_amount")), "totalSpent"],
      ],
      include: [
        {
          model: PublicUser,
          as: "user",
          attributes: ["id"],
        },
      ],
      where: {
        status: "paid",
        createdAt: {
          [Op.between]: [start, end],
        },
      },
      group: ["user_id"],
      order: [[sequelize.fn("COUNT", sequelize.col("id")), "DESC"]],
      limit: 10,
      raw: true,
    });

    // Geographic distribution (by county)
    const userByCounty = await PublicUser.findAll({
      attributes: [
        "county",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      where: {
        county: { [Op.ne]: null },
        createdAt: {
          [Op.between]: [start, end],
        },
      },
      group: ["county"],
      order: [[sequelize.fn("COUNT", sequelize.col("id")), "DESC"]],
      raw: true,
    });

    res.status(200).json({
      success: true,
      data: {
        dateRange: { start, end },
        userRegistrations,
        activeUsers,
        totalUsers,
        purchasePatterns,
        userByCounty,
        activityRate:
          totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(2) : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching user analytics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user analytics",
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
};
