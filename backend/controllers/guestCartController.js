// controllers/guestCartController.js
// Simple guest cart management using dedicated guest_cart table

/**
 * Add product to guest cart
 * If product already exists for this session, update quantity
 * Uses atomic INSERT...ON DUPLICATE KEY UPDATE to prevent race conditions
 * 
 * POST /api/guest-cart/add
 * Body: { productId, quantity }
 */
function addToGuestCart(db) {
  return (req, res) => {
    const { productId, quantity } = req.body;
    const sessionId = req.sessionID;

    // Validate input
    if (!productId || !quantity || quantity < 1) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid product ID or quantity' 
      });
    }

    if (!sessionId) {
      return res.status(400).json({ 
        success: false,
        message: 'Session not initialized' 
      });
    }

    const quantityInt = parseInt(quantity);
    const productIdInt = parseInt(productId);

    // Use atomic INSERT...ON DUPLICATE KEY UPDATE to handle race conditions
    // This ensures that if product already exists, quantity is updated instead of duplicate entry
    db.query(
      `INSERT INTO guest_cart (session_id, product_id, quantity, created_at, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
       quantity = quantity + VALUES(quantity),
       updated_at = CURRENT_TIMESTAMP`,
      [sessionId, productIdInt, quantityInt],
      (err, result) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ 
            success: false,
            message: 'Failed to add product to cart' 
          });
        }

        // After insert, fetch the current quantity to return
        db.query(
          'SELECT quantity FROM guest_cart WHERE session_id = ? AND product_id = ?',
          [sessionId, productIdInt],
          (err, results) => {
            if (err) {
              console.error('Fetch error:', err);
              return res.status(500).json({ 
                success: false,
                message: 'Failed to verify cart update' 
              });
            }

            const finalQuantity = results.length > 0 ? results[0].quantity : quantityInt;
            const isNew = result.affectedRows === 1; // 1 = INSERT, 2 = UPDATE

            res.json({ 
              success: true,
              message: isNew ? 'Product added to cart' : 'Product quantity updated',
              productId: productIdInt,
              quantity: finalQuantity,
              isNew: isNew
            });
          }
        );
      }
    );
  };
}

/**
 * Get guest cart items
 * Fetches all products in cart for this session
 * 
 * GET /api/guest-cart
 */
function getGuestCart(db) {
  return (req, res) => {
    const sessionId = req.sessionID;

    if (!sessionId) {
      return res.status(400).json({ 
        success: false,
        message: 'Session not initialized' 
      });
    }

    db.query(
      `SELECT 
        gc.id,
        gc.session_id,
        gc.product_id,
        gc.quantity,
        gc.created_at,
        gc.updated_at,
        p.name,
        p.price,
        p.img,
        p.stock
      FROM guest_cart gc
      JOIN products p ON gc.product_id = p.id
      WHERE gc.session_id = ?
      ORDER BY gc.created_at DESC`,
      [sessionId],
      (err, results) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ 
            success: false,
            message: 'Database error' 
          });
        }

        // Calculate totals
        const itemCount = results.length;
        const totalQuantity = results.reduce((sum, item) => sum + item.quantity, 0);
        const subtotal = results.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const taxAmount = Math.round(subtotal * 0.05 * 100) / 100; // 5% tax
        const shippingCost = subtotal > 5000 ? 0 : 100; // Free shipping over Rs. 5000
        const grandTotal = subtotal + taxAmount + shippingCost;

        res.json({
          success: true,
          sessionId,
          items: results,
          itemCount,
          totalQuantity,
          subtotal: Math.round(subtotal * 100) / 100,
          taxAmount,
          shippingCost,
          grandTotal: Math.round(grandTotal * 100) / 100
        });
      }
    );
  };
}

/**
 * Update product quantity in guest cart
 * 
 * PUT /api/guest-cart/:productId
 * Body: { quantity }
 */
function updateGuestCartQuantity(db) {
  return (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body;
    const sessionId = req.sessionID;

    // Validate input
    if (!quantity || quantity < 1) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid quantity' 
      });
    }

    if (!sessionId) {
      return res.status(400).json({ 
        success: false,
        message: 'Session not initialized' 
      });
    }

    const quantityInt = parseInt(quantity);
    const productIdInt = parseInt(productId);

    db.query(
      'UPDATE guest_cart SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND product_id = ?',
      [quantityInt, sessionId, productIdInt],
      (err, result) => {
        if (err) {
          console.error('Update error:', err);
          return res.status(500).json({ 
            success: false,
            message: 'Database error' 
          });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ 
            success: false,
            message: 'Product not found in cart' 
          });
        }

        res.json({ 
          success: true,
          message: 'Quantity updated',
          productId: productIdInt,
          quantity: quantityInt
        });
      }
    );
  };
}

/**
 * Remove product from guest cart
 * 
 * DELETE /api/guest-cart/:productId
 */
function removeFromGuestCart(db) {
  return (req, res) => {
    const { productId } = req.params;
    const sessionId = req.sessionID;

    if (!sessionId) {
      return res.status(400).json({ 
        success: false,
        message: 'Session not initialized' 
      });
    }

    const productIdInt = parseInt(productId);

    db.query(
      'DELETE FROM guest_cart WHERE session_id = ? AND product_id = ?',
      [sessionId, productIdInt],
      (err, result) => {
        if (err) {
          console.error('Delete error:', err);
          return res.status(500).json({ 
            success: false,
            message: 'Database error' 
          });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ 
            success: false,
            message: 'Product not found in cart' 
          });
        }

        res.json({ 
          success: true,
          message: 'Product removed from cart',
          productId: productIdInt
        });
      }
    );
  };
}

/**
 * Clear entire guest cart
 * 
 * DELETE /api/guest-cart
 */
function clearGuestCart(db) {
  return (req, res) => {
    const sessionId = req.sessionID;

    if (!sessionId) {
      return res.status(400).json({ 
        success: false,
        message: 'Session not initialized' 
      });
    }

    db.query(
      'DELETE FROM guest_cart WHERE session_id = ?',
      [sessionId],
      (err, result) => {
        if (err) {
          console.error('Delete error:', err);
          return res.status(500).json({ 
            success: false,
            message: 'Database error' 
          });
        }

        res.json({ 
          success: true,
          message: 'Cart cleared',
          deletedItems: result.affectedRows
        });
      }
    );
  };
}

module.exports = {
  addToGuestCart,
  getGuestCart,
  updateGuestCartQuantity,
  removeFromGuestCart,
  clearGuestCart
};
