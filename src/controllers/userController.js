const {
  User,
  Event,
  Payment,
  TicketPurchase,
  TicketType,
  sequelize,
} = require("../models");
const { Op } = require("sequelize");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config/config");
const { convertToRelativePath } = require("../utils/filePath");
const {
  parseGenreFromBody,
  withPortalArtistGenres,
} = require("../utils/artistGenres");
const { WRONG_ACCOUNT_TYPE, organizerPortalWrongTabMessage } = require("../utils/authMessages");

const JWT_TYPE_BY_ROLE = {
  admin: "admin",
  event_organizer: "organizer",
  artist: "artist",
};

const sanitizeUser = (user) => {
  const data = user.toJSON ? user.toJSON() : { ...user };
  delete data.password;
  return data;
};

const formatUserResponse = (user) => {
  const data = sanitizeUser(user);
  if (data.role === "artist") {
    return withPortalArtistGenres(data);
  }
  return data;
};

const formatOrganizerLegacy = (user) => {
  const data = sanitizeUser(user);
  return {
    ...data,
    contact_person: user.full_name,
    phone_number: user.phone,
    status: user.organizer_status,
  };
};

const formatLoginPayload = (user, token) => {
  const sanitized = sanitizeUser(user);
  if (user.role === "admin") {
    return {
      admin: {
        ...sanitized,
        role: "admin",
      },
      token,
    };
  }
  if (user.role === "event_organizer") {
    return { organizer: formatOrganizerLegacy(user), token };
  }
  if (user.role === "artist") {
    return { artist: withPortalArtistGenres(sanitized), token };
  }
  return { user: sanitized, token };
};

const signToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      type: JWT_TYPE_BY_ROLE[user.role],
    },
    config.jwtSecret,
    { expiresIn: "7d" }
  );

const register = async (req, res) => {
  try {
    const {
      role = "event_organizer",
      full_name,
      organization_name,
      contact_person,
      email,
      password,
      phone,
      phone_number,
      address,
      kra_pin,
      bank_name,
      bank_account_number,
      stage_name,
      bio,
      genre,
    } = req.body;

    if (role === "artist") {
      return res.status(400).json({
        success: false,
        message: "Use POST /api/artists/register for artist accounts",
      });
    }

    if (!["event_organizer"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Registration is only available for event organizers",
      });
    }

    const normalizedEmail = String(email || "")
      .toLowerCase()
      .trim();

    const existing = await User.findOne({
      where: { email: normalizedEmail, role },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const name = full_name || contact_person;
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Full name is required",
      });
    }

    const user = await User.create({
      role,
      full_name: name,
      email: normalizedEmail,
      password: hashedPassword,
      phone: phone || phone_number,
      organization_name:
        role === "event_organizer"
          ? organization_name || name
          : organization_name,
      address,
      kra_pin,
      bank_name,
      bank_account_number,
      organizer_status: role === "event_organizer" ? "pending" : null,
      stage_name,
      bio,
      genre,
    });

    const message = "Registration submitted successfully. Awaiting admin approval.";

    res.status(201).json({
      success: true,
      message,
      data: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({
      success: false,
      message: "Error registering user",
      error: error.message,
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password, role: expectedRole } = req.body;
    const normalizedEmail = String(email || "")
      .toLowerCase()
      .trim();

    let user;
    if (expectedRole) {
      user = await User.findOne({
        where: { email: normalizedEmail, role: expectedRole },
      });
    } else {
      const matches = await User.findAll({
        where: { email: normalizedEmail },
      });
      if (matches.length === 0) {
        user = null;
      } else if (matches.length === 1) {
        user = matches[0];
      } else {
        return res.status(400).json({
          success: false,
          message:
            "Multiple accounts exist for this email. Include role in login body (admin, event_organizer, or artist).",
        });
      }
    }

    if (!user) {
      if (expectedRole) {
        const matches = await User.findAll({
          where: { email: normalizedEmail },
        });
        const message = organizerPortalWrongTabMessage(matches, expectedRole);
        if (message) {
          return res.status(403).json({
            success: false,
            code: WRONG_ACCOUNT_TYPE,
            message,
          });
        }
      }
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (expectedRole && user.role !== expectedRole) {
      return res.status(403).json({
        success: false,
        message: "Invalid account type for this login",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is inactive",
      });
    }

    if (user.role === "event_organizer") {
      if (
        user.organizer_status !== "approved" &&
        user.organizer_status !== "active"
      ) {
        return res.status(403).json({
          success: false,
          message: `Account is ${user.organizer_status}. Please contact admin.`,
        });
      }
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    await user.update({ lastLogin: new Date() });
    const token = signToken(user);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: formatLoginPayload(user, token),
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

const createUser = async (req, res) => {
  try {
    const {
      full_name,
      email,
      password,
      phone,
      role = "admin",
    } = req.body;

    const normalizedEmail = String(email || "")
      .toLowerCase()
      .trim();

    const existing = await User.findOne({
      where: { email: normalizedEmail, role },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "User with this email and role already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      full_name,
      email: normalizedEmail,
      password: hashedPassword,
      phone,
      role,
      organizer_status: role === "event_organizer" ? "approved" : null,
    });

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({
      success: false,
      message: "Error creating user",
      error: error.message,
    });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const { page, limit, role, status } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    const whereClause = {};
    if (role) whereClause.role = role;
    if (status && role === "event_organizer") {
      whereClause.organizer_status = status;
    }

    const totalCount = await User.count({ where: whereClause });
    const include = [];

    if (role === "event_organizer") {
      include.push({
        model: Event,
        as: "events",
        attributes: ["id", "event_name", "status", "event_date"],
      });
    }

    const users = await User.findAll({
      where: whereClause,
      attributes: { exclude: ["password"] },
      include,
      limit: limitNum,
      offset,
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: users.map((user) => formatUserResponse(user)),
      count: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message,
    });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      attributes: { exclude: ["password"] },
      include: [
        {
          model: Event,
          as: "events",
          required: false,
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

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({ success: true, data: formatUserResponse(user) });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user",
      error: error.message,
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const {
      full_name,
      phone,
      phone_number,
      profile_image,
      organization_name,
      contact_person,
      address,
      kra_pin,
      bank_name,
      bank_account_number,
      pesapal_merchant_ref,
      stage_name,
      bio,
      genre,
      isActive,
    } = req.body;

    const imageUrl = convertToRelativePath(req.file?.path);
    const removeProfileImage =
      req.body.remove_profile_image === true ||
      req.body.remove_profile_image === "true";

    const parsedActive =
      isActive === undefined || isActive === null || isActive === ""
        ? user.isActive
        : isActive === true || isActive === "true";

    await user.update({
      full_name: full_name || contact_person || user.full_name,
      phone: phone || phone_number || user.phone,
      profile_image: removeProfileImage
        ? null
        : imageUrl || profile_image || user.profile_image,
      organization_name: organization_name ?? user.organization_name,
      address: address ?? user.address,
      kra_pin: kra_pin ?? user.kra_pin,
      bank_name: bank_name ?? user.bank_name,
      bank_account_number: bank_account_number ?? user.bank_account_number,
      pesapal_merchant_ref: pesapal_merchant_ref ?? user.pesapal_merchant_ref,
      stage_name: stage_name ?? user.stage_name,
      bio: bio ?? user.bio,
      ...(user.role === "artist" && genre !== undefined
        ? { genre: parseGenreFromBody(genre) }
        : genre !== undefined
          ? { genre }
          : {}),
      isActive: parsedActive,
    });

    const updated = await User.findByPk(id, {
      attributes: { exclude: ["password"] },
    });

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: formatUserResponse(updated),
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

const changePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashedNewPassword });

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({
      success: false,
      message: "Error updating password",
      error: error.message,
    });
  }
};

const approveOrganizer = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user || user.role !== "event_organizer") {
      return res.status(404).json({
        success: false,
        message: "Organizer not found",
      });
    }

    await user.update({ organizer_status: "approved" });

    res.status(200).json({
      success: true,
      message: "Organizer approved successfully",
      data: sanitizeUser(user),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error approving organizer",
      error: error.message,
    });
  }
};

const suspendOrganizer = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user || user.role !== "event_organizer") {
      return res.status(404).json({
        success: false,
        message: "Organizer not found",
      });
    }

    await user.update({ organizer_status: "suspended" });

    res.status(200).json({
      success: true,
      message: "Organizer suspended successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error suspending organizer",
      error: error.message,
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await user.destroy();

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: error.message,
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { Email, email } = req.body;
    const lookupEmail = (Email || email || "").toLowerCase().trim();

    if (!lookupEmail) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ where: { email: lookupEmail } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email",
      });
    }

    res.status(200).json({
      success: true,
      message: "Password reset instructions have been sent to your email",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error processing password reset request",
      error: error.message,
    });
  }
};

const getOrganizerDashboardStats = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    let eventDateFilter = {};
    let paymentDateFilter = {};
    if (startDate && endDate) {
      const range = {
        [Op.between]: [
          new Date(startDate),
          new Date(endDate + "T23:59:59.999Z"),
        ],
      };
      eventDateFilter = { createdAt: range };
      paymentDateFilter = { createdAt: range };
    }

    const organizer = await User.findByPk(id, {
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
                  where: { status: "completed", ...paymentDateFilter },
                  required: false,
                  attributes: ["organizer_share", "admin_share", "amount"],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!organizer || organizer.role !== "event_organizer") {
      return res.status(404).json({
        success: false,
        message: "Organizer not found",
      });
    }

    const events = organizer.events || [];
    let totalRevenue = 0;
    events.forEach((event) => {
      (event.purchases || []).forEach((purchase) => {
        if (purchase.payment) {
          totalRevenue += parseFloat(purchase.payment.organizer_share || 0);
        }
      });
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
        totalEvents: events.length,
        approvedEvents: events.filter((e) => e.status === "approved").length,
        completedEvents: events.filter((e) => e.status === "completed").length,
        pendingEvents: events.filter((e) => e.status === "pending").length,
        totalRevenue: totalRevenue.toFixed(2),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard stats",
      error: error.message,
    });
  }
};

module.exports = {
  register,
  login,
  createUser,
  getAllUsers,
  getUserById,
  updateProfile,
  changePassword,
  approveOrganizer,
  suspendOrganizer,
  deleteUser,
  forgotPassword,
  getOrganizerDashboardStats,
  sanitizeUser,
  formatOrganizerLegacy,
  signToken,
};
