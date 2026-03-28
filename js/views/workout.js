import { today, getDayOfWeek, getWeekNumber, getPhase, formatDateFR, addDays, showToast } from '../utils.js';
import { getUserProfile, getWorkout, saveWorkout, getExerciseHistory } from '../db.js';
import { getExercisesForDay, getDaySchedule } from '../program-data.js';
import { EXERCISE_GUIDE, openExerciseGuide } from '../exercise-guide.js';
import { showCoachAdvice } from '../coach.js';

let currentDate = null;

export async function render(container, resetDate = true) {
  if (resetDate || !currentDate) currentDate = today();
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const profile = await getUserProfile();
    const dayOfWeek = getDayOfWeek(currentDate);
    const schedule = getDaySchedule(dayOfWeek);
    const weekNum = profile?.startDate ? getWeekNumber(profile.startDate, currentDate) : 1;
    const phase = getPhase(weekNum);
    const exercises = getExercisesForDay(dayOfWeek, phase);

    // Load existing data for this date
    const existing = await getWorkout(currentDate);

    // Check if an extra activity was added (or existed in DB)
    const hasExtraVelo = existing?.extraActivities?.includes('velo');

    // Separate done/not-done exercises for ordering
    const doneExercises = [];
    const todoExercises = [];
    if (schedule.type === 'muscu') {
      exercises.forEach((ex, i) => {
        const saved = existing?.exercises?.find(e => e.id === ex.id);
        if (saved?.done) doneExercises.push(i);
        else todoExercises.push(i);
      });
    }

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

      <div class="card" style="text-align:center;padding:10px">
        <strong>${schedule.icon} ${schedule.label}</strong>
        <span style="font-size:12px;color:var(--text-secondary);margin-left:8px">${phase} · S${weekNum}</span>
      </div>

      ${schedule.type === 'muscu' ? renderMuscu(exercises, existing, doneExercises, todoExercises) : ''}
      ${schedule.type === 'velo' ? renderVelo(existing) : ''}
      ${schedule.type === 'rest' ? renderRest() : ''}

      ${/* Extra vélo section (on non-vélo days) */
        schedule.type !== 'velo' && hasExtraVelo ? `
        <div id="extra-velo-section">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:16px;margin-bottom:4px">
            <span class="card-title" style="margin:0">Activité ajoutée</span>
            <button class="btn btn-small" id="remove-extra-velo" style="color:var(--danger);background:none;border:1px solid var(--danger);padding:4px 10px;font-size:12px">
              ✕ Retirer vélo
            </button>
          </div>
          ${renderVelo(existing)}
        </div>
      ` : ''}

      ${/* Add activity button (when no vélo scheduled AND no extra vélo yet) */
        schedule.type !== 'velo' && !hasExtraVelo ? `
        <div id="add-activity-area" style="margin-top:16px">
          <button class="btn btn-secondary" id="add-activity-btn" style="gap:6px">
            <span style="font-size:18px">+</span> Ajouter une activité
          </button>
        </div>
      ` : ''}

      <button class="btn btn-success" id="save-workout" style="margin-top:12px">
        Enregistrer
      </button>
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

    // Calendar picker
    const datePicker = document.getElementById('date-picker');
    const calendarBtn = document.getElementById('open-calendar');
    calendarBtn.addEventListener('click', () => {
      datePicker.showPicker();
    });
    datePicker.addEventListener('change', () => {
      if (datePicker.value) {
        currentDate = datePicker.value;
        render(container, false);
      }
    });

    // Add activity button
    const addBtn = document.getElementById('add-activity-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        addBtn.parentElement.innerHTML = `
          <div class="card" style="text-align:center">
            <p style="font-size:13px;color:var(--text-secondary);margin-bottom:10px">Quelle activité ajouter ?</p>
            <button class="btn btn-primary btn-small" id="add-velo-btn" style="width:auto;margin:0 auto">
              🚴 Vélo
            </button>
          </div>
        `;
        document.getElementById('add-velo-btn').addEventListener('click', () => {
          // Re-render with extra vélo flag stored temporarily
          saveWorkout(currentDate, {
            ...buildSaveData(schedule, exercises, weekNum, phase, existing),
            extraActivities: ['velo'],
          }).then(() => render(container, false));
        });
      });
    }

    // Remove extra vélo
    const removeBtn = document.getElementById('remove-extra-velo');
    if (removeBtn) {
      removeBtn.addEventListener('click', async () => {
        const data = buildSaveData(schedule, exercises, weekNum, phase, existing);
        data.extraActivities = [];
        data.bikeData = null;
        await saveWorkout(currentDate, data);
        render(container, false);
      });
    }

    // Exercise guide buttons
    container.querySelectorAll('.exercise-guide-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openExerciseGuide(btn.dataset.exerciseId);
      });
    });

    // Exercise history buttons
    container.querySelectorAll('.exercise-history-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const exId = btn.dataset.exerciseId;
        const exName = btn.dataset.exerciseName;
        openExerciseHistory(exId, exName, currentDate);
      });
    });

    // Save
    const saveBtn = document.getElementById('save-workout');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Enregistrement...';

        const data = buildSaveData(schedule, exercises, weekNum, phase, existing);

        // Include extra vélo data if present
        if (hasExtraVelo || schedule.type === 'velo') {
          data.bikeData = {
            fcAvg: parseInt(document.getElementById('bike-fc')?.value) || 0,
            wattsAvg: parseInt(document.getElementById('bike-watts')?.value) || 0,
            durationMinutes: parseInt(document.getElementById('bike-duration')?.value) || 0,
            distanceKm: parseFloat(document.getElementById('bike-distance')?.value) || 0,
            elevationGain: parseInt(document.getElementById('bike-elevation')?.value) || 0,
            rpm: parseInt(document.getElementById('bike-rpm')?.value) || 0,
          };
          if (hasExtraVelo) data.extraActivities = ['velo'];
        }

        try {
          await saveWorkout(currentDate, data);
          showToast('Séance enregistrée ✓');
          showCoachAdvice('workout', currentDate);
        } catch (err) {
          showToast('Erreur — réessaie');
        }
        saveBtn.disabled = false;
        saveBtn.textContent = 'Enregistrer';
      });
    }
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Erreur</p><p style="font-size:12px">${err.message}</p></div>`;
  }
}

function buildSaveData(schedule, exercises, weekNum, phase, existing) {
  const data = {
    week: weekNum,
    phase,
    dayType: schedule.type,
    muscleGroup: schedule.label,
    extraActivities: existing?.extraActivities || [],
  };

  if (schedule.type === 'muscu') {
    data.exercises = exercises.map((ex, i) => ({
      id: ex.id,
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      done: document.getElementById(`ex-done-${i}`)?.checked || false,
      note: document.getElementById(`ex-note-${i}`)?.value || '',
    }));
  } else if (schedule.type === 'velo') {
    data.bikeData = {
      fcAvg: parseInt(document.getElementById('bike-fc')?.value) || 0,
      wattsAvg: parseInt(document.getElementById('bike-watts')?.value) || 0,
      durationMinutes: parseInt(document.getElementById('bike-duration')?.value) || 0,
      distanceKm: parseFloat(document.getElementById('bike-distance')?.value) || 0,
      elevationGain: parseInt(document.getElementById('bike-elevation')?.value) || 0,
      rpm: parseInt(document.getElementById('bike-rpm')?.value) || 0,
    };
  }

  return data;
}

function renderMuscu(exercises, existing, doneExercises, todoExercises) {
  // Render done exercises first, then todo
  const orderedIndices = [...doneExercises, ...todoExercises];

  return orderedIndices.map(i => {
    const ex = exercises[i];
    const saved = existing?.exercises?.find(e => e.id === ex.id);
    const done = saved?.done || false;
    const note = saved?.note || '';

    return `
      <div class="exercise-card ${done ? 'done' : ''}" id="card-${i}">
        <div class="exercise-header">
          <input type="checkbox" class="exercise-checkbox" id="ex-done-${i}" ${done ? 'checked' : ''}>
          <div class="exercise-info">
            <div class="exercise-name">
              ${ex.name}
              ${EXERCISE_GUIDE[ex.id] ? `<button class="exercise-guide-btn" data-exercise-id="${ex.id}" title="Comment faire cet exercice">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
              </button>` : ''}
              <button class="exercise-history-btn" data-exercise-id="${ex.id}" data-exercise-name="${ex.name}" title="Historique">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </button>
            </div>
            <div class="exercise-details">${ex.notes}</div>
            <div class="exercise-meta">
              <span class="exercise-tag">${ex.sets} × ${ex.reps}</span>
              <span class="exercise-tag">Repos ${ex.rest}</span>
              ${ex.weight !== '—' ? `<span class="exercise-tag">${ex.weight}</span>` : ''}
              ${ex.phaseNote ? `<span class="exercise-tag" style="color:var(--accent)">${ex.phaseNote}</span>` : ''}
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

function renderVelo(existing) {
  const bike = existing?.bikeData || {};
  return `
    <div class="card bike-form">
      <div class="card-title">Session vélo</div>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:14px">
        Intensité modérée · 110-128 bpm · tu dois pouvoir parler
      </p>
      <div class="form-row">
        <div class="form-group">
          <label>FC moyenne (bpm)</label>
          <input type="number" id="bike-fc" placeholder="120" value="${bike.fcAvg || ''}">
        </div>
        <div class="form-group">
          <label>Watts moyens</label>
          <input type="number" id="bike-watts" placeholder="80" value="${bike.wattsAvg || ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Durée (minutes)</label>
          <input type="number" id="bike-duration" placeholder="45" value="${bike.durationMinutes || ''}">
        </div>
        <div class="form-group">
          <label>Distance (km)</label>
          <input type="number" id="bike-distance" step="0.1" placeholder="20" value="${bike.distanceKm || ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>D+ (m)</label>
          <input type="number" id="bike-elevation" placeholder="250" value="${bike.elevationGain || ''}">
        </div>
        <div class="form-group">
          <label>Cadence (rpm)</label>
          <input type="number" id="bike-rpm" placeholder="80" value="${bike.rpm || ''}">
        </div>
      </div>
    </div>
  `;
}

function renderRest() {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">♻️</div>
      <p>Jour de repos</p>
      <p style="font-size:13px;color:var(--text-secondary);margin-top:8px">
        Étirements, mobilité, sommeil 7-9h
      </p>
    </div>
  `;
}

async function openExerciseHistory(exerciseId, exerciseName, date) {
  // Show modal with spinner immediately
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
        <p style="color:var(--text-secondary);font-size:13px;text-align:center;padding:20px 0">
          Aucun historique trouvé
        </p>
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
  } catch (err) {
    overlay.remove();
  }
}
