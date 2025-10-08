const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Project = sequelize.define(
    "Project",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      location_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true,
      },
      longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM(
          "planning",
          "in_progress",
          "completed",
          "on_hold",
          "cancelled"
        ),
        allowNull: false,
        defaultValue: "planning",
      },
      start_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      end_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      budget_estimate: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      actual_cost: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0,
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "KES",
      },
      contractor_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      client_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      funding_source: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      engineer_in_charge: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "admins",
          key: "id",
        },
      },
      progress_percent: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
          max: 100,
        },
      },
      blueprint_url: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
      },
      document_urls: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      floor_size: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: "Floor size of the project (in square meters or ft²)",
      },
      construction_type: {
        type: DataTypes.ENUM(
          "building",
          "infrastructure",
          "industrial",
          "specialized",
          "other"
        ),
        allowNull: false,
        defaultValue: "building",
        comment: "Type of construction project",
      },
    },
    {
      tableName: "projects",
      timestamps: true,
    }
  );

  return Project;
};
