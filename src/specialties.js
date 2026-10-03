'use strict';

/**
 * Catálogo de especialidades del hospital.
 * El `slug` es el identificador estable que se guarda en la base de datos;
 * el `nombre` es lo que ve el usuario (puede ajustarse sin romper datos).
 * `general` no es una especialidad de registro: se usa solo para etiquetar
 * material de la Biblioteca Clínica aplicable a todas las especialidades.
 */
const SPECIALTIES = [
  { slug: 'alergologia', nombre: 'Alergología' },
  { slug: 'anatomia-patologica', nombre: 'Anatomía Patológica' },
  { slug: 'anestesiologia', nombre: 'Anestesiología y Reanimación' },
  { slug: 'angiologia', nombre: 'Angiología y Cirugía Vascular' },
  { slug: 'cardiologia', nombre: 'Cardiología' },
  { slug: 'cirugia-cardiovascular', nombre: 'Cirugía Cardiovascular' },
  { slug: 'cirugia-general', nombre: 'Cirugía General' },
  { slug: 'cirugia-maxilofacial', nombre: 'Cirugía Maxilofacial' },
  { slug: 'cirugia-pediatrica', nombre: 'Cirugía Pediátrica' },
  { slug: 'cirugia-plastica', nombre: 'Cirugía Plástica y Caumatología' },
  { slug: 'coloproctologia', nombre: 'Coloproctología' },
  { slug: 'dermatologia', nombre: 'Dermatología' },
  { slug: 'endocrinologia', nombre: 'Endocrinología' },
  { slug: 'estomatologia', nombre: 'Estomatología' },
  { slug: 'gastroenterologia', nombre: 'Gastroenterología' },
  { slug: 'genetica', nombre: 'Genética Clínica' },
  { slug: 'geriatria', nombre: 'Geriatría y Gerontología' },
  { slug: 'ginecologia', nombre: 'Ginecología y Obstetricia' },
  { slug: 'hematologia', nombre: 'Hematología' },
  { slug: 'imagenologia', nombre: 'Imagenología' },
  { slug: 'inmunologia', nombre: 'Inmunología' },
  { slug: 'laboratorio-clinico', nombre: 'Laboratorio Clínico' },
  { slug: 'medicina-fisica', nombre: 'Medicina Física y Rehabilitación' },
  { slug: 'medicina-general-integral', nombre: 'Medicina General Integral' },
  { slug: 'medicina-intensiva', nombre: 'Medicina Intensiva y Emergencias' },
  { slug: 'medicina-interna', nombre: 'Medicina Interna' },
  { slug: 'microbiologia', nombre: 'Microbiología' },
  { slug: 'nefrologia', nombre: 'Nefrología' },
  { slug: 'neonatologia', nombre: 'Neonatología' },
  { slug: 'neumologia', nombre: 'Neumología' },
  { slug: 'neurocirugia', nombre: 'Neurocirugía' },
  { slug: 'neurologia', nombre: 'Neurología' },
  { slug: 'nutricion', nombre: 'Nutrición Clínica' },
  { slug: 'oftalmologia', nombre: 'Oftalmología' },
  { slug: 'oncologia', nombre: 'Oncología' },
  { slug: 'ortopedia', nombre: 'Ortopedia y Traumatología' },
  { slug: 'otorrinolaringologia', nombre: 'Otorrinolaringología' },
  { slug: 'pediatria', nombre: 'Pediatría' },
  { slug: 'psiquiatria', nombre: 'Psiquiatría' },
  { slug: 'psiquiatria-infantil', nombre: 'Psiquiatría Infantil' },
  { slug: 'reumatologia', nombre: 'Reumatología' },
  { slug: 'urologia', nombre: 'Urología' },
];

const GENERAL = { slug: 'general', nombre: 'General (todas las especialidades)' };

const BY_SLUG = new Map(SPECIALTIES.map((s) => [s.slug, s]));
BY_SLUG.set(GENERAL.slug, GENERAL);

function normalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function isValidSpecialty(slug) {
  return BY_SLUG.has(slug) && slug !== GENERAL.slug;
}

function isValidLibraryTag(slug) {
  return BY_SLUG.has(slug);
}

function nameOf(slug) {
  const s = BY_SLUG.get(slug);
  return s ? s.nombre : 'Sin especialidad';
}

/** Intenta reconocer un texto libre antiguo ("oftalmologia", "Cardiología") como especialidad del catálogo. */
function matchFreeText(text) {
  const n = normalize(text);
  if (!n) return null;
  for (const s of SPECIALTIES) {
    if (normalize(s.nombre) === n || s.slug === n.replace(/\s+/g, '-')) return s.slug;
  }
  return null;
}

module.exports = { SPECIALTIES, GENERAL, isValidSpecialty, isValidLibraryTag, nameOf, matchFreeText, normalize };
