'use strict';

const express = require('express');
const crypto = require('node:crypto');
const db = require('../db');
const config = require('../config');
const { hashPassword, verifyPassword } = require('../auth-utils');
const { createSession, destroySession, setSessionCookie, clearSessionCookie, requireAuth } = require('../auth-middleware');
const { isValidSpecialty, nameOf } = require('../specialties');
const { toDoctorCard } = require('../util');

const router = express.Router();

function publicUser(u) {
  return u ? toDoctorCard(u) : null;
}

// --- Limitador de intentos de inicio de sesión (en memoria) ---
// Frena ataques de fuerza bruta: 10 intentos fallidos por IP+correo cada 15 minutos.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILS = 10;
const loginFails = new Map(); // clave -> { count, first }

function loginKey(req, email) {
  return `${req.ip}|${String(email || '').toLowerCase().trim()}`;
}
function isLocked(key) {
  const e = loginFails.get(key);
  if (!e) return false;
  if (Date.now() - e.first > LOGIN_WINDOW_MS) {
    loginFails.delete(key);
    return false;
  }
  return e.count >= LOGIN_MAX_FAILS;
}
function registerFail(key) {
  const e = loginFails.get(key);
  if (!e || Date.now() - e.first > LOGIN_WINDOW_MS) loginFails.set(key, { count: 1, first: Date.now() });
  else e.count += 1;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, e] of loginFails) if (now - e.first > LOGIN_WINDOW_MS) loginFails.delete(k);
}, LOGIN_WINDOW_MS).unref();

/** Comparación en tiempo constante (no revela cuántos caracteres del código coinciden). */
function sameSecret(a, b) {
  const ha = crypto.createHash('sha256').update(String(a || '')).digest();
  const hb = crypto.createHash('sha256').update(String(b || '')).digest();
  return crypto.timingSafeEqual(ha, hb);
}

router.post('/register', (req, res) => {
  try {
    const { nombre, apellidos, sexo, telefono, email, password, especialidad_slug, subespecialidad, codigo } = req.body || {};

    // Registro controlado: solo quien conoce el código del hospital puede crear una cuenta.
    if (config.registrationCode && !sameSecret(String(codigo || '').trim(), config.registrationCode)) {
      return res.status(403).json({ error: 'El código de registro del hospital no es correcto. Solicítelo a la administración.' });
    }

    if (!nombre?.trim() || !apellidos?.trim() || !sexo || !telefono?.trim() || !email?.trim() || !password || !especialidad_slug) {
      return res.status(400).json({ error: 'Existen campos de carácter obligatorio pendientes de completar.' });
    }
    if (!['M', 'F'].includes(sexo)) {
      return res.status(400).json({ error: 'El valor consignado para el campo sexo no resulta válido.' });
    }
    if (!isValidSpecialty(especialidad_slug)) {
      return res.status(400).json({ error: 'La especialidad seleccionada no pertenece al catálogo del hospital.' });
    }
    if (String(password).length < config.passwordMinLength) {
      return res.status(400).json({ error: `La contraseña debe constar de un mínimo de ${config.passwordMinLength} caracteres.` });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({ error: 'La dirección de correo electrónico consignada no resulta válida.' });
    }

    const normEmail = String(email).toLowerCase().trim();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normEmail);
    if (existing) return res.status(409).json({ error: 'Ya existe una cuenta profesional registrada con la dirección de correo electrónico consignada.' });

    const { hash, salt } = hashPassword(password);
    // Administrador maestro: si MASTER_EMAIL está definido, solo ese correo lo obtiene al
    // registrarse; si no, el primer facultativo registrado (comportamiento heredado).
    const makeMaster = config.masterEmail
      ? normEmail === config.masterEmail
      : db.prepare('SELECT COUNT(*) as c FROM users').get().c === 0;

    const info = db
      .prepare(
        `INSERT INTO users (nombre, apellidos, sexo, telefono, email, especialidad, especialidad_slug, subespecialidad, password_hash, salt, is_admin)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        nombre.trim(),
        apellidos.trim(),
        sexo,
        telefono.trim(),
        normEmail,
        nameOf(especialidad_slug),
        especialidad_slug,
        String(subespecialidad || '').trim(),
        hash,
        salt,
        makeMaster ? 1 : 0
      );

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    const { token } = createSession(user.id);
    setSessionCookie(res, token, req);

    res.status(201).json({ user: publicUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Se ha producido un error al procesar el registro del facultativo.' });
  }
});

router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'La dirección de correo electrónico y la contraseña constituyen campos obligatorios.' });

    const key = loginKey(req, email);
    if (isLocked(key)) {
      return res.status(429).json({ error: 'Se ha excedido el número de intentos permitidos. Aguarde 15 minutos antes de intentarlo nuevamente.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase().trim());
    if (!user || !verifyPassword(password, user.salt, user.password_hash)) {
      registerFail(key);
      return res.status(401).json({ error: 'Las credenciales consignadas no son correctas.' });
    }
    loginFails.delete(key);

    const { token } = createSession(user.id);
    setSessionCookie(res, token, req);
    res.json({ user: publicUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Se ha producido un error al procesar el inicio de sesión.' });
  }
});

router.post('/logout', (req, res) => {
  if (req.sessionToken) destroySession(req.sessionToken);
  clearSessionCookie(res, req);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// Cambio de contraseña: exige la contraseña vigente y cierra las demás sesiones abiertas.
router.post('/password', requireAuth, (req, res) => {
  const { actual, nueva } = req.body || {};
  if (!actual || !nueva) {
    return res.status(400).json({ error: 'Debe consignar la contraseña vigente y la nueva contraseña.' });
  }
  if (String(nueva).length < config.passwordMinLength) {
    return res.status(400).json({ error: `La nueva contraseña debe constar de un mínimo de ${config.passwordMinLength} caracteres.` });
  }
  if (!verifyPassword(actual, req.user.salt, req.user.password_hash)) {
    return res.status(401).json({ error: 'La contraseña vigente consignada no es correcta.' });
  }
  const { hash, salt } = hashPassword(nueva);
  db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, req.user.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token <> ?').run(req.user.id, req.sessionToken);
  res.json({ ok: true });
});

module.exports = router;
