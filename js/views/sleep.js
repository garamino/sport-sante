import { today, formatDateShort, formatDateFR, addDays, computeHoursSlept, showToast } from '../utils.js';
import { getSleep, saveSleep, getRecentSleep, getAllSleep } from '../db.js';
import { resolveMeds, stripMedsFromNote } from '../sleep-meds.js';

let currentDate = null;

export async function render(container, resetDate = true) {
  if (resetDate || !currentDate) currentDate = today();
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const [existing, recent] = await Promise.all([
      getSleep(currentDate).catch(() => null),
      getRecentSleep(7).catch(() => []),
    ]);

    const meds = resolveMeds(existing);

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
          <label>Metasleep</label>
          <select id="sleep-metasleep">
            <option value=""${meds.metasleep === '' ? ' selected' : ''}>—</option>
            <option value="1/2"${meds.metasleep === '1/2' ? ' selected' : ''}>1/2</option>
            <option value="1"${meds.metasleep === '1' ? ' selected' : ''}>1</option>
          </select>
        </div>
        <div class="form-group">
          <label>Trazodone</label>
          <select id="sleep-trazodone">
            <option value=""${meds.trazodone === '' ? ' selected' : ''}>—</option>
            <option value="1/4"${meds.trazodone === '1/4' ? ' selected' : ''}>1/4</option>
            <option value="1/2"${meds.trazodone === '1/2' ? ' selected' : ''}>1/2</option>
          </select>
        </div>
        <div class="form-group">
          <label>Stilnoct</label>
          <select id="sleep-stilnoct">
            <option value=""${meds.stilnoct === '' ? ' selected' : ''}>—</option>
            <option value="1/2"${meds.stilnoct === '1/2' ? ' selected' : ''}>1/2</option>
          </select>
        </div>
        <div class="form-group">
          <label>Note</label>
          <textarea id="sleep-note" placeholder="Comment s'est passée ta nuit ?">${existing?.note || ''}</textarea>
        </div>

        <button class="btn btn-success" id="save-sleep">Enregistrer</button>
        <button class="btn" id="export-sleep" style="margin-top:8px;width:100%">Exporter (TSV)</button>
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

    // Export TSV
    document.getElementById('export-sleep').addEventListener('click', async (e) => {
      const btn = e.target;
      btn.disabled = true;
      btn.textContent = 'Export...';
      try {
        const all = await getAllSleep();
        const header = ['Date', 'Qualité', 'Coucher', 'Réveil', 'Heures dormies', 'Metasleep', 'Trazodone', 'Stilnoct', 'Note'];
        const fmtDose = v => v === '1/2' ? '½' : v === '1/4' ? '¼' : v;
        const rows = all.map(s => {
          const m = resolveMeds(s);
          const cleanNote = stripMedsFromNote(s.note || '').replace(/[\t\r\n]+/g, ' ');
          return [
            s.date || '',
            s.quality ?? '',
            s.bedtime || '',
            s.wakeTime || '',
            s.hoursSleptHHMM || (s.hoursSlept ? String(s.hoursSlept).replace('.', ',') : ''),
            fmtDose(m.metasleep),
            fmtDose(m.trazodone),
            fmtDose(m.stilnoct),
            cleanNote,
          ].join('\t');
        });
        const tsv = [header.join('\t'), ...rows].join('\n');
        let copied = false;
        try {
          await navigator.clipboard.writeText(tsv);
          copied = true;
        } catch {
          // Fallback 1 : execCommand sur textarea temporaire
          const ta = document.createElement('textarea');
          ta.value = tsv;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          try { copied = document.execCommand('copy'); } catch { copied = false; }
          document.body.removeChild(ta);
        }
        if (copied) {
          showToast(`${all.length} nuits copiées ✓`);
        } else {
          // Fallback 2 : téléchargement
          const blob = new Blob([tsv], { type: 'text/tab-separated-values;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `sommeil_${today()}.tsv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showToast(`${all.length} nuits téléchargées ✓`);
        }
      } catch (err) {
        showToast('Erreur export — ' + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Exporter (TSV)';
      }
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
        meds: {
          metasleep: document.getElementById('sleep-metasleep').value,
          trazodone: document.getElementById('sleep-trazodone').value,
          stilnoct:  document.getElementById('sleep-stilnoct').value,
        },
      };

      try {
        await saveSleep(currentDate, data);
        showToast('Sommeil enregistré ✓');
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
