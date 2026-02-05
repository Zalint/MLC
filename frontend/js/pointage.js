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
  
  // Sinon, utiliser aujourd'hui
  const today = new Date().toISOString().split('T')[0];
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

  // Trier par KM parcourus (décroissant)
  const sortedTimesheets = [...allTimesheets].sort((a, b) => {
    const kmA = a.timesheet?.total_km || 0;
    const kmB = b.timesheet?.total_km || 0;
    return kmB - kmA; // Décroissant (plus grand en premier)
  });

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

  sortedTimesheets.forEach(item => {
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
          <button class="btn-icon btn-view-photos" data-timesheet-id="${timesheet.id}" title="Agrandir les photos">🔍</button>
        `;
      } else if (timesheet.start_time) {
        endCell = '<span class="status-partial">⏳ En cours</span>';
        statusBadge = '<span class="timesheet-status status-partial">En cours</span>';
        actions = `
          <button class="btn-icon btn-view-photos" data-timesheet-id="${timesheet.id}" title="Agrandir photo début">🔍</button>
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
    title.innerHTML = `${emoji} Pointer ${action} pour: <span id="livreur-name">${livreur.username}</span>`;
  }
  
  if (livreurDisplay) livreurDisplay.value = livreur.username;
  if (dateInput) dateInput.value = currentDate;
  if (userIdInput) userIdInput.value = userId;
  if (typeInput) typeInput.value = type;

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
    
    // Vérifier s'il y a une photo de fin
    const timesheet = allTimesheets.find(item => item.timesheet && item.timesheet.id === timesheetId);
    if (timesheet && timesheet.timesheet.end_photo_path) {
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
    currentDate = new Date().toISOString().split('T')[0];
    document.getElementById('filter-timesheet-date').value = currentDate;
    loadAllTimesheetsForDate();
  });
  
  // Bouton hier
  document.getElementById('btn-yesterday').addEventListener('click', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    currentDate = yesterday.toISOString().split('T')[0];
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
  
  // Boutons annuler
  document.querySelectorAll('#btn-cancel-point-for-user').forEach(btn => {
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
