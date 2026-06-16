import { today, formatDateFR, addDays, showToast } from '../utils.js';
import { getHydration, saveHydration, getHydrationGoal, saveHydrationGoal, getNutrition } from '../db.js';

let currentDate = null;
let _container  = null;
let _data       = null;  // { entries: [{id, ml, label, time}] }
let _goal       = 2000;
let _nutLiquids = [];    // nutrition items with unit === 'ml'

export async function render(container, resetDate = true) {
  if (resetDate || !currentDate) currentDate = today();
  _container = container;
  container.innerHTML = '<div class="spinner"></div>';

  try {
    [_data, _goal] = await Promise.all([
      getHydration(currentDate).catch(() => null),
      getHydrationGoal().catch(() => 2000),
    ]);

    if (!_data) _data = { entries: [] };

    await _loadNutLiquids();
    renderView();
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Erreur de chargement</p>
      <p style="font-size:12px;color:var(--text-secondary)">${err.message}</p></div>`;
  }
}

async function _loadNutLiquids() {
  try {
    const nut = await getNutrition(currentDate);
    if (!nut) { _nutLiquids = []; return; }
    _nutLiquids = Object.entries(nut.sections || {}).flatMap(([section, items]) =>
      (items || [])
        .filter(i => i.unit === 'ml' && i.qty > 0)
        .map(i => ({ ...i, section }))
    );
  } catch {
    _nutLiquids = [];
  }
}

function totalWater() {
  return (_data.entries || []).reduce((s, e) => s + (e.ml || 0), 0);
}

function totalOther() {
  return _nutLiquids.reduce((s, i) => s + (i.qty || 0), 0);
}

function renderView() {
  const water = totalWater();
  const other = totalOther();
  const total = water + other;
  const pctWater = _goal > 0 ? Math.min(100, (water / _goal) * 100) : 0;
  const pctOther = _goal > 0 ? Math.min(100 - pctWater, (other / _goal) * 100) : 0;
  const pctTotal = Math.min(100, pctWater + pctOther);

  const barColor  = total >= _goal ? 'var(--success)' : total >= _goal * 0.7 ? 'var(--accent)' : '#ef9a9a';
  const totalColor = total >= _goal ? 'var(--success)' : total >= _goal * 0.5 ? 'var(--text-primary)' : 'var(--text-secondary)';

  const QUICK_AMOUNTS = [200, 250, 300, 330, 500];

  _container.innerHTML = `
    <div class="date-nav-row">
      <div class="date-nav" style="margin-bottom:0">
        <button id="hyd-prev">‹</button>
        <span class="current-date">${formatDateFR(currentDate)}</span>
        <button id="hyd-next">›</button>
      </div>
    </div>

    <div class="card" style="text-align:center">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div class="card-title" style="margin:0">💧 Hydratation du jour</div>
        <button id="hyd-goal-btn" class="btn-icon" title="Modifier l'objectif"
          style="width:28px;height:28px;border:1px solid var(--border);border-radius:6px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
          </svg>
        </button>
      </div>

      <div style="font-size:36px;font-weight:700;color:${totalColor};line-height:1">
        ${total >= 1000 ? (total / 1000).toFixed(1).replace('.', ',') + ' L' : total + ' ml'}
      </div>
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
        sur ${_goal >= 1000 ? (_goal / 1000).toFixed(1).replace('.', ',') + ' L' : _goal + ' ml'} objectif
        ${total >= _goal ? ' · <span style="color:var(--success)">✓ Objectif atteint !</span>' : ''}
      </div>

      <div style="height:12px;background:var(--bg-primary);border-radius:6px;overflow:hidden;margin-bottom:8px;position:relative">
        <div style="position:absolute;left:0;top:0;height:100%;width:${pctWater}%;background:#4fc3f7;border-radius:6px 0 0 6px;transition:width .4s"></div>
        <div style="position:absolute;left:${pctWater}%;top:0;height:100%;width:${pctOther}%;background:#ffa726;transition:width .4s"></div>
      </div>
      <div style="display:flex;gap:16px;justify-content:center;font-size:12px;margin-bottom:4px">
        <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#4fc3f7;margin-right:4px"></span>
          Eau <b style="color:var(--text-primary)">${water} ml</b></span>
        ${other > 0 ? `<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ffa726;margin-right:4px"></span>
          Autres <b style="color:var(--text-primary)">${other} ml</b></span>` : ''}
      </div>
    </div>

    <div class="card">
      <div class="card-title">Ajouter de l'eau</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        ${QUICK_AMOUNTS.map(ml => `
          <button class="hyd-quick-btn btn btn-small"
            data-ml="${ml}"
            style="flex:1;min-width:56px;background:var(--bg-secondary);border:1px solid var(--border);color:var(--text-primary);font-size:13px;padding:8px 4px">
            +${ml}
          </button>`).join('')}
      </div>
      <div style="display:flex;gap:8px">
        <input type="number" id="hyd-custom-ml" placeholder="Quantité (ml)"
          min="1" max="3000" step="10"
          style="flex:1;padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:14px">
        <button id="hyd-custom-add" class="btn btn-primary" style="width:auto;padding:10px 16px;font-size:13px">
          Ajouter
        </button>
      </div>
    </div>

    ${(_data.entries || []).length > 0 ? `
    <div class="card">
      <div class="card-title">Eau ajoutée</div>
      <div id="hyd-entries-list">
        ${[...(_data.entries || [])].reverse().map(e => `
          <div class="hyd-entry" style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:20px">💧</span>
              <div>
                <div style="font-size:14px;font-weight:600;color:#4fc3f7">${e.ml} ml</div>
                ${e.time ? `<div style="font-size:11px;color:var(--text-secondary)">${e.time}</div>` : ''}
              </div>
            </div>
            <button class="hyd-delete-btn btn-icon" data-id="${e.id}"
              style="width:28px;height:28px;border:1px solid var(--border);border-radius:6px;color:var(--danger)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>`).join('')}
      </div>
    </div>` : ''}

    ${_nutLiquids.length > 0 ? `
    <div class="card">
      <div class="card-title">Autres liquides (nutrition)</div>
      <p style="font-size:12px;color:var(--text-secondary);margin-bottom:10px">
        Boissons enregistrées dans la nutrition du jour (en ml).
      </p>
      ${_nutLiquids.map(i => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:18px">🧃</span>
            <div>
              <div style="font-size:13px;font-weight:500">${i.name}${i.brand ? ` <span style="color:var(--text-secondary);font-weight:400">· ${i.brand}</span>` : ''}</div>
              <div style="font-size:11px;color:var(--text-secondary)">${Math.round(i.kcal || 0)} kcal</div>
            </div>
          </div>
          <span style="font-size:14px;font-weight:600;color:#ffa726">${i.qty} ml</span>
        </div>`).join('')}
    </div>` : ''}
  `;

  bindEvents();
}

function bindEvents() {
  document.getElementById('hyd-prev').addEventListener('click', () => {
    currentDate = addDays(currentDate, -1); render(_container, false);
  });
  document.getElementById('hyd-next').addEventListener('click', () => {
    currentDate = addDays(currentDate, 1); render(_container, false);
  });

  _container.querySelectorAll('.hyd-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => addWater(parseInt(btn.dataset.ml)));
  });

  document.getElementById('hyd-custom-add').addEventListener('click', () => {
    const input = document.getElementById('hyd-custom-ml');
    const ml = parseInt(input.value);
    if (!ml || ml <= 0) { showToast('Entre une quantité valide'); return; }
    addWater(ml);
    input.value = '';
  });

  document.getElementById('hyd-custom-ml').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('hyd-custom-add').click();
  });

  _container.querySelectorAll('.hyd-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      _data.entries = _data.entries.filter(e => e.id !== btn.dataset.id);
      await saveHydration(currentDate, _data);
      renderView();
    });
  });

  document.getElementById('hyd-goal-btn').addEventListener('click', openGoalModal);
}

async function addWater(ml) {
  const now = new Date();
  const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const entry = { id: Date.now().toString(), ml, time };
  if (!_data.entries) _data.entries = [];
  _data.entries.push(entry);
  await saveHydration(currentDate, _data);
  showToast(`+${ml} ml ajouté ✓`);
  renderView();
}

function openGoalModal() {
  const modal = document.createElement('div');
  modal.className = 'settings-modal-overlay';
  modal.innerHTML = `
    <div class="settings-modal" style="max-width:340px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <h3 style="font-size:15px;font-weight:600;margin:0">Objectif d'hydratation</h3>
        <button id="hg-close" class="btn-icon" style="width:30px;height:30px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:14px">
        Quantité totale d'eau à boire par jour (ml). La recommandation générale est 2 à 3 L/jour,
        plus en cas d'activité physique intense.
      </p>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        ${[1500, 2000, 2500, 3000].map(v => `
          <button class="hg-preset btn btn-small" data-val="${v}"
            style="flex:1;background:${_goal === v ? 'var(--accent)' : 'var(--bg-secondary)'};border:1px solid ${_goal === v ? 'var(--accent)' : 'var(--border)'};color:${_goal === v ? '#fff' : 'var(--text-primary)'};font-size:13px">
            ${v} ml
          </button>`).join('')}
      </div>
      <input type="number" id="hg-input" value="${_goal}" min="500" max="5000" step="100"
        style="width:100%;padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:14px;box-sizing:border-box">
      <button id="hg-save" class="btn btn-primary" style="width:100%;margin-top:14px">Enregistrer</button>
    </div>`;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  modal.querySelector('#hg-close').addEventListener('click', close);

  modal.querySelectorAll('.hg-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelector('#hg-input').value = btn.dataset.val;
    });
  });

  modal.querySelector('#hg-save').addEventListener('click', async () => {
    const ml = parseInt(modal.querySelector('#hg-input').value);
    if (!ml || ml < 500) { showToast('Valeur invalide (min 500 ml)'); return; }
    await saveHydrationGoal(ml);
    _goal = ml;
    close();
    renderView();
    showToast('Objectif mis à jour ✓');
  });
}
