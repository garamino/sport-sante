import { getIntakeProducts, deleteIntakeProduct } from '../db.js';

// Répare les doublons de la bibliothèque de produits.
// Cause historique : seedIntakeProducts a pu tourner deux fois (deux onglets /
// rechargement avant l'écriture du flag intakeProductsSeeded), et comme le seed
// utilise addDoc (ID aléatoire), le même nom a été inséré plusieurs fois.
//
// Idempotent : ne supprime que lorsqu'il reste plus d'un document pour un même
// nom (comparaison insensible à la casse/espaces). Ne touche pas aux prises déjà
// enregistrées, qui référencent les produits par nom et non par ID.
export async function dedupeIntakeProducts() {
  const products = await getIntakeProducts().catch(() => []);
  if (products.length < 2) return;

  const seen = new Map(); // clé normalisée -> produit gardé
  const toDelete = [];

  for (const p of products) {
    const key = (p.name || '').trim().toLowerCase();
    if (!key) continue;
    const kept = seen.get(key);
    if (!kept) {
      seen.set(key, p);
      continue;
    }
    // Doublon : on garde le plus ancien (createdAt le plus petit) et on
    // supprime l'autre, pour préserver l'ID le plus « historique ».
    const keptTime = kept.createdAt?.seconds ?? Infinity;
    const curTime = p.createdAt?.seconds ?? Infinity;
    if (curTime < keptTime) {
      seen.set(key, p);
      toDelete.push(kept.id);
    } else {
      toDelete.push(p.id);
    }
  }

  for (const id of toDelete) {
    await deleteIntakeProduct(id).catch(() => {});
  }

  if (toDelete.length) {
    console.info(`dedupeIntakeProducts : ${toDelete.length} doublon(s) supprimé(s).`);
  }
}
