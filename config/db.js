const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '../database.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT CHECK(role IN ('admin','fleet_manager','driver'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY,
    plate_number TEXT UNIQUE,
    model TEXT,
    type TEXT,
    status TEXT DEFAULT 'Active',
    fuel_level REAL DEFAULT 100,
    latitude REAL DEFAULT 17.0,
    longitude REAL DEFAULT 81.0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY,
    vehicle_id INTEGER,
    driver_id INTEGER,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'Active'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY,
    vehicle_id INTEGER,
    driver_id INTEGER,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    distance REAL,
    fuel_used REAL
  )`);
});

module.exports = db;