'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth-middleware');

const router = express.Router();

function folderTitle(user) {
  const prefijo = user.sexo === 'F' ? 'Dra.' : 'Dr.';
  if (user.folder_title && user.folder_title.trim()) return user.folder_title.trim();
  return `${prefijo} ${user.nombre} ${user.apellidos}`;
}

function toDoctorCard(user) {
  return {
    id: user.id,
    nombre: user.nombre,
    apellidos: user.apellidos,
    sexo: user.sexo,
    telefono: user.telefono,
    email: user.email,
    especialidad: user.especialidad,
    folder_title: folderTitle(user),
    custom_title: user.folder_title || '',
    sort_pref: user.sort_pref,
    created_at: user.created_at,
  };
}

// Listado de todas las carpetas de médicos (todos pueden ver)
router.get('/', requireAuth, (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY nombre ASC').all();
  const withCounts = users.map((u) => {
    const count = db.prepare('SELECT COUNT(*) as c FROM patients WHERE doctor_id = ?').get(u.id).c;
    return { ...toDoctorCard(u), total_pacientes: count };
  });
  res.json({ doctors: withCounts });
});

// Detalle de una carpeta de médico
router.get('/:id', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'No se ha localizado la carpeta clínica solicitada.' });
  const total_pacientes = db.prepare('SELECT COUNT(*) as c FROM patients WHERE doctor_id = ?').get(user.id).c;
  res.json({ doctor: { ...toDoctorCard(user), total_pacientes }, is_owner: req.user.id === user.id });
});

// Solo el médico titular puede modificar su carpeta (nombre, teléfono, especialidad, denominación personalizada)
router.patch('/:id', requireAuth, (req, res) => {
  const targetId = Number(req.params.id);
  if (req.user.id !== targetId) {
    return res.status(403).json({ error: 'La modificación de la presente carpeta clínica constituye prerrogativa exclusiva de su médico titular.' });
  }
  const { nombre, apellidos, telefono, especialidad, folder_title } = req.body || {};

  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  const updated = {
    nombre: nombre?.trim() || current.nombre,
    apellidos: apellidos?.trim() || current.apellidos,
    telefono: telefono?.trim() || current.telefono,
    especialidad: especialidad?.trim() || current.especialidad,
    folder_title: folder_title !== undefined ? String(folder_title).trim() : current.folder_title,
  };

  db.prepare(
    'UPDATE users SET nombre = ?, apellidos = ?, telefono = ?, especialidad = ?, folder_title = ? WHERE id = ?'
  ).run(updated.nombre, updated.apellidos, updated.telefono, updated.especialidad, updated.folder_title, targetId);

  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  res.json({ doctor: toDoctorCard(fresh) });
});

// Solo el médico titular puede cambiar el criterio de ordenamiento predeterminado de SU carpeta de pacientes
router.patch('/:id/sort-pref', requireAuth, (req, res) => {
  const targetId = Number(req.params.id);
  if (req.user.id !== targetId) {
    return res.status(403).json({ error: 'La determinación del criterio de ordenamiento predeterminado es prerrogativa exclusiva del médico titular de la carpeta.' });
  }
  const { sort_pref } = req.body || {};
  if (!['alpha', 'fecha'].includes(sort_pref)) {
    return res.status(400).json({ error: "El criterio de ordenamiento debe corresponder a 'alpha' o 'fecha'." });
  }
  db.prepare('UPDATE users SET sort_pref = ? WHERE id = ?').run(sort_pref, targetId);
  res.json({ ok: true, sort_pref });
});

module.exports = { router, folderTitle, toDoctorCard };
