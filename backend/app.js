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
const analyticsRoutes = require('./routes/analytics');
const salariesRoutes = require('./routes/salaries');
const externalRoutes = require('./routes/external');
const gpsRoutes = require('./routes/gps');

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
    // Ne pas limiter les requêtes de santé et d'authentification
    return req.path.includes('/health') || req.path.includes('/auth/check');
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
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/salaries', salariesRoutes);
app.use('/api/v1/gps', gpsRoutes);
app.use('/api/external', externalRoutes);

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

// Démarrage du serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur API démarré sur le port ${PORT}`);
  console.log(`📊 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 URL locale: http://localhost:${PORT}`);
  console.log(`🔗 URL réseau: http://192.168.1.184:${PORT}`);
});

module.exports = app; 