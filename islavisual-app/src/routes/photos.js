'use strict';

const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const multer = require('multer');
const db = require('../db');
const { requireAuth } = require('../auth-middleware');

const router = express.Router();

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads', 'photos');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const unique = crypto.randomBytes(16).toString('hex');
    cb(null, `${Date.now()}-${unique}${ext}`);
  },
});

const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB por foto
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED.has(ext)) return cb(new Error('Formato de imagen no permitido.'));
    cb(null, true);
  },
});

function assertOwnerOfPatient(req, res, patient) {
  if (req.user.id !== patient.doctor_id) {
    res.status(403).json({ error: 'La incorporación y supresión de registros fotográficos constituye prerrogativa exclusiva del médico titular de esta carpeta clínica.' });
    return false;
  }
  return true;
}

// Listar fotos de un paciente: accesible a la totalidad del cuerpo facultativo
router.get('/patient/:patientId', requireAuth, (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.patientId);
  if (!patient) return res.status(404).json({ error: 'No se ha localizado el expediente del paciente solicitado.' });

  const photos = db
    .prepare('SELECT * FROM photos WHERE patient_id = ? ORDER BY fecha_foto DESC, uploaded_at DESC')
    .all(patient.id);

  res.json({ photos, is_owner: req.user.id === patient.doctor_id });
});

// Incorporar fotografía: prerrogativa exclusiva del médico titular; requiere descripción y fecha
router.post('/patient/:patientId', requireAuth, upload.single('photo'), (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.patientId);
  if (!patient) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(404).json({ error: 'No se ha localizado el expediente del paciente solicitado.' });
  }
  if (!assertOwnerOfPatient(req, res, patient)) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return;
  }
  if (!req.file) return res.status(400).json({ error: 'Debe adjuntarse una imagen fotográfica para completar la solicitud.' });

  const { descripcion, fecha_foto } = req.body || {};
  if (!descripcion || !descripcion.trim() || !fecha_foto) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'La descripción clínica y la fecha de captura constituyen campos obligatorios.' });
  }

  const info = db
    .prepare(
      `INSERT INTO photos (patient_id, doctor_id, filename, original_name, descripcion, fecha_foto)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(patient.id, req.user.id, req.file.filename, req.file.originalname, descripcion.trim(), fecha_foto);

  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ photo });
});

// Modificar descripción/fecha de una fotografía: prerrogativa exclusiva del médico titular
router.patch('/:id', requireAuth, (req, res) => {
  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.id);
  if (!photo) return res.status(404).json({ error: 'No se ha localizado el registro fotográfico solicitado.' });
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(photo.patient_id);
  if (!assertOwnerOfPatient(req, res, patient)) return;

  const { descripcion, fecha_foto } = req.body || {};
  db.prepare('UPDATE photos SET descripcion = ?, fecha_foto = ? WHERE id = ?').run(
    descripcion?.trim() || photo.descripcion,
    fecha_foto || photo.fecha_foto,
    photo.id
  );
  const fresh = db.prepare('SELECT * FROM photos WHERE id = ?').get(photo.id);
  res.json({ photo: fresh });
});

// Suprimir fotografía: prerrogativa exclusiva del médico titular
router.delete('/:id', requireAuth, (req, res) => {
  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.id);
  if (!photo) return res.status(404).json({ error: 'No se ha localizado el registro fotográfico solicitado.' });
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(photo.patient_id);
  if (!assertOwnerOfPatient(req, res, patient)) return;

  db.prepare('DELETE FROM photos WHERE id = ?').run(photo.id);
  fs.unlink(path.join(UPLOADS_DIR, photo.filename), () => {});
  res.json({ ok: true });
});

module.exports = router;
