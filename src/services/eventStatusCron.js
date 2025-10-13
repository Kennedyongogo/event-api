const { Event } = require("../models");
const { Op } = require("sequelize");

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

      // Find all approved events where the event has ended
      const eventsToComplete = await Event.findAll({
        where: {
          status: "approved",
          [Op.and]: [
            // Event date is today or in the past
            {
              event_date: {
                [Op.lte]: now,
              },
            },
            // Either no end_time specified (assume end of day) or end_time has passed
            {
              [Op.or]: [
                // No end_time specified - consider event ended at end of day
                { end_time: null },
                // End_time has passed today
                {
                  [Op.and]: [
                    {
                      event_date: {
                        [Op.gte]: new Date(
                          now.getFullYear(),
                          now.getMonth(),
                          now.getDate()
                        ),
                      },
                    },
                    {
                      end_time: {
                        [Op.lt]: now.toTimeString().slice(0, 8), // HH:MM:SS format
                      },
                    },
                  ],
                },
                // Event date is in the past (regardless of end_time)
                {
                  event_date: {
                    [Op.lt]: new Date(
                      now.getFullYear(),
                      now.getMonth(),
                      now.getDate()
                    ),
                  },
                },
              ],
            },
          ],
        },
        attributes: [
          "id",
          "event_name",
          "event_date",
          "start_time",
          "end_time",
          "status",
        ],
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
