const { sequelize } = require("../config/database");

const User = require("./user")(sequelize);
const Event = require("./event")(sequelize);
const ArtistSchedule = require("./artistSchedule")(sequelize);
const TicketType = require("./ticketType")(sequelize);
const TicketPurchase = require("./ticketPurchase")(sequelize);
const Payment = require("./payment")(sequelize);

const models = {
  User,
  Event,
  ArtistSchedule,
  TicketType,
  TicketPurchase,
  Payment,
};

const initializeModels = async () => {
  try {
    console.log("🔄 Creating/updating tables...");

    console.log("📋 Syncing parent tables...");
    await User.sync({ force: false, alter: true });
    await Event.sync({ force: false, alter: true });
    await ArtistSchedule.sync({ force: false, alter: true });

    console.log("📋 Syncing child tables...");
    await TicketType.sync({ force: false, alter: false });
    await TicketPurchase.sync({ force: false, alter: false });
    await Payment.sync({ force: false, alter: false });

    console.log("✅ All models synced successfully");
  } catch (error) {
    console.error("❌ Error syncing models:", error);
    throw error;
  }
};

const setupAssociations = () => {
  try {
    models.User.hasMany(models.Event, {
      foreignKey: "organizer_id",
      as: "events",
    });
    models.Event.belongsTo(models.User, {
      foreignKey: "organizer_id",
      as: "organizer",
    });

    models.User.hasMany(models.ArtistSchedule, {
      foreignKey: "artist_id",
      as: "schedule",
    });
    models.ArtistSchedule.belongsTo(models.User, {
      foreignKey: "artist_id",
      as: "artist",
    });

    models.Event.hasMany(models.TicketType, {
      foreignKey: "event_id",
      as: "ticketTypes",
    });
    models.TicketType.belongsTo(models.Event, {
      foreignKey: "event_id",
      as: "event",
    });

    models.Event.hasMany(models.TicketPurchase, {
      foreignKey: "event_id",
      as: "purchases",
    });
    models.TicketPurchase.belongsTo(models.Event, {
      foreignKey: "event_id",
      as: "event",
    });

    models.TicketType.hasMany(models.TicketPurchase, {
      foreignKey: "ticket_type_id",
      as: "purchases",
    });
    models.TicketPurchase.belongsTo(models.TicketType, {
      foreignKey: "ticket_type_id",
      as: "ticketType",
    });

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
    throw error;
  }
};

module.exports = { ...models, initializeModels, setupAssociations, sequelize };
