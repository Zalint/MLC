/**
 * 📊 Routes GPS Analytics
 * 
 * Endpoints pour l'analyse des performances GPS des livreurs
 * - Métriques quotidiennes
 * - Tendances hebdomadaires
 * - Performances individuelles et comparatives
 * - Exports de données
 * 
 * Accès: Tous les utilisateurs authentifiés
 * - Livreurs: Accès à leurs propres données uniquement
 * - Managers/Admins: Accès à toutes les données
 */

const express = require('express');
const router = express.Router();
const GpsAnalyticsController = require('../controllers/gpsAnalyticsController');
const { 
  authenticateToken, 
  requireManagerOrAdmin 
} = require('../middleware/auth');

// Middleware d'authentification pour toutes les routes
router.use(authenticateToken);

// =============================================================================
// GPS ANALYTICS ENDPOINTS
// =============================================================================

/**
 * 1. Performances quotidiennes
 * GET /api/v1/analytics/gps/daily-performance?period=7&livreurId=xxx&date=2025-10-11
 */
router.get('/daily-performance', GpsAnalyticsController.getDailyPerformance);

/**
 * 2. Tendances hebdomadaires
 * GET /api/v1/analytics/gps/weekly-trends?weeks=8&livreurId=xxx
 */
router.get('/weekly-trends', GpsAnalyticsController.getWeeklyTrends);

/**
 * 3. Classement des livreurs
 * GET /api/v1/analytics/gps/rankings?period=7
 */
router.get('/rankings', requireManagerOrAdmin, GpsAnalyticsController.getLivreurRankings);

/**
 * 4. Comparaison entre livreurs
 * GET /api/v1/analytics/gps/comparison?livreur1=xxx&livreur2=yyy&period=30
 */
router.get('/comparison', requireManagerOrAdmin, GpsAnalyticsController.getLivreurComparison);

/**
 * 5. Résumé analytique général
 * GET /api/v1/analytics/gps/overview?startDate=2025-10-01&endDate=2025-10-11
 */
router.get('/overview', requireManagerOrAdmin, GpsAnalyticsController.getAnalyticsOverview);

/**
 * 6. Résumé GPS quotidien
 * GET /api/v1/analytics/gps/daily-summary?date=2025-10-11
 */
router.get('/daily-summary', requireManagerOrAdmin, GpsAnalyticsController.getDailyGpsSummary);

/**
 * 7. Résumé GPS mensuel
 * GET /api/v1/analytics/gps/monthly-summary?month=2025-10
 */
router.get('/monthly-summary', requireManagerOrAdmin, GpsAnalyticsController.getMonthlyGpsSummary);

/**
 * 8. Analytique par zone
 * GET /api/v1/analytics/gps/zones?startDate=2025-10-01&endDate=2025-10-11
 */
router.get('/zones', requireManagerOrAdmin, GpsAnalyticsController.getZoneAnalytics);

/**
 * 9. Calcul manuel des métriques quotidiennes
 * POST /api/v1/analytics/gps/calculate-metrics?date=2025-10-11
 */
router.post('/calculate-metrics', requireManagerOrAdmin, GpsAnalyticsController.calculateDailyMetrics);

/**
 * 10. Export des données GPS
 * GET /api/v1/analytics/gps/export?type=daily_performance&startDate=2025-10-01&endDate=2025-10-11&livreurId=xxx
 */
router.get('/export', requireManagerOrAdmin, GpsAnalyticsController.exportAnalytics);

module.exports = router;

