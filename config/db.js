const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '../database.db'));

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','fleet_manager','driver'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY,
    plate_number TEXT UNIQUE NOT NULL,
    model TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'Active' CHECK(status IN ('Active','Idle','Maintenance')),
    fuel_level REAL DEFAULT 100,
    latitude REAL DEFAULT 17.0,
    longitude REAL DEFAULT 81.0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY,
    vehicle_id INTEGER NOT NULL,
    driver_id INTEGER NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'Active' CHECK(status IN ('Active','Completed','Cancelled')),
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
    FOREIGN KEY (driver_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY,
    vehicle_id INTEGER NOT NULL,
    driver_id INTEGER NOT NULL,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    start_lat REAL,
    start_lng REAL,
    end_lat REAL,
    end_lng REAL,
    distance REAL,
    fuel_used REAL,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
    FOREIGN KEY (driver_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS maintenance (
    id INTEGER PRIMARY KEY,
    vehicle_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    scheduled_date TEXT NOT NULL,
    completed_date TEXT,
    status TEXT DEFAULT 'Scheduled' CHECK(status IN ('Scheduled','Completed','Cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
  )`);

  [
    'ALTER TABLE trips ADD COLUMN start_lat REAL',
    'ALTER TABLE trips ADD COLUMN start_lng REAL',
    'ALTER TABLE trips ADD COLUMN end_lat REAL',
    'ALTER TABLE trips ADD COLUMN end_lng REAL',
    'ALTER TABLE maintenance ADD COLUMN completed_date TEXT',
    "ALTER TABLE maintenance ADD COLUMN status TEXT DEFAULT 'Scheduled'",
    'ALTER TABLE maintenance ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP'
  ].forEach((statement) => {
    db.run(statement, (err) => {
      if (err && !err.message.includes('duplicate column name') && !err.message.includes('no such table')) {
        console.error(`Migration skipped: ${err.message}`);
      }
    });
  });
});

module.exports = db;
