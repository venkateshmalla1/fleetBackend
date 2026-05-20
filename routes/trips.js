const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

router.post('/', authenticateToken, (req, res) => {
  const { vehicle_id, driver_id, start_lat, start_lng, end_lat, end_lng, distance, fuel_used } = req.body;
  
  db.run(`INSERT INTO trips (vehicle_id, driver_id, start_lat, start_lng, end_lat, end_lng, distance, fuel_used) 
          VALUES (?,?,?,?,?,?,?,?)`,
    [vehicle_id, driver_id, start_lat, start_lng, end_lat, end_lng, distance, fuel_used],
    function(err) {
      if (err) return res.status(400).json({ error: err.message });
      res.status(201).json({ id: this.lastID, message: 'Trip logged successfully' });
    });
});

router.get('/', authenticateToken, (req, res) => {
  db.all(`SELECT t.*, v.plate_number, u.name as driver_name 
          FROM trips t 
          JOIN vehicles v ON t.vehicle_id = v.id 
          JOIN users u ON t.driver_id = u.id 
          ORDER BY t.start_time DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;