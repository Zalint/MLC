const express = require('express');
const router = express.Router();

const OrderController = require('../controllers/orderController');
const {
  authenticateToken,
  requireManagerOrAdmin,
  requireManagerAdminOrLivreur,
  requireDeleteAllPermission,
  requireOwnership,
  requireViewer
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
router.get('/summary', requireViewer, validateDate, OrderController.getTodayOrdersSummary);

// Route pour le récapitulatif mensuel (managers et admins seulement)
router.get('/monthly-summary', requireViewer, OrderController.getMonthlyOrdersSummary);

// Route pour l'export Excel mensuel (managers et admins seulement)
router.get('/monthly-export', requireViewer, OrderController.exportMonthlyToExcel);

// Route pour le tableau de bord mensuel MATA (managers et admins seulement)
router.get('/mata-monthly-dashboard', requireViewer, OrderController.getMataMonthlyDashboard);

// Route pour l'export Excel du tableau de bord MATA mensuel (managers et admins seulement)
router.get('/mata-monthly-export', requireViewer, OrderController.exportMataMonthlyToExcel);

// Route pour l'analyse de sentiment IA des commandes MATA (managers et admins seulement)
router.get('/mata-sentiment-analysis', requireViewer, OrderController.getMatasentimentAnalysis);

// Route pour l'analyse approfondie avec IA (managers et admins seulement)
const DeepAnalysisController = require('../controllers/deepAnalysisController');
router.post('/mata-deep-analysis', requireManagerOrAdmin, DeepAnalysisController.performDeepAnalysis);

// Route pour l'historique des commandes d'un client (par numéro de téléphone)
router.get('/client-history', requireManagerAdminOrLivreur, OrderController.getClientOrderHistory);

// Route pour l'export Excel du récapitulatif par livreur (managers et admins seulement)
router.get('/monthly-summary-export', requireViewer, OrderController.exportMonthlySummaryToExcel);

// Route pour les détails des courses d'un livreur (managers et admins seulement)
router.get('/livreur/:livreurId/details', requireViewer, validateLivreurId, validateDate, OrderController.getLivreurOrderDetails);

// Route pour l'export Excel (managers et admins seulement)
router.get('/export', requireViewer, validateDateRange, OrderController.exportToExcel);

// Route pour l'export Excel des détails d'un livreur (managers et admins seulement)
router.get('/livreur/:livreurId/export', requireViewer, validateLivreurId, validateDate, OrderController.exportLivreurDetailsToExcel);

// Création de commande
router.post('/', 
  sanitizeInput, 
  validateOrderCreation, 
  OrderController.createOrder
);

// Routes pour la recherche de clients (AVANT les routes avec :id)
router.get('/search-clients', OrderController.searchClients);
router.get('/client/:phoneNumber', OrderController.getClientByPhone);

// Routes pour le tableau MLC (AVANT les routes avec :id)
router.get('/mlc-table', requireViewer, OrderController.getMlcTable);
router.get('/mlc-table/client-details', requireViewer, OrderController.getMlcClientDetails);
router.get('/export-mlc-client-details', requireViewer, OrderController.exportMlcClientDetailsToExcel);
router.get('/export-mlc-table', requireViewer, OrderController.exportMlcTableToExcel);

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

// Route spéciale pour mettre à jour la source de connaissance d'une commande MATA (managers et admins seulement)
router.put('/:id/source-connaissance', 
  validateUUID, 
  requireManagerOrAdmin,
  sanitizeInput, 
  OrderController.updateMataOrderSourceConnaissance
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

// Route pour obtenir les dernières commandes de l'utilisateur connecté
router.get('/user/last', OrderController.getLastUserOrders);

module.exports = router; 