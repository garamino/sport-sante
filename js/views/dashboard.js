import { today, formatDateFR, getDayOfWeek, addDays } from '../utils.js';
import { getUserProfile, getWorkout, getSleep, getRecentSleep, getLastWeeklies } from '../db.js';
import { showCoachAdvice, openCoachHistory, openCoachNotesModal } from '../coach.js';

function getWeekDates(todayStr) {
  const dow = getDayOfWeek(todayStr);
  const monday = addDays(todayStr, -(dow - 1));
  return Array.from({ length: dow }, (_, i) => addDays(monday, i));
}

function buildWeekNarrative(workouts, sleepEntries, mondayStr) {
  const C_OK = 'var(--success)';
  const C_WARN = '#ffa726';
  const C_BAD = 'var(--danger)';

  const muscuDone = workouts.filter(w => w?.dayType === 'muscu' && w.exercises?.some(e => e.done)).length;
  const veloDone = workouts.filter(w => w && (w.dayType === 'velo' || w.extraActivities?.includes('velo')) && w.bikeData).length;

  const weekSleeps = sleepEntries.filter(s => s.date >= mondayStr);
  const avgHours = weekSleeps.length
    ? weekSleeps.reduce((acc, e) => acc + (e.hoursSlept || 0), 0) / weekSleeps.length
    : null;
  const avgQuality = weekSleeps.length
    ? weekSleeps.reduce((acc, e) => acc + (e.quality || 0), 0) / weekSleeps.length
    : null;
  const shortNights = weekSleeps.filter(s => s.hoursSlept && s.hoursSlept < 7).length;

  const lines = [];

  const parts = [];
  if (muscuDone > 0) parts.push(`💪 ${muscuDone} muscu`);
  if (veloDone > 0) parts.push(`🚴 ${veloDone} vélo`);
  lines.push(parts.length ? parts.join(' · ') : 'Aucune séance complète pour l\'instant');

  if (avgHours !== null) {
    const h = Math.floor(avgHours);
    const m = Math.round((avgHours - h) * 60);
    const hhmm = m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
    const hColor = avgHours >= 7 ? C_OK : avgHours >= 6 ? C_WARN : C_BAD;
    const qColor = avgQuality >= 7 ? C_OK : avgQuality >= 5 ? C_WARN : C_BAD;
    lines.push(`Sommeil : <span style="color:${hColor};font-weight:600">${hhmm} moy</span> · qualité <span style="color:${qColor};font-weight:600">${avgQuality.toFixed(1)}/10</span>`);
  }

  if (shortNights >= 2) {
    lines.push(`<span style="color:#ef9a9a">⚠ ${shortNights} nuit${shortNights > 1 ? 's' : ''} sous 7h</span>`);
  }

  return lines;
}

export async function render(container) {
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const todayStr = today();
    const weekDates = getWeekDates(todayStr);
    const mondayStr = weekDates[0];

    const [profile, workout, sleep, recentSleep, lastWeeklies, ...weekWorkouts] = await Promise.all([
      getUserProfile().catch(() => null),
      getWorkout(todayStr).catch(() => null),
      getSleep(todayStr).catch(() => null),
      getRecentSleep(7).catch(() => []),
      getLastWeeklies(3).catch(() => []),
      ...weekDates.map(d => getWorkout(d).catch(() => null)),
    ]);

    // Weight delta vs previous weekly entry
    const weightHistory = lastWeeklies.filter(w => w.weight);
    const currentWeight = profile?.currentWeight;
    const prevWeight = weightHistory.length >= 2 ? weightHistory[weightHistory.length - 2].weight
      : weightHistory.length === 1 && weightHistory[0].weight !== currentWeight ? weightHistory[0].weight
      : null;
    const deltaWeight = currentWeight && prevWeight ? +(currentWeight - prevWeight).toFixed(1) : null;
    const deltaSign = deltaWeight > 0 ? '+' : '';
    const deltaArrow = deltaWeight > 0 ? '↑' : '↓';
    const deltaColor = deltaWeight === 0 ? 'var(--text-secondary)' : deltaWeight > 0 ? 'var(--success)' : 'var(--danger)';

    const weekNarrative = buildWeekNarrative(weekWorkouts, recentSleep, mondayStr);

    // Workout summary for today
    const doneCount = workout?.exercises?.filter(e => e.done).length || 0;
    const totalExercises = workout?.exercises?.length || 0;
    const workoutDone = workout ? (workout.dayType === 'velo' ? !!workout.bikeData : doneCount > 0) : false;
    const workoutLabel = workout?.muscleGroup || workout?.templateId
      ? (workout.muscleGroup || '—')
      : null;
    const workoutIcon = workout?.dayType === 'velo' ? '🚴' : workout?.dayType === 'rest' ? '♻️' : '💪';

    // Stat colors based on thresholds
    const C_OK = 'var(--success)';
    const C_WARN = '#ffa726';
    const C_BAD = 'var(--danger)';
    const C_NEUTRAL = 'var(--text-secondary)';

    const qualityVal = sleep?.quality || 0;
    const qualityColor = !sleep?.quality ? C_NEUTRAL : qualityVal >= 7 ? C_OK : qualityVal >= 5 ? C_WARN : C_BAD;

    const hoursVal = sleep?.hoursSlept || 0;
    const hoursColor = !sleep?.hoursSlept ? C_NEUTRAL : hoursVal >= 7 ? C_OK : hoursVal >= 6 ? C_WARN : C_BAD;

    const workoutColor = !workout ? C_NEUTRAL : workoutDone ? C_OK : C_WARN;
    const workoutDisplay = !workout ? '—' : workoutDone ? '✓' : '~';

    container.innerHTML = `
      <div class="dashboard-greeting">Salut ! 👋</div>
      <div class="dashboard-date">${formatDateFR(todayStr)}</div>

      <div class="stat-grid">
        <div class="stat-box" style="border-top:3px solid ${deltaWeight !== null ? deltaColor : 'var(--border)'}">
          <div class="stat-icon">⚖️</div>
          <div class="stat-value">${currentWeight ? currentWeight + ' kg' : '—'}</div>
          ${deltaWeight !== null ? `<div style="font-size:12px;font-weight:600;color:${deltaColor};line-height:1;margin-top:2px">${deltaSign}${deltaWeight} kg ${deltaArrow}</div>` : ''}
          <div class="stat-label">Poids</div>
        </div>
        <div class="stat-box" style="border-top:3px solid ${workoutColor}">
          <div class="stat-icon">${workoutIcon}</div>
          <div class="stat-value" style="color:${workoutColor}">${workoutDisplay}</div>
          <div class="stat-label">Séance</div>
        </div>
        <div class="stat-box" style="border-top:3px solid ${hoursColor}">
          <div class="stat-icon">😴</div>
          <div class="stat-value" style="color:${hoursColor}">${sleep?.hoursSlept ? sleep.hoursSlept + 'h' : '—'}</div>
          <div class="stat-label">Sommeil</div>
        </div>
        <div class="stat-box" style="border-top:3px solid ${qualityColor}">
          <div class="stat-icon">🌙</div>
          <div class="stat-value" style="color:${qualityColor}">${sleep?.quality ? sleep.quality + '/10' : '—'}</div>
          <div class="stat-label">Qualité nuit</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Aujourd'hui</div>
        ${workout ? `
          <p style="font-size:14px;color:var(--text-secondary);margin-bottom:4px">
            ${workoutIcon} ${workoutLabel || 'Séance enregistrée'}
            ${workout.dayType === 'muscu' && totalExercises > 0 ? ` · ${doneCount}/${totalExercises} exercices` : ''}
            ${workout.dayType === 'velo' && workout.bikeData?.durationMinutes ? ` · ${workout.bikeData.durationMinutes} min · ${workout.bikeData.fcAvg} bpm` : ''}
          </p>
        ` : `
          <p style="font-size:14px;color:var(--text-secondary)">Aucune séance enregistrée</p>
        `}
      </div>

      <div class="card">
        <div class="card-title">Cette semaine</div>
        ${weekNarrative.map((line, i) => `
          <p style="font-size:14px;color:var(--text-secondary);margin:${i > 0 ? '4px 0 0' : '0'}">${line}</p>
        `).join('')}
      </div>

      <div class="section-title">Actions rapides</div>
      <div class="quick-actions">
        <a href="#/workout" class="quick-action">
          <div class="quick-action-icon" style="background:var(--accent)">💪</div>
          <span>${workoutDone ? 'Modifier ma séance' : 'Logger ma séance'}</span>
        </a>
        <a href="#/sleep" class="quick-action">
          <div class="quick-action-icon" style="background:#7e57c2">🌙</div>
          <span>${sleep ? 'Modifier ma nuit' : 'Logger ma nuit'}</span>
        </a>
        <a href="#/weekly" class="quick-action">
          <div class="quick-action-icon" style="background:var(--success)">⚖️</div>
          <span>Pesée & résumé hebdo</span>
        </a>
        <a href="#/intakes" class="quick-action">
          <div class="quick-action-icon" style="background:#26a69a">💊</div>
          <span>Mes prises</span>
        </a>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:24px">
        <div class="section-title" style="margin:0">Coach IA</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-small" id="coach-history-btn" style="width:auto;padding:6px 14px;font-size:12px;gap:6px;background:var(--bg-card);border:1px solid var(--border);color:var(--text-secondary)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Historique
          </button>
          <button class="btn btn-primary btn-small" id="ask-coach-btn" style="width:auto;padding:6px 14px;font-size:12px;gap:6px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            Consulter
          </button>
        </div>
      </div>
      <button class="btn btn-small" id="coach-notes-btn" style="width:100%;margin-top:12px;padding:10px 14px;font-size:13px;gap:8px;background:var(--bg-card);border:1px solid var(--border);color:var(--text-secondary)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
        Ajouter une note
      </button>
    `;

    document.getElementById('ask-coach-btn')?.addEventListener('click', () => {
      showCoachAdvice('workout', todayStr);
    });
    document.getElementById('coach-history-btn')?.addEventListener('click', () => {
      openCoachHistory();
    });
    document.getElementById('coach-notes-btn')?.addEventListener('click', () => {
      openCoachNotesModal(todayStr);
    });

  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Erreur de chargement</p><p style="font-size:12px;color:var(--text-secondary)">${err.message}</p></div>`;
  }
}
