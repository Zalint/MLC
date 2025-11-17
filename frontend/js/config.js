// Configuration de l'application
window.API_BASE_URL = 'http://localhost:4000/api/v1';

// Déterminer automatiquement l'URL de l'API selon l'environnement
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  // En production, utiliser l'URL de production
  window.API_BASE_URL = 'https://matix-livreur-backend.onrender.com/api/v1';
}

console.log('📡 API Base URL:', window.API_BASE_URL);

