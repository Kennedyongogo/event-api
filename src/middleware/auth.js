const jwt = require("jsonwebtoken");
const { AdminUser, EventOrganizer, PublicUser } = require("../models");
const config = require("../config/config");

// Authenticate any user type (public, organizer, admin)
exports.authenticateToken = async (req, res, next) => {
  const authHeader = req.header("Authorization");
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied, no token provided",
    });
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token, config.jwtSecret);

    // Determine user type and fetch appropriate user
    let user = null;
    let userType = decoded.type || "public";

    if (userType === "admin") {
      user = await AdminUser.findByPk(decoded.id, {
        attributes: { exclude: ["password"] },
      });
    } else if (userType === "organizer") {
      user = await EventOrganizer.findByPk(decoded.id, {
        attributes: { exclude: ["password"] },
      });
    } else {
      user = await PublicUser.findByPk(decoded.id, {
        attributes: { exclude: ["password"] },
      });
    }

    if (!user || !user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Access denied, invalid or inactive user",
      });
    }

    // Attach user info to request
    req.userId = user.id;
    req.user = user;
    req.userType = userType;
    if (userType === "admin") {
      req.adminRole = user.role;
    }

    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(400).json({
      success: false,
      message: "Invalid token",
    });
  }
};

// Authenticate only admin users
exports.authenticateAdmin = async (req, res, next) => {
  const authHeader = req.header("Authorization");
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied, no token provided",
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);

    if (decoded.type !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied, admin privileges required",
      });
    }

    const admin = await AdminUser.findByPk(decoded.id, {
      attributes: { exclude: ["password"] },
    });

    if (!admin || !admin.isActive) {
      return res.status(403).json({
        success: false,
        message: "Access denied, invalid or inactive admin",
      });
    }

    req.userId = admin.id;
    req.user = admin;
    req.userType = "admin";
    req.adminRole = admin.role;

    next();
  } catch (error) {
    console.error("Admin auth error:", error);
    res.status(400).json({
      success: false,
      message: "Invalid token",
    });
  }
};

// Authenticate only event organizers
exports.authenticateOrganizer = async (req, res, next) => {
  const authHeader = req.header("Authorization");
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied, no token provided",
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);

    if (decoded.type !== "organizer") {
      return res.status(403).json({
        success: false,
        message: "Access denied, organizer privileges required",
      });
    }

    const organizer = await EventOrganizer.findByPk(decoded.id, {
      attributes: { exclude: ["password"] },
    });

    if (!organizer || !organizer.isActive) {
      return res.status(403).json({
        success: false,
        message: "Access denied, invalid or inactive organizer",
      });
    }

    if (organizer.status !== "approved" && organizer.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Access denied, organizer not approved",
      });
    }

    req.userId = organizer.id;
    req.user = organizer;
    req.userType = "organizer";

    next();
  } catch (error) {
    console.error("Organizer auth error:", error);
    res.status(400).json({
      success: false,
      message: "Invalid token",
    });
  }
};

// Authenticate only public users
exports.authenticatePublicUser = async (req, res, next) => {
  const authHeader = req.header("Authorization");
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied, no token provided",
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);

    if (decoded.type !== "public") {
      return res.status(403).json({
        success: false,
        message: "Access denied, public user required",
      });
    }

    const user = await PublicUser.findByPk(decoded.id, {
      attributes: { exclude: ["password"] },
    });

    if (!user || !user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Access denied, invalid or inactive user",
      });
    }

    req.userId = user.id;
    req.user = user;
    req.userType = "public";

    next();
  } catch (error) {
    console.error("Public user auth error:", error);
    res.status(400).json({
      success: false,
      message: "Invalid token",
    });
  }
};

// Authenticate admin OR organizer (for shared endpoints)
exports.authenticateAdminOrOrganizer = async (req, res, next) => {
  const authHeader = req.header("Authorization");
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied, no token provided",
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);

    let user = null;
    let userType = decoded.type;

    if (userType === "admin") {
      user = await AdminUser.findByPk(decoded.id, {
        attributes: { exclude: ["password"] },
      });
      if (user) req.adminRole = user.role;
    } else if (userType === "organizer") {
      user = await EventOrganizer.findByPk(decoded.id, {
        attributes: { exclude: ["password"] },
      });
      if (user && user.status !== "approved" && user.status !== "active") {
        return res.status(403).json({
          success: false,
          message: "Access denied, organizer not approved",
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: "Access denied, admin or organizer privileges required",
      });
    }

    if (!user || !user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Access denied, invalid or inactive user",
      });
    }

    req.userId = user.id;
    req.user = user;
    req.userType = userType;

    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(400).json({
      success: false,
      message: "Invalid token",
    });
  }
};

// Optional authentication (for public endpoints that might need user info)
exports.optionalAuth = async (req, res, next) => {
  const authHeader = req.header("Authorization");
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return next(); // Continue without authentication
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);

    let user = null;
    let userType = decoded.type || "public";

    if (userType === "admin") {
      user = await AdminUser.findByPk(decoded.id, {
        attributes: { exclude: ["password"] },
      });
    } else if (userType === "organizer") {
      user = await EventOrganizer.findByPk(decoded.id, {
        attributes: { exclude: ["password"] },
      });
    } else {
      user = await PublicUser.findByPk(decoded.id, {
        attributes: { exclude: ["password"] },
      });
    }

    if (user && user.isActive) {
      req.userId = user.id;
      req.user = user;
      req.userType = userType;
      if (userType === "admin") {
        req.adminRole = user.role;
      }
    }

    next();
  } catch (error) {
    // If token is invalid, continue without authentication
    next();
  }
};

// Check if admin has super_admin role
exports.requireSuperAdmin = (req, res, next) => {
  if (req.userType !== "admin" || req.adminRole !== "super_admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied, super admin privileges required",
    });
  }
  next();
};

// Verify resource ownership (for organizers accessing their own resources)
exports.verifyOrganizerOwnership = (resourceIdParam = "organizer_id") => {
  return (req, res, next) => {
    if (req.userType === "admin") {
      // Admins can access all resources
      return next();
    }

    if (req.userType !== "organizer") {
      return res.status(403).json({
        success: false,
        message: "Access denied, organizer privileges required",
      });
    }

    const resourceOwnerId =
      req.params[resourceIdParam] ||
      req.body[resourceIdParam] ||
      req.query[resourceIdParam];

    if (resourceOwnerId && resourceOwnerId !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied, you can only access your own resources",
      });
    }

    next();
  };
};

// Verify user owns the resource (for public users)
exports.verifyUserOwnership = (userIdParam = "user_id") => {
  return (req, res, next) => {
    if (req.userType === "admin") {
      // Admins can access all resources
      return next();
    }

    const resourceUserId =
      req.params[userIdParam] ||
      req.body[userIdParam] ||
      req.query[userIdParam];

    if (resourceUserId && resourceUserId !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied, you can only access your own resources",
      });
    }

    next();
  };
};

module.exports = exports;
