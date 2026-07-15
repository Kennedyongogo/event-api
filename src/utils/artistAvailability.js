/**
 * Artist availability: no working hours.
 *
 * A date is the interval's start/anchor date. When end_time is earlier than
 * start_time, the interval ends the next calendar day. Equal times remain
 * invalid so zero-length and 24-hour intervals are not ambiguous.
 */

const BUSY_BOOKING_STATUSES = ["pending", "confirmed"];
const DAY_MS = 24 * 60 * 60 * 1000;

const hasTimeValue = (value) =>
  typeof value === "string" ? value.trim().length > 0 : Boolean(value);

const parseTime = (time) => {
  if (!hasTimeValue(time)) return null;
  const match = String(time)
    .trim()
    .match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || 0);
  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  return {
    hours,
    minutes,
    seconds,
    totalMinutes: hours * 60 + minutes,
    totalSeconds: hours * 3600 + minutes * 60 + seconds,
  };
};

const timeToMinutes = (time) => parseTime(time)?.totalMinutes ?? null;

const secondsToTime = (totalSeconds) => {
  const normalized = Math.max(0, Math.min(totalSeconds, 24 * 3600 - 1));
  const hours = Math.floor(normalized / 3600);
  const minutes = Math.floor((normalized % 3600) / 60);
  const seconds = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
};

const minutesToTime = (minutes) =>
  secondsToTime(Math.round(Number(minutes) * 60));

const formatDateOnly = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const test = new Date(Date.UTC(year, month - 1, day));
      if (
        test.getUTCFullYear() === year &&
        test.getUTCMonth() === month - 1 &&
        test.getUTCDate() === day
      ) {
        return match[0];
      }
      return null;
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const dateOnlyToUtcMs = (dateOnly) => {
  const normalized = formatDateOnly(dateOnly);
  if (!normalized) return null;
  const [year, month, day] = normalized.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
};

const addDaysDateOnly = (dateOnly, days) => {
  const timestamp = dateOnlyToUtcMs(dateOnly);
  if (timestamp == null) return null;
  return new Date(timestamp + Number(days) * DAY_MS)
    .toISOString()
    .slice(0, 10);
};

/** Returns error message or null. */
const validateTimeRange = (start_time, end_time) => {
  if (!hasTimeValue(start_time) || !hasTimeValue(end_time)) {
    return "start_time and end_time are required";
  }
  const start = parseTime(start_time);
  const end = parseTime(end_time);
  if (!start || !end) {
    return "start_time and end_time must be valid times (HH:mm or HH:mm:ss)";
  }
  if (end.totalSeconds === start.totalSeconds) {
    return "start_time and end_time cannot be the same";
  }
  return null;
};

const buildAbsoluteInterval = (dateOnly, start_time, end_time) => {
  const dateStart = dateOnlyToUtcMs(dateOnly);
  const start = parseTime(start_time);
  const end = parseTime(end_time);
  if (dateStart == null || !start || !end) return null;
  if (start.totalSeconds === end.totalSeconds) return null;

  const overnight = end.totalSeconds < start.totalSeconds;
  const startAt = dateStart + start.totalSeconds * 1000;
  const endAt =
    dateStart + end.totalSeconds * 1000 + (overnight ? DAY_MS : 0);

  return {
    date: formatDateOnly(dateOnly),
    startAt,
    endAt,
    start_at: new Date(startAt).toISOString(),
    end_at: new Date(endAt).toISOString(),
    start_time: secondsToTime(start.totalSeconds),
    end_time: secondsToTime(end.totalSeconds),
    overnight,
    end_day_offset: overnight ? 1 : 0,
  };
};

const intervalsOverlap = (aStart, aEnd, bStart, bEnd) =>
  aStart < bEnd && bStart < aEnd;

const itemToBusy = (item, type) => {
  const anchorDate =
    type === "schedule" ? item.activity_date : item.booking_date;
  const interval = buildAbsoluteInterval(
    anchorDate,
    item.start_time,
    item.end_time
  );
  if (!interval) return null;

  return {
    type,
    id: item.id,
    title:
      type === "schedule"
        ? item.title || "Scheduled show"
        : `Booking (${item.status})`,
    ...(item.status ? { status: item.status } : {}),
    ...interval,
  };
};

const collectBusyIntervals = (scheduleItems, bookingItems, opts = {}) => {
  const busy = [];
  for (const item of scheduleItems) {
    if (opts.excludeScheduleId && item.id === opts.excludeScheduleId) continue;
    const block = itemToBusy(item, "schedule");
    if (block) busy.push(block);
  }
  for (const item of bookingItems) {
    if (opts.excludeBookingId && item.id === opts.excludeBookingId) continue;
    if (!BUSY_BOOKING_STATUSES.includes(item.status)) continue;
    const block = itemToBusy(item, "booking");
    if (block) busy.push(block);
  }
  return busy.sort((a, b) => a.startAt - b.startAt);
};

const mergeIntervals = (intervals) => {
  if (!intervals.length) return [];
  const sorted = [...intervals].sort((a, b) => a.startAt - b.startAt);
  const merged = [{ startAt: sorted[0].startAt, endAt: sorted[0].endAt }];
  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const last = merged[merged.length - 1];
    if (current.startAt <= last.endAt) {
      last.endAt = Math.max(last.endAt, current.endAt);
    } else {
      merged.push({ startAt: current.startAt, endAt: current.endAt });
    }
  }
  return merged;
};

const timestampToDayTime = (timestamp, dayStart, isDayEnd = false) => {
  if (isDayEnd && timestamp >= dayStart + DAY_MS) return "23:59:00";
  const seconds = Math.max(
    0,
    Math.min(
      Math.floor((timestamp - dayStart) / 1000),
      24 * 3600 - 1
    )
  );
  return secondsToTime(seconds);
};

const freeSlotsFromBusy = (busyIntervals, dayStart) => {
  const dayEnd = dayStart + DAY_MS;
  const clipped = busyIntervals
    .filter((block) =>
      intervalsOverlap(block.startAt, block.endAt, dayStart, dayEnd)
    )
    .map((block) => ({
      startAt: Math.max(block.startAt, dayStart),
      endAt: Math.min(block.endAt, dayEnd),
    }));

  const free = [];
  let cursor = dayStart;
  for (const busy of mergeIntervals(clipped)) {
    if (busy.startAt > cursor) {
      free.push({
        start_time: timestampToDayTime(cursor, dayStart),
        end_time: timestampToDayTime(busy.startAt, dayStart),
      });
    }
    cursor = Math.max(cursor, busy.endAt);
  }
  if (cursor < dayEnd) {
    free.push({
      start_time: timestampToDayTime(cursor, dayStart),
      end_time: timestampToDayTime(dayEnd, dayStart, true),
    });
  }
  return free;
};

const publicBusySlot = (block) => ({
  type: block.type,
  id: block.id,
  title: block.title,
  ...(block.status ? { status: block.status } : {}),
  date: block.date,
  start_time: block.start_time,
  end_time: block.end_time,
  start_at: block.start_at,
  end_at: block.end_at,
  overnight: block.overnight,
  end_day_offset: block.end_day_offset,
});

/**
 * Build availability for one calendar day. Items anchored on the previous
 * day must be included by the caller so overnight spillover is represented.
 */
const buildDayAvailability = (
  scheduleItems,
  bookingItems,
  dateOnly,
  opts = {}
) => {
  const dayStart = dateOnlyToUtcMs(dateOnly);
  if (dayStart == null) {
    return { busy_slots: [], free_slots: [], is_fully_free: false };
  }
  const dayEnd = dayStart + DAY_MS;
  const allBusy = collectBusyIntervals(scheduleItems, bookingItems, opts);
  const busy = allBusy.filter((block) =>
    intervalsOverlap(block.startAt, block.endAt, dayStart, dayEnd)
  );

  return {
    busy_slots: busy.map(publicBusySlot),
    free_slots: freeSlotsFromBusy(busy, dayStart),
    is_fully_free: busy.length === 0,
  };
};

/**
 * Check a slot anchored on dateOnly. end_time before start_time means next day.
 */
const isSlotAvailable = (
  scheduleItems,
  bookingItems,
  dateOnly,
  start_time,
  end_time,
  opts = {}
) => {
  const timeError = validateTimeRange(start_time, end_time);
  if (timeError) return { available: false, error: timeError };

  const requested = buildAbsoluteInterval(dateOnly, start_time, end_time);
  if (!requested) return { available: false, error: "Invalid date or time" };

  const busy = collectBusyIntervals(scheduleItems, bookingItems, opts);
  for (const block of busy) {
    if (
      intervalsOverlap(
        requested.startAt,
        requested.endAt,
        block.startAt,
        block.endAt
      )
    ) {
      return { available: false, conflict: publicBusySlot(block) };
    }
  }

  return {
    available: true,
    overnight: requested.overnight,
    end_day_offset: requested.end_day_offset,
    start_at: requested.start_at,
    end_at: requested.end_at,
  };
};

module.exports = {
  BUSY_BOOKING_STATUSES,
  DAY_MS,
  hasTimeValue,
  parseTime,
  timeToMinutes,
  minutesToTime,
  formatDateOnly,
  addDaysDateOnly,
  validateTimeRange,
  buildAbsoluteInterval,
  intervalsOverlap,
  buildDayAvailability,
  isSlotAvailable,
};
