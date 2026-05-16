-- Fix missing session_logs table
-- Run this if session_logs table doesn't exist

USE Shopsphere;

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

-- Verify table was created
SHOW TABLES LIKE 'session_logs';

-- You should see one row if successful
