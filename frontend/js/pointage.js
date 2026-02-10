/**
 * PAGE POINTAGES DES LIVREURS
 * Gestion des pointages pour les managers
 */

// Configuration API
const isLocalHost = (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  /^192\.168\./.test(window.location.hostname)
);
const API_BASE_URL = isLocalHost
  ? 'http://localhost:4000/api/v1'
  : 'https://matix-livreur-backend.onrender.com/api/v1';

// Variables globales
let currentDate = getInitialDate(); // YYYY-MM-DD
let allTimesheets = [];
let stats = null;
let currentUser = null;
let selectedLivreur = null;
let pointType = null;
let photoFile = null;

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
 * Obtenir la date initiale depuis l'URL ou aujourd'hui
 */
function getInitialDate() {
  const urlParams = new URLSearchParams(window.location.search);
  const dateParam = urlParams.get('date');
  
  // Valider le format de date (YYYY-MM-DD)
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    console.log('📅 Date récupérée depuis l\'URL:', dateParam);
    return dateParam;
  }
  
  // Sinon, utiliser aujourd'hui en heure locale
  const today = formatLocalYYYYMMDD(new Date());
  console.log('📅 Date par défaut (aujourd\'hui):', today);
  return today;
}

/**
 * Initialisation de la page
 */
async function init() {
  console.log('📊 Initialisation page pointage');
  
  // Masquer le loader
  hideLoader();
  
  // Vérifier l'authentification
  await checkAuth();
  
  // Vérifier les permissions
  if (!currentUser || (currentUser.role !== 'MANAGER' && currentUser.role !== 'ADMIN')) {
    showNotification('Accès non autorisé. Redirection...', 'error');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1500);
    return;
  }
  
  // Afficher les infos utilisateur
  document.getElementById('username').textContent = currentUser.username;
  document.getElementById('user-role').textContent = currentUser.role;
  
  // Initialiser la date
  document.getElementById('filter-timesheet-date').value = currentDate;
  
  // Charger les données
  await loadAllTimesheetsForDate();
  
  // Attacher les événements
  attachEvents();
  
  console.log('✅ Page pointage initialisée');
}

/**
 * Vérifier l'authentification
 */
async function checkAuth() {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = 'index.html';
      return;
    }
    
    const response = await fetch(`${API_BASE_URL}/auth/check`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      localStorage.removeItem('token');
      window.location.href = 'index.html';
      return;
    }
    
    const data = await response.json();
    currentUser = data.user;
  } catch (error) {
    console.error('Erreur authentification:', error);
    window.location.href = 'index.html';
  }
}

/**
 * Charger tous les pointages pour une date
 */
async function loadAllTimesheetsForDate() {
  try {
    showLoader();
    
    const response = await fetch(`${API_BASE_URL}/timesheets/all?date=${currentDate}`, {
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
  } finally {
    hideLoader();
  }
}

/**
 * Render la table de tous les pointages
 */
function renderAllTimesheetsTable() {
  const container = document.getElementById('timesheets-table-container');
  if (!container) return;

  if (allTimesheets.length === 0) {
    container.innerHTML = '<div class="no-data" style="text-align: center; padding: 40px; color: #a0aec0;">Aucun livreur actif</div>';
    return;
  }

  let html = `
    <table class="timesheets-table">
      <thead>
        <tr>
          <th>Livreur</th>
          <th>Scooter</th>
          <th>Début</th>
          <th>Fin</th>
          <th>Km parcourus</th>
          <th>Statut</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  allTimesheets.forEach((livreur) => {
    const timesheets = livreur.timesheets || [];
    const nbPointages = timesheets.length;
    
    if (nbPointages === 0) {
      // Livreur sans pointage
      html += `
        <tr>
          <td><strong>👤 ${escapeHtml(livreur.username)}</strong></td>
          <td colspan="4" style="text-align: center;">
            <span class="status-missing">❌ Pas pointé</span>
          </td>
          <td><span class="timesheet-status status-missing">Manquant</span></td>
          <td class="actions-cell">
            <button class="btn-icon btn-point-start" data-user-id="${livreur.user_id}" title="Pointer le début">➕</button>
          </td>
        </tr>
      `;
    } else {
      // Afficher tous les pointages du livreur
      timesheets.forEach((timesheet, index) => {
        const startTime = timesheet.start_time 
          ? new Date(timesheet.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          : '--';
        
        const endTime = timesheet.end_time 
          ? new Date(timesheet.end_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          : '--';
        
        const scooterBadge = timesheet.scooter_id 
          ? `<span class="scooter-badge-small">🛵 ${timesheet.scooter_id}</span>`
          : '<span class="scooter-badge-small" style="background: #gray;">Sans N°</span>';
        
        let statusBadge = '';
        let actions = '';
        
        if (timesheet.end_time) {
          statusBadge = '<span class="timesheet-status status-complete">✅ Complet</span>';
          actions = `
            <button class="btn-icon btn-view-photos" data-timesheet-id="${timesheet.id}" title="Agrandir les photos">🔍</button>
            <button class="btn-icon btn-edit-timesheet" data-timesheet-id="${timesheet.id}" data-username="${escapeHtml(livreur.username)}" title="Modifier le pointage">✏️</button>
            <button class="btn-icon btn-delete-timesheet" data-timesheet-id="${timesheet.id}" data-username="${escapeHtml(livreur.username)}" title="Supprimer le pointage">🗑️</button>
          `;
        } else {
          statusBadge = '<span class="timesheet-status status-partial">⏳ En cours</span>';
          actions = `
            <button class="btn-icon btn-view-photos" data-timesheet-id="${timesheet.id}" title="Agrandir photo début">🔍</button>
            <button class="btn-icon btn-point-end-for-timesheet" data-timesheet-id="${timesheet.id}" data-user-id="${livreur.user_id}" title="Pointer la fin">➕</button>
            <button class="btn-icon btn-edit-timesheet" data-timesheet-id="${timesheet.id}" data-username="${escapeHtml(livreur.username)}" title="Modifier le pointage">✏️</button>
            <button class="btn-icon btn-delete-timesheet" data-timesheet-id="${timesheet.id}" data-username="${escapeHtml(livreur.username)}" title="Supprimer le pointage">🗑️</button>
          `;
        }
        
        // Première ligne du livreur : afficher le nom avec rowspan
        if (index === 0) {
          html += `
            <tr class="livreur-row">
              <td rowspan="${nbPointages + 1}">
                <strong>👤 ${escapeHtml(livreur.username)}</strong><br/>
                <small style="color: #667eea;">Total: ${livreur.total_km_journee} km (${nbPointages} pointage${nbPointages > 1 ? 's' : ''})</small>
              </td>
              <td>${scooterBadge}</td>
              <td>
                <div>${startTime}</div>
                <div class="small-text">${timesheet.start_km} km</div>
              </td>
              <td>
                ${timesheet.end_time ? `<div>${endTime}</div><div class="small-text">${timesheet.end_km} km</div>` : '<span class="status-partial">⏳ En cours</span>'}
              </td>
              <td>${timesheet.total_km ? `<strong>${timesheet.total_km} km</strong>` : '--'}</td>
              <td>${statusBadge}</td>
              <td class="actions-cell">${actions}</td>
            </tr>
          `;
        } else {
          // Lignes suivantes : sans le nom du livreur
          html += `
            <tr class="pointage-row">
              <td>${scooterBadge}</td>
              <td>
                <div>${startTime}</div>
                <div class="small-text">${timesheet.start_km} km</div>
              </td>
              <td>
                ${timesheet.end_time ? `<div>${endTime}</div><div class="small-text">${timesheet.end_km} km</div>` : '<span class="status-partial">⏳ En cours</span>'}
              </td>
              <td>${timesheet.total_km ? `<strong>${timesheet.total_km} km</strong>` : '--'}</td>
              <td>${statusBadge}</td>
              <td class="actions-cell">${actions}</td>
            </tr>
          `;
        }
      });
      
      // Ligne vide pour bouton "Ajouter pointage"
      html += `
        <tr class="add-pointage-row">
          <td colspan="6" style="text-align: center; padding: 5px;">
            <button class="btn-add-pointage-for-user" data-user-id="${livreur.user_id}" style="font-size: 0.85rem; padding: 4px 12px;">
              ➕ Nouveau pointage pour ${escapeHtml(livreur.username)}
            </button>
          </td>
        </tr>
      `;
    }
  });

  html += `
      </tbody>
    </table>
  `;

  container.innerHTML = html;
  
  // Attacher les event listeners sur les boutons d'action
  container.querySelectorAll('.btn-point-start, .btn-add-pointage-for-user').forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = btn.getAttribute('data-user-id');
      openPointForUserModal(userId, 'start');
    });
  });
  
  container.querySelectorAll('.btn-point-end-for-timesheet').forEach(btn => {
    btn.addEventListener('click', () => {
      const timesheetId = btn.getAttribute('data-timesheet-id');
      const userId = btn.getAttribute('data-user-id');
      openPointEndForTimesheetModal(timesheetId, userId);
    });
  });
  
  container.querySelectorAll('.btn-view-photos').forEach(btn => {
    btn.addEventListener('click', () => {
      const timesheetId = btn.getAttribute('data-timesheet-id');
      viewPhotos(timesheetId);
    });
  });
  
  container.querySelectorAll('.btn-edit-timesheet').forEach(btn => {
    btn.addEventListener('click', () => {
      const timesheetId = btn.getAttribute('data-timesheet-id');
      const username = btn.getAttribute('data-username');
      showEditTimesheetModal(timesheetId, username);
    });
  });
  
  container.querySelectorAll('.btn-delete-timesheet').forEach(btn => {
    btn.addEventListener('click', () => {
      const timesheetId = btn.getAttribute('data-timesheet-id');
      const username = btn.getAttribute('data-username');
      deleteTimesheetConfirm(timesheetId, username);
    });
  });
}

/**
 * Render les statistiques
 */
function renderStats() {
  const statsContainer = document.getElementById('timesheet-stats');
  if (!statsContainer || !stats) return;

  // Calculer les pourcentages en évitant la division par zéro
  const total = stats.total_livreurs || 0;
  const completsPercent = total > 0 ? Math.round(stats.complets / total * 100) : 0;
  const enCoursPercent = total > 0 ? Math.round(stats.en_cours / total * 100) : 0;
  const nonPointesPercent = total > 0 ? Math.round(stats.non_pointes / total * 100) : 0;

  statsContainer.innerHTML = `
    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-label">Total livreurs</div>
        <div class="stat-value">${stats.total_livreurs}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Pointages complets</div>
        <div class="stat-value stat-success">${stats.complets} (${completsPercent}%)</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">En cours</div>
        <div class="stat-value stat-partial">${stats.en_cours} (${enCoursPercent}%)</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Non pointés</div>
        <div class="stat-value stat-missing">${stats.non_pointes} (${nonPointesPercent}%)</div>
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
  const modal = document.getElementById('modal-point-for-user');
  if (!modal) return;

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

  if (title) {
    const emoji = type === 'start' ? '🟢' : '🔴';
    const action = type === 'start' ? 'le début' : 'la fin';
    title.innerHTML = `${emoji} Pointer ${action} pour: <span id="livreur-name">${escapeHtml(livreur.username)}</span>`;
  }
  
  if (livreurDisplay) livreurDisplay.value = livreur.username;
  if (dateInput) dateInput.value = currentDate;
  if (userIdInput) userIdInput.value = userId;
  if (typeInput) typeInput.value = type;

  modal.classList.remove('hidden');
  modal.classList.add('active');
}

/**
 * Ouvrir le modal pour pointer la fin d'un timesheet spécifique
 */
function openPointEndForTimesheetModal(timesheetId, userId) {
  const modal = document.getElementById('modal-point-for-user');
  if (!modal) return;

  // Trouver le livreur et le timesheet
  const livreur = allTimesheets.find(item => item.user_id === userId);
  if (!livreur) return;
  
  const timesheet = livreur.timesheets.find(t => t.id === parseInt(timesheetId));
  if (!timesheet) return;

  selectedLivreur = livreur;
  pointType = 'end';

  // Remplir le modal
  const title = document.getElementById('point-for-user-title');
  const livreurDisplay = document.getElementById('point-livreur-display');
  const dateInput = document.getElementById('point-date');
  const userIdInput = document.getElementById('point-user-id');
  const typeInput = document.getElementById('point-type');

  if (title) {
    const scooterInfo = timesheet.scooter_id ? ` (Scooter ${timesheet.scooter_id})` : '';
    title.innerHTML = `🔴 Pointer la fin pour: <span id="livreur-name">${escapeHtml(livreur.username)}${scooterInfo}</span>`;
  }
  
  if (livreurDisplay) livreurDisplay.value = livreur.username;
  if (dateInput) dateInput.value = currentDate;
  if (userIdInput) userIdInput.value = userId;
  if (typeInput) typeInput.value = 'end';

  modal.classList.remove('hidden');
  modal.classList.add('active');
}

/**
 * Voir les photos d'un pointage
 */
async function viewPhotos(timesheetId) {
  try {
    showLoader();
    
    // Télécharger la photo de début avec le token
    const startResponse = await fetch(`${API_BASE_URL}/timesheets/${timesheetId}/photo/start`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (!startResponse.ok) {
      showNotification('Erreur lors du téléchargement de la photo', 'error');
      hideLoader();
      return;
    }
    
    // Convertir en data URL (base64)
    const startBlob = await startResponse.blob();
    const startDataUrl = await blobToDataURL(startBlob);
    
    let photosHtml = `
      <div style="margin-bottom: 20px;">
        <h3 style="color: #48bb78;">🟢 Photo de début</h3>
        <img src="${startDataUrl}" style="max-width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
      </div>
    `;
    
    // Trouver le timesheet dans tous les livreurs
    let foundTimesheet = null;
    for (const livreur of allTimesheets) {
      if (livreur.timesheets) {
        foundTimesheet = livreur.timesheets.find(t => t.id === parseInt(timesheetId));
        if (foundTimesheet) break;
      }
    }
    
    // Vérifier s'il y a une photo de fin
    if (foundTimesheet && foundTimesheet.end_photo_path) {
      const endResponse = await fetch(`${API_BASE_URL}/timesheets/${timesheetId}/photo/end`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (endResponse.ok) {
        const endBlob = await endResponse.blob();
        const endDataUrl = await blobToDataURL(endBlob);
        
        photosHtml += `
          <div>
            <h3 style="color: #f56565;">🔴 Photo de fin</h3>
            <img src="${endDataUrl}" style="max-width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
          </div>
        `;
      }
    }
    
    // Créer un modal pour afficher les photos
    const modalHtml = `
      <div class="modal active" id="modal-view-photos" style="display: flex !important; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); z-index: 10000; align-items: center; justify-content: center; padding: 20px;">
        <div style="background: white; border-radius: 12px; padding: 30px; max-width: 800px; max-height: 90vh; overflow-y: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px;">
            <h2 style="margin: 0;">📸 Photos du pointage</h2>
            <button id="btn-close-photos" style="background: none; border: none; font-size: 28px; cursor: pointer; color: #a0aec0;">&times;</button>
          </div>
          
          ${photosHtml}
          
          <div style="text-align: center; margin-top: 20px;">
            <button id="btn-close-photos-bottom" class="btn btn-secondary">Fermer</button>
          </div>
        </div>
      </div>
    `;
    
    // Ajouter le modal au body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Attacher les événements de fermeture
    document.getElementById('btn-close-photos').addEventListener('click', () => {
      document.getElementById('modal-view-photos').remove();
    });
    
    document.getElementById('btn-close-photos-bottom').addEventListener('click', () => {
      document.getElementById('modal-view-photos').remove();
    });
    
    // Fermer en cliquant sur le backdrop
    document.getElementById('modal-view-photos').addEventListener('click', (e) => {
      if (e.target.id === 'modal-view-photos') {
        document.getElementById('modal-view-photos').remove();
      }
    });
    
  } catch (error) {
    console.error('Erreur viewPhotos:', error);
    showNotification('Erreur lors de l\'affichage des photos', 'error');
  } finally {
    hideLoader();
  }
}

/**
 * Convertir un Blob en Data URL (base64)
 */
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Soumettre le pointage pour un livreur
 */
async function submitPointForUser(e) {
  e.preventDefault();
  
  const userId = document.getElementById('point-user-id').value;
  const date = document.getElementById('point-date').value;
  const km = document.getElementById('point-km').value;
  const type = document.getElementById('point-type').value;

  if (!userId || !date || !km || !photoFile) {
    showNotification('Veuillez remplir tous les champs et ajouter une photo', 'error');
    return;
  }

  const kmNumber = parseFloat(km);
  if (isNaN(kmNumber) || kmNumber < 0) {
    showNotification('Kilométrage invalide', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('user_id', userId);
  formData.append('date', date);
  formData.append('km', km);
  formData.append('photo', photoFile);

  const endpoint = type === 'start' ? 'start-for-user' : 'end-for-user';

  showLoader();

  try {
    const response = await fetch(`${API_BASE_URL}/timesheets/${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData
    });

    const data = await response.json();

    if (response.ok) {
      showNotification(data.message || '✅ Pointage enregistré !', 'success');
      closeModal();
      resetPointForm();
      await loadAllTimesheetsForDate();
    } else {
      showNotification(data.message || 'Erreur lors de l\'enregistrement', 'error');
    }
  } catch (error) {
    console.error('Erreur submitPointForUser:', error);
    showNotification('Erreur de connexion', 'error');
  } finally {
    hideLoader();
  }
}

/**
 * Attacher les événements
 */
function attachEvents() {
  // Bouton retour
  document.getElementById('btn-retour-dashboard').addEventListener('click', () => {
    window.location.href = 'index.html';
  });
  
  // Filtre date
  document.getElementById('filter-timesheet-date').addEventListener('change', (e) => {
    currentDate = e.target.value;
    loadAllTimesheetsForDate();
  });
  
  // Bouton aujourd'hui
  document.getElementById('btn-today').addEventListener('click', () => {
    currentDate = formatLocalYYYYMMDD(new Date());
    document.getElementById('filter-timesheet-date').value = currentDate;
    loadAllTimesheetsForDate();
  });
  
  // Bouton hier
  document.getElementById('btn-yesterday').addEventListener('click', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    currentDate = formatLocalYYYYMMDD(yesterday);
    document.getElementById('filter-timesheet-date').value = currentDate;
    loadAllTimesheetsForDate();
  });
  
  // Bouton rafraîchir
  document.getElementById('btn-refresh-timesheets').addEventListener('click', loadAllTimesheetsForDate);
  
  // Modal photo
  const pointPhotoDropzone = document.getElementById('point-photo-dropzone');
  const pointPhotoInput = document.getElementById('point-photo-input');
  
  if (pointPhotoDropzone) {
    pointPhotoDropzone.addEventListener('click', () => pointPhotoInput.click());
  }
  
  if (pointPhotoInput) {
    pointPhotoInput.addEventListener('change', (e) => handlePointPhotoSelect(e.target.files[0]));
  }
  
  // Form submit
  const formPointForUser = document.getElementById('form-point-for-user');
  if (formPointForUser) {
    formPointForUser.addEventListener('submit', submitPointForUser);
  }
  
  // Boutons annuler (maintenant des classes au lieu d'IDs dupliqués)
  document.querySelectorAll('.js-cancel-point-for-user').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal();
      resetPointForm();
    });
  });
  
  // Close modal on click
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal();
      resetPointForm();
    });
  });
}

/**
 * Gérer la sélection de photo
 */
function handlePointPhotoSelect(file) {
  if (!file) return;

  const MAX_SIZE = 10 * 1024 * 1024;
  const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

  if (file.size > MAX_SIZE) {
    showNotification('Photo trop volumineuse (max 10 Mo)', 'error');
    return;
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    showNotification('Format non accepté (JPEG ou PNG uniquement)', 'error');
    return;
  }

  photoFile = file;
  
  const container = document.getElementById('point-photo-preview');
  if (!container) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    container.innerHTML = `
      <div class="photo-preview">
        <img src="${e.target.result}" alt="Preview" style="max-width: 100%; max-height: 200px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
        <div class="photo-name" style="margin-top: 8px; font-size: 0.9rem; color: #718096;">${file.name}</div>
      </div>
    `;
  };
  reader.readAsDataURL(file);
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
 * Fermer le modal
 */
function closeModal() {
  const modal = document.getElementById('modal-point-for-user');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('active');
  }
}

/**
 * Afficher/cacher le loader
 */
function showLoader() {
  const loader = document.getElementById('loader');
  if (loader) loader.style.display = 'flex';
}

function hideLoader() {
  const loader = document.getElementById('loader');
  if (loader) loader.style.display = 'none';
}

/**
 * Afficher le modal de modification de pointage
 */
function showEditTimesheetModal(timesheetId, username) {
  // Trouver le timesheet dans tous les livreurs
  let timesheet = null;
  for (const livreur of allTimesheets) {
    if (livreur.timesheets) {
      timesheet = livreur.timesheets.find(t => t.id == timesheetId);
      if (timesheet) break;
    }
  }
  
  if (!timesheet) {
    showNotification('Pointage introuvable', 'error');
    return;
  }
  
  const hasEnd = !!timesheet.end_time;
  
  const modalHTML = `
    <div id="modal-edit-timesheet" class="modal active" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(4px); padding: 1rem;">
      <div class="modal-overlay" id="edit-timesheet-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7);"></div>
      <div class="modal-content" style="position: relative; z-index: 10001; max-width: 450px; width: 95%; background: white; border-radius: 1rem; box-shadow: 0 25px 75px rgba(0, 0, 0, 0.5); padding: 0; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 1rem 1rem 0 0;">
          <h3 style="margin: 0; color: white; font-size: 1.25rem; font-weight: 700;">✏️ Modifier - ${escapeHtml(username)}</h3>
          <button id="close-edit-timesheet" class="modal-close" style="background: rgba(255, 255, 255, 0.2); border: 2px solid rgba(255, 255, 255, 0.3); font-size: 1.5rem; cursor: pointer; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">&times;</button>
        </div>
        <div class="modal-body" style="padding: 1.5rem;">
          ${hasEnd ? `
            <button id="btn-edit-start" class="btn-choice-modify" style="width: 100%; margin-bottom: 1rem; padding: 1rem; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1.05rem; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 0.75rem;">
              <span style="font-size: 1.5rem;">🟢</span>
              <span>Modifier le début (${timesheet.start_km} km)</span>
            </button>
            <button id="btn-edit-end" class="btn-choice-modify" style="width: 100%; padding: 1rem; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1.05rem; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 0.75rem;">
              <span style="font-size: 1.5rem;">🔴</span>
              <span>Modifier la fin (${timesheet.end_km} km)</span>
            </button>
          ` : `
            <button id="btn-edit-start" class="btn-choice-modify" style="width: 100%; padding: 1rem; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1.05rem; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 0.75rem;">
              <span style="font-size: 1.5rem;">🟢</span>
              <span>Modifier le début (${timesheet.start_km} km)</span>
            </button>
          `}
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
  
  document.getElementById('close-edit-timesheet').addEventListener('click', closeModal);
  document.getElementById('edit-timesheet-overlay').addEventListener('click', closeModal);
  
  document.getElementById('btn-edit-start').addEventListener('click', () => {
    closeModal();
    showModifyModal(timesheet.id, 'start', timesheet.start_km, username);
  });
  
  if (hasEnd) {
    document.getElementById('btn-edit-end').addEventListener('click', () => {
      closeModal();
      showModifyModal(timesheet.id, 'end', timesheet.end_km, username);
    });
  }
}

/**
 * Afficher le modal de modification (début ou fin)
 */
function showModifyModal(timesheetId, type, currentKm, username) {
  const isStart = type === 'start';
  const emoji = isStart ? '🟢' : '🔴';
  const label = isStart ? 'début' : 'fin';
  const color = isStart ? '#10b981' : '#ef4444';
  const colorDark = isStart ? '#059669' : '#dc2626';
  
  const modalHTML = `
    <div id="modal-modify-timesheet" class="modal active" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(4px); padding: 1rem;">
      <div class="modal-overlay" id="modify-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7);"></div>
      <div class="modal-content" style="position: relative; z-index: 10001; max-width: 500px; width: 95%; background: white; border-radius: 1rem; box-shadow: 0 25px 75px rgba(0, 0, 0, 0.5); padding: 0; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; background: linear-gradient(135deg, ${color} 0%, ${colorDark} 100%); border-radius: 1rem 1rem 0 0;">
          <h3 style="margin: 0; color: white; font-size: 1.25rem; font-weight: 700;">${emoji} Modifier ${label} - ${escapeHtml(username)}</h3>
          <button id="close-modify" class="modal-close" style="background: rgba(255, 255, 255, 0.2); border: 2px solid rgba(255, 255, 255, 0.3); font-size: 1.5rem; cursor: pointer; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">&times;</button>
        </div>
        <form id="form-modify-timesheet" style="padding: 1.5rem;">
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; margin-bottom: 0.5rem; color: #4a5568; font-weight: 600;">Kilométrage actuel</label>
            <div style="padding: 0.75rem; background: #f7fafc; border-radius: 0.5rem; color: #718096; font-size: 1rem;">
              ${currentKm} km
            </div>
          </div>
          
          <div style="margin-bottom: 1.5rem;">
            <label for="modify-km" style="display: block; margin-bottom: 0.5rem; color: #4a5568; font-weight: 600;">Nouveau kilométrage *</label>
            <input 
              type="number" 
              id="modify-km" 
              name="km" 
              value="${currentKm}"
              step="0.1" 
              min="0" 
              required 
              style="width: 100%; padding: 0.75rem; border: 2px solid #e2e8f0; border-radius: 0.5rem; font-size: 1rem; transition: border-color 0.2s;"
            />
          </div>
          
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; margin-bottom: 0.5rem; color: #4a5568; font-weight: 600;">
              Nouvelle photo (optionnel)
            </label>
            <div 
              id="modify-photo-dropzone" 
              style="border: 2px dashed #cbd5e0; border-radius: 0.5rem; padding: 2rem; text-align: center; cursor: pointer; background: #f7fafc; transition: all 0.2s;"
            >
              <div style="font-size: 2rem; margin-bottom: 0.5rem;">📸</div>
              <p style="margin: 0; color: #718096;">Cliquez pour ajouter une photo (optionnel)</p>
            </div>
            <input type="file" id="modify-photo-input" accept="image/jpeg,image/png" style="display: none;" />
            <div id="modify-photo-preview" style="margin-top: 1rem;"></div>
          </div>
          
          <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
            <button 
              type="button" 
              id="btn-cancel-modify" 
              class="btn-secondary" 
              style="padding: 0.75rem 1.5rem; background: #e2e8f0; color: #4a5568; border: none; border-radius: 0.5rem; cursor: pointer; font-size: 1rem; font-weight: 600; transition: all 0.2s;"
            >
              Annuler
            </button>
            <button 
              type="submit" 
              class="btn-primary" 
              style="padding: 0.75rem 1.5rem; background: linear-gradient(135deg, ${color}, ${colorDark}); color: white; border: none; border-radius: 0.5rem; cursor: pointer; font-size: 1rem; font-weight: 600; transition: all 0.2s;"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHTML;
  document.body.appendChild(modalContainer);
  
  let selectedFile = null;
  
  const closeModal = () => {
    modalContainer.remove();
  };
  
  // Event listeners
  document.getElementById('close-modify').addEventListener('click', closeModal);
  document.getElementById('modify-overlay').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-modify').addEventListener('click', closeModal);
  
  // Photo upload
  const dropzone = document.getElementById('modify-photo-dropzone');
  const fileInput = document.getElementById('modify-photo-input');
  const preview = document.getElementById('modify-photo-preview');
  const kmInput = document.getElementById('modify-km');
  
  // Event listeners pour l'input kilométrage (remplace onfocus/onblur inline)
  kmInput.addEventListener('focus', () => {
    kmInput.style.borderColor = color;
  });
  
  kmInput.addEventListener('blur', () => {
    kmInput.style.borderColor = '#e2e8f0';
  });
  
  // Event listeners pour la dropzone (remplace onmouseover/onmouseout inline)
  dropzone.addEventListener('mouseover', () => {
    dropzone.style.borderColor = color;
    dropzone.style.background = '#f0fdf4';
  });
  
  dropzone.addEventListener('mouseout', () => {
    dropzone.style.borderColor = '#cbd5e0';
    dropzone.style.background = '#f7fafc';
  });
  
  dropzone.addEventListener('click', () => fileInput.click());
  
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const MAX_SIZE = 10 * 1024 * 1024;
    const ALLOWED_TYPES = ['image/jpeg', 'image/png'];
    
    if (file.size > MAX_SIZE) {
      showNotification('Photo trop volumineuse (max 10 Mo)', 'error');
      return;
    }
    
    if (!ALLOWED_TYPES.includes(file.type)) {
      showNotification('Format non accepté (JPEG ou PNG uniquement)', 'error');
      return;
    }
    
    selectedFile = file;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.innerHTML = `
        <div class="photo-preview">
          <img src="${e.target.result}" alt="Preview" style="max-width: 100%; max-height: 200px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
          <div class="photo-name" style="margin-top: 8px; font-size: 0.9rem; color: #718096;">${file.name}</div>
        </div>
      `;
    };
    reader.readAsDataURL(file);
  });
  
  // Form submit
  document.getElementById('form-modify-timesheet').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const km = document.getElementById('modify-km').value;
    
    if (!km) {
      showNotification('Veuillez entrer le kilométrage', 'error');
      return;
    }
    
    const kmNumber = parseFloat(km);
    if (isNaN(kmNumber) || kmNumber < 0) {
      showNotification('Kilométrage invalide', 'error');
      return;
    }
    
    closeModal();
    
    try {
      showLoader();
      showNotification('Modification en cours...', 'info');
      
      const formData = new FormData();
      formData.append('km', km);
      if (selectedFile) {
        formData.append('photo', selectedFile);
      }
      
      const endpoint = isStart ? 'start' : 'end';
      const response = await fetch(`${API_BASE_URL}/timesheets/${timesheetId}/${endpoint}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
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
        showNotification(data.message || '✅ Pointage modifié avec succès', 'success');
        await loadAllTimesheetsForDate();
      } else {
        showNotification(data.message || 'Erreur lors de la modification', 'error');
      }
    } catch (error) {
      console.error('Erreur modification:', error);
      showNotification('Erreur de connexion', 'error');
    } finally {
      hideLoader();
    }
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
 * Afficher un modal de confirmation personnalisé
 */
function showConfirmModal(title, message, onConfirm) {
  const modalHTML = `
    <div id="modal-confirm-delete" class="modal active" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(4px); padding: 1rem;">
      <div class="modal-overlay" id="confirm-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7);"></div>
      <div class="modal-content" style="position: relative; z-index: 10001; max-width: 450px; width: 95%; background: white; border-radius: 1rem; box-shadow: 0 25px 75px rgba(0, 0, 0, 0.5); padding: 0; animation: modalSlideIn 0.3s ease-out;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 1rem 1rem 0 0;">
          <h3 style="margin: 0; color: white; font-size: 1.25rem; font-weight: 700;">${escapeHtml(title)}</h3>
          <button id="close-confirm" class="modal-close" style="background: rgba(255, 255, 255, 0.2); border: 2px solid rgba(255, 255, 255, 0.3); font-size: 1.5rem; cursor: pointer; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">&times;</button>
        </div>
        <div class="modal-body" style="padding: 2rem 1.5rem;">
          <p style="color: #4a5568; font-size: 1rem; line-height: 1.6; margin: 0; white-space: pre-line;">${escapeHtml(message)}</p>
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
 * Confirmer et supprimer un pointage
 */
async function deleteTimesheetConfirm(timesheetId, username) {
  showConfirmModal(
    '⚠️ Supprimer le pointage',
    `Êtes-vous sûr de vouloir supprimer le pointage de ${username} ?\n\nCette action est irréversible et supprimera également les photos associées.`,
    async () => {
      await performDeleteTimesheet(timesheetId, username);
    }
  );
}

/**
 * Effectuer la suppression du pointage
 */
async function performDeleteTimesheet(timesheetId, username) {
  try {
    showNotification('Suppression en cours...', 'info');
    
    const response = await fetch(`${API_BASE_URL}/timesheets/${timesheetId}`, {
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
      showNotification(`✅ Pointage de ${username} supprimé avec succès`, 'success');
      await loadAllTimesheetsForDate();
    } else {
      showNotification(data.message || 'Erreur lors de la suppression', 'error');
    }
  } catch (error) {
    console.error('Erreur performDeleteTimesheet:', error);
    showNotification('Erreur de connexion', 'error');
  }
}

/**
 * Toast Manager - Système de notifications jolies
 */
const ToastManager = {
  show(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toast-container');
    if (!container) {
      console.error('Toast container non trouvé');
      return;
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Ajouter une icône selon le type
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';
    
    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 20px;">${icon}</span>
        <span>${escapeHtml(message)}</span>
      </div>
    `;

    container.appendChild(toast);

    // Auto-remove après duration
    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.add('fade-out');
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }
    }, duration);

    // Fermer au clic
    toast.addEventListener('click', () => {
      if (toast.parentNode) {
        toast.classList.add('fade-out');
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }
    });
  },

  success(message) {
    this.show(message, 'success');
  },

  error(message) {
    this.show(message, 'error');
  },

  warning(message) {
    this.show(message, 'warning');
  },

  info(message) {
    this.show(message, 'info');
  }
};

/**
 * Échapper le HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Afficher une notification
 */
function showNotification(message, type = 'info') {
  ToastManager.show(message, type);
}

// Initialiser au chargement
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
