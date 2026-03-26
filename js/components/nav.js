import { getWeekNumber, getPhase, today } from '../utils.js';
import { getUserProfile } from '../db.js';

export async function updateHeader() {
  try {
    const profile = await getUserProfile();
    const weekEl = document.getElementById('header-week');
    const phaseEl = document.getElementById('header-phase');

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
