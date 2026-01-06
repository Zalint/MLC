const express = require('express');
const router = express.Router();
const { validateApiKey } = require('../middleware/apiKeyAuth');
const { authenticateToken } = require('../middleware/auth');
const commandeEnCoursController = require('../controllers/commandeEnCoursController');

/**
 * Routes pour les commandes en cours
 * 
 * Routes externes (avec x-api-key):
 * - POST /api/external/commande-en-cours - Créer/mettre à jour une commande en cours
 * - DELETE /api/external/commande-en-cours/annuler - Annuler une commande (depuis application de caisse)
 * 
 * Routes internes (avec authentification JWT):
 * - GET /api/v1/commandes-en-cours - Liste des commandes en cours
 * - DELETE /api/v1/commandes-en-cours/:id - Supprimer une commande
 * - PATCH /api/v1/commandes-en-cours/:id/statut - Mettre à jour le statut
 */

// Routes externes protégées par x-api-key
// Ces routes sont accessibles depuis n'importe où avec la clé API
router.post('/external/commande-en-cours', validateApiKey, commandeEnCoursController.createCommandeEnCours);
router.delete('/external/commande-en-cours/annuler', validateApiKey, commandeEnCoursController.annulerCommandeExterne);

// Routes internes protégées par authentification JWT
router.get('/v1/commandes-en-cours', authenticateToken, commandeEnCoursController.getCommandesEnCours);
router.delete('/v1/commandes-en-cours/:id', authenticateToken, commandeEnCoursController.deleteCommandeEnCours);
router.patch('/v1/commandes-en-cours/:id/statut', authenticateToken, commandeEnCoursController.updateStatutCommande);
router.patch('/v1/commandes-en-cours/:id/reassign', authenticateToken, commandeEnCoursController.reassignCommande);

module.exports = router;

