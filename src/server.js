'use strict';

const express = require('express');
const path = require('node:path');
const fs = require('node:fs');

const { attachUser, requireAuth, cleanExpiredSessions } = require('./auth-middleware');
const backup = require('./backup');

const authRoutes = require('./routes/auth');
const { router: doctorsRoutes } = require('./routes/doctors');
const patientsRoutes = require('./routes/patients');
const photosRoutes = require('./routes/photos');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Confía en el proxy de Railway para IP/proto correctos
app.set('trust proxy', 1);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(attachUser);

// --- API ---
app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorsRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/photos', photosRoutes);
app.use('/api/admin', adminRoutes);

// Acceso a imágenes: SOLO usuarios autenticados (info médica sensible, no debe ser pública)
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads', 'photos');
app.get('/media/photos/:filename', requireAuth, (req, res) => {
  const safeName = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, safeName);
  if (!fs.existsSync(filePath)) return res.status(404).send('No encontrada');
  res.sendFile(filePath);
});

// --- Frontend estático ---
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR, { maxAge: '1h' }));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Ruta no encontrada.' });
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// --- Manejador de errores (incluye errores de multer, tamaño de archivo, etc.) ---
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err.message);
  if (res.headersSent) return next(err);
  const status = err.status || 400;
  res.status(status).json({ error: err.message || 'Error inesperado en el servidor.' });
});

// --- Tareas de mantenimiento periódico ---
setInterval(cleanExpiredSessions, 60 * 60 * 1000); // limpia sesiones vencidas cada hora
backup.startScheduledBackups(6); // respaldo automático cada 6 horas

const server = app.listen(PORT, () => {
  console.log(`✓ IslaVisual corriendo en el puerto ${PORT}`);
});

// Evita que la app se caiga por errores no capturados (alta disponibilidad para 500+ usuarios)
process.on('unhandledRejection', (reason) => {
  console.error('Promesa rechazada sin manejar:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Excepción no capturada:', err);
});

// Cierre ordenado
process.on('SIGTERM', () => {
  console.log('SIGTERM recibido, cerrando servidor...');
  server.close(() => process.exit(0));
});

module.exports = app;
