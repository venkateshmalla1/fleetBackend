const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

router.post('/register', (req, res) => {
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
      res.status(201).json({ message: 'User registered successfully' });
    });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()], (err, user) => {
    if (err || !user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name },
      process.env.JWT_SECRET || 'secretkey',
      { expiresIn: '8h' }
    );

    res.json({ 
      token, 
      role: user.role, 
      name: user.name,
      message: 'Login successful' 
    });
  });
});

module.exports = router;
