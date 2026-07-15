const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const ArtistBooking = sequelize.define(
    "ArtistBooking",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      artist_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      requester_user_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: "Optional authenticated app user",
      },
      requester_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      requester_email: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      requester_phone: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      booking_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      start_time: {
        type: DataTypes.TIME,
        allowNull: false,
      },
      end_time: {
        type: DataTypes.TIME,
        allowNull: false,
      },
      venue: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      artist_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("pending", "confirmed", "rejected", "cancelled"),
        allowNull: false,
        defaultValue: "pending",
      },
    },
    {
      tableName: "artist_bookings",
      timestamps: true,
      indexes: [
        { fields: ["artist_id", "booking_date"] },
        { fields: ["artist_id", "status"] },
        { fields: ["requester_email"] },
      ],
    }
  );

  return ArtistBooking;
};
