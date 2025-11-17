const db = require('../models/database');

class AuditController {
  /**
   * Créer un log d'audit quand l'utilisateur ouvre l'historique d'un client
   * POST /api/audit/client-history/open
   */
  static async openClientHistory(req, res) {
    try {
      const { client_name, client_phone, orders_count, total_amount } = req.body;
      
      if (!client_name || !client_phone) {
        return res.status(400).json({
          success: false,
          error: 'Le nom et le téléphone du client sont requis'
        });
      }

      const query = `
        INSERT INTO client_history_audit 
          (user_id, username, user_role, client_name, client_phone, orders_count, total_amount)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, opened_at
      `;

      const values = [
        req.user.id,
        req.user.username,
        req.user.role,
        client_name,
        client_phone,
        orders_count || 0,
        total_amount || 0
      ];

      const result = await db.query(query, values);
      const log = result.rows[0];

      res.json({
        success: true,
        log_id: log.id,
        opened_at: log.opened_at
      });
    } catch (error) {
      console.error('❌ Erreur lors de la création du log d\'audit:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur interne du serveur'
      });
    }
  }

  /**
   * Fermer un log d'audit quand l'utilisateur ferme l'historique
   * PUT /api/audit/client-history/:log_id/close
   */
  static async closeClientHistory(req, res) {
    try {
      const { log_id } = req.params;
      const { duration_seconds } = req.body;

      if (!log_id) {
        return res.status(400).json({
          success: false,
          error: 'L\'ID du log est requis'
        });
      }

      const query = `
        UPDATE client_history_audit
        SET closed_at = NOW(),
            duration_seconds = $1
        WHERE id = $2
        AND user_id = $3
        RETURNING id, opened_at, closed_at, duration_seconds
      `;

      const values = [duration_seconds || null, log_id, req.user.id];
      const result = await db.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Log d\'audit non trouvé ou non autorisé'
        });
      }

      res.json({
        success: true,
        log: result.rows[0]
      });
    } catch (error) {
      console.error('❌ Erreur lors de la fermeture du log d\'audit:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur interne du serveur'
      });
    }
  }

  /**
   * Récupérer tous les logs d'audit (managers et admins uniquement)
   * GET /api/audit/client-history/logs
   */
  static async getClientHistoryLogs(req, res) {
    try {
      const { 
        user_id, 
        user_role,
        start_date, 
        end_date,
        client_phone,
        min_duration,
        limit = 100,
        offset = 0
      } = req.query;

      let query = `
        SELECT *,
          CASE 
            WHEN duration_seconds IS NULL THEN 'En cours'
            WHEN duration_seconds < 60 THEN 'Rapide'
            WHEN duration_seconds < 180 THEN 'Normal'
            WHEN duration_seconds < 600 THEN 'Long'
            ELSE 'Très long'
          END as duration_category
        FROM client_history_audit
        WHERE 1=1
      `;
      
      const values = [];
      let paramIndex = 1;

      // Filtres
      if (user_id) {
        query += ` AND user_id = $${paramIndex}`;
        values.push(user_id);
        paramIndex++;
      }

      if (user_role) {
        query += ` AND user_role = $${paramIndex}`;
        values.push(user_role);
        paramIndex++;
      }

      if (start_date) {
        query += ` AND DATE(opened_at) >= $${paramIndex}`;
        values.push(start_date);
        paramIndex++;
      }

      if (end_date) {
        query += ` AND DATE(opened_at) <= $${paramIndex}`;
        values.push(end_date);
        paramIndex++;
      }

      if (client_phone) {
        query += ` AND client_phone = $${paramIndex}`;
        values.push(client_phone);
        paramIndex++;
      }

      if (min_duration) {
        query += ` AND duration_seconds >= $${paramIndex}`;
        values.push(parseInt(min_duration));
        paramIndex++;
      }

      // Compte total (avant pagination)
      const countQuery = `SELECT COUNT(*) as total FROM (${query}) as subquery`;
      const countResult = await db.query(countQuery, values);
      const total = parseInt(countResult.rows[0].total);

      // Ajouter ORDER BY et LIMIT
      query += ` ORDER BY opened_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      values.push(parseInt(limit), parseInt(offset));

      const result = await db.query(query, values);

      // Statistiques globales
      const statsQuery = `
        SELECT 
          COUNT(*) as total_accesses,
          AVG(duration_seconds) as avg_duration_seconds,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT client_phone) as unique_clients
        FROM client_history_audit
        WHERE duration_seconds IS NOT NULL
        ${start_date ? `AND DATE(opened_at) >= '${start_date}'` : ''}
        ${end_date ? `AND DATE(opened_at) <= '${end_date}'` : ''}
      `;
      const statsResult = await db.query(statsQuery);

      res.json({
        success: true,
        logs: result.rows,
        total: total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        statistics: statsResult.rows[0]
      });
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des logs d\'audit:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur interne du serveur'
      });
    }
  }

  /**
   * Statistiques pour le dashboard d'audit (managers et admins uniquement)
   * GET /api/audit/client-history/stats
   */
  static async getClientHistoryStats(req, res) {
    try {
      const { period = 'last_7_days' } = req.query;

      // Calculer les dates selon la période
      let startDate;
      const endDate = new Date();
      
      switch (period) {
        case 'today':
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'last_7_days':
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'last_30_days':
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 30);
          break;
        case 'this_month':
          startDate = new Date();
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
          break;
        default:
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
      }

      // Top 5 utilisateurs
      const topUsersQuery = `
        SELECT 
          username,
          user_role,
          COUNT(*) as access_count,
          AVG(duration_seconds) as avg_duration
        FROM client_history_audit
        WHERE opened_at >= $1 AND opened_at <= $2
          AND duration_seconds IS NOT NULL
        GROUP BY username, user_role
        ORDER BY access_count DESC
        LIMIT 5
      `;
      const topUsers = await db.query(topUsersQuery, [startDate, endDate]);

      // Top 5 clients consultés
      const topClientsQuery = `
        SELECT 
          client_name,
          client_phone,
          COUNT(*) as consultation_count
        FROM client_history_audit
        WHERE opened_at >= $1 AND opened_at <= $2
        GROUP BY client_name, client_phone
        ORDER BY consultation_count DESC
        LIMIT 5
      `;
      const topClients = await db.query(topClientsQuery, [startDate, endDate]);

      // Accès par jour
      const dailyAccessQuery = `
        SELECT 
          DATE(opened_at) as date,
          COUNT(*) as access_count
        FROM client_history_audit
        WHERE opened_at >= $1 AND opened_at <= $2
        GROUP BY DATE(opened_at)
        ORDER BY date
      `;
      const dailyAccess = await db.query(dailyAccessQuery, [startDate, endDate]);

      res.json({
        success: true,
        period: period,
        date_range: {
          start: startDate,
          end: endDate
        },
        top_users: topUsers.rows,
        top_clients: topClients.rows,
        daily_access: dailyAccess.rows
      });
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des statistiques:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur interne du serveur'
      });
    }
  }
}

module.exports = AuditController;

