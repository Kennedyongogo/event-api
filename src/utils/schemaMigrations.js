const jsonDefaultLiteral = (udtName) =>  String(udtName || "").toLowerCase() === "jsonb" ? "'[]'::jsonb" : "'[]'::json";

const backfillProfileImagesSql = (udtName) => {
  const isJsonb = String(udtName || "").toLowerCase() === "jsonb";
  const emptyCheck = isJsonb
    ? "(profile_images IS NULL OR profile_images = '[]'::jsonb)"
    : "(profile_images IS NULL OR profile_images::text = '[]')";
  const valueExpr = isJsonb
    ? "jsonb_build_array(profile_image)"
    : "to_json(ARRAY[profile_image])";

  return `
    UPDATE users
    SET profile_images = ${valueExpr}
    WHERE profile_image IS NOT NULL
      AND profile_image <> ''
      AND ${emptyCheck};
  `;
};

const migrateGenreToJsonArray = async (sequelize) => {
  const [rows] = await sequelize.query(`
    SELECT data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'genre'
    LIMIT 1;
  `);

  if (!rows.length) return;

  const dataType = String(rows[0].data_type || "").toLowerCase();
  const udtName = String(rows[0].udt_name || "").toLowerCase();
  const isJson =
    dataType === "json" ||
    dataType === "jsonb" ||
    udtName === "json" ||
    udtName === "jsonb";

  if (isJson) {
    await sequelize.query(`
      ALTER TABLE users
      ALTER COLUMN genre SET DEFAULT ${jsonDefaultLiteral(udtName)};
    `);
    return;
  }

  console.log("🔄 Migrating users.genre from text to JSON array...");
  await sequelize.query(`
    ALTER TABLE users
    ALTER COLUMN genre TYPE JSONB
    USING (
      CASE
        WHEN genre IS NULL OR btrim(genre::text) = '' THEN '[]'::jsonb
        WHEN left(btrim(genre::text), 1) = '[' THEN genre::jsonb
        ELSE jsonb_build_array(btrim(genre::text))
      END
    );
  `);
  await sequelize.query(`
    ALTER TABLE users
    ALTER COLUMN genre SET DEFAULT '[]'::jsonb;
  `);
  console.log("✅ users.genre migrated to JSON array");
};

const migrateProfileImagesColumn = async (sequelize) => {
  const [rows] = await sequelize.query(`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'profile_images'
    LIMIT 1;
  `);

  if (rows.length) {
    await sequelize.query(backfillProfileImagesSql(rows[0].udt_name));
    return;
  }

  console.log("🔄 Adding users.profile_images column...");
  await sequelize.query(`
    ALTER TABLE users
    ADD COLUMN profile_images JSON DEFAULT '[]'::json;
  `);
  await sequelize.query(backfillProfileImagesSql("json"));
  console.log("✅ users.profile_images column ready");
};

const runSchemaMigrations = async (sequelize) => {
  await migrateGenreToJsonArray(sequelize);
  await migrateProfileImagesColumn(sequelize);
};

module.exports = {
  runSchemaMigrations,
  migrateGenreToJsonArray,
  migrateProfileImagesColumn,
};
