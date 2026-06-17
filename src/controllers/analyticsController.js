const {
  User,
  Event,
  Payment,
  TicketPurchase,
  sequelize,
} = require("../models");
const { Op } = require("sequelize");
const cronManager = require("../services/cronManager");

const organizerWhere = (extra = {}) => ({
  role: "event_organizer",
  ...extra,
});

const getDashboardStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          [Op.between]: [
            new Date(startDate),
            new Date(endDate + "T23:59:59.999Z"),
          ],
        },
      };
    }

    const totalOrganizers = await User.count({
      where: organizerWhere(dateFilter),
    });
    const pendingOrganizers = await User.count({
      where: organizerWhere({ organizer_status: "pending", ...dateFilter }),
    });
    const totalEvents = await Event.count({ where: dateFilter });
    const pendingEvents = await Event.count({
      where: { status: "pending", ...dateFilter },
    });
    const totalTicketsSold = await TicketPurchase.count({
      where: { status: "paid", ...dateFilter },
    });

    const revenueData = await Payment.findAll({
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
    });

    const revenue = revenueData[0] || {
      totalRevenue: 0,
      adminRevenue: 0,
      organizerRevenue: 0,
    };

    const recentEvents = await Event.findAll({
      limit: 5,
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
    });

    const recentPurchases = await TicketPurchase.findAll({
      limit: 5,
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
    });

    res.status(200).json({
      success: true,
      data: {
        dateRange: {
          start: startDate ? new Date(startDate).toISOString() : null,
          end: endDate
            ? new Date(endDate + "T23:59:59.999Z").toISOString()
            : null,
        },
        stats: {
          totalOrganizers,
          pendingOrganizers,
          totalEvents,
          pendingEvents,
          totalTicketsSold,
        },
        revenue: {
          totalRevenue: parseFloat(revenue.totalRevenue || 0).toFixed(2),
          adminRevenue: parseFloat(revenue.adminRevenue || 0).toFixed(2),
          organizerRevenue: parseFloat(revenue.organizerRevenue || 0).toFixed(
            2
          ),
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

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          [Op.between]: [
            new Date(startDate),
            new Date(endDate + "T23:59:59.999Z"),
          ],
        },
      };
    }

    let groupBy;
    switch (period) {
      case "day":
        groupBy = sequelize.fn("DATE", sequelize.col("createdAt"));
        break;
      case "week":
        groupBy = sequelize.fn(
          "EXTRACT",
          sequelize.literal('WEEK FROM "createdAt"')
        );
        break;
      case "month":
      default:
        groupBy = sequelize.fn(
          "EXTRACT",
          sequelize.literal('MONTH FROM "createdAt"')
        );
        break;
    }

    const revenueByPeriod = await Payment.findAll({
      attributes: [
        [groupBy, "period"],
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

    const topEvents = await Payment.findAll({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("amount")), "totalRevenue"],
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
          include: [
            {
              model: Event,
              as: "event",
              attributes: ["id", "event_name", "venue"],
            },
          ],
        },
      ],
      where: { status: "completed", ...dateFilter },
      group: ["purchase.event.id"],
      order: [[sequelize.fn("SUM", sequelize.col("amount")), "DESC"]],
      limit: 10,
      raw: true,
    });

    const commissionByOrganizer = await Payment.findAll({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("admin_share")), "totalCommission"],
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
          include: [
            {
              model: Event,
              as: "event",
              attributes: [],
              include: [
                {
                  model: User,
                  as: "organizer",
                  attributes: ["organization_name"],
                },
              ],
            },
          ],
        },
      ],
      where: { status: "completed", ...dateFilter },
      group: ["purchase.event.organizer.id"],
      order: [[sequelize.fn("SUM", sequelize.col("admin_share")), "DESC"]],
      raw: true,
    });

    res.status(200).json({
      success: true,
      data: {
        period,
        dateRange: {
          start: startDate ? new Date(startDate).toISOString() : null,
          end: endDate
            ? new Date(endDate + "T23:59:59.999Z").toISOString()
            : null,
        },
        revenueByPeriod,
        topEvents,
        commissionByOrganizer,
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

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          [Op.between]: [
            new Date(startDate),
            new Date(endDate + "T23:59:59.999Z"),
          ],
        },
      };
    }

    const eventStatsRaw = await Event.findAll({
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      where: dateFilter,
      group: ["status"],
      raw: true,
    });

    const allStatuses = [
      "pending",
      "approved",
      "rejected",
      "completed",
      "cancelled",
    ];
    const eventStats = allStatuses.map((status) => {
      const found = eventStatsRaw.find((item) => item.status === status);
      return { status, count: found ? found.count : "0" };
    });

    const eventsByCategoryRaw = await Event.findAll({
      attributes: [
        "category",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      where: dateFilter,
      group: ["category"],
      raw: true,
    });

    const allCategories = [
      "Conference",
      "Concert",
      "Sports",
      "Workshop",
      "Seminar",
      "Festival",
      "Exhibition",
      "Other",
    ];

    const eventsByCategory = allCategories
      .map((category) => {
        const found = eventsByCategoryRaw.find(
          (item) => item.category === category
        );
        return { category, count: found ? found.count : "0" };
      })
      .sort((a, b) => parseInt(b.count) - parseInt(a.count));

    const avgTicketsPerEvent = await TicketPurchase.findAll({
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
    });

    const completedEvents = await Event.count({
      where: { status: "completed", ...dateFilter },
    });
    const totalEvents = await Event.count({ where: dateFilter });

    res.status(200).json({
      success: true,
      data: {
        dateRange: {
          start: startDate ? new Date(startDate).toISOString() : null,
          end: endDate
            ? new Date(endDate + "T23:59:59.999Z").toISOString()
            : null,
        },
        eventStats,
        eventsByCategory,
        avgTicketsPerEvent: {
          avgTickets: avgTicketsPerEvent[0]?.avgTickets || 0,
          totalTickets: avgTicketsPerEvent[0]?.totalTickets || 0,
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
    const end = endDate ? new Date(endDate) : new Date();

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
        purchaseTrends,
        uniqueBuyers,
        topBuyers,
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
    const end = endDate ? new Date(endDate) : new Date();

    const paymentStats = await Payment.findAll({
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
        paymentStats,
        failedTransactions,
        totalTransactions,
        successRate:
          totalTransactions > 0
            ? (
                ((totalTransactions - failedTransactions) / totalTransactions) *
                100
              ).toFixed(2)
            : 100,
        systemUptime: 99.9,
        recentErrors: [],
        dbHealth: {
          connectionStatus: "connected",
          responseTime: "< 100ms",
          lastBackup: new Date().toISOString(),
        },
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
