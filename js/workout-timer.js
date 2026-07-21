// Chronomètre de séance — barre fixe en bas (éphémère, rien n'est sauvegardé)
// Deux outils : chrono de séance (Pause/Reprise) + minuteur de repos entre séries.
import { showToast } from './utils.js';

let bar = null;
let hashHandler = null;
let audioCtx = null;

// Chrono de séance
let sw = { accMs: 0, startTs: 0, running: false };
let tick = null;

// Minuteur de repos
let rest = { remaining: 0, total: 0, interval: null };

// ── Formatage ─────────────────────────────────────────────────────────────────
function fmt(totalSec) {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = n => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
}

function elapsedMs() {
  return sw.accMs + (sw.running ? Date.now() - sw.startTs : 0);
}

// ── Cycle de vie ────────────────────────────────────────────────────────────────
export function isSessionTimerActive() { return !!bar; }

export function startSessionTimer() {
  if (bar) return; // déjà lancé
  buildBar();
  document.body.classList.add('timer-on');
  sw = { accMs: 0, startTs: Date.now(), running: true };
  startTick();
  updateSwUI();
  updateToggleUI();

  // Nettoyage automatique quand on quitte la vue Séance
  hashHandler = () => {
    if (!location.hash.startsWith('#/workout')) stopSessionTimer();
  };
  window.addEventListener('hashchange', hashHandler);
}

export function stopSessionTimer() {
  stopTick();
  stopRest();
  if (hashHandler) { window.removeEventListener('hashchange', hashHandler); hashHandler = null; }
  document.body.classList.remove('timer-on');
  bar?.remove();
  bar = null;
  sw = { accMs: 0, startTs: 0, running: false };
}

// ── Construction de la barre ────────────────────────────────────────────────────
function buildBar() {
  bar = document.createElement('div');
  bar.id = 'session-timer-bar';
  bar.className = 'stw-bar';
  bar.innerHTML = `
    <div class="stw-rest hidden" id="stw-rest"></div>
    <div class="stw-main">
      <div class="stw-time" id="stw-time">00:00</div>
      <div class="stw-actions">
        <button class="stw-btn stw-btn-toggle" id="stw-toggle">⏸ Pause</button>
        <button class="stw-btn stw-btn-rest" id="stw-rest-open">⏱ Repos</button>
        <button class="stw-btn stw-btn-stop" id="stw-stop">⏹ Stop</button>
      </div>
    </div>
  `;
  document.body.appendChild(bar);

  bar.querySelector('#stw-toggle').addEventListener('click', toggleSw);
  bar.querySelector('#stw-rest-open').addEventListener('click', openRest);
  bar.querySelector('#stw-stop').addEventListener('click', () => {
    stopSessionTimer();
    showToast('Chrono arrêté');
  });
}

// ── Chrono de séance ────────────────────────────────────────────────────────────
function startTick() { stopTick(); tick = setInterval(updateSwUI, 250); }
function stopTick() { if (tick) { clearInterval(tick); tick = null; } }

function updateSwUI() {
  const el = bar?.querySelector('#stw-time');
  if (el) el.textContent = fmt(elapsedMs() / 1000);
}

function updateToggleUI() {
  const btn = bar?.querySelector('#stw-toggle');
  if (btn) btn.textContent = sw.running ? '⏸ Pause' : '▶ Reprendre';
}

function toggleSw() {
  if (sw.running) {
    sw.accMs = elapsedMs();
    sw.running = false;
    stopTick();
  } else {
    sw.startTs = Date.now();
    sw.running = true;
    startTick();
  }
  updateToggleUI();
  updateSwUI();
}

// ── Minuteur de repos ───────────────────────────────────────────────────────────
function openRest() {
  if (rest.interval) return; // repos déjà en cours
  renderRestPresets();
}

function renderRestPresets() {
  const el = bar?.querySelector('#stw-rest');
  if (!el) return;
  el.classList.remove('hidden');
  el.innerHTML = `
    <span class="stw-rest-label">Repos :</span>
    ${[45, 60, 90, 120, 180].map(s => `<button class="stw-preset" data-sec="${s}">${s}s</button>`).join('')}
    <button class="stw-rest-close" id="stw-rest-close" title="Fermer">&times;</button>
  `;
  el.querySelectorAll('.stw-preset').forEach(b =>
    b.addEventListener('click', () => startRest(parseInt(b.dataset.sec)))
  );
  el.querySelector('#stw-rest-close').addEventListener('click', () => hideRest());
}

function renderRestActive() {
  const el = bar?.querySelector('#stw-rest');
  if (!el) return;
  el.classList.remove('hidden');
  el.innerHTML = `
    <button class="stw-preset" id="rest-minus">−30</button>
    <span class="stw-rest-time" id="stw-rest-time">00:00</span>
    <button class="stw-preset" id="rest-plus">+30</button>
    <button class="stw-rest-close" id="rest-cancel" title="Annuler">&times;</button>
  `;
  el.querySelector('#rest-minus').addEventListener('click', () => adjustRest(-30));
  el.querySelector('#rest-plus').addEventListener('click', () => adjustRest(30));
  el.querySelector('#rest-cancel').addEventListener('click', () => stopRest());
  updateRestUI();
}

function startRest(seconds) {
  ensureAudio(); // débloque l'audio (geste utilisateur)
  if (rest.interval) clearInterval(rest.interval);
  rest.total = seconds;
  rest.remaining = seconds;
  renderRestActive();
  rest.interval = setInterval(() => {
    rest.remaining -= 1;
    if (rest.remaining <= 0) {
      restDone();
    } else {
      updateRestUI();
    }
  }, 1000);
}

function adjustRest(delta) {
  if (!rest.interval) return;
  rest.remaining = Math.max(1, rest.remaining + delta);
  updateRestUI();
}

function updateRestUI() {
  const el = bar?.querySelector('#stw-rest-time');
  if (el) el.textContent = fmt(rest.remaining);
}

function restDone() {
  if (rest.interval) { clearInterval(rest.interval); rest.interval = null; }
  rest.remaining = 0;
  updateRestUI();
  beep();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  showToast('Repos terminé 💪');
  setTimeout(() => { if (!rest.interval) hideRest(); }, 1500);
}

function stopRest() {
  if (rest.interval) { clearInterval(rest.interval); rest.interval = null; }
  rest.remaining = 0;
  hideRest();
}

function hideRest() {
  const el = bar?.querySelector('#stw-rest');
  if (el) { el.classList.add('hidden'); el.innerHTML = ''; }
}

// ── Bip de fin de repos (Web Audio, pas d'asset) ────────────────────────────────
function ensureAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {}
}

function beep() {
  try {
    ensureAudio();
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.22;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.start(t);
      o.stop(t + 0.2);
    }
  } catch {}
}
