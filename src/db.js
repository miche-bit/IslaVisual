'use strict';

/**
 * Capa de base de datos.
 * Usa node:sqlite (nativo, cero dependencias externas para persistencia).
 * WAL mode habilitado para soportar muchas lecturas concurrentes
 * (500+ usuarios entrando a la vez) sin bloquear al que escribe.
 *
 * Las migraciones son idempotentes: se ejecutan en cada arranque y solo
 * agregan lo que falta, de modo que una base de datos de una versión
 * anterior se actualiza sola sin perder información.
 */

const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { matchFreeText } = require('./specialties');
const { createPolicyTriggers } = require('./policies');

const DATA_DIR = require('./config').dataDir;
const DB_PATH = path.join(DATA_DIR, 'islavisual.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);

// --- Pragmas para rendimiento y concurrencia ---
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

// --- Esquema base (versión original) ---
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
  folder_title TEXT, -- denominación personalizada opcional de la carpeta
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
  type TEXT NOT NULL DEFAULT 'auto',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS library_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  categoria TEXT NOT NULL CHECK (categoria IN ('imagen','video','documento')),
  filename TEXT NOT NULL,
  original_name TEXT,
  size_bytes INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Notas de evolución clínica de cada paciente (v3)
CREATE TABLE IF NOT EXISTS patient_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

function columnsOf(table, schema = 'main') {
  return db.prepare(`PRAGMA ${schema}.table_info(${table})`).all().map((c) => c.name);
}

function addColumnIfMissing(table, column, definition) {
  if (!columnsOf(table).includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/**
 * Migraciones idempotentes. Se exportan para poder re-ejecutarlas después
 * de restaurar una copia de seguridad de una versión anterior.
 */
function runMigrations() {
  // v3 — especialidades del hospital
  addColumnIfMissing('users', 'especialidad_slug', 'TEXT');
  addColumnIfMissing('users', 'subespecialidad', "TEXT DEFAULT ''");
  addColumnIfMissing('library_items', 'especialidad_slug', 'TEXT');

  // Usuarios anteriores a v3: se reconoce su especialidad de texto libre; si no
  // coincide con el catálogo (p. ej. "Retina"), se conservan como subespecialidad
  // dentro de Oftalmología, que era la única especialidad de la plataforma.
  const pending = db.prepare('SELECT id, especialidad FROM users WHERE especialidad_slug IS NULL').all();
  const setUser = db.prepare('UPDATE users SET especialidad_slug = ?, subespecialidad = ? WHERE id = ?');
  for (const u of pending) {
    const matched = matchFreeText(u.especialidad);
    setUser.run(matched || 'oftalmologia', matched ? '' : String(u.especialidad || '').trim(), u.id);
  }

  // Material de biblioteca anterior a v3: pertenecía al servicio de Oftalmología.
  db.prepare("UPDATE library_items SET especialidad_slug = 'oftalmologia' WHERE especialidad_slug IS NULL").run();

  // v4 — roles y aprobación de materiales.
  // is_admin = administrador maestro; specialty_admin = administrador de SU especialidad.
  addColumnIfMissing('users', 'specialty_admin', 'INTEGER NOT NULL DEFAULT 0');
  // Todo el material anterior a v4 ya estaba publicado: queda aprobado.
  addColumnIfMissing('library_items', 'estado', "TEXT NOT NULL DEFAULT 'aprobado'");
  addColumnIfMissing('library_items', 'revisado_por', 'INTEGER');
  addColumnIfMissing('library_items', 'revisado_at', 'TEXT');
  addColumnIfMissing('library_items', 'motivo_rechazo', 'TEXT');
  // Un administrador maestro no necesita además el rol de especialidad.
  db.prepare('UPDATE users SET specialty_admin = 0 WHERE is_admin = 1 AND specialty_admin = 1').run();

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_patients_doctor ON patients(doctor_id);
    CREATE INDEX IF NOT EXISTS idx_photos_patient ON photos(patient_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_library_created ON library_items(created_at);
    CREATE INDEX IF NOT EXISTS idx_users_specialty ON users(especialidad_slug);
    CREATE INDEX IF NOT EXISTS idx_library_specialty ON library_items(especialidad_slug);
    CREATE INDEX IF NOT EXISTS idx_notes_patient ON patient_notes(patient_id);
    CREATE INDEX IF NOT EXISTS idx_library_estado ON library_items(estado, especialidad_slug);
  `);

  // v6 — políticas de integridad por fila (equivalente a RLS; ver src/policies.js)
  createPolicyTriggers(db);
}

runMigrations();

module.exports = db;
module.exports.DATA_DIR = DATA_DIR;
module.exports.DB_PATH = DB_PATH;
module.exports.runMigrations = runMigrations;
module.exports.columnsOf = columnsOf;
