const { EventOrganizer, Event, Payment, TicketPurchase, TicketType } = require("../models");
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
          status: organizer.status,
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

    const organizer = await EventOrganizer.findByPk(id, {
      include: [
        {
          model: Event,
          as: "events",
          include: [
            {
              model: Payment,
              as: "payments",
              attributes: ["organizer_share", "admin_share", "amount"],
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
      if (event.payments) {
        event.payments.forEach((payment) => {
          totalRevenue += parseFloat(payment.organizer_share || 0);
        });
      }
    });

    res.status(200).json({
      success: true,
      data: {
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

module.exports = {
  register,
  login,
  getAllOrganizers,
  getOrganizerById,
  updateProfile,
  approveOrganizer,
  suspendOrganizer,
  getDashboardStats,
  deleteOrganizer,
  forgotPassword,
};
