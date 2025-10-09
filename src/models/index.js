const { sequelize } = require("../config/database");

// Import all models
const PublicUser = require("./publicUser")(sequelize);
const EventOrganizer = require("./eventOrganizer")(sequelize);
const AdminUser = require("./adminUser")(sequelize);
const Event = require("./event")(sequelize);
const TicketType = require("./ticketType")(sequelize);
const TicketPurchase = require("./ticketPurchase")(sequelize);
const Payment = require("./payment")(sequelize);

const models = {
  PublicUser,
  EventOrganizer,
  AdminUser,
  Event,
  TicketType,
  TicketPurchase,
  Payment,
};

// Initialize models in correct order (parent tables first)
const initializeModels = async () => {
  try {
    console.log("🔄 Creating/updating tables...");

    // Use alter: false to prevent schema conflicts in production
    console.log("📋 Syncing parent tables...");
    await PublicUser.sync({ force: false, alter: false });
    await EventOrganizer.sync({ force: false, alter: false });
    await AdminUser.sync({ force: false, alter: false });
    await Event.sync({ force: false, alter: false });

    console.log("📋 Syncing child tables...");
    await TicketType.sync({ force: false, alter: false });
    await TicketPurchase.sync({ force: false, alter: false });
    await Payment.sync({ force: false, alter: false });

    console.log("✅ All models synced successfully");
  } catch (error) {
    console.error("❌ Error syncing models:", error);
    console.error("❌ Error details:", {
      name: error.name,
      message: error.message,
      parent: error.parent?.message,
      original: error.original?.message,
      sql: error.sql,
    });
    throw error;
  }
};

const setupAssociations = () => {
  try {
    // Event Organizer → Event (1:Many)
    models.EventOrganizer.hasMany(models.Event, {
      foreignKey: "organizer_id",
      as: "events",
    });
    models.Event.belongsTo(models.EventOrganizer, {
      foreignKey: "organizer_id",
      as: "organizer",
    });

    // Event → TicketType (1:Many)
    models.Event.hasMany(models.TicketType, {
      foreignKey: "event_id",
      as: "ticketTypes",
    });
    models.TicketType.belongsTo(models.Event, {
      foreignKey: "event_id",
      as: "event",
    });

    // PublicUser → TicketPurchase (1:Many)
    models.PublicUser.hasMany(models.TicketPurchase, {
      foreignKey: "user_id",
      as: "purchases",
    });
    models.TicketPurchase.belongsTo(models.PublicUser, {
      foreignKey: "user_id",
      as: "user",
    });

    // Event → TicketPurchase (1:Many)
    models.Event.hasMany(models.TicketPurchase, {
      foreignKey: "event_id",
      as: "purchases",
    });
    models.TicketPurchase.belongsTo(models.Event, {
      foreignKey: "event_id",
      as: "event",
    });

    // TicketType → TicketPurchase (1:Many)
    models.TicketType.hasMany(models.TicketPurchase, {
      foreignKey: "ticket_type_id",
      as: "purchases",
    });
    models.TicketPurchase.belongsTo(models.TicketType, {
      foreignKey: "ticket_type_id",
      as: "ticketType",
    });

    // TicketPurchase → Payment (1:1)
    models.TicketPurchase.hasOne(models.Payment, {
      foreignKey: "purchase_id",
      as: "payment",
    });
    models.Payment.belongsTo(models.TicketPurchase, {
      foreignKey: "purchase_id",
      as: "purchase",
    });

    console.log("✅ All associations set up successfully");
  } catch (error) {
    console.error("❌ Error during setupAssociations:", error);
  }
};

module.exports = { ...models, initializeModels, setupAssociations, sequelize };
