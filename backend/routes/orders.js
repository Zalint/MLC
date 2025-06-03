const express = require('express');
const router = express.Router();

const OrderController = require('../controllers/orderController');
const { 
  authenticateToken, 
  requireManagerOrAdmin,
  requireDeleteAllPermission,
  requireOwnership 
} = require('../middleware/auth');
const { 
  validateOrderCreation,
  validateOrderUpdate,
  validateUUID,
  validateLivreurId,
  validateDate,
  validateDateRange,
  validatePagination,
  sanitizeInput 
} = require('../middleware/validation');

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// DEBUG: Route temporaire pour diagnostiquer les problèmes de rôles
router.get('/debug-role', OrderController.debugUserRole);

// Routes accessibles à tous les utilisateurs authentifiés
router.get('/', validatePagination, OrderController.getAllOrders);
router.get('/last', OrderController.getLastUserOrders);
router.get('/by-date', validateDate, OrderController.getOrdersByDate);
router.get('/stats', validateDateRange, OrderController.getOrderStats);

// Route optimisée pour toutes les données du tableau de bord (1 seule requête)
router.get('/dashboard-data', validateDate, OrderController.getDashboardData);

// Route pour le récapitulatif (managers et admins seulement)
router.get('/summary', requireManagerOrAdmin, validateDate, OrderController.getTodayOrdersSummary);

// Route pour le récapitulatif mensuel (managers et admins seulement)
router.get('/monthly-summary', requireManagerOrAdmin, OrderController.getMonthlyOrdersSummary);

// Route pour l'export Excel mensuel (managers et admins seulement)
router.get('/monthly-export', requireManagerOrAdmin, OrderController.exportMonthlyToExcel);

// Route pour le tableau de bord mensuel MATA (managers et admins seulement)
router.get('/mata-monthly-dashboard', requireManagerOrAdmin, OrderController.getMataMonthlyDashboard);

// Route pour l'export Excel du tableau de bord MATA mensuel (managers et admins seulement)
router.get('/mata-monthly-export', requireManagerOrAdmin, OrderController.exportMataMonthlyToExcel);

// Route pour les détails des courses d'un livreur (managers et admins seulement)
router.get('/livreur/:livreurId/details', requireManagerOrAdmin, validateLivreurId, validateDate, OrderController.getLivreurOrderDetails);

// Route pour l'export Excel (managers et admins seulement)
router.get('/export', requireManagerOrAdmin, validateDateRange, OrderController.exportToExcel);

// Route pour l'export Excel des détails d'un livreur (managers et admins seulement)
router.get('/livreur/:livreurId/export', requireManagerOrAdmin, validateLivreurId, validateDate, OrderController.exportLivreurDetailsToExcel);

// Création de commande
router.post('/', 
  sanitizeInput, 
  validateOrderCreation, 
  OrderController.createOrder
);

// Routes avec ID spécifique
router.get('/:id', validateUUID, OrderController.getOrderById);

router.put('/:id', 
  validateUUID, 
  sanitizeInput, 
  validateOrderUpdate, 
  OrderController.updateOrder
);

// Route spéciale pour mettre à jour le commentaire d'une commande MATA (managers et admins seulement)
router.put('/:id/comment', 
  validateUUID, 
  requireManagerOrAdmin,
  sanitizeInput, 
  OrderController.updateMataOrderComment
);

// Route spéciale pour mettre à jour les notes d'une commande MATA (managers et admins seulement)
router.put('/:id/rating', 
  validateUUID, 
  requireManagerOrAdmin,
  sanitizeInput, 
  OrderController.updateMataOrderRating
);

router.delete('/:id', 
  validateUUID, 
  OrderController.deleteOrder
);

// Route spéciale pour supprimer toutes les commandes d'un utilisateur pour une date
router.delete('/user/date', 
  validateDate, 
  OrderController.deleteUserOrdersForDate
);

module.exports = router; 