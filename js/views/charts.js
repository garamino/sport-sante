import { getAllWeeklies, getAllSleep, getAllWorkouts, getAllIntakes } from '../db.js';

const SLEEP_PRODUCTS = [
  'Metasleep',
  'Metarelax',
  'Trazodone 100mg',
  'Stilnoct 10mg',
  'Ashwagandha 300mg',
  'L-Théanine 200mg',
  'D-Pearls 38 microgr',
];

const PRODUCT_COLORS = {
  'Metasleep':            '#4fc3f7',
  'Metarelax':            '#ab47bc',
  'Trazodone 100mg':      '#ef5350',
  'Stilnoct 10mg':        '#ffa726',
  'Ashwagandha 300mg':    '#66bb6a',
  'L-Théanine 200mg':     '#26a69a',
  'D-Pearls 38 microgr':  '#ffee58',
};

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

// Toute prise du jour D vise la nuit D+1 (cohérent avec sleep.js qui affiche
// les prises de D-1 comme contexte du sommeil noté le jour D).
function effectiveNight(intakeDate, _time) {
  return shiftDateStr(intakeDate, 1);
}

let currentSleepPeriod = '3m';
let currentSleepProduct = 'all';

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
        <div class="chart-container"><canvas id="main-chart"></canvas></div>
        <div id="chart-empty" class="empty-state hidden">
          <p>Pas encore de données</p>
          <p style="font-size:13px;color:var(--text-secondary)">Commence à logger tes séances !</p>
        </div>
      `;
      const canvas = document.getElementById('main-chart');
      const emptyEl = document.getElementById('chart-empty');

      const weeklies = await getAllWeeklies();
      const data = weeklies.filter(w => w.weight);

      if (data.length === 0) {
        canvas.parentElement.classList.add('hidden');
        emptyEl.classList.remove('hidden');
        return;
      }

      chartInstance = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: data.map(w => `S${w.week}`),
          datasets: [{
            label: 'Poids (kg)',
            data: data.map(w => w.weight),
            borderColor: chartColors.accent,
            backgroundColor: chartColors.accent + '33',
            fill: true,
            tension: 0.3,
            pointRadius: 5,
            pointBackgroundColor: chartColors.accent,
          }],
        },
        options: {
          ...baseOptions,
          scales: {
            ...baseOptions.scales,
            y: { ...baseOptions.scales.y, suggestedMin: 55, suggestedMax: 70 },
          },
          plugins: {
            legend: { display: true, labels: { color: chartColors.text } },
          },
        },
      });

    } else if (type === 'sleep') {
      area.innerHTML = `
        <div class="chart-container"><canvas id="main-chart"></canvas></div>
        <div id="chart-empty" class="empty-state hidden">
          <p>Pas encore de données</p>
          <p style="font-size:13px;color:var(--text-secondary)">Commence à logger tes séances !</p>
        </div>
        <div id="sleep-meds-section" style="margin-top:24px"></div>
      `;
      const canvas = document.getElementById('main-chart');
      const emptyEl = document.getElementById('chart-empty');

      const [sleepData, intakesData] = await Promise.all([
        getAllSleep(),
        getAllIntakes().catch(() => []),
      ]);
      const data = sleepData.filter(s => s.quality);

      if (data.length === 0) {
        canvas.parentElement.classList.add('hidden');
        emptyEl.classList.remove('hidden');
      } else {
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
      }

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
    }
  } catch (e) {
    console.error('Chart error:', e);
    area.innerHTML = `<div class="empty-state"><p>Erreur de chargement</p></div>`;
  }
}

let currentPeriod = '3m';

function filterByPeriod(data, period) {
  if (period === 'all') return data;
  const now = new Date();
  const months = period === '3m' ? 3 : 6;
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return data.filter(w => w.date >= cutoffStr);
}

function renderPeriodButtons(container, bikeData, colors, baseOptions, sub) {
  const wrapper = document.createElement('div');
  wrapper.className = 'period-buttons';
  wrapper.innerHTML = ['3m', '6m', 'all'].map(p =>
    `<button class="period-btn ${p === currentPeriod ? 'active' : ''}" data-period="${p}">${p === 'all' ? 'Tout' : p === '3m' ? '3 mois' : '6 mois'}</button>`
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

  if (sub === 'intensite') {
    renderIntensiteChart(container, bikeData, colors, baseOptions);
  } else if (sub === 'performance') {
    renderPerformanceChart(container, filterByPeriod(bikeData, currentPeriod), colors);
    renderPeriodButtons(container, bikeData, colors, baseOptions, sub);
  } else {
    renderEfficaciteChart(container, filterByPeriod(bikeData, currentPeriod), colors, baseOptions);
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
  // Map<night, Map<product, totalDose>>
  const nightMap = new Map();
  for (const day of intakesData || []) {
    const entries = day?.entries || [];
    for (const e of entries) {
      if (!e?.product) continue;
      if (!SLEEP_PRODUCTS.includes(e.product)) continue;
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
    <div class="period-buttons" id="meds-period-buttons"></div>
    <div class="product-chips" id="meds-product-chips"></div>
    <div id="meds-correlation" class="meds-correlation"></div>
    <div class="chart-container"><canvas id="meds-chart"></canvas></div>
    <div id="meds-empty" class="empty-state hidden">
      <p>Pas de données sur la période</p>
    </div>
  `;

  // Period buttons
  const pb = section.querySelector('#meds-period-buttons');
  pb.innerHTML = ['3m', '6m', 'all'].map(p =>
    `<button class="period-btn ${p === currentSleepPeriod ? 'active' : ''}" data-period="${p}">${p === 'all' ? 'Tout' : p === '3m' ? '3 mois' : '6 mois'}</button>`
  ).join('');
  pb.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSleepPeriod = btn.dataset.period;
      renderSleepMedsSection(sleepData, intakesData, colors, baseOptions);
    });
  });

  // Product chips
  const cp = section.querySelector('#meds-product-chips');
  const chipHtml = [
    `<button class="product-chip ${currentSleepProduct === 'all' ? 'active' : ''}" data-product="all">Tous</button>`,
    ...SLEEP_PRODUCTS.map(p => {
      const c = PRODUCT_COLORS[p];
      const active = currentSleepProduct === p;
      return `<button class="product-chip ${active ? 'active' : ''}" data-product="${p}" style="--chip:${c}">
        <span class="chip-dot" style="background:${c}"></span>${p}
      </button>`;
    }),
  ].join('');
  cp.innerHTML = chipHtml;
  cp.querySelectorAll('.product-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSleepProduct = btn.dataset.product;
      renderSleepMedsSection(sleepData, intakesData, colors, baseOptions);
    });
  });

  // Filter by period
  const periodSleep = filterSleepByPeriod(sleepData.filter(s => s.quality), currentSleepPeriod);
  const nightMap = buildNightDoseMap(intakesData);

  // Correlation cards (always vs full filtered data, not affected by selected product)
  renderCorrelationCards(periodSleep, nightMap);

  // Chart
  if (periodSleep.length === 0) {
    document.querySelector('#meds-chart').parentElement.classList.add('hidden');
    document.querySelector('#meds-empty').classList.remove('hidden');
    return;
  }

  renderMedsChart(periodSleep, nightMap, colors, baseOptions);
}

function renderCorrelationCards(periodSleep, nightMap) {
  const el = document.getElementById('meds-correlation');
  if (!el) return;
  if (periodSleep.length === 0) { el.innerHTML = ''; return; }

  const cards = SLEEP_PRODUCTS.map(p => {
    const withQ = [];
    const withoutQ = [];
    for (const s of periodSleep) {
      const m = nightMap.get(s.date);
      const dose = m ? (m.get(p) || 0) : 0;
      if (dose > 0) withQ.push(s.quality);
      else withoutQ.push(s.quality);
    }
    if (withQ.length === 0) return null;
    const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const aw = avg(withQ);
    const ao = withoutQ.length ? avg(withoutQ) : null;
    const delta = ao !== null ? aw - ao : null;
    const deltaColor = delta === null ? '#8892a0' : (delta >= 0 ? '#1D9E75' : '#E24B4A');
    const deltaTxt = delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`;
    return `
      <div class="meds-corr-card" style="border-left:3px solid ${PRODUCT_COLORS[p]}">
        <div class="meds-corr-name">${p}</div>
        <div class="meds-corr-row">
          <span class="meds-corr-with">Avec : <b>${aw.toFixed(1)}</b> <span class="meds-corr-n">(n=${withQ.length})</span></span>
          <span class="meds-corr-without">Sans : <b>${ao !== null ? ao.toFixed(1) : '—'}</b> <span class="meds-corr-n">(n=${withoutQ.length})</span></span>
          <span class="meds-corr-delta" style="color:${deltaColor}">${deltaTxt}</span>
        </div>
      </div>
    `;
  }).filter(Boolean).join('');

  el.innerHTML = cards || `<div style="color:var(--text-secondary);font-size:13px;padding:8px 0">Aucune prise sur la période.</div>`;
}

function renderMedsChart(periodSleep, nightMap, colors, baseOptions) {
  const canvas = document.getElementById('meds-chart');
  if (!canvas) return;

  const labels = periodSleep.map(s => {
    const d = new Date(s.date + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  });

  let datasets;
  let yScales;

  if (currentSleepProduct === 'all') {
    // Stacked bar: one dataset per product
    datasets = SLEEP_PRODUCTS.map(p => ({
      label: p,
      data: periodSleep.map(s => {
        const m = nightMap.get(s.date);
        return m ? (m.get(p) || 0) : 0;
      }),
      backgroundColor: PRODUCT_COLORS[p],
      borderRadius: 2,
      stack: 'doses',
    })).filter(ds => ds.data.some(v => v > 0));

    yScales = {
      y: {
        ...baseOptions.scales.y,
        stacked: true,
        beginAtZero: true,
        title: { display: true, text: 'Doses', color: colors.text },
      },
    };
  } else {
    // Single product + quality overlay
    const p = currentSleepProduct;
    const doseData = periodSleep.map(s => {
      const m = nightMap.get(s.date);
      return m ? (m.get(p) || 0) : 0;
    });
    datasets = [
      {
        type: 'bar',
        label: `${p} (dose)`,
        data: doseData,
        backgroundColor: PRODUCT_COLORS[p],
        borderRadius: 2,
        yAxisID: 'y',
        order: 2,
      },
      {
        type: 'line',
        label: 'Qualité sommeil',
        data: periodSleep.map(s => s.quality),
        borderColor: colors.accent,
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: colors.accent,
        tension: 0.3,
        yAxisID: 'y1',
        order: 1,
      },
    ];
    yScales = {
      y: {
        ...baseOptions.scales.y,
        beginAtZero: true,
        position: 'left',
        title: { display: true, text: 'Dose', color: PRODUCT_COLORS[p] },
      },
      y1: {
        ...baseOptions.scales.y,
        position: 'right',
        min: 0,
        max: 10,
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'Qualité', color: colors.accent },
      },
    };
  }

  medsChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets },
    options: {
      ...baseOptions,
      scales: {
        x: {
          ...baseOptions.scales.x,
          stacked: currentSleepProduct === 'all',
        },
        ...yScales,
      },
      plugins: {
        legend: {
          display: true,
          labels: { color: colors.text, usePointStyle: true, font: { size: 10 } },
        },
        tooltip: {
          callbacks: {
            afterBody: function(items) {
              const idx = items[0]?.dataIndex;
              if (idx === undefined) return '';
              const s = periodSleep[idx];
              if (!s) return '';
              return ['───────────', `Qualité : ${s.quality}/10`];
            },
          },
        },
      },
    },
  });
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
