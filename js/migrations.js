import { getUserProfile, saveUserProfile, getAllSleep, getIntakes, saveIntakes, deleteSleepMedsField } from './db.js';

const LEGACY_MED_TO_PRODUCT = {
  metasleep: 'Metasleep',
  trazodone: 'Trazodone 100mg',
  stilnoct:  'Stilnoct 10mg',
};

function shortId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

// Migre les champs sleep.meds (legacy) vers la collection intakes/{date}
// puis supprime le champ meds sur le doc sleep.
export async function migrateMedsToIntakes() {
  const profile = await getUserProfile().catch(() => null);
  if (profile?.migrations?.intakesV1) return;

  const allSleep = await getAllSleep().catch(() => []);
  for (const s of allSleep) {
    if (!s?.meds || !s.date) continue;

    const newEntries = [];
    for (const [legacyKey, product] of Object.entries(LEGACY_MED_TO_PRODUCT)) {
      const q = s.meds[legacyKey];
      if (q) newEntries.push({ id: shortId(), time: '', product, quantity: q });
    }
    if (newEntries.length > 0) {
      const existing = await getIntakes(s.date).catch(() => null);
      const existingEntries = existing?.entries || [];
      // Dédoublonne : ne ré-ajoute pas un (product, quantity) déjà présent
      const sig = e => `${e.product}|${e.quantity}`;
      const existingSigs = new Set(existingEntries.map(sig));
      const toAdd = newEntries.filter(e => !existingSigs.has(sig(e)));
      if (toAdd.length > 0) {
        await saveIntakes(s.date, [...existingEntries, ...toAdd]);
      }
    }

    await deleteSleepMedsField(s.date).catch(() => {});
  }

  await saveUserProfile({ migrations: { ...(profile?.migrations || {}), intakesV1: true } });
}
