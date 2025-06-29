const db = require('../models/database');
const gpsSettings = require('../config/gps-settings.json');

class GpsAnalyticsController {
  // Calculer les métriques quotidiennes
  static async calculateDailyMetrics(req, res) {
    try {
      const { date } = req.query;
      const targetDate = date || new Date().toISOString().split('T')[0];

      // Vérifier les permissions
      if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé'
        });
      }

      const query = 'SELECT calculate_daily_metrics($1) as processed_count';
      const result = await db.query(query, [targetDate]);

      res.json({
        success: true,
        message: 'Métriques calculées avec succès',
        data: {
          date: targetDate,
          processed_livreurs: result.rows[0].processed_count
        }
      });

    } catch (error) {
      console.error('❌ Erreur lors du calcul des métriques:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  }

  // Obtenir les performances quotidiennes
  static async getDailyPerformance(req, res) {
    try {
      const { date, period, livreurId } = req.query;
      const userRole = req.user.role;
      const currentUserId = req.user.id;
      
      let query = `
        SELECT * FROM gps_daily_performance 
        WHERE 1=1
      `;
      const params = [];

      // Si l'utilisateur est un livreur, filtrer automatiquement ses données
      if (userRole === 'LIVREUR') {
        params.push(currentUserId);
        query += ` AND livreur_id = $${params.length}`;
      } else if (livreurId) {
        // Pour les managers/admins, permettre de filtrer par livreur spécifique
        params.push(livreurId);
        query += ` AND livreur_id = $${params.length}`;
      }

      if (period) {
        query += ` AND tracking_date >= CURRENT_DATE - INTERVAL '${parseInt(period)} days'`;
      }

      if (date) {
        params.push(date);
        query += ` AND tracking_date = $${params.length}`;
      }

      // Limiter aux 30 derniers jours si aucune date spécifiée
      if (!date && !period) {
        query += ` AND tracking_date >= CURRENT_DATE - INTERVAL '30 days'`;
      }

      query += ` ORDER BY tracking_date DESC, route_efficiency_score DESC LIMIT 100`;

      const result = await db.query(query, params);

      res.json({
        success: true,
        data: result.rows,
        count: result.rows.length
      });

    } catch (error) {
      console.error('❌ Erreur lors de la récupération des performances:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  }

  // Obtenir les tendances hebdomadaires
  static async getWeeklyTrends(req, res) {
    try {
      const { livreurId, weeks = 8 } = req.query;

      let query = `
        SELECT * FROM gps_weekly_trends 
        WHERE week_start >= CURRENT_DATE - INTERVAL '${parseInt(weeks)} weeks'
      `;
      const params = [];

      if (livreurId) {
        params.push(livreurId);
        query += ` AND livreur_id = $${params.length}`;
      }

      query += ` ORDER BY week_start DESC, avg_route_efficiency DESC`;

      const result = await db.query(query, params);

      res.json({
        success: true,
        data: result.rows,
        count: result.rows.length
      });

    } catch (error) {
      console.error('❌ Erreur lors de la récupération des tendances:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  }

  // Obtenir le classement des livreurs
  static async getLivreurRankings(req, res) {
    try {
      const { month } = req.query;
      const targetMonth = month || new Date().toISOString().slice(0, 7) + '-01';

      const query = `
        SELECT * FROM gps_livreur_rankings 
        WHERE DATE_TRUNC('month', month) = DATE_TRUNC('month', $1::date)
        ORDER BY global_score DESC
      `;

      const result = await db.query(query, [targetMonth]);

      res.json({
        success: true,
        data: result.rows,
        count: result.rows.length,
        month: targetMonth
      });

    } catch (error) {
      console.error('❌ Erreur lors de la récupération du classement:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  }

  // Obtenir les statistiques globales d'analytics
  static async getAnalyticsOverview(req, res) {
    try {
      const { period = '30' } = req.query; // derniers X jours

      // Statistiques générales
      const overviewQuery = `
        WITH recent_metrics AS (
          SELECT * FROM gps_daily_metrics 
          WHERE tracking_date >= CURRENT_DATE - INTERVAL '${parseInt(period)} days'
        ),
        performance_stats AS (
          SELECT 
            COUNT(DISTINCT livreur_id) as active_livreurs,
            COUNT(*) as total_tracking_days,
            SUM(total_distance_km) as total_distance,
            AVG(route_efficiency_score) as avg_efficiency,
            AVG(fuel_efficiency_score) as avg_fuel_efficiency,
            AVG(average_speed_kmh) as avg_speed
          FROM recent_metrics
        ),
        top_performers AS (
          SELECT 
            livreur_id,
            u.username,
            AVG(route_efficiency_score) as avg_score
          FROM recent_metrics rm
          JOIN users u ON rm.livreur_id = u.id
          GROUP BY livreur_id, u.username
          ORDER BY avg_score DESC
          LIMIT 5
        ),
        efficiency_distribution AS (
          SELECT 
            CASE 
              WHEN route_efficiency_score >= 80 THEN 'Excellent'
              WHEN route_efficiency_score >= 60 THEN 'Bon'
              WHEN route_efficiency_score >= 40 THEN 'Moyen'
              ELSE 'À améliorer'
            END as performance_level,
            COUNT(*) as count,
            ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
          FROM recent_metrics
          GROUP BY 
            CASE 
              WHEN route_efficiency_score >= 80 THEN 'Excellent'
              WHEN route_efficiency_score >= 60 THEN 'Bon'
              WHEN route_efficiency_score >= 40 THEN 'Moyen'
              ELSE 'À améliorer'
            END
        )
        SELECT 
          (SELECT row_to_json(performance_stats) FROM performance_stats) as global_stats,
          (SELECT json_agg(top_performers) FROM top_performers) as top_performers,
          (SELECT json_agg(efficiency_distribution) FROM efficiency_distribution) as efficiency_distribution
      `;

      const result = await db.query(overviewQuery);
      const data = result.rows[0];

      res.json({
        success: true,
        data: {
          period_days: parseInt(period),
          global_stats: data.global_stats,
          top_performers: data.top_performers,
          efficiency_distribution: data.efficiency_distribution
        }
      });

    } catch (error) {
      console.error('❌ Erreur lors de la récupération de l\'aperçu analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  }

  // Obtenir l'analyse comparative des livreurs
  static async getLivreurComparison(req, res) {
    try {
      const { livreurIds, metric = 'route_efficiency_score', period = '30' } = req.body;

      if (!livreurIds || !Array.isArray(livreurIds) || livreurIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Liste des IDs livreurs requise'
        });
      }

      const placeholders = livreurIds.map((_, i) => `$${i + 1}`).join(',');
      
      const query = `
        SELECT 
          dm.livreur_id,
          u.username as livreur_username,
          dm.tracking_date,
          dm.${metric},
          AVG(dm.${metric}) OVER (PARTITION BY dm.livreur_id) as avg_metric
        FROM gps_daily_metrics dm
        JOIN users u ON dm.livreur_id = u.id
        WHERE dm.livreur_id IN (${placeholders})
          AND dm.tracking_date >= CURRENT_DATE - INTERVAL '${parseInt(period)} days'
        ORDER BY dm.tracking_date DESC, dm.${metric} DESC
      `;

      const result = await db.query(query, livreurIds);

      res.json({
        success: true,
        data: result.rows,
        comparison_metric: metric,
        period_days: parseInt(period)
      });

    } catch (error) {
      console.error('❌ Erreur lors de la comparaison des livreurs:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  }

  // Obtenir les zones et leurs statistiques
  static async getZoneAnalytics(req, res) {
    try {
      const zonesQuery = `
        SELECT 
          z.*,
          COUNT(ze.id) as total_events,
          COUNT(CASE WHEN ze.event_type = 'enter' THEN 1 END) as entries,
          COUNT(CASE WHEN ze.event_type = 'exit' THEN 1 END) as exits,
          AVG(ze.duration_minutes) as avg_duration_minutes,
          COUNT(DISTINCT ze.livreur_id) as unique_livreurs
        FROM gps_zones z
        LEFT JOIN gps_zone_events ze ON z.id = ze.zone_id
          AND ze.event_timestamp >= CURRENT_DATE - INTERVAL '30 days'
        WHERE z.is_active = true
        GROUP BY z.id, z.zone_name, z.zone_type, z.center_latitude, 
                 z.center_longitude, z.radius_meters, z.is_active, z.created_at
        ORDER BY total_events DESC
      `;

      const result = await db.query(zonesQuery);

      res.json({
        success: true,
        data: result.rows,
        count: result.rows.length
      });

    } catch (error) {
      console.error('❌ Erreur lors de la récupération des analytics de zones:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  }

  // Obtenir les données GPS mensuelles par livreur
  static async getMonthlyGpsSummary(req, res) {
    try {
      const { month } = req.query;
      const targetMonth = month || new Date().toISOString().slice(0, 7);

      const query = `
        SELECT 
          gdm.livreur_id,
          u.username as livreur_username,
          SUM(gdm.total_distance_km) as total_distance_km,
          SUM(gdm.total_time_minutes) as total_time_minutes,
          COUNT(gdm.tracking_date) as total_tracking_days,
          AVG(gdm.average_speed_kmh) as avg_speed_kmh,
          AVG(gdm.route_efficiency_score) as avg_route_efficiency,
          AVG(gdm.fuel_efficiency_score) as avg_fuel_efficiency
        FROM gps_daily_metrics gdm
        JOIN users u ON gdm.livreur_id = u.id
        WHERE DATE_TRUNC('month', gdm.tracking_date) = DATE_TRUNC('month', $1::date)
        GROUP BY gdm.livreur_id, u.username
        ORDER BY total_distance_km DESC
      `;

      const result = await db.query(query, [targetMonth + '-01']);

      res.json({
        success: true,
        data: result.rows,
        month: targetMonth,
        count: result.rows.length
      });

    } catch (error) {
      console.error('❌ Erreur lors de la récupération du résumé GPS mensuel:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  }

  // Obtenir les données GPS quotidiennes par livreur
  static async getDailyGpsSummary(req, res) {
    try {
      const { month } = req.query;
      const targetMonth = month || new Date().toISOString().slice(0, 7);

      const query = `
        SELECT 
          gdm.livreur_id,
          u.username as livreur_username,
          gdm.tracking_date,
          gdm.total_distance_km,
          gdm.total_time_minutes,
          gdm.average_speed_kmh,
          gdm.route_efficiency_score,
          gdm.fuel_efficiency_score
        FROM gps_daily_metrics gdm
        JOIN users u ON gdm.livreur_id = u.id
        WHERE DATE_TRUNC('month', gdm.tracking_date) = DATE_TRUNC('month', $1::date)
        ORDER BY gdm.tracking_date DESC, u.username
      `;

      const result = await db.query(query, [targetMonth + '-01']);

      res.json({
        success: true,
        data: result.rows,
        month: targetMonth,
        count: result.rows.length
      });

    } catch (error) {
      console.error('❌ Erreur lors de la récupération des données GPS quotidiennes:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  }

  // Export des données analytics en CSV
  static async exportAnalytics(req, res) {
    try {
      const { type = 'daily_performance', startDate, endDate, livreurId } = req.query;

      let query = '';
      let params = [];

      switch (type) {
        case 'daily_performance':
          query = `
            SELECT 
              livreur_username as "Livreur",
              tracking_date as "Date",
              total_distance_km as "Distance (km)",
              total_time_minutes as "Temps total (min)",
              average_speed_kmh as "Vitesse moyenne (km/h)",
              route_efficiency_score as "Score efficacité",
              performance_rating as "Évaluation"
            FROM gps_daily_performance
            WHERE 1=1
          `;
          break;

        case 'weekly_trends':
          query = `
            SELECT 
              livreur_username as "Livreur",
              week_start as "Semaine",
              days_worked as "Jours travaillés",
              total_distance_km as "Distance totale (km)",
              avg_route_efficiency as "Score efficacité moyen"
            FROM gps_weekly_trends
            WHERE 1=1
          `;
          break;

        default:
          return res.status(400).json({
            success: false,
            message: 'Type d\'export non supporté'
          });
      }

      if (startDate) {
        params.push(startDate);
        query += ` AND tracking_date >= $${params.length}`;
      }

      if (endDate) {
        params.push(endDate);
        query += ` AND tracking_date <= $${params.length}`;
      }

      if (livreurId) {
        params.push(livreurId);
        query += ` AND livreur_id = $${params.length}`;
      }

      query += ' ORDER BY tracking_date DESC';

      const result = await db.query(query, params);

      // Convertir en CSV
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Aucune donnée trouvée pour l\'export'
        });
      }

      const headers = Object.keys(result.rows[0]);
      const csvContent = [
        headers.join(','),
        ...result.rows.map(row => 
          headers.map(header => `"${row[header] || ''}"`).join(',')
        )
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analytics_${type}_${Date.now()}.csv"`);
      res.send(csvContent);

    } catch (error) {
      console.error('❌ Erreur lors de l\'export analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'export'
      });
    }
  }
}

module.exports = GpsAnalyticsController; 