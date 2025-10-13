const {
  EventOrganizer,
  Event,
  Payment,
  TicketPurchase,
  TicketType,
  sequelize,
} = require("../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config/config");
const { Op } = require("sequelize");
const { convertToRelativePath } = require("../utils/filePath");

// Register new event organizer
const register = async (req, res) => {
  try {
    const {
      organization_name,
      contact_person,
      email,
      password,
      phone_number,
      address,
      kra_pin,
      bank_name,
      bank_account_number,
      website,
    } = req.body;

    // Check if organizer already exists
    const existingOrganizer = await EventOrganizer.findOne({
      where: { email },
    });
    if (existingOrganizer) {
      return res.status(400).json({
        success: false,
        message: "Organizer with this email already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create organizer
    const organizer = await EventOrganizer.create({
      organization_name,
      contact_person,
      email,
      password: hashedPassword,
      phone_number,
      address,
      kra_pin,
      bank_name,
      bank_account_number,
      website,
      status: "pending", // Requires admin approval
    });

    res.status(201).json({
      success: true,
      message: "Registration submitted successfully. Awaiting admin approval.",
      data: {
        id: organizer.id,
        organization_name: organizer.organization_name,
        contact_person: organizer.contact_person,
        email: organizer.email,
        status: organizer.status,
      },
    });
  } catch (error) {
    console.error("Error registering organizer:", error);
    res.status(500).json({
      success: false,
      message: "Error registering organizer",
      error: error.message,
    });
  }
};

// Login event organizer
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find organizer
    const organizer = await EventOrganizer.findOne({ where: { email } });
    if (!organizer) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if organizer is approved
    if (organizer.status !== "approved" && organizer.status !== "active") {
      return res.status(403).json({
        success: false,
        message: `Account is ${organizer.status}. Please contact admin.`,
      });
    }

    // Check if active
    if (!organizer.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is inactive",
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, organizer.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Update last login
    await organizer.update({ lastLogin: new Date() });

    // Generate token
    const token = jwt.sign(
      { id: organizer.id, email: organizer.email, type: "organizer" },
      config.jwtSecret,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        organizer: {
          id: organizer.id,
          organization_name: organizer.organization_name,
          contact_person: organizer.contact_person,
          email: organizer.email,
          phone_number: organizer.phone_number,
          address: organizer.address,
          kra_pin: organizer.kra_pin,
          pesapal_merchant_ref: organizer.pesapal_merchant_ref,
          bank_name: organizer.bank_name,
          bank_account_number: organizer.bank_account_number,
          website: organizer.website,
          logo: organizer.logo,
          status: organizer.status,
          isActive: organizer.isActive,
          lastLogin: organizer.lastLogin,
          createdAt: organizer.createdAt,
          updatedAt: organizer.updatedAt,
        },
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

// Get all organizers (admin only)
const getAllOrganizers = async (req, res) => {
  try {
    const { page, limit, status } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }

    const totalCount = await EventOrganizer.count({ where: whereClause });

    const organizers = await EventOrganizer.findAll({
      where: whereClause,
      attributes: { exclude: ["password"] },
      include: [
        {
          model: Event,
          as: "events",
          attributes: ["id", "event_name", "status", "event_date"],
        },
      ],
      limit: limitNum,
      offset: offset,
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: organizers,
      count: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (error) {
    console.error("Error fetching organizers:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching organizers",
      error: error.message,
    });
  }
};

// Get organizer by ID
const getOrganizerById = async (req, res) => {
  try {
    const { id } = req.params;

    const organizer = await EventOrganizer.findByPk(id, {
      attributes: { exclude: ["password"] },
      include: [
        {
          model: Event,
          as: "events",
          attributes: [
            "id",
            "event_name",
            "venue",
            "event_date",
            "status",
            "createdAt",
          ],
        },
      ],
    });

    if (!organizer) {
      return res.status(404).json({
        success: false,
        message: "Organizer not found",
      });
    }

    res.status(200).json({
      success: true,
      data: organizer,
    });
  } catch (error) {
    console.error("Error fetching organizer:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching organizer",
      error: error.message,
    });
  }
};

// Update organizer profile
const updateProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      organization_name,
      contact_person,
      phone_number,
      address,
      kra_pin,
      bank_name,
      bank_account_number,
      website,
      logo,
      pesapal_merchant_ref,
    } = req.body;

    const organizer = await EventOrganizer.findByPk(id);
    if (!organizer) {
      return res.status(404).json({
        success: false,
        message: "Organizer not found",
      });
    }

    // Handle logo upload - convert absolute path to relative path if file uploaded
    const logoUrl = convertToRelativePath(req.file?.path);

    await organizer.update({
      organization_name: organization_name || organizer.organization_name,
      contact_person: contact_person || organizer.contact_person,
      phone_number: phone_number || organizer.phone_number,
      address: address || organizer.address,
      kra_pin: kra_pin || organizer.kra_pin,
      bank_name: bank_name || organizer.bank_name,
      bank_account_number: bank_account_number || organizer.bank_account_number,
      website: website || organizer.website,
      logo: logoUrl || organizer.logo,
      pesapal_merchant_ref:
        pesapal_merchant_ref || organizer.pesapal_merchant_ref,
    });

    // Fetch the updated organizer with all fields (excluding password)
    const updatedOrganizer = await EventOrganizer.findByPk(id, {
      attributes: { exclude: ["password"] },
    });

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedOrganizer,
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

// Approve organizer (admin only)
const approveOrganizer = async (req, res) => {
  try {
    const { id } = req.params;

    const organizer = await EventOrganizer.findByPk(id);
    if (!organizer) {
      return res.status(404).json({
        success: false,
        message: "Organizer not found",
      });
    }

    await organizer.update({
      status: "approved",
    });

    res.status(200).json({
      success: true,
      message: "Organizer approved successfully",
      data: {
        id: organizer.id,
        organization_name: organizer.organization_name,
        status: organizer.status,
      },
    });
  } catch (error) {
    console.error("Error approving organizer:", error);
    res.status(500).json({
      success: false,
      message: "Error approving organizer",
      error: error.message,
    });
  }
};

// Suspend organizer (admin only)
const suspendOrganizer = async (req, res) => {
  try {
    const { id } = req.params;

    const organizer = await EventOrganizer.findByPk(id);
    if (!organizer) {
      return res.status(404).json({
        success: false,
        message: "Organizer not found",
      });
    }

    await organizer.update({ status: "suspended" });

    res.status(200).json({
      success: true,
      message: "Organizer suspended successfully",
    });
  } catch (error) {
    console.error("Error suspending organizer:", error);
    res.status(500).json({
      success: false,
      message: "Error suspending organizer",
      error: error.message,
    });
  }
};

// Get organizer dashboard stats
const getDashboardStats = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    // Build date filter for events
    let eventDateFilter = {};
    if (startDate && endDate) {
      eventDateFilter = {
        createdAt: {
          [Op.between]: [
            new Date(startDate),
            new Date(endDate + "T23:59:59.999Z"),
          ],
        },
      };
    }

    // Build date filter for payments
    let paymentDateFilter = {};
    if (startDate && endDate) {
      paymentDateFilter = {
        createdAt: {
          [Op.between]: [
            new Date(startDate),
            new Date(endDate + "T23:59:59.999Z"),
          ],
        },
      };
    }

    const organizer = await EventOrganizer.findByPk(id, {
      include: [
        {
          model: Event,
          as: "events",
          where: eventDateFilter,
          required: false,
          include: [
            {
              model: TicketPurchase,
              as: "purchases",
              where: { status: "paid" },
              required: false,
              include: [
                {
                  model: Payment,
                  as: "payment",
                  where: {
                    status: "completed",
                    ...paymentDateFilter,
                  },
                  required: false,
                  attributes: ["organizer_share", "admin_share", "amount"],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!organizer) {
      return res.status(404).json({
        success: false,
        message: "Organizer not found",
      });
    }

    // Calculate stats
    const totalEvents = organizer.events.length;
    const approvedEvents = organizer.events.filter(
      (e) => e.status === "approved"
    ).length;
    const completedEvents = organizer.events.filter(
      (e) => e.status === "completed"
    ).length;
    const pendingEvents = organizer.events.filter(
      (e) => e.status === "pending"
    ).length;

    let totalRevenue = 0;
    organizer.events.forEach((event) => {
      if (event.purchases) {
        event.purchases.forEach((purchase) => {
          if (purchase.payment) {
            totalRevenue += parseFloat(purchase.payment.organizer_share || 0);
          }
        });
      }
    });

    res.status(200).json({
      success: true,
      data: {
        dateRange: {
          start: startDate ? new Date(startDate).toISOString() : null,
          end: endDate ? new Date(endDate).toISOString() : null,
        },
        totalEvents,
        approvedEvents,
        completedEvents,
        pendingEvents,
        totalRevenue: totalRevenue.toFixed(2),
        commission_rate: organizer.commission_rate,
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

// Delete organizer (admin only)
const deleteOrganizer = async (req, res) => {
  try {
    const { id } = req.params;

    const organizer = await EventOrganizer.findByPk(id);
    if (!organizer) {
      return res.status(404).json({
        success: false,
        message: "Organizer not found",
      });
    }

    await organizer.destroy();

    res.status(200).json({
      success: true,
      message: "Organizer deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting organizer:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting organizer",
      error: error.message,
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { Email } = req.body;

    if (!Email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const organizer = await EventOrganizer.findOne({ where: { email: Email } });
    if (!organizer) {
      return res.status(404).json({
        success: false,
        message: "Organizer not found with this email",
      });
    }

    // TODO: Implement actual password reset logic
    // For now, just return success message
    res.status(200).json({
      success: true,
      message: "Password reset instructions have been sent to your email",
    });
  } catch (error) {
    console.error("Error in forgot password:", error);
    res.status(500).json({
      success: false,
      message: "Error processing password reset request",
      error: error.message,
    });
  }
};

// Change password for organizer
const changePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    // Find organizer by ID
    const organizer = await EventOrganizer.findByPk(id);
    if (!organizer) {
      return res.status(404).json({
        success: false,
        message: "Organizer not found",
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      organizer.password
    );
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await organizer.update({ password: hashedNewPassword });

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({
      success: false,
      message: "Error updating password",
    });
  }
};

// Get organizer events analytics
const getEventsAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    // Build date filter
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

    const organizer = await EventOrganizer.findByPk(id);
    if (!organizer) {
      return res.status(404).json({
        success: false,
        message: "Organizer not found",
      });
    }

    // Get events with date filtering
    const events = await Event.findAll({
      where: {
        organizer_id: id,
        ...dateFilter,
      },
      include: [
        {
          model: TicketType,
          as: "ticketTypes",
          attributes: [
            "id",
            "name",
            "price",
            "total_quantity",
            "remaining_quantity",
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Calculate analytics
    const totalEvents = events.length;

    // Define all possible event statuses
    const allStatuses = [
      "pending",
      "approved",
      "rejected",
      "completed",
      "cancelled",
    ];

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

    // Create complete status array with zero counts for missing statuses
    const eventsByStatus = allStatuses.map((status) => {
      const found = events.find((event) => event.status === status);
      return {
        status,
        count: found ? 1 : 0,
      };
    });

    // Create complete category array with zero counts for missing categories
    const eventsByCategory = allCategories.map((category) => {
      const found = events.find((event) => event.category === category);
      return {
        category,
        count: found ? 1 : 0,
      };
    });

    // Calculate total tickets sold and revenue
    let totalTicketsSold = 0;
    let totalRevenue = 0;

    for (const event of events) {
      const purchases = await TicketPurchase.findAll({
        where: {
          event_id: event.id,
          status: "paid",
        },
        include: [
          {
            model: Payment,
            as: "payment",
            where: { status: "completed" },
          },
        ],
      });

      totalTicketsSold += purchases.reduce(
        (sum, purchase) => sum + purchase.quantity,
        0
      );

      const eventRevenue = purchases.reduce((sum, purchase) => {
        return sum + parseFloat(purchase.payment?.organizer_share || 0);
      }, 0);

      totalRevenue += eventRevenue;
    }

    res.status(200).json({
      success: true,
      data: {
        dateRange: {
          start: startDate ? new Date(startDate).toISOString() : null,
          end: endDate
            ? new Date(endDate + "T23:59:59.999Z").toISOString()
            : null,
        },
        totalEvents,
        eventsByStatus: eventsByStatus.map((item) => ({
          status: item.status,
          count: item.count.toString(),
        })),
        eventsByCategory: eventsByCategory.map((item) => ({
          category: item.category,
          count: item.count.toString(),
        })),
        totalTicketsSold,
        totalRevenue: totalRevenue.toFixed(2),
        avgTicketsPerEvent:
          totalEvents > 0 ? (totalTicketsSold / totalEvents).toFixed(2) : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching events analytics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching events analytics",
      error: error.message,
    });
  }
};

// Get organizer revenue analytics
const getRevenueAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, period = "month" } = req.query;

    // Build date filter
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

    const organizer = await EventOrganizer.findByPk(id);
    if (!organizer) {
      return res.status(404).json({
        success: false,
        message: "Organizer not found",
      });
    }

    // Get organizer's events
    const events = await Event.findAll({
      where: {
        organizer_id: id,
      },
      attributes: ["id", "event_name"],
    });

    const eventIds = events.map((event) => event.id);

    // Revenue by period
    let groupByClause;
    switch (period) {
      case "day":
        groupByClause = 'DATE("Payment"."createdAt")';
        break;
      case "week":
        groupByClause = 'EXTRACT(WEEK FROM "Payment"."createdAt")';
        break;
      case "month":
        groupByClause = 'EXTRACT(MONTH FROM "Payment"."createdAt")';
        break;
      default:
        groupByClause = 'EXTRACT(MONTH FROM "Payment"."createdAt")';
    }

    const revenueByPeriod = await Payment.findAll({
      attributes: [
        [sequelize.literal(groupByClause), "period"],
        [
          sequelize.fn("SUM", sequelize.col("organizer_share")),
          "organizerRevenue",
        ],
        [sequelize.fn("SUM", sequelize.col("admin_share")), "adminRevenue"],
        [sequelize.fn("SUM", sequelize.col("amount")), "totalRevenue"],
        [
          sequelize.fn("COUNT", sequelize.col("Payment.id")),
          "transactionCount",
        ],
      ],
      where: {
        status: "completed",
        ...dateFilter,
      },
      include: [
        {
          model: TicketPurchase,
          as: "purchase",
          where: {
            event_id: {
              [Op.in]: eventIds,
            },
          },
          attributes: [],
        },
      ],
      group: [sequelize.literal(groupByClause)],
      order: [[sequelize.literal(groupByClause), "ASC"]],
      raw: true,
    });

    // Top performing events - using raw SQL for better control
    const eventIdsPlaceholder = eventIds
      .map((_, index) => `:eventId${index}`)
      .join(",");
    const eventIdsParams = {};
    eventIds.forEach((id, index) => {
      eventIdsParams[`eventId${index}`] = id;
    });

    const topEvents = await sequelize.query(
      `
      SELECT 
        e.event_name,
        SUM(p.organizer_share) as "totalRevenue",
        COUNT(p.id) as "transactionCount"
      FROM "ticket_purchases" tp
      INNER JOIN "payments" p ON tp.id = p.purchase_id
      INNER JOIN "events" e ON tp.event_id = e.id
      WHERE tp.event_id IN (${eventIdsPlaceholder})
        AND tp.status = 'paid'
        AND p.status = 'completed'
        ${
          startDate && endDate
            ? `AND p."createdAt" BETWEEN :startDate AND :endDate`
            : ""
        }
      GROUP BY e.id, e.event_name
      ORDER BY SUM(p.organizer_share) DESC
      LIMIT 10
    `,
      {
        replacements: {
          ...eventIdsParams,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate + "T23:59:59.999Z") : null,
        },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    res.status(200).json({
      success: true,
      data: {
        dateRange: {
          start: startDate ? new Date(startDate).toISOString() : null,
          end: endDate
            ? new Date(endDate + "T23:59:59.999Z").toISOString()
            : null,
        },
        revenueByPeriod,
        topEvents,
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

module.exports = {
  register,
  login,
  getAllOrganizers,
  getOrganizerById,
  updateProfile,
  approveOrganizer,
  suspendOrganizer,
  getDashboardStats,
  getEventsAnalytics,
  getRevenueAnalytics,
  deleteOrganizer,
  forgotPassword,
  changePassword,
};
