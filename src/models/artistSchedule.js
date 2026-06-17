const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const ArtistSchedule = sequelize.define(
    "ArtistSchedule",
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
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "Show, festival, appearance name",
      },
      venue: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      activity_date: {
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
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      image_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      external_url: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "Optional ticket/info link outside TickaHub",
      },
      is_public: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      tableName: "artist_schedules",
      timestamps: true,
      indexes: [{ fields: ["artist_id", "activity_date"] }],
    }
  );

  return ArtistSchedule;
};
