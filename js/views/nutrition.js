import { today, formatDateFR, addDays, showToast } from '../utils.js';
import {
  getNutrition, saveNutrition,
  getNutritionGoals, saveNutritionGoals,
  getRecentNutritionFoods, saveNutritionFood,
  getApiKey,
  getUserProfile, getLastWeeklies, getRecentSleep,
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

let currentDate = null;
let _container  = null;
let _data       = null;
let _goals      = DEFAULT_GOALS;
let _recents    = [];

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
    _goals = _goals || DEFAULT_GOALS;

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

// ─── Rendu principal ─────────────────────────────────────────────────────────

function renderView() {
  const t = sum(allItems());
  const tKcal = Math.round(t.kcal), tProt = round1(t.prot);
  const tCarbs = round1(t.carbs), tFats = round1(t.fats);

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
          <button id="nut-edit-goals-btn" class="btn-icon" title="Modifier les objectifs" style="width:28px;height:28px;border:1px solid var(--border);border-radius:6px">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button id="nut-estimate-btn" class="nut-estimate-btn">✨ Estimer mes besoins</button>
        </div>
      </div>
      ${macroBar('Calories',  tKcal,  _goals.kcal,  'var(--accent)',   ' kcal')}
      ${macroBar('Protéines', tProt,  _goals.prot,  '#ab47bc')}
      ${macroBar('Glucides',  tCarbs, _goals.carbs, '#ffa726')}
      ${macroBar('Lipides',   tFats,  _goals.fats,  'var(--success)')}
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
        <button class="nut-delete-btn btn-icon" data-section="${sectionKey}" data-id="${item.id}">
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

// ─── Modale : estimation des besoins journaliers ────────────────────────────

async function openGoalsModal() {
  document.getElementById('nut-goals-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'nut-goals-modal';
  modal.className = 'settings-modal-overlay';
  modal.innerHTML = '<div class="settings-modal" style="max-width:480px"></div>';
  document.body.appendChild(modal);

  const inner = modal.querySelector('.settings-modal');
  const close = () => modal.remove();
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  // ── Step 1 : chargement des données ────────────────────────────────────
  inner.innerHTML = `
    <div style="text-align:center;padding:32px 16px">
      <div class="spinner" style="width:32px;height:32px;margin:0 auto 16px"></div>
      <p style="font-size:14px;font-weight:500">Analyse de ton profil…</p>
      <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Poids · sommeil · programme sportif</p>
    </div>`;

  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      inner.innerHTML = `
        <div style="text-align:center;padding:32px 16px">
          <p style="font-size:32px;margin-bottom:8px">🔑</p>
          <p style="font-size:14px;font-weight:500">Clé API requise</p>
          <p style="font-size:13px;color:var(--text-secondary);margin-top:6px">Configure ta clé Gemini dans ⚙️ Paramètres.</p>
          <button id="ng-close-err" class="btn btn-primary" style="margin-top:16px;width:100%">Fermer</button>
        </div>`;
      inner.querySelector('#ng-close-err').addEventListener('click', close);
      return;
    }

    // Collecte des données disponibles
    const [profile, weeklies, sleepEntries] = await Promise.all([
      getUserProfile().catch(() => null),
      getLastWeeklies(4).catch(() => []),
      getRecentSleep(7).catch(() => []),
    ]);

    const lastWeight  = weeklies.at(-1)?.weight || profile?.weight;
    const sleepCount  = sleepEntries.length;
    const avgHours    = sleepCount ? round1(sleepEntries.reduce((s, e) => s + (e.hoursSlept || 0), 0) / sleepCount) : null;
    const avgQuality  = sleepCount ? round1(sleepEntries.reduce((s, e) => s + (e.quality || 0), 0) / sleepCount) : null;

    const knownData = {
      ...(lastWeight        && { 'Poids actuel':         `${lastWeight} kg` }),
      ...(profile?.bodyFat  && { 'Masse graisseuse':     `${profile.bodyFat} %` }),
      ...(profile?.age      && { 'Âge':                  `${profile.age} ans` }),
      ...(profile?.height   && { 'Taille':               `${profile.height} cm` }),
      ...(avgHours          && { 'Sommeil moyen':         `${avgHours}h / nuit (qualité ${avgQuality}/10)` }),
      'Programme':            'Prise de masse 14 semaines — musculation 4×/semaine + vélo 2×/semaine',
    };

    // ── Step 2 : Gemini génère les questions ──────────────────────────────
    const questions = await _geminiAskQuestions(knownData, apiKey);
    _showQuestionnaire(inner, close, questions, knownData, apiKey);

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

async function _geminiAskQuestions(knownData, apiKey) {
  const ctx = Object.entries(knownData).map(([k, v]) => `- ${k} : ${v}`).join('\n');
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text:
        `Tu es un nutritionniste expert. Tu vas estimer les besoins nutritionnels journaliers (kcal, protéines, glucides, lipides) d'un utilisateur.

Données déjà disponibles :
${ctx}

Génère UNIQUEMENT les questions indispensables pour les informations manquantes.
Réponds UNIQUEMENT avec un tableau JSON valide, sans aucun texte autour :
[{"id":"objectif","question":"Quel est ton objectif principal ?","type":"choice","choices":["Prise de masse","Maintien","Perte de masse graisseuse"]},{"id":"age","question":"Quel est ton âge ?","type":"number","unit":"ans","min":15,"max":80}]

Types : "choice" (boutons), "number" (saisie numérique + unité).
Maximum 5 questions. Ne demande pas ce que tu as déjà. Questions pertinentes uniquement.` }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Réponse inattendue de Gemini');
  return JSON.parse(match[0]);
}

function _showQuestionnaire(inner, close, questions, knownData, apiKey) {
  inner.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div>
        <h3 style="font-size:15px;font-weight:600;margin:0">✨ Estimer mes besoins</h3>
        <p style="font-size:12px;color:var(--text-secondary);margin:3px 0 0">${questions.length} question${questions.length > 1 ? 's' : ''} pour affiner</p>
      </div>
      <button id="ng-close" class="btn-icon" style="width:30px;height:30px">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div id="ng-questions">
      ${questions.map(q => _questionHTML(q)).join('')}
    </div>
    <button id="ng-submit" class="btn btn-primary" style="width:100%;margin-top:16px">
      Calculer mes besoins →
    </button>`;

  inner.querySelector('#ng-close').addEventListener('click', close);

  inner.querySelector('#ng-submit').addEventListener('click', async () => {
    const answers = {};
    let valid = true;

    for (const q of questions) {
      const block = inner.querySelector(`[data-qid="${q.id}"]`);
      if (q.type === 'choice') {
        const sel = inner.querySelector(`input[name="q_${q.id}"]:checked`);
        if (sel) { answers[q.id] = { question: q.question, answer: sel.value }; }
        else { block?.classList.add('ng-q-error'); valid = false; }
      } else if (q.type === 'number') {
        const inp = inner.querySelector(`#q_${q.id}`);
        const val = parseFloat(inp?.value);
        if (!isNaN(val) && val > 0) {
          answers[q.id] = { question: q.question, answer: `${val}${q.unit ? ' ' + q.unit : ''}` };
        } else { inp?.classList.add('ng-q-error'); valid = false; }
      }
    }

    if (!valid) { showToast('Réponds à toutes les questions'); return; }

    inner.innerHTML = `
      <div style="text-align:center;padding:32px 16px">
        <div class="spinner" style="width:32px;height:32px;margin:0 auto 16px"></div>
        <p style="font-size:14px;font-weight:500">Calcul en cours…</p>
        <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Gemini analyse ton profil complet</p>
      </div>`;

    try {
      const result = await _geminiComputeGoals(knownData, answers, apiKey);
      _showGoalsResult(inner, close, result);
    } catch (err) {
      showToast('Erreur — ' + err.message);
      _showQuestionnaire(inner, close, questions, knownData, apiKey);
    }
  });
}

function _questionHTML(q) {
  if (q.type === 'choice') {
    return `
      <div class="ng-q-block" data-qid="${q.id}">
        <div class="ng-q-label">${q.question}</div>
        <div class="ng-q-choices">
          ${q.choices.map((c, i) => `
            <label class="ng-q-choice">
              <input type="radio" name="q_${q.id}" value="${c}" ${i === 0 ? 'checked' : ''}>
              <span>${c}</span>
            </label>`).join('')}
        </div>
      </div>`;
  }
  if (q.type === 'number') {
    return `
      <div class="ng-q-block" data-qid="${q.id}">
        <div class="ng-q-label">${q.question}</div>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="number" id="q_${q.id}" min="${q.min || 0}" max="${q.max || 9999}" placeholder="0" style="flex:1">
          ${q.unit ? `<span style="font-size:13px;color:var(--text-secondary);white-space:nowrap">${q.unit}</span>` : ''}
        </div>
      </div>`;
  }
  return '';
}

async function _geminiComputeGoals(knownData, answers, apiKey) {
  const ctx = Object.entries(knownData).map(([k, v]) => `- ${k} : ${v}`).join('\n');
  const ans = Object.values(answers).map(a => `- ${a.question} → ${a.answer}`).join('\n');
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text:
        `Tu es un nutritionniste expert. Calcule les apports nutritionnels journaliers optimaux.

Données connues :
${ctx}

Réponses de l'utilisateur :
${ans}

Fournis les recommandations personnalisées.
Réponds UNIQUEMENT avec un objet JSON valide, sans aucun texte autour :
{"kcal":2800,"prot":175,"carbs":320,"fats":85,"explanation":"2-3 phrases justifiant les valeurs","tips":["Conseil pratique 1","Conseil pratique 2","Conseil pratique 3"]}

Valeurs entières. Explication en français, concise. 3 tips pratiques et actionnables.` }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Réponse inattendue de Gemini');
  return JSON.parse(match[0]);
}

function _showGoalsResult(inner, close, result) {
  inner.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <h3 style="font-size:15px;font-weight:600;margin:0">✨ Tes besoins estimés</h3>
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

    <p style="font-size:13px;color:var(--text-secondary);line-height:1.55;margin:14px 0 10px">${result.explanation}</p>

    ${result.tips?.length ? `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px">
      ${result.tips.map(t => `<div class="ng-tip">💡 ${t}</div>`).join('')}
    </div>` : ''}

    <button id="ng-apply" class="btn btn-primary" style="width:100%">
      Appliquer ces objectifs
    </button>`;

  inner.querySelector('#ng-close').addEventListener('click', close);

  inner.querySelector('#ng-apply').addEventListener('click', async () => {
    const goals = {
      kcal: result.kcal, prot: result.prot, carbs: result.carbs, fats: result.fats,
      explanation: result.explanation || '',
      tips: result.tips || [],
    };
    await saveNutritionGoals(goals);
    _goals = goals;
    close();
    renderView();
    showToast('Objectifs nutritionnels mis à jour ✓');
  });
}

// ─── Open Food Facts ─────────────────────────────────────────────────────────

async function searchFoods(query) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&action=process&json=1&page_size=8&lc=fr&cc=fr`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('API indisponible');
  const data = await res.json();
  return (data.products || []).filter(p => p.product_name || p.product_name_fr);
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
      </div>`;
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
  }

  // ── Recherche Open Food Facts ─────────────────────────────────────────────
  function showSearch(el) {
    el.innerHTML = `
      <input id="nut-search-input" type="text" placeholder="Nom du produit…" autocomplete="off" />
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
        <img id="nut-photo-img" style="width:100%;max-height:200px;object-fit:cover;border-radius:var(--radius-sm);margin-bottom:12px">
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
      goTo('loading');
      try {
        const apiKey = await getApiKey();
        if (!apiKey) {
          goTo('preview');
          showToast('Configure ta clé API Gemini dans ⚙️ Paramètres');
          return;
        }
        const foods = await analyzePhotoWithGemini(photoBase64, photoMediaType, apiKey);
        renderPhotoResults(stepResults, foods);
        goTo('results');
      } catch (err) {
        goTo('preview');
        showToast('Erreur d\'analyse — ' + (err.message || 'Réessaie'));
      }
    });
  }

  async function analyzePhotoWithGemini(base64, mediaType, apiKey) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mediaType, data: base64 } },
            {
              text: `Analyse cette photo de repas. Identifie chaque aliment visible et estime sa quantité ainsi que ses valeurs nutritionnelles.
Réponds UNIQUEMENT avec un tableau JSON valide, sans aucun texte autour, dans ce format exact :
[{"name":"Nom","qty":150,"unit":"g","kcal":200,"prot":12,"carbs":25,"fats":6}]
Règles : utilise "g" ou "ml" comme unit. Maximum 8 aliments. Valeurs réalistes pour la portion visible.`,
            },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Erreur API Gemini (${res.status})`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Réponse inattendue de Gemini');
    return JSON.parse(match[0]);
  }

  function renderPhotoResults(el, foods) {
    if (!foods.length) {
      el.innerHTML = `<p style="text-align:center;font-size:13px;color:var(--text-secondary);padding:16px 0">Aucun aliment détecté — essaie avec une photo plus nette.</p>`;
      return;
    }
    el.innerHTML = `
      <div style="font-size:12px;color:var(--text-secondary);margin-bottom:10px">
        ${foods.length} aliment(s) détecté(s) — coche ceux à ajouter :
      </div>
      <div id="nut-photo-food-list">
        ${foods.map((f, i) => `
          <label class="nut-photo-food-row">
            <input type="checkbox" data-idx="${i}" checked>
            <div style="min-width:0;flex:1">
              <div style="font-size:13px;font-weight:500">${f.name}</div>
              <div style="font-size:11px;color:var(--text-secondary)">${f.qty}${f.unit} · ${Math.round(f.kcal)} kcal · P:${round1(f.prot)}g · G:${round1(f.carbs)}g · L:${round1(f.fats)}g</div>
            </div>
          </label>`).join('')}
      </div>
      <button id="nut-photo-add" class="btn btn-primary" style="width:100%;margin-top:12px">
        Ajouter les sélectionnés
      </button>`;

    el.querySelector('#nut-photo-add').addEventListener('click', async () => {
      const checked = el.querySelectorAll('input[type=checkbox]:checked');
      if (!checked.length) { showToast('Sélectionne au moins un aliment'); return; }
      for (const cb of checked) {
        const f = foods[parseInt(cb.dataset.idx)];
        await addEntry({
          name: f.name, brand: '',
          qty:   f.qty,   unit:  f.unit,
          kcal:  Math.round(f.kcal),
          prot:  round1(f.prot),
          carbs: round1(f.carbs),
          fats:  round1(f.fats),
        });
      }
    });
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
