// config/sessionConfig.js
// Express Session Configuration with MySQL Store
// Sessions persist after server restart and do not regenerate for returning guests

const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

/**
 * Session Configuration
 * 
 * Features:
 * - Persistent session storage in MySQL (survives server restart)
 * - Sessions do NOT regenerate for returning guests with same browser
 * - HTTPOnly and Secure cookies with proper maxAge
 * - Automatic session cleanup after expiration
 * - 24-hour default session expiration (customizable via environment)
 */

module.exports = function createSessionConfig(db) {
  // Session expiration time in milliseconds (24 hours by default)
  // Customize via SESSION_EXPIRATION_MS environment variable
  const SESSION_EXPIRATION_MS = parseInt(process.env.SESSION_EXPIRATION_MS, 10) || (24 * 60 * 60 * 1000); // 24 hours

  // MySQL Store configuration with proper settings for persistent sessions
  // express-mysql-session requires a promise-compatible connection when
  // using async/await or .then/.catch; mysql2 provides this via .promise()
  const connectionForStore = db && typeof db.promise === 'function' ? db.promise() : db;

  const sessionStore = new MySQLStore(
    {
      expiration: SESSION_EXPIRATION_MS, // Store-side expiration in ms
      createDatabaseTable: true, // Auto-create sessions table if not exists
      schema: {
        tableName: 'sessions',
        columnNames: {
          session_id: 'session_id',
          expires: 'expires',
          data: 'data'
        }
      },
      // Cleanup interval: run every 15 minutes to remove expired sessions
      checkExpirationInterval: 15 * 60 * 1000
    },
    connectionForStore
  );

  // Session middleware configuration
  const sessionConfig = {
    // Secret for signing session IDs (should be unique and strong in production)
    secret: process.env.SESSION_SECRET || 'shopsphere-session-secret-change-in-production',
    
    // Use MySQL store for persistence
    store: sessionStore,
    
    // CRITICAL settings to prevent unnecessary session regeneration:
    // resave: false - Only save session if it was modified (prevents regeneration)
    // saveUninitialized: true - CREATE session for all visitors (needed for guest carts)
    resave: false,
    saveUninitialized: true,
    
    // Session ID cookie name (custom to avoid conflicts)
    name: 'shopsphere.sid',
    
    // Cookie configuration - CRITICAL for persistence across restarts
    cookie: {
      // httpOnly: true prevents client-side JavaScript from accessing the session ID
      // This reduces XSS vulnerability
      httpOnly: true,
      
      // Secure: Only send cookie over HTTPS (enable in production)
      secure: process.env.NODE_ENV === 'production',
      
      // SameSite: Prevents CSRF attacks by controlling when cookie is sent
      sameSite: 'lax', // 'lax' allows some cross-site requests, 'strict' is more restrictive
      
      // maxAge: Session expiration time in milliseconds (matches store expiration)
      // CRITICAL: This determines when the browser deletes the cookie
      // Set to 24 hours (same as store expiration for consistency)
      maxAge: SESSION_EXPIRATION_MS,
      
      // Optional: Set domain if needed for subdomain sharing
      domain: process.env.COOKIE_DOMAIN || undefined
    },
    
    // Proxy trust for production environments
    proxy: process.env.NODE_ENV === 'production'
  };

  return {
    middleware: session(sessionConfig),
    store: sessionStore
  };
};
