/**
 * GESTION DES POINTAGES - VUE LIVREUR
 * Système de pointage journalier avec km et photos
 */

const TimesheetsLivreurManager = (() => {
  // Variables globales
  let todayTimesheet = null;
  let startPhotoFile = null;
  let endPhotoFile = null;
  
  // Éléments DOM
  let widgetContainer;
  let modalStart;
  let modalEnd;

  /**
   * Initialisation
   */
  async function init() {
    console.log('🚴 Initialisation TimesheetsLivreurManager');
    
    widgetContainer = document.getElementById('timesheet-widget-content');
    modalStart = document.getElementById('modal-start-activity');
    modalEnd = document.getElementById('modal-end-activity');

    if (!widgetContainer) {
      console.warn('Widget timesheet non trouvé');
      return;
    }

    // Charger le pointage du jour
    await loadTodayTimesheet();
    
    // Render UI
    renderTimesheetWidget();
    
    // Attach events
    attachEvents();
  }

  /**
   * Obtenir la date sélectionnée dans le dashboard
   */
  function getSelectedDashboardDate() {
    const dashboardDateFilter = document.getElementById('dashboard-date-filter');
    return dashboardDateFilter?.value || formatLocalYYYYMMDD(new Date());
  }

  /**
   * Charger le pointage pour la date sélectionnée (ou aujourd'hui)
   */
  async function loadTodayTimesheet() {
    try {
      // Utiliser la date du dashboard si disponible, sinon aujourd'hui
      const selectedDate = getSelectedDashboardDate();
      
      const response = await fetch(`${window.API_BASE_URL}/timesheets/today?date=${selectedDate}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        todayTimesheet = data.data;
        console.log('📊 Pointage chargé pour', data.date, ':', todayTimesheet);
      } else {
        console.error('Erreur chargement pointage:', data.message);
      }
    } catch (error) {
      console.error('Erreur loadTodayTimesheet:', error);
    }
  }

  /**
   * Render le widget selon l'état du pointage
   */
  function renderTimesheetWidget() {
    if (!widgetContainer) return;

    let html = '';

    if (!todayTimesheet) {
      // Aucun pointage
      html = `
        <div class="timesheet-empty">
          <p>Vous n'avez pas encore pointé aujourd'hui</p>
        </div>
        <div class="timesheet-actions">
          <button id="btn-start-activity" class="btn-start-activity">
            🟢 Pointer le début
          </button>
          <button class="btn-end-activity" disabled>
            🔴 Pointer la fin
          </button>
        </div>
      `;
    } else if (todayTimesheet.start_time && !todayTimesheet.end_time) {
      // Début pointé, en attente de fin
      const startTime = new Date(todayTimesheet.start_time).toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      html = `
        <div class="timesheet-partial">
          <div class="timesheet-info">
            <div class="info-item">
              <span class="icon">🟢</span>
              <span class="label">Début:</span>
              <span class="value">${startTime} - ${todayTimesheet.start_km} km</span>
              <button class="btn-view-photo-small" data-timesheet-id="${todayTimesheet.id}" data-photo-type="start" title="Agrandir la photo de début">
                🔍
              </button>
            </div>
          </div>
          <div class="timesheet-actions-inline">
            <button class="btn-modify-start" data-timesheet-id="${todayTimesheet.id}" title="Modifier le début">
              ✏️ Modifier
            </button>
            <button class="btn-delete-timesheet" data-timesheet-id="${todayTimesheet.id}" title="Supprimer le pointage">
              🗑️ Supprimer
            </button>
          </div>
        </div>
        <div class="timesheet-actions">
          <button class="btn-start-activity" disabled>
            🟢 Pointer le début
          </button>
          <button id="btn-end-activity" class="btn-end-activity">
            🔴 Pointer la fin
          </button>
        </div>
      `;
    } else if (todayTimesheet.start_time && todayTimesheet.end_time) {
      // Pointage complet
      const startTime = new Date(todayTimesheet.start_time).toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      const endTime = new Date(todayTimesheet.end_time).toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      html = `
        <div class="timesheet-complete">
          <div class="success-badge">Activité du jour complétée</div>
          
          <div class="timesheet-summary">
            <div class="info-row">
              <span class="icon">🟢</span>
              <span class="label">Début:</span>
              <span class="value">${startTime} - ${todayTimesheet.start_km} km</span>
              <button class="btn-view-photo-small" data-timesheet-id="${todayTimesheet.id}" data-photo-type="start" title="Agrandir la photo de début">
                🔍
              </button>
            </div>
            <div class="info-row">
              <span class="icon">🔴</span>
              <span class="label">Fin:</span>
              <span class="value">${endTime} - ${todayTimesheet.end_km} km</span>
              <button class="btn-view-photo-small" data-timesheet-id="${todayTimesheet.id}" data-photo-type="end" title="Agrandir la photo de fin">
                🔍
              </button>
            </div>
          </div>
          
          <div class="km-counter">
            📊 ${todayTimesheet.total_km} KM parcourus
          </div>
          
          <div class="timesheet-actions-inline">
            <button class="btn-modify-timesheet" data-timesheet-id="${todayTimesheet.id}" title="Modifier le pointage">
              ✏️ Modifier
            </button>
            <button class="btn-delete-timesheet" data-timesheet-id="${todayTimesheet.id}" title="Supprimer le pointage">
              🗑️ Supprimer
            </button>
          </div>
        </div>
      `;
    }

    widgetContainer.innerHTML = html;
  }

  /**
   * Attacher les événements
   */
  function attachEvents() {
    // Bouton "Pointer le début"
    document.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'btn-start-activity') {
        openStartModal();
      }
    });

    // Bouton "Pointer la fin"
    document.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'btn-end-activity') {
        openEndModal();
      }
    });

    // Modal start - upload photo
    const startPhotoDropzone = document.getElementById('start-photo-dropzone');
    const startPhotoInput = document.getElementById('start-photo-input');
    
    if (startPhotoDropzone) {
      startPhotoDropzone.addEventListener('click', () => startPhotoInput.click());
    }
    
    if (startPhotoInput) {
      startPhotoInput.addEventListener('change', (e) => handleStartPhotoSelect(e.target.files[0]));
    }

    // Modal end - upload photo
    const endPhotoDropzone = document.getElementById('end-photo-dropzone');
    const endPhotoInput = document.getElementById('end-photo-input');
    
    if (endPhotoDropzone) {
      endPhotoDropzone.addEventListener('click', () => endPhotoInput.click());
    }
    
    if (endPhotoInput) {
      endPhotoInput.addEventListener('change', (e) => handleEndPhotoSelect(e.target.files[0]));
    }

    // Form submit
    const formStart = document.getElementById('form-start-activity');
    if (formStart) {
      formStart.addEventListener('submit', (e) => {
        e.preventDefault();
        submitStartActivity();
      });
    }

    const formEnd = document.getElementById('form-end-activity');
    if (formEnd) {
      formEnd.addEventListener('submit', (e) => {
        e.preventDefault();
        submitEndActivity();
      });
    }

    // Boutons voir photo
    document.addEventListener('click', async (e) => {
      if (e.target && e.target.classList.contains('btn-view-photo-small')) {
        const timesheetId = e.target.dataset.timesheetId;
        const photoType = e.target.dataset.photoType;
        if (timesheetId && photoType) {
          await viewPhoto(timesheetId, photoType);
        }
      }
    });

    // Boutons modifier début (quand seulement début est pointé)
    document.addEventListener('click', (e) => {
      if (e.target && e.target.classList.contains('btn-modify-start')) {
        const timesheetId = e.target.dataset.timesheetId;
        openModifyStartModal(timesheetId);
      }
    });

    // Boutons modifier (quand début ET fin sont pointés - affiche menu de choix)
    document.addEventListener('click', (e) => {
      if (e.target && e.target.classList.contains('btn-modify-timesheet')) {
        const timesheetId = e.target.dataset.timesheetId;
        showModifyChoiceMenu(timesheetId);
      }
    });

    // Boutons supprimer
    document.addEventListener('click', async (e) => {
      if (e.target && e.target.classList.contains('btn-delete-timesheet')) {
        const timesheetId = e.target.dataset.timesheetId;
        await deleteTimesheet(timesheetId);
      }
    });

    // Boutons annuler (maintenant des classes au lieu d'IDs dupliqués)
    document.addEventListener('click', (e) => {
      if (e.target && e.target.classList.contains('js-cancel-start')) {
        closeModal(modalStart);
        resetStartForm();
      }
      if (e.target && e.target.classList.contains('js-cancel-end')) {
        closeModal(modalEnd);
        resetEndForm();
      }
    });
  }

  /**
   * Formater une date locale en YYYY-MM-DD
   */
  function formatLocalYYYYMMDD(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Ouvrir le modal de début d'activité
   */
  function openStartModal() {
    if (!modalStart) return;

    // Pré-remplir la date en utilisant celle du sélecteur du dashboard (ou date locale)
    const dashboardDateFilter = document.getElementById('dashboard-date-filter');
    const selectedDate = dashboardDateFilter?.value || formatLocalYYYYMMDD(new Date());
    
    const dateInput = document.getElementById('start-date');
    if (dateInput) {
      dateInput.value = selectedDate;
      dateInput.setAttribute('readonly', 'true'); // Livreur ne peut changer la date
    }

    showModal(modalStart);
  }

  /**
   * Ouvrir le modal de fin d'activité
   */
  function openEndModal() {
    if (!modalEnd) return;

    // Pré-remplir la date en utilisant celle du sélecteur du dashboard (ou date locale)
    const dashboardDateFilter = document.getElementById('dashboard-date-filter');
    const selectedDate = dashboardDateFilter?.value || formatLocalYYYYMMDD(new Date());
    
    const dateInput = document.getElementById('end-date');
    if (dateInput) {
      dateInput.value = selectedDate;
      dateInput.setAttribute('readonly', 'true');
    }

    // Afficher les infos de début
    const startInfo = document.getElementById('end-start-info');
    if (startInfo && todayTimesheet) {
      const startTime = new Date(todayTimesheet.start_time).toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      startInfo.textContent = `Début d'activité: ${todayTimesheet.start_km} km à ${startTime}`;
    }

    showModal(modalEnd);
  }

  /**
   * Gérer la sélection de photo de début
   */
  function handleStartPhotoSelect(file) {
    if (!file) return;

    // Valider
    const validation = validatePhoto(file);
    if (!validation.valid) {
      showNotification(validation.error, 'error');
      return;
    }

    startPhotoFile = file;
    renderPhotoPreview('start-photo-preview', file);
  }

  /**
   * Gérer la sélection de photo de fin
   */
  function handleEndPhotoSelect(file) {
    if (!file) return;

    const validation = validatePhoto(file);
    if (!validation.valid) {
      showNotification(validation.error, 'error');
      return;
    }

    endPhotoFile = file;
    renderPhotoPreview('end-photo-preview', file);
  }

  /**
   * Valider une photo
   */
  function validatePhoto(file) {
    const MAX_SIZE = 10 * 1024 * 1024; // 10 Mo
    const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

    if (file.size > MAX_SIZE) {
      return { valid: false, error: 'Photo trop volumineuse (max 10 Mo)' };
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return { valid: false, error: 'Format non accepté (JPEG ou PNG uniquement)' };
    }

    return { valid: true, error: null };
  }

  /**
   * Afficher la preview d'une photo
   */
  function renderPhotoPreview(containerId, file) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      container.innerHTML = `
        <div class="photo-preview">
          <img src="${e.target.result}" alt="Preview" />
          <div class="photo-name">${file.name}</div>
        </div>
      `;
    };
    reader.readAsDataURL(file);
  }

  /**
   * Soumettre le début d'activité
   */
  async function submitStartActivity() {
    const date = document.getElementById('start-date').value;
    const km = document.getElementById('start-km').value;
    const isEditMode = modalStart.dataset.mode === 'edit';
    const timesheetId = modalStart.dataset.timesheetId;

    // Validations
    if (!date || !km) {
      showNotification('Veuillez remplir tous les champs', 'error');
      return;
    }

    // Photo obligatoire en mode création, optionnelle en mode modification
    if (!isEditMode && !startPhotoFile) {
      showNotification('Veuillez ajouter une photo', 'error');
      return;
    }

    const kmNumber = parseFloat(km);
    if (isNaN(kmNumber) || kmNumber < 0) {
      showNotification('Kilométrage invalide', 'error');
      return;
    }

    // Préparer FormData
    const formData = new FormData();
    formData.append('km', km);
    if (startPhotoFile) {
      formData.append('photo', startPhotoFile);
    }
    
    if (!isEditMode) {
      formData.append('date', date);
    }

    // Loader
    showNotification(isEditMode ? 'Modification en cours...' : 'Enregistrement en cours...', 'info');

    try {
      const url = isEditMode 
        ? `${window.API_BASE_URL}/timesheets/${timesheetId}/start`
        : `${window.API_BASE_URL}/timesheets/start`;
      
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        const message = isEditMode ? '✅ Début d\'activité modifié !' : '✅ Début d\'activité enregistré !';
        showNotification(message, 'success');
        closeModal(modalStart);
        resetStartForm();
        
        // Nettoyer le mode
        delete modalStart.dataset.mode;
        delete modalStart.dataset.timesheetId;
        
        // Recharger
        await loadTodayTimesheet();
        renderTimesheetWidget();
      } else {
        showNotification(data.message || 'Erreur lors de l\'enregistrement', 'error');
      }
    } catch (error) {
      console.error('Erreur submitStartActivity:', error);
      showNotification('Erreur de connexion', 'error');
    }
  }

  /**
   * Soumettre la fin d'activité
   */
  async function submitEndActivity() {
    const date = document.getElementById('end-date').value;
    const km = document.getElementById('end-km').value;
    const isEditMode = modalEnd.dataset.mode === 'edit';
    const timesheetId = modalEnd.dataset.timesheetId;

    // Validations
    if (!date || !km) {
      showNotification('Veuillez remplir tous les champs', 'error');
      return;
    }

    // Photo obligatoire en mode création, optionnelle en mode modification
    if (!isEditMode && !endPhotoFile) {
      showNotification('Veuillez ajouter une photo', 'error');
      return;
    }

    const kmNumber = parseFloat(km);
    if (isNaN(kmNumber) || kmNumber < 0) {
      showNotification('Kilométrage invalide', 'error');
      return;
    }

    // Vérifier que end_km >= start_km
    if (todayTimesheet && kmNumber < todayTimesheet.start_km) {
      showNotification(`Le km de fin (${kmNumber}) doit être >= au km de début (${todayTimesheet.start_km})`, 'error');
      return;
    }

    // Préparer FormData
    const formData = new FormData();
    formData.append('km', km);
    if (endPhotoFile) {
      formData.append('photo', endPhotoFile);
    }
    
    if (!isEditMode) {
      formData.append('date', date);
    }

    showNotification(isEditMode ? 'Modification en cours...' : 'Enregistrement en cours...', 'info');

    try {
      const url = isEditMode 
        ? `${window.API_BASE_URL}/timesheets/${timesheetId}/end`
        : `${window.API_BASE_URL}/timesheets/end`;
      
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        const totalKm = data.data.total_km;
        const message = isEditMode 
          ? `✅ Fin d'activité modifiée ! Total: ${totalKm} km.`
          : `✅ Fin d'activité enregistrée ! Vous avez parcouru ${totalKm} km aujourd'hui.`;
        showNotification(message, 'success');
        closeModal(modalEnd);
        resetEndForm();
        
        // Nettoyer le mode
        delete modalEnd.dataset.mode;
        delete modalEnd.dataset.timesheetId;
        
        // Recharger
        await loadTodayTimesheet();
        renderTimesheetWidget();
      } else {
        showNotification(data.message || 'Erreur lors de l\'enregistrement', 'error');
      }
    } catch (error) {
      console.error('Erreur submitEndActivity:', error);
      showNotification('Erreur de connexion', 'error');
    }
  }

  /**
   * Reset form début
   */
  function resetStartForm() {
    document.getElementById('start-km').value = '';
    document.getElementById('start-photo-input').value = '';
    document.getElementById('start-photo-preview').innerHTML = '';
    startPhotoFile = null;
  }

  /**
   * Reset form fin
   */
  function resetEndForm() {
    document.getElementById('end-km').value = '';
    document.getElementById('end-photo-input').value = '';
    document.getElementById('end-photo-preview').innerHTML = '';
    endPhotoFile = null;
  }

  /**
   * Voir une photo de pointage
   */
  async function viewPhoto(timesheetId, photoType) {
    try {
      showNotification('Chargement de la photo...', 'info');
      
      // Télécharger la photo avec authentification
      const response = await fetch(`${window.API_BASE_URL}/timesheets/${timesheetId}/photo/${photoType}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        showNotification('Erreur lors du téléchargement de la photo', 'error');
        return;
      }

      // Convertir en blob puis en data URL
      const blob = await response.blob();
      const dataURL = await blobToDataURL(blob);

      // Créer un modal pour afficher la photo
      const photoLabel = photoType === 'start' ? 'Début d\'activité' : 'Fin d\'activité';
      const modalHTML = `
        <div id="photo-modal-temp" class="modal active" style="z-index: 10000;">
          <div class="modal-overlay" id="photo-modal-overlay-temp"></div>
          <div class="modal-content" style="max-width: 800px;">
            <div class="modal-header">
              <h3>📷 Photo - ${photoLabel}</h3>
              <button id="close-photo-modal-temp" class="modal-close" aria-label="Fermer">&times;</button>
            </div>
            <div class="modal-body" style="text-align: center;">
              <img id="photo-img-temp" src="${dataURL}" alt="Photo ${photoLabel}" style="max-width: 100%; height: auto; border-radius: 8px;" />
            </div>
          </div>
        </div>
      `;

      // Insérer le modal dans le DOM
      const modalContainer = document.createElement('div');
      modalContainer.innerHTML = modalHTML;
      document.body.appendChild(modalContainer);

      // Event listeners pour fermer
      document.getElementById('close-photo-modal-temp').addEventListener('click', () => {
        modalContainer.remove();
      });
      document.getElementById('photo-modal-overlay-temp').addEventListener('click', () => {
        modalContainer.remove();
      });

    } catch (error) {
      console.error('Erreur viewPhoto:', error);
      showNotification('Erreur lors de l\'affichage de la photo', 'error');
    }
  }

  /**
   * Convertir un blob en data URL
   */
  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Afficher un modal de confirmation personnalisé
   */
  function showConfirmModal(title, message, onConfirm) {
    const modalHTML = `
      <div id="modal-confirm-delete" class="modal active" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(4px); padding: 1rem;">
        <div class="modal-overlay" id="confirm-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7);"></div>
        <div class="modal-content" style="position: relative; z-index: 10001; max-width: 450px; width: 95%; background: white; border-radius: 1rem; box-shadow: 0 25px 75px rgba(0, 0, 0, 0.5); padding: 0; animation: modalSlideIn 0.3s ease-out;">
          <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 1rem 1rem 0 0;">
            <h3 style="margin: 0; color: white; font-size: 1.25rem; font-weight: 700;">${title}</h3>
            <button id="close-confirm" class="modal-close" style="background: rgba(255, 255, 255, 0.2); border: 2px solid rgba(255, 255, 255, 0.3); font-size: 1.5rem; cursor: pointer; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">&times;</button>
          </div>
          <div class="modal-body" style="padding: 2rem 1.5rem;">
            <p style="color: #4a5568; font-size: 1rem; line-height: 1.6; margin: 0; white-space: pre-line;">${message}</p>
          </div>
          <div class="modal-footer" style="display: flex; gap: 0.75rem; padding: 1.25rem 1.5rem; background: #f7fafc; border-radius: 0 0 1rem 1rem; justify-content: flex-end;">
            <button id="btn-cancel-confirm" class="btn-secondary" style="padding: 0.75rem 1.5rem; background: #e2e8f0; color: #4a5568; border: none; border-radius: 0.5rem; cursor: pointer; font-size: 1rem; font-weight: 600; transition: all 0.2s;">Annuler</button>
            <button id="btn-ok-confirm" class="btn-danger" style="padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; border-radius: 0.5rem; cursor: pointer; font-size: 1rem; font-weight: 600; transition: all 0.2s;">Supprimer</button>
          </div>
        </div>
      </div>
    `;
    
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);
    
    const closeModal = () => {
      modalContainer.remove();
    };
    
    document.getElementById('close-confirm').addEventListener('click', closeModal);
    document.getElementById('confirm-overlay').addEventListener('click', closeModal);
    document.getElementById('btn-cancel-confirm').addEventListener('click', closeModal);
    
    document.getElementById('btn-ok-confirm').addEventListener('click', () => {
      closeModal();
      onConfirm();
    });
    
    // Fermer avec Escape
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  /**
   * Supprimer un pointage
   */
  async function deleteTimesheet(timesheetId) {
    showConfirmModal(
      '⚠️ Supprimer le pointage',
      'Êtes-vous sûr de vouloir supprimer ce pointage ?\n\nCette action est irréversible.',
      async () => {
        await performDeleteTimesheet(timesheetId);
      }
    );
  }

  /**
   * Effectuer la suppression du pointage
   */
  async function performDeleteTimesheet(timesheetId) {
    try {
      showNotification('Suppression en cours...', 'info');
      
      const response = await fetch(`${window.API_BASE_URL}/timesheets/${timesheetId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      let data;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch (parseError) {
          console.error('Erreur parsing JSON:', parseError);
          data = { message: response.statusText || `Erreur ${response.status}` };
        }
      } else {
        data = { message: response.statusText || `Erreur ${response.status}` };
      }

      if (response.ok) {
        showNotification('✅ Pointage supprimé avec succès', 'success');
        await loadTodayTimesheet();
        renderTimesheetWidget();
      } else {
        showNotification(data.message || 'Erreur lors de la suppression', 'error');
      }
    } catch (error) {
      console.error('Erreur performDeleteTimesheet:', error);
      showNotification('Erreur de connexion', 'error');
    }
  }

  /**
   * Afficher le menu de choix de modification
   */
  function showModifyChoiceMenu(timesheetId) {
    // Créer un modal de choix responsive (mobile-first)
    const choiceModalHTML = `
      <div id="modify-choice-modal" class="modal active" style="position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; display: flex !important; align-items: center !important; justify-content: center !important; z-index: 10000 !important; backdrop-filter: blur(4px) !important; padding: 1rem !important;">
        <div class="modal-overlay" id="modify-choice-overlay" style="position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; background: rgba(0, 0, 0, 0.7) !important; backdrop-filter: blur(8px) !important; animation: fadeIn 0.2s ease !important;"></div>
        <div class="modal-content" style="position: relative !important; z-index: 10001 !important; max-width: 450px !important; width: 95% !important; max-height: 90vh !important; overflow-y: auto !important; background: white !important; border-radius: 1rem !important; box-shadow: 0 25px 75px rgba(0, 0, 0, 0.5) !important; padding: 0 !important; animation: slideUp 0.3s ease !important; margin: 0 auto !important;">
          <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-bottom: 3px solid #1e40af; border-radius: 1rem 1rem 0 0; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);">
            <h3 style="margin: 0; color: white; font-size: clamp(1rem, 4vw, 1.25rem); font-weight: 700; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.15); flex: 1; padding-right: 0.5rem;">✏️ Que voulez-vous modifier ?</h3>
            <button id="close-modify-choice" class="modal-close" aria-label="Fermer" style="background: rgba(255, 255, 255, 0.2); border: 2px solid rgba(255, 255, 255, 0.3); font-size: 1.5rem; cursor: pointer; color: white; width: 36px; height: 36px; min-width: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0;">&times;</button>
          </div>
          <div class="modal-body" style="padding: 1.5rem; background: white;">
            <button id="btn-choice-start" class="btn-choice-modify" data-timesheet-id="${timesheetId}" style="width: 100%; margin-bottom: 1rem; padding: 1rem; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: clamp(0.95rem, 3.5vw, 1.05rem); font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 0.75rem; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: all 0.2s; -webkit-tap-highlight-color: transparent; touch-action: manipulation;">
              <span style="font-size: 1.5rem;">🟢</span>
              <span>Modifier le début</span>
            </button>
            <button id="btn-choice-end" class="btn-choice-modify" data-timesheet-id="${timesheetId}" style="width: 100%; padding: 1rem; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: clamp(0.95rem, 3.5vw, 1.05rem); font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 0.75rem; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); transition: all 0.2s; -webkit-tap-highlight-color: transparent; touch-action: manipulation;">
              <span style="font-size: 1.5rem;">🔴</span>
              <span>Modifier la fin</span>
            </button>
          </div>
        </div>
      </div>
    `;

    // Insérer le modal dans le DOM
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = choiceModalHTML;
    document.body.appendChild(modalContainer);

    // Event listeners
    const closeChoice = () => {
      console.log('🔴 closeChoice appelé - fermeture du modal de choix');
      try {
        if (modalContainer && modalContainer.parentNode) {
          modalContainer.remove();
          console.log('✅ Modal de choix supprimé avec succès');
        } else {
          console.warn('⚠️ modalContainer n\'a pas de parent');
        }
      } catch (error) {
        console.error('❌ Erreur lors de la suppression du modal:', error);
      }
    };

    const closeBtn = document.getElementById('close-modify-choice');
    const overlay = document.getElementById('modify-choice-overlay');
    
    console.log('📋 Boutons trouvés:', { 
      closeBtn: !!closeBtn, 
      overlay: !!overlay,
      timesheetId 
    });
    
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        console.log('🖱️ Clic sur bouton X détecté');
        e.preventDefault();
        e.stopPropagation();
        closeChoice();
      });
    } else {
      console.error('❌ Bouton close-modify-choice non trouvé !');
    }
    
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        console.log('🖱️ Clic sur overlay détecté');
        e.preventDefault();
        e.stopPropagation();
        closeChoice();
      });
    }
    
    document.getElementById('btn-choice-start').addEventListener('click', () => {
      console.log('🟢 Clic sur "Modifier le début"');
      closeChoice();
      openModifyStartModal(timesheetId);
    });
    
    document.getElementById('btn-choice-end').addEventListener('click', () => {
      console.log('🔴 Clic sur "Modifier la fin"');
      closeChoice();
      openModifyEndModal(timesheetId);
    });
  }

  /**
   * Ouvrir le modal pour modifier le début
   */
  function openModifyStartModal(timesheetId) {
    if (!todayTimesheet || !modalStart) return;
    
    // Réinitialiser le formulaire d'abord
    resetStartForm();
    
    // Pré-remplir avec les données existantes
    const dateInput = document.getElementById('start-date');
    const kmInput = document.getElementById('start-km');
    
    if (dateInput) {
      dateInput.value = todayTimesheet.date.split('T')[0];
      dateInput.setAttribute('readonly', 'true');
    }
    if (kmInput) {
      kmInput.value = todayTimesheet.start_km;
    }
    
    // Message pour indiquer que la photo est optionnelle
    const photoPreview = document.getElementById('start-photo-preview');
    if (photoPreview) {
      photoPreview.innerHTML = '<p style="color: #666; font-size: 0.9rem;">📷 Photo actuelle conservée. Vous pouvez en uploader une nouvelle (optionnel).</p>';
    }
    
    // Marquer qu'on est en mode modification
    modalStart.dataset.mode = 'edit';
    modalStart.dataset.timesheetId = timesheetId;
    
    showModal(modalStart);
  }

  /**
   * Ouvrir le modal pour modifier la fin
   */
  function openModifyEndModal(timesheetId) {
    if (!todayTimesheet || !modalEnd) return;
    
    // Réinitialiser le formulaire d'abord
    resetEndForm();
    
    // Pré-remplir avec les données existantes
    const dateInput = document.getElementById('end-date');
    const kmInput = document.getElementById('end-km');
    
    if (dateInput) {
      dateInput.value = todayTimesheet.date.split('T')[0];
      dateInput.setAttribute('readonly', 'true');
    }
    if (kmInput) {
      kmInput.value = todayTimesheet.end_km;
    }
    
    // Message pour indiquer que la photo est optionnelle
    const photoPreview = document.getElementById('end-photo-preview');
    if (photoPreview) {
      photoPreview.innerHTML = '<p style="color: #666; font-size: 0.9rem;">📷 Photo actuelle conservée. Vous pouvez en uploader une nouvelle (optionnel).</p>';
    }
    
    // Marquer qu'on est en mode modification
    modalEnd.dataset.mode = 'edit';
    modalEnd.dataset.timesheetId = timesheetId;
    
    showModal(modalEnd);
  }

  /**
   * Afficher/cacher un modal
   */
  function showModal(modal) {
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('active');
    }
  }

  function closeModal(modal) {
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('active');
    }
  }

  /**
   * Afficher une notification
   */
  function showNotification(message, type = 'info') {
    if (typeof ToastManager !== 'undefined') {
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
      console.log(`[${type.toUpperCase()}] ${message}`);
      alert(message);
    }
  }

  // API publique
  return {
    init,
    loadTodayTimesheet,
    renderTimesheetWidget
  };
})();

// Exposer globalement pour débogage
window.TimesheetsLivreurManager = TimesheetsLivreurManager;

// L'initialisation sera appelée depuis main.js dans displayTimesheetWidgets()
// Pas besoin de setTimeout ici
