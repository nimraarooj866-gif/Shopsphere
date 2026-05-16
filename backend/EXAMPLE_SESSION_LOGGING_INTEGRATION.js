// backend/EXAMPLE_SESSION_LOGGING_INTEGRATION.js
// 
// This file shows EXACTLY where and how to add session logging to your index.js
// Copy the relevant code snippets to your actual index.js file

// ============================================
// PART 1: ADD THESE IMPORTS AT THE TOP
// ============================================

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const mysql = require('mysql2');
const path = require('path');
const bodyParser = require('body-parser');

// ADD THESE IMPORTS:
const { SessionLogger, createSessionLoggingMiddleware, createAPILoggingMiddleware } = require('./middleware/sessionLoggingMiddleware');
const sessionLogRoutes = require('./routes/sessionLogRoutes');


// ============================================
// PART 2: DATABASE CONNECTION & LOGGER SETUP
// ============================================

const app = express();

// Existing middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// Existing session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'shopsphere-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Database connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Nimra123",
  database: "Shopsphere"
});

db.connect(err => {
  if (err) {
    console.log("DB Error:", err);
  } else {
    console.log("MySQL Connected");

    // CREATE ADMIN TABLE (existing code)
    const createAdminTable = `
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) DEFAULT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    
    db.query(createAdminTable, (err) => {
      if (err) console.error("Failed to ensure admins table:", err);
      else console.log("Admins table ready");
    });

    // ===== ADD THIS: INITIALIZE SESSION LOGGER =====
    const sessionLogger = new SessionLogger(db, {
      enableFileLogging: true,
      enableDatabaseLogging: true,
      enableConsoleLogging: true,
      logsDir: path.join(__dirname, 'logs')
    });
    
    // Make sessionLogger globally accessible
    global.sessionLogger = sessionLogger;
  }
});


// ============================================
// PART 3: ADD SESSION LOGGING MIDDLEWARE
// ============================================

// ===== ADD THESE LINES AFTER SESSION SETUP BUT BEFORE ROUTES =====
app.use(createSessionLoggingMiddleware(global.sessionLogger || {}));
app.use(createAPILoggingMiddleware(global.sessionLogger || {}));


// ============================================
// PART 4: ADD DATABASE TO REQUEST OBJECT
// ============================================

// Add this middleware so routes have access to db
app.use((req, res, next) => {
  req.db = db;
  next();
});


// ============================================
// PART 5: ADD SESSION LOG ROUTES
// ============================================

// Mount the session logging routes BEFORE other routes
app.use('/api/session-logs', sessionLogRoutes);

// Then your other routes can follow...


// ============================================
// PART 6: UPDATE YOUR LOGIN ENDPOINT
// ============================================

// Find your existing login endpoint and update it:

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  // Your existing authentication code
  const query = "SELECT * FROM users WHERE email = ?";
  
  db.query(query, [email], async (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    if (result.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Password verification (your existing code)
    const user = result[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // ===== ADD THIS: Set user in session and log login =====
    req.session.userId = user.id;
    
    // Log the login activity
    if (global.sessionLogger) {
      global.sessionLogger.log(req.sessionID, 'USER_LOGIN', {
        userId: user.id,
        email: email
      }, req);
    }

    // Send success response
    res.json({ 
      success: true, 
      message: 'Login successful',
      user: { id: user.id, email: user.email, name: user.name }
    });
  });
});


// ============================================
// PART 7: CREATE/UPDATE LOGOUT ENDPOINT
// ============================================

// Add or update your logout endpoint:

app.post('/api/auth/logout', (req, res) => {
  const userId = req.session.userId;
  const sessionId = req.sessionID;

  // ===== ADD THIS: Log the logout =====
  if (userId && global.sessionLogger) {
    global.sessionLogger.log(sessionId, 'USER_LOGOUT', {
      userId: userId
    }, req);
  }

  // Destroy the session
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});


// ============================================
// PART 8: OPTIONAL - ADMIN ROUTES
// ============================================

// Add optional admin endpoints to view session logs:

// Route for admin dashboard to view active sessions
app.get('/api/admin/sessions/active', (req, res) => {
  // Check if user is admin (add your auth logic)
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Query active sessions
  const sql = `
    SELECT DISTINCT 
      sl.session_id,
      sl.user_id,
      sl.ip_address,
      MAX(sl.timestamp) as last_activity,
      COUNT(*) as activity_count
    FROM session_logs sl
    WHERE sl.timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)
    GROUP BY sl.session_id
    ORDER BY last_activity DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch active sessions' });
    }
    res.json({ success: true, sessions: results });
  });
});

// Route to get user activity
app.get('/api/admin/user/:userId/activity', (req, res) => {
  // Check if user is admin
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = req.params.userId;

  const sql = `
    SELECT 
      timestamp,
      activity,
      session_id,
      ip_address,
      details
    FROM session_logs
    WHERE user_id = ?
    ORDER BY timestamp DESC
    LIMIT 100
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch activity' });
    }

    const formatted = results.map(r => ({
      ...r,
      details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details,
      timestamp: new Date(r.timestamp).toLocaleString()
    }));

    res.json({ success: true, activity: formatted });
  });
});


// ============================================
// PART 9: START SERVER (existing code)
// ============================================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


// ============================================
// TESTING THE SESSION LOGGING
// ============================================

/*
Once integrated, test with these curl commands:

1. Check active sessions:
   curl http://localhost:5000/api/session-logs/active

2. Get user activity:
   curl http://localhost:5000/api/session-logs/timeline/1

3. Get session statistics:
   curl http://localhost:5000/api/session-logs/stats/activity

4. Export logs as CSV:
   curl http://localhost:5000/api/session-logs/export?format=csv > logs.csv

5. Get anomalies:
   curl http://localhost:5000/api/session-logs/anomalies

6. Generate report:
   curl http://localhost:5000/api/session-logs/report
*/


// ============================================
// SUMMARY OF CHANGES NEEDED
// ============================================

/*
In your index.js, you need to:

1. ✓ Import SessionLogger and middleware (line ~10)
2. ✓ Create SessionLogger instance in db.connect callback (line ~65)
3. ✓ Add logging middleware after session setup (line ~120)
4. ✓ Add req.db middleware (line ~130)
5. ✓ Mount session log routes (line ~135)
6. ✓ Log login in auth endpoint (after req.session.userId = user.id)
7. ✓ Add logout endpoint with logging
8. ✓ Optional: Add admin viewing routes

Total Code Added: ~50 lines
Files Created: 4 new files
New Database Table: session_logs (auto-created)
*/


module.exports = {};
