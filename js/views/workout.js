import { today, formatDateFR, addDays, showToast } from '../utils.js';
import { getWorkout, saveWorkout, getExerciseHistory, getWorkoutTemplates, getWorkoutTemplate, getExercise, getAllWorkouts } from '../db.js';
import { getGuideKey, openExerciseGuide } from '../exercise-guide.js';
import { importLatestCyclingActivity } from '../strava.js';

let currentDate = null;

export async function render(container, resetDate = true) {
  if (resetDate || !currentDate) currentDate = today();
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const existing = await getWorkout(currentDate);

    container.innerHTML = `
      <div class="date-nav-row">
        <div class="date-nav" style="margin-bottom:0">
          <button id="prev-day">‹</button>
          <span class="current-date">${formatDateFR(currentDate)}</span>
          <button id="next-day">›</button>
        </div>
        <button class="btn-icon" id="open-calendar" title="Calendrier">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <rect x="1" y="3" width="14" height="12" rx="2"/>
            <line x1="1" y1="7" x2="15" y2="7"/>
            <line x1="5" y1="1" x2="5" y2="5"/>
            <line x1="11" y1="1" x2="11" y2="5"/>
          </svg>
        </button>
        <a href="#/library" class="btn-icon" title="Bibliothèque" style="display:flex;align-items:center;justify-content:center;text-decoration:none;color:var(--text-secondary)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
        </a>
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

    // Calendrier modal
    const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const DAYS_FR = ['L','M','M','J','V','S','D'];

    document.getElementById('open-calendar').addEventListener('click', async e => {
      e.stopPropagation();
      let calModal = document.getElementById('workout-cal-modal');
      if (calModal) { calModal.remove(); return; }

      let calYear = parseInt(currentDate.split('-')[0]);
      let calMonth = parseInt(currentDate.split('-')[1]) - 1;

      calModal = document.createElement('div');
      calModal.id = 'workout-cal-modal';
      calModal.className = 'sleep-cal-modal';
      calModal.innerHTML = `<div class="sleep-cal-card"><div class="sleep-cal-loading">Chargement…</div></div>`;
      document.body.appendChild(calModal);
      calModal.addEventListener('click', ev => { if (ev.target === calModal) { calModal.remove(); } });

      const all = await getAllWorkouts().catch(() => []);
      const workoutDates = new Set(all.map(w => w.date));
      const todayStr = today();

      function drawCal() {
        const modal = document.getElementById('workout-cal-modal');
        if (!modal) return;
        const firstDay = new Date(calYear, calMonth, 1);
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const startDow = (firstDay.getDay() + 6) % 7;

        let cells = '';
        for (let i = 0; i < startDow; i++) cells += `<div class="sleep-cal-cell sleep-cal-empty"></div>`;
        for (let d = 1; d <= daysInMonth; d++) {
          const ds = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          cells += `<div class="sleep-cal-cell${ds === todayStr ? ' is-today' : ''}${ds === currentDate ? ' is-selected' : ''}" data-date="${ds}">
            <span class="sleep-cal-daynum">${d}</span>
            ${workoutDates.has(ds) ? `<span class="sleep-cal-q q-good" style="font-size:8px">●</span>` : ''}
          </div>`;
        }

        modal.querySelector('.sleep-cal-card').innerHTML = `
          <div class="sleep-cal-header">
            <button id="wcal-prev">‹</button>
            <span>${MONTHS_FR[calMonth]} ${calYear}</span>
            <button id="wcal-next">›</button>
          </div>
          <div class="sleep-cal-dow">${DAYS_FR.map(l => `<div>${l}</div>`).join('')}</div>
          <div class="sleep-cal-grid">${cells}</div>
        `;

        document.getElementById('wcal-prev').addEventListener('click', ev => {
          ev.stopPropagation();
          calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } drawCal();
        });
        document.getElementById('wcal-next').addEventListener('click', ev => {
          ev.stopPropagation();
          calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } drawCal();
        });
        modal.querySelector('.sleep-cal-grid').addEventListener('click', ev => {
          const cell = ev.target.closest('[data-date]');
          if (!cell) return;
          currentDate = cell.dataset.date;
          modal.remove();
          render(container, false);
        });
      }

      drawCal();
    });

    await renderWorkoutBody(container.querySelector('#workout-body'), existing);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Erreur</p><p style="font-size:12px">${err.message}</p></div>`;
  }
}

async function renderWorkoutBody(body, existing) {
  // If a template is already chosen (saved), render its exercises
  if (existing?.templateId || existing?.dayType === 'velo' || existing?.dayType === 'course' || existing?.dayType === 'marche') {
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
        <button class="session-picker-option" data-template-id="course" data-template-type="course">
          <span class="session-picker-icon">🏃</span>
          <span class="session-picker-label">Course à pied</span>
        </button>
        <button class="session-picker-option" data-template-id="marche" data-template-type="marche">
          <span class="session-picker-icon">🚶</span>
          <span class="session-picker-label">Marche</span>
        </button>
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

  if (dayType === 'course' || dayType === 'marche') {
    renderCardioSession(body, existing, dayType);
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
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div class="card-title" style="margin-bottom:0">Session vélo</div>
        <button class="btn btn-small btn-strava" id="strava-import-btn" style="display:flex;align-items:center;gap:5px;font-size:12px;padding:5px 10px;background:#fc4c02;color:#fff;border:none">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/></svg>
          Import Strava
        </button>
      </div>
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

  document.getElementById('strava-import-btn').addEventListener('click', async () => {
    const btn = document.getElementById('strava-import-btn');
    btn.disabled = true;
    btn.textContent = 'Chargement...';
    try {
      const bikeData = await importLatestCyclingActivity(currentDate);
      if (!bikeData) {
        showToast('Aucune sortie vélo trouvée sur Strava pour cette date');
        return;
      }
      if (bikeData.fcAvg) document.getElementById('bike-fc').value = bikeData.fcAvg;
      if (bikeData.wattsAvg) document.getElementById('bike-watts').value = bikeData.wattsAvg;
      if (bikeData.durationMinutes) document.getElementById('bike-duration').value = bikeData.durationMinutes;
      if (bikeData.distanceKm) document.getElementById('bike-distance').value = bikeData.distanceKm;
      if (bikeData.elevationGain) document.getElementById('bike-elevation').value = bikeData.elevationGain;
      if (bikeData.rpm) document.getElementById('bike-rpm').value = bikeData.rpm;
      showToast(`Importé depuis Strava : ${bikeData.stravaActivityName || 'Sortie vélo'} ✓`);
    } catch (err) {
      if (err.code === 'not_connected') {
        showToast('Connecte ton compte Strava dans les paramètres ⚙️');
      } else {
        showToast(err.message || 'Erreur import Strava');
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/></svg> Import Strava`;
    }
  });

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

function renderCardioSession(body, existing, type) {
  const icon  = type === 'course' ? '🏃' : '🚶';
  const label = type === 'course' ? 'Course à pied' : 'Marche';
  const cardio = existing?.cardioData || {};
  const isSkipped = existing?.skipped;

  body.innerHTML = `
    <div class="card" style="text-align:center;padding:10px;position:relative">
      <strong>${icon} ${label}</strong>
      <button class="btn btn-small" id="change-session-btn" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:11px;padding:4px 8px;background:none;border:1px solid var(--border);color:var(--text-secondary)">
        Changer
      </button>
    </div>

    ${isSkipped ? `<div class="skipped-banner">Séance non faite</div>` : ''}

    <div class="card bike-form ${isSkipped ? 'skipped' : ''}">
      <div class="card-title" style="margin-bottom:14px">Session ${label.toLowerCase()}</div>
      <div class="form-row">
        <div class="form-group"><label>Distance (km)</label><input type="number" id="cardio-distance" step="0.1" placeholder="${type === 'course' ? '8' : '5'}" value="${cardio.distanceKm || ''}"></div>
        <div class="form-group"><label>Durée (min)</label><input type="number" id="cardio-duration" placeholder="${type === 'course' ? '45' : '60'}" value="${cardio.durationMinutes || ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>FC moyenne (bpm)</label><input type="number" id="cardio-fc" placeholder="${type === 'course' ? '155' : '110'}" value="${cardio.fcAvg || ''}"></div>
        <div class="form-group"><label>Cal. dépensées</label><input type="number" id="cardio-kcal" placeholder="${type === 'course' ? '500' : '300'}" value="${cardio.caloriesBurned || ''}"></div>
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
    await saveWorkout(currentDate, { ...existing, skipped: true, cardioData: null });
    showToast('Séance marquée non faite');
    await renderCardioSession(body, await getWorkout(currentDate), type);
  });

  document.getElementById('save-workout').addEventListener('click', async () => {
    const btn = document.getElementById('save-workout');
    btn.disabled = true;
    btn.textContent = 'Enregistrement...';
    try {
      await saveWorkout(currentDate, {
        ...existing,
        cardioData: {
          distanceKm:      parseFloat(document.getElementById('cardio-distance')?.value) || 0,
          durationMinutes: parseInt(document.getElementById('cardio-duration')?.value)  || 0,
          fcAvg:           parseInt(document.getElementById('cardio-fc')?.value)         || 0,
          caloriesBurned:  parseInt(document.getElementById('cardio-kcal')?.value)       || 0,
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
              ${getGuideKey(ex) ? `<button class="exercise-guide-btn" data-exercise-id="${getGuideKey(ex)}" title="Comment faire">
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
