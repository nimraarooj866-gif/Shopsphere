-- Create product_conditions table to map products to skin conditions
CREATE TABLE IF NOT EXISTS product_conditions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    `condition` VARCHAR(50) NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY unique_product_condition (product_id, `condition`)
);

-- Insert mappings for existing products
-- Acne treatment products
INSERT INTO product_conditions (product_id, `condition`) 
SELECT id, 'Acne' FROM products WHERE name LIKE '%Face wash%' OR name LIKE '%Serum%' OR description LIKE '%Removes oil%'
ON DUPLICATE KEY UPDATE `condition`=`condition`;

-- All general skincare products can help with Eczema (moisturizers)
INSERT INTO product_conditions (product_id, `condition`) 
SELECT id, 'Eczema' FROM products WHERE category = 'skincare' AND (name LIKE '%Moistur%' OR name LIKE '%Cream%')
ON DUPLICATE KEY UPDATE `condition`=`condition`;

-- Sunscreen products for Keratosis and sun protection
INSERT INTO product_conditions (product_id, `condition`) 
SELECT id, 'Keratosis' FROM products WHERE name LIKE '%Sunscreen%' OR name LIKE '%Sunblock%'
ON DUPLICATE KEY UPDATE `condition`=`condition`;

-- Rosacea (sensitive skin, gentle products)
INSERT INTO product_conditions (product_id, `condition`) 
SELECT id, 'Rosacea' FROM products WHERE category = 'skincare' AND (name LIKE '%Cream%' OR name LIKE '%Moistur%')
ON DUPLICATE KEY UPDATE `condition`=`condition`;

-- Milia (gentle exfoliation, light products)
INSERT INTO product_conditions (product_id, `condition`) 
SELECT id, 'Milia' FROM products WHERE category = 'skincare'
ON DUPLICATE KEY UPDATE `condition`=`condition`;

-- Add some manual explicit mappings for clarity
DELETE FROM product_conditions WHERE 1=1;  -- Clear for clean mapping

-- Saeed Ghani products mappings
INSERT INTO product_conditions (product_id, `condition`) VALUES 
(1, 'Eczema'),   -- Moisturizing Cream
(1, 'Rosacea'),
(1, 'Milia'),
(2, 'Acne'),     -- Vitamin C Serum
(3, 'Keratosis'), -- Sunblock
(3, 'Rosacea'),
(3, 'Milia'),
(4, 'Keratosis'), -- Sunscreen
(4, 'Rosacea'),
(4, 'Milia'),
(6, 'Eczema'),   -- Vitamin C Cream
(6, 'Rosacea'),
(6, 'Milia'),
(7, 'Eczema'),   -- Lip Balm
(7, 'Rosacea'),
(8, 'Acne'),     -- Face wash
(8, 'Eczema'),
(8, 'Milia');
