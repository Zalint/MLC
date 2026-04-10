const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') }); // Path to root .env

// Log loaded environment variables for debugging (can be removed once stable)
console.log('--- CHECKING Environment Variables ---');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('BACKEND_PORT:', process.env.BACKEND_PORT);
console.log('JWT_SECRET is set:', !!process.env.JWT_SECRET);
console.log('----------------------------------');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const orderRoutes = require('./routes/orders');
const expenseRoutes = require('./routes/expenses');
const subscriptionRoutes = require('./routes/subscriptions');
const mataAnalyticsRoutes = require('./routes/analytics');
const gpsAnalyticsRoutes = require('./routes/gpsAnalytics');
const salariesRoutes = require('./routes/salaries');
const externalRoutes = require('./routes/external');
const gpsRoutes = require('./routes/gps');
const attachmentRoutes = require('./routes/attachments');
const auditRoutes = require('./routes/audit');
const commandesEnCoursRoutes = require('./routes/commandesEnCours');
const clientCreditsRoutes = require('./routes/clientCredits');
const timesheetRoutes = require('./routes/timesheets');
const versementsRoutes = require('./routes/versements');
const mlcZonesRoutes = require('./routes/mlcZones');

const app = express();
const PORT = process.env.BACKEND_PORT || 4000; 

// Middleware de sécurité
app.use(helmet());

// Configuration CORS
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In production, allow Render URLs and localhost for development
    const allowedOrigins = [
      `http://localhost:${process.env.FRONTEND_PORT || 3000}`,
      `https://localhost:${process.env.FRONTEND_PORT || 3000}`,
      `http://192.168.1.184:${process.env.FRONTEND_PORT || 3000}`, // Local network access
      process.env.FRONTEND_URL, // Render frontend URL
      'https://matix-livreur-frontend.onrender.com', // Your specific frontend URL
      /\.onrender\.com$/ // Any Render subdomain
    ].filter(Boolean);
    
    // Check if origin is allowed
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return origin === allowed;
      } else if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie']
};

app.use(cors(corsOptions));

// Rate limiting - Configuration plus permissive pour l'usage normal
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // Augmenté à 1000 requêtes par 15 min
  message: {
    error: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Exclure certaines routes du rate limiting pour l'usage interne
  skip: (req) => {
    // Ne pas limiter les requêtes de santé, d'authentification et d'attachments
    return req.path.includes('/health') || 
           req.path.includes('/auth/check') ||
           req.path.includes('/attachments');
  }
});

app.use(limiter);

// Middleware de parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes API
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/expenses', expenseRoutes);
app.use('/api/v1/subscriptions', subscriptionRoutes);
app.use('/api/v1/mata-analytics', mataAnalyticsRoutes);
app.use('/api/v1/analytics/gps', gpsAnalyticsRoutes);
app.use('/api/v1/salaries', salariesRoutes);
app.use('/api/v1/gps', gpsRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/clients', clientCreditsRoutes);
app.use('/api/v1/timesheets', timesheetRoutes);
app.use('/api/v1/versements', versementsRoutes);
app.use('/api/v1/mlc-zones', mlcZonesRoutes);
app.use('/api/v1', attachmentRoutes);
app.use('/api/external', externalRoutes);
// Routes pour les commandes en cours (externe et interne)
app.use('/api', commandesEnCoursRoutes);

// Route config : types de commandes (public, lu depuis order-types.json)
app.get('/api/v1/config/order-types', (req, res) => {
  try {
    const config = require('./config/order-types.json');
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Impossible de charger la configuration des types de commandes' });
  }
});

// Route config : modes de versement (lu depuis versement-modes.json)
app.get('/api/v1/config/versement-modes', (req, res) => {
  try {
    // Vider le cache pour permettre les modifications à chaud
    delete require.cache[require.resolve('./config/versement-modes.json')];
    const config = require('./config/versement-modes.json');
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Impossible de charger la configuration des modes de paiement' });
  }
});

// Route de santé
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Matix Livreur API',
    version: '1.0.0'
  });
});

// Route de santé alternative
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Matix Livreur API',
    version: '1.0.0'
  });
});

// Middleware de gestion d'erreurs
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Données invalides',
      details: err.message
    });
  }
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Token invalide'
    });
  }
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Erreur interne du serveur' 
      : err.message
  });
});

// Route 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route non trouvée',
    path: req.originalUrl
  });
});

// Auto-migrations au démarrage
async function runStartupMigrations() {
  const db = require('./models/database');
  try {
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_order_types JSONB DEFAULT NULL`);
    console.log('✅ Migration: allowed_order_types OK');
  } catch (err) {
    console.error('⚠️ Migration allowed_order_types:', err.message);
  }

  // Table mlc_zones
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS mlc_zones (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        label VARCHAR(200) NOT NULL,
        price INTEGER,
        is_custom_price BOOLEAN DEFAULT false,
        description TEXT,
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // Seed si la table est vide
    const { rows } = await db.query('SELECT COUNT(*) FROM mlc_zones');
    if (parseInt(rows[0].count) === 0) {
      await db.query(`
        INSERT INTO mlc_zones (name, label, price, is_custom_price, description, sort_order) VALUES
        ('Zone 1', 'Dakar', 1000, false, 'Sacré-Cœur, Sicap, Almadies, Yoff, Point E, Fann, Mermoz, etc.', 1),
        ('Zone 2', 'Proche', 1750, false, 'Parcelles, Guédiawaye, Pikine, Grand Yoff, HLM, etc.', 2),
        ('Zone 3', 'Banlieue', 2500, false, 'Keur Massar, Rufisque, Mbao, Sangalkam, Bargny, etc.', 3),
        ('Zone 4', 'Autre', NULL, true, 'Pour les destinations non couvertes par les zones 1, 2 et 3. Veuillez saisir le prix manuellement.', 4)
      `);
      console.log('✅ Migration: mlc_zones seeded');
    }
    console.log('✅ Migration: mlc_zones OK');
  } catch (err) {
    console.error('⚠️ Migration mlc_zones:', err.message);
  }
}

// Démarrage du serveur
runStartupMigrations().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Serveur API démarré sur le port ${PORT}`);
    console.log(`📊 Environnement: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 URL locale: http://localhost:${PORT}`);
    console.log(`🔗 URL réseau: http://192.168.1.184:${PORT}`);
  });
});

module.exports = app; 