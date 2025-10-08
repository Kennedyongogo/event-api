const { Issue, Project } = require("../models");
const { Op } = require("sequelize");

// Get available issue categories
const getIssueCategories = async (req, res) => {
  try {
    const categories = [
      {
        value: "general_inquiry",
        label: "General Inquiry",
        description: "General questions about services or information",
      },
      {
        value: "project_inquiry",
        label: "Project Inquiry",
        description: "Questions about specific projects",
      },
      {
        value: "technical_support",
        label: "Technical Support",
        description: "Technical issues or problems",
      },
      {
        value: "billing_question",
        label: "Billing Question",
        description: "Questions about payments or billing",
      },
      {
        value: "complaint",
        label: "Complaint",
        description: "Formal complaints or concerns",
      },
      {
        value: "suggestion",
        label: "Suggestion",
        description: "Suggestions for improvement",
      },
      {
        value: "other",
        label: "Other",
        description: "Other types of issues",
      },
    ];

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Error fetching issue categories:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching issue categories",
      error: error.message,
    });
  }
};

// Get all issues
const getAllIssues = async (req, res) => {
  try {
    const { project_id, status, category, email, name, page, limit } =
      req.query;

    let whereClause = {};
    if (project_id) {
      whereClause.project_id = project_id;
    }
    if (status) {
      whereClause.status = status;
    }
    if (category) {
      whereClause.category = category;
    }
    if (email) {
      whereClause.email = email;
    }
    if (name) {
      whereClause.name = { [Op.like]: `%${name}%` };
    }

    // Parse pagination parameters
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const totalCount = await Issue.count({ where: whereClause });

    // Get paginated issues
    const issues = await Issue.findAll({
      where: whereClause,
      include: [
        {
          model: Project,
          as: "project",
          attributes: ["id", "name", "status", "progress_percent"],
          required: false, // Make project association optional
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: limitNum,
      offset: offset,
    });

    res.status(200).json({
      success: true,
      data: issues,
      count: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (error) {
    console.error("Error fetching issues:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching issues",
      error: error.message,
    });
  }
};

// Get issue by ID
const getIssueById = async (req, res) => {
  try {
    const { id } = req.params;
    const issue = await Issue.findByPk(id, {
      include: [
        {
          model: Project,
          as: "project",
          attributes: [
            "id",
            "name",
            "status",
            "progress_percent",
            "start_date",
            "end_date",
          ],
          required: false, // Make project association optional
        },
      ],
    });

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: "Issue not found",
      });
    }

    res.status(200).json({
      success: true,
      data: issue,
    });
  } catch (error) {
    console.error("Error fetching issue:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching issue",
      error: error.message,
    });
  }
};

// Create new issue
const createIssue = async (req, res) => {
  try {
    const { project_id, name, email, description, category, status } = req.body;

    // Verify project exists only if project_id is provided
    if (project_id) {
      const project = await Project.findByPk(project_id);
      if (!project) {
        return res.status(400).json({
          success: false,
          message: "Project not found",
        });
      }
    }

    const issue = await Issue.create({
      project_id: project_id || null,
      name,
      email,
      description,
      category: category || "general_inquiry",
      status: status || "open",
    });

    // Fetch the created issue with associations
    const createdIssue = await Issue.findByPk(issue.id, {
      include: [
        {
          model: Project,
          as: "project",
          attributes: ["id", "name", "status"],
          required: false, // Make project association optional
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Issue created successfully",
      data: createdIssue,
    });
  } catch (error) {
    console.error("Error creating issue:", error);
    res.status(500).json({
      success: false,
      message: "Error creating issue",
      error: error.message,
    });
  }
};

// Update issue
const updateIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const issue = await Issue.findByPk(id);
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: "Issue not found",
      });
    }

    // Verify project exists if being updated
    if (updateData.project_id) {
      const project = await Project.findByPk(updateData.project_id);
      if (!project) {
        return res.status(400).json({
          success: false,
          message: "Project not found",
        });
      }
    }

    await issue.update(updateData);

    // Fetch updated issue with associations
    const updatedIssue = await Issue.findByPk(id, {
      include: [
        {
          model: Project,
          as: "project",
          attributes: ["id", "name", "status"],
        },
      ],
    });

    res.status(200).json({
      success: true,
      message: "Issue updated successfully",
      data: updatedIssue,
    });
  } catch (error) {
    console.error("Error updating issue:", error);
    res.status(500).json({
      success: false,
      message: "Error updating issue",
      error: error.message,
    });
  }
};

// Update issue status
const updateIssueStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["open", "in_review", "resolved"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const issue = await Issue.findByPk(id);
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: "Issue not found",
      });
    }

    await issue.update({ status });

    res.status(200).json({
      success: true,
      message: "Issue status updated successfully",
      data: { status },
    });
  } catch (error) {
    console.error("Error updating issue status:", error);
    res.status(500).json({
      success: false,
      message: "Error updating issue status",
      error: error.message,
    });
  }
};

// Delete issue
const deleteIssue = async (req, res) => {
  try {
    const { id } = req.params;

    const issue = await Issue.findByPk(id);
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: "Issue not found",
      });
    }

    await issue.destroy();

    res.status(200).json({
      success: true,
      message: "Issue deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting issue:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting issue",
      error: error.message,
    });
  }
};

// Get issues by project
const getIssuesByProject = async (req, res) => {
  try {
    const { project_id } = req.params;

    const issues = await Issue.findAll({
      where: { project_id },
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: issues,
      count: issues.length,
    });
  } catch (error) {
    console.error("Error fetching issues by project:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching issues by project",
      error: error.message,
    });
  }
};

// Get issues by status
const getIssuesByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const validStatuses = ["open", "in_review", "resolved"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const issues = await Issue.findAll({
      where: { status },
      include: [
        {
          model: Project,
          as: "project",
          attributes: ["id", "name", "status"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: issues,
      count: issues.length,
    });
  } catch (error) {
    console.error("Error fetching issues by status:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching issues by status",
      error: error.message,
    });
  }
};

// Get issues by email
const getIssuesByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    const issues = await Issue.findAll({
      where: { email },
      include: [
        {
          model: Project,
          as: "project",
          attributes: ["id", "name", "status"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: issues,
      count: issues.length,
    });
  } catch (error) {
    console.error("Error fetching issues by user:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching issues by user",
      error: error.message,
    });
  }
};

// Get issue statistics
const getIssueStatistics = async (req, res) => {
  try {
    const { project_id } = req.params;

    const issues = await Issue.findAll({
      where: project_id ? { project_id } : {},
      attributes: ["status", "createdAt"],
    });

    // Group by status
    const statusStats = issues.reduce((acc, issue) => {
      const status = issue.status;
      if (!acc[status]) {
        acc[status] = 0;
      }
      acc[status]++;
      return acc;
    }, {});

    // Group by month
    const monthlyStats = issues.reduce((acc, issue) => {
      const month = new Date(issue.createdAt).toISOString().substring(0, 7);
      if (!acc[month]) {
        acc[month] = 0;
      }
      acc[month]++;
      return acc;
    }, {});

    const stats = {
      total_issues: issues.length,
      status_breakdown: statusStats,
      monthly_reports: monthlyStats,
      open_issues: statusStats.open || 0,
      resolved_issues: statusStats.resolved || 0,
      resolution_rate:
        issues.length > 0
          ? Math.round(((statusStats.resolved || 0) / issues.length) * 100)
          : 0,
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching issue statistics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching issue statistics",
      error: error.message,
    });
  }
};

module.exports = {
  getIssueCategories,
  getAllIssues,
  getIssueById,
  createIssue,
  updateIssue,
  updateIssueStatus,
  deleteIssue,
  getIssuesByProject,
  getIssuesByStatus,
  getIssuesByEmail,
  getIssueStatistics,
};
