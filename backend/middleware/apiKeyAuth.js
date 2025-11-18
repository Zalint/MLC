// Middleware pour valider la clé API externe

/**
 * Middleware pour valider la clé API externe via le header x-api-key
 */
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.EXTERNAL_API_KEY;

  if (!validApiKey) {
    console.error('⚠️ EXTERNAL_API_KEY non configurée dans .env');
    return res.status(500).json({
      success: false,
      error: 'Configuration serveur manquante'
    });
  }

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'x-api-key header manquant'
    });
  }

  if (apiKey !== validApiKey) {
    console.warn('⚠️ Tentative d\'accès avec clé API invalide:', apiKey.substring(0, 10) + '...');
    return res.status(403).json({
      success: false,
      error: 'Clé API invalide'
    });
  }

  console.log('✅ Clé API validée');
  next();
};

module.exports = {
  validateApiKey
};

