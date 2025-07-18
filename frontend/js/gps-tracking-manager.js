// ===== GPS TRACKING MANAGER =====
// Module pour la page de suivi GPS des managers/admins
class GpsTrackingManager {
  static refreshInterval = null;
  static currentPositions = [];
  static map = null;
  static markers = {};
  
  // Variables pour le tracé journalier
  static currentTrace = null;
  static tracePolyline = null;
  static traceMarkers = [];
  static availableLivreurs = [];
  
  // Variables pour la configuration de tracking
  static trackingConfigs = [];
  static currentConfigLivreur = null;

  // Initialiser la page de suivi GPS
  static async init() {
    console.log('🗺️ === DÉBUT INIT GPS TRACKING MANAGER ===');
    
    // Audit complet de l'environnement
    this.performEnvironmentAudit();
    
    console.log('🗺️ Initialisation du gestionnaire de suivi GPS');
    this.setupEventListeners();
    this.initializeMap();
    await this.loadGpsData();
    this.startAutoRefresh();
    
    console.log('🗺️ === FIN INIT GPS TRACKING MANAGER ===');
  }

  // Audit complet de l'environnement
  static performEnvironmentAudit() {
    console.log('🔍 === AUDIT ENVIRONNEMENT GPS ===');
    
    // Audit des dimensions de viewport
    console.log('📐 Viewport:', {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      devicePixelRatio: window.devicePixelRatio
    });
    
    // Audit des containers
    const containers = [
      '#gps-tracking-page',
      '.gps-tracking-content', 
      '.gps-controls-panel',
      '.gps-map-container',
      '#gps-map'
    ];
    
    containers.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        const computedStyle = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        
        console.log(`📦 ${selector}:`, {
          exists: true,
          dimensions: {
            width: element.offsetWidth,
            height: element.offsetHeight,
            clientWidth: element.clientWidth,
            clientHeight: element.clientHeight,
            scrollWidth: element.scrollWidth,
            scrollHeight: element.scrollHeight
          },
          boundingRect: {
            width: rect.width,
            height: rect.height,
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom
          },
          computedStyle: {
            display: computedStyle.display,
            position: computedStyle.position,
            width: computedStyle.width,
            height: computedStyle.height,
            minWidth: computedStyle.minWidth,
            minHeight: computedStyle.minHeight,
            maxWidth: computedStyle.maxWidth,
            maxHeight: computedStyle.maxHeight,
            padding: `${computedStyle.paddingTop} ${computedStyle.paddingRight} ${computedStyle.paddingBottom} ${computedStyle.paddingLeft}`,
            margin: `${computedStyle.marginTop} ${computedStyle.marginRight} ${computedStyle.marginBottom} ${computedStyle.marginLeft}`,
            border: `${computedStyle.borderTopWidth} ${computedStyle.borderRightWidth} ${computedStyle.borderBottomWidth} ${computedStyle.borderLeftWidth}`,
            boxSizing: computedStyle.boxSizing,
            overflow: computedStyle.overflow,
            overflowX: computedStyle.overflowX,
            overflowY: computedStyle.overflowY,
            zIndex: computedStyle.zIndex,
            opacity: computedStyle.opacity,
            visibility: computedStyle.visibility,
            transform: computedStyle.transform,
            gridTemplateColumns: computedStyle.gridTemplateColumns,
            gridTemplateRows: computedStyle.gridTemplateRows,
            flex: computedStyle.flex,
            flexDirection: computedStyle.flexDirection,
            justifyContent: computedStyle.justifyContent,
            alignItems: computedStyle.alignItems
          },
          parentElement: element.parentElement ? element.parentElement.tagName : null,
          classList: Array.from(element.classList)
        });
      } else {
        console.log(`📦 ${selector}: INTROUVABLE`);
      }
    });
    
    // Audit CSS spécifique
    const gpsMapElement = document.getElementById('gps-map');
    if (gpsMapElement) {
      console.log('🎨 Styles CSS appliqués au #gps-map:');
      const allStyles = window.getComputedStyle(gpsMapElement);
      const relevantProperties = [
        'position', 'top', 'left', 'right', 'bottom',
        'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
        'display', 'flex', 'grid',
        'padding', 'margin', 'border',
        'overflow', 'clip', 'clip-path',
        'transform', 'transform-origin',
        'z-index', 'opacity', 'visibility'
      ];
      
      const appliedStyles = {};
      relevantProperties.forEach(prop => {
        appliedStyles[prop] = allStyles.getPropertyValue(prop);
      });
      console.log('🎨 Styles pertinents:', appliedStyles);
    }
    
    // Audit des CSS media queries actives
    const mediaQueries = [
      '(max-width: 768px)',
      '(max-width: 1024px)',
      '(min-width: 769px)',
      '(min-width: 1025px)'
    ];
    
    console.log('📱 Media queries actives:');
    mediaQueries.forEach(mq => {
      console.log(`  ${mq}: ${window.matchMedia(mq).matches}`);
    });
    
    console.log('🔍 === FIN AUDIT ENVIRONNEMENT ===');
  }

  // Configurer les écouteurs d'événements
  static setupEventListeners() {
    const refreshBtn = document.getElementById('gps-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadGpsData());
    }
    
    // Event listeners pour le tracé journalier
    this.setupTraceEventListeners();
    
    // Event listeners pour la configuration de tracking
    this.setupTrackingConfigEventListeners();
  }
  
  // Configurer les événements pour le tracé journalier
  static setupTraceEventListeners() {
    console.log('📍 Configuration des événements de tracé');
    
    // Charger les livreurs disponibles au démarrage
    this.loadAvailableLivreurs();
    
    // Définir la date par défaut (aujourd'hui)
    const traceDateInput = document.getElementById('trace-date-input');
    if (traceDateInput) {
      traceDateInput.value = new Date().toISOString().split('T')[0];
    }
    
    // Event listener pour changement de livreur
    const livreurSelect = document.getElementById('trace-livreur-select');
    if (livreurSelect) {
      livreurSelect.addEventListener('change', this.onLivreurSelectionChange.bind(this));
    }
    
    // Event listener pour changement de date
    if (traceDateInput) {
      traceDateInput.addEventListener('change', this.onDateSelectionChange.bind(this));
    }
    
    // Event listener pour afficher le tracé
    const showTraceBtn = document.getElementById('show-trace-btn');
    if (showTraceBtn) {
      showTraceBtn.addEventListener('click', this.showTrace.bind(this));
    }
    
    // Event listener pour effacer le tracé
    const clearTraceBtn = document.getElementById('clear-trace-btn');
    if (clearTraceBtn) {
      clearTraceBtn.addEventListener('click', this.clearTrace.bind(this));
    }
  }

  // Charger les données GPS
  static async loadGpsData() {
    console.log('📡 === DÉBUT CHARGEMENT GPS DATA ===');
    
    try {
      console.log('📡 Chargement des données GPS...');
      console.log('🔑 Token disponible:', !!localStorage.getItem('token'));
      console.log('🌐 API Base URL:', window.API_BASE_URL || 'undefined');
      
      // Charger les statistiques et positions en parallèle
      console.log('📊 Lancement des requêtes parallèles...');
      
      const [statsResponse, positionsResponse] = await Promise.all([
        ApiClient.getGpsStats().catch(err => {
          console.warn('🔄 Erreur stats GPS, utilisation de données de démonstration:', err);
          console.warn('🔄 Type d\'erreur stats:', typeof err, err.constructor.name);
          console.warn('🔄 Message erreur stats:', err.message);
          return { 
            success: true, 
            data: { online_livreurs: 2, offline_livreurs: 1, tracking_enabled: 3 } 
          };
        }),
        ApiClient.getGpsLocations().catch(err => {
          console.warn('🔄 Erreur positions GPS, utilisation de données de démonstration:', err);
          console.warn('🔄 Type d\'erreur positions:', typeof err, err.constructor.name);
          console.warn('🔄 Message erreur positions:', err.message);
          console.warn('🔄 Stack trace positions:', err.stack);
          // Données de démonstration pour montrer le fonctionnement de la carte
          return { 
            success: true, 
            data: [
              {
                livreur_id: 1,
                livreur_username: 'Demo Driver 1',
                latitude: 14.6928,
                longitude: -17.4467,
                accuracy: 15,
                speed: 25,
                seconds_ago: 45,
                timestamp: new Date(Date.now() - 45000).toISOString()
              },
              {
                livreur_id: 2,
                livreur_username: 'Demo Driver 2', 
                latitude: 14.7021,
                longitude: -17.4519,
                accuracy: 8,
                speed: 0,
                seconds_ago: 120,
                timestamp: new Date(Date.now() - 120000).toISOString()
              },
              {
                livreur_id: 3,
                livreur_username: 'Demo Driver 3',
                latitude: 14.6845,
                longitude: -17.4389,
                accuracy: 22,
                speed: 35,
                seconds_ago: 350,
                timestamp: new Date(Date.now() - 350000).toISOString()
              }
            ]
          };
        })
      ]);

      console.log('📊 Réponses reçues:');
      console.log('📊 Stats response:', statsResponse);
      console.log('📊 Positions response:', positionsResponse);

      if (statsResponse.success) {
        console.log('📊 Mise à jour des stats avec:', statsResponse.data);
        this.updateStats(statsResponse.data);
      } else {
        console.warn('⚠️ Stats response not successful:', statsResponse);
      }

      if (positionsResponse.success) {
        this.currentPositions = positionsResponse.data;
        console.log('🔍 Format des données de position:', positionsResponse.data);
        console.log('👨‍💼 Nombre de positions reçues:', positionsResponse.data?.length || 0);
        
        console.log('📝 Mise à jour de la liste des livreurs...');
        this.updateLivreursList(positionsResponse.data);
        
        console.log('🗺️ Mise à jour de la carte...');
        this.updateMap(positionsResponse.data);
      } else {
        console.warn('⚠️ Positions response not successful:', positionsResponse);
      }

      console.log(`📡 === FIN CHARGEMENT GPS DATA: ${this.currentPositions.length} positions ===`);

    } catch (error) {
      console.error('❌ === ERREUR LORS DU CHARGEMENT GPS ===');
      console.error('❌ Type d\'erreur:', typeof error, error.constructor.name);
      console.error('❌ Message:', error.message);
      console.error('❌ Stack trace:', error.stack);
      console.error('❌ Error object:', error);
      
      // Afficher des données par défaut au lieu d'une erreur
      console.log('🔄 Basculement vers données par défaut...');
      this.updateStats({ online_livreurs: 0, offline_livreurs: 0, tracking_enabled: 0 });
      this.updateLivreursList([]);
      this.updateMap([]);
      console.log('🔄 Données par défaut appliquées');
    }
  }

  // Mettre à jour les statistiques
  static updateStats(stats) {
    const onlineCountEl = document.getElementById('gps-online-count');
    const offlineCountEl = document.getElementById('gps-offline-count');
    const enabledCountEl = document.getElementById('gps-enabled-count');

    if (onlineCountEl) {
      onlineCountEl.textContent = stats.online_livreurs || 0;
    }

    if (offlineCountEl) {
      offlineCountEl.textContent = stats.offline_livreurs || 0;
    }

    if (enabledCountEl) {
      enabledCountEl.textContent = stats.tracking_enabled || 0;
    }
  }

  // Mettre à jour la liste des livreurs
  static updateLivreursList(positions) {
    const listContainer = document.getElementById('gps-livreurs-list');
    if (!listContainer) return;

    if (positions.length === 0) {
      listContainer.innerHTML = '<p style="color: #666; text-align: center;">Aucun livreur en ligne</p>';
      return;
    }

    const livreurItemsHtml = positions.map(position => {
      const isOnline = position.seconds_ago < 300; // 5 minutes
      const lastSeen = this.formatLastSeen(position.seconds_ago);
      
      return `
        <div class="gps-livreur-item">
          <div>
            <div class="gps-livreur-name">${Utils.escapeHtml(position.livreur_username)}</div>
            <small style="color: #666;">Dernière position: ${lastSeen}</small>
          </div>
          <span class="gps-livreur-status ${isOnline ? 'online' : 'offline'}">
            ${isOnline ? 'En ligne' : 'Hors ligne'}
          </span>
        </div>
      `;
    }).join('');

    listContainer.innerHTML = livreurItemsHtml;
  }

  // Initialiser la carte Leaflet
  static initializeMap() {
    console.log('🗺️ Début initializeMap()');
    
    const mapContainer = document.getElementById('gps-map');
    console.log('🗺️ Container gps-map:', mapContainer);
    console.log('🗺️ Container dimensions:', {
      width: mapContainer?.offsetWidth,
      height: mapContainer?.offsetHeight,
      clientWidth: mapContainer?.clientWidth,
      clientHeight: mapContainer?.clientHeight,
      computedStyle: mapContainer ? window.getComputedStyle(mapContainer) : null
    });
    
    if (!mapContainer) {
      console.error('❌ Container gps-map non trouvé!');
      return;
    }
    
    if (this.map) {
      console.log('🗺️ Carte déjà initialisée, nettoyage...');
      this.map.remove();
      this.map = null;
    }

    // FORCE: Corriger la hauteur du container par JavaScript
    console.log('🔧 FORÇAGE de la hauteur du container...');
    const parent = mapContainer.parentElement;
    const availableHeight = Math.max(
      window.innerHeight - 200, // Viewport moins les marges
      500 // Minimum 500px
    );
    
    console.log('🔧 Hauteur calculée:', availableHeight);
    console.log('🔧 Parent container:', parent);
    
    // Appliquer les styles de force
    mapContainer.style.height = `${availableHeight}px`;
    mapContainer.style.minHeight = '500px';
    mapContainer.style.maxHeight = 'none';
    mapContainer.style.display = 'block';
    mapContainer.style.position = 'relative';
    mapContainer.style.width = '100%';
    
    // Aussi forcer le parent si nécessaire
    if (parent && parent.classList.contains('gps-tracking-content')) {
      parent.style.height = '100%';
      parent.style.minHeight = `${availableHeight + 50}px`;
    }
    
    console.log('🔧 Styles forcés appliqués:', {
      height: mapContainer.style.height,
      minHeight: mapContainer.style.minHeight,
      maxHeight: mapContainer.style.maxHeight,
      display: mapContainer.style.display,
      finalOffsetHeight: mapContainer.offsetHeight
    });

    try {
      console.log('🗺️ Vérification Leaflet:', typeof L !== 'undefined' ? 'disponible' : 'non disponible');
      
      // Configurer les icônes Leaflet pour utiliser les fichiers locaux
      console.log('🗺️ Configuration des icônes Leaflet...');
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'assets/leaflet/images/marker-icon-2x.png',
        iconUrl: 'assets/leaflet/images/marker-icon.png',
        shadowUrl: 'assets/leaflet/images/marker-shadow.png',
      });

      // Centrer sur Dakar par défaut
      console.log('🗺️ Création de la carte Leaflet...');
      this.map = L.map('gps-map').setView([14.6937, -17.4441], 11);
      console.log('🗺️ Carte créée:', this.map);

      // Ajouter les tuiles OpenStreetMap
      console.log('🗺️ Ajout des tuiles OpenStreetMap...');
      const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      });
      
      tileLayer.on('loading', () => {
        console.log('🗺️ Tuiles en cours de chargement...');
      });
      
      tileLayer.on('load', () => {
        console.log('🗺️ Tuiles chargées avec succès');
      });
      
      tileLayer.on('tileerror', (e) => {
        console.error('❌ Erreur de chargement des tuiles:', e);
      });
      
      tileLayer.addTo(this.map);

      console.log('🗺️ Carte interactive initialisée');
      console.log('🗺️ État de la carte:', {
        zoom: this.map.getZoom(),
        center: this.map.getCenter(),
        size: this.map.getSize(),
        container: this.map.getContainer()
      });
      
      // FORCE: Correction post-initialisation
      console.log('🔧 CORRECTION POST-LEAFLET...');
      const mapContainerPost = document.getElementById('gps-map');
      if (mapContainerPost) {
        const currentHeight = mapContainerPost.offsetHeight;
        console.log('🔧 Hauteur actuelle après Leaflet:', currentHeight);
        
        if (currentHeight < 200) {
          console.log('🔧 Hauteur trop petite, correction...');
          const targetHeight = Math.max(window.innerHeight - 200, 500);
          mapContainerPost.style.height = `${targetHeight}px`;
          mapContainerPost.style.minHeight = '500px';
          
          // Force Leaflet container
          const leafletContainer = mapContainerPost.querySelector('.leaflet-container');
          if (leafletContainer) {
            leafletContainer.style.height = `${targetHeight}px`;
            leafletContainer.style.width = '100%';
          }
          
          console.log('🔧 Correction appliquée, nouvelle hauteur:', mapContainerPost.offsetHeight);
        }
      }
      
      // Force le redimensionnement de la carte après un court délai
      setTimeout(() => {
        if (this.map) {
          console.log('🗺️ Premier redimensionnement (250ms)...');
          console.log('🗺️ Taille avant invalidateSize:', this.map.getSize());
          this.map.invalidateSize();
          console.log('🗺️ Taille après invalidateSize:', this.map.getSize());
          console.log('🗺️ Taille de la carte mise à jour');
        }
      }, 250);
      
      // Redimensionnement additionnel après le chargement complet
      setTimeout(() => {
        if (this.map) {
          console.log('🗺️ Redimensionnement final (1000ms)...');
          console.log('🗺️ Container final dimensions:', {
            width: mapContainer.offsetWidth,
            height: mapContainer.offsetHeight
          });
          this.map.invalidateSize();
          this.map.setView([14.6937, -17.4441], 11);
          console.log('🗺️ Vue finale de la carte:', this.map.getCenter(), this.map.getZoom());
          console.log('🗺️ Redimensionnement final de la carte');
        }
      }, 1000);
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation de la carte:', error);
      console.error('❌ Stack trace:', error.stack);
      mapContainer.innerHTML = `
        <div style="text-align: center; padding: 20px; background: #fff; border: 1px solid #ccc;">
          <p>❌ Erreur lors du chargement de la carte</p>
          <p style="font-size: 12px; color: #666;">${error.message}</p>
          <button onclick="window.location.reload()" style="margin-top: 10px; padding: 5px 10px;">Recharger la page</button>
        </div>
      `;
    }
  }

  // Mettre à jour la carte avec les positions des livreurs
  static updateMap(positions) {
    console.log('🗺️ === DÉBUT UPDATE MAP ===');
    console.log('🗺️ Carte disponible:', !!this.map);
    console.log('🗺️ Positions reçues:', positions);
    console.log('🗺️ Nombre de positions:', positions?.length || 0);
    
    if (!this.map) {
      console.error('❌ Carte non initialisée pour updateMap');
      return;
    }

    try {
      console.log('🗺️ État actuel de la carte:', {
        zoom: this.map.getZoom(),
        center: this.map.getCenter(),
        size: this.map.getSize(),
        hasContainer: !!this.map.getContainer(),
        containerDimensions: {
          width: this.map.getContainer()?.offsetWidth,
          height: this.map.getContainer()?.offsetHeight
        }
      });

      // Supprimer les anciens marqueurs
      console.log('🗺️ Suppression des anciens marqueurs...');
      console.log('🗺️ Nombre de marqueurs existants:', Object.keys(this.markers).length);
      Object.values(this.markers).forEach(marker => {
        this.map.removeLayer(marker);
      });
      this.markers = {};
      console.log('🗺️ Marqueurs supprimés');

      if (positions.length === 0) {
        console.log('🗺️ Aucune position à afficher');
        return;
      }

      const bounds = [];
      let markersAdded = 0;

      // Ajouter les nouveaux marqueurs
      console.log('🗺️ Ajout des nouveaux marqueurs...');
      positions.forEach((position, index) => {
        console.log(`🗺️ Traitement position ${index + 1}:`, position);
        
        // Convertir les coordonnées en nombres pour éviter les erreurs (DOIT ÊTRE EN PREMIER)
        const lat = parseFloat(position.latitude);
        const lng = parseFloat(position.longitude);
        const accuracy = position.accuracy ? parseFloat(position.accuracy) : null;
        const speed = position.speed ? parseFloat(position.speed) : null;
        
        console.log(`🗺️ Coordonnées parsées: lat=${lat}, lng=${lng}`);
        
        // Vérifier que les coordonnées sont valides
        if (isNaN(lat) || isNaN(lng)) {
          console.warn('⚠️ Coordonnées invalides pour', position.livreur_username, ':', position.latitude, position.longitude);
          return;
        }

        const isOnline = position.seconds_ago < 300; // 5 minutes
        const lastSeen = this.formatLastSeen(position.seconds_ago);
        
        console.log(`🗺️ Statut livreur ${position.livreur_username}: ${isOnline ? 'en ligne' : 'hors ligne'}`);
        
        // Choisir l'icône selon le statut
        const iconHtml = isOnline ? '🚚' : '🔴';
        const iconColor = isOnline ? '#22c55e' : '#ef4444';
        
        console.log(`🗺️ Création du marqueur pour ${position.livreur_username}...`);
        
        // S'assurer que le nom existe
        const displayName = position.livreur_username || 'Inconnu';
        console.log(`🏷️ Nom à afficher: "${displayName}"`);
        
        const marker = L.marker([lat, lng], {
          icon: L.divIcon({
            html: `<div class="gps-marker-container" style="
              display: flex !important; 
              flex-direction: column !important; 
              align-items: center !important; 
              justify-content: center !important;
              pointer-events: none !important;
              position: relative !important;
              z-index: 1000 !important;
            ">
              <div class="gps-marker-icon" style="
                background: ${iconColor} !important; 
                border-radius: 50% !important; 
                width: 32px !important; 
                height: 32px !important; 
                display: flex !important; 
                align-items: center !important; 
                justify-content: center !important; 
                font-size: 18px !important;
                border: 3px solid white !important;
                box-shadow: 0 3px 8px rgba(0,0,0,0.4) !important;
                margin-bottom: 4px !important;
                z-index: 1001 !important;
              ">${iconHtml}</div>
              <div class="gps-marker-label" style="
                background: rgba(255, 255, 255, 0.95) !important; 
                padding: 4px 10px !important; 
                border-radius: 8px !important; 
                font-size: 14px !important; 
                font-weight: bold !important; 
                color: #333 !important; 
                border: 2px solid #ccc !important;
                box-shadow: 0 3px 8px rgba(0,0,0,0.4) !important;
                white-space: nowrap !important;
                text-align: center !important;
                min-width: 40px !important;
                z-index: 1002 !important;
                position: relative !important;
                font-family: Arial, sans-serif !important;
              ">${Utils.escapeHtml(displayName)}</div>
            </div>`,
            iconSize: [120, 70],
            iconAnchor: [60, 65],
            popupAnchor: [0, -65],
            className: 'gps-marker-with-name'
          })
        });
        
        console.log(`✅ Marqueur créé pour ${displayName}`);

        console.log(`🗺️ Marqueur créé:`, marker);

        // Popup avec informations du livreur
        const popupContent = `
          <div style="min-width: 200px;">
            <h4 style="margin: 0 0 10px 0;">${Utils.escapeHtml(position.livreur_username)}</h4>
            <p style="margin: 5px 0;"><strong>Statut:</strong> ${isOnline ? '🟢 En ligne' : '🔴 Hors ligne'}</p>
            <p style="margin: 5px 0;"><strong>Dernière position:</strong> ${lastSeen}</p>
            <p style="margin: 5px 0;"><strong>Coordonnées:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
            ${accuracy ? `<p style="margin: 5px 0;"><strong>Précision:</strong> ±${Math.round(accuracy)}m</p>` : ''}
            ${speed ? `<p style="margin: 5px 0;"><strong>Vitesse:</strong> ${Math.round(speed * 3.6)} km/h</p>` : ''}
            <button onclick="window.gpsTrackingManager?.showLivreurDetails(${position.livreur_id}, '${Utils.escapeHtml(position.livreur_username)}')" 
                    style="margin-top: 10px; padding: 5px 10px; background: #3b82f6; color: white; border: none; border-radius: 3px; cursor: pointer;">
              📋 Voir détails
            </button>
          </div>
        `;

        marker.bindPopup(popupContent);
        
        console.log(`🗺️ Ajout du marqueur à la carte...`);
        marker.addTo(this.map);
        
        this.markers[position.livreur_id] = marker;
        bounds.push([lat, lng]);
        markersAdded++;
        
        console.log(`🗺️ Marqueur ${markersAdded} ajouté avec succès`);
      });

      console.log(`🗺️ Total marqueurs ajoutés: ${markersAdded}`);
      console.log(`🗺️ Bounds calculés:`, bounds);

      // Ajuster la vue pour afficher tous les marqueurs
      if (bounds.length > 0) {
        console.log('🗺️ Ajustement de la vue avec fitBounds...');
        this.map.fitBounds(bounds, { padding: [20, 20] });
        console.log('🗺️ Vue ajustée, nouvelle vue:', {
          center: this.map.getCenter(),
          zoom: this.map.getZoom()
        });
      } else {
        console.log('🗺️ Aucun bounds à ajuster');
      }

      // Force un redimensionnement après l'ajout des marqueurs
      setTimeout(() => {
        if (this.map) {
          console.log('🗺️ Redimensionnement post-marqueurs...');
          this.map.invalidateSize();
          console.log('🗺️ Taille après redimensionnement post-marqueurs:', this.map.getSize());
        }
      }, 100);

      console.log(`🗺️ === FIN UPDATE MAP: ${positions.length} livreurs, ${markersAdded} marqueurs ===`);
    } catch (error) {
      console.error('❌ === ERREUR UPDATE MAP ===');
      console.error('❌ Type d\'erreur:', typeof error, error.constructor.name);
      console.error('❌ Message:', error.message);
      console.error('❌ Stack trace:', error.stack);
      console.error('❌ Error object:', error);
    }
  }

  // Formater le temps depuis la dernière position
  static formatLastSeen(secondsAgo) {
    if (secondsAgo < 60) {
      return 'À l\'instant';
    } else if (secondsAgo < 3600) {
      const minutes = Math.floor(secondsAgo / 60);
      return `Il y a ${minutes} min`;
    } else {
      const hours = Math.floor(secondsAgo / 3600);
      return `Il y a ${hours}h`;
    }
  }

  // Démarrer le rafraîchissement automatique
  static startAutoRefresh() {
    // Rafraîchir toutes les 60 secondes pour éviter les rate limits
    this.refreshInterval = setInterval(() => {
      this.loadGpsData();
    }, 300000);

    console.log('🔄 Rafraîchissement automatique démarré (5min)');
    
    // Monitoring continu de l'état de la carte
    this.startMapMonitoring();
  }

  // Surveillance légère de l'état de la carte
  static startMapMonitoring() {
    console.log('👁️ Démarrage du monitoring léger de la carte...');
    
    // Vérification initiale après 2 secondes
    setTimeout(() => {
      this.checkMapState('Vérification initiale (2s)');
    }, 2000);
    
    // Une seule vérification supplémentaire après 30 secondes pour s'assurer que tout va bien
    setTimeout(() => {
      this.checkMapState('Vérification de stabilité (30s)');
    }, 30000);
  }

  // Vérifier l'état de la carte
  static checkMapState(context) {
    console.log(`🔍 ${context} - État de la carte:`);
    
    const gpsMap = document.getElementById('gps-map');
    const mapContainer = document.querySelector('.gps-map-container');
    
    console.log('🗺️ État détaillé:', {
      context: context,
      timestamp: new Date().toLocaleTimeString(),
      mapExists: !!this.map,
      mapContainerElement: !!gpsMap,
      mapContainerWrapper: !!mapContainer,
      containerDimensions: gpsMap ? {
        offsetWidth: gpsMap.offsetWidth,
        offsetHeight: gpsMap.offsetHeight,
        clientWidth: gpsMap.clientWidth,
        clientHeight: gpsMap.clientHeight,
        scrollWidth: gpsMap.scrollWidth,
        scrollHeight: gpsMap.scrollHeight,
        boundingRect: gpsMap.getBoundingClientRect()
      } : null,
      mapProperties: this.map ? {
        center: this.map.getCenter(),
        zoom: this.map.getZoom(),
        size: this.map.getSize(),
        hasContainer: !!this.map.getContainer(),
        containerElement: this.map.getContainer()
      } : null,
      markersCount: Object.keys(this.markers || {}).length,
      currentPositionsCount: this.currentPositions?.length || 0,
      viewportSize: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight
      }
    });
    
    // Détecter si la carte semble "coupée"
    if (gpsMap && this.map) {
      const rect = gpsMap.getBoundingClientRect();
      const mapSize = this.map.getSize();
      
      const isPotentiallyCut = (
        rect.width < 200 || 
        rect.height < 200 || 
        mapSize.x < 200 || 
        mapSize.y < 200 ||
        rect.right > window.innerWidth ||
        rect.bottom > window.innerHeight
      );
      
      if (isPotentiallyCut) {
        console.warn('⚠️ CARTE POTENTIELLEMENT COUPÉE DÉTECTÉE!');
        console.warn('⚠️ Dimensions suspectes:', {
          rectWidth: rect.width,
          rectHeight: rect.height,
          mapSizeX: mapSize.x,
          mapSizeY: mapSize.y,
          rectRight: rect.right,
          rectBottom: rect.bottom,
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight
        });
        
        // Tentative de correction douce
        console.log('🔧 Tentative de correction douce...');
        
        setTimeout(() => {
          if (this.map) {
            this.map.invalidateSize();
            console.log('🔧 invalidateSize() appelé');
            
            // Vérification finale seulement si le problème persiste
            const finalHeight = document.getElementById('gps-map')?.offsetHeight;
            console.log('🔧 Hauteur finale après invalidateSize:', finalHeight);
            
            if (finalHeight < 200) {
              console.warn('⚠️ Hauteur encore trop petite après correction. Problème CSS détecté.');
              console.warn('ℹ️ Veuillez vérifier les styles CSS pour .gps-map-container');
            }
          }
        }, 100);
      }
    }
  }

  // Arrêter le rafraîchissement automatique
  static stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log('⏹️ Rafraîchissement automatique arrêté');
    }
  }

  // Forcer le redimensionnement de la carte
  static resizeMap() {
    if (this.map) {
      this.map.invalidateSize();
      console.log('🗺️ Carte redimensionnée manuellement');
    }
  }

  // Nettoyer les ressources
  static cleanup() {
    this.stopAutoRefresh();
    this.currentPositions = [];
    
    // Nettoyer la carte
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.markers = {};
      console.log('🗺️ Carte nettoyée');
    }
  }

  // Obtenir les détails d'un livreur
  static async showLivreurDetails(livreurId, livreurName) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const [locationResponse, distanceResponse] = await Promise.all([
        ApiClient.getGpsHistory(livreurId, today, today),
        ApiClient.calculateDistance(livreurId, today, today)
      ]);

      let content = `<h4>📍 Détails GPS - ${Utils.escapeHtml(livreurName)}</h4>`;

      if (distanceResponse.success) {
        const data = distanceResponse.data;
        content += `
          <div class="gps-details">
            <div class="detail-item">
              <strong>Distance parcourue aujourd'hui:</strong> ${data.distance_km} km
            </div>
            <div class="detail-item">
              <strong>Distance en mètres:</strong> ${data.distance_meters} m
            </div>
          </div>
        `;
      }

      if (locationResponse.success && locationResponse.data.length > 0) {
        content += `
          <div class="gps-history">
            <h5>Historique des positions (aujourd'hui)</h5>
            <div style="max-height: 200px; overflow-y: auto; font-size: 12px;">
        `;

        locationResponse.data.slice(0, 10).forEach(pos => {
          const time = new Date(pos.timestamp).toLocaleTimeString();
          content += `
            <div style="margin-bottom: 5px; padding: 5px; background: #f5f5f5; border-radius: 3px;">
              ${time} - Lat: ${pos.latitude.toFixed(6)}, Lng: ${pos.longitude.toFixed(6)}
              ${pos.accuracy ? ` (±${Math.round(pos.accuracy)}m)` : ''}
            </div>
          `;
        });

        content += `</div></div>`;
      }

      ModalManager.show(`Détails GPS - ${livreurName}`, content, { large: true });

    } catch (error) {
      console.error('❌ Erreur lors du chargement des détails:', error);
      ToastManager.error('Erreur lors du chargement des détails GPS');
    }
  }
  
  // ===== MÉTHODES POUR LE TRACÉ JOURNALIER =====
  
  // Charger la liste des livreurs disponibles
  static async loadAvailableLivreurs() {
    try {
      console.log('👥 Chargement des livreurs disponibles...');
      
      const response = await fetch(`${window.API_BASE_URL}/gps/available-livreurs`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        this.availableLivreurs = data.data;
        this.populateLivreurSelect();
        console.log(`✅ ${this.availableLivreurs.length} livreurs chargés`);
      } else {
        console.warn('⚠️ Aucun livreur trouvé');
        this.availableLivreurs = [];
      }
      
    } catch (error) {
      console.error('❌ Erreur lors du chargement des livreurs:', error);
      ToastManager.error('Erreur lors du chargement des livreurs');
      this.availableLivreurs = [];
    }
  }
  
  // Remplir le select des livreurs
  static populateLivreurSelect() {
    const select = document.getElementById('trace-livreur-select');
    if (!select) {
      console.error('❌ Element select "trace-livreur-select" non trouvé !');
      return;
    }
    
    // Vider les options existantes (sauf la première)
    while (select.children.length > 1) {
      select.removeChild(select.lastChild);
    }
    
    // Ajouter les livreurs
    this.availableLivreurs.forEach(livreur => {
      const option = document.createElement('option');
      option.value = livreur.id;
      option.textContent = `${livreur.username} - ${livreur.total_points} pts`;
      select.appendChild(option);
    });
    
    console.log(`📋 Dropdown rempli avec ${this.availableLivreurs.length} livreurs`);
  }
  
  // Gestionnaire de changement de livreur
  static onLivreurSelectionChange() {
    const select = document.getElementById('trace-livreur-select');
    const dateInput = document.getElementById('trace-date-input');
    const showBtn = document.getElementById('show-trace-btn');
    
    if (select && dateInput && showBtn) {
      const hasLivreur = select.value !== '';
      const hasDate = dateInput.value !== '';
      showBtn.disabled = !(hasLivreur && hasDate);
    }
  }
  
  // Gestionnaire de changement de date
  static onDateSelectionChange() {
    this.onLivreurSelectionChange(); // Même logique de validation
  }
  
  // Afficher le tracé journalier
  static async showTrace() {
    const livreurSelect = document.getElementById('trace-livreur-select');
    const dateInput = document.getElementById('trace-date-input');
    const showBtn = document.getElementById('show-trace-btn');
    const clearBtn = document.getElementById('clear-trace-btn');
    
    if (!livreurSelect.value || !dateInput.value) {
      ToastManager.error('Veuillez sélectionner un livreur et une date');
      return;
    }
    
    // Désactiver le bouton pendant le chargement
    showBtn.disabled = true;
    showBtn.innerHTML = '<span class="icon">⏳</span> Chargement...';
    
    try {
      console.log(`📍 Chargement du tracé pour livreur ${livreurSelect.value} le ${dateInput.value}`);
      
      const response = await fetch(
        `${window.API_BASE_URL}/gps/daily-trace/${livreurSelect.value}/${dateInput.value}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        if (data.data.points.length === 0) {
          ToastManager.info('Aucun point GPS trouvé pour cette date');
          this.hidTraceSummary();
        } else {
          this.displayTrace(data.data);
          ToastManager.success(`Tracé affiché: ${data.data.points.length} points`);
        }
      } else {
        throw new Error(data.message || 'Erreur lors du chargement du tracé');
      }
      
    } catch (error) {
      console.error('❌ Erreur lors du chargement du tracé:', error);
      ToastManager.error('Erreur lors du chargement du tracé');
      this.hidTraceSummary();
    } finally {
      // Restaurer le bouton
      showBtn.disabled = false;
      showBtn.innerHTML = '<span class="icon">📍</span> Afficher Tracé';
      clearBtn.disabled = false;
    }
  }
  
  // Afficher le tracé sur la carte
  static displayTrace(traceData) {
    if (!this.map || !traceData.points || traceData.points.length === 0) {
      return;
    }
    
    console.log(`🗺️ Affichage du tracé: ${traceData.points.length} points`);
    
    // Effacer le tracé précédent
    this.clearTrace();
    
    this.currentTrace = traceData;
    
    // Convertir les points en coordonnées Leaflet
    const latLngs = traceData.points.map(point => [
      parseFloat(point.latitude),
      parseFloat(point.longitude)
    ]);
    
    // Créer la polyline du tracé
    this.tracePolyline = L.polyline(latLngs, {
      color: '#3b82f6',
      weight: 4,
      opacity: 0.8,
      dashArray: '5, 10'
    }).addTo(this.map);
    
    // Ajouter marqueur de départ (vert)
    const startPoint = traceData.points[0];
    const startMarker = L.marker([parseFloat(startPoint.latitude), parseFloat(startPoint.longitude)], {
      icon: L.divIcon({
        html: '<div class="trace-start-marker">🏁</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        className: 'trace-marker'
      })
    }).addTo(this.map);
    
    startMarker.bindPopup(`
      <div>
        <strong>🏁 Départ</strong><br>
        <small>${new Date(startPoint.timestamp).toLocaleTimeString()}</small><br>
        <small>Précision: ${startPoint.accuracy}m</small>
      </div>
    `);
    
    this.traceMarkers.push(startMarker);
    
    // Ajouter marqueur d'arrivée (rouge) si différent du départ
    if (traceData.points.length > 1) {
      const endPoint = traceData.points[traceData.points.length - 1];
      const endMarker = L.marker([parseFloat(endPoint.latitude), parseFloat(endPoint.longitude)], {
        icon: L.divIcon({
          html: '<div class="trace-end-marker">🏁</div>',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          className: 'trace-marker'
        })
      }).addTo(this.map);
      
      endMarker.bindPopup(`
        <div>
          <strong>🏁 Arrivée</strong><br>
          <small>${new Date(endPoint.timestamp).toLocaleTimeString()}</small><br>
          <small>Précision: ${endPoint.accuracy}m</small>
        </div>
      `);
      
      this.traceMarkers.push(endMarker);
    }
    
    // Ajuster la vue de la carte pour inclure tout le tracé
    this.map.fitBounds(this.tracePolyline.getBounds(), { padding: [20, 20] });
    
    // Afficher le résumé
    this.displayTraceSummary(traceData.summary);
  }
  
  // Afficher le résumé du tracé
  static displayTraceSummary(summary) {
    const traceSummary = document.getElementById('trace-summary');
    if (!traceSummary || !summary) return;
    
    // Mettre à jour les valeurs
    document.getElementById('trace-distance').textContent = `${summary.total_distance_km} km`;
    document.getElementById('trace-duration').textContent = this.formatDuration(summary.duration_minutes);
    document.getElementById('trace-avg-speed').textContent = `${summary.average_speed_kmh} km/h`;
    document.getElementById('trace-points-count').textContent = summary.total_points;
    
    const timeRange = `${new Date(summary.start_time).toLocaleTimeString()} - ${new Date(summary.end_time).toLocaleTimeString()}`;
    document.getElementById('trace-time-range').textContent = timeRange;
    
    // Afficher le résumé
    traceSummary.style.display = 'block';
  }
  
  // Effacer le tracé
  static clearTrace() {
    console.log('🧹 Effacement du tracé');
    
    // Supprimer la polyline
    if (this.tracePolyline) {
      this.map.removeLayer(this.tracePolyline);
      this.tracePolyline = null;
    }
    
    // Supprimer les marqueurs de tracé
    this.traceMarkers.forEach(marker => {
      this.map.removeLayer(marker);
    });
    this.traceMarkers = [];
    
    // Réinitialiser les données
    this.currentTrace = null;
    
    // Masquer le résumé
    this.hidTraceSummary();
    
    // Désactiver le bouton effacer
    const clearBtn = document.getElementById('clear-trace-btn');
    if (clearBtn) {
      clearBtn.disabled = true;
    }
    
    ToastManager.info('Tracé effacé');
  }
  
  // Masquer le résumé du tracé
  static hidTraceSummary() {
    const traceSummary = document.getElementById('trace-summary');
    if (traceSummary) {
      traceSummary.style.display = 'none';
    }
  }
  
  // Formater la durée en heures et minutes
  static formatDuration(minutes) {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) {
      return `${hours}h`;
    }
    
    return `${hours}h ${remainingMinutes}min`;
  }
  
  // ===== MÉTHODES POUR LA CONFIGURATION DU TRACKING =====
  
  // Configurer les événements pour la configuration de tracking
  static setupTrackingConfigEventListeners() {
    console.log('⏰ Configuration des événements de config tracking');
    
    // Charger les configurations au démarrage
    this.loadAllTrackingConfigs();
    this.initializeConfigForm();
    
    // Event listener pour changement de livreur dans la config
    const configLivreurSelect = document.getElementById('config-livreur-select');
    if (configLivreurSelect) {
      configLivreurSelect.addEventListener('change', this.onConfigLivreurChange.bind(this));
    }
    
    // Event listeners pour les champs de configuration
    const startHourSelect = document.getElementById('tracking-start-hour');
    const endHourSelect = document.getElementById('tracking-end-hour');
    const trackingActiveCheckbox = document.getElementById('gps-tracking-active');
    
    if (startHourSelect) {
      startHourSelect.addEventListener('change', this.onConfigFieldChange.bind(this));
    }
    
    if (endHourSelect) {
      endHourSelect.addEventListener('change', this.onConfigFieldChange.bind(this));
    }
    
    if (trackingActiveCheckbox) {
      trackingActiveCheckbox.addEventListener('change', this.onConfigFieldChange.bind(this));
    }
    
    // Event listeners pour les jours de la semaine
    for (let day = 0; day <= 6; day++) {
      const dayCheckbox = document.getElementById(`day-${day}`);
      if (dayCheckbox) {
        dayCheckbox.addEventListener('change', this.onConfigFieldChange.bind(this));
      }
    }
    
    // Event listeners pour les boutons
    const saveConfigBtn = document.getElementById('save-config-btn');
    const resetConfigBtn = document.getElementById('reset-config-btn');
    
    if (saveConfigBtn) {
      saveConfigBtn.addEventListener('click', this.saveTrackingConfig.bind(this));
    }
    
    if (resetConfigBtn) {
      resetConfigBtn.addEventListener('click', this.resetTrackingConfig.bind(this));
    }
  }
  
  // Initialiser le formulaire de configuration
  static initializeConfigForm() {
    // Remplir les options d'heures (0-23)
    const startHourSelect = document.getElementById('tracking-start-hour');
    const endHourSelect = document.getElementById('tracking-end-hour');
    
    if (startHourSelect && endHourSelect) {
      for (let hour = 0; hour < 24; hour++) {
        const startOption = document.createElement('option');
        startOption.value = hour;
        startOption.textContent = `${hour.toString().padStart(2, '0')}:00`;
        startHourSelect.appendChild(startOption);
        
        const endOption = document.createElement('option');
        endOption.value = hour;
        endOption.textContent = `${hour.toString().padStart(2, '0')}:00`;
        endHourSelect.appendChild(endOption);
      }
    }
  }
  
  // Charger toutes les configurations de tracking
  static async loadAllTrackingConfigs() {
    try {
      console.log('⏰ Chargement des configurations de tracking...');
      
      const response = await fetch(`${window.API_BASE_URL}/gps/tracking-configs`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📡 Réponse tracking-configs:', response.status, response.statusText);
      
      if (!response.ok) {
        if (response.status === 403) {
          this.showConfigPermissionError();
          return;
        }
        const errorData = await response.json().catch(() => null);
        console.error('❌ Erreur API:', response.status, errorData);
        throw new Error(`Erreur HTTP: ${response.status} - ${errorData?.message || response.statusText}`);
      }
      
      const data = await response.json();
      console.log('📊 Données tracking configs reçues:', data);
      
      if (data.success && data.data && data.data.length > 0) {
        this.trackingConfigs = data.data;
        this.populateConfigLivreurSelect();
        console.log(`✅ ${this.trackingConfigs.length} configurations chargées`);
      } else {
        console.warn('⚠️ Aucune configuration trouvée');
        this.trackingConfigs = [];
        this.showConfigNoDataMessage();
      }
      
    } catch (error) {
      console.error('❌ Erreur lors du chargement des configurations:', error);
      this.showConfigErrorMessage(error.message);
      this.trackingConfigs = [];
    }
  }
  
  // Remplir le select des livreurs pour la configuration
  static populateConfigLivreurSelect() {
    const select = document.getElementById('config-livreur-select');
    if (!select) return;
    
    // Vider les options existantes (sauf la première)
    while (select.children.length > 1) {
      select.removeChild(select.lastChild);
    }
    
    // Ajouter les livreurs
    this.trackingConfigs.forEach(config => {
      const option = document.createElement('option');
      option.value = config.id;
      
      // Afficher le statut de tracking
      const status = config.gps_tracking_active ? '🟢' : '🔴';
      const timeRange = `${config.tracking_start_hour}h-${config.tracking_end_hour}h`;
      
      option.textContent = `${status} ${config.username} (${timeRange})`;
      select.appendChild(option);
    });
    
    console.log(`📋 Dropdown config rempli avec ${this.trackingConfigs.length} livreurs`);
  }
  
  // Gestionnaire de changement de livreur dans la config
  static onConfigLivreurChange() {
    const select = document.getElementById('config-livreur-select');
    const configForm = document.getElementById('config-form');
    const configSummary = document.getElementById('config-summary');
    
    if (!select || !configForm || !configSummary) return;
    
    const livreurId = select.value;
    
    if (livreurId) {
      // Trouver la configuration du livreur sélectionné
      const config = this.trackingConfigs.find(c => c.id === livreurId);
      
      if (config) {
        this.currentConfigLivreur = config;
        this.loadConfigIntoForm(config);
        
        // Afficher le formulaire et masquer le résumé
        configForm.style.display = 'block';
        configSummary.style.display = 'none';
      }
    } else {
      // Masquer le formulaire et afficher le résumé
      configForm.style.display = 'none';
      configSummary.style.display = 'block';
      this.currentConfigLivreur = null;
    }
  }
  
  // Charger la configuration dans le formulaire
  static loadConfigIntoForm(config) {
    // Heures de début et fin
    const startHourSelect = document.getElementById('tracking-start-hour');
    const endHourSelect = document.getElementById('tracking-end-hour');
    const trackingActiveCheckbox = document.getElementById('gps-tracking-active');
    
    if (startHourSelect) startHourSelect.value = config.tracking_start_hour;
    if (endHourSelect) endHourSelect.value = config.tracking_end_hour;
    if (trackingActiveCheckbox) trackingActiveCheckbox.checked = config.gps_tracking_active;
    
    // Jours de la semaine
    for (let day = 0; day <= 6; day++) {
      const dayCheckbox = document.getElementById(`day-${day}`);
      if (dayCheckbox) {
        dayCheckbox.checked = config.tracking_enabled_days.includes(day);
      }
    }
    
    // Désactiver les boutons (aucun changement encore)
    this.setConfigButtonsState(false);
    
    console.log(`📋 Configuration chargée pour ${config.username}`);
  }
  
  // Gestionnaire de changement des champs de configuration
  static onConfigFieldChange() {
    // Activer les boutons de sauvegarde/reset
    this.setConfigButtonsState(true);
  }
  
  // Activer/désactiver les boutons de configuration
  static setConfigButtonsState(enabled) {
    const saveBtn = document.getElementById('save-config-btn');
    const resetBtn = document.getElementById('reset-config-btn');
    
    if (saveBtn) saveBtn.disabled = !enabled;
    if (resetBtn) resetBtn.disabled = !enabled;
  }
  
  // Sauvegarder la configuration de tracking
  static async saveTrackingConfig() {
    if (!this.currentConfigLivreur) return;
    
    const saveBtn = document.getElementById('save-config-btn');
    
    // Désactiver le bouton pendant la sauvegarde
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="icon">⏳</span> Sauvegarde...';
    }
    
    try {
      // Récupérer les valeurs du formulaire
      const configData = this.getConfigFromForm();
      
      console.log('💾 Sauvegarde de la configuration:', configData);
      
      const response = await fetch(
        `${window.API_BASE_URL}/gps/tracking-config/${this.currentConfigLivreur.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(configData)
        }
      );
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Mettre à jour la configuration locale
        const configIndex = this.trackingConfigs.findIndex(c => c.id === this.currentConfigLivreur.id);
        if (configIndex !== -1) {
          this.trackingConfigs[configIndex] = data.data;
          this.currentConfigLivreur = data.data;
        }
        
        // Mettre à jour le dropdown
        this.populateConfigLivreurSelect();
        
        // Désactiver les boutons
        this.setConfigButtonsState(false);
        
        ToastManager.success('Configuration sauvegardée avec succès');
        console.log('✅ Configuration sauvegardée');
      } else {
        throw new Error(data.message || 'Erreur lors de la sauvegarde');
      }
      
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
      ToastManager.error('Erreur lors de la sauvegarde: ' + error.message);
    } finally {
      // Restaurer le bouton
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span class="icon">💾</span> Sauvegarder';
      }
    }
  }
  
  // Réinitialiser la configuration
  static resetTrackingConfig() {
    if (!this.currentConfigLivreur) return;
    
    console.log('🔄 Réinitialisation de la configuration');
    
    // Recharger la configuration originale dans le formulaire
    this.loadConfigIntoForm(this.currentConfigLivreur);
    
    ToastManager.info('Configuration réinitialisée');
  }
  
  // Récupérer la configuration depuis le formulaire
  static getConfigFromForm() {
    const startHourSelect = document.getElementById('tracking-start-hour');
    const endHourSelect = document.getElementById('tracking-end-hour');
    const trackingActiveCheckbox = document.getElementById('gps-tracking-active');
    
    // Récupérer les jours sélectionnés
    const enabledDays = [];
    for (let day = 0; day <= 6; day++) {
      const dayCheckbox = document.getElementById(`day-${day}`);
      if (dayCheckbox && dayCheckbox.checked) {
        enabledDays.push(day);
      }
    }
    
    return {
      tracking_start_hour: parseInt(startHourSelect.value),
      tracking_end_hour: parseInt(endHourSelect.value),
      tracking_enabled_days: enabledDays,
      gps_tracking_active: trackingActiveCheckbox.checked
    };
  }

  // Afficher un message d'erreur de permissions
  static showConfigPermissionError() {
    const summaryElement = document.getElementById('config-summary');
    if (summaryElement) {
      summaryElement.innerHTML = `
        <div style="color: #e74c3c; text-align: center; padding: 20px;">
          <i class="fas fa-lock" style="font-size: 24px; margin-bottom: 10px;"></i>
          <h4>Accès non autorisé</h4>
          <p>Vous devez être <strong>Manager</strong> ou <strong>Administrateur</strong> pour configurer les heures de tracking GPS.</p>
          <p style="font-size: 14px; color: #7f8c8d;">Contactez votre administrateur pour obtenir les permissions nécessaires.</p>
        </div>
      `;
    }
  }

  // Afficher un message quand aucune donnée n'est trouvée
  static showConfigNoDataMessage() {
    const summaryElement = document.getElementById('config-summary');
    if (summaryElement) {
      summaryElement.innerHTML = `
        <div style="color: #f39c12; text-align: center; padding: 20px;">
          <i class="fas fa-exclamation-triangle" style="font-size: 24px; margin-bottom: 10px;"></i>
          <h4>Aucun livreur trouvé</h4>
          <p>Aucune configuration de tracking n'a été trouvée.</p>
          <p style="font-size: 14px; color: #7f8c8d;">Vérifiez qu'il existe des livreurs dans le système.</p>
        </div>
      `;
    }
  }

  // Afficher un message d'erreur générique
  static showConfigErrorMessage(errorMessage) {
    const summaryElement = document.getElementById('config-summary');
    if (summaryElement) {
      summaryElement.innerHTML = `
        <div style="color: #e74c3c; text-align: center; padding: 20px;">
          <i class="fas fa-exclamation-circle" style="font-size: 24px; margin-bottom: 10px;"></i>
          <h4>Erreur de chargement</h4>
          <p>Impossible de charger les configurations de tracking.</p>
          <p style="font-size: 14px; color: #7f8c8d;">${errorMessage}</p>
        </div>
      `;
    }
    ToastManager.error('Erreur lors du chargement des configurations');
  }
}

// Ajouter à PageManager pour gérer la page GPS tracking
if (typeof PageManager !== 'undefined') {
  const originalLoadPageData = PageManager.loadPageData;
  
  PageManager.loadPageData = async function(pageId) {
    if (pageId === 'gps-tracking') {
      await GpsTrackingManager.init();
      return;
    }
    
    // Nettoyer si on quitte la page GPS
    if (PageManager.currentPage === 'gps-tracking' && pageId !== 'gps-tracking') {
      GpsTrackingManager.cleanup();
    }
    
    return originalLoadPageData.call(this, pageId);
  };
} 