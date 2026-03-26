// Programme Prise de Masse — 14 semaines
// Données transcrites depuis le fichier Excel programme_masse.xlsx

export const PHASES = [
  { name: 'Fondations',      weeks: [1, 2, 3, 4],          description: 'Maîtriser les mouvements, activer les muscles' },
  { name: 'Hypertrophie',    weeks: [5, 6, 7, 8, 9, 10],   description: 'Volume ↑ Intensité ↑, +1 série / exercice' },
  { name: 'Surcompensation', weeks: [11, 12, 13],           description: 'Pousser les limites, tempo lent, supersets' },
  { name: 'Décharge',        weeks: [14],                   description: 'Récupération, volume ÷ 2' },
];

// dayOfWeek: 1=Lundi ... 7=Dimanche
export const WEEKLY_SCHEDULE = {
  1: { type: 'muscu', label: 'Poitrine / Triceps',              icon: '💪', duration: '~45 min' },
  2: { type: 'velo',  label: 'Vélo – Cardio endurance',         icon: '🚴', duration: '45-60 min' },
  3: { type: 'muscu', label: 'Dos / Biceps',                    icon: '💪', duration: '~45 min' },
  4: { type: 'muscu', label: 'Jambes / Fessiers',               icon: '💪', duration: '~45 min' },
  5: { type: 'velo',  label: 'Vélo – Cardio endurance',         icon: '🚴', duration: '45-60 min' },
  6: { type: 'muscu', label: 'Épaules / Abdos + Full body',     icon: '💪', duration: '~50 min' },
  7: { type: 'rest',  label: 'Repos complet',                   icon: '♻️', duration: '—' },
};

// Exercices par jour
// Phase 1 = base. Phase 2 = +1 série, repos 60s. Phase 3 = +1 série, tempo lent, supersets. Phase 4 = volume ÷ 2.
const MONDAY_EXERCISES = [
  { id: 'pompes-classiques',     name: 'Pompes classiques',                    sets: 4, reps: '12',    rest: '90s', notes: 'Poitrine principale',                                weight: '—' },
  { id: 'pompes-inclinees',      name: 'Pompes inclinées (pieds sur chaise)',  sets: 3, reps: '10',    rest: '90s', notes: 'Haut poitrine / épaules',                             weight: '—' },
  { id: 'dips-chaises',          name: 'Dips entre deux chaises',              sets: 3, reps: '10',    rest: '90s', notes: 'Poitrine + triceps',                                   weight: '—' },
  { id: 'pompes-serrees',        name: 'Pompes serrées',                       sets: 3, reps: '10',    rest: '90s', notes: 'Triceps + poitrine',                                   weight: '—' },
  { id: 'pompes-diamant',        name: 'Pompes diamant',                       sets: 3, reps: '8',     rest: '90s', notes: 'Triceps +++ (avancer si trop dur → pompes serrées)',    weight: '—' },
];

const WEDNESDAY_EXERCISES = [
  { id: 'rowing-un-bras',        name: 'Rowing haltères un bras',              sets: 4, reps: '12/côté', rest: '90s', notes: 'Dos principal',            weight: '8-10 kg' },
  { id: 'rowing-penche',         name: 'Rowing penché haltères (2 bras)',      sets: 4, reps: '12',      rest: '90s', notes: 'Dos épaisseur',            weight: '6-8 kg' },
  { id: 'curl-biceps',           name: 'Curl biceps haltères',                 sets: 3, reps: '15',      rest: '75s', notes: 'Biceps',                   weight: '6-8 kg' },
  { id: 'curl-marteau',          name: 'Curl marteau',                         sets: 3, reps: '12',      rest: '75s', notes: 'Biceps long + avant-bras', weight: '6-8 kg' },
  { id: 'superman',              name: 'Superman (lombaires)',                 sets: 3, reps: '15',      rest: '60s', notes: 'Lombaires / chaîne post.',  weight: '—' },
];

const THURSDAY_EXERCISES = [
  { id: 'squats',                name: 'Squats',                               sets: 4, reps: '15',       rest: '90s', notes: 'Quadriceps + fessiers',    weight: '—' },
  { id: 'fentes-avant',          name: 'Fentes avant',                         sets: 3, reps: '12/jambe', rest: '90s', notes: 'Quadriceps + fessiers',    weight: '—' },
  { id: 'pont-fessier',          name: 'Pont fessier',                         sets: 4, reps: '20',       rest: '60s', notes: 'Fessiers + ischios',       weight: '10-12 kg (sur hanches)' },
  { id: 'squat-saute',           name: 'Squat sauté',                          sets: 3, reps: '10',       rest: '90s', notes: 'Explosivité',              weight: '—' },
  { id: 'mollets-debout',        name: 'Mollets debout',                       sets: 4, reps: '20',       rest: '60s', notes: 'Mollets',                  weight: '—' },
];

const SATURDAY_EXERCISES = [
  { id: 'pompes-pike',           name: 'Pompes pike (épaules)',                sets: 4, reps: '12',  rest: '90s', notes: 'Épaules antérieures',   weight: '—' },
  { id: 'elevations-laterales',  name: 'Élévations latérales haltères',       sets: 3, reps: '15',  rest: '75s', notes: 'Épaules latérales',     weight: '4-6 kg' },
  { id: 'gainage-planche',       name: 'Gainage planche',                     sets: 4, reps: '45s', rest: '60s', notes: 'Core complet',          weight: '—' },
  { id: 'crunchs',               name: 'Crunchs',                             sets: 3, reps: '20',  rest: '60s', notes: 'Abdos',                 weight: '—' },
  { id: 'releves-jambes',        name: 'Relevés de jambes',                   sets: 3, reps: '15',  rest: '60s', notes: 'Bas abdos',             weight: '—' },
  { id: 'rotation-russe',        name: 'Rotation russe',                      sets: 3, reps: '20',  rest: '60s', notes: 'Obliques',              weight: '—' },
  { id: 'burpees',               name: 'Burpees',                             sets: 3, reps: '10',  rest: '90s', notes: 'Full body explosif',    weight: '—' },
  { id: 'pompes-explosives',     name: 'Pompes explosives',                   sets: 3, reps: '8',   rest: '90s', notes: 'Puissance pectorale',   weight: '—' },
];

const VELO_SESSION = [
  { id: 'velo', name: "Vélo d'appartement", sets: 1, reps: '45-60 min', rest: '—', notes: 'Intensité modérée · 110-128 bpm · tu dois pouvoir parler', weight: '—' },
];

const REST_SESSION = [
  { id: 'repos', name: 'Repos complet', sets: 0, reps: '—', rest: '—', notes: 'Étirements, mobilité, sommeil 7-9h', weight: '—' },
];

// Base exercises by day of week
const BASE_EXERCISES = {
  1: MONDAY_EXERCISES,
  2: VELO_SESSION,
  3: WEDNESDAY_EXERCISES,
  4: THURSDAY_EXERCISES,
  5: VELO_SESSION,
  6: SATURDAY_EXERCISES,
  7: REST_SESSION,
};

// Get exercises adjusted for the current phase
export function getExercisesForDay(dayOfWeek, phase) {
  const base = BASE_EXERCISES[dayOfWeek];
  if (!base) return [];

  // Vélo and rest don't change between phases
  if (dayOfWeek === 2 || dayOfWeek === 5 || dayOfWeek === 7) {
    return base.map(e => ({ ...e }));
  }

  return base.map(exercise => {
    const e = { ...exercise };

    switch (phase) {
      case 'Hypertrophie':
        // +1 série, repos 60s
        e.sets = e.sets + 1;
        e.rest = '60s';
        e.phaseNote = '+1 série · repos 60s · lester si besoin';
        break;
      case 'Surcompensation':
        // +1 série, tempo lent, supersets
        e.sets = e.sets + 1;
        e.rest = '60s';
        e.phaseNote = '+1 série · tempo lent · supersets';
        break;
      case 'Décharge':
        // Volume ÷ 2
        e.sets = Math.max(1, Math.ceil(e.sets / 2));
        e.phaseNote = 'Volume réduit · récupération';
        break;
      default:
        // Fondations: use base values
        break;
    }

    return e;
  });
}

export function getDaySchedule(dayOfWeek) {
  return WEEKLY_SCHEDULE[dayOfWeek] || WEEKLY_SCHEDULE[7];
}
