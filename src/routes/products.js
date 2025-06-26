const express = require('express');
const router = express.Router();
const database = require('../services/database');

// Get all products
router.get('/', async (req, res) => {
  try {
    const products = await database.findAll('products');
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Failed to fetch products', error: error.message });
  }
});

// Get specific product
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

// Create new product
router.post('/', async (req, res) => {
  try {
    const productData = req.body;
    
    // Validate required fields
    const requiredFields = ['product_name', 'product_code', 'category'];
    const missingFields = requiredFields.filter(field => !productData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: 'Missing required fields', 
        missingFields 
      });
    }

    // Set defaults
    const newProduct = {
      product_id: Date.now().toString(), // Simple ID generation for demo
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...productData
    };

    const createdProduct = await database.create('products', newProduct);
    res.status(201).json(createdProduct);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: 'Failed to create product', error: error.message });
  }
});

// Update product
router.put('/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const updates = {
      ...req.body,
      updated_at: new Date().toISOString()
    };

    // Check if product exists
    const existingProduct = await database.findById('products', productId, 'product_id');
    if (!existingProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const updatedProduct = await database.update('products', productId, updates, 'product_id');
    res.json(updatedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Failed to update product', error: error.message });
  }
});

// Delete product
router.delete('/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    
    // Check if product exists
    const existingProduct = await database.findById('products', productId, 'product_id');
    if (!existingProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await database.delete('products', productId, 'product_id');
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Failed to delete product', error: error.message });
  }
});

module.exports = router;