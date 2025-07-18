// Script de debug pour les marqueurs GPS
// À exécuter dans la console du navigateur (F12)

console.log('🔍 === DEBUG GPS MARKERS ===');

// 1. Vérifier si la carte existe
console.log('1. Carte GPS existe:', !!window.GpsTrackingManager?.map);
console.log('2. Marqueurs actuels:', window.GpsTrackingManager?.markers);

// 2. Vérifier les données GPS
console.log('3. Positions actuelles:', window.GpsTrackingManager?.currentPositions);

// 3. Vérifier si Leaflet est chargé
console.log('4. Leaflet disponible:', typeof L !== 'undefined');

// 4. Vérifier les erreurs dans la console
console.log('5. Vérifiez les erreurs JavaScript ci-dessus');

// 5. Tester manuellement un marqueur avec nom
if (typeof L !== 'undefined' && window.GpsTrackingManager?.map) {
    console.log('6. Test création marqueur manuel...');
    
    const testMarker = L.marker([14.7400, -17.4700], {
        icon: L.divIcon({
            html: `<div style="
                display: flex; 
                flex-direction: column; 
                align-items: center; 
                justify-content: center;
                z-index: 1000;
            ">
                <div style="
                    background: #22c55e; 
                    border-radius: 50%; 
                    width: 30px; 
                    height: 30px; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    font-size: 16px;
                    border: 2px solid white;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    margin-bottom: 2px;
                ">🚚</div>
                <div style="
                    background: rgba(255, 255, 255, 0.95); 
                    padding: 3px 8px; 
                    border-radius: 6px; 
                    font-size: 13px; 
                    font-weight: bold; 
                    color: #333; 
                    border: 1px solid #ccc;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    white-space: nowrap;
                    text-align: center;
                    z-index: 1001;
                    position: relative;
                ">TEST ALIOU</div>
            </div>`,
            iconSize: [100, 60],
            iconAnchor: [50, 55],
            popupAnchor: [0, -55],
            className: 'test-marker-with-label'
        })
    });
    
    testMarker.addTo(window.GpsTrackingManager.map);
    console.log('✅ Marqueur de test ajouté - voyez-vous "TEST ALIOU" ?');
    
    // Supprimer le marqueur de test après 10 secondes
    setTimeout(() => {
        window.GpsTrackingManager.map.removeLayer(testMarker);
        console.log('🗑️ Marqueur de test supprimé');
    }, 10000);
} else {
    console.log('❌ Impossible de créer un marqueur de test - carte ou Leaflet manquant');
} 