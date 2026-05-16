// routes/guestCartRoutes.js
// Guest cart API endpoints

const express = require('express');
const router = express.Router();
const guestCartController = require('../controllers/guestCartController');

/**
 * POST /api/guest-cart/add
 * Add product to guest cart (or update quantity if exists)
 * 
 * Body: {
 *   "productId": 1,
 *   "quantity": 2
 * }
 */
router.post('/add', (req, res) => {
  const controller = guestCartController.addToGuestCart(req.app.get('db'));
  controller(req, res);
});

/**
 * GET /api/guest-cart
 * Get all items in guest cart for current session
 */
router.get('/', (req, res) => {
  const controller = guestCartController.getGuestCart(req.app.get('db'));
  controller(req, res);
});

/**
 * PUT /api/guest-cart/:productId
 * Update quantity of specific product in cart
 * 
 * Body: {
 *   "quantity": 5
 * }
 */
router.put('/:productId', (req, res) => {
  const controller = guestCartController.updateGuestCartQuantity(req.app.get('db'));
  controller(req, res);
});

/**
 * DELETE /api/guest-cart/:productId
 * Remove specific product from cart
 */
router.delete('/:productId', (req, res) => {
  const controller = guestCartController.removeFromGuestCart(req.app.get('db'));
  controller(req, res);
});

/**
 * DELETE /api/guest-cart
 * Clear entire guest cart
 */
router.delete('/', (req, res) => {
  const controller = guestCartController.clearGuestCart(req.app.get('db'));
  controller(req, res);
});

module.exports = router;
