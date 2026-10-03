'use strict';

/**
 * Roles de la plataforma:
 *  - Administrador maestro (users.is_admin = 1): todas las prerrogativas. Designa o
 *    reasigna a los administradores de especialidad, confiere el rol de maestro,
 *    suprime facultativos, gestiona respaldos y aprueba material de cualquier especialidad.
 *  - Administrador de especialidad (users.specialty_admin = 1): aprueba o rechaza el
 *    material propuesto para SU especialidad (y el material "General" propuesto por
 *    facultativos de su especialidad). Hay uno por especialidad.
 *  - Médico: consulta todo, gestiona su propia carpeta y propone material a la biblioteca.
 */

const GENERAL_SLUG = 'general';

function isMaster(u) {
  return !!(u && u.is_admin);
}

function isSpecialtyAdmin(u) {
  return !!(u && !u.is_admin && u.specialty_admin);
}

function canApprove(u) {
  return isMaster(u) || isSpecialtyAdmin(u);
}

function roleOf(u) {
  if (isMaster(u)) return 'maestro';
  if (isSpecialtyAdmin(u)) return 'especialidad';
  return 'medico';
}

/**
 * ¿Puede este usuario aprobar, rechazar, modificar o suprimir este material?
 * `uploaderSlug` es la especialidad de quien lo propuso.
 */
function canManageItem(u, item, uploaderSlug) {
  if (isMaster(u)) return true;
  if (!isSpecialtyAdmin(u)) return false;
  if (item.especialidad_slug === u.especialidad_slug) return true;
  return item.especialidad_slug === GENERAL_SLUG && uploaderSlug === u.especialidad_slug;
}

/**
 * Fragmento SQL (sobre library_items l JOIN users up ON up.id = l.uploaded_by) que
 * delimita el material que un aprobador puede revisar. Devuelve [sql, params].
 */
function reviewScopeSql(u) {
  if (isMaster(u)) return ['1 = 1', []];
  if (isSpecialtyAdmin(u)) {
    return [
      "(l.especialidad_slug = ? OR (l.especialidad_slug = 'general' AND up.especialidad_slug = ?))",
      [u.especialidad_slug, u.especialidad_slug],
    ];
  }
  return ['0 = 1', []];
}

/** Especialidades con las que un usuario puede etiquetar el material que propone. */
function allowedTagsFor(u) {
  if (isMaster(u)) return null; // cualquiera
  return [u.especialidad_slug, GENERAL_SLUG];
}

module.exports = { isMaster, isSpecialtyAdmin, canApprove, roleOf, canManageItem, reviewScopeSql, allowedTagsFor, GENERAL_SLUG };
