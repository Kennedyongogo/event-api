const {
  Admin,
  Project,
  Task,
  Document,
  User,
  Material,
  Equipment,
  Labor,
  Budget,
  Issue,
  ProgressUpdate,
  Notification,
} = require("../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config/config");
const { Op } = require("sequelize");
const { sequelize } = require("../models");

// Get all admins
const getAllAdmins = async (req, res) => {
  try {
    const { page, limit } = req.query;

    // Parse pagination parameters
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const totalCount = await Admin.count();

    // Get paginated admins
    const admins = await Admin.findAll({
      attributes: { exclude: ["password"] },
      include: [
        {
          model: Project,
          as: "managedProjects",
          attributes: ["id", "name", "status", "progress_percent"],
        },
        {
          model: Task,
          as: "assignedTasks",
          attributes: ["id", "name", "status", "progress_percent"],
        },
        {
          model: Document,
          as: "uploadedDocuments",
          attributes: ["id", "file_name", "file_type"],
        },
      ],
      limit: limitNum,
      offset: offset,
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: admins,
      count: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (error) {
    console.error("Error fetching admins:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching admins",
      error: error.message,
    });
  }
};

// Get admin by ID
const getAdminById = async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await Admin.findByPk(id, {
      attributes: { exclude: ["password"] },
      include: [
        {
          model: Project,
          as: "managedProjects",
          attributes: [
            "id",
            "name",
            "status",
            "progress_percent",
            "start_date",
            "end_date",
          ],
        },
        {
          model: Task,
          as: "assignedTasks",
          attributes: ["id", "name", "status", "progress_percent", "due_date"],
        },
        {
          model: Document,
          as: "uploadedDocuments",
          attributes: ["id", "file_name", "file_type", "createdAt"],
        },
      ],
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    res.status(200).json({
      success: true,
      data: admin,
    });
  } catch (error) {
    console.error("Error fetching admin:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching admin",
      error: error.message,
    });
  }
};

// Create new admin
const createAdmin = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    // Handle profile picture file upload
    let profile_picture = null;
    if (req.file) {
      profile_picture = `uploads/documents/${req.file.filename}`; // Store consistent path like blueprints
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ where: { email } });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: "Admin with this email already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    const admin = await Admin.create({
      name,
      email,
      password: hashedPassword,
      role,
      phone,
      profile_picture,
    });

    // Remove password from response
    const adminResponse = admin.toJSON();
    delete adminResponse.password;

    res.status(201).json({
      success: true,
      message: "Admin created successfully",
      data: adminResponse,
    });
  } catch (error) {
    console.error("Error creating admin:", error);
    res.status(500).json({
      success: false,
      message: "Error creating admin",
      error: error.message,
    });
  }
};

// Update admin
const updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, phone, isActive } = req.body;

    // Handle profile picture file upload
    let profile_picture = null;
    if (req.file) {
      profile_picture = `uploads/documents/${req.file.filename}`; // Store consistent path like blueprints
    }

    const admin = await Admin.findByPk(id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Check if email is being changed and if it already exists
    if (email && email !== admin.email) {
      const existingAdmin = await Admin.findOne({ where: { email } });
      if (existingAdmin) {
        return res.status(400).json({
          success: false,
          message: "Admin with this email already exists",
        });
      }
    }

    // Prepare update data
    const updateData = {
      name: name || admin.name,
      email: email || admin.email,
      role: role || admin.role,
      phone: phone !== undefined ? phone : admin.phone,
      isActive: isActive !== undefined ? isActive : admin.isActive,
    };

    // Only update profile_picture if a new file was uploaded
    if (profile_picture) {
      updateData.profile_picture = profile_picture;
    }

    await admin.update(updateData);

    // Remove password from response
    const adminResponse = admin.toJSON();
    delete adminResponse.password;

    res.status(200).json({
      success: true,
      message: "Admin updated successfully",
      data: adminResponse,
    });
  } catch (error) {
    console.error("Error updating admin:", error);
    res.status(500).json({
      success: false,
      message: "Error updating admin",
      error: error.message,
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    const admin = await Admin.findByPk(id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      admin.password
    );
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    await admin.update({ password: hashedNewPassword });

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({
      success: false,
      message: "Error changing password",
      error: error.message,
    });
  }
};

// Delete admin
const deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const admin = await Admin.findByPk(id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    await admin.destroy();

    res.status(200).json({
      success: true,
      message: "Admin deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting admin:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting admin",
      error: error.message,
    });
  }
};

// Admin login
const loginAdmin = async (req, res) => {
  try {
    console.log("🔐 LOGIN ATTEMPT:", {
      email: req.body.email,
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    const { email, password } = req.body;

    const admin = await Admin.findOne({ where: { email } });
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (!admin.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Update last login
    await admin.update({ lastLogin: new Date() });

    // Generate JWT token
    const token = jwt.sign(
      {
        adminId: admin.id,
        email: admin.email,
        role: admin.role,
      },
      config.jwtSecret,
      { expiresIn: "24h" }
    );

    // Remove password from response
    const adminResponse = admin.toJSON();
    delete adminResponse.password;

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        admin: adminResponse,
        token,
      },
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({
      success: false,
      message: "Error during login",
      error: error.message,
    });
  }
};

// Helper function to fill in missing enum values with 0 count
const fillEnumCounts = (data, enumValues, keyName = "status") => {
  const result = enumValues.map((value) => {
    const found = data.find((item) => item[keyName] === value);
    return {
      [keyName]: value,
      count: found ? found.count : "0",
    };
  });
  return result;
};

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    // Get filter parameters
    const { startDate, endDate, projectId, engineerId } = req.query;

    // Build date filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt[Op.gte] = new Date(startDate);
      if (endDate) dateFilter.createdAt[Op.lte] = new Date(endDate);
    }

    // Build project filter
    let projectFilter = {};
    if (projectId) projectFilter.id = projectId;
    if (engineerId) projectFilter.engineer_in_charge = engineerId;

    // Define all possible enum values
    const PROJECT_STATUSES = [
      "planning",
      "in_progress",
      "completed",
      "on_hold",
      "cancelled",
    ];
    const CONSTRUCTION_TYPES = [
      "building",
      "infrastructure",
      "industrial",
      "specialized",
      "other",
    ];
    const TASK_STATUSES = ["pending", "in_progress", "completed"];
    const ISSUE_STATUSES = ["open", "resolved", "in_review"];
    const LABOR_STATUSES = ["active", "completed", "on_leave"];
    const LABOR_TYPES = [
      "foreman",
      "skilled_worker",
      "unskilled_worker",
      "engineer",
      "supervisor",
    ];
    const EQUIPMENT_AVAILABILITY = [true, false];

    // === TOTAL COUNTS ===
    const totalProjects = await Project.count({
      where: Object.keys(projectFilter).length > 0 ? projectFilter : {},
    });
    const totalTasks = await Task.count();
    const totalUsers = await User.count();
    const totalAdmins = await Admin.count();
    const totalMaterials = await Material.count();
    const totalEquipment = await Equipment.count();
    const totalLabor = await Labor.count();
    const totalIssues = await Issue.count();
    const totalDocuments = await Document.count();

    // === PROJECT STATUS BREAKDOWN ===
    const projectsByStatus = await Project.findAll({
      where: Object.keys(projectFilter).length > 0 ? projectFilter : {},
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["status"],
      raw: true,
    });

    // === TASK STATUS BREAKDOWN ===
    const tasksByStatus = await Task.findAll({
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["status"],
      raw: true,
    });

    // === BUDGET ANALYSIS ===
    const budgetAnalysis = await Budget.findAll({
      attributes: [
        "type",
        [sequelize.fn("SUM", sequelize.col("amount")), "totalAmount"],
      ],
      group: ["type"],
      raw: true,
    });

    const totalBudgeted =
      budgetAnalysis.find((b) => b.type === "budgeted")?.totalAmount || 0;
    const totalActual =
      budgetAnalysis.find((b) => b.type === "actual")?.totalAmount || 0;
    const budgetVariance = parseFloat(totalBudgeted) - parseFloat(totalActual);
    const budgetUtilization =
      totalBudgeted > 0
        ? ((parseFloat(totalActual) / parseFloat(totalBudgeted)) * 100).toFixed(
            2
          )
        : 0;

    // === BUDGET BY CATEGORY ===
    const budgetByCategory = await Budget.findAll({
      attributes: [
        "category",
        "type",
        [sequelize.fn("SUM", sequelize.col("amount")), "totalAmount"],
      ],
      group: ["category", "type"],
      raw: true,
    });

    // === PROJECT BUDGET SUMMARY ===
    const projectBudgets = await Project.findAll({
      where: Object.keys(projectFilter).length > 0 ? projectFilter : {},
      attributes: [
        "id",
        "name",
        "budget_estimate",
        "actual_cost",
        [sequelize.literal("budget_estimate - actual_cost"), "budgetRemaining"],
      ],
      raw: true,
    });

    // === PROJECT RESOURCES COUNT ===
    // Count materials per project (through tasks)
    const materialsPerProject = await Material.findAll({
      attributes: [
        [sequelize.col("task.project_id"), "project_id"],
        [sequelize.fn("COUNT", sequelize.col("Material.id")), "materialCount"],
      ],
      include: [
        {
          model: Task,
          as: "task",
          attributes: [],
          required: true,
        },
      ],
      group: ["task.project_id"],
      raw: true,
    });

    // Count labor per project (through tasks)
    const laborPerProject = await Labor.findAll({
      attributes: [
        [sequelize.col("task.project_id"), "project_id"],
        [sequelize.fn("COUNT", sequelize.col("Labor.id")), "laborCount"],
      ],
      include: [
        {
          model: Task,
          as: "task",
          attributes: [],
          required: true,
        },
      ],
      group: ["task.project_id"],
      raw: true,
    });

    // Count equipment per project (through tasks)
    const equipmentPerProject = await Equipment.findAll({
      attributes: [
        [sequelize.col("assignedTask.project_id"), "project_id"],
        [
          sequelize.fn("COUNT", sequelize.col("Equipment.id")),
          "equipmentCount",
        ],
      ],
      include: [
        {
          model: Task,
          as: "assignedTask",
          attributes: [],
          required: true,
        },
      ],
      group: ["assignedTask.project_id"],
      raw: true,
    });

    // Combine resource counts with project info
    const projectResources = await Project.findAll({
      where: Object.keys(projectFilter).length > 0 ? projectFilter : {},
      attributes: ["id", "name", "status", "progress_percent"],
      raw: true,
    });

    const projectResourceSummary = projectResources.map((project) => {
      const materials =
        materialsPerProject.find((m) => m.project_id === project.id)
          ?.materialCount || "0";
      const labor =
        laborPerProject.find((l) => l.project_id === project.id)?.laborCount ||
        "0";
      const equipment =
        equipmentPerProject.find((e) => e.project_id === project.id)
          ?.equipmentCount || "0";

      return {
        project_id: project.id,
        project_name: project.name,
        status: project.status,
        progress_percent: project.progress_percent,
        materialCount: materials,
        laborCount: labor,
        equipmentCount: equipment,
        totalResources:
          parseInt(materials) + parseInt(labor) + parseInt(equipment),
      };
    });

    // === ISSUE STATUS BREAKDOWN ===
    const issuesByStatus = await Issue.findAll({
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["status"],
      raw: true,
    });

    // === TOP ENGINEERS BY PROJECT COUNT ===
    let topEngineers = [];
    try {
      // Use raw SQL query to avoid Sequelize alias issues
      const [results] = await sequelize.query(
        `
        SELECT 
          a.id,
          a.name,
          a.email,
          COUNT(p.id) as "projectCount"
        FROM admins a
        LEFT JOIN projects p ON a.id = p.engineer_in_charge
        ${
          Object.keys(projectFilter).length > 0
            ? "WHERE " +
              Object.keys(projectFilter)
                .map((key) => `p.${key} = :${key}`)
                .join(" AND ")
            : ""
        }
        GROUP BY a.id, a.name, a.email
        HAVING COUNT(p.id) > 0
        ORDER BY COUNT(p.id) DESC, a.name ASC
        LIMIT 5
      `,
        {
          replacements: projectFilter,
          type: sequelize.QueryTypes.SELECT,
        }
      );

      topEngineers = results;
    } catch (error) {
      console.error("Error fetching top engineers:", error.message);
      // Fallback: get all admins without project count
      topEngineers = await Admin.findAll({
        attributes: ["id", "name", "email"],
        limit: 5,
      });
    }

    // === RECENT ACTIVITY ===
    let recentProjects = [];
    try {
      recentProjects = await Project.findAll({
        where: Object.keys(projectFilter).length > 0 ? projectFilter : {},
        limit: 5,
        order: [["createdAt", "DESC"]],
        attributes: ["id", "name", "status", "createdAt"],
        include: [
          {
            model: Admin,
            as: "engineer",
            attributes: ["name", "email"],
          },
        ],
      });
    } catch (error) {
      console.error("Error fetching recent projects:", error.message);
      recentProjects = await Project.findAll({
        where: Object.keys(projectFilter).length > 0 ? projectFilter : {},
        limit: 5,
        order: [["createdAt", "DESC"]],
        attributes: ["id", "name", "status", "createdAt"],
      });
    }

    let recentIssues = [];
    try {
      recentIssues = await Issue.findAll({
        limit: 5,
        order: [["createdAt", "DESC"]],
        attributes: ["id", "description", "status", "createdAt"],
        include: [
          {
            model: Project,
            as: "project",
            attributes: ["name"],
          },
        ],
      });
    } catch (error) {
      console.error("Error fetching recent issues:", error.message);
      recentIssues = await Issue.findAll({
        limit: 5,
        order: [["createdAt", "DESC"]],
        attributes: ["id", "description", "status", "createdAt"],
      });
    }

    let recentTasks = [];
    try {
      recentTasks = await Task.findAll({
        limit: 5,
        order: [["createdAt", "DESC"]],
        attributes: ["id", "name", "status", "progress_percent", "createdAt"],
        include: [
          {
            model: Project,
            as: "project",
            attributes: ["name"],
          },
        ],
      });
    } catch (error) {
      console.error("Error fetching recent tasks:", error.message);
      recentTasks = await Task.findAll({
        limit: 5,
        order: [["createdAt", "DESC"]],
        attributes: ["id", "name", "status", "progress_percent", "createdAt"],
      });
    }

    // === PROJECT PROGRESS OVERVIEW ===
    const projectProgress = await Project.findAll({
      where: Object.keys(projectFilter).length > 0 ? projectFilter : {},
      attributes: [
        [
          sequelize.fn(
            "AVG",
            sequelize.cast(sequelize.col("progress_percent"), "DECIMAL(5,2)")
          ),
          "avgProgress",
        ],
        [sequelize.fn("MIN", sequelize.col("progress_percent")), "minProgress"],
        [sequelize.fn("MAX", sequelize.col("progress_percent")), "maxProgress"],
      ],
      raw: true,
    });

    // === CONSTRUCTION TYPE BREAKDOWN ===
    const projectsByType = await Project.findAll({
      where: Object.keys(projectFilter).length > 0 ? projectFilter : {},
      attributes: [
        "construction_type",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["construction_type"],
      raw: true,
    });

    // === OVERDUE TASKS ===
    const overdueTasks = await Task.count({
      where: {
        due_date: { [Op.lt]: new Date() },
        status: { [Op.ne]: "completed" },
      },
    });

    // === ACTIVE USERS (logged in last 7 days) ===
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const activeAdmins = await Admin.count({
      where: {
        lastLogin: { [Op.gte]: sevenDaysAgo },
      },
    });

    // === EQUIPMENT AVAILABILITY ===
    const equipmentByAvailability = await Equipment.findAll({
      attributes: [
        "availability",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["availability"],
      raw: true,
    });

    // === LABOR STATUS ===
    const laborByStatus = await Labor.findAll({
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["status"],
      raw: true,
    });

    // === LABOR BY TYPE ===
    const laborByType = await Labor.findAll({
      attributes: [
        "worker_type",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["worker_type"],
      raw: true,
    });

    // === MATERIAL USAGE SUMMARY ===
    const materialUsage = await Material.findAll({
      attributes: [
        [
          sequelize.fn("SUM", sequelize.col("quantity_required")),
          "totalRequired",
        ],
        [sequelize.fn("SUM", sequelize.col("quantity_used")), "totalUsed"],
        [
          sequelize.literal("SUM(quantity_required * unit_cost)"),
          "totalMaterialCost",
        ],
        [
          sequelize.literal("SUM(quantity_used * unit_cost)"),
          "totalMaterialSpent",
        ],
      ],
      raw: true,
    });

    const materialUtilization =
      materialUsage[0]?.totalRequired > 0
        ? (
            (parseFloat(materialUsage[0]?.totalUsed || 0) /
              parseFloat(materialUsage[0]?.totalRequired)) *
            100
          ).toFixed(2)
        : "0.00";

    // === LABOR COST SUMMARY ===
    const laborCostSummary = await Labor.findAll({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("hours_worked")), "totalHours"],
        [sequelize.fn("SUM", sequelize.col("total_cost")), "totalLaborCost"],
        [sequelize.fn("AVG", sequelize.col("hourly_rate")), "avgHourlyRate"],
      ],
      raw: true,
    });

    // === EQUIPMENT COST SUMMARY ===
    const equipmentCostSummary = await Equipment.findAll({
      attributes: [
        [
          sequelize.fn("SUM", sequelize.col("rental_cost_per_day")),
          "totalDailyRentalCost",
        ],
        [sequelize.fn("COUNT", sequelize.col("id")), "totalEquipment"],
      ],
      where: {
        availability: true,
      },
      raw: true,
    });

    // === TASK COMPLETION RATE ===
    const taskStats = await Task.findAll({
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "totalTasks"],
        [
          sequelize.fn(
            "COUNT",
            sequelize.literal("CASE WHEN status = 'completed' THEN 1 END")
          ),
          "completedTasks",
        ],
        [
          sequelize.fn(
            "COUNT",
            sequelize.literal("CASE WHEN status = 'in_progress' THEN 1 END")
          ),
          "inProgressTasks",
        ],
      ],
      raw: true,
    });

    const taskCompletionRate =
      taskStats[0]?.totalTasks > 0
        ? (
            (parseFloat(taskStats[0]?.completedTasks || 0) /
              parseFloat(taskStats[0]?.totalTasks)) *
            100
          ).toFixed(2)
        : "0.00";

    // === PROJECTS AT RISK (Behind Schedule) ===
    const projectsAtRisk = await Project.count({
      where: {
        end_date: { [Op.lt]: new Date() },
        status: { [Op.in]: ["planning", "in_progress"] },
      },
    });

    // === RECENT PROGRESS UPDATES ===
    let recentProgressUpdates = [];
    try {
      recentProgressUpdates = await ProgressUpdate.findAll({
        limit: 5,
        order: [["createdAt", "DESC"]],
        attributes: ["id", "description", "progress_percent", "createdAt"],
        include: [
          {
            model: Task,
            as: "task",
            attributes: ["id", "name", "status"],
            include: [
              {
                model: Project,
                as: "project",
                attributes: ["name", "status"],
              },
            ],
          },
        ],
      });
    } catch (error) {
      console.error("Error fetching recent progress updates:", error.message);
      recentProgressUpdates = [];
    }

    // === DOCUMENTS BY TYPE ===
    const documentsPerType = await Document.findAll({
      attributes: [
        "document_type",
        [sequelize.fn("COUNT", sequelize.col("id")), "documentCount"],
      ],
      group: ["document_type"],
      raw: true,
    });

    // === FILL IN MISSING ENUM VALUES ===
    const projectsByStatusComplete = fillEnumCounts(
      projectsByStatus,
      PROJECT_STATUSES,
      "status"
    );
    const projectsByTypeComplete = fillEnumCounts(
      projectsByType,
      CONSTRUCTION_TYPES,
      "construction_type"
    );
    const tasksByStatusComplete = fillEnumCounts(
      tasksByStatus,
      TASK_STATUSES,
      "status"
    );
    const issuesByStatusComplete = fillEnumCounts(
      issuesByStatus,
      ISSUE_STATUSES,
      "status"
    );
    const laborByStatusComplete = fillEnumCounts(
      laborByStatus,
      LABOR_STATUSES,
      "status"
    );
    const laborByTypeComplete = fillEnumCounts(
      laborByType,
      LABOR_TYPES,
      "worker_type"
    );

    // Fill equipment availability
    const equipmentByAvailabilityComplete = EQUIPMENT_AVAILABILITY.map(
      (value) => {
        const found = equipmentByAvailability.find(
          (item) => item.availability === value
        );
        return {
          availability: value,
          count: found ? found.count : "0",
        };
      }
    );

    // === RESPONSE ===
    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalProjects,
          totalTasks,
          totalUsers,
          totalAdmins,
          totalMaterials,
          totalEquipment,
          totalLabor,
          totalIssues,
          totalDocuments,
          activeAdmins,
          overdueTasks,
        },
        projects: {
          byStatus: projectsByStatusComplete,
          byType: projectsByTypeComplete,
          progress: projectProgress[0],
          recent: recentProjects,
          resources: projectResourceSummary,
        },
        tasks: {
          byStatus: tasksByStatusComplete,
          overdue: overdueTasks,
          recent: recentTasks,
        },
        budget: {
          totalBudgeted: parseFloat(totalBudgeted).toFixed(2),
          totalActual: parseFloat(totalActual).toFixed(2),
          variance: parseFloat(budgetVariance).toFixed(2),
          utilizationPercent: budgetUtilization,
          byCategory: budgetByCategory,
          projectBudgets: projectBudgets,
        },
        issues: {
          byStatus: issuesByStatusComplete,
          recent: recentIssues,
        },
        equipment: {
          byAvailability: equipmentByAvailabilityComplete,
        },
        labor: {
          byStatus: laborByStatusComplete,
          byType: laborByTypeComplete,
          summary: {
            totalHours: parseFloat(
              laborCostSummary[0]?.totalHours || 0
            ).toFixed(2),
            totalCost: parseFloat(
              laborCostSummary[0]?.totalLaborCost || 0
            ).toFixed(2),
            avgHourlyRate: parseFloat(
              laborCostSummary[0]?.avgHourlyRate || 0
            ).toFixed(2),
          },
        },
        materials: {
          summary: {
            totalRequired: parseFloat(
              materialUsage[0]?.totalRequired || 0
            ).toFixed(2),
            totalUsed: parseFloat(materialUsage[0]?.totalUsed || 0).toFixed(2),
            utilizationPercent: materialUtilization,
            totalCost: parseFloat(
              materialUsage[0]?.totalMaterialCost || 0
            ).toFixed(2),
            totalSpent: parseFloat(
              materialUsage[0]?.totalMaterialSpent || 0
            ).toFixed(2),
          },
        },
        equipmentSummary: {
          totalDailyRentalCost: parseFloat(
            equipmentCostSummary[0]?.totalDailyRentalCost || 0
          ).toFixed(2),
          availableEquipment: equipmentCostSummary[0]?.totalEquipment || 0,
        },
        performance: {
          taskCompletionRate: taskCompletionRate,
          completedTasks: taskStats[0]?.completedTasks || 0,
          inProgressTasks: taskStats[0]?.inProgressTasks || 0,
          projectsAtRisk: projectsAtRisk,
        },
        recentActivity: {
          progressUpdates: recentProgressUpdates,
        },
        documents: {
          perType: documentsPerType,
        },
        engineers: {
          top: topEngineers,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard statistics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard statistics",
      error: error.message,
    });
  }
};

// Get projects by start date range for bar charts
const getProjectsByDate = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = "day" } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    // Validate groupBy parameter
    const validGroupBy = ["day", "week", "month"];
    if (!validGroupBy.includes(groupBy)) {
      return res.status(400).json({
        success: false,
        message: "groupBy must be one of: day, week, month",
      });
    }

    let dateFormat;
    switch (groupBy) {
      case "day":
        dateFormat = "YYYY-MM-DD";
        break;
      case "week":
        dateFormat = "YYYY-WW"; // Year-Week
        break;
      case "month":
        dateFormat = "YYYY-MM";
        break;
    }

    const results = await sequelize.query(
      `
      SELECT 
        TO_CHAR("start_date", :dateFormat) as date,
        COUNT(*) as count,
        status
      FROM projects 
      WHERE "start_date" >= :startDate::date AND "start_date" <= :endDate::date
      GROUP BY TO_CHAR("start_date", :dateFormat), status
      ORDER BY date ASC, status ASC
    `,
      {
        replacements: {
          dateFormat,
          startDate,
          endDate,
        },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    console.log("Raw query results (filtered by start_date):", results);
    console.log("Date range filter:", { startDate, endDate, dateFormat });

    // Group results by date
    const groupedData = {};
    results.forEach((item) => {
      if (!groupedData[item.date]) {
        groupedData[item.date] = {
          date: item.date,
          total: 0,
          byStatus: {},
        };
      }
      groupedData[item.date].total += parseInt(item.count);
      groupedData[item.date].byStatus[item.status] = parseInt(item.count);
    });

    const chartData = Object.values(groupedData);

    res.json({
      success: true,
      data: {
        chartData,
        summary: {
          totalProjects: chartData.reduce((sum, item) => sum + item.total, 0),
          dateRange: { startDate, endDate },
          groupBy,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching projects by date:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching projects by date",
      error: error.message,
    });
  }
};

// Get tasks by date range for bar charts
const getTasksByDate = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = "day" } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    // Validate groupBy parameter
    const validGroupBy = ["day", "week", "month"];
    if (!validGroupBy.includes(groupBy)) {
      return res.status(400).json({
        success: false,
        message: "groupBy must be one of: day, week, month",
      });
    }

    let dateFormat;
    switch (groupBy) {
      case "day":
        dateFormat = "YYYY-MM-DD";
        break;
      case "week":
        dateFormat = "YYYY-WW"; // Year-Week
        break;
      case "month":
        dateFormat = "YYYY-MM";
        break;
    }

    const results = await sequelize.query(
      `
      SELECT 
        TO_CHAR("createdAt", :dateFormat) as date,
        COUNT(*) as count,
        status
      FROM tasks 
      WHERE "createdAt" >= :startDate::date AND "createdAt" <= :endDate::date
      GROUP BY TO_CHAR("createdAt", :dateFormat), status
      ORDER BY date ASC, status ASC
    `,
      {
        replacements: {
          dateFormat,
          startDate,
          endDate,
        },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    // Group results by date
    const groupedData = {};
    results.forEach((item) => {
      if (!groupedData[item.date]) {
        groupedData[item.date] = {
          date: item.date,
          total: 0,
          byStatus: {},
        };
      }
      groupedData[item.date].total += parseInt(item.count);
      groupedData[item.date].byStatus[item.status] = parseInt(item.count);
    });

    const chartData = Object.values(groupedData);

    res.json({
      success: true,
      data: {
        chartData,
        summary: {
          totalTasks: chartData.reduce((sum, item) => sum + item.total, 0),
          dateRange: { startDate, endDate },
          groupBy,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching tasks by date:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching tasks by date",
      error: error.message,
    });
  }
};

module.exports = {
  getAllAdmins,
  getAdminById,
  createAdmin,
  updateAdmin,
  changePassword,
  deleteAdmin,
  loginAdmin,
  getDashboardStats,
  getProjectsByDate,
  getTasksByDate,
};
