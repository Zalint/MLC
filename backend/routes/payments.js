const express = require('express');
const router = express.Router();
const PaymentsController = require('../controllers/paymentsController');
const { authenticateToken, requireManagerOrAdmin } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/v1/payments?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&livreur_id=...
router.get('/', PaymentsController.getPayments);

// GET /api/v1/payments/export?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&livreur_id=...
router.get('/export', PaymentsController.exportPayments);

// POST /api/v1/payments
router.post('/', requireManagerOrAdmin, PaymentsController.createPayment);

// DELETE /api/v1/payments/:id
router.delete('/:id', requireManagerOrAdmin, PaymentsController.deletePayment);

module.exports = router;
