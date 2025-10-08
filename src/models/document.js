const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Document = sequelize.define(
    "Document",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      document_type: {
        type: DataTypes.ENUM(
          "project_document",
          "company_document",
          "template",
          "policy",
          "contract",
          "other"
        ),
        allowNull: false,
        defaultValue: "company_document",
      },
      category: {
        type: DataTypes.STRING,
        allowNull: true,
        comment:
          "Document category for organization (e.g., 'HR', 'Finance', 'Legal')",
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Document description or notes",
      },
      file_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      file_type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      file_url: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      uploaded_by_admin_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "admins",
          key: "id",
        },
      },
    },
    {
      tableName: "documents",
      timestamps: true,
    }
  );

  return Document;
};
