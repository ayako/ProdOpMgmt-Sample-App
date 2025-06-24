const express = require('express');
const router = express.Router();
const database = require('../services/database');

// Simple product routes (basic CRUD for MVP)
router.get('/', async (req, res) => {
  try {
    const products = await database.findAll('products');
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Failed to fetch products', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await database.findById('products', req.params.id, 'product_id');
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: 'Failed to fetch product', error: error.message });
  }
});

module.exports = router;