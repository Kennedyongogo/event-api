const jwt = require("jsonwebtoken");
const { User } = require("../models");
const config = require("../config/config");

const TYPE_TO_ROLE = {
  admin: "admin",
  organizer: "event_organizer",
  artist: "artist",
};

const resolveRole = (decoded) =>
  decoded.role || TYPE_TO_ROLE[decoded.type] || null;

const loadUser = async (decoded) => {
  const role = resolveRole(decoded);
  if (!role) return null;

  const user = await User.findByPk(decoded.id, {
    attributes: { exclude: ["password"] },
  });

  if (!user || !user.isActive || user.role !== role) {
    return null;
  }

  return user;
};

const attachUser = (req, user) => {
  req.userId = user.id;
  req.user = user;
  req.userType =
    user.role === "event_organizer"
      ? "organizer"
      : user.role === "admin"
        ? "admin"
        : user.role;
  if (user.role === "admin") {
    req.adminRole = "admin";
  }
};

exports.authenticateToken = async (req, res, next) => {
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
    const user = await loadUser(decoded);

    if (!user) {
      return res.status(403).json({
        success: false,
        message: "Access denied, invalid or inactive user",
      });
    }

    attachUser(req, user);
    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(400).json({ success: false, message: "Invalid token" });
  }
};

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
    if (resolveRole(decoded) !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied, admin privileges required",
      });
    }

    const user = await loadUser(decoded);
    if (!user) {
      return res.status(403).json({
        success: false,
        message: "Access denied, invalid or inactive admin",
      });
    }

    attachUser(req, user);
    next();
  } catch (error) {
    console.error("Admin auth error:", error);
    res.status(400).json({ success: false, message: "Invalid token" });
  }
};

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
    if (resolveRole(decoded) !== "event_organizer") {
      return res.status(403).json({
        success: false,
        message: "Access denied, organizer privileges required",
      });
    }

    const user = await loadUser(decoded);
    if (!user) {
      return res.status(403).json({
        success: false,
        message: "Access denied, invalid or inactive organizer",
      });
    }

    if (
      user.organizer_status !== "approved" &&
      user.organizer_status !== "active"
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied, organizer not approved",
      });
    }

    attachUser(req, user);
    next();
  } catch (error) {
    console.error("Organizer auth error:", error);
    res.status(400).json({ success: false, message: "Invalid token" });
  }
};

exports.authenticateArtist = async (req, res, next) => {
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
    if (resolveRole(decoded) !== "artist") {
      return res.status(403).json({
        success: false,
        message: "Access denied, artist privileges required",
      });
    }

    const user = await loadUser(decoded);
    if (!user) {
      return res.status(403).json({
        success: false,
        message: "Access denied, invalid or inactive artist",
      });
    }

    attachUser(req, user);
    next();
  } catch (error) {
    console.error("Artist auth error:", error);
    res.status(400).json({ success: false, message: "Invalid token" });
  }
};

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
    const role = resolveRole(decoded);

    if (role !== "admin" && role !== "event_organizer") {
      return res.status(403).json({
        success: false,
        message: "Access denied, admin or organizer privileges required",
      });
    }

    const user = await loadUser(decoded);
    if (!user) {
      return res.status(403).json({
        success: false,
        message: "Access denied, invalid or inactive user",
      });
    }

    if (
      user.role === "event_organizer" &&
      user.organizer_status !== "approved" &&
      user.organizer_status !== "active"
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied, organizer not approved",
      });
    }

    attachUser(req, user);
    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(400).json({ success: false, message: "Invalid token" });
  }
};

exports.optionalAuth = async (req, res, next) => {
  const authHeader = req.header("Authorization");
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await loadUser(decoded);
    if (user) attachUser(req, user);
    next();
  } catch {
    next();
  }
};

exports.requireSuperAdmin = (req, res, next) => {
  if (req.userType !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied, admin privileges required",
    });
  }
  next();
};

exports.verifyOrganizerOwnership = (resourceIdParam = "id") => {
  return (req, res, next) => {
    if (req.userType === "admin") return next();

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

exports.verifyArtistOwnership = (resourceIdParam = "id") => {
  return (req, res, next) => {
    if (req.userType === "admin") return next();

    if (req.userType !== "artist") {
      return res.status(403).json({
        success: false,
        message: "Access denied, artist privileges required",
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

module.exports = exports;
