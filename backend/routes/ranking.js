const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../models/database');

// GET /api/v1/ranking?period=month|week|all
router.get('/', authenticateToken, async (req, res) => {
  try {
    const period = req.query.period || 'month';

    let dateFilter = '';
    if (period === 'month') {
      dateFilter = "AND o.created_at >= date_trunc('month', CURRENT_DATE)";
    } else if (period === 'week') {
      dateFilter = "AND o.created_at >= date_trunc('week', CURRENT_DATE)";
    } else if (period === 'day') {
      dateFilter = "AND o.created_at >= date_trunc('day', CURRENT_DATE)";
    }

    let expenseDateFilter = '';
    if (period === 'month') {
      expenseDateFilter = "AND e.expense_date >= date_trunc('month', CURRENT_DATE)";
    } else if (period === 'week') {
      expenseDateFilter = "AND e.expense_date >= date_trunc('week', CURRENT_DATE)";
    } else if (period === 'day') {
      expenseDateFilter = "AND e.expense_date >= date_trunc('day', CURRENT_DATE)";
    }

    const query = `
      WITH order_totals AS (
        SELECT o.created_by, COALESCE(SUM(o.course_price), 0) AS total_courses, COUNT(*) AS total_cmd
        FROM orders o
        WHERE o.created_by IS NOT NULL ${dateFilter}
        GROUP BY o.created_by
      ),
      expense_totals AS (
        SELECT e.livreur_id, COALESCE(SUM(
          COALESCE(e.carburant, 0) + COALESCE(e.reparations, 0) + COALESCE(e.police, 0) + COALESCE(e.autres, 0)
        ), 0) AS total_depenses
        FROM expenses e
        WHERE e.livreur_id IS NOT NULL ${expenseDateFilter}
        GROUP BY e.livreur_id
      )
      SELECT
        u.id,
        u.username,
        COALESCE(ot.total_courses, 0) - COALESCE(et.total_depenses, 0) AS benefice,
        COALESCE(ot.total_cmd, 0) AS total_cmd
      FROM users u
      LEFT JOIN order_totals ot ON ot.created_by = u.id
      LEFT JOIN expense_totals et ON et.livreur_id = u.id
      WHERE u.is_active = true AND u.role = 'LIVREUR'
        AND (COALESCE(ot.total_cmd, 0) > 0 OR COALESCE(et.total_depenses, 0) > 0)
      ORDER BY benefice DESC
    `;

    const { rows } = await db.query(query);

    // Ne renvoyer que le rang, le nom et le nombre de commandes (PAS les montants)
    const ranking = rows.map((r, i) => ({
      rank: i + 1,
      username: r.username,
      total_cmd: parseInt(r.total_cmd)
    }));

    res.json({ ranking, period });
  } catch (err) {
    console.error('Erreur ranking:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
