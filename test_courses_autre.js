const http = require('http');

console.log('🧪 Test du nouveau nœud COURSES AUTRE');
console.log('═'.repeat(60));

const testEndpoint = (path, description) => {
  console.log(`\n📍 ${description}`);
  console.log(`🔗 URL: ${path}`);
  console.log('─'.repeat(40));
  
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
          
          // Vérifier le nœud courses_autre dans summary
          if (jsonData.summary.courses_autre) {
            console.log('✅ courses_autre trouvé dans summary:');
            console.log(`   📊 Nombre: ${jsonData.summary.courses_autre.nombre}`);
            console.log(`   💰 Prix total: ${jsonData.summary.courses_autre.prix_total} FCFA`);
          } else {
            console.log('❌ courses_autre MANQUANT dans summary');
          }
          
          // Vérifier le nœud courses_autre pour le premier livreur
          if (jsonData.details.length > 0) {
            const firstLivreur = jsonData.details[0];
            console.log(`\n👤 Premier livreur: ${firstLivreur.livreur_nom}`);
            
            if (firstLivreur.courses_autre) {
              console.log('✅ courses_autre trouvé pour le livreur:');
              console.log(`   📊 Nombre: ${firstLivreur.courses_autre.nombre}`);
              console.log(`   💰 Prix total: ${firstLivreur.courses_autre.prix_total} FCFA`);
            } else {
              console.log('❌ courses_autre MANQUANT pour le livreur');
            }
          }
          
          console.log(`\n📈 Structure complète courses_autre:`);
          console.log(`   Summary: ${JSON.stringify(jsonData.summary.courses_autre)}`);
          if (jsonData.details.length > 0) {
            console.log(`   Livreur: ${JSON.stringify(jsonData.details[0].courses_autre)}`);
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

// Tests
setTimeout(() => {
  testEndpoint('/api/external/mlc/livreurStats/daily', 'Test 1: Paramètres par défaut');
}, 1000);

setTimeout(() => {
  testEndpoint('/api/external/mlc/livreurStats/daily?date=2025-06-05&seuilMata=20000&seuilMlc=1750&seuilMataPanier=10000', 'Test 2: URL complète avec tous les paramètres');
}, 3000);

setTimeout(() => {
  console.log('\n🎯 Tests terminés ! Le nœud courses_autre a été ajouté avec succès.');
  console.log('📋 Structure:');
  console.log('   courses_autre: {');
  console.log('     nombre: <nombre_de_courses_AUTRE>');
  console.log('     prix_total: <prix_total_des_courses_AUTRE>');
  console.log('   }');
}, 5000); 