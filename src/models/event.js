const { DataTypes } = require("sequelize");
const { EVENT_CATEGORIES } = require("../constants/eventCategories");

module.exports = (sequelize) => {
  const Event = sequelize.define(
    "Event",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      organizer_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      event_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      category: {
        type: DataTypes.ENUM(...EVENT_CATEGORIES),
        allowNull: true,
      },
      venue: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      venue_latitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
        comment: "Venue latitude (Y coordinate)",
      },
      venue_longitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
        comment: "Venue longitude (X coordinate)",
      },
      event_date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      start_time: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      end_time: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      image_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      lineup: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        comment: "Manual lineup names, e.g. [{ name, role }]",
      },
      tickets_available: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        comment: "Total tickets available for this event",
      },
      ticket_prices: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        comment: "Ticket tiers, e.g. [{ category: 'VIP', price: 2000, quantity: 50 }]",
      },
      merchandise: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        comment:
          "Event merch, e.g. [{ id, name, price, image_url, pickup_point, quantity_available }]",
      },
      commission_rate: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 10.0,
        comment: "Platform commission percentage for this event",
      },
      status: {
        type: DataTypes.ENUM(
          "pending",
          "approved",
          "rejected",
          "completed",
          "cancelled"
        ),
        defaultValue: "pending",
      },
    },
    {
      tableName: "events",
      timestamps: true,
    }
  );

  return Event;
};
