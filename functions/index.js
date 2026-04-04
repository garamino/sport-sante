const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
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

Tu reçois un RÉCAP HISTORIQUE résumant les données anciennes (avant la fenêtre de jours récents).
Utilise-le pour comprendre le parcours global de l'utilisateur et assurer la continuité de tes conseils.

Tu peux aussi recevoir des DOCUMENTS DE SANTÉ (bilans sanguins, etc.).
Intègre ces informations dans tes conseils (ex: carence en fer → alimentation, fatigue → adapter l'entraînement).
Ne fais pas de diagnostic médical, mais signale les valeurs anormales et leur impact potentiel sur le programme.

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

function buildUserMessage(trigger, date, data, coachWindowDays) {
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

  // Health documents
  if (data.healthDocs && data.healthDocs.length > 0) {
    parts.push(`\n=== DOCUMENTS DE SANTÉ ===`);
    for (const d of data.healthDocs) {
      parts.push(`[${d.date}] (${d.type}) ${d.summary || d.content}`);
    }
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
      parts.push(`S${w.week} (${w.phase}) : ${w.weight}kg (${w.deltaWeight >= 0 ? "+" : ""}${w.deltaWeight}kg) | Muscu: ${w.musculationDone}/${w.musculationTotal} | Vélo: ${w.bikeDone}/${w.bikeTotal}`);
    });
  }

  // Previous coach advice (for continuity)
  if (data.coachHistory && data.coachHistory.length > 0) {
    parts.push(`\n=== TES DERNIERS CONSEILS ===`);
    data.coachHistory.forEach((h) => {
      parts.push(`[${h.date}] (${h.trigger}) : ${h.advice}`);
    });
    parts.push(`\nTiens compte de tes conseils précédents pour assurer la continuité. Ne te répète pas.`);
  }

  parts.push(`\nDonne un conseil personnalisé basé sur ces données. Sois concis (2-4 phrases).`);

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
          const client = new Anthropic({ apiKey });
          const summaryResponse = await client.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 300,
            system: "Tu es un assistant qui résume des données sportives. Sois factuel et concis.",
            messages: [{ role: "user", content: summaryParts.join("\n") }],
          });

          const summaryText = summaryResponse.content[0]?.text || "";
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
    const userMessage = buildUserMessage(trigger, date, data, coachWindowDays);

    try {
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });

      const advice = response.content[0]?.text || "";

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
      if (err.status === 401) {
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

    // Call Claude Vision to extract health data
    const typeLabels = {
      prise_de_sang: "prise de sang / bilan sanguin",
      bilan_medical: "bilan médical",
      radiologie: "radiologie / imagerie médicale",
      autre: "document médical",
    };

    try {
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 600,
        system: `Tu es un assistant médical qui extrait les données clés de documents de santé.
Extrais les informations de manière structurée et concise.
Pour une prise de sang : liste chaque biomarqueur avec sa valeur, son unité et si c'est normal/bas/élevé.
Pour un bilan médical : résume les observations et recommandations.
Réponds en français. Sois factuel, pas de conseil médical.`,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64Data },
            },
            {
              type: "text",
              text: `Extrais les données de ce document (${typeLabels[type] || "document médical"}, date: ${date}). Résume de manière structurée.`,
            },
          ],
        }],
      });

      const summary = response.content[0]?.text || "";

      // Count API usage
      const today = new Date().toISOString().split("T")[0];
      const usageRef = db.doc(`users/${uid}/coachContext/usage`);
      const usageDoc = await usageRef.get();
      const usage = usageDoc.exists ? usageDoc.data() : {};
      const currentCount = usage.date === today ? (usage.count || 0) : 0;
      await usageRef.set({ date: today, count: currentCount + 1 });

      return { summary };
    } catch (err) {
      if (err.status === 401) {
        return { error: "invalid_api_key", message: "Clé API invalide." };
      }
      throw new HttpsError("internal", "Erreur lors de l'analyse du document.");
    }
  }
);
