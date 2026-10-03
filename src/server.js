'use strict';

const express = require('express');
const path = require('node:path');
const fs = require('node:fs');

const config = require('./config');
const db = require('./db');
const security = require('./security');
const { attachUser, requireAuth, cleanExpiredSessions } = require('./auth-middleware');
const backup = require('./backup');
const { PHOTOS_DIR, LIBRARY_DIR } = require('./paths');
const { SPECIALTIES, GENERAL } = require('./specialties');

const authRoutes = require('./routes/auth');
const { router: doctorsRoutes } = require('./routes/doctors');
const patientsRoutes = require('./routes/patients');
const photosRoutes = require('./routes/photos');
const adminRoutes = require('./routes/admin');
const { router: libraryRoutes } = require('./routes/library');
const hospitalRoutes = require('./routes/hospital');

const app = express();
const PORT = config.port;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Identificador de versión: cambia en cada deploy de Railway, de modo que el
// navegador descarga el CSS/JS nuevo en vez de seguir usando la copia en caché.
const BUILD_ID = config.buildId;

// Confía solo en el proxy de Railway (un salto) para obtener la IP real del cliente:
// sin esto, el límite de peticiones contaría a todos los usuarios como una sola IP.
app.set('trust proxy', config.trustProxy);
app.disable('x-powered-by');

// Cabeceras de seguridad (CSP, HSTS, anti-clickjacking…)
app.use(security.securityHeaders);

// --- index.html con referencias versionadas (nunca se guarda en caché) ---
const indexTemplate = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
const indexHtml = indexTemplate
  .replace('/css/styles.css', `/css/styles.css?v=${BUILD_ID}`)
  .replace('/js/app.js', `/js/app.js?v=${BUILD_ID}`);

function sendIndex(req, res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.type('html').send(indexHtml);
}

app.get(['/', '/index.html'], sendIndex);

// --- Archivos estáticos (antes de la sesión: no necesitan consultar la BD) ---
app.use(express.static(PUBLIC_DIR, { index: false, maxAge: '30d' }));

// --- Perímetro de la API: CORS/CSRF, tipo de contenido y límite de peticiones ---
app.use(['/api', '/media'], security.originGuard);
app.use('/api', security.requireJsonOrMultipart, security.apiLimiter);
app.use(express.json({ limit: '256kb' })); // ningún formulario de la app se acerca a este tamaño
app.use(attachUser);
app.post('/api/auth/register', security.registerLimiter);
app.post(['/api/photos/patient/:id', '/api/library'], security.uploadLimiter);

// --- API ---
// Catálogo público (lo necesita el formulario de registro antes de iniciar sesión)
app.get('/api/catalog', (req, res) => {
  res.json({
    specialties: SPECIALTIES,
    general: GENERAL,
    build: BUILD_ID,
    // Parámetros públicos que la interfaz necesita (nunca el código de registro en sí).
    politicas: {
      registro_con_codigo: !!config.registrationCode,
      password_min: config.passwordMinLength,
      inactividad_min: config.idleMinutes,
    },
  });
});
app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorsRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/photos', photosRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api', hospitalRoutes);

// Archivos clínicos: SOLO facultativos autenticados (información sensible, nunca pública)
function serveProtected(dir) {
  return (req, res) => {
    const filePath = path.join(dir, path.basename(req.params.filename));
    if (!fs.existsSync(filePath)) return res.status(404).send('No encontrado');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    // Un archivo subido nunca se ejecuta como página: se sirve aislado (sin scripts).
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox");
    res.sendFile(filePath);
  };
}
app.get('/media/photos/:filename', requireAuth, serveProtected(PHOTOS_DIR));
app.get('/media/biblioteca/:filename', requireAuth, serveProtected(LIBRARY_DIR));

app.all('/api/*', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
app.get('*', sendIndex);

// --- Manejador de errores (incluye errores de multer, tamaño de archivo, etc.) ---
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err.message);
  if (res.headersSent) return next(err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'El archivo excede el tamaño máximo permitido.' });
  }
  // Un disparador de política (capa 3 de las reglas por fila) bloqueó la escritura.
  if (/politica:/.test(err.message || '')) {
    return res.status(403).json({ error: 'La operación contraviene las políticas de acceso de la plataforma.' });
  }
  const status = err.status || err.statusCode || 400;
  // Los errores internos (p. ej. de SQLite) no se muestran crudos al usuario.
  const message = status >= 500 || /SQLITE|constraint/i.test(err.message || '')
    ? 'Se ha producido un error inesperado al procesar la solicitud.'
    : err.message || 'Se ha producido un error inesperado al procesar la solicitud.';
  res.status(status >= 400 && status < 600 ? status : 400).json({ error: message });
});

// --- Tareas de mantenimiento periódico ---
setInterval(cleanExpiredSessions, 60 * 60 * 1000); // limpia sesiones vencidas cada hora
backup.startScheduledBackups(config.backupIntervalHours);

// Recuperación: si no queda ningún administrador maestro y MASTER_EMAIL corresponde a
// una cuenta existente, esa cuenta recupera el rol al arrancar.
if (config.masterEmail) {
  const masters = db.prepare('SELECT COUNT(*) c FROM users WHERE is_admin = 1').get().c;
  if (!masters) {
    const r = db.prepare('UPDATE users SET is_admin = 1, specialty_admin = 0 WHERE email = ?').run(config.masterEmail);
    if (r.changes) console.log('[seguridad] Administrador maestro restablecido desde MASTER_EMAIL.');
  }
}

for (const p of config.problems) console.error(`[config] ${p}`);
for (const w of config.warnings) console.warn(`[seguridad] ⚠ ${w}`);

const server = app.listen(PORT, () => {
  console.log(`✓ IslaVisual corriendo en el puerto ${PORT} (versión ${BUILD_ID}) · ${config.describe()}`);
});

// Conexiones lentas o abandonadas no deben acaparar el servidor (ataques tipo slowloris).
// La subida de un video de 150 MB por una conexión lenta puede tardar: 15 minutos de margen.
server.headersTimeout = 60 * 1000;
server.requestTimeout = 15 * 60 * 1000;
server.keepAliveTimeout = 65 * 1000;

// Evita que la app se caiga por errores no capturados (alta disponibilidad)
process.on('unhandledRejection', (reason) => {
  console.error('Promesa rechazada sin manejar:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Excepción no capturada:', err);
});

// Cierre ordenado: Railway envía SIGTERM en cada deploy
process.on('SIGTERM', () => {
  console.log('SIGTERM recibido, cerrando servidor...');
  server.close(() => {
    try { db.close(); } catch (_) {}
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 8000).unref();
});

module.exports = app;
