const { sequelize } = require("../config/database");
const { runSchemaMigrations } = require("../utils/schemaMigrations");

const User = require("./user")(sequelize);
const Event = require("./event")(sequelize);
const ArtistSchedule = require("./artistSchedule")(sequelize);
const ArtistBooking = require("./artistBooking")(sequelize);
const TicketType = require("./ticketType")(sequelize);
const TicketPurchase = require("./ticketPurchase")(sequelize);
const Payment = require("./payment")(sequelize);

const models = {
  User,
  Event,
  ArtistSchedule,
  ArtistBooking,
  TicketType,
  TicketPurchase,
  Payment,
};

const initializeModels = async () => {
  try {
    console.log("🔄 Creating/updating tables...");

    const isProduction = process.env.NODE_ENV === "production";
    const parentSync = { force: false, alter: !isProduction };

    console.log(
      `📋 Syncing parent tables (alter=${parentSync.alter ? "on" : "off"})...`
    );
    await runSchemaMigrations(sequelize);
    await User.sync(parentSync);
    await Event.sync(parentSync);
    await ArtistSchedule.sync(parentSync);
    await ArtistBooking.sync(parentSync);

    console.log("📋 Syncing child tables...");
    await TicketType.sync({ force: false, alter: !isProduction });
    await TicketPurchase.sync({ force: false, alter: !isProduction });
    await Payment.sync({ force: false, alter: !isProduction });

    console.log("✅ All models synced successfully");
  } catch (error) {
    console.error("❌ Error syncing models:", error);
    throw error;
  }
};

const setupAssociations = () => {
  if (setupAssociations.ready) return;

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

    models.User.hasMany(models.ArtistBooking, {
      foreignKey: "artist_id",
      as: "artistBookings",
    });
    models.ArtistBooking.belongsTo(models.User, {
      foreignKey: "artist_id",
      as: "artist",
    });
    models.User.hasMany(models.ArtistBooking, {
      foreignKey: "requester_user_id",
      as: "requestedArtistBookings",
    });
    models.ArtistBooking.belongsTo(models.User, {
      foreignKey: "requester_user_id",
      as: "requester",
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
    setupAssociations.ready = true;
  } catch (error) {
    console.error("❌ Error during setupAssociations:", error);
    throw error;
  }
};

module.exports = { ...models, initializeModels, setupAssociations, sequelize };
