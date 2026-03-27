// Guide des exercices — descriptions et instructions
// Chaque clé correspond à l'id de l'exercice dans program-data.js
// Images : free-exercise-db (CC0 Public Domain) — https://github.com/yuhonas/free-exercise-db

const IMG_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

export const EXERCISE_GUIDE = {
  // === LUNDI — Poitrine / Triceps ===
  'pompes-classiques': {
    muscles: 'Pectoraux, deltoïdes antérieurs, triceps',
    images: [`${IMG_BASE}/Incline_Push-Up_Wide/0.jpg`, `${IMG_BASE}/Incline_Push-Up_Wide/1.jpg`],
    steps: [
      'Mains au sol, légèrement plus larges que les épaules',
      'Corps gainé, aligné de la tête aux pieds',
      'Descendre en fléchissant les coudes (angle ~45° avec le corps)',
      'Poitrine frôle le sol, puis pousser pour remonter',
      'Expirer en poussant, inspirer en descendant',
    ],
    tips: 'Garde les abdos contractés. Si trop difficile, commence sur les genoux.',
  },

  'pompes-inclinees': {
    muscles: 'Haut des pectoraux, deltoïdes antérieurs, triceps',
    images: [`${IMG_BASE}/Decline_Push-Up/0.jpg`, `${IMG_BASE}/Decline_Push-Up/1.jpg`],
    steps: [
      'Pieds posés sur une chaise ou un banc',
      'Mains au sol, largeur des épaules',
      'Corps droit et gainé (fesses pas en l\'air)',
      'Descendre la poitrine vers le sol en contrôlant',
      'Pousser pour remonter sans cambrer le dos',
    ],
    tips: 'Plus les pieds sont hauts, plus ça cible le haut des pectoraux. Commence avec une hauteur modérée.',
  },

  'dips-chaises': {
    muscles: 'Pectoraux inférieurs, triceps, deltoïdes antérieurs',
    images: [`${IMG_BASE}/Bench_Dips/0.jpg`, `${IMG_BASE}/Bench_Dips/1.jpg`],
    steps: [
      'Placer deux chaises stables face à face',
      'Mains sur le bord des chaises, bras tendus',
      'Pieds au sol ou sur une troisième chaise',
      'Descendre en fléchissant les coudes (90° max)',
      'Pousser pour remonter bras tendus',
    ],
    tips: 'Penche-toi légèrement en avant pour cibler les pectoraux, reste droit pour cibler les triceps. Assure-toi que les chaises sont bien stables.',
  },

  'pompes-serrees': {
    muscles: 'Triceps, pectoraux internes',
    images: [`${IMG_BASE}/Incline_Push-Up_Close-Grip/0.jpg`, `${IMG_BASE}/Incline_Push-Up_Close-Grip/1.jpg`],
    steps: [
      'Position de pompe, mains rapprochées (largeur épaules ou moins)',
      'Coudes le long du corps en descendant',
      'Descendre lentement en contrôlant le mouvement',
      'Pousser pour remonter en contractant les triceps',
      'Garder le corps bien gainé tout le long',
    ],
    tips: 'Les coudes doivent frôler le corps, pas partir sur les côtés. Plus les mains sont serrées, plus les triceps travaillent.',
  },

  'pompes-diamant': {
    muscles: 'Triceps (intense), pectoraux internes',
    images: [`${IMG_BASE}/Close-Grip_Push-Up_off_of_a_Dumbbell/0.jpg`, `${IMG_BASE}/Close-Grip_Push-Up_off_of_a_Dumbbell/1.jpg`],
    steps: [
      'Mains au sol, pouces et index se touchent (forme de losange/diamant)',
      'Position de pompe, corps gainé',
      'Descendre la poitrine vers les mains',
      'Coudes restent proches du corps',
      'Pousser pour remonter en contractant les triceps',
    ],
    tips: 'Exercice avancé. Si trop dur, passe en pompes serrées ou fais-le sur les genoux. La forme en diamant des mains maximise le travail des triceps.',
  },

  // === MERCREDI — Dos / Biceps ===
  'rowing-un-bras': {
    muscles: 'Grand dorsal, rhomboïdes, trapèzes, biceps',
    images: [`${IMG_BASE}/One-Arm_Dumbbell_Row/0.jpg`, `${IMG_BASE}/One-Arm_Dumbbell_Row/1.jpg`],
    steps: [
      'Un genou et une main en appui sur un banc ou une chaise',
      'Dos plat, parallèle au sol',
      'Haltère dans la main libre, bras tendu vers le sol',
      'Tirer l\'haltère vers la hanche en serrant l\'omoplate',
      'Redescendre lentement — ne pas balancer',
    ],
    tips: 'Imagine que tu veux mettre ton coude dans ta poche arrière. Le mouvement part de l\'omoplate, pas du biceps.',
  },

  'rowing-penche': {
    muscles: 'Grand dorsal, rhomboïdes, trapèzes, érecteurs du rachis',
    images: [`${IMG_BASE}/Bent_Over_Two-Dumbbell_Row/0.jpg`, `${IMG_BASE}/Bent_Over_Two-Dumbbell_Row/1.jpg`],
    steps: [
      'Debout, pieds largeur épaules, genoux légèrement fléchis',
      'Pencher le buste à 45° en gardant le dos plat',
      'Un haltère dans chaque main, bras pendants',
      'Tirer les haltères vers les hanches en serrant les omoplates',
      'Redescendre lentement en contrôlant',
    ],
    tips: 'Ne pas arrondir le dos. Pense à bomber la poitrine et serrer les omoplates en haut du mouvement.',
  },

  'curl-biceps': {
    muscles: 'Biceps brachial, brachial antérieur',
    images: [`${IMG_BASE}/Dumbbell_Bicep_Curl/0.jpg`, `${IMG_BASE}/Dumbbell_Bicep_Curl/1.jpg`],
    steps: [
      'Debout, pieds largeur épaules, un haltère dans chaque main',
      'Bras le long du corps, paumes vers l\'avant (supination)',
      'Fléchir les coudes pour monter les haltères vers les épaules',
      'Coudes fixes, collés au corps — ne pas balancer',
      'Redescendre lentement en contrôlant la descente',
    ],
    tips: 'Ne triche pas avec l\'élan. Si tu dois balancer le corps, prends plus léger. La descente (phase excentrique) est aussi importante que la montée.',
  },

  'curl-marteau': {
    muscles: 'Biceps brachial, long supinateur, avant-bras',
    images: [`${IMG_BASE}/Hammer_Curls/0.jpg`, `${IMG_BASE}/Hammer_Curls/1.jpg`],
    steps: [
      'Debout, pieds largeur épaules, un haltère dans chaque main',
      'Paumes face à face (prise neutre, comme un marteau)',
      'Fléchir les coudes pour monter les haltères',
      'Garder les coudes fixes au corps',
      'Redescendre lentement',
    ],
    tips: 'La prise neutre sollicite davantage le long supinateur et les avant-bras. Excellent complément au curl classique.',
  },

  'superman': {
    muscles: 'Lombaires, érecteurs du rachis, fessiers, ischio-jambiers',
    images: [`${IMG_BASE}/Superman/0.jpg`, `${IMG_BASE}/Superman/1.jpg`],
    steps: [
      'Allongé face au sol, bras tendus devant soi',
      'Lever simultanément les bras et les jambes du sol',
      'Serrer les fessiers et les lombaires en haut',
      'Maintenir 2-3 secondes en haut du mouvement',
      'Redescendre lentement',
    ],
    tips: 'Ne pas forcer sur la nuque — regarde le sol. Le mouvement est lent et contrôlé, pas brusque.',
  },

  // === JEUDI — Jambes / Fessiers ===
  'squats': {
    muscles: 'Quadriceps, fessiers, ischio-jambiers, core',
    images: [`${IMG_BASE}/Bodyweight_Squat/0.jpg`, `${IMG_BASE}/Bodyweight_Squat/1.jpg`],
    steps: [
      'Debout, pieds largeur épaules, pointes légèrement vers l\'extérieur',
      'Descendre en poussant les hanches en arrière (comme s\'asseoir)',
      'Genoux dans l\'axe des pieds, ne pas dépasser les pointes',
      'Descendre jusqu\'à ce que les cuisses soient parallèles au sol',
      'Pousser sur les talons pour remonter, serrer les fessiers en haut',
    ],
    tips: 'Garde le dos droit et la poitrine bombée. Le poids doit être sur les talons, pas sur les pointes.',
  },

  'fentes-avant': {
    muscles: 'Quadriceps, fessiers, ischio-jambiers',
    images: [`${IMG_BASE}/Dumbbell_Lunges/0.jpg`, `${IMG_BASE}/Dumbbell_Lunges/1.jpg`],
    steps: [
      'Debout, pieds joints',
      'Faire un grand pas en avant',
      'Descendre le genou arrière vers le sol (sans le toucher)',
      'Les deux genoux forment des angles à 90°',
      'Pousser sur le pied avant pour revenir en position initiale',
    ],
    tips: 'Le genou avant ne doit pas dépasser la pointe du pied. Alterne les jambes à chaque rep.',
  },

  'pont-fessier': {
    muscles: 'Grand fessier, ischio-jambiers, lombaires',
    images: [`${IMG_BASE}/Butt_Lift_Bridge/0.jpg`, `${IMG_BASE}/Butt_Lift_Bridge/1.jpg`],
    steps: [
      'Allongé sur le dos, genoux fléchis, pieds à plat au sol',
      'Placer le poids (haltère) sur les hanches si disponible',
      'Pousser les hanches vers le plafond en serrant les fessiers',
      'En haut : ligne droite des épaules aux genoux',
      'Redescendre lentement sans poser les fesses au sol',
    ],
    tips: 'Serre les fessiers fort en haut pendant 2 secondes. Les pieds sont proches des fesses. Ne pas cambrer le dos.',
  },

  'squat-saute': {
    muscles: 'Quadriceps, fessiers, mollets, explosivité',
    images: [`${IMG_BASE}/Freehand_Jump_Squat/0.jpg`, `${IMG_BASE}/Freehand_Jump_Squat/1.jpg`],
    steps: [
      'Position squat classique, pieds largeur épaules',
      'Descendre en squat (cuisses parallèles)',
      'Exploser vers le haut en sautant le plus haut possible',
      'Atterrir en douceur sur la plante des pieds',
      'Amortir en descendant directement dans le squat suivant',
    ],
    tips: 'Atterris doucement, genoux fléchis pour absorber l\'impact. Exercice cardio-explosif, garde un rythme régulier.',
  },

  'mollets-debout': {
    muscles: 'Gastrocnémiens (mollets), soléaire',
    images: [`${IMG_BASE}/Calf_Raise_On_A_Dumbbell/0.jpg`, `${IMG_BASE}/Calf_Raise_On_A_Dumbbell/1.jpg`],
    steps: [
      'Debout, pieds largeur des hanches (sur une marche si possible)',
      'Monter sur la pointe des pieds le plus haut possible',
      'Serrer les mollets en haut pendant 1-2 secondes',
      'Redescendre lentement (sous le niveau de la marche si possible)',
      'Ne pas plier les genoux — le mouvement vient des chevilles',
    ],
    tips: 'Pour plus d\'amplitude, fais-les au bord d\'une marche d\'escalier. Lent et contrôlé, pas de rebond.',
  },

  // === SAMEDI — Épaules / Abdos + Full Body ===
  'pompes-pike': {
    muscles: 'Deltoïdes antérieurs et latéraux, triceps',
    images: [`${IMG_BASE}/Handstand_Push-Ups/0.jpg`, `${IMG_BASE}/Handstand_Push-Ups/1.jpg`],
    steps: [
      'Position de pompe, puis lever les hanches haut (forme de V inversé)',
      'Mains un peu plus larges que les épaules',
      'Tête entre les bras, regard vers les pieds',
      'Fléchir les coudes pour descendre la tête vers le sol',
      'Pousser pour remonter, bras tendus',
    ],
    tips: 'Plus les pieds sont proches des mains, plus c\'est intense pour les épaules. Simule un développé militaire au poids du corps.',
  },

  'elevations-laterales': {
    muscles: 'Deltoïdes latéraux (épaules)',
    images: [`${IMG_BASE}/Lateral_Raise_-_With_Bands/0.jpg`, `${IMG_BASE}/Lateral_Raise_-_With_Bands/1.jpg`],
    steps: [
      'Debout, un haltère léger dans chaque main',
      'Bras le long du corps, coudes très légèrement fléchis',
      'Lever les bras sur les côtés jusqu\'à hauteur des épaules',
      'Ne pas monter plus haut que les épaules',
      'Redescendre lentement — 3 secondes minimum',
    ],
    tips: 'Poids léger ! L\'erreur n°1 est de prendre trop lourd et de compenser avec l\'élan. Imagine que tu verses de l\'eau avec des bouteilles.',
  },

  'gainage-planche': {
    muscles: 'Transverse, grand droit, obliques, lombaires',
    images: [`${IMG_BASE}/Plank/0.jpg`, `${IMG_BASE}/Plank/1.jpg`],
    steps: [
      'Sur les avant-bras et les pointes de pieds',
      'Coudes sous les épaules',
      'Corps parfaitement aligné (tête, dos, fesses, pieds)',
      'Serrer les abdos et les fessiers pour ne pas creuser le dos',
      'Maintenir la position le temps indiqué, respirer normalement',
    ],
    tips: 'Fesses ni trop hautes ni trop basses. Si ça tremble, c\'est normal, c\'est que ça travaille !',
  },

  'crunchs': {
    muscles: 'Grand droit de l\'abdomen (partie haute)',
    images: [`${IMG_BASE}/Crunches/0.jpg`, `${IMG_BASE}/Crunches/1.jpg`],
    steps: [
      'Allongé sur le dos, genoux fléchis, pieds à plat au sol',
      'Mains derrière la tête (sans tirer sur la nuque)',
      'Décoller les épaules du sol en contractant les abdos',
      'Monter d\'environ 30° — pas besoin de se relever complètement',
      'Redescendre lentement, ne pas relâcher la tension',
    ],
    tips: 'Regarde le plafond, pas les genoux, pour ne pas forcer sur la nuque. L\'amplitude est courte mais intense.',
  },

  'releves-jambes': {
    muscles: 'Grand droit de l\'abdomen (partie basse), psoas',
    images: [`${IMG_BASE}/Front_Leg_Raises/0.jpg`, `${IMG_BASE}/Front_Leg_Raises/1.jpg`],
    steps: [
      'Allongé sur le dos, bras le long du corps (ou mains sous les fesses)',
      'Jambes tendues, pieds joints',
      'Lever les jambes à la verticale (90°) en contractant les abdos',
      'Le bas du dos reste plaqué au sol',
      'Redescendre lentement sans toucher le sol, puis remonter',
    ],
    tips: 'Si trop dur avec les jambes tendues, fléchis légèrement les genoux. L\'important : le bas du dos ne doit jamais se décoller du sol.',
  },

  'rotation-russe': {
    muscles: 'Obliques internes et externes, transverse',
    images: [`${IMG_BASE}/Cable_Russian_Twists/0.jpg`, `${IMG_BASE}/Cable_Russian_Twists/1.jpg`],
    steps: [
      'Assis, dos incliné à 45°, pieds décollés du sol',
      'Mains jointes devant soi (ou avec un poids)',
      'Tourner le tronc à gauche, toucher le sol avec les mains',
      'Revenir au centre, puis tourner à droite',
      'Le mouvement vient du tronc, pas des bras',
    ],
    tips: 'Garde les pieds décollés pour plus d\'intensité. Mouvement lent et contrôlé, pas de précipitation.',
  },

  'burpees': {
    muscles: 'Full body : pectoraux, épaules, quadriceps, core, cardio',
    images: [`${IMG_BASE}/Knee_Tuck_Jump/0.jpg`, `${IMG_BASE}/Knee_Tuck_Jump/1.jpg`],
    steps: [
      'Debout → descendre en squat, mains au sol',
      'Lancer les pieds en arrière → position de planche',
      'Faire une pompe (optionnel mais recommandé)',
      'Ramener les pieds vers les mains en sautant',
      'Sauter en l\'air, bras au-dessus de la tête',
    ],
    tips: 'Exercice très cardio. Privilégie la technique à la vitesse. Si trop dur, supprime la pompe ou le saut.',
  },

  'pompes-explosives': {
    muscles: 'Pectoraux, triceps, deltoïdes — en puissance',
    images: [`${IMG_BASE}/Incline_Push-Up_Depth_Jump/0.jpg`, `${IMG_BASE}/Incline_Push-Up_Depth_Jump/1.jpg`],
    steps: [
      'Position de pompe classique',
      'Descendre la poitrine vers le sol',
      'Pousser de manière explosive pour que les mains décollent du sol',
      'Atterrir en douceur, amortir avec les bras',
      'Enchaîner directement avec la rep suivante',
    ],
    tips: 'Variante avancée. Si trop dur, fais des pompes classiques avec une poussée rapide sans décoller. Protège tes poignets à l\'atterrissage.',
  },
};

// Ouvre la modale guide pour un exercice donné
export function openExerciseGuide(exerciseId) {
  const guide = EXERCISE_GUIDE[exerciseId];
  if (!guide) return;

  // Supprimer une modale existante
  const existing = document.getElementById('exercise-guide-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'exercise-guide-modal';
  modal.className = 'guide-modal-overlay';
  modal.innerHTML = `
    <div class="guide-modal">
      <button class="guide-modal-close" id="close-guide">&times;</button>
      <div class="guide-modal-images">
        ${guide.images.map((src, i) => `<img src="${src}" alt="Position ${i + 1}" loading="lazy">`).join('')}
      </div>
      <div class="guide-modal-muscles">
        <span class="guide-muscles-label">Muscles ciblés</span>
        <span>${guide.muscles}</span>
      </div>
      <div class="guide-modal-steps">
        <span class="guide-steps-label">Exécution</span>
        <ol>
          ${guide.steps.map(s => `<li>${s}</li>`).join('')}
        </ol>
      </div>
      <div class="guide-modal-tip">
        <span class="guide-tip-icon">💡</span>
        <span>${guide.tips}</span>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Fermer au clic sur le bouton ou l'overlay
  document.getElementById('close-guide').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}
