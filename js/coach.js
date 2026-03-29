import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-functions.js';
import { app } from './auth.js';
import { getCoachHistory, getCoachNote, saveCoachNote, getAllCoachNotes } from './db.js';
import { today, formatDateFR, showToast } from './utils.js';

const functions = getFunctions(app, 'europe-west1');
const getCoachAdviceFn = httpsCallable(functions, 'getCoachAdvice');

/**
 * Show coach advice as a floating overlay after a save event.
 * Non-blocking: call this after save without awaiting.
 * @param {string} trigger - 'workout' | 'sleep' | 'weight'
 * @param {string} date - YYYY-MM-DD
 */
export function showCoachAdvice(trigger, date) {
  // Remove any existing coach overlay
  document.querySelector('.coach-overlay')?.remove();

  // Create floating overlay at bottom of screen
  const overlay = document.createElement('div');
  overlay.className = 'coach-overlay';
  overlay.innerHTML = `
    <div class="coach-card">
      <button class="coach-close">&times;</button>
      <div class="coach-header">
        <span class="coach-icon">🐻</span>
        <span class="coach-label">Coach IA</span>
      </div>
      <div class="coach-message">
        <div class="coach-loading"><span></span><span></span><span></span></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Close button
  overlay.querySelector('.coach-close').addEventListener('click', () => overlay.remove());

  // Fetch advice
  (async () => {
    try {
      const result = await getCoachAdviceFn({ trigger, date });
      const data = result.data;
      const messageEl = overlay.querySelector('.coach-message');

      if (!messageEl) return; // overlay was closed

      if (data.error === 'no_api_key') {
        messageEl.innerHTML = `<p class="coach-text">Configure ta clé API Claude dans le <a href="#/dashboard" style="color:var(--accent)">Dashboard</a> pour activer le coach.</p>`;
        return;
      }

      if (data.error === 'rate_limit') {
        messageEl.innerHTML = `<p class="coach-text">${data.message}</p>`;
        return;
      }

      if (data.error === 'invalid_api_key') {
        messageEl.innerHTML = `<p class="coach-text" style="color:var(--danger)">Clé API invalide. Vérifie-la dans le Dashboard.</p>`;
        return;
      }

      if (data.advice) {
        messageEl.innerHTML = `<p class="coach-text">${formatAdvice(data.advice)}</p>`;
      } else {
        overlay.remove();
      }
    } catch (err) {
      console.warn('Coach advice error:', err.message, err);
      const messageEl = overlay.querySelector('.coach-message');
      if (messageEl) {
        messageEl.innerHTML = `<p class="coach-text" style="color:var(--danger)">Erreur : ${err.message || 'Impossible de contacter le coach.'}</p>`;
      } else {
        overlay.remove();
      }
    }
  })();
}

function formatAdvice(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}

const TRIGGER_LABELS = {
  workout: 'Séance',
  sleep: 'Sommeil',
  weight: 'Poids',
};

function formatCoachDate(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export async function openCoachHistory() {
  const overlay = document.createElement('div');
  overlay.className = 'guide-modal-overlay';
  overlay.innerHTML = `
    <div class="guide-modal">
      <button class="guide-modal-close">&times;</button>
      <h3 style="font-size:16px;margin-bottom:4px">🐻 Historique Coach IA</h3>
      <p style="font-size:11px;color:var(--text-secondary);margin-bottom:14px;text-transform:uppercase;letter-spacing:0.5px">5 dernières interactions</p>
      <div class="spinner"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('.guide-modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  try {
    const history = await getCoachHistory();
    const content = overlay.querySelector('.guide-modal');

    if (history.length === 0) {
      content.innerHTML = `
        <button class="guide-modal-close">&times;</button>
        <h3 style="font-size:16px;margin-bottom:14px">🐻 Historique Coach IA</h3>
        <p style="color:var(--text-secondary);font-size:13px;text-align:center;padding:20px 0">
          Aucune interaction pour le moment.<br>Clique sur "Consulter" pour démarrer.
        </p>
      `;
    } else {
      content.innerHTML = `
        <button class="guide-modal-close">&times;</button>
        <h3 style="font-size:16px;margin-bottom:4px">🐻 Historique Coach IA</h3>
        <p style="font-size:11px;color:var(--text-secondary);margin-bottom:14px;text-transform:uppercase;letter-spacing:0.5px">5 dernières interactions</p>
        <div class="coach-history-list">
          ${history.map(h => `
            <div class="coach-history-item">
              <div class="coach-history-meta">
                <span class="coach-history-date">${formatCoachDate(h.date)}</span>
                <span class="coach-history-trigger">${TRIGGER_LABELS[h.trigger] || h.trigger}</span>
              </div>
              <p class="coach-history-advice">${formatAdvice(h.advice)}</p>
            </div>
          `).join('')}
        </div>
      `;
    }

    content.querySelector('.guide-modal-close').addEventListener('click', close);
  } catch (err) {
    overlay.remove();
  }
}

export async function openCoachNotesModal(defaultDate) {
  const overlay = document.createElement('div');
  overlay.className = 'guide-modal-overlay';
  overlay.innerHTML = `
    <div class="guide-modal">
      <button class="guide-modal-close">&times;</button>
      <h3 style="font-size:16px;margin-bottom:4px">Notes pour le coach</h3>
      <p style="font-size:12px;color:var(--text-secondary);margin-bottom:14px">
        Informe le coach de tes blessures, douleurs, objectifs ou contraintes. Il en tiendra compte à chaque conseil.
      </p>
      <div class="form-group" style="margin-bottom:8px">
        <label style="font-size:12px;color:var(--text-secondary)">Date de la note</label>
        <input type="date" id="coach-note-date" value="${defaultDate || today()}">
      </div>
      <textarea id="coach-notes" placeholder="Ex: Douleur poignet droit, tendinite en récupération, objectif 65kg..." rows="3"></textarea>
      <button class="btn btn-primary btn-small" id="save-coach-notes" style="margin-top:8px;width:100%">Sauvegarder la note</button>
      <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:12px">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-primary)">Historique des notes</div>
        <div id="coach-notes-history" class="coach-notes-history">
          <div class="spinner"></div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('.guide-modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  // Load note for default date
  const note = await getCoachNote(defaultDate || today()).catch(() => null);
  const textarea = overlay.querySelector('#coach-notes');
  if (note?.text) textarea.value = note.text;

  // Change date → load that note
  overlay.querySelector('#coach-note-date').addEventListener('change', async (e) => {
    const date = e.target.value;
    if (!date) return;
    const n = await getCoachNote(date).catch(() => null);
    textarea.value = n?.text || '';
  });

  // Save
  overlay.querySelector('#save-coach-notes').addEventListener('click', async (e) => {
    const btn = e.target;
    const date = overlay.querySelector('#coach-note-date').value;
    const text = textarea.value.trim();
    if (!date) { showToast('Choisis une date'); return; }
    if (!text) { showToast('La note est vide'); return; }
    btn.disabled = true;
    try {
      await saveCoachNote(date, text);
      showToast('Note sauvegardée ✓');
      loadHistory();
    } catch {
      showToast('Erreur — réessaie');
    }
    btn.disabled = false;
  });

  // Load history
  async function loadHistory() {
    const container = overlay.querySelector('#coach-notes-history');
    if (!container) return;
    try {
      const notes = await getAllCoachNotes();
      if (notes.length === 0) {
        container.innerHTML = '<p style="font-size:13px;color:var(--text-secondary);text-align:center;padding:8px 0">Aucune note pour le moment.</p>';
        return;
      }
      container.innerHTML = notes.map(n => `
        <div class="coach-note-item" data-date="${n.date}">
          <div class="coach-note-date">${formatDateFR(n.date)}</div>
          <p class="coach-note-text">${n.text.replace(/\n/g, '<br>')}</p>
        </div>
      `).join('');
      container.querySelectorAll('.coach-note-item').forEach(item => {
        item.addEventListener('click', () => {
          overlay.querySelector('#coach-note-date').value = item.dataset.date;
          const n = notes.find(x => x.date === item.dataset.date);
          textarea.value = n?.text || '';
          textarea.focus();
        });
      });
    } catch {
      container.innerHTML = '<p style="font-size:13px;color:var(--danger)">Erreur de chargement</p>';
    }
  }
  loadHistory();
}
