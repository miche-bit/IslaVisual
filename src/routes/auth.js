'use strict';

const express = require('express');
const db = require('../db');
const { hashPassword, verifyPassword } = require('../auth-utils');
const { createSession, destroySession, setSessionCookie, clearSessionCookie } = require('../auth-middleware');

const router = express.Router();

function publicUser(u) {
  if (!u) return null;
  const { password_hash, salt, ...rest } = u;
  return rest;
}

router.post('/register', (req, res) => {
  try {
    const { nombre, apellidos, sexo, telefono, email, password, especialidad } = req.body || {};

    if (!nombre || !apellidos || !sexo || !telefono || !email || !password) {
      return res.status(400).json({ error: 'Existen campos de carácter obligatorio pendientes de completar.' });
    }
    if (!['M', 'F'].includes(sexo)) {
      return res.status(400).json({ error: 'El valor consignado para el campo sexo no resulta válido.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'La contraseña debe constar de un mínimo de seis caracteres.' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase().trim());
    if (existing) return res.status(409).json({ error: 'Ya existe una cuenta profesional registrada con la dirección de correo electrónico consignada.' });

    const { hash, salt } = hashPassword(password);
    const isFirstUser = db.prepare('SELECT COUNT(*) as c FROM users').get().c === 0;

    const info = db
      .prepare(
        `INSERT INTO users (nombre, apellidos, sexo, telefono, email, especialidad, password_hash, salt, is_admin)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        nombre.trim(),
        apellidos.trim(),
        sexo,
        telefono.trim(),
        String(email).toLowerCase().trim(),
        (especialidad || 'Oftalmología').trim(),
        hash,
        salt,
        isFirstUser ? 1 : 0 // el primer usuario registrado queda como admin automáticamente
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

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase().trim());
    if (!user || !verifyPassword(password, user.salt, user.password_hash)) {
      return res.status(401).json({ error: 'Las credenciales consignadas no son correctas.' });
    }

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
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  res.json({ user: publicUser(req.user) });
});

module.exports = router;
