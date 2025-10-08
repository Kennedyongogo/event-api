const jwt = require("jsonwebtoken");
const { Admin } = require("../models");
const config = require("../config/config");

// Authenticate campaign admin
exports.authenticateToken = async (req, res, next) => {
  // Extract token from Authorization header
  const authHeader = req.header("Authorization");
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Access denied, no token provided",
    });
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token, config.jwtSecret);

    // Find the admin
    const admin = await Admin.findByPk(decoded.adminId, {
      attributes: { exclude: ["password"] },
    });

    if (!admin || !admin.isActive) {
      return res.status(403).json({
        success: false,
        error: "Access denied, invalid or inactive admin",
      });
    }

    // Attach admin info to request
    req.adminId = admin.id;
    req.admin = admin;
    req.adminRole = admin.role;

    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(400).json({
      success: false,
      error: "Invalid token",
    });
  }
};

// Optional authentication (for public endpoints that might need admin info)
exports.optionalAuth = async (req, res, next) => {
  const authHeader = req.header("Authorization");
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return next(); // Continue without authentication
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const admin = await Admin.findByPk(decoded.adminId, {
      attributes: { exclude: ["password"] },
    });

    if (admin && admin.isActive) {
      req.adminId = admin.id;
      req.admin = admin;
      req.adminRole = admin.role;
    }

    next();
  } catch (error) {
    // If token is invalid, continue without authentication
    next();
  }
};
