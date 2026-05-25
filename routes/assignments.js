const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const getOne = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    err ? reject(err) : resolve(this);
  });
});

router.post('/', authenticateToken, authorizeRoles('admin', 'fleet_manager'), async (req, res) => {
  const { vehicle_id, driver_id } = req.body;

  if (!Number.isInteger(vehicle_id) || !Number.isInteger(driver_id)) {
    return res.status(400).json({ error: 'Vehicle ID and driver ID must be integers' });
  }

  try {
    const vehicle = await getOne('SELECT * FROM vehicles WHERE id = ?', [vehicle_id]);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    if (vehicle.status === 'Maintenance') {
      return res.status(400).json({ error: 'Maintenance vehicles cannot be assigned' });
    }

    const driver = await getOne('SELECT id, role FROM users WHERE id = ?', [driver_id]);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    if (driver.role !== 'driver') {
      return res.status(400).json({ error: 'Selected user must have the driver role' });
    }

    const activeVehicleAssignment = await getOne(
      "SELECT id FROM assignments WHERE vehicle_id = ? AND status = 'Active'",
      [vehicle_id]
    );
    if (activeVehicleAssignment) {
      return res.status(409).json({ error: 'Vehicle is already assigned to an active driver' });
    }

    const activeDriverAssignment = await getOne(
      "SELECT id FROM assignments WHERE driver_id = ? AND status = 'Active'",
      [driver_id]
    );
    if (activeDriverAssignment) {
      return res.status(409).json({ error: 'Driver already has an active vehicle assignment' });
    }

    const result = await run('INSERT INTO assignments (vehicle_id, driver_id) VALUES (?,?)', [vehicle_id, driver_id]);
    await run("UPDATE vehicles SET status = 'Active', last_updated = CURRENT_TIMESTAMP WHERE id = ?", [vehicle_id]);

    res.status(201).json({ id: result.lastID, message: 'Driver assigned successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

router.patch('/:id/complete', authenticateToken, authorizeRoles('admin', 'fleet_manager'), async (req, res) => {
  try {
    const assignment = await getOne("SELECT * FROM assignments WHERE id = ? AND status = 'Active'", [req.params.id]);
    if (!assignment) return res.status(404).json({ error: 'Active assignment not found' });

    await run("UPDATE assignments SET status = 'Completed' WHERE id = ?", [req.params.id]);
    await run("UPDATE vehicles SET status = 'Idle', last_updated = CURRENT_TIMESTAMP WHERE id = ?", [assignment.vehicle_id]);

    res.json({ message: 'Assignment completed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authenticateToken, (req, res) => {
  db.get(`SELECT a.*, v.plate_number, v.model, u.name as driver_name, u.role 
          FROM assignments a 
          JOIN vehicles v ON a.vehicle_id = v.id 
          JOIN users u ON a.driver_id = u.id 
          WHERE a.id = ?`, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Assignment not found' });
    res.json(row);
  });
});

router.put('/:id', authenticateToken, authorizeRoles('admin', 'fleet_manager'), async (req, res) => {
  const { vehicle_id, driver_id, status } = req.body;
  const updates = [];
  const params = [];

  if (vehicle_id !== undefined) {
    if (!Number.isInteger(vehicle_id)) return res.status(400).json({ error: 'Vehicle ID must be an integer' });
    updates.push('vehicle_id = ?');
    params.push(vehicle_id);
  }
  if (driver_id !== undefined) {
    if (!Number.isInteger(driver_id)) return res.status(400).json({ error: 'Driver ID must be an integer' });
    updates.push('driver_id = ?');
    params.push(driver_id);
  }
  if (status) {
    if (!['Active', 'Completed', 'Cancelled'].includes(status)) return res.status(400).json({ error: 'Status must be Active, Completed, or Cancelled' });
    updates.push('status = ?');
    params.push(status);
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  params.push(req.params.id);

  try {
    const result = await run(`UPDATE assignments SET ${updates.join(', ')} WHERE id = ?`, params);
    if (result.changes === 0) return res.status(404).json({ error: 'Assignment not found' });
    res.json({ message: 'Assignment updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticateToken, authorizeRoles('admin', 'fleet_manager'), async (req, res) => {
  try {
    const result = await run('DELETE FROM assignments WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Assignment not found' });
    res.json({ message: 'Assignment deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
