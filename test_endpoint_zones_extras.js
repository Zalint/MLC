const http = require('http');

const testEndpoint = (path, description) => {
  console.log(`\n🧪 ${description}`);
  console.log(`📍 URL: ${path}`);
  console.log('─'.repeat(60));
  
  const options = {
    hostname: 'localhost',
    port: 4000,
    path: path,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('Status Code:', res.statusCode);
      
      try {
        const jsonData = JSON.parse(data);
        
        if (res.statusCode === 200) {
          console.log('✅ Succès !');
          console.log('📅 Date:', jsonData.date);
          console.log('🎯 Seuil MATA:', jsonData.seuil_mata);
          console.log('🚚 Seuil MLC:', jsonData.seuil_mlc);
          console.log('📊 Total courses:', jsonData.summary.total_courses);
          
          // Détails MLC avec abonnement
          console.log('🎫 MLC avec abonnement:');
          console.log('  📋 Total:', jsonData.summary.courses_mlc.avec_abonnement.total);
          console.log('  ⭐ Extras:', jsonData.summary.courses_mlc.avec_abonnement.nombre_extras);
          
          // Détails MLC sans abonnement par zone
          console.log('🗺️  MLC sans abonnement:');
          console.log('  📋 Total:', jsonData.summary.courses_mlc.sans_abonnement.total);
          console.log('  🏘️  Zone 1 (1750):', jsonData.summary.courses_mlc.sans_abonnement.par_zone.zone1_1750);
          console.log('  🏙️  Zone 2 (2000):', jsonData.summary.courses_mlc.sans_abonnement.par_zone.zone2_2000);
          console.log('  🏢 Zone 3 (3000):', jsonData.summary.courses_mlc.sans_abonnement.par_zone.zone3_3000);
          console.log('  🌟 Autre:', jsonData.summary.courses_mlc.sans_abonnement.par_zone.autre);
          
          console.log('👥 Nombre de livreurs:', jsonData.details.length);
          
          // Afficher quelques détails de livreurs si il y en a
          if (jsonData.details.length > 0) {
            console.log('\n📋 Premier livreur (exemple):');
            const firstLivreur = jsonData.details[0];
            console.log('  👤 Nom:', firstLivreur.livreur_nom);
            console.log('  🎫 MLC avec abonnement:', firstLivreur.courses_mlc.avec_abonnement.total, '(Extras:', firstLivreur.courses_mlc.avec_abonnement.nombre_extras + ')');
            console.log('  🗺️  MLC sans abonnement:');
            console.log('    📋 Total:', firstLivreur.courses_mlc.sans_abonnement.total);
            console.log('    🏘️  Zone 1:', firstLivreur.courses_mlc.sans_abonnement.par_zone.zone1_1750);
            console.log('    🏙️  Zone 2:', firstLivreur.courses_mlc.sans_abonnement.par_zone.zone2_2000);
            console.log('    🏢 Zone 3:', firstLivreur.courses_mlc.sans_abonnement.par_zone.zone3_3000);
            console.log('    🌟 Autre:', firstLivreur.courses_mlc.sans_abonnement.par_zone.autre);
          }
        } else {
          console.log('❌ Erreur !');
          console.log('Réponse:', JSON.stringify(jsonData, null, 2));
        }
      } catch (error) {
        console.log('❌ Erreur de parsing JSON:', error.message);
        console.log('Raw data:', data.substring(0, 500));
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Erreur de requête:', error.message);
  });

  req.end();
};

console.log('🚀 Tests des nouvelles fonctionnalités: Zones MLC et Extras');
console.log('═'.repeat(80));

// Test 1: Sans paramètres pour voir la structure de base
setTimeout(() => {
  testEndpoint('/api/external/mlc/livreurStats/daily', 'Test 1: Structure par défaut avec zones et extras');
}, 1000);

// Test 2: Avec une date spécifique où il pourrait y avoir des données
setTimeout(() => {
  testEndpoint('/api/external/mlc/livreurStats/daily?date=2024-12-01', 'Test 2: Date spécifique (vérification structure)');
}, 3000);

// Test 3: Avec une date récente
setTimeout(() => {
  testEndpoint('/api/external/mlc/livreurStats/daily?date=2024-12-30', 'Test 3: Date plus récente');
}, 5000);

// Test 4: Test complet avec tous les paramètres
setTimeout(() => {
  testEndpoint('/api/external/mlc/livreurStats/daily?date=2024-12-30&seuilMata=1500&seuilMlc=1750', 'Test 4: Paramètres complets');
}, 7000); 