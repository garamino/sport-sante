import { today, formatDateFR, addDays, showToast, getDefaultLevel, formatSetsReps, formatRest, formatWeight } from '../utils.js';
import { getWorkout, saveWorkout, getExerciseHistory, getWorkoutTemplates, saveWorkoutTemplate, getWorkoutTemplate, getExercise, getExercises, getAllWorkouts } from '../db.js';
import { getGuideKey, openExerciseGuide } from '../exercise-guide.js';
import { importLatestCyclingActivity, importLatestStrengthActivity } from '../strava.js';
import { startSessionTimer } from '../workout-timer.js';

// Niveau par défaut d'un exercice (affichage séance).
const _lvl = (ex) => getDefaultLevel(ex);

let currentDate = null;
let _ws = null; // état mutable des sessions du jour
let _seedDone = false; // seeding des templates spéciaux fait une seule fois

export async function render(container, resetDate = true) {
  if (resetDate || !currentDate) currentDate = today();
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const existing = await getWorkout(currentDate);

    container.innerHTML = `
      <div class="date-nav-row">
        <div class="date-nav" style="margin-bottom:0">
          <button id="prev-day">‹</button>
          <span class="current-date">${formatDateFR(currentDate)}</span>
          <button id="next-day">›</button>
        </div>
        <button class="btn-icon" id="open-calendar" title="Calendrier">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <rect x="1" y="3" width="14" height="12" rx="2"/>
            <line x1="1" y1="7" x2="15" y2="7"/>
            <line x1="5" y1="1" x2="5" y2="5"/>
            <line x1="11" y1="1" x2="11" y2="5"/>
          </svg>
        </button>
        <a href="#/library" class="btn-icon" title="Bibliothèque" style="display:flex;align-items:center;justify-content:center;text-decoration:none;color:var(--text-secondary)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
        </a>
      </div>

      <button class="btn btn-start-session" id="start-session-timer" style="width:100%;margin-bottom:12px;background:var(--accent);color:#04141f;border:none;font-weight:600">▶ Démarrer la séance (chrono)</button>

      <div id="workout-body"></div>
    `;

    document.getElementById('start-session-timer').addEventListener('click', () => startSessionTimer());

    // Date navigation
    document.getElementById('prev-day').addEventListener('click', () => {
      currentDate = addDays(currentDate, -1);
      render(container, false);
    });
    document.getElementById('next-day').addEventListener('click', () => {
      currentDate = addDays(currentDate, 1);
      render(container, false);
    });

    // Calendrier modal
    const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const DAYS_FR = ['L','M','M','J','V','S','D'];

    document.getElementById('open-calendar').addEventListener('click', async e => {
      e.stopPropagation();
      let calModal = document.getElementById('workout-cal-modal');
      if (calModal) { calModal.remove(); return; }

      let calYear = parseInt(currentDate.split('-')[0]);
      let calMonth = parseInt(currentDate.split('-')[1]) - 1;

      calModal = document.createElement('div');
      calModal.id = 'workout-cal-modal';
      calModal.className = 'sleep-cal-modal';
      calModal.innerHTML = `<div class="sleep-cal-card"><div class="sleep-cal-loading">Chargement…</div></div>`;
      document.body.appendChild(calModal);
      calModal.addEventListener('click', ev => { if (ev.target === calModal) { calModal.remove(); } });

      const all = await getAllWorkouts().catch(() => []);
      const workoutDates = new Set(all.map(w => w.date));
      const todayStr = today();

      function drawCal() {
        const modal = document.getElementById('workout-cal-modal');
        if (!modal) return;
        const firstDay = new Date(calYear, calMonth, 1);
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const startDow = (firstDay.getDay() + 6) % 7;

        let cells = '';
        for (let i = 0; i < startDow; i++) cells += `<div class="sleep-cal-cell sleep-cal-empty"></div>`;
        for (let d = 1; d <= daysInMonth; d++) {
          const ds = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          cells += `<div class="sleep-cal-cell${ds === todayStr ? ' is-today' : ''}${ds === currentDate ? ' is-selected' : ''}" data-date="${ds}">
            <span class="sleep-cal-daynum">${d}</span>
            ${workoutDates.has(ds) ? `<span class="sleep-cal-q q-good" style="font-size:8px">●</span>` : ''}
          </div>`;
        }

        modal.querySelector('.sleep-cal-card').innerHTML = `
          <div class="sleep-cal-header">
            <button id="wcal-prev">‹</button>
            <span>${MONTHS_FR[calMonth]} ${calYear}</span>
            <button id="wcal-next">›</button>
          </div>
          <div class="sleep-cal-dow">${DAYS_FR.map(l => `<div>${l}</div>`).join('')}</div>
          <div class="sleep-cal-grid">${cells}</div>
        `;

        document.getElementById('wcal-prev').addEventListener('click', ev => {
          ev.stopPropagation();
          calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } drawCal();
        });
        document.getElementById('wcal-next').addEventListener('click', ev => {
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

    await renderWorkoutBody(container.querySelector('#workout-body'), existing);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Erreur</p><p style="font-size:12px">${err.message}</p></div>`;
  }
}

// ── Migration & état ─────────────────────────────────────────────────────────

function migrateToSessions(existing) {
  if (!existing) return { sessions: [] };
  if (Array.isArray(existing.sessions)) return existing;
  if (!existing.dayType && !existing.templateId) return { ...existing, sessions: [] };

  const knownTypes = ['rest', 'velo', 'course', 'marche'];
  const sessionType = knownTypes.includes(existing.dayType) ? existing.dayType : 'muscu';

  return {
    ...existing,
    sessions: [{
      id: 'legacy',
      type: sessionType,
      ...(existing.templateId  && { templateId: existing.templateId }),
      ...(existing.muscleGroup && { muscleGroup: existing.muscleGroup }),
      ...(existing.exercises   && { exercises: existing.exercises }),
      ...(existing.bikeData    && { bikeData: existing.bikeData }),
      ...(existing.cardioData  && { cardioData: existing.cardioData }),
      ...(existing.skipped !== undefined && { skipped: existing.skipped }),
    }],
  };
}

function buildWorkoutDoc(ws) {
  const sessions = ws.sessions || [];
  const primary  = sessions[0];
  const muscuS   = sessions.find(s => s.type === 'muscu');
  const veloS    = sessions.find(s => s.type === 'velo' && s.bikeData);
  const cardioS  = sessions.find(s => (s.type === 'course' || s.type === 'marche') && s.cardioData);
  // Ne jamais inclure undefined — Firestore SDK v11 rejette les champs undefined
  const doc = {
    sessions,
    skipped:         sessions.length > 0 && sessions.every(s => s.skipped),
    extraActivities: sessions.slice(1).map(s => s.type).filter(Boolean),
  };
  if (primary?.type)        doc.dayType    = primary.type;
  if (muscuS?.templateId)   doc.templateId = muscuS.templateId;
  if (muscuS?.muscleGroup)  doc.muscleGroup = muscuS.muscleGroup;
  if (muscuS?.exercises)    doc.exercises  = muscuS.exercises;
  if (veloS?.bikeData)      doc.bikeData   = veloS.bikeData;
  if (cardioS?.cardioData)  doc.cardioData = cardioS.cardioData;
  return doc;
}

async function renderWorkoutBody(body, existing) {
  _ws = migrateToSessions(existing);
  await renderSessionsList(body);
}

// ── Templates spéciaux ───────────────────────────────────────────────────────

const SPECIAL_SESSIONS = [
  { name: 'Vélo – Cardio endurance', icon: '🚴', type: 'velo' },
  { name: 'Course à pied',           icon: '🏃', type: 'course' },
  { name: 'Marche',                  icon: '🚶', type: 'marche' },
  { name: 'Repos complet',           icon: '♻️', type: 'rest' },
];

async function ensureSpecialTemplates(templates) {
  if (_seedDone) return templates;
  const existingTypes = new Set(templates.map(t => t.type).filter(Boolean));
  const missing = SPECIAL_SESSIONS.filter(s => !existingTypes.has(s.type));
  _seedDone = true;
  if (missing.length === 0) return templates;
  for (const s of missing) {
    await saveWorkoutTemplate({ ...s, exerciseIds: [] });
  }
  return getWorkoutTemplates();
}

// ── Liste multi-séances ───────────────────────────────────────────────────────

async function renderSessionsList(body) {
  const sessions = _ws.sessions || [];
  let templates = await getWorkoutTemplates();
  templates = await ensureSpecialTemplates(templates);

  // Muscu en premier (ordre alpha), puis spéciaux dans l'ordre défini
  const specialOrder = SPECIAL_SESSIONS.map(s => s.type);
  templates.sort((a, b) => {
    const ai = specialOrder.indexOf(a.type), bi = specialOrder.indexOf(b.type);
    if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
    if (ai === -1) return -1;
    if (bi === -1) return 1;
    return ai - bi;
  });

  // Pré-chargement des exercices pour les séances muscu
  const exerciseMap = {};
  for (const s of sessions) {
    if (s.type === 'muscu') {
      try {
        // Le template ne sert plus qu'au libellé/icône. La LISTE d'exercices
        // vient de la séance elle-même (snapshot figé), sinon des exercices
        // réalisés, et seulement en dernier recours du template (legacy).
        const tpl = s.templateId ? await getWorkoutTemplate(s.templateId) : null;
        let ids;
        if (Array.isArray(s.exerciseIds)) {
          ids = [...s.exerciseIds];
        } else if (Array.isArray(s.exercises) && s.exercises.length) {
          ids = s.exercises.map(e => e.id).filter(Boolean);
        } else {
          ids = tpl?.exerciseIds || [];
        }
        const exs = await Promise.all(ids.map(id => getExercise(id)));
        exerciseMap[s.id] = { tpl, exercises: exs.filter(Boolean) };
      } catch {}
    }
  }

  const pickerHTML = `
    <div class="session-picker-overlay hidden" id="session-picker-overlay">
      <div class="session-picker-sheet">
        <div class="session-picker-sheet-header">
          <span>Quelle séance ?</span>
          <button class="guide-modal-close" id="close-picker">&times;</button>
        </div>
        ${templates.map(tpl => `
          <button class="session-picker-option" data-type="${tpl.type || 'muscu'}" data-template-id="${tpl.id}">
            <span class="session-picker-icon">${tpl.icon || '💪'}</span>
            <span class="session-picker-label">${tpl.name}</span>
          </button>
        `).join('')}
        <button class="session-picker-option" data-type="free">
          <span class="session-picker-icon">🧩</span>
          <span class="session-picker-label">Séance libre (exercices à la carte)</span>
        </button>
      </div>
    </div>
  `;

  if (sessions.length === 0) {
    body.innerHTML = `
      <div class="empty-day-card">
        <div class="empty-day-icon">🏋️</div>
        <p class="empty-day-label">Aucune séance planifiée</p>
        <p style="font-size:13px;color:var(--text-secondary);margin-top:4px;margin-bottom:16px">Choisis une séance pour commencer</p>
        <button class="btn btn-primary" id="pick-session-btn">Choisir une séance</button>
      </div>
      ${pickerHTML}
    `;
  } else {
    const sessionsHTML = sessions.map(s => {
      const edata = exerciseMap[s.id] || {};
      return sessionCardHTML(s, edata.tpl, edata.exercises || []);
    }).join('');

    body.innerHTML = `
      ${sessionsHTML}
      <button class="btn" id="add-session-btn" style="width:100%;margin-top:8px;background:none;border:1px solid var(--border);color:var(--text-secondary)">
        + Ajouter une séance
      </button>
      ${pickerHTML}
    `;
  }

  // Picker open/close
  const overlay = document.getElementById('session-picker-overlay');
  const openPicker = () => overlay.classList.remove('hidden');
  const closePicker = () => overlay.classList.add('hidden');

  document.getElementById('pick-session-btn')?.addEventListener('click', openPicker);
  document.getElementById('add-session-btn')?.addEventListener('click', openPicker);
  document.getElementById('close-picker').addEventListener('click', closePicker);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closePicker(); });

  // Session picker — ajout de séance
  body.querySelectorAll('.session-picker-option').forEach(btn => {
    btn.addEventListener('click', async () => {
      closePicker();
      try {
        const type = btn.dataset.type;
        const templateId = btn.dataset.templateId;
        const sessionId = 's_' + Date.now();

        const sessionType = type === 'free' ? 'muscu' : type;
        const newSession = { id: sessionId, type: sessionType };
        if (type === 'muscu') {
          newSession.templateId = templateId;
          // Snapshot : on fige la liste d'exercices du template à la création.
          // Éditer le template plus tard n'affectera plus cette séance.
          const tpl = await getWorkoutTemplate(templateId).catch(() => null);
          newSession.exerciseIds = [...(tpl?.exerciseIds || [])];
        }
        if (type === 'free') { newSession.name = 'Séance libre'; newSession.exerciseIds = []; }

        if (type === 'rest') {
          _ws.sessions = [newSession];
        } else {
          _ws.sessions = (_ws.sessions || []).filter(s => s.type !== 'rest');
          _ws.sessions.push(newSession);
        }

        await saveWorkout(currentDate, buildWorkoutDoc(_ws));
        await renderSessionsList(body);
      } catch (err) {
        showToast('Erreur : ' + err.message);
        console.error(err);
      }
    });
  });

  // Événements par séance
  for (const s of sessions) {
    const edata = exerciseMap[s.id] || {};
    bindSessionEvents(body, s, edata.exercises || []);
  }
}

function sessionCardHTML(session, tpl, exercises) {
  const sid = session.id;
  const type = session.type;

  if (type === 'rest') {
    return `
      <div class="card session-card" data-session-id="${sid}" style="margin-bottom:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px">
          <strong>♻️ Repos complet</strong>
          <button class="btn btn-small btn-delete-session" data-session-id="${sid}" style="font-size:11px;padding:4px 8px;background:none;border:1px solid var(--border);color:var(--text-secondary)">Supprimer</button>
        </div>
        <div class="empty-state" style="padding:8px 12px 12px">
          <p style="font-size:13px;color:var(--text-secondary)">Étirements, mobilité, sommeil 7-9h</p>
        </div>
      </div>
    `;
  }

  if (type === 'velo') return bikeFormHTML(session);
  if (type === 'course' || type === 'marche') return cardioFormHTML(session);

  // muscu
  const icon = tpl?.icon || '💪';
  const name = tpl?.name || session.name || 'Séance muscu';
  const isSkipped = session.skipped;
  const eff = session.effortData || {};
  const effortBadge = (eff.caloriesBurned || eff.durationMinutes || eff.fcAvg)
    ? `<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 10px 8px;font-size:12px;color:var(--text-secondary)">
        <span style="color:#fc4c02;font-weight:600">⚡ Effort importé</span>
        ${eff.caloriesBurned  ? `<span>🔥 ${eff.caloriesBurned} cal</span>` : ''}
        ${eff.durationMinutes ? `<span>⏱️ ${eff.durationMinutes} min</span>` : ''}
        ${eff.fcAvg           ? `<span>❤️ ${eff.fcAvg} bpm</span>` : ''}
       </div>`
    : '';

  return `
    <div class="card session-card" data-session-id="${sid}" style="margin-bottom:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;padding-bottom:6px;gap:8px">
        <strong style="flex:1;min-width:0">${icon} ${name}</strong>
        ${isSkipped ? '' : `<button class="btn btn-small btn-strava-muscu" data-session-id="${sid}" title="Importer l'effort depuis Strava" style="display:flex;align-items:center;gap:5px;font-size:12px;padding:5px 10px;background:#fc4c02;color:#fff;border:none;flex-shrink:0">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/></svg>
          Strava
        </button>`}
        <button class="btn btn-small btn-delete-session" data-session-id="${sid}" style="font-size:11px;padding:4px 8px;background:none;border:1px solid var(--border);color:var(--text-secondary);flex-shrink:0">Supprimer</button>
      </div>

      ${effortBadge}

      ${isSkipped ? `<div class="skipped-banner">Séance non faite</div>` : ''}

      <div style="${isSkipped ? 'opacity:0.5;' : ''}padding:0 6px 4px">
        ${muscuFormHTML(session, exercises)}
      </div>

      ${isSkipped ? '' : `<button class="btn btn-small btn-add-exercise" data-session-id="${sid}" style="width:calc(100% - 20px);margin:0 10px 4px;background:none;border:1px dashed var(--border);color:var(--text-secondary)">+ Ajouter un exercice</button>`}

      <div style="display:flex;gap:8px;margin:10px;margin-top:4px">
        <button class="btn btn-small btn-skip-session" data-session-id="${sid}" style="background:none;border:1px solid var(--danger);color:var(--danger);flex-shrink:0">Non faite</button>
        <button class="btn btn-success btn-save-session" data-session-id="${sid}" style="flex:1">Enregistrer</button>
      </div>
    </div>
  `;
}

function bikeFormHTML(session) {
  const sid = session.id;
  const bike = session.bikeData || {};
  const isSkipped = session.skipped;

  return `
    <div class="card session-card" data-session-id="${sid}" style="margin-bottom:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;padding-bottom:0">
        <strong>🚴 Vélo – Cardio endurance</strong>
        <button class="btn btn-small btn-delete-session" data-session-id="${sid}" style="font-size:11px;padding:4px 8px;background:none;border:1px solid var(--border);color:var(--text-secondary)">Supprimer</button>
      </div>

      ${isSkipped ? `<div class="skipped-banner">Séance non faite</div>` : ''}

      <div class="bike-form ${isSkipped ? 'skipped' : ''}" style="padding:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <p style="font-size:13px;color:var(--text-secondary);margin:0">Intensité modérée · 110-128 bpm</p>
          <button class="btn btn-small btn-strava-import" data-session-id="${sid}" style="display:flex;align-items:center;gap:5px;font-size:12px;padding:5px 10px;background:#fc4c02;color:#fff;border:none">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/></svg>
            Strava
          </button>
        </div>
        <div class="form-row">
          <div class="form-group"><label>FC moyenne (bpm)</label><input type="number" id="bike-fc-${sid}" placeholder="120" value="${bike.fcAvg || ''}"></div>
          <div class="form-group"><label>FC max (bpm)</label><input type="number" id="bike-fcmax-${sid}" placeholder="150" value="${bike.fcMax || ''}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Watts moyens</label><input type="number" id="bike-watts-${sid}" placeholder="80" value="${bike.wattsAvg || ''}"></div>
          <div class="form-group"><label>Cal. dépensées</label><input type="number" id="bike-kcal-${sid}" placeholder="400" value="${bike.caloriesBurned || ''}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Durée (minutes)</label><input type="number" id="bike-duration-${sid}" placeholder="45" value="${bike.durationMinutes || ''}"></div>
          <div class="form-group"><label>Distance (km)</label><input type="number" id="bike-distance-${sid}" step="0.1" placeholder="20" value="${bike.distanceKm || ''}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>D+ (m)</label><input type="number" id="bike-elevation-${sid}" placeholder="250" value="${bike.elevationGain || ''}"></div>
          <div class="form-group"><label>Cadence (rpm)</label><input type="number" id="bike-rpm-${sid}" placeholder="80" value="${bike.rpm || ''}"></div>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin:0 10px 10px">
        <button class="btn btn-small btn-skip-session" data-session-id="${sid}" style="background:none;border:1px solid var(--danger);color:var(--danger);flex-shrink:0">Non faite</button>
        <button class="btn btn-success btn-save-session" data-session-id="${sid}" style="flex:1">Enregistrer</button>
      </div>
    </div>
  `;
}

function cardioFormHTML(session) {
  const sid = session.id;
  const type = session.type;
  const icon  = type === 'course' ? '🏃' : '🚶';
  const label = type === 'course' ? 'Course à pied' : 'Marche';
  const cardio = session.cardioData || {};
  const isSkipped = session.skipped;

  return `
    <div class="card session-card" data-session-id="${sid}" style="margin-bottom:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;padding-bottom:0">
        <strong>${icon} ${label}</strong>
        <button class="btn btn-small btn-delete-session" data-session-id="${sid}" style="font-size:11px;padding:4px 8px;background:none;border:1px solid var(--border);color:var(--text-secondary)">Supprimer</button>
      </div>

      ${isSkipped ? `<div class="skipped-banner">Séance non faite</div>` : ''}

      <div class="bike-form ${isSkipped ? 'skipped' : ''}" style="padding:10px">
        <div class="form-row">
          <div class="form-group"><label>Distance (km)</label><input type="number" id="cardio-distance-${sid}" step="0.1" placeholder="${type === 'course' ? '8' : '5'}" value="${cardio.distanceKm || ''}"></div>
          <div class="form-group"><label>Durée (min)</label><input type="number" id="cardio-duration-${sid}" placeholder="${type === 'course' ? '45' : '60'}" value="${cardio.durationMinutes || ''}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>FC moyenne (bpm)</label><input type="number" id="cardio-fc-${sid}" placeholder="${type === 'course' ? '155' : '110'}" value="${cardio.fcAvg || ''}"></div>
          <div class="form-group"><label>Cal. dépensées</label><input type="number" id="cardio-kcal-${sid}" placeholder="${type === 'course' ? '500' : '300'}" value="${cardio.caloriesBurned || ''}"></div>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin:0 10px 10px">
        <button class="btn btn-small btn-skip-session" data-session-id="${sid}" style="background:none;border:1px solid var(--danger);color:var(--danger);flex-shrink:0">Non faite</button>
        <button class="btn btn-success btn-save-session" data-session-id="${sid}" style="flex:1">Enregistrer</button>
      </div>
    </div>
  `;
}

function muscuFormHTML(session, exercises) {
  const sid = session.id;
  const isSkipped = session.skipped;
  const removable = new Set(session.exerciseIds || []);

  if (exercises.length === 0) {
    return `<div class="empty-state" style="padding:12px"><p style="color:var(--text-secondary);font-size:13px">Aucun exercice — ajoute-en un ci-dessous</p></div>`;
  }

  return exercises.map((ex, i) => {
    const saved = session.exercises?.find(e => e.id === ex.id);
    const done = saved?.done || false;
    const note = saved?.note || '';
    const cardClass = isSkipped ? 'skipped' : (done ? 'done' : '');

    // Valeurs pré-remplies : ce qui a été enregistré pour CETTE séance, sinon le
    // niveau par défaut de la bibliothèque. (?? pour préserver 0.)
    const lvl    = _lvl(ex);
    const sets   = saved?.sets   ?? lvl.sets;
    const reps   = saved?.reps   ?? lvl.reps;
    const rest   = saved?.rest   ?? lvl.rest;
    const weight = saved?.weight ?? lvl.weight;

    return `
      <div class="exercise-card ${cardClass}" id="card-${sid}-${i}">
        <div class="exercise-header">
          <input type="checkbox" class="exercise-checkbox" id="ex-done-${sid}-${i}" ${done ? 'checked' : ''}>
          <div class="exercise-info">
            <div class="exercise-name">
              ${ex.name}${isSkipped ? '<span class="skipped-badge">Pas fait</span>' : ''}
              ${getGuideKey(ex) ? `<button class="exercise-guide-btn" data-exercise-id="${getGuideKey(ex)}" title="Comment faire">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
              </button>` : ''}
              <button class="exercise-history-btn" data-exercise-id="${ex.id}" data-exercise-name="${ex.name}" title="Historique">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </button>
            </div>
            <div class="exercise-details">${ex.notes || ''}</div>
            <div class="session-ex-fields" data-level="${lvl.level}">
              <span class="session-ex-level" title="Niveau chargé depuis la bibliothèque">Niveau ${lvl.level}</span>
              <label>Séries<input type="number" inputmode="numeric" min="0" step="1" id="ex-sets-${sid}-${i}" value="${sets}"></label>
              <label>Reps<input type="number" inputmode="numeric" min="0" step="1" id="ex-reps-${sid}-${i}" value="${reps}"></label>
              <label>Repos (s)<input type="number" inputmode="numeric" min="0" step="5" id="ex-rest-${sid}-${i}" value="${rest}"></label>
              <label>Charge (kg)<input type="number" inputmode="decimal" min="0" step="0.5" id="ex-weight-${sid}-${i}" value="${weight}"></label>
            </div>
          </div>
          ${!isSkipped && removable.has(ex.id) ? `<button class="btn-remove-exercise" data-ex-id="${ex.id}" title="Retirer l'exercice" style="background:none;border:none;color:var(--text-secondary);font-size:20px;line-height:1;cursor:pointer;padding:0 4px 0 6px;align-self:flex-start">&times;</button>` : ''}
        </div>
        <div class="exercise-note">
          <textarea id="ex-note-${sid}-${i}" placeholder="Note perso..." rows="1">${note}</textarea>
        </div>
      </div>
    `;
  }).join('');
}

function bindSessionEvents(body, session, exercises) {
  const sid = session.id;
  const type = session.type;
  const card = body.querySelector(`.session-card[data-session-id="${sid}"]`);
  if (!card) return;

  // Supprimer la séance
  card.querySelector(`.btn-delete-session[data-session-id="${sid}"]`)?.addEventListener('click', async () => {
    _ws.sessions = _ws.sessions.filter(s => s.id !== sid);
    await saveWorkout(currentDate, buildWorkoutDoc(_ws));
    showToast('Séance supprimée');
    await renderSessionsList(body);
  });

  // Marquer non faite
  card.querySelector(`.btn-skip-session[data-session-id="${sid}"]`)?.addEventListener('click', async () => {
    const idx = _ws.sessions.findIndex(s => s.id === sid);
    if (idx !== -1) _ws.sessions[idx] = { ..._ws.sessions[idx], skipped: true };
    await saveWorkout(currentDate, buildWorkoutDoc(_ws));
    showToast('Séance marquée non faite');
    await renderSessionsList(body);
  });

  // Enregistrer la séance
  card.querySelector(`.btn-save-session[data-session-id="${sid}"]`)?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Enregistrement...';
    try {
      const idx = _ws.sessions.findIndex(s => s.id === sid);
      if (idx !== -1) {
        let updated = { ..._ws.sessions[idx], skipped: false };

        if (type === 'velo') {
          updated.bikeData = {
            fcAvg:           parseInt(card.querySelector(`#bike-fc-${sid}`)?.value)         || 0,
            fcMax:           parseInt(card.querySelector(`#bike-fcmax-${sid}`)?.value)      || 0,
            wattsAvg:        parseInt(card.querySelector(`#bike-watts-${sid}`)?.value)      || 0,
            caloriesBurned:  parseInt(card.querySelector(`#bike-kcal-${sid}`)?.value)       || 0,
            durationMinutes: parseInt(card.querySelector(`#bike-duration-${sid}`)?.value)   || 0,
            distanceKm:      parseFloat(card.querySelector(`#bike-distance-${sid}`)?.value) || 0,
            elevationGain:   parseInt(card.querySelector(`#bike-elevation-${sid}`)?.value)  || 0,
            rpm:             parseInt(card.querySelector(`#bike-rpm-${sid}`)?.value)         || 0,
          };
        } else if (type === 'course' || type === 'marche') {
          updated.cardioData = {
            distanceKm:      parseFloat(card.querySelector(`#cardio-distance-${sid}`)?.value) || 0,
            durationMinutes: parseInt(card.querySelector(`#cardio-duration-${sid}`)?.value)   || 0,
            fcAvg:           parseInt(card.querySelector(`#cardio-fc-${sid}`)?.value)          || 0,
            caloriesBurned:  parseInt(card.querySelector(`#cardio-kcal-${sid}`)?.value)        || 0,
          };
        } else if (type === 'muscu') {
          const readNum = (sel, def) => {
            const el = card.querySelector(sel);
            if (!el) return def;
            const raw = String(el.value).trim();
            if (raw === '') return def;
            const n = Number(raw.replace(',', '.'));
            return Number.isFinite(n) ? n : def;
          };
          updated.exercises = exercises.map((ex, i) => {
            const lvl = _lvl(ex);
            return {
              id:     ex.id,
              name:   ex.name,
              done:   card.querySelector(`#ex-done-${sid}-${i}`)?.checked || false,
              note:   card.querySelector(`#ex-note-${sid}-${i}`)?.value   || '',
              // Valeurs réalisées pour cette séance (n'affectent pas la bibliothèque)
              sets:   Math.max(0, Math.round(readNum(`#ex-sets-${sid}-${i}`, lvl.sets))),
              reps:   Math.max(0, Math.round(readNum(`#ex-reps-${sid}-${i}`, lvl.reps))),
              rest:   Math.max(0, Math.round(readNum(`#ex-rest-${sid}-${i}`, lvl.rest))),
              weight: Math.max(0, readNum(`#ex-weight-${sid}-${i}`, lvl.weight)),
              level:  lvl.level,
            };
          });
        }

        _ws.sessions[idx] = updated;
      }

      await saveWorkout(currentDate, buildWorkoutDoc(_ws));
      showToast('Séance enregistrée ✓');
    } catch {
      showToast('Erreur — réessaie');
    }
    btn.disabled = false;
    btn.textContent = 'Enregistrer';
  });

  // Boutons guide exercice
  card.querySelectorAll('.exercise-guide-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openExerciseGuide(btn.dataset.exerciseId);
    });
  });

  // Boutons historique exercice
  card.querySelectorAll('.exercise-history-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      openExerciseHistory(btn.dataset.exerciseId, btn.dataset.exerciseName, currentDate);
    });
  });

  // Case à cocher exercice
  card.querySelectorAll('.exercise-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      cb.closest('.exercise-card')?.classList.toggle('done', cb.checked);
    });
  });

  // Ajouter un exercice (modale bibliothèque)
  card.querySelector(`.btn-add-exercise[data-session-id="${sid}"]`)?.addEventListener('click', () => {
    openExercisePicker(body, session, exercises.map(e => e.id));
  });

  // Retirer un exercice ajouté à la carte
  card.querySelectorAll('.btn-remove-exercise').forEach(btn => {
    btn.addEventListener('click', async () => {
      const exId = btn.dataset.exId;
      session.exerciseIds = (session.exerciseIds || []).filter(id => id !== exId);
      await saveWorkout(currentDate, buildWorkoutDoc(_ws));
      showToast('Exercice retiré');
      await renderSessionsList(body);
    });
  });

  // Import Strava (vélo uniquement)
  if (type === 'velo') {
    card.querySelector(`.btn-strava-import[data-session-id="${sid}"]`)?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = 'Chargement...';
      try {
        const bikeData = await importLatestCyclingActivity(currentDate);
        if (!bikeData) {
          showToast('Aucune sortie vélo trouvée sur Strava pour cette date');
          return;
        }
        if (bikeData.fcAvg)           card.querySelector(`#bike-fc-${sid}`).value         = bikeData.fcAvg;
        if (bikeData.fcMax)           card.querySelector(`#bike-fcmax-${sid}`).value      = bikeData.fcMax;
        if (bikeData.wattsAvg)        card.querySelector(`#bike-watts-${sid}`).value      = bikeData.wattsAvg;
        if (bikeData.caloriesBurned)  card.querySelector(`#bike-kcal-${sid}`).value       = bikeData.caloriesBurned;
        if (bikeData.durationMinutes) card.querySelector(`#bike-duration-${sid}`).value   = bikeData.durationMinutes;
        if (bikeData.distanceKm)      card.querySelector(`#bike-distance-${sid}`).value   = bikeData.distanceKm;
        if (bikeData.elevationGain)   card.querySelector(`#bike-elevation-${sid}`).value  = bikeData.elevationGain;
        if (bikeData.rpm)             card.querySelector(`#bike-rpm-${sid}`).value         = bikeData.rpm;
        showToast(`Importé depuis Strava : ${bikeData.stravaActivityName || 'Sortie vélo'} ✓`);
      } catch (err) {
        if (err.code === 'not_connected') {
          showToast('Connecte ton compte Strava dans les paramètres ⚙️');
        } else {
          showToast(err.message || 'Erreur import Strava');
        }
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/></svg> Strava`;
      }
    });
  }

  // Import Strava (renforcement musculaire) — récupère l'effort (durée, FC, calories)
  if (type === 'muscu') {
    card.querySelector(`.btn-strava-muscu[data-session-id="${sid}"]`)?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = 'Chargement...';
      try {
        const effort = await importLatestStrengthActivity(currentDate);
        if (!effort) {
          showToast('Aucune séance de renfo trouvée sur Strava pour cette date');
          return;
        }
        const idx = _ws.sessions.findIndex(s => s.id === sid);
        if (idx !== -1) {
          _ws.sessions[idx] = { ..._ws.sessions[idx], effortData: effort };
          await saveWorkout(currentDate, buildWorkoutDoc(_ws));
          showToast(`Effort importé : ${effort.stravaActivityName || 'Renforcement'} ✓`);
          await renderSessionsList(body);
        }
      } catch (err) {
        if (err.code === 'not_connected') {
          showToast('Connecte ton compte Strava dans les paramètres ⚙️');
        } else {
          showToast(err.message || 'Erreur import Strava');
        }
        btn.disabled = false;
        btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/></svg> Strava`;
      }
    });
  }
}

async function openExercisePicker(body, session, existingIds = []) {
  const overlay = document.createElement('div');
  overlay.className = 'session-picker-overlay';
  overlay.innerHTML = `
    <div class="session-picker-sheet">
      <div class="session-picker-sheet-header">
        <span>Ajouter un exercice</span>
        <button class="guide-modal-close" id="close-ex-picker">&times;</button>
      </div>
      <input type="text" id="ex-picker-search" placeholder="Rechercher un exercice…" autocomplete="off"
        style="width:calc(100% - 20px);margin:0 10px 8px;padding:9px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:14px">
      <div id="ex-picker-list"><div class="spinner"></div></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('#close-ex-picker').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  let all = [];
  try {
    all = await getExercises();
  } catch {
    overlay.querySelector('#ex-picker-list').innerHTML = `<p style="padding:12px;color:var(--text-secondary);font-size:13px">Erreur de chargement de la bibliothèque</p>`;
    return;
  }

  const exclude = new Set(existingIds);
  const available = all.filter(ex => !exclude.has(ex.id));
  const listEl = overlay.querySelector('#ex-picker-list');

  function draw(filter = '') {
    const q = filter.trim().toLowerCase();
    const items = available.filter(ex => !q || (ex.name || '').toLowerCase().includes(q));
    if (items.length === 0) {
      const msg = available.length === 0 ? 'Tous les exercices sont déjà dans la séance' : 'Aucun exercice trouvé';
      listEl.innerHTML = `<p style="padding:12px;color:var(--text-secondary);font-size:13px">${msg}</p>`;
      return;
    }
    listEl.innerHTML = items.map(ex => `
      <button class="session-picker-option" data-ex-id="${ex.id}">
        <span class="session-picker-icon">💪</span>
        <span class="session-picker-label">${ex.name}</span>
      </button>
    `).join('');
    listEl.querySelectorAll('.session-picker-option').forEach(btn => {
      btn.addEventListener('click', async () => {
        const exId = btn.dataset.exId;
        session.exerciseIds = [...(session.exerciseIds || []), exId];
        close();
        try {
          await saveWorkout(currentDate, buildWorkoutDoc(_ws));
          showToast('Exercice ajouté ✓');
          await renderSessionsList(body);
        } catch (err) {
          showToast('Erreur : ' + err.message);
        }
      });
    });
  }

  draw();
  const search = overlay.querySelector('#ex-picker-search');
  search.addEventListener('input', () => draw(search.value));
  search.focus();
}

async function openExerciseHistory(exerciseId, exerciseName, date) {
  const overlay = document.createElement('div');
  overlay.className = 'guide-modal-overlay';
  overlay.innerHTML = `
    <div class="guide-modal">
      <button class="guide-modal-close">&times;</button>
      <h3 style="font-size:16px;margin-bottom:14px">${exerciseName}</h3>
      <div class="spinner"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('.guide-modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  try {
    const history = await getExerciseHistory(exerciseId, date, 5);
    const content = overlay.querySelector('.guide-modal');

    if (history.length === 0) {
      content.innerHTML = `
        <button class="guide-modal-close">&times;</button>
        <h3 style="font-size:16px;margin-bottom:14px">${exerciseName}</h3>
        <p style="color:var(--text-secondary);font-size:13px;text-align:center;padding:20px 0">Aucun historique trouvé</p>
      `;
    } else {
      content.innerHTML = `
        <button class="guide-modal-close">&times;</button>
        <h3 style="font-size:16px;margin-bottom:4px">${exerciseName}</h3>
        <p style="font-size:11px;color:var(--text-secondary);margin-bottom:14px;text-transform:uppercase;letter-spacing:0.5px">5 dernières séances</p>
        <div class="history-list">
          ${history.map(h => {
            const perf = (h.sets != null && h.reps != null)
              ? `${h.sets} × ${h.reps}${h.weight ? ` · ${h.weight} kg` : ''}`
              : '';
            return `
            <div class="history-item">
              <span class="history-date">${formatDateFR(h.date)}</span>
              ${perf ? `<span class="history-perf">${perf}</span>` : ''}
              <span class="history-note">${h.note || '—'}</span>
            </div>
          `;
          }).join('')}
        </div>
      `;
    }
    content.querySelector('.guide-modal-close').addEventListener('click', close);
  } catch {
    overlay.remove();
  }
}
