'use strict';

const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const multer = require('multer');
const db = require('../db');
const { requireAuth } = require('../auth-middleware');
const { PHOTOS_DIR: UPLOADS_DIR } = require('../paths');
const { authorize, ownedRun } = require('../policies');
const { checkSignature } = require('../file-signature');

const router = express.Router();

function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

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
    if (!ALLOWED.has(ext)) return cb(new Error('El formato de la imagen consignada no se encuentra entre los admitidos por el sistema.'));
    cb(null, true);
  },
});

function assertOwnerOfPatient(req, res, patient) {
  return authorize(req, res, 'photos', 'insert', patient);
}

/** Antes de recibir el archivo: un no titular no puede ni siquiera ocupar disco. */
function ownPatientBeforeUpload(req, res, next) {
  const patient = db.prepare('SELECT id, doctor_id FROM patients WHERE id = ?').get(req.params.patientId);
  if (!patient) return res.status(404).json({ error: 'No se ha localizado el expediente del paciente solicitado.' });
  if (!assertOwnerOfPatient(req, res, patient)) return;
  next();
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
router.post('/patient/:patientId', requireAuth, ownPatientBeforeUpload, upload.single('photo'), (req, res) => {
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
  // El contenido real del archivo debe corresponder a una imagen (no basta la extensión).
  if (!checkSignature(req.file.path, path.extname(req.file.originalname || ''))) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'El contenido del archivo no corresponde a una imagen válida.' });
  }

  const { descripcion, fecha_foto } = req.body || {};
  if (!descripcion || !descripcion.trim() || !fecha_foto) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'La descripción clínica y la fecha de captura constituyen campos obligatorios.' });
  }
  if (!isValidDate(fecha_foto)) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'La fecha de captura consignada no resulta válida.' });
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
  if (!authorize(req, res, 'photos', 'update', patient)) return;

  const { descripcion, fecha_foto } = req.body || {};
  if (fecha_foto && !isValidDate(fecha_foto)) {
    return res.status(400).json({ error: 'La fecha de captura consignada no resulta válida.' });
  }
  const stmt = db.prepare('UPDATE photos SET descripcion = ?, fecha_foto = ? WHERE id = ? AND doctor_id = ?');
  if (!ownedRun(res, stmt, [descripcion?.trim() || photo.descripcion, fecha_foto || photo.fecha_foto, photo.id, req.user.id], 'photos')) return;
  const fresh = db.prepare('SELECT * FROM photos WHERE id = ?').get(photo.id);
  res.json({ photo: fresh });
});

// Suprimir fotografía: prerrogativa exclusiva del médico titular
router.delete('/:id', requireAuth, (req, res) => {
  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.id);
  if (!photo) return res.status(404).json({ error: 'No se ha localizado el registro fotográfico solicitado.' });
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(photo.patient_id);
  if (!authorize(req, res, 'photos', 'delete', patient)) return;

  if (!ownedRun(res, db.prepare('DELETE FROM photos WHERE id = ? AND doctor_id = ?'), [photo.id, req.user.id], 'photos')) return;
  fs.unlink(path.join(UPLOADS_DIR, path.basename(photo.filename)), () => {});
  res.json({ ok: true });
});

module.exports = router;
