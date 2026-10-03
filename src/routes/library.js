'use strict';

const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const multer = require('multer');
const db = require('../db');
const { requireAuth, requireApprover } = require('../auth-middleware');
const { LIBRARY_DIR } = require('../paths');
const { isValidLibraryTag, nameOf, GENERAL } = require('../specialties');
const { pageParams, pageResult, likePattern, doctorName } = require('../util');
const roles = require('../roles');
const { can, authorize } = require('../policies');
const { checkSignature } = require('../file-signature');

const router = express.Router();

// Clasificación automática por extensión, para elegir el ícono y el modo de presentación
const EXT_CATEGORIA = {
  '.jpg': 'imagen', '.jpeg': 'imagen', '.png': 'imagen', '.webp': 'imagen', '.gif': 'imagen',
  '.mp4': 'video', '.webm': 'video', '.mov': 'video', '.m4v': 'video',
  '.pdf': 'documento', '.doc': 'documento', '.docx': 'documento', '.ppt': 'documento', '.pptx': 'documento',
  '.xls': 'documento', '.xlsx': 'documento', '.txt': 'documento', '.odt': 'documento',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, LIBRARY_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.bin';
    cb(null, `${Date.now()}-${crypto.randomBytes(16).toString('hex')}${ext}`);
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

const SELECT_BASE = `
  SELECT l.*, up.nombre AS u_nombre, up.apellidos AS u_apellidos, up.sexo AS u_sexo, up.especialidad_slug AS u_slug,
         rv.nombre AS r_nombre, rv.apellidos AS r_apellidos, rv.sexo AS r_sexo
  FROM library_items l
  LEFT JOIN users up ON up.id = l.uploaded_by
  LEFT JOIN users rv ON rv.id = l.revisado_por`;

function getItem(id) {
  return db.prepare(`${SELECT_BASE} WHERE l.id = ?`).get(id);
}

function decorate(it, user) {
  return {
    id: it.id,
    titulo: it.titulo,
    descripcion: it.descripcion,
    categoria: it.categoria,
    filename: it.filename,
    original_name: it.original_name,
    size_bytes: it.size_bytes,
    created_at: it.created_at,
    especialidad_slug: it.especialidad_slug,
    especialidad: nameOf(it.especialidad_slug),
    estado: it.estado,
    motivo_rechazo: it.motivo_rechazo,
    revisado_at: it.revisado_at,
    revisor_nombre: it.r_nombre ? doctorName({ nombre: it.r_nombre, apellidos: it.r_apellidos, sexo: it.r_sexo }) : null,
    uploader_nombre: it.u_nombre ? doctorName({ nombre: it.u_nombre, apellidos: it.u_apellidos, sexo: it.u_sexo }) : null,
    es_propio: it.uploaded_by === user.id,
    puede_gestionar: roles.canManageItem(user, it, it.u_slug),
    // Detecta archivos perdidos (p. ej. subidos antes de que la biblioteca viviera en el volumen persistente)
    file_missing: !fs.existsSync(path.join(LIBRARY_DIR, path.basename(it.filename))),
  };
}

function checkTag(user, slug) {
  if (!isValidLibraryTag(slug)) return 'Debe etiquetar el material con una especialidad válida.';
  const allowed = roles.allowedTagsFor(user);
  if (allowed && !allowed.includes(slug)) {
    return 'Solo puede etiquetar material con su propia especialidad o como material General.';
  }
  return null;
}

/**
 * Consulta del acervo, paginada.
 * ?vista=publicado (predeterminada, material aprobado, para todo el cuerpo facultativo)
 *       |mias      (propuestas propias, en cualquier estado)
 *       |pendientes (material por revisar dentro del ámbito del aprobador)
 * Filtros: ?especialidad=slug (&incluir_general=1) &categoria= &q=
 */
router.get('/', requireAuth, (req, res) => {
  const pg = pageParams(req, 12);
  const vista = ['mias', 'pendientes'].includes(req.query.vista) ? req.query.vista : 'publicado';
  const where = [];
  const params = [];

  if (vista === 'publicado') {
    where.push("l.estado = 'aprobado'");
  } else if (vista === 'mias') {
    where.push('l.uploaded_by = ?');
    params.push(req.user.id);
  } else {
    if (!roles.canApprove(req.user)) return res.status(403).json({ error: 'Esta acción requiere prerrogativas de administración.' });
    const [scopeSql, scopeParams] = roles.reviewScopeSql(req.user);
    where.push("l.estado = 'pendiente'", scopeSql);
    params.push(...scopeParams);
  }

  if (req.query.especialidad) {
    const slug = String(req.query.especialidad);
    if (req.query.incluir_general === '1' && slug !== GENERAL.slug) {
      where.push('l.especialidad_slug IN (?, ?)');
      params.push(slug, GENERAL.slug);
    } else {
      where.push('l.especialidad_slug = ?');
      params.push(slug);
    }
  }
  if (['imagen', 'video', 'documento'].includes(req.query.categoria)) {
    where.push('l.categoria = ?');
    params.push(req.query.categoria);
  }
  const q = String(req.query.q || '').trim();
  if (q) {
    const like = likePattern(q);
    where.push("(l.titulo LIKE ? ESCAPE '\\' OR l.descripcion LIKE ? ESCAPE '\\')");
    params.push(like, like);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const total = db.prepare(`SELECT COUNT(*) AS c FROM library_items l LEFT JOIN users up ON up.id = l.uploaded_by ${whereSql}`).get(...params).c;
  const order = vista === 'pendientes' ? 'l.created_at ASC, l.id ASC' : 'l.created_at DESC, l.id DESC';
  const items = db
    .prepare(`${SELECT_BASE} ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, pg.limit, pg.offset)
    .map((it) => decorate(it, req.user));

  res.json(pageResult(items, total, pg));
});

/** Cantidad de propuestas pendientes dentro del ámbito del aprobador (0 para el resto). */
function pendingCountFor(user) {
  if (!roles.canApprove(user)) return 0;
  const [scopeSql, scopeParams] = roles.reviewScopeSql(user);
  return db
    .prepare(`SELECT COUNT(*) AS c FROM library_items l LEFT JOIN users up ON up.id = l.uploaded_by WHERE l.estado = 'pendiente' AND ${scopeSql}`)
    .get(...scopeParams).c;
}

router.get('/pending-count', requireAuth, (req, res) => {
  res.json({ count: pendingCountFor(req.user) });
});

// Propuesta de material: cualquier facultativo. Queda pendiente de aprobación, salvo que
// quien la sube sea también quien debe aprobarla (maestro o administrador de esa especialidad).
router.post('/', requireAuth, upload.single('archivo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Debe adjuntarse un archivo para completar la solicitud.' });

  const { titulo, descripcion, especialidad_slug } = req.body || {};
  const discard = (status, error) => {
    fs.unlink(req.file.path, () => {});
    return res.status(status).json({ error });
  };
  if (!checkSignature(req.file.path, path.extname(req.file.originalname || ''))) {
    return discard(400, 'El contenido del archivo no corresponde al formato indicado por su extensión.');
  }
  if (!titulo || !titulo.trim()) return discard(400, 'La denominación del material constituye un campo obligatorio.');
  const tagErr = checkTag(req.user, especialidad_slug);
  if (tagErr) return discard(400, tagErr);

  const ext = path.extname(req.file.originalname || '').toLowerCase();
  const categoria = EXT_CATEGORIA[ext] || 'documento';
  const autoApprove = roles.canManageItem(req.user, { especialidad_slug }, req.user.especialidad_slug);

  const info = db
    .prepare(
      `INSERT INTO library_items (uploaded_by, titulo, descripcion, categoria, filename, original_name, size_bytes, especialidad_slug, estado, revisado_por, revisado_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${autoApprove ? "datetime('now')" : 'NULL'})`
    )
    .run(
      req.user.id, titulo.trim(), String(descripcion || '').trim(), categoria, req.file.filename, req.file.originalname, req.file.size,
      especialidad_slug, autoApprove ? 'aprobado' : 'pendiente', autoApprove ? req.user.id : null
    );

  res.status(201).json({ item: decorate(getItem(info.lastInsertRowid), req.user) });
});

function loadManageable(req, res) {
  const item = getItem(req.params.id);
  if (!item) {
    res.status(404).json({ error: 'No se ha localizado el material solicitado.' });
    return null;
  }
  if (!authorize(req, res, 'library_items', 'review', item, 'Este material no corresponde a su ámbito de administración.')) return null;
  return item;
}

router.post('/:id/approve', requireAuth, requireApprover, (req, res) => {
  const item = loadManageable(req, res);
  if (!item) return;
  db.prepare("UPDATE library_items SET estado = 'aprobado', revisado_por = ?, revisado_at = datetime('now'), motivo_rechazo = NULL WHERE id = ?").run(req.user.id, item.id);
  res.json({ item: decorate(getItem(item.id), req.user) });
});

router.post('/:id/reject', requireAuth, requireApprover, (req, res) => {
  const item = loadManageable(req, res);
  if (!item) return;
  const motivo = String(req.body?.motivo || '').trim();
  if (!motivo) return res.status(400).json({ error: 'Debe consignar el motivo del rechazo para orientar al facultativo.' });
  if (motivo.length > 500) return res.status(400).json({ error: 'El motivo no puede exceder los 500 caracteres.' });
  db.prepare("UPDATE library_items SET estado = 'rechazado', revisado_por = ?, revisado_at = datetime('now'), motivo_rechazo = ? WHERE id = ?").run(req.user.id, motivo, item.id);
  res.json({ item: decorate(getItem(item.id), req.user) });
});

// Modificación de metadatos. Los administradores con ámbito sobre el material pueden
// modificarlo siempre; quien lo propuso puede corregir su propuesta mientras no esté
// aprobada, y al hacerlo vuelve a quedar pendiente de revisión.
router.patch('/:id', requireAuth, (req, res) => {
  const item = getItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'No se ha localizado el material solicitado.' });
  if (!authorize(req, res, 'library_items', 'update', item, 'No posee prerrogativas para modificar este material.')) return;
  const manager = can(req.user, 'library_items', 'review', item);
  const ownDraft = item.uploaded_by === req.user.id && item.estado !== 'aprobado';

  const { titulo, descripcion, especialidad_slug } = req.body || {};
  if (especialidad_slug !== undefined && especialidad_slug !== item.especialidad_slug) {
    const tagErr = checkTag(req.user, especialidad_slug);
    if (tagErr) return res.status(400).json({ error: tagErr });
  }
  const resubmit = !manager && ownDraft;
  db.prepare(
    `UPDATE library_items SET titulo = ?, descripcion = ?, especialidad_slug = ?, updated_at = datetime('now')
     ${resubmit ? ", estado = 'pendiente', motivo_rechazo = NULL, revisado_por = NULL, revisado_at = NULL" : ''}
     WHERE id = ?`
  ).run(
    titulo?.trim() || item.titulo,
    descripcion !== undefined ? String(descripcion).trim() : item.descripcion,
    especialidad_slug || item.especialidad_slug,
    item.id
  );
  res.json({ item: decorate(getItem(item.id), req.user), reenviado: resubmit });
});

// Supresión: administradores con ámbito sobre el material, o quien lo propuso mientras no esté aprobado.
router.delete('/:id', requireAuth, (req, res) => {
  const item = getItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'No se ha localizado el material solicitado.' });
  if (!authorize(req, res, 'library_items', 'delete', item, 'No posee prerrogativas para suprimir este material.')) return;

  db.prepare('DELETE FROM library_items WHERE id = ?').run(item.id);
  fs.unlink(path.join(LIBRARY_DIR, path.basename(item.filename)), () => {});
  res.json({ ok: true });
});

module.exports = { router, LIBRARY_DIR, pendingCountFor };
