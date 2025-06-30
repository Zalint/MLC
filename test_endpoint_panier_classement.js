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
          console.log('🛒 Seuil MATA Panier:', jsonData.seuil_mata_panier);
          console.log('📊 Total courses:', jsonData.summary.total_courses);
          
          // Détails MATA avec panier inférieur au seuil
          console.log('🛒 MATA Panier < Seuil:');
          console.log('  📋 Summary:', jsonData.summary.courses_mata.panier_inf_seuil);
          
          // Classement par bénéfice
          console.log('🏆 Classement par bénéfice:');
          if (jsonData.classement && jsonData.classement.length > 0) {
            console.log(`  📊 Nombre de livreurs classés: ${jsonData.classement.length}`);
            
            // Afficher le top 3
            const top3 = jsonData.classement.slice(0, 3);
            top3.forEach((livreur, index) => {
              const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
              console.log(`  ${medal} ${livreur.rang}. ${livreur.livreur_nom}`);
              console.log(`     💰 Revenus: ${livreur.revenus} FCFA`);
              console.log(`     💸 Dépenses: ${livreur.depenses_totales} FCFA`);
              console.log(`     📈 Bénéfice: ${livreur.benefice} FCFA`);
              console.log(`     🚚 Courses: ${livreur.total_courses}`);
            });
            
            // Afficher le dernier si plus de 3
            if (jsonData.classement.length > 3) {
              const dernier = jsonData.classement[jsonData.classement.length - 1];
              console.log(`  📉 Dernier: ${dernier.rang}. ${dernier.livreur_nom} (${dernier.benefice} FCFA)`);
            }
          } else {
            console.log('  ⚠️  Aucun livreur dans le classement');
          }
          
          // Détails d'un livreur pour vérification
          if (jsonData.details.length > 0) {
            console.log('\n👤 Premier livreur (détails):');
            const firstLivreur = jsonData.details[0];
            console.log('  🏷️  Nom:', firstLivreur.livreur_nom);
            console.log('  🛒 MATA panier < seuil:', firstLivreur.courses_mata.panier_inf_seuil);
            console.log('  💰 Revenus:', firstLivreur.revenus, 'FCFA');
            console.log('  💸 Dépenses totales:', firstLivreur.depenses.total, 'FCFA');
            console.log('  📈 Bénéfice:', firstLivreur.benefice, 'FCFA');
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

console.log('🚀 Tests du seuil MATA Panier et Classement par Bénéfice');
console.log('═'.repeat(80));

// Test 1: Paramètres par défaut
setTimeout(() => {
  testEndpoint('/api/external/mlc/livreurStats/daily', 'Test 1: Paramètres par défaut (seuilMataPanier=10000)');
}, 1000);

// Test 2: Avec seuil MATA panier personnalisé
setTimeout(() => {
  testEndpoint('/api/external/mlc/livreurStats/daily?seuilMataPanier=5000', 'Test 2: Seuil MATA panier = 5000 FCFA');
}, 3000);

// Test 3: Tous les paramètres comme demandé par l'utilisateur
setTimeout(() => {
  testEndpoint('/api/external/mlc/livreurStats/daily?date=2025-01-05&seuilMata=20000&seuilMlc=1750&seuilMataPanier=10000', 'Test 3: Paramètres complets comme demandé');
}, 5000);

// Test 4: Seuil MATA panier très élevé pour voir la différence
setTimeout(() => {
  testEndpoint('/api/external/mlc/livreurStats/daily?seuilMataPanier=50000', 'Test 4: Seuil MATA panier très élevé (50000)');
}, 7000);

// Test 5: Date récente pour avoir plus de chances d'avoir des données
setTimeout(() => {
  testEndpoint('/api/external/mlc/livreurStats/daily?date=2024-12-30&seuilMataPanier=8000', 'Test 5: Date récente avec seuil panier 8000');
}, 9000); 