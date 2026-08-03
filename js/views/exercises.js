import { getExercises, saveExercise } from '../db.js';
import { showToast, getDefaultLevel } from '../utils.js';

let exercises = [];
let _container = null;
const _expanded = new Set(); // exercices en mode édition (déplié)

const GROUP_ORDER = ['Poitrine', 'Triceps', 'Dos', 'Biceps', 'Jambes', 'Fessiers', 'Épaules', 'Abdominaux', 'Full body', 'Cardio', 'Autre'];

export async function render(container) {
  _container = container;
  container.innerHTML = '<div class="spinner"></div>';
  try {
    exercises = await getExercises();
    paint();
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Erreur</p><p style="font-size:12px">${err.message}</p></div>`;
  }
}

// Re-render depuis la mémoire (pas de spinner, pas de refetch) en préservant la
// position de scroll — sinon on repart en haut de la liste à chaque action.
function paint() {
  if (!_container) return;
  const scroller = document.scrollingElement || document.documentElement;
  const y = scroller.scrollTop;
  _container.innerHTML = buildHTML();
  bindEvents();
  scroller.scrollTop = y;
}

function buildHTML() {
  if (exercises.length === 0) {
    return `
      <div class="library-header"><h2 class="library-title">Exercices</h2></div>
      <div class="empty-state">
        <div class="empty-state-icon">🏋️</div>
        <p>Aucun exercice</p>
        <p style="font-size:13px;color:var(--text-secondary);margin-top:8px">La bibliothèque se remplit au premier chargement.</p>
      </div>`;
  }

  const groups = {};
  for (const ex of exercises) {
    const g = ex.muscleGroup || 'Autre';
    (groups[g] ||= []).push(ex);
  }
  const sortedGroups = Object.keys(groups).sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a), ib = GROUP_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return `
    <div class="library-header">
      <h2 class="library-title">Exercices</h2>
      <span class="library-count">${exercises.length}</span>
    </div>

    ${sortedGroups.map(group => `
      <div class="library-group">
        <div class="library-group-title">${escapeHtml(group)}</div>
        ${groups[group].map(exerciseCardHTML).join('')}
      </div>
    `).join('')}
  `;
}

function levels(ex) {
  return Array.isArray(ex.levels) && ex.levels.length ? ex.levels : [getDefaultLevel(ex)];
}

function exerciseCardHTML(ex) {
  const expanded = _expanded.has(ex.id);
  const lvls = [...levels(ex)].sort((a, b) => a.level - b.level);
  const def = ex.defaultLevel ?? lvls[0]?.level;

  return `
    <div class="exercise-list-item ${expanded ? 'is-editing' : ''}" data-id="${ex.id}">
      <div class="exercise-card-head">
        <div class="exercise-card-head-text">
          ${expanded ? `
            <input class="ex-name-input" data-id="${ex.id}" value="${escapeHtml(ex.name)}" aria-label="Nom de l'exercice" autocomplete="off">
            <textarea class="ex-notes-input" data-id="${ex.id}" rows="2" placeholder="Description / notes…" aria-label="Notes">${escapeHtml(ex.notes || '')}</textarea>
          ` : `
            <div class="exercise-list-name">${escapeHtml(ex.name)}</div>
            ${ex.notes ? `<div class="exercise-list-notes">${escapeHtml(ex.notes)}</div>` : ''}
          `}
        </div>
        <button class="exercise-edit-toggle" data-id="${ex.id}" title="${expanded ? 'Terminer' : 'Éditer'}">
          ${expanded ? '✓ Terminé' : '✎ Éditer'}
        </button>
      </div>

      ${expanded ? `
        <div class="level-list" style="margin-top:8px">
          ${lvls.map(l => levelRowHTML(ex, l, l.level === def)).join('')}
        </div>
        <button class="btn btn-small level-add-btn" data-id="${ex.id}"
          style="margin-top:8px;background:none;border:1px solid var(--border);color:var(--text-secondary);font-size:12px;padding:5px 10px">
          + Nouveau niveau
        </button>
      ` : `
        <div class="level-summary">
          <span class="level-badge">Niveau ${def}</span>
          <span class="exercise-tag">${defLevel(ex).sets} × ${defLevel(ex).reps}</span>
          <span class="exercise-tag">Repos ${defLevel(ex).rest}s</span>
          <span class="exercise-tag">${defLevel(ex).weight} kg</span>
        </div>
      `}
    </div>
  `;
}

function defLevel(ex) {
  return getDefaultLevel(ex);
}

function levelRowHTML(ex, l, isDefault) {
  return `
    <div class="level-row ${isDefault ? 'is-default' : ''}" data-id="${ex.id}" data-level="${l.level}">
      <label class="level-default-pick" title="Niveau par défaut">
        <input type="radio" name="default-${ex.id}" value="${l.level}" ${isDefault ? 'checked' : ''}>
      </label>
      <div class="level-main">
        <span class="level-badge">Niveau ${l.level}</span>
        <span class="exercise-tag">${l.sets} × ${l.reps}</span>
        <span class="exercise-tag">Repos ${l.rest}s</span>
        <span class="exercise-tag">${l.weight} kg</span>
      </div>
      <div class="level-actions">
        <button class="level-edit" title="Modifier ce niveau">✎</button>
        <button class="level-delete" title="Supprimer ce niveau">×</button>
      </div>
    </div>
  `;
}

function levelFormHTML(level) {
  const v = level || { sets: '', reps: '', rest: '', weight: '' };
  return `
    <div class="level-form">
      <div class="level-form-grid">
        <label>Séries<input type="number" min="1" step="1" class="lf-sets" value="${v.sets}"></label>
        <label>Reps<input type="number" min="0" step="1" class="lf-reps" value="${v.reps}"></label>
        <label>Repos (s)<input type="number" min="0" step="5" class="lf-rest" value="${v.rest}"></label>
        <label>Charge (kg)<input type="number" min="0" step="0.5" class="lf-weight" value="${v.weight}"></label>
      </div>
      <div class="level-form-actions">
        <button class="btn btn-small level-form-cancel" style="background:none;border:1px solid var(--border);color:var(--text-secondary)">Annuler</button>
        <button class="btn btn-small btn-success level-form-save">Enregistrer</button>
      </div>
    </div>
  `;
}

function readForm(formEl) {
  const num = (sel, def) => {
    const raw = formEl.querySelector(sel).value.trim();
    if (raw === '') return def;
    const n = Number(raw.replace(',', '.'));
    return Number.isFinite(n) ? n : def;
  };
  return {
    sets: Math.max(1, Math.round(num('.lf-sets', 1))),
    reps: Math.max(0, Math.round(num('.lf-reps', 0))),
    rest: Math.max(0, Math.round(num('.lf-rest', 0))),
    weight: Math.max(0, num('.lf-weight', 0)),
  };
}

// Persiste l'exercice (nom, notes, niveaux) + miroir du niveau par défaut.
async function persist(ex) {
  const def = getDefaultLevel(ex);
  return saveExercise({
    id: ex.id,
    name: ex.name,
    notes: ex.notes ?? '',
    levels: ex.levels,
    defaultLevel: ex.defaultLevel,
    defaultSets: def.sets,
    defaultReps: def.reps,
    defaultRest: def.rest,
    weight: def.weight,
  });
}

function bindEvents() {
  const root = _container;

  // Basculer une carte en mode édition (déplié) / replié
  root.querySelectorAll('.exercise-edit-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (_expanded.has(id)) _expanded.delete(id); else _expanded.add(id);
      paint();
    });
  });

  // Éditer le nom
  root.querySelectorAll('.ex-name-input').forEach(inp => {
    inp.addEventListener('blur', async () => {
      const ex = exercises.find(x => x.id === inp.dataset.id);
      if (!ex) return;
      const val = inp.value.trim();
      if (!val) { inp.value = ex.name; return; }      // pas de nom vide
      if (val === ex.name) return;
      ex.name = val;
      try { await persist(ex); showToast('Nom modifié ✓'); } catch { showToast('Erreur — réessaie'); }
    });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
  });

  // Éditer les notes
  root.querySelectorAll('.ex-notes-input').forEach(ta => {
    ta.addEventListener('blur', async () => {
      const ex = exercises.find(x => x.id === ta.dataset.id);
      if (!ex) return;
      const val = ta.value.trim();
      if (val === (ex.notes || '')) return;
      ex.notes = val;
      try { await persist(ex); showToast('Notes modifiées ✓'); } catch { showToast('Erreur — réessaie'); }
    });
  });

  // Choix du niveau par défaut
  root.querySelectorAll('.level-default-pick input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', async (e) => {
      const row = e.target.closest('.level-row');
      const ex = exercises.find(x => x.id === row.dataset.id);
      if (!ex) return;
      ex.defaultLevel = Number(e.target.value);
      try {
        await persist(ex);
        showToast('Niveau par défaut mis à jour ✓');
        paint();
      } catch { showToast('Erreur — réessaie'); }
    });
  });

  // Ajouter un niveau
  root.querySelectorAll('.level-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.exercise-list-item');
      if (item.querySelector('.level-form')) return; // déjà ouvert
      const holder = document.createElement('div');
      holder.innerHTML = levelFormHTML(null);
      const form = holder.firstElementChild;
      btn.before(form);
      btn.style.display = 'none';

      const close = () => { form.remove(); btn.style.display = ''; };
      form.querySelector('.level-form-cancel').addEventListener('click', close);
      form.querySelector('.level-form-save').addEventListener('click', async () => {
        const ex = exercises.find(x => x.id === btn.dataset.id);
        if (!ex) return;
        const vals = readForm(form);
        const lvls = levels(ex);
        const nextNum = Math.max(0, ...lvls.map(l => l.level)) + 1;
        ex.levels = [...lvls, { level: nextNum, ...vals }];
        try {
          await persist(ex);
          showToast(`Niveau ${nextNum} ajouté ✓`);
          paint();
        } catch { showToast('Erreur — réessaie'); }
      });
    });
  });

  // Modifier un niveau
  root.querySelectorAll('.level-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.level-row');
      const ex = exercises.find(x => x.id === row.dataset.id);
      const levelNum = Number(row.dataset.level);
      const level = levels(ex).find(l => l.level === levelNum);
      if (!ex || !level) return;

      const holder = document.createElement('div');
      holder.innerHTML = levelFormHTML(level);
      const form = holder.firstElementChild;
      row.style.display = 'none';
      row.after(form);

      const close = () => { form.remove(); row.style.display = ''; };
      form.querySelector('.level-form-cancel').addEventListener('click', close);
      form.querySelector('.level-form-save').addEventListener('click', async () => {
        const vals = readForm(form);
        ex.levels = levels(ex).map(l => l.level === levelNum ? { level: levelNum, ...vals } : l);
        try {
          await persist(ex);
          showToast(`Niveau ${levelNum} modifié ✓`);
          paint();
        } catch { showToast('Erreur — réessaie'); }
      });
    });
  });

  // Supprimer un niveau
  root.querySelectorAll('.level-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('.level-row');
      const ex = exercises.find(x => x.id === row.dataset.id);
      const levelNum = Number(row.dataset.level);
      if (!ex) return;
      const lvls = levels(ex);
      if (lvls.length <= 1) { showToast('Un exercice doit garder au moins un niveau'); return; }
      if (!confirm(`Supprimer le niveau ${levelNum} de « ${ex.name} » ?`)) return;

      ex.levels = lvls.filter(l => l.level !== levelNum);
      if (ex.defaultLevel === levelNum) {
        ex.defaultLevel = Math.min(...ex.levels.map(l => l.level));
      }
      try {
        await persist(ex);
        showToast('Niveau supprimé');
        paint();
      } catch { showToast('Erreur — réessaie'); }
    });
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
