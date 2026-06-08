import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  deleteField,
  collection,
  query,
  orderBy,
  limit,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js';
import { app } from './auth.js';
import { getUid } from './auth.js';

const storage = getStorage(app);

const db = getFirestore(app);

function userDoc(path) {
  return doc(db, 'users', getUid(), ...path.split('/'));
}

function userCollection(path) {
  return collection(db, 'users', getUid(), path);
}

// === User Profile ===
export async function getUserProfile() {
  const snap = await getDoc(doc(db, 'users', getUid()));
  return snap.exists() ? snap.data() : null;
}

export async function saveUserProfile(data) {
  await setDoc(doc(db, 'users', getUid()), data, { merge: true });
}

// === Workouts ===
export async function getWorkout(date) {
  const snap = await getDoc(userDoc(`workouts/${date}`));
  return snap.exists() ? snap.data() : null;
}

export async function saveWorkout(date, data) {
  await setDoc(userDoc(`workouts/${date}`), { ...data, date, savedAt: Timestamp.now() });
}

export async function getAllWorkouts() {
  const q = query(userCollection('workouts'), orderBy('date', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

export async function getExerciseHistory(exerciseId, beforeDate, count = 5) {
  const q = query(userCollection('workouts'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  const results = [];
  for (const d of snap.docs) {
    const data = d.data();
    if (data.date >= beforeDate) continue;
    const ex = data.exercises?.find(e => e.id === exerciseId);
    if (ex) {
      results.push({ date: data.date, note: ex.note || '', done: ex.done });
    }
    if (results.length >= count) break;
  }
  return results;
}

// === Sleep ===
export async function getSleep(date) {
  const snap = await getDoc(userDoc(`sleep/${date}`));
  return snap.exists() ? snap.data() : null;
}

export async function saveSleep(date, data) {
  await setDoc(userDoc(`sleep/${date}`), { ...data, date, savedAt: Timestamp.now() });
}

export async function getRecentSleep(count = 7) {
  const q = query(userCollection('sleep'), orderBy('date', 'desc'), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

export async function getAllSleep() {
  const q = query(userCollection('sleep'), orderBy('date', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

// === Intakes (médicaments / compléments) ===
export async function getIntakes(date) {
  const snap = await getDoc(userDoc(`intakes/${date}`));
  return snap.exists() ? snap.data() : null;
}

export async function saveIntakes(date, entries) {
  await setDoc(userDoc(`intakes/${date}`), { entries, date, savedAt: Timestamp.now() });
}

export async function getAllIntakes() {
  const q = query(userCollection('intakes'), orderBy('date', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

// Suppression du champ legacy `meds` sur un doc sleep
export async function deleteSleepMedsField(date) {
  await updateDoc(userDoc(`sleep/${date}`), { meds: deleteField() });
}

// === Weekly ===
export async function getWeekly(weekId) {
  const snap = await getDoc(userDoc(`weeklies/${weekId}`));
  return snap.exists() ? snap.data() : null;
}

export async function saveWeekly(weekId, data) {
  await setDoc(userDoc(`weeklies/${weekId}`), { ...data, savedAt: Timestamp.now() });
}

export async function getAllWeeklies() {
  const q = query(userCollection('weeklies'), orderBy('week', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

export async function getLastWeeklies(count = 2) {
  const q = query(userCollection('weeklies'), orderBy('week', 'desc'), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data()).reverse();
}

// === Coach Settings ===
export async function saveCoachWindow(days) {
  await setDoc(userDoc('settings/coachWindow'), { days, savedAt: Timestamp.now() });
}

export async function getCoachWindow() {
  const snap = await getDoc(userDoc('settings/coachWindow'));
  return snap.exists() ? snap.data().days : 7;
}

// === Coach IA ===
export async function saveApiKey(key) {
  await setDoc(userDoc('settings/apiKey'), { key, savedAt: Timestamp.now() });
  // Store readable flag in profile (key itself stays write-only)
  await setDoc(doc(db, 'users', getUid()), { hasApiKey: true }, { merge: true });
}

export async function getApiKey() {
  const snap = await getDoc(userDoc('settings/apiKey'));
  return snap.exists() ? snap.data().key : null;
}

export async function getCoachNotes() {
  const snap = await getDoc(userDoc('coachContext/notes'));
  return snap.exists() ? snap.data() : null;
}

export async function saveCoachNotes(text) {
  await setDoc(userDoc('coachContext/notes'), { persistentNotes: text, updatedAt: Timestamp.now() });
}

export async function getCoachHistory() {
  const snap = await getDoc(userDoc('coachContext/history'));
  return snap.exists() ? snap.data().entries || [] : [];
}

// === Coach Notes (historisées) ===
export async function saveCoachNote(date, text) {
  await addDoc(userCollection('coachNotes'), { text, date, savedAt: Timestamp.now() });
}

export async function deleteCoachNote(noteId) {
  await deleteDoc(userDoc(`coachNotes/${noteId}`));
}

export async function getAllCoachNotes() {
  const q = query(userCollection('coachNotes'), orderBy('savedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// === Library — Exercises ===
export async function getExercises() {
  const q = query(userCollection('exercises'), orderBy('name', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getExercise(id) {
  const snap = await getDoc(userDoc(`exercises/${id}`));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function saveExercise(data) {
  if (data.id) {
    const { id, ...rest } = data;
    await setDoc(userDoc(`exercises/${id}`), { ...rest, updatedAt: Timestamp.now() }, { merge: true });
    return id;
  }
  const ref = await addDoc(userCollection('exercises'), { ...data, createdAt: Timestamp.now() });
  return ref.id;
}

export async function deleteExercise(id) {
  await deleteDoc(userDoc(`exercises/${id}`));
}

// === Library — Workout Templates ===
export async function getWorkoutTemplates() {
  const q = query(userCollection('workoutTemplates'), orderBy('name', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getWorkoutTemplate(id) {
  const snap = await getDoc(userDoc(`workoutTemplates/${id}`));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function saveWorkoutTemplate(data) {
  if (data.id) {
    const { id, ...rest } = data;
    await setDoc(userDoc(`workoutTemplates/${id}`), { ...rest, updatedAt: Timestamp.now() }, { merge: true });
    return id;
  }
  const ref = await addDoc(userCollection('workoutTemplates'), { ...data, createdAt: Timestamp.now() });
  return ref.id;
}

export async function deleteWorkoutTemplate(id) {
  await deleteDoc(userDoc(`workoutTemplates/${id}`));
}

// === Strava ===
export async function getStravaCredentials() {
  const snap = await getDoc(userDoc('settings/stravaCredentials'));
  return snap.exists() ? snap.data() : null;
}

export async function saveStravaCredentials(data) {
  await setDoc(userDoc('settings/stravaCredentials'), { ...data, updatedAt: Timestamp.now() });
}

export async function getStravaTokens() {
  const snap = await getDoc(userDoc('settings/strava'));
  return snap.exists() ? snap.data() : null;
}

export async function clearStravaTokens() {
  await deleteDoc(userDoc('settings/strava'));
}

// === Nutrition ===
export async function getNutrition(date) {
  const snap = await getDoc(userDoc(`nutrition/${date}`));
  return snap.exists() ? snap.data() : null;
}

export async function saveNutrition(date, data) {
  await setDoc(userDoc(`nutrition/${date}`), { ...data, date, savedAt: Timestamp.now() });
}

export async function getNutritionGoals() {
  const snap = await getDoc(userDoc('settings/nutritionGoals'));
  return snap.exists() ? snap.data() : null;
}

export async function saveNutritionGoals(goals) {
  await setDoc(userDoc('settings/nutritionGoals'), { ...goals, savedAt: Timestamp.now() });
}

export async function getRecentNutritionFoods(count = 8) {
  const q = query(userCollection('nutritionFoods'), orderBy('lastUsed', 'desc'), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveNutritionFood(data) {
  // Upsert by name (case-insensitive match)
  const q = query(userCollection('nutritionFoods'), orderBy('lastUsed', 'desc'), limit(50));
  const snap = await getDocs(q);
  const existing = snap.docs.find(d => d.data().name?.toLowerCase() === data.name?.toLowerCase());
  if (existing) {
    await updateDoc(userDoc(`nutritionFoods/${existing.id}`), {
      ...data,
      useCount: (existing.data().useCount || 0) + 1,
      lastUsed: Timestamp.now(),
    });
  } else {
    await addDoc(userCollection('nutritionFoods'), {
      ...data,
      useCount: 1,
      lastUsed: Timestamp.now(),
    });
  }
}

// === Health Documents ===
export async function uploadHealthFile(file) {
  const uid = getUid();
  const fileName = `${Date.now()}_${file.name}`;
  const storageRef = ref(storage, `users/${uid}/healthDocs/${fileName}`);
  await uploadBytes(storageRef, file);
  return { path: `users/${uid}/healthDocs/${fileName}`, url: await getDownloadURL(storageRef) };
}

export async function deleteHealthFile(storagePath) {
  if (!storagePath) return;
  const storageRef = ref(storage, storagePath);
  await deleteObject(storageRef).catch(() => {});
}

export async function saveHealthDoc(data) {
  return await addDoc(userCollection('healthDocs'), { ...data, savedAt: Timestamp.now() });
}

export async function updateHealthDoc(docId, data) {
  await updateDoc(userDoc(`healthDocs/${docId}`), data);
}

export async function deleteHealthDoc(docId) {
  await deleteDoc(userDoc(`healthDocs/${docId}`));
}

export async function getAllHealthDocs() {
  const q = query(userCollection('healthDocs'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
