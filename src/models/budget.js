const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Budget = sequelize.define(
    "Budget",
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
      category: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM("budgeted", "actual"),
        allowNull: false,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      // Resource references for auto-calculation
      material_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "materials",
          key: "id",
        },
      },
      equipment_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "equipment",
          key: "id",
        },
      },
      labor_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "labor",
          key: "id",
        },
      },
      // Budget entry type
      entry_type: {
        type: DataTypes.ENUM("resource_based", "manual"),
        allowNull: false,
        defaultValue: "manual",
      },
      // Auto-calculated fields
      calculated_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 1,
      },
    },
    {
      tableName: "budgets",
      timestamps: true,
    }
  );

  return Budget;
};
