'use strict';

const { nameOf } = require('./specialties');
const presence = require('./presence');
const { roleOf } = require('./roles');

/** Lee ?page= y ?limit= de forma segura. */
function pageParams(req, defaultLimit = 12, maxLimit = 50) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

function pageResult(items, total, { page, limit }) {
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

/** Patrón LIKE seguro: escapa % y _ para que se busquen literalmente. */
function likePattern(q) {
  return `%${String(q).trim().replace(/[\\%_]/g, (c) => '\\' + c)}%`;
}

function prefijo(sexo) {
  return sexo === 'F' ? 'Dra.' : 'Dr.';
}

function doctorName(u) {
  return `${prefijo(u.sexo)} ${u.nombre} ${u.apellidos}`;
}

function folderTitle(u) {
  if (u.folder_title && u.folder_title.trim()) return u.folder_title.trim();
  return doctorName(u);
}

/** Representación pública de un facultativo (nunca incluye hash ni salt). */
function toDoctorCard(u) {
  return {
    id: u.id,
    nombre: u.nombre,
    apellidos: u.apellidos,
    sexo: u.sexo,
    telefono: u.telefono,
    email: u.email,
    especialidad_slug: u.especialidad_slug,
    especialidad: nameOf(u.especialidad_slug),
    subespecialidad: u.subespecialidad || '',
    folder_title: folderTitle(u),
    custom_title: u.folder_title || '',
    sort_pref: u.sort_pref,
    is_admin: u.is_admin ? 1 : 0,
    specialty_admin: u.specialty_admin && !u.is_admin ? 1 : 0,
    rol: roleOf(u),
    online: presence.isOnline(u.id),
    created_at: u.created_at,
  };
}

module.exports = { pageParams, pageResult, likePattern, prefijo, doctorName, folderTitle, toDoctorCard };
