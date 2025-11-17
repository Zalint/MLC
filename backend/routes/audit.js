const express = require('express');
const router = express.Router();

const AuditController = require('../controllers/auditController');
const { 
  authenticateToken, 
  requireManagerOrAdmin 
} = require('../middleware/auth');
const { sanitizeInput } = require('../middleware/validation');

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// ===== ROUTES POUR TOUS LES UTILISATEURS AUTHENTIFIÉS =====

// Enregistrer l'ouverture d'un historique client
router.post('/client-history/open',
  sanitizeInput,
  AuditController.openClientHistory
);

// Enregistrer la fermeture d'un historique client
router.put('/client-history/:log_id/close',
  sanitizeInput,
  AuditController.closeClientHistory
);

// ===== ROUTES POUR MANAGERS ET ADMINS UNIQUEMENT =====

// Récupérer tous les logs d'audit
router.get('/client-history/logs',
  requireManagerOrAdmin,
  AuditController.getClientHistoryLogs
);

// Récupérer les statistiques d'audit
router.get('/client-history/stats',
  requireManagerOrAdmin,
  AuditController.getClientHistoryStats
);

module.exports = router;

