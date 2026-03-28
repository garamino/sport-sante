import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  orderBy,
  limit,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { app } from './auth.js';
import { getUid } from './auth.js';

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

// === Coach IA ===
export async function saveApiKey(key) {
  await setDoc(userDoc('settings/apiKey'), { key, savedAt: Timestamp.now() });
  // Store readable flag in profile (key itself stays write-only)
  await setDoc(doc(db, 'users', getUid()), { hasApiKey: true }, { merge: true });
}

export async function getCoachNotes() {
  const snap = await getDoc(userDoc('coachContext/notes'));
  return snap.exists() ? snap.data() : null;
}

export async function saveCoachNotes(text) {
  await setDoc(userDoc('coachContext/notes'), { persistentNotes: text, updatedAt: Timestamp.now() });
}
