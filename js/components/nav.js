import { getWeekNumber, getPhase, today } from '../utils.js';
import { getUserProfile } from '../db.js';
import { APP_VERSION } from '../version.js';

let versionListenerAttached = false;

export async function updateHeader() {
  try {
    const profile = await getUserProfile();
    const weekEl = document.getElementById('header-week');
    const phaseEl = document.getElementById('header-phase');
    const versionEl = document.getElementById('header-version');

    if (versionEl) {
      versionEl.textContent = `v${APP_VERSION}`;

      if (!versionListenerAttached) {
        versionListenerAttached = true;
        versionEl.addEventListener('click', forceUpdate);
      }
    }

    if (profile?.startDate) {
      const week = getWeekNumber(profile.startDate, today());
      const phase = getPhase(week);
      weekEl.textContent = `Semaine ${week}/14`;
      phaseEl.textContent = phase;
    } else {
      weekEl.textContent = 'Sport & Santé';
      phaseEl.textContent = '';
    }
  } catch {
    document.getElementById('header-week').textContent = 'Sport & Santé';
  }
}

async function forceUpdate() {
  const btn = document.getElementById('header-version');
  if (!btn || btn.classList.contains('updating')) return;

  btn.classList.add('updating');
  btn.textContent = 'Mise à jour...';

  try {
    // 1. Unregister current SW and clear all caches
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      await reg.unregister();
    }

    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));

    // 2. Hard reload from network
    btn.textContent = 'Rechargement...';
    window.location.reload();
  } catch (err) {
    console.error('Update failed:', err);
    btn.classList.remove('updating');
    btn.textContent = `v${APP_VERSION}`;
  }
}
