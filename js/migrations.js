import { getUserProfile, saveUserProfile, getAllIntakes, getIntakes, saveIntakes } from './db.js';
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

// Outils manuels pour la console
if (typeof window !== 'undefined') {
  window.__forceShiftIntakes = shiftMigratedIntakesByOneDay;
}
