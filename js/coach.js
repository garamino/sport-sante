import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-functions.js';
import { app } from './auth.js';
import { getCoachHistory } from './db.js';

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
