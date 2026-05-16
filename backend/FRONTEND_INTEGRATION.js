// FRONTEND_INTEGRATION.js
// 
// Complete example of how to use the session-based cart system from your frontend
// Include this file or copy these patterns to your script.js

// ================================================================
// HELPER FUNCTIONS
// ================================================================

const API_BASE = 'http://localhost:3000/api';

/**
 * Make authenticated API call
 * Automatically includes credentials for session cookies
 */
async function apiCall(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    credentials: 'include' // IMPORTANT: Include session cookies
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'API call failed');
  }

  return response.json();
}

/**
 * Check if user is logged in
 */
async function checkLoginStatus() {
  try {
    const data = await apiCall('/auth/session');
    return {
      isLoggedIn: data.isLoggedIn,
      user: data.user,
      sessionId: data.sessionId
    };
  } catch (error) {
    console.error('Session check failed:', error);
    return { isLoggedIn: false, user: null };
  }
}

/**
 * Get current cart (guest or user)
 */
async function getCart(isLoggedIn) {
  try {
    const endpoint = isLoggedIn ? '/cart' : '/cart/guest';
    const data = await apiCall(endpoint);
    return data;
  } catch (error) {
    console.error('Failed to get cart:', error);
    return { items: [], itemCount: 0, subtotal: 0, grandTotal: 0 };
  }
}

/**
 * Update UI to show cart count in header/navbar
 */
async function updateCartUI() {
  const session = await checkLoginStatus();
  const cart = await getCart(session.isLoggedIn);
  
  // Update cart count badge
  const cartBadge = document.querySelector('.cart-count');
  if (cartBadge) {
    cartBadge.textContent = cart.itemCount || 0;
  }
  
  // Update login status in UI
  const loginBtn = document.querySelector('.login-btn');
  const logoutBtn = document.querySelector('.logout-btn');
  
  if (session.isLoggedIn) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'block';
    const userGreeting = document.querySelector('.user-greeting');
    if (userGreeting) {
      userGreeting.textContent = `Welcome, ${session.user?.name || 'User'}!`;
    }
  } else {
    if (loginBtn) loginBtn.style.display = 'block';
    if (logoutBtn) logoutBtn.style.display = 'none';
  }
}


// ================================================================
// AUTHENTICATION ENDPOINTS
// ================================================================

/**
 * User Registration
 */
async function registerUser(name, email, password, confirmPassword) {
  try {
    const data = await apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, confirmPassword })
    });
    console.log('Registration successful:', data);
    return data;
  } catch (error) {
    console.error('Registration failed:', error.message);
    throw error;
  }
}

/**
 * User Login (automatic guest cart merge)
 * 
 * This is the KEY function that handles the guest → logged-in transition
 * After login, guest cart items are automatically merged into database cart
 */
async function loginUser(email, password) {
  try {
    const data = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    
    console.log('Login successful:', data);
    
    // Check if cart was merged
    if (data.cartMerged) {
      console.log(`✓ ${data.itemsMerged} items merged from guest cart`);
      // Show user a notification
      showNotification(`${data.itemsMerged} items from your guest cart have been merged!`);
    }
    
    // Update UI
    await updateCartUI();
    
    return data;
  } catch (error) {
    console.error('Login failed:', error.message);
    throw error;
  }
}

/**
 * User Logout
 * Guest cart is preserved for continued shopping
 */
async function logoutUser() {
  try {
    const data = await apiCall('/auth/logout', {
      method: 'POST'
    });
    console.log('Logout successful:', data);
    await updateCartUI();
    return data;
  } catch (error) {
    console.error('Logout failed:', error.message);
    throw error;
  }
}


// ================================================================
// GUEST CART ENDPOINTS (No Auth Required)
// ================================================================

/**
 * Add item to guest cart (session-based)
 */
async function addToGuestCart(productId, quantity, productName, price, imageUrl) {
  try {
    const data = await apiCall('/cart/guest/add', {
      method: 'POST',
      body: JSON.stringify({
        productId,
        quantity,
        name: productName,
        price,
        img: imageUrl
      })
    });
    console.log('Added to guest cart:', data);
    await updateCartUI();
    return data;
  } catch (error) {
    console.error('Failed to add to guest cart:', error.message);
    throw error;
  }
}

/**
 * Remove item from guest cart
 */
async function removeFromGuestCart(productId) {
  try {
    const data = await apiCall(`/cart/guest/${productId}`, {
      method: 'DELETE'
    });
    console.log('Removed from guest cart:', data);
    await updateCartUI();
    return data;
  } catch (error) {
    console.error('Failed to remove from guest cart:', error.message);
    throw error;
  }
}

/**
 * Update quantity in guest cart
 */
async function updateGuestCartQuantity(productId, quantity) {
  try {
    const data = await apiCall(`/cart/guest/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity })
    });
    console.log('Updated guest cart quantity:', data);
    await updateCartUI();
    return data;
  } catch (error) {
    console.error('Failed to update guest cart quantity:', error.message);
    throw error;
  }
}

/**
 * Clear guest cart
 */
async function clearGuestCart() {
  try {
    const data = await apiCall('/cart/guest', {
      method: 'DELETE'
    });
    console.log('Guest cart cleared:', data);
    await updateCartUI();
    return data;
  } catch (error) {
    console.error('Failed to clear guest cart:', error.message);
    throw error;
  }
}


// ================================================================
// USER CART ENDPOINTS (Requires Authentication)
// ================================================================

/**
 * Add item to user's database cart
 * Must be logged in
 */
async function addToCart(productId, quantity) {
  try {
    const data = await apiCall('/cart/add', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity })
    });
    console.log('Added to user cart:', data);
    await updateCartUI();
    return data;
  } catch (error) {
    console.error('Failed to add to user cart:', error.message);
    throw error;
  }
}

/**
 * Remove item from user's cart
 * Must be logged in
 */
async function removeFromCart(itemId) {
  try {
    const data = await apiCall(`/cart/item/${itemId}`, {
      method: 'DELETE'
    });
    console.log('Removed from user cart:', data);
    await updateCartUI();
    return data;
  } catch (error) {
    console.error('Failed to remove from user cart:', error.message);
    throw error;
  }
}

/**
 * Update quantity in user's cart
 * Must be logged in
 */
async function updateCartQuantity(itemId, quantity) {
  try {
    const data = await apiCall(`/cart/item/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity })
    });
    console.log('Updated cart quantity:', data);
    await updateCartUI();
    return data;
  } catch (error) {
    console.error('Failed to update cart quantity:', error.message);
    throw error;
  }
}

/**
 * Clear user's entire cart
 * Must be logged in
 */
async function clearCart() {
  try {
    const data = await apiCall('/cart', {
      method: 'DELETE'
    });
    console.log('User cart cleared:', data);
    await updateCartUI();
    return data;
  } catch (error) {
    console.error('Failed to clear user cart:', error.message);
    throw error;
  }
}


// ================================================================
// COUPON & CHECKOUT
// ================================================================

/**
 * Validate coupon code
 */
async function validateCoupon(couponCode, subtotal) {
  try {
    const data = await apiCall('/cart/validate-coupon', {
      method: 'POST',
      body: JSON.stringify({ couponCode, subtotal })
    });
    console.log('Coupon valid:', data);
    return data;
  } catch (error) {
    console.error('Invalid coupon:', error.message);
    throw error;
  }
}


// ================================================================
// UI HELPER FUNCTIONS
// ================================================================

/**
 * Display success/error notifications
 */
function showNotification(message, type = 'success', duration = 3000) {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'error' ? '#ff6b6b' : '#51cf66'};
    color: white;
    padding: 15px 20px;
    border-radius: 5px;
    z-index: 1000;
    animation: slideIn 0.3s ease-out;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, duration);
}

/**
 * Example: "Add to Cart" button click handler
 */
async function handleAddToCart(event, productId, productName, price, imageUrl) {
  event.preventDefault();
  
  const session = await checkLoginStatus();
  const quantity = parseInt(document.querySelector('.quantity-input')?.value || 1);
  
  try {
    if (session.isLoggedIn) {
      // User is logged in: add to database cart
      await addToCart(productId, quantity);
      showNotification('✓ Added to cart');
    } else {
      // Guest user: add to session cart
      await addToGuestCart(productId, quantity, productName, price, imageUrl);
      showNotification('✓ Added to cart (guest cart)');
    }
  } catch (error) {
    showNotification(`✗ ${error.message}`, 'error');
  }
}

/**
 * Example: Display cart page
 */
async function displayCartPage() {
  const session = await checkLoginStatus();
  const cart = await getCart(session.isLoggedIn);
  
  const cartContainer = document.querySelector('.cart-items');
  
  if (cart.items.length === 0) {
    cartContainer.innerHTML = '<p>Your cart is empty</p>';
    return;
  }
  
  let html = '<table><thead><tr><th>Product</th><th>Price</th><th>Quantity</th><th>Subtotal</th><th>Action</th></tr></thead><tbody>';
  
  cart.items.forEach(item => {
    const subtotal = item.price * item.quantity;
    html += `
      <tr>
        <td>${item.name}</td>
        <td>Rs. ${item.price}</td>
        <td>
          <input type="number" value="${item.quantity}" 
            onchange="updateQuantity('${session.isLoggedIn ? item.id : item.productId}', this.value, ${session.isLoggedIn})">
        </td>
        <td>Rs. ${subtotal}</td>
        <td>
          <button onclick="removeItem('${session.isLoggedIn ? item.id : item.productId}', ${session.isLoggedIn})">
            Remove
          </button>
        </td>
      </tr>
    `;
  });
  
  html += '</tbody></table>';
  html += `
    <div class="cart-summary">
      <p>Subtotal: Rs. ${cart.subtotal}</p>
      <p>Tax (5%): Rs. ${cart.taxAmount}</p>
      <p>Shipping: Rs. ${cart.shippingCost}</p>
      <h3>Total: Rs. ${cart.grandTotal}</h3>
    </div>
  `;
  
  cartContainer.innerHTML = html;
}

/**
 * Helper: Update quantity from cart page
 */
async function updateQuantity(itemId, quantity, isLoggedIn) {
  try {
    if (isLoggedIn) {
      await updateCartQuantity(itemId, parseInt(quantity));
    } else {
      await updateGuestCartQuantity(itemId, parseInt(quantity));
    }
    displayCartPage();
  } catch (error) {
    showNotification(`✗ ${error.message}`, 'error');
  }
}

/**
 * Helper: Remove item from cart page
 */
async function removeItem(itemId, isLoggedIn) {
  try {
    if (isLoggedIn) {
      await removeFromCart(itemId);
    } else {
      await removeFromGuestCart(itemId);
    }
    displayCartPage();
  } catch (error) {
    showNotification(`✗ ${error.message}`, 'error');
  }
}


// ================================================================
// INITIALIZATION
// ================================================================

// Run on page load
document.addEventListener('DOMContentLoaded', () => {
  updateCartUI();
});
