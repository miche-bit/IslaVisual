'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth-middleware');
const { isValidSpecialty, nameOf } = require('../specialties');
const { pageParams, pageResult, likePattern, toDoctorCard } = require('../util');

const { authorize, ownedRun } = require('../policies');

const router = express.Router();

// Listado de carpetas clínicas, paginado. Filtros: ?especialidad=slug&q=texto
router.get('/', requireAuth, (req, res) => {
  const pg = pageParams(req, 12);
  const where = [];
  const params = [];
  if (req.query.especialidad) {
    where.push('u.especialidad_slug = ?');
    params.push(String(req.query.especialidad));
  }
  const q = String(req.query.q || '').trim();
  if (q) {
    const like = likePattern(q);
    where.push("((u.nombre || ' ' || u.apellidos) LIKE ? ESCAPE '\\' OR u.folder_title LIKE ? ESCAPE '\\' OR u.subespecialidad LIKE ? ESCAPE '\\')");
    params.push(like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) AS c FROM users u ${whereSql}`).get(...params).c;
  // El propio facultativo aparece primero en el listado de su especialidad.
  const rows = db
    .prepare(
      `SELECT u.*, COALESCE(pc.c, 0) AS total_pacientes
       FROM users u
       LEFT JOIN (SELECT doctor_id, COUNT(*) AS c FROM patients GROUP BY doctor_id) pc ON pc.doctor_id = u.id
       ${whereSql}
       ORDER BY (u.id = ?) DESC, u.nombre COLLATE NOCASE, u.apellidos COLLATE NOCASE
       LIMIT ? OFFSET ?`
    )
    .all(...params, req.user.id, pg.limit, pg.offset);

  res.json(pageResult(rows.map((u) => ({ ...toDoctorCard(u), total_pacientes: u.total_pacientes })), total, pg));
});

// Detalle de una carpeta clínica
router.get('/:id', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'No se ha localizado la carpeta clínica solicitada.' });
  const total_pacientes = db.prepare('SELECT COUNT(*) as c FROM patients WHERE doctor_id = ?').get(user.id).c;
  res.json({ doctor: { ...toDoctorCard(user), total_pacientes }, is_owner: req.user.id === user.id });
});

// Solo el médico titular puede modificar su carpeta (datos, especialidad, denominación personalizada)
router.patch('/:id', requireAuth, (req, res) => {
  const targetId = Number(req.params.id);
  if (!authorize(req, res, 'users', 'update', { id: targetId })) return;
  const { nombre, apellidos, telefono, especialidad_slug, subespecialidad, folder_title } = req.body || {};

  if (especialidad_slug !== undefined && !isValidSpecialty(especialidad_slug)) {
    return res.status(400).json({ error: 'La especialidad seleccionada no pertenece al catálogo del hospital.' });
  }

  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  const slug = especialidad_slug || current.especialidad_slug;
  const updated = {
    nombre: nombre?.trim() || current.nombre,
    apellidos: apellidos?.trim() || current.apellidos,
    telefono: telefono?.trim() || current.telefono,
    especialidad_slug: slug,
    subespecialidad: subespecialidad !== undefined ? String(subespecialidad).trim() : current.subespecialidad,
    folder_title: folder_title !== undefined ? String(folder_title).trim() : current.folder_title,
  };

  // Si cambia de especialidad deja de administrar la anterior (la especialidad queda
  // sin administrador hasta que el maestro designe otro).
  const leavesSpecialty = slug !== current.especialidad_slug;
  const stmt = db.prepare(
    `UPDATE users SET nombre = ?, apellidos = ?, telefono = ?, especialidad = ?, especialidad_slug = ?, subespecialidad = ?, folder_title = ?
     ${leavesSpecialty ? ', specialty_admin = 0' : ''}
     WHERE id = ? AND id = ?`
  );
  if (!ownedRun(res, stmt, [updated.nombre, updated.apellidos, updated.telefono, nameOf(slug), slug, updated.subespecialidad, updated.folder_title, targetId, req.user.id], 'users')) return;

  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  res.json({ doctor: toDoctorCard(fresh) });
});

// Solo el médico titular puede cambiar el criterio de ordenamiento predeterminado de su carpeta
router.patch('/:id/sort-pref', requireAuth, (req, res) => {
  const targetId = Number(req.params.id);
  if (!authorize(req, res, 'users', 'update', { id: targetId }, 'La determinación del criterio de ordenamiento predeterminado es prerrogativa exclusiva del médico titular de la carpeta.')) return;
  const { sort_pref } = req.body || {};
  if (!['alpha', 'fecha'].includes(sort_pref)) {
    return res.status(400).json({ error: "El criterio de ordenamiento debe corresponder a 'alpha' o 'fecha'." });
  }
  if (!ownedRun(res, db.prepare('UPDATE users SET sort_pref = ? WHERE id = ? AND id = ?'), [sort_pref, targetId, req.user.id], 'users')) return;
  res.json({ ok: true, sort_pref });
});

module.exports = { router };
