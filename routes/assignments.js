const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

router.post('/', authenticateToken, (req, res) => {
  const { vehicle_id, driver_id } = req.body;
  db.run('INSERT INTO assignments (vehicle_id, driver_id) VALUES (?,?)',
    [vehicle_id, driver_id], function(err) {
      if (err) return res.status(400).json({ error: err.message });
      res.status(201).json({ id: this.lastID, message: 'Driver assigned successfully' });
    });
});

router.get('/', authenticateToken, (req, res) => {
  db.all(`SELECT a.*, v.plate_number, v.model, u.name as driver_name, u.role 
          FROM assignments a 
          JOIN vehicles v ON a.vehicle_id = v.id 
          JOIN users u ON a.driver_id = u.id 
          WHERE a.status = 'Active'`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;