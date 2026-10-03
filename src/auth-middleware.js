'use strict';

const db = require('./db');
const { newToken } = require('./auth-utils');
const presence = require('./presence');

const config = require('./config');

// En HTTPS la cookie usa el prefijo __Host-: el navegador solo la acepta con Secure, sin
// dominio y en la ruta raíz, de modo que ningún subdominio puede sobrescribirla.
const COOKIE_NAME = 'islavisual_sid';
const COOKIE_NAME_SECURE = '__Host-islavisual_sid';
const SESSION_DAYS = config.sessionDays;

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    let v = part.slice(idx + 1).trim();
    // Una cookie malformada (p. ej. de otra app en el mismo dominio) no debe tumbar la petición.
    try { v = decodeURIComponent(v); } catch (_) { /* se usa el valor crudo */ }
    out[k] = v;
  });
  return out;
}

/** Formato de fecha de SQLite ('YYYY-MM-DD HH:MM:SS', UTC) para compararlo con datetime('now'). */
function sqliteDate(ms) {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

function createSession(userId) {
  const token = newToken();
  const expires = sqliteDate(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expires);
  presence.touch(userId);
  return { token, expires };
}

function destroySession(token) {
  const row = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token);
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  if (row) presence.remove(row.user_id);
}

// Limpieza periódica de sesiones vencidas
function cleanExpiredSessions() {
  db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
}

function attachUser(req, res, next) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME_SECURE] || cookies[COOKIE_NAME];
  req.user = null;
  if (token) {
    const row = db
      .prepare(
        `SELECT u.* FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND s.expires_at > datetime('now')`
      )
      .get(token);
    if (row) {
      req.user = row;
      req.sessionToken = token;
      presence.touch(row.id);
    }
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sesión no autenticada. Se solicita iniciar sesión nuevamente.' });
  next();
}

/** Solo el administrador maestro. */
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) return res.status(403).json({ error: 'Esta acción requiere prerrogativas de administrador maestro.' });
  next();
}

/** Administrador maestro o administrador de especialidad. */
function requireApprover(req, res, next) {
  if (!req.user || !(req.user.is_admin || req.user.specialty_admin)) {
    return res.status(403).json({ error: 'Esta acción requiere prerrogativas de administración.' });
  }
  next();
}

function isHttps(req) {
  return !!(req && (req.secure || req.headers['x-forwarded-proto'] === 'https'));
}

// SameSite=Strict: el navegador nunca envía la sesión en peticiones iniciadas desde otro sitio.
function setSessionCookie(res, token, req) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const name = isHttps(req) ? COOKIE_NAME_SECURE : COOKIE_NAME;
  res.setHeader('Set-Cookie', [
    `${name}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${isHttps(req) ? '; Secure' : ''}`,
  ]);
}

function clearSessionCookie(res, req) {
  const out = [`${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`];
  if (isHttps(req)) out.push(`${COOKIE_NAME_SECURE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Secure`);
  res.setHeader('Set-Cookie', out);
}

module.exports = {
  attachUser,
  requireAuth,
  requireAdmin,
  requireApprover,
  createSession,
  destroySession,
  cleanExpiredSessions,
  setSessionCookie,
  clearSessionCookie,
};
