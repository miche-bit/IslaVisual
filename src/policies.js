'use strict';

/**
 * Políticas de acceso por fila — el equivalente a Row Level Security (RLS) en IslaVisual.
 *
 * SQLite no tiene RLS nativo (es una función de PostgreSQL). La misma garantía se obtiene
 * en tres capas, de modo que un descuido en una sola no expone datos:
 *
 *   1. Este módulo: UNA tabla de reglas por tabla y acción. Las rutas no deciden permisos
 *      por su cuenta; preguntan aquí (`can` / `authorize`).
 *   2. Escrituras con filtro de propiedad dentro del propio SQL (`ownedRun`): el UPDATE o
 *      DELETE lleva `AND doctor_id = <usuario>`; si la fila no es suya, cambia 0 filas y se
 *      responde 403 — aunque la ruta hubiese olvidado comprobarlo.
 *   3. Disparadores (triggers) en la base de datos (`POLICY_TRIGGERS`): impiden estados
 *      imposibles aunque el código falle (una foto o nota a nombre de otro médico, mover un
 *      expediente de carpeta, dos administradores en una especialidad, quedarse sin maestro).
 *
 * Lectura: por requisito del hospital, todo facultativo AUTENTICADO puede consultar las
 * carpetas y expedientes de todos. Lo que se restringe es la escritura (y el material de la
 * biblioteca no aprobado, que solo ven su autor y quien debe revisarlo).
 */

const roles = require('./roles');

const authenticated = (u) => !!u;
const master = (u) => roles.isMaster(u);
const titular = (u, row) => !!u && !!row && u.id === Number(row.doctor_id);

/** Reglas: tabla → acción → (usuario, fila, contexto) => boolean */
const POLICIES = {
  users: {
    select: authenticated,
    update: (u, row) => !!u && !!row && u.id === Number(row.id), // cada quien su propia carpeta
    delete: master,
    grant_master: master,
    assign_specialty_admin: master,
  },
  patients: {
    select: authenticated,
    insert: (u, row) => !!u && !!row && u.id === Number(row.doctor_id), // solo en su propia carpeta
    update: titular,
    delete: titular,
  },
  patient_notes: {
    select: authenticated,
    insert: titular, // row = paciente
    delete: titular,
  },
  photos: {
    select: authenticated,
    insert: titular, // row = paciente
    update: titular,
    delete: titular,
  },
  library_items: {
    // Publicado: todos. Pendiente o rechazado: su autor y quien tiene ámbito para revisarlo.
    select: (u, row) => !!u && !!row && (row.estado === 'aprobado' || row.uploaded_by === u.id || roles.canManageItem(u, row, row.u_slug)),
    insert: authenticated,
    review: (u, row) => roles.canManageItem(u, row, row.u_slug),
    update: (u, row) => roles.canManageItem(u, row, row.u_slug) || (row.uploaded_by === u.id && row.estado !== 'aprobado'),
    delete: (u, row) => roles.canManageItem(u, row, row.u_slug) || (row.uploaded_by === u.id && row.estado !== 'aprobado'),
  },
  backups: {
    select: master,
    create: master,
    restore: master,
  },
};

/** ¿Puede `user` realizar `action` sobre `row` de `table`? Por defecto, NO (denegación implícita). */
function can(user, table, action, row = null) {
  const rule = POLICIES[table] && POLICIES[table][action];
  if (typeof rule !== 'function') return false;
  try { return !!rule(user, row); } catch (_) { return false; }
}

const MESSAGES = {
  patients: 'La presente acción constituye prerrogativa exclusiva del médico titular de esta carpeta clínica.',
  patient_notes: 'La presente acción constituye prerrogativa exclusiva del médico titular de esta carpeta clínica.',
  photos: 'La incorporación y supresión de registros fotográficos constituye prerrogativa exclusiva del médico titular de esta carpeta clínica.',
  users: 'La modificación de la presente carpeta clínica constituye prerrogativa exclusiva de su médico titular.',
  library_items: 'No posee prerrogativas sobre este material.',
  backups: 'Esta acción requiere prerrogativas de administrador maestro.',
};

/** Igual que `can`, pero responde 403 y devuelve false si no está permitido. */
function authorize(req, res, table, action, row, message) {
  if (can(req.user, table, action, row)) return true;
  res.status(403).json({ error: message || MESSAGES[table] || 'Acceso denegado.' });
  return false;
}

/**
 * Ejecuta una escritura cuyo WHERE ya incluye el filtro de propiedad (`... AND doctor_id = ?`).
 * Si no afectó ninguna fila, la fila no era del usuario: responde 403 y devuelve false.
 */
function ownedRun(res, stmt, params, table) {
  const r = stmt.run(...params);
  if (r.changes > 0) return true;
  res.status(403).json({ error: MESSAGES[table] || 'Acceso denegado.' });
  return false;
}

/**
 * Disparadores de integridad (capa 3). Se crean en cada arranque (idempotentes) y se
 * retiran temporalmente durante una restauración de respaldo, que reemplaza tablas enteras.
 */
const POLICY_TRIGGERS = {
  // Una fotografía solo puede registrarla el titular del paciente.
  trg_photos_titular_ins: `
    CREATE TRIGGER IF NOT EXISTS trg_photos_titular_ins BEFORE INSERT ON photos
    WHEN NEW.doctor_id IS NOT (SELECT doctor_id FROM patients WHERE id = NEW.patient_id)
    BEGIN SELECT RAISE(ABORT, 'politica: la fotografia debe pertenecer al titular del paciente'); END;`,
  trg_photos_titular_upd: `
    CREATE TRIGGER IF NOT EXISTS trg_photos_titular_upd BEFORE UPDATE OF doctor_id, patient_id ON photos
    WHEN NEW.doctor_id IS NOT (SELECT doctor_id FROM patients WHERE id = NEW.patient_id)
    BEGIN SELECT RAISE(ABORT, 'politica: la fotografia debe pertenecer al titular del paciente'); END;`,
  // Una nota de evolución solo puede consignarla el titular del paciente.
  trg_notes_titular_ins: `
    CREATE TRIGGER IF NOT EXISTS trg_notes_titular_ins BEFORE INSERT ON patient_notes
    WHEN NEW.doctor_id IS NOT (SELECT doctor_id FROM patients WHERE id = NEW.patient_id)
    BEGIN SELECT RAISE(ABORT, 'politica: la nota debe pertenecer al titular del paciente'); END;`,
  // Un expediente no puede cambiar de carpeta (de médico titular).
  trg_patients_titular_fijo: `
    CREATE TRIGGER IF NOT EXISTS trg_patients_titular_fijo BEFORE UPDATE OF doctor_id ON patients
    WHEN NEW.doctor_id IS NOT OLD.doctor_id
    BEGIN SELECT RAISE(ABORT, 'politica: un expediente no puede cambiar de medico titular'); END;`,
  // Un solo administrador por especialidad.
  trg_un_admin_por_especialidad: `
    CREATE TRIGGER IF NOT EXISTS trg_un_admin_por_especialidad BEFORE UPDATE ON users
    WHEN NEW.specialty_admin = 1 AND EXISTS (
      SELECT 1 FROM users WHERE especialidad_slug = NEW.especialidad_slug AND specialty_admin = 1 AND id <> NEW.id)
    BEGIN SELECT RAISE(ABORT, 'politica: la especialidad ya tiene administrador'); END;`,
  // La plataforma nunca se queda sin administrador maestro.
  trg_ultimo_maestro_del: `
    CREATE TRIGGER IF NOT EXISTS trg_ultimo_maestro_del BEFORE DELETE ON users
    WHEN OLD.is_admin = 1 AND (SELECT COUNT(*) FROM users WHERE is_admin = 1) <= 1
    BEGIN SELECT RAISE(ABORT, 'politica: debe conservarse al menos un administrador maestro'); END;`,
  trg_ultimo_maestro_upd: `
    CREATE TRIGGER IF NOT EXISTS trg_ultimo_maestro_upd BEFORE UPDATE OF is_admin ON users
    WHEN OLD.is_admin = 1 AND NEW.is_admin = 0 AND (SELECT COUNT(*) FROM users WHERE is_admin = 1) <= 1
    BEGIN SELECT RAISE(ABORT, 'politica: debe conservarse al menos un administrador maestro'); END;`,
};

function createPolicyTriggers(db) {
  for (const sql of Object.values(POLICY_TRIGGERS)) db.exec(sql);
}

function dropPolicyTriggers(db) {
  for (const name of Object.keys(POLICY_TRIGGERS)) db.exec(`DROP TRIGGER IF EXISTS ${name}`);
}

module.exports = { POLICIES, can, authorize, ownedRun, createPolicyTriggers, dropPolicyTriggers, POLICY_TRIGGERS };
