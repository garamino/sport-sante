import { render as renderExercises } from './exercises.js';
import { render as renderSessions } from './sessions.js';

let activeTab = 'exercises';

export async function render(container) {
  container.innerHTML = `
    <div class="library-tabs">
      <button class="library-tab ${activeTab === 'exercises' ? 'active' : ''}" data-tab="exercises">Exercices</button>
      <button class="library-tab ${activeTab === 'sessions' ? 'active' : ''}" data-tab="sessions">Séances</button>
    </div>
    <div id="library-content"></div>
  `;

  container.querySelectorAll('.library-tab').forEach(btn => {
    btn.addEventListener('click', async () => {
      activeTab = btn.dataset.tab;
      container.querySelectorAll('.library-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab));
      await renderTabContent(container.querySelector('#library-content'));
    });
  });

  await renderTabContent(container.querySelector('#library-content'));
}

async function renderTabContent(content) {
  if (activeTab === 'exercises') {
    await renderExercises(content);
  } else {
    await renderSessions(content);
  }
}
