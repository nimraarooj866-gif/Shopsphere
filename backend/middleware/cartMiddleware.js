// middleware/cartMiddleware.js
// Cart initialization and session management middleware

/**
 * Initialize Guest Cart in Session
 * 
 * Ensures every visitor (guest or logged-in) has:
 * - A unique session
 * - A cart object to store guest items
 * 
 * This allows guests to add items before login
 */
function initializeGuestCart(req, res, next) {
  if (!req.session) {
    return res.status(500).json({ message: 'Session not initialized' });
  }

  // Initialize guest cart if it doesn't exist
  if (!req.session.cart) {
    req.session.cart = [];
  }

  // Ensure cart is always an array
  if (!Array.isArray(req.session.cart)) {
    req.session.cart = [];
  }

  next();
}

/**
 * Track Active Guest Sessions
 * Useful for analytics and understanding visitor behavior
 */
function trackGuestSession(req, res, next) {
  if (!req.session.userId) {
    // Mark as guest session if not logged in
    req.session.isGuest = true;
    req.session.guestSessionId = req.sessionID;
    
    // Track when guest first visited
    if (!req.session.guestCreatedAt) {
      req.session.guestCreatedAt = new Date();
    }
  } else {
    // Mark as logged-in user
    req.session.isGuest = false;
  }

  next();
}

/**
 * Require Authentication Middleware
 * 
 * Ensures only logged-in users can access protected routes
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ 
      message: 'Unauthorized. Please log in to continue.',
      requiresLogin: true 
    });
  }

  next();
}

/**
 * Require Admin Authentication Middleware
 * 
 * Ensures only admin users can access admin routes
 */
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.adminId) {
    return res.status(403).json({ 
      message: 'Access denied. Admin privileges required.' 
    });
  }

  next();
}

/**
 * Validate Stock Middleware
 * 
 * Checks if product has enough stock before proceeding
 * Attaches product details to req.productData for use in controller
 */
function validateStock(db) {
  return (req, res, next) => {
    const { productId, quantity } = req.body;

    if (!productId || !quantity || quantity < 1) {
      return res.status(400).json({ message: 'Invalid product ID or quantity' });
    }

    db.query(
      'SELECT id, name, price, stock FROM products WHERE id = ?',
      [productId],
      (err, results) => {
        if (err) {
          return res.status(500).json({ message: 'Database error' });
        }

        if (results.length === 0) {
          return res.status(404).json({ message: 'Product not found' });
        }

        const product = results[0];

        if (product.stock < quantity) {
          return res.status(400).json({ 
            message: `Insufficient stock. Available: ${product.stock}`,
            availableStock: product.stock 
          });
        }

        // Attach product data to request for use in controller
        req.productData = product;
        next();
      }
    );
  };
}

/**
 * Session Data Middleware
 * 
 * Attaches user info to response for frontend
 * Useful for checking login status without additional API call
 */
function attachSessionData(req, res, next) {
  res.locals.session = {
    userId: req.session?.userId || null,
    userEmail: req.session?.userEmail || null,
    userName: req.session?.userName || null,
    isGuest: req.session?.isGuest ?? true,
    sessionId: req.sessionID
  };

  next();
}

module.exports = {
  initializeGuestCart,
  trackGuestSession,
  requireAuth,
  requireAdmin,
  validateStock,
  attachSessionData
};
