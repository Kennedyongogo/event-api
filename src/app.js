const express = require("express");
const path = require("path");
const cors = require("cors");
const fs = require("fs");

const { initializeModels, setupAssociations } = require("./models");
const { errorHandler } = require("./middleware/errorHandler");

// Import all routes
const publicUserRoutes = require("./routes/publicUserRoutes");
const eventOrganizerRoutes = require("./routes/eventOrganizerRoutes");
const adminUserRoutes = require("./routes/adminUserRoutes");
const eventRoutes = require("./routes/eventRoutes");
const ticketTypeRoutes = require("./routes/ticketTypeRoutes");
const ticketPurchaseRoutes = require("./routes/ticketPurchaseRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cors());

// Debug logging middleware
app.use((req, res, next) => {
  console.log(`🔍 [${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log(`📋 Headers:`, req.headers);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`📦 Body:`, req.body);
  }
  next();
});

// Static file serving for event ticketing system
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

console.log("📁 Events upload path:", eventsUploadPath);
console.log("📁 Organizers upload path:", organizersUploadPath);
console.log("📁 Profiles upload path:", profilesUploadPath);
console.log("📁 QR Codes upload path:", qrcodesUploadPath);
console.log("📁 Documents upload path:", documentsUploadPath);
console.log("📁 Misc upload path:", miscUploadPath);
console.log("📁 Events directory exists:", fs.existsSync(eventsUploadPath));
console.log(
  "📁 Organizers directory exists:",
  fs.existsSync(organizersUploadPath)
);
console.log("📁 Profiles directory exists:", fs.existsSync(profilesUploadPath));
console.log("📁 QR Codes directory exists:", fs.existsSync(qrcodesUploadPath));
console.log(
  "📁 Documents directory exists:",
  fs.existsSync(documentsUploadPath)
);
console.log("📁 Misc directory exists:", fs.existsSync(miscUploadPath));

app.use("/uploads/events", express.static(eventsUploadPath));
app.use("/uploads/organizers", express.static(organizersUploadPath));
app.use("/uploads/profiles", express.static(profilesUploadPath));
app.use("/uploads/qrcodes", express.static(qrcodesUploadPath));
app.use("/uploads/documents", express.static(documentsUploadPath));
app.use("/uploads/misc", express.static(miscUploadPath));

// API routes
console.log("🔗 Registering API routes...");
app.use("/api/public-users", publicUserRoutes);
console.log("✅ /api/public-users route registered");
app.use("/api/organizers", eventOrganizerRoutes);
console.log("✅ /api/organizers route registered");
app.use("/api/admins", adminUserRoutes);
console.log("✅ /api/admins route registered");
app.use("/api/events", eventRoutes);
console.log("✅ /api/events route registered");
app.use("/api/ticket-types", ticketTypeRoutes);
console.log("✅ /api/ticket-types route registered");
app.use("/api/purchases", ticketPurchaseRoutes);
console.log("✅ /api/purchases route registered");
app.use("/api/payments", paymentRoutes);
console.log("✅ /api/payments route registered");
console.log("✅ All API routes registered");

// Error handling middleware
app.use(errorHandler);

// Create upload directories if they don't exist
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

// Initialize models and associations
const initializeApp = async () => {
  try {
    // Create upload directories
    createUploadDirectories();

    await initializeModels();
    setupAssociations();
    console.log("✅ Application initialized successfully");
    return true;
  } catch (error) {
    console.error("❌ Error initializing application:", error);
    console.error("❌ Full error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      parent: error.parent?.message,
      original: error.original?.message,
    });
    throw error;
  }
};

// Export the initialization promise
const appInitialized = initializeApp();

module.exports = { app, appInitialized };
