/**
 * Production migration: add artist profile gallery column.
 * Run once against PostgreSQL when NODE_ENV=production (alter sync is off).
 *
 *   node scripts/add-profile-images-column.js
 */
const { directSequelize } = require("../src/config/database");

async function main() {
  try {
    await directSequelize.authenticate();
    await directSequelize.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS profile_images JSONB DEFAULT '[]'::jsonb;
    `);
    await directSequelize.query(`
      UPDATE users
      SET profile_images = jsonb_build_array(profile_image)
      WHERE profile_image IS NOT NULL
        AND profile_image <> ''
        AND (profile_images IS NULL OR profile_images = '[]'::jsonb);
    `);
    console.log("✅ profile_images column ready");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await directSequelize.close();
  }
}

main();
