const express = require('express');
const path = require('path');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.FRONTEND_PORT || 3000;

// Middleware de sécurité
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", `http://localhost:${process.env.BACKEND_PORT || 4001}`],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname)));

// Route pour servir l'application principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Route catch-all pour les applications SPA (Single Page Application)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Middleware de gestion d'erreurs
app.use((err, req, res, next) => {
  console.error('Erreur serveur frontend:', err);
  res.status(500).send('Erreur interne du serveur');
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🌐 Serveur Frontend démarré sur le port ${PORT}`);
  console.log(`📱 URL: http://localhost:${PORT}`);
  console.log(`🔗 API Backend: http://localhost:${process.env.BACKEND_PORT || 4000}`);
});

module.exports = app; 