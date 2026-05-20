const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.post('/', authenticateToken, authorizeRoles('admin', 'fleet_manager'), (req, res) => {
  const { vehicle_id, description, scheduled_date } = req.body;
  
  db.run('INSERT INTO maintenance (vehicle_id, description, scheduled_date) VALUES (?,?,?)',
    [vehicle_id, description, scheduled_date], function(err) {
      if (err) return res.status(400).json({ error: err.message });
      res.status(201).json({ id: this.lastID, message: 'Maintenance scheduled' });
    });
});

router.get('/', authenticateToken, (req, res) => {
  db.all('SELECT m.*, v.plate_number FROM maintenance m JOIN vehicles v ON m.vehicle_id = v.id', 
    [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
});

module.exports = router;