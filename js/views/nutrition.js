import { today, formatDateFR, addDays, showToast } from '../utils.js';
import {
  getNutrition, saveNutrition,
  getNutritionGoals, saveNutritionGoals,
  getRecentNutritionFoods, saveNutritionFood,
  getApiKey,
  getUserProfile, saveUserProfile, getLastWeeklies, getRecentSleep,
  getWorkout,
} from '../db.js';

const SECTIONS = [
  { key: 'breakfast',      label: 'Petit-déjeuner',       icon: '🌅' },
  { key: 'morningSnack',   label: 'Collation matin',      icon: '🍎' },
  { key: 'lunch',          label: 'Déjeuner',             icon: '🥗' },
  { key: 'afternoonSnack', label: 'Collation après-midi', icon: '🍊' },
  { key: 'dinner',         label: 'Dîner',                icon: '🌙' },
  { key: 'eveningSnack',   label: 'Collation soir',       icon: '🌛' },
];

const DEFAULT_GOALS = { kcal: 2500, prot: 160, carbs: 300, fats: 80 };

let currentDate  = null;
let _container   = null;
let _data        = null;
let _goals       = DEFAULT_GOALS;
let _dayAdjust   = null;
let _recents     = [];

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function render(container, resetDate = true) {
  if (resetDate || !currentDate) currentDate = today();
  _container = container;
  container.innerHTML = '<div class="spinner"></div>';

  try {
    [_data, _goals, _recents] = await Promise.all([
      getNutrition(currentDate).catch(() => null),
      getNutritionGoals().catch(() => null),
      getRecentNutritionFoods(8).catch(() => []),
    ]);

    if (!_data) _data = { sections: {} };
    for (const s of SECTIONS) {
      if (!_data.sections[s.key]) _data.sections[s.key] = [];
    }
    _goals     = _goals || DEFAULT_GOALS;
    _dayAdjust = _data.dayAdjust || null;

    renderView();
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Erreur de chargement</p>
      <p style="font-size:12px;color:var(--text-secondary)">${err.message}</p></div>`;
  }
}

// ─── Calculs ─────────────────────────────────────────────────────────────────

function sum(items) {
  return items.reduce((acc, item) => ({
    kcal:  acc.kcal  + (item.kcal  || 0),
    prot:  acc.prot  + (item.prot  || 0),
    carbs: acc.carbs + (item.carbs || 0),
    fats:  acc.fats  + (item.fats  || 0),
  }), { kcal: 0, prot: 0, carbs: 0, fats: 0 });
}

function allItems() { return Object.values(_data.sections).flat(); }
function round1(n)  { return Math.round(n * 10) / 10; }

function effectiveGoals() {
  if (!_dayAdjust) return _goals;
  return {
    kcal:  _goals.kcal  + (_dayAdjust.kcalDelta  || 0),
    prot:  _goals.prot  + (_dayAdjust.protDelta   || 0),
    carbs: _goals.carbs + (_dayAdjust.carbsDelta  || 0),
    fats:  _goals.fats  + (_dayAdjust.fatsDelta   || 0),
  };
}

function computeBaseFromProfile(weight, height, age, sex) {
  const bmr  = sex === 'F'
    ? 10 * weight + 6.25 * height - 5 * age - 161
    : 10 * weight + 6.25 * height - 5 * age + 5;
  const kcal  = Math.round(bmr * 1.4);
  const prot  = Math.round(weight * 1.6);
  const fats  = Math.round((kcal * 0.28) / 9);
  const carbs = Math.max(0, Math.round((kcal - prot * 4 - fats * 9) / 4));
  return { kcal, prot, carbs, fats };
}

// ─── Rendu principal ─────────────────────────────────────────────────────────

function renderView() {
  const t = sum(allItems());
  const tKcal = Math.round(t.kcal), tProt = round1(t.prot);
  const tCarbs = round1(t.carbs), tFats = round1(t.fats);
  const eff = effectiveGoals();

  const dayAdjustRow = _dayAdjust
    ? `<div class="nut-day-adjust-badge">
        <span>⚡ ${_dayAdjust.label}</span>
        <span class="nut-day-adjust-delta">${_dayAdjust.kcalDelta > 0 ? '+' : ''}${_dayAdjust.kcalDelta} kcal</span>
        <button id="nut-reset-adjust" class="btn-icon" style="width:20px;height:20px;margin-left:2px" title="Retirer l'ajustement">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
       </div>`
    : `<button id="nut-day-adjust-btn" class="nut-day-adjust-btn">⚡ Adapter au jour</button>`;

  _container.innerHTML = `
    <div class="date-nav-row">
      <div class="date-nav" style="margin-bottom:0">
        <button id="nut-prev">‹</button>
        <span class="current-date">${formatDateFR(currentDate)}</span>
        <button id="nut-next">›</button>
      </div>
    </div>

    <div class="card nut-totals-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="card-title" style="margin:0">Bilan du jour</div>
        <div style="display:flex;gap:6px;align-items:center">
          <button id="nut-edit-goals-btn" class="btn-icon" title="Modifier les objectifs manuellement" style="width:28px;height:28px;border:1px solid var(--border);border-radius:6px">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button id="nut-estimate-btn" class="nut-estimate-btn">✨ Ma base</button>
        </div>
      </div>
      ${macroBar('Calories',  tKcal,  eff.kcal,  'var(--accent)',   ' kcal')}
      ${macroBar('Protéines', tProt,  eff.prot,  '#ab47bc')}
      ${macroBar('Glucides',  tCarbs, eff.carbs, '#ffa726')}
      ${macroBar('Lipides',   tFats,  eff.fats,  'var(--success)')}
      <div style="display:flex;justify-content:flex-end;margin-top:10px">
        ${dayAdjustRow}
      </div>
    </div>

    <div id="nut-sections">
      ${SECTIONS.map(s => sectionHTML(s)).join('')}
    </div>`;

  bindEvents();
}

function macroBar(label, value, target, color, unit = 'g') {
  const pct    = Math.min(100, target > 0 ? (value / target) * 100 : 0);
  const over   = value > target;
  const barCol = over ? 'var(--danger)' : color;
  const valCol = over ? 'var(--danger)' : pct >= 90 ? 'var(--success)' : 'var(--text-primary)';
  return `
    <div class="nut-macro-row">
      <div class="nut-macro-label">${label}</div>
      <div class="nut-macro-track"><div class="nut-macro-fill" style="width:${pct}%;background:${barCol}"></div></div>
      <div class="nut-macro-value" style="color:${valCol}">${value}<span class="nut-macro-target"> / ${target}${unit}</span></div>
    </div>`;
}

// ─── Sections ────────────────────────────────────────────────────────────────

function sectionHTML(s) {
  const items = _data.sections[s.key] || [];
  const st    = sum(items);
  const has   = items.length > 0;
  return `
    <div class="nut-section card" data-section="${s.key}">
      <div class="nut-section-header">
        <div class="nut-section-left">
          <span class="nut-section-icon">${s.icon}</span>
          <span class="nut-section-label">${s.label}</span>
          ${has ? `<span class="nut-section-count">${items.length}</span>` : ''}
        </div>
        <div class="nut-section-right">
          <span class="nut-section-kcal">${has ? Math.round(st.kcal) + ' kcal' : '—'}</span>
          <button class="nut-add-btn btn-icon" data-section="${s.key}" title="Ajouter">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
      ${has ? `
        <div class="nut-section-body">
          ${items.map(item => foodItemHTML(s.key, item)).join('')}
          <div class="nut-section-footer">
            <span>P <b>${round1(st.prot)}g</b></span>
            <span>G <b>${round1(st.carbs)}g</b></span>
            <span>L <b>${round1(st.fats)}g</b></span>
          </div>
        </div>` : ''}
    </div>`;
}

function foodItemHTML(sectionKey, item) {
  return `
    <div class="nut-food-item">
      <div class="nut-food-info">
        <div class="nut-food-name">${item.name}${item.brand ? `<span class="nut-food-brand"> · ${item.brand}</span>` : ''}</div>
        <div class="nut-food-meta">${item.qty}${item.unit} · P:${item.prot}g · G:${item.carbs}g · L:${item.fats}g</div>
      </div>
      <div class="nut-food-actions">
        <span class="nut-food-kcal">${Math.round(item.kcal)} kcal</span>
        <button class="nut-edit-btn btn-icon" data-section="${sectionKey}" data-id="${item.id}" title="Modifier">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="nut-delete-btn btn-icon" data-section="${sectionKey}" data-id="${item.id}" title="Supprimer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>`;
}

// ─── Événements ──────────────────────────────────────────────────────────────

function bindEvents() {
  document.getElementById('nut-prev').addEventListener('click', () => {
    currentDate = addDays(currentDate, -1); render(_container, false);
  });
  document.getElementById('nut-next').addEventListener('click', () => {
    currentDate = addDays(currentDate, 1); render(_container, false);
  });

  _container.querySelectorAll('.nut-section-header').forEach(h => {
    h.addEventListener('click', e => {
      if (e.target.closest('.nut-add-btn')) return;
      h.closest('.nut-section').classList.toggle('open');
    });
  });

  _container.querySelectorAll('.nut-add-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openAddModal(btn.dataset.section); });
  });

  _container.querySelectorAll('.nut-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const { section, id } = btn.dataset;
      const item = _data.sections[section]?.find(i => i.id === id);
      if (item) openEditEntryModal(section, item);
    });
  });

  _container.querySelectorAll('.nut-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { section, id } = btn.dataset;
      _data.sections[section] = _data.sections[section].filter(i => i.id !== id);
      await saveNutrition(currentDate, _data);
      renderView();
    });
  });

  document.getElementById('nut-estimate-btn')?.addEventListener('click', openGoalsModal);
  document.getElementById('nut-edit-goals-btn')?.addEventListener('click', openEditGoalsModal);
  document.getElementById('nut-day-adjust-btn')?.addEventListener('click', openDayAdjustModal);
  document.getElementById('nut-reset-adjust')?.addEventListener('click', async () => {
    _dayAdjust = null;
    delete _data.dayAdjust;
    await saveNutrition(currentDate, _data);
    renderView();
    showToast('Ajustement retiré');
  });
}

// ─── Modale : édition d'un aliment ──────────────────────────────────────────

function openEditEntryModal(sectionKey, item) {
  document.getElementById('nut-entry-edit-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'nut-entry-edit-modal';
  modal.className = 'settings-modal-overlay';

  modal.innerHTML = `
    <div class="settings-modal" style="max-width:380px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h3 style="font-size:15px;font-weight:600;margin:0">Modifier l'aliment</h3>
        <button id="nee-close" class="btn-icon" style="width:30px;height:30px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <input id="nee-name"  type="text"   value="${item.name}"        placeholder="Nom *" />
        <input id="nee-brand" type="text"   value="${item.brand || ''}" placeholder="Marque (optionnel)" />
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <input id="nee-qty" type="number" value="${item.qty}" min="1" step="1" placeholder="Quantité *" />
          <select id="nee-unit">
            <option value="g"       ${item.unit === 'g'        ? 'selected' : ''}>g</option>
            <option value="ml"      ${item.unit === 'ml'       ? 'selected' : ''}>ml</option>
            <option value="pièce"   ${item.unit === 'pièce'    ? 'selected' : ''}>pièce(s)</option>
            <option value="portion" ${item.unit === 'portion'  ? 'selected' : ''}>portion(s)</option>
          </select>
        </div>
        <div id="nee-macros" style="font-size:12px;color:var(--text-secondary);padding:8px;background:var(--bg-secondary);border-radius:8px;text-align:center"></div>
        <div>
          <label style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-secondary);display:block;margin-bottom:5px">Déplacer vers</label>
          <select id="nee-section">
            ${SECTIONS.map(s => `<option value="${s.key}" ${s.key === sectionKey ? 'selected' : ''}>${s.icon} ${s.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <button id="nee-save" class="btn btn-primary" style="width:100%;margin-top:16px">Enregistrer</button>
    </div>`;

  document.body.appendChild(modal);

  const qtyInput  = modal.querySelector('#nee-qty');
  const macrosEl  = modal.querySelector('#nee-macros');

  function updateMacros() {
    const newQty = Math.max(1, parseFloat(qtyInput.value) || 1);
    const ratio  = newQty / item.qty;
    macrosEl.textContent = `${Math.round(item.kcal * ratio)} kcal · P:${round1(item.prot * ratio)}g · G:${round1(item.carbs * ratio)}g · L:${round1(item.fats * ratio)}g`;
  }
  updateMacros();
  qtyInput.addEventListener('input', updateMacros);

  const close = () => modal.remove();
  modal.querySelector('#nee-close').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  modal.querySelector('#nee-save').addEventListener('click', async () => {
    const name        = modal.querySelector('#nee-name').value.trim();
    const brand       = modal.querySelector('#nee-brand').value.trim();
    const qty         = Math.max(1, parseFloat(qtyInput.value) || 1);
    const unit        = modal.querySelector('#nee-unit').value;
    const targetSection = modal.querySelector('#nee-section').value;
    if (!name) { showToast('Le nom est obligatoire'); return; }

    const ratio = qty / item.qty;
    const updated = {
      ...item, name, brand, qty, unit,
      kcal:  Math.round(item.kcal  * ratio),
      prot:  round1(item.prot  * ratio),
      carbs: round1(item.carbs * ratio),
      fats:  round1(item.fats  * ratio),
    };

    _data.sections[sectionKey] = _data.sections[sectionKey].filter(i => i.id !== item.id);
    if (!_data.sections[targetSection]) _data.sections[targetSection] = [];
    _data.sections[targetSection].push(updated);

    await saveNutrition(currentDate, _data);
    close();
    renderView();
    if (targetSection !== sectionKey) {
      const targetLabel = SECTIONS.find(s => s.key === targetSection)?.label;
      showToast(`Déplacé vers ${targetLabel} ✓`);
      _container.querySelector(`.nut-section[data-section="${targetSection}"]`)?.classList.add('open');
    }
  });
}

// ─── Modale : édition manuelle des objectifs ────────────────────────────────

function openEditGoalsModal() {
  document.getElementById('nut-edit-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'nut-edit-modal';
  modal.className = 'settings-modal-overlay';
  const g = _goals;
  modal.innerHTML = `
    <div class="settings-modal" style="max-width:400px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <h3 style="font-size:15px;font-weight:600;margin:0">Objectifs journaliers</h3>
        <button id="neg-close" class="btn-icon" style="width:30px;height:30px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>
          <label style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-secondary);display:block;margin-bottom:5px">Calories (kcal)</label>
          <input type="number" id="neg-kcal"  value="${g.kcal}"  min="500"  max="6000" step="50">
        </div>
        <div>
          <label style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-secondary);display:block;margin-bottom:5px">Protéines (g)</label>
          <input type="number" id="neg-prot"  value="${g.prot}"  min="30"   max="400"  step="5">
        </div>
        <div>
          <label style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-secondary);display:block;margin-bottom:5px">Glucides (g)</label>
          <input type="number" id="neg-carbs" value="${g.carbs}" min="30"   max="800"  step="5">
        </div>
        <div>
          <label style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-secondary);display:block;margin-bottom:5px">Lipides (g)</label>
          <input type="number" id="neg-fats"  value="${g.fats}"  min="10"   max="300"  step="5">
        </div>
      </div>
      ${g.explanation ? `
      <div style="margin-top:14px;padding:12px 14px;background:var(--bg-secondary);border-radius:var(--radius-sm);border-left:3px solid var(--accent)">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--accent);margin-bottom:6px">Estimation Gemini</div>
        <p style="font-size:12px;color:var(--text-secondary);line-height:1.55;margin:0">${g.explanation}</p>
        ${g.tips?.length ? `<div style="margin-top:8px;display:flex;flex-direction:column;gap:4px">
          ${g.tips.map(t => `<div style="font-size:11px;color:var(--text-secondary)">💡 ${t}</div>`).join('')}
        </div>` : ''}
      </div>` : ''}
      <button id="neg-save" class="btn btn-primary" style="width:100%;margin-top:16px">Enregistrer</button>
    </div>`;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  modal.querySelector('#neg-close').addEventListener('click', close);

  modal.querySelector('#neg-save').addEventListener('click', async (e) => {
    const btn = e.target;
    const kcal  = parseInt(modal.querySelector('#neg-kcal').value)  || 0;
    const prot  = parseInt(modal.querySelector('#neg-prot').value)  || 0;
    const carbs = parseInt(modal.querySelector('#neg-carbs').value) || 0;
    const fats  = parseInt(modal.querySelector('#neg-fats').value)  || 0;
    if (!kcal || !prot) { showToast('Calories et protéines requis'); return; }
    btn.disabled = true; btn.textContent = 'Enregistrement…';
    try {
      await saveNutritionGoals({ kcal, prot, carbs, fats });
      _goals = { kcal, prot, carbs, fats };
      close();
      renderView();
      showToast('Objectifs mis à jour ✓');
    } catch {
      showToast('Erreur — réessaie');
      btn.disabled = false; btn.textContent = 'Enregistrer';
    }
  });
}

// ─── Modale : base nutritionnelle (Mifflin-St Jeor) ────────────────────────

async function openGoalsModal() {
  document.getElementById('nut-goals-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'nut-goals-modal';
  modal.className = 'settings-modal-overlay';
  modal.innerHTML = '<div class="settings-modal" style="max-width:440px"></div>';
  document.body.appendChild(modal);

  const inner = modal.querySelector('.settings-modal');
  const close = () => modal.remove();
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  inner.innerHTML = `
    <div style="text-align:center;padding:32px 16px">
      <div class="spinner" style="width:32px;height:32px;margin:0 auto 16px"></div>
      <p style="font-size:14px;font-weight:500">Chargement du profil…</p>
    </div>`;

  try {
    const [profile, weeklies] = await Promise.all([
      getUserProfile().catch(() => null),
      getLastWeeklies(4).catch(() => []),
    ]);
    const lastWeight = weeklies.at(-1)?.weight || profile?.weight;
    _showBaseGoalsForm(inner, close, profile, lastWeight);
  } catch (err) {
    inner.innerHTML = `
      <div style="text-align:center;padding:32px 16px">
        <p style="font-size:14px;font-weight:500;color:var(--danger)">Erreur</p>
        <p style="font-size:12px;color:var(--text-secondary);margin-top:6px">${err.message}</p>
        <button id="ng-close-err" class="btn btn-primary" style="margin-top:16px;width:100%">Fermer</button>
      </div>`;
    inner.querySelector('#ng-close-err').addEventListener('click', close);
  }
}

function _showBaseGoalsForm(inner, close, profile, lastWeight) {
  const needWeight = !lastWeight;
  const needHeight = !profile?.height;
  const needAge    = !profile?.age;
  const needSex    = !profile?.sex;

  const knownLine = [
    lastWeight      && `Poids : <b>${lastWeight} kg</b>`,
    profile?.height && `Taille : <b>${profile.height} cm</b>`,
    profile?.age    && `Âge : <b>${profile.age} ans</b>`,
  ].filter(Boolean).join(' · ');

  inner.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div>
        <h3 style="font-size:15px;font-weight:600;margin:0">✨ Ma base nutritionnelle</h3>
        <p style="font-size:12px;color:var(--text-secondary);margin:3px 0 0">Calories de maintien — sans surplus ni objectif sportif</p>
      </div>
      <button id="ng-close" class="btn-icon" style="width:30px;height:30px">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    ${knownLine ? `<p style="font-size:12px;color:var(--text-secondary);margin:0 0 12px">${knownLine}</p>` : ''}
    <div style="display:flex;flex-direction:column;gap:10px">
      ${needSex ? `
      <div>
        <div class="ng-q-label">Sexe</div>
        <div class="ng-q-choices">
          <label class="ng-q-choice"><input type="radio" name="ng-sex" value="M" checked><span>Homme</span></label>
          <label class="ng-q-choice"><input type="radio" name="ng-sex" value="F"><span>Femme</span></label>
        </div>
      </div>` : ''}
      ${needWeight ? `<div>
        <label class="ng-q-label">Poids actuel (kg)</label>
        <input type="number" id="ng-weight" min="30" max="200" step="0.5" placeholder="ex : 75">
      </div>` : ''}
      ${needHeight ? `<div>
        <label class="ng-q-label">Taille (cm)</label>
        <input type="number" id="ng-height" min="140" max="220" placeholder="ex : 178">
      </div>` : ''}
      ${needAge ? `<div>
        <label class="ng-q-label">Âge (ans)</label>
        <input type="number" id="ng-age" min="15" max="80" placeholder="ex : 25">
      </div>` : ''}
    </div>
    <button id="ng-compute" class="btn btn-primary" style="width:100%;margin-top:16px">Calculer ma base →</button>`;

  inner.querySelector('#ng-close').addEventListener('click', close);
  inner.querySelector('#ng-compute').addEventListener('click', async () => {
    const sex    = profile?.sex || inner.querySelector('input[name="ng-sex"]:checked')?.value || 'M';
    const weight = lastWeight     || parseFloat(inner.querySelector('#ng-weight')?.value);
    const height = profile?.height || parseFloat(inner.querySelector('#ng-height')?.value);
    const age    = profile?.age    || parseFloat(inner.querySelector('#ng-age')?.value);
    if (!weight || !height || !age) { showToast('Remplis toutes les données'); return; }
    if (needSex) await saveUserProfile({ sex }).catch(() => {});
    const result = computeBaseFromProfile(weight, height, age, sex);
    _showBaseGoalsResult(inner, close, result);
  });
}

function _showBaseGoalsResult(inner, close, result) {
  inner.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <h3 style="font-size:15px;font-weight:600;margin:0">✨ Ta base nutritionnelle</h3>
      <button id="ng-close" class="btn-icon" style="width:30px;height:30px">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <div class="ng-result-grid">
      <div class="ng-result-tile" style="border-color:var(--accent)">
        <span class="ng-result-val">${result.kcal}</span>
        <span class="ng-result-unit">kcal</span>
      </div>
      <div class="ng-result-tile" style="border-color:#ab47bc">
        <span class="ng-result-val">${result.prot}</span>
        <span class="ng-result-unit">g protéines</span>
      </div>
      <div class="ng-result-tile" style="border-color:#ffa726">
        <span class="ng-result-val">${result.carbs}</span>
        <span class="ng-result-unit">g glucides</span>
      </div>
      <div class="ng-result-tile" style="border-color:var(--success)">
        <span class="ng-result-val">${result.fats}</span>
        <span class="ng-result-unit">g lipides</span>
      </div>
    </div>

    <div style="margin:14px 0;padding:10px 12px;background:var(--bg-secondary);border-radius:var(--radius-sm);border-left:3px solid var(--accent)">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--accent);margin-bottom:4px">Mifflin-St Jeor × 1.4</div>
      <p style="font-size:12px;color:var(--text-secondary);line-height:1.55;margin:0">
        Calories de maintien sans activité sportive. Pour les jours d'entraînement, utilise <b>⚡ Adapter au jour</b> pour un ajustement personnalisé.
      </p>
    </div>

    <button id="ng-apply" class="btn btn-primary" style="width:100%">Appliquer comme base</button>`;

  inner.querySelector('#ng-close').addEventListener('click', close);
  inner.querySelector('#ng-apply').addEventListener('click', async () => {
    const goals = { kcal: result.kcal, prot: result.prot, carbs: result.carbs, fats: result.fats };
    await saveNutritionGoals(goals);
    _goals = goals;
    if (_dayAdjust) {
      _dayAdjust = null;
      delete _data.dayAdjust;
      await saveNutrition(currentDate, _data);
    }
    close();
    renderView();
    showToast('Base nutritionnelle mise à jour ✓');
  });
}

// Parse la réponse Gemini — fonctionne en mode JSON natif (responseMimeType: application/json)
// et en mode texte libre (fallback regex + strip markdown)
function _extractGeminiJSON(data, type = 'object') {
  const candidates = data.candidates;
  if (!candidates?.length) {
    const reason = data.promptFeedback?.blockReason;
    console.error('[Gemini] Pas de candidates :', JSON.stringify(data));
    throw new Error(reason ? `Gemini a bloqué la requête (${reason})` : 'Réponse vide de Gemini');
  }
  const finishReason = candidates[0]?.finishReason;
  const parts = candidates[0]?.content?.parts || [];
  const textParts = parts.filter(p => !p.thought);
  const text = (textParts.length ? textParts : parts).map(p => p.text || '').join('').trim();

  // Essai direct (mode JSON natif — texte déjà valide)
  try { return JSON.parse(text); } catch {}

  // Fallback : strip markdown + regex
  const stripped = text.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim();
  const source = stripped || text;
  const pattern = type === 'array' ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
  const match = source.match(pattern);
  if (!match) {
    console.error('[Gemini] Aucun JSON trouvé. finishReason:', finishReason, '| Texte :', text);
    throw new Error(`Réponse inattendue de Gemini [${finishReason || '?'}] : "${text.slice(0, 120).replace(/\n/g, ' ') || '(vide)'}"`);
  }
  try {
    return JSON.parse(match[0]);
  } catch (e) {
    console.error('[Gemini] JSON invalide :', match[0]);
    throw new Error(`JSON invalide de Gemini : ${e.message}`);
  }
}

// ─── Modale : ajustement du jour ────────────────────────────────────────────

async function openDayAdjustModal() {
  document.getElementById('nut-day-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'nut-day-modal';
  modal.className = 'settings-modal-overlay';
  modal.innerHTML = '<div class="settings-modal" style="max-width:440px"></div>';
  document.body.appendChild(modal);
  const inner = modal.querySelector('.settings-modal');
  const close = () => modal.remove();
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  inner.innerHTML = `
    <div style="text-align:center;padding:32px 16px">
      <div class="spinner" style="width:32px;height:32px;margin:0 auto 16px"></div>
      <p style="font-size:14px;font-weight:500">Analyse de ta journée…</p>
      <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Séance · activité · dépense estimée</p>
    </div>`;

  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      inner.innerHTML = `
        <div style="text-align:center;padding:32px 16px">
          <p style="font-size:32px;margin-bottom:8px">🔑</p>
          <p style="font-size:14px;font-weight:500">Clé API requise</p>
          <p style="font-size:13px;color:var(--text-secondary);margin-top:6px">Configure ta clé Gemini dans ⚙️ Paramètres.</p>
          <button id="nd-close-key" class="btn btn-primary" style="margin-top:16px;width:100%">Fermer</button>
        </div>`;
      inner.querySelector('#nd-close-key').addEventListener('click', close);
      return;
    }

    const [workout, profile, weeklies] = await Promise.all([
      getWorkout(currentDate).catch(() => null),
      getUserProfile().catch(() => null),
      getLastWeeklies(4).catch(() => []),
    ]);
    const lastWeight   = weeklies.at(-1)?.weight || profile?.weight;
    const activityDesc = _describeWorkout(workout);

    inner.innerHTML = `
      <div style="text-align:center;padding:32px 16px">
        <div class="spinner" style="width:32px;height:32px;margin:0 auto 16px"></div>
        <p style="font-size:14px;font-weight:500">Calcul de l'ajustement…</p>
        <p style="font-size:12px;color:var(--text-secondary);margin-top:6px;font-style:italic">${activityDesc}</p>
      </div>`;

    const result = await _geminiDayAdjust(_goals, activityDesc, lastWeight, apiKey);
    _showDayAdjustResult(inner, close, result, activityDesc);

  } catch (err) {
    inner.innerHTML = `
      <div style="text-align:center;padding:32px 16px">
        <p style="font-size:14px;font-weight:500;color:var(--danger)">Erreur</p>
        <p style="font-size:12px;color:var(--text-secondary);margin-top:6px">${err.message}</p>
        <button id="nd-close-err" class="btn btn-primary" style="margin-top:16px;width:100%">Fermer</button>
      </div>`;
    inner.querySelector('#nd-close-err').addEventListener('click', close);
  }
}

function _describeWorkout(workout) {
  if (!workout || workout.skipped) return 'Journée sans activité sportive enregistrée';
  if (workout.dayType === 'rest') return 'Journée repos (programmé)';

  // Multi-séances : décrire chaque session individuellement
  const sessions = Array.isArray(workout.sessions) && workout.sessions.length > 0
    ? workout.sessions
    : [{ type: workout.dayType, bikeData: workout.bikeData, cardioData: workout.cardioData, exercises: workout.exercises, muscleGroup: workout.muscleGroup, skipped: workout.skipped }];

  const descs = sessions
    .filter(s => !s.skipped && s.type !== 'rest')
    .map(s => _describeSession(s));

  return descs.length > 0 ? descs.join(' + ') : 'Journée sans activité sportive enregistrée';
}

function _describeSession(s) {
  if (s.type === 'velo' || s.bikeData) {
    const b = s.bikeData || {};
    const p = ['Vélo'];
    if (b.durationMinutes) p.push(`${b.durationMinutes} min`);
    if (b.distanceKm)      p.push(`${b.distanceKm} km`);
    if (b.wattsAvg)        p.push(`${b.wattsAvg} W moy.`);
    if (b.fcAvg)           p.push(`FC ${b.fcAvg} bpm`);
    if (b.elevationGain)   p.push(`D+ ${b.elevationGain} m`);
    return p.join(' · ');
  }
  if (s.type === 'course' || s.type === 'marche') {
    const c = s.cardioData || {};
    const name = s.type === 'course' ? 'Course à pied' : 'Marche';
    const p = [name];
    if (c.durationMinutes) p.push(`${c.durationMinutes} min`);
    if (c.distanceKm)      p.push(`${c.distanceKm} km`);
    if (c.fcAvg)           p.push(`FC ${c.fcAvg} bpm`);
    if (c.caloriesBurned)  p.push(`${c.caloriesBurned} kcal brûlées`);
    return p.join(' · ');
  }
  // muscu
  const exercises = s.exercises || [];
  const done  = exercises.filter(e => e.done).length;
  const total = exercises.length;
  const names = exercises.filter(e => e.done).map(e => e.name).slice(0, 4).join(', ');
  const mg    = s.muscleGroup ? ` (${s.muscleGroup})` : '';
  return `Muscu${mg} — ${done}/${total} ex.${names ? ' : ' + names : ''}`;
}

async function _geminiDayAdjust(baseGoals, activityDesc, weight, apiKey) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text:
        `Tu es nutritionniste sportif. Voici les besoins nutritionnels de base (au repos, sans sport) :
- Calories : ${baseGoals.kcal} kcal
- Protéines : ${baseGoals.prot} g
- Glucides : ${baseGoals.carbs} g
- Lipides : ${baseGoals.fats} g
${weight ? `- Poids : ${weight} kg` : ''}

Activité d'aujourd'hui : ${activityDesc}

Propose l'ajustement nutritionnel pour cette journée.
Réponds UNIQUEMENT avec ce JSON :
{"kcalDelta":0,"protDelta":0,"carbsDelta":0,"fatsDelta":0,"label":"Repos","tips":["Conseil 1","Conseil 2"]}

Si journée repos : kcalDelta = 0. label = 2-3 mots max (ex: "Séance muscu", "Sortie vélo", "Repos actif"). Valeurs entières. 2 tips courts et pratiques.` }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 16000, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erreur API Gemini (${res.status})`);
  }
  return _extractGeminiJSON(await res.json(), 'object');
}

function _showDayAdjustResult(inner, close, result, activityDesc) {
  const eff = {
    kcal:  _goals.kcal  + (result.kcalDelta  || 0),
    prot:  _goals.prot  + (result.protDelta   || 0),
    carbs: _goals.carbs + (result.carbsDelta  || 0),
    fats:  _goals.fats  + (result.fatsDelta   || 0),
  };
  const hasBoost = (result.kcalDelta || 0) > 0;
  const deltaColor = hasBoost ? '#ffa726' : 'var(--text-secondary)';

  inner.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div>
        <h3 style="font-size:15px;font-weight:600;margin:0">⚡ ${result.label}</h3>
        <p style="font-size:12px;color:var(--text-secondary);margin:3px 0 0">${activityDesc}</p>
      </div>
      <button id="nd-close" class="btn-icon" style="width:30px;height:30px">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:14px;align-items:center">
      <div style="flex:1;text-align:center;padding:10px 6px;background:var(--bg-secondary);border-radius:var(--radius-sm)">
        <div style="font-size:10px;color:var(--text-secondary);margin-bottom:2px">Base</div>
        <div style="font-size:18px;font-weight:700">${_goals.kcal}</div>
        <div style="font-size:10px;color:var(--text-secondary)">kcal</div>
      </div>
      <div style="font-size:16px;color:var(--text-secondary);flex-shrink:0">+</div>
      <div style="flex:1;text-align:center;padding:10px 6px;background:var(--bg-secondary);border-radius:var(--radius-sm);border:1px solid ${hasBoost ? 'rgba(255,167,38,.4)' : 'transparent'}">
        <div style="font-size:10px;color:var(--text-secondary);margin-bottom:2px">Sport</div>
        <div style="font-size:18px;font-weight:700;color:${deltaColor}">${hasBoost ? '+' : ''}${result.kcalDelta || 0}</div>
        <div style="font-size:10px;color:var(--text-secondary)">kcal</div>
      </div>
      <div style="font-size:16px;color:var(--text-secondary);flex-shrink:0">=</div>
      <div style="flex:1;text-align:center;padding:10px 6px;background:var(--bg-secondary);border-radius:var(--radius-sm);border:1px solid rgba(79,195,247,.4)">
        <div style="font-size:10px;color:var(--text-secondary);margin-bottom:2px">Objectif</div>
        <div style="font-size:18px;font-weight:700;color:var(--accent)">${eff.kcal}</div>
        <div style="font-size:10px;color:var(--text-secondary)">kcal</div>
      </div>
    </div>

    <div style="display:flex;gap:6px;margin-bottom:14px">
      <div style="flex:1;text-align:center;padding:8px 4px;background:var(--bg-secondary);border-radius:6px">
        <div style="font-size:13px;font-weight:600;color:#ab47bc">${eff.prot}g</div>
        <div style="font-size:10px;color:var(--text-secondary)">protéines</div>
      </div>
      <div style="flex:1;text-align:center;padding:8px 4px;background:var(--bg-secondary);border-radius:6px">
        <div style="font-size:13px;font-weight:600;color:#ffa726">${eff.carbs}g</div>
        <div style="font-size:10px;color:var(--text-secondary)">glucides</div>
      </div>
      <div style="flex:1;text-align:center;padding:8px 4px;background:var(--bg-secondary);border-radius:6px">
        <div style="font-size:13px;font-weight:600;color:var(--success)">${eff.fats}g</div>
        <div style="font-size:10px;color:var(--text-secondary)">lipides</div>
      </div>
    </div>

    ${result.tips?.length ? `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">
      ${result.tips.map(t => `<div class="ng-tip">💡 ${t}</div>`).join('')}
    </div>` : ''}

    <button id="nd-apply" class="btn btn-primary" style="width:100%">Appliquer pour aujourd'hui</button>`;

  inner.querySelector('#nd-close').addEventListener('click', close);
  inner.querySelector('#nd-apply').addEventListener('click', async () => {
    _dayAdjust = {
      kcalDelta:  result.kcalDelta  || 0,
      protDelta:  result.protDelta  || 0,
      carbsDelta: result.carbsDelta || 0,
      fatsDelta:  result.fatsDelta  || 0,
      label:      result.label || 'Activité',
    };
    _data.dayAdjust = _dayAdjust;
    await saveNutrition(currentDate, _data);
    close();
    renderView();
    showToast(`⚡ ${result.label} — objectif ajusté ✓`);
  });
}

// ─── Open Food Facts ─────────────────────────────────────────────────────────

async function searchFoods(query) {
  const base = 'https://world.openfoodfacts.org/cgi/search.pl?action=process&json=1&page_size=10&lc=fr&cc=fr';
  const words = query.trim().split(/\s+/);

  const requests = [
    fetch(`${base}&search_terms=${encodeURIComponent(query)}`).then(r => r.json()),
  ];
  // Si plusieurs mots : tente aussi premier mot = marque, reste = nom produit
  if (words.length >= 2) {
    const brand = words[0];
    const name = words.slice(1).join(' ');
    requests.push(
      fetch(`${base}&brands=${encodeURIComponent(brand)}&search_terms=${encodeURIComponent(name)}`).then(r => r.json())
    );
  }

  const results = await Promise.allSettled(requests);
  const seen = new Set();
  const products = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const p of (r.value.products || [])) {
      if (!(p.product_name || p.product_name_fr)) continue;
      const key = p.code || (p.product_name_fr || p.product_name);
      if (!seen.has(key)) { seen.add(key); products.push(p); }
    }
  }
  return products.slice(0, 10);
}

async function lookupBarcode(barcode) {
  const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
  if (!res.ok) throw new Error('Produit introuvable');
  const data = await res.json();
  return data.status === 1 ? data.product : null;
}

function parseProduct(p) {
  const n = p.nutriments || {};
  return {
    name:        (p.product_name_fr || p.product_name || '').trim(),
    brand:       (p.brands || '').split(',')[0].trim(),
    kcalPer100:  Math.round(n['energy-kcal_100g'] || 0),
    protPer100:  round1(n.proteins_100g    || 0),
    carbsPer100: round1(n.carbohydrates_100g || 0),
    fatsPer100:  round1(n.fat_100g         || 0),
  };
}

// ─── Modale ajout ────────────────────────────────────────────────────────────

function openAddModal(sectionKey) {
  document.getElementById('nut-modal')?.remove();
  const s = SECTIONS.find(x => x.key === sectionKey);
  let stopScanner = null; // cleanup fn for camera stream

  const modal = document.createElement('div');
  modal.id = 'nut-modal';
  modal.className = 'settings-modal-overlay';

  function close() {
    stopScanner?.();
    modal.remove();
  }

  function setContent(html) { modal.querySelector('.settings-modal').innerHTML = html; }

  // ── Tab: liste (recents + search + scanner + manuel) ──────────────────────
  function showBrowse(activeTab = 'search') {
    stopScanner?.();
    stopScanner = null;

    const hasRecents = _recents.length > 0;
    const tabs = [
      ...(hasRecents ? [{ id: 'recents', label: 'Récents' }] : []),
      { id: 'search',  label: '🔍 Rechercher' },
      { id: 'scanner', label: '📷 Scanner' },
      { id: 'photo',   label: '✨ Photo IA' },
      { id: 'manual',  label: '✏️ Manuel' },
    ];
    if (!hasRecents && activeTab === 'recents') activeTab = 'search';

    setContent(`
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <h3 style="font-size:15px;font-weight:600;margin:0">${s.icon} ${s.label}</h3>
        <button id="nut-close" class="btn-icon" style="width:30px;height:30px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="nut-tabs">
        ${tabs.map(t => `<button class="nut-tab${t.id === activeTab ? ' active' : ''}" data-tab="${t.id}">${t.label}</button>`).join('')}
      </div>
      <div id="nut-tab-content" style="margin-top:14px"></div>
    `);

    modal.querySelector('#nut-close').addEventListener('click', close);
    modal.querySelectorAll('.nut-tab').forEach(tab => {
      tab.addEventListener('click', () => showBrowse(tab.dataset.tab));
    });

    const content = modal.querySelector('#nut-tab-content');
    if (activeTab === 'recents')  showRecents(content);
    if (activeTab === 'search')   showSearch(content);
    if (activeTab === 'scanner')  showScanner(content);
    if (activeTab === 'photo')    showPhoto(content);
    if (activeTab === 'manual')   showManual(content);
  }

  // ── Récents ──────────────────────────────────────────────────────────────
  function showRecents(el) {
    el.innerHTML = `
      <div class="nut-recents-row">
        ${_recents.map(f => `<button class="nut-recent-chip" data-id="${f.id}">${f.name}</button>`).join('')}
      </div>
      <button id="nut-copy-day-btn" style="margin-top:12px;width:100%;padding:8px;background:transparent;border:1px dashed var(--border);border-radius:var(--radius-sm);color:var(--text-secondary);font-size:12px;cursor:pointer">
        📅 Copier depuis un autre jour…
      </button>`;
    el.querySelectorAll('.nut-recent-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const f = _recents.find(x => x.id === chip.dataset.id);
        if (f) showConfirm({ name: f.name, brand: f.brand || '',
          kcalPer100: f.kcal, protPer100: f.prot,
          carbsPer100: f.carbs, fatsPer100: f.fats,
          defaultQty: f.qty, defaultUnit: f.unit,
        });
      });
    });
    el.querySelector('#nut-copy-day-btn').addEventListener('click', () => showCopyFromDay(el));
  }

  // ── Recherche Open Food Facts ─────────────────────────────────────────────
  function showSearch(el) {
    el.innerHTML = `
      <input id="nut-search-input" type="text" placeholder="Nom ou marque + nom (ex: Alesto amandes)" autocomplete="off" />
      <div id="nut-search-results" style="margin-top:10px"></div>`;

    let debounce = null;
    el.querySelector('#nut-search-input').addEventListener('input', e => {
      clearTimeout(debounce);
      const q = e.target.value.trim();
      const results = el.querySelector('#nut-search-results');
      if (q.length < 2) { results.innerHTML = ''; return; }
      results.innerHTML = '<div style="font-size:12px;color:var(--text-secondary);padding:8px 0">Recherche…</div>';
      debounce = setTimeout(async () => {
        try {
          const products = await searchFoods(q);
          if (!products.length) {
            results.innerHTML = '<div style="font-size:12px;color:var(--text-secondary);padding:8px 0">Aucun résultat</div>';
            return;
          }
          results.innerHTML = products.map((p, i) => {
            const parsed = parseProduct(p);
            if (!parsed.name) return '';
            return `
              <div class="nut-result-item" data-idx="${i}">
                <div class="nut-result-name">${parsed.name}${parsed.brand ? `<span class="nut-food-brand"> · ${parsed.brand}</span>` : ''}</div>
                <div class="nut-result-meta">${parsed.kcalPer100} kcal · P:${parsed.protPer100}g · G:${parsed.carbsPer100}g · L:${parsed.fatsPer100}g <span style="color:var(--text-secondary);font-size:10px">/ 100g</span></div>
              </div>`;
          }).join('');
          results.querySelectorAll('.nut-result-item').forEach(item => {
            item.addEventListener('click', () => {
              const parsed = parseProduct(products[parseInt(item.dataset.idx)]);
              showConfirm(parsed);
            });
          });
        } catch {
          results.innerHTML = '<div style="font-size:12px;color:var(--danger);padding:8px 0">Erreur de connexion</div>';
        }
      }, 400);
    });

    setTimeout(() => el.querySelector('#nut-search-input')?.focus(), 50);
  }

  // ── Scanner ───────────────────────────────────────────────────────────────
  function showScanner(el) {
    if (!('BarcodeDetector' in window)) {
      el.innerHTML = `
        <div style="text-align:center;padding:24px 0;color:var(--text-secondary)">
          <div style="font-size:32px;margin-bottom:8px">📷</div>
          <p style="font-size:13px">Scanner non disponible sur ce navigateur.</p>
          <p style="font-size:12px;margin-top:4px">Utilise Chrome Android pour scanner.</p>
        </div>`;
      return;
    }

    el.innerHTML = `
      <div style="position:relative;border-radius:var(--radius-sm);overflow:hidden;background:#000;aspect-ratio:4/3">
        <video id="nut-scanner-video" playsinline muted style="width:100%;height:100%;object-fit:cover"></video>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
          <div style="width:60%;height:40%;border:2px solid var(--accent);border-radius:8px;box-shadow:0 0 0 9999px rgba(0,0,0,0.4)"></div>
        </div>
      </div>
      <p id="nut-scanner-status" style="font-size:12px;color:var(--text-secondary);text-align:center;margin-top:8px">Pointe la caméra vers le code-barres</p>`;

    const video = el.querySelector('#nut-scanner-video');
    const status = el.querySelector('#nut-scanner-status');

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        video.srcObject = stream;
        await video.play();

        const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
        let active = true;

        stopScanner = () => {
          active = false;
          stream.getTracks().forEach(t => t.stop());
        };

        const scan = async () => {
          if (!active) return;
          try {
            const codes = await detector.detect(video);
            if (codes.length > 0) {
              active = false;
              stream.getTracks().forEach(t => t.stop());
              status.textContent = 'Code détecté — recherche du produit…';
              try {
                const product = await lookupBarcode(codes[0].rawValue);
                if (product) {
                  showConfirm(parseProduct(product));
                } else {
                  status.textContent = 'Produit non trouvé dans la base. Essaie la recherche manuelle.';
                  status.style.color = 'var(--danger)';
                }
              } catch {
                status.textContent = 'Erreur lors de la recherche du produit.';
                status.style.color = 'var(--danger)';
              }
              return;
            }
          } catch { /* frame error, continue */ }
          requestAnimationFrame(scan);
        };
        requestAnimationFrame(scan);

      } catch (err) {
        el.innerHTML = `<div style="text-align:center;padding:24px 0;color:var(--danger);font-size:13px">
          Accès caméra refusé.<br><span style="color:var(--text-secondary);font-size:12px">${err.message}</span>
        </div>`;
      }
    })();
  }

  // ── Photo IA ─────────────────────────────────────────────────────────────
  function showPhoto(el) {
    el.innerHTML = `
      <div id="nut-photo-step-pick">
        <label class="nut-photo-upload-label" for="nut-photo-input">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          <span style="font-size:14px;font-weight:500;margin-top:6px">Prendre une photo</span>
          <span style="font-size:11px;color:var(--text-secondary);margin-top:2px">ou importer depuis la galerie</span>
        </label>
        <input id="nut-photo-input" type="file" accept="image/*" capture="environment" style="display:none">
        <p style="font-size:11px;color:var(--text-secondary);text-align:center;margin-top:10px">
          Claude analysera ton assiette et estimera les macros ✨
        </p>
      </div>

      <div id="nut-photo-step-preview" style="display:none">
        <img id="nut-photo-img" style="width:100%;max-height:180px;object-fit:cover;border-radius:var(--radius-sm);margin-bottom:10px">
        <textarea id="nut-photo-hint" rows="2" placeholder="Instruction optionnelle… (ex: décompose en plusieurs articles, donne-moi le plat complet)" style="width:100%;resize:none;font-size:12px;margin-bottom:10px;box-sizing:border-box"></textarea>
        <div style="display:flex;gap:8px">
          <button id="nut-photo-retry" class="btn" style="flex:1">↩ Rechoisir</button>
          <button id="nut-photo-analyze" class="btn btn-primary" style="flex:2">✨ Analyser</button>
        </div>
      </div>

      <div id="nut-photo-step-loading" style="display:none;text-align:center;padding:24px 0">
        <div class="spinner" style="width:28px;height:28px;margin:0 auto 10px"></div>
        <p style="font-size:13px;color:var(--text-secondary)">Analyse en cours…</p>
        <p style="font-size:11px;color:var(--text-secondary);margin-top:4px">Claude examine ton repas</p>
      </div>

      <div id="nut-photo-step-results" style="display:none"></div>`;

    let photoBase64 = null;
    let photoMediaType = null;

    const input = el.querySelector('#nut-photo-input');
    const stepPick    = el.querySelector('#nut-photo-step-pick');
    const stepPreview = el.querySelector('#nut-photo-step-preview');
    const stepLoading = el.querySelector('#nut-photo-step-loading');
    const stepResults = el.querySelector('#nut-photo-step-results');

    function goTo(step) {
      stepPick.style.display    = step === 'pick'    ? '' : 'none';
      stepPreview.style.display = step === 'preview' ? '' : 'none';
      stepLoading.style.display = step === 'loading' ? '' : 'none';
      stepResults.style.display = step === 'results' ? '' : 'none';
    }

    input.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      photoMediaType = file.type || 'image/jpeg';
      const reader = new FileReader();
      reader.onload = ev => {
        photoBase64 = ev.target.result.split(',')[1];
        el.querySelector('#nut-photo-img').src = ev.target.result;
        goTo('preview');
      };
      reader.readAsDataURL(file);
    });

    el.querySelector('#nut-photo-retry').addEventListener('click', () => {
      input.value = '';
      goTo('pick');
    });

    el.querySelector('#nut-photo-analyze').addEventListener('click', async () => {
      if (!photoBase64) return;
      const hint = el.querySelector('#nut-photo-hint').value.trim();
      goTo('loading');
      try {
        const apiKey = await getApiKey();
        if (!apiKey) {
          goTo('preview');
          showToast('Configure ta clé API Gemini dans ⚙️ Paramètres');
          return;
        }
        const foods = await analyzePhotoWithGemini(photoBase64, photoMediaType, apiKey, hint);
        renderPhotoResults(stepResults, foods);
        goTo('results');
      } catch (err) {
        goTo('preview');
        showToast('Erreur d\'analyse — ' + (err.message || 'Réessaie'));
      }
    });
  }

  async function analyzePhotoWithGemini(base64, mediaType, apiKey, hint = '') {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const hintSection = hint
      ? `\n\nInstruction de l'utilisateur : "${hint}"\nImportant : si l'instruction précise une quantité (ex: "j'en ai mangé 3", "une portion", "2 tranches"), utilise-la pour calculer les macros TOTALES pour cette quantité exacte. Lis les valeurs nutritionnelles sur l'emballage si visible, déduis le poids/la quantité d'une unité, puis multiplie. Adapte l'unité en conséquence (pièce, tranche, portion…).`
      : '';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mediaType, data: base64 } },
            {
              text: `Tu es un expert en nutrition. Analyse cette photo et identifie chaque aliment visible.${hintSection}

Pour chaque aliment, retourne les macros TOTALES pour la quantité effectivement consommée (pas par 100g).
Priorité pour estimer les valeurs nutritionnelles :
1. Si un tableau nutritionnel est lisible sur l'emballage → utilise ces valeurs exactes.
2. Sinon, identifie le produit (marque, type) depuis l'emballage et utilise tes connaissances nutritionnelles pour estimer.
3. Si aucun emballage → estime visuellement la portion et les macros typiques de cet aliment.
Unités acceptées : "g", "ml", "pièce", "tranche", "portion".

Réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour :
[{"name":"Nom de l'aliment","qty":3,"unit":"pièce","kcal":180,"prot":1.5,"carbs":36,"fats":3}]

Maximum 8 aliments. Valeurs réalistes.`,
            },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: 'application/json' },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Erreur API Gemini (${res.status})`);
    }

    return _extractGeminiJSON(await res.json(), 'array');
  }

  function renderPhotoResults(el, foods) {
    if (!foods.length) {
      el.innerHTML = `<p style="text-align:center;font-size:13px;color:var(--text-secondary);padding:16px 0">Aucun aliment détecté — essaie avec une photo plus nette.</p>`;
      return;
    }

    // Copie mutable des quantités (base = valeur Gemini)
    const qtys = foods.map(f => f.qty);

    function macrosForQty(f, qty) {
      const ratio = qty / f.qty;
      return {
        kcal: Math.round(f.kcal * ratio),
        prot: round1(f.prot * ratio),
        carbs: round1(f.carbs * ratio),
        fats: round1(f.fats * ratio),
      };
    }

    function foodRowHTML(f, i) {
      const m = macrosForQty(f, qtys[i]);
      return `
        <div class="nut-photo-food-row" data-idx="${i}">
          <input type="checkbox" data-idx="${i}" checked style="margin-top:2px;flex-shrink:0">
          <div style="min-width:0;flex:1">
            <div style="font-size:13px;font-weight:500;margin-bottom:4px">${f.name}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
              <input type="number" class="photo-qty-input" data-idx="${i}" value="${qtys[i]}" min="1" step="1"
                style="width:64px;padding:3px 6px;font-size:12px;border-radius:6px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text-primary);text-align:center">
              <span style="font-size:12px;color:var(--text-secondary)">${f.unit}</span>
            </div>
            <div class="photo-macros" data-idx="${i}" style="font-size:11px;color:var(--text-secondary)">
              ${m.kcal} kcal · P:${m.prot}g · G:${m.carbs}g · L:${m.fats}g
            </div>
          </div>
        </div>`;
    }

    el.innerHTML = `
      <div style="font-size:12px;color:var(--text-secondary);margin-bottom:10px">
        ${foods.length} aliment(s) détecté(s) — ajuste les quantités et coche ceux à ajouter :
      </div>
      <div id="nut-photo-food-list">${foods.map((f, i) => foodRowHTML(f, i)).join('')}</div>
      <button id="nut-photo-add" class="btn btn-primary" style="width:100%;margin-top:12px">
        Ajouter les sélectionnés
      </button>`;

    // Mise à jour des macros en temps réel
    el.querySelectorAll('.photo-qty-input').forEach(input => {
      input.addEventListener('input', () => {
        const i = parseInt(input.dataset.idx);
        const qty = Math.max(1, parseFloat(input.value) || 1);
        qtys[i] = qty;
        const m = macrosForQty(foods[i], qty);
        el.querySelector(`.photo-macros[data-idx="${i}"]`).textContent =
          `${m.kcal} kcal · P:${m.prot}g · G:${m.carbs}g · L:${m.fats}g`;
      });
    });

    el.querySelector('#nut-photo-add').addEventListener('click', async () => {
      const checked = el.querySelectorAll('input[type=checkbox]:checked');
      if (!checked.length) { showToast('Sélectionne au moins un aliment'); return; }
      for (const cb of checked) {
        const i = parseInt(cb.dataset.idx);
        const f = foods[i];
        const qty = qtys[i];
        const m = macrosForQty(f, qty);
        await addEntry({
          name: f.name, brand: '',
          qty, unit: f.unit,
          kcal: m.kcal, prot: m.prot, carbs: m.carbs, fats: m.fats,
        });
      }
    });
  }

  // ── Copier depuis un jour précédent ──────────────────────────────────────
  function showCopyFromDay(el) {
    let copyDate = addDays(currentDate, -1);

    async function renderCopy() {
      el.innerHTML = `
        <div class="date-nav" style="margin-bottom:12px;margin-top:0">
          <button id="copy-prev">‹</button>
          <span class="current-date" style="font-size:13px">${formatDateFR(copyDate)}</span>
          <button id="copy-next">›</button>
        </div>
        <div id="copy-day-content" style="min-height:60px">
          <div class="spinner" style="margin:16px auto;width:20px;height:20px"></div>
        </div>`;

      el.querySelector('#copy-prev').addEventListener('click', () => {
        copyDate = addDays(copyDate, -1);
        renderCopy();
      });
      el.querySelector('#copy-next').addEventListener('click', () => {
        if (copyDate >= currentDate) return;
        copyDate = addDays(copyDate, 1);
        renderCopy();
      });

      const dayData = await getNutrition(copyDate).catch(() => null);
      const content = el.querySelector('#copy-day-content');

      // Collect all items across all sections
      const allItems = [];
      for (const sec of SECTIONS) {
        const secItems = dayData?.sections?.[sec.key] || [];
        if (secItems.length) {
          allItems.push({ sec, items: secItems });
        }
      }

      if (!allItems.length) {
        content.innerHTML = `<p style="font-size:13px;color:var(--text-secondary);text-align:center;padding:16px 0">Aucun aliment enregistré ce jour-là.</p>`;
        return;
      }

      // Build a flat indexed list for event binding
      const flat = [];
      content.innerHTML = allItems.map(({ sec, items }) => {
        const start = flat.length;
        items.forEach(item => flat.push(item));
        return `
          <div style="font-size:11px;text-transform:uppercase;color:var(--text-secondary);letter-spacing:.04em;margin:10px 0 4px">${sec.icon} ${sec.label}</div>
          ${items.map((item, localIdx) => {
            const idx = start + localIdx;
            return `<div class="nut-result-item" style="display:flex;align-items:center;gap:8px">
              <div style="min-width:0;flex:1">
                <div class="nut-result-name">${item.name}${item.brand ? `<span class="nut-food-brand"> · ${item.brand}</span>` : ''}</div>
                <div class="nut-result-meta">${item.qty}${item.unit} · ${Math.round(item.kcal)} kcal · P:${item.prot}g · G:${item.carbs}g · L:${item.fats}g</div>
              </div>
              <button class="btn-icon copy-add-btn" data-idx="${idx}" title="Ajouter" style="width:28px;height:28px;flex-shrink:0;border:1px solid var(--accent);border-radius:6px;color:var(--accent)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>`;
          }).join('')}`;
      }).join('');

      content.querySelectorAll('.copy-add-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const { id: _id, ...item } = flat[parseInt(btn.dataset.idx)];
          btn.disabled = true;
          btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
          await addEntry(item);
        });
      });
    }

    renderCopy();
  }

  // ── Manuel ────────────────────────────────────────────────────────────────
  function showManual(el) {
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <input id="nf-name"  type="text"   placeholder="Nom *" />
        <input id="nf-brand" type="text"   placeholder="Marque (optionnel)" />
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <input id="nf-qty"  type="number" placeholder="Quantité *" min="1" step="1" />
          <select id="nf-unit">
            <option value="g">g</option>
            <option value="ml">ml</option>
            <option value="pièce">pièce(s)</option>
            <option value="portion">portion(s)</option>
          </select>
        </div>
        <div style="font-size:11px;text-transform:uppercase;color:var(--text-secondary);letter-spacing:.04em;margin-top:4px">
          Valeurs pour la quantité saisie
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <input id="nf-kcal"  type="number" placeholder="Calories (kcal) *" min="0" step="1" />
          <input id="nf-prot"  type="number" placeholder="Protéines (g)"     min="0" step="0.1" />
          <input id="nf-carbs" type="number" placeholder="Glucides (g)"      min="0" step="0.1" />
          <input id="nf-fats"  type="number" placeholder="Lipides (g)"       min="0" step="0.1" />
        </div>
        <button id="nf-save" class="btn btn-primary" style="margin-top:4px">Ajouter</button>
      </div>`;

    el.querySelector('#nf-save').addEventListener('click', async () => {
      const name = el.querySelector('#nf-name').value.trim();
      const kcal = parseFloat(el.querySelector('#nf-kcal').value);
      const qty  = parseFloat(el.querySelector('#nf-qty').value);
      if (!name || isNaN(kcal) || isNaN(qty) || qty <= 0) {
        showToast('Nom, calories et quantité sont requis'); return;
      }
      await addEntry({
        name, brand: el.querySelector('#nf-brand').value.trim(),
        qty, unit: el.querySelector('#nf-unit').value,
        kcal: Math.round(kcal),
        prot:  round1(parseFloat(el.querySelector('#nf-prot').value)  || 0),
        carbs: round1(parseFloat(el.querySelector('#nf-carbs').value) || 0),
        fats:  round1(parseFloat(el.querySelector('#nf-fats').value)  || 0),
      });
    });
  }

  // ── Confirmation quantité (depuis recherche/scan) ─────────────────────────
  function showConfirm(food) {
    // food = { name, brand, kcalPer100, protPer100, carbsPer100, fatsPer100, defaultQty?, defaultUnit? }
    const defaultQty  = food.defaultQty  || 100;
    const defaultUnit = food.defaultUnit || 'g';

    setContent(`
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
        <button id="nut-back" class="btn-icon" style="width:30px;height:30px;flex-shrink:0">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div style="min-width:0">
          <div style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${food.name}</div>
          ${food.brand ? `<div style="font-size:12px;color:var(--text-secondary)">${food.brand}</div>` : ''}
        </div>
      </div>

      <div style="background:var(--bg-secondary);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:14px;font-size:12px;color:var(--text-secondary)">
        Pour 100g/ml : <b style="color:var(--text-primary)">${food.kcalPer100} kcal</b>
        · P:<b style="color:var(--text-primary)">${food.protPer100}g</b>
        · G:<b style="color:var(--text-primary)">${food.carbsPer100}g</b>
        · L:<b style="color:var(--text-primary)">${food.fatsPer100}g</b>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        <input id="cf-qty"  type="number" value="${defaultQty}" min="1" step="1" placeholder="Quantité *" />
        <select id="cf-unit">
          <option value="g"       ${defaultUnit==='g'       ?'selected':''}>g</option>
          <option value="ml"      ${defaultUnit==='ml'      ?'selected':''}>ml</option>
          <option value="pièce"   ${defaultUnit==='pièce'   ?'selected':''}>pièce(s)</option>
          <option value="portion" ${defaultUnit==='portion' ?'selected':''}>portion(s)</option>
        </select>
      </div>

      <div id="cf-preview" class="nut-confirm-preview"></div>

      <button id="cf-save" class="btn btn-primary" style="width:100%;margin-top:12px">
        Ajouter à ${s.label}
      </button>
    `);

    modal.querySelector('#nut-back').addEventListener('click', () => showBrowse('search'));
    modal.querySelector('#nut-close')?.addEventListener('click', close);

    function updatePreview() {
      const qty   = parseFloat(modal.querySelector('#cf-qty').value) || 0;
      const unit  = modal.querySelector('#cf-unit').value;
      const ratio = (['g','ml'].includes(unit)) ? qty / 100 : qty;
      const kcal  = Math.round((food.kcalPer100  || 0) * ratio);
      const prot  = round1((food.protPer100  || 0) * ratio);
      const carbs = round1((food.carbsPer100 || 0) * ratio);
      const fats  = round1((food.fatsPer100  || 0) * ratio);
      modal.querySelector('#cf-preview').innerHTML = `
        <div style="display:flex;justify-content:space-between;font-size:13px">
          <span style="font-weight:700;color:var(--accent)">${kcal} kcal</span>
          <span>P: <b>${prot}g</b></span>
          <span>G: <b>${carbs}g</b></span>
          <span>L: <b>${fats}g</b></span>
        </div>`;
      return { qty, unit, kcal, prot, carbs, fats };
    }

    modal.querySelector('#cf-qty').addEventListener('input', updatePreview);
    modal.querySelector('#cf-unit').addEventListener('change', updatePreview);
    updatePreview();

    modal.querySelector('#cf-save').addEventListener('click', async () => {
      const { qty, unit, kcal, prot, carbs, fats } = updatePreview();
      if (!qty || qty <= 0) { showToast('Quantité invalide'); return; }
      await addEntry({ name: food.name, brand: food.brand, qty, unit, kcal, prot, carbs, fats });
    });
  }

  // ── Ajout en base ─────────────────────────────────────────────────────────
  async function addEntry(entry) {
    entry.id = Date.now().toString();
    _data.sections[sectionKey].push(entry);
    await saveNutrition(currentDate, _data);
    await saveNutritionFood(entry);
    _recents = await getRecentNutritionFoods(8).catch(() => []);
    close();
    renderView();
    _container.querySelector(`.nut-section[data-section="${sectionKey}"]`)?.classList.add('open');
    showToast(`${entry.name} ajouté ✓`);
  }

  // ── Init modal ────────────────────────────────────────────────────────────
  modal.innerHTML = '<div class="settings-modal" style="max-width:440px"></div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  showBrowse(_recents.length > 0 ? 'recents' : 'search');
}
