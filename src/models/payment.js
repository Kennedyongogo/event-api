const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Payment = sequelize.define(
    "Payment",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      purchase_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      pesapal_transaction_id: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      commission_amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.0,
      },
      organizer_share: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.0,
      },
      admin_share: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.0,
      },
      payment_method: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("pending", "completed", "failed", "refunded"),
        defaultValue: "pending",
      },
    },
    {
      tableName: "payments",
      timestamps: true,
    }
  );

  return Payment;
};
