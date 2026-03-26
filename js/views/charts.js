import { getAllWeeklies, getAllSleep, getAllWorkouts } from '../db.js';

let chartInstance = null;
let perfChartInstance = null;

export async function render(container) {
  container.innerHTML = `
    <div class="section-title">Statistiques</div>
    <div class="chart-tabs">
      <button class="chart-tab active" data-chart="weight">Poids</button>
      <button class="chart-tab" data-chart="sleep">Sommeil</button>
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

  await renderChart('weight');
}

async function renderChart(type) {
  const area = document.getElementById('chart-area');
  if (!area) return;

  // Destroy previous charts
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  if (perfChartInstance) { perfChartInstance.destroy(); perfChartInstance = null; }

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
      `;
      const canvas = document.getElementById('main-chart');
      const emptyEl = document.getElementById('chart-empty');

      const sleepData = await getAllSleep();
      const data = sleepData.filter(s => s.quality);

      if (data.length === 0) {
        canvas.parentElement.classList.add('hidden');
        emptyEl.classList.remove('hidden');
        return;
      }

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

    } else if (type === 'bike') {
      const workouts = await getAllWorkouts();
      const bikeData = workouts.filter(w => w.dayType === 'velo' && w.bikeData);

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
          <button class="chart-subtab active" data-sub="intensite">Intensité</button>
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

      renderBikeSubChart('intensite', bikeData, chartColors, baseOptions);
    }
  } catch (e) {
    console.error('Chart error:', e);
    area.innerHTML = `<div class="empty-state"><p>Erreur de chargement</p></div>`;
  }
}

function renderBikeSubChart(sub, bikeData, colors, baseOptions) {
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  if (perfChartInstance) { perfChartInstance.destroy(); perfChartInstance = null; }

  const container = document.getElementById('bike-chart-area');
  if (!container) return;

  if (sub === 'intensite') {
    renderIntensiteChart(container, bikeData, colors, baseOptions);
  } else {
    renderPerformanceChart(container, bikeData, colors);
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

function renderPerformanceChart(container, bikeData, colors) {
  // Filter sessions with all required data
  const validData = bikeData.filter(w => {
    const b = w.bikeData;
    return b.fcAvg && b.durationMinutes && b.distanceKm && b.durationMinutes > 0;
  });

  if (validData.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Données insuffisantes</p>
        <p style="font-size:13px;color:var(--text-secondary)">Il faut au minimum FC, durée et distance pour calculer l'indice.</p>
      </div>
    `;
    return;
  }

  const defaultFCmax = 190;

  container.innerHTML = `
    <div id="perf-metrics" class="perf-metrics"></div>
    <div class="chart-container">
      <canvas id="perf-chart"></canvas>
    </div>
    <div class="perf-slider-container">
      <label class="perf-slider-label">
        FC max : <span id="fcmax-value">${defaultFCmax}</span> bpm
      </label>
      <input type="range" id="fcmax-slider" class="quality-slider" min="170" max="210" value="${defaultFCmax}" step="1">
    </div>
  `;

  const canvas = document.getElementById('perf-chart');
  const slider = document.getElementById('fcmax-slider');
  const fcmaxLabel = document.getElementById('fcmax-value');

  function calcIndices(fcMax) {
    return validData.map(w => {
      const b = w.bikeData;
      const dist = parseFloat(b.distanceKm) || 0;
      const dplus = parseFloat(b.elevationGain) || 0;
      const dureeH = (parseFloat(b.durationMinutes) || 1) / 60;
      const fc = parseFloat(b.fcAvg) || 1;
      return (dist + dplus / 100) / (dureeH * (fc / fcMax));
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
  let indices = calcIndices(defaultFCmax);
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

  // Slider interaction
  slider.addEventListener('input', () => {
    const fcMax = parseInt(slider.value);
    fcmaxLabel.textContent = fcMax;

    indices = calcIndices(fcMax);
    trend = linearRegression(indices);

    perfChartInstance.data.datasets[0].data = indices;
    perfChartInstance.data.datasets[1].data = trend;
    perfChartInstance.update();

    updateMetrics(indices, fcValues);
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
