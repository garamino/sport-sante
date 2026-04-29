import { getUserProfile, saveUserProfile, getAllSleep, getIntakes, saveIntakes, deleteSleepMedsField } from './db.js';
import { parseMeds } from './sleep-meds.js';

const LEGACY_MED_TO_PRODUCT = {
  metasleep: 'Metasleep',
  trazodone: 'Trazodone 100mg',
  stilnoct:  'Stilnoct 10mg',
};

function shortId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

// Migre les doses (champ structuré sleep.meds OU mentions parsées dans sleep.note)
// vers la collection intakes/{date}, puis supprime le champ legacy meds.
// Idempotent : dédoublonne par (product, quantity) sur chaque date.
export async function migrateMedsToIntakes() {
  const profile = await getUserProfile().catch(() => null);
  if (profile?.migrations?.intakesV2) return;

  const allSleep = await getAllSleep().catch(() => []);
  for (const s of allSleep) {
    if (!s?.date) continue;

    // Collecte des doses : structuré + parsé depuis la note
    const doses = { metasleep: '', trazodone: '', stilnoct: '' };
    if (s.meds && typeof s.meds === 'object') {
      for (const k of Object.keys(doses)) if (s.meds[k]) doses[k] = s.meds[k];
    }
    const parsed = parseMeds(s.note || '');
    for (const k of Object.keys(doses)) if (!doses[k] && parsed[k]) doses[k] = parsed[k];

    const newEntries = [];
    for (const [legacyKey, product] of Object.entries(LEGACY_MED_TO_PRODUCT)) {
      const q = doses[legacyKey];
      if (q) newEntries.push({ id: shortId(), time: '', product, quantity: q });
    }

    if (newEntries.length > 0) {
      const existing = await getIntakes(s.date).catch(() => null);
      const existingEntries = existing?.entries || [];
      const sig = e => `${e.product}|${e.quantity}`;
      const existingSigs = new Set(existingEntries.map(sig));
      const toAdd = newEntries.filter(e => !existingSigs.has(sig(e)));
      if (toAdd.length > 0) {
        await saveIntakes(s.date, [...existingEntries, ...toAdd]);
      }
    }

    if (s.meds) {
      await deleteSleepMedsField(s.date).catch(() => {});
    }
  }

  await saveUserProfile({ migrations: { ...(profile?.migrations || {}), intakesV1: true, intakesV2: true } });
}
