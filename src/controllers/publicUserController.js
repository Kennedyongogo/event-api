const { PublicUser, TicketPurchase, Event } = require("../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config/config");

// Register new public user
const register = async (req, res) => {
  try {
    const { full_name, email, password, phone, address, county } = req.body;

    // Check if user already exists
    const existingUser = await PublicUser.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await PublicUser.create({
      full_name,
      email,
      password: hashedPassword,
      phone,
      address,
      county,
    });

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, type: "public" },
      config.jwtSecret,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
      },
      token,
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

// Login public user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await PublicUser.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is inactive",
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Update last login
    await user.update({ lastLogin: new Date() });

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, type: "public" },
      config.jwtSecret,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
      },
      token,
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

// Get all public users (admin only)
const getAllUsers = async (req, res) => {
  try {
    const { page, limit } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    const totalCount = await PublicUser.count();

    const users = await PublicUser.findAll({
      attributes: { exclude: ["password"] },
      include: [
        {
          model: TicketPurchase,
          as: "purchases",
          attributes: ["id", "total_amount", "status", "createdAt"],
          include: [
            {
              model: Event,
              as: "event",
              attributes: ["event_name"],
            },
          ],
        },
      ],
      limit: limitNum,
      offset: offset,
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: users,
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

// Get user by ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await PublicUser.findByPk(id, {
      attributes: { exclude: ["password"] },
      include: [
        {
          model: TicketPurchase,
          as: "purchases",
          attributes: ["id", "quantity", "total_amount", "status", "createdAt"],
          include: [
            {
              model: Event,
              as: "event",
              attributes: ["event_name", "venue", "event_date"],
            },
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

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user",
      error: error.message,
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, phone, address, county, profile_image } = req.body;

    const user = await PublicUser.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await user.update({
      full_name: full_name || user.full_name,
      phone: phone || user.phone,
      address: address || user.address,
      county: county || user.county,
      profile_image: profile_image || user.profile_image,
    });

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        county: user.county,
        profile_image: user.profile_image,
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

// Change password
const changePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    const user = await PublicUser.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Hash and update new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashedPassword });

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({
      success: false,
      message: "Error changing password",
      error: error.message,
    });
  }
};

// Delete user account
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await PublicUser.findByPk(id);
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
    console.error("Error deleting user:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: error.message,
    });
  }
};

module.exports = {
  register,
  login,
  getAllUsers,
  getUserById,
  updateProfile,
  changePassword,
  deleteUser,
};
