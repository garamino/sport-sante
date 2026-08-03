import { getWorkoutTemplates, getExercises, saveWorkoutTemplate, deleteWorkoutTemplate } from '../db.js';
import { showToast, getDefaultLevel, formatSetsReps } from '../utils.js';

const SPECIAL_TYPES = ['velo', 'course', 'marche', 'rest'];

let templates = [];
let exById = {};
let _container = null;

export async function render(container) {
  _container = container;
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const [tpls, exercises] = await Promise.all([getWorkoutTemplates(), getExercises()]);
    templates = tpls;
    exById = {};
    for (const ex of exercises) exById[ex.id] = ex;

    const muscu = templates.filter(t => !SPECIAL_TYPES.includes(t.type));
    const special = templates.filter(t => SPECIAL_TYPES.includes(t.type));

    container.innerHTML = `
      <div class="library-header">
        <h2 class="library-title">Séances type</h2>
        <span class="library-count">${muscu.length}</span>
      </div>

      <button class="btn btn-small" id="tpl-new"
        style="width:100%;margin-bottom:12px;background:none;border:1px dashed var(--accent);color:var(--accent)">
        + Nouvelle séance type
      </button>

      <div id="tpl-list">
        ${muscu.length ? muscu.map(muscuTemplateHTML).join('') : `
          <div style="color:var(--text-secondary);font-size:13px;padding:4px 0 12px">Aucune séance type. Crées-en une ci-dessus.</div>`}
      </div>

      ${special.length ? `
        <div class="library-group-title" style="margin-top:18px">Activités</div>
        ${special.map(specialTemplateHTML).join('')}
      ` : ''}
    `;

    bindEvents();
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Erreur</p><p style="font-size:12px">${err.message}</p></div>`;
  }
}

function muscuTemplateHTML(tpl) {
  const ids = tpl.exerciseIds || [];
  return `
    <div class="session-template-card" data-id="${tpl.id}">
      <div class="session-template-header">
        <span class="session-template-icon">${tpl.icon || '💪'}</span>
        <span class="session-template-name">${escapeHtml(tpl.name)}</span>
        <span class="session-template-count">${ids.length} ex.</span>
        <div class="tpl-actions">
          <button class="tpl-rename" title="Renommer">✎</button>
          <button class="tpl-delete" title="Supprimer la séance type">×</button>
        </div>
      </div>

      <div class="session-template-exercises">
        ${ids.length ? ids.map((id, i) => exerciseRowHTML(id, i, ids.length)).join('') : `
          <div style="color:var(--text-secondary);font-size:12px;padding:8px 4px">Aucun exercice — ajoute-en un ci-dessous</div>`}
      </div>

      <button class="btn btn-small tpl-add-ex"
        style="width:calc(100% - 20px);margin:8px 10px 10px;background:none;border:1px dashed var(--border);color:var(--text-secondary)">
        + Ajouter un exercice
      </button>
    </div>
  `;
}

function exerciseRowHTML(id, i, total) {
  const ex = exById[id];
  const name = ex ? escapeHtml(ex.name) : '⚠️ Exercice introuvable';
  const sets = ex ? formatSetsReps(getDefaultLevel(ex)) : '';
  return `
    <div class="session-exercise-row" data-ex-id="${id}">
      <span class="session-exercise-num">${i + 1}</span>
      <span class="session-exercise-name">${name}</span>
      <span class="session-exercise-sets">${sets}</span>
      <span class="tpl-ex-actions">
        <button class="tpl-ex-up" title="Monter" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="tpl-ex-down" title="Descendre" ${i === total - 1 ? 'disabled' : ''}>↓</button>
        <button class="tpl-ex-remove" title="Retirer">×</button>
      </span>
    </div>
  `;
}

function specialTemplateHTML(tpl) {
  return `
    <div class="session-template-card">
      <div class="session-template-header">
        <span class="session-template-icon">${tpl.icon || '🏃'}</span>
        <span class="session-template-name">${escapeHtml(tpl.name)}</span>
        <span class="session-template-count" style="background:rgba(79,195,247,.1);color:var(--accent);font-size:11px">Activité</span>
      </div>
    </div>
  `;
}

function tpl(id) { return templates.find(t => t.id === id); }

async function persist(t) {
  return saveWorkoutTemplate({ id: t.id, name: t.name, icon: t.icon, type: t.type, exerciseIds: t.exerciseIds || [] });
}

function bindEvents() {
  const root = _container;

  // Nouvelle séance type
  root.querySelector('#tpl-new')?.addEventListener('click', () => {
    const btn = root.querySelector('#tpl-new');
    if (root.querySelector('#tpl-new-form')) return;
    const form = document.createElement('div');
    form.id = 'tpl-new-form';
    form.className = 'card';
    form.style.marginBottom = '12px';
    form.innerHTML = `
      <div class="form-group" style="margin-bottom:8px">
        <label>Nom de la séance type</label>
        <input type="text" id="tpl-new-name" placeholder="Ex : Pectoraux / Triceps" autocomplete="off">
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-small" id="tpl-new-cancel" style="background:none;border:1px solid var(--border);color:var(--text-secondary)">Annuler</button>
        <button class="btn btn-small btn-success" id="tpl-new-save">Créer</button>
      </div>
    `;
    btn.after(form);
    const input = form.querySelector('#tpl-new-name');
    input.focus();
    const save = async () => {
      const name = input.value.trim();
      if (!name) { showToast('Entre un nom'); return; }
      if (templates.some(t => (t.name || '').toLowerCase() === name.toLowerCase())) { showToast('Ce nom existe déjà'); return; }
      try {
        await saveWorkoutTemplate({ name, icon: '💪', type: 'muscu', exerciseIds: [] });
        showToast('Séance type créée ✓');
        await render(root);
      } catch { showToast('Erreur — réessaie'); }
    };
    form.querySelector('#tpl-new-save').addEventListener('click', save);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    form.querySelector('#tpl-new-cancel').addEventListener('click', () => form.remove());
  });

  // Renommer
  root.querySelectorAll('.tpl-rename').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.session-template-card');
      const t = tpl(card.dataset.id);
      if (!t) return;
      const nameEl = card.querySelector('.session-template-name');
      nameEl.innerHTML = `<input type="text" class="tpl-name-input" value="${escapeHtml(t.name)}"
        style="width:100%;padding:4px 6px;background:var(--bg-secondary);border:1px solid var(--accent);border-radius:6px;color:var(--text-primary);font-size:14px">`;
      const input = nameEl.querySelector('input');
      input.focus();
      input.select();
      const save = async () => {
        const name = input.value.trim();
        if (!name) { showToast('Le nom ne peut pas être vide'); return; }
        t.name = name;
        try { await persist(t); showToast('Renommée ✓'); await render(root); }
        catch { showToast('Erreur — réessaie'); }
      };
      input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') render(root); });
      input.addEventListener('blur', save);
    });
  });

  // Supprimer la séance type
  root.querySelectorAll('.tpl-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const t = tpl(btn.closest('.session-template-card').dataset.id);
      if (!t) return;
      if (!confirm(`Supprimer la séance type « ${t.name} » ?\n\nLes séances déjà réalisées avec ce modèle ne sont pas affectées.`)) return;
      try { await deleteWorkoutTemplate(t.id); showToast('Séance type supprimée'); await render(root); }
      catch { showToast('Erreur — réessaie'); }
    });
  });

  // Réordonner ↑ / ↓
  root.querySelectorAll('.tpl-ex-up, .tpl-ex-down').forEach(btn => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('.session-template-card');
      const t = tpl(card.dataset.id);
      const exId = btn.closest('.session-exercise-row').dataset.exId;
      if (!t) return;
      const ids = [...(t.exerciseIds || [])];
      const i = ids.indexOf(exId);
      const j = btn.classList.contains('tpl-ex-up') ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      t.exerciseIds = ids;
      try { await persist(t); await render(root); }
      catch { showToast('Erreur — réessaie'); }
    });
  });

  // Retirer un exercice du template
  root.querySelectorAll('.tpl-ex-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('.session-template-card');
      const t = tpl(card.dataset.id);
      const exId = btn.closest('.session-exercise-row').dataset.exId;
      if (!t) return;
      t.exerciseIds = (t.exerciseIds || []).filter(id => id !== exId);
      try { await persist(t); showToast('Exercice retiré'); await render(root); }
      catch { showToast('Erreur — réessaie'); }
    });
  });

  // Ajouter un exercice au template
  root.querySelectorAll('.tpl-add-ex').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = tpl(btn.closest('.session-template-card').dataset.id);
      if (t) openExercisePicker(t);
    });
  });
}

function openExercisePicker(t) {
  const existing = new Set(t.exerciseIds || []);
  const available = Object.values(exById).filter(ex => !existing.has(ex.id));

  const overlay = document.createElement('div');
  overlay.className = 'session-picker-overlay';
  overlay.innerHTML = `
    <div class="session-picker-sheet">
      <div class="session-picker-sheet-header">
        <span>Ajouter à « ${escapeHtml(t.name)} »</span>
        <button class="guide-modal-close" id="close-tpl-picker">&times;</button>
      </div>
      <input type="text" id="tpl-picker-search" placeholder="Rechercher un exercice…" autocomplete="off"
        style="width:calc(100% - 20px);margin:0 10px 8px;padding:9px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:14px">
      <div id="tpl-picker-list"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('#close-tpl-picker').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  const listEl = overlay.querySelector('#tpl-picker-list');
  function draw(filter = '') {
    const q = filter.trim().toLowerCase();
    const items = available.filter(ex => !q || (ex.name || '').toLowerCase().includes(q));
    if (items.length === 0) {
      listEl.innerHTML = `<p style="padding:12px;color:var(--text-secondary);font-size:13px">${available.length === 0 ? 'Tous les exercices sont déjà dans la séance' : 'Aucun exercice trouvé'}</p>`;
      return;
    }
    listEl.innerHTML = items.map(ex => `
      <button class="session-picker-option" data-ex-id="${ex.id}">
        <span class="session-picker-icon">💪</span>
        <span class="session-picker-label">${escapeHtml(ex.name)}</span>
      </button>
    `).join('');
    listEl.querySelectorAll('.session-picker-option').forEach(btn => {
      btn.addEventListener('click', async () => {
        t.exerciseIds = [...(t.exerciseIds || []), btn.dataset.exId];
        close();
        try { await persist(t); showToast('Exercice ajouté ✓'); await render(_container); }
        catch { showToast('Erreur — réessaie'); }
      });
    });
  }
  draw();
  const search = overlay.querySelector('#tpl-picker-search');
  search.addEventListener('input', () => draw(search.value));
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
