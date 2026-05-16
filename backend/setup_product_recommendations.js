/**
 * Setup script to initialize product_conditions table
 * and populate with skin condition mappings
 * Run this ONCE to set up the database
 */

const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Nimra123",
  database: "Shopsphere"
});

db.connect(err => {
  if (err) {
    console.error("❌ Database connection failed:", err);
    process.exit(1);
  }
  
  console.log("✓ Connected to Shopsphere database");

  // Read SQL file
  const sqlFilePath = path.join(__dirname, 'skin_conditions_mapping.sql');
  let sqlContent;
  
  try {
    sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
  } catch (err) {
    console.error("❌ Could not read SQL file:", err);
    process.exit(1);
  }

  // Split by semicolon and execute each statement
  const statements = sqlContent
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);

  let completed = 0;

  const executeStatement = (index) => {
    if (index >= statements.length) {
      console.log("\n✅ Database setup completed successfully!");
      console.log("✅ Product recommendations are now ready to use");
      db.end();
      process.exit(0);
    }

    const statement = statements[index];
    
    db.query(statement, (err, results) => {
      if (err) {
        console.error(`❌ Error executing statement ${index + 1}:`, err.message);
        db.end();
        process.exit(1);
      }
      
      console.log(`✓ Statement ${index + 1}/${statements.length} executed`);
      executeStatement(index + 1);
    });
  };

  executeStatement(0);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.end();
  process.exit(0);
});
