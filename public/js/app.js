'use strict';

/* ==========================================================================
   IslaVisual — SPA vanilla JS (v3: hospital multiespecialidad)
   ========================================================================== */

const state = {
  user: null,
  catalog: null, // { specialties: [{slug,nombre}], general: {slug,nombre} }
  presence: { count: 0, list: [] },
  pending: 0, // propuestas de material que esperan la revisión de este usuario (aprobadores)
  sortView: {}, // { [doctorId]: 'alpha'|'fecha' } preferencia LOCAL de quien consulta
};

const APP = document.getElementById('app');

/* ---------------------------- Íconos ---------------------------- */

const I = {
  search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7.5"/><path d="M20.5 20.5l-4.2-4.2"/></svg>',
  phone: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.7a2 2 0 01-.5 2.1L8 9.8a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.7.7a2 2 0 011.7 2z"/></svg>',
  home: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/></svg>',
  book: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5v14z"/><path d="M4 19.5A2.5 2.5 0 006.5 22H20v-5"/></svg>',
  folder: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
  shield: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  key: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L21 2M16 7l3 3M19 4l2 2"/></svg>',
  logout: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>',
  download: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
  image: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
  video: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="15" height="14" rx="2"/><path d="M17 10l5-3v10l-5-3"/></svg>',
  doc: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></svg>',
  patient: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
  edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
  plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  more: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  filter: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
  print: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
  keyboard: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M9 15h6"/></svg>',
  eye: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10.1 10.1 0 0112 20c-7 0-11-8-11-8a18.5 18.5 0 015.1-5.9M9.9 4.2A9.1 9.1 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.2 3.2M1 1l22 22"/><path d="M14.1 14.1a3 3 0 11-4.2-4.2"/></svg>',
  x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  access: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4.5" r="2"/><path d="M4 8.5l8 1.5 8-1.5M12 10v5M9 22l3-7 3 7"/></svg>',
  users: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6.5 7-6.5s7 2.5 7 6.5M16 3.5a4 4 0 010 9M22 21c0-3-1.7-5.2-4.5-6"/></svg>',
};

/* ---------------------------- Preferencias de accesibilidad ----------------------------
   Por visor (este navegador): tamaño de texto y reducción de animaciones. Si el
   almacenamiento local no está disponible, la aplicación funciona igual con los valores
   predeterminados. */

const prefs = { text: 'normal', motion: 'auto' };

function applyPrefs() {
  document.documentElement.dataset.text = prefs.text;
  document.documentElement.dataset.motion = prefs.motion;
}
function loadPrefs() {
  try { Object.assign(prefs, JSON.parse(localStorage.getItem('iv-prefs') || '{}')); } catch (_) { /* sin almacenamiento */ }
  applyPrefs();
}
function savePrefs() {
  try { localStorage.setItem('iv-prefs', JSON.stringify(prefs)); } catch (_) { /* sin almacenamiento */ }
  applyPrefs();
}
loadPrefs();

/* ---------------------------- Roles ---------------------------- */

const isMaster = (u) => !!(u && u.is_admin);
const isSpecialtyAdmin = (u) => !!(u && !u.is_admin && u.specialty_admin);
const canApprove = (u) => isMaster(u) || isSpecialtyAdmin(u);

function roleLabel(u) {
  if (isMaster(u)) return 'Administrador maestro';
  if (isSpecialtyAdmin(u)) return `Administrador de ${u.especialidad}`;
  return 'Facultativo';
}

/* ---------------------------- API helper ---------------------------- */

async function api(method, url, body, isForm = false) {
  const opts = { method, headers: {}, credentials: 'same-origin' };
  if (body !== undefined) {
    if (isForm) {
      opts.body = body;
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }
  // La barra de actividad superior refleja las peticiones en curso (salvo el latido de presencia).
  const tracked = !url.startsWith('/api/presence');
  if (tracked) netStart();
  let res;
  try {
    res = await fetch(url, opts);
  } catch (_) {
    if (tracked) netEnd();
    throw new Error('No fue posible establecer conexión con el servidor. Verifique su conexión a Internet.');
  }
  let data = null;
  try { data = await res.json(); } catch (_) { data = null; }
  if (tracked) netEnd();
  if (!res.ok) {
    // Sesión vencida durante el uso: se redirige al acceso sin dejar la interfaz en un estado roto.
    if (res.status === 401 && !url.startsWith('/api/auth/') && state.user) {
      state.user = null;
      stopHeartbeat();
      location.hash = '#/login';
    }
    const msg = (data && data.error) || `Error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

let netActive = 0;
function netStart() {
  if (++netActive === 1) document.documentElement.classList.add('is-loading');
}
function netEnd() {
  netActive = Math.max(0, netActive - 1);
  if (!netActive) document.documentElement.classList.remove('is-loading');
}

/* ---------------------------- Toasts ---------------------------- */

// El aviso permanece mientras el puntero o el foco estén sobre él (WCAG 2.2.1).
function toast(message, type = 'success') {
  const wrap = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'error'
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>';
  const ms = type === 'error' ? 6000 : 3800;
  el.style.setProperty('--toast-ms', `${ms}ms`);
  el.innerHTML = `<span class="toast-icon" aria-hidden="true">${icon}</span><span class="toast-msg">${escapeHtml(message)}</span><span class="toast-timer" aria-hidden="true"></span>`;
  wrap.appendChild(el);
  let left = ms;
  let started = Date.now();
  let timer = setTimeout(dismiss, left);
  function dismiss() {
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), 320);
  }
  const pause = () => { clearTimeout(timer); left -= Date.now() - started; el.classList.add('paused'); };
  const resume = () => { started = Date.now(); el.classList.remove('paused'); timer = setTimeout(dismiss, Math.max(800, left)); };
  el.addEventListener('mouseenter', pause);
  el.addEventListener('mouseleave', resume);
}

/* ---------------------------- Utilidades ---------------------------- */

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function initials(nombre, apellidos) {
  return `${(nombre || '?')[0] || ''}${(apellidos || '?')[0] || ''}`.toUpperCase();
}

function normalize(text) {
  return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Fechas:
 * - 'YYYY-MM-DD' (fecha de captura de una foto) es una fecha de CALENDARIO: se construye
 *   como fecha local para que no se corra un día en zonas detrás de UTC (Cuba, UTC-4/-5).
 * - 'YYYY-MM-DD HH:MM:SS' (created_at de SQLite) es un INSTANTE en UTC: se convierte a la
 *   hora local, así un registro hecho a las 11 p. m. en Cuba no aparece con la fecha de mañana.
 */
function parseDbDate(raw) {
  if (!raw) return null;
  const s = String(raw);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(s.replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? '' : 'Z'));
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(raw) {
  const d = parseDbDate(raw);
  if (!d) return raw ? String(raw) : '—';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(raw) {
  const d = parseDbDate(raw);
  if (!d) return raw ? String(raw) : '—';
  return d.toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function relTime(raw) {
  const d = parseDbDate(raw);
  if (!d) return '';
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'hace un momento';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.round(h / 24);
  if (days < 7) return `hace ${days} d`;
  return fmtDate(raw);
}

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtBytes(bytes) {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`;
}

function staggerStyle(index) {
  return `animation-delay:${Math.min(index, 10) * 40}ms`;
}

function prefersReducedMotion() {
  if (prefs.motion === 'reduce') return true;
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/** Título del documento por vista (WCAG 2.4.2) y aviso a lectores de pantalla del cambio de vista. */
let hasNavigated = false;
function viewReady(title) {
  document.title = `${title} · IslaVisual`;
  const live = document.getElementById('route-announcer');
  if (live) live.textContent = title;
  // Tras una navegación del usuario, el foco pasa al encabezado principal de la nueva vista.
  if (hasNavigated) {
    const h1 = document.querySelector('#view-root h1, .auth-card h1');
    if (h1 && !document.querySelector('.layer')) {
      h1.tabIndex = -1;
      h1.focus({ preventScroll: true });
    }
  }
  hasNavigated = true;
}

function doctorPrefix(sexo) {
  return sexo === 'F' ? 'Dra.' : 'Dr.';
}

/** Resalta (de forma segura) las coincidencias de la búsqueda dentro de un texto. */
function hl(text, q) {
  const safe = escapeHtml(text);
  const needle = String(q || '').trim();
  if (needle.length < 2) return safe;
  const re = new RegExp(`(${escapeHtml(needle).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
  return safe.replace(re, '<mark>$1</mark>');
}

/* ---------------------------- Especialidades ---------------------------- */

function specialtyName(slug) {
  if (!state.catalog) return slug || '';
  if (slug === state.catalog.general.slug) return state.catalog.general.nombre;
  const s = state.catalog.specialties.find((x) => x.slug === slug);
  return s ? s.nombre : 'Sin especialidad';
}

/** Tono estable por especialidad (para su monograma), derivado del slug. */
function specialtyHue(slug) {
  let h = 0;
  for (const ch of String(slug)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 360;
}

function specialtyMonogram(nombre) {
  const words = String(nombre).split(/\s+/).filter((w) => w.length > 2 && !['del', 'las', 'los'].includes(w.toLowerCase()));
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  const w = words[0] || nombre;
  return (w[0] + (w[1] || '')).toUpperCase();
}

function specialtyOptions(selected, { includeGeneral = false, placeholder = 'Seleccione la especialidad', only = null } = {}) {
  const opts = [`<option value="">${escapeHtml(placeholder)}</option>`];
  if (includeGeneral) {
    const g = state.catalog.general;
    opts.push(`<option value="${g.slug}" ${selected === g.slug ? 'selected' : ''}>${escapeHtml(g.nombre)}</option>`);
  }
  for (const s of state.catalog.specialties) {
    if (only && !only.includes(s.slug)) continue;
    opts.push(`<option value="${s.slug}" ${selected === s.slug ? 'selected' : ''}>${escapeHtml(s.nombre)}</option>`);
  }
  return opts.join('');
}

async function loadCatalog() {
  try {
    const d = await api('GET', '/api/catalog');
    state.catalog = { specialties: d.specialties, general: d.general, politicas: d.politicas || {} };
  } catch (_) {
    state.catalog = { specialties: [], general: { slug: 'general', nombre: 'General' }, politicas: {} };
  }
}

/* ---------------------------- Transiciones entre vistas ----------------------------
   1. Crossfade: la vista anterior se desvanece mientras aparece la nueva (API View
      Transitions del navegador; sin ella, la vista nueva entra con su fundido habitual).
   2. Elemento compartido: al abrir una tarjeta, su título (y su avatar o monograma) viaja
      hasta el encabezado de la página de destino, de modo que el ojo no pierde la referencia.
      Para que el destino exista de inmediato, la vista pinta su encabezado real con los
      datos que ya conoce la tarjeta, mientras el resto carga como esqueleto.
   El iris (firma visual) queda para entrar y salir de la aplicación (acceso ↔ interior). */

// Datos de la tarjeta pulsada: { href, title, figure, titleEl, figEl }
let sharedHint = null;

document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a[data-shared]');
  if (!a || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const titleEl = a.querySelector('[data-shared-title]');
  const figEl = a.querySelector('[data-shared-figure]');
  sharedHint = {
    href: a.getAttribute('href'),
    title: titleEl ? titleEl.textContent.trim() : '',
    figure: figEl ? figEl.textContent.trim() : '',
    titleEl,
    figEl,
  };
}, true);

/** La vista de destino recoge (una sola vez) los datos de la tarjeta que la abrió. */
function takeSharedHint() {
  const h = sharedHint && sharedHint.href === location.hash ? sharedHint : null;
  sharedHint = null;
  return h;
}

function irisTransition(renderFn) {
  const veil = document.createElement('div');
  veil.className = 'iris-veil closing';
  document.body.appendChild(veil);
  // El velo se abre en cuanto la vista pinta su esqueleto (parte síncrona de renderFn),
  // sin esperar a la red: en conexiones lentas el usuario ve la estructura de inmediato.
  setTimeout(() => {
    try { renderFn(); } finally {
      veil.classList.remove('closing');
      veil.classList.add('opening');
      setTimeout(() => veil.remove(), 500);
    }
  }, 380);
}

function withIrisTransition(renderFn, { auth = false } = {}) {
  if (prefersReducedMotion() || !hasNavigated) return renderFn();
  // Cruzar el límite acceso ↔ aplicación conserva la transición de iris.
  const wasAuth = !!document.querySelector('.auth-shell');
  if (wasAuth !== auth || !document.startViewTransition) {
    if (wasAuth !== auth) return irisTransition(renderFn);
    return renderFn(); // navegador sin View Transitions: fundido de entrada de la vista
  }
  const root = document.documentElement;
  const hint = sharedHint && sharedHint.href === location.hash ? sharedHint : null;
  const named = [];
  if (hint) {
    // El nombre de transición pasa del encabezado de la página actual a la tarjeta pulsada.
    root.classList.add('vt-from-card');
    for (const [el, name] of [[hint.titleEl, 'vt-title'], [hint.figEl, 'vt-figure']]) {
      if (el && document.body.contains(el)) { el.style.viewTransitionName = name; named.push(el); }
    }
  }
  root.classList.add('vt-running');
  let t;
  try {
    t = document.startViewTransition(() => {
      root.classList.remove('vt-from-card');
      renderFn(); // la parte síncrona pinta el esqueleto y el encabezado; la red sigue después
    });
  } catch (_) {
    root.classList.remove('vt-from-card', 'vt-running');
    return renderFn();
  }
  const done = () => {
    root.classList.remove('vt-from-card', 'vt-running');
    named.forEach((el) => { el.style.viewTransitionName = ''; });
  };
  t.finished.then(done, done);
  t.ready.catch(() => {}); // una transición omitida (pestaña oculta, navegación rápida) no es un error
}

/** Azúcar para `crossfade`: `fade(el).html = '…'` sustituye a `el.innerHTML = '…'`. */
function fade(el) {
  return { set html(v) { crossfade(el, v); } };
}

/**
 * Crossfade de contenido dentro de una vista (recarga de listas, filtros, paginación):
 * el contenido anterior se desvanece superpuesto mientras entra el nuevo, sin salto.
 */
function crossfade(el, html) {
  if (prefersReducedMotion() || !el.firstElementChild || el.offsetParent === null) {
    el.innerHTML = html;
    return;
  }
  const prev = el.querySelector(':scope > .xfade-ghost');
  if (prev) prev.remove();
  const height = el.offsetHeight;
  const ghost = document.createElement(/^(UL|OL)$/.test(el.tagName) ? 'li' : 'div');
  ghost.className = 'xfade-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  while (el.firstChild) ghost.appendChild(el.firstChild);
  // Los identificadores del contenido saliente no deben colisionar con los del entrante.
  ghost.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  el.innerHTML = html;
  el.classList.add('xfade-host');
  el.style.minHeight = `${height}px`;
  el.appendChild(ghost);
  setTimeout(() => {
    ghost.remove();
    if (!el.querySelector(':scope > .xfade-ghost')) { el.classList.remove('xfade-host'); el.style.minHeight = ''; }
  }, 240);
}

/* ---------------------------- Magnificación por proximidad ----------------------------
   3. Como una lupa que viaja con el cursor: dentro de un contenedor [data-magnify], cada
      elemento [data-mag] crece según lo cerca que esté el puntero (efecto «dock»). En la
      navegación inferior responde al dedo mientras se desliza sobre la barra. */

const magnify = { container: null, x: 0, y: 0, raf: 0 };

function applyMagnify() {
  magnify.raf = 0;
  const c = magnify.container;
  if (!c || !document.body.contains(c)) return;
  const max = Number(c.dataset.magnify) || 1.3;
  const radius = Number(c.dataset.magRadius) || 130;
  const axisX = c.dataset.magAxis === 'x';
  c.querySelectorAll('[data-mag]').forEach((el) => {
    const r = el.getBoundingClientRect();
    const dx = magnify.x - (r.left + r.width / 2);
    const dy = axisX ? 0 : magnify.y - (r.top + r.height / 2);
    const f = Math.max(0, 1 - Math.hypot(dx, dy) / radius);
    const eased = f * f * (3 - 2 * f); // suavizado: sin saltos al entrar ni al salir del radio
    el.style.setProperty('--mag', (1 + (max - 1) * eased).toFixed(3));
  });
}

function resetMagnify() {
  const c = magnify.container;
  magnify.container = null;
  if (c) c.querySelectorAll('[data-mag]').forEach((el) => el.style.removeProperty('--mag'));
}

document.addEventListener('pointermove', (e) => {
  if (prefersReducedMotion()) return;
  const c = e.target.closest ? e.target.closest('[data-magnify]') : null;
  if (c !== magnify.container) resetMagnify();
  if (!c) return;
  magnify.container = c;
  magnify.x = e.clientX;
  magnify.y = e.clientY;
  if (!magnify.raf) magnify.raf = requestAnimationFrame(applyMagnify);
}, { passive: true });
['pointerup', 'pointercancel'].forEach((ev) => document.addEventListener(ev, (e) => { if (e.pointerType !== 'mouse') resetMagnify(); }, { passive: true }));
document.documentElement.addEventListener('pointerleave', resetMagnify);

/* ---------------------------- Enrutador ---------------------------- */

// Cada navegación recibe un número; si el usuario navega de nuevo antes de que una
// vista termine de cargar, la respuesta antigua se descarta en vez de sobrescribir la nueva.
let navSeq = 0;
const isStale = (nav) => nav !== navSeq;

function parseHash() {
  const hash = location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean).map((p) => decodeURIComponent(p));
  return { name: parts[0] || (state.user ? 'inicio' : 'login'), params: parts.slice(1) };
}

async function router() {
  const nav = ++navSeq;
  closePopovers();
  const { name, params } = parseHash();

  if (!state.catalog) await loadCatalog();
  if (!state.user) {
    try {
      const data = await api('GET', '/api/auth/me');
      state.user = data.user;
    } catch (_) { state.user = null; }
  }
  if (isStale(nav)) return;

  const publicRoutes = ['login', 'register'];
  if (!state.user && !publicRoutes.includes(name)) {
    location.hash = '#/login';
    return;
  }
  if (state.user && publicRoutes.includes(name)) {
    location.hash = '#/inicio';
    return;
  }
  if (state.user) startHeartbeat();

  switch (name) {
    case 'login': return renderAuth('login');
    case 'register': return renderAuth('register');
    case 'inicio':
    case 'dashboard': return renderHome(nav);
    case 'especialidad': return renderSpecialty(nav, params[0], params[1]);
    case 'doctor': return renderDoctorFolder(nav, params[0]);
    case 'patient': return renderPatient(nav, params[0]);
    case 'biblioteca': return renderLibrary(nav);
    case 'admin': return renderAdmin(nav);
    default: location.hash = '#/inicio';
  }
}

/** Vuelve a dibujar la vista actual (tras crear, modificar o suprimir algo). */
function refreshView() {
  router();
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);

/* ---------------------------- Presencia (en línea) ---------------------------- */

let heartbeatTimer = null;

function startHeartbeat() {
  resetIdle();
  if (heartbeatTimer) return;
  resetIdle(true);
  pollPresence();
  heartbeatTimer = setInterval(() => {
    if (document.visibilityState === 'visible') pollPresence();
  }, 30000);
}

function stopHeartbeat() {
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.user) pollPresence();
});

async function pollPresence() {
  try {
    const d = await api('GET', '/api/presence');
    const changed = d.online_count !== state.presence.count;
    state.presence = { count: d.online_count, list: d.online };
    const pendingChanged = d.pending_count !== state.pending;
    state.pending = d.pending_count || 0;
    updatePresenceUI(changed, pendingChanged);
    // Si el administrador maestro cambió el rol o la especialidad de este facultativo
    // mientras estaba conectado, la interfaz se actualiza sin tener que recargar.
    if (state.user && (d.mi_rol !== state.user.rol || d.mi_especialidad !== state.user.especialidad_slug)) {
      const me = await api('GET', '/api/auth/me');
      if (me.user) {
        state.user = me.user;
        toast(`Sus prerrogativas se han actualizado: ${roleLabel(me.user)}.`);
        refreshView();
      }
    }
  } catch (_) { /* silencioso: se reintenta en el próximo latido */ }
}

function updatePresenceUI(animate, pendingChanged) {
  const pill = document.getElementById('online-pill');
  if (pill) pill.setAttribute('aria-label', `Facultativos en línea: ${state.presence.count}`);
  document.querySelectorAll('[data-online-count]').forEach((el) => {
    el.textContent = state.presence.count;
    if (animate) {
      el.classList.remove('bump');
      void el.offsetWidth; // reinicia la animación
      el.classList.add('bump');
    }
  });
  document.querySelectorAll('[data-pending-count]').forEach((el) => {
    el.textContent = state.pending > 99 ? '99+' : state.pending;
    el.hidden = !state.pending;
    if (pendingChanged && state.pending) {
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }
  });
}

/* ---------------------------- Popovers ---------------------------- */

// Un solo popover abierto a la vez, con un único listener global para cerrarlo al
// hacer clic fuera (evita listeners acumulados que cerrarían el popover recién abierto).
let currentPopover = null;

function closePopovers(returnFocus = false) {
  const prev = currentPopover;
  document.querySelectorAll('.is-spot').forEach((n) => n.classList.remove('is-spot'));
  document.querySelectorAll('.popover').forEach((p) => p.remove());
  document.querySelectorAll('[aria-expanded="true"]:not(.keep-expanded)').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  currentPopover = null;
  if (returnFocus && prev && document.body.contains(prev.anchor)) prev.anchor.focus();
}

document.addEventListener('click', (e) => {
  if (!currentPopover) return;
  if (currentPopover.pop.contains(e.target) || currentPopover.anchor.contains(e.target)) return;
  closePopovers();
});

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, video[controls], [tabindex]:not([tabindex="-1"])';

/**
 * Panel flotante anclado a un control. Si el anclaje está cerca del borde izquierdo el panel
 * se alinea a su izquierda; si no, a su derecha. Escape lo cierra y devuelve el foco al anclaje.
 * Con el teclado, el foco entra en el primer control del panel.
 */
function openPopover(anchor, html, extraClass = '', { label = '' } = {}) {
  const wasOpen = anchor.getAttribute('aria-expanded') === 'true';
  closePopovers();
  if (wasOpen) return null;
  const pop = document.createElement('div');
  pop.className = `popover ${extraClass}`;
  if (label) { pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', label); }
  pop.innerHTML = html;
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const ph = pop.offsetHeight;
  // Si no cabe debajo (p. ej., filas al final de una tabla) se abre hacia arriba.
  const below = r.bottom + 8 + ph < vh - 12 || r.top < ph + 20;
  pop.style.top = `${Math.round(below ? r.bottom + 8 : r.top - ph - 8)}px`;
  pop.classList.add(below ? 'pop-down' : 'pop-up');
  if (r.left + pop.offsetWidth < vw - 12 && r.left < vw / 2) {
    pop.style.left = `${Math.max(12, Math.round(r.left))}px`;
    pop.classList.add('pop-left');
  } else {
    pop.style.right = `${Math.max(12, Math.round(vw - r.right))}px`;
  }
  anchor.setAttribute('aria-expanded', 'true');
  currentPopover = { pop, anchor };
  // Desenfoque selectivo: si el ancla vive en una lista, su fila queda nítida y el resto
  // se atenúa, de modo que es evidente sobre qué elemento actúa el menú.
  let item = anchor;
  while (item && item.parentElement && !item.parentElement.classList.contains('focus-group')) item = item.parentElement;
  if (item && item.parentElement) item.classList.add('is-spot');
  pop.addEventListener('click', (e) => { if (e.target.closest('a')) closePopovers(); });
  pop.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); closePopovers(true); }
  });
  if (anchor.matches(':focus-visible')) {
    const first = pop.querySelector(FOCUSABLE);
    if (first) first.focus();
  }
  return pop;
}

window.addEventListener('resize', () => {
  closePopovers();
  document.querySelectorAll('.tabs').forEach((t) => moveTabInk(t));
  document.querySelectorAll('.has-ink').forEach((g) => moveSegInk(g));
});

/** Menú de acciones «⋯»: [{ label, icon, danger, onClick, id }]. Un separador antes de las acciones destructivas. */
function openActionMenu(anchor, items, label = 'Acciones') {
  const safe = items.filter(Boolean);
  const firstDanger = safe.findIndex((i) => i.danger);
  const pop = openPopover(anchor, `
    <div class="pop-list" role="menu" aria-label="${escapeHtml(label)}">
      ${safe.map((it, i) => `
        ${i === firstDanger && i > 0 ? '<div class="pop-sep" role="separator"></div>' : ''}
        <button type="button" role="menuitem" class="pop-item ${it.danger ? 'pop-danger' : ''}" data-i="${i}" ${it.id ? `id="${it.id}"` : ''}>
          ${it.icon || ''}<span>${escapeHtml(it.label)}</span>
        </button>`).join('')}
    </div>`, 'pop-menu');
  if (!pop) return;
  const btns = [...pop.querySelectorAll('[role="menuitem"]')];
  btns.forEach((b) => b.addEventListener('click', () => { closePopovers(true); safe[Number(b.dataset.i)].onClick(); }));
  // Flechas arriba/abajo recorren el menú (patrón de menú de WAI-ARIA).
  pop.addEventListener('keydown', (e) => {
    const i = btns.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
  });
}

function moreButton(extraAttrs = '', label = 'Más acciones') {
  return `<button type="button" class="icon-btn icon-btn-sm more-btn" aria-haspopup="menu" aria-expanded="false" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" ${extraAttrs}>${I.more}</button>`;
}

function openPresencePopover(anchor) {
  const list = state.presence.list;
  const extra = state.presence.count - list.length;
  openPopover(anchor, `
    <div class="pop-head"><span class="pulse-dot"></span> ${plural(state.presence.count, 'facultativo en línea', 'facultativos en línea')}</div>
    <div class="pop-list">
      ${list.length ? list.map((u) => `
        <a class="pop-item" href="#/doctor/${u.id}">
          <span class="avatar-dot">${escapeHtml(u.iniciales)}</span>
          <span class="pop-item-body"><strong>${escapeHtml(u.nombre)}</strong><small>${escapeHtml(u.especialidad)}</small></span>
        </a>`).join('') : '<p class="pop-empty">No hay otros facultativos conectados en este momento.</p>'}
      ${extra > 0 ? `<p class="pop-empty">y ${extra} más…</p>` : ''}
    </div>`, 'pop-presence');
  pollPresence();
}

function openUserMenu(anchor) {
  const u = state.user;
  const pop = openPopover(anchor, `
    <div class="pop-user">
      <strong>${escapeHtml(doctorPrefix(u.sexo))} ${escapeHtml(u.nombre)} ${escapeHtml(u.apellidos)}</strong>
      <small>${escapeHtml(u.especialidad)}</small>
      <span class="role-pill role-${u.rol}">${escapeHtml(roleLabel(u))}</span>
      <small>${escapeHtml(u.email)}</small>
    </div>
    <div class="pop-list">
      <a class="pop-item" href="#/doctor/${u.id}">${I.folder}<span>Mi carpeta clínica</span></a>
      <a class="pop-item" href="#/especialidad/${encodeURIComponent(u.especialidad_slug)}">${I.home}<span>Mi especialidad</span></a>
      <button class="pop-item" type="button" data-act="password">${I.key}<span>Cambiar contraseña</span></button>
      <button class="pop-item" type="button" data-act="keys">${I.keyboard}<span>Atajos de teclado</span><kbd class="pop-kbd">?</kbd></button>
    </div>
    <div class="pop-prefs" role="group" aria-label="Accesibilidad">
      <div class="pop-prefs-title">${I.access}<span>Accesibilidad</span></div>
      ${prefSwitch('text', 'Texto ampliado', prefs.text === 'lg')}
      ${prefSwitch('motion', 'Reducir animaciones', prefs.motion === 'reduce')}
    </div>
    <div class="pop-list">
      <button class="pop-item pop-danger" type="button" data-act="logout">${I.logout}<span>Cerrar sesión</span></button>
    </div>`, 'pop-usermenu', { label: 'Menú de usuario' });
  if (!pop) return;
  pop.querySelector('[data-act="password"]').addEventListener('click', () => { closePopovers(); openPasswordModal(); });
  pop.querySelector('[data-act="keys"]').addEventListener('click', () => { closePopovers(); openShortcutsDialog(); });
  pop.querySelector('[data-act="logout"]').addEventListener('click', logout);
  pop.querySelectorAll('[role="switch"]').forEach((sw) => sw.addEventListener('click', () => {
    const on = sw.getAttribute('aria-checked') !== 'true';
    sw.setAttribute('aria-checked', String(on));
    if (sw.dataset.pref === 'text') prefs.text = on ? 'lg' : 'normal';
    else prefs.motion = on ? 'reduce' : 'auto';
    savePrefs();
    document.querySelectorAll('.tabs').forEach((t) => moveTabInk(t));
    document.querySelectorAll('.has-ink').forEach((g) => moveSegInk(g));
  }));
}

function prefSwitch(key, label, on) {
  return `<button type="button" class="pref-switch" role="switch" aria-checked="${on}" data-pref="${key}">
    <span>${label}</span><span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
  </button>`;
}

function openShortcutsDialog() {
  const rows = [
    ['Ctrl K', 'Abrir la búsqueda global'],
    ['/', 'Abrir la búsqueda global (fuera de un campo de texto)'],
    ['↑ ↓ Intro', 'Recorrer y abrir los resultados de la búsqueda'],
    ['← →', 'Cambiar de pestaña (con el foco en las pestañas)'],
    ['Ctrl Intro', 'Consignar la nota de evolución en redacción'],
    ['Esc', 'Cerrar el diálogo, el menú o el visor abierto'],
    ['?', 'Mostrar esta ayuda'],
  ];
  const backdrop = openModal(`
    <h2>Atajos de teclado</h2>
    <span class="modal-sub">Toda la aplicación puede utilizarse únicamente con el teclado.</span>
    <dl class="shortcut-list">
      ${rows.map(([k, d]) => `<div class="shortcut-row"><dt>${k.split(' ').map((x) => `<kbd>${x}</kbd>`).join(' ')}</dt><dd>${d}</dd></div>`).join('')}
    </dl>
    <div class="modal-actions"><button type="button" class="btn btn-primary" id="sc-ok">Entendido</button></div>`);
  const ok = backdrop.querySelector('#sc-ok');
  ok.addEventListener('click', () => backdrop.remove());
  ok.focus();
}

async function logout() {
  closePopovers();
  document.querySelectorAll('.layer').forEach((l) => l.remove());
  try { await api('POST', '/api/auth/logout'); } catch (_) {}
  state.user = null;
  stopHeartbeat();
  clearTimeout(idleTimer);
  location.hash = '#/login';
}

/* ---------------------------- Cierre de sesión por inactividad ----------------------------
   En estaciones de trabajo compartidas del hospital, una sesión desatendida expone datos
   clínicos. Tras 20 minutos sin actividad se avisa con 60 segundos de margen y un botón
   para continuar (WCAG 2.2.1: el usuario puede prolongar el tiempo). */

const IDLE_WARN_S = 60;
let idleTimer = null;
let idleWarnOpen = false;
let lastIdleReset = 0;

function idleMs() {
  const min = (state.catalog && state.catalog.politicas && state.catalog.politicas.inactividad_min) || 20;
  return Number(window.IV_IDLE_MS) || min * 60 * 1000;
}
/** Longitud mínima de contraseña que exige el servidor (variable PASSWORD_MIN_LENGTH). */
function passMin() {
  return (state.catalog && state.catalog.politicas && state.catalog.politicas.password_min) || 8;
}

function resetIdle(force = false) {
  if (!state.user || idleWarnOpen) return;
  const now = Date.now();
  if (!force && now - lastIdleReset < 5000) return;
  lastIdleReset = now;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(showIdleWarning, idleMs());
}
['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => document.addEventListener(ev, () => resetIdle(), { passive: true, capture: true }));

function showIdleWarning() {
  if (!state.user) return;
  idleWarnOpen = true;
  let left = IDLE_WARN_S;
  const C = 2 * Math.PI * 26;
  const backdrop = openModal(`
    <div class="idle-body">
      <svg class="idle-ring" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="26" class="idle-ring-bg"/>
        <circle cx="32" cy="32" r="26" class="idle-ring-fg" style="stroke-dasharray:${C};--c:${C}"/>
      </svg>
      <span class="idle-num" id="idle-num" aria-hidden="true">${left}</span>
    </div>
    <h2>¿Continúa trabajando?</h2>
    <span class="modal-sub">Por la confidencialidad de la información clínica, la sesión se cerrará en <strong id="idle-left">${left} segundos</strong> por inactividad.</span>
    <div class="modal-actions modal-actions-center">
      <button type="button" class="btn btn-ghost" id="idle-out">Cerrar sesión</button>
      <button type="button" class="btn btn-primary" id="idle-stay">Continuar sesión</button>
    </div>`, { role: 'alertdialog', center: true });
  const numEl = backdrop.querySelector('#idle-num');
  const leftEl = backdrop.querySelector('#idle-left');
  const tick = setInterval(() => {
    left -= 1;
    numEl.textContent = left;
    leftEl.textContent = `${left} segundos`;
    if (left <= 0) {
      clearInterval(tick);
      idleWarnOpen = false;
      backdrop.remove();
      logout().then(() => toast('La sesión se cerró por inactividad. Ingrese nuevamente para continuar.', 'error'));
    }
  }, 1000);
  const stay = () => { clearInterval(tick); idleWarnOpen = false; backdrop.remove(); resetIdle(true); pollPresence(); };
  backdrop.querySelector('#idle-stay').addEventListener('click', stay);
  backdrop.querySelector('#idle-stay').focus();
  backdrop.querySelector('#idle-out').addEventListener('click', () => { clearInterval(tick); idleWarnOpen = false; logout(); });
  // Cerrar el aviso con Escape o fuera del recuadro equivale a continuar.
  new MutationObserver((_, obs) => {
    if (!document.body.contains(backdrop)) { obs.disconnect(); if (idleWarnOpen) stay(); }
  }).observe(document.body, { childList: true });
}

/* ---------------------------- Sin conexión ---------------------------- */

function updateOnline() {
  const b = document.getElementById('offline-banner');
  if (!b) return;
  if (navigator.onLine) {
    if (!b.hidden) { b.classList.add('is-back'); setTimeout(() => { b.hidden = true; b.classList.remove('is-back'); }, 1600); b.querySelector('span').textContent = 'Conexión restablecida'; }
  } else {
    b.hidden = false;
    b.classList.remove('is-back');
    b.querySelector('span').textContent = 'Sin conexión a Internet: los cambios no podrán registrarse hasta que se restablezca.';
  }
}
window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);
updateOnline();

/* ---------------------------- Estructura (topbar, nav inferior, pie) ---------------------------- */

function topbarHtml(active) {
  const u = state.user;
  const fullName = `${doctorPrefix(u.sexo)} ${u.nombre}`;
  const link = (key, href, label) => `<a href="${href}" class="topnav-link ${active === key ? 'active' : ''}" ${active === key ? 'aria-current="page"' : ''}>${label}</a>`;
  return `
  <header class="topbar">
    <div class="topbar-inner">
      <a href="#/inicio" class="brand"><span class="brand-mark"></span><span class="brand-text">IslaVisual</span></a>
      <nav class="topnav" aria-label="Navegación principal">
        ${link('inicio', '#/inicio', 'Especialidades')}
        ${link('biblioteca', '#/biblioteca', 'Biblioteca')}
        ${link('micarpeta', `#/doctor/${u.id}`, 'Mi carpeta')}
        ${canApprove(u) ? link('admin', '#/admin', `${isMaster(u) ? 'Administración' : 'Aprobaciones'}<span class="nav-badge" data-pending-count ${state.pending ? '' : 'hidden'}>${state.pending}</span>`) : ''}
      </nav>
      <div class="topbar-actions">
        <button type="button" class="search-trigger" id="open-search" aria-label="Búsqueda global" aria-keyshortcuts="Control+K">
          ${I.search}<span class="st-label" aria-hidden="true">Buscar</span><kbd aria-hidden="true">Ctrl K</kbd>
        </button>
        <button type="button" class="online-pill" id="online-pill" aria-expanded="false" aria-haspopup="dialog" aria-label="Facultativos en línea: ${state.presence.count}">
          <span class="pulse-dot" aria-hidden="true"></span><span data-online-count aria-hidden="true">${state.presence.count}</span><span class="op-label" aria-hidden="true">&nbsp;en línea</span>
        </button>
        <button type="button" class="user-chip" id="user-menu-btn" aria-expanded="false" aria-haspopup="dialog" aria-label="Menú de usuario de ${escapeHtml(fullName)}" title="${escapeHtml(fullName)}">
          <span class="avatar-dot">${initials(u.nombre, u.apellidos)}</span>
          <span class="chip-name">${escapeHtml(fullName)}</span>
        </button>
      </div>
    </div>
  </header>`;
}

function bottomNavHtml(active) {
  const u = state.user;
  const item = (key, href, icon, label) =>
    `<a href="${href}" class="bn-item ${active === key ? 'active' : ''}" ${active === key ? 'aria-current="page"' : ''}><span class="bn-ic" data-mag>${icon}</span><span>${label}</span></a>`;
  return `
  <nav class="bottomnav" aria-label="Navegación principal" data-magnify="1.38" data-mag-radius="110" data-mag-axis="x">
    ${item('inicio', '#/inicio', I.home, 'Inicio')}
    <button type="button" class="bn-item" id="bn-search"><span class="bn-ic" data-mag>${I.search.replace('width="16" height="16"', 'width="20" height="20"')}</span><span>Buscar</span></button>
    ${item('biblioteca', '#/biblioteca', I.book, 'Biblioteca')}
    ${item('micarpeta', `#/doctor/${u.id}`, I.folder, 'Mi carpeta')}
    ${canApprove(u) ? item('admin', '#/admin', `${I.shield}<span class="nav-badge nav-badge-float" data-pending-count ${state.pending ? '' : 'hidden'}>${state.pending}</span>`, isMaster(u) ? 'Admin' : 'Aprobar') : ''}
  </nav>`;
}

function globalFooterHtml() {
  return `
  <footer class="app-footer">
    <p class="footer-line">IslaVisual · información clínica de acceso restringido al cuerpo facultativo autenticado</p>
    <p class="studio-credit">Desarrollado por <span class="studio-name">爪丨匚卄乇.studios</span> · <span class="studio-phone">+53 55633280</span></p>
  </footer>`;
}

function shell(contentHtml, active = '') {
  APP.innerHTML = `<a class="skip-link" href="#view-root" data-skip>Saltar al contenido principal</a>${topbarHtml(active)}<main class="container view-enter" id="view-root" tabindex="-1">${contentHtml}</main>${globalFooterHtml()}${bottomNavHtml(active)}`;
  document.getElementById('open-search').addEventListener('click', openSearchPalette);
  document.getElementById('bn-search').addEventListener('click', openSearchPalette);
  document.getElementById('online-pill').addEventListener('click', (e) => openPresencePopover(e.currentTarget));
  document.getElementById('user-menu-btn').addEventListener('click', (e) => openUserMenu(e.currentTarget));
  window.scrollTo(0, 0);
}

// Botones «Reintentar» de los estados de error (sin manejadores en línea: la CSP los prohíbe).
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-retry]')) refreshView();
});

// El enlace de salto no cambia el hash (lo interpretaría el enrutador): mueve el foco al contenido.
document.addEventListener('click', (e) => {
  const skip = e.target.closest('[data-skip]');
  if (!skip) return;
  e.preventDefault();
  const main = document.getElementById('view-root');
  if (main) main.focus();
});

/* ---------------------------- Esqueletos de carga ----------------------------
   Cada vista muestra, mientras carga, un esqueleto con la forma de su contenido real
   (no un indicador giratorio genérico): el usuario anticipa la disposición y la
   espera se percibe más corta. Anunciado a lectores de pantalla con aria-busy. */

const sk = (cls, w) => `<span class="sk ${cls}"${w ? ` style="width:${w}"` : ''}></span>`;
const skRepeat = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join('');

function skWrap(inner, label = 'Cargando contenido') {
  return `<div class="sk-wrap" aria-busy="true"><span class="sr-only" role="status">${label}…</span><div aria-hidden="true">${inner}</div></div>`;
}

const SK = {
  tiles: (n) => `<div class="sp-grid">${skRepeat(n, () => `<div class="sk-card sk-tile">${sk('sk-mono')}<div class="sk-col">${sk('sk-line', '70%')}${sk('sk-line sk-sm', '45%')}</div></div>`)}</div>`,
  folderCards: (n) => `<div class="folder-grid">${skRepeat(n, () => `<div class="sk-card sk-folder">${sk('sk-circle')}<div class="sk-col">${sk('sk-line sk-lg', '75%')}${sk('sk-line sk-sm', '50%')}</div>${sk('sk-line sk-sm sk-full')}</div>`)}</div>`,
  patientCards: (n) => `<div class="patient-list">${skRepeat(n, () => `<div class="sk-card sk-patient">${sk('sk-line sk-lg', '60%')}${sk('sk-line', '85%')}${sk('sk-line sk-sm', '40%')}</div>`)}</div>`,
  libraryCards: (n) => `<div class="library-grid">${skRepeat(n, () => `<div class="sk-card sk-lib">${sk('sk-block')}<div class="sk-col sk-pad">${sk('sk-line sk-lg', '80%')}${sk('sk-line', '95%')}${sk('sk-line sk-sm', '50%')}<div class="sk-row">${sk('sk-pill')}${sk('sk-dot')}${sk('sk-dot')}</div></div></div>`)}</div>`,
  photos: (n) => `<div class="photo-grid">${skRepeat(n, () => `<div class="sk-card sk-lib">${sk('sk-block sk-block-tall')}<div class="sk-col sk-pad">${sk('sk-line sk-sm', '40%')}${sk('sk-line', '90%')}</div></div>`)}</div>`,
  notes: (n) => skRepeat(n, () => `<li class="sk-card sk-note">${sk('sk-line sk-sm', '35%')}${sk('sk-line', '95%')}${sk('sk-line', '70%')}</li>`),
  tableRows: (n) => `<div class="sk-card sk-table">${skRepeat(n, () => `<div class="sk-tr">${sk('sk-dot')}${sk('sk-line', '22%')}${sk('sk-line', '16%')}${sk('sk-line', '18%')}${sk('sk-pill')}${sk('sk-dot')}</div>`)}</div>`,
  specRows: (n) => `<div class="spec-admin-list">${skRepeat(n, () => `<div class="sk-card sk-specrow">${sk('sk-mono sk-mono-sm')}<div class="sk-col">${sk('sk-line', '35%')}${sk('sk-line sk-sm', '55%')}</div>${sk('sk-pill')}</div>`)}</div>`,
  pageHead: () => `<div class="sk-head">${sk('sk-line sk-xs', '120px')}${sk('sk-line sk-h1', 'min(360px, 80%)')}${sk('sk-line', 'min(520px, 95%)')}</div>`,
  back: () => `<div class="sk-back">${sk('sk-line sk-sm', '160px')}</div>`,
  tabs: (n) => `<div class="sk-tabs">${skRepeat(n, () => sk('sk-line', '110px'))}</div>`,
  toolbar: () => `<div class="sk-toolbar">${sk('sk-input')}${sk('sk-pill sk-pill-lg')}</div>`,
  stats: (n) => `<div class="stat-row ${n > 4 ? 'stat-row-6' : 'stat-row-4'}">${skRepeat(n, () => `<div class="sk-card sk-stat">${sk('sk-line sk-h1', '40%')}${sk('sk-line sk-xs', '70%')}</div>`)}</div>`,
};

/** Copia el enlace de la vista actual (solo accesible al personal autenticado). */
async function copyLink() {
  try {
    await navigator.clipboard.writeText(location.href);
    toast('Enlace copiado; solo el personal autenticado podrá abrirlo');
  } catch (_) {
    toast('No fue posible copiar el enlace en este navegador.', 'error');
  }
}

/** Estado vacío con ilustración animada y, opcionalmente, una acción. */
function emptyState(kind, title, text, actionHtml = '') {
  const icon = { search: I.search, users: I.users, folder: I.folder, book: I.book, photo: I.image, notes: I.doc, check: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' }[kind] || I.doc;
  return `<div class="empty-state"><span class="empty-icon" aria-hidden="true">${icon.replace(/width="\d+" height="\d+"/, 'width="26" height="26"')}</span><h2 class="empty-title">${title}</h2><p>${text}</p>${actionHtml}</div>`;
}

/** Esqueleto precedido de un encabezado real (visible para todos, incluidos lectores de pantalla). */
function skHeaded(headHtml, restHtml, label) {
  return `${headHtml}${skWrap(restHtml, label)}`;
}

const SKV = {
  home: () => skWrap(`<div class="sk-head sk-hero">${sk('sk-line sk-xs', '120px')}${sk('sk-line sk-h1', 'min(420px, 85%)')}</div>${SK.stats(4)}<div class="sk-panel">${SK.tiles(8)}</div>`, 'Cargando especialidades'),
  // Cuando se conoce el título (porque viene de una tarjeta o del catálogo), el esqueleto ya
  // muestra el encabezado real en su sitio definitivo: es el destino del elemento compartido.
  specialty: (known) => skHeaded(known ? `
      <a href="#/inicio" class="back-link">&larr; Todas las especialidades</a>
      <header class="sp-header" style="--h:${known.hue}">
        <span class="sp-mono sp-mono-lg vt-figure" aria-hidden="true">${escapeHtml(known.figure)}</span>
        <div class="sp-header-text"><span class="eyebrow">Especialidad</span><h1 class="vt-title">${escapeHtml(known.title)}</h1>
          <div class="sk-col sk-under" aria-hidden="true">${sk('sk-line', 'min(260px, 80%)')}${sk('sk-line sk-sm', 'min(220px, 70%)')}</div></div>
      </header>` : '',
    `${known ? '' : `${SK.back()}<div class="sk-sphead">${sk('sk-mono sk-mono-lg')}<div class="sk-col">${sk('sk-line sk-xs', '90px')}${sk('sk-line sk-h1', 'min(300px, 70%)')}${sk('sk-line', 'min(380px, 90%)')}</div></div>`}${SK.tabs(2)}${SK.toolbar()}${SK.folderCards(6)}`, 'Cargando especialidad'),
  folder: (known) => skHeaded(known ? `
      <div class="sk-back" aria-hidden="true">${sk('sk-line sk-sm', '160px')}</div>
      <div class="folder-header">
        <div class="folder-header-left">
          <div class="fh-avatar vt-figure" aria-hidden="true">${escapeHtml(known.figure)}</div>
          <div class="fh-text"><h1 class="vt-title">${escapeHtml(known.title)}</h1>
            <div class="fh-meta" aria-hidden="true">${sk('sk-pill')}${sk('sk-pill')}</div></div>
        </div>
      </div>` : '',
    `${known ? '' : `${SK.back()}<div class="sk-sphead">${sk('sk-circle sk-circle-lg')}<div class="sk-col">${sk('sk-line sk-h1', 'min(380px, 80%)')}<div class="sk-row">${sk('sk-pill')}${sk('sk-pill')}</div></div></div>`}${SK.toolbar()}${SK.patientCards(6)}`, 'Cargando carpeta clínica'),
  patient: (known) => skHeaded(known ? `
      <div class="sk-back" aria-hidden="true">${sk('sk-line sk-sm', '200px')}</div>
      <article class="record-card">
        <div class="record-title-row"><div class="record-title"><h1 class="vt-title">${escapeHtml(known.title)}</h1>
          <div class="sk-col sk-under" aria-hidden="true">${sk('sk-line sk-sm', 'min(420px, 90%)')}</div></div></div>
        <div class="sk-grid4" aria-hidden="true">${skRepeat(6, () => `<div class="sk-col">${sk('sk-line sk-xs', '60%')}${sk('sk-line', '80%')}</div>`)}</div>
      </article>` : '',
    `${known ? '' : `${SK.back()}<div class="sk-card sk-record">${sk('sk-line sk-h1', 'min(340px, 75%)')}${sk('sk-line sk-sm', 'min(420px, 90%)')}<div class="sk-grid4">${skRepeat(6, () => `<div class="sk-col">${sk('sk-line sk-xs', '60%')}${sk('sk-line', '80%')}</div>`)}</div></div>`}${SK.tabs(2)}<ol class="sk-notes">${SK.notes(3)}</ol>`, 'Cargando expediente'),
  admin: (master) => skWrap(`${SK.pageHead()}${master ? SK.stats(6) : ''}${SK.tabs(master ? 4 : 1)}${SK.toolbar()}${SK.libraryCards(4)}`, 'Cargando administración'),
};

/* ---------------------------- Paginación ---------------------------- */

function pagerHtml(p) {
  if (!p || !p.total) return '';
  if (p.pages <= 1) return `<div class="pager"><span class="pager-info">${plural(p.total, 'resultado', 'resultados')}</span></div>`;
  return `
  <div class="pager">
    <button type="button" class="btn btn-ghost btn-sm" data-page="${p.page - 1}" ${p.page <= 1 ? 'disabled' : ''} aria-label="Página anterior">‹ Anterior</button>
    <span class="pager-info">Página ${p.page} de ${p.pages} <span class="pager-total">· ${p.total} en total</span></span>
    <button type="button" class="btn btn-ghost btn-sm" data-page="${p.page + 1}" ${p.page >= p.pages ? 'disabled' : ''} aria-label="Página siguiente">Siguiente ›</button>
  </div>`;
}

function bindPager(root, onPage) {
  root.querySelectorAll('.pager [data-page]').forEach((b) => {
    b.addEventListener('click', () => {
      onPage(Number(b.dataset.page));
      const anchor = root.closest('.panel-anchor') || root;
      const top = anchor.getBoundingClientRect().top + window.scrollY - 80;
      if (top < window.scrollY) window.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    });
  });
}

/* ---------------------------- Modales y confirmación ---------------------------- */

/**
 * Capa superpuesta accesible (diálogo, búsqueda, visor):
 * - el resto de la aplicación queda «inert» (ni foco ni lector de pantalla fuera del diálogo);
 * - Tab y Mayús+Tab quedan atrapados dentro de la capa;
 * - al cerrarse, el foco vuelve al control que la abrió (WCAG 2.4.3);
 * - el cierre se anima; cualquier llamada a layer.remove() pasa por aquí.
 */
function activateLayer(layer, container) {
  const opener = document.activeElement;
  layer.classList.add('layer');
  APP.inert = true;
  document.body.classList.add('modal-open');
  layer.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = [...container.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!f.length) { e.preventDefault(); return; }
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
  });
  const nativeRemove = Element.prototype.remove;
  let closing = false;
  const release = () => {
    if (!document.querySelector('.layer:not(.is-closing)')) {
      APP.inert = false;
      document.body.classList.remove('modal-open');
    }
    if (opener && opener.focus && document.body.contains(opener) && !opener.closest('[inert]')) opener.focus({ preventScroll: true });
  };
  layer.remove = function remove() {
    if (closing) return;
    closing = true;
    this.classList.add('is-closing');
    release();
    if (prefersReducedMotion()) nativeRemove.call(this);
    else setTimeout(() => nativeRemove.call(this), 170);
  };
}

let dlgSeq = 0;

function openModal(html, { wide = false, role = 'dialog', label = '', center = false } = {}) {
  const id = `dlg-${++dlgSeq}`;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal-box ${wide ? 'modal-wide' : ''} ${center ? 'modal-center' : ''}" role="${role}" aria-modal="true">${html}</div>`;
  const box = backdrop.firstElementChild;
  // Nombre y descripción accesibles tomados del propio contenido del diálogo.
  const h = box.querySelector('h2');
  if (h) { h.id = `${id}-t`; box.setAttribute('aria-labelledby', h.id); } else box.setAttribute('aria-label', label || 'Diálogo');
  const sub = box.querySelector('.modal-sub');
  if (sub) { sub.id = `${id}-d`; box.setAttribute('aria-describedby', sub.id); }
  // Cada etiqueta queda asociada a su campo (WCAG 1.3.1 / 4.1.2), y los obligatorios se anuncian como tales.
  box.querySelectorAll('.field').forEach((f, i) => {
    const lab = f.querySelector('label');
    const ctl = f.querySelector('input, select, textarea');
    if (!lab || !ctl) return;
    if (!ctl.id) ctl.id = `${id}-f${i}`;
    if (!lab.htmlFor) lab.htmlFor = ctl.id;
    if (ctl.required && !lab.querySelector('.req')) lab.insertAdjacentHTML('beforeend', ' <span class="req" aria-hidden="true">*</span>');
  });
  document.body.appendChild(backdrop);
  activateLayer(backdrop, box);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
  backdrop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); backdrop.remove(); } });

  // Foco en el primer campo REALMENTE visible (evita un <input type="file"> oculto).
  for (const el of box.querySelectorAll('input, select, textarea')) {
    if (el.type === 'hidden' || el.offsetParent === null) continue;
    el.focus();
    break;
  }
  if (!box.contains(document.activeElement)) { box.tabIndex = -1; box.focus(); }
  return backdrop;
}

function confirmDialog({ title = 'Confirmar acción', message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = true }) {
  return new Promise((resolve) => {
    let resolved = false;
    const iconSvg = danger
      ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>'
      : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>';
    const backdrop = openModal(`
      <div class="confirm-head">
        <div class="confirm-icon ${danger ? 'confirm-icon-danger' : ''}" aria-hidden="true">${iconSvg}</div>
        <h2>${escapeHtml(title)}</h2>
        <p class="modal-sub">${escapeHtml(message)}</p>
      </div>
      <div class="modal-actions modal-actions-center">
        <button type="button" class="btn btn-ghost" id="confirm-cancel">${escapeHtml(cancelLabel)}</button>
        <button type="button" class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" id="confirm-ok">${escapeHtml(confirmLabel)}</button>
      </div>`, { role: danger ? 'alertdialog' : 'dialog', center: true });
    const finish = (r) => { if (!resolved) { resolved = true; resolve(r); } };
    backdrop.querySelector('#confirm-cancel').addEventListener('click', () => backdrop.remove());
    const ok = backdrop.querySelector('#confirm-ok');
    ok.addEventListener('click', () => { finish(true); backdrop.remove(); });
    ok.focus();
    const obs = new MutationObserver(() => {
      if (!document.body.contains(backdrop)) { finish(false); obs.disconnect(); }
    });
    obs.observe(document.body, { childList: true });
  });
}

function showFormError(backdrop, sel, msg) {
  const box = backdrop.querySelector(sel);
  box.textContent = msg;
  box.classList.add('show');
}

/** Deshabilita el botón mientras dura la operación para evitar envíos duplicados. */
async function withBusy(btn, busyLabel, fn) {
  const label = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = busyLabel;
  try { return await fn(); } finally {
    if (document.body.contains(btn)) { btn.disabled = false; btn.innerHTML = label; }
  }
}

/* ==========================================================================
   BÚSQUEDA GLOBAL (Ctrl+K)
   ========================================================================== */

let searchSeq = 0;

function openSearchPalette() {
  if (document.querySelector('.palette-backdrop')) return;
  closePopovers();
  const bd = document.createElement('div');
  bd.className = 'palette-backdrop';
  bd.innerHTML = `
    <div class="palette" role="dialog" aria-modal="true" aria-label="Búsqueda global">
      <div class="palette-input">
        ${I.search}
        <label for="pal-q" class="sr-only">Buscar en IslaVisual</label>
        <input id="pal-q" type="search" role="combobox" aria-expanded="false" aria-controls="pal-res" aria-autocomplete="list" placeholder="Facultativos, pacientes, historias clínicas, materiales…" autocomplete="off" spellcheck="false">
        <button type="button" class="pal-close" aria-label="Cerrar búsqueda">Esc</button>
      </div>
      <p class="sr-only" id="pal-status" role="status"></p>
      <div class="palette-results" id="pal-res" aria-label="Resultados de la búsqueda">
        <p class="pal-hint">Escriba al menos dos caracteres. Puede buscar por nombre, número de historia clínica, carnet de identidad o diagnóstico.</p>
      </div>
    </div>`;
  document.body.appendChild(bd);
  activateLayer(bd, bd.querySelector('.palette'));
  const input = bd.querySelector('#pal-q');
  const resBox = bd.querySelector('#pal-res');
  input.focus();

  let links = [];
  let active = -1;

  const close = () => bd.remove();

  const statusEl = bd.querySelector('#pal-status');
  function setActive(i) {
    links.forEach((a) => { a.classList.remove('active'); a.setAttribute('aria-selected', 'false'); });
    active = i;
    if (links[i]) {
      links[i].classList.add('active');
      links[i].setAttribute('aria-selected', 'true');
      input.setAttribute('aria-activedescendant', links[i].id);
      links[i].scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }

  const run = debounce(async () => {
    const q = input.value.trim();
    if (q.length < 2) {
      resBox.innerHTML = '<p class="pal-hint">Escriba al menos dos caracteres. Puede buscar por nombre, número de historia clínica, carnet de identidad o diagnóstico.</p>';
      links = [];
      resBox.removeAttribute('role');
      input.setAttribute('aria-expanded', 'false');
      return;
    }
    const token = ++searchSeq;
    resBox.classList.add('loading');
    let d;
    try {
      d = await api('GET', `/api/search?q=${encodeURIComponent(q)}`);
    } catch (err) {
      resBox.removeAttribute("role");
      resBox.innerHTML = `<p class="pal-hint">${escapeHtml(err.message)}</p>`;
      return;
    } finally {
      resBox.classList.remove('loading');
    }
    if (token !== searchSeq || !document.body.contains(bd)) return;

    const group = (title, items) => (items.length ? `<div class="pal-group" role="group" aria-label="${title}"><div class="pal-group-title" aria-hidden="true">${title}</div>${items.join('')}</div>` : '');
    const html =
      group('Especialidades', d.specialties.map((s) => `
        <a class="pal-item" href="#/especialidad/${s.slug}">
          <span class="sp-mono sp-mono-sm" style="--h:${specialtyHue(s.slug)}">${specialtyMonogram(s.nombre)}</span>
          <span class="pal-item-body"><strong>${hl(s.nombre, q)}</strong><small>Especialidad</small></span>
        </a>`)) +
      group('Facultativos', d.doctors.map((x) => `
        <a class="pal-item" href="#/doctor/${x.id}">
          <span class="avatar-dot">${initials(x.nombre, x.apellidos)}</span>
          <span class="pal-item-body"><strong>${hl(x.folder_title, q)}</strong><small>${escapeHtml(x.especialidad)}${x.subespecialidad ? ' · ' + escapeHtml(x.subespecialidad) : ''}</small></span>
        </a>`)) +
      group('Pacientes', d.patients.map((p) => `
        <a class="pal-item" href="#/patient/${p.id}">
          <span class="pal-ic">${I.patient}</span>
          <span class="pal-item-body"><strong>${hl(p.nombre, q)}</strong><small>HC: ${hl(p.historia_clinica || '—', q)}${p.diagnostico ? ` · ${hl(p.diagnostico, q)}` : ''}</small><small>${escapeHtml(p.medico)} · ${escapeHtml(p.especialidad)}</small></span>
        </a>`)) +
      group('Biblioteca Clínica', d.library.map((l) => `
        <a class="pal-item" href="#/biblioteca" data-lib-id="${l.id}">
          <span class="pal-ic">${I.book.replace('width="20" height="20"', 'width="16" height="16"')}</span>
          <span class="pal-item-body"><strong>${hl(l.titulo, q)}</strong><small>${escapeHtml(l.especialidad)}</small></span>
        </a>`));

    resBox.innerHTML = html || `<p class="pal-hint">No se encontraron coincidencias para «${escapeHtml(q)}».</p>`;
    links = [...resBox.querySelectorAll('.pal-item')];
    input.setAttribute('aria-expanded', links.length ? 'true' : 'false');
    if (links.length) resBox.setAttribute('role', 'listbox'); else resBox.removeAttribute('role');
    statusEl.textContent = links.length ? `${plural(links.length, 'resultado', 'resultados')}. Use las flechas para recorrerlos.` : 'Sin resultados.';
    links.forEach((a, i) => {
      a.id = `pal-opt-${i}`;
      a.setAttribute('role', 'option');
      a.setAttribute('tabindex', '-1');
      a.addEventListener('mouseenter', () => setActive(i));
      a.addEventListener('click', (e) => {
        if (a.dataset.libId) state.pendingLibraryQuery = a.querySelector('strong').textContent;
        close();
        // Si el destino es la vista actual, el hashchange no se dispara: se fuerza el redibujado.
        if (a.getAttribute('href') === location.hash) { e.preventDefault(); refreshView(); }
      });
    });
    setActive(links.length ? 0 : -1);
  }, 220);

  input.addEventListener('input', run);
  bd.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    else if (e.key === 'ArrowDown' && links.length) { e.preventDefault(); setActive((active + 1) % links.length); }
    else if (e.key === 'ArrowUp' && links.length) { e.preventDefault(); setActive((active - 1 + links.length) % links.length); }
    else if (e.key === 'Enter' && links[active]) { e.preventDefault(); links[active].click(); }
  });
  bd.addEventListener('click', (e) => { if (e.target === bd) close(); });
  bd.querySelector('.pal-close').addEventListener('click', close);
}

document.addEventListener('keydown', (e) => {
  if (!state.user) return;
  const typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]');
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openSearchPalette();
  } else if (e.key === '/' && !typing && !document.querySelector('.layer')) {
    e.preventDefault();
    openSearchPalette();
  } else if (e.key === '?' && !typing && !document.querySelector('.layer')) {
    e.preventDefault();
    openShortcutsDialog();
  } else if (e.key === 'Escape') {
    closePopovers();
  }
});

/* ==========================================================================
   ACCESO Y REGISTRO
   ========================================================================== */

function renderAuth(mode) {
  sharedHint = null;
  withIrisTransition(async () => {
    const isLogin = mode === 'login';
    APP.innerHTML = `
    <main class="auth-shell" id="view-root">
      <div class="auth-card ${isLogin ? '' : 'auth-card-wide'} view-enter">
        <div class="auth-brand"><span class="brand-mark" aria-hidden="true"></span><span class="brand-text">IslaVisual</span></div>
        <span class="auth-eyebrow">Cuerpo Facultativo · Plataforma Hospitalaria</span>
        <h1>${isLogin ? 'Bienvenido nuevamente' : 'Registro de nuevo facultativo'}</h1>
        <span class="auth-sub">${isLogin ? 'Acceda a su carpeta clínica y a las de sus colegas de todas las especialidades.' : 'Complete el formulario para habilitar su carpeta clínica dentro de su especialidad.'}</span>
        <div class="form-error" id="auth-error" role="alert"></div>
        <form id="auth-form" novalidate>
          ${isLogin || !(state.catalog.politicas || {}).registro_con_codigo ? '' : `
          <div class="field">
            <label for="f-codigo">Código de registro del hospital</label>
            <input id="f-codigo" name="codigo" required autocomplete="off" spellcheck="false" aria-describedby="f-codigo-hint">
            <small class="field-hint" id="f-codigo-hint">Lo facilita la administración del hospital. Protege los datos clínicos de accesos externos.</small>
          </div>`}
          ${isLogin ? '' : `
          <div class="field-row">
            <div class="field"><label for="f-nombre">Nombre</label><input id="f-nombre" name="nombre" required autocomplete="given-name"></div>
            <div class="field"><label for="f-apellidos">Apellidos</label><input id="f-apellidos" name="apellidos" required autocomplete="family-name"></div>
          </div>
          <div class="field-row">
            <div class="field">
              <label for="f-sexo">Sexo</label>
              <select id="f-sexo" name="sexo" required>
                <option value="">Seleccione</option>
                <option value="M">Masculino (Dr.)</option>
                <option value="F">Femenino (Dra.)</option>
              </select>
            </div>
            <div class="field"><label for="f-tel">Teléfono de contacto</label><input id="f-tel" name="telefono" type="tel" required placeholder="+53 5xxxxxxx" autocomplete="tel"></div>
          </div>
          <div class="field-row stack-mobile">
            <div class="field">
              <label for="f-esp">Especialidad</label>
              <select id="f-esp" name="especialidad_slug" required>${specialtyOptions('')}</select>
            </div>
            <div class="field"><label for="f-sub">Subespecialidad o área <span class="opt">(opcional)</span></label><input id="f-sub" name="subespecialidad" placeholder="Ej.: Retina, Arritmias…"></div>
          </div>
          `}
          <div class="${isLogin ? '' : 'field-row stack-mobile'}">
            <div class="field"><label for="f-email">Correo electrónico</label><input id="f-email" type="email" name="email" required autocomplete="email"></div>
            <div class="field"><label for="f-pass">Contraseña</label>
              <div class="pass-wrap"><input id="f-pass" type="password" name="password" required ${isLogin ? '' : `minlength="${passMin()}"`} autocomplete="${isLogin ? 'current-password' : 'new-password'}" ${isLogin ? '' : 'aria-describedby="f-pass-hint"'}>
                <button type="button" class="pass-toggle" aria-label="Mostrar contraseña" aria-pressed="false">${I.eye}</button></div>
              ${isLogin ? '' : `<small class="field-hint" id="f-pass-hint">Mínimo ${passMin()} caracteres.</small>`}
            </div>
          </div>
          <button class="btn btn-primary btn-block" type="submit">${isLogin ? 'Ingresar' : 'Completar registro'}</button>
        </form>
        <div class="auth-switch">
          ${isLogin ? '¿Aún no posee una cuenta profesional? <button type="button" id="switch-link">Regístrese</button>'
                    : '¿Ya posee una cuenta profesional? <button type="button" id="switch-link">Inicie sesión</button>'}
        </div>
      </div>
    </main>`;

    document.getElementById('switch-link').addEventListener('click', () => {
      location.hash = isLogin ? '#/register' : '#/login';
    });
    // Mostrar u ocultar la contraseña facilita el acceso sin memorizar ni transcribir (WCAG 3.3.8).
    const passToggle = APP.querySelector('.pass-toggle');
    passToggle.addEventListener('click', () => {
      const input = document.getElementById('f-pass');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      passToggle.setAttribute('aria-pressed', String(show));
      passToggle.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
      passToggle.innerHTML = show ? I.eyeOff : I.eye;
    });
    viewReady(isLogin ? 'Acceso' : 'Registro');

    const form = document.getElementById('auth-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('auth-error');
      errBox.classList.remove('show');
      // Validación en el propio formulario, con un mensaje claro y el foco en el campo pendiente.
      const firstInvalid = [...form.elements].find((el) => el.willValidate && !el.checkValidity());
      if (firstInvalid) {
        const label = form.querySelector(`label[for="${firstInvalid.id}"]`);
        errBox.textContent = firstInvalid.validity.valueMissing
          ? `El campo «${label ? label.childNodes[0].textContent.trim() : 'requerido'}» es obligatorio.`
          : firstInvalid.type === 'email' ? 'La dirección de correo electrónico no resulta válida.'
          : firstInvalid.name === 'password' ? `La contraseña debe constar de un mínimo de ${passMin()} caracteres.`
          : 'Revise los datos consignados.';
        errBox.classList.add('show');
        firstInvalid.focus();
        return;
      }
      const payload = Object.fromEntries(new FormData(form).entries());
      const submitBtn = form.querySelector('button[type=submit]');
      await withBusy(submitBtn, 'Procesando solicitud…', async () => {
        try {
          const data = await api('POST', isLogin ? '/api/auth/login' : '/api/auth/register', payload);
          state.user = data.user;
          toast(isLogin ? `Bienvenido nuevamente, ${doctorPrefix(data.user.sexo)} ${data.user.nombre}` : 'Cuenta profesional registrada satisfactoriamente');
          location.hash = '#/inicio';
        } catch (err) {
          errBox.textContent = err.message;
          errBox.classList.add('show');
        }
      });
    });
  }, { auth: true });
}

/* ==========================================================================
   INICIO — mosaico de especialidades + actividad reciente
   ========================================================================== */

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

function renderHome(nav) {
  withIrisTransition(async () => {
    shell(SKV.home(), 'inicio');
    let sp;
    try {
      sp = await api('GET', '/api/specialties');
    } catch (err) {
      if (!isStale(nav)) document.getElementById('view-root').innerHTML = emptyState('search', 'No fue posible cargar la información', escapeHtml(err.message), '<button type="button" class="btn btn-primary btn-sm" data-retry>Reintentar</button>');
      return;
    }
    if (isStale(nav)) return;

    const u = state.user;
    const all = sp.specialties;
    const totals = all.reduce((a, s) => ({ doc: a.doc + s.doctores, pac: a.pac + s.pacientes, mat: a.mat + s.materiales }), { doc: 0, pac: 0, mat: 0 });
    totals.mat += sp.general.materiales;
    const activas = all.filter((s) => s.doctores > 0).length;

    // Orden: la especialidad propia primero; luego las que tienen facultativos; luego alfabético.
    const sorted = [...all].sort((a, b) =>
      (b.slug === u.especialidad_slug) - (a.slug === u.especialidad_slug) ||
      b.doctores - a.doctores ||
      a.nombre.localeCompare(b.nombre, 'es'));
    const isFeatured = (s) => s.slug === u.especialidad_slug || s.doctores > 0 || s.materiales > 0;
    const featuredCount = sorted.filter(isFeatured).length;

    const root = document.getElementById('view-root');
    root.innerHTML = `
      <section class="home-hero">
        <div>
          <span class="eyebrow">${escapeHtml(u.especialidad)}</span>
          <h1>${greeting()}, ${escapeHtml(doctorPrefix(u.sexo))} ${escapeHtml(u.apellidos.split(' ')[0])}</h1>
          <p class="page-sub">Consulte las carpetas clínicas y la biblioteca de cualquier especialidad del hospital.</p>
        </div>
        <button type="button" class="hero-search" id="hero-search" aria-keyshortcuts="Control+K">
          ${I.search}<span>Buscar facultativos, pacientes, historias clínicas…</span><kbd aria-hidden="true">Ctrl K</kbd>
        </button>
      </section>

      <dl class="stat-row stat-row-4">
        <div class="stat-card view-enter" style="${staggerStyle(0)}"><dt class="stat-label">Especialidades activas</dt><dd class="stat-num" data-count="${activas}">${activas}</dd></div>
        <div class="stat-card view-enter" style="${staggerStyle(1)}"><dt class="stat-label">Facultativos</dt><dd class="stat-num" data-count="${totals.doc}">${totals.doc}</dd></div>
        <div class="stat-card view-enter" style="${staggerStyle(2)}"><dt class="stat-label">Pacientes</dt><dd class="stat-num" data-count="${totals.pac}">${totals.pac}</dd></div>
        <div class="stat-card stat-online view-enter" style="${staggerStyle(3)}"><dt class="stat-label">En línea ahora</dt><dd class="stat-num"><span class="pulse-dot" aria-hidden="true"></span><span data-online-count>${state.presence.count}</span></dd></div>
      </dl>

      <section class="card-panel panel-anchor" aria-labelledby="sp-title">
        <div class="panel-head">
          <h2 id="sp-title">Especialidades</h2>
          <div class="inline-search">
            ${I.search}
            <input id="sp-filter" type="search" placeholder="Filtrar especialidades…" aria-label="Filtrar especialidades">
          </div>
        </div>
        <p class="sr-only" id="sp-status" role="status"></p>
        <div class="sp-grid" id="sp-grid" data-magnify="1.32" data-mag-radius="230"></div>
        <div class="sp-more" id="sp-more"></div>
      </section>
    `;

    animateCounters(root);
    document.getElementById('hero-search').addEventListener('click', openSearchPalette);

    let showAll = false;
    const grid = document.getElementById('sp-grid');
    const more = document.getElementById('sp-more');
    const filterInput = document.getElementById('sp-filter');

    function draw() {
      const f = normalize(filterInput.value);
      const list = f ? sorted.filter((s) => normalize(s.nombre).includes(f)) : showAll ? sorted : sorted.filter(isFeatured);
      grid.innerHTML = list.length
        ? list.map((s, i) => specialtyTileHtml(s, i, s.slug === u.especialidad_slug)).join('')
        : '<p class="muted-note">Ninguna especialidad coincide con el filtro.</p>';
      if (f) document.getElementById('sp-status').textContent = plural(list.length, 'especialidad coincide', 'especialidades coinciden');
      const hidden = sorted.length - featuredCount;
      more.innerHTML = !f && hidden > 0
        ? `<button type="button" class="btn btn-ghost btn-sm" id="sp-toggle" aria-expanded="${showAll}">${showAll ? 'Mostrar solo las especialidades con actividad' : `Mostrar las ${hidden} especialidades restantes`}</button>`
        : '';
      const t = document.getElementById('sp-toggle');
      if (t) t.addEventListener('click', () => { showAll = !showAll; draw(); });
    }
    filterInput.addEventListener('input', draw);
    draw();
    viewReady('Especialidades');
  });
}

function specialtyTileHtml(s, i, mine) {
  return `
  <a class="sp-tile view-enter ${mine ? 'sp-tile-mine' : ''}" style="${staggerStyle(i)};--h:${specialtyHue(s.slug)}" href="#/especialidad/${s.slug}" data-shared>
    <span class="sp-mono" aria-hidden="true" data-shared-figure data-mag>${specialtyMonogram(s.nombre)}</span>
    <span class="sp-body">
      <span class="sp-name" data-shared-title>${escapeHtml(s.nombre)}</span>
      <span class="sp-meta" title="${plural(s.doctores, 'facultativo', 'facultativos')} · ${plural(s.pacientes, 'paciente', 'pacientes')}">${s.doctores} fac. · ${s.pacientes} pac.</span>
    </span>
    ${s.en_linea ? `<span class="sp-online" title="${plural(s.en_linea, 'facultativo en línea', 'facultativos en línea')}"><i aria-hidden="true"></i>${s.en_linea}<span class="sr-only"> en línea</span></span>` : ''}
    ${mine ? '<span class="sp-mine-badge">Su especialidad</span>' : ''}
  </a>`;
}

function animateCounters(root) {
  if (prefersReducedMotion()) return;
  root.querySelectorAll('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count);
    if (!target) return;
    const start = performance.now();
    const dur = 700;
    const step = (now) => {
      const p = Math.min(1, (now - start) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/* ==========================================================================
   ESPECIALIDAD — facultativos y biblioteca de la especialidad
   ========================================================================== */

function renderSpecialty(nav, slug, initialTab) {
  withIrisTransition(async () => {
    takeSharedHint();
    // El nombre de la especialidad ya está en el catálogo: el encabezado se pinta de inmediato.
    const knownSp = state.catalog.specialties.find((x) => x.slug === slug);
    shell(SKV.specialty(knownSp ? { title: knownSp.nombre, figure: specialtyMonogram(knownSp.nombre), hue: specialtyHue(knownSp.slug) } : null), 'inicio');
    let sp;
    try {
      sp = (await api('GET', `/api/specialties/${encodeURIComponent(slug || '')}`)).specialty;
    } catch (err) {
      if (isStale(nav)) return;
      toast(err.message, 'error');
      location.hash = '#/inicio';
      return;
    }
    if (isStale(nav)) return;

    const root = document.getElementById('view-root');
    root.innerHTML = `
      <a href="#/inicio" class="back-link">&larr; Todas las especialidades</a>
      <header class="sp-header ${knownSp ? '' : 'view-enter'}" style="--h:${specialtyHue(sp.slug)}">
        <span class="sp-mono sp-mono-lg vt-figure" aria-hidden="true">${specialtyMonogram(sp.nombre)}</span>
        <div class="sp-header-text">
          <span class="eyebrow">Especialidad</span>
          <h1 class="vt-title">${escapeHtml(sp.nombre)}</h1>
          <p class="sp-header-meta">
            ${plural(sp.doctores, 'facultativo', 'facultativos')} · ${plural(sp.pacientes, 'paciente', 'pacientes')}
            ${sp.en_linea ? ` · <span class="online-inline"><i aria-hidden="true"></i>${sp.en_linea} en línea</span>` : ''}
          </p>
          <p class="sp-admin-line">${I.shield.replace('width="20" height="20"', 'width="14" height="14" aria-hidden="true"')}
            ${sp.administrador
              ? `<span>Administrador: <a href="#/doctor/${sp.administrador.id}">${escapeHtml(sp.administrador.nombre)}</a></span>`
              : '<span>Sin administrador designado · revisa el administrador maestro</span>'}
          </p>
        </div>
      </header>
      <div class="tabs-block">
        <div class="tabs" role="tablist" aria-label="Secciones de la especialidad">
          <button type="button" role="tab" class="tab" data-tab="facultativos">Facultativos <span class="tab-count">${sp.doctores}</span></button>
          <button type="button" role="tab" class="tab" data-tab="biblioteca">Biblioteca <span class="tab-count">${sp.materiales}</span></button>
          <span class="tab-ink" aria-hidden="true"></span>
        </div>
        <div class="panel-anchor" role="tabpanel" id="sp-panel" tabindex="0"></div>
      </div>
    `;

    wireTabs(root.querySelector('.tabs-block'), {
      initial: initialTab === 'biblioteca' ? 'biblioteca' : 'facultativos',
      onShow: (t, body) => {
        if (t === 'facultativos') mountDoctorsPanel(body, sp.slug);
        else mountLibraryPanel(body, { fixedSlug: sp.slug });
      },
    });
    viewReady(sp.nombre);
  });
}

function moveTabInk(root) {
  const ink = root.querySelector('.tab-ink');
  const active = root.querySelector('.tab.active');
  if (!ink || !active) return;
  ink.style.width = `${active.offsetWidth}px`;
  ink.style.transform = `translateX(${active.offsetLeft}px)`;
}

/**
 * Pestañas accesibles (patrón WAI-ARIA): tablist/tab/tabpanel enlazados, tabindex itinerante,
 * flechas, Inicio y Fin. El panel entra deslizándose desde el lado de la pestaña elegida.
 */
let tabSeq = 0;
function wireTabs(block, { initial, onShow }) {
  const list = block.querySelector('[role="tablist"]');
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  const panel = block.querySelector('[role="tabpanel"]');
  const uid = `tabs-${++tabSeq}`;
  if (!panel.id) panel.id = `${uid}-panel`;
  tabs.forEach((t) => { t.id = `${uid}-${t.dataset.tab}`; t.setAttribute('aria-controls', panel.id); });
  let current = null;
  function show(key, focus = false) {
    const idx = Math.max(0, tabs.findIndex((t) => t.dataset.tab === key));
    const prev = tabs.findIndex((t) => t.dataset.tab === current);
    current = tabs[idx].dataset.tab;
    tabs.forEach((t, i) => {
      const on = i === idx;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', tabs[idx].id);
    moveTabInk(list);
    panel.classList.remove('view-enter', 'slide-from-right', 'slide-from-left');
    void panel.offsetWidth;
    panel.classList.add(prev < 0 ? 'view-enter' : idx > prev ? 'slide-from-right' : 'slide-from-left');
    if (focus) tabs[idx].focus();
    onShow(current, panel);
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => { if (t.dataset.tab !== current) show(t.dataset.tab); });
    t.addEventListener('keydown', (e) => {
      const n = tabs.length;
      const j = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : null;
      if (j === null) return;
      e.preventDefault();
      show(tabs[j].dataset.tab, true);
    });
  });
  show(initial);
  return { show, get current() { return current; } };
}

/** Grupo de botones excluyentes (segmentos): estado anunciado con aria-pressed. */
function wireSegments(group, onPick) {
  const btns = [...group.querySelectorAll('button')];
  btns.forEach((b) => {
    b.setAttribute('aria-pressed', b.classList.contains('active') ? 'true' : 'false');
    b.addEventListener('click', () => {
      if (b.classList.contains('active')) return;
      btns.forEach((x) => { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      moveSegInk(group);
      onPick(b);
    });
  });
  requestAnimationFrame(() => moveSegInk(group));
}

/** Indicador deslizante bajo el segmento activo. */
function moveSegInk(group) {
  let ink = group.querySelector('.seg-ink');
  const active = group.querySelector('button.active');
  if (!active) return;
  if (!ink) { ink = document.createElement('span'); ink.className = 'seg-ink'; ink.setAttribute('aria-hidden', 'true'); group.prepend(ink); }
  ink.style.width = `${active.offsetWidth}px`;
  ink.style.height = `${active.offsetHeight}px`;
  ink.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
  group.classList.add('has-ink');
}

function doctorCardHtml(d, i) {
  const me = d.id === state.user.id;
  return `
  <a class="folder-card view-enter" style="${staggerStyle(i)}" href="#/doctor/${d.id}" aria-label="Consultar carpeta clínica de ${escapeHtml(d.folder_title)}" data-shared>
    <div class="fc-top">
      <div class="fc-avatar" aria-hidden="true" data-shared-figure>${initials(d.nombre, d.apellidos)}${d.online ? '<span class="online-dot" title="En línea"></span>' : ''}</div>
      ${me ? '<span class="fc-badge-me">Su carpeta</span>' : ''}
    </div>
    <h2 class="card-title" data-shared-title>${escapeHtml(d.folder_title)}</h2>
    <span class="fc-specialty">${escapeHtml(d.subespecialidad || d.especialidad)}</span>
    <div class="fc-meta">
      <span class="fc-phone">${I.phone.replace('<svg', '<svg aria-hidden="true"')} ${escapeHtml(d.telefono)}</span>
      <span><span class="fc-count">${d.total_pacientes}</span> pac.</span>
    </div>
  </a>`;
}

function mountDoctorsPanel(el, slug) {
  el.innerHTML = `
    <div class="toolbar">
      <div class="search-input">
        ${I.search}
        <input type="search" class="dp-q" placeholder="Localizar facultativo…" aria-label="Localizar facultativo">
      </div>
    </div>
    <div class="dp-list" aria-live="polite">${skWrap(SK.folderCards(6), 'Cargando facultativos')}</div>`;
  const list = el.querySelector('.dp-list');
  const qInput = el.querySelector('.dp-q');
  let page = 1;
  let seq = 0;

  async function load() {
    const my = ++seq;
    const q = qInput.value.trim();
    try {
      const d = await api('GET', `/api/doctors?especialidad=${encodeURIComponent(slug)}&q=${encodeURIComponent(q)}&page=${page}`);
      if (my !== seq) return;
      if (!d.items.length) {
        fade(list).html = q
          ? emptyState('search', 'Sin coincidencias', `Ningún facultativo coincide con «${escapeHtml(q)}».`)
          : emptyState('users', 'Aún no hay facultativos registrados', 'Cuando los facultativos de esta especialidad se registren, sus carpetas clínicas aparecerán aquí.');
        return;
      }
      fade(list).html = `<div class="folder-grid focus-group focus-hover">${d.items.map(doctorCardHtml).join('')}</div>${pagerHtml(d)}`;
      bindPager(list, (p) => { page = p; load(); });
    } catch (err) {
      if (my === seq) fade(list).html = `<div class="empty-state"><p>${escapeHtml(err.message)}</p></div>`;
    }
  }
  qInput.addEventListener('input', debounce(() => { page = 1; load(); }, 250));
  load();
}

/* ==========================================================================
   CARPETA CLÍNICA DE UN FACULTATIVO
   ========================================================================== */

function renderDoctorFolder(nav, doctorId) {
  withIrisTransition(async () => {
    const isMine = Number(doctorId) === state.user.id;
    const hint = takeSharedHint();
    const knownDoc = hint && hint.title
      ? { title: hint.title, figure: hint.figure }
      : isMine ? { title: state.user.folder_title, figure: initials(state.user.nombre, state.user.apellidos) } : null;
    shell(SKV.folder(knownDoc), isMine ? 'micarpeta' : 'inicio');
    let doctor, isOwner;
    try {
      const data = await api('GET', `/api/doctors/${encodeURIComponent(doctorId)}`);
      doctor = data.doctor;
      isOwner = data.is_owner;
    } catch (err) {
      if (isStale(nav)) return;
      toast(err.message, 'error');
      location.hash = '#/inicio';
      return;
    }
    if (isStale(nav)) return;

    let sort = state.sortView[doctorId] || doctor.sort_pref;
    let page = 1;
    const root = document.getElementById('view-root');
    root.innerHTML = `
      <a href="#/especialidad/${doctor.especialidad_slug}" class="back-link">&larr; ${escapeHtml(doctor.especialidad)}</a>
      <div class="folder-header ${knownDoc ? '' : 'view-enter'}">
        <div class="folder-header-left">
          <div class="fh-avatar vt-figure" aria-hidden="true">${initials(doctor.nombre, doctor.apellidos)}${doctor.online ? '<span class="online-dot"></span>' : ''}</div>
          <div class="fh-text">
            <h1 class="vt-title">${escapeHtml(doctor.folder_title)}</h1>
            <div class="fh-meta">
              <a class="chip" href="#/especialidad/${doctor.especialidad_slug}" style="--h:${specialtyHue(doctor.especialidad_slug)}">${escapeHtml(doctor.especialidad)}</a>
              ${doctor.subespecialidad ? `<span class="chip chip-plain">${escapeHtml(doctor.subespecialidad)}</span>` : ''}
              <a class="fh-phone" href="tel:${escapeHtml(doctor.telefono.replace(/[^\d+]/g, ''))}" aria-label="Llamar al ${escapeHtml(doctor.telefono)}">${I.phone.replace('<svg', '<svg aria-hidden="true"')} ${escapeHtml(doctor.telefono)}</a>
              ${doctor.online ? '<span class="online-inline"><i aria-hidden="true"></i>En línea</span>' : ''}
            </div>
          </div>
        </div>
        <div class="fh-actions">
          ${isOwner ? `<button id="add-patient-btn" class="btn btn-gold btn-sm">${I.plus} Incorporar paciente</button>
                       ${moreButton('id="folder-more"', 'Más acciones de la carpeta')}`
                    : '<span class="text-view-hint">Modalidad de consulta</span>'}
        </div>
      </div>

      <div class="toolbar panel-anchor">
        <div class="search-input">
          ${I.search}
          <input id="patient-search" type="search" placeholder="Nombre, historia clínica, carnet o diagnóstico…" aria-label="Localizar paciente">
        </div>
        <div class="sort-toggle seg" id="sort-toggle" role="group" aria-label="Orden de los pacientes">
          <button type="button" data-sort="alpha" class="${sort === 'alpha' ? 'active' : ''}">A–Z</button>
          <button type="button" data-sort="fecha" class="${sort === 'fecha' ? 'active' : ''}">Recientes</button>
        </div>
      </div>
      <div id="patient-list-wrap" aria-live="polite">${skWrap(SK.patientCards(6), 'Cargando pacientes')}</div>
    `;

    const wrap = document.getElementById('patient-list-wrap');
    const qInput = document.getElementById('patient-search');
    let seq = 0;

    async function loadPatients() {
      const my = ++seq;
      const q = qInput.value.trim();
      try {
        const d = await api('GET', `/api/patients/doctor/${encodeURIComponent(doctorId)}?sort=${sort}&q=${encodeURIComponent(q)}&page=${page}`);
        if (my !== seq) return;
        if (!d.items.length) {
          fade(wrap).html = q
            ? emptyState('search', 'Sin coincidencias', `Ningún paciente coincide con «${escapeHtml(q)}».`)
            : emptyState('folder', 'Aún no se han incorporado pacientes', isOwner ? 'Abra la primera hoja de cargo de esta carpeta clínica.' : 'El médico titular aún no ha incorporado pacientes a esta carpeta clínica.',
              isOwner ? `<button type="button" class="btn btn-gold btn-sm" id="empty-add">${I.plus} Incorporar paciente</button>` : '');
          const ea = document.getElementById('empty-add');
          if (ea) ea.addEventListener('click', () => openPatientModal(doctorId));
          return;
        }
        fade(wrap).html = `<ul class="patient-list focus-group focus-hover" aria-label="Pacientes">${d.items.map((p, i) => `
          <li class="view-enter" style="${staggerStyle(i)}"><a class="patient-card" href="#/patient/${p.id}" data-shared>
            <h2 class="card-title" data-shared-title>${hl(`${p.nombre} ${p.apellidos}`, q)}</h2>
            <p class="pc-dx">${p.diagnostico ? hl(p.diagnostico, q) : '<span class="muted">Sin diagnóstico consignado</span>'}</p>
            <div class="pc-tags">
              <span class="patient-tag"><span class="sr-only">Edad: </span>${p.edad} años</span>
              <span class="patient-tag"><span class="sr-only">Sexo: </span>${p.sexo === 'F' ? 'F' : 'M'}</span>
              ${p.photo_count ? `<span class="patient-tag gold">${plural(p.photo_count, 'foto', 'fotos')}</span>` : ''}
              ${p.note_count ? `<span class="patient-tag">${plural(p.note_count, 'nota', 'notas')}</span>` : ''}
            </div>
            <div class="patient-meta-line">
              <span>HC: ${hl(p.historia_clinica || '—', q)}</span>
              <span>${fmtDate(p.created_at)}</span>
            </div>
          </a></li>`).join('')}</ul>${pagerHtml(d)}`;
        bindPager(wrap, (pg) => { page = pg; loadPatients(); });
      } catch (err) {
        if (my === seq) fade(wrap).html = emptyState('search', 'No fue posible cargar los pacientes', escapeHtml(err.message));
      }
    }

    wireSegments(document.getElementById('sort-toggle'), async (btn) => {
      sort = btn.dataset.sort;
      state.sortView[doctorId] = sort;
      page = 1;
      loadPatients();
      if (isOwner) {
        try { await api('PATCH', `/api/doctors/${doctorId}/sort-pref`, { sort_pref: sort }); } catch (_) {}
      }
    });
    qInput.addEventListener('input', debounce(() => { page = 1; loadPatients(); }, 250));
    loadPatients();

    if (isOwner) {
      document.getElementById('add-patient-btn').addEventListener('click', () => openPatientModal(doctorId));
      document.getElementById('folder-more').addEventListener('click', (e) => openActionMenu(e.currentTarget, [
        { label: 'Modificar carpeta', icon: I.edit, id: 'edit-folder-btn', onClick: () => openEditFolderModal(doctor) },
        { label: 'Copiar enlace de la carpeta', icon: I.folder.replace('width="20" height="20"', 'width="16" height="16"'), onClick: () => copyLink() },
      ], 'Acciones de la carpeta'));
    }
    viewReady(doctor.folder_title);
  });
}

function openEditFolderModal(doctor) {
  const backdrop = openModal(`
    <h2>Modificación de la Carpeta Clínica</h2>
    <span class="modal-sub">Las modificaciones aquí consignadas serán visibles para la totalidad del cuerpo facultativo. Esta función es prerrogativa exclusiva del médico titular.</span>
    <div class="form-error" id="ef-error" role="alert"></div>
    <form id="edit-folder-form">
      <div class="field-row">
        <div class="field"><label>Nombre</label><input name="nombre" value="${escapeHtml(doctor.nombre)}" required></div>
        <div class="field"><label>Apellidos</label><input name="apellidos" value="${escapeHtml(doctor.apellidos)}" required></div>
      </div>
      <div class="field-row stack-mobile">
        <div class="field"><label>Especialidad</label><select name="especialidad_slug" required>${specialtyOptions(doctor.especialidad_slug)}</select></div>
        <div class="field"><label>Subespecialidad o área <span class="opt">(opcional)</span></label><input name="subespecialidad" value="${escapeHtml(doctor.subespecialidad || '')}"></div>
      </div>
      <div class="field"><label>Teléfono de contacto</label><input name="telefono" type="tel" value="${escapeHtml(doctor.telefono)}" required></div>
      <div class="field">
        <label>Denominación personalizada de la carpeta <span class="opt">(opcional)</span></label>
        <input name="folder_title" placeholder="Ej.: Dr. Julio César — Segmento Anterior" value="${escapeHtml(doctor.custom_title || '')}">
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="ef-cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">Registrar modificaciones</button>
      </div>
    </form>
  `);
  backdrop.querySelector('#ef-cancel').addEventListener('click', () => backdrop.remove());
  const form = backdrop.querySelector('#edit-folder-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    await withBusy(form.querySelector('[type=submit]'), 'Registrando…', async () => {
      try {
        const d = await api('PATCH', `/api/doctors/${doctor.id}`, payload);
        // El chip superior y el menú reflejan de inmediato el cambio de nombre o especialidad.
        state.user = { ...state.user, ...d.doctor };
        toast('Carpeta clínica actualizada satisfactoriamente');
        backdrop.remove();
        refreshView();
      } catch (err) {
        showFormError(backdrop, '#ef-error', err.message);
      }
    });
  });
}

function openPatientModal(doctorId, patient = null) {
  const isEdit = !!patient;
  const v = (k) => (isEdit ? escapeHtml(patient[k] ?? '') : '');
  const backdrop = openModal(`
    <h2>${isEdit ? 'Modificación de la Hoja de Cargo' : 'Apertura de Hoja de Cargo'}</h2>
    <span class="modal-sub">El presente formulario constituye la hoja de cargo del paciente, de carácter obligatorio para garantizar la continuidad del seguimiento clínico.</span>
    <div class="form-error" id="pf-error" role="alert"></div>
    <form id="patient-form">
      <div class="field-row">
        <div class="field"><label>Nombre</label><input name="nombre" required value="${v('nombre')}"></div>
        <div class="field"><label>Apellidos</label><input name="apellidos" required value="${v('apellidos')}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Edad</label><input type="number" inputmode="numeric" min="0" max="130" step="1" name="edad" required value="${v('edad')}"></div>
        <div class="field">
          <label>Sexo</label>
          <select name="sexo" required>
            <option value="">Seleccione</option>
            <option value="M" ${isEdit && patient.sexo === 'M' ? 'selected' : ''}>Masculino</option>
            <option value="F" ${isEdit && patient.sexo === 'F' ? 'selected' : ''}>Femenino</option>
          </select>
        </div>
      </div>
      <div class="field"><label>Diagnóstico</label><textarea name="diagnostico" rows="2">${v('diagnostico')}</textarea></div>
      <div class="field-row">
        <div class="field"><label>Número de historia clínica</label><input name="historia_clinica" value="${v('historia_clinica')}"></div>
        <div class="field"><label>Número de carnet de identidad</label><input name="carnet_identidad" inputmode="numeric" value="${v('carnet_identidad')}"></div>
      </div>
      <div class="field"><label>CAS (conducta)</label><textarea name="cas" rows="2">${v('cas')}</textarea></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="pf-cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Registrar modificaciones' : 'Consignar paciente'}</button>
      </div>
    </form>
  `, { wide: true });
  backdrop.querySelector('#pf-cancel').addEventListener('click', () => backdrop.remove());
  const form = backdrop.querySelector('#patient-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    await withBusy(form.querySelector('[type=submit]'), 'Registrando…', async () => {
      try {
        if (isEdit) {
          await api('PATCH', `/api/patients/${patient.id}`, payload);
          toast('Expediente del paciente actualizado satisfactoriamente');
          backdrop.remove();
          refreshView();
        } else {
          const d = await api('POST', `/api/patients/doctor/${doctorId}`, payload);
          toast('Paciente incorporado satisfactoriamente');
          backdrop.remove();
          location.hash = `#/patient/${d.patient.id}`;
        }
      } catch (err) {
        showFormError(backdrop, '#pf-error', err.message);
      }
    });
  });
}

/* ==========================================================================
   EXPEDIENTE DEL PACIENTE — hoja de cargo, evolución y fotografías
   ========================================================================== */

function renderPatient(nav, patientId) {
  withIrisTransition(async () => {
    const hint = takeSharedHint();
    const knownPat = hint && hint.title ? { title: hint.title } : null;
    shell(SKV.patient(knownPat), 'inicio');
    let data;
    try {
      data = await api('GET', `/api/patients/${encodeURIComponent(patientId)}`);
    } catch (err) {
      if (isStale(nav)) return;
      toast(err.message, 'error');
      location.hash = '#/inicio';
      return;
    }
    if (isStale(nav)) return;
    const { patient, doctor, is_owner: isOwner } = data;
    const fullName = `${patient.nombre} ${patient.apellidos}`;

    const root = document.getElementById('view-root');
    root.innerHTML = `
      <a href="#/doctor/${patient.doctor_id}" class="back-link">&larr; Carpeta de ${escapeHtml(doctor ? doctor.nombre : 'facultativo')}</a>

      <article class="record-card ${knownPat ? '' : 'view-enter'}" aria-labelledby="record-title">
        <p class="print-only print-head">IslaVisual · Hoja de Cargo · impresa el ${escapeHtml(fmtDateTime(new Date().toISOString()))}</p>
        <div class="record-title-row">
          <div class="record-title">
            <h1 id="record-title" class="vt-title">${escapeHtml(fullName)}</h1>
            <span class="page-sub">Hoja de Cargo · ${doctor ? `${escapeHtml(doctor.nombre)} · ${escapeHtml(specialtyName(doctor.especialidad_slug))} · ` : ''}actualizada ${escapeHtml(relTime(patient.updated_at))}</span>
          </div>
          <div class="fh-actions no-print">
            ${isOwner
              ? `<button id="edit-patient-btn" class="btn btn-ghost btn-sm">${I.edit} Modificar</button>`
              : '<span class="text-view-hint">Modalidad de consulta</span>'}
            ${moreButton('id="patient-more"', 'Más acciones del expediente')}
          </div>
        </div>
        <dl class="record-grid">
          <div class="record-field"><dt class="rf-label">Edad</dt><dd class="rf-value">${patient.edad} años</dd></div>
          <div class="record-field"><dt class="rf-label">Sexo</dt><dd class="rf-value">${patient.sexo === 'F' ? 'Femenino' : 'Masculino'}</dd></div>
          <div class="record-field"><dt class="rf-label">Historia clínica</dt><dd class="rf-value mono">${escapeHtml(patient.historia_clinica || '—')}</dd></div>
          <div class="record-field"><dt class="rf-label">Carnet de identidad</dt><dd class="rf-value mono">${escapeHtml(patient.carnet_identidad || '—')}</dd></div>
          <div class="record-field wide"><dt class="rf-label">Diagnóstico</dt><dd class="rf-value">${escapeHtml(patient.diagnostico || '—')}</dd></div>
          <div class="record-field wide"><dt class="rf-label">CAS (conducta)</dt><dd class="rf-value"><span class="cas-pill">${escapeHtml(patient.cas || 'Sin definir')}</span></dd></div>
        </dl>
      </article>

      <div class="tabs-block">
        <div class="tabs no-print" role="tablist" aria-label="Secciones del expediente">
          <button type="button" role="tab" class="tab" data-tab="notas">Evolución clínica <span class="tab-count" id="notes-count">…</span></button>
          <button type="button" role="tab" class="tab" data-tab="fotos">Fotografías <span class="tab-count" id="photos-count">…</span></button>
          <span class="tab-ink" aria-hidden="true"></span>
        </div>
        <div class="panel-anchor" role="tabpanel" id="patient-tab-body" tabindex="0"></div>
      </div>
    `;

    wireTabs(root.querySelector('.tabs-block'), {
      initial: state.patientTab === 'fotos' ? 'fotos' : 'notas',
      onShow: (t, body) => {
        state.patientTab = t;
        if (t === 'notas') mountNotesPanel(body, patient, isOwner);
        else mountPhotosPanel(body, patient, isOwner);
      },
    });

    // Conteos de ambas pestañas (se muestran aunque la pestaña no esté abierta)
    api('GET', `/api/patients/${patient.id}/notes?limit=1`).then((d) => {
      const el = document.getElementById('notes-count');
      if (el) el.textContent = d.total;
    }).catch(() => {});
    api('GET', `/api/photos/patient/${patient.id}`).then((d) => {
      const el = document.getElementById('photos-count');
      if (el) el.textContent = d.photos.length;
    }).catch(() => {});

    const deletePatient = async () => {
      if (!(await confirmDialog({ title: 'Suprimir expediente', message: `¿Confirma la supresión del expediente de ${fullName}, sus notas de evolución y la totalidad de su registro fotográfico? Esta acción es irreversible.`, confirmLabel: 'Suprimir' }))) return;
      try {
        await api('DELETE', `/api/patients/${patient.id}`);
        toast('Expediente suprimido satisfactoriamente');
        location.hash = `#/doctor/${patient.doctor_id}`;
      } catch (err) { toast(err.message, 'error'); }
    };
    document.getElementById('patient-more').addEventListener('click', (e) => openActionMenu(e.currentTarget, [
      { label: 'Imprimir hoja de cargo', icon: I.print, onClick: () => window.print() },
      { label: 'Copiar enlace del expediente', icon: I.folder.replace('width="20" height="20"', 'width="16" height="16"'), onClick: () => copyLink() },
      isOwner && { label: 'Suprimir expediente', icon: I.trash, danger: true, id: 'delete-patient-btn', onClick: deletePatient },
    ], 'Acciones del expediente'));
    if (isOwner) document.getElementById('edit-patient-btn').addEventListener('click', () => openPatientModal(patient.doctor_id, patient));
    viewReady(fullName);
  });
}

function mountNotesPanel(el, patient, isOwner) {
  el.innerHTML = `
    ${isOwner ? `
    <form class="note-composer" id="note-form">
      <label for="note-text" class="sr-only">Nueva nota de evolución</label>
      <textarea id="note-text" rows="1" maxlength="4000" placeholder="Consigne la evolución clínica del paciente…" aria-describedby="note-chars"></textarea>
      <div class="note-composer-foot">
        <span class="muted" id="note-chars">0 / 4000 · <kbd>Ctrl</kbd> <kbd>Intro</kbd> para consignar</span>
        <button type="submit" class="btn btn-primary btn-sm">Consignar nota</button>
      </div>
    </form>` : ''}
    <ol class="notes-timeline" id="notes-list" aria-label="Notas de evolución" aria-busy="true">${SK.notes(3)}</ol>
    <div id="notes-pager"></div>`;

  const listEl = el.querySelector('#notes-list');
  const pagerEl = el.querySelector('#notes-pager');
  let page = 1;
  let seq = 0;

  async function load() {
    const my = ++seq;
    try {
      const d = await api('GET', `/api/patients/${patient.id}/notes?page=${page}&limit=5`);
      if (my !== seq) return;
      listEl.removeAttribute('aria-busy');
      const countEl = document.getElementById('notes-count');
      if (countEl) countEl.textContent = d.total;
      if (!d.items.length) {
        listEl.innerHTML = `<li class="notes-empty">${isOwner ? 'Aún no se han consignado notas de evolución. Utilice el recuadro superior para registrar la primera.' : 'El médico titular aún no ha consignado notas de evolución.'}</li>`;
        pagerEl.innerHTML = '';
        return;
      }
      listEl.innerHTML = d.items.map((n, i) => `
        <li class="note view-enter" style="${staggerStyle(i)}">
          <div class="note-head">
            <time datetime="${escapeHtml(n.created_at)}">${escapeHtml(fmtDateTime(n.created_at))}</time>
            <span class="note-author">${escapeHtml(n.autor)}</span>
            ${isOwner ? `<button type="button" class="icon-btn icon-btn-sm note-del no-print" data-id="${n.id}" title="Suprimir nota" aria-label="Suprimir nota del ${escapeHtml(fmtDateTime(n.created_at))}">${I.x}</button>` : ''}
          </div>
          <p class="note-text">${escapeHtml(n.texto)}</p>
        </li>`).join('');
      pagerEl.innerHTML = pagerHtml(d);
      bindPager(pagerEl, (p) => { page = p; load(); });
      listEl.querySelectorAll('.note-del').forEach((b) => b.addEventListener('click', async () => {
        if (!(await confirmDialog({ title: 'Suprimir nota', message: '¿Confirma la supresión de esta nota de evolución? Esta acción es irreversible.', confirmLabel: 'Suprimir' }))) return;
        try {
          const li = b.closest('.note');
          if (li && !prefersReducedMotion()) { li.classList.add('item-out'); await new Promise((r) => setTimeout(r, 240)); }
          await api('DELETE', `/api/patients/${patient.id}/notes/${b.dataset.id}`);
          toast('Nota suprimida satisfactoriamente');
          load();
        } catch (err) { toast(err.message, 'error'); load(); }
      }));
    } catch (err) {
      if (my === seq) listEl.innerHTML = `<li class="notes-empty">${escapeHtml(err.message)}</li>`;
    }
  }

  if (isOwner) {
    const form = el.querySelector('#note-form');
    const ta = el.querySelector('#note-text');
    const chars = el.querySelector('#note-chars');
    const sync = () => {
      chars.firstChild.textContent = `${ta.value.length} / 4000 · `;
      form.classList.toggle('has-text', ta.value.length > 0);
    };
    ta.addEventListener('input', sync);
    // Ctrl/Cmd+Enter consigna la nota sin soltar el teclado.
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) form.requestSubmit(); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const texto = ta.value.trim();
      if (!texto) { ta.focus(); return; }
      await withBusy(form.querySelector('[type=submit]'), 'Consignando…', async () => {
        try {
          await api('POST', `/api/patients/${patient.id}/notes`, { texto });
          ta.value = '';
          sync();
          ta.blur();
          toast('Nota de evolución consignada satisfactoriamente');
          page = 1;
          load();
        } catch (err) { toast(err.message, 'error'); }
      });
    });
  }
  load();
}

function mountPhotosPanel(el, patient, isOwner) {
  const PER_PAGE = 8;
  let page = 1;
  let photos = [];
  el.innerHTML = `
    ${isOwner ? `<div class="panel-actions"><button id="upload-photo-btn" class="btn btn-gold btn-sm">${I.plus} Incorporar fotografía</button></div>` : ''}
    <div id="photo-grid-wrap" aria-live="polite">${skWrap(SK.photos(4), 'Cargando fotografías')}</div>`;
  const wrap = el.querySelector('#photo-grid-wrap');

  async function load() {
    try {
      photos = (await api('GET', `/api/photos/patient/${patient.id}`)).photos;
      const countEl = document.getElementById('photos-count');
      if (countEl) countEl.textContent = photos.length;
      draw();
    } catch (err) {
      fade(wrap).html = emptyState('photo', 'No fue posible cargar las fotografías', escapeHtml(err.message));
    }
  }

  function draw() {
    if (!photos.length) {
      fade(wrap).html = emptyState('photo', 'Sin registro fotográfico', isOwner ? 'Incorpore la primera fotografía de seguimiento clínico.' : 'El médico titular aún no ha incorporado registro fotográfico a este expediente.');
      return;
    }
    const pages = Math.max(1, Math.ceil(photos.length / PER_PAGE));
    page = Math.min(page, pages);
    const slice = photos.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    fade(wrap).html = `<ul class="photo-grid focus-group focus-hover" aria-label="Registro fotográfico">${slice.map((ph, i) => `
      <li class="photo-card view-enter" style="${staggerStyle(i)}">
        <button type="button" class="photo-thumb" data-lightbox="${ph.id}" aria-label="Ampliar fotografía del ${escapeHtml(fmtDate(ph.fecha_foto))}: ${escapeHtml(ph.descripcion)}">
          <img src="/media/photos/${encodeURIComponent(ph.filename)}" alt="" loading="lazy">
        </button>
        <div class="photo-card-body">
          <div class="photo-card-head">
            <time class="photo-date" datetime="${escapeHtml(ph.fecha_foto)}">${fmtDate(ph.fecha_foto)}</time>
            ${isOwner ? `<span class="photo-card-actions">
              <button type="button" class="icon-btn icon-btn-sm edit-photo-btn" data-id="${ph.id}" title="Modificar fotografía" aria-label="Modificar fotografía del ${escapeHtml(fmtDate(ph.fecha_foto))}">${I.edit}</button>
              <button type="button" class="icon-btn icon-btn-sm icon-btn-danger del-photo-btn" data-id="${ph.id}" title="Suprimir fotografía" aria-label="Suprimir fotografía del ${escapeHtml(fmtDate(ph.fecha_foto))}">${I.trash}</button>
            </span>` : ''}
          </div>
          <p class="photo-desc">${escapeHtml(ph.descripcion)}</p>
        </div>
      </li>`).join('')}</ul>${pagerHtml({ page, pages, total: photos.length })}`;

    const byId = Object.fromEntries(photos.map((p) => [String(p.id), p]));
    bindPager(wrap, (p) => { page = p; draw(); });
    wrap.querySelectorAll('[data-lightbox]').forEach((b) => b.addEventListener('click', () => openLightbox(byId[b.dataset.lightbox])));
    wrap.querySelectorAll('.edit-photo-btn').forEach((b) => b.addEventListener('click', () => openEditPhotoModal(byId[b.dataset.id], load)));
    wrap.querySelectorAll('.del-photo-btn').forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmDialog({ title: 'Suprimir fotografía', message: '¿Confirma la supresión de esta fotografía? Esta acción es irreversible.', confirmLabel: 'Suprimir' }))) return;
      try {
        await api('DELETE', `/api/photos/${b.dataset.id}`);
        toast('Registro fotográfico suprimido satisfactoriamente');
        load();
      } catch (err) { toast(err.message, 'error'); }
    }));
  }

  if (isOwner) el.querySelector('#upload-photo-btn').addEventListener('click', () => openUploadPhotoModal(patient.id, () => { page = 1; load(); }));
  load();
}

function openLightbox(photo) {
  const backdrop = document.createElement('div');
  backdrop.className = 'lightbox-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', 'Fotografía de seguimiento clínico');
  backdrop.innerHTML = `
    <button class="icon-btn lightbox-close" id="lb-close" aria-label="Cerrar">✕</button>
    <img src="/media/photos/${encodeURIComponent(photo.filename)}" alt="Fotografía de seguimiento clínico">
    <div class="lightbox-info">
      <div class="photo-date">${fmtDate(photo.fecha_foto)}</div>
      <p>${escapeHtml(photo.descripcion)}</p>
    </div>`;
  document.body.appendChild(backdrop);
  activateLayer(backdrop, backdrop);
  backdrop.querySelector('.lightbox-close').focus();
  const close = () => backdrop.remove();
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  backdrop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  backdrop.querySelector('#lb-close').addEventListener('click', close);
}

function wireDropzone(backdrop, { dzSel, inputSel, onFile }) {
  const dz = backdrop.querySelector(dzSel);
  const input = backdrop.querySelector(inputSel);
  dz.addEventListener('click', () => input.click());
  dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('dragover'); }));
  dz.addEventListener('drop', (e) => { if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); });
  input.addEventListener('change', () => { if (input.files[0]) onFile(input.files[0]); });
}

function openUploadPhotoModal(patientId, onDone) {
  const backdrop = openModal(`
    <h2>Incorporación de Registro Fotográfico</h2>
    <span class="modal-sub">La descripción clínica y la fecha de captura constituyen campos de carácter obligatorio.</span>
    <div class="form-error" id="up-error" role="alert"></div>
    <form id="upload-photo-form">
      <div class="dropzone" id="dropzone" tabindex="0" role="button">
        <strong>Pulse para seleccionar una imagen</strong> o arrástrela hasta este recuadro<br>JPG, PNG o WEBP · máx. 15 MB
        <img class="preview-thumb" id="preview-thumb" alt="">
      </div>
      <input type="file" id="photo-input" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" style="display:none">
      <div class="field"><label>Descripción</label><textarea name="descripcion" rows="2" required placeholder="Ej.: Postoperatorio día 1, OD, facoemulsificación"></textarea></div>
      <div class="field"><label>Fecha de captura fotográfica</label><input type="date" name="fecha_foto" required value="${todayISO()}" max="${todayISO()}"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="up-cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary" id="up-submit">Incorporar fotografía</button>
      </div>
    </form>`);
  const preview = backdrop.querySelector('#preview-thumb');
  let selectedFile = null;
  wireDropzone(backdrop, {
    dzSel: '#dropzone',
    inputSel: '#photo-input',
    onFile: (f) => {
      if (f.size > 15 * 1024 * 1024) { showFormError(backdrop, '#up-error', 'La imagen excede el tamaño máximo de 15 MB.'); return; }
      selectedFile = f;
      if (preview.src) URL.revokeObjectURL(preview.src);
      preview.src = URL.createObjectURL(f);
      preview.style.display = 'block';
    },
  });

  backdrop.querySelector('#up-cancel').addEventListener('click', () => backdrop.remove());
  const form = backdrop.querySelector('#upload-photo-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedFile) { showFormError(backdrop, '#up-error', 'Debe seleccionar una imagen para continuar.'); return; }
    const fd = new FormData(form);
    fd.append('photo', selectedFile);
    await withBusy(backdrop.querySelector('#up-submit'), 'Incorporando…', async () => {
      try {
        await api('POST', `/api/photos/patient/${patientId}`, fd, true);
        toast('Registro fotográfico incorporado satisfactoriamente');
        backdrop.remove();
        onDone();
      } catch (err) {
        showFormError(backdrop, '#up-error', err.message);
      }
    });
  });
}

function openEditPhotoModal(photo, onDone) {
  const backdrop = openModal(`
    <h2>Modificación del Registro Fotográfico</h2>
    <div class="form-error" id="epf-error" role="alert"></div>
    <form id="edit-photo-form">
      <img src="/media/photos/${encodeURIComponent(photo.filename)}" class="modal-preview" alt="">
      <div class="field"><label>Descripción</label><textarea name="descripcion" rows="2" required>${escapeHtml(photo.descripcion)}</textarea></div>
      <div class="field"><label>Fecha de captura</label><input type="date" name="fecha_foto" required value="${escapeHtml(photo.fecha_foto)}" max="${todayISO()}"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="epf-cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">Registrar modificaciones</button>
      </div>
    </form>`);
  backdrop.querySelector('#epf-cancel').addEventListener('click', () => backdrop.remove());
  const form = backdrop.querySelector('#edit-photo-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    await withBusy(form.querySelector('[type=submit]'), 'Registrando…', async () => {
      try {
        await api('PATCH', `/api/photos/${photo.id}`, payload);
        toast('Registro fotográfico actualizado satisfactoriamente');
        backdrop.remove();
        onDone();
      } catch (err) {
        showFormError(backdrop, '#epf-error', err.message);
      }
    });
  });
}

/* ==========================================================================
   BIBLIOTECA CLÍNICA
   ========================================================================== */

function renderLibrary(nav) {
  withIrisTransition(async () => {
    shell('', 'biblioteca');
    if (isStale(nav)) return;
    const root = document.getElementById('view-root');
    root.innerHTML = `
      <div class="page-head page-head-compact">
        <div>
          <span class="eyebrow">Acervo Bibliográfico</span>
          <h1>Biblioteca Clínica</h1>
          <p class="page-sub">Material de consulta de todas las especialidades. Se publica una vez aprobado por el administrador de cada especialidad.</p>
        </div>
      </div>
      <div id="lib-panel" class="panel-anchor"></div>`;
    const initialQuery = state.pendingLibraryQuery || '';
    state.pendingLibraryQuery = null;
    mountLibraryPanel(document.getElementById('lib-panel'), { fixedSlug: null, initialQuery });
    viewReady('Biblioteca Clínica');
  });
}

const LIB_CATS = [['', 'Todo'], ['documento', 'Documentos'], ['imagen', 'Imágenes'], ['video', 'Videos']];

/**
 * Panel reutilizable de la biblioteca.
 * fixedSlug: si se indica, muestra el material de esa especialidad más el material General.
 * vista: 'publicado' | 'mias' | 'pendientes'. lockView: oculta el selector de vista (panel de aprobaciones).
 *
 * Ley de Hick: la barra muestra solo lo esencial (búsqueda, «Filtros» y la acción principal).
 * La especialidad y el tipo de material quedan dentro del panel de filtros; los filtros
 * activos se muestran como etiquetas que se retiran con un clic.
 */
function mountLibraryPanel(el, { fixedSlug = null, initialQuery = '', vista = 'publicado', lockView = false, onChange = null } = {}) {
  const u = state.user;
  const approver = canApprove(u);
  let page = 1;
  let categoria = '';
  let especialidad = '';
  let seq = 0;
  const views = [['publicado', 'Publicado'], ['mias', 'Mis propuestas']];
  if (approver) views.push(['pendientes', 'Por revisar']);
  const canFilterSpecialty = !fixedSlug && !(lockView && !isMaster(u));

  el.innerHTML = `
    ${lockView ? '' : `
    <div class="seg view-switch" role="group" aria-label="Vista de la biblioteca">
      ${views.map(([v, label]) => `<button type="button" data-vista="${v}" class="${v === vista ? 'active' : ''}">${label}${v === 'pendientes' ? ` <span class="nav-badge" data-pending-count ${state.pending ? '' : 'hidden'}>${state.pending}</span>` : ''}</button>`).join('')}
    </div>`}
    <div class="toolbar lib-toolbar">
      <div class="search-input">
        ${I.search}
        <input type="search" class="lib-q" placeholder="Localizar material…" aria-label="Localizar material" value="${escapeHtml(initialQuery)}">
      </div>
      <button type="button" class="btn btn-ghost btn-sm filter-btn" aria-label="Filtros" aria-haspopup="dialog" aria-expanded="false">${I.filter}<span class="btn-label">Filtros</span><span class="filter-count" hidden></span></button>
      ${lockView ? '' : `<button type="button" class="btn btn-gold btn-sm lib-upload" aria-label="${approver ? 'Incorporar material' : 'Proponer material'}">${I.plus}<span class="btn-label">${approver ? 'Incorporar' : 'Proponer'}</span></button>`}
    </div>
    <div class="active-filters" aria-live="polite"></div>
    <div class="lib-list" aria-live="polite">${skWrap(SK.libraryCards(4), 'Cargando material')}</div>`;

  const list = el.querySelector('.lib-list');
  const qInput = el.querySelector('.lib-q');
  const filterBtn = el.querySelector('.filter-btn');
  const chipsEl = el.querySelector('.active-filters');

  function emptyMessage(filtered) {
    if (filtered) return ['search', 'Sin coincidencias', 'Ningún material coincide con los filtros aplicados.'];
    if (vista === 'mias') return ['book', 'Aún no ha propuesto material', 'Utilice «Proponer» para enviar un recurso a la Biblioteca Clínica. Quedará visible para todos una vez aprobado.'];
    if (vista === 'pendientes') return ['check', 'No hay propuestas por revisar', 'Cuando los facultativos de su ámbito propongan material, aparecerá aquí para su aprobación.'];
    return ['book', 'Aún no se ha publicado material', 'Proponga el primer recurso mediante el control dispuesto en la parte superior.'];
  }

  function renderChips() {
    const chips = [];
    if (especialidad) chips.push(['sp', specialtyName(especialidad)]);
    if (categoria) chips.push(['cat', LIB_CATS.find(([k]) => k === categoria)[1]]);
    const count = el.querySelector('.filter-count');
    count.hidden = !chips.length;
    count.textContent = chips.length;
    filterBtn.classList.toggle('is-active', chips.length > 0);
    chipsEl.innerHTML = chips.length ? `${chips.map(([k, label]) => `<button type="button" class="filter-chip" data-k="${k}" aria-label="Quitar filtro ${escapeHtml(label)}">${escapeHtml(label)} ${I.x}</button>`).join('')}
      ${chips.length > 1 ? '<button type="button" class="link-btn" data-k="all">Quitar todos</button>' : ''}` : '';
    chipsEl.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.k === 'sp' || b.dataset.k === 'all') especialidad = '';
      if (b.dataset.k === 'cat' || b.dataset.k === 'all') categoria = '';
      page = 1;
      renderChips();
      load();
      qInput.focus();
    }));
  }

  function openFilters() {
    const pop = openPopover(filterBtn, `
      <div class="filter-panel">
        ${canFilterSpecialty ? `<div class="field"><label for="flt-sp">Especialidad</label>
          <select id="flt-sp">${specialtyOptions(especialidad, { includeGeneral: true, placeholder: 'Todas las especialidades' })}</select></div>` : ''}
        <fieldset class="field">
          <legend>Tipo de material</legend>
          <div class="seg seg-block" role="group" aria-label="Tipo de material">
            ${LIB_CATS.map(([k, label]) => `<button type="button" data-cat="${k}" class="${categoria === k ? 'active' : ''}">${label}</button>`).join('')}
          </div>
        </fieldset>
      </div>`, 'pop-filters', { label: 'Filtros de la biblioteca' });
    if (!pop) return;
    const sel = pop.querySelector('#flt-sp');
    if (sel) sel.addEventListener('change', () => { especialidad = sel.value; page = 1; renderChips(); load(); });
    wireSegments(pop.querySelector('.seg'), (b) => { categoria = b.dataset.cat; page = 1; renderChips(); load(); });
  }

  async function load() {
    const my = ++seq;
    const params = new URLSearchParams({ page: String(page), q: qInput.value.trim(), vista });
    if (fixedSlug) { params.set('especialidad', fixedSlug); params.set('incluir_general', '1'); }
    else if (especialidad) params.set('especialidad', especialidad);
    if (categoria) params.set('categoria', categoria);
    try {
      const d = await api('GET', `/api/library?${params}`);
      if (my !== seq) return;
      if (!d.items.length) {
        const [kind, t, m] = emptyMessage(qInput.value.trim() || categoria || especialidad);
        fade(list).html = emptyState(kind, t, m);
        return;
      }
      fade(list).html = `<ul class="library-grid focus-group focus-hover" aria-label="Material bibliográfico">${d.items.map((it, i) => libraryCardHtml(it, i, !fixedSlug || it.especialidad_slug !== fixedSlug)).join('')}</ul>${pagerHtml(d)}`;
      bindPager(list, (p) => { page = p; load(); });
      const byId = Object.fromEntries(d.items.map((i) => [String(i.id), i]));
      const after = () => { load(); pollPresence(); if (onChange) onChange(); };
      const del = async (it) => {
        const msg = it.estado === 'aprobado'
          ? '¿Confirma la supresión de este material publicado? Dejará de estar disponible para todo el cuerpo facultativo. Esta acción es irreversible.'
          : '¿Confirma la supresión de esta propuesta? Esta acción es irreversible.';
        if (!(await confirmDialog({ title: 'Suprimir material', message: msg, confirmLabel: 'Suprimir' }))) return;
        try {
          await api('DELETE', `/api/library/${it.id}`);
          toast('Material suprimido satisfactoriamente');
          after();
        } catch (err) { toast(err.message, 'error'); }
      };
      list.querySelectorAll('.lib-open-btn').forEach((b) => b.addEventListener('click', () => openLibraryLightbox(byId[b.dataset.id])));
      list.querySelectorAll('.lib-more').forEach((b) => b.addEventListener('click', () => {
        const it = byId[b.dataset.id];
        openActionMenu(b, [
          { label: it.es_propio && !it.puede_gestionar ? 'Corregir y reenviar' : 'Modificar', icon: I.edit, onClick: () => openEditLibraryModal(it, after) },
          { label: it.estado === 'aprobado' ? 'Suprimir material' : 'Suprimir propuesta', icon: I.trash, danger: true, onClick: () => del(it) },
        ], `Acciones de ${it.titulo}`);
      }));
      list.querySelectorAll('.lib-approve-btn').forEach((b) => b.addEventListener('click', () => withBusy(b, 'Aprobando…', async () => {
        try {
          await api('POST', `/api/library/${b.dataset.id}/approve`);
          toast('Material aprobado y publicado en la Biblioteca Clínica');
          const card = b.closest('.library-card');
          if (card && !prefersReducedMotion()) { card.classList.add('card-approved'); await new Promise((r) => setTimeout(r, 520)); }
          after();
        } catch (err) { toast(err.message, 'error'); }
      })));
      list.querySelectorAll('.lib-reject-btn').forEach((b) => b.addEventListener('click', () => openRejectModal(byId[b.dataset.id], after)));
    } catch (err) {
      if (my === seq) fade(list).html = emptyState('search', 'No fue posible cargar el material', escapeHtml(err.message));
    }
  }

  const vs = el.querySelector('.view-switch');
  if (vs) wireSegments(vs, (b) => { vista = b.dataset.vista; page = 1; load(); });
  filterBtn.addEventListener('click', openFilters);
  qInput.addEventListener('input', debounce(() => { page = 1; load(); }, 250));
  const upBtn = el.querySelector('.lib-upload');
  if (upBtn) {
    upBtn.addEventListener('click', () => openUploadLibraryModal(fixedSlug || especialidad || '', (item) => {
      page = 1;
      // Tras proponer, el facultativo ve su propuesta en «Mis propuestas».
      if (item && item.estado !== 'aprobado' && vista !== 'mias') {
        const tab = el.querySelector('.view-switch [data-vista="mias"]');
        if (tab) { tab.click(); return; }
      }
      load();
    }));
  }
  renderChips();
  load();
}

function libraryCardHtml(it, idx, showSpecialty) {
  const url = `/media/biblioteca/${encodeURIComponent(it.filename)}`;
  const icon = it.categoria === 'video' ? I.video : it.categoria === 'imagen' ? I.image : I.doc;
  const canEdit = it.puede_gestionar || (it.es_propio && it.estado !== 'aprobado');
  const statusHtml = it.estado === 'pendiente'
    ? `<span class="status-pill status-pending">Pendiente</span>`
    : it.estado === 'rechazado'
      ? `<span class="status-pill status-rejected">Rechazado</span>`
      : it.es_propio ? `<span class="status-pill status-approved">Publicado</span>` : '';
  const catLabel = { documento: 'Documento', imagen: 'Imagen', video: 'Video' }[it.categoria] || 'Documento';
  return `
  <li class="library-card view-enter ${it.file_missing ? 'lib-missing' : ''} ${it.estado !== 'aprobado' ? `lib-${it.estado}` : ''}" style="${staggerStyle(idx)}">
    <button type="button" class="lib-card-preview lib-cat-${it.categoria} lib-open-btn" data-id="${it.id}" aria-label="Ver ${escapeHtml(it.titulo)} (${catLabel})" ${it.file_missing ? 'disabled' : ''}>
      ${it.categoria === 'imagen' && !it.file_missing
        ? `<img src="${url}" alt="" loading="lazy">`
        : `<span class="lib-icon" aria-hidden="true">${icon}</span>`}
      ${showSpecialty ? `<span class="lib-sp-chip" style="--h:${specialtyHue(it.especialidad_slug)}">${escapeHtml(it.especialidad_slug === 'general' ? 'General' : it.especialidad)}</span>` : ''}
      ${statusHtml}
    </button>
    <div class="lib-card-body">
      <h2 class="card-title">${escapeHtml(it.titulo)}</h2>
      ${it.descripcion ? `<p class="lib-desc">${escapeHtml(it.descripcion)}</p>` : ''}
      ${it.estado === 'rechazado' && it.motivo_rechazo ? `<p class="lib-reject-note"><strong>Motivo:</strong> ${escapeHtml(it.motivo_rechazo)}${it.es_propio ? ' Corrija la propuesta y se reenviará a revisión.' : ''}</p>` : ''}
      ${it.file_missing ? `<p class="lib-missing-note">Archivo no disponible en el servidor${it.puede_gestionar ? ': vuelva a incorporarlo.' : '.'}</p>` : ''}
      <p class="lib-meta">
        <span title="Propuesto por ${escapeHtml(it.uploader_nombre || '—')}">${escapeHtml(it.uploader_nombre || '—')}</span>
        <time datetime="${escapeHtml(it.created_at)}">${fmtDate(it.created_at)}</time>
      </p>
      ${it.estado === 'pendiente' && it.puede_gestionar ? `
      <div class="lib-review">
        <button type="button" class="btn btn-primary btn-sm lib-approve-btn" data-id="${it.id}" aria-label="Aprobar ${escapeHtml(it.titulo)}">Aprobar</button>
        <button type="button" class="btn btn-ghost btn-sm lib-reject-btn" data-id="${it.id}" aria-label="Rechazar ${escapeHtml(it.titulo)}">Rechazar</button>
      </div>` : ''}
      <div class="lib-actions">
        ${it.file_missing ? '' : `
        <button type="button" class="btn btn-ghost btn-sm lib-open-btn" data-id="${it.id}" aria-label="Ver ${escapeHtml(it.titulo)}">Ver</button>
        <a class="icon-btn icon-btn-sm" href="${url}" download="${escapeHtml(it.original_name || it.titulo)}" title="Descargar archivo" aria-label="Descargar ${escapeHtml(it.titulo)}">${I.download}</a>`}
        ${canEdit ? moreButton(`data-id="${it.id}"`, `Más acciones de ${it.titulo}`).replace('more-btn', 'more-btn lib-more') : ''}
      </div>
    </div>
  </li>`;
}

function openLibraryLightbox(item) {
  const url = `/media/biblioteca/${encodeURIComponent(item.filename)}`;
  const ext = ((item.original_name || item.filename).split('.').pop() || '').toLowerCase();
  let mediaHtml;
  if (item.categoria === 'imagen') {
    mediaHtml = `<img src="${url}" alt="${escapeHtml(item.titulo)}">`;
  } else if (item.categoria === 'video') {
    mediaHtml = `<video src="${url}" controls autoplay playsinline></video>`;
  } else if (ext === 'pdf') {
    mediaHtml = `<iframe src="${url}" title="${escapeHtml(item.titulo)}"></iframe>`;
  } else {
    mediaHtml = `
      <div class="lib-lightbox-fallback">
        <span class="lib-icon">${I.doc}</span>
        <p>La vista previa no está disponible para este formato de archivo.</p>
        <a class="btn btn-primary" href="${url}" download="${escapeHtml(item.original_name || item.titulo)}">Descargar archivo</a>
      </div>`;
  }
  const backdrop = document.createElement('div');
  backdrop.className = 'lightbox-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', 'Vista previa del material bibliográfico');
  backdrop.innerHTML = `
    <button class="icon-btn lightbox-close" id="lib-lb-close" aria-label="Cerrar">✕</button>
    ${mediaHtml}
    <div class="lightbox-info">
      <p class="lb-title">${escapeHtml(item.titulo)}</p>
      <p class="lb-sub">${escapeHtml(item.especialidad)}</p>
      ${item.descripcion ? `<p>${escapeHtml(item.descripcion)}</p>` : ''}
    </div>`;
  document.body.appendChild(backdrop);
  activateLayer(backdrop, backdrop);
  backdrop.querySelector('.lightbox-close').focus();
  const close = () => backdrop.remove();
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  backdrop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  backdrop.querySelector('#lib-lb-close').addEventListener('click', close);
}

function libraryTagOptions(selected) {
  const u = state.user;
  if (isMaster(u)) return specialtyOptions(selected, { includeGeneral: true });
  // Facultativos y administradores de especialidad: su especialidad o material General.
  const sel = selected === 'general' || selected === u.especialidad_slug ? selected : u.especialidad_slug;
  return specialtyOptions(sel, { includeGeneral: true, only: [u.especialidad_slug] });
}

function openUploadLibraryModal(preselectedSlug, onDone) {
  const u = state.user;
  const reviewNote = isMaster(u)
    ? 'Como administrador maestro, el material se publica de inmediato.'
    : isSpecialtyAdmin(u)
      ? `El material de ${escapeHtml(u.especialidad)} se publica de inmediato, pues usted administra esta especialidad.`
      : `Su propuesta será revisada por el administrador de ${escapeHtml(u.especialidad)} (o por el administrador maestro) y se publicará una vez aprobada.`;
  const backdrop = openModal(`
    <h2>${canApprove(u) ? 'Incorporación de Material Bibliográfico' : 'Propuesta de Material Bibliográfico'}</h2>
    <span class="modal-sub">Admite imágenes, video y documentos (PDF, Word, Excel, PowerPoint). Tamaño máximo: 150 MB.</span>
    <p class="review-note">${I.shield.replace('width="20" height="20"', 'width="15" height="15"')}<span>${reviewNote}</span></p>
    <div class="form-error" id="lib-error" role="alert"></div>
    <form id="library-form">
      <div class="dropzone" id="lib-dropzone" tabindex="0" role="button">
        <strong>Pulse para seleccionar un archivo</strong> o arrástrelo hasta este recuadro
        <div id="lib-file-name" class="dz-file"></div>
      </div>
      <input type="file" id="lib-file-input" accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.odt" style="display:none">
      <div class="field"><label>Título</label><input name="titulo" required placeholder="Ej.: Guía de manejo del glaucoma"></div>
      <div class="field"><label>Especialidad</label><select name="especialidad_slug" required>${libraryTagOptions(preselectedSlug)}</select></div>
      <div class="field"><label>Descripción <span class="opt">(opcional)</span></label><textarea name="descripcion" rows="2" placeholder="Breve reseña del contenido del material"></textarea></div>
      <div class="upload-progress" id="lib-progress" hidden><span></span></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="lib-cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary" id="lib-submit">${canApprove(u) ? 'Incorporar material' : 'Enviar propuesta'}</button>
      </div>
    </form>`);
  const fileNameEl = backdrop.querySelector('#lib-file-name');
  let selectedFile = null;
  let xhr = null;
  wireDropzone(backdrop, {
    dzSel: '#lib-dropzone',
    inputSel: '#lib-file-input',
    onFile: (f) => {
      if (f.size > 150 * 1024 * 1024) { showFormError(backdrop, '#lib-error', 'El archivo excede el tamaño máximo de 150 MB.'); return; }
      selectedFile = f;
      fileNameEl.textContent = `${f.name} · ${fmtBytes(f.size)}`;
      fileNameEl.style.display = 'block';
      const titulo = backdrop.querySelector('[name=titulo]');
      if (!titulo.value) titulo.value = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
    },
  });

  backdrop.querySelector('#lib-cancel').addEventListener('click', () => { if (xhr) xhr.abort(); backdrop.remove(); });
  const form = backdrop.querySelector('#library-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const errBox = backdrop.querySelector('#lib-error');
    errBox.classList.remove('show');
    if (!selectedFile) { showFormError(backdrop, '#lib-error', 'Debe seleccionar un archivo para continuar.'); return; }
    if (!form.titulo.value.trim()) { showFormError(backdrop, '#lib-error', 'El título constituye un campo obligatorio.'); return; }
    if (!form.especialidad_slug.value) { showFormError(backdrop, '#lib-error', 'Debe etiquetar el material con una especialidad.'); return; }

    // XMLHttpRequest permite mostrar el progreso real de subida (videos de hasta 150 MB).
    const fd = new FormData(form);
    fd.append('archivo', selectedFile);
    const submitBtn = backdrop.querySelector('#lib-submit');
    const bar = backdrop.querySelector('#lib-progress');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Incorporando… 0%';
    bar.hidden = false;
    xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/library');
    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable) return;
      const pct = Math.round((ev.loaded / ev.total) * 100);
      bar.firstElementChild.style.width = `${pct}%`;
      submitBtn.textContent = `Incorporando… ${pct}%`;
    };
    const fail = (msg) => {
      showFormError(backdrop, '#lib-error', msg);
      submitBtn.disabled = false;
      submitBtn.textContent = canApprove(u) ? 'Incorporar material' : 'Enviar propuesta';
      bar.hidden = true;
      bar.firstElementChild.style.width = '0';
    };
    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch (_) {}
      if (xhr.status >= 200 && xhr.status < 300) {
        const item = data && data.item;
        toast(item && item.estado === 'aprobado'
          ? 'Material publicado en la Biblioteca Clínica'
          : 'Propuesta enviada; se publicará una vez aprobada por la administración');
        backdrop.remove();
        onDone(item);
      } else {
        fail((data && data.error) || `Error ${xhr.status}`);
      }
    };
    xhr.onerror = () => fail('No fue posible completar la subida. Verifique su conexión e inténtelo nuevamente.');
    xhr.send(fd);
  });
}

function openEditLibraryModal(item, onDone) {
  const resubmits = !item.puede_gestionar; // propuesta propia no aprobada: al guardar vuelve a revisión
  const backdrop = openModal(`
    <h2>Modificación del Material</h2>
    ${resubmits && item.estado === 'rechazado' ? `<p class="review-note review-note-warn"><span><strong>Motivo del rechazo:</strong> ${escapeHtml(item.motivo_rechazo || '—')}</span></p>` : ''}
    ${resubmits ? '<span class="modal-sub">Al registrar los cambios, la propuesta se reenviará a revisión.</span>' : ''}
    <div class="form-error" id="libf-error" role="alert"></div>
    <form id="edit-library-form">
      <div class="field"><label>Título</label><input name="titulo" required value="${escapeHtml(item.titulo)}"></div>
      <div class="field"><label>Especialidad</label><select name="especialidad_slug" required>${isMaster(state.user) ? specialtyOptions(item.especialidad_slug, { includeGeneral: true }) : libraryTagOptions(item.especialidad_slug)}</select></div>
      <div class="field"><label>Descripción</label><textarea name="descripcion" rows="2">${escapeHtml(item.descripcion || '')}</textarea></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="libf-cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">${resubmits ? 'Reenviar a revisión' : 'Registrar modificaciones'}</button>
      </div>
    </form>`);
  backdrop.querySelector('#libf-cancel').addEventListener('click', () => backdrop.remove());
  const form = backdrop.querySelector('#edit-library-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    await withBusy(form.querySelector('[type=submit]'), 'Registrando…', async () => {
      try {
        const d = await api('PATCH', `/api/library/${item.id}`, payload);
        toast(d.reenviado ? 'Propuesta corregida y reenviada a revisión' : 'Material actualizado satisfactoriamente');
        backdrop.remove();
        onDone();
      } catch (err) {
        showFormError(backdrop, '#libf-error', err.message);
      }
    });
  });
}

function openRejectModal(item, onDone) {
  const backdrop = openModal(`
    <h2>Rechazo de propuesta</h2>
    <span class="modal-sub">«${escapeHtml(item.titulo)}», propuesto por ${escapeHtml(item.uploader_nombre || '—')}. El motivo se comunicará al facultativo para que pueda corregir y reenviar su propuesta.</span>
    <div class="form-error" id="rj-error" role="alert"></div>
    <form id="reject-form">
      <div class="field"><label for="rj-motivo">Motivo del rechazo</label>
        <textarea id="rj-motivo" name="motivo" rows="3" maxlength="500" required placeholder="Ej.: El documento está incompleto; adjunte la versión aprobada por el consejo científico."></textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="rj-cancel">Cancelar</button>
        <button type="submit" class="btn btn-danger-solid">Rechazar propuesta</button>
      </div>
    </form>`);
  backdrop.querySelector('#rj-cancel').addEventListener('click', () => backdrop.remove());
  const form = backdrop.querySelector('#reject-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const motivo = form.motivo.value.trim();
    if (!motivo) return showFormError(backdrop, '#rj-error', 'Debe consignar el motivo del rechazo.');
    await withBusy(form.querySelector('[type=submit]'), 'Registrando…', async () => {
      try {
        await api('POST', `/api/library/${item.id}/reject`, { motivo });
        toast('Propuesta rechazada; el facultativo verá el motivo');
        backdrop.remove();
        onDone();
      } catch (err) {
        showFormError(backdrop, '#rj-error', err.message);
      }
    });
  });
}

/* ==========================================================================
   CAMBIO DE CONTRASEÑA
   ========================================================================== */

function openPasswordModal() {
  const backdrop = openModal(`
    <h2>Cambio de contraseña</h2>
    <span class="modal-sub">Por seguridad, se cerrarán las sesiones abiertas en otros dispositivos.</span>
    <div class="form-error" id="pw-error" role="alert"></div>
    <form id="pw-form">
      <div class="field"><label>Contraseña vigente</label><input type="password" name="actual" required autocomplete="current-password"></div>
      <div class="field-row stack-mobile">
        <div class="field"><label>Nueva contraseña</label><input type="password" name="nueva" required minlength="${passMin()}" autocomplete="new-password"></div>
        <div class="field"><label>Confirme la nueva contraseña</label><input type="password" name="confirmar" required minlength="${passMin()}" autocomplete="new-password"></div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="pw-cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">Actualizar contraseña</button>
      </div>
    </form>`);
  backdrop.querySelector('#pw-cancel').addEventListener('click', () => backdrop.remove());
  const form = backdrop.querySelector('#pw-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { actual, nueva, confirmar } = Object.fromEntries(new FormData(form).entries());
    if (nueva.length < passMin()) return showFormError(backdrop, '#pw-error', `La nueva contraseña debe constar de un mínimo de ${passMin()} caracteres.`);
    if (nueva !== confirmar) return showFormError(backdrop, '#pw-error', 'La confirmación no coincide con la nueva contraseña.');
    await withBusy(form.querySelector('[type=submit]'), 'Actualizando…', async () => {
      try {
        await api('POST', '/api/auth/password', { actual, nueva });
        toast('Contraseña actualizada satisfactoriamente');
        backdrop.remove();
      } catch (err) {
        showFormError(backdrop, '#pw-error', err.message);
      }
    });
  });
}

/* ==========================================================================
   PANEL DE ADMINISTRACIÓN
   ========================================================================== */

function renderAdmin(nav) {
  withIrisTransition(async () => {
    const u = state.user;
    if (!canApprove(u)) {
      toast('No posee las prerrogativas administrativas requeridas para acceder a esta sección.', 'error');
      location.hash = '#/inicio';
      return;
    }
    const master = isMaster(u);
    shell(SKV.admin(master), 'admin');
    let stats = null;
    if (master) {
      try { stats = await api('GET', '/api/admin/stats'); } catch (err) {
        if (!isStale(nav)) toast(err.message, 'error');
        return;
      }
    }
    if (isStale(nav)) return;

    const root = document.getElementById('view-root');
    const tabs = master
      ? [['aprobaciones', 'Aprobaciones'], ['users', 'Facultativos'], ['especialidades', 'Especialidades'], ['backups', 'Respaldos']]
      : [['aprobaciones', 'Aprobaciones']];
    const stat = (i, label, value, extra = '') => `<div class="stat-card view-enter ${extra}" style="${staggerStyle(i)}"><dt class="stat-label">${label}</dt><dd class="stat-num">${value}</dd></div>`;
    root.innerHTML = `
      <div class="page-head page-head-compact">
        <div>
          <span class="eyebrow">${master ? 'Administración maestra' : `Administración · ${escapeHtml(u.especialidad)}`}</span>
          <h1>${master ? 'Panel de Administración' : 'Aprobaciones de la especialidad'}</h1>
          ${master ? '' : `<p class="page-sub">Revise el material que los facultativos de ${escapeHtml(u.especialidad)} proponen a la Biblioteca Clínica. Solo el material aprobado se publica.</p>`}
        </div>
      </div>
      ${master ? `
      <dl class="stat-row stat-row-6">
        ${stat(0, 'Facultativos', `<span data-count="${stats.totalUsers}">${stats.totalUsers}</span>`)}
        ${stat(1, 'Admin. de especialidad', `<span data-count="${stats.specialtyAdmins}">${stats.specialtyAdmins}</span>`)}
        ${stat(2, 'Pacientes', `<span data-count="${stats.totalPatients}">${stats.totalPatients}</span>`)}
        ${stat(3, 'Materiales publicados', `<span data-count="${stats.totalLibrary}">${stats.totalLibrary}</span>`)}
        ${stat(4, 'En línea ahora', `<span class="pulse-dot" aria-hidden="true"></span><span data-online-count>${stats.onlineNow}</span>`, 'stat-online')}
        ${stat(5, 'Almacenamiento', `<span class="stat-num-sm">${fmtBytes(stats.uploadsSizeBytes)}</span>`)}
      </dl>` : ''}
      <div class="tabs-block">
        ${tabs.length > 1 ? `
        <div class="tabs" role="tablist" aria-label="Secciones de administración">
          ${tabs.map(([k, label]) => `<button type="button" role="tab" class="tab" data-tab="${k}">${label}${k === 'aprobaciones' ? ` <span class="tab-count tab-count-alert" data-pending-count ${state.pending ? '' : 'hidden'}>${state.pending}</span>` : ''}</button>`).join('')}
          <span class="tab-ink" aria-hidden="true"></span>
        </div>` : ''}
        <div id="admin-content" class="panel-anchor" ${tabs.length > 1 ? 'role="tabpanel" tabindex="0"' : ''}></div>
      </div>
    `;
    animateCounters(root);
    const content = document.getElementById('admin-content');
    const mount = (t) => {
      state.adminTab = t;
      if (t === 'aprobaciones') mountLibraryPanel(content, { vista: 'pendientes', lockView: true });
      else if (t === 'users') mountAdminUsers(content);
      else if (t === 'especialidades') mountAdminSpecialties(content);
      else mountAdminBackups(content);
    };
    const initial = tabs.some(([k]) => k === state.adminTab) ? state.adminTab : 'aprobaciones';
    if (tabs.length > 1) wireTabs(root.querySelector('.tabs-block'), { initial, onShow: (t) => mount(t) });
    else mount('aprobaciones');
    viewReady(master ? 'Panel de Administración' : 'Aprobaciones');
  });
}

function roleCellHtml(u) {
  if (u.rol === 'maestro') return '<span class="role-pill role-maestro">Administrador maestro</span>';
  if (u.rol === 'especialidad') return '<span class="role-pill role-especialidad">Admin. de especialidad</span>';
  return '<span class="role-pill role-medico">Facultativo</span>';
}

/**
 * Filtros plegables reutilizables: un botón «Filtros» con contador y etiquetas de los filtros
 * activos. `fields` = [{ key, label, options: [[valor, texto]], value }].
 */
function mountFilterButton(btn, chipsEl, fields, onChange) {
  const render = () => {
    const active = fields.filter((f) => f.value);
    const count = btn.querySelector('.filter-count');
    count.hidden = !active.length;
    count.textContent = active.length;
    btn.classList.toggle('is-active', active.length > 0);
    chipsEl.innerHTML = active.map((f) => {
      const label = (f.options.find(([v]) => v === f.value) || [, f.value])[1];
      return `<button type="button" class="filter-chip" data-k="${f.key}" aria-label="Quitar filtro ${escapeHtml(label)}">${escapeHtml(label)} ${I.x}</button>`;
    }).join('');
    chipsEl.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => {
      fields.find((f) => f.key === b.dataset.k).value = '';
      render();
      onChange();
    }));
  };
  btn.addEventListener('click', () => {
    const pop = openPopover(btn, `<div class="filter-panel">${fields.map((f) => `
      <div class="field"><label for="flt-${f.key}">${f.label}</label>
        <select id="flt-${f.key}" data-k="${f.key}">${f.options.map(([v, t]) => `<option value="${escapeHtml(v)}" ${v === f.value ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}</select>
      </div>`).join('')}</div>`, 'pop-filters', { label: 'Filtros' });
    if (!pop) return;
    pop.querySelectorAll('select').forEach((s) => s.addEventListener('change', () => {
      fields.find((f) => f.key === s.dataset.k).value = s.value;
      render();
      onChange();
    }));
  });
  render();
}

const filterBtnHtml = () => `<button type="button" class="btn btn-ghost btn-sm filter-btn" aria-label="Filtros" aria-haspopup="dialog" aria-expanded="false">${I.filter}<span class="btn-label">Filtros</span><span class="filter-count" hidden></span></button>`;

function mountAdminUsers(content) {
  let page = 1;
  let seq = 0;
  const fields = [
    { key: 'especialidad', label: 'Especialidad', value: '', options: [['', 'Todas las especialidades'], ...state.catalog.specialties.map((s) => [s.slug, s.nombre])] },
    { key: 'rol', label: 'Rol', value: '', options: [['', 'Todos los roles'], ['maestro', 'Administradores maestros'], ['especialidad', 'Administradores de especialidad'], ['medico', 'Facultativos']] },
  ];
  content.innerHTML = `
    <div class="toolbar">
      <div class="search-input">${I.search}<input type="search" class="au-q" placeholder="Nombre, correo o teléfono…" aria-label="Localizar facultativo"></div>
      ${filterBtnHtml()}
    </div>
    <div class="active-filters" aria-live="polite"></div>
    <div class="au-list" aria-live="polite">${skWrap(SK.tableRows(8), 'Cargando facultativos')}</div>`;
  const list = content.querySelector('.au-list');
  const qInput = content.querySelector('.au-q');

  async function load() {
    const my = ++seq;
    try {
      const params = new URLSearchParams({ page: String(page), q: qInput.value.trim(), especialidad: fields[0].value, rol: fields[1].value });
      const d = await api('GET', `/api/admin/users?${params}`);
      if (my !== seq) return;
      if (!d.items.length) {
        fade(list).html = emptyState('search', 'Sin coincidencias', 'Ningún facultativo coincide con los filtros aplicados.');
        return;
      }
      fade(list).html = `
        <div class="table-wrap" role="region" aria-label="Cuerpo facultativo" tabindex="0">
          <table class="data-table">
            <caption class="sr-only">Cuerpo facultativo registrado, ${plural(d.total, 'facultativo', 'facultativos')}</caption>
            <thead><tr><th scope="col">Facultativo</th><th scope="col">Especialidad</th><th scope="col" class="col-contact">Contacto</th><th scope="col" class="col-num">Pac.</th><th scope="col">Rol</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead>
            <tbody class="focus-group">
              ${d.items.map((x, i) => `
                <tr class="row-enter" style="${staggerStyle(i)}">
                  <th scope="row"><span class="td-name">${x.online ? '<span class="online-dot online-dot-inline" title="En línea"></span><span class="sr-only">En línea: </span>' : ''}<a href="#/doctor/${x.id}">${escapeHtml(doctorPrefix(x.sexo))} ${escapeHtml(x.nombre)} ${escapeHtml(x.apellidos)}</a></span></th>
                  <td>${escapeHtml(x.especialidad)}</td>
                  <td class="col-contact"><div class="td-contact"><span>${escapeHtml(x.email)}</span><span class="mono">${escapeHtml(x.telefono)}</span></div></td>
                  <td class="col-num">${x.total_pacientes}</td>
                  <td>${roleCellHtml(x)}</td>
                  <td class="td-actions">
                    ${x.id === state.user.id ? '<span class="muted td-self">Su cuenta</span>' : moreButton(`data-id="${x.id}"`, `Gestionar a ${x.nombre} ${x.apellidos}`).replace('more-btn', 'more-btn au-more')}
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        ${pagerHtml(d)}`;
      bindPager(list, (p) => { page = p; load(); });
      const byId = Object.fromEntries(d.items.map((x) => [String(x.id), x]));
      list.querySelectorAll('.au-more').forEach((btn) => btn.addEventListener('click', () => {
        const x = byId[btn.dataset.id];
        const name = `${x.nombre} ${x.apellidos}`;
        openActionMenu(btn, [
          { label: 'Consultar carpeta clínica', icon: I.folder.replace('width="20" height="20"', 'width="16" height="16"'), onClick: () => { location.hash = `#/doctor/${x.id}`; } },
          x.rol === 'medico' && { label: `Designar admin. de ${x.especialidad}`, icon: I.shield.replace('width="20" height="20"', 'width="16" height="16"'), onClick: () => setSpecialtyAdmin(x, true, load) },
          x.rol === 'especialidad' && { label: 'Retirar como admin. de especialidad', icon: I.shield.replace('width="20" height="20"', 'width="16" height="16"'), onClick: () => setSpecialtyAdmin(x, false, load) },
          { label: x.is_admin ? 'Revocar administración maestra' : 'Conferir administración maestra', icon: I.key, onClick: () => setMaster(x, load) },
          { label: 'Suprimir facultativo', icon: I.trash, danger: true, onClick: () => deleteUser(x, load) },
        ], `Gestionar a ${name}`);
      }));
    } catch (err) {
      if (my === seq) fade(list).html = emptyState('search', 'No fue posible cargar el cuerpo facultativo', escapeHtml(err.message));
    }
  }
  qInput.addEventListener('input', debounce(() => { page = 1; load(); }, 250));
  mountFilterButton(content.querySelector('.filter-btn'), content.querySelector('.active-filters'), fields, () => { page = 1; load(); });
  load();
}

async function setSpecialtyAdmin(x, on, done) {
  const name = `${x.nombre} ${x.apellidos}`;
  const ok = on
    ? await confirmDialog({ title: 'Designar administrador de especialidad', message: `¿Designar a ${name} como administrador de ${x.especialidad}? Si la especialidad ya tiene un administrador, será reemplazado.`, confirmLabel: 'Designar', danger: false })
    : await confirmDialog({ title: 'Retirar administrador', message: `¿Retirar a ${name} como administrador de su especialidad? El material propuesto lo revisará el administrador maestro.`, confirmLabel: 'Retirar' });
  if (!ok) return;
  try {
    await api('PUT', `/api/admin/specialties/${encodeURIComponent(x.especialidad_slug)}/admin`, { user_id: on ? x.id : null });
    toast(on ? 'Administrador de especialidad designado satisfactoriamente' : 'Se retiró el rol de administrador de especialidad');
    done();
  } catch (err) { toast(err.message, 'error'); }
}

async function setMaster(x, done) {
  const name = `${x.nombre} ${x.apellidos}`;
  const make = !x.is_admin;
  const ok = await confirmDialog(make
    ? { title: 'Conferir administración maestra', message: `¿Conferir a ${name} las prerrogativas de administrador maestro? Podrá suprimir facultativos, designar administradores y restaurar copias de seguridad.`, confirmLabel: 'Conferir', danger: false }
    : { title: 'Revocar administración maestra', message: `¿Revocar a ${name} las prerrogativas de administrador maestro?`, confirmLabel: 'Revocar' });
  if (!ok) return;
  try {
    await api('PATCH', `/api/admin/users/${x.id}/admin`, { is_admin: make });
    toast(make ? 'Se han conferido las prerrogativas de administrador maestro' : 'Las prerrogativas de administrador maestro han sido revocadas');
    done();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteUser(x, done) {
  const name = `${x.nombre} ${x.apellidos}`;
  if (!(await confirmDialog({ title: 'Suprimir facultativo', message: `¿Confirma la supresión de ${name}, su carpeta clínica y la totalidad de sus expedientes y registros fotográficos? El material de biblioteca que haya incorporado se conservará. Esta acción es irreversible.`, confirmLabel: 'Suprimir' }))) return;
  try {
    await api('DELETE', `/api/admin/users/${x.id}`);
    toast('Facultativo suprimido del sistema satisfactoriamente');
    done();
  } catch (err) { toast(err.message, 'error'); }
}

/** Administradores de especialidad: una fila por especialidad y una única acción («Gestionar»). */
function mountAdminSpecialties(content) {
  const PER_PAGE = 10;
  let page = 1;
  let rows = [];
  let filter = '';
  let onlyWithout = false;
  content.innerHTML = `
    <div class="toolbar">
      <div class="search-input">${I.search}<input type="search" class="as-q" placeholder="Filtrar especialidades…" aria-label="Filtrar especialidades"></div>
      <label class="check-inline"><input type="checkbox" class="as-without"> Solo sin administrador</label>
    </div>
    <div class="as-list" aria-live="polite">${skWrap(SK.specRows(8), 'Cargando especialidades')}</div>`;
  const list = content.querySelector('.as-list');

  async function load() {
    try {
      // Primero las especialidades con facultativos registrados (las únicas en las que se puede designar).
      rows = (await api('GET', '/api/admin/specialties')).specialties
        .sort((a, b) => (b.candidatos.length > 0) - (a.candidatos.length > 0) || a.nombre.localeCompare(b.nombre, 'es'));
      draw();
    } catch (err) {
      fade(list).html = emptyState('search', 'No fue posible cargar las especialidades', escapeHtml(err.message));
    }
  }

  function draw() {
    const f = normalize(filter);
    const visible = rows.filter((r) => (!f || normalize(r.nombre).includes(f)) && (!onlyWithout || !r.administrador));
    const pages = Math.max(1, Math.ceil(visible.length / PER_PAGE));
    page = Math.min(page, pages);
    const slice = visible.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    if (!slice.length) {
      fade(list).html = emptyState('search', 'Sin coincidencias', 'Ninguna especialidad coincide con el filtro.');
      return;
    }
    fade(list).html = `
      <ul class="spec-admin-list focus-group" aria-label="Especialidades y sus administradores">
        ${slice.map((r, i) => `
          <li class="spec-admin-row view-enter" style="${staggerStyle(i)}">
            <span class="sp-mono sp-mono-sm" style="--h:${specialtyHue(r.slug)}" aria-hidden="true">${specialtyMonogram(r.nombre)}</span>
            <div class="sar-body">
              <strong>${escapeHtml(r.nombre)}</strong>
              <small>${r.administrador ? `Administrador: <a href="#/doctor/${r.administrador.id}">${escapeHtml(r.administrador.nombre)}</a>` : '<span class="sar-none">Sin administrador</span>'} · ${plural(r.candidatos.length, 'elegible', 'elegibles')}</small>
            </div>
            ${r.candidatos.length
              ? `<button type="button" class="btn btn-ghost btn-sm sar-manage" data-slug="${r.slug}" aria-label="Gestionar la administración de ${escapeHtml(r.nombre)}">${r.administrador ? 'Gestionar' : 'Designar'}</button>`
              : '<span class="muted sar-empty">Sin facultativos</span>'}
          </li>`).join('')}
      </ul>
      ${pagerHtml({ page, pages, total: visible.length })}`;
    bindPager(list, (p) => { page = p; draw(); });
    list.querySelectorAll('.sar-manage').forEach((btn) => btn.addEventListener('click', () => openSpecialtyAdminModal(rows.find((r) => r.slug === btn.dataset.slug), load)));
  }

  content.querySelector('.as-q').addEventListener('input', (e) => { filter = e.target.value; page = 1; draw(); });
  content.querySelector('.as-without').addEventListener('change', (e) => { onlyWithout = e.target.checked; page = 1; draw(); });
  load();
}

function openSpecialtyAdminModal(r, done) {
  const backdrop = openModal(`
    <h2>Administración de ${escapeHtml(r.nombre)}</h2>
    <span class="modal-sub">${r.administrador
      ? `Administrada actualmente por <strong>${escapeHtml(r.administrador.nombre)}</strong>. Puede reasignarla a otro facultativo de la especialidad o dejarla sin administrador.`
      : 'La especialidad no tiene administrador: el material que propongan sus facultativos lo revisa el administrador maestro.'}</span>
    <div class="form-error" id="sa-error" role="alert"></div>
    <form id="sa-form">
      <div class="field"><label>Facultativo que administrará la especialidad</label>
        <select name="user_id" required>
          <option value="">Seleccione un facultativo</option>
          ${r.candidatos.map((c) => `<option value="${c.id}" ${r.administrador && r.administrador.id === c.id ? 'selected' : ''}>${escapeHtml(c.nombre)}</option>`).join('')}
        </select>
      </div>
      <div class="modal-actions">
        ${r.administrador ? '<button type="button" class="btn btn-danger btn-sm-mobile" id="sa-clear">Dejar sin administrador</button><span class="spacer"></span>' : ''}
        <button type="button" class="btn btn-ghost" id="sa-cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">${r.administrador ? 'Reasignar' : 'Designar'}</button>
      </div>
    </form>`);
  backdrop.querySelector('#sa-cancel').addEventListener('click', () => backdrop.remove());
  const form = backdrop.querySelector('#sa-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = Number(form.user_id.value);
    if (!id) return showFormError(backdrop, '#sa-error', 'Seleccione el facultativo que administrará la especialidad.');
    if (r.administrador && r.administrador.id === id) return showFormError(backdrop, '#sa-error', 'Ese facultativo ya administra esta especialidad.');
    const name = form.user_id.options[form.user_id.selectedIndex].textContent;
    await withBusy(form.querySelector('[type=submit]'), 'Guardando…', async () => {
      try {
        await api('PUT', `/api/admin/specialties/${encodeURIComponent(r.slug)}/admin`, { user_id: id });
        toast(`${name} administra ahora ${r.nombre}`);
        backdrop.remove();
        done();
      } catch (err) { showFormError(backdrop, '#sa-error', err.message); }
    });
  });
  const clear = backdrop.querySelector('#sa-clear');
  if (clear) clear.addEventListener('click', () => withBusy(clear, 'Retirando…', async () => {
    try {
      await api('PUT', `/api/admin/specialties/${encodeURIComponent(r.slug)}/admin`, { user_id: null });
      toast('Administrador de especialidad retirado');
      backdrop.remove();
      done();
    } catch (err) { showFormError(backdrop, '#sa-error', err.message); }
  }));
}

function mountAdminBackups(content) {
  const PER_PAGE = 8;
  let page = 1;
  let backups = [];
  content.innerHTML = skWrap(`${SK.toolbar()}${SK.tableRows(6)}`, 'Cargando copias de seguridad');

  async function load() {
    try {
      backups = (await api('GET', '/api/admin/backups')).backups;
      draw();
    } catch (err) {
      content.innerHTML = emptyState('search', 'No fue posible cargar las copias', escapeHtml(err.message));
    }
  }

  const typeLabel = { auto: 'Automática', manual: 'Manual', 'pre-restore': 'Previa a restauración' };

  function draw() {
    const pages = Math.max(1, Math.ceil(backups.length / PER_PAGE));
    page = Math.min(page, pages);
    const slice = backups.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    fade(content).html = `
      <div class="panel-actions panel-actions-split">
        <p class="panel-note">Copias automáticas cada seis horas; se conservan las treinta más recientes y todas las manuales.</p>
        <button class="btn btn-gold btn-sm" id="new-backup-btn">${I.plus} Generar copia</button>
      </div>
      ${slice.length ? `
      <ul class="backup-list focus-group" aria-label="Copias de seguridad">
        ${slice.map((b, i) => `
          <li class="backup-row view-enter" style="${staggerStyle(i)}">
            <span class="backup-ic backup-${escapeHtml(b.type)}" aria-hidden="true">${I.shield.replace('width="20" height="20"', 'width="16" height="16"')}</span>
            <div class="backup-body">
              <strong><time datetime="${escapeHtml(b.created_at)}">${fmtDateTime(b.created_at)}</time></strong>
              <small>${escapeHtml(typeLabel[b.type] || b.type)} · ${fmtBytes(b.size_bytes)} · <span class="mono">${escapeHtml(b.filename)}</span></small>
            </div>
            ${moreButton(`data-file="${escapeHtml(b.filename)}"`, `Acciones de la copia del ${fmtDateTime(b.created_at)}`).replace('more-btn', 'more-btn bk-more')}
          </li>`).join('')}
      </ul>` : emptyState('check', 'Aún no hay copias de seguridad', 'La primera se creará automáticamente al iniciar el servidor, o puede generarla ahora.')}
      ${pagerHtml({ page, pages, total: backups.length })}`;
    bindPager(content, (p) => { page = p; draw(); });
    const newBtn = content.querySelector('#new-backup-btn');
    newBtn.addEventListener('click', () => withBusy(newBtn, 'Generando…', async () => {
      try {
        await api('POST', '/api/admin/backups');
        toast('Copia de seguridad generada satisfactoriamente');
        page = 1;
        await load();
      } catch (err) { toast(err.message, 'error'); }
    }));
    content.querySelectorAll('.bk-more').forEach((btn) => btn.addEventListener('click', () => {
      const file = btn.dataset.file;
      openActionMenu(btn, [
        { label: 'Descargar copia', icon: I.download, onClick: () => { location.href = `/api/admin/backups/${encodeURIComponent(file)}/download`; } },
        { label: 'Restaurar esta copia', icon: I.key, danger: true, onClick: () => restore(file) },
      ], 'Acciones de la copia');
    }));
  }

  async function restore(file) {
    if (!(await confirmDialog({ title: 'Confirmar restauración', message: `¿Confirma la restauración de la base de datos a partir de «${file}»? Los datos actuales serán reemplazados; antes de proceder se generará automáticamente una copia del estado presente.`, confirmLabel: 'Restaurar' }))) return;
    try {
      toast('Restaurando la base de datos…');
      await api('POST', `/api/admin/backups/${encodeURIComponent(file)}/restore`);
      toast('Base de datos restaurada satisfactoriamente. Actualizando…');
      setTimeout(() => location.reload(), 1200);
    } catch (err) { toast(err.message, 'error'); }
  }
  load();
}
