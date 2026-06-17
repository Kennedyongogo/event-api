require("dotenv").config();
const bcrypt = require("bcryptjs");
const { sequelize } = require("../src/config/database");
const User = require("../src/models/user")(sequelize);

const ADMIN = {
  full_name: "Kennedy Oduor",
  email: "ongogokennedy89@gmail.com",
  password: "123456",
  role: "admin",
};

async function ensureEmailRoleUnique() {
  const [indexes] = await sequelize.query(
    "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'users'"
  );

  const legacyEmailOnly = indexes.find(
    (idx) =>
      idx.indexdef.includes("UNIQUE") &&
      idx.indexdef.includes("(email)") &&
      !idx.indexdef.includes("role")
  );

  if (legacyEmailOnly) {
    console.log(`Removing legacy email-only unique: ${legacyEmailOnly.indexname}`);
    await sequelize.query(
      `ALTER TABLE users DROP CONSTRAINT IF EXISTS "${legacyEmailOnly.indexname}"`
    );
  }

  const hasComposite = indexes.some((idx) =>
    idx.indexname.includes("users_email_role_unique")
  );
  if (!hasComposite) {
    await sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS users_email_role_unique ON users (email, role)'
    );
    console.log("Ensured composite unique index on (email, role).");
  }
}

async function main() {
  try {
    await sequelize.authenticate();
    console.log("Database connected.");

    await ensureEmailRoleUnique();

    const normalizedEmail = ADMIN.email.toLowerCase().trim();
    const existing = await User.findOne({
      where: { email: normalizedEmail, role: "admin" },
    });

    const hashedPassword = await bcrypt.hash(ADMIN.password, 10);

    if (existing) {
      await existing.update({
        full_name: ADMIN.full_name,
        password: hashedPassword,
        isActive: true,
      });
      console.log("Admin already exists — password and details updated.");
      console.log(`  ID: ${existing.id}`);
      console.log(`  Email: ${normalizedEmail}`);
      return;
    }

    const admin = await User.create({
      full_name: ADMIN.full_name,
      email: normalizedEmail,
      password: hashedPassword,
      role: ADMIN.role,
      isActive: true,
    });

    console.log("Admin created successfully.");
    console.log(`  ID: ${admin.id}`);
    console.log(`  Name: ${admin.full_name}`);
    console.log(`  Email: ${admin.email}`);
  } catch (error) {
    console.error("Failed to create admin:", error.message);
    if (error.errors) {
      error.errors.forEach((e) => console.error(`  - ${e.path}: ${e.message}`));
    }
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
