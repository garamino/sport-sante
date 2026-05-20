import { today, formatDateFR } from '../utils.js';
import { getUserProfile, getWorkout, getSleep } from '../db.js';
import { showCoachAdvice, openCoachHistory, openCoachNotesModal } from '../coach.js';

export async function render(container) {
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const todayStr = today();

    const [profile, workout, sleep] = await Promise.all([
      getUserProfile().catch(() => null),
      getWorkout(todayStr).catch(() => null),
      getSleep(todayStr).catch(() => null),
    ]);

    // Workout summary for today
    const doneCount = workout?.exercises?.filter(e => e.done).length || 0;
    const totalExercises = workout?.exercises?.length || 0;
    const workoutDone = workout ? (workout.dayType === 'velo' ? !!workout.bikeData : doneCount > 0) : false;
    const workoutLabel = workout?.muscleGroup || workout?.templateId
      ? (workout.muscleGroup || '—')
      : null;
    const workoutIcon = workout?.dayType === 'velo' ? '🚴' : workout?.dayType === 'rest' ? '♻️' : '💪';

    container.innerHTML = `
      <div class="dashboard-greeting">Salut ! 👋</div>
      <div class="dashboard-date">${formatDateFR(todayStr)}</div>

      <div class="stat-grid">
        <div class="stat-box">
          <div class="stat-value">${profile?.currentWeight ? profile.currentWeight + ' kg' : '—'}</div>
          <div class="stat-label">Poids</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${sleep?.quality ? sleep.quality + '/10' : '—'}</div>
          <div class="stat-label">Nuit</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${sleep?.hoursSlept ? sleep.hoursSlept + 'h' : '—'}</div>
          <div class="stat-label">Sommeil</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${workoutDone ? '✓' : '—'}</div>
          <div class="stat-label">Séance</div>
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
