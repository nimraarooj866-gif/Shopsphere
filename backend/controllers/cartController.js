// controllers/cartController.js
// Complete Cart Management System

/**
 * Cart Controller
 * 
 * Handles:
 * - Guest cart management (in-session)
 * - User cart management (database)
 * - Guest → Logged-in merge
 * - Cart CRUD operations
 * - Cart totals and checkout
 */

// =====================================================
// GUEST CART OPERATIONS (Database + Session)
// =====================================================

/**
 * Helper: Get or create guest cart (database)
 * Returns cartId for use in database operations
 */
function getOrCreateGuestCart(db, sessionId, callback) {
  db.query(
    'SELECT id FROM cart WHERE session_id = ? AND user_id IS NULL',
    [sessionId],
    (err, results) => {
      if (err) return callback(err, null);

      if (results.length > 0) {
        callback(null, results[0].id);
      } else {
        // Create new guest cart
        db.query(
          'INSERT INTO cart (session_id) VALUES (?)',
          [sessionId],
          function (err, insertResult) {
            if (err) return callback(err, null);
            callback(null, insertResult.insertId);
          }
        );
      }
    }
  );
}

/**
 * Add item to guest cart (Database + Session)
 * 
 * POST /api/cart/guest/add
 * Body: { productId, quantity, name, price, img }
 * 
 * Persistency: Items stored in both database (via session_id) and session
 */
function addToGuestCart(db) {
  return (req, res) => {
    const { productId, quantity } = req.body;
    const sessionId = req.sessionID;

    if (!productId || !quantity || quantity < 1) {
      return res.status(400).json({ message: 'Invalid product or quantity' });
    }

    if (!sessionId) {
      return res.status(400).json({ message: 'Session not initialized' });
    }

    // Get or create guest cart in database
    getOrCreateGuestCart(db, sessionId, (err, cartId) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      // Check if item already in cart
      db.query(
        'SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?',
        [cartId, productId],
        (err, results) => {
          if (err) return res.status(500).json({ message: 'Database error' });

          const newQuantity = parseInt(quantity);

          if (results.length > 0) {
            // Update existing item
            const updatedQuantity = results[0].quantity + newQuantity;
            db.query(
              'UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [updatedQuantity, results[0].id],
              (err) => {
                if (err) return res.status(500).json({ message: 'Failed to update cart' });

                // Also update session for consistency
                if (!req.session.cart) {
                  req.session.cart = [];
                }
                const sessionItem = req.session.cart.find(item => item.productId === parseInt(productId));
                if (sessionItem) {
                  sessionItem.quantity = updatedQuantity;
                } else {
                  req.session.cart.push({
                    productId: parseInt(productId),
                    quantity: updatedQuantity,
                    name: req.body.name,
                    price: parseFloat(req.body.price),
                    img: req.body.img
                  });
                }

                req.session.save(() => {
                  res.json({
                    message: 'Item quantity updated in cart',
                    itemCount: req.session.cart.length
                  });
                });
              }
            );
          } else {
            // Insert new item
            db.query(
              'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)',
              [cartId, productId, newQuantity],
              (err) => {
                if (err) return res.status(500).json({ message: 'Failed to add item to cart' });

                // Also update session
                if (!req.session.cart) {
                  req.session.cart = [];
                }
                req.session.cart.push({
                  productId: parseInt(productId),
                  quantity: newQuantity,
                  name: req.body.name,
                  price: parseFloat(req.body.price),
                  img: req.body.img
                });

                req.session.save(() => {
                  res.json({
                    message: 'Item added to cart',
                    itemCount: req.session.cart.length
                  });
                });
              }
            );
          }
        }
      );
    });
  };
}

/**
 * Remove item from guest cart (Database + Session)
 * 
 * DELETE /api/cart/guest/:productId
 */
function removeFromGuestCart(db) {
  return (req, res) => {
    const { productId } = req.params;
    const sessionId = req.sessionID;

    if (!sessionId) {
      return res.status(400).json({ message: 'Session not initialized' });
    }

    // Get guest cart from database
    getOrCreateGuestCart(db, sessionId, (err, cartId) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      // Find and delete the item
      db.query(
        'DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?',
        [cartId, parseInt(productId)],
        (err, result) => {
          if (err) return res.status(500).json({ message: 'Database error' });

          if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Product not found in cart' });
          }

          // Also update session
          if (req.session.cart) {
            req.session.cart = req.session.cart.filter(
              item => item.productId !== parseInt(productId)
            );
          }

          req.session.save(() => {
            res.json({
              message: 'Item removed from cart',
              itemCount: req.session.cart ? req.session.cart.length : 0
            });
          });
        }
      );
    });
  };
}

/**
 * Update quantity in guest cart (Database + Session)
 * 
 * PATCH /api/cart/guest/:productId
 * Body: { quantity }
 */
function updateGuestCartQuantity(db) {
  return (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body;
    const sessionId = req.sessionID;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: 'Invalid quantity' });
    }

    if (!sessionId) {
      return res.status(400).json({ message: 'Session not initialized' });
    }

    // Get guest cart from database
    getOrCreateGuestCart(db, sessionId, (err, cartId) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      // Update item in database
      db.query(
        'UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE cart_id = ? AND product_id = ?',
        [parseInt(quantity), cartId, parseInt(productId)],
        (err, result) => {
          if (err) return res.status(500).json({ message: 'Database error' });

          if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Product not found in cart' });
          }

          // Also update session
          if (req.session.cart) {
            const item = req.session.cart.find(item => item.productId === parseInt(productId));
            if (item) {
              item.quantity = parseInt(quantity);
            }
          }

          req.session.save(() => {
            res.json({
              message: 'Quantity updated',
              newQuantity: parseInt(quantity)
            });
          });
        }
      );
    });
  };
}

/**
 * Get guest cart (from Database)
 * 
 * GET /api/cart/guest
 * 
 * Fetches items from database using session_id
 */
function getGuestCart(db) {
  return (req, res) => {
    const sessionId = req.sessionID;

    if (!sessionId) {
      return res.json({
        items: [],
        itemCount: 0,
        subtotal: 0,
        taxAmount: 0,
        shippingCost: 100,
        grandTotal: 100
      });
    }

    // Get cart from database
    db.query(
      'SELECT id FROM cart WHERE session_id = ? AND user_id IS NULL',
      [sessionId],
      (err, cartResults) => {
        if (err) return res.status(500).json({ message: 'Database error' });

        if (cartResults.length === 0) {
          return res.json({
            items: [],
            itemCount: 0,
            subtotal: 0,
            taxAmount: 0,
            shippingCost: 100,
            grandTotal: 100
          });
        }

        const cartId = cartResults[0].id;

        // Get items from database
        db.query(
          `SELECT 
             ci.id, ci.product_id, ci.quantity, ci.added_at, ci.updated_at,
             p.name, p.price, p.img, p.stock
           FROM cart_items ci
           JOIN products p ON ci.product_id = p.id
           WHERE ci.cart_id = ?
           ORDER BY ci.added_at DESC`,
          [cartId],
          (err, items) => {
            if (err) return res.status(500).json({ message: 'Database error' });

            // Calculate totals
            const totals = calculateDatabaseCartTotals(items);

            res.json({
              cartId,
              items,
              ...totals
            });
          }
        );
      }
    );
  };
}

/**
 * Clear guest cart (Database + Session)
 * 
 * DELETE /api/cart/guest
 */
function clearGuestCart(db) {
  return (req, res) => {
    const sessionId = req.sessionID;

    if (!sessionId) {
      return res.status(400).json({ message: 'Session not initialized' });
    }

    // Get cart from database
    db.query(
      'SELECT id FROM cart WHERE session_id = ? AND user_id IS NULL',
      [sessionId],
      (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error' });

        if (results.length === 0) {
          req.session.cart = [];
          return req.session.save(() => {
            res.json({ message: 'Cart is already empty' });
          });
        }

        const cartId = results[0].id;

        // Delete all items from cart
        db.query(
          'DELETE FROM cart_items WHERE cart_id = ?',
          [cartId],
          (err) => {
            if (err) return res.status(500).json({ message: 'Failed to clear cart' });

            // Also clear session
            req.session.cart = [];
            req.session.save(() => {
              res.json({ message: 'Cart cleared' });
            });
          }
        );
      }
    );
  };
}

// =====================================================
// USER CART OPERATIONS (Database)
// =====================================================

/**
 * Add item to user cart (database)
 * 
 * POST /api/cart/add
 * Requires authentication
 */
function addToCart(db) {
  return (req, res) => {
    const userId = req.session.userId;
    const { productId, quantity } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'Please log in first' });
    }

    if (!productId || !quantity || quantity < 1) {
      return res.status(400).json({ message: 'Invalid product or quantity' });
    }

    // Get or create user's cart
    db.query(
      'SELECT id FROM cart WHERE user_id = ?',
      [userId],
      (err, cartResults) => {
        if (err) return res.status(500).json({ message: 'Database error' });

        let cartId;

        if (cartResults.length === 0) {
          // Create new cart
          db.query(
            'INSERT INTO cart (user_id) VALUES (?)',
            [userId],
            function (err, insertResult) {
              if (err) return res.status(500).json({ message: 'Failed to create cart' });
              cartId = insertResult.insertId;
              addItemToCart(db, res, cartId, productId, quantity);
            }
          );
        } else {
          cartId = cartResults[0].id;
          addItemToCart(db, res, cartId, productId, quantity);
        }
      }
    );
  };
}

/**
 * Helper: Add item to specific cart
 */
function addItemToCart(db, res, cartId, productId, quantity) {
  db.query(
    'SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?',
    [cartId, productId],
    (err, itemResults) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      if (itemResults.length > 0) {
        // Update existing item quantity
        const newQuantity = itemResults[0].quantity + quantity;
        db.query(
          'UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newQuantity, itemResults[0].id],
          (err) => {
            if (err) return res.status(500).json({ message: 'Update failed' });
            res.json({ message: 'Item quantity updated', newQuantity });
          }
        );
      } else {
        // Insert new item
        db.query(
          'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)',
          [cartId, productId, quantity],
          (err) => {
            if (err) {
              if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ message: 'Item already in cart' });
              }
              return res.status(500).json({ message: 'Failed to add item' });
            }
            res.json({ message: 'Item added to cart' });
          }
        );
      }
    }
  );
}

/**
 * Remove item from user cart
 * 
 * DELETE /api/cart/item/:itemId
 */
function removeFromCart(db) {
  return (req, res) => {
    const userId = req.session.userId;
    const { itemId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: 'Please log in first' });
    }

    // Verify item belongs to user's cart
    db.query(
      `SELECT ci.id FROM cart_items ci 
       JOIN cart c ON ci.cart_id = c.id 
       WHERE ci.id = ? AND c.user_id = ?`,
      [itemId, userId],
      (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        if (results.length === 0) {
          return res.status(404).json({ message: 'Item not found' });
        }

        db.query(
          'DELETE FROM cart_items WHERE id = ?',
          [itemId],
          (err) => {
            if (err) return res.status(500).json({ message: 'Failed to remove item' });
            res.json({ message: 'Item removed from cart' });
          }
        );
      }
    );
  };
}

/**
 * Update item quantity in user cart
 * 
 * PATCH /api/cart/item/:itemId
 * Body: { quantity }
 */
function updateCartQuantity(db) {
  return (req, res) => {
    const userId = req.session.userId;
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'Please log in first' });
    }

    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: 'Invalid quantity' });
    }

    // Verify item belongs to user's cart
    db.query(
      `SELECT ci.id FROM cart_items ci 
       JOIN cart c ON ci.cart_id = c.id 
       WHERE ci.id = ? AND c.user_id = ?`,
      [itemId, userId],
      (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        if (results.length === 0) {
          return res.status(404).json({ message: 'Item not found' });
        }

        db.query(
          'UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [quantity, itemId],
          (err) => {
            if (err) return res.status(500).json({ message: 'Update failed' });
            res.json({ message: 'Quantity updated' });
          }
        );
      }
    );
  };
}

/**
 * Get user's cart with all items and totals
 * 
 * GET /api/cart
 */
function getCart(db) {
  return (req, res) => {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Please log in first' });
    }

    db.query(
      `SELECT c.id, c.created_at, c.updated_at
       FROM cart c
       WHERE c.user_id = ?`,
      [userId],
      (err, cartResults) => {
        if (err) return res.status(500).json({ message: 'Database error' });

        if (cartResults.length === 0) {
          return res.json({
            items: [],
            itemCount: 0,
            subtotal: 0,
            taxAmount: 0,
            shippingCost: 100,
            grandTotal: 100
          });
        }

        const cartId = cartResults[0].id;

        db.query(
          `SELECT 
             ci.id, ci.product_id, ci.quantity, ci.added_at, ci.updated_at,
             p.name, p.price, p.img, p.stock
           FROM cart_items ci
           JOIN products p ON ci.product_id = p.id
           WHERE ci.cart_id = ?
           ORDER BY ci.added_at DESC`,
          [cartId],
          (err, itemResults) => {
            if (err) return res.status(500).json({ message: 'Database error' });

            const totals = calculateDatabaseCartTotals(itemResults);

            res.json({
              cartId,
              items: itemResults,
              ...totals
            });
          }
        );
      }
    );
  };
}

/**
 * Clear user's cart (delete all items)
 * 
 * DELETE /api/cart
 */
function clearCart(db) {
  return (req, res) => {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Please log in first' });
    }

    db.query(
      'DELETE FROM cart_items WHERE cart_id = (SELECT id FROM cart WHERE user_id = ?)',
      [userId],
      (err) => {
        if (err) return res.status(500).json({ message: 'Failed to clear cart' });
        res.json({ message: 'Cart cleared' });
      }
    );
  };
}

// =====================================================
// GUEST → LOGGED-IN MERGE
// =====================================================

/**
 * Merge guest cart into user's database cart
 * Called automatically after successful login
 * Fetches guest cart from database using session_id
 * 
 * POST /api/cart/merge
 */
function mergeGuestCartToUser(db) {
  return (req, res) => {
    const userId = req.session.userId;
    const sessionId = req.sessionID;

    if (!userId) {
      return res.status(401).json({ message: 'Please log in first' });
    }

    // Get guest cart from database (if it exists)
    db.query(
      'SELECT id FROM cart WHERE session_id = ? AND user_id IS NULL',
      [sessionId],
      (err, guestCartResults) => {
        if (err) return res.status(500).json({ message: 'Database error' });

        // If no guest cart exists, just return success
        if (guestCartResults.length === 0) {
          req.session.cart = [];
          return req.session.save(() => {
            res.json({ message: 'No items to merge', itemsMerged: 0 });
          });
        }

        const guestCartId = guestCartResults[0].id;

        // Get all items from guest cart
        db.query(
          'SELECT product_id, quantity FROM cart_items WHERE cart_id = ?',
          [guestCartId],
          (err, guestItems) => {
            if (err) return res.status(500).json({ message: 'Database error' });

            // If no items in guest cart, return success
            if (guestItems.length === 0) {
              return deleteGuestCartAndRespond(0);
            }

            // Get or create user's cart
            db.query(
              'SELECT id FROM cart WHERE user_id = ?',
              [userId],
              (err, userCartResults) => {
                if (err) return res.status(500).json({ message: 'Database error' });

                let userCartId;
                let mergedCount = 0;
                let completedMerges = 0;
                let errorOccurred = false;

                if (userCartResults.length === 0) {
                  // Create new user cart
                  db.query(
                    'INSERT INTO cart (user_id) VALUES (?)',
                    [userId],
                    function (err, insertResult) {
                      if (err) return res.status(500).json({ message: 'Failed to create cart' });
                      userCartId = insertResult.insertId;
                      performMerge();
                    }
                  );
                } else {
                  userCartId = userCartResults[0].id;
                  performMerge();
                }

                function performMerge() {
                  guestItems.forEach((guestItem) => {
                    db.query(
                      'SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?',
                      [userCartId, guestItem.product_id],
                      (err, itemResults) => {
                        if (errorOccurred) return;

                        if (err) {
                          errorOccurred = true;
                          return res.status(500).json({ message: 'Database error during merge' });
                        }

                        if (itemResults.length > 0) {
                          // Item exists: update quantity
                          const newQuantity = itemResults[0].quantity + guestItem.quantity;
                          db.query(
                            'UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                            [newQuantity, itemResults[0].id],
                            (err) => {
                              completedMerges++;
                              if (!err) mergedCount++;
                              checkMergeComplete();
                            }
                          );
                        } else {
                          // Item new: insert it
                          db.query(
                            'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)',
                            [userCartId, guestItem.product_id, guestItem.quantity],
                            (err) => {
                              completedMerges++;
                              if (!err) mergedCount++;
                              checkMergeComplete();
                            }
                          );
                        }
                      }
                    );
                  });

                  function checkMergeComplete() {
                    if (completedMerges === guestItems.length && !errorOccurred) {
                      deleteGuestCartAndRespond(mergedCount);
                    }
                  }
                }

                function deleteGuestCartAndRespond(count) {
                  // Delete guest cart and its items
                  db.query(
                    'DELETE FROM cart WHERE session_id = ? AND user_id IS NULL',
                    [sessionId],
                    (err) => {
                      if (err) {
                        return res.status(500).json({ message: 'Failed to clean up guest cart' });
                      }

                      // Clear session cart
                      req.session.cart = [];
                      req.session.save(() => {
                        res.json({
                          message: 'Guest cart merged successfully',
                          itemsMerged: count
                        });
                      });
                    }
                  );
                }
              }
            );
          }
        );
      }
    );
  };
}

// =====================================================
// CART TOTAL CALCULATIONS
// =====================================================

/**
 * Calculate guest cart totals
 */
function calculateGuestCartTotals(cart) {
  const itemCount = cart.length;
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const taxAmount = Math.round(subtotal * 0.05 * 100) / 100; // 5% tax
  const shippingCost = subtotal > 5000 ? 0 : 100; // Free shipping over Rs. 5000
  const grandTotal = subtotal + taxAmount + shippingCost;

  return {
    itemCount,
    subtotal: Math.round(subtotal * 100) / 100,
    taxAmount,
    shippingCost,
    grandTotal: Math.round(grandTotal * 100) / 100
  };
}

/**
 * Calculate database cart totals
 */
function calculateDatabaseCartTotals(items) {
  const itemCount = items.length;
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const taxAmount = Math.round(subtotal * 0.05 * 100) / 100; // 5% tax
  const shippingCost = subtotal > 5000 ? 0 : 100; // Free shipping over Rs. 5000
  const grandTotal = subtotal + taxAmount + shippingCost;

  return {
    itemCount,
    totalQuantity,
    subtotal: Math.round(subtotal * 100) / 100,
    taxAmount,
    shippingCost,
    grandTotal: Math.round(grandTotal * 100) / 100
  };
}

// =====================================================
// COUPON VALIDATION
// =====================================================

/**
 * Validate and apply coupon code
 * 
 * POST /api/cart/validate-coupon
 * Body: { couponCode, subtotal }
 */
function validateCoupon(db) {
  return (req, res) => {
    const { couponCode, subtotal } = req.body;

    if (!couponCode) {
      return res.status(400).json({ message: 'Coupon code required' });
    }

    db.query(
      `SELECT id, discount_type, discount_value, min_purchase_amount, max_uses, current_uses
       FROM coupons
       WHERE code = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > NOW())`,
      [couponCode.toUpperCase()],
      (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error' });

        if (results.length === 0) {
          return res.status(400).json({ message: 'Invalid or expired coupon code' });
        }

        const coupon = results[0];

        if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
          return res.status(400).json({ message: 'Coupon has reached maximum uses' });
        }

        if (subtotal < coupon.min_purchase_amount) {
          return res.status(400).json({
            message: `Minimum purchase of Rs. ${coupon.min_purchase_amount} required`
          });
        }

        let discountAmount = 0;
        if (coupon.discount_type === 'percentage') {
          discountAmount = Math.round((subtotal * coupon.discount_value) / 100 * 100) / 100;
        } else {
          discountAmount = coupon.discount_value;
        }

        res.json({
          message: 'Coupon valid',
          couponId: coupon.id,
          discountType: coupon.discount_type,
          discountValue: coupon.discount_value,
          discountAmount,
          newSubtotal: Math.max(0, subtotal - discountAmount)
        });
      }
    );
  };
}

module.exports = {
  // Guest cart
  addToGuestCart,
  removeFromGuestCart,
  updateGuestCartQuantity,
  getGuestCart,
  clearGuestCart,
  // User cart
  addToCart,
  removeFromCart,
  updateCartQuantity,
  getCart,
  clearCart,
  // Merge
  mergeGuestCartToUser,
  // Utilities
  calculateGuestCartTotals,
  calculateDatabaseCartTotals,
  validateCoupon
};
