// Export Markdown digéré d'une période — destiné à être collé dans une IA
// pour analyse et conseils (nutrition / entraînement).
import {
  getAllWorkouts, getAllNutrition, getAllSleep, getAllHydration,
  getNutritionGoals, getHydrationGoal,
} from './db.js';
import { formatDateFR, addDays } from './utils.js';

const MEAL_SECTIONS = [
  { key: 'breakfast',      label: 'Petit-déjeuner' },
  { key: 'morningSnack',   label: 'Collation matin' },
  { key: 'lunch',          label: 'Déjeuner' },
  { key: 'afternoonSnack', label: 'Collation après-midi' },
  { key: 'dinner',         label: 'Dîner' },
  { key: 'eveningSnack',   label: 'Collation soir' },
];

const SESSION_LABELS = {
  muscu: 'Musculation', velo: 'Vélo', course: 'Course', marche: 'Marche', rest: 'Repos',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const r0 = n => Math.round(n);
const r1 = n => Math.round(n * 10) / 10;

function inRange(dateStr, from, to) {
  return dateStr >= from && dateStr <= to;
}

function indexByDate(arr, from, to) {
  const map = new Map();
  for (const d of arr) {
    if (d?.date && inRange(d.date, from, to)) map.set(d.date, d);
  }
  return map;
}

// Totaux macro d'un jour de nutrition à partir des sections
function nutritionDayTotals(nut) {
  const t = { kcal: 0, prot: 0, carbs: 0, fats: 0 };
  const sections = nut?.sections || {};
  for (const items of Object.values(sections)) {
    for (const it of items || []) {
      t.kcal  += it.kcal  || 0;
      t.prot  += it.prot  || 0;
      t.carbs += it.carbs || 0;
      t.fats  += it.fats  || 0;
    }
  }
  return t;
}

function hydrationDayTotal(hyd) {
  return (hyd?.entries || []).reduce((s, e) => s + (e.ml || 0), 0);
}

// Volume des liquides enregistrés dans la nutrition (unit === 'ml'), comme
// le fait la vue Hydratation qui les compte dans le total « Autres ».
function nutritionLiquidsMl(nut) {
  let ml = 0;
  const sections = nut?.sections || {};
  for (const items of Object.values(sections)) {
    for (const it of items || []) {
      if (it?.unit === 'ml' && it.qty > 0) ml += it.qty;
    }
  }
  return ml;
}

// Le doc sommeil est daté du jour de réveil → la nuit va de la veille à ce jour.
// Ex : doc du 28/07 → "Nuit du 27 au 28 juillet" (ou cross-mois : "du 31 juillet au 1er août").
function nightLabel(dateStr) {
  const from = new Date(addDays(dateStr, -1) + 'T00:00:00');
  const to   = new Date(dateStr + 'T00:00:00');
  const day   = d => (d.getDate() === 1 ? '1er' : String(d.getDate()));
  const month = d => d.toLocaleDateString('fr-FR', { month: 'long' });
  return from.getMonth() === to.getMonth()
    ? `Nuit du ${day(from)} au ${day(to)} ${month(to)}`
    : `Nuit du ${day(from)} ${month(from)} au ${day(to)} ${month(to)}`;
}

// Décimal d'heures → "7h20"
function fmtHours(hoursSleptHHMM, hoursSlept) {
  if (hoursSleptHHMM) {
    const [h, m] = hoursSleptHHMM.split(':');
    return `${parseInt(h, 10)}h${m}`;
  }
  if (hoursSlept) return `${r1(hoursSlept)}h`;
  return '?';
}

// Une session a-t-elle un contenu réel (évite une fausse séance sur un jour
// où seul le poids a été renseigné) ?
function hasSessionContent(s) {
  return (s.exercises && s.exercises.length) || s.bikeData || s.cardioData
    || s.type === 'rest' || s.skipped;
}

// Séances d'un doc workout (format sessions[] moderne + fallback legacy)
function workoutSessions(w) {
  let sessions;
  if (Array.isArray(w?.sessions) && w.sessions.length) {
    sessions = w.sessions;
  } else {
    // Fallback legacy : reconstruire une session unique
    const s = { type: w?.dayType || 'muscu' };
    if (w?.exercises) s.exercises = w.exercises;
    if (w?.bikeData)  s.bikeData  = w.bikeData;
    if (w?.cardioData) s.cardioData = w.cardioData;
    sessions = [s];
  }
  return sessions.filter(hasSessionContent);
}

function bikeLine(b) {
  const parts = [];
  if (b.distanceKm)      parts.push(`${r1(b.distanceKm)} km`);
  if (b.durationMinutes) parts.push(`${b.durationMinutes} min`);
  if (b.wattsAvg)        parts.push(`${b.wattsAvg} W`);
  if (b.fcAvg)           parts.push(`FC ${b.fcAvg}`);
  if (b.elevationGain)   parts.push(`D+ ${b.elevationGain} m`);
  if (b.rpm)             parts.push(`${b.rpm} rpm`);
  return parts.join(' · ') || '—';
}

function cardioLine(c) {
  const parts = [];
  if (c.distanceKm)      parts.push(`${r1(c.distanceKm)} km`);
  if (c.durationMinutes) parts.push(`${c.durationMinutes} min`);
  if (c.caloriesBurned)  parts.push(`${c.caloriesBurned} kcal`);
  return parts.join(' · ') || '—';
}

// ─── Construction du Markdown ────────────────────────────────────────────────

export async function buildMarkdownExport(from, to) {
  const [workouts, nutrition, sleep, hydration, nutGoals, hydGoal] = await Promise.all([
    getAllWorkouts().catch(() => []),
    getAllNutrition().catch(() => []),
    getAllSleep().catch(() => []),
    getAllHydration().catch(() => []),
    getNutritionGoals().catch(() => null),
    getHydrationGoal().catch(() => null),
  ]);

  const wMap = indexByDate(workouts, from, to);
  const nMap = indexByDate(nutrition, from, to);
  const sMap = indexByDate(sleep, from, to);
  const hMap = indexByDate(hydration, from, to);

  const allDates = [...new Set([...wMap.keys(), ...nMap.keys(), ...sMap.keys(), ...hMap.keys()])].sort();

  const nbDays = Math.round((new Date(to + 'T12:00:00') - new Date(from + 'T12:00:00')) / 86400000) + 1;

  const L = []; // lignes de sortie

  // ── En-tête ──
  L.push(`# Export Sport & Santé — ${from} → ${to} (${nbDays} jours)`, '');
  if (nutGoals) {
    L.push(`**Objectifs nutrition** : ${r0(nutGoals.kcal)} kcal · P ${r0(nutGoals.prot)}g · G ${r0(nutGoals.carbs)}g · L ${r0(nutGoals.fats)}g`);
  }
  if (hydGoal) L.push(`**Objectif hydratation** : ${hydGoal} ml/jour`);
  L.push('');

  // ── Résumé de période ──
  L.push('## Résumé de la période', '');

  // Poids (stocké dans le doc workout du jour)
  const weightSeries = [...wMap.entries()]
    .filter(([, w]) => typeof w.weight === 'number')
    .map(([date, w]) => ({ date, weight: w.weight, bodyFat: w.bodyFat }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (weightSeries.length) {
    const first = weightSeries[0], last = weightSeries[weightSeries.length - 1];
    L.push(`**Poids** (${weightSeries.length} pesée${weightSeries.length > 1 ? 's' : ''})`);
    if (weightSeries.length > 1) {
      const delta = r1(last.weight - first.weight);
      L.push(`- ${r1(first.weight)} kg (${first.date}) → ${r1(last.weight)} kg (${last.date})`);
      L.push(`- Évolution : ${delta >= 0 ? '+' : ''}${delta} kg sur la période`);
    } else {
      L.push(`- ${r1(last.weight)} kg (${last.date})`);
    }
    L.push('');
  }

  // Nutrition
  const nDays = [...nMap.values()].map(nutritionDayTotals).filter(t => t.kcal > 0);
  if (nDays.length) {
    const avg = nDays.reduce((a, t) => ({
      kcal: a.kcal + t.kcal, prot: a.prot + t.prot, carbs: a.carbs + t.carbs, fats: a.fats + t.fats,
    }), { kcal: 0, prot: 0, carbs: 0, fats: 0 });
    const n = nDays.length;
    L.push(`**Nutrition** (${n} jour${n > 1 ? 's' : ''} renseigné${n > 1 ? 's' : ''})`);
    L.push(`- Moyenne : ${r0(avg.kcal / n)} kcal · P ${r0(avg.prot / n)}g · G ${r0(avg.carbs / n)}g · L ${r0(avg.fats / n)}g`);
    if (nutGoals?.kcal) {
      const diff = r0(avg.kcal / n - nutGoals.kcal);
      L.push(`- vs objectif kcal : ${diff >= 0 ? '+' : ''}${diff} kcal/jour`);
    }
    L.push('');
  }

  // Entraînement
  const sessionTypeCounts = {};
  let bikeKm = 0, bikeMin = 0, exercisesDone = 0, exercisesTotal = 0;
  for (const w of wMap.values()) {
    for (const s of workoutSessions(w)) {
      if (s.skipped) continue;
      sessionTypeCounts[s.type] = (sessionTypeCounts[s.type] || 0) + 1;
      if (s.bikeData) { bikeKm += s.bikeData.distanceKm || 0; bikeMin += s.bikeData.durationMinutes || 0; }
      for (const ex of s.exercises || []) { exercisesTotal++; if (ex.done) exercisesDone++; }
    }
  }
  const sessionSummary = Object.entries(sessionTypeCounts)
    .map(([t, c]) => `${c} ${SESSION_LABELS[t] || t}`).join(' · ');
  if (sessionSummary) {
    L.push('**Entraînement**');
    L.push(`- Séances : ${sessionSummary}`);
    if (exercisesTotal) L.push(`- Exercices réalisés : ${exercisesDone}/${exercisesTotal}`);
    if (bikeKm || bikeMin) L.push(`- Vélo cumulé : ${r1(bikeKm)} km · ${bikeMin} min`);
    L.push('');
  }

  // Sommeil
  const sleepDays = [...sMap.values()].filter(s => s.hoursSlept || s.hoursSleptHHMM);
  if (sleepDays.length) {
    const decimals = sleepDays.map(s => s.hoursSlept || 0).filter(Boolean);
    const quals = sleepDays.map(s => s.quality).filter(q => typeof q === 'number');
    const avgDec = decimals.length ? decimals.reduce((a, b) => a + b, 0) / decimals.length : 0;
    L.push(`**Sommeil** (${sleepDays.length} nuit${sleepDays.length > 1 ? 's' : ''})`);
    if (avgDec) {
      const h = Math.floor(avgDec), m = r0((avgDec - h) * 60);
      L.push(`- Durée moyenne : ${h}h${String(m).padStart(2, '0')}`);
    }
    if (quals.length) L.push(`- Qualité moyenne : ${r1(quals.reduce((a, b) => a + b, 0) / quals.length)}/10`);
    L.push('');
  }

  // Hydratation (eau + liquides nutrition en ml, comme la vue Hydratation)
  const hydDates = [...new Set([...hMap.keys(), ...nMap.keys()])];
  const hydTotals = hydDates
    .map(d => hydrationDayTotal(hMap.get(d)) + nutritionLiquidsMl(nMap.get(d)))
    .filter(v => v > 0);
  if (hydTotals.length) {
    const avg = hydTotals.reduce((a, b) => a + b, 0) / hydTotals.length;
    L.push(`**Hydratation** (${hydTotals.length} jour${hydTotals.length > 1 ? 's' : ''})`);
    L.push(`- Moyenne : ${r0(avg)} ml/jour${hydGoal ? ` (${r0(avg / hydGoal * 100)}% de l'objectif)` : ''}`);
    L.push('');
  }

  if (!allDates.length) {
    L.push('_Aucune donnée sur cette période._');
    return L.join('\n');
  }

  // ── Détail par jour ──
  L.push('## Détail par jour', '');

  for (const date of allDates) {
    L.push(`### ${formatDateFR(date)} — ${date}`);

    // Poids
    const w = wMap.get(date);
    if (typeof w?.weight === 'number') {
      const bf = typeof w.bodyFat === 'number' ? ` · ${r1(w.bodyFat)}% MG` : '';
      const wt = w.weightTime ? ` (${w.weightTime})` : '';
      L.push(`**Poids** : ${r1(w.weight)} kg${bf}${wt}`);
    }

    // Entraînement
    if (w) {
      for (const s of workoutSessions(w)) {
        const label = SESSION_LABELS[s.type] || s.type;
        const muscle = s.muscleGroup ? ` — ${s.muscleGroup}` : '';
        if (s.skipped) { L.push(`**${label}${muscle}** : pas fait`); continue; }
        if (s.type === 'muscu') {
          L.push(`**${label}${muscle}**`);
          for (const ex of s.exercises || []) {
            const mark = ex.done ? '✓' : '✗';
            const note = ex.note ? ` — ${ex.note}` : '';
            L.push(`- ${mark} ${ex.name}${note}`);
          }
        } else if (s.bikeData) {
          L.push(`**${label}** : ${bikeLine(s.bikeData)}`);
        } else if (s.cardioData) {
          L.push(`**${label}** : ${cardioLine(s.cardioData)}`);
        } else if (s.type === 'rest') {
          L.push(`**Repos**`);
        } else {
          L.push(`**${label}**`);
        }
      }
    }

    // Nutrition
    const nut = nMap.get(date);
    if (nut) {
      const t = nutritionDayTotals(nut);
      if (t.kcal > 0) {
        L.push(`**Nutrition** : ${r0(t.kcal)} kcal · P ${r0(t.prot)}g · G ${r0(t.carbs)}g · L ${r0(t.fats)}g`);
        for (const sec of MEAL_SECTIONS) {
          const items = nut.sections?.[sec.key] || [];
          if (!items.length) continue;
          const list = items.map(it => {
            const qty = it.qty ? ` (${it.qty}${it.unit || ''})` : '';
            return `${it.name}${qty}`;
          }).join(', ');
          L.push(`- ${sec.label} : ${list}`);
        }
      }
    }

    // Sommeil
    const s = sMap.get(date);
    if (s && (s.hoursSlept || s.hoursSleptHHMM || s.bedtime)) {
      const dur = fmtHours(s.hoursSleptHHMM, s.hoursSlept);
      const window = (s.bedtime || s.wakeTime) ? `${s.bedtime || '?'} → ${s.wakeTime || '?'} · ` : '';
      const qual = typeof s.quality === 'number' ? ` · qualité ${s.quality}/10` : '';
      const note = s.note ? ` — ${s.note}` : '';
      L.push(`**Sommeil** (${nightLabel(date)}) : ${window}${dur}${qual}${note}`);
    }

    // Hydratation (eau + liquides nutrition en ml)
    const water = hydrationDayTotal(hMap.get(date));
    const other = nutritionLiquidsMl(nMap.get(date));
    const totalHyd = water + other;
    if (totalHyd > 0) {
      const breakdown = other > 0 ? ` (eau ${water} ml + autres ${other} ml)` : '';
      L.push(`**Hydratation** : ${totalHyd} ml${breakdown}${hydGoal ? ` / ${hydGoal} ml` : ''}`);
    }

    L.push('');
  }

  return L.join('\n').trim() + '\n';
}
