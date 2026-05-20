const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const statuses = ['Active', 'Idle', 'Maintenance'];

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

router.post('/', authenticateToken, authorizeRoles('admin', 'fleet_manager'), (req, res) => {
  const { plate_number, model, type, status = 'Active', fuel_level = 100 } = req.body;

  if (!plate_number || !model || !type) {
    return res.status(400).json({ error: 'Plate number, model, and type are required' });
  }
  if (!statuses.includes(status)) {
    return res.status(400).json({ error: 'Status must be Active, Idle, or Maintenance' });
  }
  if (!isFiniteNumber(fuel_level) || fuel_level < 0 || fuel_level > 100) {
    return res.status(400).json({ error: 'Fuel level must be a number between 0 and 100' });
  }

  db.run('INSERT INTO vehicles (plate_number, model, type, status, fuel_level) VALUES (?,?,?,?,?)',
    [plate_number.trim().toUpperCase(), model.trim(), type.trim(), status, fuel_level], function(err) {
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

router.put('/:id', authenticateToken, authorizeRoles('admin', 'fleet_manager'), (req, res) => {
  const { model, type, status, fuel_level } = req.body;

  if (!model && !type && status === undefined && fuel_level === undefined) {
    return res.status(400).json({ error: 'At least one vehicle field is required' });
  }
  if (status !== undefined && !statuses.includes(status)) {
    return res.status(400).json({ error: 'Status must be Active, Idle, or Maintenance' });
  }
  if (fuel_level !== undefined && (!isFiniteNumber(fuel_level) || fuel_level < 0 || fuel_level > 100)) {
    return res.status(400).json({ error: 'Fuel level must be a number between 0 and 100' });
  }

  const fields = [];
  const values = [];
  if (model) {
    fields.push('model=?');
    values.push(model.trim());
  }
  if (type) {
    fields.push('type=?');
    values.push(type.trim());
  }
  if (status !== undefined) {
    fields.push('status=?');
    values.push(status);
  }
  if (fuel_level !== undefined) {
    fields.push('fuel_level=?');
    values.push(fuel_level);
  }
  values.push(req.params.id);

  db.run(`UPDATE vehicles SET ${fields.join(', ')}, last_updated=CURRENT_TIMESTAMP WHERE id=?`,
    values, function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Vehicle not found' });
      if (status === 'Maintenance') {
        return db.run("UPDATE assignments SET status = 'Cancelled' WHERE vehicle_id = ? AND status = 'Active'",
          [req.params.id], (assignmentErr) => {
            if (assignmentErr) return res.status(500).json({ error: assignmentErr.message });
            res.json({ message: 'Vehicle updated successfully' });
          });
      }
      res.json({ message: 'Vehicle updated successfully' });
    });
});

router.put('/:id/location', authenticateToken, (req, res) => {
  const { latitude, longitude } = req.body;
  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) {
    return res.status(400).json({ error: 'Latitude and longitude must be valid numbers' });
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ error: 'Latitude or longitude is out of range' });
  }

  db.run('UPDATE vehicles SET latitude=?, longitude=?, last_updated=CURRENT_TIMESTAMP WHERE id=?',
    [latitude, longitude, req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Vehicle not found' });
      res.json({ message: 'Location updated successfully' });
    });
});

module.exports = router;
