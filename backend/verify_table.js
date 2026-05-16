const mysql = require('mysql2');

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Nimra123",
  database: "Shopsphere"
});

db.connect(err => {
  if (err) {
    console.error('Connection error:', err);
    process.exit(1);
  }

  db.query('SHOW TABLES LIKE "product_conditions"', (err, res) => {
    if (err) {
      console.error('Query error:', err);
      db.end();
      process.exit(1);
    }

    console.log('Table product_conditions exists:', res.length > 0 ? 'YES' : 'NO');
    db.end();
  });
});