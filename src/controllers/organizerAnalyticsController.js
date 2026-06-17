const {
  User,
  Event,
  Payment,
  TicketPurchase,
  sequelize,
} = require("../models");
const { Op, QueryTypes } = require("sequelize");
const {
  buildDateFilter,
  formatDateRangeMeta,
  toMoney,
  toNumber,
  toInt,
  formatPeriodLabel,
  normalizeStatusCounts,
  mapRecentEvent,
  mapRecentPurchase,
} = require("../utils/analyticsHelpers");

const assertOrganizer = async (organizerId) => {
  const organizer = await User.findByPk(organizerId, {
    attributes: ["id", "role", "organization_name", "full_name"],
  });
  if (!organizer || organizer.role !== "event_organizer") {
    return null;
  }
  return organizer;
};

const organizerEventFilter = (organizerId, dateFilter = {}) => ({
  organizer_id: organizerId,
  ...dateFilter,
});

const getPeriodGroup = (period = "month") => {
  switch (period) {
    case "day":
      return {
        type: "day",
        expression: sequelize.fn("DATE", sequelize.col("Payment.createdAt")),
      };
    case "week":
      return {
        type: "week",
        expression: sequelize.fn(
          "EXTRACT",
          sequelize.literal('WEEK FROM "Payment"."createdAt"')
        ),
      };
    case "month":
    default:
      return {
        type: "month",
        expression: sequelize.fn(
          "EXTRACT",
          sequelize.literal('MONTH FROM "Payment"."createdAt"')
        ),
      };
  }
};

const getOrganizerDashboardStats = async (req, res) => {
  try {
    const { id: organizerId } = req.params;
    const { startDate, endDate } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate);

    const organizer = await assertOrganizer(organizerId);
    if (!organizer) {
      return res.status(404).json({ success: false, message: "Organizer not found" });
    }

    const eventWhere = organizerEventFilter(organizerId, dateFilter);
    const now = new Date();

    const [
      eventStatsRaw,
      totalTicketsSold,
      earningsRow,
      grossRow,
      upcomingEvents,
      recentEvents,
      recentPurchases,
    ] = await Promise.all([
      Event.findAll({
        attributes: [
          "status",
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        ],
        where: eventWhere,
        group: ["status"],
        raw: true,
      }),
      TicketPurchase.count({
        where: { status: "paid" },
        include: [
          {
            model: Event,
            as: "event",
            attributes: [],
            where: eventWhere,
            required: true,
          },
        ],
      }),
      sequelize.query(
        `
        SELECT
          COALESCE(SUM(p.organizer_share), 0) AS "organizerEarnings",
          COALESCE(SUM(p.admin_share), 0) AS "platformFees"
        FROM payments p
        INNER JOIN ticket_purchases tp ON p.purchase_id = tp.id
        INNER JOIN events e ON tp.event_id = e.id
        WHERE p.status = 'completed'
          AND e.organizer_id = :organizerId
          ${startDate && endDate ? `AND p."createdAt" BETWEEN :startDate AND :endDate` : ""}
        `,
        {
          replacements: {
            organizerId,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate + "T23:59:59.999Z") : null,
          },
          type: QueryTypes.SELECT,
        }
      ),
      sequelize.query(
        `
        SELECT COALESCE(SUM(p.amount), 0) AS "grossSales"
        FROM payments p
        INNER JOIN ticket_purchases tp ON p.purchase_id = tp.id
        INNER JOIN events e ON tp.event_id = e.id
        WHERE p.status = 'completed'
          AND e.organizer_id = :organizerId
          ${startDate && endDate ? `AND p."createdAt" BETWEEN :startDate AND :endDate` : ""}
        `,
        {
          replacements: {
            organizerId,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate + "T23:59:59.999Z") : null,
          },
          type: QueryTypes.SELECT,
        }
      ),
      Event.count({
        where: {
          organizer_id: organizerId,
          status: "approved",
          event_date: { [Op.gte]: now },
        },
      }),
      Event.findAll({
        limit: 6,
        order: [["createdAt", "DESC"]],
        attributes: ["id", "event_name", "status", "createdAt", "event_date"],
        where: eventWhere,
        include: [
          {
            model: User,
            as: "organizer",
            attributes: ["organization_name", "full_name"],
          },
        ],
      }),
      TicketPurchase.findAll({
        limit: 6,
        order: [["createdAt", "DESC"]],
        attributes: [
          "id",
          "total_amount",
          "status",
          "createdAt",
          "buyer_name",
          "quantity",
        ],
        where: { status: "paid", ...dateFilter },
        include: [
          {
            model: Event,
            as: "event",
            attributes: ["event_name"],
            where: { organizer_id: organizerId },
            required: true,
          },
        ],
      }),
    ]);

    const eventStats = normalizeStatusCounts(eventStatsRaw);
    const totalEvents = eventStats.reduce((sum, row) => sum + row.count, 0);
    const approvedEvents =
      eventStats.find((row) => row.status === "approved")?.count || 0;
    const pendingEvents =
      eventStats.find((row) => row.status === "pending")?.count || 0;
    const completedEvents =
      eventStats.find((row) => row.status === "completed")?.count || 0;

    const earnings = earningsRow[0] || {};
    const gross = grossRow[0] || {};

    res.status(200).json({
      success: true,
      data: {
        dateRange: formatDateRangeMeta(startDate, endDate),
        organizer: {
          id: organizer.id,
          name: organizer.organization_name || organizer.full_name,
        },
        metrics: {
          events: {
            total: totalEvents,
            pending: pendingEvents,
            approved: approvedEvents,
            completed: completedEvents,
            upcoming: upcomingEvents,
          },
          tickets: { sold: totalTicketsSold },
          sales: {
            gross: toMoney(gross.grossSales),
            earnings: toMoney(earnings.organizerEarnings),
            platformFees: toMoney(earnings.platformFees),
          },
        },
        rates: {
          approvalRate:
            totalEvents > 0
              ? ((approvedEvents / totalEvents) * 100).toFixed(1)
              : "0.0",
        },
        recent: {
          events: recentEvents.map((event) => ({
            ...mapRecentEvent(event),
            eventDate: event.event_date,
          })),
          purchases: recentPurchases.map(mapRecentPurchase),
        },
        totalEvents,
        approvedEvents,
        completedEvents,
        pendingEvents,
        totalRevenue: toMoney(earnings.organizerEarnings),
      },
    });
  } catch (error) {
    console.error("Error fetching organizer dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching organizer dashboard stats",
      error: error.message,
    });
  }
};

const getOrganizerEventAnalytics = async (req, res) => {
  try {
    const { id: organizerId } = req.params;
    const { startDate, endDate } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate);
    const eventWhere = organizerEventFilter(organizerId, dateFilter);

    const organizer = await assertOrganizer(organizerId);
    if (!organizer) {
      return res.status(404).json({ success: false, message: "Organizer not found" });
    }

    const [eventStatsRaw, eventsByCategoryRaw, ticketStats] = await Promise.all([
      Event.findAll({
        attributes: [
          "status",
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        ],
        where: eventWhere,
        group: ["status"],
        raw: true,
      }),
      Event.findAll({
        attributes: [
          "category",
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        ],
        where: {
          ...eventWhere,
          category: { [Op.ne]: null },
        },
        group: ["category"],
        order: [[sequelize.fn("COUNT", sequelize.col("id")), "DESC"]],
        raw: true,
      }),
      TicketPurchase.findAll({
        attributes: [
          [sequelize.fn("AVG", sequelize.col("quantity")), "avgTickets"],
          [sequelize.fn("SUM", sequelize.col("quantity")), "totalTickets"],
        ],
        include: [
          {
            model: Event,
            as: "event",
            attributes: [],
            where: eventWhere,
            required: true,
          },
        ],
        where: { status: "paid" },
        raw: true,
      }),
    ]);

    const eventStats = normalizeStatusCounts(eventStatsRaw);
    const eventsByCategory = eventsByCategoryRaw.map((row) => ({
      category: row.category || "Uncategorized",
      count: toInt(row.count),
    }));

    const totalEvents = eventStats.reduce((sum, row) => sum + row.count, 0);
    const completedEvents =
      eventStats.find((row) => row.status === "completed")?.count || 0;
    const approvedEvents =
      eventStats.find((row) => row.status === "approved")?.count || 0;
    const pendingEvents =
      eventStats.find((row) => row.status === "pending")?.count || 0;
    const avgTickets = toNumber(ticketStats[0]?.avgTickets);
    const totalTickets = toInt(ticketStats[0]?.totalTickets);

    res.status(200).json({
      success: true,
      data: {
        dateRange: formatDateRangeMeta(startDate, endDate),
        summary: {
          totalEvents,
          approvedEvents,
          pendingEvents,
          completedEvents,
          totalTicketsSold: totalTickets,
          avgTicketsPerEvent: Number(avgTickets.toFixed(1)),
          completionRate:
            totalEvents > 0
              ? ((completedEvents / totalEvents) * 100).toFixed(1)
              : "0.0",
        },
        eventStats,
        eventsByStatus: eventStats,
        eventsByCategory,
        avgTicketsPerEvent: avgTickets,
        totalTicketsSold: totalTickets,
      },
    });
  } catch (error) {
    console.error("Error fetching organizer event analytics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching organizer event analytics",
      error: error.message,
    });
  }
};

const getOrganizerRevenueAnalytics = async (req, res) => {
  try {
    const { id: organizerId } = req.params;
    const { startDate, endDate, period = "month" } = req.query;

    const organizer = await assertOrganizer(organizerId);
    if (!organizer) {
      return res.status(404).json({ success: false, message: "Organizer not found" });
    }

    const dateFilter = buildDateFilter(startDate, endDate);
    const { type: periodType, expression: groupBy } = getPeriodGroup(period);

    const revenueByPeriodRaw = await Payment.findAll({
      attributes: [
        [groupBy, "periodKey"],
        [sequelize.fn("SUM", sequelize.col("amount")), "grossSales"],
        [sequelize.fn("SUM", sequelize.col("organizer_share")), "organizerEarnings"],
        [sequelize.fn("SUM", sequelize.col("admin_share")), "platformFees"],
        [
          sequelize.fn("COUNT", sequelize.col("Payment.id")),
          "transactionCount",
        ],
      ],
      include: [
        {
          model: TicketPurchase,
          as: "purchase",
          attributes: [],
          required: true,
          include: [
            {
              model: Event,
              as: "event",
              attributes: [],
              where: { organizer_id: organizerId },
              required: true,
            },
          ],
        },
      ],
      where: { status: "completed", ...dateFilter },
      group: [groupBy],
      order: [[groupBy, "ASC"]],
      raw: true,
    });

    const revenueByPeriod = revenueByPeriodRaw.map((row) => ({
      periodKey: row.periodKey,
      period: formatPeriodLabel(row.periodKey, periodType),
      grossSales: toMoney(row.grossSales),
      organizerEarnings: toMoney(row.organizerEarnings),
      platformFees: toMoney(row.platformFees),
      transactionCount: toInt(row.transactionCount),
    }));

    const dateSql =
      startDate && endDate
        ? `AND p."createdAt" BETWEEN :startDate AND :endDate`
        : "";

    const topEvents = await sequelize.query(
      `
      SELECT
        e.id AS "eventId",
        e.event_name AS "eventName",
        e.venue AS "venue",
        COALESCE(SUM(p.organizer_share), 0) AS "organizerEarnings",
        COALESCE(SUM(p.amount), 0) AS "grossSales",
        COUNT(p.id)::int AS "transactionCount"
      FROM payments p
      INNER JOIN ticket_purchases tp ON p.purchase_id = tp.id
      INNER JOIN events e ON tp.event_id = e.id
      WHERE p.status = 'completed'
        AND e.organizer_id = :organizerId
        ${dateSql}
      GROUP BY e.id, e.event_name, e.venue
      ORDER BY SUM(p.organizer_share) DESC
      LIMIT 10
      `,
      {
        replacements: {
          organizerId,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate + "T23:59:59.999Z") : null,
        },
        type: QueryTypes.SELECT,
      }
    );

    const summary = revenueByPeriod.reduce(
      (acc, row) => ({
        grossSales: acc.grossSales + toNumber(row.grossSales),
        organizerEarnings: acc.organizerEarnings + toNumber(row.organizerEarnings),
        platformFees: acc.platformFees + toNumber(row.platformFees),
        transactionCount: acc.transactionCount + row.transactionCount,
      }),
      {
        grossSales: 0,
        organizerEarnings: 0,
        platformFees: 0,
        transactionCount: 0,
      }
    );

    res.status(200).json({
      success: true,
      data: {
        period,
        dateRange: formatDateRangeMeta(startDate, endDate),
        summary: {
          grossSales: toMoney(summary.grossSales),
          organizerEarnings: toMoney(summary.organizerEarnings),
          platformFees: toMoney(summary.platformFees),
          transactionCount: summary.transactionCount,
        },
        revenueByPeriod,
        topEvents: topEvents.map((row) => ({
          eventId: row.eventId,
          eventName: row.eventName,
          venue: row.venue,
          organizerEarnings: toMoney(row.organizerEarnings),
          grossSales: toMoney(row.grossSales),
          transactionCount: toInt(row.transactionCount),
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching organizer revenue analytics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching organizer revenue analytics",
      error: error.message,
    });
  }
};

module.exports = {
  getOrganizerDashboardStats,
  getOrganizerEventAnalytics,
  getOrganizerRevenueAnalytics,
};
