const {
  Budget,
  Task,
  Project,
  Material,
  Equipment,
  Labor,
} = require("../models");

// Get all budgets
const getAllBudgets = async (req, res) => {
  try {
    const { task_id, project_id, type, category, page, limit } = req.query;

    let whereClause = {};
    if (task_id) {
      whereClause.task_id = task_id;
    }
    if (project_id) {
      // Find tasks for the project first
      const tasks = await Task.findAll({ where: { project_id } });
      const taskIds = tasks.map((task) => task.id);
      whereClause.task_id = taskIds;
    }
    if (type) {
      whereClause.type = type;
    }
    if (category) {
      whereClause.category = category;
    }

    // Parse pagination parameters
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const totalCount = await Budget.count({ where: whereClause });

    // Get paginated budgets
    const budgets = await Budget.findAll({
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
      order: [["date", "DESC"]],
      limit: limitNum,
      offset: offset,
    });

    res.status(200).json({
      success: true,
      data: budgets,
      count: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (error) {
    console.error("Error fetching budgets:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching budgets",
      error: error.message,
    });
  }
};

// Get budget by ID
const getBudgetById = async (req, res) => {
  try {
    const { id } = req.params;
    const budget = await Budget.findByPk(id, {
      include: [
        {
          model: Task,
          as: "task",
          attributes: ["id", "name", "status", "progress_percent"],
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
          ],
        },
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
    });

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: "Budget not found",
      });
    }

    res.status(200).json({
      success: true,
      data: budget,
    });
  } catch (error) {
    console.error("Error fetching budget:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching budget",
      error: error.message,
    });
  }
};

// Create new budget (smart version with auto-calculation)
const createBudget = async (req, res) => {
  try {
    const {
      task_id,
      category,
      amount,
      type,
      date,
      entry_type = "manual",
      material_id,
      equipment_id,
      labor_id,
      quantity = 1,
    } = req.body;

    // Verify task exists
    const task = await Task.findByPk(task_id);
    if (!task) {
      return res.status(400).json({
        success: false,
        message: "Task not found",
      });
    }

    let calculatedAmount = amount;
    let resourceDetails = {};

    // Auto-calculate based on resource type
    if (entry_type === "resource_based") {
      if (material_id) {
        const material = await Material.findByPk(material_id);
        if (!material) {
          return res.status(400).json({
            success: false,
            message: "Material not found",
          });
        }
        calculatedAmount =
          parseFloat(material.unit_cost) * parseFloat(quantity);
        resourceDetails = {
          resource_type: "material",
          resource_name: material.name,
          unit_cost: material.unit_cost,
          quantity: quantity,
        };
      } else if (equipment_id) {
        const equipment = await Equipment.findByPk(equipment_id);
        if (!equipment) {
          return res.status(400).json({
            success: false,
            message: "Equipment not found",
          });
        }
        calculatedAmount =
          parseFloat(equipment.rental_cost_per_day) * parseFloat(quantity);
        resourceDetails = {
          resource_type: "equipment",
          resource_name: equipment.name,
          daily_rate: equipment.rental_cost_per_day,
          days: quantity,
        };
      } else if (labor_id) {
        const labor = await Labor.findByPk(labor_id);
        if (!labor) {
          return res.status(400).json({
            success: false,
            message: "Labor record not found",
          });
        }
        const hours = parseFloat(labor.hours_worked) || 0;
        const rate = parseFloat(labor.hourly_rate) || 0;
        calculatedAmount = hours * rate * parseFloat(quantity);
        resourceDetails = {
          resource_type: "labor",
          resource_name: labor.worker_name,
          hourly_rate: labor.hourly_rate,
          hours: hours,
          quantity: quantity,
        };
      }
    }

    const budget = await Budget.create({
      task_id,
      category,
      amount: calculatedAmount,
      type,
      date: date || new Date(),
      entry_type,
      material_id,
      equipment_id,
      labor_id,
      calculated_amount: calculatedAmount,
      quantity,
    });

    // Fetch the created budget with associations
    const createdBudget = await Budget.findByPk(budget.id, {
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
        {
          model: Material,
          as: "material",
          attributes: ["id", "name", "unit_cost"],
        },
        {
          model: Equipment,
          as: "equipment",
          attributes: ["id", "name", "rental_cost_per_day"],
        },
        {
          model: Labor,
          as: "labor",
          attributes: ["id", "worker_name", "hourly_rate", "hours_worked"],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Budget created successfully",
      data: {
        ...createdBudget.toJSON(),
        resource_details: resourceDetails,
      },
    });
  } catch (error) {
    console.error("Error creating budget:", error);
    res.status(500).json({
      success: false,
      message: "Error creating budget",
      error: error.message,
    });
  }
};

// Update budget
const updateBudget = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const budget = await Budget.findByPk(id);
    if (!budget) {
      return res.status(404).json({
        success: false,
        message: "Budget not found",
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

    await budget.update(updateData);

    // Fetch updated budget with associations
    const updatedBudget = await Budget.findByPk(id, {
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
    });

    res.status(200).json({
      success: true,
      message: "Budget updated successfully",
      data: updatedBudget,
    });
  } catch (error) {
    console.error("Error updating budget:", error);
    res.status(500).json({
      success: false,
      message: "Error updating budget",
      error: error.message,
    });
  }
};

// Delete budget
const deleteBudget = async (req, res) => {
  try {
    const { id } = req.params;

    const budget = await Budget.findByPk(id);
    if (!budget) {
      return res.status(404).json({
        success: false,
        message: "Budget not found",
      });
    }

    await budget.destroy();

    res.status(200).json({
      success: true,
      message: "Budget deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting budget:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting budget",
      error: error.message,
    });
  }
};

// Get budgets by project
const getBudgetsByProject = async (req, res) => {
  try {
    const { project_id } = req.params;

    const budgets = await Budget.findAll({
      where: { project_id },
      order: [["date", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: budgets,
      count: budgets.length,
    });
  } catch (error) {
    console.error("Error fetching budgets by project:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching budgets by project",
      error: error.message,
    });
  }
};

// Get budget summary by project
const getBudgetSummaryByProject = async (req, res) => {
  try {
    const { project_id } = req.params;

    const budgets = await Budget.findAll({
      where: { project_id },
      attributes: ["category", "amount", "type", "date"],
    });

    // Calculate summary
    const budgetedAmount = budgets
      .filter((budget) => budget.type === "budgeted")
      .reduce((sum, budget) => sum + parseFloat(budget.amount), 0);

    const actualAmount = budgets
      .filter((budget) => budget.type === "actual")
      .reduce((sum, budget) => sum + parseFloat(budget.amount), 0);

    // Group by category
    const categorySummary = budgets.reduce((acc, budget) => {
      const key = budget.category;
      if (!acc[key]) {
        acc[key] = { budgeted: 0, actual: 0 };
      }
      if (budget.type === "budgeted") {
        acc[key].budgeted += parseFloat(budget.amount);
      } else {
        acc[key].actual += parseFloat(budget.amount);
      }
      return acc;
    }, {});

    const summary = {
      project_id,
      total_budgeted: budgetedAmount,
      total_actual: actualAmount,
      variance: actualAmount - budgetedAmount,
      variance_percentage:
        budgetedAmount > 0
          ? Math.round(((actualAmount - budgetedAmount) / budgetedAmount) * 100)
          : 0,
      category_breakdown: categorySummary,
      total_entries: budgets.length,
    };

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error fetching budget summary:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching budget summary",
      error: error.message,
    });
  }
};

// Get budgets by type
const getBudgetsByType = async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ["budgeted", "actual"];

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid budget type",
      });
    }

    const budgets = await Budget.findAll({
      where: { type },
      include: [
        {
          model: Project,
          as: "project",
          attributes: ["id", "name", "status"],
        },
      ],
      order: [["date", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: budgets,
      count: budgets.length,
    });
  } catch (error) {
    console.error("Error fetching budgets by type:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching budgets by type",
      error: error.message,
    });
  }
};

// Get budgets by category
const getBudgetsByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    const budgets = await Budget.findAll({
      where: { category },
      include: [
        {
          model: Project,
          as: "project",
          attributes: ["id", "name", "status"],
        },
      ],
      order: [["date", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: budgets,
      count: budgets.length,
    });
  } catch (error) {
    console.error("Error fetching budgets by category:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching budgets by category",
      error: error.message,
    });
  }
};

// Get available resources for budget creation
const getAvailableResourcesForTask = async (req, res) => {
  try {
    const { task_id } = req.params;

    // Verify task exists
    const task = await Task.findByPk(task_id);
    if (!task) {
      return res.status(400).json({
        success: false,
        message: "Task not found",
      });
    }

    // Get all resources for the task
    const [materials, equipment, labor] = await Promise.all([
      Material.findAll({
        where: { task_id },
        attributes: ["id", "name", "unit", "unit_cost", "quantity_required"],
      }),
      Equipment.findAll({
        where: { assigned_task_id: task_id },
        attributes: [
          "id",
          "name",
          "type",
          "rental_cost_per_day",
          "availability",
        ],
      }),
      Labor.findAll({
        where: { task_id },
        attributes: [
          "id",
          "worker_name",
          "worker_type",
          "hourly_rate",
          "hours_worked",
          "is_requirement",
          "required_quantity",
        ],
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        task_id,
        materials: materials.map((mat) => ({
          id: mat.id,
          name: mat.name,
          unit: mat.unit,
          unit_cost: mat.unit_cost,
          quantity_required: mat.quantity_required,
          estimated_cost:
            parseFloat(mat.unit_cost) * parseFloat(mat.quantity_required || 1),
        })),
        equipment: equipment.map((eq) => ({
          id: eq.id,
          name: eq.name,
          type: eq.type,
          daily_rate: eq.rental_cost_per_day,
          availability: eq.availability,
        })),
        labor: labor.map((worker) => ({
          id: worker.id,
          worker_name: worker.worker_name,
          worker_type: worker.worker_type,
          hourly_rate: worker.hourly_rate,
          hours_worked: worker.hours_worked,
          is_requirement: worker.is_requirement,
          required_quantity: worker.required_quantity,
          estimated_cost: worker.is_requirement
            ? parseFloat(worker.hourly_rate) *
              parseFloat(worker.hours_worked) *
              (worker.required_quantity || 1)
            : parseFloat(worker.hourly_rate) * parseFloat(worker.hours_worked),
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching available resources:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching available resources",
      error: error.message,
    });
  }
};

// Get total budget for a specific task
const getTotalBudgetForTask = async (req, res) => {
  try {
    const { task_id } = req.params;

    // Verify task exists
    const task = await Task.findByPk(task_id);
    if (!task) {
      return res.status(400).json({
        success: false,
        message: "Task not found",
      });
    }

    // Get all budget entries for the task
    const budgets = await Budget.findAll({
      where: { task_id },
      include: [
        {
          model: Material,
          as: "material",
          attributes: ["id", "name", "unit"],
        },
        {
          model: Equipment,
          as: "equipment",
          attributes: ["id", "name", "type"],
        },
        {
          model: Labor,
          as: "labor",
          attributes: ["id", "worker_name", "worker_type"],
        },
      ],
    });

    // Calculate totals by category and type
    const summary = {
      task_id,
      task_name: task.name,
      total_budgeted: 0,
      total_actual: 0,
      total_overall: 0,
      by_category: {},
      by_type: {},
      budget_entries: budgets.map((budget) => ({
        id: budget.id,
        category: budget.category,
        amount: parseFloat(budget.amount),
        type: budget.type,
        entry_type: budget.entry_type,
        date: budget.date,
        resource: budget.material
          ? {
              type: "material",
              name: budget.material.name,
              unit: budget.material.unit,
            }
          : budget.equipment
          ? {
              type: "equipment",
              name: budget.equipment.name,
              type: budget.equipment.type,
            }
          : budget.labor
          ? {
              type: "labor",
              name: budget.labor.worker_name,
              worker_type: budget.labor.worker_type,
            }
          : null,
      })),
    };

    // Calculate totals
    budgets.forEach((budget) => {
      const amount = parseFloat(budget.amount);

      // Overall totals
      summary.total_overall += amount;
      if (budget.type === "budgeted") {
        summary.total_budgeted += amount;
      } else {
        summary.total_actual += amount;
      }

      // By category
      if (!summary.by_category[budget.category]) {
        summary.by_category[budget.category] = {
          budgeted: 0,
          actual: 0,
          total: 0,
        };
      }
      summary.by_category[budget.category].total += amount;
      if (budget.type === "budgeted") {
        summary.by_category[budget.category].budgeted += amount;
      } else {
        summary.by_category[budget.category].actual += amount;
      }

      // By type (budgeted vs actual)
      if (!summary.by_type[budget.type]) {
        summary.by_type[budget.type] = 0;
      }
      summary.by_type[budget.type] += amount;
    });

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error fetching total budget for task:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching total budget for task",
      error: error.message,
    });
  }
};

module.exports = {
  getAllBudgets,
  getBudgetById,
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgetsByProject,
  getBudgetSummaryByProject,
  getBudgetsByType,
  getBudgetsByCategory,
  getAvailableResourcesForTask,
  getTotalBudgetForTask,
};
