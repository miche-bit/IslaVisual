'use strict';

const express = require('express');
const path = require('node:path');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../auth-middleware');
const backup = require('../backup');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/stats', (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  const totalPatients = db.prepare('SELECT COUNT(*) c FROM patients').get().c;
  const totalPhotos = db.prepare('SELECT COUNT(*) c FROM photos').get().c;
  const uploadsSize = backup.getUploadsFolderSize();
  res.json({
    totalUsers,
    totalPatients,
    totalPhotos,
    uploadsSizeBytes: uploadsSize,
  });
});

router.get('/users', (req, res) => {
  const users = db
    .prepare(
      `SELECT id, nombre, apellidos, sexo, telefono, email, especialidad, is_admin, sort_pref, folder_title, created_at
       FROM users ORDER BY created_at DESC`
    )
    .all();
  const withCounts = users.map((u) => ({
    ...u,
    total_pacientes: db.prepare('SELECT COUNT(*) c FROM patients WHERE doctor_id = ?').get(u.id).c,
  }));
  res.json({ users: withCounts });
});

router.patch('/users/:id/admin', (req, res) => {
  const { is_admin } = req.body || {};
  db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(is_admin ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

router.delete('/users/:id', (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'No resulta posible suprimir la cuenta propia desde esta sección.' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// --- Backups ---

router.get('/backups', (req, res) => {
  const list = backup.listBackups();
  res.json({ backups: list });
});

router.post('/backups', (req, res) => {
  try {
    const result = backup.createBackup('manual');
    res.status(201).json({ backup: result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No fue posible generar la copia de seguridad: ' + e.message });
  }
});

router.post('/backups/:filename/restore', (req, res) => {
  try {
    backup.restoreBackup(req.params.filename);
    res.json({ ok: true, message: 'Base de datos restaurada satisfactoriamente. Es posible que deba actualizar la página.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No fue posible completar la restauración: ' + e.message });
  }
});

router.get('/backups/:filename/download', (req, res) => {
  const file = path.join(backup.BACKUP_DIR, req.params.filename);
  res.download(file);
});

module.exports = router;
