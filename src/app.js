const express = require("express");
const path = require("path");
const cors = require("cors");
const fs = require("fs");

const { initializeModels, setupAssociations } = require("./models");
const { errorHandler } = require("./middleware/errorHandler");

const userRoutes = require("./routes/userRoutes");
const {
  login,
  register,
  forgotPassword,
  getAllUsers,
} = require("./controllers/userController");
const analyticsController = require("./controllers/analyticsController");
const { authenticateAdmin, requireSuperAdmin } = require("./middleware/auth");
const eventRoutes = require("./routes/eventRoutes");
const ticketTypeRoutes = require("./routes/ticketTypeRoutes");
const ticketPurchaseRoutes = require("./routes/ticketPurchaseRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const artistRoutes = require("./routes/artistRoutes");

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cors());

app.use((req, res, next) => {
  console.log(`🔍 [${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`📦 Body:`, req.body);
  }
  next();
});

const eventsUploadPath = path.join(__dirname, "..", "uploads", "events");
const organizersUploadPath = path.join(
  __dirname,
  "..",
  "uploads",
  "organizers"
);
const profilesUploadPath = path.join(__dirname, "..", "uploads", "profiles");
const qrcodesUploadPath = path.join(__dirname, "..", "uploads", "qrcodes");
const documentsUploadPath = path.join(__dirname, "..", "uploads", "documents");
const miscUploadPath = path.join(__dirname, "..", "uploads", "misc");

app.use("/uploads/events", express.static(eventsUploadPath));
app.use("/uploads/organizers", express.static(organizersUploadPath));
app.use("/uploads/profiles", express.static(profilesUploadPath));
app.use("/uploads/qrcodes", express.static(qrcodesUploadPath));
app.use("/uploads/documents", express.static(documentsUploadPath));
app.use("/uploads/misc", express.static(miscUploadPath));

console.log("🔗 Registering API routes...");
app.use("/api/users", userRoutes);
console.log("✅ /api/users route registered");

// Legacy paths for existing admin & organizer frontends
app.post("/api/admins/login", (req, res, next) => {
  req.body.role = "admin";
  return login(req, res, next);
});
app.post("/api/organizers/login", (req, res, next) => {
  req.body.role = "event_organizer";
  return login(req, res, next);
});
app.post("/api/organizers/register", (req, res, next) => {
  req.body.role = "event_organizer";
  return register(req, res, next);
});
app.post("/api/organizers/forgot-password", forgotPassword);

app.use("/api/artists", artistRoutes);
console.log("✅ /api/artists route registered");

// Legacy admin API (event-admin frontend)
app.get(
  "/api/admins/dashboard/stats",
  authenticateAdmin,
  analyticsController.getDashboardStats
);
app.get(
  "/api/admins/analytics/revenue",
  authenticateAdmin,
  analyticsController.getRevenueAnalytics
);
app.get(
  "/api/admins/analytics/events",
  authenticateAdmin,
  analyticsController.getEventAnalytics
);
app.get(
  "/api/admins/analytics/users",
  authenticateAdmin,
  analyticsController.getUserAnalytics
);
app.get(
  "/api/admins/analytics/system",
  authenticateAdmin,
  analyticsController.getSystemAnalytics
);
app.get(
  "/api/admins/cron/status",
  authenticateAdmin,
  analyticsController.getCronStatus
);
app.post(
  "/api/admins/cron/trigger/event-status",
  authenticateAdmin,
  analyticsController.triggerEventStatusCron
);
app.post("/api/admins/cron/start", authenticateAdmin, analyticsController.startCronJobs);
app.post("/api/admins/cron/stop", authenticateAdmin, analyticsController.stopCronJobs);
app.get("/api/admins", authenticateAdmin, (req, res, next) => {
  req.query.role = "admin";
  return getAllUsers(req, res, next);
});
app.get("/api/organizers", authenticateAdmin, (req, res, next) => {
  req.query.role = "event_organizer";
  return getAllUsers(req, res, next);
});
console.log("✅ Legacy /api/admins and /api/organizers routes registered");

app.use("/api/events", eventRoutes);
app.use("/api/ticket-types", ticketTypeRoutes);
app.use("/api/purchases", ticketPurchaseRoutes);
app.use("/api/payments", paymentRoutes);
console.log("✅ All API routes registered");

app.use(errorHandler);

const createUploadDirectories = () => {
  const uploadDirs = [
    path.join(__dirname, "..", "uploads"),
    path.join(__dirname, "..", "uploads", "events"),
    path.join(__dirname, "..", "uploads", "organizers"),
    path.join(__dirname, "..", "uploads", "profiles"),
    path.join(__dirname, "..", "uploads", "qrcodes"),
    path.join(__dirname, "..", "uploads", "documents"),
    path.join(__dirname, "..", "uploads", "misc"),
  ];

  uploadDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created upload directory: ${dir}`);
    }
  });
};

const initializeApp = async () => {
  try {
    createUploadDirectories();
    await initializeModels();
    setupAssociations();

    const cronManager = require("./services/cronManager");
    cronManager.initialize();

    console.log("✅ Application initialized successfully");
    return true;
  } catch (error) {
    console.error("❌ Error initializing application:", error);
    throw error;
  }
};

const appInitialized = initializeApp();

module.exports = { app, appInitialized };
