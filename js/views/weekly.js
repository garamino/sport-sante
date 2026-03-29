import { today, formatDateFR, addDays, getWeekNumber, getPhase, showToast } from '../utils.js';
import { getUserProfile, saveUserProfile, getWeekly, saveWeekly, getAllWorkouts, getWorkout, saveWorkout } from '../db.js';

let currentDate = null;

export async function render(container, resetDate = true) {
  if (resetDate || !currentDate) currentDate = today();
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const profile = await getUserProfile();
    const weekNum = profile?.startDate ? getWeekNumber(profile.startDate, currentDate) : 1;
    const phase = getPhase(weekNum);
    const weekId = `W${String(weekNum).padStart(2, '0')}`;

    const [weekly, allWorkouts, dayData] = await Promise.all([
      getWeekly(weekId).catch(() => null),
      getAllWorkouts().catch(() => []),
      getWorkout(currentDate).catch(() => null),
    ]);

    // Count this week's sessions
    const weekWorkouts = allWorkouts.filter(w => w.week === weekNum);
    const muscu = weekWorkouts.filter(w => w.dayType === 'muscu' && w.exercises?.some(e => e.done));
    const velo = weekWorkouts.filter(w => w.dayType === 'velo' && w.bikeData);

    // Get previous week weight for delta
    const prevWeekId = `W${String(Math.max(1, weekNum - 1)).padStart(2, '0')}`;
    const prevWeekly = weekNum > 1 ? await getWeekly(prevWeekId).catch(() => null) : null;

    container.innerHTML = `
      <div class="date-nav">
        <button id="weight-prev">‹</button>
        <span class="current-date">${formatDateFR(currentDate)}</span>
        <button id="weight-next">›</button>
      </div>

      <div class="card">
        <div class="card-title">Pesée du jour</div>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="form-group" style="flex:1;margin-bottom:0">
            <input type="number" id="daily-weight" step="0.1" min="40" max="150"
                   placeholder="Ex: 59.5" value="${dayData?.weight || ''}">
          </div>
          <span style="font-size:14px;color:var(--text-secondary)">kg</span>
        </div>
        <button class="btn btn-success btn-small" id="save-daily-weight" style="margin-top:12px;width:100%">Enregistrer</button>
      </div>

      <div class="section-title" style="margin-top:20px">Semaine ${weekNum} — ${phase}</div>

      <div class="week-summary">
        <div class="week-summary-item">
          <div class="week-summary-value" style="color:var(--accent)">${muscu.length}/4</div>
          <div class="week-summary-label">Musculation</div>
        </div>
        <div class="week-summary-item">
          <div class="week-summary-value" style="color:var(--accent)">${velo.length}/2</div>
          <div class="week-summary-label">Vélo</div>
        </div>
        <div class="week-summary-item">
          <div class="week-summary-value" style="color:var(--accent)">${weekly?.weight ? weekly.weight + ' kg' : '—'}</div>
          <div class="week-summary-label">Poids semaine</div>
        </div>
      </div>

      ${prevWeekly?.weight && weekly?.weight ? `
        <div class="card" style="text-align:center">
          <span style="font-size:13px;color:var(--text-secondary)">Delta semaine : </span>
          <strong style="color:${(weekly.weight - prevWeekly.weight) >= 0 ? 'var(--success)' : 'var(--danger)'}">
            ${(weekly.weight - prevWeekly.weight) > 0 ? '+' : ''}${(weekly.weight - prevWeekly.weight).toFixed(1)} kg
          </strong>
        </div>
      ` : ''}
    `;

    // Date navigation
    document.getElementById('weight-prev').addEventListener('click', () => {
      currentDate = addDays(currentDate, -1);
      render(container, false);
    });
    document.getElementById('weight-next').addEventListener('click', () => {
      currentDate = addDays(currentDate, 1);
      render(container, false);
    });

    // Save daily weight
    document.getElementById('save-daily-weight').addEventListener('click', async (e) => {
      const btn = e.target;
      const weight = parseFloat(document.getElementById('daily-weight').value);
      if (!weight) {
        showToast('Indique ton poids');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Enregistrement...';

      try {
        // Save weight in the workout document for this day
        const existingDay = dayData || {};
        await saveWorkout(currentDate, { ...existingDay, weight });

        // Also update the weekly summary with the latest weight
        const delta = prevWeekly?.weight ? Math.round((weight - prevWeekly.weight) * 10) / 10 : 0;
        await saveWeekly(weekId, {
          week: weekNum,
          phase,
          weight,
          deltaWeight: delta,
          musculationDone: muscu.length,
          musculationTotal: 4,
          bikeDone: velo.length,
          bikeTotal: 2,
        });
        await saveUserProfile({ currentWeight: weight });

        showToast('Pesée enregistrée ✓');
        render(container, false);
      } catch {
        showToast('Erreur — réessaie');
        btn.disabled = false;
        btn.textContent = 'Enregistrer';
      }
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Erreur</p><p style="font-size:12px">${err.message}</p></div>`;
  }
}
