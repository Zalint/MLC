// Test des routes de production
const axios = require('axios');

const PROD_BASE_URL = 'https://matix-livreur-backend.onrender.com';

async function testProductionRoutes() {
  try {
    console.log('🌐 Test des routes de production...\n');
    
    // Test 1: Route de santé
    console.log('1️⃣ Test route de santé...');
    try {
      const healthResponse = await axios.get(`${PROD_BASE_URL}/api/v1/health`);
      console.log('✅ Health check:', healthResponse.status, healthResponse.data);
    } catch (error) {
      console.log('❌ Health check failed:', error.response?.status, error.response?.data);
    }
    
    // Test 2: Connexion pour obtenir un token
    console.log('\n2️⃣ Test connexion...');
    let token = null;
    try {
      const loginResponse = await axios.post(`${PROD_BASE_URL}/api/v1/auth/login`, {
        username: 'admin',
        password: 'bonea2024'
      });
      
      if (loginResponse.data.success) {
        token = loginResponse.data.token;
        console.log('✅ Connexion réussie, token obtenu');
      } else {
        console.log('❌ Connexion échouée:', loginResponse.data);
      }
    } catch (error) {
      console.log('❌ Erreur connexion:', error.response?.status, error.response?.data);
    }
    
    if (!token) {
      console.log('\n⚠️ Impossible de tester les routes protégées sans token');
      return;
    }
    
    // Test 3: Route GPS stats (existant)
    console.log('\n3️⃣ Test route GPS stats (existant)...');
    try {
      const statsResponse = await axios.get(`${PROD_BASE_URL}/api/v1/gps/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('✅ GPS stats:', statsResponse.status, 'Données reçues');
    } catch (error) {
      console.log('❌ GPS stats failed:', error.response?.status, error.response?.data);
    }
    
    // Test 4: Route tracking-configs (NOUVELLE)
    console.log('\n4️⃣ Test route tracking-configs (NOUVELLE)...');
    try {
      const configsResponse = await axios.get(`${PROD_BASE_URL}/api/v1/gps/tracking-configs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('✅ Tracking configs:', configsResponse.status);
      if (configsResponse.data.success) {
        console.log(`   📊 ${configsResponse.data.data.length} configurations trouvées`);
      }
    } catch (error) {
      console.log('❌ Tracking configs failed:', error.response?.status, error.response?.data);
    }
    
    // Test 5: Route available-livreurs (NOUVELLE)
    console.log('\n5️⃣ Test route available-livreurs (NOUVELLE)...');
    try {
      const livreursResponse = await axios.get(`${PROD_BASE_URL}/api/v1/gps/available-livreurs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('✅ Available livreurs:', livreursResponse.status);
      if (livreursResponse.data.success) {
        console.log(`   👥 ${livreursResponse.data.data.length} livreurs trouvés`);
      }
    } catch (error) {
      console.log('❌ Available livreurs failed:', error.response?.status, error.response?.data);
    }
    
    // Test 6: Route daily-trace (NOUVELLE)
    console.log('\n6️⃣ Test route daily-trace (NOUVELLE)...');
    try {
      const traceResponse = await axios.get(`${PROD_BASE_URL}/api/v1/gps/daily-trace/admin/2025-01-18`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('✅ Daily trace:', traceResponse.status);
    } catch (error) {
      console.log('❌ Daily trace failed:', error.response?.status, error.response?.data);
    }
    
    console.log('\n🎯 Résumé des tests:');
    console.log('- Si les routes 4, 5, 6 échouent avec 404, le déploiement n\'est pas complet');
    console.log('- Si elles fonctionnent, le problème vient du frontend');
    
  } catch (error) {
    console.error('❌ Erreur générale:', error.message);
  }
}

testProductionRoutes(); 