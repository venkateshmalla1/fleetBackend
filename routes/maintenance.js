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

const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

router.post('/', authenticateToken, authorizeRoles('admin', 'fleet_manager'), async (req, res) => {
  const { vehicle_id, description, scheduled_date } = req.body;

  if (!Number.isInteger(vehicle_id)) {
    return res.status(400).json({ error: 'Vehicle ID must be an integer' });
  }
  if (!description || !scheduled_date) {
    return res.status(400).json({ error: 'Description and scheduled date are required' });
  }
  if (!isValidDate(scheduled_date)) {
    return res.status(400).json({ error: 'Scheduled date must use YYYY-MM-DD format' });
  }

  try {
    const vehicle = await getOne('SELECT id FROM vehicles WHERE id = ?', [vehicle_id]);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    await run('BEGIN TRANSACTION');
    const result = await run('INSERT INTO maintenance (vehicle_id, description, scheduled_date) VALUES (?,?,?)',
      [vehicle_id, description.trim(), scheduled_date]);
    await run("UPDATE assignments SET status = 'Cancelled' WHERE vehicle_id = ? AND status = 'Active'", [vehicle_id]);
    await run("UPDATE vehicles SET status = 'Maintenance', last_updated = CURRENT_TIMESTAMP WHERE id = ?", [vehicle_id]);
    await run('COMMIT');

    res.status(201).json({ id: result.lastID, message: 'Maintenance scheduled' });
  } catch (err) {
    await run('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

router.get('/', authenticateToken, (req, res) => {
  db.all(`SELECT m.*, v.plate_number, v.model
          FROM maintenance m
          JOIN vehicles v ON m.vehicle_id = v.id
          ORDER BY m.scheduled_date DESC, m.created_at DESC`,
    [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
});

router.patch('/:id/complete', authenticateToken, authorizeRoles('admin', 'fleet_manager'), async (req, res) => {
  try {
    const record = await getOne("SELECT * FROM maintenance WHERE id = ? AND status = 'Scheduled'", [req.params.id]);
    if (!record) return res.status(404).json({ error: 'Scheduled maintenance record not found' });

    await run('BEGIN TRANSACTION');
    await run("UPDATE maintenance SET status = 'Completed', completed_date = DATE('now') WHERE id = ?", [req.params.id]);
    await run("UPDATE vehicles SET status = 'Idle', last_updated = CURRENT_TIMESTAMP WHERE id = ?", [record.vehicle_id]);
    await run('COMMIT');

    res.json({ message: 'Maintenance completed successfully' });
  } catch (err) {
    await run('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
