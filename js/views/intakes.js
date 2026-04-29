import { today, formatDateFR, addDays, showToast } from '../utils.js';
import { getIntakes, saveIntakes } from '../db.js';

const PRODUCTS = [
  'Metasleep',
  'Metarelax',
  'Trazodone 100mg',
  'Stilnoct 10mg',
  'Ashwagandha 300mg',
  'L-Théanine 200mg',
];

const QUANTITIES = ['1', '1/2', '1/4'];

const fmtQty = q => q === '1/2' ? '½' : q === '1/4' ? '¼' : q;

let currentDate = null;
let entries = [];

function shortId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

function sortEntries(arr) {
  return [...arr].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}

export async function render(container, resetDate = true) {
  if (resetDate || !currentDate) currentDate = today();
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const existing = await getIntakes(currentDate).catch(() => null);
    entries = sortEntries(existing?.entries || []);

    container.innerHTML = `
      <div class="date-nav">
        <button id="intakes-prev">‹</button>
        <span class="current-date">${formatDateFR(currentDate)}</span>
        <button id="intakes-next">›</button>
      </div>

      <div class="card">
        <div class="section-title" style="margin-top:0">Prises de la journée</div>
        <div id="intakes-list">${renderList()}</div>
      </div>

      <div class="card">
        <div class="section-title" style="margin-top:0">Ajouter une prise</div>
        <div class="form-group">
          <label>Produit</label>
          <select id="intake-product">
            ${PRODUCTS.map(p => `<option value="${p}">${p}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Quantité</label>
          <select id="intake-quantity">
            ${QUANTITIES.map(q => `<option value="${q}">${fmtQty(q)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Heure</label>
          <input type="time" id="intake-time">
        </div>
        <button class="btn btn-success" id="intake-add">Ajouter</button>
      </div>
    `;

    document.getElementById('intakes-prev').addEventListener('click', () => {
      currentDate = addDays(currentDate, -1);
      render(container, false);
    });
    document.getElementById('intakes-next').addEventListener('click', () => {
      currentDate = addDays(currentDate, 1);
      render(container, false);
    });

    document.getElementById('intake-add').addEventListener('click', async () => {
      const product = document.getElementById('intake-product').value;
      const quantity = document.getElementById('intake-quantity').value;
      const time = document.getElementById('intake-time').value;
      const entry = { id: shortId(), product, quantity, time };
      entries = sortEntries([...entries, entry]);
      await persist();
      render(container, false);
    });

    bindListEvents(container);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Erreur</p><p style="font-size:12px">${err.message}</p></div>`;
  }
}

function renderList() {
  if (entries.length === 0) {
    return `<div style="color:var(--text-secondary);font-size:13px;padding:8px 0">Aucune prise enregistrée pour cette journée.</div>`;
  }
  return entries.map(e => `
    <div class="intake-item" data-id="${e.id}">
      <div class="intake-item-main">
        <div class="intake-item-product">${e.product}</div>
        <div class="intake-item-meta">${fmtQty(e.quantity)}${e.time ? ' · ' + e.time : ''}</div>
      </div>
      <div class="intake-item-actions">
        <button class="intake-edit" title="Modifier">✎</button>
        <button class="intake-delete" title="Supprimer">×</button>
      </div>
    </div>
  `).join('');
}

function bindListEvents(container) {
  container.querySelectorAll('.intake-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.closest('.intake-item').dataset.id;
      entries = entries.filter(en => en.id !== id);
      await persist();
      render(container, false);
    });
  });
  container.querySelectorAll('.intake-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const itemEl = e.target.closest('.intake-item');
      const id = itemEl.dataset.id;
      const entry = entries.find(en => en.id === id);
      if (!entry) return;
      itemEl.innerHTML = `
        <div class="intake-item-main" style="display:flex;flex-direction:column;gap:6px;width:100%">
          <select class="edit-product">
            ${PRODUCTS.map(p => `<option value="${p}"${p === entry.product ? ' selected' : ''}>${p}</option>`).join('')}
          </select>
          <select class="edit-quantity">
            ${QUANTITIES.map(q => `<option value="${q}"${q === entry.quantity ? ' selected' : ''}>${fmtQty(q)}</option>`).join('')}
          </select>
          <input type="time" class="edit-time" value="${entry.time || ''}">
        </div>
        <div class="intake-item-actions">
          <button class="intake-save">✓</button>
          <button class="intake-cancel">×</button>
        </div>
      `;
      itemEl.querySelector('.intake-save').addEventListener('click', async () => {
        entry.product = itemEl.querySelector('.edit-product').value;
        entry.quantity = itemEl.querySelector('.edit-quantity').value;
        entry.time = itemEl.querySelector('.edit-time').value;
        entries = sortEntries(entries);
        await persist();
        render(container, false);
      });
      itemEl.querySelector('.intake-cancel').addEventListener('click', () => render(container, false));
    });
  });
}

async function persist() {
  try {
    await saveIntakes(currentDate, entries);
    showToast('Prises enregistrées ✓');
  } catch {
    showToast('Erreur — réessaie');
  }
}
