const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Material = sequelize.define(
    "Material",
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
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      unit: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      unit_cost: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
      },
      quantity_required: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
      },
      quantity_used: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0,
      },
    },
    {
      tableName: "materials",
      timestamps: true,
    }
  );

  return Material;
};
