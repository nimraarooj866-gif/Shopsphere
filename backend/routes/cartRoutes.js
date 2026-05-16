// routes/cartRoutes.js
// Cart endpoints for guest and logged-in users

const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { requireAuth, validateStock } = require('../middleware/cartMiddleware');

/**
 * ================================================
 * GUEST CART ROUTES (No Authentication Required)
 * ================================================
 * These routes store cart items in the session
 * and work for users who haven't logged in yet
 */

/**
 * GET /api/cart/guest
 * Get the current guest's cart from database
 */
router.get('/guest', (req, res) => {
  const controller = cartController.getGuestCart(req.app.get('db'));
  controller(req, res);
});

/**
 * POST /api/cart/guest/add
 * Add item to guest cart (database + session)
 * 
 * Expected body:
 * {
 *   "productId": 1,
 *   "quantity": 2,
 *   "name": "Product Name",
 *   "price": 500,
 *   "img": "image.jpg"
 * }
 */
router.post('/guest/add', (req, res) => {
  const controller = cartController.addToGuestCart(req.app.get('db'));
  controller(req, res);
});

/**
 * DELETE /api/cart/guest/:productId
 * Remove item from guest cart
 */
router.delete('/guest/:productId', (req, res) => {
  const controller = cartController.removeFromGuestCart(req.app.get('db'));
  controller(req, res);
});

/**
 * PATCH /api/cart/guest/:productId
 * Update quantity of item in guest cart
 * 
 * Expected body:
 * { "quantity": 5 }
 */
router.patch('/guest/:productId', (req, res) => {
  const controller = cartController.updateGuestCartQuantity(req.app.get('db'));
  controller(req, res);
});

/**
 * DELETE /api/cart/guest
 * Clear entire guest cart
 */
router.delete('/guest', (req, res) => {
  const controller = cartController.clearGuestCart(req.app.get('db'));
  controller(req, res);
});

/**
 * ================================================
 * LOGGED-IN USER CART ROUTES
 * ================================================
 * These routes store cart items in the database
 * and require authentication (login)
 */

/**
 * Middleware: Require authentication for all routes below
 */
router.use(requireAuth);

/**
 * GET /api/cart
 * Get logged-in user's cart with all items and totals
 */
router.get('/', (req, res) => {
  const controller = cartController.getCart(req.app.get('db'));
  controller(req, res);
});

/**
 * POST /api/cart/add
 * Add item to user's database cart
 * 
 * Expected body:
 * {
 *   "productId": 1,
 *   "quantity": 2
 * }
 */
router.post('/add', (req, res) => {
  const controller = cartController.addToCart(req.app.get('db'));
  controller(req, res);
});

/**
 * PATCH /api/cart/item/:itemId
 * Update quantity of item in user's cart
 * 
 * Expected body:
 * { "quantity": 5 }
 */
router.patch('/item/:itemId', (req, res) => {
  const controller = cartController.updateCartQuantity(req.app.get('db'));
  controller(req, res);
});

/**
 * DELETE /api/cart/item/:itemId
 * Remove specific item from user's cart
 */
router.delete('/item/:itemId', (req, res) => {
  const controller = cartController.removeFromCart(req.app.get('db'));
  controller(req, res);
});

/**
 * DELETE /api/cart
 * Clear entire user's cart
 */
router.delete('/', (req, res) => {
  const controller = cartController.clearCart(req.app.get('db'));
  controller(req, res);
});

/**
 * POST /api/cart/merge
 * Merge guest cart into user's database cart
 * Called after successful login
 */
router.post('/merge', (req, res) => {
  const controller = cartController.mergeGuestCartToUser(req.app.get('db'));
  controller(req, res);
});

/**
 * ================================================
 * COUPON & CHECKOUT ROUTES
 * ================================================
 */

/**
 * POST /api/cart/validate-coupon
 * Validate coupon code and calculate discount
 * 
 * Expected body:
 * {
 *   "couponCode": "SAVE10",
 *   "subtotal": 5000
 * }
 */
router.post('/validate-coupon', (req, res) => {
  const controller = cartController.validateCoupon(req.app.get('db'));
  controller(req, res);
});

module.exports = router;
