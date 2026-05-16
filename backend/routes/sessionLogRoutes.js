// routes/sessionLogRoutes.js
// Session Logging API Routes

const express = require('express');
const router = express.Router();
const sessionLogUtils = require('../utils/sessionLogUtils');

/**
 * @route GET /api/session-logs/user/:userId
 * @desc Get all sessions for a specific user
 * @access Private (admin)
 */
router.get('/user/:userId', (req, res) => {
  const userId = req.params.userId;

  sessionLogUtils.getUserSessions(req.db, userId, (err, sessions) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch user sessions', details: err.message });
    }
    res.json({ success: true, sessions });
  });
});

/**
 * @route GET /api/session-logs/timeline/:userId
 * @desc Get activity timeline for a user
 * @access Private (admin)
 */
router.get('/timeline/:userId', (req, res) => {
  const userId = req.params.userId;
  const numRows = req.query.rows || 100;

  sessionLogUtils.getUserActivityTimeline(req.db, userId, numRows, (err, timeline) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch activity timeline', details: err.message });
    }
    
    const formattedTimeline = timeline.map(t => ({
      ...t,
      details: typeof t.details === 'string' ? JSON.parse(t.details) : t.details
    }));

    res.json({ success: true, timeline: formattedTimeline });
  });
});

/**
 * @route GET /api/session-logs/active
 * @desc Get all active sessions
 * @access Private (admin)
 */
router.get('/active', (req, res) => {
  sessionLogUtils.getActiveSessions(req.db, (err, sessions) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch active sessions', details: err.message });
    }
    res.json({ success: true, sessions });
  });
});

/**
 * @route GET /api/session-logs/stats/duration
 * @desc Get session duration statistics
 * @access Private (admin)
 */
router.get('/stats/duration', (req, res) => {
  sessionLogUtils.getSessionDurationStats(req.db, (err, stats) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch duration stats', details: err.message });
    }
    res.json({ success: true, stats: stats[0] });
  });
});

/**
 * @route GET /api/session-logs/stats/activity
 * @desc Get activity breakdown
 * @access Private (admin)
 */
router.get('/stats/activity', (req, res) => {
  sessionLogUtils.getActivityBreakdown(req.db, (err, breakdown) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch activity breakdown', details: err.message });
    }
    res.json({ success: true, breakdown });
  });
});

/**
 * @route GET /api/session-logs/stats/hourly
 * @desc Get hourly activity statistics
 * @access Private (admin)
 */
router.get('/stats/hourly', (req, res) => {
  sessionLogUtils.getHourlyActivityStats(req.db, (err, stats) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch hourly stats', details: err.message });
    }
    res.json({ success: true, stats });
  });
});

/**
 * @route GET /api/session-logs/stats/top-users
 * @desc Get top active users
 * @access Private (admin)
 */
router.get('/stats/top-users', (req, res) => {
  const limit = req.query.limit || 10;

  sessionLogUtils.getTopActiveUsers(req.db, limit, (err, users) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch top users', details: err.message });
    }
    res.json({ success: true, users });
  });
});

/**
 * @route GET /api/session-logs/stats/ip-activity
 * @desc Get IP address activity statistics
 * @access Private (admin)
 */
router.get('/stats/ip-activity', (req, res) => {
  const limit = req.query.limit || 20;

  sessionLogUtils.getIPActivityStats(req.db, limit, (err, ips) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch IP activity', details: err.message });
    }
    res.json({ success: true, ips });
  });
});

/**
 * @route GET /api/session-logs/report
 * @desc Generate comprehensive session report
 * @access Private (admin)
 */
router.get('/report', (req, res) => {
  sessionLogUtils.generateSessionReport(req.db, (err, report) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to generate report', details: err.message });
    }
    res.json({ success: true, report });
  });
});

/**
 * @route GET /api/session-logs/anomalies
 * @desc Get session anomalies
 * @access Private (admin)
 */
router.get('/anomalies', (req, res) => {
  sessionLogUtils.getSessionAnomalies(req.db, (err, anomalies) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch anomalies', details: err.message });
    }
    res.json({ success: true, anomalies });
  });
});

/**
 * @route GET /api/session-logs/export
 * @desc Export session logs
 * @access Private (admin)
 */
router.get('/export', (req, res) => {
  const filters = {
    userId: req.query.userId,
    sessionId: req.query.sessionId,
    activity: req.query.activity,
    startDate: req.query.startDate,
    endDate: req.query.endDate
  };

  sessionLogUtils.exportSessionLogs(req.db, filters, (err, logs) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to export logs', details: err.message });
    }

    // Format as CSV
    if (req.query.format === 'csv') {
      const csvContent = convertToCSV(logs);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="session-logs.csv"');
      res.send(csvContent);
    } else {
      res.json({ success: true, logs: logs.map(sessionLogUtils.formatSessionLog) });
    }
  });
});

/**
 * @route POST /api/session-logs/cleanup
 * @desc Delete old session logs
 * @access Private (admin)
 */
router.post('/cleanup', (req, res) => {
  const daysOld = req.body.daysOld || 30;

  sessionLogUtils.cleanupOldSessionLogs(req.db, daysOld, (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to cleanup logs', details: err.message });
    }
    res.json({ success: true, message: `Deleted logs older than ${daysOld} days`, affectedRows: result.affectedRows });
  });
});

/**
 * Convert array of objects to CSV format
 */
function convertToCSV(data) {
  if (!data || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(',');

  const csvRows = data.map(row => {
    return headers.map(header => {
      let value = row[header];
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        value = `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',');
  });

  return [csvHeaders, ...csvRows].join('\n');
}

module.exports = router;
