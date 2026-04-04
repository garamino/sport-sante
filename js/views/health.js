import { today, formatDateFR, showToast } from '../utils.js';
import { uploadHealthFile, deleteHealthFile, saveHealthDoc, deleteHealthDoc, getAllHealthDocs } from '../db.js';
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
            <input type="file" id="health-file" accept="image/*,.pdf" style="display:none">
            <div class="upload-placeholder" id="upload-placeholder">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span style="color:var(--text-secondary);font-size:13px;margin-top:4px">Appuie pour choisir un fichier</span>
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
          <label>Contenu (resultats, observations...)</label>
          <textarea id="health-text-content" rows="6" placeholder="Ex: Hemoglobine 14.2 g/dL, Ferritine 45 ng/mL, Glycemie 0.92 g/L..."></textarea>
        </div>
        <button class="btn btn-success" id="health-text-btn">Enregistrer</button>
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
      <button class="btn btn-success" id="health-result-save">Valider et sauvegarder</button>
    </div>

    <!-- History -->
    ${docs.length > 0 ? `
      <div class="card">
        <div class="card-title">Historique</div>
        ${docs.map(d => `
          <div class="health-doc-item" style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:flex-start">
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;color:var(--text-secondary)">${formatDateFR(d.date)} — ${formatDocType(d.type)}</div>
              <div style="font-size:13px;margin-top:4px;white-space:pre-wrap;overflow:hidden;max-height:80px">${escapeHtml(d.summary || d.content || '')}</div>
            </div>
            <button class="btn btn-small health-delete-btn" data-id="${d.id}" data-path="${d.storagePath || ''}" style="color:var(--danger);background:none;padding:4px 8px;flex-shrink:0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
            </button>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;

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

  // --- File input ---
  let selectedFile = null;
  const fileInput = document.getElementById('health-file');
  const uploadZone = document.getElementById('upload-zone');
  const placeholder = document.getElementById('upload-placeholder');
  const preview = document.getElementById('upload-preview');
  const filenameEl = document.getElementById('upload-filename');

  uploadZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    selectedFile = fileInput.files[0] || null;
    if (selectedFile) {
      placeholder.classList.add('hidden');
      preview.classList.remove('hidden');
      filenameEl.textContent = selectedFile.name;
    }
  });
  document.getElementById('upload-clear').addEventListener('click', (e) => {
    e.stopPropagation();
    selectedFile = null;
    fileInput.value = '';
    placeholder.classList.remove('hidden');
    preview.classList.add('hidden');
  });

  // --- Upload & analyze ---
  let pendingExtraction = null;
  document.getElementById('health-upload-btn').addEventListener('click', async () => {
    if (!selectedFile) { showToast('Choisis un fichier'); return; }

    const btn = document.getElementById('health-upload-btn');
    btn.disabled = true;
    btn.textContent = 'Upload en cours...';

    try {
      const { path, url } = await uploadHealthFile(selectedFile);
      btn.textContent = 'Analyse en cours...';

      const result = await processHealthDocFn({
        fileUrl: url,
        storagePath: path,
        type: document.getElementById('health-type').value,
        date: document.getElementById('health-date').value,
      });

      if (result.data.error) {
        showToast(result.data.message || 'Erreur');
        btn.disabled = false;
        btn.textContent = 'Analyser le document';
        return;
      }

      const extracted = result.data.summary;
      pendingExtraction = {
        date: document.getElementById('health-date').value,
        type: document.getElementById('health-type').value,
        summary: extracted,
        storagePath: path,
        source: 'upload',
      };

      document.getElementById('health-result-text').textContent = extracted;
      document.getElementById('health-result-edit').value = extracted;
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

    try {
      await saveHealthDoc(pendingExtraction);
      // Delete original file from storage (only keep summary)
      await deleteHealthFile(pendingExtraction.storagePath);
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
    if (!content) { showToast('Entre du contenu'); return; }

    const btn = document.getElementById('health-text-btn');
    btn.disabled = true;
    btn.textContent = 'Enregistrement...';

    try {
      await saveHealthDoc({
        date: document.getElementById('health-text-date').value,
        type: document.getElementById('health-text-type').value,
        content,
        summary: content,
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

  // --- Delete ---
  container.querySelectorAll('.health-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const path = btn.dataset.path;
      if (!confirm('Supprimer ce document ?')) return;
      try {
        if (path) await deleteHealthFile(path);
        await deleteHealthDoc(id);
        showToast('Supprime');
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
