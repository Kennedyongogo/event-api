const { Document, Admin } = require("../models");
const { Op } = require("sequelize");
const path = require("path");

// Get all documents
const getAllDocuments = async (req, res) => {
  try {
    const {
      document_type,
      category,
      file_type,
      uploaded_by,
      page,
      limit,
      exclude_types,
    } = req.query;

    let whereClause = {};
    if (document_type) {
      whereClause.document_type = document_type;
    }
    if (category) {
      whereClause.category = category;
    }
    if (file_type) {
      whereClause.file_type = file_type;
    }
    if (uploaded_by) {
      whereClause.uploaded_by_admin_id = uploaded_by;
    }

    // Handle exclude_types parameter
    if (exclude_types) {
      const excludeList = Array.isArray(exclude_types)
        ? exclude_types
        : [exclude_types];
      whereClause.document_type = {
        [Op.notIn]: excludeList,
      };
    }

    // Parse pagination parameters
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const totalCount = await Document.count({ where: whereClause });

    // Get paginated documents
    const documents = await Document.findAll({
      where: whereClause,
      include: [
        {
          model: Admin,
          as: "uploadedBy",
          attributes: ["id", "name", "email", "role"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: limitNum,
      offset: offset,
    });

    res.status(200).json({
      success: true,
      data: documents,
      count: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching documents",
      error: error.message,
    });
  }
};

// Get document by ID
const getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await Document.findByPk(id, {
      include: [
        {
          model: Admin,
          as: "uploadedBy",
          attributes: ["id", "name", "email", "role", "phone"],
        },
      ],
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error("Error fetching document:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching document",
      error: error.message,
    });
  }
};

// Create new document (with file upload)
const createDocument = async (req, res) => {
  try {
    const { document_type, category, description, uploaded_by_admin_id } =
      req.body;

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // Verify admin exists
    const admin = await Admin.findByPk(uploaded_by_admin_id);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Extract file information
    const file_name = req.file.originalname;
    const file_type = path.extname(file_name).toLowerCase();
    const file_url = `/uploads/documents/${req.file.filename}`;

    const document = await Document.create({
      document_type: document_type || "company_document",
      category,
      description,
      file_name,
      file_type,
      file_url,
      uploaded_by_admin_id,
    });

    // Fetch the created document with associations
    const createdDocument = await Document.findByPk(document.id, {
      include: [
        {
          model: Admin,
          as: "uploadedBy",
          attributes: ["id", "name", "email", "role"],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      data: createdDocument,
    });
  } catch (error) {
    console.error("Error creating document:", error);
    res.status(500).json({
      success: false,
      message: "Error creating document",
      error: error.message,
    });
  }
};

// Upload multiple documents
const uploadDocuments = async (req, res) => {
  try {
    const { document_type, category, description, uploaded_by_admin_id } =
      req.body;

    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
    }

    // Verify admin exists
    const admin = await Admin.findByPk(uploaded_by_admin_id);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Process each uploaded file
    const documents = [];
    for (const file of req.files) {
      const file_name = file.originalname;
      const file_type = path.extname(file_name).toLowerCase();
      const file_url = `/uploads/documents/${file.filename}`;

      const document = await Document.create({
        document_type: document_type || "company_document",
        category,
        description,
        file_name,
        file_type,
        file_url,
        uploaded_by_admin_id,
      });

      documents.push(document);
    }

    // Fetch all created documents with associations
    const createdDocuments = await Document.findAll({
      where: { id: documents.map((doc) => doc.id) },
      include: [
        {
          model: Admin,
          as: "uploadedBy",
          attributes: ["id", "name", "email", "role"],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: `${documents.length} documents uploaded successfully`,
      data: createdDocuments,
      count: createdDocuments.length,
    });
  } catch (error) {
    console.error("Error uploading documents:", error);
    res.status(500).json({
      success: false,
      message: "Error uploading documents",
      error: error.message,
    });
  }
};

// Update document
const updateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const document = await Document.findByPk(id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Verify admin exists if being updated
    if (updateData.uploaded_by_admin_id) {
      const admin = await Admin.findByPk(updateData.uploaded_by_admin_id);
      if (!admin) {
        return res.status(400).json({
          success: false,
          message: "Admin not found",
        });
      }
    }

    await document.update(updateData);

    // Fetch updated document with associations
    const updatedDocument = await Document.findByPk(id, {
      include: [
        {
          model: Admin,
          as: "uploadedBy",
          attributes: ["id", "name", "email", "role"],
        },
      ],
    });

    res.status(200).json({
      success: true,
      message: "Document updated successfully",
      data: updatedDocument,
    });
  } catch (error) {
    console.error("Error updating document:", error);
    res.status(500).json({
      success: false,
      message: "Error updating document",
      error: error.message,
    });
  }
};

// Delete document
const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const document = await Document.findByPk(id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    await document.destroy();

    res.status(200).json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting document",
      error: error.message,
    });
  }
};

// Get documents by type
const getDocumentsByType = async (req, res) => {
  try {
    const { document_type } = req.params;

    const documents = await Document.findAll({
      where: { document_type },
      include: [
        {
          model: Admin,
          as: "uploadedBy",
          attributes: ["id", "name", "email", "role"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: documents,
      count: documents.length,
    });
  } catch (error) {
    console.error("Error fetching documents by type:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching documents by type",
      error: error.message,
    });
  }
};

// Get documents by category
const getDocumentsByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    const documents = await Document.findAll({
      where: { category },
      include: [
        {
          model: Admin,
          as: "uploadedBy",
          attributes: ["id", "name", "email", "role"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: documents,
      count: documents.length,
    });
  } catch (error) {
    console.error("Error fetching documents by category:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching documents by category",
      error: error.message,
    });
  }
};

// Get documents by file type
const getDocumentsByFileType = async (req, res) => {
  try {
    const { file_type } = req.params;

    const documents = await Document.findAll({
      where: { file_type },
      include: [
        {
          model: Admin,
          as: "uploadedBy",
          attributes: ["id", "name", "email", "role"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: documents,
      count: documents.length,
    });
  } catch (error) {
    console.error("Error fetching documents by file type:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching documents by file type",
      error: error.message,
    });
  }
};

// Get documents by uploader
const getDocumentsByUploader = async (req, res) => {
  try {
    const { admin_id } = req.params;

    const documents = await Document.findAll({
      where: { uploaded_by_admin_id: admin_id },
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: documents,
      count: documents.length,
    });
  } catch (error) {
    console.error("Error fetching documents by uploader:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching documents by uploader",
      error: error.message,
    });
  }
};

// Get document statistics
const getDocumentStatistics = async (req, res) => {
  try {
    const { document_type, category } = req.query;

    let whereClause = {};
    if (document_type) whereClause.document_type = document_type;
    if (category) whereClause.category = category;

    const documents = await Document.findAll({
      where: whereClause,
      attributes: ["file_type", "document_type", "category", "createdAt"],
    });

    // Group by file type
    const fileTypeStats = documents.reduce((acc, doc) => {
      const type = doc.file_type;
      if (!acc[type]) {
        acc[type] = 0;
      }
      acc[type]++;
      return acc;
    }, {});

    // Group by document type
    const documentTypeStats = documents.reduce((acc, doc) => {
      const type = doc.document_type;
      if (!acc[type]) {
        acc[type] = 0;
      }
      acc[type]++;
      return acc;
    }, {});

    // Group by category
    const categoryStats = documents.reduce((acc, doc) => {
      const category = doc.category || "Uncategorized";
      if (!acc[category]) {
        acc[category] = 0;
      }
      acc[category]++;
      return acc;
    }, {});

    // Group by month
    const monthlyStats = documents.reduce((acc, doc) => {
      const month = new Date(doc.createdAt).toISOString().substring(0, 7);
      if (!acc[month]) {
        acc[month] = 0;
      }
      acc[month]++;
      return acc;
    }, {});

    const stats = {
      total_documents: documents.length,
      file_type_breakdown: fileTypeStats,
      document_type_breakdown: documentTypeStats,
      category_breakdown: categoryStats,
      monthly_uploads: monthlyStats,
      most_common_file_type: Object.keys(fileTypeStats).reduce(
        (a, b) => (fileTypeStats[a] > fileTypeStats[b] ? a : b),
        null
      ),
      most_common_document_type: Object.keys(documentTypeStats).reduce(
        (a, b) => (documentTypeStats[a] > documentTypeStats[b] ? a : b),
        null
      ),
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching document statistics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching document statistics",
      error: error.message,
    });
  }
};

module.exports = {
  getAllDocuments,
  getDocumentById,
  createDocument,
  uploadDocuments,
  updateDocument,
  deleteDocument,
  getDocumentsByType,
  getDocumentsByCategory,
  getDocumentsByFileType,
  getDocumentsByUploader,
  getDocumentStatistics,
};
