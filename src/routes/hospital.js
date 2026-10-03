'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth-middleware');
const { SPECIALTIES, GENERAL, nameOf, normalize } = require('../specialties');
const presence = require('../presence');
const { likePattern, doctorName, toDoctorCard } = require('../util');
const { pendingCountFor } = require('./library');
const { roleOf } = require('../roles');

const router = express.Router();

function groupCount(sql) {
  const map = new Map();
  for (const r of db.prepare(sql).all()) map.set(r.slug, r.c);
  return map;
}

/** Administrador designado de cada especialidad: slug -> { id, nombre }. */
function specialtyAdmins() {
  const map = new Map();
  const rows = db.prepare('SELECT id, nombre, apellidos, sexo, especialidad_slug FROM users WHERE specialty_admin = 1 AND is_admin = 0').all();
  for (const u of rows) map.set(u.especialidad_slug, { id: u.id, nombre: doctorName(u) });
  return map;
}

/** Conteos por especialidad: facultativos, pacientes, materiales aprobados y en línea. */
function specialtyStats() {
  const doctors = groupCount('SELECT especialidad_slug AS slug, COUNT(*) AS c FROM users GROUP BY especialidad_slug');
  const patients = groupCount(
    'SELECT u.especialidad_slug AS slug, COUNT(p.id) AS c FROM patients p JOIN users u ON u.id = p.doctor_id GROUP BY u.especialidad_slug'
  );
  const library = groupCount("SELECT especialidad_slug AS slug, COUNT(*) AS c FROM library_items WHERE estado = 'aprobado' GROUP BY especialidad_slug");

  const onlineBySlug = new Map();
  const ids = presence.onlineIds();
  if (ids.length) {
    const rows = db
      .prepare(`SELECT especialidad_slug AS slug, COUNT(*) AS c FROM users WHERE id IN (${ids.map(() => '?').join(',')}) GROUP BY especialidad_slug`)
      .all(...ids);
    for (const r of rows) onlineBySlug.set(r.slug, r.c);
  }

  return { doctors, patients, library, onlineBySlug, admins: specialtyAdmins() };
}

function specialtyRow(s, st) {
  return {
    slug: s.slug,
    nombre: s.nombre,
    doctores: st.doctors.get(s.slug) || 0,
    pacientes: st.patients.get(s.slug) || 0,
    materiales: st.library.get(s.slug) || 0,
    en_linea: st.onlineBySlug.get(s.slug) || 0,
    administrador: st.admins.get(s.slug) || null,
  };
}

router.get('/specialties', requireAuth, (req, res) => {
  const st = specialtyStats();
  res.json({
    specialties: SPECIALTIES.map((s) => specialtyRow(s, st)),
    general: { slug: GENERAL.slug, nombre: GENERAL.nombre, materiales: st.library.get(GENERAL.slug) || 0 },
  });
});

router.get('/specialties/:slug', requireAuth, (req, res) => {
  const s = SPECIALTIES.find((x) => x.slug === req.params.slug);
  if (!s) return res.status(404).json({ error: 'No se ha localizado la especialidad solicitada.' });
  res.json({ specialty: specialtyRow(s, specialtyStats()) });
});

// Presencia: cantidad de facultativos en línea y listado (limitado) para el panel desplegable.
// Cada llamada también actúa como latido del propio usuario (ver attachUser) y, para los
// administradores, informa cuántas propuestas de material esperan su revisión.
router.get('/presence', requireAuth, (req, res) => {
  const ids = presence.onlineIds();
  let online = [];
  if (ids.length) {
    online = db
      .prepare(`SELECT * FROM users WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY nombre, apellidos LIMIT 60`)
      .all(...ids)
      .map((u) => ({ id: u.id, nombre: doctorName(u), especialidad: nameOf(u.especialidad_slug), sexo: u.sexo, iniciales: `${u.nombre[0] || ''}${u.apellidos[0] || ''}`.toUpperCase() }));
  }
  res.json({ online_count: ids.length, online, pending_count: pendingCountFor(req.user), mi_rol: roleOf(req.user), mi_especialidad: req.user.especialidad_slug });
});

// Búsqueda global: facultativos, pacientes (nombre, historia clínica, carnet, diagnóstico)
// y material APROBADO de la biblioteca.
router.get('/search', requireAuth, (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ doctors: [], patients: [], library: [], specialties: [] });
  const like = likePattern(q);

  const doctors = db
    .prepare(
      `SELECT * FROM users
       WHERE (nombre || ' ' || apellidos) LIKE ? ESCAPE '\\' OR folder_title LIKE ? ESCAPE '\\' OR subespecialidad LIKE ? ESCAPE '\\'
       ORDER BY nombre LIMIT 6`
    )
    .all(like, like, like)
    .map(toDoctorCard);

  const patients = db
    .prepare(
      `SELECT p.id, p.nombre, p.apellidos, p.edad, p.historia_clinica, p.diagnostico, u.nombre AS dn, u.apellidos AS da, u.sexo AS ds, u.especialidad_slug
       FROM patients p JOIN users u ON u.id = p.doctor_id
       WHERE (p.nombre || ' ' || p.apellidos) LIKE ? ESCAPE '\\' OR p.historia_clinica LIKE ? ESCAPE '\\' OR p.carnet_identidad LIKE ? ESCAPE '\\' OR p.diagnostico LIKE ? ESCAPE '\\'
       ORDER BY p.apellidos, p.nombre LIMIT 8`
    )
    .all(like, like, like, like)
    .map((p) => ({
      id: p.id,
      nombre: `${p.nombre} ${p.apellidos}`,
      edad: p.edad,
      historia_clinica: p.historia_clinica,
      diagnostico: p.diagnostico,
      medico: doctorName({ nombre: p.dn, apellidos: p.da, sexo: p.ds }),
      especialidad: nameOf(p.especialidad_slug),
    }));

  const library = db
    .prepare(
      `SELECT id, titulo, categoria, especialidad_slug FROM library_items
       WHERE estado = 'aprobado' AND (titulo LIKE ? ESCAPE '\\' OR descripcion LIKE ? ESCAPE '\\')
       ORDER BY created_at DESC LIMIT 6`
    )
    .all(like, like)
    .map((l) => ({ ...l, especialidad: nameOf(l.especialidad_slug) }));

  const nq = normalize(q);
  const specialties = SPECIALTIES.filter((s) => normalize(s.nombre).includes(nq)).slice(0, 5);

  res.json({ doctors, patients, library, specialties });
});

module.exports = router;
module.exports.specialtyAdmins = specialtyAdmins;
