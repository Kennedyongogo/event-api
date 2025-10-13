const eventStatusCron = require("./eventStatusCron");

/**
 * Cron Manager
 * Manages all cron jobs in the application
 */
class CronManager {
  constructor() {
    this.cronJobs = {
      eventStatus: eventStatusCron,
    };
    this.isInitialized = false;
  }

  /**
   * Initialize all cron jobs
   */
  initialize() {
    if (this.isInitialized) {
      console.log("⚠️ Cron manager is already initialized");
      return;
    }

    console.log("🚀 Initializing cron jobs...");

    // Start event status cron job (runs every 60 minutes)
    this.cronJobs.eventStatus.start(60);

    this.isInitialized = true;
    console.log("✅ All cron jobs initialized successfully");
  }

  /**
   * Start all cron jobs
   */
  start() {
    console.log("🚀 Starting all cron jobs...");

    Object.values(this.cronJobs).forEach((cronJob) => {
      if (typeof cronJob.start === "function") {
        cronJob.start();
      }
    });
  }

  /**
   * Stop all cron jobs
   */
  stop() {
    console.log("🛑 Stopping all cron jobs...");

    Object.values(this.cronJobs).forEach((cronJob) => {
      if (typeof cronJob.stop === "function") {
        cronJob.stop();
      }
    });
  }

  /**
   * Get status of all cron jobs
   */
  getStatus() {
    const status = {};

    Object.entries(this.cronJobs).forEach(([name, cronJob]) => {
      if (typeof cronJob.getStatus === "function") {
        status[name] = cronJob.getStatus();
      }
    });

    return status;
  }

  /**
   * Get specific cron job
   */
  getCronJob(name) {
    return this.cronJobs[name];
  }

  /**
   * Manual trigger for testing
   */
  async runCronJob(name) {
    const cronJob = this.cronJobs[name];

    if (!cronJob) {
      throw new Error(`Cron job '${name}' not found`);
    }

    if (typeof cronJob.runOnce === "function") {
      return await cronJob.runOnce();
    } else {
      throw new Error(`Cron job '${name}' does not support manual execution`);
    }
  }
}

// Create singleton instance
const cronManager = new CronManager();

module.exports = cronManager;
