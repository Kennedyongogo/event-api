const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const EventOrganizer = sequelize.define(
    "EventOrganizer",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      organization_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      contact_person: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      phone_number: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      address: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      kra_pin: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      pesapal_merchant_ref: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      bank_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      bank_account_number: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      website: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      logo: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("pending", "approved", "active", "suspended"),
        defaultValue: "pending",
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      lastLogin: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "event_organizers",
      timestamps: true,
    }
  );

  return EventOrganizer;
};
