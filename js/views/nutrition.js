import { today, formatDateFR, addDays } from '../utils.js';

let currentDate = null;

export async function render(container, resetDate = true) {
  if (resetDate || !currentDate) currentDate = today();

  container.innerHTML = `
    <div class="date-nav-row">
      <div class="date-nav" style="margin-bottom:0">
        <button id="nut-prev">‹</button>
        <span class="current-date">${formatDateFR(currentDate)}</span>
        <button id="nut-next">›</button>
      </div>
    </div>

    <div class="empty-state" style="margin-top:48px">
      <p style="font-size:32px">🥗</p>
      <p>Module nutrition</p>
      <p style="font-size:13px;color:var(--text-secondary);margin-top:8px">En cours de développement</p>
    </div>
  `;

  document.getElementById('nut-prev').addEventListener('click', () => {
    currentDate = addDays(currentDate, -1);
    render(container, false);
  });
  document.getElementById('nut-next').addEventListener('click', () => {
    currentDate = addDays(currentDate, 1);
    render(container, false);
  });
}
