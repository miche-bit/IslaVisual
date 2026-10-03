'use strict';

const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../auth-middleware');
const backup = require('../backup');
const presence = require('../presence');
const { deletePhotoFilesOf } = require('./patients');
const { pageParams, pageResult, likePattern, toDoctorCard, doctorName } = require('../util');
const { SPECIALTIES, isValidSpecialty } = require('../specialties');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/stats', (req, res) => {
  res.json({
    totalUsers: db.prepare('SELECT COUNT(*) c FROM users').get().c,
    totalPatients: db.prepare('SELECT COUNT(*) c FROM patients').get().c,
    totalPhotos: db.prepare('SELECT COUNT(*) c FROM photos').get().c,
    totalLibrary: db.prepare("SELECT COUNT(*) c FROM library_items WHERE estado = 'aprobado'").get().c,
    pendingLibrary: db.prepare("SELECT COUNT(*) c FROM library_items WHERE estado = 'pendiente'").get().c,
    specialtyAdmins: db.prepare('SELECT COUNT(*) c FROM users WHERE specialty_admin = 1 AND is_admin = 0').get().c,
    onlineNow: presence.onlineIds().length,
    uploadsSizeBytes: backup.getUploadsFolderSize(),
  });
});

// Listado paginado de facultativos. Filtros: ?q=texto &especialidad=slug
router.get('/users', (req, res) => {
  const pg = pageParams(req, 15);
  const where = [];
  const params = [];
  const q = String(req.query.q || '').trim();
  if (q) {
    const like = likePattern(q);
    where.push("((u.nombre || ' ' || u.apellidos) LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\' OR u.telefono LIKE ? ESCAPE '\\')");
    params.push(like, like, like);
  }
  if (req.query.especialidad) {
    where.push('u.especialidad_slug = ?');
    params.push(String(req.query.especialidad));
  }
  if (req.query.rol === 'maestro') where.push('u.is_admin = 1');
  else if (req.query.rol === 'especialidad') where.push('u.is_admin = 0 AND u.specialty_admin = 1');
  else if (req.query.rol === 'medico') where.push('u.is_admin = 0 AND u.specialty_admin = 0');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS c FROM users u ${whereSql}`).get(...params).c;
  const rows = db
    .prepare(
      `SELECT u.*, COALESCE(pc.c, 0) AS total_pacientes FROM users u
       LEFT JOIN (SELECT doctor_id, COUNT(*) AS c FROM patients GROUP BY doctor_id) pc ON pc.doctor_id = u.id
       ${whereSql} ORDER BY u.created_at DESC, u.id DESC LIMIT ? OFFSET ?`
    )
    .all(...params, pg.limit, pg.offset)
    .map((u) => ({ ...toDoctorCard(u), total_pacientes: u.total_pacientes }));
  res.json(pageResult(rows, total, pg));
});

router.patch('/users/:id/admin', (req, res) => {
  const targetId = Number(req.params.id);
  const makeAdmin = !!(req.body || {}).is_admin;
  if (targetId === req.user.id && !makeAdmin) {
    return res.status(400).json({ error: 'No resulta posible revocar sus propias prerrogativas administrativas.' });
  }
  if (!makeAdmin) {
    const admins = db.prepare('SELECT COUNT(*) c FROM users WHERE is_admin = 1').get().c;
    const target = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(targetId);
    if (target?.is_admin && admins <= 1) {
      return res.status(400).json({ error: 'La plataforma debe conservar al menos un administrador maestro.' });
    }
  }
  // Un maestro ya tiene todas las prerrogativas: al conferirlo se libera su rol de especialidad
  // (la especialidad queda sin administrador hasta que se designe otro).
  db.prepare(`UPDATE users SET is_admin = ?${makeAdmin ? ', specialty_admin = 0' : ''} WHERE id = ?`).run(makeAdmin ? 1 : 0, targetId);
  res.json({ ok: true });
});

// --- Administradores de especialidad (uno por especialidad) ---

// Estado de cada especialidad: su administrador actual y los facultativos elegibles.
router.get('/specialties', (req, res) => {
  const users = db.prepare('SELECT id, nombre, apellidos, sexo, especialidad_slug, is_admin, specialty_admin FROM users ORDER BY nombre, apellidos').all();
  const bySlug = new Map();
  for (const u of users) {
    if (!bySlug.has(u.especialidad_slug)) bySlug.set(u.especialidad_slug, []);
    bySlug.get(u.especialidad_slug).push(u);
  }
  res.json({
    specialties: SPECIALTIES.map((s) => {
      const members = bySlug.get(s.slug) || [];
      const admin = members.find((u) => u.specialty_admin && !u.is_admin);
      return {
        slug: s.slug,
        nombre: s.nombre,
        administrador: admin ? { id: admin.id, nombre: doctorName(admin) } : null,
        // Los administradores maestros no se designan como administradores de especialidad.
        candidatos: members.filter((u) => !u.is_admin).map((u) => ({ id: u.id, nombre: doctorName(u) })),
      };
    }),
  });
});

// Designa (o reasigna) al administrador de una especialidad. { user_id } — null para dejarla sin administrador.
router.put('/specialties/:slug/admin', (req, res) => {
  const slug = req.params.slug;
  if (!isValidSpecialty(slug)) return res.status(404).json({ error: 'No se ha localizado la especialidad solicitada.' });
  const userId = req.body?.user_id === null || req.body?.user_id === '' ? null : Number(req.body?.user_id);

  if (userId !== null) {
    const u = db.prepare('SELECT id, especialidad_slug, is_admin FROM users WHERE id = ?').get(userId);
    if (!u) return res.status(404).json({ error: 'No se ha localizado el facultativo solicitado.' });
    if (u.especialidad_slug !== slug) return res.status(400).json({ error: 'El facultativo designado debe pertenecer a esta especialidad.' });
    if (u.is_admin) return res.status(400).json({ error: 'Un administrador maestro ya posee todas las prerrogativas; designe a otro facultativo.' });
  }

  db.exec('BEGIN');
  try {
    db.prepare('UPDATE users SET specialty_admin = 0 WHERE especialidad_slug = ? AND specialty_admin = 1').run(slug);
    if (userId !== null) db.prepare('UPDATE users SET specialty_admin = 1 WHERE id = ?').run(userId);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  res.json({ ok: true });
});

router.delete('/users/:id', (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) {
    return res.status(400).json({ error: 'No resulta posible suprimir la cuenta propia desde esta sección.' });
  }
  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
  if (!target) return res.status(404).json({ error: 'No se ha localizado el facultativo solicitado.' });

  // El material de la Biblioteca pertenece a la institución, no al facultativo:
  // se reasigna al administrador actual en vez de perderse en cascada.
  db.prepare('UPDATE library_items SET uploaded_by = ? WHERE uploaded_by = ?').run(req.user.id, targetId);
  // Las fotografías de sus pacientes se eliminan también del disco.
  const patientIds = db.prepare('SELECT id FROM patients WHERE doctor_id = ?').all(targetId).map((r) => r.id);
  deletePhotoFilesOf(patientIds);

  db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  presence.remove(targetId);
  res.json({ ok: true });
});

// --- Copias de seguridad ---

router.get('/backups', (req, res) => {
  res.json({ backups: backup.listBackups() });
});

router.post('/backups', (req, res) => {
  try {
    res.status(201).json({ backup: backup.createBackup('manual') });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No fue posible generar la copia de seguridad: ' + e.message });
  }
});

router.post('/backups/:filename/restore', (req, res) => {
  try {
    backup.restoreBackup(req.params.filename, { keepToken: req.sessionToken, keepUser: req.user });
    res.json({ ok: true, message: 'Base de datos restaurada satisfactoriamente.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No fue posible completar la restauración: ' + e.message });
  }
});

router.get('/backups/:filename/download', (req, res) => {
  // basename() impide rutas del tipo "..%2F..%2Fdata%2Fislavisual.db"
  const file = path.join(backup.BACKUP_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'La copia de seguridad especificada no existe.' });
  res.download(file);
});

module.exports = router;
