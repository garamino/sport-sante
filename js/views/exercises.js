import { getExercises } from '../db.js';

export async function render(container) {
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const exercises = await getExercises();

    // Group by muscleGroup
    const groups = {};
    for (const ex of exercises) {
      const g = ex.muscleGroup || 'Autre';
      if (!groups[g]) groups[g] = [];
      groups[g].push(ex);
    }

    const groupOrder = ['Poitrine', 'Triceps', 'Dos', 'Biceps', 'Jambes', 'Fessiers', 'Épaules', 'Abdominaux', 'Full body', 'Cardio', 'Autre'];
    const sortedGroups = Object.keys(groups).sort((a, b) => {
      const ia = groupOrder.indexOf(a);
      const ib = groupOrder.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    if (exercises.length === 0) {
      container.innerHTML = `
        <div class="library-header">
          <h2 class="library-title">Exercices</h2>
        </div>
        <div class="empty-state">
          <div class="empty-state-icon">🏋️</div>
          <p>Aucun exercice</p>
          <p style="font-size:13px;color:var(--text-secondary);margin-top:8px">La bibliothèque se remplit au premier chargement.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="library-header">
        <h2 class="library-title">Exercices</h2>
        <span class="library-count">${exercises.length}</span>
      </div>

      ${sortedGroups.map(group => `
        <div class="library-group">
          <div class="library-group-title">${group}</div>
          ${groups[group].map(ex => `
            <div class="exercise-list-item">
              <div class="exercise-list-name">${ex.name}</div>
              <div class="exercise-list-meta">
                <span class="exercise-tag">${ex.defaultSets} × ${ex.defaultReps}</span>
                <span class="exercise-tag">Repos ${ex.defaultRest}</span>
                ${ex.weight && ex.weight !== '—' ? `<span class="exercise-tag">${ex.weight}</span>` : ''}
              </div>
              ${ex.notes ? `<div class="exercise-list-notes">${ex.notes}</div>` : ''}
            </div>
          `).join('')}
        </div>
      `).join('')}
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Erreur</p><p style="font-size:12px">${err.message}</p></div>`;
  }
}
