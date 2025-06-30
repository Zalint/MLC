// ===== GPS MANAGER =====
// Module pour gérer la géolocalisation des livreurs
class GpsManager {
  static trackingInterval = null;
  static lastKnownPosition = null;
  static isTracking = false;
  static config = {
    trackingInterval: 30000, // 30 secondes par défaut
    maxAccuracy: 100,
    timeout: 10000,
    enableHighAccuracy: true
  };

  // Initialiser le système GPS
  static async init() {
    try {
      console.log('📍 Initialisation du système GPS...');
      
      // Charger les paramètres depuis le serveur
      await this.loadSettings();
      
      // Vérifier si c'est un livreur
      if (AppState.user && AppState.user.role === 'LIVREUR') {
        this.setupLivreurGPS();
      } else if (AppState.user && (AppState.user.role === 'MANAGER' || AppState.user.role === 'ADMIN')) {
        this.setupManagerGPS();
      }
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation GPS:', error);
    }
  }

  // Configuration spécifique pour les livreurs
  static setupLivreurGPS() {
    console.log('📱 Configuration GPS pour livreur');
    
    // Afficher les contrôles GPS dans l'interface livreur
    this.showLivreurGpsControls();
    
    // Démarrer automatiquement si le suivi était activé
    if (this.settings && this.settings.tracking_enabled) {
      this.requestLocationPermission();
    }
  }

  // Configuration spécifique pour les managers/admins
  static setupManagerGPS() {
    console.log('🗺️ Configuration GPS pour manager/admin');
    // La carte de suivi sera initialisée dans la page dédiée
    // Pour les managers/admins, on n'a pas besoin de charger des paramètres GPS spécifiques
    this.settings = {
      tracking_enabled: false,
      tracking_interval: 30000
    };
  }

  // Charger les paramètres GPS depuis le serveur
  static async loadSettings() {
    try {
      // Seuls les livreurs peuvent charger leurs paramètres GPS
      if (AppState.user && AppState.user.role === 'LIVREUR') {
        const response = await ApiClient.request('/gps/settings');
        if (response.success) {
          this.settings = response.data;
          this.config = { ...this.config, ...response.config.tracking };
          console.log('⚙️ Paramètres GPS chargés:', this.settings);
        }
      } else {
        // Pour les managers/admins, utiliser des paramètres par défaut
        this.settings = {
          tracking_enabled: false,
          tracking_interval: 30000
        };
        this.config = { ...this.config };
        console.log('⚙️ Paramètres GPS par défaut pour manager/admin');
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des paramètres GPS:', error);
      // Paramètres par défaut
      this.settings = {
        tracking_enabled: false,
        tracking_interval: 30000
      };
    }
  }

  // Afficher les contrôles GPS pour les livreurs
  static showLivreurGpsControls() {
    const sidebar = document.querySelector('.user-sidebar');
    if (!sidebar) return;

    const gpsControls = document.createElement('div');
    gpsControls.className = 'gps-controls';
    gpsControls.innerHTML = `
      <div class="gps-section">
        <h4>📍 Localisation GPS</h4>
        <div class="gps-status">
          <div class="status-indicator" id="gps-status-indicator">
            <span class="status-dot"></span>
            <span class="status-text">Inactif</span>
          </div>
        </div>
        <div class="gps-actions">
          <button type="button" class="btn gps-toggle-btn" id="gps-toggle-btn">
            Activer GPS
          </button>
          <button type="button" class="btn btn-secondary" id="gps-settings-btn">
            Paramètres
          </button>
        </div>
        <div class="gps-info" id="gps-info" style="display: none;">
          <small>
            <div>Précision: <span id="gps-accuracy">-</span>m</div>
            <div>Dernière position: <span id="gps-last-update">-</span></div>
            <div>Batterie: <span id="gps-battery">-</span>%</div>
          </small>
        </div>
      </div>
    `;

    sidebar.appendChild(gpsControls);
    this.setupGpsEventListeners();
    this.updateGpsUI();
  }

  // Configurer les écouteurs d'événements GPS
  static setupGpsEventListeners() {
    const toggleBtn = document.getElementById('gps-toggle-btn');
    const settingsBtn = document.getElementById('gps-settings-btn');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleTracking());
    }

    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.showSettingsModal());
    }
  }

  // Demander l'autorisation de géolocalisation
  static async requestLocationPermission() {
    try {
      console.log('📍 Demande d\'autorisation de géolocalisation...');
      
      if (!navigator.geolocation) {
        throw new Error('La géolocalisation n\'est pas supportée par ce navigateur');
      }

      // Test de permission
      const position = await this.getCurrentPosition();
      console.log('✅ Permission accordée, position obtenue:', position.coords);
      
      return true;
    } catch (error) {
      console.error('❌ Erreur de permission géolocalisation:', error);
      ToastManager.error(`Erreur de géolocalisation: ${error.message}`);
      return false;
    }
  }

  // Obtenir la position actuelle (Promise wrapper)
  static getCurrentPosition() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: this.config.enableHighAccuracy,
          timeout: this.config.timeout,
          maximumAge: 60000 // Cache de 1 minute
        }
      );
    });
  }

  // Activer/désactiver le suivi GPS
  static async toggleTracking() {
    try {
      const toggleBtn = document.getElementById('gps-toggle-btn');
      
      if (this.isTracking) {
        // Désactiver le suivi
        await this.stopTracking();
      } else {
        // Activer le suivi
        toggleBtn.disabled = true;
        toggleBtn.textContent = 'Demande d\'autorisation...';
        
        const hasPermission = await this.requestLocationPermission();
        
        if (hasPermission) {
          await this.startTracking();
        } else {
          ToastManager.error('Autorisation de géolocalisation requise pour activer le suivi');
        }
        
        toggleBtn.disabled = false;
      }
    } catch (error) {
      console.error('❌ Erreur lors du basculement du suivi:', error);
      ToastManager.error('Erreur lors de la modification du suivi GPS');
    }
  }

  // Démarrer le suivi GPS
  static async startTracking() {
    try {
      // Mettre à jour les paramètres sur le serveur
      const response = await ApiClient.request('/gps/toggle-tracking', {
        method: 'POST',
        body: JSON.stringify({
          enabled: true,
          permission_granted: true
        })
      });

      if (response.success) {
        this.isTracking = true;
        this.settings = response.data;
        
        // Démarrer l'envoi périodique de positions
        this.startPeriodicTracking();
        
        ToastManager.success('Suivi GPS activé');
        this.updateGpsUI();
        
        console.log('📍 Suivi GPS démarré');
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      console.error('❌ Erreur lors du démarrage du suivi:', error);
      ToastManager.error('Impossible d\'activer le suivi GPS');
    }
  }

  // Arrêter le suivi GPS
  static async stopTracking() {
    try {
      // Arrêter l'intervalle
      if (this.trackingInterval) {
        clearInterval(this.trackingInterval);
        this.trackingInterval = null;
      }

      // Mettre à jour les paramètres sur le serveur
      const response = await ApiClient.request('/gps/toggle-tracking', {
        method: 'POST',
        body: JSON.stringify({
          enabled: false
        })
      });

      if (response.success) {
        this.isTracking = false;
        this.settings = response.data;
        
        ToastManager.info('Suivi GPS désactivé');
        this.updateGpsUI();
        
        console.log('📍 Suivi GPS arrêté');
      }
    } catch (error) {
      console.error('❌ Erreur lors de l\'arrêt du suivi:', error);
      ToastManager.error('Erreur lors de la désactivation du suivi GPS');
    }
  }

  // Démarrer le suivi périodique
  static startPeriodicTracking() {
    // Envoyer immédiatement une position
    this.sendCurrentPosition();
    
    // Puis envoyer périodiquement
    this.trackingInterval = setInterval(() => {
      this.sendCurrentPosition();
    }, this.config.trackingInterval);
    
    console.log(`📍 Suivi périodique démarré (${this.config.trackingInterval}ms)`);
  }

  // Envoyer la position actuelle au serveur
  static async sendCurrentPosition() {
    try {
      const position = await this.getCurrentPosition();
      const coords = position.coords;
      
      // Vérifier la précision
      if (coords.accuracy > this.config.maxAccuracy) {
        console.warn(`⚠️ Précision GPS insuffisante: ${coords.accuracy}m`);
        return;
      }

      // Obtenir le niveau de batterie si disponible
      let batteryLevel = null;
      if ('getBattery' in navigator) {
        try {
          const battery = await navigator.getBattery();
          batteryLevel = Math.round(battery.level * 100);
        } catch (e) {
          // Batterie API non disponible
        }
      }

      // Préparer les données
      const locationData = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        is_active: true,
        battery_level: batteryLevel,
        speed: coords.speed ? Math.round(coords.speed * 3.6) : null, // m/s vers km/h
        timestamp: new Date().toISOString()
      };

      // Envoyer au serveur
      const response = await ApiClient.request('/gps/location', {
        method: 'POST',
        body: JSON.stringify(locationData)
      });

      if (response.success) {
        this.lastKnownPosition = locationData;
        this.updateGpsInfo();
        console.log('📍 Position envoyée:', coords.latitude, coords.longitude);
      } else {
        console.error('❌ Erreur lors de l\'envoi de position:', response.message);
      }

    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi de position:', error);
      
      // En cas d'erreur de géolocalisation, ne pas arrêter complètement
      if (error.code === error.PERMISSION_DENIED) {
        ToastManager.error('Permission de géolocalisation refusée');
        this.stopTracking();
      }
    }
  }

  // Mettre à jour l'interface GPS
  static updateGpsUI() {
    const statusIndicator = document.getElementById('gps-status-indicator');
    const toggleBtn = document.getElementById('gps-toggle-btn');
    const gpsInfo = document.getElementById('gps-info');

    if (!statusIndicator || !toggleBtn) return;

    const statusDot = statusIndicator.querySelector('.status-dot');
    const statusText = statusIndicator.querySelector('.status-text');

    if (this.isTracking) {
      statusDot.className = 'status-dot online';
      statusText.textContent = 'Actif';
      toggleBtn.textContent = 'Désactiver GPS';
      toggleBtn.className = 'btn btn-danger gps-toggle-btn';
      if (gpsInfo) gpsInfo.style.display = 'block';
    } else {
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'Inactif';
      toggleBtn.textContent = 'Activer GPS';
      toggleBtn.className = 'btn btn-primary gps-toggle-btn';
      if (gpsInfo) gpsInfo.style.display = 'none';
    }
  }

  // Mettre à jour les informations GPS
  static updateGpsInfo() {
    if (!this.lastKnownPosition) return;

    const accuracyEl = document.getElementById('gps-accuracy');
    const lastUpdateEl = document.getElementById('gps-last-update');
    const batteryEl = document.getElementById('gps-battery');

    if (accuracyEl) {
      accuracyEl.textContent = Math.round(this.lastKnownPosition.accuracy);
    }

    if (lastUpdateEl) {
      const time = new Date(this.lastKnownPosition.timestamp);
      lastUpdateEl.textContent = time.toLocaleTimeString();
    }

    if (batteryEl) {
      batteryEl.textContent = this.lastKnownPosition.battery_level || '-';
    }
  }

  // Afficher la modal des paramètres GPS
  static showSettingsModal() {
    const content = `
      <div class="gps-settings-form">
        <div class="form-group">
          <label for="gps-interval">Intervalle de suivi (secondes):</label>
          <select id="gps-interval" class="form-control">
            <option value="5000">5 secondes</option>
            <option value="10000">10 secondes</option>
            <option value="30000" selected>30 secondes</option>
            <option value="60000">1 minute</option>
            <option value="300000">5 minutes</option>
          </select>
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" id="gps-high-accuracy" checked>
            Haute précision (consomme plus de batterie)
          </label>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-primary" id="save-gps-settings">
            Sauvegarder
          </button>
          <button type="button" class="btn btn-secondary" id="cancel-gps-settings">
            Annuler
          </button>
        </div>
      </div>
    `;

    ModalManager.show('Paramètres GPS', content);

    // Charger les valeurs actuelles
    const intervalSelect = document.getElementById('gps-interval');
    const highAccuracyCheck = document.getElementById('gps-high-accuracy');

    if (intervalSelect && this.settings) {
      intervalSelect.value = this.settings.tracking_interval || 30000;
    }

    if (highAccuracyCheck) {
      highAccuracyCheck.checked = this.config.enableHighAccuracy;
    }

    // Écouteurs d'événements
    document.getElementById('save-gps-settings').addEventListener('click', () => {
      this.saveGpsSettings();
    });

    document.getElementById('cancel-gps-settings').addEventListener('click', () => {
      ModalManager.hide();
    });
  }

  // Sauvegarder les paramètres GPS
  static async saveGpsSettings() {
    try {
      const interval = parseInt(document.getElementById('gps-interval').value);
      const highAccuracy = document.getElementById('gps-high-accuracy').checked;

      // Mettre à jour la configuration locale
      this.config.trackingInterval = interval;
      this.config.enableHighAccuracy = highAccuracy;

      // Envoyer au serveur
      const response = await ApiClient.request('/gps/interval', {
        method: 'PUT',
        body: JSON.stringify({ interval })
      });

      if (response.success) {
        this.settings = response.data;
        
        // Redémarrer le suivi avec les nouveaux paramètres si actif
        if (this.isTracking) {
          clearInterval(this.trackingInterval);
          this.startPeriodicTracking();
        }

        ToastManager.success('Paramètres GPS sauvegardés');
        ModalManager.hide();
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde des paramètres GPS:', error);
      ToastManager.error('Erreur lors de la sauvegarde des paramètres');
    }
  }

  // Nettoyer les ressources GPS
  static cleanup() {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
    this.isTracking = false;
    console.log('🧹 Nettoyage des ressources GPS');
  }
}

// Ajouter les méthodes GPS à l'ApiClient
ApiClient.getGpsLocations = async function() {
  return this.request('/gps/locations');
};

ApiClient.getGpsLocationByLivreur = async function(livreurId) {
  return this.request(`/gps/location/${livreurId}`);
};

ApiClient.getGpsHistory = async function(livreurId, startDate, endDate) {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  return this.request(`/gps/history/${livreurId}?${params.toString()}`);
};

ApiClient.calculateDistance = async function(livreurId, startDate, endDate) {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  return this.request(`/gps/distance/${livreurId}?${params.toString()}`);
};

ApiClient.getGpsStats = async function() {
  return this.request('/gps/stats');
};

ApiClient.getOfflineLivreurs = async function(minutes = 5) {
  return this.request(`/gps/offline?minutes=${minutes}`);
};
 