const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../models/database');

// GET /api/v1/ranking?period=month|week|day OR ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

    let orderDateFilter = '';
    let expenseDateFilter = '';
    let timesheetDateFilter = '';
    let daysInPeriodExpr = '';
    const params = [];

    // Mode plage de dates personnalisée
    if (startDate && endDate && isoDateRegex.test(startDate) && isoDateRegex.test(endDate)) {
      params.push(startDate, endDate);
      orderDateFilter = `AND o.created_at::date BETWEEN $1::date AND $2::date`;
      expenseDateFilter = `AND e.expense_date BETWEEN $1::date AND $2::date`;
      timesheetDateFilter = `AND t.date BETWEEN $1::date AND $2::date`;
      daysInPeriodExpr = `($2::date - $1::date + 1)`;
    } else if (period === 'week') {
      orderDateFilter = "AND o.created_at >= date_trunc('week', CURRENT_DATE)";
      expenseDateFilter = "AND e.expense_date >= date_trunc('week', CURRENT_DATE)";
      timesheetDateFilter = "AND t.date >= date_trunc('week', CURRENT_DATE)";
      daysInPeriodExpr = "(CURRENT_DATE - date_trunc('week', CURRENT_DATE)::date + 1)";
    } else if (period === 'day') {
      orderDateFilter = "AND o.created_at >= date_trunc('day', CURRENT_DATE)";
      expenseDateFilter = "AND e.expense_date >= date_trunc('day', CURRENT_DATE)";
      timesheetDateFilter = "AND t.date = CURRENT_DATE";
      daysInPeriodExpr = "1";
    } else {
      // month par défaut
      orderDateFilter = "AND o.created_at >= date_trunc('month', CURRENT_DATE)";
      expenseDateFilter = "AND e.expense_date >= date_trunc('month', CURRENT_DATE)";
      timesheetDateFilter = "AND t.date >= date_trunc('month', CURRENT_DATE)";
      daysInPeriodExpr = "(CURRENT_DATE - date_trunc('month', CURRENT_DATE)::date + 1)";
    }

    const query = `
      WITH order_totals AS (
        SELECT o.created_by,
               COALESCE(SUM(o.course_price), 0) AS total_courses,
               COUNT(*) AS total_cmd
        FROM orders o
        WHERE o.created_by IS NOT NULL ${orderDateFilter}
        GROUP BY o.created_by
      ),
      expense_totals AS (
        SELECT e.livreur_id,
               COALESCE(SUM(
                 COALESCE(e.carburant, 0) + COALESCE(e.reparations, 0) +
                 COALESCE(e.police, 0) + COALESCE(e.autres, 0)
               ), 0) AS total_depenses
        FROM expenses e
        WHERE e.livreur_id IS NOT NULL ${expenseDateFilter}
        GROUP BY e.livreur_id
      ),
      timesheet_stats AS (
        SELECT t.user_id,
               COUNT(*) FILTER (WHERE t.start_time IS NOT NULL AND t.end_time IS NOT NULL) AS complets,
               COUNT(*) FILTER (WHERE t.start_time IS NOT NULL AND t.end_time IS NULL) AS incomplets,
               COUNT(*) AS total_pointages,
               COALESCE(SUM(t.total_km), 0) AS total_km
        FROM delivery_timesheets t
        WHERE 1=1 ${timesheetDateFilter}
        GROUP BY t.user_id
      )
      SELECT
        u.id,
        u.username,
        COALESCE(ot.total_cmd, 0) AS total_cmd,
        COALESCE(ot.total_courses, 0) - COALESCE(et.total_depenses, 0) AS benefice,
        COALESCE(ts.total_km, 0) AS total_km,
        COALESCE(ts.complets, 0) AS complets,
        COALESCE(ts.incomplets, 0) AS incomplets,
        GREATEST(${daysInPeriodExpr} - COALESCE(ts.total_pointages, 0), 0) AS absents
      FROM users u
      LEFT JOIN order_totals ot ON ot.created_by = u.id
      LEFT JOIN expense_totals et ON et.livreur_id = u.id
      LEFT JOIN timesheet_stats ts ON ts.user_id = u.id
      WHERE u.is_active = true AND u.role = 'LIVREUR'
        AND (COALESCE(ot.total_cmd, 0) > 0 OR COALESCE(et.total_depenses, 0) > 0)
    `;

    const { rows } = await db.query(query, params);

    if (rows.length === 0) {
      return res.json({ ranking: [], period: period || (startDate && endDate ? 'custom' : 'month') });
    }

    // Calcul des scores normalisés
    const benefices = rows.map(r => parseFloat(r.benefice) || 0);
    const minBen = Math.min(...benefices);
    const maxBen = Math.max(...benefices);

    // Efficacité = bénéfice / km (si km > 0, sinon null)
    const efficacites = rows.map(r => {
      const km = parseFloat(r.total_km) || 0;
      const ben = parseFloat(r.benefice) || 0;
      return km > 0 ? ben / km : null;
    });
    const validEff = efficacites.filter(e => e !== null);
    const minEff = validEff.length > 0 ? Math.min(...validEff) : 0;
    const maxEff = validEff.length > 0 ? Math.max(...validEff) : 0;

    const scored = rows.map((r, i) => {
      const ben = benefices[i];
      const eff = efficacites[i];

      // Score Bénéfice: 0 à 50 (linéaire entre min et max)
      const scoreBen = maxBen === minBen ? 50 : ((ben - minBen) / (maxBen - minBen)) * 50;

      // Score Efficacité: 0 à 50 (si pas de km, score = 0)
      let scoreEff;
      if (eff === null) {
        scoreEff = 0;
      } else if (maxEff === minEff) {
        scoreEff = 50;
      } else {
        scoreEff = ((eff - minEff) / (maxEff - minEff)) * 50;
      }

      return {
        username: r.username,
        total_cmd: parseInt(r.total_cmd),
        total_km: Math.round(parseFloat(r.total_km) || 0),
        complets: parseInt(r.complets),
        incomplets: parseInt(r.incomplets),
        absents: parseInt(r.absents),
        score_benefice: Math.round(scoreBen * 10) / 10,
        score_efficacite: Math.round(scoreEff * 10) / 10,
        score_total: Math.round((scoreBen + scoreEff) * 10) / 10
      };
    });

    // Tri par score total decroissant, puis par username pour stabilite
    scored.sort((a, b) => b.score_total - a.score_total || a.username.localeCompare(b.username));
    scored.forEach((r, i) => { r.rank = i + 1; });

    res.json({ ranking: scored, period: period || (startDate && endDate ? 'custom' : 'month') });
  } catch (err) {
    console.error('Erreur ranking:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
