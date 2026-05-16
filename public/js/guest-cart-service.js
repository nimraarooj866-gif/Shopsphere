/**
 * Guest Cart Service
 * Handles all guest cart operations via API
 * IMPORTANT: All requests include credentials: 'include' to send session cookies
 */

class GuestCartService {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.apiUrl = `${baseUrl}/api/guest-cart`;
  }

  /**
   * Add product to cart
   * @param {number} productId - Product ID
   * @param {number} quantity - Quantity to add
   * @returns {Promise<Object>} API response
   */
  async addToCart(productId, quantity) {
    try {
      const response = await fetch(`${this.apiUrl}/add`, {
        method: 'POST',
        credentials: 'include',  // ✅ CRITICAL: Send session cookie
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productId: parseInt(productId),
          quantity: parseInt(quantity)
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error adding to cart:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get all cart items for current session
   * @returns {Promise<Object>} Cart data with items and totals
   */
  async getCart() {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'GET',
        credentials: 'include'  // ✅ CRITICAL: Send session cookie
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching cart:', error);
      return { 
        success: false, 
        items: [], 
        totals: {
          itemCount: 0,
          totalQuantity: 0,
          subtotal: 0,
          tax: 0,
          shipping: 0,
          grandTotal: 0
        }
      };
    }
  }

  /**
   * Update quantity of a product
   * @param {number} productId - Product ID
   * @param {number} quantity - New quantity
   * @returns {Promise<Object>} API response
   */
  async updateQuantity(productId, quantity) {
    try {
      const response = await fetch(`${this.apiUrl}/${productId}`, {
        method: 'PUT',
        credentials: 'include',  // ✅ CRITICAL: Send session cookie
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quantity: parseInt(quantity)
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating quantity:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Remove product from cart
   * @param {number} productId - Product ID
   * @returns {Promise<Object>} API response
   */
  async removeFromCart(productId) {
    try {
      const response = await fetch(`${this.apiUrl}/${productId}`, {
        method: 'DELETE',
        credentials: 'include'  // ✅ CRITICAL: Send session cookie
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error removing from cart:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Clear entire cart
   * @returns {Promise<Object>} API response
   */
  async clearCart() {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'DELETE',
        credentials: 'include'  // ✅ CRITICAL: Send session cookie
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error clearing cart:', error);
      return { success: false, message: error.message };
    }
  }
}

// Create global instance for use in HTML
window.guestCartService = new GuestCartService();
