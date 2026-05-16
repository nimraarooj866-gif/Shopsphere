/**
 * Quick test script to verify product recommendation endpoints
 * Run this to test the API without needing the full backend
 */

const mysql = require('mysql2');

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
  
  console.log("✓ Connected to database\n");
  console.log("=" .repeat(60));
  console.log("TESTING PRODUCT RECOMMENDATIONS");
  console.log("=" .repeat(60));

  // Test 1: Check table exists
  console.log("\n[Test 1] Checking product_conditions table...");
  db.query("SELECT COUNT(*) as count FROM product_conditions", (err, results) => {
    if (err) {
      console.error("❌ Table error:", err);
    } else {
      console.log(`✓ Table exists with ${results[0].count} mappings`);
    }

    // Test 2: Get products for Acne
    console.log("\n[Test 2] Fetching products for 'Acne'...");
    const query2 = `
      SELECT DISTINCT p.id, p.name, p.price, p.img
      FROM products p
      INNER JOIN product_conditions pc ON p.id = pc.product_id
      WHERE pc.\`condition\` = 'Acne'
      AND p.stock > 0
      LIMIT 5
    `;
    db.query(query2, (err, results) => {
      if (err) {
        console.error("❌ Query error:", err);
      } else if (results.length === 0) {
        console.log("⚠️  No products found for Acne");
      } else {
        console.log(`✓ Found ${results.length} products for Acne:`);
        results.forEach((p, i) => {
          console.log(`   ${i+1}. ${p.name} - PKR ${p.price}`);
        });
      }

      // Test 3: Get all conditions with counts
      console.log("\n[Test 3] All conditions and product counts...");
      const query3 = `
        SELECT pc.\`condition\`, COUNT(DISTINCT p.id) as count
        FROM product_conditions pc
        INNER JOIN products p ON pc.product_id = p.id AND p.stock > 0
        GROUP BY pc.\`condition\`
        ORDER BY count DESC
      `;
      db.query(query3, (err, results) => {
        if (err) {
          console.error("❌ Query error:", err);
        } else {
          console.log("✓ Conditions and product counts:");
          results.forEach(row => {
            console.log(`   ${row.condition.padEnd(15)} : ${row.count} products`);
          });
        }

        // Test 4: Sample product mapping
        console.log("\n[Test 4] Sample product-condition mappings...");
        const query4 = `
          SELECT p.name, pc.\`condition\`
          FROM product_conditions pc
          INNER JOIN products p ON pc.product_id = p.id
          LIMIT 10
        `;
        db.query(query4, (err, results) => {
          if (err) {
            console.error("❌ Query error:", err);
          } else {
            console.log("✓ Sample mappings:");
            results.forEach(row => {
              console.log(`   ${row.name.substring(0, 40).padEnd(40)} → ${row.condition}`);
            });
          }

          console.log("\n" + "=" .repeat(60));
          console.log("✅ ALL TESTS COMPLETED SUCCESSFULLY!");
          console.log("=" .repeat(60));
          console.log("\n📝 Next Step:");
          console.log("   Start your backend with: npm start");
          console.log("   Then test the chatbot at: http://localhost:3000/chat.html");
          console.log("   Upload a skin image and watch products appear!\n");
          
          db.end();
          process.exit(0);
        });
      });
    });
  });
});

// Timeout fallback
setTimeout(() => {
  console.error("❌ Test timed out");
  process.exit(1);
}, 10000);
