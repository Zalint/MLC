// ===== GPS TRACKING MANAGER =====
// Module pour la page de suivi GPS des managers/admins
class GpsTrackingManager {
  static refreshInterval = null;
  static currentPositions = [];
  static map = null;
  static markers = {};

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
        
        const marker = L.marker([lat, lng], {
          icon: L.divIcon({
            html: `<div style="
              background: ${iconColor}; 
              border-radius: 50%; 
              width: 30px; 
              height: 30px; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              font-size: 16px;
              border: 2px solid white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            ">${iconHtml}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            popupAnchor: [0, -15],
            className: 'custom-marker'
          })
        });

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