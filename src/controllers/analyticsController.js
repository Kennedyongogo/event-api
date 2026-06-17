const {
  User,
  Event,
  Payment,
  TicketPurchase,
  sequelize,
} = require("../models");
const { Op, QueryTypes } = require("sequelize");
const cronManager = require("../services/cronManager");
const { EVENT_CATEGORIES } = require("../constants/eventCategories");
const {
  buildDateFilter,
  formatDateRangeMeta,
  toMoney,
  toNumber,
  toInt,
  formatPeriodLabel,
  normalizeStatusCounts,
  normalizeCategoryCounts,
  mapRecentEvent,
  mapRecentPurchase,
} = require("../utils/analyticsHelpers");

const organizerWhere = (extra = {}) => ({
  role: "event_organizer",
  ...extra,
});

const artistWhere = (extra = {}) => ({
  role: "artist",
  ...extra,
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

const getDashboardStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate);

    const [
      totalOrganizers,
      pendingOrganizers,
      approvedOrganizers,
      totalArtists,
      totalEvents,
      pendingEvents,
      approvedEvents,
      completedEvents,
      totalTicketsSold,
      revenueData,
      recentEvents,
      recentPurchases,
    ] = await Promise.all([
      User.count({ where: organizerWhere(dateFilter) }),
      User.count({
        where: organizerWhere({ organizer_status: "pending", ...dateFilter }),
      }),
      User.count({
        where: organizerWhere({
          organizer_status: { [Op.in]: ["approved", "active"] },
          ...dateFilter,
        }),
      }),
      User.count({ where: artistWhere(dateFilter) }),
      Event.count({ where: dateFilter }),
      Event.count({ where: { status: "pending", ...dateFilter } }),
      Event.count({ where: { status: "approved", ...dateFilter } }),
      Event.count({ where: { status: "completed", ...dateFilter } }),
      TicketPurchase.count({ where: { status: "paid", ...dateFilter } }),
      Payment.findAll({
        attributes: [
          [sequelize.fn("SUM", sequelize.col("amount")), "totalRevenue"],
          [sequelize.fn("SUM", sequelize.col("admin_share")), "adminRevenue"],
          [
            sequelize.fn("SUM", sequelize.col("organizer_share")),
            "organizerRevenue",
          ],
        ],
        where: { status: "completed", ...dateFilter },
        raw: true,
      }),
      Event.findAll({
        limit: 6,
        order: [["createdAt", "DESC"]],
        attributes: ["id", "event_name", "status", "createdAt"],
        where: dateFilter,
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
          "buyer_email",
        ],
        where: dateFilter,
        include: [
          {
            model: Event,
            as: "event",
            attributes: ["event_name"],
          },
        ],
      }),
    ]);

    const revenue = revenueData[0] || {};
    const completionRate =
      totalEvents > 0 ? ((completedEvents / totalEvents) * 100).toFixed(1) : "0.0";

    res.status(200).json({
      success: true,
      data: {
        dateRange: formatDateRangeMeta(startDate, endDate),
        metrics: {
          organizers: {
            total: totalOrganizers,
            pending: pendingOrganizers,
            approved: approvedOrganizers,
          },
          artists: { total: totalArtists },
          events: {
            total: totalEvents,
            pending: pendingEvents,
            approved: approvedEvents,
            completed: completedEvents,
          },
          tickets: { sold: totalTicketsSold },
          revenue: {
            total: toMoney(revenue.totalRevenue),
            admin: toMoney(revenue.adminRevenue),
            organizer: toMoney(revenue.organizerRevenue),
          },
        },
        rates: {
          eventCompletionRate: completionRate,
        },
        recent: {
          events: recentEvents.map(mapRecentEvent),
          purchases: recentPurchases.map(mapRecentPurchase),
        },
        // Legacy shape for older clients
        stats: {
          totalOrganizers,
          pendingOrganizers,
          totalEvents,
          pendingEvents,
          totalTicketsSold,
        },
        revenue: {
          totalRevenue: toMoney(revenue.totalRevenue),
          adminRevenue: toMoney(revenue.adminRevenue),
          organizerRevenue: toMoney(revenue.organizerRevenue),
        },
        recentActivities: {
          recentEvents,
          recentPurchases,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard stats",
      error: error.message,
    });
  }
};

const getRevenueAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, period = "month" } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate);
    const { type: periodType, expression: groupBy } = getPeriodGroup(period);

    const revenueByPeriodRaw = await Payment.findAll({
      attributes: [
        [groupBy, "periodKey"],
        [sequelize.fn("SUM", sequelize.col("amount")), "totalRevenue"],
        [sequelize.fn("SUM", sequelize.col("admin_share")), "adminRevenue"],
        [
          sequelize.fn("SUM", sequelize.col("organizer_share")),
          "organizerRevenue",
        ],
        [
          sequelize.fn("COUNT", sequelize.col("Payment.id")),
          "transactionCount",
        ],
      ],
      where: { status: "completed", ...dateFilter },
      group: [groupBy],
      order: [[groupBy, "ASC"]],
      raw: true,
    });

    const revenueByPeriod = revenueByPeriodRaw.map((row) => ({
      periodKey: row.periodKey,
      period: formatPeriodLabel(row.periodKey, periodType),
      totalRevenue: toMoney(row.totalRevenue),
      adminRevenue: toMoney(row.adminRevenue),
      organizerRevenue: toMoney(row.organizerRevenue),
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
        COALESCE(SUM(p.amount), 0) AS "totalRevenue",
        COUNT(p.id)::int AS "transactionCount"
      FROM payments p
      INNER JOIN ticket_purchases tp ON p.purchase_id = tp.id
      INNER JOIN events e ON tp.event_id = e.id
      WHERE p.status = 'completed'
      ${dateSql}
      GROUP BY e.id, e.event_name, e.venue
      ORDER BY SUM(p.amount) DESC
      LIMIT 10
      `,
      {
        replacements: {
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate + "T23:59:59.999Z") : null,
        },
        type: QueryTypes.SELECT,
      }
    );

    const commissionByOrganizer = await sequelize.query(
      `
      SELECT
        u.id AS "organizerId",
        COALESCE(NULLIF(u.organization_name, ''), u.full_name, 'Unknown') AS "organizationName",
        COALESCE(SUM(p.admin_share), 0) AS "totalCommission",
        COUNT(p.id)::int AS "transactionCount"
      FROM payments p
      INNER JOIN ticket_purchases tp ON p.purchase_id = tp.id
      INNER JOIN events e ON tp.event_id = e.id
      INNER JOIN users u ON e.organizer_id = u.id
      WHERE p.status = 'completed'
      ${dateSql}
      GROUP BY u.id, u.organization_name, u.full_name
      ORDER BY SUM(p.admin_share) DESC
      LIMIT 10
      `,
      {
        replacements: {
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate + "T23:59:59.999Z") : null,
        },
        type: QueryTypes.SELECT,
      }
    );

    const summary = revenueByPeriod.reduce(
      (acc, row) => ({
        totalRevenue: acc.totalRevenue + toNumber(row.totalRevenue),
        adminRevenue: acc.adminRevenue + toNumber(row.adminRevenue),
        organizerRevenue: acc.organizerRevenue + toNumber(row.organizerRevenue),
        transactionCount: acc.transactionCount + row.transactionCount,
      }),
      {
        totalRevenue: 0,
        adminRevenue: 0,
        organizerRevenue: 0,
        transactionCount: 0,
      }
    );

    res.status(200).json({
      success: true,
      data: {
        period,
        dateRange: formatDateRangeMeta(startDate, endDate),
        summary: {
          totalRevenue: toMoney(summary.totalRevenue),
          adminRevenue: toMoney(summary.adminRevenue),
          organizerRevenue: toMoney(summary.organizerRevenue),
          transactionCount: summary.transactionCount,
        },
        revenueByPeriod,
        topEvents: topEvents.map((row) => ({
          eventId: row.eventId,
          eventName: row.eventName,
          venue: row.venue,
          totalRevenue: toMoney(row.totalRevenue),
          transactionCount: toInt(row.transactionCount),
        })),
        commissionByOrganizer: commissionByOrganizer.map((row) => ({
          organizerId: row.organizerId,
          organizationName: row.organizationName,
          totalCommission: toMoney(row.totalCommission),
          transactionCount: toInt(row.transactionCount),
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching revenue analytics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching revenue analytics",
      error: error.message,
    });
  }
};

const getEventAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate);

    const [eventStatsRaw, eventsByCategoryRaw, ticketStats] = await Promise.all([
        Event.findAll({
          attributes: [
            "status",
            [sequelize.fn("COUNT", sequelize.col("id")), "count"],
          ],
          where: dateFilter,
          group: ["status"],
          raw: true,
        }),
        Event.findAll({
          attributes: [
            "category",
            [sequelize.fn("COUNT", sequelize.col("id")), "count"],
          ],
          where: {
            ...dateFilter,
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
              where: dateFilter,
            },
          ],
          where: { status: "paid" },
          raw: true,
        }),
      ]);

    const eventStats = normalizeStatusCounts(eventStatsRaw);

    const categoryCounts = normalizeCategoryCounts(
      eventsByCategoryRaw.map((row) => ({
        category: row.category || "Uncategorized",
        count: row.count,
      })),
      EVENT_CATEGORIES
    );

    const knownCategories = new Set(EVENT_CATEGORIES);
    eventsByCategoryRaw.forEach((row) => {
      const category = row.category || "Uncategorized";
      if (!knownCategories.has(category)) {
        categoryCounts.push({ category, count: toInt(row.count) });
      }
    });

    const eventsByCategory = categoryCounts;

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
        // Legacy fields
        avgTicketsPerEvent: {
          avgTickets,
          totalTickets,
        },
        completionRate:
          totalEvents > 0
            ? ((completedEvents / totalEvents) * 100).toFixed(2)
            : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching event analytics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching event analytics",
      error: error.message,
    });
  }
};

const getUserAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate + "T23:59:59.999Z") : new Date();

    const purchaseTrends = await TicketPurchase.findAll({
      attributes: [
        [sequelize.fn("DATE", sequelize.col("createdAt")), "date"],
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        [sequelize.fn("SUM", sequelize.col("total_amount")), "revenue"],
      ],
      where: {
        status: "paid",
        createdAt: { [Op.between]: [start, end] },
      },
      group: [sequelize.fn("DATE", sequelize.col("createdAt"))],
      order: [[sequelize.fn("DATE", sequelize.col("createdAt")), "ASC"]],
      raw: true,
    });

    const uniqueBuyers = await TicketPurchase.count({
      distinct: true,
      col: "buyer_email",
      where: { status: "paid" },
    });

    const topBuyers = await TicketPurchase.findAll({
      attributes: [
        "buyer_email",
        "buyer_name",
        [sequelize.fn("COUNT", sequelize.col("id")), "purchaseCount"],
        [sequelize.fn("SUM", sequelize.col("total_amount")), "totalSpent"],
      ],
      where: {
        status: "paid",
        createdAt: { [Op.between]: [start, end] },
      },
      group: ["buyer_email", "buyer_name"],
      order: [[sequelize.fn("COUNT", sequelize.col("id")), "DESC"]],
      limit: 10,
      raw: true,
    });

    const totalPurchases = await TicketPurchase.count({
      where: {
        status: "paid",
        createdAt: { [Op.between]: [start, end] },
      },
    });

    res.status(200).json({
      success: true,
      data: {
        dateRange: { start, end },
        purchaseTrends: purchaseTrends.map((row) => ({
          date: row.date,
          count: toInt(row.count),
          revenue: toMoney(row.revenue),
        })),
        uniqueBuyers,
        topBuyers: topBuyers.map((row) => ({
          buyerEmail: row.buyer_email,
          buyerName: row.buyer_name,
          purchaseCount: toInt(row.purchaseCount),
          totalSpent: toMoney(row.totalSpent),
        })),
        totalPurchases,
      },
    });
  } catch (error) {
    console.error("Error fetching buyer analytics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching buyer analytics",
      error: error.message,
    });
  }
};

const getSystemAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate + "T23:59:59.999Z") : new Date();

    const paymentStatsRaw = await Payment.findAll({
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      where: { createdAt: { [Op.between]: [start, end] } },
      group: ["status"],
      raw: true,
    });

    const failedTransactions = await Payment.count({
      where: {
        status: "failed",
        createdAt: { [Op.between]: [start, end] },
      },
    });

    const totalTransactions = await Payment.count({
      where: { createdAt: { [Op.between]: [start, end] } },
    });

    res.status(200).json({
      success: true,
      data: {
        dateRange: { start, end },
        paymentStats: paymentStatsRaw.map((row) => ({
          status: row.status,
          count: toInt(row.count),
        })),
        failedTransactions,
        totalTransactions,
        successRate:
          totalTransactions > 0
            ? (
                ((totalTransactions - failedTransactions) / totalTransactions) *
                100
              ).toFixed(1)
            : "100.0",
      },
    });
  } catch (error) {
    console.error("Error fetching system analytics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching system analytics",
      error: error.message,
    });
  }
};

const getCronStatus = async (req, res) => {
  try {
    res.status(200).json({ success: true, data: cronManager.getStatus() });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error getting cron status",
      error: error.message,
    });
  }
};

const triggerEventStatusCron = async (req, res) => {
  try {
    const result = await cronManager.runCronJob("eventStatus");
    res.status(200).json({
      success: true,
      message: "Event status cron job executed successfully",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error triggering event status cron",
      error: error.message,
    });
  }
};

const startCronJobs = async (req, res) => {
  try {
    cronManager.start();
    res.status(200).json({
      success: true,
      message: "All cron jobs started successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error starting cron jobs",
      error: error.message,
    });
  }
};

const stopCronJobs = async (req, res) => {
  try {
    cronManager.stop();
    res.status(200).json({
      success: true,
      message: "All cron jobs stopped successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error stopping cron jobs",
      error: error.message,
    });
  }
};

module.exports = {
  getDashboardStats,
  getRevenueAnalytics,
  getEventAnalytics,
  getUserAnalytics,
  getSystemAnalytics,
  getCronStatus,
  triggerEventStatusCron,
  startCronJobs,
  stopCronJobs,
};
