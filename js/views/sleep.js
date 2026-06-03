import { today, formatDateShort, formatDateFR, addDays, computeHoursSlept, showToast, NIGHT_CUTOFF } from '../utils.js';
import { getSleep, saveSleep, getRecentSleep, getAllSleep, getIntakes, getAllIntakes } from '../db.js';
import { stripMedsFromNote } from '../sleep-meds.js';

const fmtQty = q => q === '1/2' ? '½' : q === '1/4' ? '¼' : q;

let currentDate = null;

export async function render(container, resetDate = true) {
  if (resetDate || !currentDate) currentDate = today();
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const prevDate = addDays(currentDate, -1);
    const [existing, recent, prevIntakes, todayIntakes] = await Promise.all([
      getSleep(currentDate).catch(() => null),
      getRecentSleep(7).catch(() => []),
      getIntakes(prevDate).catch(() => null),
      getIntakes(currentDate).catch(() => null),
    ]);

    // Prises de la nuit = soirée de D-1 (≥ NIGHT_CUTOFF) + début de nuit D (< NIGHT_CUTOFF)
    const nightEntries = [
      ...(prevIntakes?.entries  || []).filter(e => !e.time || e.time >= NIGHT_CUTOFF),
      ...(todayIntakes?.entries || []).filter(e => e.time && e.time < NIGHT_CUTOFF),
    ].sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    container.innerHTML = `
      <div class="date-nav-row">
        <div class="date-nav" style="margin-bottom:0">
          <button id="sleep-prev">‹</button>
          <span class="current-date">${formatDateFR(currentDate)}</span>
          <button id="sleep-next">›</button>
        </div>
        <button class="btn-icon" id="sleep-cal" title="Calendrier">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <rect x="1" y="3" width="14" height="12" rx="2"/>
            <line x1="1" y1="7" x2="15" y2="7"/>
            <line x1="5" y1="1" x2="5" y2="5"/>
            <line x1="11" y1="1" x2="11" y2="5"/>
          </svg>
        </button>
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
        <div class="form-group" style="position:relative">
          <label style="display:flex;align-items:center;gap:4px">
            Qualité (1-10)
            <button class="ing-info-btn" id="quality-info-btn" type="button">ⓘ</button>
          </label>
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
        <div class="section-title" style="margin-top:0">Prises de la nuit — ${formatDateShort(prevDate)}</div>
        ${nightEntries.length === 0 ? `
          <div style="color:var(--text-secondary);font-size:13px">Aucune prise enregistrée.</div>
        ` : `
          <div>
            ${nightEntries.map(e => `
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
        <a href="#/intakes" class="btn btn-secondary btn-small" style="margin-top:12px;text-decoration:none">⚙ Gérer mes prises</a>
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

    // Popover ⓘ grille de cotation
    const qualityInfoBtn = document.getElementById('quality-info-btn');
    let qualityPopover = null;
    qualityInfoBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (qualityPopover) { qualityPopover.remove(); qualityPopover = null; return; }
      const pop = document.createElement('div');
      pop.className = 'quality-info-popover';
      pop.innerHTML = `
        <table>
          <tr><td>10</td><td>&gt; 8h30 d'une traite*</td></tr>
          <tr><td>9</td><td>8h+ d'une traite*</td></tr>
          <tr><td>8</td><td>6h45+ d'une traite*</td></tr>
          <tr><td>7</td><td>6h d'une traite · 6h45+ avec micro-réveils</td></tr>
          <tr><td>6</td><td>6h + 2-3 micro-réveils · 6h45+ avec gros creux</td></tr>
          <tr><td>5</td><td>5-6h + creux &gt; 45min · 6h + réveils fréquents</td></tr>
          <tr><td>4</td><td>4-5h cumulé + grosses périodes d'éveil</td></tr>
          <tr><td>3</td><td>3-4h cumulé + grosses périodes d'éveil</td></tr>
          <tr><td>2</td><td>1h30-3h cumulé</td></tr>
          <tr><td>1</td><td>Nuit blanche ou &lt; 1h30</td></tr>
        </table>
        <div class="quality-info-note">* ou 1-2 micro-réveils avec rendormissement &lt; 3 min</div>
      `;
      qualityInfoBtn.closest('.form-group').appendChild(pop);
      qualityPopover = pop;
    });
    container.addEventListener('click', e => {
      if (qualityPopover && !e.target.closest('.quality-info-popover') && e.target.id !== 'quality-info-btn') {
        qualityPopover.remove();
        qualityPopover = null;
      }
    });

    // === Calendrier modal ===
    const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const DAYS_FR = ['L','M','M','J','V','S','D'];

    document.getElementById('sleep-cal').addEventListener('click', async e => {
      e.stopPropagation();
      let calModal = document.getElementById('sleep-cal-modal');
      if (calModal) { calModal.remove(); return; }

      let calYear = parseInt(currentDate.split('-')[0]);
      let calMonth = parseInt(currentDate.split('-')[1]) - 1;

      calModal = document.createElement('div');
      calModal.id = 'sleep-cal-modal';
      calModal.className = 'sleep-cal-modal';
      calModal.innerHTML = `<div class="sleep-cal-card"><div class="sleep-cal-loading">Chargement…</div></div>`;
      document.body.appendChild(calModal);
      calModal.addEventListener('click', ev => { if (ev.target === calModal) { calModal.remove(); } });

      const all = await getAllSleep().catch(() => []);
      const qualityMap = new Map(all.map(s => [s.date, s.quality]));
      const todayStr = today();

      function drawCal() {
        const modal = document.getElementById('sleep-cal-modal');
        if (!modal) return;
        const firstDay = new Date(calYear, calMonth, 1);
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const startDow = (firstDay.getDay() + 6) % 7;

        let cells = '';
        for (let i = 0; i < startDow; i++) cells += `<div class="sleep-cal-cell sleep-cal-empty"></div>`;
        for (let d = 1; d <= daysInMonth; d++) {
          const ds = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const q = qualityMap.get(ds);
          const qClass = q >= 7 ? 'q-good' : q >= 4 ? 'q-ok' : q ? 'q-bad' : '';
          cells += `<div class="sleep-cal-cell${ds === todayStr ? ' is-today' : ''}${ds === currentDate ? ' is-selected' : ''}" data-date="${ds}">
            <span class="sleep-cal-daynum">${d}</span>
            ${q != null ? `<span class="sleep-cal-q ${qClass}">${q}</span>` : ''}
          </div>`;
        }

        modal.querySelector('.sleep-cal-card').innerHTML = `
          <div class="sleep-cal-header">
            <button id="cal-prev">‹</button>
            <span>${MONTHS_FR[calMonth]} ${calYear}</span>
            <button id="cal-next">›</button>
          </div>
          <div class="sleep-cal-dow">${DAYS_FR.map(l => `<div>${l}</div>`).join('')}</div>
          <div class="sleep-cal-grid">${cells}</div>
          <div class="sleep-cal-legend">
            <span class="leg-good">■ 7-10</span>
            <span class="leg-ok">■ 4-6</span>
            <span class="leg-bad">■ 1-3</span>
          </div>
        `;

        document.getElementById('cal-prev').addEventListener('click', ev => {
          ev.stopPropagation();
          calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } drawCal();
        });
        document.getElementById('cal-next').addEventListener('click', ev => {
          ev.stopPropagation();
          calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } drawCal();
        });
        modal.querySelector('.sleep-cal-grid').addEventListener('click', ev => {
          const cell = ev.target.closest('[data-date]');
          if (!cell) return;
          currentDate = cell.dataset.date;
          modal.remove();
          render(container, false);
        });
      }

      drawCal();
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

        // Prises attribuées à une nuit D (réveil le jour D) — même règle que l'affichage (NIGHT_CUTOFF)
        const intakesForNight = date => {
          const prev = addDays(date, -1);
          const evening = (intakesByDate.get(prev) || []).filter(en => !en.time || en.time >= NIGHT_CUTOFF);
          const earlyMorn = (intakesByDate.get(date) || []).filter(en => en.time && en.time < NIGHT_CUTOFF);
          return [...evening, ...earlyMorn].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        };

        const header = ['Date', 'Qualité', 'Coucher', 'Réveil', 'Heures dormies', 'Prises de la nuit', 'Note'];
        const rows = all.map(s => {
          const cleanNote = stripMedsFromNote(s.note || '').replace(/[\t\r\n]+/g, ' ');
          return [
            s.date || '',
            s.quality ?? '',
            s.bedtime || '',
            s.wakeTime || '',
            s.hoursSleptHHMM || (s.hoursSlept ? String(s.hoursSlept).replace('.', ',') : ''),
            formatIntakes(intakesForNight(s.date)),
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
