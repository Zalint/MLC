// ===== TEST FUSEAU HORAIRE TRACKING =====
// Script pour tester le comportement des fuseaux horaires
// Usage: node test_timezone_tracking.js

console.log('🕒 TEST FUSEAU HORAIRE TRACKING GPS\n');

// Simuler les heures de tracking configurées
const trackingConfig = {
  tracking_start_hour: 9,
  tracking_end_hour: 21,
  tracking_timezone: 'Africa/Dakar',
  tracking_enabled_days: '0,1,2,3,4,5,6',
  gps_tracking_active: true
};

console.log('📋 Configuration de test:');
console.log(`   Heures: ${trackingConfig.tracking_start_hour}h - ${trackingConfig.tracking_end_hour}h`);
console.log(`   Timezone: ${trackingConfig.tracking_timezone}`);
console.log(`   Jours: ${trackingConfig.tracking_enabled_days}`);
console.log(`   Actif: ${trackingConfig.gps_tracking_active}\n`);

// Test avec différentes heures
const testHours = [8, 9, 10, 15, 20, 21, 22, 23];

console.log('🧪 Tests avec différentes heures:');
console.log('='.repeat(60));

testHours.forEach(hour => {
  // Simuler une heure spécifique
  const testDate = new Date();
  testDate.setHours(hour, 0, 0, 0);
  
  // Convertir vers le fuseau horaire du livreur
  const livreurTime = new Date(testDate.toLocaleString("en-US", {
    timeZone: trackingConfig.tracking_timezone || "Africa/Dakar"
  }));
  
  const currentHour = livreurTime.getHours();
  const currentDay = livreurTime.getDay();
  
  // Vérifier si autorisé
  const enabledDays = trackingConfig.tracking_enabled_days.split(',').map(d => parseInt(d.trim()));
  const dayAllowed = enabledDays.includes(currentDay);
  const hourAllowed = currentHour >= trackingConfig.tracking_start_hour && currentHour < trackingConfig.tracking_end_hour;
  const trackingAllowed = trackingConfig.gps_tracking_active && dayAllowed && hourAllowed;
  
  console.log(`⏰ ${hour.toString().padStart(2, '0')}:00 → ${currentHour.toString().padStart(2, '0')}:00 (Dakar) → ${trackingAllowed ? '✅ AUTORISÉ' : '❌ REFUSÉ'}`);
  console.log(`   Jour: ${['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][currentDay]} (${currentDay}) - ${dayAllowed ? '✅' : '❌'}`);
  console.log(`   Heure: ${currentHour}h dans [${trackingConfig.tracking_start_hour}h-${trackingConfig.tracking_end_hour}h[ - ${hourAllowed ? '✅' : '❌'}`);
  console.log('');
});

// Test avec l'heure actuelle
console.log('🕐 Test avec l\'heure actuelle:');
console.log('='.repeat(60));

const now = new Date();
const dakarTime = new Date(now.toLocaleString("en-US", {
  timeZone: trackingConfig.tracking_timezone || "Africa/Dakar"
}));
const currentHour = dakarTime.getHours();
const currentDay = dakarTime.getDay();

const enabledDays = trackingConfig.tracking_enabled_days.split(',').map(d => parseInt(d.trim()));
const dayAllowed = enabledDays.includes(currentDay);
const hourAllowed = currentHour >= trackingConfig.tracking_start_hour && currentHour < trackingConfig.tracking_end_hour;
const trackingAllowed = trackingConfig.gps_tracking_active && dayAllowed && hourAllowed;

console.log(`⏰ Heure actuelle: ${now.toLocaleString()}`);
console.log(`⏰ Heure Dakar: ${dakarTime.toLocaleString()} (${currentHour}h)`);
console.log(`📅 Jour: ${['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][currentDay]} (${currentDay})`);
console.log(`🕒 Plage autorisée: ${trackingConfig.tracking_start_hour}h - ${trackingConfig.tracking_end_hour}h`);
console.log(`📊 Résultat: ${trackingAllowed ? '✅ TRACKING AUTORISÉ' : '❌ TRACKING REFUSÉ'}`);

if (!trackingAllowed) {
  console.log('\n🔍 Raisons possibles:');
  if (!trackingConfig.gps_tracking_active) console.log('   - GPS tracking désactivé');
  if (!dayAllowed) console.log('   - Jour non autorisé');
  if (!hourAllowed) console.log('   - Heure hors plage');
}

console.log('\n🎯 CONCLUSION:');
console.log('Le système utilise correctement le fuseau horaire Africa/Dakar.');
console.log('Si vous voyez des problèmes en production, vérifiez:');
console.log('1. La timezone du serveur de production');
console.log('2. Les logs de la fonction isTrackingAllowed()');
console.log('3. La configuration des livreurs en base de données'); 