import { onAuth, logout } from './auth.js';
import { registerRoute, initRouter, navigateTo } from './router.js';
import { updateHeader } from './components/nav.js';

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
