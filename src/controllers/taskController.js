const {
  Task,
  Project,
  Admin,
  Material,
  Equipment,
  Labor,
  Budget,
  ProgressUpdate,
} = require("../models");

// Get all tasks
const getAllTasks = async (req, res) => {
  try {
    const { project_id, status, assigned_to, page, limit } = req.query;

    let whereClause = {};
    if (project_id) {
      whereClause.project_id = project_id;
    }
    if (status) {
      whereClause.status = status;
    }
    if (assigned_to) {
      whereClause.assigned_to_admin = assigned_to;
    }

    // Parse pagination parameters
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const totalCount = await Task.count({ where: whereClause });

    // Get paginated tasks
    const tasks = await Task.findAll({
      where: whereClause,
      include: [
        {
          model: Project,
          as: "project",
          attributes: ["id", "name", "status", "progress_percent"],
        },
        {
          model: Admin,
          as: "assignedAdmin",
          attributes: ["id", "name", "email", "role"],
        },
      ],
      order: [["due_date", "ASC"]],
      limit: limitNum,
      offset: offset,
    });

    res.status(200).json({
      success: true,
      data: tasks,
      count: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching tasks",
      error: error.message,
    });
  }
};

// Get task by ID
const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findByPk(id, {
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
        },
        {
          model: Admin,
          as: "assignedAdmin",
          attributes: ["id", "name", "email", "role", "phone"],
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
          model: Labor,
          as: "labor",
          attributes: [
            "id",
            "worker_name",
            "worker_type",
            "hourly_rate",
            "hours_worked",
            "total_cost",
            "start_date",
            "end_date",
            "status",
            "phone",
            "skills",
            "is_requirement",
            "required_quantity",
          ],
        },
        {
          model: Budget,
          as: "budgets",
          attributes: [
            "id",
            "category",
            "amount",
            "type",
            "date",
            "entry_type",
            "calculated_amount",
            "quantity",
          ],
          include: [
            {
              model: Material,
              as: "material",
              attributes: ["id", "name", "unit", "unit_cost"],
            },
            {
              model: Equipment,
              as: "equipment",
              attributes: ["id", "name", "type", "rental_cost_per_day"],
            },
            {
              model: Labor,
              as: "labor",
              attributes: ["id", "worker_name", "worker_type", "hourly_rate"],
            },
          ],
        },
      ],
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    res.status(200).json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error("Error fetching task:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching task",
      error: error.message,
    });
  }
};

// Create new task
const createTask = async (req, res) => {
  try {
    const {
      project_id,
      name,
      description,
      start_date,
      due_date,
      assigned_to_admin,
    } = req.body;

    // Verify project exists
    const project = await Project.findByPk(project_id);
    if (!project) {
      return res.status(400).json({
        success: false,
        message: "Project not found",
      });
    }

    // Verify admin exists
    const admin = await Admin.findByPk(assigned_to_admin);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: "Admin not found",
      });
    }

    const task = await Task.create({
      project_id,
      name,
      description,
      start_date,
      due_date,
      assigned_to_admin,
    });

    // Fetch the created task with associations
    const createdTask = await Task.findByPk(task.id, {
      include: [
        {
          model: Project,
          as: "project",
          attributes: ["id", "name", "status"],
        },
        {
          model: Admin,
          as: "assignedAdmin",
          attributes: ["id", "name", "email", "role"],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: createdTask,
    });
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({
      success: false,
      message: "Error creating task",
      error: error.message,
    });
  }
};

// Update task
const updateTask = async (req, res) => {
  try {
    console.log("🚀 Updating task...");
    const { id } = req.params;
    const updateData = req.body;
    console.log("📋 Task ID:", id);
    console.log("📋 Update data:", updateData);

    const task = await Task.findByPk(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Check if status is changing from pending
    const statusChangingFromPending =
      updateData.status &&
      task.status === "pending" &&
      updateData.status !== "pending";

    // Check if status is changing from in_progress to completed
    const statusChangingFromInProgress =
      updateData.status &&
      task.status === "in_progress" &&
      updateData.status === "completed";

    // Check if progress is changing from 0
    const progressChangingFromZero =
      updateData.progress_percent !== undefined &&
      task.progress_percent === 0 &&
      updateData.progress_percent > 0;

    // If any condition is true, require progress update
    console.log("🔍 Checking progress update requirements:");
    console.log("📊 Status changing from pending:", statusChangingFromPending);
    console.log(
      "📊 Status changing from in_progress:",
      statusChangingFromInProgress
    );
    console.log("📊 Progress changing from zero:", progressChangingFromZero);

    if (
      statusChangingFromPending ||
      statusChangingFromInProgress ||
      progressChangingFromZero
    ) {
      console.log("⚠️ Progress update required!");
      console.log("📋 Has progress_update:", !!updateData.progress_update);
      console.log(
        "📋 progress_update_already_created:",
        updateData.progress_update_already_created
      );

      if (
        !updateData.progress_update &&
        !updateData.progress_update_already_created
      ) {
        console.log("❌ Missing required progress update data");
        return res.status(400).json({
          success: false,
          message:
            "Progress update is required when changing task status or progress",
          required_fields: ["description", "progress_percent", "date"],
          current_status: task.status,
          new_status: updateData.status,
          current_progress: task.progress_percent,
          new_progress: updateData.progress_percent,
        });
      }
      console.log("✅ Progress update validation passed");

      // Validate progress update data
      if (updateData.progress_update) {
        if (
          !updateData.progress_update.description ||
          updateData.progress_update.progress_percent === undefined ||
          !updateData.progress_update.date
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Progress update must include description, progress_percent, and date",
            missing_fields: {
              description: !updateData.progress_update.description,
              progress_percent:
                updateData.progress_update.progress_percent === undefined,
              date: !updateData.progress_update.date,
            },
          });
        }

        // Validate progress percentage
        if (
          updateData.progress_update.progress_percent < 0 ||
          updateData.progress_update.progress_percent > 100
        ) {
          return res.status(400).json({
            success: false,
            message: "Progress percentage must be between 0 and 100",
          });
        }
      }
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

    // Verify admin exists if being updated
    if (updateData.assigned_to_admin) {
      const admin = await Admin.findByPk(updateData.assigned_to_admin);
      if (!admin) {
        return res.status(400).json({
          success: false,
          message: "Admin not found",
        });
      }
    }

    // Update the task
    await task.update(updateData);

    // If progress update was provided, create it (only if it doesn't already exist)
    if (
      updateData.progress_update &&
      !updateData.progress_update_already_created
    ) {
      const progressUpdateData = {
        task_id: id,
        description: updateData.progress_update.description,
        progress_percent: updateData.progress_update.progress_percent,
        date: updateData.progress_update.date,
        images: updateData.progress_update.images || [],
      };

      await ProgressUpdate.create(progressUpdateData);
    }

    // Fetch updated task with associations
    const updatedTask = await Task.findByPk(id, {
      include: [
        {
          model: Project,
          as: "project",
          attributes: ["id", "name", "status"],
        },
        {
          model: Admin,
          as: "assignedAdmin",
          attributes: ["id", "name", "email", "role"],
        },
      ],
    });

    console.log("🎉 Task update completed successfully!");

    res.status(200).json({
      success: true,
      message: "Task updated successfully",
      data: updatedTask,
    });
  } catch (error) {
    console.error("❌ Error updating task:", error);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Error updating task",
      error: error.message,
    });
  }
};

// Update task status
const updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      progress_percent,
      progress_update,
      progress_update_already_created,
    } = req.body;

    const validStatuses = ["pending", "in_progress", "completed"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    if (
      progress_percent !== undefined &&
      (progress_percent < 0 || progress_percent > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "Progress percentage must be between 0 and 100",
      });
    }

    const task = await Task.findByPk(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Check if status is changing from pending
    const statusChangingFromPending =
      status && task.status === "pending" && status !== "pending";

    // Check if status is changing from in_progress to completed
    const statusChangingFromInProgress =
      status && task.status === "in_progress" && status === "completed";

    // Check if progress is changing from 0
    const progressChangingFromZero =
      progress_percent !== undefined &&
      task.progress_percent === 0 &&
      progress_percent > 0;

    // If any condition is true, require progress update
    if (
      statusChangingFromPending ||
      statusChangingFromInProgress ||
      progressChangingFromZero
    ) {
      if (!progress_update && !progress_update_already_created) {
        return res.status(400).json({
          success: false,
          message:
            "Progress update is required when changing task status or progress",
          required_fields: ["description", "progress_percent", "date"],
          current_status: task.status,
          new_status: status,
          current_progress: task.progress_percent,
          new_progress: progress_percent,
        });
      }

      // Validate progress update data
      if (
        !progress_update.description ||
        progress_update.progress_percent === undefined ||
        !progress_update.date
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Progress update must include description, progress_percent, and date",
          missing_fields: {
            description: !progress_update.description,
            progress_percent: progress_update.progress_percent === undefined,
            date: !progress_update.date,
          },
        });
      }

      // Validate progress percentage in progress update
      if (
        progress_update.progress_percent < 0 ||
        progress_update.progress_percent > 100
      ) {
        return res.status(400).json({
          success: false,
          message: "Progress update percentage must be between 0 and 100",
        });
      }
    }

    // Update the task
    await task.update({ status, progress_percent });

    // If progress update was provided, create it (only if it doesn't already exist)
    if (progress_update && !progress_update_already_created) {
      const progressUpdateData = {
        task_id: id,
        description: progress_update.description,
        progress_percent: progress_update.progress_percent,
        date: progress_update.date,
        images: progress_update.images || [],
      };

      await ProgressUpdate.create(progressUpdateData);
    }

    res.status(200).json({
      success: true,
      message: "Task status updated successfully",
      data: { status, progress_percent },
    });
  } catch (error) {
    console.error("Error updating task status:", error);
    res.status(500).json({
      success: false,
      message: "Error updating task status",
      error: error.message,
    });
  }
};

// Delete task
const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await Task.findByPk(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // First delete all associated records
    await ProgressUpdate.destroy({
      where: { task_id: id },
    });

    await Material.destroy({
      where: { task_id: id },
    });

    await Equipment.destroy({
      where: { assigned_task_id: id },
    });

    await Labor.destroy({
      where: { task_id: id },
    });

    await Budget.destroy({
      where: { task_id: id },
    });

    // Then delete the task
    await task.destroy();

    res.status(200).json({
      success: true,
      message: "Task and all associated records deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting task",
      error: error.message,
    });
  }
};

// Get tasks by project
const getTasksByProject = async (req, res) => {
  try {
    const { project_id } = req.params;

    const tasks = await Task.findAll({
      where: { project_id },
      include: [
        {
          model: Admin,
          as: "assignedAdmin",
          attributes: ["id", "name", "email", "role"],
        },
      ],
      order: [["due_date", "ASC"]],
    });

    res.status(200).json({
      success: true,
      data: tasks,
      count: tasks.length,
    });
  } catch (error) {
    console.error("Error fetching tasks by project:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching tasks by project",
      error: error.message,
    });
  }
};

// Get overdue tasks
const getOverdueTasks = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tasks = await Task.findAll({
      where: {
        due_date: {
          [require("sequelize").Op.lt]: today,
        },
        status: {
          [require("sequelize").Op.ne]: "completed",
        },
      },
      include: [
        {
          model: Project,
          as: "project",
          attributes: ["id", "name", "status"],
        },
        {
          model: Admin,
          as: "assignedAdmin",
          attributes: ["id", "name", "email", "role"],
        },
      ],
      order: [["due_date", "ASC"]],
    });

    res.status(200).json({
      success: true,
      data: tasks,
      count: tasks.length,
    });
  } catch (error) {
    console.error("Error fetching overdue tasks:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching overdue tasks",
      error: error.message,
    });
  }
};

// Get progress updates for a specific task
const getTaskProgressUpdates = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Verify task exists
    const task = await Task.findByPk(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Parse pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const totalCount = await ProgressUpdate.count({ where: { task_id: id } });

    // Get paginated progress updates
    const progressUpdates = await ProgressUpdate.findAll({
      where: { task_id: id },
      order: [["date", "DESC"]],
      limit: limitNum,
      offset: offset,
    });

    res.status(200).json({
      success: true,
      data: progressUpdates,
      count: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (error) {
    console.error("Error fetching task progress updates:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching task progress updates",
      error: error.message,
    });
  }
};

module.exports = {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  getTasksByProject,
  getOverdueTasks,
  getTaskProgressUpdates,
};
