const { Labor, Task, Project } = require("../models");

// Get all labor
const getAllLabor = async (req, res) => {
  try {
    const { task_id, worker_type, status, page, limit } = req.query;

    let whereClause = {};
    if (task_id) {
      whereClause.task_id = task_id;
    }
    if (worker_type) {
      whereClause.worker_type = worker_type;
    }
    if (status) {
      whereClause.status = status;
    }

    // Parse pagination parameters
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const totalCount = await Labor.count({ where: whereClause });

    // Get paginated labor
    const labor = await Labor.findAll({
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
      data: labor,
      count: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (error) {
    console.error("Error fetching labor:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching labor",
      error: error.message,
    });
  }
};

// Get labor by ID
const getLaborById = async (req, res) => {
  try {
    const { id } = req.params;
    const labor = await Labor.findByPk(id, {
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
    });

    if (!labor) {
      return res.status(404).json({
        success: false,
        message: "Labor record not found",
      });
    }

    res.status(200).json({
      success: true,
      data: labor,
    });
  } catch (error) {
    console.error("Error fetching labor:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching labor",
      error: error.message,
    });
  }
};

// Create new labor
const createLabor = async (req, res) => {
  try {
    const {
      task_id,
      worker_name,
      worker_type,
      hourly_rate,
      hours_worked,
      start_date,
      end_date,
      status,
      phone,
      skills,
    } = req.body;

    // Verify task exists
    const task = await Task.findByPk(task_id);
    if (!task) {
      return res.status(400).json({
        success: false,
        message: "Task not found",
      });
    }

    // Calculate total cost
    const total_cost = parseFloat(hourly_rate) * parseFloat(hours_worked || 0);

    const labor = await Labor.create({
      task_id,
      worker_name,
      worker_type,
      hourly_rate,
      hours_worked: hours_worked || 0,
      total_cost,
      start_date,
      end_date,
      status: status || "active",
      phone,
      skills: skills || [],
    });

    // Fetch the created labor with associations
    const createdLabor = await Labor.findByPk(labor.id, {
      include: [
        {
          model: Task,
          as: "task",
          attributes: ["id", "name", "status"],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Labor record created successfully",
      data: createdLabor,
    });
  } catch (error) {
    console.error("Error creating labor:", error);
    res.status(500).json({
      success: false,
      message: "Error creating labor",
      error: error.message,
    });
  }
};

// Update labor
const updateLabor = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const labor = await Labor.findByPk(id);
    if (!labor) {
      return res.status(404).json({
        success: false,
        message: "Labor record not found",
      });
    }

    // Recalculate total cost if hourly_rate or hours_worked changed
    if (updateData.hourly_rate || updateData.hours_worked) {
      const hourly_rate = updateData.hourly_rate || labor.hourly_rate;
      const hours_worked = updateData.hours_worked || labor.hours_worked;
      updateData.total_cost =
        parseFloat(hourly_rate) * parseFloat(hours_worked);
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

    await labor.update(updateData);

    // Fetch updated labor with associations
    const updatedLabor = await Labor.findByPk(id, {
      include: [
        {
          model: Task,
          as: "task",
          attributes: ["id", "name", "status"],
        },
      ],
    });

    res.status(200).json({
      success: true,
      message: "Labor record updated successfully",
      data: updatedLabor,
    });
  } catch (error) {
    console.error("Error updating labor:", error);
    res.status(500).json({
      success: false,
      message: "Error updating labor",
      error: error.message,
    });
  }
};

// Delete labor
const deleteLabor = async (req, res) => {
  try {
    const { id } = req.params;

    const labor = await Labor.findByPk(id);
    if (!labor) {
      return res.status(404).json({
        success: false,
        message: "Labor record not found",
      });
    }

    await labor.destroy();

    res.status(200).json({
      success: true,
      message: "Labor record deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting labor:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting labor",
      error: error.message,
    });
  }
};

// Get labor by task
const getLaborByTask = async (req, res) => {
  try {
    const { task_id } = req.params;

    const labor = await Labor.findAll({
      where: { task_id },
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: labor,
      count: labor.length,
    });
  } catch (error) {
    console.error("Error fetching labor by task:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching labor by task",
      error: error.message,
    });
  }
};

// Get labor by worker type
const getLaborByWorkerType = async (req, res) => {
  try {
    const { worker_type } = req.params;

    const labor = await Labor.findAll({
      where: { worker_type },
      include: [
        {
          model: Task,
          as: "task",
          attributes: ["id", "name", "status"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: labor,
      count: labor.length,
    });
  } catch (error) {
    console.error("Error fetching labor by worker type:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching labor by worker type",
      error: error.message,
    });
  }
};

// Get labor cost summary by task
const getLaborCostSummaryByTask = async (req, res) => {
  try {
    const { task_id } = req.params;

    const labor = await Labor.findAll({
      where: { task_id },
      attributes: ["worker_type", "total_cost", "hours_worked", "status"],
    });

    // Calculate summary
    const totalCost = labor.reduce(
      (sum, worker) => sum + parseFloat(worker.total_cost),
      0
    );
    const totalHours = labor.reduce(
      (sum, worker) => sum + parseFloat(worker.hours_worked),
      0
    );

    // Group by worker type
    const typeSummary = labor.reduce((acc, worker) => {
      const type = worker.worker_type;
      if (!acc[type]) {
        acc[type] = { count: 0, total_cost: 0, total_hours: 0 };
      }
      acc[type].count++;
      acc[type].total_cost += parseFloat(worker.total_cost);
      acc[type].total_hours += parseFloat(worker.hours_worked);
      return acc;
    }, {});

    const summary = {
      task_id,
      total_workers: labor.length,
      total_cost: totalCost,
      total_hours: totalHours,
      average_hourly_rate: totalHours > 0 ? totalCost / totalHours : 0,
      type_breakdown: typeSummary,
    };

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error fetching labor cost summary:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching labor cost summary",
      error: error.message,
    });
  }
};

// Calculate total task cost (Materials + Equipment + Labor + Budget)
const getTotalTaskCost = async (req, res) => {
  try {
    const { task_id } = req.params;
    const { Material, Equipment, Budget } = require("../models");

    // Get all costs for the task
    const [materials, equipment, labor, budgets] = await Promise.all([
      Material.findAll({
        where: { task_id },
        attributes: ["quantity_used", "unit_cost"],
      }),
      Equipment.findAll({
        where: { assigned_task_id: task_id },
        attributes: ["rental_cost_per_day", "days_used"],
      }),
      Labor.findAll({
        where: { task_id },
        attributes: [
          "total_cost",
          "is_requirement",
          "required_quantity",
          "hourly_rate",
          "hours_worked",
        ],
      }),
      Budget.findAll({
        where: { task_id },
        attributes: ["amount", "type", "category"],
      }),
    ]);

    // Calculate material costs
    const materialCost = materials.reduce((sum, mat) => {
      const quantity = parseFloat(mat.quantity_used) || 0;
      const unitCost = parseFloat(mat.unit_cost) || 0;
      return sum + quantity * unitCost;
    }, 0);

    // Calculate equipment costs
    const equipmentCost = equipment.reduce((sum, eq) => {
      const dailyRate = parseFloat(eq.rental_cost_per_day) || 0;
      const days = parseFloat(eq.days_used) || 0;
      return sum + dailyRate * days;
    }, 0);

    // Calculate actual labor costs
    const actualLaborCost = labor
      .filter((worker) => !worker.is_requirement)
      .reduce((sum, worker) => sum + parseFloat(worker.total_cost), 0);

    // Calculate required labor costs (budgeted)
    const requiredLaborCost = labor
      .filter((worker) => worker.is_requirement)
      .reduce((sum, req) => {
        const quantity = req.required_quantity || 1;
        const hours = parseFloat(req.hours_worked) || 0;
        const rate = parseFloat(req.hourly_rate) || 0;
        return sum + quantity * hours * rate;
      }, 0);

    // Calculate budget costs
    const budgetedCost = budgets
      .filter((b) => b.type === "budgeted")
      .reduce((sum, b) => sum + parseFloat(b.amount), 0);

    const actualBudgetCost = budgets
      .filter((b) => b.type === "actual")
      .reduce((sum, b) => sum + parseFloat(b.amount), 0);

    const totalCost = {
      task_id,
      materials: {
        cost: materialCost,
        count: materials.length,
      },
      equipment: {
        cost: equipmentCost,
        count: equipment.length,
      },
      labor: {
        actual_cost: actualLaborCost,
        required_cost: requiredLaborCost,
        actual_workers: labor.filter((w) => !w.is_requirement).length,
        required_workers: labor
          .filter((w) => w.is_requirement)
          .reduce((sum, req) => sum + (req.required_quantity || 1), 0),
      },
      budget: {
        budgeted: budgetedCost,
        actual: actualBudgetCost,
        variance: actualBudgetCost - budgetedCost,
      },
      total: {
        estimated:
          materialCost + equipmentCost + requiredLaborCost + budgetedCost,
        actual:
          materialCost + equipmentCost + actualLaborCost + actualBudgetCost,
        variance:
          materialCost +
          equipmentCost +
          actualLaborCost +
          actualBudgetCost -
          (materialCost + equipmentCost + requiredLaborCost + budgetedCost),
      },
    };

    res.status(200).json({
      success: true,
      data: totalCost,
    });
  } catch (error) {
    console.error("Error calculating total task cost:", error);
    res.status(500).json({
      success: false,
      message: "Error calculating total task cost",
      error: error.message,
    });
  }
};

module.exports = {
  getAllLabor,
  getLaborById,
  createLabor,
  updateLabor,
  deleteLabor,
  getLaborByTask,
  getLaborByWorkerType,
  getLaborCostSummaryByTask,
  getTotalTaskCost,
};
