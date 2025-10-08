const { Material, Task, Project } = require("../models");

// Get all materials
const getAllMaterials = async (req, res) => {
  try {
    const { task_id, page, limit } = req.query;

    let whereClause = {};
    if (task_id) {
      whereClause.task_id = task_id;
    }

    // Parse pagination parameters
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const totalCount = await Material.count({ where: whereClause });

    // Get paginated materials
    const materials = await Material.findAll({
      where: whereClause,
      include: [
        {
          model: Task,
          as: "task",
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
      data: materials,
      count: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (error) {
    console.error("Error fetching materials:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching materials",
      error: error.message,
    });
  }
};

// Get material by ID
const getMaterialById = async (req, res) => {
  try {
    const { id } = req.params;
    const material = await Material.findByPk(id, {
      include: [
        {
          model: Task,
          as: "task",
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

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found",
      });
    }

    res.status(200).json({
      success: true,
      data: material,
    });
  } catch (error) {
    console.error("Error fetching material:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching material",
      error: error.message,
    });
  }
};

// Create new material
const createMaterial = async (req, res) => {
  try {
    const { task_id, name, unit, unit_cost, quantity_required, quantity_used } =
      req.body;

    // Verify task exists
    const task = await Task.findByPk(task_id);
    if (!task) {
      return res.status(400).json({
        success: false,
        message: "Task not found",
      });
    }

    const material = await Material.create({
      task_id,
      name,
      unit,
      unit_cost,
      quantity_required,
      quantity_used: quantity_used || 0,
    });

    // Fetch the created material with associations
    const createdMaterial = await Material.findByPk(material.id, {
      include: [
        {
          model: Task,
          as: "task",
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
      message: "Material created successfully",
      data: createdMaterial,
    });
  } catch (error) {
    console.error("Error creating material:", error);
    res.status(500).json({
      success: false,
      message: "Error creating material",
      error: error.message,
    });
  }
};

// Update material
const updateMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const material = await Material.findByPk(id);
    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found",
      });
    }

    // Verify task exists if being updated
    if (updateData.task_id) {
      const task = await Task.findByPk(updateData.task_id);
      if (!task) {
        return res.status(400).json({
          success: false,
          message: "Task not found",
        });
      }
    }

    await material.update(updateData);

    // Fetch updated material with associations
    const updatedMaterial = await Material.findByPk(id, {
      include: [
        {
          model: Task,
          as: "task",
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
      message: "Material updated successfully",
      data: updatedMaterial,
    });
  } catch (error) {
    console.error("Error updating material:", error);
    res.status(500).json({
      success: false,
      message: "Error updating material",
      error: error.message,
    });
  }
};

// Update material usage
const updateMaterialUsage = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity_used } = req.body;

    const material = await Material.findByPk(id);
    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found",
      });
    }

    if (quantity_used < 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity used cannot be negative",
      });
    }

    if (quantity_used > material.quantity_required) {
      return res.status(400).json({
        success: false,
        message: "Quantity used cannot exceed quantity required",
      });
    }

    await material.update({ quantity_used });

    res.status(200).json({
      success: true,
      message: "Material usage updated successfully",
      data: { quantity_used },
    });
  } catch (error) {
    console.error("Error updating material usage:", error);
    res.status(500).json({
      success: false,
      message: "Error updating material usage",
      error: error.message,
    });
  }
};

// Delete material
const deleteMaterial = async (req, res) => {
  try {
    const { id } = req.params;

    const material = await Material.findByPk(id);
    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Material not found",
      });
    }

    await material.destroy();

    res.status(200).json({
      success: true,
      message: "Material deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting material:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting material",
      error: error.message,
    });
  }
};

// Get materials by project
const getMaterialsByProject = async (req, res) => {
  try {
    const { project_id } = req.params;

    const materials = await Material.findAll({
      include: [
        {
          model: Task,
          as: "task",
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
      data: materials,
      count: materials.length,
    });
  } catch (error) {
    console.error("Error fetching materials by project:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching materials by project",
      error: error.message,
    });
  }
};

// Get material usage summary
const getMaterialUsageSummary = async (req, res) => {
  try {
    const { project_id } = req.params;

    const materials = await Material.findAll({
      include: [
        {
          model: Task,
          as: "task",
          where: { project_id: project_id },
          attributes: ["id", "name", "status"],
        },
      ],
      attributes: [
        "id",
        "name",
        "unit",
        "unit_cost",
        "quantity_required",
        "quantity_used",
      ],
    });

    const summary = materials.map((material) => {
      const remaining = material.quantity_required - material.quantity_used;
      const usage_percentage =
        material.quantity_required > 0
          ? Math.round(
              (material.quantity_used / material.quantity_required) * 100
            )
          : 0;
      const total_cost = material.quantity_used * material.unit_cost;

      return {
        id: material.id,
        name: material.name,
        unit: material.unit,
        unit_cost: material.unit_cost,
        quantity_required: material.quantity_required,
        quantity_used: material.quantity_used,
        remaining,
        usage_percentage,
        total_cost,
      };
    });

    const total_cost = summary.reduce((sum, item) => sum + item.total_cost, 0);

    res.status(200).json({
      success: true,
      data: {
        materials: summary,
        total_cost,
        total_materials: materials.length,
      },
    });
  } catch (error) {
    console.error("Error fetching material usage summary:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching material usage summary",
      error: error.message,
    });
  }
};

module.exports = {
  getAllMaterials,
  getMaterialById,
  createMaterial,
  updateMaterial,
  updateMaterialUsage,
  deleteMaterial,
  getMaterialsByProject,
  getMaterialUsageSummary,
};
