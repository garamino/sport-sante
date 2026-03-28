import { onAuth, logout, getCurrentUser } from './auth.js';
import { registerRoute, initRouter, navigateTo } from './router.js';
import { updateHeader } from './components/nav.js';
import { getUserProfile, saveApiKey } from './db.js';
import { showToast } from './utils.js';

// Import views
import * as loginView from './views/login.js';
import * as dashboardView from './views/dashboard.js';
import * as workoutView from './views/workout.js';
import * as sleepView from './views/sleep.js';
import * as weeklyView from './views/weekly.js';
import * as chartsView from './views/charts.js';

// Register routes
registerRoute('/login', loginView);
registerRoute('/dashboard', dashboardView);
registerRoute('/workout', workoutView);
registerRoute('/sleep', sleepView);
registerRoute('/weekly', weeklyView);
registerRoute('/charts', chartsView);

const appContainer = document.getElementById('app');
const header = document.getElementById('app-header');
const bottomNav = document.getElementById('bottom-nav');
const logoutBtn = document.getElementById('btn-logout');

// Auth state handler
onAuth(async (user) => {
  if (user) {
    // Logged in
    document.body.classList.remove('login-mode');
    header.classList.remove('hidden');
    bottomNav.classList.remove('hidden');
    await updateHeader();
    initRouter(appContainer);
    if (window.location.hash === '#/login' || !window.location.hash) {
      navigateTo('/dashboard');
    }
  } else {
    // Logged out
    document.body.classList.add('login-mode');
    header.classList.add('hidden');
    bottomNav.classList.add('hidden');
    navigateTo('/login');
    loginView.render(appContainer);
  }
});

// Logout
logoutBtn.addEventListener('click', async () => {
  await logout();
});

// Settings modal
const settingsBtn = document.getElementById('btn-settings');
settingsBtn.addEventListener('click', async () => {
  // Remove existing modal if any
  document.querySelector('.settings-modal-overlay')?.remove();

  const user = getCurrentUser();
  const profile = await getUserProfile().catch(() => null);
  const hasKey = profile?.hasApiKey || false;

  const overlay = document.createElement('div');
  overlay.className = 'settings-modal-overlay';
  overlay.innerHTML = `
    <div class="settings-modal">
      <button class="guide-modal-close">&times;</button>
      <h3 style="font-size:18px;margin-bottom:16px">Paramètres</h3>

      <div class="settings-section">
        <div class="settings-label">Compte</div>
        <div class="settings-value">${user?.email || '—'}</div>
      </div>

      <div class="settings-section">
        <div class="settings-label">Clé API Claude</div>
        ${hasKey ? `
          <div class="settings-status settings-status-ok">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            Clé configurée
          </div>
        ` : `
          <div class="settings-status settings-status-missing">
            Aucune clé configurée
          </div>
        `}
        <p style="font-size:12px;color:var(--text-secondary);margin:8px 0">
          ${hasKey ? 'Tu peux remplacer ta clé en en entrant une nouvelle ci-dessous.' : 'Entre ta clé depuis <a href="https://console.anthropic.com/" target="_blank" rel="noopener" style="color:var(--accent)">console.anthropic.com</a> pour activer le Coach IA.'}
        </p>
        <input type="password" id="settings-api-key" placeholder="sk-ant-api03-...">
        <button class="btn btn-primary btn-small" id="settings-save-key" style="margin-top:8px;width:100%">
          ${hasKey ? 'Mettre à jour la clé' : 'Enregistrer la clé'}
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('.guide-modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  document.getElementById('settings-save-key').addEventListener('click', async (e) => {
    const btn = e.target;
    const key = document.getElementById('settings-api-key').value.trim();
    if (!key) { showToast('Entre une clé API'); return; }
    btn.disabled = true;
    btn.textContent = 'Enregistrement...';
    try {
      await saveApiKey(key);
      document.getElementById('settings-api-key').value = '';
      showToast('Clé API enregistrée ✓');
      close();
    } catch {
      showToast('Erreur — réessaie');
      btn.disabled = false;
      btn.textContent = hasKey ? 'Mettre à jour la clé' : 'Enregistrer la clé';
    }
  });
});

// Offline detection
window.addEventListener('online', () => {
  document.getElementById('offline-banner').classList.add('hidden');
});
window.addEventListener('offline', () => {
  document.getElementById('offline-banner').classList.remove('hidden');
});
if (!navigator.onLine) {
  document.getElementById('offline-banner').classList.remove('hidden');
}

// Register Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
