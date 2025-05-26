const express = require('express');
const router = express.Router();
const ExpenseController = require('../controllers/expenseController');
const { authenticateToken } = require('../middleware/auth');

// Middleware d'authentification pour toutes les routes
router.use(authenticateToken);

// Routes pour les dépenses

// GET /api/v1/expenses/summary?date=YYYY-MM-DD - Récapitulatif des dépenses par livreur pour une date
router.get('/summary', ExpenseController.getExpensesSummary);

// GET /api/v1/expenses/by-date?date=YYYY-MM-DD - Dépenses pour une date donnée
router.get('/by-date', ExpenseController.getExpensesByDate);

// GET /api/v1/expenses/by-date-range?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD - Dépenses par plage de dates
router.get('/by-date-range', ExpenseController.getExpensesByDateRange);

// GET /api/v1/expenses/livreur/:livreurId - Dépenses d'un livreur spécifique
router.get('/livreur/:livreurId', ExpenseController.getExpensesByLivreur);

// GET /api/v1/expenses/livreur/:livreurId/date/:date - Dépense d'un livreur pour une date spécifique
router.get('/livreur/:livreurId/date/:date', ExpenseController.getExpenseByLivreurAndDate);

// GET /api/v1/expenses/:id - Dépense spécifique par ID
router.get('/:id', ExpenseController.getExpenseById);

// POST /api/v1/expenses - Créer ou mettre à jour une dépense
router.post('/', ExpenseController.createOrUpdateExpense);

// PUT /api/v1/expenses/:id - Mettre à jour une dépense
router.put('/:id', ExpenseController.updateExpense);

// DELETE /api/v1/expenses/:id - Supprimer une dépense
router.delete('/:id', ExpenseController.deleteExpense);

module.exports = router; 