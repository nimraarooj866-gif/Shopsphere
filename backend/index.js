const bcrypt = require("bcrypt");
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const multer = require("multer");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const session = require('express-session');
const createSessionConfig = require('./config/sessionConfig');
const { SessionLogger, createSessionLoggingMiddleware, createAPILoggingMiddleware } = require('./middleware/sessionLoggingMiddleware');
const sessionLogRoutes = require('./routes/sessionLogRoutes');

const app = express();
// Enable CORS with credentials support for session cookies
app.use(cors({
  origin: 'http://localhost:3000',      // Allow requests from frontend on same host
  credentials: true,                     // Allow cookies to be sent
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());

// Configurable salt rounds via environment (default 10)
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS, 10) || 10;

// Serve static files from public folder
app.use(express.static(path.join(__dirname, '../public')));

// Fix edge case: admin routes may use relative stylesheet paths and get redirected to HTML
app.get('/admin/style.css', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/style.css'));
});
app.get('/admin/auth.css', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/auth.css'));
});
app.get('/admin/images/:img', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/images', req.params.img));
});

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  }
});

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Nimra123",
  database: "Shopsphere"
});

// Flag to track if session middleware has been applied
let sessionMiddlewareApplied = false;

/**
 * Apply only the session middleware (no logger) so requests before
 * the database connection still have a valid req.session object.
 */
function applySessionMiddleware() {
  if (sessionMiddlewareApplied) return;
  const { middleware: sessionMiddleware } = createSessionConfig(db);
  app.use(sessionMiddleware);
  sessionMiddlewareApplied = true;
  console.log("✓ Session middleware mounted (store may initialize on first query)");
}

// **Immediately apply the middleware**.  DB connection may not yet be ready,
// but mysql2 will queue queries until it's live and the store will create
// the table when possible.  This prevents routes running without sessions.
applySessionMiddleware();

/**
 * Once the database connects we can safely set up logging and perform
 * any post-connection initialization.
 */
function initializeAfterDbConnect() {
  // Initialize Session Logger (now that connection is reliable)
  const sessionLogger = new SessionLogger(db, {
    enableFileLogging: true,
    enableDatabaseLogging: true,
    enableConsoleLogging: true,
    logsDir: path.join(__dirname, 'logs')
  });
  global.sessionLogger = sessionLogger;

  // Add session logging middleware AFTER logger is initialized
  app.use(createSessionLoggingMiddleware(sessionLogger));
  app.use(createAPILoggingMiddleware(sessionLogger));
  console.log("✓ Session logger initialized");
}

db.connect(err => {
  if (err) {
    console.log("DB Error:", err);
    return;
  }
  
  console.log("MySQL Connected");

  // Post-connection steps
  initializeAfterDbConnect();

  // Ensure an admins table exists separately from users
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
    else console.log("✓ Admins table ready");
  });
  
  // Log session store initialization with customizable expiration
  const sessionExpirationHours = (parseInt(process.env.SESSION_EXPIRATION_MS, 10) || (24 * 60 * 60 * 1000)) / (60 * 60 * 1000);
  console.log(`✓ MySQL sessions table created/verified (expiration: ${sessionExpirationHours} hours)`);
});

// ============== MODEL WARM-UP ==============
// Warm up the Python model on server start to avoid timeout on first request
function warmUpModel() {
  console.log("Warming up ML model...");
  const pythonScript = path.join(__dirname, "skin_predictor.py");
  const warmupScript = path.join(__dirname, "warmup_test.py");
  
  // Create a simple warmup test
  const warmupCode = `
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
import warnings
warnings.filterwarnings('ignore')
import logging
logging.getLogger('tensorflow').setLevel(logging.ERROR)
import sys
sys.path.insert(0, '${__dirname}')
from skin_predictor import load_model_once
model = load_model_once()
if model:
    print("Model loaded successfully")
`;
  
  try {
    fs.writeFileSync(warmupScript, warmupCode);
    const python = spawn("python", [warmupScript]);
    
    python.stdout.on("data", (data) => {
      console.log("Model warmup:", data.toString());
    });
    
    python.on("close", () => {
      try { fs.unlinkSync(warmupScript); } catch (e) {}
    });
  } catch (e) {
    console.log("Model warmup skipped:", e.message);
  }
}

// Warm up on startup (non-blocking)
setTimeout(warmUpModel, 1000);

// Make database available to routes
app.use((req, res, next) => {
  req.db = db;
  next();
});

// Initialize guest flag for new sessions (ensures session is created for all users)
app.use((req, res, next) => {
  if (!req.session.userId) {
    // Mark as guest if not logged in
    if (!req.session.isGuest) {
      req.session.isGuest = true;
      req.session.guestSince = new Date().toISOString();
    }
  }
  next();
});

// Set database in app for access via req.app.get('db')
app.set('db', db);

// Mount session logging routes
app.use('/api/session-logs', sessionLogRoutes);

// Mount cart routes (for guest and authenticated user carts)
const cartRoutes = require('./routes/cartRoutes');
app.use('/api/cart', cartRoutes);

// Mount guest cart routes (simple dedicated guest cart table)
const guestCartRoutes = require('./routes/guestCartRoutes');
app.use('/api/guest-cart', guestCartRoutes);

// Mount product recommendation routes (skin condition based recommendations)
const productRecommendationRoutes = require('./routes/productRecommendationRoutes');
productRecommendationRoutes(app, db);

// ============== ADMIN AUTHENTICATION ==============

// helper middleware to restrict access to logged-in admins
function requireAdmin(req, res, next) {
  if (req.session && req.session.adminId) {
    return next();
  }
  // if request came from browser, redirect to login page
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    return res.redirect('/admin');
  }
  res.status(401).json({ message: 'Unauthorized (admin only)' });
}

// return count of admins (used by front‑end to decide whether to show signup or login)
app.get('/admin/status', (req, res) => {
  db.query('SELECT COUNT(*) AS cnt FROM admins', (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.json({ count: results[0].cnt });
  });
});

// display appropriate page when /admin hit
app.get('/admin', (req, res) => {
  if (req.session && req.session.adminId) {
    return res.redirect('/admin/dashboard');
  }

  db.query('SELECT COUNT(*) AS cnt FROM admins', (err, results) => {
    if (err) return res.status(500).send('Database error');
    const cnt = results[0].cnt;
    if (cnt === 0) {
      return res.sendFile(path.join(__dirname, '../public/admin/signup.html'));
    }
    // 1 or more admins -> show login page
    res.sendFile(path.join(__dirname, '../public/admin/login.html'));
  });
});

// explicit signup page route (used when 1 admin exists and second needs to be created)
app.get('/admin/signup', (req, res) => {
  if (req.session && req.session.adminId) {
    return res.redirect('/admin/dashboard');
  }
  db.query('SELECT COUNT(*) AS cnt FROM admins', (err, results) => {
    if (err) return res.status(500).send('Database error');
    const cnt = results[0].cnt;
    if (cnt >= 2) {
      // already maxed out
      return res.redirect('/admin');
    }
    res.sendFile(path.join(__dirname, '../public/admin/signup.html'));
  });
});

// signup endpoint (first or second admin only)
app.post('/admin/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

  db.query('SELECT COUNT(*) AS cnt FROM admins', async (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    const cnt = results[0].cnt;
    if (cnt >= 2) return res.status(403).json({ message: 'Maximum number of admins reached' });

    try {
      const hash = await bcrypt.hash(password, Math.min(Math.max(SALT_ROUNDS,4),20));
      db.query(
        'INSERT INTO admins (name, email, password) VALUES (?, ?, ?)',
        [name || null, email, hash],
        function(err, insertResult) {
          if (err) {
            if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Email already in use' });
            return res.status(500).json({ message: 'Database error' });
          }
          // automatically log them in
          req.session.adminId = insertResult.insertId;
          req.session.adminEmail = email;
          req.session.adminName = name;
          res.json({ message: 'Admin created' });
        }
      );
    } catch (e) {
      res.status(500).json({ message: 'Hashing failed' });
    }
  });
});

// login endpoint (works when one or two admins exist)
app.post('/admin/login', (req, res) => {
  const { email, password } = req.body;
  db.query('SELECT * FROM admins WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ message: 'Login failed' });
    if (results.length === 0) return res.status(400).json({ message: 'Invalid credentials' });

    const admin = results[0];
    try {
      const match = await bcrypt.compare(password, admin.password);
      if (!match) return res.status(400).json({ message: 'Invalid credentials' });
      // set session
      req.session.adminId = admin.id;
      req.session.adminEmail = admin.email;
      req.session.adminName = admin.name;
      res.json({ message: 'Login successful' });
    } catch (e) {
      res.status(500).json({ message: 'Error checking credentials' });
    }
  });
});

// logout
app.post('/admin/logout', requireAdmin, (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ message: 'Logout failed' });
    res.json({ message: 'Logged out' });
  });
});

// helper route to get current admin information
app.get('/admin/me', requireAdmin, (req, res) => {
  res.json({ id: req.session.adminId, email: req.session.adminEmail, name: req.session.adminName });
});

// Diagnostic endpoint - check if user is authenticated (no auth required)
app.get('/admin/auth-status', (req, res) => {
  if (req.session && req.session.adminId) {
    res.json({ 
      authenticated: true, 
      adminId: req.session.adminId, 
      email: req.session.adminEmail,
      message: 'You are logged in as an admin'
    });
  } else {
    res.json({ 
      authenticated: false, 
      message: 'Not authenticated as admin. Please log in at /admin'
    });
  }
});

// ========== ADMIN DASHBOARD METRICS ==========
/**
 * GET /admin/stats
 * Fetch dynamic metrics for admin dashboard:
 * - Total sales (sum of all order amounts)
 * - Orders today (count of orders placed today)
 * - Active users (count of users who have placed orders)
 * - Low stock items (count of products with stock <= 5)
 * - Recent orders (last 8 orders with customer info)
 * - Sales trend (daily sales for last 7 days)
 * - Orders trend (daily order count for last 7 days)
 */
app.get('/admin/stats', requireAdmin, (req, res) => {
  Promise.all([
    // Total sales from all orders
    new Promise((resolve) => {
      db.query(
        'SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE status != "cancelled"',
        (err, results) => {
          resolve(err ? 0 : results[0].total);
        }
      );
    }),

    // Orders placed today
    new Promise((resolve) => {
      db.query(
        `SELECT COUNT(*) as count FROM orders 
         WHERE DATE(order_date) = CURDATE() AND status != "cancelled"`,
        (err, results) => {
          resolve(err ? 0 : results[0].count);
        }
      );
    }),

    // Active users (users who have placed orders)
    new Promise((resolve) => {
      db.query(
        `SELECT COUNT(DISTINCT user_id) as count FROM orders WHERE user_id IS NOT NULL`,
        (err, results) => {
          resolve(err ? 0 : results[0].count);
        }
      );
    }),

    // Low stock items (stock <= 5)
    new Promise((resolve) => {
      db.query(
        'SELECT COUNT(*) as count FROM products WHERE stock <= 5',
        (err, results) => {
          resolve(err ? 0 : results[0].count);
        }
      );
    }),

    // Recent orders (last 8)
    new Promise((resolve) => {
      db.query(
        `SELECT o.id, o.user_id, o.total_amount, o.status, o.order_date, u.name as customer
         FROM orders o
         LEFT JOIN users u ON o.user_id = u.id
         ORDER BY o.order_date DESC
         LIMIT 8`,
        (err, results) => {
          if (err) {
            resolve([]);
          } else {
            const orders = results.map(o => ({
              id: o.id,
              customer: o.customer || 'Guest',
              total: o.total_amount,
              status: o.status || 'pending',
              date: o.order_date ? o.order_date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
            }));
            resolve(orders);
          }
        }
      );
    }),

  ])
  .then(([totalSales, ordersToday, activeUsers, lowStock, recentOrders]) => {
    const statsData = {
      name: req.session.adminName || 'Administrator',
      totalSales: Math.round(totalSales),
      ordersToday: ordersToday,
      activeUsers: activeUsers,
      lowStock: lowStock,
      recentOrders: recentOrders
    };
    console.log('[ADMIN STATS]', statsData);
    res.json(statsData);
  })
  .catch((err) => {
    console.error('Stats fetch error:', err);
    // Return safe fallback data instead of error
    res.json({
      name: req.session.adminName || 'Administrator',
      totalSales: 0,
      ordersToday: 0,
      activeUsers: 0,
      lowStock: 0,
      recentOrders: []
    });
  });
});

// protected admin dashboard display
app.get('/admin/dashboard', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/dashboard.html'));
});

// All orders page
app.get('/admin/orders', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/orders.html'));
});

// Products management page
app.get('/admin/products', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/products.html'));
});

app.get('/admin/add-product', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/add-product.html'));
});

// Settings page
app.get('/admin/settings', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/settings.html'));
});

// ========== ADMIN DETAIL ROUTES ==========

// Sales detail page
app.get('/admin/details/sales', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/sales-detail.html'));
});

// Orders today detail page
app.get('/admin/details/orders-today', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/orders-today-detail.html'));
});

// Active users detail page
app.get('/admin/details/users', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/users-detail.html'));
});

// Low stock items detail page
app.get('/admin/details/low-stock', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/low-stock-detail.html'));
});

// ========== API ROUTES FOR DETAIL DATA ==========

// Get all sales/orders data
app.get('/admin/sales-data', requireAdmin, (req, res) => {
  console.log('[ADMIN API] GET /admin/sales-data - fetching all orders');
  db.query(
    `SELECT o.id, o.user_id, o.total_amount, o.status, o.order_date, u.name as customer
     FROM orders o
     LEFT JOIN users u ON o.user_id = u.id
     ORDER BY o.order_date DESC`,
    (err, results) => {
      if (err) {
        console.error('[ADMIN API] Sales data error:', err.message);
        return res.status(500).json({ message: 'Failed to fetch sales data', error: err.message });
      }
      console.log(`[ADMIN API] Sales data fetched: ${results.length} orders`);
      const orders = results.map(o => ({
        id: o.id,
        customer: o.customer || 'Guest',
        total: o.total_amount,
        status: o.status || 'pending',
        date: o.order_date ? o.order_date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      }));
      res.json({ orders });
    }
  );
});

// Get today's orders
app.get('/admin/today-orders', requireAdmin, (req, res) => {
  db.query(
    `SELECT o.id, o.user_id, o.total_amount, o.status, o.order_date, u.name as customer
     FROM orders o
     LEFT JOIN users u ON o.user_id = u.id
     WHERE DATE(o.order_date) = CURDATE()
     ORDER BY o.order_date DESC`,
    (err, results) => {
      if (err) {
        console.error('Today orders fetch error:', err);
        return res.status(500).json({ message: 'Failed to fetch today orders', error: err.message });
      }
      const orders = results.map(o => ({
        id: o.id,
        customer: o.customer || 'Guest',
        total: o.total_amount,
        status: o.status || 'pending',
        time: o.order_date ? o.order_date.toLocaleTimeString() : new Date().toLocaleTimeString(),
        date: o.order_date ? o.order_date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      }));
      res.json({ orders });
    }
  );
});

// Get all orders
app.get('/admin/all-orders', requireAdmin, (req, res) => {
  db.query(
    `SELECT o.id, o.user_id, o.total_amount, o.status, o.order_date, u.name as customer
     FROM orders o
     LEFT JOIN users u ON o.user_id = u.id
     ORDER BY o.order_date DESC`,
    (err, results) => {
      if (err) {
        console.error('All orders fetch error:', err);
        return res.status(500).json({ message: 'Failed to fetch all orders', error: err.message });
      }
      const orders = results.map(o => ({
        id: o.id,
        customer: o.customer || 'Guest',
        total: o.total_amount,
        status: o.status || 'pending',
        dateTime: o.order_date ? new Date(o.order_date).toLocaleString() : new Date().toLocaleString()
      }));
      res.json({ orders });
    }
  );
});

// Get all products for admin
app.get('/admin/all-products', requireAdmin, (req, res) => {
  db.query('SELECT id, name, category, price, stock, description, img FROM products ORDER BY id DESC', (err, results) => {
    if (err) {
      console.error('All products fetch error:', err);
      return res.status(500).json({ message: 'Failed to fetch products', error: err.message });
    }
    res.json({ products: results });
  });
});

// Get single product for admin
app.get('/admin/product/:id', requireAdmin, (req, res) => {
  const productId = req.params.id;
  db.query('SELECT * FROM products WHERE id = ?', [productId], (err, results) => {
    if (err) {
      console.error('Product fetch error:', err);
      return res.status(500).json({ message: 'Failed to fetch product', error: err.message });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(results[0]);
  });
});

// Add new product
app.post('/admin/products', requireAdmin, (req, res) => {
  const { name, price, category, stock, description, img } = req.body;

  if (!name || !price || !category || stock === undefined || !description || !img) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  db.query(
    'INSERT INTO products (name, price, category, stock, description, img) VALUES (?, ?, ?, ?, ?, ?)',
    [name, price, category, stock, description, img],
    (err, result) => {
      if (err) {
        console.error('Product add error:', err);
        return res.status(500).json({ message: 'Failed to add product', error: err.message });
      }
      res.json({ message: 'Product added successfully', productId: result.insertId });
    }
  );
});

// Update product
app.put('/admin/products/:id', requireAdmin, (req, res) => {
  const productId = req.params.id;
  const { name, price, category, stock, description, img } = req.body;

  if (!name || !price || !category || stock === undefined || !description || !img) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  db.query(
    'UPDATE products SET name = ?, price = ?, category = ?, stock = ?, description = ?, img = ? WHERE id = ?',
    [name, price, category, stock, description, img, productId],
    (err, result) => {
      if (err) {
        console.error('Product update error:', err);
        return res.status(500).json({ message: 'Failed to update product', error: err.message });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Product not found' });
      }
      res.json({ message: 'Product updated successfully' });
    }
  );
});

// Delete product
app.delete('/admin/products/:id', requireAdmin, (req, res) => {
  const productId = req.params.id;

  db.query('DELETE FROM products WHERE id = ?', [productId], (err, result) => {
    if (err) {
      console.error('Product delete error:', err);
      return res.status(500).json({ message: 'Failed to delete product', error: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  });
});

// Get active users
app.get('/admin/active-users', requireAdmin, (req, res) => {
  db.query(
    `SELECT u.id, u.name, u.email, COUNT(o.id) as orderCount, 
            COALESCE(SUM(o.total_amount), 0) as totalSpent,
            MAX(o.order_date) as lastOrder
     FROM users u
     LEFT JOIN orders o ON u.id = o.user_id
     GROUP BY u.id
     HAVING COUNT(o.id) > 0
     ORDER BY orderCount DESC`,
    (err, results) => {
      if (err) {
        console.error('Active users fetch error:', err);
        return res.status(500).json({ message: 'Failed to fetch users', error: err.message });
      }
      const users = results.map(u => ({
        id: u.id,
        name: u.name || '—',
        email: u.email || '—',
        orderCount: u.orderCount,
        totalSpent: u.totalSpent,
        lastOrder: u.lastOrder ? u.lastOrder.toISOString().split('T')[0] : '—'
      }));
      res.json({ users });
    }
  );
});

// Get low stock items
app.get('/admin/low-stock-items', requireAdmin, (req, res) => {
  db.query(
    'SELECT id, name, category, stock, price FROM products WHERE stock <= 5 ORDER BY stock ASC',
    (err, results) => {
      if (err) {
        console.error('Low stock items fetch error:', err);
        return res.status(500).json({ message: 'Failed to fetch low stock items', error: err.message });
      }
      const products = results.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        stock: p.stock,
        price: p.price
      }));
      res.json({ products });
    }
  );
});

// Get individual order details
app.get('/admin/order/:id', requireAdmin, (req, res) => {
  const orderId = req.params.id;
  
  db.query(
    `SELECT o.id, o.user_id, o.total_amount, o.status, o.order_date, 
            u.name as customerName, u.email as customerEmail
     FROM orders o
     LEFT JOIN users u ON o.user_id = u.id
     WHERE o.id = ?`,
    [orderId],
    (err, results) => {
      if (err || results.length === 0) {
        return res.status(404).json({ message: 'Order not found' });
      }

      const order = results[0];
      
      // Get order items
      db.query(
        `SELECT oi.id, oi.product_id, oi.quantity, oi.price_at_order as price, oi.product_name as productName
         FROM order_items oi
         WHERE oi.order_id = ?`,
        [orderId],
        (err, items) => {
          if (err) {
            console.error('Order items fetch error:', err);
            items = [];
          }

          const orderData = {
            id: order.id,
            customerName: order.customerName || 'Guest',
            customerEmail: order.customerEmail || '—',
            total: order.total_amount,
            status: order.status || 'pending',
            date: order.order_date ? order.order_date.toISOString().split('T')[0] : '—',
            shippingAddress: '—',
            items: items.map(item => ({
              id: item.id,
              productId: item.product_id,
              productName: item.productName,
              quantity: item.quantity,
              price: item.price
            }))
          };

          res.json({ order: orderData });
        }
      );
    }
  );
});

// Update order status
app.patch('/admin/order/:id/status', requireAdmin, (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;

  if (!status || !['pending', 'shipped', 'delivered', 'cancelled'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  db.query(
    'UPDATE orders SET status = ? WHERE id = ?',
    [status, orderId],
    (err) => {
      if (err) {
        return res.status(500).json({ message: 'Failed to update status' });
      }
      res.json({ message: 'Order status updated successfully' });
    }
  );
});

// =================================================

// ---------------- Signup ----------------
app.post("/signup", async (req, res) => { // 'async' zaroori hai
  const { name, email, password } = req.body;
  const sessionId = req.sessionID; // Get session for guest cart merge

  try {
    if (!name || !email || !password) return res.status(400).json({ message: "Missing required fields" });
    if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });

    // 1. Check if email already exists
    db.query("SELECT email FROM users WHERE email = ?", [email], async (err, results) => {
      if (err) return res.status(500).json({ message: "Database error" });
      
      // If email exists in results, reject signup
      if (results.length > 0) return res.status(400).json({ message: "Email exists" });

      try {
        // 2. Hash generate karein
        const hashedPassword = await bcrypt.hash(password, Math.min(Math.max(SALT_ROUNDS, 4), 20));

        // 3. Database mein 'hashedPassword' bhejein (na ke 'password')
        db.query(
          "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
          [name, email, hashedPassword], 
          function(err, insertResult) {
            if (err) {
              if (err.code === "ER_DUP_ENTRY") return res.status(400).json({ message: "Email exists" });
              return res.status(500).json({ message: "Database error" });
            }

            const newUserId = insertResult.insertId;

            // Set session for new user
            req.session.userId = newUserId;

            // ===== MERGE GUEST CART ITEMS INTO NEW USER CART =====
            db.query(
              'SELECT id, product_id, quantity FROM guest_cart WHERE session_id = ?',
              [sessionId],
              (err, guestItems) => {
                if (err) {
                  console.error('Merge error (guest cart fetch):', err);
                  // Don't block signup, just proceed without merge
                  return res.json({ 
                    message: "Signup successful",
                    cartMerged: false,
                    itemsMerged: 0,
                    userId: newUserId
                  });
                }

                // If guest has no items, just respond with signup success
                if (!guestItems || guestItems.length === 0) {
                  return res.json({ 
                    message: "Signup successful",
                    cartMerged: false,
                    itemsMerged: 0,
                    userId: newUserId
                  });
                }

                // Guest has items - merge them into new user cart
                let itemsMerged = 0;
                let processedCount = 0;

                // Create new user cart
                db.query(
                  'INSERT INTO cart (user_id) VALUES (?)',
                  [newUserId],
                  function (err) {
                    if (err) {
                      console.error('Merge error (create user cart):', err);
                      return res.json({ 
                        message: "Signup successful",
                        cartMerged: false,
                        itemsMerged: 0,
                        userId: newUserId
                      });
                    }

                    const userCartId = insertResult.insertId;

                    // Merge each guest item into user cart
                    guestItems.forEach((guestItem) => {
                      db.query(
                        `INSERT INTO cart_items (cart_id, product_id, quantity)
                         VALUES (?, ?, ?)
                         ON DUPLICATE KEY UPDATE
                         quantity = VALUES(quantity),
                         updated_at = CURRENT_TIMESTAMP`,
                        [userCartId, guestItem.product_id, guestItem.quantity],
                        (err) => {
                          processedCount++;

                          if (!err) {
                            itemsMerged++;
                          } else {
                            console.error('Merge error (merge item):', err);
                          }

                          // After all items processed, respond with merge info
                          // NOTE: Keep guest_cart items - they'll be restored if user logs out
                          if (processedCount === guestItems.length) {
                            res.json({ 
                              message: "Signup successful",
                              cartMerged: itemsMerged > 0,
                              itemsMerged: itemsMerged,
                              userId: newUserId
                            });
                          }
                        }
                      );
                    });
                  }
                );
              }
            );
            // ===== END CART MERGE =====
          }
        );
      } catch (error) {
        res.status(500).json({ message: "Hashing failed" });
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Hashing failed" });
  }
});

// ---------------- Login ----------------
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
    if (err) {
      console.error('LOGIN DB ERROR:', err.message);
      return res.status(500).json({ message: "Login failed" });
    }
    // Do not reveal whether the email exists — generic message prevents enumeration
    if (results.length === 0) {
      // Log failed login attempt
      if (global.sessionLogger) {
        global.sessionLogger.log(req.sessionID, 'LOGIN_FAILED', {
          email: email,
          reason: 'user_not_found'
        }, req);
      }
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const user = results[0];

    // Yahan plain password ko DB ke hash se compare karein
    try {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

      // Set session and log login
      req.session.userId = user.id;
      if (global.sessionLogger) {
        global.sessionLogger.log(req.sessionID, 'USER_LOGIN', {
          userId: user.id,
          email: email
        }, req);
      }

      // ===== MERGE GUEST CART ITEMS INTO USER CART =====
      const sessionId = req.sessionID;
      const userId = user.id;

      db.query(
        'SELECT id, product_id, quantity FROM guest_cart WHERE session_id = ?',
        [sessionId],
        (err, guestItems) => {
          if (err) {
            console.error('Merge error (guest cart fetch):', err);
            // Don't block login, just proceed without merge
            const { password: _pwd, ...safeUser } = user;
            return res.json({ 
              message: "Login successful", 
              user: safeUser,
              cartMerged: false,
              itemsMerged: 0
            });
          }

          // If guest has no items, just respond with login success
          if (!guestItems || guestItems.length === 0) {
            const { password: _pwd, ...safeUser } = user;
            return res.json({ 
              message: "Login successful", 
              user: safeUser,
              cartMerged: false,
              itemsMerged: 0
            });
          }

          // Guest has items - merge them into user cart
          let itemsMerged = 0;
          let processedCount = 0;
          let mergeError = false;

          // Get or create user's cart
          db.query(
            'SELECT id FROM cart WHERE user_id = ?',
            [userId],
            (err, userCartResults) => {
              if (err) {
                console.error('Merge error (get user cart):', err);
                const { password: _pwd, ...safeUser } = user;
                return res.json({ 
                  message: "Login successful", 
                  user: safeUser,
                  cartMerged: false,
                  itemsMerged: 0
                });
              }

              let userCartId;

              if (userCartResults.length === 0) {
                // Create new user cart
                db.query(
                  'INSERT INTO cart (user_id) VALUES (?)',
                  [userId],
                  function (err) {
                    if (err) {
                      console.error('Merge error (create user cart):', err);
                      const { password: _pwd, ...safeUser } = user;
                      return res.json({ 
                        message: "Login successful", 
                        user: safeUser,
                        cartMerged: false,
                        itemsMerged: 0
                      });
                    }
                    userCartId = insertResult.insertId;
                    mergeItems(userCartId);
                  }
                );
              } else {
                userCartId = userCartResults[0].id;
                mergeItems(userCartId);
              }

              function mergeItems(cartId) {
                // Merge each guest item into user cart
                guestItems.forEach((guestItem) => {
                  db.query(
                    `INSERT INTO cart_items (cart_id, product_id, quantity)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                     quantity = VALUES(quantity),
                     updated_at = CURRENT_TIMESTAMP`,
                    [cartId, guestItem.product_id, guestItem.quantity],
                    (err) => {
                      processedCount++;

                      if (!err) {
                        itemsMerged++;
                      } else {
                        console.error('Merge error (merge item):', err);
                      }

                      // After all items processed, respond with merge info
                      // NOTE: Keep guest_cart items - they'll be restored if user logs out
                      if (processedCount === guestItems.length) {
                        const { password: _pwd, ...safeUser } = user;
                        res.json({ 
                          message: "Login successful", 
                          user: safeUser,
                          cartMerged: itemsMerged > 0,
                          itemsMerged: itemsMerged
                        });
                      }
                    }
                  );
                });
              }
            }
          );
        }
      );
      // ===== END CART MERGE =====
    } catch (e) {
      console.error('LOGIN ERROR:', e.message);
      return res.status(500).json({ message: "Error checking credentials" });
    }
  });
});

// ---------------- Logout ----------------
app.post("/logout", (req, res) => {
  const userId = req.session.userId;
  const sessionId = req.sessionID;

  // Log logout activity
  if (userId && global.sessionLogger) {
    global.sessionLogger.log(sessionId, 'USER_LOGOUT', {
      userId: userId
    }, req);
  }

  // Clear user info but KEEP the session alive
  // This preserves the sessionID so guest_cart items remain accessible
  delete req.session.userId;
  delete req.session.adminId;
  delete req.session.adminEmail;
  delete req.session.adminName;
  
  // Save the modified session (with cleared user data)
  req.session.save((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// ---------------- Change passowrd ----------------
app.post("/change-password", async (req, res) => {
  const { email, oldPassword, newPassword } = req.body;
  if (!email || !oldPassword || !newPassword) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  // Check old password
  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
    if (err) return res.status(500).json({ message: "Error checking password" });
    // Generic response to avoid revealing whether the email exists
    if (results.length === 0) return res.status(400).json({ message: "Invalid credentials" });

    const user = results[0];
    try {
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

      if (typeof newPassword !== 'string' || newPassword.length < 8) return res.status(400).json({ message: "New password must be at least 8 characters" });

      const newHashed = await bcrypt.hash(newPassword, Math.min(Math.max(SALT_ROUNDS, 4), 20));

      db.query("UPDATE users SET password = ? WHERE email = ?", [newHashed, email], (err) => {
        if (err) return res.status(500).json({ message: "Failed to update password" });
        res.json({ message: "Password changed successfully" });
      });
    } catch (e) {
      return res.status(500).json({ message: "Error updating password" });
    }
  });
});

// ---------------- Update User Profile ----------------
app.post("/update-profile", (req, res) => {
  const { email, name, phone } = req.body;
  if (!email) return res.status(400).json({ message: "Email required" });
  
  db.query("UPDATE users SET name = ?, phone = ? WHERE email = ?", [name, phone, email], (err) => {
    if (err) return res.status(500).json({ message: "Update failed" });
    res.json({ message: "Profile updated successfully" });
  });
});

// ---------------- Delete Account ----------------
// Requires email + password confirmation to avoid accidental or unauthenticated deletions.
// Cascade-deletes related data (cart, orders) before removing user.
app.post("/delete-account", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Missing required fields" });

  db.query("SELECT id, password FROM users WHERE email = ?", [email], async (err, results) => {
    if (err) return res.status(500).json({ message: "Error processing request" });
    // Generic message to prevent user enumeration
    if (results.length === 0) return res.status(400).json({ message: "Invalid credentials" });

    const user = results[0];
    try {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

      // Delete related data first (cascade delete)
      db.query("DELETE FROM cart WHERE user_id = ?", [user.id], (err1) => {
        if (err1) console.error("Cart delete error:", err1);
        
        db.query("DELETE FROM orders WHERE user_id = ?", [user.id], (err2) => {
          if (err2) console.error("Orders delete error:", err2);
          
          // Finally delete the user
          db.query("DELETE FROM users WHERE id = ?", [user.id], (err3) => {
            if (err3) return res.status(500).json({ message: "Failed to delete account" });
            res.json({ message: "Account deleted successfully" });
          });
        });
      });
    } catch (e) {
      return res.status(500).json({ message: "Error deleting account" });
    }
  });
});

// ---------------- Products ----------------
app.get("/products", (req, res) => {
  db.query("SELECT * FROM products", (err, results) => {
    if (err) return res.status(500).json({ message: "Products fetch failed" });
    res.json(results);
  });
});
// ---------------- Banners ----------------
app.get("/banners", (req, res) => {
  const query = "SELECT id, image_url, title, subtitle, button_text, button_link, display_order, is_active FROM banners WHERE is_active=1 ORDER BY display_order ASC";
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: "Failed to fetch banners" });
    res.json(results);
  });
});

// make sure banner upload folder exists
const bannerDir = path.join(__dirname, '../public/images/banners');
if (!fs.existsSync(bannerDir)) {
  fs.mkdirSync(bannerDir, { recursive: true });
}

// ---------------- Admin banners management (protected) ----------------
app.get('/admin/banners', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/banners.html'));
});

app.post('/admin/banners/upload', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Image file is required' });
  }
  const ext = req.file.mimetype.split('/')[1] || 'jpg';
  const filename = `banner_${Date.now()}.${ext}`;
  const outPath = path.join(bannerDir, filename);
  fs.writeFile(outPath, req.file.buffer, (err) => {
    if (err) return res.status(500).json({ message: 'Failed to save image' });
    const { title, subtitle, button_text, button_link, display_order, is_active } = req.body;
    const imageUrl = `/images/banners/${filename}`;
    db.query(
      'INSERT INTO banners (image_url, title, subtitle, button_text, button_link, display_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [imageUrl, title, subtitle, button_text, button_link, display_order || 0, is_active || 1],
      (err) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json({ message: 'Banner added' });
      }
    );
  });
});

// Get all banners for admin management
app.get('/admin/all-banners', requireAdmin, (req, res) => {
  const query = "SELECT id, image_url, title, subtitle, button_text, button_link, display_order, is_active FROM banners ORDER BY display_order ASC";
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch banners' });
    res.json(results);
  });
});

// Update banner
app.put('/admin/banners/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { title, subtitle, button_text, button_link, display_order, is_active } = req.body;

  const query = "UPDATE banners SET title=?, subtitle=?, button_text=?, button_link=?, display_order=?, is_active=? WHERE id=?";
  db.query(query, [title, subtitle, button_text, button_link, display_order, is_active, id], (err) => {
    if (err) return res.status(500).json({ message: 'Failed to update banner' });
    res.json({ message: 'Banner updated successfully' });
  });
});

// Delete banner
app.delete('/admin/banners/:id', requireAdmin, (req, res) => {
  const { id } = req.params;

  const query = "DELETE FROM banners WHERE id=?";
  db.query(query, [id], (err) => {
    if (err) return res.status(500).json({ message: 'Failed to delete banner' });
    res.json({ message: 'Banner deleted successfully' });
  });
});


// ============== SKIN DISEASE DETECTION ==============

// Skin prediction API
app.post("/api/predict-skin", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No image file provided"
      });
    }

    // Save image temporarily
    const tempDir = path.join(__dirname, "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    const fileExt = req.file.mimetype.split('/')[1] || 'jpg';
    const tempImagePath = path.join(tempDir, `temp_${Date.now()}.${fileExt}`);
    
    // Write file buffer to disk
    fs.writeFileSync(tempImagePath, req.file.buffer);

    // Call Python script for prediction
    const pythonScript = path.join(__dirname, "skin_predictor.py");
    
    const python = spawn("python", [pythonScript, tempImagePath]);

    let pythonOutput = "";
    let pythonError = "";
    let responseSent = false;
    let processTimeout;

    // Set 120 second timeout (increased from 30s to handle model loading + prediction)
    processTimeout = setTimeout(() => {
      if (!responseSent) {
        responseSent = true;
        python.kill();
        try { fs.unlinkSync(tempImagePath); } catch (e) {}
        res.status(500).json({
          success: false,
          error: "Python prediction timeout (exceeded 120 seconds)"
        });
      }
    }, 120000);

    python.stdout.on("data", (data) => {
      pythonOutput += data.toString();
    });

    python.stderr.on("data", (data) => {
      pythonError += data.toString();
    });

    python.on("close", (code) => {
      clearTimeout(processTimeout);
      
      // Clean up temporary file with delay to avoid EBUSY error
      setTimeout(() => {
        try {
          if (fs.existsSync(tempImagePath)) {
            fs.unlinkSync(tempImagePath);
            console.log("Temp file deleted:", tempImagePath);
          }
        } catch (e) {
          console.log("Temp file cleanup info:", e.message);
        }
      }, 100);

      if (responseSent) return;

      if (code !== 0 && code !== null) {
        console.error("Python script error (code " + code + "):", pythonError);
        responseSent = true;
        return res.status(500).json({
          success: false,
          error: "Python prediction failed: " + (pythonError.substring(0, 200) || "Unknown error")
        });
      }

      try {
        const output = pythonOutput.trim();
        if (!output) {
          responseSent = true;
          return res.status(500).json({
            success: false,
            error: "No output from Python script"
          });
        }
        
        const result = JSON.parse(output);
        responseSent = true;
        res.json(result);
      } catch (e) {
        console.error("JSON parse error:", e.message);
        console.error("Python output was:", pythonOutput.substring(0, 500));
        console.error("Python error was:", pythonError.substring(0, 500));
        responseSent = true;
        res.status(500).json({
          success: false,
          error: "Failed to parse prediction results: " + e.message
        });
      }
    });

    python.on("error", (err) => {
      clearTimeout(processTimeout);
      
      // Clean up temporary file with delay
      setTimeout(() => {
        try {
          if (fs.existsSync(tempImagePath)) {
            fs.unlinkSync(tempImagePath);
          }
        } catch (e) {
          console.log("Temp file cleanup info:", e.message);
        }
      }, 100);

      if (responseSent) return;
      responseSent = true;

      console.error("Python process error:", err.message);
      res.status(500).json({
        success: false,
        error: "Python process error: " + err.message
      });
    });

  } catch (error) {
    console.error("API error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "An error occurred during processing"
    });
  }
});

// ============== PERSISTENT CART SYSTEM ==============

// Get cart for logged-in user
app.get("/api/cart/:userId", (req, res) => {
  const { userId } = req.params;
  const sessionId = req.sessionID;

  // determine cart owner: user or session
  const userId_num = parseInt(userId) || 0;

  if (!userId_num && !sessionId) {
    return res.status(400).json({ message: "Invalid user ID or session" });
  }

  const query = `
    SELECT ci.id, ci.product_id, ci.quantity, 
           p.id as p_id, p.name, p.price, p.img
    FROM cart_items ci
    JOIN cart c ON ci.cart_id = c.id
    JOIN products p ON ci.product_id = p.id
    WHERE ${userId_num ? 'c.user_id = ?' : 'c.session_id = ?'}
  `;

  db.query(query, [userId_num || sessionId], (err, results) => {
    if (err) {
      console.error("Cart fetch error:", err);
      return res.status(500).json({ message: "Failed to fetch cart" });
    }
    
    // Format response to match frontend cart structure
    const cartItems = results.map(row => ({
      id: row.product_id,
      name: row.name,
      price: parseFloat(row.price) || 0,
      quantity: parseInt(row.quantity) || 1,
      image: `images/${row.img.split('/').pop()}` // Format image path correctly
    }));
    
    res.json({ cart: cartItems });
  });
});

// Add item to cart or update quantity
app.post("/api/cart/:userId/add", (req, res) => {
  const { userId } = req.params;
  const { product_id, quantity } = req.body;
  const sessionId = req.sessionID;

  if ((!userId && !sessionId) || !product_id || quantity === undefined) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const userId_num = parseInt(userId) || 0;
  const product_id_num = parseInt(product_id) || 0;
  const qty = Math.max(1, parseInt(quantity) || 1);

  if ((!userId_num && !sessionId) || !product_id_num) {
    return res.status(400).json({ message: "Invalid user/session or product ID" });
  }

  // First, get or create cart for user or session
  const selector = userId_num ? 'user_id' : 'session_id';
  const selectorVal = userId_num || sessionId;
  db.query(
    `SELECT id FROM cart WHERE ${selector} = ?`,
    [selectorVal],
    (err, cartResults) => {
      if (err) {
        console.error("Cart check error:", err);
        return res.status(500).json({ message: "Database error" });
      }

      let cartId;

      const addToCart = (cId) => {
        // Check if product already exists in cart
        db.query(
          "SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?",
          [cId, product_id_num],
          (err, results) => {
            if (err) {
              console.error("Cart item check error:", err);
              return res.status(500).json({ message: "Database error" });
            }

            if (results && results.length > 0) {
              // Product exists, update quantity
              const newQuantity = results[0].quantity + qty;
              db.query(
                "UPDATE cart_items SET quantity = ? WHERE id = ?",
                [newQuantity, results[0].id],
                (err) => {
                  if (err) {
                    console.error("Cart update error:", err);
                    return res.status(500).json({ message: "Failed to update cart" });
                  }
                  res.json({ message: "Cart updated", quantity: newQuantity });
                }
              );
            } else {
              // Product doesn't exist, insert new
              db.query(
                "INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)",
                [cId, product_id_num, qty],
                (err) => {
                  if (err) {
                    console.error("Cart insert error:", err);
                    return res.status(500).json({ message: "Failed to add to cart" });
                  }
                  res.json({ message: "Added to cart", quantity: qty });
                }
              );
            }
          }
        );
      };

      if (cartResults && cartResults.length > 0) {
        // Cart exists
        cartId = cartResults[0].id;
        addToCart(cartId);
      } else {
        // Create new cart for user or session
        const insertSQL = userId_num ?
          "INSERT INTO cart (user_id) VALUES (?)" :
          "INSERT INTO cart (session_id) VALUES (?)";
        db.query(
          insertSQL,
          [selectorVal],
          (err, insertResult) => {
            if (err) {
              console.error("Cart creation error:", err);
              return res.status(500).json({ message: "Failed to create cart" });
            }
            cartId = insertResult.insertId;
            addToCart(cartId);
          }
        );
      }
    }
  );
});

// Update cart item quantity
app.put("/api/cart/:userId/update/:productId", (req, res) => {
  const { userId, productId } = req.params;
  const { quantity } = req.body;

  if (!userId || !productId || quantity === undefined) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const sessionId = req.sessionID;
  const userId_num = parseInt(userId) || 0;
  const productId_num = parseInt(productId) || 0;
  const qty = Math.max(1, parseInt(quantity) || 1);

  if ((!userId_num && !sessionId) || !productId_num) {
    return res.status(400).json({ message: "Invalid user/session or product ID" });
  }

  // Get cart_id for user or session and update cart_items
  const selector = userId_num ? 'user_id' : 'session_id';
  const selectorVal = userId_num || sessionId;
  db.query(
    `UPDATE cart_items ci 
     SET ci.quantity = ? 
     WHERE ci.product_id = ? 
     AND ci.cart_id = (SELECT id FROM cart WHERE ${selector} = ?)
    `,
    [qty, productId_num, selectorVal],
    (err) => {
      if (err) {
        console.error("Cart update error:", err);
        return res.status(500).json({ message: "Failed to update cart" });
      }
      res.json({ message: "Quantity updated", quantity: qty });
    }
  );
});

// Remove item from cart
app.delete("/api/cart/:userId/remove/:productId", (req, res) => {
  const { userId, productId } = req.params;

  if (!userId || !productId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const sessionId = req.sessionID;
  const userId_num = parseInt(userId) || 0;
  const productId_num = parseInt(productId) || 0;

  if ((!userId_num && !sessionId) || !productId_num) {
    return res.status(400).json({ message: "Invalid user/session or product ID" });
  }

  const selector = userId_num ? 'user_id' : 'session_id';
  const selectorVal = userId_num || sessionId;
  db.query(
    `DELETE FROM cart_items 
     WHERE product_id = ? 
     AND cart_id = (SELECT id FROM cart WHERE ${selector} = ?)
    `,
    [productId_num, selectorVal],
    (err) => {
      if (err) {
        console.error("Cart delete error:", err);
        return res.status(500).json({ message: "Failed to remove item" });
      }
      res.json({ message: "Item removed from cart" });
    }
  );
});

// Clear entire cart for user
app.delete("/api/cart/:userId/clear", (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ message: "User ID required" });
  }

  const sessionId = req.sessionID;
  const userId_num = parseInt(userId) || 0;

  if (!userId_num && !sessionId) {
    return res.status(400).json({ message: "Invalid user/session" });
  }

  const selector = userId_num ? 'user_id' : 'session_id';
  const selectorVal = userId_num || sessionId;
  db.query(
    `DELETE FROM cart_items 
     WHERE cart_id = (SELECT id FROM cart WHERE ${selector} = ?)
    `,
    [selectorVal],
    (err) => {
      if (err) {
        console.error("Cart clear error:", err);
        return res.status(500).json({ message: "Failed to clear cart" });
      }
      res.json({ message: "Cart cleared" });
    }
  );
});

// ========== PLACE ORDER (Clear cart on order confirmation) ==========
app.post('/api/orders', (req, res) => {
  const userId = req.session.userId;
  const sessionId = req.sessionID;
  const { items, total_amount, status = 'pending', shipping_address = '', contact_email = '' } = req.body;

  // Validate required fields
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'No items in order' });
  }

  if (!total_amount) {
    return res.status(400).json({ message: 'Total amount required' });
  }

  // Create order record
  db.query(
    'INSERT INTO orders (user_id, order_date, total_amount, status) VALUES (?, CURRENT_TIMESTAMP, ?, ?)',
    [userId || null, total_amount, status],
    function(err) {
      if (err) {
        console.error('Order creation error:', err);
        return res.status(500).json({ message: 'Failed to create order' });
      }

      const orderId = insertResult.insertId;
      let processedCount = 0;
      let itemsAdded = 0;

      // Add each item to order_items table
      items.forEach((item) => {
        const productId = item.id || item.product_id;
        const quantity = item.quantity || 1;
        const price = item.price || 0;
        const subtotal = price * quantity;

        db.query(
          `INSERT INTO order_items (order_id, product_id, product_name, price_at_order, quantity, subtotal)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [orderId, productId, item.name || 'Product', price, quantity, subtotal],
          (err) => {
            processedCount++;
            if (!err) itemsAdded++;

            // After all items are added, delete cart items from database
            if (processedCount === items.length) {
              // Delete cart items for logged-in user
              if (userId) {
                db.query(
                  `DELETE FROM cart_items 
                   WHERE cart_id = (SELECT id FROM cart WHERE user_id = ?)`,
                  [userId],
                  (deleteErr) => {
                    if (deleteErr) {
                      console.error('Error clearing user cart:', deleteErr);
                      // Don't fail the order, just log the warning
                    }
                    // Also clear guest cart for this session if it exists
                    db.query(
                      `DELETE FROM guest_cart WHERE session_id = ?`,
                      [sessionId],
                      (guestDeleteErr) => {
                        if (guestDeleteErr) {
                          console.error('Error clearing guest cart:', guestDeleteErr);
                        }
                        respondWithOrder(orderId);
                      }
                    );
                  }
                );
              } else {
                // Guest user: only delete from guest_cart
                db.query(
                  `DELETE FROM guest_cart WHERE session_id = ?`,
                  [sessionId],
                  (err) => {
                    if (err) {
                      console.error('Error clearing guest cart:', err);
                    }
                    respondWithOrder(orderId);
                  }
                );
              }
            }
          }
        );
      });

      function respondWithOrder(orderId) {
        res.json({
          message: 'Order placed successfully',
          orderId: orderId,
          itemsAdded: itemsAdded,
          success: true
        });
      }
    }
  );
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
