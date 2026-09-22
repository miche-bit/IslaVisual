'use strict';

const db = require('./db');
const { newToken } = require('./auth-utils');

const COOKIE_NAME = 'islavisual_sid';
const SESSION_DAYS = 30;

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = decodeURIComponent(part.slice(idx + 1).trim());
    out[k] = v;
  });
  return out;
}

function createSession(userId) {
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expires);
  return { token, expires };
}

function destroySession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

// Limpieza periódica de sesiones vencidas
function cleanExpiredSessions() {
  db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
}

function attachUser(req, res, next) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
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
    }
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sesión no autenticada. Se solicita iniciar sesión nuevamente.' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) return res.status(403).json({ error: 'El acceso a esta sección requiere prerrogativas administrativas.' });
  next();
}

function setSessionCookie(res, token, req) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const isHttps = req && (req.secure || req.headers['x-forwarded-proto'] === 'https');
  const secureFlag = isHttps ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureFlag}`
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

module.exports = {
  attachUser,
  requireAuth,
  requireAdmin,
  createSession,
  destroySession,
  cleanExpiredSessions,
  setSessionCookie,
  clearSessionCookie,
};
