/**
 * GESTION DES PIÈCES JOINTES
 * Système d'upload, preview et gestion des fichiers
 */

const AttachmentsManager = (() => {
  // Variables globales
  let selectedFiles = [];
  const MAX_FILES = 2;
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB en bytes
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
  const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'];
  const MAX_RETRIES = 2;
  const RETRY_DELAY = 1000; // 1 seconde

  // Éléments DOM
  let dropzone;
  let fileInput;
  let filesPreview;

  /**
   * Afficher une notification (utilise ToastManager si disponible)
   */
  function showNotification(message, type = 'info') {
    if (typeof ToastManager !== 'undefined') {
      // Utiliser ToastManager si disponible
      switch(type) {
        case 'success':
          ToastManager.success(message);
          break;
        case 'error':
          ToastManager.error(message);
          break;
        case 'warning':
          ToastManager.warning(message);
          break;
        default:
          ToastManager.info(message);
      }
    } else {
      // Fallback : console
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Fetch avec gestion du rate limiting (429)
   */
  async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
    try {
      const response = await fetch(url, options);
      
      // Si rate limited et qu'il reste des tentatives, réessayer
      if (response.status === 429 && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return fetchWithRetry(url, options, retries - 1);
      }
      
      return response;
    } catch (error) {
      // Si erreur réseau et qu'il reste des tentatives, réessayer
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return fetchWithRetry(url, options, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Initialisation du gestionnaire de pièces jointes
   */
  function init() {
    dropzone = document.getElementById('dropzone');
    fileInput = document.getElementById('attachments-input');
    filesPreview = document.getElementById('files-preview');

    if (!dropzone || !fileInput || !filesPreview) {
      console.warn('Éléments de pièces jointes non trouvés');
      return;
    }

    // Événements du dropzone
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', handleDragOver);
    dropzone.addEventListener('dragleave', handleDragLeave);
    dropzone.addEventListener('drop', handleDrop);

    // Événement de sélection de fichiers
    fileInput.addEventListener('change', handleFileSelect);
  }

  /**
   * Gestion du drag over
   */
  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add('dragover');
  }

  /**
   * Gestion du drag leave
   */
  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('dragover');
  }

  /**
   * Gestion du drop
   */
  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('dragover');

    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }

  /**
   * Gestion de la sélection de fichiers
   */
  function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    addFiles(files);
    // Réinitialiser l'input pour permettre de sélectionner le même fichier
    fileInput.value = '';
  }

  /**
   * Ajouter des fichiers à la liste
   */
  function addFiles(files) {
    // Vérifier le nombre total de fichiers
    if (selectedFiles.length + files.length > MAX_FILES) {
      showNotification(`Vous ne pouvez ajouter que ${MAX_FILES} fichiers maximum`, 'warning');
      return;
    }

    // Valider et ajouter chaque fichier
    for (const file of files) {
      const validation = validateFile(file);
      if (validation.valid) {
        selectedFiles.push(file);
      } else {
        showNotification(validation.error, 'error');
      }
    }

    // Afficher la preview
    renderFilesPreview();
  }

  /**
   * Valider un fichier
   */
  function validateFile(file) {
    // Vérifier la taille
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `"${file.name}" est trop volumineux (max 10 Mo)`
      };
    }

    // Vérifier le type MIME
    if (!ALLOWED_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: `"${file.name}" n'est pas un format accepté (JPEG, PNG, PDF uniquement)`
      };
    }

    // Vérifier l'extension
    const extension = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return {
        valid: false,
        error: `Extension "${extension}" non autorisée`
      };
    }

    return { valid: true, error: null };
  }

  /**
   * Afficher la preview des fichiers
   */
  function renderFilesPreview() {
    if (selectedFiles.length === 0) {
      filesPreview.style.display = 'none';
      filesPreview.innerHTML = '';
      return;
    }

    filesPreview.style.display = 'block';
    filesPreview.innerHTML = selectedFiles
      .map((file, index) => createFilePreviewHTML(file, index))
      .join('');

    // Ajouter les événements de suppression
    selectedFiles.forEach((_, index) => {
      const removeBtn = document.getElementById(`remove-file-${index}`);
      if (removeBtn) {
        removeBtn.addEventListener('click', () => removeFile(index));
      }
    });
  }

  /**
   * Créer le HTML pour la preview d'un fichier
   */
  function createFilePreviewHTML(file, index) {
    const icon = getFileIcon(file.type);
    const size = formatFileSize(file.size);

    return `
      <div class="file-preview-item">
        <div class="file-info">
          <span class="file-icon">${icon}</span>
          <div class="file-details">
            <div class="file-name">${escapeHtml(file.name)}</div>
            <div class="file-size">${size}</div>
          </div>
        </div>
        <div class="file-actions">
          <button type="button" id="remove-file-${index}" class="btn-icon btn-danger" title="Supprimer">
            🗑️
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Supprimer un fichier de la liste
   */
  function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderFilesPreview();
  }

  /**
   * Obtenir l'icône selon le type de fichier
   */
  function getFileIcon(type) {
    if (type.startsWith('image/')) return '🖼️';
    if (type === 'application/pdf') return '📄';
    return '📎';
  }

  /**
   * Formater la taille du fichier
   */
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Échapper le HTML pour éviter les injections
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Uploader les fichiers sélectionnés
   */
  async function uploadFiles(orderId) {
    if (selectedFiles.length === 0) {
      return { success: true, message: 'Aucun fichier à uploader' };
    }

    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('attachments', file);
    });

    try {
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}/attachments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erreur lors de l\'upload des fichiers');
      }

      return { success: true, data: data.data };
    } catch (error) {
      console.error('Erreur upload fichiers:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Récupérer les pièces jointes d'une commande
   */
  async function getAttachments(orderId) {
    try {
      const response = await fetchWithRetry(`${API_BASE_URL}/orders/${orderId}/attachments`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      // Si 404, c'est normal - aucune pièce jointe
      if (response.status === 404) {
        return { success: true, data: [] };
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erreur lors de la récupération des pièces jointes');
      }

      return { success: true, data: data.data };
    } catch (error) {
      // Ne pas logger les 404 - c'est attendu quand il n'y a pas de pièces jointes
      if (error.message && !error.message.includes('404')) {
        console.error('Erreur récupération pièces jointes:', error);
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Télécharger une pièce jointe
   */
  async function downloadAttachment(attachmentId, originalName) {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/attachments/${attachmentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors du téléchargement');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showNotification('Fichier téléchargé avec succès', 'success');
    } catch (error) {
      console.error('Erreur téléchargement:', error);
      showNotification('Erreur lors du téléchargement du fichier', 'error');
    }
  }

  /**
   * Supprimer une pièce jointe
   */
  async function deleteAttachment(attachmentId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette pièce jointe ?')) {
      return { success: false, cancelled: true };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/orders/attachments/${attachmentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erreur lors de la suppression');
      }

      return { success: true };
    } catch (error) {
      console.error('Erreur suppression:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Afficher les pièces jointes dans le détail d'une commande
   */
  async function renderOrderAttachments(orderId, containerElement) {
    const result = await getAttachments(orderId);

    if (!result.success) {
      containerElement.innerHTML = `
        <div class="order-attachments-section">
          <h4>📎 Pièces jointes</h4>
          <div class="no-attachments">Erreur lors du chargement des pièces jointes</div>
        </div>
      `;
      return;
    }

    const attachments = result.data;

    if (attachments.length === 0) {
      containerElement.innerHTML = `
        <div class="order-attachments-section">
          <h4>📎 Pièces jointes</h4>
          <div class="no-attachments">Aucune pièce jointe</div>
        </div>
      `;
      return;
    }

    const attachmentsHTML = attachments.map(att => {
      const icon = getFileIcon(att.file_type);
      const size = formatFileSize(att.file_size);
      const uploadDate = new Date(att.uploaded_at).toLocaleDateString('fr-FR');

      return `
        <div class="attachment-item" data-id="${att.id}">
          <div class="attachment-info">
            <span class="attachment-icon">${icon}</span>
            <div class="attachment-details">
              <div class="attachment-name">${escapeHtml(att.original_name)}</div>
              <div class="attachment-meta">${size} • Ajouté le ${uploadDate}</div>
            </div>
          </div>
          <div class="attachment-actions">
            <button type="button" class="btn-icon btn-download" data-attachment-id="${att.id}" data-filename="${escapeHtml(att.original_name)}" title="Télécharger">
              📥
            </button>
            <button type="button" class="btn-icon btn-danger btn-delete-attachment" data-attachment-id="${att.id}" data-order-id="${orderId}" title="Supprimer">
              🗑️
            </button>
          </div>
        </div>
      `;
    }).join('');

    containerElement.innerHTML = `
      <div class="order-attachments-section">
        <h4>📎 Pièces jointes (${attachments.length})</h4>
        ${attachmentsHTML}
      </div>
    `;

    // Attacher les event listeners pour les boutons de téléchargement
    containerElement.querySelectorAll('.btn-download').forEach(btn => {
      btn.addEventListener('click', () => {
        const attachmentId = btn.getAttribute('data-attachment-id');
        const filename = btn.getAttribute('data-filename');
        downloadAttachment(attachmentId, filename);
      });
    });

    // Attacher les event listeners pour les boutons de suppression
    containerElement.querySelectorAll('.btn-delete-attachment').forEach(btn => {
      btn.addEventListener('click', () => {
        const attachmentId = btn.getAttribute('data-attachment-id');
        const orderIdFromBtn = btn.getAttribute('data-order-id');
        handleDeleteAttachment(attachmentId, orderIdFromBtn);
      });
    });
  }

  /**
   * Gérer la suppression d'une pièce jointe avec rafraîchissement
   */
  async function handleDeleteAttachment(attachmentId, orderId) {
    const result = await deleteAttachment(attachmentId);

    if (result.success) {
      showNotification('Pièce jointe supprimée avec succès', 'success');
      // Rafraîchir l'affichage
      const container = document.querySelector('.order-attachments-section').parentElement;
      if (container) {
        await renderOrderAttachments(orderId, container);
      }
    } else if (!result.cancelled) {
      showNotification(result.error || 'Erreur lors de la suppression', 'error');
    }
  }

  /**
   * Réinitialiser les fichiers sélectionnés
   */
  function reset() {
    selectedFiles = [];
    renderFilesPreview();
    if (fileInput) {
      fileInput.value = '';
    }
  }

  /**
   * Obtenir les fichiers sélectionnés
   */
  function getSelectedFiles() {
    return selectedFiles;
  }

  /**
   * Récupérer le nombre de pièces jointes d'une commande (pour badge)
   */
  async function getAttachmentsCount(orderId) {
    try {
      const response = await fetchWithRetry(`${API_BASE_URL}/orders/${orderId}/attachments`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      // Si 404, c'est normal - aucune pièce jointe, donc retourner 0
      if (response.status === 404) {
        return 0;
      }

      if (!response.ok) {
        return 0;
      }

      const data = await response.json();
      return data.data ? data.data.length : 0;
    } catch (error) {
      // Silencieux - retourner simplement 0 si erreur
      return 0;
    }
  }

  /**
   * Générer le HTML du badge de pièces jointes
   */
  function getAttachmentBadge(count) {
    if (count === 0) return '';
    return `<span class="badge badge-attachments" title="${count} pièce(s) jointe(s)">📎 ${count}</span>`;
  }

  // API publique
  return {
    init,
    uploadFiles,
    getAttachments,
    getAttachmentsCount,
    downloadAttachment,
    deleteAttachment,
    renderOrderAttachments,
    handleDeleteAttachment,
    reset,
    getSelectedFiles,
    getAttachmentBadge
  };
})();

// Initialiser au chargement du DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', AttachmentsManager.init);
} else {
  AttachmentsManager.init();
}

