import { today, formatDateFR, addDays, showToast } from '../utils.js';
import { getWorkout, saveWorkout, getExerciseHistory, getWorkoutTemplates, getWorkoutTemplate, getExercise } from '../db.js';
import { EXERCISE_GUIDE, openExerciseGuide } from '../exercise-guide.js';

let currentDate = null;

export async function render(container, resetDate = true) {
  if (resetDate || !currentDate) currentDate = today();
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const existing = await getWorkout(currentDate);

    container.innerHTML = `
      <div class="date-nav">
        <button id="prev-day">‹</button>
        <span class="current-date">${formatDateFR(currentDate)}</span>
        <button id="next-day">›</button>
        <input type="date" id="date-picker" value="${currentDate}" class="date-picker-hidden">
        <button id="open-calendar" class="date-nav-calendar" title="Choisir une date">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </button>
      </div>

      <div id="workout-body"></div>
    `;

    // Date navigation
    document.getElementById('prev-day').addEventListener('click', () => {
      currentDate = addDays(currentDate, -1);
      render(container, false);
    });
    document.getElementById('next-day').addEventListener('click', () => {
      currentDate = addDays(currentDate, 1);
      render(container, false);
    });

    const datePicker = document.getElementById('date-picker');
    document.getElementById('open-calendar').addEventListener('click', () => datePicker.showPicker());
    datePicker.addEventListener('change', () => {
      if (datePicker.value) { currentDate = datePicker.value; render(container, false); }
    });

    await renderWorkoutBody(container.querySelector('#workout-body'), existing);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Erreur</p><p style="font-size:12px">${err.message}</p></div>`;
  }
}

async function renderWorkoutBody(body, existing) {
  // If a template is already chosen (saved), render its exercises
  if (existing?.templateId || existing?.dayType === 'velo') {
    await renderActiveSession(body, existing);
  } else {
    await renderEmptyDay(body, existing);
  }
}

// ── Empty day — no session chosen yet ─────────────────────────────────────────

async function renderEmptyDay(body, existing) {
  const templates = await getWorkoutTemplates();

  body.innerHTML = `
    <div class="empty-day-card">
      <div class="empty-day-icon">🏋️</div>
      <p class="empty-day-label">Aucune séance planifiée</p>
      <p style="font-size:13px;color:var(--text-secondary);margin-top:4px;margin-bottom:16px">Choisis une séance pour commencer</p>
      <button class="btn btn-primary" id="pick-session-btn">Choisir une séance</button>
    </div>

    <div class="session-picker-overlay hidden" id="session-picker-overlay">
      <div class="session-picker-sheet">
        <div class="session-picker-sheet-header">
          <span>Quelle séance ?</span>
          <button class="guide-modal-close" id="close-picker">&times;</button>
        </div>
        ${templates.map(tpl => `
          <button class="session-picker-option" data-template-id="${tpl.id}" data-template-type="${tpl.type}">
            <span class="session-picker-icon">${tpl.icon || '💪'}</span>
            <span class="session-picker-label">${tpl.name}</span>
          </button>
        `).join('')}
        <button class="session-picker-option" data-template-id="rest" data-template-type="rest">
          <span class="session-picker-icon">♻️</span>
          <span class="session-picker-label">Repos complet</span>
        </button>
      </div>
    </div>
  `;

  document.getElementById('pick-session-btn').addEventListener('click', () => {
    document.getElementById('session-picker-overlay').classList.remove('hidden');
  });
  document.getElementById('close-picker').addEventListener('click', () => {
    document.getElementById('session-picker-overlay').classList.add('hidden');
  });
  document.getElementById('session-picker-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('session-picker-overlay')) {
      document.getElementById('session-picker-overlay').classList.add('hidden');
    }
  });

  body.querySelectorAll('.session-picker-option').forEach(btn => {
    btn.addEventListener('click', async () => {
      const templateId = btn.dataset.templateId;
      const templateType = btn.dataset.templateType;
      const muscleGroup = btn.querySelector('.session-picker-label')?.textContent?.trim() || '';
      const data = { ...existing || {}, templateId, dayType: templateType, muscleGroup };
      await saveWorkout(currentDate, data);
      await renderActiveSession(body, await getWorkout(currentDate));
    });
  });
}

// ── Active session — template chosen ──────────────────────────────────────────

async function renderActiveSession(body, existing) {
  const dayType = existing?.dayType || 'muscu';

  if (dayType === 'rest') {
    renderRestSession(body, existing);
    return;
  }

  if (dayType === 'velo') {
    renderVeloSession(body, existing);
    return;
  }

  // Muscu: load template exercises
  let templateName = '';
  let templateIcon = '💪';
  let exercises = [];

  if (existing?.templateId && existing.templateId !== 'rest') {
    try {
      const tpl = await getWorkoutTemplate(existing.templateId);
      if (tpl) {
        templateName = tpl.name;
        templateIcon = tpl.icon || '💪';
        exercises = await Promise.all((tpl.exerciseIds || []).map(id => getExercise(id)));
        exercises = exercises.filter(Boolean);
      }
    } catch {}
  }

  const isSkipped = existing?.skipped;

  body.innerHTML = `
    <div class="card" style="text-align:center;padding:10px;position:relative">
      <strong>${templateIcon} ${templateName}</strong>
      <button class="btn btn-small" id="change-session-btn" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:11px;padding:4px 8px;background:none;border:1px solid var(--border);color:var(--text-secondary)">
        Changer
      </button>
    </div>

    ${isSkipped ? `
      <div class="skipped-banner">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        Séance non faite
      </div>
    ` : ''}

    ${renderMuscu(exercises, existing)}

    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn btn-small" id="skip-workout" style="background:none;border:1px solid var(--danger);color:var(--danger);flex-shrink:0">
        Séance non faite
      </button>
      <button class="btn btn-success" id="save-workout" style="flex:1">Enregistrer</button>
    </div>
  `;

  // Change session → reset templateId, re-render empty
  document.getElementById('change-session-btn').addEventListener('click', async () => {
    const data = { ...existing };
    delete data.templateId;
    delete data.dayType;
    await saveWorkout(currentDate, data);
    await renderEmptyDay(body, data);
  });

  // Exercise guide & history buttons
  body.querySelectorAll('.exercise-guide-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openExerciseGuide(btn.dataset.exerciseId);
    });
  });
  body.querySelectorAll('.exercise-history-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      openExerciseHistory(btn.dataset.exerciseId, btn.dataset.exerciseName, currentDate);
    });
  });

  // Checkbox → visual done state
  body.querySelectorAll('.exercise-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      cb.closest('.exercise-card')?.classList.toggle('done', cb.checked);
    });
  });

  // Skip
  document.getElementById('skip-workout').addEventListener('click', async () => {
    const btn = document.getElementById('skip-workout');
    btn.disabled = true;
    btn.textContent = 'Enregistrement...';
    try {
      await saveWorkout(currentDate, {
        ...existing,
        skipped: true,
        exercises: exercises.map(ex => ({ id: ex.id, name: ex.name, done: false, note: '' })),
      });
      showToast('Séance marquée non faite');
      await renderActiveSession(body, await getWorkout(currentDate));
    } catch {
      showToast('Erreur — réessaie');
      btn.disabled = false;
      btn.textContent = 'Séance non faite';
    }
  });

  // Save
  document.getElementById('save-workout').addEventListener('click', async () => {
    const btn = document.getElementById('save-workout');
    btn.disabled = true;
    btn.textContent = 'Enregistrement...';
    try {
      await saveWorkout(currentDate, {
        ...existing,
        exercises: exercises.map((ex, i) => ({
          id: ex.id,
          name: ex.name,
          done: body.querySelector(`#ex-done-${i}`)?.checked || false,
          note: body.querySelector(`#ex-note-${i}`)?.value || '',
        })),
      });
      showToast('Séance enregistrée ✓');
    } catch {
      showToast('Erreur — réessaie');
    }
    btn.disabled = false;
    btn.textContent = 'Enregistrer';
  });
}

function renderRestSession(body, existing) {
  body.innerHTML = `
    <div class="card" style="text-align:center;padding:10px;position:relative">
      <strong>♻️ Repos complet</strong>
      <button class="btn btn-small" id="change-session-btn" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:11px;padding:4px 8px;background:none;border:1px solid var(--border);color:var(--text-secondary)">
        Changer
      </button>
    </div>
    <div class="empty-state" style="margin-top:16px">
      <p style="font-size:13px;color:var(--text-secondary)">Étirements, mobilité, sommeil 7-9h</p>
    </div>
  `;
  document.getElementById('change-session-btn').addEventListener('click', async () => {
    const data = { ...existing };
    delete data.templateId;
    delete data.dayType;
    await saveWorkout(currentDate, data);
    await renderEmptyDay(body, data);
  });
}

function renderVeloSession(body, existing) {
  const bike = existing?.bikeData || {};
  const isSkipped = existing?.skipped;
  body.innerHTML = `
    <div class="card" style="text-align:center;padding:10px;position:relative">
      <strong>🚴 Vélo – Cardio endurance</strong>
      <button class="btn btn-small" id="change-session-btn" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:11px;padding:4px 8px;background:none;border:1px solid var(--border);color:var(--text-secondary)">
        Changer
      </button>
    </div>

    ${isSkipped ? `<div class="skipped-banner">Séance non faite</div>` : ''}

    <div class="card bike-form ${isSkipped ? 'skipped' : ''}">
      <div class="card-title">Session vélo</div>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:14px">Intensité modérée · 110-128 bpm</p>
      <div class="form-row">
        <div class="form-group"><label>FC moyenne (bpm)</label><input type="number" id="bike-fc" placeholder="120" value="${bike.fcAvg || ''}"></div>
        <div class="form-group"><label>Watts moyens</label><input type="number" id="bike-watts" placeholder="80" value="${bike.wattsAvg || ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Durée (minutes)</label><input type="number" id="bike-duration" placeholder="45" value="${bike.durationMinutes || ''}"></div>
        <div class="form-group"><label>Distance (km)</label><input type="number" id="bike-distance" step="0.1" placeholder="20" value="${bike.distanceKm || ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>D+ (m)</label><input type="number" id="bike-elevation" placeholder="250" value="${bike.elevationGain || ''}"></div>
        <div class="form-group"><label>Cadence (rpm)</label><input type="number" id="bike-rpm" placeholder="80" value="${bike.rpm || ''}"></div>
      </div>
    </div>

    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn btn-small" id="skip-workout" style="background:none;border:1px solid var(--danger);color:var(--danger);flex-shrink:0">Séance non faite</button>
      <button class="btn btn-success" id="save-workout" style="flex:1">Enregistrer</button>
    </div>
  `;

  document.getElementById('change-session-btn').addEventListener('click', async () => {
    const data = { ...existing };
    delete data.templateId;
    delete data.dayType;
    await saveWorkout(currentDate, data);
    await renderEmptyDay(body, data);
  });

  document.getElementById('skip-workout').addEventListener('click', async () => {
    await saveWorkout(currentDate, { ...existing, skipped: true, bikeData: null });
    showToast('Séance marquée non faite');
    await renderVeloSession(body, await getWorkout(currentDate));
  });

  document.getElementById('save-workout').addEventListener('click', async () => {
    const btn = document.getElementById('save-workout');
    btn.disabled = true;
    btn.textContent = 'Enregistrement...';
    try {
      await saveWorkout(currentDate, {
        ...existing,
        bikeData: {
          fcAvg: parseInt(document.getElementById('bike-fc')?.value) || 0,
          wattsAvg: parseInt(document.getElementById('bike-watts')?.value) || 0,
          durationMinutes: parseInt(document.getElementById('bike-duration')?.value) || 0,
          distanceKm: parseFloat(document.getElementById('bike-distance')?.value) || 0,
          elevationGain: parseInt(document.getElementById('bike-elevation')?.value) || 0,
          rpm: parseInt(document.getElementById('bike-rpm')?.value) || 0,
        },
      });
      showToast('Séance enregistrée ✓');
    } catch {
      showToast('Erreur — réessaie');
    }
    btn.disabled = false;
    btn.textContent = 'Enregistrer';
  });
}

// ── Render helpers ─────────────────────────────────────────────────────────────

function renderMuscu(exercises, existing) {
  if (exercises.length === 0) {
    return `<div class="empty-state" style="margin-top:16px"><p style="color:var(--text-secondary);font-size:13px">Aucun exercice dans cette séance</p></div>`;
  }

  const isSkipped = existing?.skipped;

  return exercises.map((ex, i) => {
    const saved = existing?.exercises?.find(e => e.id === ex.id);
    const done = saved?.done || false;
    const note = saved?.note || '';
    const cardClass = isSkipped ? 'skipped' : (done ? 'done' : '');

    return `
      <div class="exercise-card ${cardClass}" id="card-${i}">
        <div class="exercise-header">
          <input type="checkbox" class="exercise-checkbox" id="ex-done-${i}" ${done ? 'checked' : ''}>
          <div class="exercise-info">
            <div class="exercise-name">
              ${ex.name}${isSkipped ? '<span class="skipped-badge">Pas fait</span>' : ''}
              ${EXERCISE_GUIDE[ex.id] ? `<button class="exercise-guide-btn" data-exercise-id="${ex.id}" title="Comment faire">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
              </button>` : ''}
              <button class="exercise-history-btn" data-exercise-id="${ex.id}" data-exercise-name="${ex.name}" title="Historique">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </button>
            </div>
            <div class="exercise-details">${ex.notes || ''}</div>
            <div class="exercise-meta">
              <span class="exercise-tag">${ex.defaultSets} × ${ex.defaultReps}</span>
              <span class="exercise-tag">Repos ${ex.defaultRest}</span>
              ${ex.weight && ex.weight !== '—' ? `<span class="exercise-tag">${ex.weight}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="exercise-note">
          <textarea id="ex-note-${i}" placeholder="Note perso..." rows="1">${note}</textarea>
        </div>
      </div>
    `;
  }).join('');
}

async function openExerciseHistory(exerciseId, exerciseName, date) {
  const overlay = document.createElement('div');
  overlay.className = 'guide-modal-overlay';
  overlay.innerHTML = `
    <div class="guide-modal">
      <button class="guide-modal-close">&times;</button>
      <h3 style="font-size:16px;margin-bottom:14px">${exerciseName}</h3>
      <div class="spinner"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('.guide-modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  try {
    const history = await getExerciseHistory(exerciseId, date, 5);
    const content = overlay.querySelector('.guide-modal');

    if (history.length === 0) {
      content.innerHTML = `
        <button class="guide-modal-close">&times;</button>
        <h3 style="font-size:16px;margin-bottom:14px">${exerciseName}</h3>
        <p style="color:var(--text-secondary);font-size:13px;text-align:center;padding:20px 0">Aucun historique trouvé</p>
      `;
    } else {
      content.innerHTML = `
        <button class="guide-modal-close">&times;</button>
        <h3 style="font-size:16px;margin-bottom:4px">${exerciseName}</h3>
        <p style="font-size:11px;color:var(--text-secondary);margin-bottom:14px;text-transform:uppercase;letter-spacing:0.5px">5 dernières séances</p>
        <div class="history-list">
          ${history.map(h => `
            <div class="history-item">
              <span class="history-date">${formatDateFR(h.date)}</span>
              <span class="history-note">${h.note || '—'}</span>
            </div>
          `).join('')}
        </div>
      `;
    }
    content.querySelector('.guide-modal-close').addEventListener('click', close);
  } catch {
    overlay.remove();
  }
}
