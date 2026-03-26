import { login } from '../auth.js';

export async function render(container) {
  container.innerHTML = `
    <div class="login-container">
      <h1>Sport & Santé</h1>
      <p class="subtitle">Programme Prise de Masse — 14 semaines</p>
      <form id="login-form">
        <div class="form-group">
          <input type="email" id="login-email" placeholder="Email" autocomplete="email" required>
        </div>
        <div class="form-group">
          <input type="password" id="login-password" placeholder="Mot de passe" autocomplete="current-password" required>
        </div>
        <button type="submit" class="btn btn-primary" id="login-btn">Se connecter</button>
        <div class="login-error" id="login-error"></div>
      </form>
    </div>
  `;

  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    btn.disabled = true;
    btn.textContent = 'Connexion...';
    errorEl.textContent = '';

    try {
      await login(email, password);
    } catch (err) {
      const messages = {
        'auth/invalid-credential': 'Email ou mot de passe incorrect',
        'auth/user-not-found': 'Aucun compte avec cet email',
        'auth/wrong-password': 'Mot de passe incorrect',
        'auth/too-many-requests': 'Trop de tentatives, réessaie plus tard',
        'auth/invalid-email': 'Email invalide',
      };
      errorEl.textContent = messages[err.code] || 'Erreur de connexion';
      btn.disabled = false;
      btn.textContent = 'Se connecter';
    }
  });
}
