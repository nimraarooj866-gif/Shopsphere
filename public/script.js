// script.js - Combined products + cart + auth + header UI
// Replace your existing script.js with this file.
// - Fetch products and render
// - Robust cart (normalize qty, renderCartPage, empty-state)
// - Signup/login handlers
// - Header: hide 'Login' when user logged in, show Profile & Logout
// - Emits 'cartUpdated' and listens to it for UI updates

const API_BASE = 'http://localhost:3000';
const PRODUCTS_URL = `${API_BASE}/products`;
const CART_KEY = 'cart';

// ---------- Utilities ----------
function safeParse(json) { try { return JSON.parse(json); } catch { return null; } }
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function formatPKR(n) { n = Number(n) || 0; return 'Rs.' + n.toLocaleString('en-US'); }

// ---------- Cart storage & normalization ----------
function getCart() {
  try {
    const raw = sessionStorage.getItem(CART_KEY);
    const parsed = raw ? safeParse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(it => {
      const quantity = Number(it.quantity ?? it.qty ?? 0) || 0;
      return {
        id: it.id ?? null,
        name: it.name ?? it.title ?? 'Unknown',
        price: Number(it.price) || 0,
        quantity,
        image: it.image ?? it.img ?? ''
      };
    });
  } catch (err) { console.error('getCart', err); return []; }
}

function saveCart(cart) {
  try {
    const toSave = cart.map(it => ({
      id: it.id ?? null,
      name: it.name ?? 'Unknown',
      price: Number(it.price) || 0,
      quantity: Number(it.quantity) || 0,
      image: it.image ?? ''
    }));
    sessionStorage.setItem(CART_KEY, JSON.stringify(toSave));
    dispatchCartUpdated();
    updateCartCount();
  } catch (err) { console.error('saveCart', err); }
}

function dispatchCartUpdated() {
  try { window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { time: Date.now() } })); } catch(e) {}
}

// ---------- Cart UI helpers ----------
function updateCartCount() {
  const cart = getCart();
  const totalQty = cart.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const el = document.getElementById('cart-count') || document.querySelector('.cart-badge');
  if (el) el.textContent = totalQty;
}

function updateEmptyStateUI() {
  const cart = getCart();
  const hasItems = Array.isArray(cart) && cart.length > 0;
  const emptyNote = document.getElementById('empty-note');
  const summaryCard = document.querySelector('.summary-card');
  if (emptyNote) emptyNote.style.display = hasItems ? 'none' : 'flex';
  if (summaryCard) summaryCard.style.display = hasItems ? 'block' : 'none';
}

// ---------- Database cart sync functions ----------
function isLoggedIn() {
  const user = safeParse(localStorage.getItem('user') || 'null');
  return user && user.id;
}

async function fetchUserCartFromDB(userId) {
  try {
    const res = await fetch(`${API_BASE}/api/cart/${userId}`);
    if (!res.ok) return [];
    const data = await res.json();
    const cart = data.cart || [];
    // Ensure quantities are numbers
    return cart.map(item => ({
      ...item,
      quantity: Number(item.quantity) || 1,
      price: Number(item.price) || 0
    }));
  } catch (err) {
    console.error('Fetch cart from DB error:', err);
    return [];
  }
}

async function addItemToDBCart(userId, productId, quantity) {
  try {
    const res = await fetch(`${API_BASE}/api/cart/${userId}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, quantity })
    });
    return res.ok;
  } catch (err) {
    console.error('Add to DB cart error:', err);
    return false;
  }
}

async function updateDBCartQty(userId, productId, quantity) {
  try {
    const res = await fetch(`${API_BASE}/api/cart/${userId}/update/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity })
    });
    return res.ok;
  } catch (err) {
    console.error('Update DB cart error:', err);
    return false;
  }
}

async function removeItemFromDBCart(userId, productId) {
  try {
    const res = await fetch(`${API_BASE}/api/cart/${userId}/remove/${productId}`, {
      method: 'DELETE'
    });
    return res.ok;
  } catch (err) {
    console.error('Remove from DB cart error:', err);
    return false;
  }
}

// ---------- Guest cart database functions (session-based) ----------
/**
 * Fetch guest cart from database using session
 * GET /api/guest-cart
 */
async function fetchGuestCartFromDB() {
  try {
    const res = await fetch(`${API_BASE}/api/guest-cart`, {
      method: 'GET',
      credentials: 'include', // Include session cookie
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) return [];
    const data = await res.json();
    const cart = data.items || data.cart || [];
    // Ensure quantities are numbers and normalize field names
    return cart.map(item => ({
      id: item.product_id ?? item.id,
      name: item.name ?? item.title ?? 'Unknown',
      price: Number(item.price) || 0,
      quantity: Number(item.quantity) || 1,
      image: item.img ?? item.image ?? ''
    }));
  } catch (err) {
    console.error('Fetch guest cart from DB error:', err);
    return [];
  }
}

/**
 * Add item to guest cart
 * POST /api/guest-cart/add
 */
async function addItemToGuestCart(productId, quantity) {
  try {
    const res = await fetch(`${API_BASE}/api/guest-cart/add`, {
      method: 'POST',
      credentials: 'include', // Include session cookie
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity })
    });
    return res.ok;
  } catch (err) {
    console.error('Add to guest cart error:', err);
    return false;
  }
}

/**
 * Update quantity in guest cart
 * PUT /api/guest-cart/:productId
 */
async function updateGuestCartQty(productId, quantity) {
  try {
    const res = await fetch(`${API_BASE}/api/guest-cart/${productId}`, {
      method: 'PUT',
      credentials: 'include', // Include session cookie
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity })
    });
    return res.ok;
  } catch (err) {
    console.error('Update guest cart error:', err);
    return false;
  }
}

/**
 * Remove item from guest cart
 * DELETE /api/guest-cart/:productId
 */
async function removeItemFromGuestCart(productId) {
  try {
    const res = await fetch(`${API_BASE}/api/guest-cart/${productId}`, {
      method: 'DELETE',
      credentials: 'include', // Include session cookie
      headers: { 'Content-Type': 'application/json' }
    });
    return res.ok;
  } catch (err) {
    console.error('Remove from guest cart error:', err);
    return false;
  }
}

// ---------- Cart operations ----------
function addToCart(item, sourceEl) {
  try {
    const user = safeParse(localStorage.getItem('user') || 'null');
    
    // If user is logged in: use user cart
    if (user && user.id) {
      const cart = getCart();
      const idx = cart.findIndex(i => String(i.id) === String(item.id));
      const currentQty = idx > -1 ? Number(cart[idx].quantity) || 0 : 0;
      const newQty = currentQty + 1;
      
      if (idx > -1) cart[idx].quantity = newQty;
      else cart.push({ id: item.id ?? null, name: item.name ?? 'Unknown', price: Number(item.price) || 0, quantity: 1, image: item.image ?? '' });
      
      saveCart(cart);
      
      if (idx > -1) {
        updateDBCartQty(user.id, item.id, newQty);
      } else {
        addItemToDBCart(user.id, item.id, 1);
      }
      
      if (document.getElementById('cart-items')) renderCartPage();
      window.location.href = 'cart.html';
    } else {
      // Guest user: use guest cart API
      addItemToGuestCart(item.id, 1).then(success => {
        if (success) {
          // Reload cart from database to refresh UI
          window.location.href = 'cart.html';
        } else {
          alert('Failed to add item to cart');
        }
      });
    }
  } catch (err) { console.error('addToCart', err); }
}

function updateQty(id, delta) {
  try {
    const user = safeParse(localStorage.getItem('user') || 'null');
    
    // If user is logged in: use user cart
    if (user && user.id) {
      const cart = getCart();
      const idx = cart.findIndex(i => String(i.id) === String(id));
      if (idx === -1) return;
      cart[idx].quantity = Math.max(1, (Number(cart[idx].quantity) || 1) + delta);
      saveCart(cart);
      updateDBCartQty(user.id, id, cart[idx].quantity);
      if (document.getElementById('cart-items')) renderCartPage();
    } else {
      // Guest user: use guest cart API
      const cart = getCart();
      const idx = cart.findIndex(i => String(i.id) === String(id));
      if (idx === -1) return;
      const newQty = Math.max(1, (Number(cart[idx].quantity) || 1) + delta);
      updateGuestCartQty(id, newQty).then(success => {
        if (success) {
          cart[idx].quantity = newQty;
          saveCart(cart);
          if (document.getElementById('cart-items')) renderCartPage();
        } else {
          alert('Failed to update quantity');
        }
      });
    }
  } catch (err) { console.error('updateQty', err); }
}

function removeItem(id) {
  try {
    const user = safeParse(localStorage.getItem('user') || 'null');
    
    // If user is logged in: use user cart
    if (user && user.id) {
      let cart = getCart();
      cart = cart.filter(i => String(i.id) !== String(id));
      saveCart(cart);
      removeItemFromDBCart(user.id, id);
      if (document.getElementById('cart-items')) renderCartPage();
    } else {
      // Guest user: use guest cart API
      removeItemFromGuestCart(id).then(success => {
        if (success) {
          let cart = getCart();
          cart = cart.filter(i => String(i.id) !== String(id));
          saveCart(cart);
          if (document.getElementById('cart-items')) renderCartPage();
        } else {
          alert('Failed to remove item');
        }
      });
    }
  } catch (err) { console.error('removeItem', err); }
}

function clearCart() {
  if (!confirm('Clear all items from cart?')) return;
  try {
    const user = safeParse(localStorage.getItem('user') || 'null');
    
    sessionStorage.removeItem(CART_KEY);
    dispatchCartUpdated();
    updateCartCount();
    
    // If logged-in user: clear from user cart API
    if (user && user.id) {
      fetch(`${API_BASE}/api/cart`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      }).catch(err => console.error('Clear user cart error:', err));
    } else {
      // Guest user: clear from guest cart API
      fetch(`${API_BASE}/api/guest-cart`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      }).catch(err => console.error('Clear guest cart error:', err));
    }
    
    if (document.getElementById('cart-items')) {
      renderCartPage().catch(err => console.error('Error rendering cart:', err));
    }
  } catch (err) { console.error('clearCart', err); }
}

// ---------- Visual helpers ----------
function showTickOnButton(btn) {
  if (!btn) return;
  const orig = btn.innerHTML;
  btn.disabled = true;
  // Create trolly element
  const trolly = document.createElement('span');
  trolly.className = 'trolly-slide';
  trolly.innerHTML = '🛒';
  // Animate: replace button content with trolly
  btn.innerHTML = '';
  btn.appendChild(trolly);
  btn.classList.add('trolly-animating');
  // After animation, restore button
  setTimeout(() => {
    btn.innerHTML = orig;
    btn.disabled = false;
    btn.classList.remove('trolly-animating');
  }, 1200);
}

// ---------- Render cart page ----------
function renderCartPage() {
  const container = document.getElementById('cart-items');
  if (!container) return;
  container.innerHTML = '';
  const cart = getCart();
  const emptyNote = document.getElementById('empty-note');
  const summaryEl = document.getElementById('cart-summary');
  const subtotalEl = document.getElementById('subtotal');
  const estimatedEl = document.getElementById('estimated');
  const hasItems = Array.isArray(cart) && cart.length > 0;

  if (emptyNote) emptyNote.style.display = hasItems ? 'none' : 'flex';
  if (summaryEl) summaryEl.style.display = hasItems ? 'block' : 'none';

  if (!hasItems) {
    if (subtotalEl) subtotalEl.textContent = formatPKR(0);
    if (estimatedEl) estimatedEl.textContent = formatPKR(0);
    updateCartCount();
    return;
  }

  cart.forEach(item => {
    const itemEl = document.createElement('article');
    itemEl.className = 'cart-card';
    itemEl.innerHTML = `
      <img src="${escapeHtml(item.image) || 'https://via.placeholder.com/120x90?text=Product'}" alt="${escapeHtml(item.name)}" class="cart-thumb">
      <div class="cart-meta">
        <h3 class="cart-title">${escapeHtml(item.name)}</h3>
        <div class="cart-price">${formatPKR(item.price)}</div>
        <div class="qty-row">
          <button class="qty-btn dec" data-id="${escapeHtml(item.id)}">−</button>
          <span class="qty">${escapeHtml(item.quantity)}</span>
          <button class="qty-btn inc" data-id="${escapeHtml(item.id)}">+</button>
          <button class="remove-btn" data-id="${escapeHtml(item.id)}" title="Remove item">🗑️</button>
        </div>
      </div>
    `;
    container.appendChild(itemEl);
  });

  container.querySelectorAll('.qty-btn.inc').forEach(b => b.addEventListener('click', () => updateQty(b.dataset.id, +1)));
  container.querySelectorAll('.qty-btn.dec').forEach(b => b.addEventListener('click', () => updateQty(b.dataset.id, -1)));
  container.querySelectorAll('.remove-btn').forEach(b => b.addEventListener('click', () => removeItem(b.dataset.id)));

  calculateTotals();
  updateEmptyStateUI();
}

function calculateTotals() {
  const cart = getCart();
  const subtotal = cart.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
  const subtotalEl = document.getElementById('subtotal');
  const estimatedEl = document.getElementById('estimated');
  if (subtotalEl) subtotalEl.textContent = formatPKR(subtotal);
  const estimated = Math.max(0, subtotal + 200);
  if (estimatedEl) estimatedEl.textContent = formatPKR(estimated);
  updateCartCount();
}

// ---------- Products rendering ----------
window.renderProducts = function(products, container) {
  const defaultContainer = document.getElementById('products') || document.getElementById('products-list') || document.getElementById('search-products');
  container = container || defaultContainer;
  if (!container) return;
  // Add a helper CSS class when a single product is rendered so we can style it prominently
  try { container.classList.toggle('single-item', Array.isArray(products) && products.length === 1); } catch(e) {}
  container.innerHTML = '';
  if (!products || products.length === 0) {
    container.innerHTML = "<p style='text-align:center;'>No products found.</p>";
    return;
  }
  products.forEach(product => {
    const div = document.createElement('div');
    div.className = 'product';
    div.dataset.id = product.id;
    div.dataset.name = product.name;
    div.dataset.price = product.price;
    div.dataset.image = product.image ?? product.img ?? '';
    const imgSrc = product.image ? `images/${product.image}` : (product.img ? product.img : 'images/default.png');
      // Normalize image src: if product.image or product.img already looks like a URL/path, don't prefix
      function normalizeSrc(src) {
        if (!src) return 'images/default.png';
        const s = src.toString();
        if (/^(https?:)?\/\//i.test(s)) return s; // absolute URL
        if (s.startsWith('/')) return s.slice(1); // remove leading slash for relative
        if (s.startsWith('images/')) return s; // already prefixed
        return `images/${s}`;
      }
      const finalImg = normalizeSrc(product.image ?? product.img ?? '');
    div.innerHTML = `
      <img src="${finalImg}" alt="${escapeHtml(product.name)}">
      <h3>${escapeHtml(product.name)}</h3>
      <p>${escapeHtml(product.description || '')}</p>
      <p class="price"><b>Price:</b> Rs. ${product.price}</p>
      <div class="card-actions">
        <a class="view-details" href="product.html?id=${encodeURIComponent(product.id)}">View Details</a>
        <button class="add-to-cart">Add to Cart</button>
      </div>
    `;
    container.appendChild(div);
    // note: a delegated click handler below already handles
    // `button.add-to-cart`, so we don’t need to attach a second
    // listener here.  removing the direct listener prevents the
    // "double add" bug where every click fired twice.
    //
    // keep the quick-add button since it uses a different class
    // and isn’t covered by the delegation logic.
    const quick = div.querySelector('.quick-add');
    if (quick) quick.addEventListener('click', (ev) => addToCart({ id: String(product.id), name: product.name, price: Number(product.price), image: finalImg }, ev.currentTarget));
  });
};

// ---------- Fetch products ----------
function fetchProductsAndRender() {
  fetch(PRODUCTS_URL).then(res => res.json()).then(data => {
    window.allProducts = data;
    if (document.getElementById('products')) window.renderProducts(data.slice(0,6), document.getElementById('products'));
    if (document.getElementById('products-list')) window.renderProducts(data, document.getElementById('products-list'));
  }).catch(err => console.error('Products fetch error:', err));
}

// ---------- Delegated handlers ----------
document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'checkout-btn') {
    const cart = getCart();
    if (!cart || cart.length === 0) { alert('Your cart is empty.'); return; }
    window.location.href = 'checkout.html';
  }
  if (e.target && e.target.id === 'clear-cart') clearCart();
  // Delegated handler: ensure any button with class `add-to-cart` will add item
  const addBtn = e.target.closest && e.target.closest('button.add-to-cart');
  if (addBtn) {
    // Try to infer product data from nearest .product element or data attributes on the button
    try {
      const productEl = addBtn.closest && addBtn.closest('.product');
      let id = addBtn.dataset.id || (productEl && productEl.dataset.id) || addBtn.getAttribute('data-id');
      let name = addBtn.dataset.name || (productEl && productEl.dataset.name) || addBtn.getAttribute('data-name');
      let price = addBtn.dataset.price || (productEl && productEl.dataset.price) || addBtn.getAttribute('data-price');
      let image = addBtn.dataset.image || (productEl && productEl.dataset.image) || addBtn.getAttribute('data-image') || '';
      // Fallback: if price is not numeric, try to parse from nearby .price element
      if ((!price || isNaN(Number(price))) && productEl) {
        const priceEl = productEl.querySelector && (productEl.querySelector('.price') || productEl.querySelector('.product-price'));
        if (priceEl) {
          const m = (priceEl.textContent || '').match(/([\d,.]+)/);
          if (m) price = m[1].replace(/,/g, '');
        }
      }
      // Build item and add
      const item = { id: id ?? String(Math.random()).slice(2,8), name: name || 'Unknown', price: Number(price) || 0, image };
      addToCart(item, addBtn);
    } catch (err) { console.error('delegated add-to-cart', err); }
  }
});

// ---------- Auth UI (hide login link when user logged in) ----------
function handleAuthUI() {
  try {
    const navLogin = document.querySelector('a[href="login.html"]');
    const nav = navLogin ? navLogin.parentElement : document.querySelector('nav');
    const user = safeParse(localStorage.getItem('user') || 'null');

    // Remove existing to avoid duplicates
    const prevAcc = document.getElementById('nav-account');
    const prevOut = document.getElementById('nav-logout');
    if (prevAcc) prevAcc.remove();
    if (prevOut) prevOut.remove();

    // If logged in: hide login link and show Profile & Logout
    if (user && nav) {
      if (navLogin) navLogin.style.display = 'none';

      // Profile link (labelled "Profile")
      const acc = document.createElement('a');
      acc.href = 'profile.html';
      acc.id = 'nav-account';
      acc.textContent = 'Profile';
      acc.style.color = '#fff';
      acc.style.fontWeight = '700';
      acc.style.marginLeft = '12px';
      // Navigation will happen via normal link; no extra handler required
      nav.appendChild(acc);

      // Logout link
      const out = document.createElement('a');
      out.href = '#';
      out.id = 'nav-logout';
      out.textContent = 'Logout';
      out.style.color = '#fff';
      out.style.marginLeft = '8px';
      out.addEventListener('click', async (ev) => {
        ev.preventDefault();
        
        try {
          // Call backend logout endpoint to clear user session
          // NOTE: Session ID is preserved so guest_cart items remain accessible
          await fetch(`${API_BASE}/logout`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (err) {
          console.error('Logout error:', err);
        }

        // Clear user from localStorage
        localStorage.removeItem('user');
        
        // Clear current cart from sessionStorage
        sessionStorage.removeItem('cart');
        
        // Reload guest cart items using the SAME session ID
        const guestCart = await fetchGuestCartFromDB();
        if (guestCart && guestCart.length > 0) {
          sessionStorage.setItem('cart', JSON.stringify(guestCart));
          updateCartCount();
        } else {
          updateCartCount();
        }
        
        updateEmptyStateUI();
        
        // Update auth UI
        handleAuthUI();
        
        // Redirect to cart page to show recovered items
        window.location.href = 'cart.html';
      });
      nav.appendChild(out);
    } else {
      // not logged in: show login link and ensure no account/logout present
      if (navLogin) navLogin.style.display = '';
      if (profileBtn) profileBtn.classList.add('hidden');
      const acc = document.getElementById('nav-account');
      const out = document.getElementById('nav-logout');
      if (acc) acc.remove();
      if (out) out.remove();
    }
  } catch (err) { console.error('handleAuthUI', err); }
}

// ---------- Signup & Login handlers ----------
document.addEventListener('DOMContentLoaded', () => {
  // Signup
  const signupForm = document.getElementById("signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("signup-name").value.trim();
      const email = document.getElementById("signup-email").value.trim();
      const password = document.getElementById("signup-password").value.trim();
      try {
        const res = await fetch(`${API_BASE}/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: 'include',
          body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        if (res.ok) {
          // Show merge notification if items were merged from guest cart
          let message = data.message || 'Signup successful';
          if (data.cartMerged && data.itemsMerged > 0) {
            message += ` (${data.itemsMerged} item${data.itemsMerged > 1 ? 's' : ''} from your guest cart added)`;
          }
          alert(message);

          // Create user object from response
          const user = {
            id: data.userId,
            name: name,
            email: email
          };
          localStorage.setItem('user', JSON.stringify(user));

          // Fetch user's cart from database and load into sessionStorage
          const dbCart = await fetchUserCartFromDB(user.id);
          if (dbCart && dbCart.length > 0) {
            sessionStorage.setItem('cart', JSON.stringify(dbCart));
            updateCartCount();
          }

          handleAuthUI();
          window.location.href = 'products.html';
        } else {
          alert(data.message || 'Signup error');
        }
      } catch (err) {
        console.error('Signup error', err);
        alert('Error during signup — check server or network (see console).');
      }
    });
  }

  // Login
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value.trim();
      try {
        const res = await fetch(`${API_BASE}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: 'include',
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok) {
          // Show merge notification if items were merged from guest cart
          let message = data.message || 'Login successful';
          if (data.cartMerged && data.itemsMerged > 0) {
            message += ` (${data.itemsMerged} item${data.itemsMerged > 1 ? 's' : ''} from your guest cart added)`;
          }
          alert(message);

          if (data.user) {
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Fetch user's cart from database and load into sessionStorage
            const dbCart = await fetchUserCartFromDB(data.user.id);
            if (dbCart && dbCart.length > 0) {
              sessionStorage.setItem('cart', JSON.stringify(dbCart));
              updateCartCount();
            }
          }
          handleAuthUI();
          window.location.href = 'products.html';
        } else {
          alert(data.message || 'Login failed');
        }
      } catch (err) {
        console.error('Login error', err);
        alert('Error during login — check server or network (see console).');
      }
    });
  }

  // run auth UI initial
  handleAuthUI();
});

// ---------- Init ----------
window.addEventListener('DOMContentLoaded', async () => {
  fetchProductsAndRender();
  
  const user = safeParse(localStorage.getItem('user') || 'null');
  
  // If user is logged in, fetch their cart from database
  if (user && user.id) {
    const dbCart = await fetchUserCartFromDB(user.id);
    if (dbCart && dbCart.length > 0) {
      sessionStorage.setItem('cart', JSON.stringify(dbCart));
    }
  } else {
    // Guest user: fetch from guest cart API
    const guestCart = await fetchGuestCartFromDB();
    if (guestCart && guestCart.length > 0) {
      sessionStorage.setItem('cart', JSON.stringify(guestCart));
    }
  }
  
  if (document.getElementById('cart-items')) renderCartPage();
  updateCartCount();
  handleAuthUI(); // Initialize auth UI
  // Cart icon button click handler
  const cartBtn = document.getElementById('cartIconBtn');
  if (cartBtn) {
    cartBtn.addEventListener('click', () => {
      window.location.href = 'cart.html';
    });
  }
});

// Stabilize UI
window.addEventListener('load', async () => {
  const user = safeParse(localStorage.getItem('user') || 'null');
  
  // If user is logged in, refresh cart from database
  if (user && user.id) {
    const dbCart = await fetchUserCartFromDB(user.id);
    if (dbCart && dbCart.length > 0) {
      sessionStorage.setItem('cart', JSON.stringify(dbCart));
    }
  } else {
    // Guest user: refresh from guest cart API
    const guestCart = await fetchGuestCartFromDB();
    if (guestCart && guestCart.length > 0) {
      sessionStorage.setItem('cart', JSON.stringify(guestCart));
    }
  }
  
  setTimeout(() => { if (document.getElementById('cart-items')) renderCartPage(); updateEmptyStateUI(); }, 120);
  setTimeout(updateEmptyStateUI, 700);
});

// Sync across tabs & listen cart updates
window.addEventListener('storage', (e) => {
  if (e.key === CART_KEY || e.key === 'cart') { try { renderCartPage(); updateEmptyStateUI(); } catch { updateEmptyStateUI(); } }
});
window.addEventListener('cartUpdated', () => updateEmptyStateUI());

// Expose API
window.getCart = getCart;
window.saveCart = saveCart;
window.addToCart = addToCart;
window.renderCartPage = renderCartPage;
window.updateEmptyStateUI = updateEmptyStateUI;

// ---------- Fetch products function (placed last) ----------
function fetchProductsAndRender() {
  fetch(PRODUCTS_URL)
    .then(res => res.json())
    .then(data => {
      window.allProducts = data;
      if (document.getElementById('products')) window.renderProducts(data.slice(0,6), document.getElementById('products'));
      if (document.getElementById('products-list')) window.renderProducts(data, document.getElementById('products-list'));
    })
    .catch(err => console.error('Products fetch error:', err));
}

// ---------- Filter UI ----------
function setupFilterUI() {
  const heroBtn = document.getElementById('heroFilterBtn');
  const filterIconBtn = document.getElementById('filterIconBtn');
  const floatingFilterBtn = document.getElementById('floatingFilterBtn');
  const filterModal = document.getElementById('filterModal');
  const closeFilterModal = document.getElementById('closeFilterModal');
  const inlineBtns = Array.from(document.querySelectorAll('.filter-btn'));
  const modalBtns = Array.from(document.querySelectorAll('.filter-modal-btn'));

  function openModal() { if (filterModal) filterModal.classList.add('active'); }
  function closeModal() { if (filterModal) filterModal.classList.remove('active'); }

  if (heroBtn) heroBtn.addEventListener('click', openModal);
  if (filterIconBtn) filterIconBtn.addEventListener('click', openModal);
  if (floatingFilterBtn) floatingFilterBtn.addEventListener('click', openModal);
  if (closeFilterModal) closeFilterModal.addEventListener('click', closeModal);
  if (filterModal) filterModal.addEventListener('click', (e) => { if (e.target === filterModal) closeModal(); });

  function setActive(category) {
    inlineBtns.forEach(b => b.classList.toggle('active', (b.dataset.category || '') === (category || '')));
    modalBtns.forEach(b => b.classList.toggle('active', (b.dataset.category || '') === (category || '')));
  }

  function getProductCategory(p) {
    return (p.category || p.category_name || p.type || p.cat || (Array.isArray(p.tags) ? p.tags.join(',') : '') || '').toString().toLowerCase();
  }

  function applyCategory(category) {
    if (!window.allProducts || !Array.isArray(window.allProducts)) return;
    const cat = (category || 'all').toString().toLowerCase();
    let filtered = window.allProducts;
    if (cat !== 'all') {
      filtered = window.allProducts.filter(p => {
        const pc = getProductCategory(p);
        return pc === cat || pc.split(',').map(s => s.trim()).includes(cat) || pc.includes(cat);
      });
    }
    const target = document.getElementById('products');
    if (target) window.renderProducts(filtered.slice(0, 6), target);
    setActive(category);
    closeModal();
  }

  inlineBtns.forEach(b => b.addEventListener('click', () => applyCategory(b.dataset.category)));
  modalBtns.forEach(b => b.addEventListener('click', () => applyCategory(b.dataset.category)));
}

document.addEventListener('DOMContentLoaded', setupFilterUI);

// ---------- Search handlers ----------
function performSearch(rawTerm) {
  const term = (rawTerm || '').toString().trim().toLowerCase();
  if (!window.allProducts || !Array.isArray(window.allProducts)) return;
  const results = term === '' ? window.allProducts : window.allProducts.filter(p => ((p.name||p.title||'') .toString().toLowerCase().includes(term)));

  // If we're on the products page (has products-list) show full results there, otherwise show in featured area
  const productsList = document.getElementById('products-list');
  const featured = document.getElementById('products');
  if (productsList) {
    window.renderProducts(results, productsList);
  } else if (featured) {
    // when searching from home show all matches (not limited), but if search is empty revert to featured slice
    if (term === '') window.renderProducts(window.allProducts.slice(0,6), featured);
    else window.renderProducts(results, featured);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const searchBtn = document.getElementById('searchBtn');
  const clearBtn = document.getElementById('clearBtn');
  const searchBar = document.getElementById('searchBar');
  if (searchBtn) searchBtn.addEventListener('click', () => performSearch(searchBar ? searchBar.value : ''));
  if (clearBtn) clearBtn.addEventListener('click', () => { if (searchBar) searchBar.value = ''; performSearch(''); });
  if (searchBar) searchBar.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); performSearch(searchBar.value); } });
});

// ---------- Banner Rotation ----------
let currentBannerIndex = 0;
let allBanners = [];
let bannerRotationTimer = null;

function fetchAndRenderBanners() {
  fetch(`${API_BASE}/banners`)
    .then(res => res.json())
    .then(data => {
      allBanners = Array.isArray(data) ? data : [];
      if (allBanners.length > 0) {
        renderBanner(0);
        if (allBanners.length > 1) startBannerRotation();
      }
    })
    .catch(err => console.error('Banners fetch error:', err));
}

function renderBanner(index) {
  if (!allBanners || allBanners.length === 0) return;
  const banner = allBanners[index % allBanners.length];
  const container = document.getElementById('bannersContainer');
  if (!container) return;
  
  // Add fade-out effect to old content
  const oldWrapper = container.querySelector('.banner-wrapper');
  if (oldWrapper) {
    oldWrapper.style.opacity = '0';
    oldWrapper.style.transform = 'translateX(-20px)';
  }
  
  setTimeout(() => {
    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'banner-wrapper';
    wrapper.style.cssText = 'position:relative;width:100%;max-width:900px;height:300px;overflow:hidden;border-radius:8px;margin:0 auto;opacity:0;transform:translateX(20px);';
    const img = document.createElement('img');
    img.src = banner.image_url || 'images/default-banner.png';
    img.alt = banner.title || 'Banner';
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
    wrapper.appendChild(img);
    if (banner.title || banner.subtitle || banner.button_text) {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.35);display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:20px;color:#fff;';
      if (banner.title) {
        const title = document.createElement('h3');
        title.textContent = banner.title;
        title.style.cssText = 'margin:0 0 6px 0;font-size:24px;font-weight:700;color:#fff;';
        overlay.appendChild(title);
      }
      if (banner.subtitle) {
        const subtitle = document.createElement('p');
        subtitle.textContent = banner.subtitle;
        subtitle.style.cssText = 'margin:0 0 12px 0;font-size:14px;color:#f0f0f0;';
        overlay.appendChild(subtitle);
      }
      if (banner.button_text && banner.button_link) {
        const btn = document.createElement('button');
        btn.textContent = banner.button_text;
        btn.style.cssText = 'padding:10px 22px;background:#C84771;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:14px;transition:all 0.3s ease;box-shadow:8px 8px 16px #d4738f, -8px -8px 16px #ffffff;';
        btn.addEventListener('click', () => window.location.href = 'products.html');
        btn.addEventListener('mouseenter', () => {
          btn.style.background = '#a83a5a';
          btn.style.transform = 'scale(1.05)';
          btn.style.boxShadow = '12px 12px 24px #d4738f, -12px -12px 24px #ffffff';
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.background = '#C84771';
          btn.style.transform = 'scale(1)';
          btn.style.boxShadow = '8px 8px 16px #d4738f, -8px -8px 16px #ffffff';
        });
        btn.addEventListener('mousedown', () => {
          btn.style.transform = 'scale(0.95)';
        });
        btn.addEventListener('mouseup', () => {
          btn.style.transform = 'scale(1.05)';
        });
        overlay.appendChild(btn);
      }
      wrapper.appendChild(overlay);
    }
    container.appendChild(wrapper);
    
    // Trigger animation
    setTimeout(() => {
      wrapper.style.opacity = '1';
      wrapper.style.transform = 'translateX(0)';
    }, 10);
  }, 300);
  
  currentBannerIndex = index;
}

function startBannerRotation() {
  if (bannerRotationTimer) clearInterval(bannerRotationTimer);
  bannerRotationTimer = setInterval(() => {
    currentBannerIndex = (currentBannerIndex + 1) % allBanners.length;
    renderBanner(currentBannerIndex);
  }, 5000); // rotate every 5 seconds
}

// Swipe gesture support for banner carousel
let touchStartX = 0;
let touchEndX = 0;

function handleSwipe() {
  const swipeDistance = touchStartX - touchEndX;
  const minSwipeDistance = 50; // minimum distance to trigger swipe
  
  if (Math.abs(swipeDistance) > minSwipeDistance) {
    if (swipeDistance > 0) {
      // Swiped left - show next banner
      currentBannerIndex = (currentBannerIndex + 1) % allBanners.length;
    } else {
      // Swiped right - show previous banner
      currentBannerIndex = (currentBannerIndex - 1 + allBanners.length) % allBanners.length;
    }
    renderBanner(currentBannerIndex);
    
    // Reset auto-rotation timer
    if (bannerRotationTimer) clearInterval(bannerRotationTimer);
    if (allBanners.length > 1) startBannerRotation();
  }
}

function initBannerSwipeGestures() {
  const container = document.getElementById('bannersContainer');
  if (!container) return;
  
  container.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, false);
  
  container.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, false);
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('bannersContainer')) {
    fetchAndRenderBanners();
    initBannerSwipeGestures();
  }
  
  // Initialize chatbot popup on homepage (only on index.html)
  initChatbotPopup();
});

// ---------- Chatbot Popup Handler (Homepage Only) ----------
function initChatbotPopup() {
  const popup = document.getElementById('chatbotPopup');
  const closeBtn = document.getElementById('closePopup');
  const openBtn = document.getElementById('openChatbotBtn');
  
  if (!popup) return; // Not on homepage
  
  // Show popup after 4-5 seconds
  setTimeout(() => {
    popup.classList.add('show');
  }, 4500);
  
  // Close popup button
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      popup.classList.remove('show');
    });
  }
  
  // Open chatbot button
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      window.location.href = 'chat.html';
    });
  }
  
  // Close popup when clicking outside
  document.addEventListener('click', (e) => {
    if (popup.classList.contains('show') && 
        !popup.contains(e.target) && 
        e.target.id !== 'openChatbotBtn') {
      popup.classList.remove('show');
    }
  });
}

// ---------- Chatbot icon handler ----------
// Open chat.html when chatbot icon is clicked
document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'chatbotToggle') {
    // Hide the small chatbot widget before opening full chat page
    const chatbotIcon = document.getElementById('chatbotToggle');
    const chatWindow = document.getElementById('chatWindow');
    if (chatbotIcon) chatbotIcon.style.display = 'none';
    if (chatWindow) chatWindow.style.display = 'none';
    window.location.href = 'chat.html';
  }
});
// ---------- Chatbot + Image Upload + SkinAI (Refined Fix) ----------

async function handleImageUpload(file){
    const chatContainer=document.querySelector('.messages-inner');
    if(!chatContainer)return;

    // Show image preview first
    const reader = new FileReader();
    reader.onload = async (event) => {
        const imageUrl = event.target.result;
        
        // Add user's image to chat
        const userMsg = document.createElement('div');
        userMsg.className = 'message user';
        const userBubble = document.createElement('div');
        userBubble.className = 'message-bubble';
        const img = document.createElement('img');
        img.src = imageUrl;
        img.style.maxWidth = '200px';
        img.style.borderRadius = '8px';
        userBubble.appendChild(img);
        userMsg.appendChild(userBubble);
        chatContainer.appendChild(userMsg);
        
        // Show typing indicator
        const typingEl = document.createElement('div');
        typingEl.className = 'typing-indicator bot';
        typingEl.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
        chatContainer.appendChild(typingEl);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await fetch(`${API_BASE}/api/predict-skin`, {method: 'POST', body: formData});
            const result = await res.json();
            typingEl.remove();

            if (result.success) {
                const msg = document.createElement('div');
                msg.className = 'message bot';
                const bubble = document.createElement('div');
                bubble.className = 'message-bubble prediction-result';
                
                const disease = document.createElement('div');
                disease.className = 'prediction-disease';
                disease.textContent = `🔍 Detected: ${result.disease}`;
                
                const confidence = document.createElement('div');
                confidence.className = 'prediction-confidence';
                confidence.textContent = `Confidence: ${(result.confidence*100).toFixed(2)}%`;
                
                const rec = document.createElement('div');
                rec.className = 'prediction-recommendation';
                rec.textContent = `💡 ${result.recommendations}`;
                
                bubble.appendChild(disease);
                bubble.appendChild(confidence);
                bubble.appendChild(rec);
                msg.appendChild(bubble);
                chatContainer.appendChild(msg);
                chatContainer.scrollTop = chatContainer.scrollHeight;
            } else {
                const errorMsg = document.createElement('div');
                errorMsg.className = 'message bot';
                errorMsg.innerHTML = `<div class="message-bubble">❌ Error: ${result.error || 'Prediction failed'}</div>`;
                chatContainer.appendChild(errorMsg);
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        } catch(err) {
            typingEl.remove();
            console.error(err);
            const errorMsg = document.createElement('div');
            errorMsg.className = 'message bot';
            errorMsg.innerHTML = `<div class="message-bubble">❌ Server error: ${err.message}</div>`;
            chatContainer.appendChild(errorMsg);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    };
    reader.readAsDataURL(file);
}

// Setup + button for image upload - DISABLED (handled in chat.html instead)
// document.addEventListener('DOMContentLoaded',()=>{
//     const chatAddBtn=document.getElementById('chatAddBtn');
//     if(chatAddBtn){
//         chatAddBtn.addEventListener('click',(e)=>{
//             e.preventDefault();
//             e.stopPropagation();
//             const inputFile=document.createElement('input');
//             inputFile.type='file';
//             inputFile.accept='image/*';
//             inputFile.onchange=async()=>{if(inputFile.files.length===0)return;const file=inputFile.files[0];await handleImageUpload(file);};
//             inputFile.click();
//         });
//     }
// });

// ---------- Init ----------
window.addEventListener('DOMContentLoaded',()=>{
    fetchProductsAndRender();
    if(document.getElementById('cart-items')) {
      renderCartPage().catch(err => console.error('Error rendering cart:', err));
    }
    updateCartCount();
    handleAuthUI();
    const cartBtn=document.getElementById('cartIconBtn');
    if(cartBtn)cartBtn.addEventListener('click',()=>{window.location.href='cart.html';});
});