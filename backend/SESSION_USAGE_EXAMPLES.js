/**
 * Session Usage Examples for Express Routes
 * 
 * Shows how to work with persistent sessions configured with MySQL store
 * These sessions survive server restarts and don't regenerate for returning guests
 */

// ============================================================
// EXAMPLE 1: Creating a Session (Login)
// ============================================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Verify user credentials...
    const user = await verifyUser(email, password);
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Store user info in session (MySQL store will persist this)
    // Session ID automatically sent to browser as shopsphere.sid cookie
    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.role = user.role;
    req.session.loginTime = new Date();
    
    // Session is automatically saved to MySQL database
    res.json({ 
      message: 'Login successful',
      sessionId: req.sessionID
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// EXAMPLE 2: Accessing Session Data (Persist across requests)
// ============================================================
router.get('/profile', (req, res) => {
  // req.session is automatically populated from MySQL store
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  // Session data retrieved from MySQL:
  res.json({
    userId: req.session.userId,
    email: req.session.email,
    role: req.session.role,
    loginTime: req.session.loginTime
  });
});

// ============================================================
// EXAMPLE 3: Modifying Session Data
// ============================================================
router.post('/update-profile', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  // Update session data
  req.session.firstName = req.body.firstName;
  req.session.lastName = req.body.lastName;
  
  // Session changes automatically saved to MySQL
  // NOTE: With resave: false, only modified sessions are saved
  
  res.json({ message: 'Profile updated' });
});

// ============================================================
// EXAMPLE 4: Session Persistence (Server Restart Test)
// ============================================================
/**
 * Scenario: User logs in, then server restarts
 * 
 * Step 1: User login
 *   POST /login
 *   → req.session.userId = 123
 *   → Stored in MySQL sessions table
 *   → Browser receives shopsphere.sid cookie
 * 
 * Step 2: Server restarts
 *   → MySQL database is still there
 *   → Sessions table unchanged
 *   → Browser cookie (shopsphere.sid) not affected
 * 
 * Step 3: User refreshes page
 *   → Browser sends shopsphere.sid cookie to new server
 *   → Server looks up session in MySQL
 *   → req.session.userId = 123 is restored
 *   → User stays logged in!
 * 
 * Result: NO SESSION REGENERATION
 */

// ============================================================
// EXAMPLE 5: Destroying a Session (Logout)
// ============================================================
router.post('/logout', (req, res) => {
  // Destroy session - removes from MySQL
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    
    // Clear browser cookie
    res.clearCookie('shopsphere.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

// ============================================================
// EXAMPLE 6: Authentication Middleware
// ============================================================
const requireAuth = (req, res, next) => {
  // Session loaded from MySQL automatically
  if (!req.session.userId) {
    return res.status(401).json({ 
      message: 'Authentication required',
      redirectTo: '/login'
    });
  }
  
  next();
};

// Use middleware to protect routes
router.get('/protected-data', requireAuth, (req, res) => {
  // Session guaranteed to exist here
  res.json({
    userId: req.session.userId,
    data: 'Protected content'
  });
});

// ============================================================
// EXAMPLE 7: Session Timeout
// ============================================================
/**
 * How timeout works:
 * 
 * A. Browser-side timeout:
 *    - Cookie has maxAge = 24 hours (default)
 *    - Browser automatically deletes cookie after 24 hours
 *    - User has to log in again
 * 
 * B. Server-side timeout:
 *    - MySQL sessions table has expires timestamp
 *    - Cleanup runs every 15 minutes
 *    - Expired sessions removed from database
 *    - Even if browser doesn't delete cookie, server won't find session
 * 
 * Both should match! Set in backend/config/sessionConfig.js:
 *    SESSION_EXPIRATION_MS = 24 * 60 * 60 * 1000 (24 hours)
 */

// Customize via environment:
// SESSION_EXPIRATION_MS=604800000  (7 days)
// SESSION_EXPIRATION_MS=3600000    (1 hour)

// ============================================================
// EXAMPLE 8: Guest vs Authenticated Sessions
// ============================================================
router.get('/cart', (req, res) => {
  // Session exists for EVERYONE (guest or logged in)
  // With saveUninitialized: false, it's only created when needed
  
  if (!req.session.cart) {
    req.session.cart = [];
  }
  
  // Even guests have a persistent session ID
  // Their cart persists after server restart!
  
  res.json({
    cartId: req.sessionID,
    items: req.session.cart,
    isAuthenticated: req.session.userId ? true : false
  });
});

router.post('/cart/add', (req, res) => {
  if (!req.session.cart) {
    req.session.cart = [];
  }
  
  req.session.cart.push(req.body.item);
  
  // Auto-saved to MySQL for both guests and logged-in users!
  
  res.json({ 
    message: 'Item added to cart',
    items: req.session.cart 
  });
});

// ============================================================
// IMPORTANT NOTES
// ============================================================

/**
 * KEY FEATURES CONFIGURED:
 * 
 * 1. PERSISTENCE ACROSS RESTARTS
 *    - Sessions stored in MySQL, not memory
 *    - Server restart = session data survives
 * 
 * 2. NO SESSION REGENERATION
 *    - resave: false - prevents unnecessary regeneration
 *    - Same guest with same browser = same session ID
 *    - sessionID doesn't change after restart
 * 
 * 3. PROPER COOKIE SETTINGS
 *    - maxAge synchronized with server expiration
 *    - httpOnly prevents XSS attacks
 *    - secure: true in production (HTTPS only)
 * 
 * 4. GUEST SESSIONS
 *    - Guests also get persistent sessions
 *    - Their carts/preferences survive restart
 *    - No need to be logged in to use sessions
 * 
 * 5. AUTOMATIC CLEANUP
 *    - Expired sessions removed from database
 *    - Prevents table from growing indefinitely
 *    - Runs every 15 minutes automatically
 */

// ============================================================
// MONITORING SESSION USE
// ============================================================

/**
 * Check session table from MySQL:
 * 
 * SELECT COUNT(*) as session_count FROM sessions;
 * 
 * SELECT session_id, 
 *        FROM_UNIXTIME(expires/1000) as expires_at,
 *        CHAR_LENGTH(data) as data_size 
 * FROM sessions 
 * WHERE expires > UNIX_TIMESTAMP(NOW())*1000
 * LIMIT 10;
 */

module.exports = {
  requireAuth
};
