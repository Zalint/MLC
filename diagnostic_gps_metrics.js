// ===== DIAGNOSTIC GPS MÉTRIQUES =====
// Script pour analyser pourquoi les métriques sont faibles
// Usage: node diagnostic_gps_metrics.js

console.log('🔍 DIAGNOSTIC GPS MÉTRIQUES\n');

// Simuler l'analyse des données GPS
const diagnosticData = {
  date: '2025-07-19',
  livreurs: [
    {
      nom: 'Mane',
      distance: 4.04,
      temps: 639,
      vitesse_moy: 0.5,
      positions_attendues: 1278, // 639 min * 2 positions/min
      positions_reelles: 150, // Estimation basée sur vos données
      precision_gps: '100m filter',
      heures_actives: '9h-21h'
    },
    {
      nom: 'Aliou', 
      distance: 0.05,
      temps: 220,
      vitesse_moy: 0,
      positions_attendues: 440,
      positions_reelles: 50,
      precision_gps: '100m filter',
      heures_actives: '9h-21h'
    },
    {
      nom: 'Diaby',
      distance: 0.33,
      temps: 304,
      vitesse_moy: 1.9,
      positions_attendues: 608,
      positions_reelles: 80,
      precision_gps: '100m filter',
      heures_actives: '9h-21h'
    }
  ]
};

console.log('📊 ANALYSE DES MÉTRIQUES:');
console.log('='.repeat(60));

diagnosticData.livreurs.forEach(livreur => {
  console.log(`\n🚚 ${livreur.nom}:`);
  console.log(`   Distance: ${livreur.distance} km`);
  console.log(`   Temps: ${livreur.temps} min (${Math.floor(livreur.temps/60)}h${livreur.temps%60}min)`);
  console.log(`   Vitesse moyenne: ${livreur.vitesse_moy} km/h`);
  console.log(`   Positions attendues: ~${livreur.positions_attendues}`);
  console.log(`   Positions réelles: ~${livreur.positions_reelles}`);
  console.log(`   Taux de capture: ${Math.round(livreur.positions_reelles/livreur.positions_attendues*100)}%`);
});

console.log('\n🔍 POSSIBLES CAUSES:');
console.log('='.repeat(60));

console.log('1️⃣ FILTRE DE PRÉCISION GPS:');
console.log('   - Filtre 100m appliqué globalement');
console.log('   - Peut éliminer trop de positions valides');
console.log('   - Solution: Réduire à 200m ou 500m');

console.log('\n2️⃣ LIVREURS STATIONNAIRES:');
console.log('   - Peut-être qu\'ils restent à un point fixe');
console.log('   - Pas de déplacements significatifs');
console.log('   - Solution: Vérifier les positions GPS');

console.log('\n3️⃣ HEURES DE TRAVAIL:');
console.log('   - Tracking 9h-21h mais activité réelle différente');
console.log('   - Peut-être qu\'ils ne travaillent pas encore');
console.log('   - Solution: Vérifier les heures d\'activité réelles');

console.log('\n4️⃣ CONFIGURATION DU CALCUL:');
console.log('   - Seuil de distance minimum trop élevé');
console.log('   - Filtrage des arrêts trop agressif');
console.log('   - Solution: Ajuster les paramètres');

console.log('\n🛠️ ACTIONS RECOMMANDÉES:');
console.log('='.repeat(60));

console.log('1. Vérifier les positions GPS brutes (sans filtre)');
console.log('2. Analyser les heures d\'activité réelles');
console.log('3. Ajuster le filtre de précision GPS');
console.log('4. Vérifier la configuration des seuils de distance');
console.log('5. Comparer avec les données des jours précédents');

console.log('\n📋 REQUÊTES SQL DE DIAGNOSTIC:');
console.log('='.repeat(60));

console.log('-- Voir les positions GPS brutes du 19/07/2025');
console.log('SELECT livreur_id, COUNT(*) as positions,');
console.log('       MIN(timestamp) as debut, MAX(timestamp) as fin,');
console.log('       AVG(accuracy) as precision_moyenne');
console.log('FROM gps_locations');
console.log('WHERE DATE(timestamp) = \'2025-07-19\'');
console.log('GROUP BY livreur_id;');

console.log('\n-- Voir les heures d\'activité');
console.log('SELECT livreur_id,');
console.log('       EXTRACT(HOUR FROM timestamp) as heure,');
console.log('       COUNT(*) as positions');
console.log('FROM gps_locations');
console.log('WHERE DATE(timestamp) = \'2025-07-19\'');
console.log('GROUP BY livreur_id, EXTRACT(HOUR FROM timestamp)');
console.log('ORDER BY livreur_id, heure;');

console.log('\n🎯 CONCLUSION:');
console.log('Les métriques faibles peuvent être normales si les livreurs');
console.log('sont stationnaires ou si le filtre GPS est trop strict.');
console.log('Il faut analyser les données brutes pour comprendre.'); 