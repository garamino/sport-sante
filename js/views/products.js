import { getIntakeProducts, saveIntakeProduct, deleteIntakeProduct } from '../db.js';
import { showToast } from '../utils.js';

let products = [];

export async function render(container) {
  container.innerHTML = '<div class="spinner"></div>';

  try {
    products = await getIntakeProducts();

    container.innerHTML = `
      <div class="library-header">
        <a href="#/intakes" class="btn-icon" title="Retour aux prises" style="display:flex;align-items:center;justify-content:center;text-decoration:none;color:var(--text-secondary)">‹</a>
        <h2 class="library-title" style="flex:1">Médicaments / compléments</h2>
        <span class="library-count">${products.length}</span>
      </div>

      <div class="card">
        <div class="section-title" style="margin-top:0">Ajouter un produit</div>
        <div class="form-group">
          <label>Nom</label>
          <input type="text" id="product-name" placeholder="Ex : Vitamine C 500mg" autocomplete="off">
        </div>
        <button class="btn btn-success" id="product-add">Ajouter</button>
      </div>

      <div class="card">
        <div class="section-title" style="margin-top:0">Ma bibliothèque</div>
        <div id="products-list">${renderList()}</div>
      </div>
    `;

    const input = document.getElementById('product-name');
    const addBtn = document.getElementById('product-add');

    const doAdd = async () => {
      const name = input.value.trim();
      if (!name) { showToast('Entre un nom de produit'); return; }
      if (products.some(p => p.name?.toLowerCase() === name.toLowerCase())) {
        showToast('Ce produit existe déjà');
        return;
      }
      addBtn.disabled = true;
      try {
        await saveIntakeProduct({ name });
        input.value = '';
        showToast('Produit ajouté ✓');
        await render(container);
      } catch {
        showToast('Erreur — réessaie');
        addBtn.disabled = false;
      }
    };

    addBtn.addEventListener('click', doAdd);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });

    bindListEvents(container);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Erreur</p><p style="font-size:12px">${err.message}</p></div>`;
  }
}

function renderList() {
  if (products.length === 0) {
    return `<div style="color:var(--text-secondary);font-size:13px;padding:8px 0">Aucun produit. Ajoute ton premier médicament ou complément ci-dessus.</div>`;
  }
  return products.map(p => `
    <div class="intake-item" data-id="${p.id}">
      <div class="intake-item-line">
        <span class="intake-product">${escapeHtml(p.name)}</span>
      </div>
      <div class="intake-item-actions">
        <button class="product-edit" title="Modifier">✎</button>
        <button class="product-delete" title="Supprimer">×</button>
      </div>
    </div>
  `).join('');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function bindListEvents(container) {
  container.querySelectorAll('.product-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.closest('.intake-item').dataset.id;
      const product = products.find(p => p.id === id);
      if (!product) return;
      if (!confirm(`Supprimer « ${product.name} » de la bibliothèque ?\n\nLes prises déjà enregistrées avec ce produit ne sont pas affectées.`)) return;
      try {
        await deleteIntakeProduct(id);
        showToast('Produit supprimé');
        await render(container);
      } catch {
        showToast('Erreur — réessaie');
      }
    });
  });

  container.querySelectorAll('.product-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const itemEl = e.target.closest('.intake-item');
      const id = itemEl.dataset.id;
      const product = products.find(p => p.id === id);
      if (!product) return;
      itemEl.innerHTML = `
        <div class="intake-item-main" style="display:flex;flex-direction:column;gap:6px;width:100%">
          <input type="text" class="edit-product-name" value="${escapeHtml(product.name)}">
        </div>
        <div class="intake-item-actions">
          <button class="product-save">✓</button>
          <button class="product-cancel">×</button>
        </div>
      `;
      const nameInput = itemEl.querySelector('.edit-product-name');
      const save = async () => {
        const name = nameInput.value.trim();
        if (!name) { showToast('Le nom ne peut pas être vide'); return; }
        if (products.some(p => p.id !== id && p.name?.toLowerCase() === name.toLowerCase())) {
          showToast('Ce produit existe déjà');
          return;
        }
        try {
          await saveIntakeProduct({ id, name });
          showToast('Produit modifié ✓');
          await render(container);
        } catch {
          showToast('Erreur — réessaie');
        }
      };
      itemEl.querySelector('.product-save').addEventListener('click', save);
      nameInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') save(); });
      itemEl.querySelector('.product-cancel').addEventListener('click', () => render(container));
    });
  });
}
