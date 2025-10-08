const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Issue = sequelize.define(
    "Issue",
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
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isEmail: true,
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      category: {
        type: DataTypes.ENUM(
          "general_inquiry",
          "project_inquiry",
          "technical_support",
          "billing_question",
          "complaint",
          "suggestion",
          "other"
        ),
        allowNull: false,
        defaultValue: "general_inquiry",
      },
      project_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "projects",
          key: "id",
        },
      },
      status: {
        type: DataTypes.ENUM("open", "resolved", "in_review"),
        allowNull: false,
        defaultValue: "open",
      },
    },
    {
      tableName: "issues",
      timestamps: true,
    }
  );

  return Issue;
};
