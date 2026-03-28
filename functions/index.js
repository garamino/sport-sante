const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const Anthropic = require("@anthropic-ai/sdk");

initializeApp();
const db = getFirestore();

const SYSTEM_PROMPT = `Tu es un coach sportif personnel ET un kinésithérapeute avec des connaissances en médecine du sport.
Tu accompagnes un programme de prise de masse de 14 semaines au poids du corps + vélo d'appartement.
Tu parles français. Tu es concis : 2-4 phrases maximum par conseil.
Tu es motivant mais honnête. Tu adaptes tes conseils au contexte.

En tant que kiné/médecin du sport, tu peux :
- Alerter sur des risques de blessure (surcharge, mauvaise récupération)
- Conseiller des adaptations d'exercices en cas de douleur ou blessure
- Recommander des étirements ou mobilité ciblés
- Détecter des signes de surentraînement (sommeil dégradé + performances en baisse)
- Donner des conseils de prévention adaptés à la phase du programme

PROGRAMME HEBDOMADAIRE :
- Lundi : Poitrine / Triceps (pompes classiques, inclinées, dips, pompes serrées, diamant)
- Mardi : Vélo d'appartement (cardio endurance, 45-60 min, FC 110-128 bpm)
- Mercredi : Dos / Biceps (rowing un bras, rowing penché, curl biceps, curl marteau, superman)
- Jeudi : Jambes / Fessiers (squats, fentes avant, pont fessier, squat sauté, mollets debout)
- Vendredi : Vélo d'appartement
- Samedi : Épaules / Abdos + Full body (pompes pike, élévations latérales, gainage, crunchs, relevés jambes, rotation russe, burpees, pompes explosives)
- Dimanche : Repos complet

PHASES DU PROGRAMME :
- Fondations (S1-4) : Maîtriser les mouvements, activer les muscles. Repos 90s.
- Hypertrophie (S5-10) : Volume + intensité, +1 série/exercice, repos réduit à 60s.
- Surcompensation (S11-13) : Pousser les limites, tempo lent, supersets, +1 série.
- Décharge (S14) : Récupération active, volume ÷ 2.`;

function buildUserMessage(trigger, date, data) {
  const parts = [];

  // What was just saved
  parts.push(`=== ÉVÉNEMENT ===`);
  parts.push(`Type : ${trigger}`);
  parts.push(`Date : ${date}`);

  // User context / persistent notes
  if (data.coachNotes) {
    parts.push(`\n=== NOTES PERSISTANTES (blessures, objectifs, contexte) ===`);
    parts.push(data.coachNotes);
  }

  // Current status
  parts.push(`\n=== STATUT ACTUEL ===`);
  if (data.profile) {
    parts.push(`Poids actuel : ${data.profile.currentWeight || "non renseigné"} kg`);
    parts.push(`Date début programme : ${data.profile.startDate || "non définie"}`);
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
    parts.push(`\n=== HISTORIQUE SÉANCES (7 derniers jours) ===`);
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
    parts.push(`\n=== HISTORIQUE SOMMEIL (7 derniers jours) ===`);
    data.recentSleep.forEach((s) => {
      let line = `${s.date} | ${s.hoursSlept}h | Qualité: ${s.quality}/10`;
      if (s.note) line += ` | ${s.note}`;
      parts.push(line);
    });
  }

  if (data.recentWeeklies && data.recentWeeklies.length > 0) {
    parts.push(`\n=== TENDANCE POIDS ===`);
    data.recentWeeklies.forEach((w) => {
      parts.push(`S${w.week} (${w.phase}) : ${w.weight}kg (${w.deltaWeight >= 0 ? "+" : ""}${w.deltaWeight}kg) | Muscu: ${w.musculationDone}/${w.musculationTotal} | Vélo: ${w.bikeDone}/${w.bikeTotal}`);
    });
  }

  parts.push(`\nDonne un conseil personnalisé basé sur ces données. Sois concis (2-4 phrases).`);

  return parts.join("\n");
}

exports.getCoachAdvice = onCall(
  { maxInstances: 3, timeoutSeconds: 30, region: "europe-west1" },
  async (request) => {
    // 1. Auth check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentification requise.");
    }
    const uid = request.auth.uid;

    // 2. Validate input
    const { trigger, date } = request.data;
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
    if (usage.date === today && (usage.count || 0) >= 30) {
      return { error: "rate_limit", message: "Limite quotidienne atteinte (30 appels/jour)." };
    }

    // 5. Fetch user data
    const data = {};

    // Profile
    const profileDoc = await db.doc(`users/${uid}`).get();
    data.profile = profileDoc.exists ? profileDoc.data() : null;

    // Coach notes
    const notesDoc = await db.doc(`users/${uid}/coachContext/notes`).get();
    data.coachNotes = notesDoc.exists ? notesDoc.data().persistentNotes : null;

    // Today's workout (for workout trigger)
    if (trigger === "workout") {
      const wDoc = await db.doc(`users/${uid}/workouts/${date}`).get();
      data.todayWorkout = wDoc.exists ? wDoc.data() : null;
    }

    // Today's sleep (for sleep trigger)
    if (trigger === "sleep") {
      const sDoc = await db.doc(`users/${uid}/sleep/${date}`).get();
      data.todaySleep = sDoc.exists ? sDoc.data() : null;
    }

    // Recent workouts (last 7 days)
    const workoutsSnap = await db
      .collection(`users/${uid}/workouts`)
      .orderBy("date", "desc")
      .limit(7)
      .get();
    data.recentWorkouts = workoutsSnap.docs.map((d) => d.data());

    // Recent sleep (last 7 days)
    const sleepSnap = await db
      .collection(`users/${uid}/sleep`)
      .orderBy("date", "desc")
      .limit(7)
      .get();
    data.recentSleep = sleepSnap.docs.map((d) => d.data());

    // Recent weeklies (last 3)
    const weekliesSnap = await db
      .collection(`users/${uid}/weeklies`)
      .orderBy("week", "desc")
      .limit(3)
      .get();
    data.recentWeeklies = weekliesSnap.docs.map((d) => d.data());

    // 6. Build prompt and call Claude
    const userMessage = buildUserMessage(trigger, date, data);

    try {
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });

      const advice = response.content[0]?.text || "";

      // 7. Update usage counter
      await usageRef.set({
        date: today,
        count: usage.date === today ? (usage.count || 0) + 1 : 1,
      });

      return { advice };
    } catch (err) {
      if (err.status === 401) {
        return { error: "invalid_api_key", message: "Clé API invalide." };
      }
      throw new HttpsError("internal", "Erreur lors de l'appel au coach IA.");
    }
  }
);
