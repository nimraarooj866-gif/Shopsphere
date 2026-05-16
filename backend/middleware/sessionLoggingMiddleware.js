// middleware/sessionLoggingMiddleware.js
// Session Logging and Activity Tracking Middleware

const fs = require('fs');
const path = require('path');

/**
 * Session Logger Middleware
 * Tracks all session-related activities: creation, updates, destruction
 * Logs to both file and optionally database
 */

class SessionLogger {
  constructor(db, options = {}) {
    this.db = db;
    this.logsDir = options.logsDir || path.join(__dirname, '../logs');
    this.enableFileLogging = options.enableFileLogging !== false;
    this.enableDatabaseLogging = options.enableDatabaseLogging !== false;
    this.enableConsoleLogging = options.enableConsoleLogging !== false;

    // Ensure logs directory exists
    if (this.enableFileLogging && !fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }

    // Initialize database table for session logs
    if (this.enableDatabaseLogging && db) {
      this.initializeDatabaseTable();
    }
  }

  /**
   * Initialize session_logs table in database
   */
  initializeDatabaseTable() {
    const createTableSql = `
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
    `;

    this.db.query(createTableSql, (err) => {
      if (err) {
        console.error('Failed to create session_logs table:', err);
      } else {
        console.log('✓ Session logs table ready');
      }
    });
  }

  /**
   * Log activity to all enabled outputs
   */
  log(sessionId, activity, details = {}, req = null) {
    // format timestamp as MySQL DATETIME (YYYY-MM-DD HH:mm:ss)
    const mysqlTs = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const logData = {
      timestamp: mysqlTs,
      session_id: sessionId,
      activity: activity,
      user_id: details.userId || null,
      ip_address: details.ipAddress || (req ? req.ip : null),
      user_agent: req ? req.get('user-agent') : null,
      details: details
    };

    // Console logging
    if (this.enableConsoleLogging) {
      console.log(`[SESSION] ${activity} - Session: ${sessionId.substring(0, 8)}... at ${logData.timestamp}`);
    }

    // File logging
    if (this.enableFileLogging) {
      this.logToFile(logData);
    }

    // Database logging
    if (this.enableDatabaseLogging && this.db) {
      this.logToDatabase(logData);
    }
  }

  /**
   * Write log to file
   */
  logToFile(logData) {
    const fileName = `session-${new Date().toISOString().split('T')[0]}.log`;
    const filePath = path.join(this.logsDir, fileName);
    const logLine = JSON.stringify(logData) + '\n';

    fs.appendFile(filePath, logLine, (err) => {
      if (err) console.error('Error writing to session log file:', err);
    });
  }

  /**
   * Write log to database
   */
  logToDatabase(logData) {
    // omit timestamp column so default CURRENT_TIMESTAMP is used (avoids format errors)
    const sql = `
      INSERT INTO session_logs 
      (session_id, user_id, activity, ip_address, user_agent, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const values = [
      logData.session_id,
      logData.user_id,
      logData.activity,
      logData.ip_address,
      logData.user_agent,
      JSON.stringify(logData.details)
    ];

    this.db.query(sql, values, (err) => {
      if (err) console.error('Error logging to database:', err);
    });
  }

  /**
   * Get session logs for a specific session
   */
  getSessionLogs(sessionId, callback) {
    const sql = `
      SELECT * FROM session_logs 
      WHERE session_id = ? 
      ORDER BY timestamp DESC 
      LIMIT 100
    `;

    this.db.query(sql, [sessionId], callback);
  }

  /**
   * Get user session history
   */
  getUserSessionLogs(userId, callback) {
    const sql = `
      SELECT DISTINCT session_id, activity, timestamp, ip_address 
      FROM session_logs 
      WHERE user_id = ? 
      ORDER BY timestamp DESC 
      LIMIT 500
    `;

    this.db.query(sql, [userId], callback);
  }
}

/**
 * Middleware factory: Session activity tracking
 */
function createSessionLoggingMiddleware(sessionLogger) {
  return function sessionLoggingMiddleware(req, res, next) {
    const sessionId = req.sessionID;

    // Track session initialization
    if (!req.session.logged && sessionLogger && typeof sessionLogger.log === 'function') {
      req.session.logged = true;
      sessionLogger.log(sessionId, 'SESSION_CREATED', {
        isGuest: !req.session.userId
      }, req);
    }

    // Log on response finish to capture any session changes
    res.on('finish', () => {
      if (req.session.userId && !req.session.userActivityLogged && sessionLogger && typeof sessionLogger.log === 'function') {
        req.session.userActivityLogged = true;
        sessionLogger.log(sessionId, 'USER_SESSION_ACTIVE', {
          userId: req.session.userId,
          path: req.path,
          method: req.method
        }, req);
      }
    });

    next();
  };
}

/**
 * Middleware: Log user login
 */
function createLoginLoggingMiddleware(sessionLogger) {
  return function loginLoggingMiddleware(req, res, next) {
    res.on('finish', () => {
      if (res.statusCode === 200 && req.body.email && req.sessionID && sessionLogger && typeof sessionLogger.log === 'function') {
        sessionLogger.log(req.sessionID, 'USER_LOGIN', {
          userId: req.session.userId,
          email: req.body.email
        }, req);
      }
    });

    next();
  };
}

/**
 * Middleware: Log user logout
 */
function createLogoutLoggingMiddleware(sessionLogger) {
  return function logoutLoggingMiddleware(req, res, next) {
    const sessionId = req.sessionID;
    const userId = req.session.userId;

    req.on('end', () => {
      if (userId && sessionLogger && typeof sessionLogger.log === 'function') {
        sessionLogger.log(sessionId, 'USER_LOGOUT', {
          userId: userId
        }, req);
      }
    });

    next();
  };
}

/**
 * API endpoint middleware: Log all API calls
 */
function createAPILoggingMiddleware(sessionLogger) {
  return function apiLoggingMiddleware(req, res, next) {
    const sessionId = req.sessionID;
    const startTime = Date.now();

    res.on('finish', () => {
      if (sessionLogger && typeof sessionLogger.log === 'function') {
        const duration = Date.now() - startTime;
        sessionLogger.log(sessionId, 'API_CALL', {
          userId: req.session.userId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration: duration,
          query: Object.keys(req.query).length > 0 ? req.query : null
        }, req);
      }
    });

    next();
  };
}

/**
 * Get session statistics
 */
function getSessionStats(db, callback) {
  const sql = `
    SELECT 
      COUNT(DISTINCT session_id) as total_sessions,
      COUNT(DISTINCT user_id) as total_users,
      COUNT(*) as total_events,
      MAX(timestamp) as last_activity
    FROM session_logs
    WHERE timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)
  `;

  db.query(sql, callback);
}

module.exports = {
  SessionLogger,
  createSessionLoggingMiddleware,
  createLoginLoggingMiddleware,
  createLogoutLoggingMiddleware,
  createAPILoggingMiddleware,
  getSessionStats
};
