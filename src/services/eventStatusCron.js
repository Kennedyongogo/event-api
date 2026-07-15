const { Event } = require("../models");
const { parseTime, formatDateOnly } = require("../utils/artistAvailability");

const eventEndDateTime = (event) => {
  const dateOnly = formatDateOnly(event.event_date);
  if (!dateOnly) return null;
  const [year, month, day] = dateOnly.split("-").map(Number);

  if (!event.end_time) {
    return new Date(year, month - 1, day, 23, 59, 59, 999);
  }

  const end = parseTime(event.end_time);
  if (!end) return null;
  const start = parseTime(event.start_time);
  const overnight =
    start != null && end.totalSeconds < start.totalSeconds;

  return new Date(
    year,
    month - 1,
    day + (overnight ? 1 : 0),
    end.hours,
    end.minutes,
    end.seconds,
  );
};

/**
 * Event Status Cron Job
 * Automatically updates event status from 'approved' to 'completed'
 * when the event's end time has passed
 */
class EventStatusCron {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
  }

  /**
   * Check and update event statuses
   */
  async updateEventStatuses() {
    try {
      console.log("🔄 Running event status cron job...");

      const now = new Date();

      const approvedEvents = await Event.findAll({
        where: { status: "approved" },
        attributes: [
          "id",
          "event_name",
          "event_date",
          "start_time",
          "end_time",
          "status",
        ],
      });
      const eventsToComplete = approvedEvents.filter((event) => {
        const endsAt = eventEndDateTime(event);
        return endsAt != null && endsAt <= now;
      });

      if (eventsToComplete.length === 0) {
        console.log("✅ No events need status update");
        return;
      }

      console.log(
        `📅 Found ${eventsToComplete.length} events to mark as completed:`
      );

      // Log events being updated
      eventsToComplete.forEach((event) => {
        console.log(
          `  - ${event.event_name} (${event.event_date} ${
            event.end_time || "No end time"
          })`
        );
      });

      // Update status to completed
      const updatedEvents = await Event.update(
        {
          status: "completed",
          updatedAt: new Date(),
        },
        {
          where: {
            id: {
              [Op.in]: eventsToComplete.map((event) => event.id),
            },
          },
        }
      );

      console.log(
        `✅ Successfully updated ${updatedEvents[0]} events to 'completed' status`
      );

      return {
        success: true,
        updatedCount: updatedEvents[0],
        events: eventsToComplete.map((event) => ({
          id: event.id,
          event_name: event.event_name,
          event_date: event.event_date,
          end_time: event.end_time,
        })),
      };
    } catch (error) {
      console.error("❌ Error in event status cron job:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Start the cron job
   * @param {number} intervalMinutes - How often to run the check (default: 60 minutes)
   */
  start(intervalMinutes = 60) {
    if (this.isRunning) {
      console.log("⚠️ Event status cron job is already running");
      return;
    }

    console.log(
      `🚀 Starting event status cron job (every ${intervalMinutes} minutes)`
    );

    this.isRunning = true;

    // Run immediately on start
    this.updateEventStatuses();

    // Then run at specified intervals
    this.intervalId = setInterval(() => {
      this.updateEventStatuses();
    }, intervalMinutes * 60 * 1000); // Convert minutes to milliseconds
  }

  /**
   * Stop the cron job
   */
  stop() {
    if (!this.isRunning) {
      console.log("⚠️ Event status cron job is not running");
      return;
    }

    console.log("🛑 Stopping event status cron job");

    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Get cron job status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalId: this.intervalId,
    };
  }

  /**
   * Manual trigger for testing
   */
  async runOnce() {
    console.log("🔧 Manual trigger of event status cron job");
    return await this.updateEventStatuses();
  }
}

// Create singleton instance
const eventStatusCron = new EventStatusCron();

module.exports = eventStatusCron;
