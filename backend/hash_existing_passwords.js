const mysql = require("mysql2/promise"); // promise version
const bcrypt = require("bcrypt");

// CLI options: --dry-run to avoid writing to DB
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS, 10) || 10;

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

(async () => {
  try {
    const db = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASS || "Nimra123",
      database: process.env.DB_NAME || "Shopsphere"
    });

    console.log("✅ Connected to DB");

    const [users] = await db.query("SELECT id, password FROM users");
    console.log(`🔹 Found ${users.length} users.`);

    let updated = 0;
    let skipped = 0;

    for (let user of users) {
      if (!user.password || typeof user.password !== 'string') {
        console.log(`⚠️ User ID ${user.id} has empty or invalid password, skipping`);
        skipped++;
        continue;
      }

      if (!user.password.startsWith("$2")) { // not bcrypt hash
        const rounds = Math.min(Math.max(SALT_ROUNDS, 4), 20);
        const hashed = await bcrypt.hash(user.password, rounds);
        if (DRY_RUN) {
          console.log(`(dry) ✅ Would hash User ID ${user.id}`);
        } else {
          await db.query("UPDATE users SET password = ? WHERE id = ?", [hashed, user.id]);
          console.log(`✅ User ID ${user.id} password hashed`);
        }
        updated++;
      } else {
        console.log(`ℹ️ User ID ${user.id} already hashed, skipping`);
        skipped++;
      }
    }

    console.log(`✅ All users processed! Updated: ${updated}, Skipped: ${skipped}`);
    await db.end();
    process.exit(0);
  } catch (e) {
    console.error("❌ Error:", e);
    process.exit(1);
  }
})();
