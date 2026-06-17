const { Op } = require("sequelize");

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const EVENT_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "completed",
  "cancelled",
];

const buildDateFilter = (startDate, endDate) => {
  if (!startDate || !endDate) return {};
  return {
    createdAt: {
      [Op.between]: [
        new Date(startDate),
        new Date(endDate + "T23:59:59.999Z"),
      ],
    },
  };
};

const formatDateRangeMeta = (startDate, endDate) => ({
  start: startDate ? new Date(startDate).toISOString() : null,
  end: endDate ? new Date(endDate + "T23:59:59.999Z").toISOString() : null,
});

const toMoney = (value) => parseFloat(value || 0).toFixed(2);

const toNumber = (value) => parseFloat(value || 0);

const toInt = (value) => parseInt(value || 0, 10);

const formatPeriodLabel = (period, groupType) => {
  if (period == null || period === "") return "—";
  if (groupType === "month") {
    const idx = parseInt(period, 10) - 1;
    return MONTH_NAMES[idx] || `M${period}`;
  }
  if (groupType === "week") return `W${period}`;
  return String(period);
};

const normalizeStatusCounts = (rows, key = "status") =>
  EVENT_STATUSES.map((status) => {
    const found = rows.find((item) => item[key] === status);
    return { status, count: toInt(found?.count) };
  });

const mapRecentEvent = (event) => ({
  id: event.id,
  name: event.event_name,
  status: event.status,
  createdAt: event.createdAt,
  organizerName:
    event.organizer?.organization_name ||
    event.organizer?.full_name ||
    "—",
});

const mapRecentPurchase = (purchase) => ({
  id: purchase.id,
  amount: toMoney(purchase.total_amount),
  status: purchase.status,
  createdAt: purchase.createdAt,
  buyerName: purchase.buyer_name || "—",
  eventName: purchase.event?.event_name || "—",
});

const normalizeCategoryCounts = (rows, categories) =>
  categories.map((category) => {
    const found = rows.find((item) => item.category === category);
    return { category, count: toInt(found?.count) };
  });

module.exports = {
  MONTH_NAMES,
  EVENT_STATUSES,
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
};
