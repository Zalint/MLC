// Test simple pour vérifier l'import du module external
console.log('Test de l\'import du module external...');

try {
  const externalRoutes = require('./backend/routes/external');
  console.log('✅ Import du module external réussi');
  console.log('Type du module:', typeof externalRoutes);
} catch (error) {
  console.error('❌ Erreur d\'import du module external:', error.message);
}

// Test de la connexion à la base de données
console.log('\nTest de la connexion à la base de données...');
try {
  const db = require('./backend/models/database');
  console.log('✅ Import du module database réussi');
} catch (error) {
  console.error('❌ Erreur d\'import du module database:', error.message);
}

console.log('\nTest terminé.');

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/external/mlc/livreurStats/daily?seuilMataPanier=5000',
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
      console.log('Réponse JSON complète:');
      console.log(JSON.stringify(jsonData, null, 2));
    } catch (error) {
      console.log('❌ Erreur de parsing JSON:', error.message);
      console.log('Raw data:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Erreur de requête:', error.message);
});

req.end(); 