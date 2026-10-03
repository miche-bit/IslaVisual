'use strict';

/**
 * Registro de presencia en memoria: quién ha usado la plataforma recientemente.
 *
 * Se mantiene en memoria (no en la base de datos) para no generar una escritura
 * por cada petición con cientos de facultativos conectados. El cliente envía un
 * latido cada ~30 s mientras la pestaña está visible; un facultativo se considera
 * "en línea" si hubo actividad en los últimos ONLINE_WINDOW_MS.
 * Al reiniciar el servidor el registro empieza vacío y se repuebla en segundos.
 */

const ONLINE_WINDOW_MS = 90 * 1000;

const lastSeen = new Map(); // userId -> timestamp (ms)

function touch(userId) {
  lastSeen.set(userId, Date.now());
}

function remove(userId) {
  lastSeen.delete(userId);
}

function onlineIds() {
  const cutoff = Date.now() - ONLINE_WINDOW_MS;
  const ids = [];
  for (const [id, ts] of lastSeen) {
    if (ts >= cutoff) ids.push(id);
    else lastSeen.delete(id); // limpieza perezosa
  }
  return ids;
}

function isOnline(userId) {
  const ts = lastSeen.get(userId);
  return ts !== undefined && ts >= Date.now() - ONLINE_WINDOW_MS;
}

module.exports = { touch, remove, onlineIds, isOnline };
