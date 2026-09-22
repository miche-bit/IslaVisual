'use strict';

const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');

const DB_PATH = db.DB_PATH;
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');

const MAX_BACKUPS = 30; // conserva los últimos 30 respaldos automáticos

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(
    d.getMinutes()
  )}${pad(d.getSeconds())}`;
}

/**
 * Hace un checkpoint del WAL para asegurar que todo lo escrito esté
 * volcado al archivo principal .db antes de copiarlo.
 */
function checkpoint() {
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch (e) {
    console.error('Error en checkpoint WAL:', e.message);
  }
}

function createBackup(type = 'auto') {
  checkpoint();
  const file = `islavisual-${timestamp()}-${type}.db`;
  const dest = path.join(BACKUP_DIR, file);
  fs.copyFileSync(DB_PATH, dest);
  const size = fs.statSync(dest).size;

  db.prepare('INSERT INTO backup_log (filename, size_bytes, type) VALUES (?, ?, ?)').run(file, size, type);

  if (type === 'auto') pruneOldBackups();

  return { file, size, type };
}

function pruneOldBackups() {
  const autos = listBackups().filter((b) => b.type === 'auto');
  if (autos.length <= MAX_BACKUPS) return;
  const toDelete = autos.slice(MAX_BACKUPS);
  for (const b of toDelete) {
    try {
      fs.unlinkSync(path.join(BACKUP_DIR, b.filename));
    } catch (_) {
      /* ya no existe, ignorar */
    }
    db.prepare('DELETE FROM backup_log WHERE filename = ?').run(b.filename);
  }
}

function listBackups() {
  const rows = db.prepare('SELECT * FROM backup_log ORDER BY created_at DESC').all();
  // filtra los que ya no existen físicamente
  return rows.filter((r) => fs.existsSync(path.join(BACKUP_DIR, r.filename)));
}

function restoreBackup(filename) {
  const src = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(src)) throw new Error('La copia de seguridad especificada no existe.');

  // Respaldo de seguridad del estado actual antes de restaurar, por si acaso
  createBackup('pre-restore');

  checkpoint();
  fs.copyFileSync(src, DB_PATH);

  // Limpia los archivos WAL/SHM viejos para forzar a SQLite a releer el .db restaurado
  const walPath = DB_PATH + '-wal';
  const shmPath = DB_PATH + '-shm';
  try {
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  } catch (_) {}

  return true;
}

function getUploadsFolderSize() {
  let total = 0;
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else total += fs.statSync(p).size;
    }
  }
  walk(UPLOADS_DIR);
  return total;
}

function startScheduledBackups(intervalHours = 6) {
  // Respaldo inicial al arrancar, y luego cada N horas
  setTimeout(() => {
    try {
      createBackup('auto');
      console.log('[backup] Respaldo automático inicial creado.');
    } catch (e) {
      console.error('[backup] Error creando respaldo inicial:', e.message);
    }
  }, 15000);

  setInterval(() => {
    try {
      createBackup('auto');
      console.log('[backup] Respaldo automático programado creado.');
    } catch (e) {
      console.error('[backup] Error en respaldo programado:', e.message);
    }
  }, intervalHours * 60 * 60 * 1000);
}

module.exports = {
  createBackup,
  listBackups,
  restoreBackup,
  startScheduledBackups,
  getUploadsFolderSize,
  BACKUP_DIR,
  DB_PATH,
};
