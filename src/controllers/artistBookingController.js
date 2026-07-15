const { Op } = require("sequelize");
const { User, ArtistSchedule, ArtistBooking } = require("../models");
const {
  BUSY_BOOKING_STATUSES,
  formatDateOnly,
  validateTimeRange,
  buildDayAvailability,
  isSlotAvailable,
} = require("../utils/artistAvailability");

const startOfDay = (value) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (value) => {
  const d = new Date(value);
  d.setHours(23, 59, 59, 999);
  return d;
};

const findPublicArtist = async (artistId) => {
  return User.findOne({
    where: { id: artistId, role: "artist", isActive: true },
    attributes: ["id", "full_name", "stage_name"],
  });
};

const loadDayBusySources = async (artistId, dateOnly, opts = {}) => {
  const dayStart = startOfDay(dateOnly);
  const dayEnd = endOfDay(dateOnly);

  const [scheduleItems, bookingItems] = await Promise.all([
    ArtistSchedule.findAll({
      where: {
        artist_id: artistId,
        activity_date: { [Op.between]: [dayStart, dayEnd] },
      },
      attributes: ["id", "title", "start_time", "end_time", "activity_date"],
      order: [["start_time", "ASC"]],
    }),
    ArtistBooking.findAll({
      where: {
        artist_id: artistId,
        booking_date: dateOnly,
        status: { [Op.in]: BUSY_BOOKING_STATUSES },
        ...(opts.excludeBookingId
          ? { id: { [Op.ne]: opts.excludeBookingId } }
          : {}),
      },
      attributes: [
        "id",
        "status",
        "start_time",
        "end_time",
        "booking_date",
        "requester_name",
      ],
      order: [["start_time", "ASC"]],
    }),
  ]);

  return { scheduleItems, bookingItems };
};

/**
 * GET /api/artists/public/:id/availability?date=YYYY-MM-DD
 * Optional: start_time & end_time to check a specific slot.
 */
const getPublicAvailability = async (req, res) => {
  try {
    const artist = await findPublicArtist(req.params.id);
    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Artist not found",
      });
    }

    const dateOnly = formatDateOnly(req.query.date);
    if (!dateOnly) {
      return res.status(400).json({
        success: false,
        message: "Query parameter date is required (YYYY-MM-DD)",
      });
    }

    const { scheduleItems, bookingItems } = await loadDayBusySources(
      artist.id,
      dateOnly
    );
    const availability = buildDayAvailability(scheduleItems, bookingItems);

    let slot_check = null;
    if (req.query.start_time || req.query.end_time) {
      slot_check = isSlotAvailable(
        scheduleItems,
        bookingItems,
        req.query.start_time,
        req.query.end_time
      );
    }

    res.status(200).json({
      success: true,
      data: {
        artist_id: artist.id,
        date: dateOnly,
        ...availability,
        ...(slot_check ? { slot_check } : {}),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching availability",
      error: error.message,
    });
  }
};

/**
 * POST /api/artists/public/:id/bookings
 * Body: booking_date, start_time, end_time, requester_name, requester_email,
 *       requester_phone, venue?, notes?
 */
const createPublicBooking = async (req, res) => {
  try {
    const artist = await findPublicArtist(req.params.id);
    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Artist not found",
      });
    }

    const {
      booking_date,
      start_time,
      end_time,
      requester_name,
      requester_email,
      requester_phone,
      venue,
      notes,
    } = req.body;

    const dateOnly = formatDateOnly(booking_date);
    if (!dateOnly) {
      return res.status(400).json({
        success: false,
        message: "booking_date is required (YYYY-MM-DD)",
      });
    }

    if (
      !requester_name?.trim() ||
      !requester_email?.trim() ||
      !requester_phone?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "requester_name, requester_email, and requester_phone are required",
      });
    }

    const timeError = validateTimeRange(start_time, end_time);
    if (timeError) {
      return res.status(400).json({
        success: false,
        message: timeError,
      });
    }

    const { scheduleItems, bookingItems } = await loadDayBusySources(
      artist.id,
      dateOnly
    );
    const check = isSlotAvailable(
      scheduleItems,
      bookingItems,
      start_time,
      end_time
    );

    if (!check.available) {
      return res.status(409).json({
        success: false,
        message: check.error || "Selected time overlaps an existing show or booking",
        conflict: check.conflict || null,
      });
    }

    const booking = await ArtistBooking.create({
      artist_id: artist.id,
      requester_user_id: req.userId || null,
      requester_name: requester_name.trim(),
      requester_email: requester_email.trim().toLowerCase(),
      requester_phone: requester_phone.trim(),
      booking_date: dateOnly,
      start_time,
      end_time,
      venue: venue?.trim() || null,
      notes: notes?.trim() || null,
      status: "pending",
    });

    res.status(201).json({
      success: true,
      message: "Booking request submitted",
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating booking",
      error: error.message,
    });
  }
};

/**
 * GET /api/artists/me/bookings
 * Query: status, date_from, date_to, page, limit
 */
const listMyBookings = async (req, res) => {
  try {
    const { status, date_from, date_to } = req.query;
    const requestedPage = Number.parseInt(req.query.page, 10);
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const page = Number.isFinite(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 100)
      : 10;
    const offset = (page - 1) * limit;
    const baseWhere = { artist_id: req.userId };

    if (date_from || date_to) {
      baseWhere.booking_date = {};
      if (date_from) {
        baseWhere.booking_date[Op.gte] = formatDateOnly(date_from);
      }
      if (date_to) {
        baseWhere.booking_date[Op.lte] = formatDateOnly(date_to);
      }
    }

    const where = { ...baseWhere };
    if (status && status !== "all") where.status = status;

    const [result, groupedCounts] = await Promise.all([
      ArtistBooking.findAndCountAll({
        where,
        limit,
        offset,
        order: [
          ["booking_date", "ASC"],
          ["start_time", "ASC"],
        ],
      }),
      ArtistBooking.count({
        where: baseWhere,
        group: ["status"],
      }),
    ]);

    const statusCounts = {
      all: 0,
      pending: 0,
      confirmed: 0,
      rejected: 0,
      cancelled: 0,
    };
    for (const entry of groupedCounts) {
      if (Object.prototype.hasOwnProperty.call(statusCounts, entry.status)) {
        statusCounts[entry.status] = Number(entry.count);
        statusCounts.all += Number(entry.count);
      }
    }
    const totalPages = result.count === 0 ? 0 : Math.ceil(result.count / limit);

    res.status(200).json({
      success: true,
      count: result.count,
      data: result.rows,
      status_counts: statusCounts,
      pagination: {
        page,
        limit,
        total: result.count,
        total_pages: totalPages,
        has_next_page: page < totalPages,
        has_previous_page: page > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching bookings",
      error: error.message,
    });
  }
};

/**
 * PUT /api/artists/me/bookings/:bookingId/status
 * Body: status (confirmed|rejected|cancelled), artist_notes?
 */
const updateMyBookingStatus = async (req, res) => {
  try {
    const booking = await ArtistBooking.findOne({
      where: { id: req.params.bookingId, artist_id: req.userId },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const { status, artist_notes } = req.body;
    const allowed = ["confirmed", "rejected", "cancelled"];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${allowed.join(", ")}`,
      });
    }

    if (status === "confirmed") {
      if (booking.status === "cancelled" || booking.status === "rejected") {
        return res.status(400).json({
          success: false,
          message: "Cannot confirm a cancelled or rejected booking",
        });
      }

      const dateOnly = formatDateOnly(booking.booking_date);
      const { scheduleItems, bookingItems } = await loadDayBusySources(
        req.userId,
        dateOnly,
        { excludeBookingId: booking.id }
      );
      const check = isSlotAvailable(
        scheduleItems,
        bookingItems,
        booking.start_time,
        booking.end_time
      );

      if (!check.available) {
        return res.status(409).json({
          success: false,
          message:
            check.error ||
            "Cannot confirm: time now overlaps another show or booking",
          conflict: check.conflict || null,
        });
      }
    }

    await booking.update({
      status,
      artist_notes:
        artist_notes !== undefined
          ? artist_notes?.trim() || null
          : booking.artist_notes,
    });

    res.status(200).json({
      success: true,
      message: `Booking ${status}`,
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating booking",
      error: error.message,
    });
  }
};

/**
 * Assert a schedule window does not conflict with bookings.
 * Used by schedule create/update.
 */
const assertScheduleSlotFreeOfBookings = async (
  artistId,
  activityDate,
  start_time,
  end_time,
  excludeScheduleId = null
) => {
  const dateOnly = formatDateOnly(activityDate);
  if (!dateOnly) {
    return { ok: false, message: "Invalid activity_date" };
  }

  const timeError = validateTimeRange(start_time, end_time);
  if (timeError) {
    return { ok: false, message: timeError };
  }

  const { scheduleItems, bookingItems } = await loadDayBusySources(
    artistId,
    dateOnly
  );

  const schedules = excludeScheduleId
    ? scheduleItems.filter((s) => s.id !== excludeScheduleId)
    : scheduleItems;

  const check = isSlotAvailable(schedules, bookingItems, start_time, end_time);
  if (!check.available) {
    return {
      ok: false,
      message:
        check.error ||
        "This time overlaps an existing show or pending/confirmed booking",
      conflict: check.conflict || null,
    };
  }

  return { ok: true };
};

module.exports = {
  getPublicAvailability,
  createPublicBooking,
  listMyBookings,
  updateMyBookingStatus,
  assertScheduleSlotFreeOfBookings,
  loadDayBusySources,
};
