const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const { getStorage } = require("firebase-admin/storage");
const { GoogleGenerativeAI } = require("@google/generative-ai");

initializeApp();
const db = getFirestore();

const SYSTEM_PROMPT = `Tu es un coach sportif personnel ET un nutritionniste ET un kinésithérapeute avec des connaissances en médecine du sport.
Tu accompagnes un programme de prise de masse de 14 semaines au poids du corps + vélo d'appartement.
Tu parles français. Tu es motivant mais honnête. Tu adaptes tes conseils au contexte.

LONGUEUR DES RÉPONSES :
- Conseil automatique (trigger séance, sommeil, pesée, sans message de l'utilisateur) : 2-4 phrases, direct et ciblé.
- Question ou demande libre de l'utilisateur : réponds complètement. Si la réponse le justifie, tu peux aller jusqu'à 8-10 phrases ou utiliser une courte liste à puces. Pas de remplissage — chaque phrase doit apporter quelque chose.

IMPORTANT — TON ET ATTITUDE :
- Reste MESURÉ et FACTUEL. Pas de ton catastrophiste ni d'urgence exagérée.
- N'utilise JAMAIS de mots comme "CRITIQUE", "ALARME", "STOP", "DANGER", "URGENCE" sauf situation réellement grave (blessure aiguë, douleur thoracique, etc.).
- Pour des valeurs biologiques légèrement hors normes, contextualise calmement au lieu d'alerter.
- Tu n'es pas médecin : tu peux signaler une anomalie et suggérer d'en parler au médecin, mais sans dramatiser.

CONNAISSANCES EN BIOLOGIE DU SPORT :
- Les AST (ASAT), CK (créatine kinase) et LDH sont souvent élevées chez les sportifs après un effort intense — c'est un signe normal de micro-lésions musculaires (rhabdomyolyse d'effort), PAS un signe de maladie hépatique.
- Les éosinophiles peuvent être modérément élevés après l'effort ou en cas d'allergies saisonnières — ce n'est pas alarmant isolément.
- Le cholestérol total légèrement élevé n'est pas inquiétant si le ratio HDL/LDL est correct et que la personne fait du sport régulièrement.
- Toujours croiser les marqueurs biologiques avec le contexte sportif (timing par rapport à l'entraînement, volume d'effort récent).

CONNAISSANCES EN NUTRITION POUR LA PRISE DE MASSE :
- L'apport protéique optimal est 1,6–2,2 g/kg de poids corporel par jour. En dessous de 1,4 g/kg, la synthèse musculaire est sous-optimale.
- Un surplus calorique modéré de 200–400 kcal/jour favorise la prise de masse sans excès de gras. Un surplus trop important (> 500 kcal) augmente le stockage adipeux.
- Les glucides sont essentiels pour l'énergie musculaire : 4–6 g/kg/jour pour l'effort d'endurance + muscu.
- L'hydratation est directement liée à la performance et à la synthèse protéique : minimum 2 L/jour, plus en cas d'effort.
- Les compléments courants (créatine, whey, BCAA) sont notés dans les "prises" de l'utilisateur — tiens-en compte dans tes conseils.
- Si les calories du jour sont insuffisantes (< 80 % de l'objectif) ou si les protéines manquent, signale-le comme frein à la progression.
- Si l'hydratation est très faible (< 50 % de l'objectif), mentionne-le brièvement.

En tant que kiné/médecin du sport, tu peux :
- Alerter sur des risques de blessure (surcharge, mauvaise récupération)
- Conseiller des adaptations d'exercices en cas de douleur ou blessure
- Recommander des étirements ou mobilité ciblés
- Détecter des signes de surentraînement (sommeil dégradé + performances en baisse)
- Donner des conseils de prévention adaptés à la phase du programme

Tu reçois un RÉCAP HISTORIQUE résumant les données anciennes (avant la fenêtre de jours récents).
Utilise-le pour comprendre le parcours global de l'utilisateur et assurer la continuité de tes conseils.

Tu peux aussi recevoir des DOCUMENTS DE SANTÉ (bilans sanguins, etc.).
- Documents récents (< 3 mois) : intègre-les si pertinents pour le conseil du jour.
- Documents anciens (> 3 mois) : NE LES MENTIONNE PAS systématiquement. Évoque-les uniquement si l'utilisateur te pose une question en rapport direct, ou si une valeur ancienne est clairement aggravée par l'activité récente.
Ne fais pas de diagnostic médical. Si une valeur est anormale, mentionne-la calmement et suggère d'en parler au médecin si besoin.

DONNÉES DISPONIBLES DANS L'APPLICATION :
- Séances (muscu + vélo avec FC, watts, durée)
- Sommeil (durée, qualité 1-10, notes)
- Nutrition (kcal, protéines, glucides, lipides par repas — petit-déjeuner, collations, déjeuner, dîner)
- Hydratation (eau pure + autres boissons en ml, objectif journalier configurable)
- Pesée quotidienne (poids en kg, masse grasse % via Fitbit Aria, heure de pesée)
- Prises (compléments alimentaires, médicaments horodatés)
- Documents de santé (bilans sanguins, bilans médicaux, imagerie)
- Notes personnelles au coach (blessures, objectifs, contraintes)

BIBLIOTHÈQUE DE SÉANCES :
Tu reçois la liste complète des séances disponibles dans l'application (section "BIBLIOTHÈQUE DE SÉANCES").
Quand tu suggères une séance, utilise toujours son nom exact tel qu'il apparaît dans la bibliothèque.
Pour choisir quelle séance recommander, raisonne à partir de l'historique récent : groupes musculaires travaillés, récupération, fréquence.

CONSEIL SUR LA PROCHAINE SÉANCE :
Conclus toujours ton conseil par un avis sur la prochaine séance (section "SÉANCE DE DEMAIN") :
- Si une séance est enregistrée pour demain → conseille sur ses exercices spécifiques (adapter, alléger ou y aller à fond selon la récupération).
- Si rien n'est enregistré pour demain → ne devine pas et n'invente pas de séance. Conseille sur la récupération ou suggère quel type de séance serait pertinent selon l'historique récent.
Prends en compte : douleurs/blessures signalées dans les notes, qualité du sommeil récent, charge des derniers jours, nutrition du jour.`;

function buildUserMessage(trigger, date, data, coachWindowDays, userMessage) {
  const parts = [];

  // Historical summary (data older than the window)
  if (data.historicalSummary) {
    parts.push(`=== RÉCAP HISTORIQUE (avant les ${coachWindowDays} derniers jours) ===`);
    parts.push(data.historicalSummary);
  }

  // What was just saved
  parts.push(`\n=== ÉVÉNEMENT ===`);
  parts.push(`Type : ${trigger}`);
  parts.push(`Date : ${date}`);

  // User context / notes historisées
  if (data.coachNotes && data.coachNotes.length > 0) {
    parts.push(`\n=== NOTES DE L'UTILISATEUR (blessures, objectifs, contexte) ===`);
    for (const n of data.coachNotes) {
      parts.push(`[${n.date}] ${n.text}`);
    }
  }

  // Health documents — recent ones in full, old ones summarised briefly
  if (data.healthDocs && data.healthDocs.length > 0) {
    const cutoff = new Date(date + "T00:00:00");
    cutoff.setDate(cutoff.getDate() - 90); // 90 days = ~3 months
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const recentDocs = data.healthDocs.filter(d => d.date >= cutoffStr);
    const oldDocs    = data.healthDocs.filter(d => d.date <  cutoffStr);

    if (recentDocs.length > 0) {
      parts.push(`\n=== DOCUMENTS DE SANTÉ RÉCENTS (< 3 mois) ===`);
      for (const d of recentDocs) {
        parts.push(`[${d.date}] (${d.type}) ${d.summary || d.content}`);
      }
    }

    if (oldDocs.length > 0) {
      parts.push(`\n=== DOCUMENTS DE SANTÉ ANCIENS (> 3 mois — ne pas répéter systématiquement) ===`);
      for (const d of oldDocs) {
        parts.push(`[${d.date}] (${d.type}) — disponible mais ancien, n'évoquer que si explicitement pertinent.`);
      }
    }
  }

  // Current status
  parts.push(`\n=== STATUT ACTUEL ===`);
  if (data.profile) {
    parts.push(`Poids actuel : ${data.profile.currentWeight || "non renseigné"} kg`);
    parts.push(`Date début programme : ${data.profile.startDate || "non définie"}`);
  }

  // Today's nutrition
  if (data.todayNutrition) {
    const n = data.todayNutrition;
    const allItems = Object.values(n.sections || {}).flat();
    const kcal  = Math.round(allItems.reduce((s, i) => s + (i.kcal  || 0), 0));
    const prot  = Math.round(allItems.reduce((s, i) => s + (i.prot  || 0), 0) * 10) / 10;
    const carbs = Math.round(allItems.reduce((s, i) => s + (i.carbs || 0), 0) * 10) / 10;
    const fats  = Math.round(allItems.reduce((s, i) => s + (i.fats  || 0), 0) * 10) / 10;
    if (kcal > 0) {
      parts.push(`\n=== NUTRITION DU JOUR ===`);
      const g = data.nutritionGoals;
      const goalLine = g ? ` (obj: ${g.kcal} kcal, ${g.prot}g prot)` : "";
      parts.push(`Total : ${kcal} kcal · P: ${prot}g · G: ${carbs}g · L: ${fats}g${goalLine}`);
      // Per-meal breakdown
      const SECTION_LABELS = {
        breakfast: "Petit-déj", morningSnack: "Collation matin", lunch: "Déjeuner",
        afternoonSnack: "Collation aprèm", dinner: "Dîner", eveningSnack: "Collation soir",
      };
      for (const [key, items] of Object.entries(n.sections || {})) {
        if (!items || items.length === 0) continue;
        const mKcal = Math.round(items.reduce((s, i) => s + (i.kcal || 0), 0));
        const mProt = Math.round(items.reduce((s, i) => s + (i.prot || 0), 0) * 10) / 10;
        const names = items.map(i => i.name).join(", ");
        parts.push(`  ${SECTION_LABELS[key] || key} : ${mKcal} kcal, P:${mProt}g — ${names}`);
      }
    }
  }

  // Today's hydration
  if (data.todayHydration) {
    const h = data.todayHydration;
    const water = (h.entries || []).reduce((s, e) => s + (e.ml || 0), 0);
    const nutLiquids = data.todayNutrition
      ? Object.values(data.todayNutrition.sections || {}).flat()
          .filter(i => i.unit === "ml" && i.qty > 0)
          .reduce((s, i) => s + (i.qty || 0), 0)
      : 0;
    const total = water + nutLiquids;
    if (total > 0 || data.hydrationGoal) {
      parts.push(`\n=== HYDRATATION DU JOUR ===`);
      const goal = data.hydrationGoal || 2000;
      const pct = Math.round((total / goal) * 100);
      parts.push(`Eau : ${water} ml · Autres boissons : ${nutLiquids} ml · Total : ${total} ml / ${goal} ml (${pct}%)`);
    }
  }

  // Today's intakes (supplements/medications)
  if (data.todayIntakes && data.todayIntakes.entries && data.todayIntakes.entries.length > 0) {
    parts.push(`\n=== PRISES DU JOUR (compléments / médicaments) ===`);
    data.todayIntakes.entries.forEach(e => {
      parts.push(`  ${e.time || ""} ${e.name}${e.dose ? " — " + e.dose : ""}${e.note ? " (" + e.note + ")" : ""}`);
    });
  }

  // Today's weighing (body fat if available)
  if (data.todayWeight) {
    const w = data.todayWeight;
    if (w.weight || w.bodyFat) {
      parts.push(`\n=== PESÉE DU JOUR ===`);
      if (w.weight) parts.push(`Poids : ${w.weight} kg${w.weightTime ? " à " + w.weightTime : ""}`);
      if (w.bodyFat) parts.push(`Masse grasse : ${w.bodyFat}%`);
    }
  }

  // Today's data based on trigger
  if (trigger === "workout" && data.todayWorkout) {
    const w = data.todayWorkout;
    parts.push(`\n=== SÉANCE DU JOUR ===`);
    parts.push(`Type : ${w.dayType} | Groupe : ${w.muscleGroup}`);
    parts.push(`Phase : ${w.phase} | Semaine : ${w.week}`);
    if (w.exercises) {
      parts.push("Exercices :");
      w.exercises.forEach((ex) => {
        const status = ex.done ? "✓" : "✗";
        parts.push(`  ${status} ${ex.name} (${ex.sets}×${ex.reps})${ex.note ? " — Note: " + ex.note : ""}`);
      });
    }
    if (w.bikeData && w.bikeData.durationMinutes) {
      const b = w.bikeData;
      parts.push(`Vélo : ${b.durationMinutes}min, ${b.distanceKm}km, FC ${b.fcAvg}bpm, ${b.wattsAvg}W, ${b.rpm}rpm, D+ ${b.elevationGain}m`);
    }
  }

  if (trigger === "sleep" && data.todaySleep) {
    const s = data.todaySleep;
    parts.push(`\n=== SOMMEIL DU JOUR ===`);
    parts.push(`Coucher : ${s.bedtime} | Réveil : ${s.wakeTime}`);
    parts.push(`Durée : ${s.hoursSlept}h | Qualité : ${s.quality}/10`);
    if (s.note) parts.push(`Note : ${s.note}`);
  }

  if (trigger === "weight") {
    parts.push(`\n=== PESÉE DU JOUR ===`);
    parts.push(`Poids : ${data.profile?.currentWeight || "?"} kg`);
  }

  // Recent history
  if (data.recentWorkouts && data.recentWorkouts.length > 0) {
    parts.push(`\n=== HISTORIQUE SÉANCES (${coachWindowDays} derniers jours) ===`);
    data.recentWorkouts.forEach((w) => {
      let line = `${w.date} | ${w.dayType} | ${w.muscleGroup}`;
      if (w.exercises) {
        const done = w.exercises.filter((e) => e.done).length;
        const total = w.exercises.length;
        line += ` | ${done}/${total} exercices faits`;
        const notes = w.exercises.filter((e) => e.note).map((e) => `${e.name}: ${e.note}`);
        if (notes.length > 0) line += ` | Notes: ${notes.join(", ")}`;
      }
      if (w.bikeData && w.bikeData.durationMinutes) {
        line += ` | Vélo: ${w.bikeData.durationMinutes}min, FC ${w.bikeData.fcAvg}bpm, ${w.bikeData.wattsAvg}W`;
      }
      parts.push(line);
    });
  }

  if (data.recentSleep && data.recentSleep.length > 0) {
    parts.push(`\n=== HISTORIQUE SOMMEIL (${coachWindowDays} derniers jours) ===`);
    data.recentSleep.forEach((s) => {
      let line = `${s.date} | ${s.hoursSlept}h | Qualité: ${s.quality}/10`;
      if (s.note) line += ` | ${s.note}`;
      parts.push(line);
    });
  }

  if (data.recentWeeklies && data.recentWeeklies.length > 0) {
    parts.push(`\n=== TENDANCE POIDS ===`);
    data.recentWeeklies.forEach((w) => {
      let line = `S${w.week} (${w.phase}) : ${w.weight || "?"}kg`;
      if (w.deltaWeight != null) line += ` (${w.deltaWeight >= 0 ? "+" : ""}${w.deltaWeight}kg)`;
      if (w.bodyFat != null) line += ` · MG: ${w.bodyFat}%`;
      if (w.musculationDone != null) line += ` | Muscu: ${w.musculationDone}/${w.musculationTotal}`;
      if (w.bikeDone != null) line += ` | Vélo: ${w.bikeDone}/${w.bikeTotal}`;
      parts.push(line);
    });
  }

  if (data.recentNutrition && data.recentNutrition.length > 0) {
    parts.push(`\n=== NUTRITION RÉCENTE (${coachWindowDays} derniers jours) ===`);
    data.recentNutrition.forEach((n) => {
      const allItems = Object.values(n.sections || {}).flat();
      const kcal = Math.round(allItems.reduce((s, i) => s + (i.kcal || 0), 0));
      const prot = Math.round(allItems.reduce((s, i) => s + (i.prot || 0), 0) * 10) / 10;
      if (kcal > 0) parts.push(`${n.date} : ${kcal} kcal · P: ${prot}g`);
    });
  }

  // Workout library
  if (data.workoutLibrary && data.workoutLibrary.length > 0) {
    parts.push(`\n=== BIBLIOTHÈQUE DE SÉANCES ===`);
    for (const tpl of data.workoutLibrary) {
      const exList = tpl.exercises.map(e => `${e.name} (${e.sets}×${e.reps})`).join(", ");
      parts.push(`${tpl.icon || "💪"} ${tpl.name} — ${exList}`);
    }
    parts.push(`Utilise ces séances par leur nom exact quand tu suggères une activité.`);
  }

  // Next session — based solely on what's actually saved in the app
  parts.push(`\n=== SÉANCE DE DEMAIN ===`);
  if (data.tomorrowWorkout) {
    const tw = data.tomorrowWorkout;
    if (tw.dayType === "rest") {
      parts.push(`Repos enregistré.`);
    } else if (tw.dayType === "velo") {
      const b = tw.bikeData;
      parts.push(`Vélo${b && b.durationMinutes ? ` : déjà effectué (${b.durationMinutes}min, FC ${b.fcAvg}bpm)` : " (prévu, pas encore effectué)"}`);
    } else {
      parts.push(`Type : ${tw.dayType} | Groupe : ${tw.muscleGroup || tw.templateId || "—"}`);
      if (tw.exercises?.length > 0) {
        const done = tw.exercises.filter(e => e.done).length;
        const total = tw.exercises.length;
        if (done > 0) {
          parts.push(`Déjà effectuée : ${done}/${total} exercices faits`);
        } else {
          parts.push(`Exercices prévus : ${tw.exercises.map(e => e.name).join(", ")}`);
        }
      }
    }
  } else {
    parts.push(`Aucune séance enregistrée pour demain dans l'application.`);
  }

  // Previous coach advice (for continuity)
  if (data.coachHistory && data.coachHistory.length > 0) {
    parts.push(`\n=== TES DERNIERS CONSEILS ===`);
    data.coachHistory.forEach((h) => {
      parts.push(`[${h.date}] (${h.trigger}) : ${h.advice}`);
    });
    parts.push(`\nTiens compte de tes conseils précédents pour assurer la continuité. Ne te répète pas.`);
  }

  if (userMessage) {
    parts.push(`\n=== MESSAGE DE L'UTILISATEUR ===`);
    parts.push(userMessage.slice(0, 300));
    parts.push(`\nRéponds à sa question en priorité, en t'appuyant sur ses données. Développe autant que nécessaire (jusqu'à 8-10 phrases ou une liste si pertinent), mais sans remplissage.`);
  } else {
    parts.push(`\nDonne un conseil ciblé basé sur ces données. Reste court : 2-4 phrases suffisent.`);
  }

  return parts.join("\n");
}

exports.getCoachAdvice = onCall(
  { maxInstances: 3, timeoutSeconds: 60, region: "europe-west1", invoker: "public" },
  async (request) => {
    // 1. Auth check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentification requise.");
    }
    const uid = request.auth.uid;

    // 2. Validate input
    const { trigger, date, userMessage } = request.data;
    if (!["workout", "sleep", "weight"].includes(trigger)) {
      throw new HttpsError("invalid-argument", "Trigger invalide.");
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new HttpsError("invalid-argument", "Date invalide.");
    }

    // 3. Read API key from Firestore
    const apiKeyDoc = await db.doc(`users/${uid}/settings/apiKey`).get();
    if (!apiKeyDoc.exists || !apiKeyDoc.data().key) {
      return { error: "no_api_key", message: "Aucune clé API configurée." };
    }
    const apiKey = apiKeyDoc.data().key;

    // 4. Rate limiting (30 calls/day)
    const today = new Date().toISOString().split("T")[0];
    const usageRef = db.doc(`users/${uid}/coachContext/usage`);
    const usageDoc = await usageRef.get();
    const usage = usageDoc.exists ? usageDoc.data() : {};
    let currentCount = usage.date === today ? (usage.count || 0) : 0;
    if (currentCount >= 30) {
      return { error: "rate_limit", message: "Limite quotidienne atteinte (30 appels/jour)." };
    }

    // 5. Read coach window setting (default 7 days)
    const windowDoc = await db.doc(`users/${uid}/settings/coachWindow`).get();
    const coachWindowDays = windowDoc.exists ? windowDoc.data().days : 7;

    // 6. Fetch user data
    const data = {};

    // Profile
    const profileDoc = await db.doc(`users/${uid}`).get();
    data.profile = profileDoc.exists ? profileDoc.data() : null;

    // Coach notes (limited to window)
    const notesSnap = await db.collection(`users/${uid}/coachNotes`)
      .orderBy("date", "desc").limit(coachWindowDays).get();
    data.coachNotes = notesSnap.docs.map((d) => d.data());

    // Fallback: legacy persistent notes
    if (data.coachNotes.length === 0) {
      const legacyDoc = await db.doc(`users/${uid}/coachContext/notes`).get();
      if (legacyDoc.exists && legacyDoc.data().persistentNotes) {
        data.coachNotes = [{date: "legacy", text: legacyDoc.data().persistentNotes}];
      }
    }

    // Today's workout (for workout trigger)
    if (trigger === "workout") {
      const wDoc = await db.doc(`users/${uid}/workouts/${date}`).get();
      data.todayWorkout = wDoc.exists ? wDoc.data() : null;
    }

    // Tomorrow's workout (to give accurate "next session" advice)
    const tomorrowDate = new Date(date + "T12:00:00");
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().split("T")[0];
    const tomorrowDoc = await db.doc(`users/${uid}/workouts/${tomorrowStr}`).get();
    data.tomorrowWorkout = tomorrowDoc.exists ? tomorrowDoc.data() : null;

    // Today's sleep (for sleep trigger)
    if (trigger === "sleep") {
      const sDoc = await db.doc(`users/${uid}/sleep/${date}`).get();
      data.todaySleep = sDoc.exists ? sDoc.data() : null;
    }

    // Recent workouts (limited to coach window)
    const workoutsSnap = await db
      .collection(`users/${uid}/workouts`)
      .orderBy("date", "desc")
      .limit(coachWindowDays)
      .get();
    data.recentWorkouts = workoutsSnap.docs.map((d) => d.data());

    // Recent sleep (limited to coach window)
    const sleepSnap = await db
      .collection(`users/${uid}/sleep`)
      .orderBy("date", "desc")
      .limit(coachWindowDays)
      .get();
    data.recentSleep = sleepSnap.docs.map((d) => d.data());

    // Recent weeklies (last 3)
    const weekliesSnap = await db
      .collection(`users/${uid}/weeklies`)
      .orderBy("week", "desc")
      .limit(3)
      .get();
    data.recentWeeklies = weekliesSnap.docs.map((d) => d.data());

    // Today's nutrition
    const nutDoc = await db.doc(`users/${uid}/nutrition/${date}`).get();
    data.todayNutrition = nutDoc.exists ? nutDoc.data() : null;

    // Nutrition goals
    const nutGoalsDoc = await db.doc(`users/${uid}/settings/nutritionGoals`).get();
    data.nutritionGoals = nutGoalsDoc.exists ? nutGoalsDoc.data() : null;

    // Recent nutrition (last coachWindowDays days — just summaries computed in buildUserMessage)
    const nutSnap = await db
      .collection(`users/${uid}/nutrition`)
      .orderBy("date", "desc")
      .limit(coachWindowDays)
      .get();
    data.recentNutrition = nutSnap.docs.map((d) => d.data()).filter((n) => n.date !== date);

    // Today's hydration
    const hydDoc = await db.doc(`users/${uid}/hydration/${date}`).get();
    data.todayHydration = hydDoc.exists ? hydDoc.data() : null;

    // Hydration goal
    const hydGoalDoc = await db.doc(`users/${uid}/settings/hydrationGoal`).get();
    data.hydrationGoal = hydGoalDoc.exists ? hydGoalDoc.data().ml : 2000;

    // Today's intakes (supplements / medications)
    const intakesDoc = await db.doc(`users/${uid}/intakes/${date}`).get();
    data.todayIntakes = intakesDoc.exists ? intakesDoc.data() : null;

    // Today's weight entry (for body fat % — stored in workouts doc)
    if (trigger !== "workout") {
      const weightDoc = await db.doc(`users/${uid}/workouts/${date}`).get();
      data.todayWeight = weightDoc.exists ? { weight: weightDoc.data().weight, bodyFat: weightDoc.data().bodyFat, weightTime: weightDoc.data().weightTime } : null;
    } else {
      data.todayWeight = data.todayWorkout ? { weight: data.todayWorkout.weight, bodyFat: data.todayWorkout.bodyFat, weightTime: data.todayWorkout.weightTime } : null;
    }

    // Workout library — templates + exercises (for "what should I do?" advice)
    const [templatesSnap, exercisesSnap] = await Promise.all([
      db.collection(`users/${uid}/workoutTemplates`).get(),
      db.collection(`users/${uid}/exercises`).get(),
    ]);
    const exercisesById = {};
    exercisesSnap.docs.forEach(d => { exercisesById[d.id] = d.data(); });
    data.workoutLibrary = templatesSnap.docs.map(d => {
      const tpl = { id: d.id, ...d.data() };
      tpl.exercises = (tpl.exerciseIds || [])
        .map(id => exercisesById[id])
        .filter(Boolean)
        .map(ex => ({ name: ex.name, sets: ex.defaultSets, reps: ex.defaultReps, muscleGroup: ex.muscleGroup }));
      return tpl;
    });

    // Health documents (all — they're already summarized)
    const healthSnap = await db.collection(`users/${uid}/healthDocs`)
      .orderBy("date", "desc").limit(10).get();
    data.healthDocs = healthSnap.docs.map((d) => d.data());

    // Coach history (last 5 interactions for continuity)
    const historyRef = db.doc(`users/${uid}/coachContext/history`);
    const historyDoc = await historyRef.get();
    const history = historyDoc.exists ? historyDoc.data().entries || [] : [];
    data.coachHistory = history;

    // 7. Historical summary — auto-generate if stale or missing
    const summaryRef = db.doc(`users/${uid}/coachContext/summary`);
    const summaryDoc = await summaryRef.get();
    const summaryData = summaryDoc.exists ? summaryDoc.data() : null;
    const summaryAgeDays = summaryData
      ? (Date.now() - summaryData.generatedAt.toMillis()) / (1000 * 60 * 60 * 24)
      : Infinity;

    // Determine the cutoff date for "old" data (before the window)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - coachWindowDays);
    const cutoffStr = cutoffDate.toISOString().split("T")[0];

    // Regenerate summary every 7 days (or if window changed, or if none exists)
    const windowChanged = summaryData && summaryData.windowDays !== coachWindowDays;
    if (summaryAgeDays > 7 || windowChanged) {
      // Fetch ALL data older than the window
      const oldWorkoutsSnap = await db
        .collection(`users/${uid}/workouts`)
        .orderBy("date", "desc")
        .get();
      const oldWorkouts = oldWorkoutsSnap.docs
        .map((d) => d.data())
        .filter((w) => w.date < cutoffStr);

      const oldSleepSnap = await db
        .collection(`users/${uid}/sleep`)
        .orderBy("date", "desc")
        .get();
      const oldSleep = oldSleepSnap.docs
        .map((d) => d.data())
        .filter((s) => s.date < cutoffStr);

      const oldNotesSnap = await db
        .collection(`users/${uid}/coachNotes`)
        .orderBy("date", "desc")
        .get();
      const oldNotes = oldNotesSnap.docs
        .map((d) => d.data())
        .filter((n) => n.date < cutoffStr);

      // Only generate if there's actually old data
      if (oldWorkouts.length > 0 || oldSleep.length > 0 || oldNotes.length > 0) {
        const summaryParts = [];
        summaryParts.push("Résume le parcours sportif suivant en un paragraphe structuré (max 150 mots).");
        summaryParts.push("Couvre : tendance poids, habitudes sommeil, points forts/faibles muscu, progression vélo, blessures/alertes.\n");

        if (oldWorkouts.length > 0) {
          summaryParts.push(`=== SÉANCES ANCIENNES (${oldWorkouts.length} séances, ${oldWorkouts[oldWorkouts.length - 1]?.date} → ${oldWorkouts[0]?.date}) ===`);
          for (const w of oldWorkouts.slice(0, 60)) {
            let line = `${w.date} | ${w.dayType} | ${w.muscleGroup}`;
            if (w.exercises) {
              const done = w.exercises.filter((e) => e.done).length;
              line += ` | ${done}/${w.exercises.length} faits`;
            }
            if (w.bikeData?.durationMinutes) {
              line += ` | Vélo: ${w.bikeData.durationMinutes}min, FC ${w.bikeData.fcAvg}bpm`;
            }
            summaryParts.push(line);
          }
        }

        if (oldSleep.length > 0) {
          summaryParts.push(`\n=== SOMMEIL ANCIEN (${oldSleep.length} nuits) ===`);
          for (const s of oldSleep.slice(0, 60)) {
            summaryParts.push(`${s.date} | ${s.hoursSlept}h | Qualité: ${s.quality}/10`);
          }
        }

        if (oldNotes.length > 0) {
          summaryParts.push(`\n=== NOTES ANCIENNES ===`);
          for (const n of oldNotes) {
            summaryParts.push(`[${n.date}] ${n.text}`);
          }
        }

        try {
          const genAI = new GoogleGenerativeAI(apiKey);
          const summaryModel = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: "Tu es un assistant qui résume des données sportives. Sois factuel et concis.",
          });
          const summaryResponse = await summaryModel.generateContent({
            contents: [{ role: "user", parts: [{ text: summaryParts.join("\n") }] }],
            generationConfig: { maxOutputTokens: 2048, temperature: 0.2 },
          });

          const summaryText = summaryResponse.response.text();
          const dateRange = oldWorkouts.length > 0
            ? `${oldWorkouts[oldWorkouts.length - 1]?.date} → ${oldWorkouts[0]?.date}`
            : oldSleep.length > 0
              ? `${oldSleep[oldSleep.length - 1]?.date} → ${oldSleep[0]?.date}`
              : "N/A";

          await summaryRef.set({
            summary: summaryText,
            generatedAt: FieldValue.serverTimestamp(),
            dataRange: dateRange,
            windowDays: coachWindowDays,
          });

          data.historicalSummary = summaryText;

          // Count this as an extra API call in usage
          currentCount++;
          await usageRef.set({ date: today, count: currentCount });
        } catch (summaryErr) {
          // If summary generation fails, use existing summary if available
          if (summaryData) {
            data.historicalSummary = summaryData.summary;
          }
        }
      }
    } else if (summaryData) {
      data.historicalSummary = summaryData.summary;
    }

    // 8. Build prompt and call Claude
    const promptMessage = buildUserMessage(trigger, date, data, coachWindowDays, userMessage);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const coachModel = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: SYSTEM_PROMPT,
      });
      const response = await coachModel.generateContent({
        contents: [{ role: "user", parts: [{ text: promptMessage }] }],
        generationConfig: { maxOutputTokens: 8192, temperature: 0.3 },
      });

      const candidate = response.response.candidates?.[0];
      const finishReason = candidate?.finishReason;
      const usage = response.response.usageMetadata;
      console.log(`[Coach] finishReason: ${finishReason} | tokens: in=${usage?.promptTokenCount} out=${usage?.candidatesTokenCount} thinking=${usage?.thoughtsTokenCount ?? 'n/a'}`);

      const advice = response.response.text();
      console.log(`[Coach] advice length: ${advice?.length} chars`);

      // 9. Update usage counter
      currentCount++;
      await usageRef.set({ date: today, count: currentCount });

      // 10. Save to coach history (keep last 5)
      const now = new Date().toISOString();
      const newEntry = { date: now, trigger, advice };
      const updatedHistory = [newEntry, ...history].slice(0, 5);
      await historyRef.set({ entries: updatedHistory });

      return { advice };
    } catch (err) {
      if (err.status === 400 || err.status === 401 || err.message?.includes("API_KEY_INVALID")) {
        return { error: "invalid_api_key", message: "Clé API invalide." };
      }
      throw new HttpsError("internal", "Erreur lors de l'appel au coach IA.");
    }
  }
);

// ========== PROCESS HEALTH DOCUMENT (Claude Vision) ==========
exports.processHealthDoc = onCall(
  { maxInstances: 3, timeoutSeconds: 60, region: "europe-west1", invoker: "public" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentification requise.");
    }
    const uid = request.auth.uid;
    const { fileUrl, storagePath, type, date } = request.data;

    if (!fileUrl || !storagePath) {
      throw new HttpsError("invalid-argument", "URL du fichier manquante.");
    }

    // Read API key
    const apiKeyDoc = await db.doc(`users/${uid}/settings/apiKey`).get();
    if (!apiKeyDoc.exists || !apiKeyDoc.data().key) {
      return { error: "no_api_key", message: "Aucune clé API configurée." };
    }
    const apiKey = apiKeyDoc.data().key;

    // Download file from Storage to get base64
    const bucket = getStorage().bucket();
    const file = bucket.file(storagePath);
    const [fileBuffer] = await file.download();
    const base64Data = fileBuffer.toString("base64");

    // Determine media type
    const ext = storagePath.split(".").pop().toLowerCase();
    const mediaTypes = {
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
      gif: "image/gif", webp: "image/webp", pdf: "application/pdf",
    };
    const mediaType = mediaTypes[ext] || "image/jpeg";

    // Call Claude to extract health data
    const typeLabels = {
      prise_de_sang: "prise de sang / bilan sanguin",
      bilan_medical: "bilan médical",
      radiologie: "radiologie / imagerie médicale",
      autre: "document médical",
    };

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const visionModel = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: `Tu es un assistant médical qui extrait les données clés de documents de santé.
Extrais les informations de manière structurée et concise.
Pour une prise de sang : liste chaque biomarqueur avec sa valeur, son unité et si c'est normal/bas/élevé.
Pour un bilan médical : résume les observations et recommandations.
Réponds en français. Sois factuel, pas de conseil médical.`,
      });
      const response = await visionModel.generateContent({
        contents: [{
          role: "user",
          parts: [
            { inlineData: { mimeType: mediaType, data: base64Data } },
            { text: `Extrais les données de ce document (${typeLabels[type] || "document médical"}, date: ${date}). Résume de manière structurée.` },
          ],
        }],
        generationConfig: { maxOutputTokens: 2048 },
      });

      const summary = response.response.text();

      // Count API usage
      const today = new Date().toISOString().split("T")[0];
      const usageRef = db.doc(`users/${uid}/coachContext/usage`);
      const usageDoc = await usageRef.get();
      const usage = usageDoc.exists ? usageDoc.data() : {};
      const currentCount = usage.date === today ? (usage.count || 0) : 0;
      await usageRef.set({ date: today, count: currentCount + 1 });

      return { summary };
    } catch (err) {
      if (err.status === 400 || err.status === 401 || err.message?.includes("API_KEY_INVALID")) {
        return { error: "invalid_api_key", message: "Clé API invalide." };
      }
      throw new HttpsError("internal", "Erreur lors de l'analyse du document.");
    }
  }
);

// ========== STRAVA — ÉCHANGE DE CODE OAUTH ==========
exports.stravaExchange = onCall(
  { maxInstances: 3, timeoutSeconds: 30, region: "europe-west1", invoker: "public" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Authentification requise.");
    const uid = request.auth.uid;
    const { code } = request.data;
    if (!code) throw new HttpsError("invalid-argument", "Code OAuth manquant.");

    const credsDoc = await db.doc(`users/${uid}/settings/stravaCredentials`).get();
    if (!credsDoc.exists) throw new HttpsError("failed-precondition", "Identifiants Strava non configurés.");
    const { clientId, clientSecret } = credsDoc.data();

    const resp = await fetch(STRAVA_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, grant_type: "authorization_code" }),
    });
    const tokens = await resp.json();
    if (!resp.ok || tokens.errors) {
      throw new HttpsError("invalid-argument", tokens.message || "Échange de token Strava échoué.");
    }

    await db.doc(`users/${uid}/settings/strava`).set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_at,
      athleteId: tokens.athlete?.id || null,
      athleteName: `${tokens.athlete?.firstname || ""} ${tokens.athlete?.lastname || ""}`.trim(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { ok: true, athleteName: tokens.athlete?.firstname || "Athlète" };
  }
);

// ========== STRAVA — RENOUVELLEMENT DU TOKEN ==========
exports.stravaRefresh = onCall(
  { maxInstances: 3, timeoutSeconds: 30, region: "europe-west1", invoker: "public" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Authentification requise.");
    const uid = request.auth.uid;

    const [credsDoc, stravaDoc] = await Promise.all([
      db.doc(`users/${uid}/settings/stravaCredentials`).get(),
      db.doc(`users/${uid}/settings/strava`).get(),
    ]);
    if (!credsDoc.exists || !stravaDoc.exists) {
      throw new HttpsError("not-found", "Compte Strava non connecté.");
    }
    const { clientId, clientSecret } = credsDoc.data();
    const { refreshToken } = stravaDoc.data();

    const resp = await fetch(STRAVA_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    });
    const tokens = await resp.json();
    if (!resp.ok) throw new HttpsError("internal", "Renouvellement du token Strava échoué.");

    await db.doc(`users/${uid}/settings/strava`).update({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_at,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { accessToken: tokens.access_token, expiresAt: tokens.expires_at };
  }
);
