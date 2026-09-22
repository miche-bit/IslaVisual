'use strict';

const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const multer = require('multer');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../auth-middleware');

const router = express.Router();

const LIBRARY_DIR = process.env.LIBRARY_DIR || path.join(__dirname, '..', '..', 'uploads', 'biblioteca');
if (!fs.existsSync(LIBRARY_DIR)) fs.mkdirSync(LIBRARY_DIR, { recursive: true });

// Clasificación automática por extensión, para elegir el ícono y el modo de presentación
const EXT_CATEGORIA = {
  '.jpg': 'imagen', '.jpeg': 'imagen', '.png': 'imagen', '.webp': 'imagen', '.gif': 'imagen', '.heic': 'imagen', '.heif': 'imagen',
  '.mp4': 'video', '.webm': 'video', '.mov': 'video', '.mkv': 'video', '.avi': 'video',
  '.pdf': 'documento', '.doc': 'documento', '.docx': 'documento', '.ppt': 'documento', '.pptx': 'documento',
  '.xls': 'documento', '.xlsx': 'documento', '.txt': 'documento', '.odt': 'documento',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, LIBRARY_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.bin';
    const unique = crypto.randomBytes(16).toString('hex');
    cb(null, `${Date.now()}-${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 }, // 150MB — contempla material audiovisual
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!EXT_CATEGORIA[ext]) return cb(new Error('El formato del material consignado no se encuentra entre los admitidos por el sistema.'));
    cb(null, true);
  },
});

// Consulta del acervo bibliográfico: accesible a la totalidad del cuerpo facultativo autenticado
router.get('/', requireAuth, (req, res) => {
  const items = db.prepare('SELECT * FROM library_items ORDER BY created_at DESC').all();
  const withUploader = items.map((it) => {
    const uploader = db.prepare('SELECT nombre, apellidos, sexo FROM users WHERE id = ?').get(it.uploaded_by);
    return { ...it, uploader_nombre: uploader ? `${uploader.sexo === 'F' ? 'Dra.' : 'Dr.'} ${uploader.nombre} ${uploader.apellidos}` : null };
  });
  res.json({ items: withUploader });
});

// Incorporación de material: prerrogativa exclusiva del cuerpo administrativo
router.post('/', requireAuth, requireAdmin, upload.single('archivo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Debe adjuntarse un archivo para completar la solicitud.' });

  const { titulo, descripcion } = req.body || {};
  if (!titulo || !titulo.trim()) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'La denominación del material constituye un campo obligatorio.' });
  }

  const ext = path.extname(req.file.originalname || '').toLowerCase();
  const categoria = EXT_CATEGORIA[ext] || 'documento';

  const info = db
    .prepare(
      `INSERT INTO library_items (uploaded_by, titulo, descripcion, categoria, filename, original_name, size_bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.user.id, titulo.trim(), (descripcion || '').trim(), categoria, req.file.filename, req.file.originalname, req.file.size);

  const item = db.prepare('SELECT * FROM library_items WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ item });
});

// Modificación de metadatos del material: prerrogativa exclusiva del cuerpo administrativo
router.patch('/:id', requireAuth, requireAdmin, (req, res) => {
  const item = db.prepare('SELECT * FROM library_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'No se ha localizado el material solicitado.' });

  const { titulo, descripcion } = req.body || {};
  db.prepare("UPDATE library_items SET titulo = ?, descripcion = ?, updated_at = datetime('now') WHERE id = ?").run(
    titulo?.trim() || item.titulo,
    descripcion !== undefined ? String(descripcion).trim() : item.descripcion,
    item.id
  );

  const fresh = db.prepare('SELECT * FROM library_items WHERE id = ?').get(item.id);
  res.json({ item: fresh });
});

// Supresión de material: prerrogativa exclusiva del cuerpo administrativo
router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  const item = db.prepare('SELECT * FROM library_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'No se ha localizado el material solicitado.' });

  db.prepare('DELETE FROM library_items WHERE id = ?').run(item.id);
  fs.unlink(path.join(LIBRARY_DIR, item.filename), () => {});
  res.json({ ok: true });
});

module.exports = { router, LIBRARY_DIR };
