const { Pool } = require('pg');
require('dotenv').config();

// Configuration de la connexion PostgreSQL
let poolConfig;

if (process.env.DATABASE_URL) {
  // Use connection string (common for Render)
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
} else {
  // Use individual parameters
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'matix_livreur',
    user: process.env.DB_USER || 'matix_user',
    password: process.env.DB_PASSWORD || 'mlc2024',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    // SSL configuration for production (Render)
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false
  };
}

const pool = new Pool(poolConfig);

// Test de connexion
pool.on('connect', () => {
  console.log('✅ Connexion à PostgreSQL établie');
});

pool.on('error', (err) => {
  console.error('❌ Erreur de connexion PostgreSQL:', err);
  process.exit(-1);
});

// Fonction utilitaire pour exécuter des requêtes
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('📊 Requête exécutée:', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('❌ Erreur de requête:', { text, error: error.message });
    throw error;
  }
};

// Fonction pour obtenir un client du pool (pour les transactions)
const getClient = async () => {
  return await pool.connect();
};

module.exports = {
  query,
  getClient,
  pool
}; 