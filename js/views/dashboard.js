import { today, formatDateFR, getDayOfWeek, addDays } from '../utils.js';
import { getUserProfile, getWorkout, getSleep, getRecentSleep, getLastWeeklies, getNutrition, getNutritionGoals, getHydration, getHydrationGoal } from '../db.js';
import { showCoachAdvice, openCoachHistory, openCoachNotesModal } from '../coach.js';

function getWeekDates(todayStr) {
  const dow = getDayOfWeek(todayStr);
  const monday = addDays(todayStr, -(dow - 1));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

function fmtShortDate(dateStr) {
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

function fmtHours(h) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}h${String(mm).padStart(2, '0')}` : `${hh}h`;
}

function buildWeekVisual(weekDates, weekWorkouts, weekSleeps, weekNuts, goals, todayStr) {
  const DAY_ABBREV = ['L', 'M', 'Me', 'J', 'V', 'S', 'D'];
  const C_OK   = '#66bb6a';
  const C_WARN = '#ffa726';
  const C_BAD  = '#ef5350';
  const C_EMPTY = 'var(--border)';

  // ── Entraînements ──────────────────────────────────────────────────────────
  const workoutCells = weekDates.map((d, i) => {
    const w = weekWorkouts[i];
    const isFuture = d > todayStr;
    let icon = '·';
    let dotColor = C_EMPTY;

    if (w) {
      if (w.dayType === 'rest') {
        icon = '♻️'; dotColor = 'var(--text-secondary)';
      } else if (w.dayType === 'velo' || w.extraActivities?.includes('velo')) {
        icon = '🚴'; dotColor = w.bikeData ? C_OK : C_WARN;
      } else if (w.dayType === 'course') {
        icon = '🏃'; dotColor = w.cardioData ? C_OK : C_WARN;
      } else if (w.dayType === 'marche') {
        icon = '🚶'; dotColor = w.cardioData ? C_OK : C_WARN;
      } else if (w.dayType === 'muscu') {
        const done = w.exercises?.some(e => e.done);
        icon = '💪'; dotColor = done ? C_OK : C_WARN;
      }
    }

    return `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;opacity:${isFuture ? '0.35' : '1'}">
        <span style="font-size:17px;line-height:1.2">${icon === '·' ? '' : icon}</span>
        <div style="width:7px;height:7px;border-radius:50%;background:${dotColor}"></div>
        <span style="font-size:9px;color:var(--text-secondary)">${DAY_ABBREV[i]}</span>
      </div>`;
  }).join('');

  // ── Sommeil ────────────────────────────────────────────────────────────────
  const validSleeps = weekSleeps.filter(s => s?.hoursSlept);
  const avgHours   = validSleeps.length ? validSleeps.reduce((a, s) => a + s.hoursSlept, 0) / validSleeps.length : null;
  const avgQuality = validSleeps.length ? validSleeps.reduce((a, s) => a + (s.quality || 0), 0) / validSleeps.length : null;
  const shortNights = validSleeps.filter(s => s.hoursSlept < 7).length;
  const maxSleepH = 9;

  const sleepValueRow = weekDates.map((_, i) => {
    const s = weekSleeps[i];
    return `<div style="flex:1;text-align:center;font-size:8px;color:var(--text-secondary);height:11px;overflow:hidden">${s?.hoursSlept ? fmtHours(s.hoursSlept) : ''}</div>`;
  }).join('');

  const sleepBarRow = weekDates.map((d, i) => {
    const s = weekSleeps[i];
    const h = s?.hoursSlept || 0;
    const pct = h ? Math.min(100, (h / maxSleepH) * 100) : 0;
    const color = !h ? C_EMPTY : h >= 7 ? C_OK : h >= 6 ? C_WARN : C_BAD;
    return `<div style="flex:1;height:${pct > 0 ? Math.max(pct, 4) : 2}%;background:${color};border-radius:2px 2px 0 0;opacity:${d > todayStr ? '0.35' : '1'}"></div>`;
  }).join('');

  const sleepLabelRow = DAY_ABBREV.map(l =>
    `<div style="flex:1;text-align:center;font-size:9px;color:var(--text-secondary)">${l}</div>`
  ).join('');

  const sleepSummary = avgHours
    ? `<span style="font-size:11px;color:var(--text-secondary)">${fmtHours(avgHours)} moy · ${avgQuality.toFixed(1)}/10${shortNights >= 2 ? ` · <span style="color:#ef9a9a">⚠ ${shortNights} nuits &lt;7h</span>` : ''}</span>`
    : `<span style="font-size:11px;color:var(--text-secondary)">—</span>`;

  // ── Nutrition ──────────────────────────────────────────────────────────────
  const kcalGoal = goals?.kcal || 2500;

  function dayKcal(n) {
    if (!n) return 0;
    return Math.round(Object.values(n.sections || {}).flat().reduce((a, i) => a + (i.kcal || 0), 0));
  }

  const validNuts = weekNuts.filter(n => n && dayKcal(n) > 0);
  const avgKcal = validNuts.length
    ? Math.round(validNuts.reduce((a, n) => a + dayKcal(n), 0) / validNuts.length)
    : null;

  const nutValueRow = weekDates.map((_, i) => {
    const k = dayKcal(weekNuts[i]);
    return `<div style="flex:1;text-align:center;font-size:8px;color:var(--text-secondary);height:11px;overflow:hidden">${k > 0 ? k : ''}</div>`;
  }).join('');

  const nutBarRow = weekDates.map((d, i) => {
    const k = dayKcal(weekNuts[i]);
    const pct = k > 0 ? Math.min(110, (k / kcalGoal) * 100) : 0;
    const ratio = k / kcalGoal;
    const color = k === 0 ? C_EMPTY : ratio >= 0.9 && ratio <= 1.15 ? C_OK : ratio >= 0.7 ? C_WARN : C_BAD;
    return `<div style="flex:1;height:${pct > 0 ? Math.max(pct, 4) : 2}%;background:${color};border-radius:2px 2px 0 0;opacity:${d > todayStr ? '0.35' : '1'}"></div>`;
  }).join('');

  const nutSummary = avgKcal
    ? `<span style="font-size:11px;color:var(--text-secondary)">${avgKcal} kcal moy · obj ${kcalGoal}</span>`
    : `<span style="font-size:11px;color:var(--text-secondary)">—</span>`;

  return `
    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em">🏋️ Entraînements</span>
      </div>
      <div style="display:flex;gap:2px">${workoutCells}</div>
    </div>

    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em">😴 Sommeil</span>
        ${sleepSummary}
      </div>
      <div style="display:flex;gap:3px;margin-bottom:3px">${sleepValueRow}</div>
      <div style="display:flex;gap:3px;align-items:flex-end;height:36px">${sleepBarRow}</div>
      <div style="display:flex;gap:3px;margin-top:3px">${sleepLabelRow}</div>
    </div>

    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em">🍽️ Nutrition</span>
        ${nutSummary}
      </div>
      <div style="display:flex;gap:3px;margin-bottom:3px">${nutValueRow}</div>
      <div style="display:flex;gap:3px;align-items:flex-end;height:36px">${nutBarRow}</div>
      <div style="display:flex;gap:3px;margin-top:3px">${sleepLabelRow}</div>
    </div>`;
}

export async function render(container) {
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const todayStr = today();
    const weekDates = getWeekDates(todayStr);
    const mondayStr = weekDates[0];

    const [profile, workout, sleep, recentSleep, lastWeeklies, nutData, nutGoals, hydData, hydGoal, weekWorkouts, weekSleeps, weekNuts] = await Promise.all([
      getUserProfile().catch(() => null),
      getWorkout(todayStr).catch(() => null),
      getSleep(todayStr).catch(() => null),
      getRecentSleep(7).catch(() => []),
      getLastWeeklies(3).catch(() => []),
      getNutrition(todayStr).catch(() => null),
      getNutritionGoals().catch(() => null),
      getHydration(todayStr).catch(() => null),
      getHydrationGoal().catch(() => 2000),
      Promise.all(weekDates.map(d => getWorkout(d).catch(() => null))),
      Promise.all(weekDates.map(d => getSleep(d).catch(() => null))),
      Promise.all(weekDates.map(d => getNutrition(d).catch(() => null))),
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

    const sundayStr = addDays(mondayStr, 6);
    const weekVisual = buildWeekVisual(weekDates, weekWorkouts, weekSleeps, weekNuts, nutGoals, todayStr);

    // Nutrition today
    const NUT_DEFAULTS = { kcal: 2500, prot: 160, carbs: 300, fats: 80 };
    const baseGoals = nutGoals || NUT_DEFAULTS;
    const dayAdjust = nutData?.dayAdjust || null;
    const goals = dayAdjust ? {
      kcal:  baseGoals.kcal  + (dayAdjust.kcalDelta  || 0),
      prot:  baseGoals.prot  + (dayAdjust.protDelta   || 0),
      carbs: baseGoals.carbs + (dayAdjust.carbsDelta  || 0),
      fats:  baseGoals.fats  + (dayAdjust.fatsDelta   || 0),
    } : baseGoals;
    const allNutItems = nutData ? Object.values(nutData.sections || {}).flat() : [];
    const nutTotal = allNutItems.reduce(
      (acc, i) => ({ kcal: acc.kcal + (i.kcal||0), prot: acc.prot + (i.prot||0), carbs: acc.carbs + (i.carbs||0), fats: acc.fats + (i.fats||0) }),
      { kcal: 0, prot: 0, carbs: 0, fats: 0 }
    );
    const nutKcal   = Math.round(nutTotal.kcal);
    const nutPct    = Math.min(100, goals.kcal > 0 ? (nutKcal / goals.kcal) * 100 : 0);
    const nutColor  = nutPct >= 100 ? 'var(--danger)' : nutPct >= 80 ? 'var(--success)' : 'var(--accent)';
    const nutAdjustLabel = dayAdjust ? `⚡ ${dayAdjust.label}` : null;
    const hasNut    = allNutItems.length > 0;

    // Hydration today
    const hydEntries = hydData?.entries || [];
    const hydWater = hydEntries.reduce((s, e) => s + (e.ml || 0), 0);
    const hydNutLiquids = nutData
      ? Object.values(nutData.sections || {}).flat().filter(i => i.unit === 'ml' && i.qty > 0)
      : [];
    const hydOther = hydNutLiquids.reduce((s, i) => s + (i.qty || 0), 0);
    const hydTotal = hydWater + hydOther;
    const hydPctWater = hydGoal > 0 ? Math.min(100, (hydWater / hydGoal) * 100) : 0;
    const hydPctOther = hydGoal > 0 ? Math.min(100 - hydPctWater, (hydOther / hydGoal) * 100) : 0;
    const hydColor = hydTotal >= hydGoal ? 'var(--success)' : hydTotal >= hydGoal * 0.5 ? 'var(--accent)' : 'var(--text-secondary)';

    // Workout summary for today — multi-séances
    const _sessions = Array.isArray(workout?.sessions) && workout.sessions.length > 0
      ? workout.sessions
      : workout ? [{ type: workout.dayType, bikeData: workout.bikeData, cardioData: workout.cardioData, exercises: workout.exercises, muscleGroup: workout.muscleGroup, skipped: workout.skipped }]
      : [];
    const _sIcon = s => s.type === 'velo' ? '🚴' : s.type === 'course' ? '🏃' : s.type === 'marche' ? '🚶' : s.type === 'rest' ? '♻️' : '💪';
    const _sDone = s => !s.skipped && (s.type === 'rest' || s.type === 'velo' ? !!s.bikeData : s.type === 'course' || s.type === 'marche' ? !!s.cardioData : (s.exercises || []).some(e => e.done));
    const _sLine = s => {
      if (s.type === 'rest') return 'Repos complet';
      if (s.type === 'velo') { const b = s.bikeData || {}; return ['Vélo', b.durationMinutes ? b.durationMinutes + ' min' : '', b.fcAvg ? b.fcAvg + ' bpm' : ''].filter(Boolean).join(' · '); }
      if (s.type === 'course' || s.type === 'marche') { const c = s.cardioData || {}; return [(s.type === 'course' ? 'Course' : 'Marche'), c.durationMinutes ? c.durationMinutes + ' min' : '', c.distanceKm ? c.distanceKm + ' km' : ''].filter(Boolean).join(' · '); }
      const done = (s.exercises || []).filter(e => e.done).length;
      const total = (s.exercises || []).length;
      return (s.muscleGroup || 'Muscu') + (total > 0 ? ` · ${done}/${total} ex.` : '');
    };
    const workoutIcon = _sessions.length > 0 ? _sessions.map(_sIcon).join('') : '💪';
    const workoutDone = _sessions.length > 0 && _sessions.some(_sDone);

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
        ${_sessions.length > 0 ? _sessions.map(s => `
          <p style="font-size:14px;color:var(--text-secondary);margin-bottom:4px">
            ${_sIcon(s)} ${_sLine(s)}${s.skipped ? ' <span style="color:var(--danger);font-size:12px">· non faite</span>' : ''}
          </p>
        `).join('') : `
          <p style="font-size:14px;color:var(--text-secondary)">Aucune séance enregistrée</p>
        `}
      </div>

      <a href="#/nutrition" class="card dash-nut-card" style="display:block;text-decoration:none;color:inherit">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:7px">
            <div class="card-title" style="margin:0">🍽️ Nutrition</div>
            ${nutAdjustLabel ? `<span style="font-size:10px;color:#ffa726;background:rgba(255,167,38,.1);border:1px solid rgba(255,167,38,.3);border-radius:8px;padding:2px 6px;white-space:nowrap">${nutAdjustLabel}</span>` : ''}
          </div>
          <span style="font-size:13px;font-weight:600;color:${nutColor}">
            ${nutKcal} <span style="color:var(--text-secondary);font-weight:400;font-size:12px">/ ${goals.kcal} kcal</span>
          </span>
        </div>
        <div style="height:6px;background:var(--bg-primary);border-radius:3px;overflow:hidden;margin-bottom:10px">
          <div style="height:100%;width:${nutPct}%;background:${nutColor};border-radius:3px;transition:width .3s"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px">
          <span style="color:var(--text-secondary)">P <b style="color:var(--text-primary)">${Math.round(nutTotal.prot)}g</b></span>
          <span style="color:var(--text-secondary)">G <b style="color:var(--text-primary)">${Math.round(nutTotal.carbs)}g</b></span>
          <span style="color:var(--text-secondary)">L <b style="color:var(--text-primary)">${Math.round(nutTotal.fats)}g</b></span>
          <span style="color:var(--accent);font-size:11px">${hasNut ? 'Voir détail →' : 'Renseigner →'}</span>
        </div>
      </a>

      <a href="#/hydration" class="card" style="display:block;text-decoration:none;color:inherit">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div class="card-title" style="margin:0">💧 Hydratation</div>
          <span style="font-size:13px;font-weight:600;color:${hydColor}">
            ${hydTotal >= 1000 ? (hydTotal / 1000).toFixed(1).replace('.', ',') + ' L' : hydTotal + ' ml'}
            <span style="color:var(--text-secondary);font-weight:400;font-size:12px"> / ${hydGoal >= 1000 ? (hydGoal / 1000).toFixed(1).replace('.', ',') + ' L' : hydGoal + ' ml'}</span>
          </span>
        </div>
        <div style="height:6px;background:var(--bg-primary);border-radius:3px;overflow:hidden;margin-bottom:8px;position:relative">
          <div style="position:absolute;left:0;top:0;height:100%;width:${hydPctWater}%;background:#4fc3f7;border-radius:3px 0 0 3px;transition:width .3s"></div>
          <div style="position:absolute;left:${hydPctWater}%;top:0;height:100%;width:${hydPctOther}%;background:#ffa726;transition:width .3s"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px">
          <div style="display:flex;gap:12px">
            <span style="color:var(--text-secondary)">💧 <b style="color:#4fc3f7">${hydWater} ml</b></span>
            ${hydOther > 0 ? `<span style="color:var(--text-secondary)">🧃 <b style="color:#ffa726">${hydOther} ml</b></span>` : ''}
          </div>
          <span style="color:var(--accent);font-size:11px">${hydTotal > 0 ? 'Voir détail →' : 'Ajouter →'}</span>
        </div>
      </a>

      <div class="card">
        <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px">
          <div class="card-title" style="margin:0">Cette semaine</div>
          <span style="font-size:11px;color:var(--text-secondary)">${fmtShortDate(mondayStr)} – ${fmtShortDate(sundayStr)}</span>
        </div>
        ${weekVisual}
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
        <a href="#/hydration" class="quick-action">
          <div class="quick-action-icon" style="background:#0288d1">💧</div>
          <span>Ajouter eau</span>
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
