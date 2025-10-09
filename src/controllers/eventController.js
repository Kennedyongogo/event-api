const {
  Event,
  EventOrganizer,
  TicketType,
  TicketPurchase,
} = require("../models");
const { Op } = require("sequelize");

// Create new event
const createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      venue,
      county,
      sub_county,
      event_date,
      start_time,
      end_time,
      commission_rate,
    } = req.body;

    // Get organizer_id from authenticated user
    const organizer_id = req.user.id;

    // Verify organizer exists and is approved
    const organizer = await EventOrganizer.findByPk(organizer_id);
    if (!organizer) {
      return res.status(404).json({
        success: false,
        message: "Organizer not found",
      });
    }

    if (organizer.status !== "approved" && organizer.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Organizer must be approved to create events",
      });
    }

    // Handle image upload
    const image_url = req.file ? req.file.path : null;

    // Create event with default commission rate (can be changed by admin during approval)
    const event = await Event.create({
      organizer_id,
      event_name: title,
      description,
      category,
      venue,
      county,
      sub_county,
      event_date,
      start_time,
      end_time,
      image_url,
      commission_rate: commission_rate || 10.0, // Default 10% commission
      status: "pending", // Requires admin approval
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
    const { page, limit, status, category, county, organizer_id, search } =
      req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    const whereClause = {};

    // If user is an organizer, only show their events
    if (req.user.type === "organizer") {
      whereClause.organizer_id = req.user.id;
    }

    if (status) {
      whereClause.status = status;
    }
    if (category) {
      whereClause.category = category;
    }
    if (county) {
      whereClause.county = county;
    }
    if (organizer_id && req.user.type === "admin") {
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
          model: EventOrganizer,
          as: "organizer",
          attributes: ["organization_name", "contact_person", "phone_number"],
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
    const { page, limit, category, county, search } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;

    const whereClause = {
      status: { [Op.in]: ["approved", "active"] },
      event_date: { [Op.gte]: new Date() }, // Only future events
    };

    if (category) {
      whereClause.category = category;
    }
    if (county) {
      whereClause.county = county;
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
          model: EventOrganizer,
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

// Get event by ID
const getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findByPk(id, {
      include: [
        {
          model: EventOrganizer,
          as: "organizer",
          attributes: [
            "organization_name",
            "contact_person",
            "phone_number",
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
      description,
      category,
      venue,
      county,
      sub_county,
      event_date,
      start_time,
      end_time,
      image_url,
    } = req.body;

    const event = await Event.findByPk(id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    await event.update({
      event_name: event_name || event.event_name,
      description: description || event.description,
      category: category || event.category,
      venue: venue || event.venue,
      county: county || event.county,
      sub_county: sub_county || event.sub_county,
      event_date: event_date || event.event_date,
      start_time: start_time || event.start_time,
      end_time: end_time || event.end_time,
      image_url: image_url || event.image_url,
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

module.exports = {
  createEvent,
  getAllEvents,
  getPublicEvents,
  getEventById,
  updateEvent,
  approveEvent,
  rejectEvent,
  cancelEvent,
  deleteEvent,
};
