// Parsing des médicaments mentionnés dans les notes de sommeil
// Doses autorisées par médicament :
//   - metasleep : '1/2' ou '1'
//   - trazodone : '1/4' ou '1/2'
//   - stilnoct  : '1/2'

const DRUGS = {
  metasleep: { re: /m[eé]tasleep/i, allowed: ['1/2', '1'] },
  // accepte trazodone, tradozone, trazo
  trazodone: { re: /tra[zd]o(?:done|zone)?/i, allowed: ['1/4', '1/2'] },
  stilnoct:  { re: /stilnoct/i, allowed: ['1/2'] },
};

const DOSE_TOKEN = '(1\\/2|1\\/4|1)';

export function parseMeds(note) {
  const out = { metasleep: '', trazodone: '', stilnoct: '' };
  if (!note) return out;
  for (const [key, { re, allowed }] of Object.entries(DRUGS)) {
    const before = new RegExp(`${DOSE_TOKEN}\\s*${re.source}`, 'i');
    const after  = new RegExp(`${re.source}\\s*${DOSE_TOKEN}`, 'i');
    const m = note.match(before) || note.match(after);
    if (m && allowed.includes(m[1])) out[key] = m[1];
  }
  return out;
}

export function stripMedsFromNote(note) {
  if (!note) return '';
  let cleaned = note;
  for (const { re } of Object.values(DRUGS)) {
    const before = new RegExp(`${DOSE_TOKEN}\\s*${re.source}`, 'gi');
    const after  = new RegExp(`${re.source}\\s*${DOSE_TOKEN}`, 'gi');
    cleaned = cleaned.replace(before, '').replace(after, '');
  }
  // nettoyage des séparateurs orphelins (+ , ;) et espaces multiples
  return cleaned
    .replace(/\s*\+\s*/g, ' ')
    .replace(/^\s*[,;+]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Renvoie la valeur structurée si présente, sinon la valeur parsée depuis la note
export function resolveMeds(sleepDoc) {
  if (sleepDoc?.meds && typeof sleepDoc.meds === 'object') {
    return {
      metasleep: sleepDoc.meds.metasleep || '',
      trazodone: sleepDoc.meds.trazodone || '',
      stilnoct:  sleepDoc.meds.stilnoct  || '',
    };
  }
  return parseMeds(sleepDoc?.note || '');
}
