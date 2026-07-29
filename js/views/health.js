import { today, formatDateFR, showToast } from '../utils.js';
import { uploadHealthFile, deleteHealthFile, saveHealthDoc, updateHealthDoc, deleteHealthDoc, getAllHealthDocs } from '../db.js';
import { normalizeBiomarkerKey, getReference, classifyValue, formatRange, STATUS_COLORS } from '../health-reference.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-functions.js';
import { app } from '../auth.js';

const functions = getFunctions(app, 'europe-west1');
const processHealthDocFn = httpsCallable(functions, 'processHealthDoc');

export async function render(container) {
  container.innerHTML = '<div class="spinner"></div>';

  const docs = await getAllHealthDocs().catch(() => []);

  container.innerHTML = `
    <h2 style="margin-bottom:16px">Documents Sante</h2>

    <!-- Upload zone -->
    <div class="card">
      <div class="card-title">Ajouter un document</div>

      <div class="health-tabs" style="display:flex;gap:8px;margin-bottom:12px">
        <button class="btn btn-small health-tab active" data-tab="upload">Photo / PDF</button>
        <button class="btn btn-small health-tab" data-tab="text">Saisie libre</button>
      </div>

      <!-- Tab: Upload -->
      <div id="health-tab-upload">
        <div class="form-group">
          <label>Date de l'analyse</label>
          <input type="date" id="health-date" value="${today()}">
        </div>
        <div class="form-group">
          <label>Type de document</label>
          <select id="health-type">
            <option value="prise_de_sang">Prise de sang</option>
            <option value="bilan_medical">Bilan medical</option>
            <option value="radiologie">Radiologie / Imagerie</option>
            <option value="autre">Autre</option>
          </select>
        </div>
        <div class="form-group">
          <label>Photo ou PDF du document</label>
          <div class="upload-zone" id="upload-zone">
            <input type="file" id="health-file" accept="image/*,.pdf" multiple style="display:none">
            <div class="upload-placeholder" id="upload-placeholder">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span style="color:var(--text-secondary);font-size:13px;margin-top:4px">Appuie pour choisir un ou plusieurs fichiers</span>
              <span style="color:var(--text-secondary);font-size:12px;margin-top:2px">(pages d'une même analyse → un seul document)</span>
            </div>
            <div class="upload-preview hidden" id="upload-preview">
              <span id="upload-filename"></span>
              <button class="btn btn-small" id="upload-clear" style="padding:4px 8px">X</button>
            </div>
          </div>
        </div>
        <button class="btn btn-primary" id="health-upload-btn">Analyser le document</button>
      </div>

      <!-- Tab: Text -->
      <div id="health-tab-text" class="hidden">
        <div class="form-group">
          <label>Date</label>
          <input type="date" id="health-text-date" value="${today()}">
        </div>
        <div class="form-group">
          <label>Type</label>
          <select id="health-text-type">
            <option value="prise_de_sang">Prise de sang</option>
            <option value="bilan_medical">Bilan medical</option>
            <option value="note_sante">Note sante</option>
            <option value="autre">Autre</option>
          </select>
        </div>
        <div class="form-group">
          <label>Contenu (colle ton compte-rendu, résultats, observations...)</label>
          <textarea id="health-text-content" rows="8" placeholder="Ex: Hemoglobine 14.2 g/dL, Ferritine 45 ng/mL, Glycemie 0.92 g/L..."></textarea>
        </div>
        <button type="button" class="btn btn-small" id="health-text-parse" style="margin-bottom:8px">✨ Structurer le texte</button>
        ${biomarkerEditorHtml('bm-text')}
        <button class="btn btn-success" id="health-text-btn" style="margin-top:12px">Enregistrer</button>
      </div>
    </div>

    <!-- Extraction result (hidden by default) -->
    <div class="card hidden" id="health-result-card">
      <div class="card-title">Resultat de l'extraction</div>
      <div id="health-result-text" style="white-space:pre-wrap;font-size:13px;line-height:1.5"></div>
      <div class="form-group" style="margin-top:12px">
        <label>Corriger si besoin avant de sauvegarder</label>
        <textarea id="health-result-edit" rows="6"></textarea>
      </div>
      ${biomarkerEditorHtml('bm-result')}
      <button class="btn btn-success" id="health-result-save" style="margin-top:12px">Valider et sauvegarder</button>
    </div>

    <!-- History -->
    ${docs.length > 0 ? `
      <div class="card">
        <div class="card-title">Historique</div>
        ${docs.map(d => `
          <div class="health-doc-item" style="padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" class="health-doc-header" data-id="${d.id}">
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;color:var(--text-secondary)">${formatDateFR(d.date)} — ${formatDocType(d.type)}</div>
                <div style="font-size:13px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml((d.summary || d.content || '').split('\n')[0])}</div>
              </div>
              <svg class="health-doc-chevron" data-id="${d.id}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="2" style="flex-shrink:0;transition:transform .2s"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="health-doc-detail hidden" id="health-detail-${d.id}" style="margin-top:10px">
              ${biomarkersTableHtml(d.biomarkers)}
              <input type="date" class="health-doc-editdate hidden" id="health-editdate-${d.id}" value="${d.date}" style="width:100%;margin-bottom:8px">
              <div class="health-doc-view" id="health-view-${d.id}" style="font-size:13px;line-height:1.6;white-space:pre-wrap;background:var(--bg-primary);padding:10px;border-radius:8px">${escapeHtml(d.summary || d.content || '')}</div>
              <textarea class="health-doc-edit hidden" id="health-edit-${d.id}" rows="8" style="width:100%;margin-top:8px;font-size:13px">${escapeHtml(d.summary || d.content || '')}</textarea>
              <div style="display:flex;gap:8px;margin-top:8px">
                <button class="btn btn-small health-edit-btn" data-id="${d.id}" style="flex:1">Modifier</button>
                <button class="btn btn-small btn-success health-save-btn hidden" data-id="${d.id}" style="flex:1">Enregistrer</button>
                <button class="btn btn-small health-cancel-btn hidden" data-id="${d.id}" style="flex:1">Annuler</button>
                <button class="btn btn-small health-delete-btn" data-id="${d.id}" data-path="${d.storagePath || ''}" style="color:var(--danger);background:none;padding:4px 8px">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;

  // --- Biomarker editors (empty for text tab, filled after extraction for result) ---
  fillBiomarkerEditor('bm-text', []);
  fillBiomarkerEditor('bm-result', []);

  // --- Structurer le texte collé en biomarqueurs ---
  document.getElementById('health-text-parse').addEventListener('click', () => {
    const text = document.getElementById('health-text-content').value;
    const parsed = parseBiomarkersFromText(text);
    if (parsed.length === 0) { showToast('Aucune valeur détectée'); return; }
    fillBiomarkerEditor('bm-text', parsed);
    showToast(`${parsed.length} paramètre(s) détecté(s) ✓`);
  });

  // --- Tab switching ---
  container.querySelectorAll('.health-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.health-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const isUpload = tab.dataset.tab === 'upload';
      document.getElementById('health-tab-upload').classList.toggle('hidden', !isUpload);
      document.getElementById('health-tab-text').classList.toggle('hidden', isUpload);
    });
  });

  // --- File input (multi-fichiers : pages d'une même analyse) ---
  let selectedFiles = [];
  const fileInput = document.getElementById('health-file');
  const uploadZone = document.getElementById('upload-zone');
  const placeholder = document.getElementById('upload-placeholder');
  const preview = document.getElementById('upload-preview');
  const filenameEl = document.getElementById('upload-filename');

  uploadZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    selectedFiles = Array.from(fileInput.files || []);
    if (selectedFiles.length > 0) {
      placeholder.classList.add('hidden');
      preview.classList.remove('hidden');
      filenameEl.textContent = selectedFiles.length === 1
        ? selectedFiles[0].name
        : `${selectedFiles.length} fichiers sélectionnés`;
    }
  });
  document.getElementById('upload-clear').addEventListener('click', (e) => {
    e.stopPropagation();
    selectedFiles = [];
    fileInput.value = '';
    placeholder.classList.remove('hidden');
    preview.classList.add('hidden');
  });

  // --- Upload & analyze ---
  let pendingExtraction = null;
  document.getElementById('health-upload-btn').addEventListener('click', async () => {
    if (selectedFiles.length === 0) { showToast('Choisis au moins un fichier'); return; }

    const btn = document.getElementById('health-upload-btn');
    btn.disabled = true;

    try {
      const uploaded = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        btn.textContent = selectedFiles.length > 1
          ? `Upload ${i + 1}/${selectedFiles.length}...`
          : 'Upload en cours...';
        uploaded.push(await uploadHealthFile(selectedFiles[i]));
      }
      btn.textContent = 'Analyse en cours...';

      const storagePaths = uploaded.map(u => u.path);
      const result = await processHealthDocFn({
        storagePaths,
        fileUrl: uploaded[0].url, // rétro-compat
        storagePath: storagePaths[0], // rétro-compat
        type: document.getElementById('health-type').value,
        date: document.getElementById('health-date').value,
      });

      if (result.data.error) {
        showToast(result.data.message || 'Erreur');
        // Nettoyer les fichiers uploadés en cas d'échec
        for (const u of uploaded) await deleteHealthFile(u.path);
        btn.disabled = false;
        btn.textContent = 'Analyser le document';
        return;
      }

      const extracted = result.data.summary;
      pendingExtraction = {
        date: document.getElementById('health-date').value,
        type: document.getElementById('health-type').value,
        summary: extracted,
        storagePaths,
        source: 'upload',
      };

      document.getElementById('health-result-text').textContent = extracted;
      document.getElementById('health-result-edit').value = extracted;
      fillBiomarkerEditor('bm-result', Array.isArray(result.data.biomarkers) ? result.data.biomarkers : []);
      document.getElementById('health-result-card').classList.remove('hidden');
      btn.textContent = 'Analyser le document';
      btn.disabled = false;
    } catch (err) {
      showToast('Erreur lors de l\'analyse');
      btn.disabled = false;
      btn.textContent = 'Analyser le document';
    }
  });

  // --- Save extraction result ---
  document.getElementById('health-result-save').addEventListener('click', async () => {
    if (!pendingExtraction) return;
    const btn = document.getElementById('health-result-save');
    btn.disabled = true;

    const editedSummary = document.getElementById('health-result-edit').value.trim();
    pendingExtraction.summary = editedSummary || pendingExtraction.summary;
    pendingExtraction.biomarkers = readBiomarkerEditor('bm-result');

    try {
      await saveHealthDoc(pendingExtraction);
      // Delete original files from storage (only keep summary + biomarkers)
      for (const path of (pendingExtraction.storagePaths || [])) await deleteHealthFile(path);
      showToast('Document enregistre');
      pendingExtraction = null;
      render(container);
    } catch {
      showToast('Erreur');
      btn.disabled = false;
    }
  });

  // --- Save text entry ---
  document.getElementById('health-text-btn').addEventListener('click', async () => {
    const content = document.getElementById('health-text-content').value.trim();
    const biomarkers = readBiomarkerEditor('bm-text');
    if (!content && biomarkers.length === 0) { showToast('Entre du contenu ou des biomarqueurs'); return; }

    const btn = document.getElementById('health-text-btn');
    btn.disabled = true;
    btn.textContent = 'Enregistrement...';

    try {
      await saveHealthDoc({
        date: document.getElementById('health-text-date').value,
        type: document.getElementById('health-text-type').value,
        content,
        summary: content,
        biomarkers,
        source: 'text',
      });
      showToast('Document enregistre');
      render(container);
    } catch {
      showToast('Erreur');
      btn.disabled = false;
      btn.textContent = 'Enregistrer';
    }
  });

  // --- Accordion toggle ---
  container.querySelectorAll('.health-doc-header').forEach(header => {
    header.addEventListener('click', () => {
      const id = header.dataset.id;
      const detail = document.getElementById(`health-detail-${id}`);
      const chevron = container.querySelector(`.health-doc-chevron[data-id="${id}"]`);
      const isOpen = !detail.classList.contains('hidden');
      detail.classList.toggle('hidden', isOpen);
      chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
    });
  });

  // --- Edit mode ---
  container.querySelectorAll('.health-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      document.getElementById(`health-view-${id}`).classList.add('hidden');
      document.getElementById(`health-edit-${id}`).classList.remove('hidden');
      document.getElementById(`health-editdate-${id}`).classList.remove('hidden');
      btn.classList.add('hidden');
      container.querySelector(`.health-save-btn[data-id="${id}"]`).classList.remove('hidden');
      container.querySelector(`.health-cancel-btn[data-id="${id}"]`).classList.remove('hidden');
    });
  });

  // --- Cancel edit ---
  container.querySelectorAll('.health-cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      document.getElementById(`health-view-${id}`).classList.remove('hidden');
      document.getElementById(`health-edit-${id}`).classList.add('hidden');
      document.getElementById(`health-editdate-${id}`).classList.add('hidden');
      container.querySelector(`.health-edit-btn[data-id="${id}"]`).classList.remove('hidden');
      btn.classList.add('hidden');
      container.querySelector(`.health-save-btn[data-id="${id}"]`).classList.add('hidden');
      // Reset textarea to original value
      const viewText = document.getElementById(`health-view-${id}`).textContent;
      document.getElementById(`health-edit-${id}`).value = viewText;
    });
  });

  // --- Save edit ---
  container.querySelectorAll('.health-save-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const newText = document.getElementById(`health-edit-${id}`).value.trim();
      const newDate = document.getElementById(`health-editdate-${id}`).value;
      if (!newText) { showToast('Le contenu ne peut pas être vide'); return; }
      if (!newDate) { showToast('La date ne peut pas être vide'); return; }
      btn.disabled = true;
      btn.textContent = 'Enregistrement...';
      try {
        await updateHealthDoc(id, { summary: newText, content: newText, date: newDate });
        showToast('Document mis à jour');
        render(container);
      } catch {
        showToast('Erreur');
        btn.disabled = false;
        btn.textContent = 'Enregistrer';
      }
    });
  });

  // --- Delete ---
  container.querySelectorAll('.health-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const path = btn.dataset.path;
      if (!confirm('Supprimer ce document ?')) return;
      try {
        if (path) await deleteHealthFile(path);
        await deleteHealthDoc(id);
        showToast('Supprimé');
        render(container);
      } catch {
        showToast('Erreur');
      }
    });
  });
}

function formatDocType(type) {
  const labels = {
    prise_de_sang: 'Prise de sang',
    bilan_medical: 'Bilan medical',
    radiologie: 'Radiologie',
    note_sante: 'Note sante',
    autre: 'Autre',
  };
  return labels[type] || type;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// === Éditeur de biomarqueurs (lignes label / valeur / unité) ===

function biomarkerEditorHtml(rootId) {
  return `
    <div class="section-title" style="font-size:14px;margin:16px 0 4px">Biomarqueurs</div>
    <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">Valeurs chiffrées pour le suivi graphique (onglet Stats → Santé).</div>
    <div id="${rootId}-rows"></div>
    <button type="button" class="btn btn-small" id="${rootId}-add" style="margin-top:8px">+ Ajouter un paramètre</button>
  `;
}

function biomarkerRowHtml(b = {}) {
  return `<div class="bm-row" style="display:flex;gap:6px;align-items:center;margin-top:6px">
    <input class="bm-label" placeholder="Paramètre" value="${escapeHtml(b.label || '')}" style="flex:2;min-width:0">
    <input class="bm-value" type="number" step="any" inputmode="decimal" placeholder="Valeur" value="${b.value ?? ''}" style="flex:1;min-width:0">
    <input class="bm-unit" placeholder="Unité" value="${escapeHtml(b.unit || '')}" style="flex:1;min-width:0">
    <button type="button" class="btn btn-small bm-remove" title="Retirer" style="color:var(--danger);background:none;padding:4px 8px">✕</button>
  </div>`;
}

function fillBiomarkerEditor(rootId, list) {
  const rowsEl = document.getElementById(`${rootId}-rows`);
  const addBtn = document.getElementById(`${rootId}-add`);
  if (!rowsEl || !addBtn) return;
  rowsEl.innerHTML = (Array.isArray(list) ? list : []).map(biomarkerRowHtml).join('');
  addBtn.onclick = () => rowsEl.insertAdjacentHTML('beforeend', biomarkerRowHtml());
  rowsEl.onclick = (e) => {
    const rm = e.target.closest('.bm-remove');
    if (rm) rm.closest('.bm-row').remove();
  };
}

function readBiomarkerEditor(rootId) {
  const rowsEl = document.getElementById(`${rootId}-rows`);
  if (!rowsEl) return [];
  return [...rowsEl.querySelectorAll('.bm-row')].map(row => {
    const label = row.querySelector('.bm-label').value.trim();
    const value = parseFloat(row.querySelector('.bm-value').value);
    const unit = row.querySelector('.bm-unit').value.trim();
    if (!label || isNaN(value)) return null;
    return { key: normalizeBiomarkerKey(label), label, value, unit };
  }).filter(Boolean);
}

// Extrait des biomarqueurs { key, label, value, unit } depuis un texte collé.
// Gère les lignes markdown type "- **Hémoglobine :** 15.6 g/dL (normal, norme 13-18)".
function parseBiomarkersFromText(text) {
  const out = [];
  const seen = new Set();
  for (const raw of (text || '').split('\n')) {
    const line = raw.replace(/\*\*/g, '').replace(/^[\s\-*•]+/, '').trim();
    const m = line.match(/^(.+?)\s*:\s*(-?\d+(?:[.,]\d+)?)\s*([^\s(]*)/);
    if (!m) continue;
    const label = m[1].trim();
    const value = parseFloat(m[2].replace(',', '.'));
    const unit = m[3].trim().replace(/[.,;]+$/, '');
    if (!label || isNaN(value)) continue;
    // Ignorer les lignes méta (date de prélèvement, labo, patient…)
    if (/date|labo|pr[ée]l[èe]|patient|\bnom\b|na[iî]ss/i.test(label)) continue;
    if (unit.startsWith('/')) continue; // motif de date type 27/03/2026
    const key = normalizeBiomarkerKey(label);
    const dedup = key || label.toLowerCase();
    if (seen.has(dedup)) continue;
    seen.add(dedup);
    out.push({ key, label, value, unit });
  }
  return out;
}

// Tableau lecture seule des biomarqueurs (affiché dans l'historique).
function biomarkersTableHtml(list) {
  if (!Array.isArray(list) || list.length === 0) return '';
  const rows = list.map(b => {
    const ref = b.key ? getReference(b.key) : null;
    const status = classifyValue(b.value, ref);
    const color = STATUS_COLORS[status];
    const range = ref ? formatRange(ref) : '';
    return `<tr>
      <td style="padding:4px 6px">${escapeHtml(b.label)}</td>
      <td style="padding:4px 6px;text-align:right;color:${color};font-weight:600;white-space:nowrap">${b.value} ${escapeHtml(b.unit || '')}</td>
      <td style="padding:4px 6px;text-align:right;color:var(--text-secondary);font-size:12px;white-space:nowrap">${range}</td>
    </tr>`;
  }).join('');
  return `<div style="overflow-x:auto;margin-bottom:10px"><table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="color:var(--text-secondary);font-size:11px;text-transform:uppercase">
      <th style="text-align:left;padding:4px 6px">Paramètre</th>
      <th style="text-align:right;padding:4px 6px">Valeur</th>
      <th style="text-align:right;padding:4px 6px">Norme</th>
    </tr></thead><tbody>${rows}</tbody></table></div>`;
}
