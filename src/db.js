'use strict';

/**
 * Capa de base de datos.
 * Usa node:sqlite (nativo, cero dependencias externas para persistencia).
 * WAL mode habilitado para soportar muchas lecturas concurrentes
 * (500+ usuarios entrando a la vez a ver carpetas) sin bloquear al que escribe.
 */

const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'islavisual.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);

// --- Pragmas para rendimiento y concurrencia ---
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

// --- Esquema ---
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  sexo TEXT NOT NULL CHECK (sexo IN ('M','F')),
  telefono TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  especialidad TEXT DEFAULT 'Oftalmología',
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  sort_pref TEXT NOT NULL DEFAULT 'alpha', -- 'alpha' | 'fecha' (predeterminado de su carpeta, lo determina el médico titular)
  folder_title TEXT, -- override opcional del titulo de la carpeta (Dr./Dra. Nombre)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  edad INTEGER NOT NULL,
  sexo TEXT NOT NULL CHECK (sexo IN ('M','F')),
  diagnostico TEXT,
  historia_clinica TEXT,
  carnet_identidad TEXT,
  cas TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT,
  descripcion TEXT NOT NULL,
  fecha_foto TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS backup_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  size_bytes INTEGER,
  type TEXT NOT NULL DEFAULT 'auto', -- 'auto' | 'manual'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_patients_doctor ON patients(doctor_id);
CREATE INDEX IF NOT EXISTS idx_photos_patient ON photos(patient_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
`);

module.exports = db;
module.exports.DATA_DIR = DATA_DIR;
module.exports.DB_PATH = DB_PATH;
