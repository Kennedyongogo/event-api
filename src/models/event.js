const { DataTypes } = require("sequelize");

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
        type: DataTypes.STRING,
        allowNull: true,
      },
      venue: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      county: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      sub_county: {
        type: DataTypes.STRING,
        allowNull: true,
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
          "active",
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
