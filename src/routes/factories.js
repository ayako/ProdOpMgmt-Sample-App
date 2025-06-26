const express = require('express');
const router = express.Router();
const Factory = require('../models/Factory');

// Get all factories
router.get('/', async (req, res) => {
  try {
    const { status, speciality } = req.query;
    let factories;

    if (status) {
      factories = await Factory.findAll({ status });
    } else if (speciality) {
      factories = await Factory.findBySpeciality(speciality);
    } else {
      factories = await Factory.findAll();
    }

    res.json(factories);
  } catch (error) {
    console.error('Error fetching factories:', error);
    res.status(500).json({ message: 'Failed to fetch factories', error: error.message });
  }
});

// Get specific factory
router.get('/:id', async (req, res) => {
  try {
    const factory = await Factory.findById(req.params.id);
    if (!factory) {
      return res.status(404).json({ message: 'Factory not found' });
    }
    res.json(factory);
  } catch (error) {
    console.error('Error fetching factory:', error);
    res.status(500).json({ message: 'Failed to fetch factory', error: error.message });
  }
});

// Create new factory
router.post('/', async (req, res) => {
  try {
    const factoryData = req.body;
    
    // Validate required fields
    const requiredFields = ['factory_name', 'contact_email'];
    const missingFields = requiredFields.filter(field => !factoryData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: 'Missing required fields', 
        missingFields 
      });
    }

    const newFactory = await Factory.create(factoryData);
    res.status(201).json(newFactory);
  } catch (error) {
    console.error('Error creating factory:', error);
    res.status(500).json({ message: 'Failed to create factory', error: error.message });
  }
});

// Update factory
router.put('/:id', async (req, res) => {
  try {
    const factoryId = req.params.id;
    const updates = req.body;

    // Check if factory exists
    const existingFactory = await Factory.findById(factoryId);
    if (!existingFactory) {
      return res.status(404).json({ message: 'Factory not found' });
    }

    const updatedFactory = await Factory.update(factoryId, updates);
    res.json(updatedFactory);
  } catch (error) {
    console.error('Error updating factory:', error);
    res.status(500).json({ message: 'Failed to update factory', error: error.message });
  }
});

// Delete factory
router.delete('/:id', async (req, res) => {
  try {
    const factoryId = req.params.id;
    
    // Check if factory exists
    const existingFactory = await Factory.findById(factoryId);
    if (!existingFactory) {
      return res.status(404).json({ message: 'Factory not found' });
    }

    await Factory.delete(factoryId);
    res.json({ message: 'Factory deleted successfully' });
  } catch (error) {
    console.error('Error deleting factory:', error);
    res.status(500).json({ message: 'Failed to delete factory', error: error.message });
  }
});

module.exports = router;