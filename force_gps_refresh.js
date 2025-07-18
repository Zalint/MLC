// Script pour forcer le rafraîchissement des marqueurs GPS avec noms
// À copier-coller dans la console du navigateur (F12) sur la page GPS

console.log('🔄 === FORCE REFRESH GPS MARKERS ===');

// Fonction pour forcer le rafraîchissement
function forceGpsRefresh() {
    console.log('🔄 Démarrage du rafraîchissement forcé...');
    
    // Vérifier que le GPS Manager existe
    if (!window.GpsTrackingManager) {
        console.error('❌ GpsTrackingManager non trouvé');
        return;
    }
    
    // Simuler des données GPS avec Aliou
    const testData = [
        {
            livreur_id: "bad9467f-9dba-4b0f-909c-a65b589fc9b9",
            livreur_username: "Aliou",
            latitude: 14.7400,
            longitude: -17.4700,
            accuracy: 24.90,
            speed: 0,
            seconds_ago: 30,
            timestamp: new Date().toISOString(),
            is_active: true,
            battery_level: 85
        },
        {
            livreur_id: "test-id-2",
            livreur_username: "Moussa",
            latitude: 14.7450,
            longitude: -17.4750,
            accuracy: 20.5,
            speed: 25,
            seconds_ago: 45,
            timestamp: new Date().toISOString(),
            is_active: true,
            battery_level: 92
        }
    ];
    
    console.log('📍 Données de test:', testData);
    
    // Forcer la mise à jour de la carte
    try {
        window.GpsTrackingManager.updateMap(testData);
        console.log('✅ Carte mise à jour avec succès');
        console.log('👀 Vérifiez maintenant si vous voyez "Aliou" et "Moussa" sur la carte');
    } catch (error) {
        console.error('❌ Erreur lors de la mise à jour:', error);
    }
}

// Fonction pour vider et recréer les marqueurs
function clearAndRecreateMarkers() {
    console.log('🧹 Nettoyage et recréation des marqueurs...');
    
    if (window.GpsTrackingManager && window.GpsTrackingManager.map) {
        // Vider tous les marqueurs existants
        Object.values(window.GpsTrackingManager.markers || {}).forEach(marker => {
            window.GpsTrackingManager.map.removeLayer(marker);
        });
        window.GpsTrackingManager.markers = {};
        
        console.log('🧹 Marqueurs supprimés');
        
        // Recharger les données GPS réelles
        setTimeout(() => {
            console.log('🔄 Rechargement des données GPS...');
            window.GpsTrackingManager.loadGpsData();
        }, 1000);
    }
}

// Fonction pour créer un marqueur de test permanent
function createTestMarker() {
    console.log('🧪 Création d\'un marqueur de test permanent...');
    
    if (!window.GpsTrackingManager?.map || typeof L === 'undefined') {
        console.error('❌ Carte ou Leaflet non disponible');
        return;
    }
    
    // Créer un marqueur de test avec le nouveau format
    const testMarker = L.marker([14.7400, -17.4700], {
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
                    background: #22c55e !important; 
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
                ">🚚</div>
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
                ">ALIOU TEST</div>
            </div>`,
            iconSize: [120, 70],
            iconAnchor: [60, 65],
            popupAnchor: [0, -65],
            className: 'gps-marker-with-name'
        })
    });
    
    testMarker.addTo(window.GpsTrackingManager.map);
    
    // Stocker la référence pour pouvoir le supprimer
    window.testGpsMarker = testMarker;
    
    console.log('✅ Marqueur de test créé - vous devriez voir "ALIOU TEST"');
    console.log('💡 Pour le supprimer: window.GpsTrackingManager.map.removeLayer(window.testGpsMarker)');
}

// Interface utilisateur dans la console
console.log('🎮 === COMMANDES DISPONIBLES ===');
console.log('1. forceGpsRefresh() - Rafraîchir avec données de test');
console.log('2. clearAndRecreateMarkers() - Nettoyer et recharger');
console.log('3. createTestMarker() - Créer un marqueur de test permanent');
console.log('');
console.log('📝 Exemple d\'utilisation:');
console.log('   createTestMarker()');
console.log('');

// Exposer les fonctions globalement
window.forceGpsRefresh = forceGpsRefresh;
window.clearAndRecreateMarkers = clearAndRecreateMarkers;
window.createTestMarker = createTestMarker;

// Auto-exécution d'un test
console.log('🚀 Test automatique dans 2 secondes...');
setTimeout(() => {
    createTestMarker();
}, 2000); 