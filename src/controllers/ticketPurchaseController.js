const {
  TicketPurchase,
  TicketType,
  Event,
  PublicUser,
  Payment,
  EventOrganizer,
} = require("../models");
const { sequelize } = require("../models");

// Create ticket purchase (initiate)
const createPurchase = async (req, res) => {
  try {
    const { user_id, event_id, ticket_type_id, quantity } = req.body;

    // Verify user exists
    const user = await PublicUser.findByPk(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify event exists and is active
    const event = await Event.findByPk(event_id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    if (event.status !== "approved" && event.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Event is not available for ticket purchase",
      });
    }

    // Verify ticket type exists and has availability
    const ticketType = await TicketType.findByPk(ticket_type_id);
    if (!ticketType) {
      return res.status(404).json({
        success: false,
        message: "Ticket type not found",
      });
    }

    if (ticketType.event_id !== event_id) {
      return res.status(400).json({
        success: false,
        message: "Ticket type does not belong to this event",
      });
    }

    if (ticketType.remaining_quantity < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${ticketType.remaining_quantity} tickets available`,
      });
    }

    // Calculate total amount
    const total_amount = ticketType.price * quantity;

    // Create purchase record
    const purchase = await TicketPurchase.create({
      user_id,
      event_id,
      ticket_type_id,
      quantity,
      total_amount,
      status: "pending", // Awaiting payment
    });

    // Reserve tickets (reduce remaining_quantity)
    await ticketType.update({
      remaining_quantity: ticketType.remaining_quantity - quantity,
    });

    res.status(201).json({
      success: true,
      message: "Purchase initiated successfully. Proceed to payment.",
      data: {
        purchase_id: purchase.id,
        total_amount,
        quantity,
        ticket_type: ticketType.name,
        event: event.event_name,
      },
    });
  } catch (error) {
    console.error("Error creating purchase:", error);
    res.status(500).json({
      success: false,
      message: "Error creating purchase",
      error: error.message,
    });
  }
};

// Get all purchases
const getAllPurchases = async (req, res) => {
  try {
    const { page, limit, status, user_id, event_id } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }
    if (user_id) {
      whereClause.user_id = user_id;
    }
    if (event_id) {
      whereClause.event_id = event_id;
    }

    const totalCount = await TicketPurchase.count({ where: whereClause });

    const purchases = await TicketPurchase.findAll({
      where: whereClause,
      include: [
        {
          model: PublicUser,
          as: "user",
          attributes: ["full_name", "email", "phone"],
        },
        {
          model: Event,
          as: "event",
          attributes: ["event_name", "venue", "event_date"],
        },
        {
          model: TicketType,
          as: "ticketType",
          attributes: ["name", "price"],
        },
        {
          model: Payment,
          as: "payment",
          attributes: ["pesapal_transaction_id", "status", "createdAt"],
        },
      ],
      limit: limitNum,
      offset: offset,
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: purchases,
      count: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (error) {
    console.error("Error fetching purchases:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching purchases",
      error: error.message,
    });
  }
};

// Get purchase by ID
const getPurchaseById = async (req, res) => {
  try {
    const { id } = req.params;

    const purchase = await TicketPurchase.findByPk(id, {
      include: [
        {
          model: PublicUser,
          as: "user",
          attributes: ["full_name", "email", "phone"],
        },
        {
          model: Event,
          as: "event",
          attributes: [
            "event_name",
            "venue",
            "event_date",
            "start_time",
            "end_time",
          ],
        },
        {
          model: TicketType,
          as: "ticketType",
          attributes: ["name", "price"],
        },
        {
          model: Payment,
          as: "payment",
        },
      ],
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    res.status(200).json({
      success: true,
      data: purchase,
    });
  } catch (error) {
    console.error("Error fetching purchase:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching purchase",
      error: error.message,
    });
  }
};

// Get user's purchases
const getUserPurchases = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { status } = req.query;

    const whereClause = { user_id };
    if (status) {
      whereClause.status = status;
    }

    const purchases = await TicketPurchase.findAll({
      where: whereClause,
      include: [
        {
          model: Event,
          as: "event",
          attributes: [
            "event_name",
            "venue",
            "event_date",
            "start_time",
            "image_url",
          ],
        },
        {
          model: TicketType,
          as: "ticketType",
          attributes: ["name", "price"],
        },
        {
          model: Payment,
          as: "payment",
          attributes: ["status", "createdAt"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: purchases,
      count: purchases.length,
    });
  } catch (error) {
    console.error("Error fetching user purchases:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user purchases",
      error: error.message,
    });
  }
};

// Update purchase status
const updatePurchaseStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const purchase = await TicketPurchase.findByPk(id);
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    await purchase.update({ status });

    res.status(200).json({
      success: true,
      message: "Purchase status updated successfully",
      data: purchase,
    });
  } catch (error) {
    console.error("Error updating purchase status:", error);
    res.status(500).json({
      success: false,
      message: "Error updating purchase status",
      error: error.message,
    });
  }
};

// Cancel purchase
const cancelPurchase = async (req, res) => {
  try {
    const { id } = req.params;

    const purchase = await TicketPurchase.findByPk(id, {
      include: [
        {
          model: TicketType,
          as: "ticketType",
        },
      ],
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    if (purchase.status === "paid") {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel a paid purchase. Request a refund instead.",
      });
    }

    // Restore ticket quantity
    await purchase.ticketType.update({
      remaining_quantity:
        purchase.ticketType.remaining_quantity + purchase.quantity,
    });

    // Update purchase status
    await purchase.update({ status: "cancelled" });

    res.status(200).json({
      success: true,
      message: "Purchase cancelled successfully",
    });
  } catch (error) {
    console.error("Error cancelling purchase:", error);
    res.status(500).json({
      success: false,
      message: "Error cancelling purchase",
      error: error.message,
    });
  }
};

// Generate QR code for purchase
const generateQRCode = async (req, res) => {
  try {
    const { id } = req.params;

    const purchase = await TicketPurchase.findByPk(id);
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    if (purchase.status !== "paid") {
      return res.status(400).json({
        success: false,
        message: "QR code can only be generated for paid purchases",
      });
    }

    // Generate QR code data (you can use a library like qrcode)
    const qrData = `TICKET-${purchase.id}-${purchase.event_id}`;

    // TODO: Implement actual QR code generation
    // For now, just store the data
    await purchase.update({ qr_code: qrData });

    res.status(200).json({
      success: true,
      message: "QR code generated successfully",
      data: {
        qr_code: qrData,
        purchase_id: purchase.id,
      },
    });
  } catch (error) {
    console.error("Error generating QR code:", error);
    res.status(500).json({
      success: false,
      message: "Error generating QR code",
      error: error.message,
    });
  }
};

// Delete purchase (admin only)
const deletePurchase = async (req, res) => {
  try {
    const { id } = req.params;

    const purchase = await TicketPurchase.findByPk(id);
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    await purchase.destroy();

    res.status(200).json({
      success: true,
      message: "Purchase deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting purchase:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting purchase",
      error: error.message,
    });
  }
};

module.exports = {
  createPurchase,
  getAllPurchases,
  getPurchaseById,
  getUserPurchases,
  updatePurchaseStatus,
  cancelPurchase,
  generateQRCode,
  deletePurchase,
};
