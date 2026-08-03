import { getUserProfile, saveUserProfile, getAllIntakes, getIntakes, saveIntakes, getExercises, saveExercise, getAllWorkouts, saveWorkout, getWorkoutTemplate } from './db.js';
import { buildLevelFromLegacy } from './utils.js';
import { ADDED_EXERCISES } from './migrations/seed-library.js';
import { Timestamp, getFirestore, doc, deleteDoc } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { app } from './auth.js';
import { getUid } from './auth.js';

const db = getFirestore(app);

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// V4 — Décale d'1 jour vers le passé toutes les entrées intakes sans heure
// (signature des prises migrées depuis sleep.note/meds : elles correspondent
// aux prises du soir précédant la nuit, donc J-1).
async function shiftMigratedIntakesByOneDay() {
  const allDocs = await getAllIntakes().catch(() => []);
  console.log(`[migration v4] ${allDocs.length} docs intakes à scanner`);
  let totalShifted = 0;

  // On collecte d'abord tout en mémoire pour éviter les conflits entre lectures/écritures
  const plan = [];
  for (const docData of allDocs) {
    const entries = docData.entries || [];
    const toShift = entries.filter(e => !e.time);
    const toKeep = entries.filter(e => e.time);
    if (toShift.length > 0) {
      plan.push({ date: docData.date, toShift, toKeep });
    }
  }

  for (const { date, toShift, toKeep } of plan) {
    const targetDate = addDays(date, -1);

    // Ajoute à J-1 avec dédup (product, quantity)
    const targetDoc = await getIntakes(targetDate).catch(() => null);
    const targetEntries = targetDoc?.entries || [];
    const sig = e => `${e.product}|${e.quantity}|${e.time || ''}`;
    const targetSigs = new Set(targetEntries.map(sig));
    const toAdd = toShift.filter(e => !targetSigs.has(sig(e)));
    if (toAdd.length > 0) {
      await saveIntakes(targetDate, [...targetEntries, ...toAdd]);
    }

    // Réécrit le doc source : garde uniquement les entrées avec heure, ou supprime si vide
    if (toKeep.length > 0) {
      await saveIntakes(date, toKeep);
    } else {
      await deleteDoc(doc(db, 'users', getUid(), 'intakes', date)).catch(() => {});
    }

    totalShifted += toShift.length;
    console.log(`[migration v4] ${date} → ${targetDate} : ${toShift.length} prise(s) décalée(s)`);
  }

  console.log(`[migration v4] terminé — ${totalShifted} prises décalées`);
  return { totalShifted };
}

export async function migrateMedsToIntakes() {
  const profile = await getUserProfile().catch(() => null);
  if (profile?.migrations?.intakesV4) return;
  console.log('[migration] démarrage intakesV4...');
  await shiftMigratedIntakesByOneDay();
  await saveUserProfile({ migrations: { ...(profile?.migrations || {}), intakesV4: true } });
}

// exerciseLevelsV1 — Dote chaque exercice existant d'un niveau 1 construit à
// partir de ses anciens champs (defaultSets/Reps/Rest/weight), en numérique
// strict (repos en secondes, charge en kg). Choisit le niveau 1 par défaut.
async function addLevelsToExercises() {
  const exercises = await getExercises().catch(() => []);
  let migrated = 0;
  for (const ex of exercises) {
    if (Array.isArray(ex.levels) && ex.levels.length) continue;
    const level = buildLevelFromLegacy(ex);
    await saveExercise({
      id: ex.id,
      levels: [level],
      defaultLevel: 1,
      // Miroir legacy pour l'affichage existant
      defaultSets: level.sets,
      defaultReps: level.reps,
      defaultRest: level.rest,
      weight: level.weight,
    });
    migrated++;
  }
  console.log(`[migration exerciseLevelsV1] ${migrated} exercice(s) dotés d'un niveau 1`);
  return { migrated };
}

export async function migrateExerciseLevels() {
  const profile = await getUserProfile().catch(() => null);
  if (profile?.migrations?.exerciseLevelsV1) return;
  console.log('[migration] démarrage exerciseLevelsV1...');
  await addLevelsToExercises();
  await saveUserProfile({ migrations: { ...(profile?.migrations || {}), exerciseLevelsV1: true } });
}

// snapshotWorkoutsV1 — Fige la liste d'exercices de chaque séance muscu déjà
// enregistrée dans son propre doc (`session.exerciseIds`), pour la découpler
// des templates. Source de vérité : les exercices réalisés (`session.exercises`),
// sinon l'union template + ajouts au moment de la migration.
function _sameIds(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

async function snapshotWorkoutExercises() {
  const all = await getAllWorkouts().catch(() => []);
  let changed = 0;
  for (const w of all) {
    if (!Array.isArray(w.sessions)) continue; // legacy pré-sessions : figé au rendu
    let touched = false;
    for (const s of w.sessions) {
      if (s.type !== 'muscu') continue;
      let ids = null;
      if (Array.isArray(s.exercises) && s.exercises.length) {
        ids = s.exercises.map(e => e.id).filter(Boolean); // ce qui a réellement été fait
      } else if (s.templateId || Array.isArray(s.exerciseIds)) {
        const tpl = s.templateId ? await getWorkoutTemplate(s.templateId).catch(() => null) : null;
        ids = [...new Set([...(tpl?.exerciseIds || []), ...(s.exerciseIds || [])])];
      }
      if (ids && ids.length && !_sameIds(ids, s.exerciseIds)) {
        s.exerciseIds = ids;
        touched = true;
      }
    }
    if (touched) { await saveWorkout(w.date, w); changed++; }
  }
  console.log(`[migration snapshotWorkoutsV1] ${changed} séance(s) figée(s)`);
  return { changed };
}

export async function migrateWorkoutSnapshots() {
  const profile = await getUserProfile().catch(() => null);
  if (profile?.migrations?.snapshotWorkoutsV1) return;
  console.log('[migration] démarrage snapshotWorkoutsV1...');
  await snapshotWorkoutExercises();
  await saveUserProfile({ migrations: { ...(profile?.migrations || {}), snapshotWorkoutsV1: true } });
}

// extraExercisesV1 — Ajoute les exercices d'ADDED_EXERCISES aux comptes déjà
// seedés, s'ils ne sont pas déjà présents (comparaison par nom). Idempotent :
// un exercice supprimé volontairement ne revient pas (grâce au flag).
async function addExtraExercises() {
  const existing = await getExercises().catch(() => []);
  const byName = new Set(existing.map(e => (e.name || '').toLowerCase()));
  let added = 0;
  for (const ex of ADDED_EXERCISES) {
    if (byName.has(ex.name.toLowerCase())) continue;
    const level = buildLevelFromLegacy(ex);
    await saveExercise({
      ...ex,
      levels: [level],
      defaultLevel: 1,
      defaultSets: level.sets,
      defaultReps: level.reps,
      defaultRest: level.rest,
      weight: level.weight,
    });
    added++;
  }
  console.log(`[migration extraExercisesV1] ${added} exercice(s) ajouté(s)`);
  return { added };
}

export async function migrateExtraExercises() {
  const profile = await getUserProfile().catch(() => null);
  if (profile?.migrations?.extraExercisesV1) return;
  console.log('[migration] démarrage extraExercisesV1...');
  await addExtraExercises();
  await saveUserProfile({ migrations: { ...(profile?.migrations || {}), extraExercisesV1: true } });
}

// Outils manuels pour la console
if (typeof window !== 'undefined') {
  window.__forceShiftIntakes = shiftMigratedIntakesByOneDay;
  window.__forceAddExerciseLevels = addLevelsToExercises;
  window.__forceSnapshotWorkouts = snapshotWorkoutExercises;
  window.__forceAddExtraExercises = addExtraExercises;
}
