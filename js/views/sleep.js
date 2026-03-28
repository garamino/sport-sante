import { today, formatDateShort, formatDateFR, addDays, computeHoursSlept, showToast } from '../utils.js';
import { getSleep, saveSleep, getRecentSleep } from '../db.js';
import { showCoachAdvice } from '../coach.js';

let currentDate = null;

export async function render(container, resetDate = true) {
  if (resetDate || !currentDate) currentDate = today();
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const [existing, recent] = await Promise.all([
      getSleep(currentDate).catch(() => null),
      getRecentSleep(7).catch(() => []),
    ]);

    container.innerHTML = `
      <div class="date-nav">
        <button id="sleep-prev">‹</button>
        <span class="current-date">${formatDateFR(currentDate)}</span>
        <button id="sleep-next">›</button>
      </div>

      <div class="card">
        <div class="form-group">
          <label>Coucher</label>
          <input type="time" id="sleep-bedtime" value="${existing?.bedtime || ''}">
        </div>
        <div class="form-group">
          <label>Réveil</label>
          <input type="time" id="sleep-waketime" value="${existing?.wakeTime || ''}">
        </div>
        <div class="form-group">
          <label>Heures dormies</label>
          <input type="text" id="sleep-hours" placeholder="Auto-calculé (HH:MM)"
                 value="${existing?.hoursSleptHHMM || ''}">
        </div>
        <div class="form-group">
          <label>Qualité (1-10)</label>
          <input type="range" class="quality-slider" id="sleep-quality" min="1" max="10" value="${existing?.quality || 5}">
          <div class="quality-display" id="quality-display">${existing?.quality || 5}</div>
        </div>
        <div class="form-group">
          <label>Note</label>
          <textarea id="sleep-note" placeholder="Comment s'est passée ta nuit ?">${existing?.note || ''}</textarea>
        </div>

        <button class="btn btn-success" id="save-sleep">Enregistrer</button>
      </div>

      ${recent.length > 0 ? `
        <div class="section-title" style="margin-top:20px">Dernières nuits</div>
        <div class="card">
          ${recent.map(s => `
            <div class="sleep-history-item">
              <div>
                <div style="font-weight:600">${formatDateShort(s.date)}</div>
                <div style="font-size:12px;color:var(--text-secondary)">${s.hoursSleptHHMM || (s.hoursSlept ? s.hoursSlept + 'h' : '?')} · ${s.bedtime || '?'} → ${s.wakeTime || '?'}</div>
              </div>
              <span class="sleep-quality-badge ${s.quality >= 7 ? 'good' : s.quality >= 4 ? 'ok' : 'bad'}">${s.quality}/10</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;

    // Date navigation
    document.getElementById('sleep-prev').addEventListener('click', () => {
      currentDate = addDays(currentDate, -1);
      render(container, false);
    });
    document.getElementById('sleep-next').addEventListener('click', () => {
      currentDate = addDays(currentDate, 1);
      render(container, false);
    });

    // Auto-compute hours slept
    const bedtimeInput = document.getElementById('sleep-bedtime');
    const waketimeInput = document.getElementById('sleep-waketime');
    const hoursInput = document.getElementById('sleep-hours');

    function autoComputeHours() {
      const result = computeHoursSlept(bedtimeInput.value, waketimeInput.value);
      if (result.hhmm) hoursInput.value = result.hhmm;
    }
    bedtimeInput.addEventListener('change', autoComputeHours);
    waketimeInput.addEventListener('change', autoComputeHours);

    // Quality slider display
    const slider = document.getElementById('sleep-quality');
    const display = document.getElementById('quality-display');
    slider.addEventListener('input', () => {
      display.textContent = slider.value;
    });

    // Save
    document.getElementById('save-sleep').addEventListener('click', async (e) => {
      const btn = e.target;
      btn.disabled = true;
      btn.textContent = 'Enregistrement...';

      const manualHHMM = hoursInput.value.trim();
      let hoursDecimal = 0;
      let hhmm = manualHHMM;
      if (manualHHMM && manualHHMM.includes(':')) {
        const [h, m] = manualHHMM.split(':').map(Number);
        hoursDecimal = Math.round((h + m / 60) * 10) / 10;
      } else if (manualHHMM) {
        hoursDecimal = parseFloat(manualHHMM) || 0;
        const h = Math.floor(hoursDecimal);
        const m = Math.round((hoursDecimal - h) * 60);
        hhmm = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
      const data = {
        bedtime: bedtimeInput.value,
        wakeTime: waketimeInput.value,
        hoursSlept: hoursDecimal,
        hoursSleptHHMM: hhmm,
        quality: parseInt(slider.value),
        note: document.getElementById('sleep-note').value,
      };

      try {
        await saveSleep(currentDate, data);
        showToast('Sommeil enregistré ✓');
        showCoachAdvice('sleep', currentDate);
        render(container, false);
      } catch {
        showToast('Erreur — réessaie');
        btn.disabled = false;
        btn.textContent = 'Enregistrer';
      }
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Erreur</p><p style="font-size:12px">${err.message}</p></div>`;
  }
}
