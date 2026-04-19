/**
 * 🔬 Routes MATA Analytics
 * 
 * Endpoints GET prédéfinis pour l'analyse approfondie des commandes MATA
 * - Lecture seule (GET uniquement)
 * - Requêtes SQL prédéfinies et sécurisées
 * - Accès: Managers et Admins uniquement
 */

const express = require('express');
const router = express.Router();
const MataAnalyticsController = require('../controllers/mataAnalyticsController');
const { requireManagerOrAdmin, requireViewer } = require('../middleware/auth');

// Middleware: Managers et Admins uniquement

// =============================================================================
// ANALYTICS ENDPOINTS (GET uniquement)
// =============================================================================

/**
 * 1. Clients à commande unique
 * GET /api/v1/mata-analytics/one-time-customers?month=2025-09
 */
router.get('/one-time-customers', requireViewer, MataAnalyticsController.getOneTimeCustomers);

/**
 * 2. Clients inactifs
 * GET /api/v1/mata-analytics/inactive-customers?days=30
 */
router.get('/inactive-customers', requireViewer, MataAnalyticsController.getInactiveCustomers);

/**
 * 3. Top clients
 * GET /api/v1/mata-analytics/top-customers?limit=10&period=all
 */
router.get('/top-customers', requireViewer, MataAnalyticsController.getTopCustomers);

/**
 * 4. Nouveaux clients
 * GET /api/v1/mata-analytics/new-customers?month=2025-09
 */
router.get('/new-customers', requireViewer, MataAnalyticsController.getNewCustomers);

/**
 * 5. Taux de rétention
 * GET /api/v1/mata-analytics/customer-retention?start_month=2025-01&end_month=2025-09
 */
router.get('/customer-retention', requireViewer, MataAnalyticsController.getCustomerRetention);

/**
 * 6. Distribution par point de vente
 * GET /api/v1/mata-analytics/customers-by-point-vente?month=2025-09
 */
router.get('/customers-by-point-vente', requireViewer, MataAnalyticsController.getCustomersByPointVente);

/**
 * 7. Clients à forte valeur
 * GET /api/v1/mata-analytics/high-value-customers?min_amount=100000
 */
router.get('/high-value-customers', requireViewer, MataAnalyticsController.getHighValueCustomers);

/**
 * 8. Clients fréquents
 * GET /api/v1/mata-analytics/frequent-customers?min_orders=5
 */
router.get('/frequent-customers', requireViewer, MataAnalyticsController.getFrequentCustomers);

/**
 * 9. Risque de churn
 * GET /api/v1/mata-analytics/churn-risk?threshold_days=45
 */
router.get('/churn-risk', requireViewer, MataAnalyticsController.getChurnRisk);

/**
 * 10. Satisfaction client
 * GET /api/v1/mata-analytics/customer-satisfaction?min_rating=8&max_rating=10
 */
router.get('/customer-satisfaction', requireViewer, MataAnalyticsController.getCustomerSatisfaction);

/**
 * 11. Distribution par jour de la semaine
 * GET /api/v1/mata-analytics/customers-by-day-of-week?month=2025-09
 */
router.get('/customers-by-day-of-week', requireViewer, MataAnalyticsController.getCustomersByDayOfWeek);

/**
 * 12. Valeur vie client (CLV)
 * GET /api/v1/mata-analytics/customer-lifetime-value?top=20
 */
router.get('/customer-lifetime-value', requireViewer, MataAnalyticsController.getCustomerLifetimeValue);

/**
 * 13. Détails complets (FALLBACK)
 * GET /api/v1/mata-analytics/orders-detailed?start_date=2025-09-01&end_date=2025-09-30&limit=1000
 */
router.get('/orders-detailed', requireViewer, MataAnalyticsController.getOrdersDetailed);

module.exports = router;
