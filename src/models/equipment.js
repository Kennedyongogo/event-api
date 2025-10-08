const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Equipment = sequelize.define(
    "Equipment",
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
      type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      availability: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      rental_cost_per_day: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      assigned_task_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "tasks",
          key: "id",
        },
      },
    },
    {
      tableName: "equipment",
      timestamps: true,
    }
  );

  return Equipment;
};
