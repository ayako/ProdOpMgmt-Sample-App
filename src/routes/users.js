const express = require('express');
const router = express.Router();
const database = require('../services/database');

// Simple user routes (basic CRUD for MVP)
router.get('/', async (req, res) => {
  try {
    const users = await database.findAll('users');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = await database.findById('users', req.params.id, 'user_id');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Failed to fetch user', error: error.message });
  }
});

module.exports = router;