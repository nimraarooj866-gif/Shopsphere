-- complete Shopsphere database (drop/create then all tables + views)
DROP DATABASE IF EXISTS Shopsphere;
CREATE DATABASE Shopsphere;
USE Shopsphere;

-- ============================================
-- 1. users & admins
-- ============================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255)
);

CREATE TABLE admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255)
);

-- ============================================
-- 2. products (with stock column)
-- ============================================
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    price DECIMAL(10,2),
    description VARCHAR(255),
    img VARCHAR(255),
    category VARCHAR(50),
    stock INT DEFAULT 0
);

-- ============================================
-- 3. banners
-- ============================================
CREATE TABLE banners (
  id INT AUTO_INCREMENT PRIMARY KEY,
  image_url VARCHAR(255) NOT NULL,
  title VARCHAR(100),
  subtitle VARCHAR(255),
  button_text VARCHAR(50),
  button_link VARCHAR(255),
  display_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1
);

-- ============================================
-- 4. basic cart (legacy – you may ignore)
-- ============================================
CREATE TABLE cart (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    product_id INT,
    quantity INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================
-- 5. orders (basic)
-- ============================================
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    order_date TIMESTAMP,
    total_amount DECIMAL(10,2),
    status VARCHAR(50),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================
-- 6. sample data
-- ============================================
INSERT INTO products (name, price, description, img, category, stock) VALUES
('Saeed Ghani Moisturizing Cream', 405, 'Moisturizer', 'images/moisturizing-cream.jpg', 'skincare', 12),
('Dr Rashel Vitamin C Serum', 650, 'Brightening serum', 'images/vitamin-c-serum.jpg', 'skincare', 8),
('Olim Naturals Sunblock SPF-50+', 550, 'SPF 50 Sunblock', 'images/sunblock.jpg', 'skincare', 5),
('Spectra Block Sunscreen Pro SPF', 880, 'Sunscreen SPF 50+', 'images/sunscreen.jpg', 'skincare', 3),
('Saeed Ghani Onion Shampoo', 500, 'Hair care', 'images/shampoo.jpg', 'haircare', 15),
('Saeed Ghani Vitamin C Cream', 405, 'Vitamin C Cream', 'images/vitamin-c-cream.jpg', 'skincare', 0),
('Vaseline Rose Therapy Lip Balm', 510, 'Lip care', 'images/lip-balm.jpg', 'skincare', 2),
('BNB Organic Rice Extract Face wash', 650, 'Face wash', 'images/face-wash.jpg', 'skincare', 7);

INSERT INTO banners (image_url, title, subtitle, button_text, button_link, display_order) VALUES
('images/banner1.jpg', 'Glow Naturally', 'Clean • Safe • Effective Skincare', 'Shop Now', '/shop', 1),
('images/banner2.jpg', 'Herbal Beauty, Real Results', 'No Harsh Chemicals', 'Explore Collection', '/collection', 2),
('images/banner3.jpg', 'Find Your Perfect Routine', 'Acne • Dry Skin • Glow', 'Get Started', '/routine', 3);

-- ============================================
-- 7. sessions table for express-mysql-session
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
-- 8. guest_cart table (for guest users only)
-- ============================================
CREATE TABLE IF NOT EXISTS guest_cart (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(128) NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY unique_guest_product (session_id, product_id),
    INDEX idx_session_id (session_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 9. enhanced cart & cart_items
-- ============================================
CREATE TABLE IF NOT EXISTS cart (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    session_id VARCHAR(128) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_cart (user_id),
    UNIQUE KEY unique_session_cart (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

CREATE INDEX idx_cart_user ON cart(user_id);
CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX idx_cart_items_product ON cart_items(product_id);
CREATE INDEX idx_cart_items_created ON cart_items(added_at);

-- ============================================
-- 10. coupons/discounts
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
-- 11. order_items snapshot table
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
-- 12. enhance orders table
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
-- 13. session logs table for activity tracking
-- ============================================
CREATE TABLE IF NOT EXISTS session_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  user_id INT,
  activity VARCHAR(100) NOT NULL,
  ip_address VARCHAR(50),
  user_agent VARCHAR(500),
  details JSON,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session_id (session_id),
  INDEX idx_user_id (user_id),
  INDEX idx_activity (activity),
  INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Verify
SHOW TABLES;
-- ============================================
-- ✅ All tables and views created successfully.
--    Paste this entire script into MySQL to set up the full
--    Shopsphere database with sessions and cart system.
-- ============================================
