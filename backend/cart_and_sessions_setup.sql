-- ============================================
-- Session Management & Cart System Setup
-- Run this AFTER database.sql to add session and enhanced cart tables
-- ============================================

USE Shopsphere;

-- ============================================
-- Sessions Table (for express-mysql-session)
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) COLLATE utf8mb4_bin PRIMARY KEY,
  expires INT UNSIGNED NOT NULL,
  data MEDIUMTEXT COLLATE utf8mb4_bin,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX expires (expires)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- ============================================
-- Enhanced Cart Table (per user)
-- ============================================
CREATE TABLE IF NOT EXISTS cart (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_cart (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Cart Items Table (individual product entries)
-- ============================================
CREATE TABLE IF NOT EXISTS cart_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cart_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (cart_id) REFERENCES cart(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY unique_cart_product (cart_id, product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Cart Totals View (for quick calculations)
-- ============================================
CREATE OR REPLACE VIEW cart_totals AS
SELECT 
    ci.cart_id,
    COUNT(ci.id) as item_count,
    SUM(ci.quantity) as total_quantity,
    SUM(ci.quantity * p.price) as subtotal,
    ROUND(SUM(ci.quantity * p.price) * 0.05, 2) as tax_amount,
    ROUND(SUM(ci.quantity * p.price) * 0.05 + 100, 2) as total_with_tax_and_shipping
FROM cart_items ci
JOIN products p ON ci.product_id = p.id
GROUP BY ci.cart_id;

-- ============================================
-- Indexes for Performance
-- ============================================
CREATE INDEX idx_cart_user ON cart(user_id);
CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX idx_cart_items_product ON cart_items(product_id);
CREATE INDEX idx_cart_items_created ON cart_items(added_at);

-- ============================================
-- Coupon/Discount Table (Optional)
-- ============================================
CREATE TABLE IF NOT EXISTS coupons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_type ENUM('percentage', 'fixed') DEFAULT 'percentage',
    discount_value DECIMAL(10, 2) NOT NULL,
    min_purchase_amount DECIMAL(10, 2) DEFAULT 0,
    max_uses INT DEFAULT NULL,
    current_uses INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    created_by INT,
    FOREIGN KEY (created_by) REFERENCES admins(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Order Items Table (stores cart snapshot)
-- ============================================
CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    product_name VARCHAR(100),
    price_at_order DECIMAL(10, 2),
    quantity INT NOT NULL,
    subtotal DECIMAL(10, 2),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Enhanced Orders Table
-- ============================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS 
    coupon_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS 
    coupon_discount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS 
    tax_amount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS 
    shipping_cost DECIMAL(10, 2) DEFAULT 100,
ADD COLUMN IF NOT EXISTS 
    status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS 
    notes TEXT;

-- ============================================
-- Setup Complete
-- ============================================
-- Tables Created:
-- ✓ sessions (for express-mysql-session)
-- ✓ cart (user carts)
-- ✓ cart_items (individual items in cart)
-- ✓ order_items (items in completed orders)
-- ✓ coupons (discount management)
-- ✓ Enhanced orders with coupon & tax fields
-- Views Created:
-- ✓ cart_totals (automatic calculations)
-- ============================================
