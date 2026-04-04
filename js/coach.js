import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-functions.js';
import { app } from './auth.js';
import { getCoachHistory, saveCoachNote, deleteCoachNote, getAllCoachNotes } from './db.js';
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

  // Create floating overlay with optional user message input
  const overlay = document.createElement('div');
  overlay.className = 'coach-overlay';
  overlay.innerHTML = `
    <div class="coach-card">
      <button class="coach-close">&times;</button>
      <div class="coach-header">
        <span class="coach-icon">🐻</span>
        <span class="coach-label">Coach IA</span>
      </div>
      <div class="coach-input-zone">
        <textarea class="coach-user-input" placeholder="Une question, une douleur, un ressenti ? (optionnel)" maxlength="300" rows="2"></textarea>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
          <span class="coach-char-count" style="font-size:11px;color:var(--text-secondary)">0/300</span>
          <button class="btn btn-primary btn-small coach-send-btn" style="padding:6px 16px;font-size:13px">Envoyer</button>
        </div>
      </div>
      <div class="coach-message hidden">
        <div class="coach-loading"><span></span><span></span><span></span></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Close button
  overlay.querySelector('.coach-close').addEventListener('click', () => overlay.remove());

  // Char counter
  const textarea = overlay.querySelector('.coach-user-input');
  const counter = overlay.querySelector('.coach-char-count');
  textarea.addEventListener('input', () => {
    counter.textContent = `${textarea.value.length}/300`;
  });

  // Send button
  overlay.querySelector('.coach-send-btn').addEventListener('click', () => {
    const userMessage = textarea.value.trim() || null;
    const inputZone = overlay.querySelector('.coach-input-zone');
    const messageZone = overlay.querySelector('.coach-message');
    inputZone.classList.add('hidden');
    messageZone.classList.remove('hidden');
    fetchCoachAdvice(overlay, trigger, date, userMessage);
  });
}

async function fetchCoachAdvice(overlay, trigger, date, userMessage) {
  try {
    const result = await getCoachAdviceFn({ trigger, date, userMessage });
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
      <button class="btn btn-primary btn-small" id="save-coach-notes" style="margin-top:8px;width:100%">Ajouter la note</button>
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

  const textarea = overlay.querySelector('#coach-notes');

  // Save → creates a new note each time
  overlay.querySelector('#save-coach-notes').addEventListener('click', async (e) => {
    const btn = e.target;
    const date = overlay.querySelector('#coach-note-date').value;
    const text = textarea.value.trim();
    if (!date) { showToast('Choisis une date'); return; }
    if (!text) { showToast('La note est vide'); return; }
    btn.disabled = true;
    try {
      await saveCoachNote(date, text);
      showToast('Note ajoutée ✓');
      textarea.value = '';
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
        <div class="coach-note-item">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div class="coach-note-date">${formatDateFR(n.date)}</div>
            <button class="coach-note-delete" data-id="${n.id}" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;padding:2px 4px;font-size:14px;opacity:0.6">&times;</button>
          </div>
          <p class="coach-note-text">${n.text.replace(/\n/g, '<br>')}</p>
        </div>
      `).join('');
      // Delete buttons
      container.querySelectorAll('.coach-note-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          try {
            await deleteCoachNote(id);
            showToast('Note supprimée');
            loadHistory();
          } catch {
            showToast('Erreur — réessaie');
          }
        });
      });
    } catch {
      container.innerHTML = '<p style="font-size:13px;color:var(--danger)">Erreur de chargement</p>';
    }
  }
  loadHistory();
}
