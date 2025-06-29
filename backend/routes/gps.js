const express = require('express');
const router = express.Router();

const GpsController = require('../controllers/gpsController');
const { 
  authenticateToken, 
  requireManagerOrAdmin, 
  requireAdmin 
} = require('../middleware/auth');
const { 
  validateUUID,
  sanitizeInput 
} = require('../middleware/validation');

// Middleware d'authentification pour toutes les routes
router.use(authenticateToken);

// ===== ROUTES POUR LES LIVREURS =====

// Enregistrer une position GPS (livreurs seulement)
router.post('/location', 
  sanitizeInput,
  GpsController.recordLocation
);

// Activer/désactiver le suivi GPS (livreurs seulement)
router.post('/toggle-tracking', 
  sanitizeInput,
  GpsController.toggleTracking
);

// Obtenir ses propres paramètres GPS (livreurs)
router.get('/settings', 
  GpsController.getSettings
);

// Mettre à jour l'intervalle de suivi (livreurs seulement)
router.put('/interval', 
  sanitizeInput,
  GpsController.updateInterval
);

// Obtenir son propre historique (livreurs)
router.get('/history/:livreurId', 
  validateUUID,
  GpsController.getLocationHistory
);

// ===== ROUTES POUR MANAGERS ET ADMINS =====

// Obtenir toutes les dernières positions des livreurs
router.get('/locations', 
  requireManagerOrAdmin,
  GpsController.getAllLatestPositions
);

// Obtenir la dernière position d'un livreur spécifique
router.get('/location/:livreurId', 
  requireManagerOrAdmin,
  validateUUID,
  GpsController.getLocationByLivreur
);

// Calculer la distance parcourue par un livreur
router.get('/distance/:livreurId', 
  requireManagerOrAdmin,
  validateUUID,
  GpsController.calculateDistance
);

// Obtenir les paramètres GPS d'un livreur spécifique
router.get('/settings/:livreurId', 
  requireManagerOrAdmin,
  validateUUID,
  GpsController.getSettings
);

// Obtenir les livreurs hors ligne
router.get('/offline', 
  requireManagerOrAdmin,
  GpsController.getOfflineLivreurs
);

// Obtenir les statistiques GPS générales
router.get('/stats', 
  requireManagerOrAdmin,
  GpsController.getStats
);

// ===== ROUTES POUR ADMINS SEULEMENT =====

// Supprimer l'historique GPS d'un livreur
router.delete('/history/:livreurId', 
  requireAdmin,
  validateUUID,
  GpsController.deleteHistory
);

// Nettoyer les anciennes données GPS (> 30 jours)
router.post('/cleanup', 
  requireAdmin,
  GpsController.cleanupOldData
);

module.exports = router; 