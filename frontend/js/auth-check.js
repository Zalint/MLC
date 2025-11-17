// Vérification de l'authentification pour les pages protégées

(async function() {
  // Définir API_BASE_URL si pas déjà défini
  if (!window.API_BASE_URL) {
    const isLocalHost = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1';
    window.API_BASE_URL = isLocalHost 
      ? 'http://localhost:4000/api/v1' 
      : 'https://matix-livreur-backend.onrender.com/api/v1';
  }

  // Vérifier si l'utilisateur a un token
  const token = localStorage.getItem('token');

  if (!token) {
    // Pas de token, rediriger vers la page de login
    console.warn('⚠️ Pas de token, redirection vers login');
    window.location.href = 'login.html';
    return;
  }

  try {
    // Vérifier le token auprès du backend
    const response = await fetch(`${window.API_BASE_URL}/auth/check`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Token invalide');
    }

    const data = await response.json();
    
    if (!data.authenticated || !data.user) {
      throw new Error('Authentification échouée');
    }

    // Stocker l'utilisateur dans localStorage pour un accès facile
    localStorage.setItem('user', JSON.stringify(data.user));

    console.log('✅ Utilisateur authentifié:', data.user.username, '-', data.user.role);
  } catch (error) {
    console.error('❌ Erreur lors de la vérification de l\'authentification:', error);
    localStorage.clear();
    window.location.href = 'login.html';
  }
})();

