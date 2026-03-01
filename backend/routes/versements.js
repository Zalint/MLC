const express = require('express');
const router = express.Router();
const VersementsController = require('../controllers/versementsController');
const { authenticateToken, requireManagerOrAdmin } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/v1/versements?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&livreur_id=...
router.get('/', requireManagerOrAdmin, VersementsController.getVersements);

// GET /api/v1/versements/export?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&livreur_id=...
router.get('/export', requireManagerOrAdmin, VersementsController.exportVersements);

// POST /api/v1/versements
router.post('/', requireManagerOrAdmin, VersementsController.createVersement);

// DELETE /api/v1/versements/:id
router.delete('/:id', requireManagerOrAdmin, VersementsController.deleteVersement);

module.exports = router;
