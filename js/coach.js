import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-functions.js';
import { app } from './auth.js';

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
        messageEl.innerHTML = `<p class="coach-text">${data.advice}</p>`;
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
