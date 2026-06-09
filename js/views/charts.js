import { getAllWeeklies, getAllSleep, getAllWorkouts, getAllIntakes, getAllNutrition, getNutritionGoals } from '../db.js';
import { NIGHT_CUTOFF } from '../utils.js';

const SLEEP_PRODUCTS = [
  'Metasleep',
  'Metarelax',
  'Trazodone 100mg',
  'Stilnoct 10mg',
  'Ashwagandha 300mg',
  'L-Théanine 200mg',
  'D-Pearls 38 microgr',
  'Forténight',
];

const PRODUCT_COLORS = {
  'Metasleep':            '#4fc3f7',
  'Metarelax':            '#ab47bc',
  'Trazodone 100mg':      '#ef5350',
  'Stilnoct 10mg':        '#ffa726',
  'Ashwagandha 300mg':    '#66bb6a',
  'L-Théanine 200mg':     '#26a69a',
  'D-Pearls 38 microgr':  '#ffee58',
  'Forténight':           '#1e88e5',
};

// === Vue composants : compositions et couleurs ===

// Quantités pour 1 unité de dose, en mg (µg convertis : 1 µg = 0.001 mg)
const PRODUCT_COMPOSITIONS = {
  'Metasleep': {
    'Valériane':    150,   'L-Théanine':   100,   'Mélisse':       50,
    'Passiflore':    50,   'Mélatonine':     0.295,'Magnésium':     60,
    'Vit. B6':        1,   'Folate':         0.1,  'Vit. B12':       0.025,
  },
  'Metarelax': {
    'Magnésium':    200,   'Vit. B6':        2,    'Folate':         0.2,
    'Vit. B12':     0.025, 'Vit. D':         0.025,'Taurine':      300,
  },
  'Forténight': {
    'Mélatonine':   0.295, 'GABA':          100,   'Passiflore':   100,
    'Valériane':   100,    'Pavot de Calif.': 50,  'Vit. B3':       16,
    'Vit. B6':      1.4,
  },
  'Ashwagandha 300mg':   { 'Ashwagandha':   300 },
  'L-Théanine 200mg':    { 'L-Théanine':    200 },
  'Trazodone 100mg':     { 'Trazodone HCl': 100 },
  'Stilnoct 10mg':       { 'Zolpidem':       10 },
  'D-Pearls 38 microgr': { 'Vit. D':         0.038 },
};

// Ordre d'affichage des ingrédients dans la vue composants
const INGREDIENTS = [
  'Valériane', 'L-Théanine', 'Mélisse', 'Passiflore', 'Mélatonine',
  'Magnésium', 'Vit. B6', 'Folate', 'Vit. B12', 'Taurine',
  'Vit. D', 'GABA', 'Pavot de Calif.', 'Vit. B3',
  'Ashwagandha', 'Trazodone HCl', 'Zolpidem',
];

// Ingrédients à afficher en µg dans les tooltips (valeur < 1 mg par dose)
const UG_INGREDIENTS = new Set(['Mélatonine', 'Folate', 'Vit. B12', 'Vit. D']);

const INGREDIENT_COLORS = {
  'Valériane':         '#8bc34a', 'L-Théanine':        '#4fc3f7',
  'Mélisse':           '#aed581', 'Passiflore':        '#ce93d8',
  'Mélatonine':        '#f48fb1', 'Magnésium':         '#80cbc4',
  'Vit. B6':           '#ffb74d', 'Folate':            '#fff176',
  'Vit. B12':          '#e0e0e0', 'Taurine':           '#ff8a65',
  'Vit. D':            '#ffe082', 'GABA':              '#80deea',
  'Pavot de Calif.':   '#ef9a9a', 'Vit. B3':           '#bcaaa4',
  'Ashwagandha':       '#a5d6a7', 'Trazodone HCl':     '#ff7043',
  'Zolpidem':          '#b0bec5',
};

function fmtIngredientAmt(ingredient, mg) {
  if (UG_INGREDIENTS.has(ingredient)) {
    const ug = mg * 1000;
    return `${+ug.toFixed(ug < 10 ? 2 : 0)} µg`;
  }
  return `${+mg.toFixed(mg < 10 ? 2 : 1)} mg`;
}

const MOON_PHASES = [
  { icon: '🌑', label: 'Nouvelle lune' },
  { icon: '🌒', label: 'Croissant ↑' },
  { icon: '🌓', label: 'Premier quartier' },
  { icon: '🌔', label: 'Gibbeuse ↑' },
  { icon: '🌕', label: 'Pleine lune' },
  { icon: '🌖', label: 'Gibbeuse ↓' },
  { icon: '🌗', label: 'Dernier quartier' },
  { icon: '🌘', label: 'Décroissant ↓' },
];

// Algorithme astronomique simplifié — précision ±1 jour, suffisant pour détecter des tendances.
// Référence : nouvelle lune du 6 janvier 2000. Période synodique : 29.530588853 j.
function getMoonPhase(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const ref = new Date(2000, 0, 6);
  const dt  = new Date(y, m - 1, d);
  const daysSince = (dt - ref) / 86400000;
  const cycle = 29.530588853;
  const pos = ((daysSince % cycle) + cycle) % cycle;
  let idx;
  if (pos < 1.85)       idx = 0;
  else if (pos < 7.38)  idx = 1;
  else if (pos < 11.07) idx = 2;
  else if (pos < 14.77) idx = 3;
  else if (pos < 16.62) idx = 4;
  else if (pos < 22.15) idx = 5;
  else if (pos < 25.84) idx = 6;
  else                  idx = 7;
  return { ...MOON_PHASES[idx], phaseIdx: idx };
}

function qtyToNumber(q) {
  if (q === '1/2') return 0.5;
  if (q === '1/4') return 0.25;
  const n = parseFloat(q);
  return isNaN(n) ? 0 : n;
}

function shiftDateStr(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// Prise du jour D à heure H :
//   - H < NIGHT_CUTOFF → appartient à la nuit D-1→D, stockée comme jour D  (= intakeDate)
//   - H ≥ NIGHT_CUTOFF ou heure inconnue → appartient à la nuit D→D+1, stockée comme D+1
// NIGHT_CUTOFF importé depuis utils.js — modifier là-bas pour changer partout.
function effectiveNight(intakeDate, time) {
  if (time && time < NIGHT_CUTOFF) return intakeDate;
  return shiftDateStr(intakeDate, 1);
}

let currentSleepPeriod = '3m';
let currentSleepProduct = 'all';
let currentSleepQualityPeriod = '3m';
let currentMedsView = 'products'; // 'products' | 'ingredients'
let currentIngredientPeriod = '3m';
let currentIngredient = 'all';
let currentNutritionPeriod = '1m';
let currentNutritionMetric = 'kcal'; // 'kcal' | 'prot' | 'carbs' | 'fats'
let nutChartInstance = null;

let chartInstance = null;
let perfChartInstance = null;
let medsChartInstance = null;

export async function render(container) {
  container.innerHTML = `
    <div class="section-title">Statistiques</div>
    <div class="chart-tabs">
      <button class="chart-tab" data-chart="weight">Poids</button>
      <button class="chart-tab active" data-chart="sleep">Sommeil</button>
      <button class="chart-tab" data-chart="bike">Vélo</button>
      <button class="chart-tab" data-chart="nutrition">Nutrition</button>
    </div>
    <div id="chart-area"></div>
  `;

  // Load Chart.js from CDN
  if (!window.Chart) {
    await loadScript('https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js');
  }

  const tabs = container.querySelectorAll('.chart-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderChart(tab.dataset.chart);
    });
  });

  await renderChart('sleep');
}

async function renderChart(type) {
  const area = document.getElementById('chart-area');
  if (!area) return;

  // Destroy previous charts
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  if (perfChartInstance) { perfChartInstance.destroy(); perfChartInstance = null; }
  if (medsChartInstance) { medsChartInstance.destroy(); medsChartInstance = null; }
  if (nutChartInstance) { nutChartInstance.destroy(); nutChartInstance = null; }

  const chartColors = {
    accent: '#4fc3f7',
    success: '#66bb6a',
    danger: '#ef5350',
    warning: '#ffa726',
    grid: '#2a3a4e',
    text: '#8892a0',
    perfGreen: '#1D9E75',
    perfRed: '#E24B4A',
  };

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        ticks: { color: chartColors.text, font: { size: 11 } },
        grid: { color: chartColors.grid },
      },
      y: {
        ticks: { color: chartColors.text, font: { size: 11 } },
        grid: { color: chartColors.grid },
      },
    },
  };

  try {
    if (type === 'weight') {
      area.innerHTML = `
        <div class="period-buttons" id="weight-period-buttons"></div>
        <div class="chart-container"><canvas id="main-chart"></canvas></div>
        <div id="chart-empty" class="empty-state hidden">
          <p>Pas encore de données</p>
          <p style="font-size:13px;color:var(--text-secondary)">Commence à logger tes séances !</p>
        </div>
      `;
      const canvas = document.getElementById('main-chart');
      const emptyEl = document.getElementById('chart-empty');

      const allWorkouts = await getAllWorkouts();
      const allWeightData = allWorkouts.filter(w => w.weight != null && w.weight > 0);

      let currentWeightPeriod = '3m';

      function applyWeightPeriod() {
        if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

        document.querySelectorAll('#weight-period-buttons .period-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.period === currentWeightPeriod);
        });

        const data = filterByPeriod(allWeightData.map(w => ({ ...w, date: w.date })), currentWeightPeriod);

        if (data.length === 0) {
          canvas.parentElement.classList.add('hidden');
          emptyEl.classList.remove('hidden');
          return;
        }
        canvas.parentElement.classList.remove('hidden');
        emptyEl.classList.add('hidden');

        const hasBodyFat = data.some(w => w.bodyFat != null);

        chartInstance = new Chart(canvas.getContext('2d'), {
          type: 'line',
          data: {
            labels: data.map(w => {
              const d = new Date(w.date + 'T00:00:00');
              return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
            }),
            datasets: [
              {
                label: 'Poids (kg)',
                data: data.map(w => w.weight),
                borderColor: chartColors.accent,
                backgroundColor: chartColors.accent + '33',
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: chartColors.accent,
                yAxisID: 'y',
              },
              ...(hasBodyFat ? [{
                label: 'Masse grasse (%)',
                data: data.map(w => w.bodyFat ?? null),
                borderColor: chartColors.warning,
                backgroundColor: 'transparent',
                borderDash: [4, 4],
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: chartColors.warning,
                yAxisID: 'y1',
                spanGaps: true,
              }] : []),
            ],
          },
          options: {
            ...baseOptions,
            scales: {
              x: baseOptions.scales.x,
              y: { ...baseOptions.scales.y, position: 'left', suggestedMin: 55, suggestedMax: 70, title: { display: true, text: 'kg', color: chartColors.text } },
              ...(hasBodyFat ? {
                y1: {
                  position: 'right',
                  ticks: { color: chartColors.text, font: { size: 11 } },
                  grid: { drawOnChartArea: false },
                  suggestedMin: 10, suggestedMax: 30,
                  title: { display: true, text: '%', color: chartColors.text },
                },
              } : {}),
            },
            plugins: {
              legend: { display: hasBodyFat, labels: { color: chartColors.text } },
              tooltip: {
                callbacks: {
                  title: (items) => {
                    const w = data[items[0]?.dataIndex];
                    if (!w) return '';
                    const d = new Date(w.date + 'T00:00:00');
                    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' });
                  },
                },
              },
            },
          },
        });
      }

      const pb = document.getElementById('weight-period-buttons');
      pb.innerHTML = ['1m', '3m', '6m', 'all'].map(p =>
        `<button class="period-btn ${p === currentWeightPeriod ? 'active' : ''}" data-period="${p}">${PERIOD_LABELS[p]}</button>`
      ).join('');
      pb.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          currentWeightPeriod = btn.dataset.period;
          applyWeightPeriod();
        });
      });

      applyWeightPeriod();

    } else if (type === 'sleep') {
      area.innerHTML = `
        <div class="period-buttons" id="sleep-quality-period-buttons"></div>
        <div class="chart-container"><canvas id="main-chart"></canvas></div>
        <div id="moon-icons-row" class="moon-icons-row"></div>
        <div id="chart-empty" class="empty-state hidden">
          <p>Pas encore de données</p>
          <p style="font-size:13px;color:var(--text-secondary)">Commence à logger tes séances !</p>
        </div>
        <div id="sleep-meds-section" style="margin-top:24px"></div>
        <div id="moon-section" style="margin-top:24px"></div>
      `;
      const canvas = document.getElementById('main-chart');
      const emptyEl = document.getElementById('chart-empty');

      const [sleepData, intakesData] = await Promise.all([
        getAllSleep(),
        getAllIntakes().catch(() => []),
      ]);
      const allQualityData = sleepData.filter(s => s.quality);

      function applySleepQualityPeriod() {
        if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

        const data = filterSleepByPeriod(allQualityData, currentSleepQualityPeriod);

        document.querySelectorAll('#sleep-quality-period-buttons .period-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.period === currentSleepQualityPeriod);
        });

        if (data.length === 0) {
          canvas.parentElement.classList.add('hidden');
          emptyEl.classList.remove('hidden');
          renderMoonIconsRow([]);
          renderMoonSection([]);
          return;
        }
        canvas.parentElement.classList.remove('hidden');
        emptyEl.classList.add('hidden');

        const colors = data.map(s =>
          s.quality >= 7 ? chartColors.success :
          s.quality >= 4 ? chartColors.warning :
          chartColors.danger
        );

        chartInstance = new Chart(canvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels: data.map(s => {
              const d = new Date(s.date + 'T00:00:00');
              return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
            }),
            datasets: [{
              label: 'Qualité',
              data: data.map(s => s.quality),
              backgroundColor: colors,
              borderRadius: 4,
            }],
          },
          options: {
            ...baseOptions,
            scales: {
              ...baseOptions.scales,
              y: { ...baseOptions.scales.y, min: 0, max: 10 },
            },
          },
        });

        renderMoonIconsRow(data);
        renderMoonSection(data);
      }

      // Boutons de période
      const pb = document.getElementById('sleep-quality-period-buttons');
      pb.innerHTML = ['3m', '6m', 'all'].map(p =>
        `<button class="period-btn ${p === currentSleepQualityPeriod ? 'active' : ''}" data-period="${p}">${p === 'all' ? 'Tout' : p === '3m' ? '3 mois' : '6 mois'}</button>`
      ).join('');
      pb.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          currentSleepQualityPeriod = btn.dataset.period;
          applySleepQualityPeriod();
        });
      });

      applySleepQualityPeriod();
      renderSleepMedsSection(sleepData, intakesData, chartColors, baseOptions);

    } else if (type === 'bike') {
      const workouts = await getAllWorkouts();
      const bikeData = workouts.filter(w => w.bikeData);

      if (bikeData.length === 0) {
        area.innerHTML = `
          <div class="empty-state">
            <p>Pas encore de données</p>
            <p style="font-size:13px;color:var(--text-secondary)">Commence à logger tes séances vélo !</p>
          </div>
        `;
        return;
      }

      // Sub-tabs for Intensité / Performance
      area.innerHTML = `
        <div class="chart-subtabs">
          <button class="chart-subtab active" data-sub="efficacite">Efficacité</button>
          <button class="chart-subtab" data-sub="intensite">Intensité</button>
          <button class="chart-subtab" data-sub="performance">Performance</button>
        </div>
        <div id="bike-chart-area"></div>
      `;

      const subTabs = area.querySelectorAll('.chart-subtab');
      subTabs.forEach(st => {
        st.addEventListener('click', () => {
          subTabs.forEach(s => s.classList.remove('active'));
          st.classList.add('active');
          renderBikeSubChart(st.dataset.sub, bikeData, chartColors, baseOptions);
        });
      });

      renderBikeSubChart('efficacite', bikeData, chartColors, baseOptions);
    } else if (type === 'nutrition') {
      const [allNut, goals] = await Promise.all([
        getAllNutrition(),
        getNutritionGoals().catch(() => null),
      ]);

      if (allNut.length === 0) {
        area.innerHTML = `
          <div class="empty-state">
            <p>Pas encore de données</p>
            <p style="font-size:13px;color:var(--text-secondary)">Commence à logger ta nutrition !</p>
          </div>`;
        return;
      }

      area.innerHTML = `
        <div class="chart-subtabs">
          <button class="chart-subtab ${currentNutritionMetric === 'kcal'  ? 'active' : ''}" data-metric="kcal">Calories</button>
          <button class="chart-subtab ${currentNutritionMetric === 'prot'  ? 'active' : ''}" data-metric="prot">Protéines</button>
          <button class="chart-subtab ${currentNutritionMetric === 'carbs' ? 'active' : ''}" data-metric="carbs">Glucides</button>
          <button class="chart-subtab ${currentNutritionMetric === 'fats'  ? 'active' : ''}" data-metric="fats">Lipides</button>
        </div>
        <div class="period-buttons" id="nut-period-buttons"></div>
        <div class="chart-container"><canvas id="nut-chart"></canvas></div>
        <div id="nut-summary" style="margin-top:16px"></div>
      `;

      area.querySelectorAll('.chart-subtab').forEach(st => {
        st.addEventListener('click', () => {
          currentNutritionMetric = st.dataset.metric;
          area.querySelectorAll('.chart-subtab').forEach(s => s.classList.remove('active'));
          st.classList.add('active');
          renderNutritionChart(allNut, goals, chartColors, baseOptions);
        });
      });

      const pb = document.getElementById('nut-period-buttons');
      pb.innerHTML = ['1m', '3m', 'all'].map(p =>
        `<button class="period-btn ${p === currentNutritionPeriod ? 'active' : ''}" data-period="${p}">${PERIOD_LABELS[p]}</button>`
      ).join('');
      pb.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          currentNutritionPeriod = btn.dataset.period;
          pb.querySelectorAll('.period-btn').forEach(b => b.classList.toggle('active', b.dataset.period === currentNutritionPeriod));
          renderNutritionChart(allNut, goals, chartColors, baseOptions);
        });
      });

      renderNutritionChart(allNut, goals, chartColors, baseOptions);
    }
  } catch (e) {
    console.error('Chart error:', e);
    area.innerHTML = `<div class="empty-state"><p>Erreur de chargement</p></div>`;
  }
}

let currentPeriod = '3m';

const PERIOD_LABELS = { '1m': '1 mois', '3m': '3 mois', '6m': '6 mois', 'all': 'Tout' };

function filterByPeriod(data, period) {
  if (period === 'all') return data;
  const months = { '1m': 1, '3m': 3, '6m': 6 }[period] ?? 3;
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return data.filter(w => w.date >= cutoffStr);
}

function renderPeriodButtons(container, bikeData, colors, baseOptions, sub) {
  const wrapper = document.createElement('div');
  wrapper.className = 'period-buttons';
  wrapper.innerHTML = ['1m', '3m', '6m', 'all'].map(p =>
    `<button class="period-btn ${p === currentPeriod ? 'active' : ''}" data-period="${p}">${PERIOD_LABELS[p]}</button>`
  ).join('');
  container.prepend(wrapper);

  wrapper.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPeriod = btn.dataset.period;
      renderBikeSubChart(sub, bikeData, colors, baseOptions);
    });
  });
}

function renderBikeSubChart(sub, bikeData, colors, baseOptions) {
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  if (perfChartInstance) { perfChartInstance.destroy(); perfChartInstance = null; }

  const container = document.getElementById('bike-chart-area');
  if (!container) return;

  const filtered = filterByPeriod(bikeData, currentPeriod);

  if (sub === 'intensite') {
    renderIntensiteChart(container, filtered, colors, baseOptions);
    renderPeriodButtons(container, bikeData, colors, baseOptions, sub);
  } else if (sub === 'performance') {
    renderPerformanceChart(container, filtered, colors);
    renderPeriodButtons(container, bikeData, colors, baseOptions, sub);
  } else {
    renderEfficaciteChart(container, filtered, colors, baseOptions);
    renderPeriodButtons(container, bikeData, colors, baseOptions, sub);
  }
}

function renderIntensiteChart(container, bikeData, colors, baseOptions) {
  container.innerHTML = `<div class="chart-container"><canvas id="intensite-chart"></canvas></div>`;
  const canvas = document.getElementById('intensite-chart');

  chartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: bikeData.map(w => {
        const d = new Date(w.date + 'T00:00:00');
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      }),
      datasets: [
        {
          label: 'FC moy (bpm)',
          data: bikeData.map(w => w.bikeData.fcAvg),
          borderColor: colors.danger,
          backgroundColor: colors.danger + '33',
          tension: 0.3,
          yAxisID: 'y',
        },
        {
          label: 'Watts moy',
          data: bikeData.map(w => w.bikeData.wattsAvg),
          borderColor: colors.accent,
          backgroundColor: colors.accent + '33',
          tension: 0.3,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      ...baseOptions,
      plugins: {
        legend: { display: true, labels: { color: colors.text } },
      },
      scales: {
        x: baseOptions.scales.x,
        y: {
          ...baseOptions.scales.y,
          position: 'left',
          title: { display: true, text: 'FC (bpm)', color: colors.text },
        },
        y1: {
          ...baseOptions.scales.y,
          position: 'right',
          title: { display: true, text: 'Watts', color: colors.text },
          grid: { drawOnChartArea: false },
        },
      },
    },
  });
}

function linearRegression(values) {
  const n = values.length;
  if (n < 2) return values.slice();
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return values.map((_, i) => parseFloat((intercept + slope * i).toFixed(2)));
}

function renderPerformanceChart(container, bikeData, colors) {
  // Filter sessions with all required data
  const validData = bikeData.filter(w => {
    const b = w.bikeData;
    return b.fcAvg && b.distanceKm && b.wattsAvg && b.fcAvg > 0;
  });

  if (validData.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Données insuffisantes</p>
        <p style="font-size:13px;color:var(--text-secondary)">Il faut au minimum Watts, FC et distance pour calculer l'indice.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div id="perf-metrics" class="perf-metrics"></div>
    <div class="chart-container">
      <canvas id="perf-chart"></canvas>
    </div>
    <div class="formula-box">
      <span class="formula-label">Formule</span>
      <code>indice = (W<sub>moy</sub> × (dist + D<sup>+</sup>÷40) ÷ FC<sub>moy</sub>) × cadence<sub>f</sub></code>
      <span class="formula-detail">cadence<sub>f</sub> = max(0.7, 1 − 0.015 × |RPM − 85|)</span>
    </div>
  `;

  const canvas = document.getElementById('perf-chart');

  function calcIndices() {
    return validData.map(w => {
      const b = w.bikeData;
      const dist = parseFloat(b.distanceKm) || 0;
      const dplus = parseFloat(b.elevationGain) || 0;
      const watts = parseFloat(b.wattsAvg) || 1;
      const fc = parseFloat(b.fcAvg) || 1;
      const rpm = parseFloat(b.rpm) || 85; // défaut 85 = neutre si pas de donnée
      const cadenceFactor = Math.max(0.7, 1 - 0.015 * Math.abs(rpm - 85));
      return (watts * (dist + dplus / 40) / fc) * cadenceFactor;
    });
  }

  function updateMetrics(indices, fcValues) {
    const metricsEl = document.getElementById('perf-metrics');
    if (!metricsEl) return;

    const first = indices[0];
    const last = indices[indices.length - 1];
    const delta = last - first;
    const deltaSign = delta >= 0 ? '+' : '';
    const deltaColor = delta >= 0 ? colors.perfGreen : colors.perfRed;

    const firstFC = fcValues[0];
    const lastFC = fcValues[fcValues.length - 1];
    const deltaFC = lastFC - firstFC;
    const deltaFCSign = deltaFC >= 0 ? '+' : '';
    // Green if FC drops (improvement), red if rises
    const deltaFCColor = deltaFC <= 0 ? colors.perfGreen : colors.perfRed;

    metricsEl.innerHTML = `
      <div class="perf-metric-card">
        <div class="perf-metric-value">${first.toFixed(1)}</div>
        <div class="perf-metric-label">Indice 1ère</div>
      </div>
      <div class="perf-metric-card">
        <div class="perf-metric-value">${last.toFixed(1)}</div>
        <div class="perf-metric-delta" style="color:${deltaColor}">${deltaSign}${delta.toFixed(1)}</div>
        <div class="perf-metric-label">Indice dernière</div>
      </div>
      <div class="perf-metric-card">
        <div class="perf-metric-value">${lastFC}</div>
        <div class="perf-metric-delta" style="color:${deltaFCColor}">${deltaFCSign}${deltaFC}</div>
        <div class="perf-metric-label">FC moy dernière</div>
      </div>
    `;
  }

  const labels = validData.map(w => {
    const d = new Date(w.date + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  });

  const fcValues = validData.map(w => parseFloat(w.bikeData.fcAvg));
  let indices = calcIndices();
  let trend = linearRegression(indices);

  updateMetrics(indices, fcValues);

  perfChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Indice perf.',
          data: indices,
          borderColor: colors.perfGreen,
          backgroundColor: colors.perfGreen + '25',
          fill: true,
          tension: 0.3,
          pointRadius: 5,
          pointBackgroundColor: colors.perfGreen,
          yAxisID: 'y',
          order: 2,
        },
        {
          label: 'Tendance',
          data: trend,
          borderColor: colors.perfGreen,
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0,
          yAxisID: 'y',
          order: 1,
        },
        {
          label: 'FC moy (bpm)',
          data: fcValues,
          borderColor: colors.perfRed,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: colors.perfRed,
          fill: false,
          tension: 0.3,
          yAxisID: 'y1',
          order: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: {
            color: colors.text,
            usePointStyle: true,
            filter: (item) => item.text !== 'Tendance',
          },
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              if (ctx.dataset.label === 'Tendance') return null;
              return `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}`;
            },
            afterBody: function(tooltipItems) {
              const idx = tooltipItems[0]?.dataIndex;
              if (idx === undefined) return '';
              const b = validData[idx]?.bikeData;
              if (!b) return '';
              const lines = [];
              lines.push('───────────');
              if (b.distanceKm) lines.push(`Distance: ${b.distanceKm} km`);
              if (b.wattsAvg) lines.push(`Watts moy: ${b.wattsAvg} W`);
              if (b.durationMinutes) lines.push(`Durée: ${b.durationMinutes} min`);
              if (b.elevationGain) lines.push(`D+: ${b.elevationGain} m`);
              if (b.rpm) lines.push(`Cadence: ${b.rpm} rpm`);
              return lines;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: colors.text, font: { size: 11 } },
          grid: { color: colors.grid },
        },
        y: {
          position: 'left',
          ticks: { color: colors.perfGreen, font: { size: 11 } },
          grid: { color: colors.grid },
          title: { display: true, text: 'Indice', color: colors.perfGreen },
        },
        y1: {
          position: 'right',
          ticks: { color: colors.perfRed, font: { size: 11 } },
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'FC (bpm)', color: colors.perfRed },
        },
      },
    },
  });

}

function renderEfficaciteChart(container, bikeData, colors, baseOptions) {
  const validData = bikeData.filter(w => {
    const b = w.bikeData;
    return b.wattsAvg && b.fcAvg && b.fcAvg > 0;
  });

  if (validData.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Données insuffisantes</p>
        <p style="font-size:13px;color:var(--text-secondary)">Il faut au minimum Watts et FC pour calculer l'efficacité.</p>
      </div>
    `;
    return;
  }

  const labels = validData.map(w => {
    const d = new Date(w.date + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  });

  const effValues = validData.map(w => {
    return parseFloat((w.bikeData.wattsAvg / w.bikeData.fcAvg).toFixed(3));
  });

  // Trend line
  const trend = linearRegression(effValues);

  // Metric cards
  const first = effValues[0];
  const last = effValues[effValues.length - 1];
  const delta = last - first;
  const deltaSign = delta >= 0 ? '+' : '';
  const deltaColor = delta >= 0 ? colors.perfGreen : colors.perfRed;

  container.innerHTML = `
    <div class="perf-metrics">
      <div class="perf-metric-card">
        <div class="perf-metric-value">${first.toFixed(2)}</div>
        <div class="perf-metric-label">1ère session</div>
      </div>
      <div class="perf-metric-card">
        <div class="perf-metric-value">${last.toFixed(2)}</div>
        <div class="perf-metric-delta" style="color:${deltaColor}">${deltaSign}${delta.toFixed(2)}</div>
        <div class="perf-metric-label">Dernière</div>
      </div>
      <div class="perf-metric-card">
        <div class="perf-metric-value">${(effValues.reduce((a, b) => a + b, 0) / effValues.length).toFixed(2)}</div>
        <div class="perf-metric-label">Moyenne</div>
      </div>
    </div>
    <div class="chart-container"><canvas id="efficacite-chart"></canvas></div>
  `;

  const canvas = document.getElementById('efficacite-chart');

  chartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Efficacité (W/bpm)',
          data: effValues,
          borderColor: colors.accent,
          backgroundColor: colors.accent + '25',
          fill: true,
          tension: 0.3,
          pointRadius: 5,
          pointBackgroundColor: colors.accent,
        },
        {
          label: 'Tendance',
          data: trend,
          borderColor: colors.accent,
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0,
        },
      ],
    },
    options: {
      ...baseOptions,
      plugins: {
        legend: {
          display: true,
          labels: {
            color: colors.text,
            usePointStyle: true,
            filter: (item) => item.text !== 'Tendance',
          },
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              if (ctx.dataset.label === 'Tendance') return null;
              return `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(3)}`;
            },
          },
        },
      },
      scales: {
        x: baseOptions.scales.x,
        y: {
          ...baseOptions.scales.y,
          title: { display: true, text: 'Watts / FC', color: colors.text },
        },
      },
    },
  });
}

// === Sleep meds section ===

function buildNightDoseMap(intakesData) {
  const nightMap = new Map();
  for (const day of intakesData || []) {
    for (const e of day?.entries || []) {
      if (!e?.product || !SLEEP_PRODUCTS.includes(e.product)) continue;
      const night = effectiveNight(day.date, e.time);
      const dose = qtyToNumber(e.quantity);
      if (dose <= 0) continue;
      if (!nightMap.has(night)) nightMap.set(night, new Map());
      const m = nightMap.get(night);
      m.set(e.product, (m.get(e.product) || 0) + dose);
    }
  }
  return nightMap;
}

function buildIngredientNightMap(intakesData) {
  // Map<night, Map<ingredient, totalMg>>
  const nightMap = new Map();
  for (const day of intakesData || []) {
    for (const e of day?.entries || []) {
      const compo = PRODUCT_COMPOSITIONS[e?.product];
      if (!compo) continue;
      const dose = qtyToNumber(e.quantity);
      if (dose <= 0) continue;
      const night = effectiveNight(day.date, e.time);
      if (!nightMap.has(night)) nightMap.set(night, new Map());
      const m = nightMap.get(night);
      for (const [ing, mgPer1] of Object.entries(compo)) {
        m.set(ing, (m.get(ing) || 0) + dose * mgPer1);
      }
    }
  }
  return nightMap;
}

function filterSleepByPeriod(data, period) {
  if (period === 'all') return data;
  const months = period === '3m' ? 3 : 6;
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return data.filter(s => s.date >= cutoffStr);
}

function renderSleepMedsSection(sleepData, intakesData, colors, baseOptions) {
  const section = document.getElementById('sleep-meds-section');
  if (!section) return;

  if (!intakesData || intakesData.length === 0) {
    section.innerHTML = `
      <div class="section-title">Prises & impact</div>
      <div class="empty-state">
        <p>Aucune prise enregistrée</p>
        <p style="font-size:13px;color:var(--text-secondary)">Ajoute des prises dans l'onglet Prises pour voir leur impact.</p>
      </div>
    `;
    return;
  }

  section.innerHTML = `
    <div class="section-title">Prises & impact sur le sommeil</div>
    <div class="meds-view-tabs">
      <button class="meds-view-tab ${currentMedsView === 'products' ? 'active' : ''}" data-view="products">Vue produits</button>
      <button class="meds-view-tab ${currentMedsView === 'ingredients' ? 'active' : ''}" data-view="ingredients">Vue composants</button>
    </div>
    <div id="meds-tab-content"></div>
  `;

  section.querySelectorAll('.meds-view-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentMedsView = btn.dataset.view;
      section.querySelectorAll('.meds-view-tab').forEach(b =>
        b.classList.toggle('active', b.dataset.view === currentMedsView));
      renderMedsTabContent(sleepData, intakesData, colors, baseOptions);
    });
  });

  renderMedsTabContent(sleepData, intakesData, colors, baseOptions);
}

function renderMedsTabContent(sleepData, intakesData, colors, baseOptions) {
  if (medsChartInstance) { medsChartInstance.destroy(); medsChartInstance = null; }
  const content = document.getElementById('meds-tab-content');
  if (!content) return;
  if (currentMedsView === 'products') {
    renderProductsTab(content, sleepData, intakesData, colors, baseOptions);
  } else {
    renderIngredientsTab(content, sleepData, intakesData, colors, baseOptions);
  }
}

// ── Vue produits ──────────────────────────────────────────────────────────────

function renderProductsTab(content, sleepData, intakesData, colors, baseOptions) {
  content.innerHTML = `
    <div class="period-buttons" id="meds-period-buttons"></div>
    <div class="product-chips" id="meds-product-chips"></div>
    <div id="meds-correlation" class="meds-correlation"></div>
    <div class="chart-container"><canvas id="meds-chart"></canvas></div>
    <div id="meds-empty" class="empty-state hidden"><p>Pas de données sur la période</p></div>
  `;

  const pb = content.querySelector('#meds-period-buttons');
  pb.innerHTML = ['3m', '6m', 'all'].map(p =>
    `<button class="period-btn ${p === currentSleepPeriod ? 'active' : ''}" data-period="${p}">${p === 'all' ? 'Tout' : p === '3m' ? '3 mois' : '6 mois'}</button>`
  ).join('');
  pb.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSleepPeriod = btn.dataset.period;
      renderMedsTabContent(sleepData, intakesData, colors, baseOptions);
    });
  });

  const cp = content.querySelector('#meds-product-chips');
  cp.innerHTML = [
    `<button class="product-chip ${currentSleepProduct === 'all' ? 'active' : ''}" data-product="all">Tous</button>`,
    ...SLEEP_PRODUCTS.map(p => {
      const c = PRODUCT_COLORS[p];
      return `<button class="product-chip ${currentSleepProduct === p ? 'active' : ''}" data-product="${p}" style="--chip:${c}">
        <span class="chip-dot" style="background:${c}"></span>${p}
      </button>`;
    }),
  ].join('');
  cp.querySelectorAll('.product-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSleepProduct = btn.dataset.product;
      renderMedsTabContent(sleepData, intakesData, colors, baseOptions);
    });
  });

  const periodSleep = filterSleepByPeriod(sleepData.filter(s => s.quality), currentSleepPeriod);
  const nightMap = buildNightDoseMap(intakesData);
  renderCorrelationCards(periodSleep, nightMap);

  if (periodSleep.length === 0) {
    content.querySelector('#meds-chart').parentElement.classList.add('hidden');
    content.querySelector('#meds-empty').classList.remove('hidden');
    return;
  }
  renderMedsChart(periodSleep, nightMap, colors, baseOptions);
}

// ── Vue composants ────────────────────────────────────────────────────────────

function renderIngredientsTab(content, sleepData, intakesData, colors, baseOptions) {
  content.innerHTML = `
    <div class="period-buttons" id="ing-period-buttons"></div>
    <div class="product-chips" id="ing-chips"></div>
    <div id="ing-correlation" class="meds-correlation"></div>
    <div class="chart-container"><canvas id="ing-chart"></canvas></div>
    <div id="ing-empty" class="empty-state hidden"><p>Pas de données sur la période</p></div>
  `;

  const pb = content.querySelector('#ing-period-buttons');
  pb.innerHTML = ['3m', '6m', 'all'].map(p =>
    `<button class="period-btn ${p === currentIngredientPeriod ? 'active' : ''}" data-period="${p}">${p === 'all' ? 'Tout' : p === '3m' ? '3 mois' : '6 mois'}</button>`
  ).join('');
  pb.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentIngredientPeriod = btn.dataset.period;
      renderMedsTabContent(sleepData, intakesData, colors, baseOptions);
    });
  });

  const cp = content.querySelector('#ing-chips');
  cp.innerHTML = [
    `<button class="product-chip ${currentIngredient === 'all' ? 'active' : ''}" data-ingredient="all">Tous</button>`,
    ...INGREDIENTS.map(ing => {
      const c = INGREDIENT_COLORS[ing] || '#888';
      return `<button class="product-chip ${currentIngredient === ing ? 'active' : ''}" data-ingredient="${ing}" style="--chip:${c}">
        <span class="chip-dot" style="background:${c}"></span>${ing}
      </button>`;
    }),
  ].join('');
  cp.querySelectorAll('.product-chip[data-ingredient]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentIngredient = btn.dataset.ingredient;
      renderMedsTabContent(sleepData, intakesData, colors, baseOptions);
    });
  });

  const periodSleep = filterSleepByPeriod(sleepData.filter(s => s.quality), currentIngredientPeriod);
  const ingredientMap = buildIngredientNightMap(intakesData);
  renderIngredientCorrelationCards(periodSleep, ingredientMap);

  if (periodSleep.length === 0) {
    content.querySelector('#ing-chart').parentElement.classList.add('hidden');
    content.querySelector('#ing-empty').classList.remove('hidden');
    return;
  }
  renderIngredientsChart(periodSleep, ingredientMap, colors, baseOptions);
}

// ── Correlation cards ─────────────────────────────────────────────────────────

function renderCorrelationCards(periodSleep, nightMap) {
  const el = document.getElementById('meds-correlation');
  if (!el) return;
  if (periodSleep.length === 0) { el.innerHTML = ''; return; }

  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const cards = SLEEP_PRODUCTS.map(p => {
    const withQ = [], withoutQ = [];
    for (const s of periodSleep) {
      const m = nightMap.get(s.date);
      const dose = m ? (m.get(p) || 0) : 0;
      (dose > 0 ? withQ : withoutQ).push(s.quality);
    }
    if (withQ.length === 0) return null;
    const aw = avg(withQ);
    const ao = withoutQ.length ? avg(withoutQ) : null;
    const delta = ao !== null ? aw - ao : null;
    const deltaColor = delta === null ? '#8892a0' : delta >= 0 ? '#1D9E75' : '#E24B4A';
    const deltaTxt = delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`;
    return `
      <div class="meds-corr-card" style="border-left:3px solid ${PRODUCT_COLORS[p]}">
        <div class="meds-corr-name">${p}</div>
        <div class="meds-corr-row">
          <span class="meds-corr-with">Avec : <b>${aw.toFixed(1)}</b> <span class="meds-corr-n">(n=${withQ.length})</span></span>
          <span class="meds-corr-without">Sans : <b>${ao !== null ? ao.toFixed(1) : '—'}</b> <span class="meds-corr-n">(n=${withoutQ.length})</span></span>
          <span class="meds-corr-delta" style="color:${deltaColor}">${deltaTxt}</span>
        </div>
      </div>`;
  }).filter(Boolean).join('');
  el.innerHTML = cards || `<div style="color:var(--text-secondary);font-size:13px;padding:8px 0">Aucune prise sur la période.</div>`;
}

function ingSourceRows(ing) {
  // Liste des produits qui contiennent cet ingrédient, avec la quantité pour 1 dose
  return Object.entries(PRODUCT_COMPOSITIONS)
    .filter(([, compo]) => compo[ing] !== undefined)
    .map(([prod, compo]) =>
      `<div class="ing-info-popover-row">
        <span class="ing-info-popover-prod">${prod}</span>
        <span class="ing-info-popover-amt">${fmtIngredientAmt(ing, compo[ing])} / dose</span>
      </div>`
    ).join('');
}

function renderIngredientCorrelationCards(periodSleep, ingredientMap) {
  const el = document.getElementById('ing-correlation');
  if (!el) return;
  if (periodSleep.length === 0) { el.innerHTML = ''; return; }

  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const cards = INGREDIENTS.map(ing => {
    const withQ = [], withoutQ = [];
    for (const s of periodSleep) {
      const m = ingredientMap.get(s.date);
      const amt = m ? (m.get(ing) || 0) : 0;
      (amt > 0 ? withQ : withoutQ).push(s.quality);
    }
    if (withQ.length === 0) return null;
    const aw = avg(withQ);
    const ao = withoutQ.length ? avg(withoutQ) : null;
    const delta = ao !== null ? aw - ao : null;
    const deltaColor = delta === null ? '#8892a0' : delta >= 0 ? '#1D9E75' : '#E24B4A';
    const deltaTxt = delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`;
    const c = INGREDIENT_COLORS[ing] || '#888';
    return `
      <div class="meds-corr-card" style="border-left:3px solid ${c};position:relative">
        <div class="meds-corr-name">
          ${ing}
          <button class="ing-info-btn" data-ing="${ing}" title="Sources de ${ing}">ⓘ</button>
        </div>
        <div class="meds-corr-row">
          <span class="meds-corr-with">Avec : <b>${aw.toFixed(1)}</b> <span class="meds-corr-n">(n=${withQ.length})</span></span>
          <span class="meds-corr-without">Sans : <b>${ao !== null ? ao.toFixed(1) : '—'}</b> <span class="meds-corr-n">(n=${withoutQ.length})</span></span>
          <span class="meds-corr-delta" style="color:${deltaColor}">${deltaTxt}</span>
        </div>
      </div>`;
  }).filter(Boolean).join('');
  el.innerHTML = cards || `<div style="color:var(--text-secondary);font-size:13px;padding:8px 0">Aucune donnée sur la période.</div>`;

  // Popover ⓘ
  let openPopover = null;
  el.querySelectorAll('.ing-info-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      // Ferme si déjà ouvert sur ce bouton
      if (openPopover && openPopover.btn === btn) {
        openPopover.el.remove();
        openPopover = null;
        return;
      }
      // Ferme l'éventuel précédent
      openPopover?.el.remove();

      const ing = btn.dataset.ing;
      const pop = document.createElement('div');
      pop.className = 'ing-info-popover';
      pop.innerHTML = ingSourceRows(ing);
      btn.closest('.meds-corr-card').appendChild(pop);
      openPopover = { btn, el: pop };
    });
  });

  // Clic dehors → ferme
  document.addEventListener('click', function closeAll() {
    openPopover?.el.remove();
    openPopover = null;
    document.removeEventListener('click', closeAll);
  });
}

// ── Charts ────────────────────────────────────────────────────────────────────

function renderMedsChart(periodSleep, nightMap, colors, baseOptions) {
  const canvas = document.getElementById('meds-chart');
  if (!canvas) return;

  const labels = periodSleep.map(s => {
    const d = new Date(s.date + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  });

  let datasets, yScales;

  if (currentSleepProduct === 'all') {
    datasets = SLEEP_PRODUCTS.map(p => ({
      label: p,
      data: periodSleep.map(s => { const m = nightMap.get(s.date); return m ? (m.get(p) || 0) : 0; }),
      backgroundColor: PRODUCT_COLORS[p],
      borderRadius: 2,
      stack: 'doses',
    })).filter(ds => ds.data.some(v => v > 0));
    yScales = { y: { ...baseOptions.scales.y, stacked: true, beginAtZero: true, title: { display: true, text: 'Doses', color: colors.text } } };
  } else {
    const p = currentSleepProduct;
    datasets = [
      { type: 'bar',  label: `${p} (dose)`,    data: periodSleep.map(s => { const m = nightMap.get(s.date); return m ? (m.get(p) || 0) : 0; }), backgroundColor: PRODUCT_COLORS[p], borderRadius: 2, yAxisID: 'y', order: 2 },
      { type: 'line', label: 'Qualité sommeil', data: periodSleep.map(s => s.quality), borderColor: colors.accent, backgroundColor: 'transparent', borderWidth: 2, pointRadius: 3, pointBackgroundColor: colors.accent, tension: 0.3, yAxisID: 'y1', order: 1 },
    ];
    yScales = {
      y:  { ...baseOptions.scales.y, beginAtZero: true, position: 'left',  title: { display: true, text: 'Dose',    color: PRODUCT_COLORS[p] } },
      y1: { ...baseOptions.scales.y, position: 'right', min: 0, max: 10, grid: { drawOnChartArea: false }, title: { display: true, text: 'Qualité', color: colors.accent } },
    };
  }

  medsChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets },
    options: {
      ...baseOptions,
      scales: { x: { ...baseOptions.scales.x, stacked: currentSleepProduct === 'all' }, ...yScales },
      plugins: {
        legend: { display: true, labels: { color: colors.text, usePointStyle: true, font: { size: 10 } } },
        tooltip: { callbacks: { afterBody: (items) => {
          const s = periodSleep[items[0]?.dataIndex];
          return s ? ['───────────', `Qualité : ${s.quality}/10`] : '';
        } } },
      },
    },
  });
}

function renderIngredientsChart(periodSleep, ingredientMap, colors, baseOptions) {
  const canvas = document.getElementById('ing-chart');
  if (!canvas) return;

  const labels = periodSleep.map(s => {
    const d = new Date(s.date + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  });

  let datasets, yScales;

  if (currentIngredient === 'all') {
    datasets = INGREDIENTS.map(ing => ({
      label: ing,
      data: periodSleep.map(s => { const m = ingredientMap.get(s.date); return m ? +(m.get(ing) || 0).toFixed(4) : 0; }),
      backgroundColor: INGREDIENT_COLORS[ing] || '#888',
      borderRadius: 2,
      stack: 'amounts',
    })).filter(ds => ds.data.some(v => v > 0));
    yScales = { y: { ...baseOptions.scales.y, stacked: true, beginAtZero: true, title: { display: true, text: 'mg', color: colors.text } } };
  } else {
    const ing = currentIngredient;
    const isUg = UG_INGREDIENTS.has(ing);
    const c = INGREDIENT_COLORS[ing] || '#888';
    const rawData = periodSleep.map(s => { const m = ingredientMap.get(s.date); return m ? (m.get(ing) || 0) : 0; });
    const displayData = isUg ? rawData.map(v => +(v * 1000).toFixed(3)) : rawData.map(v => +v.toFixed(3));
    datasets = [
      { type: 'bar',  label: `${ing} (${isUg ? 'µg' : 'mg'})`, data: displayData, backgroundColor: c, borderRadius: 2, yAxisID: 'y', order: 2 },
      { type: 'line', label: 'Qualité sommeil', data: periodSleep.map(s => s.quality), borderColor: colors.accent, backgroundColor: 'transparent', borderWidth: 2, pointRadius: 3, pointBackgroundColor: colors.accent, tension: 0.3, yAxisID: 'y1', order: 1 },
    ];
    yScales = {
      y:  { ...baseOptions.scales.y, beginAtZero: true, position: 'left',  title: { display: true, text: isUg ? 'µg' : 'mg', color: c } },
      y1: { ...baseOptions.scales.y, position: 'right', min: 0, max: 10, grid: { drawOnChartArea: false }, title: { display: true, text: 'Qualité', color: colors.accent } },
    };
  }

  medsChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets },
    options: {
      ...baseOptions,
      scales: { x: { ...baseOptions.scales.x, stacked: currentIngredient === 'all' }, ...yScales },
      plugins: {
        legend: { display: true, labels: { color: colors.text, usePointStyle: true, font: { size: 10 } } },
        tooltip: {
          filter: item => item.raw !== 0,
          callbacks: {
            label: (item) => currentIngredient !== 'all'
              ? `${item.dataset.label}: ${item.formattedValue}`
              : `${item.dataset.label}: ${fmtIngredientAmt(item.dataset.label, item.raw)}`,
            afterBody: (items) => {
              const s = periodSleep[items[0]?.dataIndex];
              return s ? ['───────────', `Qualité : ${s.quality}/10`] : '';
            },
          },
        },
      },
    },
  });
}

function renderMoonIconsRow(data) {
  const row = document.getElementById('moon-icons-row');
  if (!row || data.length === 0) return;

  // N'affiche que les 4 phases clés au premier jour de chaque phase
  const KEY_PHASES = new Set([0, 2, 4, 6]); // 🌑 🌓 🌕 🌗
  let prevPhaseIdx = null;

  row.innerHTML = data.map(s => {
    const { icon, label, phaseIdx } = getMoonPhase(s.date);
    const show = KEY_PHASES.has(phaseIdx) && phaseIdx !== prevPhaseIdx;
    prevPhaseIdx = phaseIdx;
    return show
      ? `<span class="moon-icon-cell" title="${label}">${icon}</span>`
      : `<span class="moon-icon-cell"></span>`;
  }).join('');

  // Aligne avec la zone de plot Chart.js (exclut les marges des axes)
  requestAnimationFrame(() => {
    if (chartInstance?.chartArea) {
      const ca = chartInstance.chartArea;
      const totalWidth = chartInstance.canvas.offsetWidth;
      row.style.paddingLeft  = ca.left + 'px';
      row.style.paddingRight = (totalWidth - ca.right) + 'px';
    }
  });
}

function renderMoonSection(data) {
  const section = document.getElementById('moon-section');
  if (!section) return;
  if (data.length === 0) { section.innerHTML = ''; return; }

  const stats = MOON_PHASES.map((p, idx) => {
    const nights = data.filter(s => getMoonPhase(s.date).phaseIdx === idx)
                       .sort((a, b) => b.date.localeCompare(a.date)); // récent en premier
    const avg = nights.length
      ? +(nights.reduce((sum, s) => sum + s.quality, 0) / nights.length).toFixed(1)
      : null;
    return { ...p, avg, n: nights.length, nights };
  });

  const cards = stats.map((p, idx) => {
    const scoreColor = p.avg === null ? 'var(--text-secondary)'
      : p.avg >= 7 ? '#66bb6a'
      : p.avg >= 4 ? '#ffa726'
      : '#ef5350';
    return `
      <div class="moon-phase-card" data-moon-idx="${idx}" role="button" tabindex="0"
           style="cursor:pointer" title="Voir les nuits ${p.label}">
        <div class="moon-phase-icon">${p.icon}</div>
        <div class="moon-phase-name">${p.label}</div>
        <div class="moon-phase-score" style="color:${scoreColor}">${p.avg ?? '—'}</div>
        <div class="moon-phase-n">${p.n} nuit${p.n !== 1 ? 's' : ''}</div>
      </div>
    `;
  }).join('');

  section.innerHTML = `
    <div class="section-title">Lune &amp; qualité du sommeil</div>
    <div class="moon-phase-grid">${cards}</div>
  `;

  section.querySelectorAll('.moon-phase-card').forEach(card => {
    const open = () => {
      const idx = parseInt(card.dataset.moonIdx, 10);
      showMoonPhaseModal(stats[idx]);
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') open(); });
  });
}

function showMoonPhaseModal({ icon, label, avg, nights }) {
  // Supprime une éventuelle modale déjà ouverte
  document.getElementById('moon-modal-overlay')?.remove();

  const qualityColor = q => q >= 7 ? '#66bb6a' : q >= 4 ? '#ffa726' : '#ef5350';

  const rows = nights.length === 0
    ? `<div style="color:var(--text-secondary);text-align:center;padding:16px">Aucune nuit enregistrée</div>`
    : nights.map(s => {
        const d = new Date(s.date + 'T12:00:00');
        const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
        return `
          <div class="moon-modal-row">
            <span class="moon-modal-date">${dateStr}</span>
            <span class="moon-modal-badge" style="background:${qualityColor(s.quality)}">${s.quality}/10</span>
          </div>
        `;
      }).join('');

  const avgLine = avg !== null
    ? `<div class="moon-modal-avg">Moyenne : <b>${avg}/10</b> sur ${nights.length} nuit${nights.length !== 1 ? 's' : ''}</div>`
    : '';

  const overlay = document.createElement('div');
  overlay.id = 'moon-modal-overlay';
  overlay.className = 'moon-modal-overlay';
  overlay.innerHTML = `
    <div class="moon-modal" role="dialog" aria-modal="true">
      <button class="moon-modal-close" aria-label="Fermer">✕</button>
      <div class="moon-modal-header">
        <span class="moon-modal-icon">${icon}</span>
        <span class="moon-modal-title">${label}</span>
      </div>
      ${avgLine}
      <div class="moon-modal-list">${rows}</div>
    </div>
  `;

  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('.moon-modal-close').addEventListener('click', close);
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });

  document.body.appendChild(overlay);
  // Force reflow pour l'animation
  requestAnimationFrame(() => overlay.classList.add('moon-modal-overlay--visible'));
}

// ── Nutrition chart ───────────────────────────────────────────────────────────

const NUT_METRICS = {
  kcal:  { label: 'Calories', unit: 'kcal', color: '#4fc3f7' },
  prot:  { label: 'Protéines', unit: 'g',   color: '#ab47bc' },
  carbs: { label: 'Glucides',  unit: 'g',   color: '#ffa726' },
  fats:  { label: 'Lipides',   unit: 'g',   color: '#66bb6a' },
};

const DEFAULT_NUT_GOALS = { kcal: 2500, prot: 160, carbs: 300, fats: 80 };

function renderNutritionChart(allNut, goals, colors, baseOptions) {
  if (nutChartInstance) { nutChartInstance.destroy(); nutChartInstance = null; }

  const canvas = document.getElementById('nut-chart');
  const summaryEl = document.getElementById('nut-summary');
  if (!canvas) return;

  const g = { ...DEFAULT_NUT_GOALS, ...(goals || {}) };
  const metric = currentNutritionMetric;
  const { label, unit, color } = NUT_METRICS[metric];
  const goal = g[metric];

  // Aggregation par jour
  const days = filterByPeriod(allNut.map(doc => {
    const items = Object.values(doc.sections || {}).flat();
    const total = items.reduce((acc, i) => acc + (i[metric] || 0), 0);
    return { date: doc.date, value: metric === 'kcal' ? Math.round(total) : +total.toFixed(1) };
  }), currentNutritionPeriod);

  const labels = days.map(d => {
    const dt = new Date(d.date + 'T12:00:00');
    return dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  });

  const values = days.map(d => d.value);

  // Couleur par barre selon % de l'objectif
  const barColors = values.map(v => {
    const pct = goal > 0 ? v / goal : 0;
    if (pct >= 0.9 && pct <= 1.15) return '#66bb6a'; // dans l'objectif
    if (pct >= 0.75 || pct <= 1.3)  return '#ffa726'; // proche
    return '#ef5350';                                   // loin
  });

  // Ligne objectif (dataset ligne plate)
  const goalLine = days.map(() => goal);

  nutChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label,
          data: values,
          backgroundColor: barColors,
          borderRadius: 4,
          order: 2,
        },
        {
          type: 'line',
          label: `Objectif (${goal} ${unit})`,
          data: goalLine,
          borderColor: color,
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0,
          order: 1,
        },
      ],
    },
    options: {
      ...baseOptions,
      plugins: {
        legend: {
          display: true,
          labels: { color: colors.text, usePointStyle: true, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            title: (items) => {
              const d = days[items[0]?.dataIndex];
              if (!d) return '';
              const dt = new Date(d.date + 'T12:00:00');
              return dt.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' });
            },
            label: (ctx) => {
              if (ctx.datasetIndex === 1) return `Objectif : ${goal} ${unit}`;
              const v = ctx.raw;
              const pct = goal > 0 ? Math.round(v / goal * 100) : '—';
              return `${label} : ${v} ${unit} (${pct}%)`;
            },
          },
        },
      },
      scales: {
        x: baseOptions.scales.x,
        y: {
          ...baseOptions.scales.y,
          beginAtZero: true,
          title: { display: true, text: unit, color: colors.text },
        },
      },
    },
  });

  // Résumé stats
  if (summaryEl && values.length > 0) {
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const daysOnTarget = values.filter(v => goal > 0 && v / goal >= 0.9 && v / goal <= 1.15).length;
    summaryEl.innerHTML = `
      <div class="perf-metrics">
        <div class="perf-metric-card">
          <div class="perf-metric-value">${avg}</div>
          <div class="perf-metric-label">Moyenne / jour</div>
        </div>
        <div class="perf-metric-card">
          <div class="perf-metric-value" style="color:#66bb6a">${daysOnTarget}</div>
          <div class="perf-metric-label">Jours dans l'objectif</div>
        </div>
        <div class="perf-metric-card">
          <div class="perf-metric-value">${max}</div>
          <div class="perf-metric-label">Max</div>
        </div>
        <div class="perf-metric-card">
          <div class="perf-metric-value">${min}</div>
          <div class="perf-metric-label">Min</div>
        </div>
      </div>`;
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
