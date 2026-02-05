/**
 * GESTION DES POINTAGES - VUE MANAGER
 * Voir tous les pointages + Pointer pour un livreur
 */

const TimesheetsManagerView = (() => {
  // Variables globales
  let currentDate = null; // Sera initialisé dans init()
  let allTimesheets = [];
  let stats = null;
  let selectedLivreur = null;
  let pointType = null; // 'start' | 'end'
  let photoFile = null;
  
  /**
   * Obtenir la date sélectionnée dans le dashboard
   */
  function getSelectedDashboardDate() {
    const dashboardDateFilter = document.getElementById('dashboard-date-filter');
    return dashboardDateFilter?.value || new Date().toISOString().split('T')[0];
  }
  
  // Éléments DOM
  let widgetContainer;
  let modalAllTimesheets;
  let modalPointForUser;

  /**
   * Initialisation
   */
  async function init() {
    console.log('📊 ==========================================');
    console.log('📊 INITIALISATION TimesheetsManagerView');
    console.log('📊 ==========================================');
    console.log('📊 User:', window.AppState?.user);
    console.log('📊 Role:', window.AppState?.user?.role);
    
    // Initialiser la date courante
    currentDate = getSelectedDashboardDate();
    console.log('📊 Date sélectionnée:', currentDate);
    
    widgetContainer = document.getElementById('timesheet-manager-widget');
    modalAllTimesheets = document.getElementById('modal-all-timesheets');
    modalPointForUser = document.getElementById('modal-point-for-user');

    console.log('📊 Éléments DOM:', {
      widgetContainer: !!widgetContainer,
      modalAllTimesheets: !!modalAllTimesheets,
      modalPointForUser: !!modalPointForUser
    });

    if (!widgetContainer) {
      console.error('❌ Widget manager timesheet non trouvé');
      return;
    }

    // Afficher le widget manager
    widgetContainer.style.display = 'block';
    console.log('📊 Widget affiché');
    
    // Charger un résumé rapide
    console.log('📊 Chargement résumé rapide...');
    await loadQuickSummary();
    
    // Attach events
    console.log('📊 Attachement des événements...');
    attachEvents();
    
    console.log('📊 ✅ Initialisation terminée');
  }

  /**
   * Charger un résumé rapide des pointages
   */
  async function loadQuickSummary() {
    try {
      console.log('📊 Chargement résumé pour date:', currentDate);
      const response = await fetch(`${window.API_BASE_URL}/timesheets/all?date=${currentDate}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        stats = data.stats;
        console.log('✅ Stats reçues:', stats);
        renderQuickSummary();
      } else {
        console.error('❌ Erreur API:', data.message);
      }
    } catch (error) {
      console.error('❌ Erreur loadQuickSummary:', error);
    }
  }

  /**
   * Render le résumé rapide
   */
  function renderQuickSummary() {
    const summaryElement = document.getElementById('timesheet-summary-text');
    if (!summaryElement) {
      console.warn('⚠️ Élément timesheet-summary-text non trouvé');
      return;
    }
    if (!stats) {
      console.warn('⚠️ Stats non disponibles');
      return;
    }

    console.log('📊 Rendu du résumé:', stats);
    summaryElement.innerHTML = `
      <strong>${stats.total_livreurs}</strong> livreurs actifs | 
      <span class="stat-success">${stats.complets} pointés</span> | 
      <span class="stat-partial">${stats.en_cours} en cours</span> | 
      <span class="stat-missing">${stats.non_pointes} manquants</span>
    `;
  }

  /**
   * Attacher les événements
   */
  function attachEvents() {
    // Bouton "Voir tous les pointages"
    const btnViewAll = document.getElementById('btn-view-all-timesheets');
    if (btnViewAll) {
      console.log('📊 Bouton "Voir tous les pointages" trouvé, redirection vers pointage.html');
      btnViewAll.addEventListener('click', () => {
        console.log('📊 Clic détecté, redirection...');
        
        // Récupérer la date du sélecteur du dashboard
        const dashboardDateFilter = document.getElementById('dashboard-date-filter');
        const selectedDate = dashboardDateFilter?.value || new Date().toISOString().split('T')[0];
        
        // Rediriger avec la date en paramètre
        window.location.href = `pointage.html?date=${selectedDate}`;
      });
    } else {
      console.warn('⚠️ Bouton "Voir tous les pointages" non trouvé');
    }

    // Filtre par date
    const filterDate = document.getElementById('filter-timesheet-date');
    if (filterDate) {
      filterDate.value = currentDate;
      filterDate.addEventListener('change', (e) => {
        currentDate = e.target.value;
        loadAllTimesheetsForDate();
      });
    }

    // Boutons rapides de date
    const btnToday = document.getElementById('btn-today');
    if (btnToday) {
      btnToday.addEventListener('click', () => {
        currentDate = new Date().toISOString().split('T')[0];
        document.getElementById('filter-timesheet-date').value = currentDate;
        loadAllTimesheetsForDate();
      });
    }

    const btnYesterday = document.getElementById('btn-yesterday');
    if (btnYesterday) {
      btnYesterday.addEventListener('click', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        currentDate = yesterday.toISOString().split('T')[0];
        document.getElementById('filter-timesheet-date').value = currentDate;
        loadAllTimesheetsForDate();
      });
    }

    // Bouton rafraîchir
    const btnRefresh = document.getElementById('btn-refresh-timesheets');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', loadAllTimesheetsForDate);
    }

    // Bouton fermer modal
    const btnClose = document.getElementById('btn-close-all-timesheets');
    if (btnClose) {
      btnClose.addEventListener('click', () => closeModal(modalAllTimesheets));
    }

    // Modal "Pointer pour user" - upload photo
    const pointPhotoDropzone = document.getElementById('point-photo-dropzone');
    const pointPhotoInput = document.getElementById('point-photo-input');
    
    if (pointPhotoDropzone) {
      pointPhotoDropzone.addEventListener('click', () => pointPhotoInput.click());
    }
    
    if (pointPhotoInput) {
      pointPhotoInput.addEventListener('change', (e) => handlePointPhotoSelect(e.target.files[0]));
    }

    // Form submit "Pointer pour user"
    const formPointForUser = document.getElementById('form-point-for-user');
    if (formPointForUser) {
      formPointForUser.addEventListener('submit', (e) => {
        e.preventDefault();
        submitPointForUser();
      });
    }

    // Bouton annuler
    const btnCancelPoint = document.getElementById('btn-cancel-point-for-user');
    if (btnCancelPoint) {
      btnCancelPoint.addEventListener('click', () => {
        closeModal(modalPointForUser);
        resetPointForm();
      });
    }
  }

  /**
   * Ouvrir le modal de tous les pointages
   */
  async function openAllTimesheetsModal() {
    if (!modalAllTimesheets) return;

    showModal(modalAllTimesheets);
    
    // Charger les données
    await loadAllTimesheetsForDate();
  }

  /**
   * Charger tous les pointages pour une date
   */
  async function loadAllTimesheetsForDate() {
    try {
      const response = await fetch(`${window.API_BASE_URL}/timesheets/all?date=${currentDate}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        allTimesheets = data.data;
        stats = data.stats;
        renderAllTimesheetsTable();
        renderStats();
      } else {
        showNotification(data.message || 'Erreur lors du chargement', 'error');
      }
    } catch (error) {
      console.error('Erreur loadAllTimesheetsForDate:', error);
      showNotification('Erreur de connexion', 'error');
    }
  }

  /**
   * Render la table de tous les pointages
   */
  function renderAllTimesheetsTable() {
    const container = document.getElementById('timesheets-table-container');
    if (!container) return;

    if (allTimesheets.length === 0) {
      container.innerHTML = '<div class="no-data">Aucun livreur actif</div>';
      return;
    }

    let html = `
      <table class="timesheets-table">
        <thead>
          <tr>
            <th>Livreur</th>
            <th>Début</th>
            <th>Fin</th>
            <th>Km parcourus</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
    `;

    allTimesheets.forEach(item => {
      const timesheet = item.timesheet;
      const status = item.status;
      
      let startCell = '<span class="status-missing">❌ Pas pointé</span>';
      let endCell = '--';
      let kmCell = '--';
      let statusBadge = '<span class="timesheet-status status-missing">Manquant</span>';
      let actions = `<button class="btn-icon btn-point-start" data-user-id="${item.user_id}" title="Pointer le début">➕</button>`;

      if (timesheet) {
        if (timesheet.start_time) {
          const startTime = new Date(timesheet.start_time).toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          startCell = `<div>✅ ${startTime}</div><div class="small-text">${timesheet.start_km} km</div>`;
        }

        if (timesheet.end_time) {
          const endTime = new Date(timesheet.end_time).toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          endCell = `<div>✅ ${endTime}</div><div class="small-text">${timesheet.end_km} km</div>`;
          kmCell = `<strong>${timesheet.total_km} km</strong>`;
          statusBadge = '<span class="timesheet-status status-complete">Complet</span>';
          actions = `
            <button class="btn-icon btn-view-photos" data-timesheet-id="${timesheet.id}" title="Voir les photos">👁️</button>
          `;
        } else if (timesheet.start_time) {
          endCell = '<span class="status-partial">⏳ En cours</span>';
          statusBadge = '<span class="timesheet-status status-partial">En cours</span>';
          actions = `
            <button class="btn-icon btn-view-photos" data-timesheet-id="${timesheet.id}" title="Voir photo début">👁️</button>
            <button class="btn-icon btn-point-end" data-user-id="${item.user_id}" title="Pointer la fin">➕</button>
          `;
        }
      }

      html += `
        <tr>
          <td><strong>👤 ${item.username}</strong></td>
          <td>${startCell}</td>
          <td>${endCell}</td>
          <td>${kmCell}</td>
          <td>${statusBadge}</td>
          <td class="actions-cell">${actions}</td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    `;

    container.innerHTML = html;
    
    // Attacher les event listeners sur les boutons d'action
    container.querySelectorAll('.btn-point-start').forEach(btn => {
      btn.addEventListener('click', () => {
        const userId = btn.getAttribute('data-user-id');
        openPointForUserModal(userId, 'start');
      });
    });
    
    container.querySelectorAll('.btn-point-end').forEach(btn => {
      btn.addEventListener('click', () => {
        const userId = btn.getAttribute('data-user-id');
        openPointForUserModal(userId, 'end');
      });
    });
    
    container.querySelectorAll('.btn-view-photos').forEach(btn => {
      btn.addEventListener('click', () => {
        const timesheetId = btn.getAttribute('data-timesheet-id');
        viewPhotos(timesheetId);
      });
    });
  }

  /**
   * Render les statistiques
   */
  function renderStats() {
    const statsContainer = document.getElementById('timesheet-stats');
    if (!statsContainer || !stats) return;

    statsContainer.innerHTML = `
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-label">Total livreurs</div>
          <div class="stat-value">${stats.total_livreurs}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Pointages complets</div>
          <div class="stat-value stat-success">${stats.complets} (${Math.round(stats.complets / stats.total_livreurs * 100)}%)</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">En cours</div>
          <div class="stat-value stat-partial">${stats.en_cours} (${Math.round(stats.en_cours / stats.total_livreurs * 100)}%)</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Non pointés</div>
          <div class="stat-value stat-missing">${stats.non_pointes} (${Math.round(stats.non_pointes / stats.total_livreurs * 100)}%)</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Total km parcourus</div>
          <div class="stat-value">${stats.total_km} km</div>
        </div>
      </div>
    `;
  }

  /**
   * Ouvrir le modal pour pointer pour un livreur
   */
  function openPointForUserModal(userId, type) {
    if (!modalPointForUser) return;

    // Trouver le livreur
    const livreur = allTimesheets.find(item => item.user_id === userId);
    if (!livreur) return;

    selectedLivreur = livreur;
    pointType = type;

    // Remplir le modal
    const title = document.getElementById('point-for-user-title');
    const livreurDisplay = document.getElementById('point-livreur-display');
    const dateInput = document.getElementById('point-date');
    const userIdInput = document.getElementById('point-user-id');
    const typeInput = document.getElementById('point-type');
    const livreurName = document.getElementById('livreur-name');

    if (title) {
      title.innerHTML = type === 'start' 
        ? `🟢 Pointer le début pour: <span id="livreur-name">${livreur.username}</span>`
        : `🔴 Pointer la fin pour: <span id="livreur-name">${livreur.username}</span>`;
    }
    
    if (livreurDisplay) livreurDisplay.value = livreur.username;
    if (dateInput) dateInput.value = currentDate;
    if (userIdInput) userIdInput.value = userId;
    if (typeInput) typeInput.value = type;

    showModal(modalPointForUser);
  }

  /**
   * Gérer la sélection de photo pour pointer
   */
  function handlePointPhotoSelect(file) {
    if (!file) return;

    const validation = validatePhoto(file);
    if (!validation.valid) {
      showNotification(validation.error, 'error');
      return;
    }

    photoFile = file;
    renderPhotoPreview('point-photo-preview', file);
  }

  /**
   * Valider une photo
   */
  function validatePhoto(file) {
    const MAX_SIZE = 10 * 1024 * 1024;
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
   * Soumettre le pointage pour un livreur
   */
  async function submitPointForUser() {
    const userId = document.getElementById('point-user-id').value;
    const date = document.getElementById('point-date').value;
    const km = document.getElementById('point-km').value;
    const type = document.getElementById('point-type').value;

    // Validations
    if (!userId || !date || !km || !photoFile) {
      showNotification('Veuillez remplir tous les champs et ajouter une photo', 'error');
      return;
    }

    const kmNumber = parseFloat(km);
    if (isNaN(kmNumber) || kmNumber < 0) {
      showNotification('Kilométrage invalide', 'error');
      return;
    }

    // Préparer FormData
    const formData = new FormData();
    formData.append('user_id', userId);
    formData.append('date', date);
    formData.append('km', km);
    formData.append('photo', photoFile);

    const endpoint = type === 'start' ? 'start-for-user' : 'end-for-user';

    showNotification('Enregistrement en cours...', 'info');

    try {
      const response = await fetch(`${window.API_BASE_URL}/timesheets/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        showNotification(data.message || '✅ Pointage enregistré !', 'success');
        closeModal(modalPointForUser);
        resetPointForm();
        
        // Recharger la table
        await loadAllTimesheetsForDate();
        await loadQuickSummary();
      } else {
        showNotification(data.message || 'Erreur lors de l\'enregistrement', 'error');
      }
    } catch (error) {
      console.error('Erreur submitPointForUser:', error);
      showNotification('Erreur de connexion', 'error');
    }
  }

  /**
   * Voir les photos d'un pointage
   */
  function viewPhotos(timesheetId) {
    // Ouvrir les photos dans de nouveaux onglets
    window.open(`${window.API_BASE_URL}/timesheets/${timesheetId}/photo/start`, '_blank');
    
    // Vérifier s'il y a une photo de fin
    const timesheet = allTimesheets.find(item => item.timesheet && item.timesheet.id === timesheetId);
    if (timesheet && timesheet.timesheet.end_photo_path) {
      window.open(`${window.API_BASE_URL}/timesheets/${timesheetId}/photo/end`, '_blank');
    }
  }

  /**
   * Reset form
   */
  function resetPointForm() {
    document.getElementById('point-km').value = '';
    document.getElementById('point-photo-input').value = '';
    document.getElementById('point-photo-preview').innerHTML = '';
    photoFile = null;
    selectedLivreur = null;
    pointType = null;
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

  /**
   * Recharger le résumé avec la nouvelle date du dashboard
   */
  async function reloadSummary() {
    const oldDate = currentDate;
    currentDate = getSelectedDashboardDate();
    console.log('📊 Rechargement résumé - Ancienne date:', oldDate, '→ Nouvelle date:', currentDate);
    await loadQuickSummary();
    console.log('✅ Résumé rechargé avec succès');
  }

  // API publique
  return {
    init,
    openAllTimesheetsModal,
    openPointForUserModal,
    viewPhotos,
    loadQuickSummary,
    reloadSummary
  };
})();

// Exposer globalement pour débogage
window.TimesheetsManagerView = TimesheetsManagerView;

// L'initialisation sera appelée depuis main.js dans displayTimesheetWidgets()
// Pas besoin de setTimeout ici
