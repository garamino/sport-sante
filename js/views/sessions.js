import { getWorkoutTemplates, getExercise } from '../db.js';

export async function render(container) {
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const templates = await getWorkoutTemplates();

    if (templates.length === 0) {
      container.innerHTML = `
        <div class="library-header">
          <h2 class="library-title">Séances</h2>
        </div>
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <p>Aucune séance</p>
          <p style="font-size:13px;color:var(--text-secondary);margin-top:8px">La bibliothèque se remplit au premier chargement.</p>
        </div>
      `;
      return;
    }

    // Load all exercises for each template
    const templatesWithExercises = await Promise.all(
      templates.map(async tpl => {
        const exercises = await Promise.all(
          (tpl.exerciseIds || []).map(id => getExercise(id))
        );
        return { ...tpl, exercises: exercises.filter(Boolean) };
      })
    );

    container.innerHTML = `
      <div class="library-header">
        <h2 class="library-title">Séances</h2>
        <span class="library-count">${templates.length}</span>
      </div>

      ${templatesWithExercises.map(tpl => {
        const isSpecial = ['velo', 'course', 'marche', 'rest'].includes(tpl.type);
        return `
          <div class="session-template-card">
            <div class="session-template-header">
              <span class="session-template-icon">${tpl.icon || '💪'}</span>
              <span class="session-template-name">${tpl.name}</span>
              ${isSpecial
                ? `<span class="session-template-count" style="background:rgba(79,195,247,.1);color:var(--accent);font-size:11px">Activité</span>`
                : `<span class="session-template-count">${tpl.exercises.length} ex.</span>`
              }
            </div>
            ${!isSpecial && tpl.exercises.length > 0 ? `
              <div class="session-template-exercises">
                ${tpl.exercises.map((ex, i) => `
                  <div class="session-exercise-row">
                    <span class="session-exercise-num">${i + 1}</span>
                    <span class="session-exercise-name">${ex.name}</span>
                    <span class="session-exercise-sets">${ex.defaultSets} × ${ex.defaultReps}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Erreur</p><p style="font-size:12px">${err.message}</p></div>`;
  }
}
