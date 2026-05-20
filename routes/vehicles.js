const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.post('/', authenticateToken, authorizeRoles('admin', 'fleet_manager'), (req, res) => {
  const { plate_number, model, type } = req.body;
  db.run('INSERT INTO vehicles (plate_number, model, type) VALUES (?,?,?)',
    [plate_number, model, type], function(err) {
      if (err) return res.status(400).json({ error: err.message });
      res.status(201).json({ id: this.lastID, message: 'Vehicle added successfully' });
    });
});

router.get('/', authenticateToken, (req, res) => {
  db.all('SELECT * FROM vehicles ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.put('/:id/location', authenticateToken, (req, res) => {
  const { latitude, longitude } = req.body;
  db.run('UPDATE vehicles SET latitude=?, longitude=?, last_updated=CURRENT_TIMESTAMP WHERE id=?',
    [latitude, longitude, req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Location updated successfully' });
    });
});

module.exports = router;