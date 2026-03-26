import { today, formatDateFR, getDayOfWeek, getWeekNumber, getPhase } from '../utils.js';
import { getUserProfile, getWorkout, getSleep, getWeekly } from '../db.js';
import { getDaySchedule, getExercisesForDay } from '../program-data.js';

export async function render(container) {
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const profile = await getUserProfile();
    const todayStr = today();
    const dayOfWeek = getDayOfWeek(todayStr);
    const schedule = getDaySchedule(dayOfWeek);
    const weekNum = profile?.startDate ? getWeekNumber(profile.startDate, todayStr) : 0;
    const phase = getPhase(weekNum);

    // Load today's data
    const [workout, sleep, weekly] = await Promise.all([
      getWorkout(todayStr).catch(() => null),
      getSleep(todayStr).catch(() => null),
      weekNum > 0 ? getWeekly(`W${String(weekNum).padStart(2, '0')}`).catch(() => null) : null,
    ]);

    // Count exercises done today
    const exercises = getExercisesForDay(dayOfWeek, phase);
    const doneCount = workout?.exercises?.filter(e => e.done).length || 0;
    const totalExercises = schedule.type === 'muscu' ? exercises.length : (schedule.type === 'velo' ? 1 : 0);
    const workoutDone = workout ? (schedule.type === 'velo' ? !!workout.bikeData : doneCount > 0) : false;

    container.innerHTML = `
      <div class="dashboard-greeting">Salut ! ${schedule.icon}</div>
      <div class="dashboard-date">${formatDateFR(todayStr)}</div>

      ${!profile?.startDate ? `
        <div class="card">
          <div class="card-title">Configuration initiale</div>
          <p style="margin-bottom:12px;font-size:14px;color:var(--text-secondary)">
            Indique la date de début de ton programme (le lundi de la semaine 1) :
          </p>
          <div class="form-group">
            <input type="date" id="start-date" value="${todayStr}">
          </div>
          <button class="btn btn-primary" id="save-start">Démarrer le programme</button>
        </div>
      ` : ''}

      <div class="stat-grid">
        <div class="stat-box">
          <div class="stat-value">${weekNum > 0 ? `S${weekNum}` : '—'}</div>
          <div class="stat-label">Semaine</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${weekly?.weight ? weekly.weight + ' kg' : (profile?.currentWeight ? profile.currentWeight + ' kg' : '—')}</div>
          <div class="stat-label">Poids</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${sleep?.quality ? sleep.quality + '/10' : '—'}</div>
          <div class="stat-label">Nuit</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${workoutDone ? '✓' : '—'}</div>
          <div class="stat-label">Séance</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Aujourd'hui — ${schedule.label}</div>
        ${schedule.type === 'muscu' ? `
          <p style="font-size:14px;color:var(--text-secondary);margin-bottom:4px">
            ${doneCount}/${totalExercises} exercices · ${schedule.duration}
          </p>
        ` : schedule.type === 'velo' ? `
          <p style="font-size:14px;color:var(--text-secondary);margin-bottom:4px">
            ${workout?.bikeData ? `${workout.bikeData.durationMinutes} min · ${workout.bikeData.fcAvg} bpm · ${workout.bikeData.wattsAvg} W` : schedule.duration}
          </p>
        ` : `
          <p style="font-size:14px;color:var(--text-secondary)">Étirements, mobilité, sommeil 7-9h</p>
        `}
      </div>

      <div class="section-title">Actions rapides</div>
      <div class="quick-actions">
        ${schedule.type !== 'rest' ? `
          <a href="#/workout" class="quick-action">
            <div class="quick-action-icon" style="background:var(--accent)">${schedule.icon}</div>
            <span>${workoutDone ? 'Modifier ma séance' : 'Logger ma séance'}</span>
          </a>
        ` : ''}
        <a href="#/sleep" class="quick-action">
          <div class="quick-action-icon" style="background:#7e57c2">🌙</div>
          <span>${sleep ? 'Modifier ma nuit' : 'Logger ma nuit'}</span>
        </a>
        <a href="#/weekly" class="quick-action">
          <div class="quick-action-icon" style="background:var(--success)">⚖️</div>
          <span>Pesée & résumé hebdo</span>
        </a>
      </div>
    `;

    // Setup start date button
    const saveStartBtn = document.getElementById('save-start');
    if (saveStartBtn) {
      const { saveUserProfile } = await import('../db.js');
      saveStartBtn.addEventListener('click', async () => {
        const startDate = document.getElementById('start-date').value;
        if (startDate) {
          await saveUserProfile({ startDate });
          const { updateHeader } = await import('../components/nav.js');
          await updateHeader();
          render(container);
        }
      });
    }
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Erreur de chargement</p><p style="font-size:12px;color:var(--text-secondary)">${err.message}</p></div>`;
  }
}
