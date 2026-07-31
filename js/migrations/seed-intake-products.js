import { getUserProfile, saveUserProfile, getIntakeProducts, saveIntakeProduct } from '../db.js';

// Liste initiale (auparavant codée en dur dans intakes.js).
// Sert uniquement à amorcer la bibliothèque Firestore au premier chargement.
const INITIAL_PRODUCTS = [
  'Metasleep',
  'Metarelax',
  'Trazodone 100mg',
  'Stilnoct 10mg',
  'Ashwagandha 300mg',
  'L-Théanine 200mg',
  'D-Pearls 38 microgr',
  'Folavit 1mg',
  'Forténight',
];

export async function seedIntakeProducts() {
  const profile = await getUserProfile().catch(() => null);
  if (profile?.intakeProductsSeeded) return;

  // Ne pas dupliquer si la collection contient déjà des produits (nom identique).
  const existing = await getIntakeProducts().catch(() => []);
  const existingNames = new Set(existing.map(p => p.name?.toLowerCase()));

  for (const name of INITIAL_PRODUCTS) {
    if (existingNames.has(name.toLowerCase())) continue;
    await saveIntakeProduct({ name });
  }

  await saveUserProfile({ intakeProductsSeeded: true });
}
