'use strict';

/**
 * Protecciones perimetrales del servidor.
 *
 *  1. securityHeaders — CSP estricta, HSTS, anti-clickjacking, sin rastreo de referencias.
 *  2. originGuard     — CORS con lista blanca + protección CSRF (Origin / Sec-Fetch-Site).
 *  3. rateLimit       — límite de peticiones por IP (ventana deslizante) contra saturación.
 *  4. requireJsonOrMultipart — las escrituras solo aceptan JSON o archivos (bloquea
 *                       formularios HTML falsificados en otros sitios).
 */

const config = require('./config');

// ---------------------------------------------------------------------------
// 1. Cabeceras de seguridad
// ---------------------------------------------------------------------------
const CSP = [
  "default-src 'self'",
  "script-src 'self'",                    // sin scripts en línea ni de terceros
  "style-src 'self' 'unsafe-inline'",     // atributos style= (tonos por especialidad, retardos de animación)
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'self'",                     // visor de PDF de la Biblioteca
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function securityHeaders(req, res, next) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

// ---------------------------------------------------------------------------
// 2. CORS con lista blanca + CSRF
// ---------------------------------------------------------------------------
function selfOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  return `${String(proto).split(',')[0].trim()}://${req.headers.host}`;
}

function isAllowedOrigin(req, origin) {
  return origin === selfOrigin(req) || config.allowedOrigins.has(origin);
}

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * - Mismo origen: se atiende con normalidad (es la propia aplicación).
 * - Origen en ALLOWED_ORIGINS: se responde con cabeceras CORS explícitas (nunca "*").
 * - Cualquier otro origen: 403, incluso para lecturas, de modo que otra página no puede
 *   usar la sesión de un facultativo para consultar o modificar datos.
 * - Escrituras sin cabecera Origin: se exige que el navegador no las marque como
 *   «cross-site» (Sec-Fetch-Site). Los clientes sin navegador no portan la cookie
 *   de otra persona, así que no constituyen un riesgo de CSRF.
 */
function originGuard(req, res, next) {
  const origin = req.headers.origin;
  if (origin && origin !== 'null') {
    if (!isAllowedOrigin(req, origin)) {
      return res.status(403).json({ error: 'Origen no autorizado.' });
    }
    if (origin !== selfOrigin(req)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }
  } else if (origin === 'null') {
    return res.status(403).json({ error: 'Origen no autorizado.' });
  }

  if (req.method === 'OPTIONS') {
    if (!origin) return res.status(403).end();
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
    return res.status(204).end();
  }

  if (UNSAFE.has(req.method) && !origin) {
    const site = req.headers['sec-fetch-site'];
    if (site && site !== 'same-origin' && site !== 'none') {
      return res.status(403).json({ error: 'Solicitud entre sitios rechazada.' });
    }
  }
  next();
}

// ---------------------------------------------------------------------------
// 3. Limitación de peticiones (en memoria, por proceso)
// ---------------------------------------------------------------------------
/**
 * Ventana deslizante aproximada (dos ventanas fijas ponderadas): barata en memoria y
 * sin ráfagas dobles en el borde de la ventana. Devuelve un middleware.
 */
function rateLimit({ windowMs, max, key = (req) => req.ip, message, name }) {
  const buckets = new Map(); // key -> { start, count, prev }
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) if (now - b.start > windowMs * 2) buckets.delete(k);
  }, windowMs).unref();
  void sweep;

  return function limiter(req, res, next) {
    const k = `${name}:${key(req)}`;
    const now = Date.now();
    let b = buckets.get(k);
    if (!b) { b = { start: now, count: 0, prev: 0 }; buckets.set(k, b); }
    const elapsed = now - b.start;
    if (elapsed >= windowMs) {
      b.prev = elapsed >= windowMs * 2 ? 0 : b.count;
      b.start = now - (elapsed % windowMs);
      b.count = 0;
    }
    const weight = 1 - (now - b.start) / windowMs;
    const estimated = b.prev * weight + b.count;
    if (estimated >= max) {
      const retry = Math.max(1, Math.ceil((windowMs - (now - b.start)) / 1000));
      res.setHeader('Retry-After', String(retry));
      return res.status(429).json({ error: message || 'Demasiadas solicitudes. Aguarde unos instantes e inténtelo nuevamente.' });
    }
    b.count += 1;
    next();
  };
}

const apiLimiter = rateLimit({
  name: 'api',
  windowMs: 60 * 1000,
  max: config.rateLimitPerMinute,
  message: 'Se ha excedido el número de solicitudes por minuto. Aguarde unos instantes.',
});

const registerLimiter = rateLimit({
  name: 'register',
  windowMs: 60 * 60 * 1000,
  max: config.registerLimitPerHour,
  message: 'Se han realizado demasiados registros desde esta conexión. Inténtelo nuevamente en una hora.',
});

// Subidas: por usuario autenticado (si no, por IP)
const uploadLimiter = rateLimit({
  name: 'upload',
  windowMs: 60 * 60 * 1000,
  max: config.uploadLimitPerHour,
  key: (req) => (req.user ? `u${req.user.id}` : req.ip),
  message: 'Se ha alcanzado el límite de archivos por hora. Inténtelo nuevamente más tarde.',
});

// ---------------------------------------------------------------------------
// 4. Tipos de contenido admitidos en escrituras
// ---------------------------------------------------------------------------
function requireJsonOrMultipart(req, res, next) {
  if (!UNSAFE.has(req.method)) return next();
  const len = Number(req.headers['content-length'] || 0);
  const type = String(req.headers['content-type'] || '').toLowerCase();
  if (!len && !type) return next(); // p. ej. POST /logout o /approve sin cuerpo
  if (type.startsWith('application/json') || type.startsWith('multipart/form-data')) return next();
  return res.status(415).json({ error: 'Tipo de contenido no admitido.' });
}

module.exports = {
  securityHeaders,
  originGuard,
  rateLimit,
  apiLimiter,
  registerLimiter,
  uploadLimiter,
  requireJsonOrMultipart,
  CSP,
};
