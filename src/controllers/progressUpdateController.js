const { ProgressUpdate, Task, Project } = require("../models");

// Get all progress updates
const getAllProgressUpdates = async (req, res) => {
  try {
    const { task_id, project_id, page, limit } = req.query;

    let whereClause = {};
    if (task_id) {
      whereClause.task_id = task_id;
    }

    // Parse pagination parameters
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const totalCount = await ProgressUpdate.count({ where: whereClause });

    // Get paginated progress updates
    const progressUpdates = await ProgressUpdate.findAll({
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
    console.error("Error fetching progress updates:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching progress updates",
      error: error.message,
    });
  }
};

// Get progress update by ID
const getProgressUpdateById = async (req, res) => {
  try {
    const { id } = req.params;

    const progressUpdate = await ProgressUpdate.findByPk(id, {
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

    if (!progressUpdate) {
      return res.status(404).json({
        success: false,
        message: "Progress update not found",
      });
    }

    res.status(200).json({
      success: true,
      data: progressUpdate,
    });
  } catch (error) {
    console.error("Error fetching progress update:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching progress update",
      error: error.message,
    });
  }
};

// Create new progress update
const createProgressUpdate = async (req, res) => {
  try {
    console.log("🚀 Creating progress update...");
    console.log("📋 Request body:", req.body);
    console.log("📁 Files received:", req.files?.length || 0);
    console.log(
      "📁 Files details:",
      req.files?.map((f) => ({
        name: f.filename,
        fieldname: f.fieldname,
        mimetype: f.mimetype,
      })) || []
    );

    const { task_id, description, progress_percent, images, date } = req.body;

    // Verify task exists
    console.log("🔍 Looking for task with ID:", task_id);
    const task = await Task.findByPk(task_id);
    if (!task) {
      console.log("❌ Task not found with ID:", task_id);
      return res.status(400).json({
        success: false,
        message: "Task not found",
      });
    }
    console.log("✅ Task found:", task.name);

    // Validate progress percentage
    console.log("📊 Progress percentage:", progress_percent);
    if (progress_percent < 0 || progress_percent > 100) {
      console.log("❌ Invalid progress percentage:", progress_percent);
      return res.status(400).json({
        success: false,
        message: "Progress percentage must be between 0 and 100",
      });
    }

    // Handle image uploads if files are provided
    let imageUrls = [];
    console.log("🖼️ Processing images...");
    if (req.files && req.files.length > 0) {
      console.log("📁 Files found, processing...");
      imageUrls = req.files.map(
        (file) => `/uploads/progress-updates/${file.filename}`
      );
      console.log("✅ Image URLs generated:", imageUrls);
    } else if (images && Array.isArray(images)) {
      console.log("📋 Images from body:", images);
      imageUrls = images;
    } else {
      console.log("ℹ️ No images provided");
    }

    console.log("💾 Creating progress update with data:", {
      task_id,
      description,
      progress_percent,
      images: imageUrls,
      date: date || new Date(),
    });

    const progressUpdate = await ProgressUpdate.create({
      task_id,
      description,
      progress_percent,
      images: imageUrls,
      date: date || new Date(),
    });

    console.log("✅ Progress update created with ID:", progressUpdate.id);

    // Update task progress if this is the latest update
    if (progress_percent > task.progress_percent) {
      console.log(
        "📈 Updating task progress from",
        task.progress_percent,
        "to",
        progress_percent
      );
      await task.update({ progress_percent });
    }

    // Fetch the created progress update with associations
    const createdProgressUpdate = await ProgressUpdate.findByPk(
      progressUpdate.id,
      {
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
      }
    );

    console.log("🎉 Progress update creation completed successfully!");

    res.status(201).json({
      success: true,
      message: "Progress update created successfully",
      data: createdProgressUpdate,
    });
  } catch (error) {
    console.error("❌ Error creating progress update:", error);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Error creating progress update",
      error: error.message,
    });
  }
};

// Update progress update
const updateProgressUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const progressUpdate = await ProgressUpdate.findByPk(id);
    if (!progressUpdate) {
      return res.status(404).json({
        success: false,
        message: "Progress update not found",
      });
    }

    // Validate progress percentage if being updated
    if (updateData.progress_percent !== undefined) {
      if (
        updateData.progress_percent < 0 ||
        updateData.progress_percent > 100
      ) {
        return res.status(400).json({
          success: false,
          message: "Progress percentage must be between 0 and 100",
        });
      }
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

    // Handle image uploads if files are provided
    if (req.files && req.files.length > 0) {
      const imageUrls = req.files.map(
        (file) => `/uploads/progress-updates/${file.filename}`
      );
      updateData.images = imageUrls;
    }

    await progressUpdate.update(updateData);

    // Update task progress if this is the latest update
    if (updateData.progress_percent !== undefined) {
      const task = await Task.findByPk(progressUpdate.task_id);
      if (task && updateData.progress_percent > task.progress_percent) {
        await task.update({ progress_percent: updateData.progress_percent });
      }
    }

    // Fetch updated progress update with associations
    const updatedProgressUpdate = await ProgressUpdate.findByPk(id, {
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
      message: "Progress update updated successfully",
      data: updatedProgressUpdate,
    });
  } catch (error) {
    console.error("Error updating progress update:", error);
    res.status(500).json({
      success: false,
      message: "Error updating progress update",
      error: error.message,
    });
  }
};

// Delete progress update
const deleteProgressUpdate = async (req, res) => {
  try {
    const { id } = req.params;

    const progressUpdate = await ProgressUpdate.findByPk(id);
    if (!progressUpdate) {
      return res.status(404).json({
        success: false,
        message: "Progress update not found",
      });
    }

    await progressUpdate.destroy();

    res.status(200).json({
      success: true,
      message: "Progress update deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting progress update:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting progress update",
      error: error.message,
    });
  }
};

// Get progress updates by task
const getProgressUpdatesByTask = async (req, res) => {
  try {
    const { task_id } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    const progressUpdates = await ProgressUpdate.findAndCountAll({
      where: { task_id },
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
      order: [["date", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.status(200).json({
      success: true,
      data: progressUpdates.rows,
      count: progressUpdates.count,
      total_pages: Math.ceil(progressUpdates.count / limit),
    });
  } catch (error) {
    console.error("Error fetching progress updates by task:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching progress updates by task",
      error: error.message,
    });
  }
};

// Get latest progress updates
const getLatestProgressUpdates = async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const progressUpdates = await ProgressUpdate.findAll({
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
      order: [["date", "DESC"]],
      limit: parseInt(limit),
    });

    res.status(200).json({
      success: true,
      data: progressUpdates,
      count: progressUpdates.length,
    });
  } catch (error) {
    console.error("Error fetching latest progress updates:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching latest progress updates",
      error: error.message,
    });
  }
};

// Get progress timeline for task
const getProgressTimeline = async (req, res) => {
  try {
    const { task_id } = req.params;

    const progressUpdates = await ProgressUpdate.findAll({
      where: { task_id },
      attributes: ["id", "description", "progress_percent", "images", "date"],
      order: [["date", "ASC"]],
    });

    // Create timeline with progress milestones
    const timeline = progressUpdates.map((update, index) => {
      const previousUpdate = index > 0 ? progressUpdates[index - 1] : null;
      const progressChange = previousUpdate
        ? update.progress_percent - previousUpdate.progress_percent
        : update.progress_percent;

      return {
        id: update.id,
        date: update.date,
        description: update.description,
        progress_percent: update.progress_percent,
        progress_change: progressChange,
        images: update.images,
        is_milestone: progressChange >= 10 || update.progress_percent === 100,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        task_id,
        timeline,
        total_updates: timeline.length,
        milestones: timeline.filter((item) => item.is_milestone),
      },
    });
  } catch (error) {
    console.error("Error fetching progress timeline:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching progress timeline",
      error: error.message,
    });
  }
};

// Upload progress update images
const uploadProgressUpdateImages = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No images provided",
      });
    }

    // Find the existing progress update
    const progressUpdate = await ProgressUpdate.findByPk(id);
    if (!progressUpdate) {
      return res.status(404).json({
        success: false,
        message: "Progress update not found",
      });
    }

    // Generate image URLs
    const newImageUrls = req.files.map(
      (file) => `/uploads/progress-updates/${file.filename}`
    );

    // Get existing images and add new ones
    const existingImages = progressUpdate.images || [];
    const updatedImages = [...existingImages, ...newImageUrls];

    // Update the progress update with new images
    await progressUpdate.update({
      images: updatedImages,
    });

    res.status(200).json({
      success: true,
      message: `${newImageUrls.length} image(s) added to progress update successfully`,
      data: {
        progressUpdateId: id,
        newImages: newImageUrls,
        totalImages: updatedImages.length,
        allImages: updatedImages,
      },
    });
  } catch (error) {
    console.error("Error uploading progress update images:", error);
    res.status(500).json({
      success: false,
      message: "Error uploading images",
      error: error.message,
    });
  }
};

module.exports = {
  getAllProgressUpdates,
  getProgressUpdateById,
  createProgressUpdate,
  updateProgressUpdate,
  deleteProgressUpdate,
  getProgressUpdatesByTask,
  getLatestProgressUpdates,
  getProgressTimeline,
  uploadProgressUpdateImages,
};
