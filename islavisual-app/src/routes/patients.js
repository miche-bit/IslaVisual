'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth-middleware');

const router = express.Router();

function assertOwner(req, res, doctorId) {
  if (req.user.id !== Number(doctorId)) {
    res.status(403).json({ error: 'La presente acción constituye prerrogativa exclusiva del médico titular de esta carpeta clínica.' });
    return false;
  }
  return true;
}

// Lista de pacientes de un médico. Cualquier facultativo autenticado puede consultarla.
// ?sort=alpha|fecha  -> preferencia de VISUALIZACIÓN de quien consulta (no se guarda si no es el médico titular)
router.get('/doctor/:doctorId', requireAuth, (req, res) => {
  const doctor = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.doctorId);
  if (!doctor) return res.status(404).json({ error: 'No se ha localizado el facultativo solicitado.' });

  const sort = req.query.sort === 'alpha' || req.query.sort === 'fecha' ? req.query.sort : doctor.sort_pref;

  const orderBy = sort === 'fecha' ? 'created_at DESC' : 'apellidos ASC, nombre ASC';
  const patients = db.prepare(`SELECT * FROM patients WHERE doctor_id = ? ORDER BY ${orderBy}`).all(doctor.id);

  const withPhotoCounts = patients.map((p) => {
    const photo_count = db.prepare('SELECT COUNT(*) as c FROM photos WHERE patient_id = ?').get(p.id).c;
    return { ...p, photo_count };
  });

  res.json({ patients: withPhotoCounts, applied_sort: sort, is_owner: req.user.id === doctor.id });
});

router.get('/:id', requireAuth, (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'No se ha localizado el expediente del paciente solicitado.' });
  res.json({ patient, is_owner: req.user.id === patient.doctor_id });
});

// Consignar nuevo paciente: prerrogativa exclusiva del médico titular de la carpeta
router.post('/doctor/:doctorId', requireAuth, (req, res) => {
  if (!assertOwner(req, res, req.params.doctorId)) return;

  const { nombre, apellidos, edad, sexo, diagnostico, historia_clinica, carnet_identidad, cas } = req.body || {};
  if (!nombre || !apellidos || edad === undefined || !sexo) {
    return res.status(400).json({ error: 'Los campos nombre, apellidos, edad y sexo son de carácter obligatorio.' });
  }
  if (!['M', 'F'].includes(sexo)) return res.status(400).json({ error: 'El valor consignado para el campo sexo no resulta válido.' });

  const info = db
    .prepare(
      `INSERT INTO patients (doctor_id, nombre, apellidos, edad, sexo, diagnostico, historia_clinica, carnet_identidad, cas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.id,
      nombre.trim(),
      apellidos.trim(),
      Number(edad),
      sexo,
      (diagnostico || '').trim(),
      (historia_clinica || '').trim(),
      (carnet_identidad || '').trim(),
      (cas || '').trim()
    );

  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ patient });
});

// Modificar paciente: prerrogativa exclusiva del médico titular
router.patch('/:id', requireAuth, (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'No se ha localizado el expediente del paciente solicitado.' });
  if (!assertOwner(req, res, patient.doctor_id)) return;

  const fields = ['nombre', 'apellidos', 'edad', 'sexo', 'diagnostico', 'historia_clinica', 'carnet_identidad', 'cas'];
  const updates = {};
  for (const f of fields) {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  }

  const merged = { ...patient, ...updates };
  db.prepare(
    `UPDATE patients SET nombre=?, apellidos=?, edad=?, sexo=?, diagnostico=?, historia_clinica=?, carnet_identidad=?, cas=?, updated_at=datetime('now')
     WHERE id = ?`
  ).run(
    merged.nombre,
    merged.apellidos,
    Number(merged.edad),
    merged.sexo,
    merged.diagnostico,
    merged.historia_clinica,
    merged.carnet_identidad,
    merged.cas,
    patient.id
  );

  const fresh = db.prepare('SELECT * FROM patients WHERE id = ?').get(patient.id);
  res.json({ patient: fresh });
});

// Suprimir paciente: prerrogativa exclusiva del médico titular
router.delete('/:id', requireAuth, (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'No se ha localizado el expediente del paciente solicitado.' });
  if (!assertOwner(req, res, patient.doctor_id)) return;

  db.prepare('DELETE FROM patients WHERE id = ?').run(patient.id);
  res.json({ ok: true });
});

module.exports = router;
