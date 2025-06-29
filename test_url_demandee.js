const http = require('http');

console.log('🧪 Test de l\'URL exacte demandée par l\'utilisateur');
console.log('═'.repeat(60));

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/external/mlc/livreurStats/daily?date=2025-06-05&seuilMata=20000&seuilMlc=1750&seuilMataPanier=10000',
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
        console.log('\n📋 Paramètres de la requête:');
        console.log('📅 Date:', jsonData.date);
        console.log('🎯 Seuil MATA (courses > seuil):', jsonData.seuil_mata);
        console.log('🚚 Seuil MLC (courses > seuil):', jsonData.seuil_mlc);
        console.log('🛒 Seuil MATA Panier (panier < seuil):', jsonData.seuil_mata_panier);
        
        console.log('\n📊 Summary Global:');
        console.log('📈 Total courses:', jsonData.summary.total_courses);
        console.log('🛒 MATA panier < 10000:', jsonData.summary.courses_mata.panier_inf_seuil);
        console.log('🏆 Nombre de livreurs classés:', jsonData.classement.length);
        
        console.log('\n👥 Aperçu des livreurs:');
        jsonData.details.slice(0, 3).forEach(livreur => {
          console.log(`🚚 ${livreur.livreur_nom}:`);
          console.log(`   💰 Revenus: ${livreur.revenus} FCFA`);
          console.log(`   💸 Dépenses: ${livreur.depenses.total} FCFA`);
          console.log(`   📈 Bénéfice: ${livreur.benefice} FCFA`);
          console.log(`   🛒 MATA panier < seuil: ${livreur.courses_mata.panier_inf_seuil}`);
        });
        
        if (jsonData.classement.length > 0) {
          console.log('\n🏆 Classement par bénéfice (Top 3):');
          jsonData.classement.slice(0, 3).forEach(livreur => {
            console.log(`${livreur.rang}. ${livreur.livreur_nom} - ${livreur.benefice} FCFA`);
          });
        }
        
        console.log('\n🎯 Test terminé avec succès !');
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