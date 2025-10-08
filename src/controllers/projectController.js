const {
  Project,
  Admin,
  Task,
  Material,
  Equipment,
  Labor,
  Budget,
  Issue,
  ProgressUpdate,
} = require("../models");
const { Op } = require("sequelize");
const path = require("path");

// Get all projects
const getAllProjects = async (req, res) => {
  try {
    const { status, engineer_id, page, limit } = req.query;

    let whereClause = {};
    if (status) {
      whereClause.status = status;
    }
    if (engineer_id) {
      whereClause.engineer_in_charge = engineer_id;
    }

    // Parse pagination parameters
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const totalCount = await Project.count({ where: whereClause });

    // Get paginated projects
    const projects = await Project.findAll({
      where: whereClause,
      include: [
        {
          model: Admin,
          as: "engineer",
          attributes: ["id", "name", "email", "role"],
        },
        {
          model: Task,
          as: "tasks",
          attributes: ["id", "name", "status", "progress_percent", "due_date"],
          include: [
            {
              model: Material,
              as: "materials",
              attributes: [
                "id",
                "name",
                "unit",
                "quantity_required",
                "quantity_used",
              ],
            },
            {
              model: Equipment,
              as: "equipment",
              attributes: ["id", "name", "type", "availability"],
            },
            {
              model: Labor,
              as: "labor",
              attributes: [
                "id",
                "worker_name",
                "worker_type",
                "total_cost",
                "status",
              ],
            },
            {
              model: Budget,
              as: "budgets",
              attributes: ["id", "category", "amount", "type", "entry_type"],
            },
          ],
        },
        {
          model: Issue,
          as: "issues",
          attributes: [
            "id",
            "name",
            "email",
            "description",
            "category",
            "status",
            "createdAt",
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: limitNum,
      offset: offset,
    });

    res.status(200).json({
      success: true,
      data: projects,
      count: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching projects",
      error: error.message,
    });
  }
};

// Get project by ID
const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findByPk(id, {
      include: [
        {
          model: Admin,
          as: "engineer",
          attributes: ["id", "name", "email", "role", "phone"],
        },
        {
          model: Task,
          as: "tasks",
          attributes: [
            "id",
            "name",
            "description",
            "status",
            "progress_percent",
            "start_date",
            "due_date",
            "assigned_to_admin",
          ],
          include: [
            {
              model: Admin,
              as: "assignedAdmin",
              attributes: ["id", "name", "email"],
            },
            {
              model: Material,
              as: "materials",
              attributes: [
                "id",
                "name",
                "unit",
                "unit_cost",
                "quantity_required",
                "quantity_used",
              ],
            },
            {
              model: Equipment,
              as: "equipment",
              attributes: [
                "id",
                "name",
                "type",
                "availability",
                "rental_cost_per_day",
              ],
            },
            {
              model: ProgressUpdate,
              as: "progressUpdates",
              attributes: [
                "id",
                "description",
                "progress_percent",
                "date",
                "images",
                "createdAt",
              ],
              order: [["createdAt", "DESC"]],
            },
          ],
        },
        {
          model: Issue,
          as: "issues",
          attributes: [
            "id",
            "name",
            "email",
            "description",
            "category",
            "status",
            "createdAt",
          ],
        },
      ],
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching project",
      error: error.message,
    });
  }
};

// Create new project
const createProject = async (req, res) => {
  try {
    const {
      name,
      description,
      location_name,
      latitude,
      longitude,
      status,
      start_date,
      end_date,
      budget_estimate,
      actual_cost,
      currency,
      contractor_name,
      client_name,
      funding_source,
      engineer_in_charge,
      progress_percent,
      blueprint_url,
      documents,
      notes,
      floor_size,
      construction_type,
    } = req.body;

    // Verify engineer exists
    const engineer = await Admin.findByPk(engineer_in_charge);
    if (!engineer) {
      return res.status(400).json({
        success: false,
        message: "Engineer not found",
      });
    }

    // Handle blueprint file uploads if present
    let finalBlueprintUrls = Array.isArray(blueprint_url)
      ? blueprint_url
      : blueprint_url
      ? [blueprint_url]
      : [];

    // Handle single blueprint file upload
    if (req.file && req.file.fieldname === "blueprint") {
      finalBlueprintUrls.push(`uploads/projects/${req.file.filename}`);
    }

    // Handle multiple blueprint files upload
    if (req.files && req.files.blueprints && req.files.blueprints.length > 0) {
      req.files.blueprints.forEach((file) => {
        finalBlueprintUrls.push(`uploads/projects/${file.filename}`);
      });
    }

    // Handle document file uploads if present
    let finalDocumentUrls = Array.isArray(documents)
      ? documents
      : documents
      ? [documents]
      : [];

    // Handle document files upload
    if (req.files && req.files.documents && req.files.documents.length > 0) {
      req.files.documents.forEach((file) => {
        finalDocumentUrls.push(`uploads/projectdocuments/${file.filename}`);
      });
    }

    const project = await Project.create({
      name,
      description,
      location_name,
      latitude,
      longitude,
      status: status || "planning",
      start_date,
      end_date,
      budget_estimate,
      actual_cost: actual_cost || 0,
      currency: currency || "KES",
      contractor_name,
      client_name,
      funding_source,
      engineer_in_charge,
      progress_percent: progress_percent || 0,
      blueprint_url: finalBlueprintUrls,
      document_urls: finalDocumentUrls,
      notes,
      floor_size,
      construction_type: construction_type || "building",
    });

    // Fetch the created project with associations
    const createdProject = await Project.findByPk(project.id, {
      include: [
        {
          model: Admin,
          as: "engineer",
          attributes: ["id", "name", "email", "role"],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: createdProject,
    });
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({
      success: false,
      message: "Error creating project",
      error: error.message,
    });
  }
};

// Update project
const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    console.log("📦 Update request received:");
    console.log("📦 Body keys:", Object.keys(req.body));
    console.log("📦 Files received:", req.files?.length || 0);
    console.log("📦 blueprint_url in body:", req.body.blueprint_url);

    const project = await Project.findByPk(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Verify engineer exists if being updated
    if (updateData.engineer_in_charge) {
      const engineer = await Admin.findByPk(updateData.engineer_in_charge);
      if (!engineer) {
        return res.status(400).json({
          success: false,
          message: "Engineer not found",
        });
      }
    }

    // Handle blueprint file uploads if present
    let finalBlueprintUrls = [];

    // Handle blueprint_url from form data (existing URLs that should be kept)
    if (updateData.blueprint_url) {
      const existingUrls = Array.isArray(updateData.blueprint_url)
        ? updateData.blueprint_url
        : updateData.blueprint_url
        ? [updateData.blueprint_url]
        : [];
      // Start with URLs sent from frontend (this handles removals properly)
      finalBlueprintUrls = existingUrls.filter(Boolean);
    }

    // Handle new blueprint files from FormData
    if (req.files && req.files.blueprints && req.files.blueprints.length > 0) {
      req.files.blueprints.forEach((file) => {
        finalBlueprintUrls.push(`uploads/projects/${file.filename}`);
      });
    }

    // Handle document file uploads if present
    let finalDocumentUrls = [];

    // Handle document_urls from form data (existing URLs that should be kept)
    if (updateData.document_urls) {
      const existingUrls = Array.isArray(updateData.document_urls)
        ? updateData.document_urls
        : updateData.document_urls
        ? [updateData.document_urls]
        : [];
      // Start with URLs sent from frontend (this handles removals properly)
      finalDocumentUrls = existingUrls.filter(Boolean);
    }

    // Handle new document files from FormData
    if (req.files && req.files.documents && req.files.documents.length > 0) {
      req.files.documents.forEach((file) => {
        finalDocumentUrls.push(`uploads/projectdocuments/${file.filename}`);
      });
    }

    console.log("📸 Current blueprints in DB:", project.blueprint_url);
    console.log("📸 Blueprints from frontend:", updateData.blueprint_url);
    console.log("📸 New uploaded files:", req.files?.length || 0);
    console.log("📸 Final blueprint URLs:", finalBlueprintUrls);
    console.log("📄 Final document URLs:", finalDocumentUrls);

    // Update the blueprint_url and document_urls in updateData
    updateData.blueprint_url = finalBlueprintUrls;
    updateData.document_urls = finalDocumentUrls;

    console.log("Updating project with data:", updateData);
    await project.update(updateData);

    // Fetch updated project with associations
    const updatedProject = await Project.findByPk(id, {
      include: [
        {
          model: Admin,
          as: "engineer",
          attributes: ["id", "name", "email", "role", "phone"],
        },
        {
          model: Task,
          as: "tasks",
          attributes: ["id", "name", "status", "progress_percent", "due_date"],
        },
        {
          model: Issue,
          as: "issues",
          attributes: [
            "id",
            "name",
            "email",
            "description",
            "category",
            "status",
            "createdAt",
          ],
        },
      ],
    });

    res.status(200).json({
      success: true,
      message: "Project updated successfully",
      data: updatedProject,
    });
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({
      success: false,
      message: "Error updating project",
      error: error.message,
    });
  }
};

// Update project progress
const updateProjectProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { progress_percent } = req.body;

    if (progress_percent < 0 || progress_percent > 100) {
      return res.status(400).json({
        success: false,
        message: "Progress percentage must be between 0 and 100",
      });
    }

    const project = await Project.findByPk(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    await project.update({ progress_percent });

    res.status(200).json({
      success: true,
      message: "Project progress updated successfully",
      data: { progress_percent },
    });
  } catch (error) {
    console.error("Error updating project progress:", error);
    res.status(500).json({
      success: false,
      message: "Error updating project progress",
      error: error.message,
    });
  }
};

// Delete project
const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findByPk(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    await project.destroy();

    res.status(200).json({
      success: true,
      message: "Project deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting project",
      error: error.message,
    });
  }
};

// Get project statistics
const getProjectStats = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findByPk(id, {
      include: [
        {
          model: Task,
          as: "tasks",
          attributes: ["id", "status", "progress_percent"],
          include: [
            {
              model: Budget,
              as: "budgets",
              attributes: ["amount", "type"],
            },
          ],
        },
        {
          model: Issue,
          as: "issues",
          attributes: ["id", "status"],
        },
      ],
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Calculate statistics
    const totalTasks = project.tasks.length;
    const completedTasks = project.tasks.filter(
      (task) => task.status === "completed"
    ).length;
    const inProgressTasks = project.tasks.filter(
      (task) => task.status === "in_progress"
    ).length;
    const pendingTasks = project.tasks.filter(
      (task) => task.status === "pending"
    ).length;

    // Calculate budget amounts from all tasks
    const budgetedAmount = project.tasks.reduce((total, task) => {
      return (
        total +
        (task.budgets || []).reduce((taskTotal, budget) => {
          return budget.type === "budgeted"
            ? taskTotal + parseFloat(budget.amount)
            : taskTotal;
        }, 0)
      );
    }, 0);

    const actualAmount = project.tasks.reduce((total, task) => {
      return (
        total +
        (task.budgets || []).reduce((taskTotal, budget) => {
          return budget.type === "actual"
            ? taskTotal + parseFloat(budget.amount)
            : taskTotal;
        }, 0)
      );
    }, 0);

    const openIssues = project.issues.filter(
      (issue) => issue.status === "open"
    ).length;
    const resolvedIssues = project.issues.filter(
      (issue) => issue.status === "resolved"
    ).length;

    const stats = {
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        progress_percent: project.progress_percent,
      },
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        in_progress: inProgressTasks,
        pending: pendingTasks,
        completion_rate:
          totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      },
      budget: {
        estimated: project.budget_estimate,
        budgeted: budgetedAmount,
        actual: actualAmount,
        variance: actualAmount - budgetedAmount,
      },
      issues: {
        total: project.issues.length,
        open: openIssues,
        resolved: resolvedIssues,
      },
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching project stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching project stats",
      error: error.message,
    });
  }
};

// Get projects by status
const getProjectsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const validStatuses = [
      "planning",
      "in_progress",
      "completed",
      "on_hold",
      "cancelled",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const projects = await Project.findAll({
      where: { status },
      include: [
        {
          model: Admin,
          as: "engineer",
          attributes: ["id", "name", "email", "role"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: projects,
      count: projects.length,
    });
  } catch (error) {
    console.error("Error fetching projects by status:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching projects by status",
      error: error.message,
    });
  }
};

// Get all projects (public endpoint - no authentication required)
// Get public project by ID (no authentication required)
const getPublicProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findByPk(id, {
      include: [
        {
          model: Admin,
          as: "engineer",
          attributes: ["id", "name", "email", "role", "phone"],
        },
        {
          model: Task,
          as: "tasks",
          attributes: [
            "id",
            "name",
            "description",
            "status",
            "progress_percent",
            "start_date",
            "due_date",
            "assigned_to_admin",
          ],
          include: [
            {
              model: Admin,
              as: "assignedAdmin",
              attributes: ["id", "name", "email"],
            },
            {
              model: Material,
              as: "materials",
              attributes: [
                "id",
                "name",
                "unit",
                "unit_cost",
                "quantity_required",
                "quantity_used",
              ],
            },
            {
              model: Equipment,
              as: "equipment",
              attributes: [
                "id",
                "name",
                "type",
                "availability",
                "rental_cost_per_day",
              ],
            },
            {
              model: ProgressUpdate,
              as: "progressUpdates",
              attributes: [
                "id",
                "description",
                "progress_percent",
                "date",
                "images",
                "createdAt",
              ],
              order: [["createdAt", "DESC"]],
            },
          ],
        },
        {
          model: Issue,
          as: "issues",
          attributes: [
            "id",
            "name",
            "email",
            "description",
            "category",
            "status",
            "createdAt",
          ],
        },
      ],
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error("Error fetching public project:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching project",
      error: error.message,
    });
  }
};

const getPublicProjects = async (req, res) => {
  try {
    const { status, page, limit } = req.query;

    let whereClause = {};
    if (status) {
      whereClause.status = status;
    }

    // Parse pagination parameters
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const totalCount = await Project.count({ where: whereClause });

    // Get paginated projects with limited data for public access
    const projects = await Project.findAll({
      where: whereClause,
      include: [
        {
          model: Admin,
          as: "engineer",
          attributes: ["id", "name", "email", "role"],
        },
        {
          model: Task,
          as: "tasks",
          attributes: ["id", "name", "status", "progress_percent", "due_date"],
          include: [
            {
              model: Material,
              as: "materials",
              attributes: [
                "id",
                "name",
                "unit",
                "quantity_required",
                "quantity_used",
              ],
            },
            {
              model: Equipment,
              as: "equipment",
              attributes: ["id", "name", "type", "availability"],
            },
            {
              model: Labor,
              as: "labor",
              attributes: [
                "id",
                "worker_name",
                "worker_type",
                "total_cost",
                "status",
              ],
            },
            {
              model: Budget,
              as: "budgets",
              attributes: ["id", "category", "amount", "type", "entry_type"],
            },
            {
              model: ProgressUpdate,
              as: "progressUpdates",
              attributes: [
                "id",
                "description",
                "progress_percent",
                "date",
                "images",
                "createdAt",
              ],
              order: [["createdAt", "DESC"]],
            },
          ],
        },
        {
          model: Issue,
          as: "issues",
          attributes: [
            "id",
            "name",
            "email",
            "description",
            "category",
            "status",
            "createdAt",
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: limitNum,
      offset: offset,
    });

    res.status(200).json({
      success: true,
      data: projects,
      count: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (error) {
    console.error("Error fetching public projects:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching projects",
      error: error.message,
    });
  }
};

// Search public projects with filtering
const searchPublicProjects = async (req, res) => {
  try {
    const { search, limit = 10000 } = req.query;

    let whereClause = {
      status: ["planning", "in_progress", "completed"],
    };

    if (search && search.trim()) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search.trim()}%` } },
        { description: { [Op.like]: `%${search.trim()}%` } },
        { location: { [Op.like]: `%${search.trim()}%` } },
      ];
    }

    const projects = await Project.findAll({
      where: whereClause,
      attributes: [
        "id",
        "name",
        "description",
        "location",
        "status",
        "progress_percent",
        "start_date",
        "end_date",
        "image_url",
        "createdAt",
        "updatedAt",
      ],
      limit: parseInt(limit),
      order: [["name", "ASC"]],
    });

    res.status(200).json({
      success: true,
      data: projects,
      count: projects.length,
    });
  } catch (error) {
    console.error("Error searching public projects:", error);
    res.status(500).json({
      success: false,
      message: "Error searching projects",
      error: error.message,
    });
  }
};

module.exports = {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  updateProjectProgress,
  deleteProject,
  getProjectStats,
  getProjectsByStatus,
  getPublicProjects,
  getPublicProjectById,
  searchPublicProjects,
};
