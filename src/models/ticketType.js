const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const TicketType = sequelize.define(
    "TicketType",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      event_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      total_quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      remaining_quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      tableName: "ticket_types",
      timestamps: true,
    }
  );

  return TicketType;
};
