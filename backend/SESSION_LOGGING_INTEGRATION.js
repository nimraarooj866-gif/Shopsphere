// SESSION LOGGING INTEGRATION GUIDE
// ===================================

// STEP 1: Add this to the top of your index.js file (after other require statements):
/*
const { SessionLogger, createSessionLoggingMiddleware, createAPILoggingMiddleware } = require('./middleware/sessionLoggingMiddleware');
const sessionLogRoutes = require('./routes/sessionLogRoutes');
*/

// STEP 2: After database connection is established, initialize session logger:
/*
// Initialize Session Logger (after db.connect callback)
const sessionLogger = new SessionLogger(db, {
  enableFileLogging: true,
  enableDatabaseLogging: true,
  enableConsoleLogging: true,
  logsDir: path.join(__dirname, 'logs')
});
*/

// STEP 3: Add session logging middleware after session middleware:
/*
// Session logging middleware
app.use(createSessionLoggingMiddleware(sessionLogger));
app.use(createAPILoggingMiddleware(sessionLogger));
*/

// STEP 4: Add session log routes after other routes:
/*
// Pass db to routes middleware
app.use((req, res, next) => {
  req.db = db;
  next();
});

// Session logging routes
app.use('/api/session-logs', sessionLogRoutes);
*/

// STEP 5: In your login endpoint, add this before successful response:
/*
if (result.length > 0) {
  req.session.userId = result[0].id;
  
  // Log login activity
  sessionLogger.log(req.sessionID, 'USER_LOGIN', {
    userId: result[0].id,
    email: email
  }, req);
  
  return res.json({ success: true, message: 'Login successful' });
}
*/

// STEP 6: In your logout endpoint, add:
/*
app.post('/api/logout', (req, res) => {
  const userId = req.session.userId;
  const sessionId = req.sessionID;
  
  if (userId) {
    sessionLogger.log(sessionId, 'USER_LOGOUT', { userId }, req);
  }
  
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ success: true, message: 'Logged out successfully' });
  });
});
*/

// ===== AVAILABLE API ENDPOINTS =====

// GET /api/session-logs/user/:userId
// - Get all sessions for a user
// - Example: /api/session-logs/user/123

// GET /api/session-logs/timeline/:userId?rows=100
// - Get activity timeline for a user
// - Example: /api/session-logs/timeline/123?rows=50

// GET /api/session-logs/active
// - Get all active sessions (last activity in past hour)

// GET /api/session-logs/stats/duration
// - Get session duration statistics

// GET /api/session-logs/stats/activity
// - Get activity breakdown by type

// GET /api/session-logs/stats/hourly
// - Get hourly activity statistics

// GET /api/session-logs/stats/top-users?limit=10
// - Get top active users

// GET /api/session-logs/stats/ip-activity?limit=20
// - Get IP address activity statistics

// GET /api/session-logs/report
// - Generate comprehensive session report

// GET /api/session-logs/anomalies
// - Get unusual session patterns

// GET /api/session-logs/export?userId=123&format=json
// - Export session logs (supports json and csv)
// - Query params: userId, sessionId, activity, startDate, endDate, format

// POST /api/session-logs/cleanup
// - Delete old session logs
// - Body: { "daysOld": 30 }

// ===== EXAMPLE USAGE =====

// Check active sessions
// curl http://localhost:5000/api/session-logs/active

// Get user activity timeline
// curl http://localhost:5000/api/session-logs/timeline/1?rows=50

// Export logs as CSV
// curl http://localhost:5000/api/session-logs/export?format=csv > logs.csv

// Get session anomalies
// curl http://localhost:5000/api/session-logs/anomalies

// Cleanup old logs (older than 30 days)
// curl -X POST http://localhost:5000/api/session-logs/cleanup -H "Content-Type: application/json" -d '{"daysOld":30}'

// ===== DATABASE TABLE CREATED =====
/*
CREATE TABLE IF NOT EXISTS session_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  user_id INT,
  activity VARCHAR(100) NOT NULL,
  ip_address VARCHAR(50),
  user_agent VARCHAR(500),
  details JSON,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session_id (session_id),
  INDEX idx_user_id (user_id),
  INDEX idx_activity (activity),
  INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
*/

// ===== ACTIVITIES LOGGED =====

// SESSION_CREATED - New session initialized
// USER_LOGIN - User logged in
// USER_LOGOUT - User logged out
// USER_SESSION_ACTIVE - User session is active
// API_CALL - API endpoint called
// (Any custom activity you define)

// ===== SAMPLE OUTPUT =====
/*
{
  "success": true,
  "timeline": [
    {
      "timestamp": "3/3/2026, 10:30:45 AM",
      "activity": "API_CALL",
      "session_id": "abc123def456",
      "ip_address": "192.168.1.100",
      "details": {
        "userId": 5,
        "method": "GET",
        "path": "/api/products",
        "statusCode": 200,
        "duration": 45
      }
    },
    {
      "timestamp": "3/3/2026, 10:25:12 AM",
      "activity": "USER_LOGIN",
      "session_id": "abc123def456",
      "ip_address": "192.168.1.100",
      "details": {
        "userId": 5,
        "email": "user@example.com"
      }
    }
  ]
}
*/

module.exports = {};
