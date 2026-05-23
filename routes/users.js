const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Get all users (admin only)
router.get('/', authenticateToken, authorizeRoles('admin'), (req, res) => {
  db.all('SELECT id, name, email, role FROM users ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get all drivers (for assignments)
router.get('/drivers', authenticateToken, (req, res) => {
  db.all('SELECT id, name, email, role FROM users WHERE role = ?', ['driver'], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get user by ID
router.get('/:id', authenticateToken, (req, res) => {
  db.get('SELECT id, name, email, role FROM users WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'User not found' });
    res.json(row);
  });
});

// Create user (admin only) - also used by frontend Admin page
router.post('/', authenticateToken, authorizeRoles('admin'), (req, res) => {
  const { name, email, password, role } = req.body;
  const allowedRoles = ['admin', 'fleet_manager', 'driver'];

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Role must be admin, fleet_manager, or driver' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run('INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)',
    [name.trim(), email.trim().toLowerCase(), hashedPassword, role], function(err) {
      if (err) return res.status(400).json({ error: err.message });
      res.status(201).json({ id: this.lastID, message: 'User created successfully' });
    });
});

// Update user (admin only)
router.put('/:id', authenticateToken, authorizeRoles('admin'), (req, res) => {
  const { name, email, role } = req.body;

  if (!name && !email && !role) {
    return res.status(400).json({ error: 'At least one field is required' });
  }

  const allowedRoles = ['admin', 'fleet_manager', 'driver'];
  if (role && !allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const updates = [];
  const params = [];

  if (name) {
    updates.push('name = ?');
    params.push(name.trim());
  }
  if (email) {
    updates.push('email = ?');
    params.push(email.trim().toLowerCase());
  }
  if (role) {
    updates.push('role = ?');
    params.push(role);
  }

  params.push(req.params.id);

  db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
    if (err) return res.status(400).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User updated successfully' });
  });
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, authorizeRoles('admin'), (req, res) => {
  db.run('DELETE FROM users WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(400).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  });
});

module.exports = router;
