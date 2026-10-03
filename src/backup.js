'use strict';

const { dropPolicyTriggers } = require('./policies');

const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');
const { PHOTOS_DIR, LIBRARY_DIR, BACKUP_DIR } = require('./paths');

const MAX_BACKUPS = 30; // conserva los últimos 30 respaldos automáticos

// Tablas con datos clínicos que se restauran. `sessions` y `backup_log` no se
// tocan: así el administrador conserva su sesión y el historial de respaldos
// sigue reflejando los archivos que existen en disco.
const RESTORABLE_TABLES = ['users', 'patients', 'photos', 'library_items', 'patient_notes'];

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(
    d.getMinutes()
  )}${pad(d.getSeconds())}`;
}

/**
 * VACUUM INTO produce una instantánea consistente de la base de datos aunque
 * haya escrituras en curso (a diferencia de copiar el archivo a mano).
 */
function createBackup(type = 'auto') {
  let file = `islavisual-${timestamp()}-${type}.db`;
  let dest = path.join(BACKUP_DIR, file);
  // Dos respaldos en el mismo segundo (p. ej. pre-restore + manual) no deben pisarse.
  let n = 1;
  while (fs.existsSync(dest)) {
    file = `islavisual-${timestamp()}-${type}-${n++}.db`;
    dest = path.join(BACKUP_DIR, file);
  }
  db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  const size = fs.statSync(dest).size;

  db.prepare('INSERT INTO backup_log (filename, size_bytes, type) VALUES (?, ?, ?)').run(file, size, type);

  if (type === 'auto') pruneOldBackups();

  return { file, size, type };
}

function pruneOldBackups() {
  const autos = listBackups().filter((b) => b.type === 'auto');
  if (autos.length <= MAX_BACKUPS) return;
  for (const b of autos.slice(MAX_BACKUPS)) {
    try {
      fs.unlinkSync(path.join(BACKUP_DIR, b.filename));
    } catch (_) {
      /* ya no existe, ignorar */
    }
    db.prepare('DELETE FROM backup_log WHERE filename = ?').run(b.filename);
  }
}

function listBackups() {
  const rows = db.prepare('SELECT * FROM backup_log ORDER BY created_at DESC, id DESC').all();
  return rows.filter((r) => fs.existsSync(path.join(BACKUP_DIR, r.filename)));
}

/**
 * Restauración segura con la base de datos abierta: se adjunta la copia como
 * una base de datos secundaria y se reemplaza el contenido tabla por tabla
 * dentro de una transacción (todo o nada). Solo se copian las columnas que
 * existen en ambas versiones, y al final se re-ejecutan las migraciones, de
 * modo que restaurar una copia de una versión anterior deja la app funcional.
 */
function restoreBackup(filename, { keepToken = null, keepUser = null } = {}) {
  const safeName = path.basename(filename);
  const src = path.join(BACKUP_DIR, safeName);
  if (!fs.existsSync(src)) throw new Error('La copia de seguridad especificada no existe.');

  // Respaldo del estado actual antes de restaurar, por si fuese necesario revertir.
  createBackup('pre-restore');

  // Los disparadores de política se retiran mientras se reemplazan las tablas completas
  // (runMigrations los vuelve a crear al terminar).
  dropPolicyTriggers(db);
  db.exec(`ATTACH DATABASE '${src.replace(/'/g, "''")}' AS bk`);
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    const backupTables = new Set(
      db.prepare("SELECT name FROM bk.sqlite_master WHERE type = 'table'").all().map((r) => r.name)
    );
    db.exec('BEGIN');
    try {
      for (const table of RESTORABLE_TABLES) {
        db.exec(`DELETE FROM main.${table}`);
        if (!backupTables.has(table)) continue; // la tabla no existía en esa versión
        const mainCols = db.columnsOf(table, 'main');
        const bkCols = new Set(db.columnsOf(table, 'bk'));
        const common = mainCols.filter((c) => bkCols.has(c)).map((c) => `"${c}"`).join(', ');
        db.exec(`INSERT INTO main.${table} (${common}) SELECT ${common} FROM bk.${table}`);
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('DETACH DATABASE bk');
  }

  db.runMigrations();

  // Las sesiones se identifican por id de usuario. Tras restaurar, un mismo id podría
  // corresponder a otra persona (p. ej. si la copia proviene de otra instalación), así que
  // se cierran todas las sesiones salvo la del administrador que restaura, y esta solo
  // se conserva si su cuenta sigue siendo la misma (mismo id y mismo correo).
  db.prepare('DELETE FROM sessions WHERE token <> ?').run(keepToken || '');
  if (keepToken && keepUser) {
    const same = db.prepare('SELECT id FROM users WHERE id = ? AND email = ?').get(keepUser.id, keepUser.email);
    if (!same) db.prepare('DELETE FROM sessions WHERE token = ?').run(keepToken);
  }
  return true;
}

function folderSize(dir) {
  let total = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) total += folderSize(p);
    else total += fs.statSync(p).size;
  }
  return total;
}

function getUploadsFolderSize() {
  return folderSize(PHOTOS_DIR) + folderSize(LIBRARY_DIR);
}

function startScheduledBackups(intervalHours = 6) {
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
};
