const { sequelize } = require("../config/database");

// Import all models
const Admin = require("./admin")(sequelize);
const User = require("./user")(sequelize);
const Project = require("./project")(sequelize);
const Task = require("./task")(sequelize);
const Material = require("./material")(sequelize);
const Equipment = require("./equipment")(sequelize);
const Labor = require("./labor")(sequelize);
const Budget = require("./budget")(sequelize);
const Document = require("./document")(sequelize);
const ProgressUpdate = require("./progressUpdate")(sequelize);
const Issue = require("./issue")(sequelize);
const Notification = require("./notification")(sequelize);

const models = {
  Admin,
  User,
  Project,
  Task,
  Material,
  Equipment,
  Labor,
  Budget,
  Document,
  ProgressUpdate,
  Issue,
  Notification,
};

// Initialize models in correct order (parent tables first)
const initializeModels = async () => {
  try {
    console.log("🔄 Creating/updating tables...");

    // Use alter: false to prevent schema conflicts in production
    console.log("📋 Syncing parent tables...");
    await Admin.sync({ force: false, alter: false });
    await User.sync({ force: false, alter: false });
    await Project.sync({ force: false, alter: false });

    console.log("📋 Syncing child tables...");
    await Task.sync({ force: false, alter: false });
    await Material.sync({ force: false, alter: false });
    await Equipment.sync({ force: false, alter: false });
    await Labor.sync({ force: false, alter: false });
    await Budget.sync({ force: false, alter: false });
    await Document.sync({ force: false, alter: false });
    await ProgressUpdate.sync({ force: false, alter: false });
    await Issue.sync({ force: false });
    await Notification.sync({ force: false, alter: false });

    console.log("✅ All models synced successfully");
  } catch (error) {
    console.error("❌ Error syncing models:", error);
    console.error("❌ Error details:", {
      name: error.name,
      message: error.message,
      parent: error.parent?.message,
      original: error.original?.message,
      sql: error.sql,
    });
    throw error;
  }
};

const setupAssociations = () => {
  try {
    // Admin can be in charge of Projects
    models.Project.belongsTo(models.Admin, {
      foreignKey: "engineer_in_charge",
      as: "engineer",
    });

    models.Admin.hasMany(models.Project, {
      foreignKey: "engineer_in_charge",
      as: "managedProjects",
    });

    // Task associations
    models.Task.belongsTo(models.Project, {
      foreignKey: "project_id",
      as: "project",
    });
    models.Project.hasMany(models.Task, {
      foreignKey: "project_id",
      as: "tasks",
    });
    models.Task.belongsTo(models.Admin, {
      foreignKey: "assigned_to_admin",
      as: "assignedAdmin",
    });
    models.Admin.hasMany(models.Task, {
      foreignKey: "assigned_to_admin",
      as: "assignedTasks",
    });

    // Material associations
    models.Material.belongsTo(models.Task, {
      foreignKey: "task_id",
      as: "task",
    });
    models.Task.hasMany(models.Material, {
      foreignKey: "task_id",
      as: "materials",
    });

    // Equipment associations
    models.Equipment.belongsTo(models.Task, {
      foreignKey: "assigned_task_id",
      as: "assignedTask",
    });
    models.Task.hasMany(models.Equipment, {
      foreignKey: "assigned_task_id",
      as: "equipment",
    });

    // Labor associations
    models.Labor.belongsTo(models.Task, {
      foreignKey: "task_id",
      as: "task",
    });
    models.Task.hasMany(models.Labor, {
      foreignKey: "task_id",
      as: "labor",
    });

    // Budget associations (now task-based)
    models.Budget.belongsTo(models.Task, {
      foreignKey: "task_id",
      as: "task",
    });
    models.Task.hasMany(models.Budget, {
      foreignKey: "task_id",
      as: "budgets",
    });

    // Budget resource associations
    models.Budget.belongsTo(models.Material, {
      foreignKey: "material_id",
      as: "material",
    });
    models.Material.hasMany(models.Budget, {
      foreignKey: "material_id",
      as: "budgets",
    });

    models.Budget.belongsTo(models.Equipment, {
      foreignKey: "equipment_id",
      as: "equipment",
    });
    models.Equipment.hasMany(models.Budget, {
      foreignKey: "equipment_id",
      as: "budgets",
    });

    models.Budget.belongsTo(models.Labor, {
      foreignKey: "labor_id",
      as: "labor",
    });
    models.Labor.hasMany(models.Budget, {
      foreignKey: "labor_id",
      as: "budgets",
    });

    // Document associations (no project relationship - documents are independent)
    models.Document.belongsTo(models.Admin, {
      foreignKey: "uploaded_by_admin_id",
      as: "uploadedBy",
    });
    models.Admin.hasMany(models.Document, {
      foreignKey: "uploaded_by_admin_id",
      as: "uploadedDocuments",
    });

    // ProgressUpdate associations
    models.ProgressUpdate.belongsTo(models.Task, {
      foreignKey: "task_id",
      as: "task",
    });
    models.Task.hasMany(models.ProgressUpdate, {
      foreignKey: "task_id",
      as: "progressUpdates",
    });

    // Issue associations
    models.Issue.belongsTo(models.Project, {
      foreignKey: "project_id",
      as: "project",
    });
    models.Project.hasMany(models.Issue, {
      foreignKey: "project_id",
      as: "issues",
    });
  } catch (error) {
    console.error("❌ Error during setupAssociations:", error);
  }
};

module.exports = { ...models, initializeModels, setupAssociations, sequelize };
