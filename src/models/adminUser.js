const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const AdminUser = sequelize.define(
    "AdminUser",
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
        unique: true,
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
      department: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      permissions: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      role: {
        type: DataTypes.ENUM("super_admin", "finance_admin", "support_admin"),
        defaultValue: "super_admin",
      },
      profile_image: {
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
      tableName: "admin_users",
      timestamps: true,
    }
  );

  return AdminUser;
};
