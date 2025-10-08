const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Labor = sequelize.define(
    "Labor",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      task_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "tasks",
          key: "id",
        },
      },
      worker_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      worker_type: {
        type: DataTypes.ENUM(
          "foreman",
          "skilled_worker",
          "unskilled_worker",
          "engineer",
          "supervisor"
        ),
        allowNull: false,
      },
      hourly_rate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      hours_worked: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 0,
      },
      total_cost: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      start_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      end_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("active", "completed", "on_leave"),
        allowNull: false,
        defaultValue: "active",
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      skills: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
      },
      // Add fields for labor requirements
      is_requirement: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      required_quantity: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1,
      },
    },
    {
      tableName: "labor",
      timestamps: true,
    }
  );

  // Calculate total cost before saving
  Labor.beforeSave((labor) => {
    if (labor.hourly_rate && labor.hours_worked) {
      labor.total_cost =
        parseFloat(labor.hourly_rate) * parseFloat(labor.hours_worked);
    }
  });

  return Labor;
};
