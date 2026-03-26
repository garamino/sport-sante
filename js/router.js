const routes = {};
let currentView = null;

export function registerRoute(path, viewModule) {
  routes[path] = viewModule;
}

export function navigateTo(path) {
  window.location.hash = path;
}

export function getCurrentPath() {
  return window.location.hash.slice(1) || '/dashboard';
}

export function initRouter(container) {
  async function handleRoute() {
    const path = getCurrentPath();
    const view = routes[path];

    if (!view) {
      navigateTo('/dashboard');
      return;
    }

    // Update active nav
    document.querySelectorAll('.nav-item').forEach(item => {
      const href = item.getAttribute('href')?.slice(1);
      item.classList.toggle('active', href === path);
    });

    currentView = view;
    container.innerHTML = '';
    await view.render(container);
  }

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
