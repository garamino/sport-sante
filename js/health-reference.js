// Table de référence des biomarqueurs (normes adultes indicatives).
// Sert à : normaliser un libellé extrait → clé canonique, et classer bas/normal/élevé.
// Les normes sont indicatives (varient selon labo/âge/sexe) et ne constituent pas un avis médical.

// key: { label, unit, min, max, category, decimals }
// min/max null = borne non définie (ex: "<190" → max:190, min:null).
export const BIOMARKERS = {
  // --- Hématologie ---
  hemoglobine:      { label: 'Hémoglobine',       unit: 'g/dL',     min: 13.0, max: 18.0, category: 'Hématologie', decimals: 1 },
  globules_rouges:  { label: 'Globules rouges',   unit: 'x10⁶/µL',  min: 4.4,  max: 5.9,  category: 'Hématologie', decimals: 2 },
  hematocrite:      { label: 'Hématocrite',       unit: '%',        min: 40.0, max: 53.0, category: 'Hématologie', decimals: 1 },
  plaquettes:       { label: 'Plaquettes',        unit: 'x10³/µL',  min: 150,  max: 440,  category: 'Hématologie', decimals: 0 },
  globules_blancs:  { label: 'Globules blancs',   unit: 'x10³/µL',  min: 3.5,  max: 11.0, category: 'Hématologie', decimals: 1 },
  eosinophiles:     { label: 'Éosinophiles',      unit: '%',        min: null, max: 5,    category: 'Formule leucocytaire', decimals: 1 },
  basophiles:       { label: 'Basophiles',        unit: '%',        min: 0,    max: 1,    category: 'Formule leucocytaire', decimals: 1 },
  neutrophiles:     { label: 'Neutrophiles',      unit: '%',        min: 40,   max: 75,   category: 'Formule leucocytaire', decimals: 1 },
  lymphocytes:      { label: 'Lymphocytes',       unit: '%',        min: 20,   max: 45,   category: 'Formule leucocytaire', decimals: 1 },
  monocytes:        { label: 'Monocytes',         unit: '%',        min: 2,    max: 10,   category: 'Formule leucocytaire', decimals: 1 },

  // --- Fonction rénale ---
  creatinine:       { label: 'Créatinine',        unit: 'mg/dL',    min: 0.70, max: 1.20, category: 'Fonction rénale', decimals: 2 },
  dfg:              { label: 'DFG',               unit: 'mL/min/1.73m²', min: 60, max: null, category: 'Fonction rénale', decimals: 0 },
  uree:             { label: 'Urée',              unit: 'g/L',      min: 0.15, max: 0.45, category: 'Fonction rénale', decimals: 2 },
  acide_urique:     { label: 'Acide urique',      unit: 'mg/dL',    min: 3.5,  max: 7.2,  category: 'Fonction rénale', decimals: 1 },

  // --- Fonction hépatique ---
  ast:              { label: 'AST (ASAT/SGOT)',   unit: 'UI/L',     min: 10,   max: 50,   category: 'Fonction hépatique', decimals: 0 },
  alt:              { label: 'ALT (ALAT/SGPT)',   unit: 'UI/L',     min: 10,   max: 50,   category: 'Fonction hépatique', decimals: 0 },
  ggt:              { label: 'GGT',               unit: 'UI/L',     min: 10,   max: 71,   category: 'Fonction hépatique', decimals: 0 },
  pal:              { label: 'Phosphatases alcalines', unit: 'UI/L', min: 40,  max: 130,  category: 'Fonction hépatique', decimals: 0 },
  bilirubine:       { label: 'Bilirubine totale', unit: 'mg/dL',    min: null, max: 1.2,  category: 'Fonction hépatique', decimals: 2 },

  // --- Profil lipidique ---
  cholesterol_total:{ label: 'Cholestérol total', unit: 'mg/dL',    min: null, max: 190,  category: 'Profil lipidique', decimals: 0 },
  ldl:              { label: 'LDL-cholestérol',   unit: 'mg/dL',    min: null, max: 100,  category: 'Profil lipidique', decimals: 0 },
  hdl:              { label: 'HDL-cholestérol',   unit: 'mg/dL',    min: 40,   max: null, category: 'Profil lipidique', decimals: 0 },
  triglycerides:    { label: 'Triglycérides',     unit: 'mg/dL',    min: null, max: 175,  category: 'Profil lipidique', decimals: 0 },

  // --- Glycémie ---
  glycemie:         { label: 'Glycémie à jeun',   unit: 'g/L',      min: 0.70, max: 1.00, category: 'Glycémie', decimals: 2 },
  hba1c:            { label: 'HbA1c',             unit: '%',        min: null, max: 5.7,  category: 'Glycémie', decimals: 1 },

  // --- Vitamines & minéraux ---
  vitamine_d:       { label: 'Vitamine D (25OH)', unit: 'ng/mL',    min: 30,   max: 100,  category: 'Vitamines & minéraux', decimals: 1 },
  vitamine_b12:     { label: 'Vitamine B12',      unit: 'pg/mL',    min: 200,  max: 900,  category: 'Vitamines & minéraux', decimals: 0 },
  folate:           { label: 'Folate (B9)',       unit: 'ng/mL',    min: 3,    max: 17,   category: 'Vitamines & minéraux', decimals: 1 },
  ferritine:        { label: 'Ferritine',         unit: 'ng/mL',    min: 30,   max: 400,  category: 'Vitamines & minéraux', decimals: 0 },
  fer:              { label: 'Fer sérique',       unit: 'µg/dL',    min: 65,   max: 175,  category: 'Vitamines & minéraux', decimals: 0 },
  magnesium:        { label: 'Magnésium',         unit: 'mg/dL',    min: 1.7,  max: 2.2,  category: 'Vitamines & minéraux', decimals: 1 },
  calcium:          { label: 'Calcium',           unit: 'mg/dL',    min: 8.6,  max: 10.2, category: 'Vitamines & minéraux', decimals: 1 },

  // --- Hormones ---
  tsh:              { label: 'TSH',               unit: 'mUI/L',    min: 0.4,  max: 4.0,  category: 'Hormones', decimals: 2 },
  testosterone:     { label: 'Testostérone totale', unit: 'ng/dL',  min: 264,  max: 916,  category: 'Hormones', decimals: 0 },

  // --- Inflammation ---
  crp:              { label: 'CRP',               unit: 'mg/L',     min: null, max: 5,    category: 'Inflammation', decimals: 1 },
};

// Alias : chaîne normalisée (sans accents/espaces, minuscule) → clé canonique.
const ALIASES = {
  hemoglobine: 'hemoglobine', hb: 'hemoglobine',
  globulesrouges: 'globules_rouges', hematies: 'globules_rouges', gr: 'globules_rouges',
  hematocrite: 'hematocrite', ht: 'hematocrite', hct: 'hematocrite',
  plaquettes: 'plaquettes', thrombocytes: 'plaquettes', plt: 'plaquettes',
  globulesblancs: 'globules_blancs', leucocytes: 'globules_blancs', gb: 'globules_blancs',
  eosinophiles: 'eosinophiles', basophiles: 'basophiles',
  neutrophiles: 'neutrophiles', lymphocytes: 'lymphocytes', monocytes: 'monocytes',
  creatinine: 'creatinine', dfg: 'dfg', egfr: 'dfg', debitdefiltrationglomerulaire: 'dfg',
  uree: 'uree', acideurique: 'acide_urique',
  ast: 'ast', asat: 'ast', sgot: 'ast', alt: 'alt', alat: 'alt', sgpt: 'alt',
  ggt: 'ggt', gammagt: 'ggt', pal: 'pal', phosphatasesalcalines: 'pal', bilirubine: 'bilirubine',
  cholesteroltotal: 'cholesterol_total', cholesterol: 'cholesterol_total',
  ldl: 'ldl', ldlcholesterol: 'ldl', hdl: 'hdl', hdlcholesterol: 'hdl', triglycerides: 'triglycerides',
  glycemie: 'glycemie', glucose: 'glycemie', hba1c: 'hba1c', hemoglobineglyquee: 'hba1c',
  vitamined: 'vitamine_d', vitd: 'vitamine_d', '25ohvitamined': 'vitamine_d', vitamined25oh: 'vitamine_d',
  vitamineb12: 'vitamine_b12', b12: 'vitamine_b12', folate: 'folate', b9: 'folate',
  ferritine: 'ferritine', fer: 'fer', ferserique: 'fer',
  magnesium: 'magnesium', calcium: 'calcium',
  tsh: 'tsh', testosterone: 'testosterone', testosteronetotale: 'testosterone',
  crp: 'crp', proteinecreactive: 'crp',
};

// Normalise une chaîne : minuscule, sans accents, sans caractères non alphanumériques.
function slug(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Mappe un libellé libre vers une clé canonique connue, sinon null.
export function normalizeBiomarkerKey(labelOrKey) {
  const s = slug(labelOrKey);
  if (!s) return null;
  if (BIOMARKERS[s]) return s;          // déjà une clé canonique
  if (ALIASES[s]) return ALIASES[s];
  return null;
}

export function getReference(key) {
  return BIOMARKERS[key] || null;
}

// Retourne 'low' | 'normal' | 'high' | 'unknown' pour une valeur donnée.
export function classifyValue(value, ref) {
  if (ref == null || value == null || isNaN(value)) return 'unknown';
  if (ref.min != null && value < ref.min) return 'low';
  if (ref.max != null && value > ref.max) return 'high';
  return 'normal';
}

export const STATUS_COLORS = {
  low:     '#ffa726',
  normal:  '#66bb6a',
  high:    '#ef5350',
  unknown: '#8892a0',
};

export const STATUS_LABELS = {
  low: 'Bas', normal: 'Normal', high: 'Élevé', unknown: '—',
};

// Formate la norme pour affichage : "13.0–18.0", "<190", ">40".
export function formatRange(ref) {
  if (!ref) return '';
  if (ref.min != null && ref.max != null) return `${ref.min}–${ref.max}`;
  if (ref.max != null) return `<${ref.max}`;
  if (ref.min != null) return `>${ref.min}`;
  return '';
}
