const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      full_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isEmail: true,
        },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      role: {
        type: DataTypes.ENUM("admin", "event_organizer", "artist"),
        allowNull: false,
      },
      // Event organizer fields
      organization_name: {
        type: DataTypes.STRING,
        allowNull: true,
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
      organizer_status: {
        type: DataTypes.ENUM("pending", "approved", "active", "suspended"),
        allowNull: true,
      },
      // Artist fields
      stage_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      bio: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      genre: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      profile_image: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      profile_images: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
      },
      facebook_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      instagram_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      tiktok_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      twitter_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      linkedin_url: {
        type: DataTypes.STRING,
        allowNull: true,
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
      tableName: "users",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["email", "role"],
          name: "users_email_role_unique",
        },
      ],
    }
  );

  return User;
};
