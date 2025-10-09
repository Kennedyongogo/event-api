const { TicketType, Event, TicketPurchase } = require("../models");

// Create ticket type
const createTicketType = async (req, res) => {
  try {
    const { event_id, name, price, total_quantity } = req.body;

    // Verify event exists
    const event = await Event.findByPk(event_id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Create ticket type
    const ticketType = await TicketType.create({
      event_id,
      name,
      price,
      total_quantity,
      remaining_quantity: total_quantity, // Initially, all tickets are available
    });

    res.status(201).json({
      success: true,
      message: "Ticket type created successfully",
      data: ticketType,
    });
  } catch (error) {
    console.error("Error creating ticket type:", error);
    res.status(500).json({
      success: false,
      message: "Error creating ticket type",
      error: error.message,
    });
  }
};

// Get all ticket types
const getAllTicketTypes = async (req, res) => {
  try {
    const { page, limit, event_id } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    const whereClause = {};
    if (event_id) {
      whereClause.event_id = event_id;
    }

    const totalCount = await TicketType.count({ where: whereClause });

    const ticketTypes = await TicketType.findAll({
      where: whereClause,
      include: [
        {
          model: Event,
          as: "event",
          attributes: ["event_name", "venue", "event_date", "status"],
        },
      ],
      limit: limitNum,
      offset: offset,
      order: [["price", "ASC"]],
    });

    res.status(200).json({
      success: true,
      data: ticketTypes,
      count: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (error) {
    console.error("Error fetching ticket types:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching ticket types",
      error: error.message,
    });
  }
};

// Get ticket type by ID
const getTicketTypeById = async (req, res) => {
  try {
    const { id } = req.params;

    const ticketType = await TicketType.findByPk(id, {
      include: [
        {
          model: Event,
          as: "event",
          attributes: [
            "event_name",
            "venue",
            "event_date",
            "status",
            "start_time",
            "end_time",
          ],
        },
        {
          model: TicketPurchase,
          as: "purchases",
          attributes: ["id", "quantity", "status", "createdAt"],
        },
      ],
    });

    if (!ticketType) {
      return res.status(404).json({
        success: false,
        message: "Ticket type not found",
      });
    }

    // Calculate sold tickets
    const soldTickets =
      ticketType.total_quantity - ticketType.remaining_quantity;

    res.status(200).json({
      success: true,
      data: {
        ...ticketType.toJSON(),
        soldTickets,
      },
    });
  } catch (error) {
    console.error("Error fetching ticket type:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching ticket type",
      error: error.message,
    });
  }
};

// Get ticket types by event ID
const getTicketTypesByEvent = async (req, res) => {
  try {
    const { event_id } = req.params;

    const event = await Event.findByPk(event_id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    const ticketTypes = await TicketType.findAll({
      where: { event_id },
      order: [["price", "ASC"]],
    });

    res.status(200).json({
      success: true,
      data: ticketTypes,
    });
  } catch (error) {
    console.error("Error fetching ticket types by event:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching ticket types by event",
      error: error.message,
    });
  }
};

// Update ticket type
const updateTicketType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, total_quantity } = req.body;

    const ticketType = await TicketType.findByPk(id);
    if (!ticketType) {
      return res.status(404).json({
        success: false,
        message: "Ticket type not found",
      });
    }

    // Calculate sold tickets
    const soldTickets =
      ticketType.total_quantity - ticketType.remaining_quantity;

    // If updating total_quantity, adjust remaining_quantity
    let newRemainingQuantity = ticketType.remaining_quantity;
    if (total_quantity !== undefined) {
      if (total_quantity < soldTickets) {
        return res.status(400).json({
          success: false,
          message: `Cannot set total quantity below ${soldTickets} (already sold tickets)`,
        });
      }
      newRemainingQuantity = total_quantity - soldTickets;
    }

    await ticketType.update({
      name: name || ticketType.name,
      price: price !== undefined ? price : ticketType.price,
      total_quantity: total_quantity || ticketType.total_quantity,
      remaining_quantity: newRemainingQuantity,
    });

    res.status(200).json({
      success: true,
      message: "Ticket type updated successfully",
      data: ticketType,
    });
  } catch (error) {
    console.error("Error updating ticket type:", error);
    res.status(500).json({
      success: false,
      message: "Error updating ticket type",
      error: error.message,
    });
  }
};

// Delete ticket type
const deleteTicketType = async (req, res) => {
  try {
    const { id } = req.params;

    const ticketType = await TicketType.findByPk(id);
    if (!ticketType) {
      return res.status(404).json({
        success: false,
        message: "Ticket type not found",
      });
    }

    // Check if any tickets have been sold
    const soldTickets =
      ticketType.total_quantity - ticketType.remaining_quantity;
    if (soldTickets > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete ticket type with sold tickets",
      });
    }

    await ticketType.destroy();

    res.status(200).json({
      success: true,
      message: "Ticket type deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting ticket type:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting ticket type",
      error: error.message,
    });
  }
};

// Check ticket availability
const checkAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.query;

    const ticketType = await TicketType.findByPk(id);
    if (!ticketType) {
      return res.status(404).json({
        success: false,
        message: "Ticket type not found",
      });
    }

    const requestedQuantity = parseInt(quantity) || 1;
    const isAvailable = ticketType.remaining_quantity >= requestedQuantity;

    res.status(200).json({
      success: true,
      data: {
        available: isAvailable,
        remaining_quantity: ticketType.remaining_quantity,
        requested_quantity: requestedQuantity,
        price: ticketType.price,
        total_cost: (ticketType.price * requestedQuantity).toFixed(2),
      },
    });
  } catch (error) {
    console.error("Error checking availability:", error);
    res.status(500).json({
      success: false,
      message: "Error checking availability",
      error: error.message,
    });
  }
};

module.exports = {
  createTicketType,
  getAllTicketTypes,
  getTicketTypeById,
  getTicketTypesByEvent,
  updateTicketType,
  deleteTicketType,
  checkAvailability,
};
