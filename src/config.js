'use strict';

/**
 * Configuración centralizada a partir de variables de entorno.
 *
 * - Todo el servidor lee su configuración de aquí; ningún otro archivo toca process.env.
 * - Cada valor se valida al arrancar. Un valor mal escrito NO tumba la aplicación:
 *   se registra el error en los logs y se usa el valor seguro por defecto.
 * - Los secretos (REGISTRATION_CODE) nunca se imprimen en los logs.
 *
 * Referencia completa: .env.example
 */

const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const env = process.env;
const problems = [];
const warnings = [];

function str(name, def = '') {
  const v = env[name];
  return v === undefined || v === '' ? def : String(v).trim();
}

function int(name, def, min, max) {
  const raw = env[name];
  if (raw === undefined || raw === '') return def;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    problems.push(`${name}="${raw}" no es un entero entre ${min} y ${max}; se usa ${def}.`);
    return def;
  }
  return n;
}

function originOf(value, name) {
  try {
    const u = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return u.origin;
  } catch (_) {
    problems.push(`${name}: «${value}» no es una URL válida; se ignora.`);
    return null;
  }
}

const NODE_ENV = str('NODE_ENV', env.RAILWAY_ENVIRONMENT ? 'production' : 'development');
const isProduction = NODE_ENV === 'production';

// --- Orígenes permitidos (CORS) ---
// Siempre se admite el propio dominio público de la app. ALLOWED_ORIGINS añade otros
// (separados por comas) solo si alguna vez otro sitio necesita consumir la API.
const allowedOrigins = new Set();
const appUrl = str('APP_URL');
if (appUrl) { const o = originOf(appUrl, 'APP_URL'); if (o) allowedOrigins.add(o); }
if (env.RAILWAY_PUBLIC_DOMAIN) allowedOrigins.add(`https://${env.RAILWAY_PUBLIC_DOMAIN}`);
for (const part of str('ALLOWED_ORIGINS').split(',').map((s) => s.trim()).filter(Boolean)) {
  if (part === '*') { problems.push('ALLOWED_ORIGINS="*" no está permitido con sesiones autenticadas; se ignora.'); continue; }
  const o = originOf(part, 'ALLOWED_ORIGINS');
  if (o) allowedOrigins.add(o);
}

// --- Registro controlado ---
const registrationCode = str('REGISTRATION_CODE');
if (registrationCode && registrationCode.length < 8) {
  warnings.push('REGISTRATION_CODE tiene menos de 8 caracteres: use un código más largo y difícil de adivinar.');
}
if (!registrationCode && isProduction) {
  warnings.push('REGISTRATION_CODE no está definido: CUALQUIER persona con el enlace puede registrarse y consultar los expedientes. Defínalo en Railway › Variables.');
}
const masterEmail = str('MASTER_EMAIL').toLowerCase();
if (masterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(masterEmail)) {
  problems.push(`MASTER_EMAIL «${masterEmail}» no es un correo válido; se ignora.`);
}

const config = ({
  NODE_ENV,
  isProduction,
  port: int('PORT', 3000, 1, 65535),
  buildId: (str('RAILWAY_DEPLOYMENT_ID') || str('RAILWAY_GIT_COMMIT_SHA') || String(Date.now())).slice(0, 12),
  trustProxy: int('TRUST_PROXY', 1, 0, 10),

  // Almacenamiento (en Railway deben apuntar al volumen persistente)
  dataDir: str('DATA_DIR', path.join(ROOT, 'data')),
  photosDir: str('UPLOADS_DIR', path.join(ROOT, 'uploads', 'photos')),
  libraryDir: str('LIBRARY_DIR', ''), // vacío = hermana de UPLOADS_DIR
  backupDir: str('BACKUP_DIR', path.join(ROOT, 'backups')),

  // Seguridad de acceso
  allowedOrigins,
  registrationCode,                 // secreto: nunca se envía al navegador ni a los logs
  masterEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(masterEmail) ? masterEmail : '',
  sessionDays: int('SESSION_DAYS', 14, 1, 90),
  idleMinutes: int('IDLE_MINUTES', 20, 2, 240),
  passwordMinLength: int('PASSWORD_MIN_LENGTH', 8, 6, 64),

  // Protección contra saturación (por dirección IP, ventanas deslizantes en memoria)
  rateLimitPerMinute: int('RATE_LIMIT_PER_MINUTE', 300, 30, 10000),
  registerLimitPerHour: int('REGISTER_LIMIT_PER_HOUR', 5, 1, 1000),
  uploadLimitPerHour: int('UPLOAD_LIMIT_PER_HOUR', 60, 1, 10000),

  // Copias de seguridad
  backupIntervalHours: int('BACKUP_INTERVAL_HOURS', 6, 1, 168),
});

/** Resumen seguro para los logs de arranque (sin secretos). */
function describe() {
  return [
    `entorno=${config.NODE_ENV}`,
    `orígenes=${[...config.allowedOrigins].join(' ') || '(solo el propio dominio)'}`,
    `registro=${config.registrationCode ? 'con código' : 'ABIERTO'}`,
    `maestro=${config.masterEmail ? 'por MASTER_EMAIL' : 'primer registro'}`,
    `sesión=${config.sessionDays} d`,
    `límite=${config.rateLimitPerMinute}/min`,
  ].join(' · ');
}

module.exports = Object.freeze({ ...config, describe, problems, warnings });
