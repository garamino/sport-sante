import { today, getWeekNumber, getPhase, showToast } from '../utils.js';
import { getUserProfile, saveUserProfile, getWeekly, saveWeekly, getAllWorkouts } from '../db.js';

export async function render(container) {
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const profile = await getUserProfile();
    const todayStr = today();
    const weekNum = profile?.startDate ? getWeekNumber(profile.startDate, todayStr) : 1;
    const phase = getPhase(weekNum);
    const weekId = `W${String(weekNum).padStart(2, '0')}`;

    const [weekly, allWorkouts] = await Promise.all([
      getWeekly(weekId).catch(() => null),
      getAllWorkouts().catch(() => []),
    ]);

    // Count this week's sessions
    const weekWorkouts = allWorkouts.filter(w => w.week === weekNum);
    const muscu = weekWorkouts.filter(w => w.dayType === 'muscu' && w.exercises?.some(e => e.done));
    const velo = weekWorkouts.filter(w => w.dayType === 'velo' && w.bikeData);

    // Get previous week weight for delta
    const prevWeekId = `W${String(Math.max(1, weekNum - 1)).padStart(2, '0')}`;
    const prevWeekly = weekNum > 1 ? await getWeekly(prevWeekId).catch(() => null) : null;

    container.innerHTML = `
      <div class="section-title">Semaine ${weekNum} — ${phase}</div>

      <div class="week-summary">
        <div class="week-summary-item">
          <div class="week-summary-value" style="color:var(--accent)">${muscu.length}/4</div>
          <div class="week-summary-label">Musculation</div>
        </div>
        <div class="week-summary-item">
          <div class="week-summary-value" style="color:var(--accent)">${velo.length}/2</div>
          <div class="week-summary-label">Vélo</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Pesée hebdomadaire</div>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:12px">
          1× par semaine, le matin à jeun
        </p>
        <div class="form-group">
          <label>Poids (kg)</label>
          <input type="number" id="weekly-weight" step="0.1" min="40" max="150"
                 placeholder="Ex: 59.5" value="${weekly?.weight || ''}">
        </div>
        ${prevWeekly?.weight ? `
          <p style="font-size:13px;color:var(--text-secondary)">
            Semaine précédente : ${prevWeekly.weight} kg
            ${weekly?.weight ? ` · Delta : <strong style="color:${(weekly.weight - prevWeekly.weight) >= 0 ? 'var(--success)' : 'var(--danger)'}">
              ${(weekly.weight - prevWeekly.weight) > 0 ? '+' : ''}${(weekly.weight - prevWeekly.weight).toFixed(1)} kg
            </strong>` : ''}
          </p>
        ` : ''}

        <button class="btn btn-success" id="save-weekly" style="margin-top:12px">Enregistrer</button>
      </div>
    `;

    // Save
    document.getElementById('save-weekly').addEventListener('click', async (e) => {
      const btn = e.target;
      const weight = parseFloat(document.getElementById('weekly-weight').value);
      if (!weight) {
        showToast('Indique ton poids');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Enregistrement...';

      const delta = prevWeekly?.weight ? Math.round((weight - prevWeekly.weight) * 10) / 10 : 0;

      try {
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
        render(container);
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
