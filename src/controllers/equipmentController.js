const { Equipment, Task, Project } = require("../models");

// Get all equipment
const getAllEquipment = async (req, res) => {
  try {
    const { type, availability, task_id, page, limit } = req.query;

    let whereClause = {};
    if (type) {
      whereClause.type = type;
    }
    if (availability !== undefined) {
      whereClause.availability = availability === "true";
    }
    if (task_id) {
      whereClause.assigned_task_id = task_id;
    }

    // Parse pagination parameters
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const totalCount = await Equipment.count({ where: whereClause });

    // Get paginated equipment
    const equipment = await Equipment.findAll({
      where: whereClause,
      include: [
        {
          model: Task,
          as: "assignedTask",
          attributes: ["id", "name", "status", "progress_percent"],
          include: [
            {
              model: Project,
              as: "project",
              attributes: ["id", "name", "status"],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: limitNum,
      offset: offset,
    });

    res.status(200).json({
      success: true,
      data: equipment,
      count: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (error) {
    console.error("Error fetching equipment:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching equipment",
      error: error.message,
    });
  }
};

// Get equipment by ID
const getEquipmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const equipment = await Equipment.findByPk(id, {
      include: [
        {
          model: Task,
          as: "assignedTask",
          attributes: [
            "id",
            "name",
            "status",
            "progress_percent",
            "start_date",
            "due_date",
          ],
          include: [
            {
              model: Project,
              as: "project",
              attributes: ["id", "name", "status"],
            },
          ],
        },
      ],
    });

    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: "Equipment not found",
      });
    }

    res.status(200).json({
      success: true,
      data: equipment,
    });
  } catch (error) {
    console.error("Error fetching equipment:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching equipment",
      error: error.message,
    });
  }
};

// Create new equipment
const createEquipment = async (req, res) => {
  try {
    const { name, type, availability, rental_cost_per_day, assigned_task_id } =
      req.body;

    // Verify task exists if assigned
    if (assigned_task_id) {
      const task = await Task.findByPk(assigned_task_id);
      if (!task) {
        return res.status(400).json({
          success: false,
          message: "Task not found",
        });
      }
    }

    const equipment = await Equipment.create({
      name,
      type,
      availability: availability !== undefined ? availability : true,
      rental_cost_per_day,
      assigned_task_id,
    });

    // Fetch the created equipment with associations
    const createdEquipment = await Equipment.findByPk(equipment.id, {
      include: [
        {
          model: Task,
          as: "assignedTask",
          attributes: ["id", "name", "status"],
          include: [
            {
              model: Project,
              as: "project",
              attributes: ["id", "name", "status"],
            },
          ],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Equipment created successfully",
      data: createdEquipment,
    });
  } catch (error) {
    console.error("Error creating equipment:", error);
    res.status(500).json({
      success: false,
      message: "Error creating equipment",
      error: error.message,
    });
  }
};

// Update equipment
const updateEquipment = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const equipment = await Equipment.findByPk(id);
    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: "Equipment not found",
      });
    }

    // Verify task exists if being assigned
    if (updateData.assigned_task_id) {
      const task = await Task.findByPk(updateData.assigned_task_id);
      if (!task) {
        return res.status(400).json({
          success: false,
          message: "Task not found",
        });
      }
    }

    await equipment.update(updateData);

    // Fetch updated equipment with associations
    const updatedEquipment = await Equipment.findByPk(id, {
      include: [
        {
          model: Task,
          as: "assignedTask",
          attributes: ["id", "name", "status"],
          include: [
            {
              model: Project,
              as: "project",
              attributes: ["id", "name", "status"],
            },
          ],
        },
      ],
    });

    res.status(200).json({
      success: true,
      message: "Equipment updated successfully",
      data: updatedEquipment,
    });
  } catch (error) {
    console.error("Error updating equipment:", error);
    res.status(500).json({
      success: false,
      message: "Error updating equipment",
      error: error.message,
    });
  }
};

// Assign equipment to task
const assignEquipmentToTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { task_id } = req.body;

    const equipment = await Equipment.findByPk(id);
    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: "Equipment not found",
      });
    }

    if (!equipment.availability) {
      return res.status(400).json({
        success: false,
        message: "Equipment is not available",
      });
    }

    // Verify task exists
    const task = await Task.findByPk(task_id);
    if (!task) {
      return res.status(400).json({
        success: false,
        message: "Task not found",
      });
    }

    await equipment.update({
      assigned_task_id: task_id,
      availability: false,
    });

    res.status(200).json({
      success: true,
      message: "Equipment assigned to task successfully",
    });
  } catch (error) {
    console.error("Error assigning equipment:", error);
    res.status(500).json({
      success: false,
      message: "Error assigning equipment",
      error: error.message,
    });
  }
};

// Release equipment from task
const releaseEquipmentFromTask = async (req, res) => {
  try {
    const { id } = req.params;

    const equipment = await Equipment.findByPk(id);
    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: "Equipment not found",
      });
    }

    await equipment.update({
      assigned_task_id: null,
      availability: true,
    });

    res.status(200).json({
      success: true,
      message: "Equipment released from task successfully",
    });
  } catch (error) {
    console.error("Error releasing equipment:", error);
    res.status(500).json({
      success: false,
      message: "Error releasing equipment",
      error: error.message,
    });
  }
};

// Update equipment availability
const updateEquipmentAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { availability } = req.body;

    const equipment = await Equipment.findByPk(id);
    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: "Equipment not found",
      });
    }

    await equipment.update({ availability });

    res.status(200).json({
      success: true,
      message: "Equipment availability updated successfully",
      data: { availability },
    });
  } catch (error) {
    console.error("Error updating equipment availability:", error);
    res.status(500).json({
      success: false,
      message: "Error updating equipment availability",
      error: error.message,
    });
  }
};

// Delete equipment
const deleteEquipment = async (req, res) => {
  try {
    const { id } = req.params;

    const equipment = await Equipment.findByPk(id);
    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: "Equipment not found",
      });
    }

    await equipment.destroy();

    res.status(200).json({
      success: true,
      message: "Equipment deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting equipment:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting equipment",
      error: error.message,
    });
  }
};

// Get equipment by project
const getEquipmentByProject = async (req, res) => {
  try {
    const { project_id } = req.params;

    const equipment = await Equipment.findAll({
      include: [
        {
          model: Task,
          as: "assignedTask",
          where: { project_id: project_id },
          attributes: ["id", "name", "status"],
          include: [
            {
              model: Project,
              as: "project",
              attributes: ["id", "name", "status"],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: equipment,
      count: equipment.length,
    });
  } catch (error) {
    console.error("Error fetching equipment by project:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching equipment by project",
      error: error.message,
    });
  }
};

// Get available equipment
const getAvailableEquipment = async (req, res) => {
  try {
    const { type } = req.query;

    let whereClause = { availability: true };
    if (type) {
      whereClause.type = type;
    }

    const equipment = await Equipment.findAll({
      where: whereClause,
      order: [["name", "ASC"]],
    });

    res.status(200).json({
      success: true,
      data: equipment,
      count: equipment.length,
    });
  } catch (error) {
    console.error("Error fetching available equipment:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching available equipment",
      error: error.message,
    });
  }
};

// Get equipment by type
const getEquipmentByType = async (req, res) => {
  try {
    const { type } = req.params;

    const equipment = await Equipment.findAll({
      where: { type },
      include: [
        {
          model: Task,
          as: "assignedTask",
          attributes: ["id", "name", "status"],
          include: [
            {
              model: Project,
              as: "project",
              attributes: ["id", "name", "status"],
            },
          ],
        },
      ],
      order: [["name", "ASC"]],
    });

    res.status(200).json({
      success: true,
      data: equipment,
      count: equipment.length,
    });
  } catch (error) {
    console.error("Error fetching equipment by type:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching equipment by type",
      error: error.message,
    });
  }
};

module.exports = {
  getAllEquipment,
  getEquipmentById,
  createEquipment,
  updateEquipment,
  assignEquipmentToTask,
  releaseEquipmentFromTask,
  updateEquipmentAvailability,
  deleteEquipment,
  getEquipmentByProject,
  getAvailableEquipment,
  getEquipmentByType,
};
