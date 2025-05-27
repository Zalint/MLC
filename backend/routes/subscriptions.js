const express = require('express');
const router = express.Router();
const SubscriptionController = require('../controllers/subscriptionController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateSubscriptionCreation, validateSubscriptionUpdate, validateMLCOrderCreation, validateUUID } = require('../middleware/validation');

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// Routes pour les statistiques (accessible à tous les utilisateurs authentifiés)
router.get('/stats', SubscriptionController.getSubscriptionStats);
router.get('/expiring-soon', SubscriptionController.getExpiringSoon);

// Route pour obtenir les cartes actives
router.get('/active', SubscriptionController.getActiveSubscriptions);

// Routes de recherche
router.get('/search', SubscriptionController.searchSubscriptions);

// Routes pour les cartes spécifiques
router.get('/:id', validateUUID, SubscriptionController.getSubscriptionById);

// Routes pour lister toutes les cartes
router.get('/', SubscriptionController.getAllSubscriptions);

// Routes pour vérifier la validité d'une carte
router.get('/check/:cardNumber', SubscriptionController.checkCardValidity);

// Routes pour obtenir les cartes par téléphone
router.get('/phone/:phoneNumber', SubscriptionController.getSubscriptionsByPhone);

// Routes pour obtenir une carte spécifique
router.get('/card/:cardNumber', SubscriptionController.getSubscriptionByCardNumber);

// Routes pour créer une nouvelle carte (MANAGER et ADMIN seulement)
router.post('/', 
  requireRole(['MANAGER', 'ADMIN']), 
  validateSubscriptionCreation, 
  SubscriptionController.createSubscription
);

// Routes pour désactiver/réactiver une carte (MANAGER et ADMIN seulement)
router.patch('/:id/deactivate', 
  requireRole(['MANAGER', 'ADMIN']), 
  validateUUID, 
  SubscriptionController.deactivateSubscription
);

router.patch('/:id/reactivate', 
  requireRole(['MANAGER', 'ADMIN']), 
  validateUUID, 
  SubscriptionController.reactivateSubscription
);

// Routes pour mettre à jour une carte (MANAGER et ADMIN seulement)
router.put('/:id', 
  requireRole(['MANAGER', 'ADMIN']), 
  validateUUID, 
  validateSubscriptionUpdate, 
  SubscriptionController.updateSubscription
);

// Route spéciale pour créer une commande MLC avec déduction automatique
router.post('/mlc-order', 
  validateMLCOrderCreation,
  SubscriptionController.createMLCOrderWithSubscription
);

// Routes pour utiliser une livraison
router.post('/:id/use-delivery', 
  validateUUID, 
  SubscriptionController.useDelivery
);

module.exports = router; 