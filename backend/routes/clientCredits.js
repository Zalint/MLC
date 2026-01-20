const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const ClientCreditsController = require('../controllers/clientCreditsController');

/**
 * Routes pour la gestion des crédits clients MATA
 * Toutes les routes nécessitent une authentification JWT
 * Accessibles uniquement aux MANAGER et ADMIN
 */

// Middleware pour vérifier le rôle MANAGER ou ADMIN
const requireManagerOrAdmin = (req, res, next) => {
  if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'Accès non autorisé. Réservé aux managers et administrateurs.'
    });
  }
  next();
};

// GET /api/v1/clients/mata-list - Liste de tous les clients MATA avec noms alternatifs
router.get('/mata-list', authenticateToken, requireManagerOrAdmin, ClientCreditsController.getMataClientsList);

// POST /api/v1/clients/credits - Attribuer ou mettre à jour un crédit
router.post('/credits', authenticateToken, requireManagerOrAdmin, ClientCreditsController.setClientCredit);

// GET /api/v1/clients/credits/:phone_number - Récupérer le crédit d'un client
router.get('/credits/:phone_number', authenticateToken, requireManagerOrAdmin, ClientCreditsController.getClientCredit);

// DELETE /api/v1/clients/credits/:phone_number - Supprimer le crédit d'un client
router.delete('/credits/:phone_number', authenticateToken, requireManagerOrAdmin, ClientCreditsController.deleteClientCredit);

module.exports = router;

