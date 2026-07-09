const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const TicketPurchase = sequelize.define(
    "TicketPurchase",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: true, // Now optional since public users don't register
      },
      // Buyer information (for anonymous purchases)
      buyer_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      buyer_email: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      buyer_phone: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      event_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      ticket_type_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      total_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      ticket_subtotal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      merchandise_subtotal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      merchandise_items: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        comment:
          "Merchandise line items with commission breakdown [{ merchandise_id, name, quantity, unit_price, line_total, commission_rate, platform_fee, organizer_share, pickup_point }]",
      },
      qr_code: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("pending", "paid", "cancelled", "refunded"),
        defaultValue: "pending",
      },
    },
    {
      tableName: "ticket_purchases",
      timestamps: true,
    }
  );

  return TicketPurchase;
};
