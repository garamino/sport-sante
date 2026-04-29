import { today, formatDateShort, formatDateFR, addDays, computeHoursSlept, showToast } from '../utils.js';
import { getSleep, saveSleep, getRecentSleep, getAllSleep, getIntakes, getAllIntakes } from '../db.js';
import { stripMedsFromNote } from '../sleep-meds.js';

const fmtQty = q => q === '1/2' ? '½' : q === '1/4' ? '¼' : q;

let currentDate = null;

export async function render(container, resetDate = true) {
  if (resetDate || !currentDate) currentDate = today();
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const prevDate = addDays(currentDate, -1);
    const [existing, recent, prevIntakes] = await Promise.all([
      getSleep(currentDate).catch(() => null),
      getRecentSleep(7).catch(() => []),
      getIntakes(prevDate).catch(() => null),
    ]);

    const prevEntries = (prevIntakes?.entries || []).slice().sort((a, b) => {
      const ta = a.time || '', tb = b.time || '';
      if (!ta && !tb) return 0;
      if (!ta) return 1;
      if (!tb) return -1;
      return ta.localeCompare(tb);
    });

    container.innerHTML = `
      <div class="date-nav-row">
        <div class="date-nav" style="margin-bottom:0">
          <button id="sleep-prev">‹</button>
          <span class="current-date">${formatDateFR(currentDate)}</span>
          <button id="sleep-next">›</button>
        </div>
        <button class="btn-icon" id="export-sleep" title="Exporter (TSV)">⤓</button>
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

      <div class="card">
        <div class="section-title" style="margin-top:0">Prises de la veille — ${formatDateShort(prevDate)}</div>
        ${prevEntries.length === 0 ? `
          <div style="color:var(--text-secondary);font-size:13px">Aucune prise enregistrée.</div>
        ` : `
          <div>
            ${prevEntries.map(e => `
              <div class="intake-item">
                <div class="intake-item-line">
                  <span class="intake-time">${e.time || '—'}</span>
                  <span class="intake-qty">${fmtQty(e.quantity)}</span>
                  <span class="intake-product">${e.product}</span>
                </div>
              </div>
            `).join('')}
          </div>
        `}
        <a href="#/intakes" class="btn" style="margin-top:8px;display:block;text-align:center;text-decoration:none">Gérer mes prises</a>
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

    // Export TSV (toutes les nuits + prises de la veille)
    document.getElementById('export-sleep').addEventListener('click', async (e) => {
      const btn = e.target;
      btn.disabled = true;
      const oldLabel = btn.textContent;
      btn.textContent = '…';
      try {
        const [all, allIntakes] = await Promise.all([getAllSleep(), getAllIntakes()]);
        const intakesByDate = new Map();
        for (const doc of allIntakes) {
          intakesByDate.set(doc.date, (doc.entries || []).slice().sort((a, b) => (a.time || '').localeCompare(b.time || '')));
        }
        const formatIntakes = entries => (entries || []).map(en => `${en.time ? en.time + ' ' : ''}${en.product} ${fmtQty(en.quantity)}`).join(' ; ');

        const header = ['Date', 'Qualité', 'Coucher', 'Réveil', 'Heures dormies', 'Prises de la veille', 'Note'];
        const rows = all.map(s => {
          const prev = addDays(s.date, -1);
          const cleanNote = stripMedsFromNote(s.note || '').replace(/[\t\r\n]+/g, ' ');
          return [
            s.date || '',
            s.quality ?? '',
            s.bedtime || '',
            s.wakeTime || '',
            s.hoursSleptHHMM || (s.hoursSlept ? String(s.hoursSlept).replace('.', ',') : ''),
            formatIntakes(intakesByDate.get(prev)),
            cleanNote,
          ].join('\t');
        });
        const tsv = [header.join('\t'), ...rows].join('\n');
        let copied = false;
        try {
          await navigator.clipboard.writeText(tsv);
          copied = true;
        } catch {
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
        btn.textContent = oldLabel;
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
