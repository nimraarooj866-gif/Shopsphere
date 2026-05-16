// utils/sessionLogUtils.js
// Session Logging Utilities and Analytics

/**
 * Get all sessions for a specific user
 */
function getUserSessions(db, userId, callback) {
  const sql = `
    SELECT DISTINCT 
      session_id, 
      MIN(timestamp) as session_start,
      MAX(timestamp) as session_end,
      COUNT(*) as activity_count,
      GROUP_CONCAT(DISTINCT activity) as activities,
      ip_address
    FROM session_logs
    WHERE user_id = ?
    GROUP BY session_id
    ORDER BY session_start DESC
    LIMIT 50
  `;

  db.query(sql, [userId], callback);
}

/**
 * Get active sessions (last activity within past hour)
 */
function getActiveSessions(db, callback) {
  const sql = `
    SELECT 
      sl.session_id,
      MAX(sl.user_id) as user_id,
      MAX(sl.ip_address) as ip_address,
      MAX(sl.timestamp) as last_activity,
      COUNT(*) as activity_count
    FROM session_logs sl
    WHERE sl.timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)
    GROUP BY sl.session_id
    ORDER BY last_activity DESC
  `;

  db.query(sql, callback);
}

/**
 * Get session duration statistics
 */
function getSessionDurationStats(db, callback) {
  const sql = `
    SELECT 
      AVG(TIMESTAMPDIFF(MINUTE, MIN(timestamp), MAX(timestamp))) as avg_duration_minutes,
      MAX(TIMESTAMPDIFF(MINUTE, MIN(timestamp), MAX(timestamp))) as max_duration_minutes,
      MIN(TIMESTAMPDIFF(MINUTE, MIN(timestamp), MAX(timestamp))) as min_duration_minutes,
      COUNT(DISTINCT session_id) as total_sessions
    FROM session_logs
    WHERE timestamp > DATE_SUB(NOW(), INTERVAL 7 DAY)
  `;

  db.query(sql, callback);
}

/**
 * Get activity breakdown
 */
function getActivityBreakdown(db, callback) {
  const sql = `
    SELECT 
      activity,
      COUNT(*) as count,
      COUNT(DISTINCT session_id) as unique_sessions,
      COUNT(DISTINCT user_id) as unique_users
    FROM session_logs
    WHERE timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)
    GROUP BY activity
    ORDER BY count DESC
  `;

  db.query(sql, callback);
}

/**
 * Get user activity timeline
 */
function getUserActivityTimeline(db, userId, numRows = 100, callback) {
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
    LIMIT ?
  `;

  db.query(sql, [userId, numRows], callback);
}

/**
 * Get hourly activity statistics
 */
function getHourlyActivityStats(db, callback) {
  const sql = `
    SELECT 
      DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00') as hour,
      COUNT(*) as total_events,
      COUNT(DISTINCT session_id) as sessions,
      COUNT(DISTINCT user_id) as active_users
    FROM session_logs
    WHERE timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)
    GROUP BY DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00')
    ORDER BY hour DESC
  `;

  db.query(sql, callback);
}

/**
 * Get top users by activity
 */
function getTopActiveUsers(db, limit = 10, callback) {
  const sql = `
    SELECT 
      user_id,
      COUNT(*) as activity_count,
      COUNT(DISTINCT session_id) as session_count,
      MAX(timestamp) as last_active,
      GROUP_CONCAT(DISTINCT ip_address) as ip_addresses
    FROM session_logs
    WHERE user_id IS NOT NULL AND timestamp > DATE_SUB(NOW(), INTERVAL 7 DAY)
    GROUP BY user_id
    ORDER BY activity_count DESC
    LIMIT ?
  `;

  db.query(sql, [limit], callback);
}

/**
 * Get IP address activity
 */
function getIPActivityStats(db, limit = 20, callback) {
  const sql = `
    SELECT 
      ip_address,
      COUNT(*) as activity_count,
      COUNT(DISTINCT session_id) as sessions,
      COUNT(DISTINCT user_id) as users,
      MAX(timestamp) as last_activity
    FROM session_logs
    WHERE ip_address IS NOT NULL AND timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)
    GROUP BY ip_address
    ORDER BY activity_count DESC
    LIMIT ?
  `;

  db.query(sql, [limit], callback);
}

/**
 * Export session logs to CSV
 */
function exportSessionLogs(db, filters = {}, callback) {
  let sql = 'SELECT * FROM session_logs WHERE 1=1';
  let params = [];

  if (filters.userId) {
    sql += ' AND user_id = ?';
    params.push(filters.userId);
  }

  if (filters.sessionId) {
    sql += ' AND session_id = ?';
    params.push(filters.sessionId);
  }

  if (filters.activity) {
    sql += ' AND activity = ?';
    params.push(filters.activity);
  }

  if (filters.startDate) {
    sql += ' AND timestamp >= ?';
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    sql += ' AND timestamp <= ?';
    params.push(filters.endDate);
  }

  sql += ' ORDER BY timestamp DESC LIMIT 10000';

  db.query(sql, params, callback);
}

/**
 * Cleanup old session logs (older than specified days)
 */
function cleanupOldSessionLogs(db, daysOld = 30, callback) {
  const sql = `
    DELETE FROM session_logs
    WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)
  `;

  db.query(sql, [daysOld], callback);
}

/**
 * Get session anomalies (unusual patterns)
 */
function getSessionAnomalies(db, callback) {
  const sql = `
    SELECT 
      session_id,
      user_id,
      COUNT(*) as activity_count,
      COUNT(DISTINCT ip_address) as ip_count,
      GROUP_CONCAT(DISTINCT ip_address) as ip_addresses,
      MAX(timestamp) - MIN(timestamp) as session_duration,
      GROUP_CONCAT(DISTINCT activity) as activities
    FROM session_logs
    WHERE timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)
    GROUP BY session_id
    HAVING activity_count > 100 OR ip_count > 1
    ORDER BY activity_count DESC
  `;

  db.query(sql, callback);
}

/**
 * Format session log for display
 */
function formatSessionLog(log) {
  return {
    ...log,
    details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details,
    timestamp: new Date(log.timestamp).toLocaleString()
  };
}

/**
 * Generate comprehensive session report
 */
function generateSessionReport(db, callback) {
  Promise.all([
    new Promise((resolve) => getActiveSessions(db, (err, data) => resolve(data || []))),
    new Promise((resolve) => getSessionDurationStats(db, (err, data) => resolve(data || []))),
    new Promise((resolve) => getActivityBreakdown(db, (err, data) => resolve(data || []))),
    new Promise((resolve) => getTopActiveUsers(db, 5, (err, data) => resolve(data || [])))
  ]).then(([activeSessions, durationStats, activityBreakdown, topUsers]) => {
    callback(null, {
      activeSessions: activeSessions,
      durationStats: durationStats[0],
      activityBreakdown: activityBreakdown,
      topUsers: topUsers
    });
  }).catch((err) => callback(err, null));
}

module.exports = {
  getUserSessions,
  getActiveSessions,
  getSessionDurationStats,
  getActivityBreakdown,
  getUserActivityTimeline,
  getHourlyActivityStats,
  getTopActiveUsers,
  getIPActivityStats,
  exportSessionLogs,
  cleanupOldSessionLogs,
  getSessionAnomalies,
  formatSessionLog,
  generateSessionReport
};
