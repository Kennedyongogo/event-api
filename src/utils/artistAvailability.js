/**
 * Artist availability: no working hours.
 * Bookable anytime as long as the slot does not overlap schedule shows
 * or pending/confirmed bookings.
 */

const BUSY_BOOKING_STATUSES = ["pending", "confirmed"];

const hasTimeValue = (value) =>
  typeof value === "string" ? value.trim().length > 0 : Boolean(value);

const timeToMinutes = (time) => {
  if (!hasTimeValue(time)) return null;
  const raw = String(time).trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

const minutesToTime = (mins) => {
  const clamped = Math.max(0, Math.min(mins, 24 * 60 - 1));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
};

const formatDateOnly = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
};

/** Returns error message or null. */
const validateTimeRange = (start_time, end_time) => {
  if (!hasTimeValue(start_time) || !hasTimeValue(end_time)) {
    return "start_time and end_time are required";
  }
  const startMins = timeToMinutes(start_time);
  const endMins = timeToMinutes(end_time);
  if (startMins == null || endMins == null) {
    return "start_time and end_time must be valid times (HH:mm or HH:mm:ss)";
  }
  if (endMins <= startMins) {
    return "end_time must be after start_time";
  }
  return null;
};

const intervalsOverlap = (aStart, aEnd, bStart, bEnd) =>
  aStart < bEnd && bStart < aEnd;

const mergeIntervals = (intervals) => {
  if (!intervals.length) return [];
  const sorted = [...intervals].sort((a, b) => a.startMins - b.startMins);
  const merged = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = merged[merged.length - 1];
    if (cur.startMins < last.endMins) {
      last.endMins = Math.max(last.endMins, cur.endMins);
      last.label = last.label || cur.label;
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
};

const freeSlotsFromBusy = (busyIntervals) => {
  const dayStart = 0;
  const dayEnd = 24 * 60; // exclusive end marker → display as 23:59:00 last free end
  const merged = mergeIntervals(busyIntervals);
  const free = [];
  let cursor = dayStart;

  for (const busy of merged) {
    if (busy.startMins > cursor) {
      free.push({
        start_time: minutesToTime(cursor),
        end_time: minutesToTime(busy.startMins),
        startMins: cursor,
        endMins: busy.startMins,
      });
    }
    cursor = Math.max(cursor, busy.endMins);
  }

  if (cursor < dayEnd) {
    // Use 23:59 for the open end of the day
    free.push({
      start_time: minutesToTime(cursor),
      end_time: "23:59:00",
      startMins: cursor,
      endMins: 23 * 60 + 59,
    });
  }

  return free.map(({ start_time, end_time }) => ({ start_time, end_time }));
};

const scheduleToBusy = (item) => {
  const startMins = timeToMinutes(item.start_time);
  const endMins = timeToMinutes(item.end_time);
  if (startMins == null || endMins == null || endMins <= startMins) return null;
  return {
    type: "schedule",
    id: item.id,
    title: item.title || "Scheduled show",
    start_time: minutesToTime(startMins),
    end_time: minutesToTime(endMins),
    startMins,
    endMins,
  };
};

const bookingToBusy = (item) => {
  const startMins = timeToMinutes(item.start_time);
  const endMins = timeToMinutes(item.end_time);
  if (startMins == null || endMins == null || endMins <= startMins) return null;
  return {
    type: "booking",
    id: item.id,
    title: `Booking (${item.status})`,
    status: item.status,
    start_time: minutesToTime(startMins),
    end_time: minutesToTime(endMins),
    startMins,
    endMins,
  };
};

/**
 * @param {object[]} scheduleItems
 * @param {object[]} bookingItems
 * @param {{ excludeBookingId?: string }} [opts]
 */
const buildDayAvailability = (scheduleItems, bookingItems, opts = {}) => {
  const busy = [];

  for (const item of scheduleItems) {
    const block = scheduleToBusy(item);
    if (block) busy.push(block);
  }

  for (const item of bookingItems) {
    if (opts.excludeBookingId && item.id === opts.excludeBookingId) continue;
    if (!BUSY_BOOKING_STATUSES.includes(item.status)) continue;
    const block = bookingToBusy(item);
    if (block) busy.push(block);
  }

  const free_slots = freeSlotsFromBusy(busy);

  return {
    busy_slots: busy.map(
      ({ type, id, title, status, start_time, end_time }) => ({
        type,
        id,
        title,
        ...(status ? { status } : {}),
        start_time,
        end_time,
      })
    ),
    free_slots,
    is_fully_free: busy.length === 0,
  };
};

/**
 * Check whether a requested range is free.
 * @returns {{ available: boolean, conflict?: object }}
 */
const isSlotAvailable = (scheduleItems, bookingItems, start_time, end_time, opts = {}) => {
  const timeError = validateTimeRange(start_time, end_time);
  if (timeError) {
    return { available: false, error: timeError };
  }

  const reqStart = timeToMinutes(start_time);
  const reqEnd = timeToMinutes(end_time);
  const day = buildDayAvailability(scheduleItems, bookingItems, opts);

  for (const block of day.busy_slots) {
    const bStart = timeToMinutes(block.start_time);
    const bEnd = timeToMinutes(block.end_time);
    if (intervalsOverlap(reqStart, reqEnd, bStart, bEnd)) {
      return {
        available: false,
        conflict: block,
      };
    }
  }

  return { available: true };
};

module.exports = {
  BUSY_BOOKING_STATUSES,
  hasTimeValue,
  timeToMinutes,
  minutesToTime,
  formatDateOnly,
  validateTimeRange,
  intervalsOverlap,
  buildDayAvailability,
  isSlotAvailable,
};
