class GpsLivreurManager {
  constructor() {
    this.isTracking = false;
    this.watchId = null;
    this.trackingInterval = null;
    this.settings = {
      updateInterval: 30000, // 30 secondes par défaut
      enableTracking: false,
      highAccuracy: true,
      timeout: 5000,        // AMÉLIORÉ: Plus court pour responsivité
      maximumAge: 15000     // AMÉLIORÉ: Plus frais pour précision
    };
    this.lastPosition = null;
    this.permissionStatus = 'unknown'; // 'granted', 'denied', 'prompt', 'unknown'
    // NOUVEAU: Variables pour précision adaptative
    this.consecutiveAccuratePositions = 0;
    this.lastMovementTime = Date.now();
    this.isStationary = false;
    this.init();
  }

  async init() {
    console.log('📍 Initialisation GPS Livreur...');
    
    // Charger les paramètres
    await this.loadSettings();
    
    // Vérifier la compatibilité du navigateur
    if (!this.isGeolocationSupported()) {
      this.showError('Votre navigateur ne supporte pas la géolocalisation');
      return;
    }

    // Initialiser l'interface
    this.initUI();
    
    // NOUVEAU: Gestion du cycle de vie de l'app
    this.setupAppLifecycleHandlers();
    
    // Vérifier les permissions
    await this.checkPermissions();
    
    // Auto-démarrer si configuré
    if (this.settings.enableTracking && this.permissionStatus === 'granted') {
      this.startTracking();
    }
  }

  isGeolocationSupported() {
    return 'geolocation' in navigator;
  }

  async loadSettings() {
    try {
      const response = await ApiClient.request('/gps/settings');
      // Mettre à jour les paramètres avec la réponse du serveur
      if (response.data) {
        this.settings.enableTracking = response.data.tracking_enabled;
        this.settings.updateInterval = response.data.tracking_interval;
        console.log('📍 Paramètres GPS chargés:', this.settings);
      }
    } catch (error) {
      console.log('⚠️ Impossible de charger les paramètres GPS, utilisation des valeurs par défaut');
    }
  }

  initUI() {
    // Créer l'interface GPS pour les livreurs
    const gpsContainer = document.getElementById('gps-livreur-interface');
    if (!gpsContainer) {
      console.log('🔍 Container GPS livreur non trouvé - vérification DOM...');
      console.log('📋 Profil page existe:', !!document.getElementById('profile-page'));
      console.log('📋 GPS section existe:', !!document.getElementById('gps-livreur-section'));
      return;
    }
    
    console.log('✅ Container GPS livreur trouvé - initialisation UI...');

    gpsContainer.innerHTML = `
      <div class="gps-livreur-panel">
        <div class="gps-header">
          <h4>📍 Ma Position GPS</h4>
          <div class="gps-status-indicator">
            <span class="status-dot" id="gps-status-dot"></span>
            <span class="status-text" id="gps-status-text">Initialisation...</span>
          </div>
        </div>

        <div class="gps-controls">
          <div class="gps-toggle-container">
            <label class="gps-toggle-label">
              <input type="checkbox" id="gps-toggle" ${this.settings.enableTracking ? 'checked' : ''}>
              <span class="gps-toggle-slider"></span>
              <span class="gps-toggle-text">Partage de position permanent</span>
            </label>
            <small style="color: #666; font-size: 12px; margin-top: 5px; display: block;">
              ✨ Une fois activé, redémarre automatiquement à chaque ouverture de l'app
            </small>
          </div>
          
          <div class="gps-permission-panel" id="gps-permission-panel" style="display: none;">
            <p>🔒 Permission de géolocalisation requise</p>
            <button id="request-permission-btn" class="btn btn-primary btn-sm">
              📍 Autoriser la géolocalisation
            </button>
          </div>
        </div>

        <div class="gps-info-panel">
          <div class="gps-info-row">
            <span class="info-label">📍 Position:</span>
            <span class="info-value" id="current-position">Non disponible</span>
          </div>
          <div class="gps-info-row">
            <span class="info-label">⏰ Dernière mise à jour:</span>
            <span class="info-value" id="last-update">Jamais</span>
          </div>
          <div class="gps-info-row">
            <span class="info-label">🎯 Précision:</span>
            <span class="info-value" id="gps-accuracy">-</span>
          </div>
        </div>

        <div class="gps-alerts" id="gps-alerts" style="display: none;"></div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    // Toggle GPS
    const gpsToggle = document.getElementById('gps-toggle');
    if (gpsToggle) {
      gpsToggle.addEventListener('change', async (e) => {
        if (e.target.checked) {
          await this.requestAndStartTracking();
        } else {
          await this.stopTracking();
        }
      });
    }

    // Bouton de permission
    const permissionBtn = document.getElementById('request-permission-btn');
    if (permissionBtn) {
      permissionBtn.addEventListener('click', () => {
        this.requestPermission();
      });
    }
  }

  async checkPermissions() {
    try {
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        this.permissionStatus = permission.state;
        
        permission.addEventListener('change', () => {
          this.permissionStatus = permission.state;
          this.updateUI();
          // Auto-restart si tracking activé et permission accordée
          if (this.settings.enableTracking && this.permissionStatus === 'granted' && !this.isTracking) {
            this.startTracking();
          }
        });
      } else {
        // Fallback: tester directement avec getCurrentPosition
        console.log('⚠️ Permissions API non disponible, test direct GPS...');
        await this.testDirectGpsAccess();
      }
      
      this.updateUI();
      
      // AMÉLIORATION: Auto-restart agressif si tracking activé
      if (this.settings.enableTracking) {
        await this.attemptAutoRestart();
      }
      
    } catch (error) {
      console.log('⚠️ Impossible de vérifier les permissions géolocalisation');
      
      // AMÉLIORATION: Fallback en cas d'erreur
      if (this.settings.enableTracking) {
        await this.attemptAutoRestart();
      }
    }
  }

  // NOUVEAU: Test direct d'accès GPS
  async testDirectGpsAccess() {
    try {
      console.log('🔍 Test direct d\'accès GPS...');
      await this.getCurrentPosition();
      this.permissionStatus = 'granted';
      console.log('✅ GPS accessible directement');
    } catch (error) {
      if (error.code === 1) { // PERMISSION_DENIED
        this.permissionStatus = 'denied';
      } else {
        this.permissionStatus = 'prompt';
      }
      console.log('❌ GPS non accessible:', error.message);
    }
  }

  // NOUVEAU: Tentative auto-restart agressif
  async attemptAutoRestart() {
    console.log('🔄 Tentative auto-restart GPS...');
    
    // Essayer plusieurs approches
    const attempts = [
      () => this.tryDirectStart(),
      () => this.tryWithPermissionRequest(),
      () => this.tryFallbackStart()
    ];

    for (let i = 0; i < attempts.length; i++) {
      try {
        await attempts[i]();
        if (this.isTracking) {
          console.log(`✅ Auto-restart réussi (tentative ${i + 1})`);
          return;
        }
      } catch (error) {
        console.log(`❌ Tentative ${i + 1} échouée:`, error.message);
      }
    }

    console.log('⚠️ Auto-restart impossible, intervention manuelle requise');
  }

  // NOUVEAU: Démarrage direct
  async tryDirectStart() {
    if (this.permissionStatus === 'granted' || this.permissionStatus === 'unknown') {
      this.startTracking();
    }
  }

  // NOUVEAU: Avec demande de permission
  async tryWithPermissionRequest() {
    if (this.permissionStatus !== 'denied') {
      await this.requestPermission();
      this.startTracking();
    }
  }

  // NOUVEAU: Démarrage de secours
  async tryFallbackStart() {
    console.log('🆘 Tentative de démarrage de secours...');
    // Force le démarrage même avec status incertain
    this.permissionStatus = 'granted';
    this.startTracking();
  }

  updateUI() {
    const statusDot = document.getElementById('gps-status-dot');
    const statusText = document.getElementById('gps-status-text');
    const permissionPanel = document.getElementById('gps-permission-panel');
    const gpsToggle = document.getElementById('gps-toggle');

    if (!statusDot || !statusText) return;

    // Mise à jour du statut
    if (this.isTracking) {
      statusDot.className = 'status-dot online';
      statusText.textContent = 'Actif - Position partagée';
    } else if (this.permissionStatus === 'denied') {
      statusDot.className = 'status-dot error';
      statusText.textContent = 'Permission refusée';
    } else if (this.permissionStatus === 'granted') {
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'Prêt - Position non partagée';
    } else {
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'Permission requise';
    }

    // Panneau de permission
    if (permissionPanel) {
      if (this.permissionStatus === 'prompt' || this.permissionStatus === 'unknown') {
        permissionPanel.style.display = 'block';
      } else {
        permissionPanel.style.display = 'none';
      }
    }

    // Toggle activé/désactivé
    if (gpsToggle) {
      gpsToggle.disabled = this.permissionStatus === 'denied';
    }
  }

  async requestPermission() {
    try {
      this.showInfo('📍 Demande d\'autorisation en cours...');
      
      const position = await this.getCurrentPosition();
      this.permissionStatus = 'granted';
      this.showSuccess('✅ Permission accordée !');
      this.updateUI();
      
      return position;
    } catch (error) {
      this.permissionStatus = 'denied';
      this.handleGeolocationError(error);
      this.updateUI();
      throw error;
    }
  }

  async requestAndStartTracking() {
    try {
      if (this.permissionStatus !== 'granted') {
        await this.requestPermission();
      }
      
      // Activer le tracking sur le backend
      await this.enableBackendTracking(true);
      
      this.startTracking();
    } catch (error) {
      console.error('❌ Erreur lors du démarrage du tracking:', error);
      // Désactiver le toggle si erreur
      const gpsToggle = document.getElementById('gps-toggle');
      if (gpsToggle) gpsToggle.checked = false;
    }
  }

  startTracking() {
    if (this.isTracking) {
      console.log('📍 Tracking déjà actif');
      return;
    }

    if (this.permissionStatus !== 'granted') {
      this.showError('Permission de géolocalisation requise');
      return;
    }

    console.log('🟢 Démarrage du tracking GPS...');
    this.isTracking = true;

    // AMÉLIORÉ: Options de géolocalisation optimisées
    const options = {
      enableHighAccuracy: true,
      timeout: this.settings.timeout,
      maximumAge: this.settings.maximumAge,
      // Options modernes si disponibles
      desiredAccuracy: 10,        // Objectif 10m
      priority: 'high'            // Priorité maximale
    };

    console.log('📍 Options GPS utilisées:', options);

    // Tracking continu avec gestion d'erreur améliorée
    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handlePositionUpdate(position),
      (error) => this.handleGeolocationError(error),
      options
    );

    // AMÉLIORÉ: Envoi adaptatif basé sur le mouvement
    this.startAdaptiveTracking();

    this.updateUI();
    this.showSuccess('📍 Partage de position activé');
  }

  // NOUVEAU: Tracking adaptatif basé sur le mouvement
  startAdaptiveTracking() {
    console.log('🔄 Démarrage du tracking adaptatif...');
    
    this.trackingInterval = setInterval(() => {
      this.sendCurrentPosition();
      this.adjustTrackingFrequency();
    }, this.getCurrentInterval());
  }

  // NOUVEAU: Obtenir l'intervalle actuel basé sur l'activité
  getCurrentInterval() {
    if (this.isStationary) {
      return Math.max(this.settings.updateInterval * 2, 60000); // Maximum 1 minute si stationnaire
    } else {
      return Math.min(this.settings.updateInterval, 15000); // Minimum 15 secondes si en mouvement
    }
  }

  // NOUVEAU: Ajuster la fréquence selon l'activité
  adjustTrackingFrequency() {
    if (!this.trackingInterval) return;

    const newInterval = this.getCurrentInterval();
    const currentInterval = this.trackingInterval._repeat || this.settings.updateInterval;

    if (Math.abs(newInterval - currentInterval) > 5000) { // Changement significatif
      console.log(`🔄 Ajustement intervalle: ${currentInterval}ms → ${newInterval}ms`);
      
      clearInterval(this.trackingInterval);
      this.trackingInterval = setInterval(() => {
        this.sendCurrentPosition();
        this.adjustTrackingFrequency();
      }, newInterval);
    }
  }

  async stopTracking() {
    if (!this.isTracking) return;

    console.log('🔴 Arrêt du tracking GPS...');
    this.isTracking = false;

    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }

    // Désactiver le tracking sur le backend
    try {
      await this.enableBackendTracking(false);
    } catch (error) {
      console.error('⚠️ Erreur lors de la désactivation backend:', error);
    }

    this.updateUI();
    this.showInfo('📍 Partage de position désactivé');
  }

  handlePositionUpdate(position) {
    const accuracy = position.coords.accuracy;
    
    // FILTRE: Ignorer complètement les positions > 1km de précision (aberrantes)
    if (accuracy > 1000) {
      console.log(`🚫 Position ignorée - précision aberrante: ±${Math.round(accuracy)}m (> 1km)`);
      return; // Ne pas traiter du tout cette position
    }
    
    // Déterminer si utilisable pour les calculs (≤ 100m)
    const isAccurateForCalculations = accuracy <= 100; // Seuil fixe de 100m pour les calculs
    
    // NOUVEAU: Détection de mouvement (seulement avec positions précises pour éviter les faux positifs)
    if (isAccurateForCalculations) {
      this.detectMovement(position);
      this.consecutiveAccuratePositions++;
    } else {
      console.log(`📍 Position enregistrée mais exclue des calculs - précision: ±${Math.round(accuracy)}m (> 100m)`);
      // Reset le compteur si position imprécise
      this.consecutiveAccuratePositions = Math.max(0, this.consecutiveAccuratePositions - 1);
    }
    
    // TOUJOURS mettre à jour la dernière position connue (seulement si < 1km)
    this.lastPosition = position;
    
    // Mise à jour de l'interface
    this.updatePositionDisplay(position);
    
    console.log('📍 Position reçue:', {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: `±${Math.round(position.coords.accuracy)}m`,
      usedForCalculations: isAccurateForCalculations ? '✅ Oui' : '❌ Non (>100m)',
      speed: position.coords.speed ? `${Math.round(position.coords.speed * 3.6)} km/h` : null,
      movement: this.isStationary ? 'Stationnaire' : 'En mouvement'
    });
  }

  // NOUVEAU: Détection de mouvement intelligent
  detectMovement(position) {
    if (!this.lastPosition) {
      this.isStationary = false;
      this.lastMovementTime = Date.now();
      return;
    }

    // Calculer la distance depuis la dernière position
    const distance = this.calculateDistance(
      this.lastPosition.coords.latitude,
      this.lastPosition.coords.longitude,
      position.coords.latitude,
      position.coords.longitude
    );

    const timeSinceLastPosition = Date.now() - this.lastMovementTime;
    const speed = position.coords.speed || 0;

    // Déterminer si en mouvement
    const isMoving = distance > 20 || speed > 1; // Plus de 20m ou vitesse > 1 m/s

    if (isMoving) {
      this.isStationary = false;
      this.lastMovementTime = Date.now();
    } else {
      // Considérer comme stationnaire après 3 minutes sans mouvement
      this.isStationary = timeSinceLastPosition > 180000;
    }

    console.log(`🚶 Mouvement: distance=${Math.round(distance)}m, vitesse=${Math.round(speed * 3.6)}km/h, stationnaire=${this.isStationary}`);
  }

  // Calcul de distance entre deux points GPS
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Rayon de la Terre en mètres
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance en mètres
  }

  updatePositionDisplay(position) {
    const positionEl = document.getElementById('current-position');
    const lastUpdateEl = document.getElementById('last-update');
    const accuracyEl = document.getElementById('gps-accuracy');

    if (positionEl) {
      const lat = position.coords.latitude.toFixed(6);
      const lng = position.coords.longitude.toFixed(6);
      positionEl.textContent = `${lat}, ${lng}`;
    }

    if (lastUpdateEl) {
      lastUpdateEl.textContent = new Date().toLocaleTimeString('fr-FR');
    }

    if (accuracyEl) {
      const accuracy = Math.round(position.coords.accuracy);
      const isUsedForCalculations = accuracy <= 100;
      
      // Déterminer la qualité de la précision
      const precision = accuracy <= 20 ? 'Excellente' : 
                       accuracy <= 50 ? 'Bonne' : 
                       accuracy <= 100 ? 'Correcte' : 
                       accuracy <= 1000 ? 'Faible' : 'Aberrante';
      
      // Indicateur d'utilisation
      let calculationStatus;
      if (accuracy <= 100) {
        calculationStatus = '<span style="color: #28a745;">✅ Utilisée pour calculs</span>';
      } else if (accuracy <= 1000) {
        calculationStatus = '<span style="color: #ffc107;">📝 Enregistrée seulement</span>';
      } else {
        calculationStatus = '<span style="color: #dc3545;">🚫 Ignorée</span>';
      }
      
      accuracyEl.innerHTML = `
        ±${accuracy}m 
        <span style="color: ${this.getPrecisionColor(accuracy)};">(${precision})</span><br>
        <small>${calculationStatus}</small>
      `;
    }

    // Ajouter indicateur de mouvement
    this.updateMovementIndicator();
  }

  // AMÉLIORÉ: Couleur selon la précision avec seuil 1km
  getPrecisionColor(accuracy) {
    if (accuracy <= 20) return '#28a745'; // Vert
    if (accuracy <= 50) return '#ffc107'; // Jaune
    if (accuracy <= 100) return '#fd7e14'; // Orange
    if (accuracy <= 1000) return '#dc3545'; // Rouge
    return '#6c757d'; // Gris pour aberrant
  }

  // NOUVEAU: Mettre à jour l'indicateur de mouvement
  updateMovementIndicator() {
    let movementEl = document.getElementById('movement-indicator');
    if (!movementEl) {
      // Créer l'indicateur s'il n'existe pas
      const infoPanel = document.querySelector('.gps-info-panel');
      if (infoPanel) {
        const movementRow = document.createElement('div');
        movementRow.className = 'gps-info-row';
        movementRow.innerHTML = `
          <span class="info-label">🚶 Activité:</span>
          <span class="info-value" id="movement-indicator">Détection...</span>
        `;
        infoPanel.appendChild(movementRow);
        movementEl = document.getElementById('movement-indicator');
      }
    }

    if (movementEl) {
      if (this.isStationary) {
        movementEl.textContent = '🛑 Stationnaire';
        movementEl.style.color = '#6c757d';
      } else {
        movementEl.textContent = '🚶 En mouvement';
        movementEl.style.color = '#28a745';
      }
    }
  }

  async sendCurrentPosition() {
    if (!this.lastPosition || !this.isTracking) return;

    try {
      // IMPORTANT: On envoie seulement les positions < 1km au backend
      // - Positions > 1km = ignorées complètement (aberrantes)
      // - Positions 100m-1km = enregistrées mais pas pour les calculs
      // - Positions ≤ 100m = enregistrées ET utilisées pour les calculs
      const positionData = {
        latitude: this.lastPosition.coords.latitude,
        longitude: this.lastPosition.coords.longitude,
        accuracy: this.lastPosition.coords.accuracy,
        timestamp: new Date().toISOString(),
        speed: this.lastPosition.coords.speed || null,
        heading: this.lastPosition.coords.heading || null
      };

      await ApiClient.request('/gps/location', { method: 'POST', body: JSON.stringify(positionData) });
      console.log('📍 Position envoyée avec succès');
    } catch (error) {
      console.error('❌ Erreur envoi position:', error);
      // Si erreur 403, essayer de réactiver le tracking
      if (error.message.includes('403')) {
        console.log('🔄 Tentative de réactivation du tracking...');
        try {
          await this.enableBackendTracking(true);
        } catch (reactivateError) {
          console.error('❌ Impossible de réactiver le tracking:', reactivateError);
        }
      }
    }
  }

  async enableBackendTracking(enabled) {
    try {
      const response = await ApiClient.request('/gps/toggle-tracking', {
        method: 'POST',
        body: JSON.stringify({ 
          enabled: enabled,
          permission_granted: enabled ? true : null
        })
      });
      
      console.log(`📍 Tracking backend ${enabled ? 'activé' : 'désactivé'}:`, response);
      this.settings.enableTracking = enabled;
      return response;
    } catch (error) {
      console.error('❌ Erreur toggle tracking backend:', error);
      throw error;
    }
  }

  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      const options = {
        enableHighAccuracy: this.settings.highAccuracy,
        timeout: this.settings.timeout,
        maximumAge: this.settings.maximumAge
      };

      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  }

  handleGeolocationError(error) {
    let message = '';
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        message = '🔒 Permission de géolocalisation refusée. Veuillez autoriser l\'accès à votre position dans les paramètres du navigateur.';
        this.permissionStatus = 'denied';
        break;
      case error.POSITION_UNAVAILABLE:
        message = '📍 Position non disponible. Vérifiez que le GPS est activé.';
        break;
      case error.TIMEOUT:
        message = '⏰ Délai d\'attente dépassé pour obtenir la position.';
        break;
      default:
        message = '❌ Erreur de géolocalisation inconnue.';
        break;
    }

    console.error('❌ Erreur GPS:', error);
    this.showError(message);

    // Arrêter le tracking en cas d'erreur
    if (this.isTracking) {
      this.stopTracking();
      const gpsToggle = document.getElementById('gps-toggle');
      if (gpsToggle) gpsToggle.checked = false;
    }
  }

  showSuccess(message) {
    this.showAlert(message, 'success');
  }

  showInfo(message) {
    this.showAlert(message, 'info');
  }

  showError(message) {
    this.showAlert(message, 'error');
  }

  showAlert(message, type = 'info') {
    const alertsContainer = document.getElementById('gps-alerts');
    if (!alertsContainer) return;

    const alert = document.createElement('div');
    alert.className = `gps-alert gps-alert-${type}`;
    alert.textContent = message;

    alertsContainer.appendChild(alert);
    alertsContainer.style.display = 'block';

    // Auto-hide après 5 secondes
    setTimeout(() => {
      if (alert.parentNode) {
        alert.remove();
        if (alertsContainer.children.length === 0) {
          alertsContainer.style.display = 'none';
        }
      }
    }, 5000);
  }

  // Méthode pour cleanup quand l'utilisateur se déconnecte
  cleanup() {
    this.stopTracking();
  }

  // NOUVEAU: Gestion du cycle de vie de l'application
  setupAppLifecycleHandlers() {
    console.log('📱 Configuration des gestionnaires de cycle de vie...');
    
    // Quand l'app redevient visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        console.log('👁️ App redevenue visible - vérification GPS...');
        this.handleAppBecameVisible();
      } else {
        console.log('😴 App cachée');
      }
    });

    // Quand la fenêtre retrouve le focus
    window.addEventListener('focus', () => {
      console.log('🎯 App a retrouvé le focus - vérification GPS...');
      setTimeout(() => this.handleAppBecameVisible(), 1000);
    });

    // Détection de retour en ligne
    window.addEventListener('online', () => {
      console.log('🌐 Connexion rétablie - redémarrage GPS...');
      if (this.settings.enableTracking && !this.isTracking) {
        this.attemptAutoRestart();
      }
    });
  }

  // NOUVEAU: Gestion quand l'app redevient visible
  async handleAppBecameVisible() {
    console.log('🔄 Vérification après retour en premier plan...');
    
    // Si le tracking devrait être actif mais ne l'est pas
    if (this.settings.enableTracking && !this.isTracking) {
      console.log('⚠️ Tracking devrait être actif mais ne l\'est pas - redémarrage...');
      
      // Recharger les paramètres du serveur
      await this.loadSettings();
      
      // Tentative de redémarrage
      await this.attemptAutoRestart();
    }
    
    // Vérifier la connexion avec le serveur
    if (this.isTracking) {
      this.verifyServerConnection();
    }
  }

  // NOUVEAU: Vérification de la connexion serveur
  async verifyServerConnection() {
    try {
      // Test ping vers le serveur
      await ApiClient.request('/gps/settings');
      console.log('✅ Connexion serveur OK');
    } catch (error) {
      console.log('❌ Problème connexion serveur, retry automatique...');
      // Programmer un retry
      setTimeout(() => this.verifyServerConnection(), 30000); // 30 secondes
    }
  }
}

// Initialiser pour les livreurs
let gpsLivreurManager;

// Auto-initialisation si l'utilisateur est un livreur
document.addEventListener('DOMContentLoaded', () => {
  // Attendre que l'utilisateur soit connecté
  const checkUserAndInit = () => {
    if (window.AppState && window.AppState.user && window.AppState.user.role === 'LIVREUR') {
      const gpsInterface = document.getElementById('gps-livreur-interface');
      if (gpsInterface && !window.gpsLivreurManager) {
        try {
          gpsLivreurManager = new GpsLivreurManager();
          console.log('📍 GPS Livreur auto-initialisé pour', window.AppState.user.username);
        } catch (error) {
          console.error('❌ Erreur auto-initialisation GPS:', error);
        }
      }
    }
  };

  // Vérifier plusieurs fois avec délais croissants
  setTimeout(checkUserAndInit, 1000);
  setTimeout(checkUserAndInit, 3000);
  setTimeout(checkUserAndInit, 5000);
});

// Export pour utilisation externe
window.GpsLivreurManager = GpsLivreurManager; 