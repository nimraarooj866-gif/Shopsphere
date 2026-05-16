// routes/authRoutes.js
// User authentication routes

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/cartMiddleware');

/**
 * ================================================
 * PUBLIC AUTH ROUTES
 * ================================================
 * These routes don't require authentication
 */

/**
 * POST /api/auth/register
 * Create a new user account
 * 
 * Expected body:
 * {
 *   "name": "John Doe",
 *   "email": "john@example.com",
 *   "password": "password123",
 *   "confirmPassword": "password123"
 * }
 */
router.post('/register', (req, res) => {
  const controller = authController.registerUser(req.app.get('db'));
  controller(req, res);
});

/**
 * POST /api/auth/login
 * Log in a user (with automatic guest cart merge)
 * 
 * Expected body:
 * {
 *   "email": "john@example.com",
 *   "password": "password123"
 * }
 * 
 * Response includes:
 * - User information
 * - cartMerged flag (true if guest items were merged)
 * - itemsMerged count
 */
router.post('/login', (req, res) => {
  const controller = authController.loginUser(req.app.get('db'));
  controller(req, res);
});

/**
 * POST /api/auth/logout
 * Log out the current user
 * Preserves guest cart for continued shopping
 */
router.post('/logout', authController.logoutUser);

/**
 * GET /api/auth/session
 * Get current user session info
 * 
 * Response:
 * - isLoggedIn: boolean
 * - isGuest: boolean
 * - user: { id, name, email } or null
 * - sessionId: unique session identifier
 */
router.get('/session', authController.getCurrentSession);

/**
 * ================================================
 * PROTECTED AUTH ROUTES
 * ================================================
 * These routes require authentication (logged-in user)
 */

/**
 * POST /api/auth/update-profile
 * Update current user's profile
 * Requires authentication
 * 
 * Expected body:
 * {
 *   "name": "Updated Name",
 *   "phone": "+92300123456"
 * }
 */
router.post('/update-profile', requireAuth, (req, res) => {
  const controller = authController.updateProfile(req.app.get('db'));
  controller(req, res);
});

/**
 * POST /api/auth/change-password
 * Change current user's password
 * Requires authentication
 * 
 * Expected body:
 * {
 *   "oldPassword": "currentPassword123",
 *   "newPassword": "newPassword123",
 *   "confirmPassword": "newPassword123"
 * }
 */
router.post('/change-password', requireAuth, (req, res) => {
  const controller = authController.changePassword(req.app.get('db'));
  controller(req, res);
});

/**
 * POST /api/auth/delete-account
 * Permanently delete current user's account
 * Requires authentication and password confirmation
 * 
 * Expected body:
 * { "password": "userPassword123" }
 */
router.post('/delete-account', requireAuth, (req, res) => {
  const controller = authController.deleteAccount(req.app.get('db'));
  controller(req, res);
});

module.exports = router;
