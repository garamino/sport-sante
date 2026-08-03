// Date helpers
function pad(n) { return String(n).padStart(2, '0'); }
function toLocalDateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

// Coupure nuit/jour : avant 06:00 = encore la nuit précédente.
// Modifier ici pour changer le comportement partout (sleep view + graphiques).
export const NIGHT_CUTOFF = '06:00';

export function today() {
  return toLocalDateStr(new Date());
}

export function formatDateFR(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function getDayOfWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  return day === 0 ? 7 : day; // 1=Mon...7=Sun
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00'); // noon to avoid DST/timezone shifts
  d.setDate(d.getDate() + n);
  return toLocalDateStr(d);
}

// Week/phase calculation from program start date
export function getWeekNumber(startDate, currentDate) {
  const start = new Date(startDate + 'T00:00:00');
  const current = new Date(currentDate + 'T00:00:00');
  const diffDays = Math.floor((current - start) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 0;
  return Math.min(Math.floor(diffDays / 7) + 1, 14);
}

export function getPhase(weekNumber) {
  if (weekNumber <= 4) return 'Fondations';
  if (weekNumber <= 10) return 'Hypertrophie';
  if (weekNumber <= 13) return 'Surcompensation';
  return 'Décharge';
}

// Toast notification
export function showToast(message, duration = 2000) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// === Niveaux d'exercice ===
// Un niveau : { level:<int>, sets:<int>, reps:<int>, rest:<int secondes>, weight:<int kg> }

// Extrait le premier nombre trouvé dans une valeur ; renvoie `def` si aucun.
export function parseFirstNumber(v, def = 0) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : def;
  const m = String(v ?? '').match(/-?\d+(?:[.,]\d+)?/);
  return m ? Math.round(parseFloat(m[0].replace(',', '.'))) : def;
}

// Construit un niveau 1 à partir des anciens champs d'un exercice (numérique strict).
export function buildLevelFromLegacy(ex) {
  return {
    level: 1,
    sets: parseFirstNumber(ex?.defaultSets, 1) || 1,
    reps: parseFirstNumber(ex?.defaultReps, 0),
    rest: parseFirstNumber(ex?.defaultRest, 0),
    weight: parseFirstNumber(ex?.weight, 0),
  };
}

// Renvoie le niveau par défaut d'un exercice (repli : 1er niveau, puis champs legacy).
export function getDefaultLevel(ex) {
  const levels = Array.isArray(ex?.levels) ? ex.levels : [];
  if (levels.length) {
    return levels.find(l => l.level === ex.defaultLevel) || levels[0];
  }
  return buildLevelFromLegacy(ex || {});
}

export function formatSetsReps(level) {
  if (!level) return '';
  return `${level.sets} × ${level.reps}`;
}
export function formatRest(level) {
  if (!level || !level.rest) return '—';
  return `${level.rest}s`;
}
export function formatWeight(level) {
  if (!level || !level.weight) return '';
  return `${level.weight} kg`;
}

// Compute hours slept from bedtime & wake time — returns { decimal, hhmm }
export function computeHoursSlept(bedtime, wakeTime) {
  if (!bedtime || !wakeTime) return { decimal: 0, hhmm: '' };
  const [bH, bM] = bedtime.split(':').map(Number);
  const [wH, wM] = wakeTime.split(':').map(Number);
  let bedMin = bH * 60 + bM;
  let wakeMin = wH * 60 + wM;
  if (wakeMin <= bedMin) wakeMin += 24 * 60;
  const totalMin = wakeMin - bedMin;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return {
    decimal: Math.round(totalMin / 60 * 10) / 10,
    hhmm: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
  };
}
