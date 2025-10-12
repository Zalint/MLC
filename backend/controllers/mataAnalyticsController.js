/**
 * 🔬 MATA Analytics Controller
 * 
 * Endpoints GET prédéfinis pour l'analyse approfondie des données MATA
 * - Aucun SQL dynamique
 * - GET uniquement (lecture seule)
 * - Requêtes optimisées et sécurisées
 */

const db = require('../models/database');

class MataAnalyticsController {
  /**
   * 1. Clients qui n'ont commandé qu'une seule fois (basé uniquement sur le numéro de téléphone)
   * GET /api/v1/analytics/one-time-customers?month=2025-09
   */
  static async getOneTimeCustomers(req, res) {
    try {
      const { month } = req.query;
      
      let query = `
        WITH phone_orders AS (
          SELECT 
            phone_number,
            COUNT(*) as order_count
          FROM orders
          WHERE order_type = 'MATA'
            AND (interne = false OR interne IS NULL)
      `;
      
      const params = [];
      if (month) {
        query += ` AND TO_CHAR(created_at, 'YYYY-MM') = $1`;
        params.push(month);
      }
      
      query += `
          GROUP BY phone_number
          HAVING COUNT(*) = 1
        ),
        phone_details AS (
          SELECT 
            o.phone_number,
            MAX(o.client_name) as last_client_name,
            STRING_AGG(DISTINCT o.client_name, ', ' ORDER BY o.client_name) as all_client_names,
            TO_CHAR(MAX(o.created_at), 'DD/MM/YYYY') as order_date,
            MAX(o.amount) as total_amount,
            MAX(o.point_de_vente) as point_de_vente,
            MAX(o.source_connaissance) as source_connaissance,
            MAX(o.created_at) as last_order_date
          FROM orders o
          INNER JOIN phone_orders po ON o.phone_number = po.phone_number
          WHERE o.order_type = 'MATA'
            AND (o.interne = false OR o.interne IS NULL)
      `;
      
      if (month) {
        query += ` AND TO_CHAR(o.created_at, 'YYYY-MM') = $${params.length}`;
      }
      
      query += `
          GROUP BY o.phone_number
        )
        SELECT 
          last_client_name as client_name,
          phone_number,
          all_client_names,
          order_date,
          total_amount,
          point_de_vente,
          source_connaissance
        FROM phone_details
        ORDER BY last_order_date DESC
        LIMIT 1000
      `;
      
      const result = await db.query(query, params);
      
      res.json({
        success: true,
        endpoint: '/analytics/one-time-customers',
        result_count: result.rows.length,
        data: result.rows
      });
      
    } catch (error) {
      console.error('❌ Error in getOneTimeCustomers:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'analyse des clients à commande unique'
      });
    }
  }

  /**
   * 2. Clients inactifs depuis X jours (groupé UNIQUEMENT par téléphone)
   * GET /api/v1/analytics/inactive-customers?days=30&min_amount=20000&max_amount=100000
   */
  static async getInactiveCustomers(req, res) {
    try {
      const days = parseInt(req.query.days) || 30;
      const min_amount = parseInt(req.query.min_amount) || 0;
      const max_amount = parseInt(req.query.max_amount) || 999999999;
      
      // Validation
      if (days < 1 || days > 365) {
        return res.status(400).json({
          success: false,
          error: 'Le nombre de jours doit être entre 1 et 365'
        });
      }
      
      const query = `
        WITH last_orders AS (
          SELECT 
            phone_number,
            MAX(created_at) as last_order_date,
            COUNT(*) as total_orders,
            SUM(amount) as total_spent,
            STRING_AGG(DISTINCT client_name, ', ' ORDER BY client_name) as all_client_names,
            (SELECT client_name FROM orders o2 
             WHERE o2.phone_number = orders.phone_number 
               AND o2.order_type = 'MATA'
               AND (o2.interne = false OR o2.interne IS NULL)
             ORDER BY o2.created_at DESC LIMIT 1) as client_name
          FROM orders
          WHERE order_type = 'MATA'
            AND (interne = false OR interne IS NULL)
          GROUP BY phone_number
          HAVING SUM(amount) >= $2 AND SUM(amount) <= $3
        )
        SELECT 
          client_name,
          phone_number,
          all_client_names,
          TO_CHAR(last_order_date, 'DD/MM/YYYY') as last_order_date,
          EXTRACT(DAY FROM NOW() - last_order_date)::int as days_since_last_order,
          total_orders,
          total_spent
        FROM last_orders
        WHERE last_order_date < NOW() - INTERVAL '1 day' * $1
        ORDER BY last_order_date DESC
        LIMIT 1000
      `;
      
      const result = await db.query(query, [days, min_amount, max_amount]);
      
      res.json({
        success: true,
        endpoint: '/analytics/inactive-customers',
        params: { days, min_amount, max_amount },
        result_count: result.rows.length,
        data: result.rows
      });
      
    } catch (error) {
      console.error('❌ Error in getInactiveCustomers:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'analyse des clients inactifs'
      });
    }
  }

  /**
   * 3. Top N clients par montant total (groupé UNIQUEMENT par téléphone)
   * GET /api/v1/analytics/top-customers?limit=10&period=all&min_amount=20000&max_amount=100000
   */
  static async getTopCustomers(req, res) {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 10, 100);
      const period = req.query.period || 'all'; // 'all' or 'YYYY-MM'
      const min_amount = parseInt(req.query.min_amount) || 0;
      const max_amount = parseInt(req.query.max_amount) || 999999999;
      
      let query = `
        SELECT 
          (SELECT client_name FROM orders o2 
           WHERE o2.phone_number = orders.phone_number 
             AND o2.order_type = 'MATA'
             AND (o2.interne = false OR o2.interne IS NULL)
           ORDER BY o2.created_at DESC LIMIT 1) as client_name,
          phone_number,
          STRING_AGG(DISTINCT client_name, ', ' ORDER BY client_name) as all_client_names,
          COUNT(*) as total_orders,
          SUM(amount) as total_amount,
          ROUND(AVG(amount), 0) as avg_order_amount,
          TO_CHAR(MIN(created_at), 'DD/MM/YYYY') as first_order_date,
          TO_CHAR(MAX(created_at), 'DD/MM/YYYY') as last_order_date,
          MAX(point_de_vente) as primary_point_vente
        FROM orders
        WHERE order_type = 'MATA'
          AND (interne = false OR interne IS NULL)
      `;
      
      const params = [];
      if (period !== 'all') {
        query += ` AND TO_CHAR(created_at, 'YYYY-MM') = $1`;
        params.push(period);
      }
      
      query += `
        GROUP BY phone_number
        HAVING SUM(amount) >= $${params.length + 1} AND SUM(amount) <= $${params.length + 2}
        ORDER BY total_amount DESC
        LIMIT $${params.length + 3}
      `;
      
      params.push(min_amount, max_amount, limit);
      
      const result = await db.query(query, params);
      
      res.json({
        success: true,
        endpoint: '/analytics/top-customers',
        params: { limit, period, min_amount, max_amount },
        result_count: result.rows.length,
        data: result.rows
      });
      
    } catch (error) {
      console.error('❌ Error in getTopCustomers:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'analyse des meilleurs clients'
      });
    }
  }

  /**
   * 4. Nouveaux clients d'une période
   * GET /api/v1/analytics/new-customers?month=2025-09
   */
  static async getNewCustomers(req, res) {
    try {
      const month = req.query.month || new Date().toISOString().slice(0, 7);
      
      const query = `
        WITH first_orders AS (
          SELECT 
            phone_number,
            MIN(created_at) as first_order_date
          FROM orders
          WHERE order_type = 'MATA'
            AND (interne = false OR interne IS NULL)
          GROUP BY phone_number
        )
        SELECT 
          o.client_name,
          o.phone_number,
          TO_CHAR(fo.first_order_date, 'DD/MM/YYYY') as first_order_date,
          o.amount as first_order_amount,
          o.point_de_vente,
          o.source_connaissance
        FROM orders o
        JOIN first_orders fo ON o.phone_number = fo.phone_number 
          AND o.created_at = fo.first_order_date
        WHERE TO_CHAR(fo.first_order_date, 'YYYY-MM') = $1
          AND o.order_type = 'MATA'
        ORDER BY fo.first_order_date DESC
        LIMIT 1000
      `;
      
      const result = await db.query(query, [month]);
      
      res.json({
        success: true,
        endpoint: '/analytics/new-customers',
        params: { month },
        result_count: result.rows.length,
        data: result.rows
      });
      
    } catch (error) {
      console.error('❌ Error in getNewCustomers:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'analyse des nouveaux clients'
      });
    }
  }

  /**
   * 5. Taux de rétention mensuel
   * GET /api/v1/analytics/customer-retention?start_month=2025-01&end_month=2025-09
   */
  static async getCustomerRetention(req, res) {
    try {
      const start_month = req.query.start_month || '2025-01';
      const end_month = req.query.end_month || new Date().toISOString().slice(0, 7);
      
      const query = `
        WITH monthly_customers AS (
          SELECT 
            TO_CHAR(created_at, 'YYYY-MM') as month,
            phone_number
          FROM orders
          WHERE order_type = 'MATA'
            AND (interne = false OR interne IS NULL)
            AND TO_CHAR(created_at, 'YYYY-MM') >= $1
            AND TO_CHAR(created_at, 'YYYY-MM') <= $2
          GROUP BY TO_CHAR(created_at, 'YYYY-MM'), phone_number
        ),
        retention_data AS (
          SELECT 
            mc1.month,
            COUNT(DISTINCT mc1.phone_number) as customers_this_month,
            COUNT(DISTINCT mc2.phone_number) as customers_returned_next_month
          FROM monthly_customers mc1
          LEFT JOIN monthly_customers mc2 
            ON mc1.phone_number = mc2.phone_number
            AND TO_DATE(mc2.month || '-01', 'YYYY-MM-DD') = 
                TO_DATE(mc1.month || '-01', 'YYYY-MM-DD') + INTERVAL '1 month'
          GROUP BY mc1.month
        )
        SELECT 
          month,
          customers_this_month,
          customers_returned_next_month,
          CASE 
            WHEN customers_this_month > 0 
            THEN ROUND((customers_returned_next_month::numeric / customers_this_month * 100), 1)
            ELSE 0 
          END as retention_rate_percent
        FROM retention_data
        ORDER BY month
      `;
      
      const result = await db.query(query, [start_month, end_month]);
      
      res.json({
        success: true,
        endpoint: '/analytics/customer-retention',
        params: { start_month, end_month },
        result_count: result.rows.length,
        data: result.rows
      });
      
    } catch (error) {
      console.error('❌ Error in getCustomerRetention:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors du calcul du taux de rétention'
      });
    }
  }

  /**
   * 6. Distribution clients par point de vente
   * GET /api/v1/analytics/customers-by-point-vente?month=2025-09
   */
  static async getCustomersByPointVente(req, res) {
    try {
      const { month } = req.query;
      
      let query = `
        SELECT 
          point_de_vente,
          COUNT(DISTINCT phone_number) as unique_customers,
          COUNT(*) as total_orders,
          SUM(amount) as total_revenue,
          ROUND(AVG(amount), 0) as avg_order_amount
        FROM orders
        WHERE order_type = 'MATA'
          AND (interne = false OR interne IS NULL)
          AND point_de_vente IS NOT NULL
      `;
      
      const params = [];
      if (month) {
        query += ` AND TO_CHAR(created_at, 'YYYY-MM') = $1`;
        params.push(month);
      }
      
      query += `
        GROUP BY point_de_vente
        ORDER BY total_revenue DESC
      `;
      
      const result = await db.query(query, params);
      
      res.json({
        success: true,
        endpoint: '/analytics/customers-by-point-vente',
        params: { month },
        result_count: result.rows.length,
        data: result.rows
      });
      
    } catch (error) {
      console.error('❌ Error in getCustomersByPointVente:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'analyse par point de vente'
      });
    }
  }

  /**
   * 7. Clients à panier moyen élevé (groupé UNIQUEMENT par téléphone)
   * GET /api/v1/analytics/high-value-customers?min_amount=100000
   */
  static async getHighValueCustomers(req, res) {
    try {
      const min_amount = parseInt(req.query.min_amount) || 100000;
      
      const query = `
        SELECT 
          (SELECT client_name FROM orders o2 
           WHERE o2.phone_number = orders.phone_number 
             AND o2.order_type = 'MATA'
             AND (o2.interne = false OR o2.interne IS NULL)
           ORDER BY o2.created_at DESC LIMIT 1) as client_name,
          phone_number,
          STRING_AGG(DISTINCT client_name, ', ' ORDER BY client_name) as all_client_names,
          COUNT(*) as total_orders,
          SUM(amount) as total_spent,
          ROUND(AVG(amount), 0) as avg_order_amount,
          TO_CHAR(MIN(created_at), 'DD/MM/YYYY') as first_order_date,
          TO_CHAR(MAX(created_at), 'DD/MM/YYYY') as last_order_date
        FROM orders
        WHERE order_type = 'MATA'
          AND (interne = false OR interne IS NULL)
        GROUP BY phone_number
        HAVING SUM(amount) >= $1
        ORDER BY total_spent DESC
        LIMIT 500
      `;
      
      const result = await db.query(query, [min_amount]);
      
      res.json({
        success: true,
        endpoint: '/analytics/high-value-customers',
        params: { min_amount },
        result_count: result.rows.length,
        data: result.rows
      });
      
    } catch (error) {
      console.error('❌ Error in getHighValueCustomers:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'analyse des clients à forte valeur'
      });
    }
  }

  /**
   * 8. Clients qui commandent fréquemment (groupé UNIQUEMENT par téléphone)
   * GET /api/v1/analytics/frequent-customers?min_orders=5
   */
  static async getFrequentCustomers(req, res) {
    try {
      const min_orders = parseInt(req.query.min_orders) || 5;
      
      const query = `
        SELECT 
          (SELECT client_name FROM orders o2 
           WHERE o2.phone_number = orders.phone_number 
             AND o2.order_type = 'MATA'
             AND (o2.interne = false OR o2.interne IS NULL)
           ORDER BY o2.created_at DESC LIMIT 1) as client_name,
          phone_number,
          STRING_AGG(DISTINCT client_name, ', ' ORDER BY client_name) as all_client_names,
          COUNT(*) as total_orders,
          SUM(amount) as total_spent,
          ROUND(AVG(amount), 0) as avg_order_amount,
          TO_CHAR(MIN(created_at), 'DD/MM/YYYY') as first_order_date,
          TO_CHAR(MAX(created_at), 'DD/MM/YYYY') as last_order_date,
          ROUND(
            EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 86400 / 
            NULLIF(COUNT(*) - 1, 0), 
            1
          ) as avg_days_between_orders
        FROM orders
        WHERE order_type = 'MATA'
          AND (interne = false OR interne IS NULL)
        GROUP BY phone_number
        HAVING COUNT(*) >= $1
        ORDER BY total_orders DESC
        LIMIT 500
      `;
      
      const result = await db.query(query, [min_orders]);
      
      res.json({
        success: true,
        endpoint: '/analytics/frequent-customers',
        params: { min_orders },
        result_count: result.rows.length,
        data: result.rows
      });
      
    } catch (error) {
      console.error('❌ Error in getFrequentCustomers:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'analyse des clients fréquents'
      });
    }
  }

  /**
   * 9. Clients à risque de churn (groupé UNIQUEMENT par téléphone)
   * GET /api/v1/analytics/churn-risk?threshold_days=45
   */
  static async getChurnRisk(req, res) {
    try {
      const threshold_days = parseInt(req.query.threshold_days) || 45;
      
      const query = `
        WITH customer_stats AS (
          SELECT 
            phone_number,
            COUNT(*) as total_orders,
            MAX(created_at) as last_order_date,
            ROUND(AVG(amount), 0) as avg_order_amount,
            SUM(amount) as total_spent,
            STRING_AGG(DISTINCT client_name, ', ' ORDER BY client_name) as all_client_names,
            (SELECT client_name FROM orders o2 
             WHERE o2.phone_number = orders.phone_number 
               AND o2.order_type = 'MATA'
               AND (o2.interne = false OR o2.interne IS NULL)
             ORDER BY o2.created_at DESC LIMIT 1) as client_name
          FROM orders
          WHERE order_type = 'MATA'
            AND (interne = false OR interne IS NULL)
          GROUP BY phone_number
          HAVING COUNT(*) >= 2  -- Clients récurrents uniquement
        )
        SELECT 
          client_name,
          phone_number,
          all_client_names,
          total_orders,
          TO_CHAR(last_order_date, 'DD/MM/YYYY') as last_order_date,
          EXTRACT(DAY FROM NOW() - last_order_date)::int as days_since_last_order,
          avg_order_amount,
          total_spent,
          CASE 
            WHEN EXTRACT(DAY FROM NOW() - last_order_date) > $1 * 1.5 THEN 'Élevé'
            WHEN EXTRACT(DAY FROM NOW() - last_order_date) > $1 THEN 'Moyen'
            ELSE 'Faible'
          END as churn_risk_level
        FROM customer_stats
        WHERE EXTRACT(DAY FROM NOW() - last_order_date) >= $1
        ORDER BY days_since_last_order DESC, total_spent DESC
        LIMIT 500
      `;
      
      const result = await db.query(query, [threshold_days]);
      
      res.json({
        success: true,
        endpoint: '/analytics/churn-risk',
        params: { threshold_days },
        result_count: result.rows.length,
        data: result.rows
      });
      
    } catch (error) {
      console.error('❌ Error in getChurnRisk:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'analyse du risque de churn'
      });
    }
  }

  /**
   * 10. Clients par niveau de satisfaction (groupé UNIQUEMENT par téléphone)
   * GET /api/v1/analytics/customer-satisfaction?min_rating=8&max_rating=10&min_amount=20000&max_amount=100000
   */
  static async getCustomerSatisfaction(req, res) {
    try {
      const min_rating = parseFloat(req.query.min_rating) || 0;
      const max_rating = parseFloat(req.query.max_rating) || 10;
      const min_amount = parseInt(req.query.min_amount) || 0;
      const max_amount = parseInt(req.query.max_amount) || 999999999;
      
      const query = `
        WITH customer_ratings AS (
          SELECT 
            phone_number,
            COUNT(*) as total_orders,
            COUNT(*) FILTER (WHERE average_rating IS NOT NULL) as rated_orders,
            ROUND(AVG(average_rating), 1) as avg_rating,
            ROUND(AVG(service_rating), 1) as avg_service_rating,
            ROUND(AVG(quality_rating), 1) as avg_quality_rating,
            ROUND(AVG(price_rating), 1) as avg_price_rating,
            SUM(amount) as total_spent,
            STRING_AGG(DISTINCT client_name, ', ' ORDER BY client_name) as all_client_names,
            (SELECT client_name FROM orders o2 
             WHERE o2.phone_number = orders.phone_number 
               AND o2.order_type = 'MATA'
               AND (o2.interne = false OR o2.interne IS NULL)
             ORDER BY o2.created_at DESC LIMIT 1) as client_name
          FROM orders
          WHERE order_type = 'MATA'
            AND (interne = false OR interne IS NULL)
            AND average_rating IS NOT NULL
          GROUP BY phone_number
          HAVING SUM(amount) >= $3 AND SUM(amount) <= $4
        )
        SELECT 
          client_name,
          phone_number,
          all_client_names,
          total_orders,
          rated_orders,
          avg_rating,
          avg_service_rating,
          avg_quality_rating,
          avg_price_rating,
          total_spent,
          CASE 
            WHEN avg_rating >= 9 THEN 'Très satisfait'
            WHEN avg_rating >= 7 THEN 'Satisfait'
            WHEN avg_rating >= 5 THEN 'Neutre'
            ELSE 'Insatisfait'
          END as satisfaction_level
        FROM customer_ratings
        WHERE avg_rating >= $1 AND avg_rating <= $2
        ORDER BY avg_rating DESC, total_orders DESC
        LIMIT 1000
      `;
      
      const result = await db.query(query, [min_rating, max_rating, min_amount, max_amount]);
      
      res.json({
        success: true,
        endpoint: '/analytics/customer-satisfaction',
        params: { min_rating, max_rating, min_amount, max_amount },
        result_count: result.rows.length,
        data: result.rows
      });
      
    } catch (error) {
      console.error('❌ Error in getCustomerSatisfaction:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'analyse de la satisfaction'
      });
    }
  }

  /**
   * 11. Distribution par jour de la semaine
   * GET /api/v1/analytics/customers-by-day-of-week?month=2025-09
   */
  static async getCustomersByDayOfWeek(req, res) {
    try {
      const { month } = req.query;
      
      let query = `
        SELECT 
          CASE EXTRACT(DOW FROM created_at)
            WHEN 0 THEN 'Dimanche'
            WHEN 1 THEN 'Lundi'
            WHEN 2 THEN 'Mardi'
            WHEN 3 THEN 'Mercredi'
            WHEN 4 THEN 'Jeudi'
            WHEN 5 THEN 'Vendredi'
            WHEN 6 THEN 'Samedi'
          END as day_of_week,
          EXTRACT(DOW FROM created_at) as day_number,
          COUNT(*) as total_orders,
          COUNT(DISTINCT phone_number) as unique_customers,
          SUM(amount) as total_revenue,
          ROUND(AVG(amount), 0) as avg_order_amount
        FROM orders
        WHERE order_type = 'MATA'
          AND (interne = false OR interne IS NULL)
      `;
      
      const params = [];
      if (month) {
        query += ` AND TO_CHAR(created_at, 'YYYY-MM') = $1`;
        params.push(month);
      }
      
      query += `
        GROUP BY EXTRACT(DOW FROM created_at)
        ORDER BY day_number
      `;
      
      const result = await db.query(query, params);
      
      res.json({
        success: true,
        endpoint: '/analytics/customers-by-day-of-week',
        params: { month },
        result_count: result.rows.length,
        data: result.rows
      });
      
    } catch (error) {
      console.error('❌ Error in getCustomersByDayOfWeek:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'analyse par jour de la semaine'
      });
    }
  }

  /**
   * 12. Valeur vie client (Customer Lifetime Value) - groupé UNIQUEMENT par téléphone
   * GET /api/v1/analytics/customer-lifetime-value?top=20&min_amount=20000&max_amount=100000
   */
  static async getCustomerLifetimeValue(req, res) {
    try {
      const top = Math.min(parseInt(req.query.top) || 20, 100);
      const min_amount = parseInt(req.query.min_amount) || 0;
      const max_amount = parseInt(req.query.max_amount) || 999999999;
      
      const query = `
        WITH customer_metrics AS (
          SELECT 
            phone_number,
            COUNT(*) as total_orders,
            SUM(amount) as total_revenue,
            ROUND(AVG(amount), 0) as avg_order_value,
            MIN(created_at) as first_order_date,
            MAX(created_at) as last_order_date,
            EXTRACT(DAY FROM MAX(created_at) - MIN(created_at)) as customer_lifespan_days,
            ROUND(
              EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 86400 / 
              NULLIF(COUNT(*) - 1, 0), 
              1
            ) as avg_days_between_orders,
            STRING_AGG(DISTINCT client_name, ', ' ORDER BY client_name) as all_client_names,
            (SELECT client_name FROM orders o2 
             WHERE o2.phone_number = orders.phone_number 
               AND o2.order_type = 'MATA'
               AND (o2.interne = false OR o2.interne IS NULL)
             ORDER BY o2.created_at DESC LIMIT 1) as client_name
          FROM orders
          WHERE order_type = 'MATA'
            AND (interne = false OR interne IS NULL)
          GROUP BY phone_number
          HAVING SUM(amount) >= $2 AND SUM(amount) <= $3
        )
        SELECT 
          client_name,
          phone_number,
          all_client_names,
          total_orders,
          total_revenue as lifetime_value,
          avg_order_value,
          TO_CHAR(first_order_date, 'DD/MM/YYYY') as first_order_date,
          TO_CHAR(last_order_date, 'DD/MM/YYYY') as last_order_date,
          customer_lifespan_days,
          avg_days_between_orders,
          CASE 
            WHEN customer_lifespan_days > 0 
            THEN ROUND((total_revenue / NULLIF(customer_lifespan_days, 0)) * 30, 0)
            ELSE total_revenue 
          END as estimated_monthly_value
        FROM customer_metrics
        WHERE total_orders >= 2
        ORDER BY lifetime_value DESC
        LIMIT $1
      `;
      
      const result = await db.query(query, [top, min_amount, max_amount]);
      
      res.json({
        success: true,
        endpoint: '/analytics/customer-lifetime-value',
        params: { top, min_amount, max_amount },
        result_count: result.rows.length,
        data: result.rows
      });
      
    } catch (error) {
      console.error('❌ Error in getCustomerLifetimeValue:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors du calcul de la valeur vie client'
      });
    }
  }

  /**
   * 13. Détails complets des commandes (FALLBACK)
   * GET /api/v1/analytics/orders-detailed?start_date=2025-09-01&end_date=2025-09-30&limit=1000
   */
  static async getOrdersDetailed(req, res) {
    try {
      const { 
        start_date, 
        end_date, 
        limit = 1000,
        phone_number
      } = req.query;
      
      // Validation
      const maxLimit = 5000;
      const finalLimit = Math.min(parseInt(limit) || 1000, maxLimit);
      
      // Dates par défaut
      const defaultStartDate = new Date();
      defaultStartDate.setDate(1); // Début du mois
      const defaultEndDate = new Date();
      
      const startDate = start_date || defaultStartDate.toISOString().split('T')[0];
      const endDate = end_date || defaultEndDate.toISOString().split('T')[0];
      
      // Construire la clause WHERE dynamiquement
      const whereConditions = [
        "o.order_type = 'MATA'",
        "(o.interne = false OR o.interne IS NULL)",
        "o.created_at::date >= $1::date",
        "o.created_at::date <= $2::date"
      ];
      
      const queryParams = [startDate, endDate];
      
      // Ajouter le filtre par numéro de téléphone si fourni
      if (phone_number) {
        queryParams.push(phone_number);
        whereConditions.push(`o.phone_number = $${queryParams.length}`);
      }
      
      // Ajouter le limit en dernier
      queryParams.push(finalLimit);
      const limitParamIndex = queryParams.length;
      
      // SQL PRÉDÉFINI avec TOUS les détails
      const query = `
        WITH order_stats AS (
          SELECT 
            phone_number,
            COUNT(*) as total_orders_count,
            MIN(created_at) as first_order_date
          FROM orders
          WHERE order_type = 'MATA'
            AND (interne = false OR interne IS NULL)
          GROUP BY phone_number
        )
        SELECT 
          o.id as order_id,
          o.client_name,
          o.phone_number,
          TO_CHAR(o.created_at, 'DD/MM/YYYY') as order_date,
          TO_CHAR(o.created_at, 'HH24:MI') as order_time,
          CASE EXTRACT(DOW FROM o.created_at)
            WHEN 0 THEN 'Dimanche'
            WHEN 1 THEN 'Lundi'
            WHEN 2 THEN 'Mardi'
            WHEN 3 THEN 'Mercredi'
            WHEN 4 THEN 'Jeudi'
            WHEN 5 THEN 'Vendredi'
            WHEN 6 THEN 'Samedi'
          END as day_of_week,
          o.amount,
          o.course_price,
          o.point_de_vente,
          o.adresse_source,
          o.adresse_destination,
          o.source_connaissance,
          o.commentaire,
          o.service_rating,
          o.quality_rating,
          o.price_rating,
          o.commercial_service_rating,
          o.average_rating,
          
          -- Stats client
          os.total_orders_count,
          (SELECT COUNT(*) 
           FROM orders o2 
           WHERE o2.phone_number = o.phone_number 
             AND o2.order_type = 'MATA'
             AND TO_CHAR(o2.created_at, 'YYYY-MM') = TO_CHAR(o.created_at, 'YYYY-MM')
             AND (o2.interne = false OR o2.interne IS NULL)
          ) as orders_this_month_count,
          CASE 
            WHEN os.total_orders_count = 1 THEN true 
            ELSE false 
          END as is_new_client,
          TO_CHAR(os.first_order_date, 'DD/MM/YYYY') as client_first_order_date
          
        FROM orders o
        JOIN order_stats os ON o.phone_number = os.phone_number
        WHERE ${whereConditions.join('\n          AND ')}
        ORDER BY o.created_at DESC
        LIMIT $${limitParamIndex}
      `;
      
      const result = await db.query(query, queryParams);
      
      res.json({
        success: true,
        endpoint: '/analytics/orders-detailed',
        period: {
          start_date: startDate,
          end_date: endDate
        },
        result_count: result.rows.length,
        data: result.rows,
        metadata: {
          limit_applied: finalLimit,
          truncated: result.rows.length >= finalLimit
        }
      });
      
    } catch (error) {
      console.error('❌ Error in getOrdersDetailed:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des détails des commandes'
      });
    }
  }
}

module.exports = MataAnalyticsController;

