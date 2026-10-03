'use strict';

const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const db = require('../db');
const { requireAuth } = require('../auth-middleware');
const { PHOTOS_DIR } = require('../paths');
const { pageParams, pageResult, likePattern, doctorName } = require('../util');
const { authorize, ownedRun } = require('../policies');

const router = express.Router();

/** Valida los campos de la hoja de cargo. Devuelve un mensaje de error o null. */
function validatePatient(p) {
  if (!String(p.nombre || '').trim() || !String(p.apellidos || '').trim()) {
    return 'Los campos nombre y apellidos son de carácter obligatorio.';
  }
  const edad = Number(p.edad);
  if (p.edad === '' || p.edad === null || p.edad === undefined || !Number.isInteger(edad) || edad < 0 || edad > 130) {
    return 'La edad consignada debe ser un número entero entre 0 y 130.';
  }
  if (!['M', 'F'].includes(p.sexo)) return 'El valor consignado para el campo sexo no resulta válido.';
  return null;
}

function clean(v) {
  return String(v ?? '').trim();
}

/** Suprime del disco las fotografías de uno o varios pacientes (antes de borrar las filas). */
function deletePhotoFilesOf(patientIds) {
  if (!patientIds.length) return;
  const rows = db
    .prepare(`SELECT filename FROM photos WHERE patient_id IN (${patientIds.map(() => '?').join(',')})`)
    .all(...patientIds);
  for (const r of rows) fs.unlink(path.join(PHOTOS_DIR, path.basename(r.filename)), () => {});
}

// Pacientes de una carpeta clínica, paginados. Consultable por todo el cuerpo facultativo.
// ?sort=alpha|fecha (preferencia de visualización de quien consulta) &q=texto &page=
router.get('/doctor/:doctorId', requireAuth, (req, res) => {
  const doctor = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.doctorId);
  if (!doctor) return res.status(404).json({ error: 'No se ha localizado el facultativo solicitado.' });

  const pg = pageParams(req, 12);
  const sort = req.query.sort === 'alpha' || req.query.sort === 'fecha' ? req.query.sort : doctor.sort_pref;
  const orderBy = sort === 'fecha' ? 'p.created_at DESC, p.id DESC' : 'p.apellidos COLLATE NOCASE, p.nombre COLLATE NOCASE';

  const where = ['p.doctor_id = ?'];
  const params = [doctor.id];
  const q = String(req.query.q || '').trim();
  if (q) {
    const like = likePattern(q);
    where.push("((p.nombre || ' ' || p.apellidos) LIKE ? ESCAPE '\\' OR p.historia_clinica LIKE ? ESCAPE '\\' OR p.carnet_identidad LIKE ? ESCAPE '\\' OR p.diagnostico LIKE ? ESCAPE '\\')");
    params.push(like, like, like, like);
  }
  const whereSql = where.join(' AND ');

  const total = db.prepare(`SELECT COUNT(*) AS c FROM patients p WHERE ${whereSql}`).get(...params).c;
  const rows = db
    .prepare(
      `SELECT p.*, COALESCE(ph.c, 0) AS photo_count, COALESCE(nt.c, 0) AS note_count
       FROM patients p
       LEFT JOIN (SELECT patient_id, COUNT(*) AS c FROM photos GROUP BY patient_id) ph ON ph.patient_id = p.id
       LEFT JOIN (SELECT patient_id, COUNT(*) AS c FROM patient_notes GROUP BY patient_id) nt ON nt.patient_id = p.id
       WHERE ${whereSql}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`
    )
    .all(...params, pg.limit, pg.offset);

  res.json({ ...pageResult(rows, total, pg), applied_sort: sort, is_owner: req.user.id === doctor.id });
});

router.get('/:id', requireAuth, (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'No se ha localizado el expediente del paciente solicitado.' });
  const doctor = db.prepare('SELECT * FROM users WHERE id = ?').get(patient.doctor_id);
  res.json({
    patient,
    doctor: doctor ? { id: doctor.id, nombre: doctorName(doctor), especialidad_slug: doctor.especialidad_slug, telefono: doctor.telefono } : null,
    is_owner: req.user.id === patient.doctor_id,
  });
});

// Consignar nuevo paciente: prerrogativa exclusiva del médico titular de la carpeta
router.post('/doctor/:doctorId', requireAuth, (req, res) => {
  if (!authorize(req, res, 'patients', 'insert', { doctor_id: req.params.doctorId })) return;
  const b = req.body || {};
  const err = validatePatient(b);
  if (err) return res.status(400).json({ error: err });

  const info = db
    .prepare(
      `INSERT INTO patients (doctor_id, nombre, apellidos, edad, sexo, diagnostico, historia_clinica, carnet_identidad, cas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.user.id, clean(b.nombre), clean(b.apellidos), Number(b.edad), b.sexo, clean(b.diagnostico), clean(b.historia_clinica), clean(b.carnet_identidad), clean(b.cas));

  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ patient });
});

// Modificar paciente: prerrogativa exclusiva del médico titular
router.patch('/:id', requireAuth, (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'No se ha localizado el expediente del paciente solicitado.' });
  if (!authorize(req, res, 'patients', 'update', patient)) return;

  const fields = ['nombre', 'apellidos', 'edad', 'sexo', 'diagnostico', 'historia_clinica', 'carnet_identidad', 'cas'];
  const merged = { ...patient };
  for (const f of fields) if (req.body?.[f] !== undefined) merged[f] = req.body[f];

  const err = validatePatient(merged);
  if (err) return res.status(400).json({ error: err });

  const stmt = db.prepare(
    `UPDATE patients SET nombre=?, apellidos=?, edad=?, sexo=?, diagnostico=?, historia_clinica=?, carnet_identidad=?, cas=?, updated_at=datetime('now')
     WHERE id = ? AND doctor_id = ?`
  );
  if (!ownedRun(res, stmt, [clean(merged.nombre), clean(merged.apellidos), Number(merged.edad), merged.sexo, clean(merged.diagnostico), clean(merged.historia_clinica), clean(merged.carnet_identidad), clean(merged.cas), patient.id, req.user.id], 'patients')) return;

  res.json({ patient: db.prepare('SELECT * FROM patients WHERE id = ?').get(patient.id) });
});

// Suprimir paciente: prerrogativa exclusiva del médico titular. También elimina sus fotografías del disco.
router.delete('/:id', requireAuth, (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'No se ha localizado el expediente del paciente solicitado.' });
  if (!authorize(req, res, 'patients', 'delete', patient)) return;

  const photoFiles = db.prepare('SELECT filename FROM photos WHERE patient_id = ?').all(patient.id);
  if (!ownedRun(res, db.prepare('DELETE FROM patients WHERE id = ? AND doctor_id = ?'), [patient.id, req.user.id], 'patients')) return;
  for (const { filename } of photoFiles) fs.unlink(path.join(PHOTOS_DIR, path.basename(filename)), () => {});
  res.json({ ok: true });
});

// --- Notas de evolución clínica ---

// Consulta: todo el cuerpo facultativo. Paginadas, más recientes primero.
router.get('/:id/notes', requireAuth, (req, res) => {
  const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'No se ha localizado el expediente del paciente solicitado.' });
  const pg = pageParams(req, 5, 20);
  const total = db.prepare('SELECT COUNT(*) AS c FROM patient_notes WHERE patient_id = ?').get(patient.id).c;
  const rows = db
    .prepare(
      `SELECT n.*, u.nombre, u.apellidos, u.sexo FROM patient_notes n JOIN users u ON u.id = n.doctor_id
       WHERE n.patient_id = ? ORDER BY n.created_at DESC, n.id DESC LIMIT ? OFFSET ?`
    )
    .all(patient.id, pg.limit, pg.offset)
    .map((n) => ({ id: n.id, texto: n.texto, created_at: n.created_at, autor: doctorName(n) }));
  res.json(pageResult(rows, total, pg));
});

// Consignar nota: prerrogativa exclusiva del médico titular.
router.post('/:id/notes', requireAuth, (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'No se ha localizado el expediente del paciente solicitado.' });
  if (!authorize(req, res, 'patient_notes', 'insert', patient)) return;
  const texto = clean(req.body?.texto);
  if (!texto) return res.status(400).json({ error: 'La nota de evolución no puede estar vacía.' });
  if (texto.length > 4000) return res.status(400).json({ error: 'La nota de evolución no puede exceder los 4000 caracteres.' });
  const info = db.prepare('INSERT INTO patient_notes (patient_id, doctor_id, texto) VALUES (?, ?, ?)').run(patient.id, req.user.id, texto);
  db.prepare("UPDATE patients SET updated_at = datetime('now') WHERE id = ?").run(patient.id);
  res.status(201).json({ note: db.prepare('SELECT * FROM patient_notes WHERE id = ?').get(info.lastInsertRowid) });
});

router.delete('/:id/notes/:noteId', requireAuth, (req, res) => {
  const note = db.prepare('SELECT * FROM patient_notes WHERE id = ? AND patient_id = ?').get(req.params.noteId, req.params.id);
  if (!note) return res.status(404).json({ error: 'No se ha localizado la nota solicitada.' });
  const patient = db.prepare('SELECT doctor_id FROM patients WHERE id = ?').get(note.patient_id);
  if (!authorize(req, res, 'patient_notes', 'delete', patient)) return;
  const stmt = db.prepare('DELETE FROM patient_notes WHERE id = ? AND patient_id IN (SELECT id FROM patients WHERE doctor_id = ?)');
  if (!ownedRun(res, stmt, [note.id, req.user.id], 'patient_notes')) return;
  res.json({ ok: true });
});

module.exports = router;
module.exports.deletePhotoFilesOf = deletePhotoFilesOf;
