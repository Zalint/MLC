const express = require('express');
const router = express.Router();
const timesheetController = require('../controllers/timesheetController');
const { authenticateToken } = require('../middleware/auth');

// Middleware pour vérifier que l'utilisateur est manager ou admin
const requireManagerOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentification requise.'
    });
  }

  const role = req.user.role;
  
  if (role !== 'MANAGER' && role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Accès réservé aux managers et administrateurs.'
    });
  }

  next();
};

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// ============================================
// ROUTES LIVREURS
// ============================================

// Récupérer le pointage du jour pour le livreur connecté
// GET /api/timesheets/today
router.get('/today', timesheetController.getTodayTimesheet);

// Pointer le début d'activité (pour soi-même)
// POST /api/timesheets/start (avec FormData: date, km, photo)
router.post(
  '/start',
  timesheetController.uploadPhotoMiddleware,
  timesheetController.startActivity
);

// Pointer la fin d'activité (pour soi-même)
// POST /api/timesheets/end (avec FormData: date, km, photo)
router.post(
  '/end',
  timesheetController.uploadPhotoMiddleware,
  timesheetController.endActivity
);

// Modifier le début d'activité (pour soi-même)
// PUT /api/timesheets/:id/start (avec FormData: km, photo optionnel)
router.put(
  '/:id/start',
  timesheetController.uploadPhotoMiddleware,
  timesheetController.updateStartActivity
);

// Modifier la fin d'activité (pour soi-même)
// PUT /api/timesheets/:id/end (avec FormData: km, photo optionnel)
router.put(
  '/:id/end',
  timesheetController.uploadPhotoMiddleware,
  timesheetController.updateEndActivity
);

// ============================================
// ROUTES MANAGERS (ordre important: routes spécifiques avant routes génériques)
// ============================================

// Récupérer TOUS les pointages d'une date (manager uniquement)
// GET /api/timesheets/all?date=2026-02-05
router.get('/all', requireManagerOrAdmin, timesheetController.getAllTimesheetsForDate);

// Pointer le début pour UN livreur spécifique (manager uniquement)
// POST /api/timesheets/start-for-user (FormData: user_id, date, km, photo)
router.post(
  '/start-for-user',
  requireManagerOrAdmin,
  timesheetController.uploadPhotoMiddleware,
  timesheetController.startActivityForUser
);

// Pointer la fin pour UN livreur spécifique (manager uniquement)
// POST /api/timesheets/end-for-user (FormData: user_id, date, km, photo)
router.post(
  '/end-for-user',
  requireManagerOrAdmin,
  timesheetController.uploadPhotoMiddleware,
  timesheetController.endActivityForUser
);

// ============================================
// ROUTES COMMUNES
// ============================================

// Télécharger une photo
// GET /api/timesheets/:id/photo/:type (type = start|end)
router.get('/:id/photo/:type', timesheetController.downloadPhoto);

// Récupérer l'historique des pointages
// GET /api/timesheets?start_date=2026-02-01&end_date=2026-02-28&user_id=xxx (optionnel)
router.get('/', timesheetController.getTimesheets);

// Modifier un pointage (si autorisé)
// PUT /api/timesheets/:id
router.put('/:id', timesheetController.updateTimesheet);

// Supprimer un pointage
// DELETE /api/timesheets/:id
// Permissions gérées dans le controller:
// - Manager/Admin: peut supprimer n'importe quel pointage
// - Livreur: peut supprimer uniquement son propre pointage du jour même
router.delete('/:id', timesheetController.deleteTimesheet);

module.exports = router;
