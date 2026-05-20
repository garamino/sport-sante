import { getUserProfile, saveUserProfile, saveExercise, saveWorkoutTemplate } from '../db.js';

// Exercices extraits de program-data.js
const EXERCISES = [
  // Poitrine / Triceps
  { name: 'Pompes classiques',                   muscleGroup: 'Poitrine',         defaultSets: 4, defaultReps: '12',       defaultRest: '90s', notes: 'Poitrine principale',                                        weight: '—' },
  { name: 'Pompes inclinées (pieds sur chaise)', muscleGroup: 'Poitrine',         defaultSets: 3, defaultReps: '10',       defaultRest: '90s', notes: 'Haut poitrine / épaules',                                    weight: '—' },
  { name: 'Dips entre deux chaises',             muscleGroup: 'Poitrine',         defaultSets: 3, defaultReps: '10',       defaultRest: '90s', notes: 'Poitrine + triceps',                                          weight: '—' },
  { name: 'Pompes serrées',                      muscleGroup: 'Triceps',          defaultSets: 3, defaultReps: '10',       defaultRest: '90s', notes: 'Triceps + poitrine',                                          weight: '—' },
  { name: 'Pompes diamant',                      muscleGroup: 'Triceps',          defaultSets: 3, defaultReps: '8',        defaultRest: '90s', notes: 'Triceps +++ (avancer si trop dur → pompes serrées)',           weight: '—' },
  // Dos / Biceps
  { name: 'Rowing haltères un bras',             muscleGroup: 'Dos',              defaultSets: 4, defaultReps: '12/côté', defaultRest: '90s', notes: 'Dos principal',                                               weight: '8-10 kg' },
  { name: 'Rowing penché haltères (2 bras)',     muscleGroup: 'Dos',              defaultSets: 4, defaultReps: '12',       defaultRest: '90s', notes: 'Dos épaisseur',                                               weight: '6-8 kg' },
  { name: 'Curl biceps haltères',                muscleGroup: 'Biceps',           defaultSets: 3, defaultReps: '15',       defaultRest: '75s', notes: 'Biceps',                                                      weight: '6-8 kg' },
  { name: 'Curl marteau',                        muscleGroup: 'Biceps',           defaultSets: 3, defaultReps: '12',       defaultRest: '75s', notes: 'Biceps long + avant-bras',                                    weight: '6-8 kg' },
  { name: 'Superman (lombaires)',                muscleGroup: 'Dos',              defaultSets: 3, defaultReps: '15',       defaultRest: '60s', notes: 'Lombaires / chaîne post.',                                    weight: '—' },
  // Jambes / Fessiers
  { name: 'Squats',                              muscleGroup: 'Jambes',           defaultSets: 4, defaultReps: '15',       defaultRest: '90s', notes: 'Quadriceps + fessiers',                                       weight: '—' },
  { name: 'Fentes avant',                        muscleGroup: 'Jambes',           defaultSets: 3, defaultReps: '12/jambe', defaultRest: '90s', notes: 'Quadriceps + fessiers',                                      weight: '—' },
  { name: 'Pont fessier',                        muscleGroup: 'Fessiers',         defaultSets: 4, defaultReps: '20',       defaultRest: '60s', notes: 'Fessiers + ischios',                                          weight: '10-12 kg (sur hanches)' },
  { name: 'Squat sauté',                         muscleGroup: 'Jambes',           defaultSets: 3, defaultReps: '10',       defaultRest: '90s', notes: 'Explosivité',                                                  weight: '—' },
  { name: 'Mollets debout',                      muscleGroup: 'Jambes',           defaultSets: 4, defaultReps: '20',       defaultRest: '60s', notes: 'Mollets',                                                      weight: '—' },
  // Épaules / Abdos
  { name: 'Pompes pike (épaules)',               muscleGroup: 'Épaules',          defaultSets: 4, defaultReps: '12',       defaultRest: '90s', notes: 'Épaules antérieures',                                         weight: '—' },
  { name: 'Élévations latérales haltères',      muscleGroup: 'Épaules',          defaultSets: 3, defaultReps: '15',       defaultRest: '75s', notes: 'Épaules latérales',                                           weight: '4-6 kg' },
  { name: 'Gainage planche',                     muscleGroup: 'Abdominaux',       defaultSets: 4, defaultReps: '45s',      defaultRest: '60s', notes: 'Core complet',                                                 weight: '—' },
  { name: 'Crunchs',                             muscleGroup: 'Abdominaux',       defaultSets: 3, defaultReps: '20',       defaultRest: '60s', notes: 'Abdos',                                                        weight: '—' },
  { name: 'Relevés de jambes',                   muscleGroup: 'Abdominaux',       defaultSets: 3, defaultReps: '15',       defaultRest: '60s', notes: 'Bas abdos',                                                    weight: '—' },
  { name: 'Rotation russe',                      muscleGroup: 'Abdominaux',       defaultSets: 3, defaultReps: '20',       defaultRest: '60s', notes: 'Obliques',                                                     weight: '—' },
  { name: 'Burpees',                             muscleGroup: 'Full body',        defaultSets: 3, defaultReps: '10',       defaultRest: '90s', notes: 'Full body explosif',                                           weight: '—' },
  { name: 'Pompes explosives',                   muscleGroup: 'Poitrine',         defaultSets: 3, defaultReps: '8',        defaultRest: '90s', notes: 'Puissance pectorale',                                          weight: '—' },
  // Vélo
  { name: "Vélo d'appartement",                  muscleGroup: 'Cardio',           defaultSets: 1, defaultReps: '45-60 min', defaultRest: '—', notes: 'Intensité modérée · 110-128 bpm · tu dois pouvoir parler',    weight: '—' },
];

// Mapping nom → id Firestore (rempli après création des exercices)
const nameToId = {};

// Templates de séances
const TEMPLATES = [
  {
    name: 'Poitrine / Triceps',
    icon: '💪',
    type: 'muscu',
    exerciseNames: ['Pompes classiques', 'Pompes inclinées (pieds sur chaise)', 'Dips entre deux chaises', 'Pompes serrées', 'Pompes diamant'],
  },
  {
    name: 'Dos / Biceps',
    icon: '💪',
    type: 'muscu',
    exerciseNames: ['Rowing haltères un bras', 'Rowing penché haltères (2 bras)', 'Curl biceps haltères', 'Curl marteau', 'Superman (lombaires)'],
  },
  {
    name: 'Jambes / Fessiers',
    icon: '💪',
    type: 'muscu',
    exerciseNames: ['Squats', 'Fentes avant', 'Pont fessier', 'Squat sauté', 'Mollets debout'],
  },
  {
    name: 'Épaules / Abdos + Full body',
    icon: '💪',
    type: 'muscu',
    exerciseNames: ['Pompes pike (épaules)', 'Élévations latérales haltères', 'Gainage planche', 'Crunchs', 'Relevés de jambes', 'Rotation russe', 'Burpees', 'Pompes explosives'],
  },
  {
    name: 'Vélo – Cardio endurance',
    icon: '🚴',
    type: 'velo',
    exerciseNames: ["Vélo d'appartement"],
  },
];

export async function seedLibrary() {
  const profile = await getUserProfile();
  if (profile?.librarySeeded) return;

  // Create exercises and collect name → id mapping
  for (const ex of EXERCISES) {
    const id = await saveExercise(ex);
    nameToId[ex.name] = id;
  }

  // Create workout templates using the generated exercise ids
  for (const tpl of TEMPLATES) {
    const { exerciseNames, ...rest } = tpl;
    const exerciseIds = exerciseNames.map(n => nameToId[n]).filter(Boolean);
    await saveWorkoutTemplate({ ...rest, exerciseIds });
  }

  await saveUserProfile({ librarySeeded: true });
}
