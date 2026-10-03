'use strict';

/**
 * Rutas de almacenamiento centralizadas.
 *
 * En Railway, DATA_DIR / UPLOADS_DIR / BACKUP_DIR apuntan al volumen persistente.
 * La carpeta de la Biblioteca Clínica se deriva automáticamente como hermana de
 * UPLOADS_DIR (p. ej. /app/persist/uploads/biblioteca), de modo que también vive
 * en el volumen persistente sin necesidad de configurar una variable adicional.
 * (En versiones anteriores quedaba dentro del contenedor y se perdía en cada deploy.)
 */

const path = require('node:path');
const fs = require('node:fs');

const config = require('./config');

const PHOTOS_DIR = config.photosDir;
const LIBRARY_DIR = config.libraryDir || path.join(path.dirname(PHOTOS_DIR), 'biblioteca');
const BACKUP_DIR = config.backupDir;

for (const dir of [PHOTOS_DIR, LIBRARY_DIR, BACKUP_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

module.exports = { PHOTOS_DIR, LIBRARY_DIR, BACKUP_DIR };
