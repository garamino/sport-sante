import { getAllWeeklies, getAllSleep, getAllWorkouts } from '../db.js';

let chartInstance = null;

export async function render(container) {
  container.innerHTML = `
    <div class="section-title">Statistiques</div>
    <div class="chart-tabs">
      <button class="chart-tab active" data-chart="weight">Poids</button>
      <button class="chart-tab" data-chart="sleep">Sommeil</button>
      <button class="chart-tab" data-chart="bike">Vélo</button>
    </div>
    <div class="chart-container">
      <canvas id="main-chart"></canvas>
    </div>
    <div id="chart-empty" class="empty-state hidden">
      <p>Pas encore de données</p>
      <p style="font-size:13px;color:var(--text-secondary)">Commence à logger tes séances !</p>
    </div>
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
  const canvas = document.getElementById('main-chart');
  const emptyEl = document.getElementById('chart-empty');
  if (!canvas) return;

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const ctx = canvas.getContext('2d');
  const chartColors = {
    accent: '#4fc3f7',
    success: '#66bb6a',
    danger: '#ef5350',
    warning: '#ffa726',
    grid: '#2a3a4e',
    text: '#8892a0',
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
      const weeklies = await getAllWeeklies();
      const data = weeklies.filter(w => w.weight);

      if (data.length === 0) {
        canvas.parentElement.classList.add('hidden');
        emptyEl.classList.remove('hidden');
        return;
      }

      canvas.parentElement.classList.remove('hidden');
      emptyEl.classList.add('hidden');

      chartInstance = new Chart(ctx, {
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
            y: {
              ...baseOptions.scales.y,
              suggestedMin: 55,
              suggestedMax: 70,
            },
          },
          plugins: {
            ...baseOptions.plugins,
            legend: { display: true, labels: { color: chartColors.text } },
          },
        },
      });

    } else if (type === 'sleep') {
      const sleepData = await getAllSleep();
      const data = sleepData.filter(s => s.quality);

      if (data.length === 0) {
        canvas.parentElement.classList.add('hidden');
        emptyEl.classList.remove('hidden');
        return;
      }

      canvas.parentElement.classList.remove('hidden');
      emptyEl.classList.add('hidden');

      const colors = data.map(s =>
        s.quality >= 7 ? chartColors.success :
        s.quality >= 4 ? chartColors.warning :
        chartColors.danger
      );

      chartInstance = new Chart(ctx, {
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
        canvas.parentElement.classList.add('hidden');
        emptyEl.classList.remove('hidden');
        return;
      }

      canvas.parentElement.classList.remove('hidden');
      emptyEl.classList.add('hidden');

      chartInstance = new Chart(ctx, {
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
              borderColor: chartColors.danger,
              backgroundColor: chartColors.danger + '33',
              tension: 0.3,
              yAxisID: 'y',
            },
            {
              label: 'Watts moy',
              data: bikeData.map(w => w.bikeData.wattsAvg),
              borderColor: chartColors.accent,
              backgroundColor: chartColors.accent + '33',
              tension: 0.3,
              yAxisID: 'y1',
            },
          ],
        },
        options: {
          ...baseOptions,
          plugins: {
            legend: { display: true, labels: { color: chartColors.text } },
          },
          scales: {
            x: baseOptions.scales.x,
            y: {
              ...baseOptions.scales.y,
              position: 'left',
              title: { display: true, text: 'FC (bpm)', color: chartColors.text },
            },
            y1: {
              ...baseOptions.scales.y,
              position: 'right',
              title: { display: true, text: 'Watts', color: chartColors.text },
              grid: { drawOnChartArea: false },
            },
          },
        },
      });
    }
  } catch {
    canvas.parentElement.classList.add('hidden');
    emptyEl.classList.remove('hidden');
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
