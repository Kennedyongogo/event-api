/**
 * Test script for Event Status Cron Job
 * Run this to test the cron job functionality
 */

const cronManager = require("./src/services/cronManager");

async function testCronJob() {
  console.log("🧪 Testing Event Status Cron Job...\n");

  try {
    // Test manual execution
    console.log("1. Testing manual execution...");
    const result = await cronManager.runCronJob("eventStatus");
    console.log("Result:", JSON.stringify(result, null, 2));

    // Test cron status
    console.log("\n2. Testing cron status...");
    const status = cronManager.getStatus();
    console.log("Status:", JSON.stringify(status, null, 2));

    // Test starting cron jobs
    console.log("\n3. Testing cron job start...");
    cronManager.start();

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Test stopping cron jobs
    console.log("\n4. Testing cron job stop...");
    cronManager.stop();

    console.log("\n✅ All tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  }

  process.exit(0);
}

// Run the test
testCronJob();
