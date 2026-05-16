/**
 * Product Recommendation Routes
 * Handles fetching products based on skin conditions
 */

module.exports = (app, db) => {
  /**
   * GET /api/products/recommend?condition=<skinCondition>
   * 
   * Returns products recommended for a specific skin condition
   * Response format:
   * {
   *   "success": true,
   *   "condition": "Acne",
   *   "count": 2,
   *   "products": [
   *     {
   *       "id": 1,
   *       "name": "Product Name",
   *       "description": "Short description",
   *       "price": "10.99",
   *       "image": "url/to/image.jpg",
   *       "link": "/product/1"
   *     }
   *   ]
   * }
   */
  app.get('/api/products/recommend', (req, res) => {
    const condition = req.query.condition;

    if (!condition) {
      return res.status(400).json({
        success: false,
        error: 'condition parameter is required'
      });
    }

    // Validate condition against known conditions
    const validConditions = ['Acne', 'Carcinoma', 'Eczema', 'Keratosis', 'Milia', 'Rosacea'];
    if (!validConditions.includes(condition)) {
      return res.status(400).json({
        success: false,
        error: `Invalid condition. Must be one of: ${validConditions.join(', ')}`
      });
    }

    // SQL query to get products for condition
    const query = `
      SELECT DISTINCT
        p.id,
        p.name,
        p.description,
        p.price,
        p.img,
        p.category,
        p.stock
      FROM products p
      INNER JOIN product_conditions pc ON p.id = pc.product_id
      WHERE pc.\`condition\` = ?
      AND p.stock > 0
      ORDER BY p.price ASC
      LIMIT 10
    `;

    db.query(query, [condition], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          error: 'Database error while fetching products'
        });
      }

      // Format response with product details
      const products = results.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: parseFloat(product.price).toFixed(2),
        image: product.img || '/images/placeholder.jpg',
        link: `/product.html?id=${product.id}`,
        stock: product.stock
      }));

      res.json({
        success: true,
        condition: condition,
        count: products.length,
        products: products
      });
    });
  });

  /**
   * GET /api/products/by-condition
   * Returns all conditions with their product counts
   * Useful for frontend to know available conditions
   */
  app.get('/api/products/by-condition', (req, res) => {
    const query = `
      SELECT DISTINCT
        pc.\`condition\` as condition,
        COUNT(DISTINCT p.id) as product_count
      FROM product_conditions pc
      INNER JOIN products p ON pc.product_id = p.id AND p.stock > 0
      GROUP BY pc.\`condition\`
      ORDER BY product_count DESC
    `;

    db.query(query, (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          error: 'Database error'
        });
      }

      res.json({
        success: true,
        conditions: results
      });
    });
  });

  /**
   * GET /api/products/:id
   * Get single product details by ID
   */
  app.get('/api/products/:id', (req, res) => {
    const productId = parseInt(req.params.id);

    const query = `
      SELECT 
        id,
        name,
        description,
        price,
        img,
        category,
        stock
      FROM products
      WHERE id = ?
    `;

    db.query(query, [productId], (err, results) => {
      if (err) {
        return res.status(500).json({
          success: false,
          error: 'Database error'
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Product not found'
        });
      }

      const product = results[0];
      res.json({
        success: true,
        product: {
          id: product.id,
          name: product.name,
          description: product.description,
          price: parseFloat(product.price).toFixed(2),
          image: product.img,
          category: product.category,
          stock: product.stock,
          link: `/product.html?id=${product.id}`
        }
      });
    });
  });
};
