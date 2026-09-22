'use strict';

/* ==========================================================================
   IslaVisual — SPA vanilla JS
   ========================================================================== */

const state = {
  user: null,
  sortView: {}, // { [doctorId]: 'alpha'|'fecha' }  preferencia LOCAL de visualización del que mira
};

const APP = document.getElementById('app');

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
  const res = await fetch(url, opts);
  let data = null;
  try { data = await res.json(); } catch (_) { data = null; }
  if (!res.ok) {
    const msg = (data && data.error) || `Error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/* ---------------------------- Toasts ---------------------------- */

function toast(message, type = 'success') {
  const wrap = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'error'
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>`;
  el.innerHTML = `<span class="toast-icon">${icon}</span><span>${escapeHtml(message)}</span>`;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 300ms ease, transform 300ms ease';
    el.style.opacity = '0';
    el.style.transform = 'translateX(30px)';
    setTimeout(() => el.remove(), 320);
  }, 3200);
}

/* ---------------------------- Utils ---------------------------- */

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function initials(nombre, apellidos) {
  return `${(nombre || '?')[0] || ''}${(apellidos || '?')[0] || ''}`.toUpperCase();
}

function folderTitleOf(doc) {
  return doc.folder_title;
}

function fmtDate(raw) {
  if (!raw) return '—';
  // Acepta 'YYYY-MM-DD' (fecha de foto) o 'YYYY-MM-DD HH:MM:SS' (created_at de SQLite).
  // Se construye como fecha LOCAL a propósito (sin pasar por UTC/Z) para que la fecha
  // que el médico eligió no se corra un día en zonas horarias detrás de UTC (p. ej. Cuba, UTC-5).
  const match = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return raw;
  const [, y, m, day] = match;
  const d = new Date(Number(y), Number(m) - 1, Number(day));
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function staggerStyle(index) {
  return `animation-delay:${Math.min(index, 10) * 45}ms`;
}

function fmtBytes(bytes) {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

/* ---------------------------- Iris transition ---------------------------- */

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function withIrisTransition(renderFn) {
  if (prefersReducedMotion()) return renderFn();
  const veil = document.createElement('div');
  veil.className = 'iris-veil closing';
  document.body.appendChild(veil);
  setTimeout(async () => {
    await renderFn();
    veil.classList.remove('closing');
    veil.classList.add('opening');
    setTimeout(() => veil.remove(), 500);
  }, 380);
}

/* ---------------------------- Router ---------------------------- */

function parseHash() {
  const hash = location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean);
  return { name: parts[0] || (state.user ? 'dashboard' : 'login'), params: parts.slice(1) };
}

async function router() {
  const { name, params } = parseHash();

  if (!state.user) {
    try {
      const data = await api('GET', '/api/auth/me');
      state.user = data.user;
    } catch (_) { state.user = null; }
  }

  const publicRoutes = ['login', 'register'];
  if (!state.user && !publicRoutes.includes(name)) {
    location.hash = '#/login';
    return;
  }
  if (state.user && publicRoutes.includes(name)) {
    location.hash = '#/dashboard';
    return;
  }

  switch (name) {
    case 'login': return renderAuth('login');
    case 'register': return renderAuth('register');
    case 'dashboard': return renderDashboard();
    case 'doctor': return renderDoctorFolder(params[0]);
    case 'patient': return renderPatient(params[0]);
    case 'admin': return renderAdmin();
    case 'biblioteca': return renderLibrary();
    default: return renderDashboard();
  }
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);

/* ---------------------------- Shell / topbar ---------------------------- */

function topbarHtml() {
  if (!state.user) return '';
  const u = state.user;
  const fullName = (u.sexo === 'F' ? 'Dra. ' : 'Dr. ') + u.nombre;
  return `
  <header class="topbar">
    <div class="topbar-inner">
      <a href="#/dashboard" class="brand"><span class="brand-mark"></span><span class="brand-text">IslaVisual</span></a>
      <div class="topbar-actions">
        <a href="#/biblioteca" class="btn btn-ghost btn-sm">Biblioteca</a>
        ${u.is_admin ? `<a href="#/admin" class="btn btn-ghost btn-sm">Admin</a>` : ''}
        <div class="user-chip" title="${escapeHtml(fullName)}">
          <span class="avatar-dot">${initials(u.nombre, u.apellidos)}</span>
          <span class="chip-name">${escapeHtml(fullName)}</span>
        </div>
        <button id="logout-btn" class="icon-btn" title="Cerrar sesión">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
        </button>
      </div>
    </div>
  </header>`;
}

function attachTopbarEvents() {
  const btn = document.getElementById('logout-btn');
  if (btn) btn.addEventListener('click', async () => {
    await api('POST', '/api/auth/logout');
    state.user = null;
    location.hash = '#/login';
  });
}

function globalFooterHtml() {
  return `
  <footer class="app-footer">
    <p class="footer-line">IslaVisual · información clínica de acceso restringido al cuerpo facultativo autenticado</p>
    <p class="studio-credit">Desarrollado por <span class="studio-name">爪丨匚卄乇.studios</span> · <span class="studio-phone">+53 55633280</span></p>
  </footer>`;
}

function shell(contentHtml) {
  APP.innerHTML = `${topbarHtml()}<main class="container view-enter" id="view-root">${contentHtml}</main>${globalFooterHtml()}`;
  attachTopbarEvents();
}

/**
 * Habilita activación por teclado (Enter / Espacio) en tarjetas clicables que no son
 * elementos <button>/<a> nativos, para que el cuerpo facultativo pueda navegar sin ratón.
 */
function enableCardActivation(nodeList, handler) {
  nodeList.forEach((el) => {
    el.addEventListener('click', () => handler(el));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler(el);
      }
    });
  });
}

/* ==========================================================================
   AUTH VIEWS
   ========================================================================== */

function renderAuth(mode) {
  withIrisTransition(async () => {
    const isLogin = mode === 'login';
    APP.innerHTML = `
    <div class="auth-shell">
      <div class="auth-card view-enter">
        <div class="auth-brand"><span class="brand-mark"></span><span class="brand-text">IslaVisual</span></div>
        <span class="auth-eyebrow">Cuerpo Facultativo · Oftalmología</span>
        <h1>${isLogin ? 'Bienvenido nuevamente' : 'Registro de nuevo facultativo'}</h1>
        <span class="auth-sub">${isLogin ? 'Acceda a su carpeta clínica y a las de sus colegas del servicio.' : 'Complete el siguiente formulario para habilitar su carpeta clínica personal.'}</span>
        <div class="form-error" id="auth-error"></div>
        <form id="auth-form">
          ${isLogin ? '' : `
          <div class="field-row">
            <div class="field"><label>Nombre</label><input name="nombre" required></div>
            <div class="field"><label>Apellidos</label><input name="apellidos" required></div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Sexo</label>
              <select name="sexo" required>
                <option value="">Seleccione</option>
                <option value="M">Masculino (Dr.)</option>
                <option value="F">Femenino (Dra.)</option>
              </select>
            </div>
            <div class="field"><label>Teléfono de contacto</label><input name="telefono" required placeholder="+53 5xxxxxxx"></div>
          </div>
          <div class="field"><label>Especialidad</label><input name="especialidad" placeholder="Oftalmología, Retina, Córnea..." value="Oftalmología"></div>
          `}
          <div class="field"><label>Correo electrónico</label><input type="email" name="email" required></div>
          <div class="field"><label>Contraseña</label><input type="password" name="password" required minlength="6"></div>
          <button class="btn btn-primary btn-block" type="submit">${isLogin ? 'Ingresar' : 'Completar registro'}</button>
        </form>
        <div class="auth-switch">
          ${isLogin ? `¿Aún no posee una cuenta profesional? <button id="switch-link">Regístrese</button>`
                    : `¿Ya posee una cuenta profesional? <button id="switch-link">Inicie sesión</button>`}
        </div>
      </div>
    </div>`;

    document.getElementById('switch-link').addEventListener('click', () => {
      location.hash = isLogin ? '#/register' : '#/login';
    });

    document.getElementById('auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('auth-error');
      errBox.classList.remove('show');
      const fd = new FormData(e.target);
      const payload = Object.fromEntries(fd.entries());
      const submitBtn = e.target.querySelector('button[type=submit]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Procesando solicitud...';
      try {
        const data = await api('POST', isLogin ? '/api/auth/login' : '/api/auth/register', payload);
        state.user = data.user;
        const prefijo = data.user.sexo === 'F' ? 'Dra.' : 'Dr.';
        toast(isLogin ? `Bienvenido nuevamente, ${prefijo} ${data.user.nombre}` : 'Cuenta profesional registrada satisfactoriamente');
        location.hash = '#/dashboard';
      } catch (err) {
        errBox.textContent = err.message;
        errBox.classList.add('show');
        submitBtn.disabled = false;
        submitBtn.textContent = isLogin ? 'Ingresar' : 'Completar registro';
      }
    });
  });
}

/* ==========================================================================
   DASHBOARD — listado de carpetas de médicos
   ========================================================================== */

function renderDashboard() {
  withIrisTransition(async () => {
    shell(`<div class="loading-block"><div class="aperture-spin"></div></div>`);
    let doctors = [];
    try {
      const data = await api('GET', '/api/doctors');
      doctors = data.doctors;
    } catch (err) {
      toast(err.message, 'error');
    }

    const cards = doctors.map((d, idx) => `
      <div class="folder-card view-enter" style="${staggerStyle(idx)}" data-id="${d.id}" tabindex="0" role="button" aria-label="Consultar carpeta clínica de ${escapeHtml(folderTitleOf(d))}">
        <div class="fc-top">
          <div class="fc-avatar">${initials(d.nombre, d.apellidos)}</div>
          ${d.id === state.user.id ? '<span class="fc-badge-me">Titular</span>' : ''}
        </div>
        <h3>${escapeHtml(folderTitleOf(d))}</h3>
        <span class="fc-specialty">${escapeHtml(d.especialidad || 'Oftalmología')}</span>
        <div class="fc-meta">
          <span class="fc-phone">📞 ${escapeHtml(d.telefono)}</span>
          <span><span class="fc-count">${d.total_pacientes}</span> pac.</span>
        </div>
      </div>
    `).join('');

    const root = document.getElementById('view-root');
    root.innerHTML = `
      <div class="page-head">
        <div>
          <span class="eyebrow">Directorio Clínico</span>
          <h1>Carpetas del Cuerpo Facultativo</h1>
          <p class="page-sub">La totalidad del cuerpo facultativo puede consultar estas carpetas clínicas. La incorporación de pacientes y las modificaciones pertinentes constituyen prerrogativa exclusiva del médico titular de cada expediente.</p>
        </div>
      </div>
      ${doctors.length ? `<div class="folder-grid">${cards}</div>` : `
        <div class="empty-state">
          <h3>Aún no se han registrado carpetas clínicas</h3>
          <p>A medida que se incorporen nuevos facultativos al sistema, sus carpetas se visualizarán en este espacio.</p>
        </div>`}
    `;

    enableCardActivation(root.querySelectorAll('.folder-card'), (card) => { location.hash = `#/doctor/${card.dataset.id}`; });
  });
}

/* ==========================================================================
   DOCTOR FOLDER — carpeta de un médico con sus pacientes
   ========================================================================== */

function renderDoctorFolder(doctorId) {
  withIrisTransition(async () => {
    shell(`<div class="loading-block"><div class="aperture-spin"></div></div>`);
    let doctor, isOwner;
    try {
      const data = await api('GET', `/api/doctors/${doctorId}`);
      doctor = data.doctor;
      isOwner = data.is_owner;
    } catch (err) {
      toast(err.message, 'error');
      return location.hash = '#/dashboard';
    }

    const localSort = state.sortView[doctorId] || doctor.sort_pref;

    const root = document.getElementById('view-root');
    root.innerHTML = `
      <a href="#/dashboard" class="back-link">&larr; Volver al Directorio Clínico</a>
      <div class="folder-header">
        <div class="folder-header-left">
          <div class="fh-avatar">${initials(doctor.nombre, doctor.apellidos)}</div>
          <div>
            <h1 id="folder-title-el">${escapeHtml(folderTitleOf(doctor))}</h1>
            <div class="fh-phone-row">
              📞 ${escapeHtml(doctor.telefono)} &nbsp;·&nbsp; ${escapeHtml(doctor.especialidad || 'Oftalmología')}
            </div>
          </div>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          ${isOwner ? `<button id="edit-folder-btn" class="btn btn-ghost btn-sm">Modificar carpeta</button>
                       <button id="add-patient-btn" class="btn btn-gold btn-sm">+ Incorporar paciente</button>`
                    : `<span class="text-view-hint">Modalidad de consulta — no es usted el médico titular</span>`}
        </div>
      </div>

      <div class="toolbar">
        <div class="sort-toggle" id="sort-toggle">
          <button data-sort="alpha" class="${localSort === 'alpha' ? 'active' : ''}">A–Z</button>
          <button data-sort="fecha" class="${localSort === 'fecha' ? 'active' : ''}">Cronológico</button>
        </div>
        <div class="search-input">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
          <input id="patient-search" placeholder="Localizar paciente...">
        </div>
      </div>

      <div id="patient-list-wrap"></div>
    `;

    async function loadPatients(sort) {
      const wrap = document.getElementById('patient-list-wrap');
      wrap.innerHTML = `<div class="loading-block"><div class="aperture-spin"></div></div>`;
      try {
        const data = await api('GET', `/api/patients/doctor/${doctorId}?sort=${sort}`);
        renderPatientList(wrap, data.patients);
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    function renderPatientList(wrap, patients) {
      if (!patients.length) {
        wrap.innerHTML = `<div class="empty-state"><h3>Aún no se han incorporado pacientes</h3><p>${isOwner ? 'Incorpore el primer paciente mediante el control dispuesto en la parte superior.' : 'El médico titular aún no ha incorporado pacientes a esta carpeta clínica.'}</p></div>`;
        return;
      }
      wrap.innerHTML = `<div class="patient-list">${patients.map((p, idx) => `
        <div class="patient-card view-enter" style="${staggerStyle(idx)}" data-id="${p.id}" tabindex="0" role="button" aria-label="Consultar expediente de ${escapeHtml(p.nombre)} ${escapeHtml(p.apellidos)}" data-search="${escapeHtml((p.nombre + ' ' + p.apellidos).toLowerCase())}">
          <h4>${escapeHtml(p.nombre)} ${escapeHtml(p.apellidos)}</h4>
          <div>
            <span class="patient-tag">${p.edad} años</span>
            <span class="patient-tag">${p.sexo === 'F' ? 'Femenino' : 'Masculino'}</span>
            ${p.photo_count ? `<span class="patient-tag gold">${p.photo_count} foto${p.photo_count === 1 ? '' : 's'}</span>` : ''}
          </div>
          <div class="patient-meta-line">
            <span>HC: ${escapeHtml(p.historia_clinica || '—')}</span>
            <span>${fmtDate(p.created_at)}</span>
          </div>
        </div>
      `).join('')}</div>`;

      enableCardActivation(wrap.querySelectorAll('.patient-card'), (card) => { location.hash = `#/patient/${card.dataset.id}`; });
    }

    await loadPatients(localSort);

    document.getElementById('sort-toggle').addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const sort = btn.dataset.sort;
      state.sortView[doctorId] = sort;
      document.querySelectorAll('#sort-toggle button').forEach((b) => b.classList.toggle('active', b === btn));
      await loadPatients(sort);
      if (isOwner) {
        try {
          await api('PATCH', `/api/doctors/${doctorId}/sort-pref`, { sort_pref: sort });
        } catch (_) {}
      }
    });

    document.getElementById('patient-search').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      document.querySelectorAll('.patient-card').forEach((card) => {
        card.style.display = card.dataset.search.includes(q) ? '' : 'none';
      });
    });

    if (isOwner) {
      document.getElementById('edit-folder-btn').addEventListener('click', () => openEditFolderModal(doctor));
      document.getElementById('add-patient-btn').addEventListener('click', () => openPatientModal(doctorId));
    }
  });
}

/* ---------------------------- Modal: editar carpeta ---------------------------- */

function openModal(html) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal-box">${html}</div>`;
  document.body.appendChild(backdrop);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
  // Cierre con Escape: funciona porque el foco se mueve dentro del modal (ver más abajo),
  // así que la tecla burbujea hasta este elemento sin necesitar un listener global que
  // luego haya que recordar remover.
  backdrop.addEventListener('keydown', (e) => { if (e.key === 'Escape') backdrop.remove(); });

  // Foco automático en el primer campo REALMENTE visible (evita enfocar un <input type="file">
  // oculto con display:none que precede a otros campos en el DOM de los modales de subida).
  const candidates = backdrop.querySelectorAll('input, select, textarea');
  for (const el of candidates) {
    if (el.type === 'hidden' || el.offsetParent === null) continue;
    el.focus();
    break;
  }
  return backdrop;
}

/**
 * Diálogo de confirmación animado y coherente con la identidad visual de la app,
 * en sustitución del confirm() nativo del navegador (no estilizable y visualmente
 * discordante). Se resuelve en true si el usuario confirma, false en cualquier otro
 * cierre (botón Cancelar, clic fuera del modal, o tecla Escape).
 */
function confirmDialog({ title = 'Confirmar acción', message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = true }) {
  return new Promise((resolve) => {
    let resolved = false;
    const iconSvg = danger
      ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>`
      : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`;

    const backdrop = openModal(`
      <div style="text-align:center;">
        <div class="confirm-icon ${danger ? 'confirm-icon-danger' : ''}">${iconSvg}</div>
        <h2>${escapeHtml(title)}</h2>
        <p class="modal-sub" style="margin-bottom:22px;">${escapeHtml(message)}</p>
      </div>
      <div class="modal-actions" style="justify-content:center;">
        <button type="button" class="btn btn-ghost" id="confirm-cancel">${escapeHtml(cancelLabel)}</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-ok">${escapeHtml(confirmLabel)}</button>
      </div>
    `);

    function finish(result) {
      if (resolved) return;
      resolved = true;
      resolve(result);
    }
    backdrop.querySelector('#confirm-cancel').addEventListener('click', () => backdrop.remove());
    backdrop.querySelector('#confirm-ok').addEventListener('click', () => { finish(true); backdrop.remove(); });

    // Cualquier otra vía de cierre (clic fuera, Escape, o el botón Cancelar de arriba)
    // equivale a cancelar; se detecta de forma unificada cuando el backdrop sale del DOM.
    const observer = new MutationObserver(() => {
      if (!document.body.contains(backdrop)) {
        finish(false);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true });
  });
}

function openEditFolderModal(doctor) {
  const backdrop = openModal(`
    <h2>Modificación de la Carpeta Clínica</h2>
    <span class="modal-sub">Las modificaciones aquí consignadas serán visibles para la totalidad del cuerpo facultativo. Esta función es prerrogativa exclusiva del médico titular.</span>
    <div class="form-error" id="ef-error"></div>
    <form id="edit-folder-form">
      <div class="field-row">
        <div class="field"><label>Nombre</label><input name="nombre" value="${escapeHtml(doctor.nombre)}" required></div>
        <div class="field"><label>Apellidos</label><input name="apellidos" value="${escapeHtml(doctor.apellidos)}" required></div>
      </div>
      <div class="field"><label>Teléfono de contacto</label><input name="telefono" value="${escapeHtml(doctor.telefono)}" required></div>
      <div class="field"><label>Especialidad</label><input name="especialidad" value="${escapeHtml(doctor.especialidad || '')}"></div>
      <div class="field">
        <label>Denominación personalizada de la carpeta (opcional)</label>
        <input name="folder_title" placeholder="Ej: Dr. Julio Cesar — Segmento Anterior" value="${escapeHtml(doctor.custom_title || '')}">
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="ef-cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">Registrar modificaciones</button>
      </div>
    </form>
  `);
  backdrop.querySelector('#ef-cancel').addEventListener('click', () => backdrop.remove());
  backdrop.querySelector('#edit-folder-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api('PATCH', `/api/doctors/${doctor.id}`, payload);
      toast('Carpeta clínica actualizada satisfactoriamente');
      backdrop.remove();
      renderDoctorFolder(doctor.id);
    } catch (err) {
      const box = backdrop.querySelector('#ef-error');
      box.textContent = err.message; box.classList.add('show');
    }
  });
}

/* ---------------------------- Modal: nuevo / editar paciente ---------------------------- */

function openPatientModal(doctorId, patient = null) {
  const isEdit = !!patient;
  const backdrop = openModal(`
    <h2>${isEdit ? 'Modificación de la Hoja de Cargo' : 'Apertura de Hoja de Cargo'}</h2>
    <span class="modal-sub">El presente formulario constituye la hoja de cargo del paciente, de carácter obligatorio para garantizar la continuidad del seguimiento clínico.</span>
    <div class="form-error" id="pf-error"></div>
    <form id="patient-form">
      <div class="field-row">
        <div class="field"><label>Nombre</label><input name="nombre" required value="${isEdit ? escapeHtml(patient.nombre) : ''}"></div>
        <div class="field"><label>Apellidos</label><input name="apellidos" required value="${isEdit ? escapeHtml(patient.apellidos) : ''}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Edad</label><input type="number" min="0" max="130" name="edad" required value="${isEdit ? patient.edad : ''}"></div>
        <div class="field">
          <label>Sexo</label>
          <select name="sexo" required>
            <option value="">Seleccione</option>
            <option value="M" ${isEdit && patient.sexo === 'M' ? 'selected' : ''}>Masculino</option>
            <option value="F" ${isEdit && patient.sexo === 'F' ? 'selected' : ''}>Femenino</option>
          </select>
        </div>
      </div>
      <div class="field"><label>Diagnóstico</label><textarea name="diagnostico" rows="2">${isEdit ? escapeHtml(patient.diagnostico) : ''}</textarea></div>
      <div class="field-row">
        <div class="field"><label>Número de historia clínica</label><input name="historia_clinica" value="${isEdit ? escapeHtml(patient.historia_clinica) : ''}"></div>
        <div class="field"><label>Número de carnet de identidad</label><input name="carnet_identidad" value="${isEdit ? escapeHtml(patient.carnet_identidad) : ''}"></div>
      </div>
      <div class="field"><label>CAS (conducta)</label><textarea name="cas" rows="2">${isEdit ? escapeHtml(patient.cas) : ''}</textarea></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="pf-cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Registrar modificaciones' : 'Consignar paciente'}</button>
      </div>
    </form>
  `);
  backdrop.querySelector('#pf-cancel').addEventListener('click', () => backdrop.remove());
  backdrop.querySelector('#patient-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      if (isEdit) {
        await api('PATCH', `/api/patients/${patient.id}`, payload);
        toast('Expediente del paciente actualizado satisfactoriamente');
        backdrop.remove();
        renderPatient(patient.id);
      } else {
        await api('POST', `/api/patients/doctor/${doctorId}`, payload);
        toast('Paciente incorporado satisfactoriamente');
        backdrop.remove();
        renderDoctorFolder(doctorId);
      }
    } catch (err) {
      const box = backdrop.querySelector('#pf-error');
      box.textContent = err.message; box.classList.add('show');
    }
  });
}

/* ==========================================================================
   PATIENT DETAIL — hoja de cargo + fotos
   ========================================================================== */

function renderPatient(patientId) {
  withIrisTransition(async () => {
    shell(`<div class="loading-block"><div class="aperture-spin"></div></div>`);
    let patient, isOwner;
    try {
      const data = await api('GET', `/api/patients/${patientId}`);
      patient = data.patient; isOwner = data.is_owner;
    } catch (err) {
      toast(err.message, 'error');
      return location.hash = '#/dashboard';
    }

    const root = document.getElementById('view-root');
    root.innerHTML = `
      <a href="#/doctor/${patient.doctor_id}" class="back-link">&larr; Regresar a la carpeta clínica</a>

      <div class="record-card">
        <div class="record-title-row">
          <div>
            <h1>${escapeHtml(patient.nombre)} ${escapeHtml(patient.apellidos)}</h1>
            <span class="page-sub">Hoja de Cargo · última actualización: ${fmtDate(patient.updated_at)}</span>
          </div>
          <div style="display:flex; gap:10px;">
            ${isOwner
              ? `<button id="edit-patient-btn" class="btn btn-ghost btn-sm">Modificar hoja de cargo</button>
                 <button id="delete-patient-btn" class="btn btn-danger btn-sm">Suprimir</button>`
              : `<span class="text-view-hint">Modalidad de consulta</span>`}
          </div>
        </div>
        <div class="record-grid">
          <div class="record-field"><div class="rf-label">Edad</div><div class="rf-value">${patient.edad} años</div></div>
          <div class="record-field"><div class="rf-label">Sexo</div><div class="rf-value">${patient.sexo === 'F' ? 'Femenino' : 'Masculino'}</div></div>
          <div class="record-field"><div class="rf-label">Historia clínica</div><div class="rf-value mono">${escapeHtml(patient.historia_clinica || '—')}</div></div>
          <div class="record-field"><div class="rf-label">Carnet de identidad</div><div class="rf-value mono">${escapeHtml(patient.carnet_identidad || '—')}</div></div>
          <div class="record-field wide"><div class="rf-label">Diagnóstico</div><div class="rf-value">${escapeHtml(patient.diagnostico || '—')}</div></div>
          <div class="record-field wide"><div class="rf-label">CAS (conducta)</div><div class="rf-value"><span class="cas-pill">${escapeHtml(patient.cas || 'Sin definir')}</span></div></div>
        </div>
      </div>

      <div class="section-head">
        <div>
          <h2>Seguimiento fotográfico</h2>
          <div class="section-sub">Registro fotográfico del procedimiento quirúrgico, con fecha y descripción, accesible a la totalidad del cuerpo facultativo.</div>
        </div>
        ${isOwner ? `<button id="upload-photo-btn" class="btn btn-gold btn-sm">+ Incorporar fotografía</button>` : ''}
      </div>
      <div id="photo-grid-wrap"></div>
    `;

    async function loadPhotos() {
      const wrap = document.getElementById('photo-grid-wrap');
      wrap.innerHTML = `<div class="loading-block"><div class="aperture-spin"></div></div>`;
      try {
        const data = await api('GET', `/api/photos/patient/${patientId}`);
        renderPhotoGrid(wrap, data.photos);
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    function renderPhotoGrid(wrap, photos) {
      if (!photos.length) {
        wrap.innerHTML = `<div class="empty-state"><h3>Sin registro fotográfico</h3><p>${isOwner ? 'Incorpore la primera fotografía de seguimiento clínico.' : 'El médico titular aún no ha incorporado registro fotográfico a este expediente.'}</p></div>`;
        return;
      }
      wrap.innerHTML = `<div class="photo-grid">${photos.map((ph, idx) => `
        <div class="photo-card view-enter" style="${staggerStyle(idx)}" data-id="${ph.id}">
          <img src="/media/photos/${ph.filename}" alt="Fotografía de seguimiento clínico" data-lightbox="${ph.id}" loading="lazy">
          <div class="photo-card-body">
            <div class="photo-date">${fmtDate(ph.fecha_foto)}</div>
            <div class="photo-desc">${escapeHtml(ph.descripcion)}</div>
            ${isOwner ? `
            <div class="photo-card-actions">
              <button class="btn btn-ghost btn-sm edit-photo-btn" data-id="${ph.id}">Modificar</button>
              <button class="btn btn-danger btn-sm del-photo-btn" data-id="${ph.id}">Suprimir</button>
            </div>` : ''}
          </div>
        </div>
      `).join('')}</div>`;

      const byId = Object.fromEntries(photos.map((p) => [String(p.id), p]));

      wrap.querySelectorAll('[data-lightbox]').forEach((img) => {
        img.addEventListener('click', () => openLightbox(byId[img.dataset.lightbox]));
      });
      wrap.querySelectorAll('.edit-photo-btn').forEach((btn) => {
        btn.addEventListener('click', () => openEditPhotoModal(byId[btn.dataset.id], loadPhotos));
      });
      wrap.querySelectorAll('.del-photo-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!(await confirmDialog({ message: '¿Confirma la supresión de esta fotografía? Esta acción es irreversible.' }))) return;
          try {
            await api('DELETE', `/api/photos/${btn.dataset.id}`);
            toast('Registro fotográfico suprimido satisfactoriamente');
            loadPhotos();
          } catch (err) { toast(err.message, 'error'); }
        });
      });
    }

    await loadPhotos();

    if (isOwner) {
      document.getElementById('edit-patient-btn').addEventListener('click', () => openPatientModal(patient.doctor_id, patient));
      document.getElementById('delete-patient-btn').addEventListener('click', async () => {
        if (!(await confirmDialog({ message: `¿Confirma la supresión del expediente de ${patient.nombre} ${patient.apellidos} y la totalidad de su registro fotográfico? Esta acción es irreversible.` }))) return;
        try {
          await api('DELETE', `/api/patients/${patient.id}`);
          toast('Expediente suprimido satisfactoriamente');
          location.hash = `#/doctor/${patient.doctor_id}`;
        } catch (err) { toast(err.message, 'error'); }
      });
      document.getElementById('upload-photo-btn').addEventListener('click', () => openUploadPhotoModal(patient.id, loadPhotos));
    }
  });
}

function openLightbox(photo) {
  const backdrop = document.createElement('div');
  backdrop.className = 'lightbox-backdrop';
  backdrop.tabIndex = -1;
  backdrop.innerHTML = `
    <button class="icon-btn lightbox-close" id="lb-close" style="background:rgba(255,255,255,.12); border:none;">✕</button>
    <img src="/media/photos/${photo.filename}" alt="">
    <div class="lightbox-info">
      <div class="photo-date">${fmtDate(photo.fecha_foto)}</div>
      <p>${escapeHtml(photo.descripcion)}</p>
    </div>
  `;
  document.body.appendChild(backdrop);
  backdrop.focus();
  const close = () => backdrop.remove();
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  backdrop.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  backdrop.querySelector('#lb-close').addEventListener('click', close);
}

function openLibraryLightbox(item) {
  const url = `/media/biblioteca/${item.filename}`;
  const ext = ((item.original_name || item.filename).split('.').pop() || '').toLowerCase();
  let mediaHtml;
  if (item.categoria === 'imagen') {
    mediaHtml = `<img src="${url}" alt="${escapeHtml(item.titulo)}">`;
  } else if (item.categoria === 'video') {
    mediaHtml = `<video src="${url}" controls autoplay></video>`;
  } else if (ext === 'pdf') {
    mediaHtml = `<iframe src="${url}" title="${escapeHtml(item.titulo)}"></iframe>`;
  } else {
    mediaHtml = `
      <div class="lib-lightbox-fallback">
        <span class="lib-icon">📄</span>
        <p>La vista previa no está disponible para este formato de archivo.</p>
        <a class="btn btn-primary" href="${url}" download="${escapeHtml(item.original_name || item.titulo)}">Descargar archivo</a>
      </div>`;
  }
  const backdrop = document.createElement('div');
  backdrop.className = 'lightbox-backdrop';
  backdrop.tabIndex = -1;
  backdrop.innerHTML = `
    <button class="icon-btn lightbox-close" id="lib-lb-close" style="background:rgba(255,255,255,.12); border:none;">✕</button>
    ${mediaHtml}
    <div class="lightbox-info">
      <p style="font-weight:600; color:#F3EFE4; margin-bottom:4px;">${escapeHtml(item.titulo)}</p>
      ${item.descripcion ? `<p>${escapeHtml(item.descripcion)}</p>` : ''}
    </div>
  `;
  document.body.appendChild(backdrop);
  backdrop.focus();
  const close = () => backdrop.remove();
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  backdrop.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  backdrop.querySelector('#lib-lb-close').addEventListener('click', close);
}

function openUploadPhotoModal(patientId, onDone) {
  const backdrop = openModal(`
    <h2>Incorporación de Registro Fotográfico</h2>
    <span class="modal-sub">La descripción clínica y la fecha de captura constituyen campos de carácter obligatorio.</span>
    <div class="form-error" id="up-error"></div>
    <form id="upload-photo-form">
      <div class="dropzone" id="dropzone">
        <strong>Pulse para seleccionar una imagen</strong> o arrástrela hasta este recuadro<br>JPG, PNG o WEBP · máx. 15MB
        <img class="preview-thumb" id="preview-thumb">
      </div>
      <input type="file" id="photo-input" accept="image/*" style="display:none">
      <div class="field"><label>Descripción</label><textarea name="descripcion" rows="2" required placeholder="Ej: Post-operatorio día 1, OD, facoemulsificación"></textarea></div>
      <div class="field"><label>Fecha de captura fotográfica</label><input type="date" name="fecha_foto" required value="${todayISO()}"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="up-cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary" id="up-submit">Incorporar fotografía</button>
      </div>
    </form>
  `);
  const dz = backdrop.querySelector('#dropzone');
  const fileInput = backdrop.querySelector('#photo-input');
  const preview = backdrop.querySelector('#preview-thumb');
  let selectedFile = null;

  dz.addEventListener('click', () => fileInput.click());
  ['dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('dragover'); }));
  dz.addEventListener('drop', (e) => {
    if (e.dataTransfer.files[0]) { selectedFile = e.dataTransfer.files[0]; showPreview(); }
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) { selectedFile = fileInput.files[0]; showPreview(); }
  });
  function showPreview() {
    preview.src = URL.createObjectURL(selectedFile);
    preview.style.display = 'block';
  }

  backdrop.querySelector('#up-cancel').addEventListener('click', () => backdrop.remove());
  backdrop.querySelector('#upload-photo-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = backdrop.querySelector('#up-error');
    if (!selectedFile) { errBox.textContent = 'Debe seleccionar una imagen para continuar.'; errBox.classList.add('show'); return; }
    const fd = new FormData(e.target);
    fd.append('photo', selectedFile);
    const submitBtn = backdrop.querySelector('#up-submit');
    submitBtn.disabled = true; submitBtn.textContent = 'Incorporando...';
    try {
      await api('POST', `/api/photos/patient/${patientId}`, fd, true);
      toast('Registro fotográfico incorporado satisfactoriamente');
      backdrop.remove();
      onDone();
    } catch (err) {
      errBox.textContent = err.message; errBox.classList.add('show');
      submitBtn.disabled = false; submitBtn.textContent = 'Incorporar fotografía';
    }
  });
}

function openEditPhotoModal(photo, onDone) {
  const backdrop = openModal(`
    <h2>Modificación del Registro Fotográfico</h2>
    <div class="form-error" id="epf-error"></div>
    <form id="edit-photo-form">
      <img src="/media/photos/${photo.filename}" style="width:100%; max-height:220px; object-fit:contain; border-radius:10px; margin-bottom:16px;">
      <div class="field"><label>Descripción</label><textarea name="descripcion" rows="2" required>${escapeHtml(photo.descripcion)}</textarea></div>
      <div class="field"><label>Fecha de captura</label><input type="date" name="fecha_foto" required value="${photo.fecha_foto}"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="epf-cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">Registrar modificaciones</button>
      </div>
    </form>
  `);
  backdrop.querySelector('#epf-cancel').addEventListener('click', () => backdrop.remove());
  backdrop.querySelector('#edit-photo-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api('PATCH', `/api/photos/${photo.id}`, payload);
      toast('Registro fotográfico actualizado satisfactoriamente');
      backdrop.remove();
      onDone();
    } catch (err) {
      const box = backdrop.querySelector('#epf-error');
      box.textContent = err.message; box.classList.add('show');
    }
  });
}

/* ==========================================================================
   ADMIN PANEL
   ========================================================================== */

function renderAdmin() {
  withIrisTransition(async () => {
    if (!state.user.is_admin) { toast('No posee las prerrogativas administrativas requeridas para acceder a esta sección.', 'error'); return location.hash = '#/dashboard'; }
    shell(`<div class="loading-block"><div class="aperture-spin"></div></div>`);

    const root = document.getElementById('view-root');
    root.innerHTML = `
      <div class="page-head">
        <div>
          <span class="eyebrow">Gestión Administrativa</span>
          <h1>Panel de Administración</h1>
          <p class="page-sub">Registro del cuerpo facultativo habilitado y administración de las copias de seguridad de la base de datos clínica.</p>
        </div>
      </div>
      <div class="admin-tabs">
        <button class="active" data-tab="users">Facultativos</button>
        <button data-tab="backups">Respaldos</button>
      </div>
      <div id="admin-content"></div>
    `;

    async function showUsers() {
      const content = document.getElementById('admin-content');
      content.innerHTML = `<div class="loading-block"><div class="aperture-spin"></div></div>`;
      const [{ users }, stats] = await Promise.all([
        api('GET', '/api/admin/users'),
        api('GET', '/api/admin/stats'),
      ]);
      content.innerHTML = `
        <div class="stat-row">
          <div class="stat-card"><div class="stat-num">${stats.totalUsers}</div><div class="stat-label">Facultativos</div></div>
          <div class="stat-card"><div class="stat-num">${stats.totalPatients}</div><div class="stat-label">Pacientes</div></div>
          <div class="stat-card"><div class="stat-num">${stats.totalPhotos}</div><div class="stat-label">Fotos</div></div>
          <div class="stat-card"><div class="stat-num">${fmtBytes(stats.uploadsSizeBytes)}</div><div class="stat-label">Almacenamiento fotos</div></div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Pacientes</th><th>Rol</th><th>Registrado</th><th></th></tr></thead>
            <tbody>
              ${users.map((u) => `
                <tr>
                  <td>${u.sexo === 'F' ? 'Dra.' : 'Dr.'} ${escapeHtml(u.nombre)} ${escapeHtml(u.apellidos)}</td>
                  <td>${escapeHtml(u.email)}</td>
                  <td class="mono">${escapeHtml(u.telefono)}</td>
                  <td>${u.total_pacientes}</td>
                  <td>${u.is_admin ? '<span class="pill-admin">Admin</span>' : '<span class="pill-doctor">Médico</span>'}</td>
                  <td>${fmtDate(u.created_at)}</td>
                  <td style="display:flex; gap:6px; flex-wrap:wrap;">
                    ${u.id !== state.user.id ? `
                      <button class="btn btn-ghost btn-sm toggle-admin" data-id="${u.id}" data-admin="${u.is_admin}">${u.is_admin ? 'Revocar administración' : 'Conferir administración'}</button>
                      <button class="btn btn-danger btn-sm del-user" data-id="${u.id}">Suprimir</button>
                    ` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <p class="scroll-hint">← Deslice horizontalmente para consultar la totalidad de la tabla →</p>
      `;
      content.querySelectorAll('.del-user').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!(await confirmDialog({ message: '¿Confirma la supresión de este facultativo, su carpeta clínica y la totalidad de los expedientes y registros fotográficos asociados? Esta acción es irreversible.' }))) return;
          try {
            await api('DELETE', `/api/admin/users/${btn.dataset.id}`);
            toast('Facultativo suprimido del sistema satisfactoriamente');
            showUsers();
          } catch (err) { toast(err.message, 'error'); }
        });
      });
      content.querySelectorAll('.toggle-admin').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const makeAdmin = btn.dataset.admin !== '1';
          try {
            await api('PATCH', `/api/admin/users/${btn.dataset.id}/admin`, { is_admin: makeAdmin });
            toast(makeAdmin ? 'Se han conferido las prerrogativas administrativas correspondientes' : 'Las prerrogativas administrativas han sido revocadas');
            showUsers();
          } catch (err) { toast(err.message, 'error'); }
        });
      });
    }

    async function showBackups() {
      const content = document.getElementById('admin-content');
      content.innerHTML = `<div class="loading-block"><div class="aperture-spin"></div></div>`;
      const { backups } = await api('GET', '/api/admin/backups');
      content.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; flex-wrap:wrap; gap:10px;">
          <p class="page-sub" style="margin:0;">El sistema ejecuta copias de seguridad automáticas cada seis horas, conservando las treinta más recientes en conjunto con aquellas generadas manualmente.</p>
          <button class="btn btn-gold btn-sm" id="new-backup-btn">Generar copia de seguridad</button>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Archivo</th><th>Tipo</th><th>Tamaño</th><th>Fecha</th><th></th></tr></thead>
            <tbody>
              ${backups.length ? backups.map((b) => `
                <tr>
                  <td class="mono">${escapeHtml(b.filename)}</td>
                  <td>${b.type}</td>
                  <td>${fmtBytes(b.size_bytes)}</td>
                  <td>${fmtDate(b.created_at)}</td>
                  <td style="display:flex; gap:6px; flex-wrap:wrap;">
                    <a class="btn btn-ghost btn-sm" href="/api/admin/backups/${encodeURIComponent(b.filename)}/download">Descargar</a>
                    <button class="btn btn-primary btn-sm restore-btn" data-file="${escapeHtml(b.filename)}">Restaurar</button>
                  </td>
                </tr>
              `).join('') : `<tr><td colspan="5">Aún no se ha generado copia de seguridad alguna. La primera se creará de forma automática una vez iniciado el servidor.</td></tr>`}
            </tbody>
          </table>
        </div>
        <p class="scroll-hint">← Deslice horizontalmente para consultar la totalidad de la tabla →</p>
      `;
      content.querySelector('#new-backup-btn').addEventListener('click', async (e) => {
        e.target.disabled = true; e.target.textContent = 'Generando...';
        try {
          await api('POST', '/api/admin/backups');
          toast('Copia de seguridad generada satisfactoriamente');
          showBackups();
        } catch (err) { toast(err.message, 'error'); e.target.disabled = false; e.target.textContent = 'Generar copia de seguridad'; }
      });
      content.querySelectorAll('.restore-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!(await confirmDialog({ title: 'Confirmar restauración', message: `¿Confirma la restauración de la base de datos a partir de "${btn.dataset.file}"? Los datos actuales serán reemplazados (se generará automáticamente una copia de seguridad del estado presente antes de proceder).`, confirmLabel: 'Restaurar', danger: false }))) return;
          try {
            await api('POST', `/api/admin/backups/${encodeURIComponent(btn.dataset.file)}/restore`);
            toast('Base de datos restaurada satisfactoriamente. Actualizando la sesión...');
            setTimeout(() => location.reload(), 1200);
          } catch (err) { toast(err.message, 'error'); }
        });
      });
    }

    document.querySelector('.admin-tabs').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      document.querySelectorAll('.admin-tabs button').forEach((b) => b.classList.toggle('active', b === btn));
      if (btn.dataset.tab === 'users') showUsers(); else showBackups();
    });

    await showUsers();
  });
}

/* ==========================================================================
   BIBLIOTECA CLÍNICA — materiales bibliográficos (imágenes, video, documentos)
   Consulta abierta a todo el cuerpo facultativo; edición exclusiva del cuerpo administrativo.
   ========================================================================== */

function renderLibrary() {
  withIrisTransition(async () => {
    shell(`<div class="loading-block"><div class="aperture-spin"></div></div>`);

    const root = document.getElementById('view-root');
    root.innerHTML = `
      <div class="page-head">
        <div>
          <span class="eyebrow">Acervo Bibliográfico</span>
          <h1>Biblioteca Clínica</h1>
          <p class="page-sub">Material de consulta del servicio — imágenes, video y documentos — accesible a la totalidad del cuerpo facultativo. La incorporación, modificación y supresión de contenido constituye prerrogativa exclusiva del cuerpo administrativo.</p>
        </div>
        ${state.user.is_admin ? `<button id="lib-upload-btn" class="btn btn-gold btn-sm">+ Incorporar material</button>` : ''}
      </div>
      <div id="library-grid-wrap"></div>
    `;

    async function loadItems() {
      const wrap = document.getElementById('library-grid-wrap');
      wrap.innerHTML = `<div class="loading-block"><div class="aperture-spin"></div></div>`;
      try {
        const data = await api('GET', '/api/library');
        renderGrid(wrap, data.items);
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    function renderGrid(wrap, items) {
      if (!items.length) {
        wrap.innerHTML = `<div class="empty-state"><h3>Aún no se ha incorporado material</h3><p>${state.user.is_admin ? 'Incorpore el primer recurso mediante el control dispuesto en la parte superior.' : 'El cuerpo administrativo aún no ha incorporado material a la biblioteca clínica.'}</p></div>`;
        return;
      }
      wrap.innerHTML = `<div class="library-grid">${items.map((it, idx) => `
        <div class="library-card view-enter" style="${staggerStyle(idx)}" data-id="${it.id}">
          <button type="button" class="lib-card-preview lib-cat-${it.categoria} lib-open-btn" data-id="${it.id}" aria-label="Ver ${escapeHtml(it.titulo)}">
            ${it.categoria === 'imagen'
              ? `<img src="/media/biblioteca/${it.filename}" alt="${escapeHtml(it.titulo)}" loading="lazy">`
              : `<span class="lib-icon">${it.categoria === 'video' ? '🎬' : '📄'}</span>`}
          </button>
          <div class="lib-card-body">
            <h4>${escapeHtml(it.titulo)}</h4>
            ${it.descripcion ? `<p class="lib-desc">${escapeHtml(it.descripcion)}</p>` : ''}
            <div class="lib-meta">
              <span>${escapeHtml(it.uploader_nombre || '—')}</span>
              <span>${fmtDate(it.created_at)}</span>
            </div>
            <div class="lib-actions">
              <button type="button" class="btn btn-ghost btn-sm lib-open-btn" data-id="${it.id}">Ver</button>
              <a class="btn btn-ghost btn-sm" href="/media/biblioteca/${it.filename}" download="${escapeHtml(it.original_name || it.titulo)}" title="Descargar archivo">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>
              </a>
              ${state.user.is_admin ? `
                <button class="btn btn-ghost btn-sm lib-edit-btn" data-id="${it.id}">Modificar</button>
                <button class="btn btn-danger btn-sm lib-del-btn" data-id="${it.id}">Suprimir</button>
              ` : ''}
            </div>
          </div>
        </div>
      `).join('')}</div>`;

      const byId = Object.fromEntries(items.map((i) => [String(i.id), i]));
      wrap.querySelectorAll('.lib-open-btn').forEach((btn) => {
        btn.addEventListener('click', () => openLibraryLightbox(byId[btn.dataset.id]));
      });
      wrap.querySelectorAll('.lib-edit-btn').forEach((btn) => {
        btn.addEventListener('click', () => openEditLibraryModal(byId[btn.dataset.id], loadItems));
      });
      wrap.querySelectorAll('.lib-del-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!(await confirmDialog({ message: '¿Confirma la supresión de este material? Esta acción es irreversible.' }))) return;
          try {
            await api('DELETE', `/api/library/${btn.dataset.id}`);
            toast('Material suprimido satisfactoriamente');
            loadItems();
          } catch (err) { toast(err.message, 'error'); }
        });
      });
    }

    await loadItems();

    if (state.user.is_admin) {
      document.getElementById('lib-upload-btn').addEventListener('click', () => openUploadLibraryModal(loadItems));
    }
  });
}

function openUploadLibraryModal(onDone) {
  const backdrop = openModal(`
    <h2>Incorporación de Material Bibliográfico</h2>
    <span class="modal-sub">Admite imágenes, video y documentos (PDF, Word, Excel, PowerPoint). Tamaño máximo: 150MB.</span>
    <div class="form-error" id="lib-error"></div>
    <form id="library-form">
      <div class="dropzone" id="lib-dropzone">
        <strong>Pulse para seleccionar un archivo</strong> o arrástrelo hasta este recuadro
        <div id="lib-file-name" style="margin-top:10px; font-weight:600; color:var(--teal); display:none;"></div>
      </div>
      <input type="file" id="lib-file-input" accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.odt" style="display:none">
      <div class="field"><label>Título</label><input name="titulo" required placeholder="Ej: Guía de manejo del glaucoma"></div>
      <div class="field"><label>Descripción (opcional)</label><textarea name="descripcion" rows="2" placeholder="Breve reseña del contenido del material"></textarea></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="lib-cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary" id="lib-submit">Incorporar material</button>
      </div>
    </form>
  `);
  const dz = backdrop.querySelector('#lib-dropzone');
  const fileInput = backdrop.querySelector('#lib-file-input');
  const fileNameEl = backdrop.querySelector('#lib-file-name');
  let selectedFile = null;

  dz.addEventListener('click', () => fileInput.click());
  ['dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('dragover'); }));
  dz.addEventListener('drop', (e) => {
    if (e.dataTransfer.files[0]) { selectedFile = e.dataTransfer.files[0]; showFileName(); }
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) { selectedFile = fileInput.files[0]; showFileName(); }
  });
  function showFileName() {
    fileNameEl.textContent = selectedFile.name;
    fileNameEl.style.display = 'block';
  }

  backdrop.querySelector('#lib-cancel').addEventListener('click', () => backdrop.remove());
  backdrop.querySelector('#library-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = backdrop.querySelector('#lib-error');
    if (!selectedFile) { errBox.textContent = 'Debe seleccionar un archivo para continuar.'; errBox.classList.add('show'); return; }
    const fd = new FormData(e.target);
    fd.append('archivo', selectedFile);
    const submitBtn = backdrop.querySelector('#lib-submit');
    submitBtn.disabled = true; submitBtn.textContent = 'Incorporando...';
    try {
      await api('POST', '/api/library', fd, true);
      toast('Material incorporado satisfactoriamente');
      backdrop.remove();
      onDone();
    } catch (err) {
      errBox.textContent = err.message; errBox.classList.add('show');
      submitBtn.disabled = false; submitBtn.textContent = 'Incorporar material';
    }
  });
}

function openEditLibraryModal(item, onDone) {
  const backdrop = openModal(`
    <h2>Modificación del Material</h2>
    <div class="form-error" id="libf-error"></div>
    <form id="edit-library-form">
      <div class="field"><label>Título</label><input name="titulo" required value="${escapeHtml(item.titulo)}"></div>
      <div class="field"><label>Descripción</label><textarea name="descripcion" rows="2">${escapeHtml(item.descripcion || '')}</textarea></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="libf-cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">Registrar modificaciones</button>
      </div>
    </form>
  `);
  backdrop.querySelector('#libf-cancel').addEventListener('click', () => backdrop.remove());
  backdrop.querySelector('#edit-library-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api('PATCH', `/api/library/${item.id}`, payload);
      toast('Material actualizado satisfactoriamente');
      backdrop.remove();
      onDone();
    } catch (err) {
      const box = backdrop.querySelector('#libf-error');
      box.textContent = err.message; box.classList.add('show');
    }
  });
}
