const {
  Event,
  User,
  TicketType,
  TicketPurchase,
} = require("../models");
const { Op } = require("sequelize");
const { parseLineup } = require("../utils/lineup");
const { convertToRelativePath } = require("../utils/filePath");
const {
  EVENT_CATEGORIES,
  isValidEventCategory,
} = require("../constants/eventCategories");
const {
  parseTicketPrices,
  parseVenueCoordinates,
  parseTicketsAvailable,
  validateTicketTierQuantities,
} = require("../utils/ticketPricing");

// Create new event
const createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      venue,
      venue_latitude,
      venue_longitude,
      latitude,
      longitude,
      event_date,
      start_time,
      end_time,
      commission_rate,
      lineup,
      tickets_available,
      ticket_prices,
    } = req.body;

    // Get organizer_id from authenticated user
    const organizer_id = req.userId || req.user.id;

    const organizer = await User.findByPk(organizer_id);
    if (!organizer || organizer.role !== "event_organizer") {
      return res.status(404).json({
        success: false,
        message: "Organizer not found",
      });
    }

    if (
      organizer.organizer_status !== "approved" &&
      organizer.organizer_status !== "active"
    ) {
      return res.status(403).json({
        success: false,
        message: "Organizer must be approved to create events",
      });
    }

    if (category && !isValidEventCategory(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event category",
        validCategories: EVENT_CATEGORIES,
      });
    }

    const coords = parseVenueCoordinates(
      venue_latitude ?? latitude,
      venue_longitude ?? longitude
    );
    if (coords.error) {
      return res.status(400).json({ success: false, message: coords.error });
    }

    const ticketsParsed = parseTicketsAvailable(tickets_available);
    if (ticketsParsed?.error) {
      return res.status(400).json({
        success: false,
        message: ticketsParsed.error,
      });
    }

    const parsedTicketPrices = parseTicketPrices(ticket_prices);
    const tierQtyCheck = validateTicketTierQuantities(
      ticketsParsed?.tickets_available ?? 0,
      parsedTicketPrices
    );
    if (tierQtyCheck?.error) {
      return res.status(400).json({
        success: false,
        message: tierQtyCheck.error,
      });
    }

    // Handle image upload - convert absolute path to relative path
    const image_url = convertToRelativePath(req.file?.path);

    // Create event with default commission rate (can be changed by admin during approval)
    const event = await Event.create({
      organizer_id,
      event_name: title,
      description,
      category: category || null,
      venue,
      venue_latitude: coords.venue_latitude,
      venue_longitude: coords.venue_longitude,
      event_date,
      start_time,
      end_time,
      image_url,
      commission_rate: commission_rate || 10.0,
      lineup: parseLineup(lineup),
      tickets_available: ticketsParsed?.tickets_available ?? 0,
      ticket_prices: parsedTicketPrices,
      status: "pending",
    });

    res.status(201).json({
      success: true,
      message: "Event created successfully. Awaiting admin approval.",
      data: event,
    });
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({
      success: false,
      message: "Error creating event",
      error: error.message,
    });
  }
};

// Get all events (with filters)
const getAllEvents = async (req, res) => {
  try {
    const { page, limit, status, category, organizer_id, search } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    const whereClause = {};

    // If user is an organizer, only show their events
    if (req.userType === "organizer") {
      whereClause.organizer_id = req.userId || req.user.id;
    }

    if (status) {
      whereClause.status = status;
    }
    if (category) {
      whereClause.category = category;
    }
    if (organizer_id && req.userType === "admin") {
      // Only admins can filter by organizer_id
      whereClause.organizer_id = organizer_id;
    }
    if (search) {
      whereClause[Op.or] = [
        { event_name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { venue: { [Op.like]: `%${search}%` } },
      ];
    }

    const totalCount = await Event.count({ where: whereClause });

    const events = await Event.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "organizer",
          attributes: ["organization_name", "full_name", "phone"],
        },
        {
          model: TicketType,
          as: "ticketTypes",
          attributes: ["id", "name", "price", "remaining_quantity"],
        },
      ],
      limit: limitNum,
      offset: offset,
      order: [["event_date", "ASC"]],
    });

    res.status(200).json({
      success: true,
      data: events,
      count: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching events",
      error: error.message,
    });
  }
};

// Get public events (only approved/active)
const getPublicEvents = async (req, res) => {
  try {
    const { page, limit, category, search } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    const whereClause = {
      status: { [Op.in]: ["approved", "active"] },
      // event_date: { [Op.gte]: new Date() }, // Temporarily disabled for testing
    };

    if (category) {
      whereClause.category = category;
    }
    if (search) {
      whereClause[Op.or] = [
        { event_name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { venue: { [Op.like]: `%${search}%` } },
      ];
    }

    const totalCount = await Event.count({ where: whereClause });

    const events = await Event.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "organizer",
          attributes: ["organization_name"],
        },
        {
          model: TicketType,
          as: "ticketTypes",
          attributes: ["id", "name", "price", "remaining_quantity"],
        },
      ],
      limit: limitNum,
      offset: offset,
      order: [["event_date", "ASC"]],
    });

    res.status(200).json({
      success: true,
      data: events,
      count: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (error) {
    console.error("Error fetching public events:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching public events",
      error: error.message,
    });
  }
};

// Get public event by ID (no purchases data)
const getPublicEventById = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findByPk(id, {
      include: [
        {
          model: User,
          as: "organizer",
          attributes: [
            "organization_name",
            "full_name",
            "phone",
            "email",
          ],
        },
        {
          model: TicketType,
          as: "ticketTypes",
          attributes: [
            "id",
            "name",
            "price",
            "total_quantity",
            "remaining_quantity",
          ],
        },
        // No purchases included for public access
      ],
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Only show approved/active events to public
    if (!["approved", "active"].includes(event.status)) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error("Error fetching public event:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching event",
      error: error.message,
    });
  }
};

// Get event by ID (with purchases for admin/organizer)
const getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findByPk(id, {
      include: [
        {
          model: User,
          as: "organizer",
          attributes: [
            "organization_name",
            "full_name",
            "phone",
            "email",
          ],
        },
        {
          model: TicketType,
          as: "ticketTypes",
          attributes: [
            "id",
            "name",
            "price",
            "total_quantity",
            "remaining_quantity",
          ],
        },
        {
          model: TicketPurchase,
          as: "purchases",
          attributes: ["id", "quantity", "status", "createdAt"],
        },
      ],
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error("Error fetching event:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching event",
      error: error.message,
    });
  }
};

// Update event
const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      event_name,
      title,
      description,
      category,
      venue,
      venue_latitude,
      venue_longitude,
      latitude,
      longitude,
      event_date,
      start_time,
      end_time,
      image_url,
      lineup,
      tickets_available,
      ticket_prices,
    } = req.body;

    const event = await Event.findByPk(id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    if (category !== undefined && category !== "" && !isValidEventCategory(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event category",
        validCategories: EVENT_CATEGORIES,
      });
    }

    const hasCoords =
      venue_latitude !== undefined ||
      venue_longitude !== undefined ||
      latitude !== undefined ||
      longitude !== undefined;

    let coordsUpdate = {};
    if (hasCoords) {
      const coords = parseVenueCoordinates(
        venue_latitude ?? latitude ?? event.venue_latitude,
        venue_longitude ?? longitude ?? event.venue_longitude
      );
      if (coords.error) {
        return res.status(400).json({ success: false, message: coords.error });
      }
      coordsUpdate = {
        venue_latitude: coords.venue_latitude,
        venue_longitude: coords.venue_longitude,
      };
    }

    let ticketsUpdate = {};
    if (tickets_available !== undefined) {
      const ticketsParsed = parseTicketsAvailable(tickets_available);
      if (ticketsParsed?.error) {
        return res.status(400).json({
          success: false,
          message: ticketsParsed.error,
        });
      }
      ticketsUpdate.tickets_available = ticketsParsed.tickets_available;
    }

    const nextTicketsAvailable =
      ticketsUpdate.tickets_available ?? event.tickets_available ?? 0;
    const nextTicketPrices =
      ticket_prices !== undefined
        ? parseTicketPrices(ticket_prices)
        : event.ticket_prices || [];

    if (ticket_prices !== undefined || tickets_available !== undefined) {
      const tierQtyCheck = validateTicketTierQuantities(
        nextTicketsAvailable,
        nextTicketPrices
      );
      if (tierQtyCheck?.error) {
        return res.status(400).json({
          success: false,
          message: tierQtyCheck.error,
        });
      }
    }

    // Handle new image upload if provided
    const newImageUrl = convertToRelativePath(req.file?.path);

    await event.update({
      event_name: event_name || title || event.event_name,
      description: description !== undefined ? description : event.description,
      category: category !== undefined ? category || null : event.category,
      venue: venue || event.venue,
      ...coordsUpdate,
      event_date: event_date || event.event_date,
      start_time: start_time !== undefined ? start_time : event.start_time,
      end_time: end_time !== undefined ? end_time : event.end_time,
      image_url: newImageUrl || image_url || event.image_url,
      ...(lineup !== undefined ? { lineup: parseLineup(lineup) } : {}),
      ...ticketsUpdate,
      ...(ticket_prices !== undefined
        ? { ticket_prices: nextTicketPrices }
        : {}),
    });

    res.status(200).json({
      success: true,
      message: "Event updated successfully",
      data: event,
    });
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({
      success: false,
      message: "Error updating event",
      error: error.message,
    });
  }
};

// Approve event (admin only)
const approveEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { commission_rate } = req.body;

    const event = await Event.findByPk(id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Admin can set/update commission rate during approval
    await event.update({
      status: "approved",
      commission_rate:
        commission_rate !== undefined ? commission_rate : event.commission_rate,
    });

    res.status(200).json({
      success: true,
      message: "Event approved successfully",
      data: event,
    });
  } catch (error) {
    console.error("Error approving event:", error);
    res.status(500).json({
      success: false,
      message: "Error approving event",
      error: error.message,
    });
  }
};

// Reject event (admin only)
const rejectEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const event = await Event.findByPk(id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    await event.update({ status: "rejected" });

    res.status(200).json({
      success: true,
      message: "Event rejected",
      data: event,
    });
  } catch (error) {
    console.error("Error rejecting event:", error);
    res.status(500).json({
      success: false,
      message: "Error rejecting event",
      error: error.message,
    });
  }
};

// Cancel event
const cancelEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findByPk(id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    await event.update({ status: "cancelled" });

    res.status(200).json({
      success: true,
      message: "Event cancelled successfully",
      data: event,
    });
  } catch (error) {
    console.error("Error cancelling event:", error);
    res.status(500).json({
      success: false,
      message: "Error cancelling event",
      error: error.message,
    });
  }
};

// Delete event
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findByPk(id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    await event.destroy();

    res.status(200).json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting event",
      error: error.message,
    });
  }
};

// List valid event categories (public)
const getEventCategories = async (req, res) => {
  res.status(200).json({
    success: true,
    data: EVENT_CATEGORIES,
  });
};

module.exports = {
  createEvent,
  getAllEvents,
  getPublicEvents,
  getPublicEventById,
  getEventById,
  updateEvent,
  approveEvent,
  rejectEvent,
  cancelEvent,
  deleteEvent,
  getEventCategories,
};
