const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const getOne = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    err ? reject(err) : resolve(this);
  });
});

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

router.post('/', authenticateToken, async (req, res) => {
  const { vehicle_id, driver_id, start_lat, start_lng, end_lat, end_lng, distance, fuel_used } = req.body;

  if (!Number.isInteger(vehicle_id) || !Number.isInteger(driver_id)) {
    return res.status(400).json({ error: 'Vehicle ID and driver ID must be integers' });
  }
  if (![start_lat, start_lng, end_lat, end_lng, distance, fuel_used].every(isFiniteNumber)) {
    return res.status(400).json({ error: 'Trip coordinates, distance, and fuel used must be valid numbers' });
  }
  if (start_lat < -90 || start_lat > 90 || end_lat < -90 || end_lat > 90 ||
      start_lng < -180 || start_lng > 180 || end_lng < -180 || end_lng > 180) {
    return res.status(400).json({ error: 'Trip coordinates are out of range' });
  }
  if (distance <= 0 || fuel_used < 0) {
    return res.status(400).json({ error: 'Distance must be positive and fuel used cannot be negative' });
  }
  if (req.user.role === 'driver' && req.user.id !== driver_id) {
    return res.status(403).json({ error: 'Drivers can only log their own trips' });
  }

  try {
    const vehicle = await getOne('SELECT * FROM vehicles WHERE id = ?', [vehicle_id]);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    if (vehicle.status === 'Maintenance') {
      return res.status(400).json({ error: 'Maintenance vehicles cannot be assigned for trips' });
    }
    if (fuel_used > vehicle.fuel_level) {
      return res.status(400).json({ error: 'Fuel used cannot exceed current vehicle fuel level' });
    }

    const driver = await getOne("SELECT id, role FROM users WHERE id = ? AND role = 'driver'", [driver_id]);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    const assignment = await getOne(
      "SELECT id FROM assignments WHERE vehicle_id = ? AND driver_id = ? AND status = 'Active'",
      [vehicle_id, driver_id]
    );
    if (!assignment) {
      return res.status(400).json({ error: 'Driver must have an active assignment for this vehicle' });
    }

    await run('BEGIN TRANSACTION');
    const result = await run(`INSERT INTO trips
      (vehicle_id, driver_id, start_lat, start_lng, end_lat, end_lng, distance, fuel_used, end_time)
      VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`,
      [vehicle_id, driver_id, start_lat, start_lng, end_lat, end_lng, distance, fuel_used]);
    await run(`UPDATE vehicles
      SET fuel_level = fuel_level - ?, latitude = ?, longitude = ?, status = 'Active', last_updated = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [fuel_used, end_lat, end_lng, vehicle_id]);
    await run('COMMIT');

    res.status(201).json({ id: result.lastID, message: 'Trip logged successfully' });
  } catch (err) {
    await run('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  }
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
