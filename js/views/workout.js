import { today, getDayOfWeek, getWeekNumber, getPhase, formatDateFR, addDays, showToast } from '../utils.js';
import { getUserProfile, getWorkout, saveWorkout } from '../db.js';
import { getExercisesForDay, getDaySchedule } from '../program-data.js';

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

    container.innerHTML = `
      <div class="date-nav">
        <button id="prev-day">‹</button>
        <span class="current-date">${formatDateFR(currentDate)}</span>
        <button id="next-day">›</button>
      </div>

      <div class="card" style="text-align:center;padding:10px">
        <strong>${schedule.icon} ${schedule.label}</strong>
        <span style="font-size:12px;color:var(--text-secondary);margin-left:8px">${phase} · S${weekNum}</span>
      </div>

      ${schedule.type === 'muscu' ? renderMuscu(exercises, existing) : ''}
      ${schedule.type === 'velo' ? renderVelo(existing) : ''}
      ${schedule.type === 'rest' ? renderRest() : ''}

      ${schedule.type !== 'rest' ? `
        <button class="btn btn-success" id="save-workout" style="margin-top:12px">
          Enregistrer
        </button>
      ` : ''}
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

    // Save
    const saveBtn = document.getElementById('save-workout');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Enregistrement...';

        const data = {
          week: weekNum,
          phase,
          dayType: schedule.type,
          muscleGroup: schedule.label,
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
            fcAvg: parseInt(document.getElementById('bike-fc').value) || 0,
            wattsAvg: parseInt(document.getElementById('bike-watts').value) || 0,
            durationMinutes: parseInt(document.getElementById('bike-duration').value) || 0,
            distanceKm: parseFloat(document.getElementById('bike-distance').value) || 0,
            elevationGain: parseInt(document.getElementById('bike-elevation').value) || 0,
          };
        }

        try {
          await saveWorkout(currentDate, data);
          showToast('Séance enregistrée ✓');
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

function renderMuscu(exercises, existing) {
  return exercises.map((ex, i) => {
    const saved = existing?.exercises?.find(e => e.id === ex.id);
    const done = saved?.done || false;
    const note = saved?.note || '';

    return `
      <div class="exercise-card ${done ? 'done' : ''}" id="card-${i}">
        <div class="exercise-header">
          <input type="checkbox" class="exercise-checkbox" id="ex-done-${i}" ${done ? 'checked' : ''}>
          <div class="exercise-info">
            <div class="exercise-name">${ex.name}</div>
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
        <div class="form-group"></div>
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
