const GpsLocation = require('../models/GpsLocation');
const GpsSettings = require('../models/GpsSettings');
const User = require('../models/User');
const gpsConfig = require('../config/gps-settings.json');
const db = require('../models/database');

class GpsController {
  // Enregistrer une position GPS (pour les livreurs)
  static async recordLocation(req, res) {
    try {
      const { latitude, longitude, accuracy, is_active, battery_level, speed, timestamp } = req.body;
      const livreur_id = req.user.id;

      // Vérifier que l'utilisateur est un livreur
      if (req.user.role !== 'LIVREUR') {
        return res.status(403).json({
          success: false,
          message: 'Seuls les livreurs peuvent enregistrer leur position'
        });
      }

      // Valider les données GPS
      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: 'Latitude et longitude sont requis'
        });
      }

      // Vérifier que le suivi est activé pour ce livreur
      const settings = await GpsSettings.getByLivreurId(livreur_id);
      if (!settings.tracking_enabled) {
        return res.status(403).json({
          success: false,
          message: 'Le suivi GPS n\'est pas activé pour ce livreur'
        });
      }

      // Valider la précision
      if (accuracy && accuracy > gpsConfig.tracking.maxAccuracy) {
        return res.status(400).json({
          success: false,
          message: `Précision GPS insuffisante (${accuracy}m > ${gpsConfig.tracking.maxAccuracy}m)`
        });
      }

      // Enregistrer la position
      const location = await GpsLocation.create({
        livreur_id,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        accuracy: accuracy ? parseFloat(accuracy) : null,
        is_active: is_active !== undefined ? is_active : true,
        battery_level: battery_level ? parseInt(battery_level) : null,
        speed: speed ? parseFloat(speed) : null,
        timestamp
      });

      // NOUVEAU: Calculer automatiquement les métriques quotidiennes
      await GpsController.updateDailyMetrics(livreur_id);

      res.status(201).json({
        success: true,
        message: 'Position GPS enregistrée',
        data: location.toJSON()
      });

    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de la position GPS:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // NOUVEAU: Mettre à jour les métriques quotidiennes automatiquement
  static async updateDailyMetrics(livreur_id) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Calculer les métriques pour aujourd'hui
      const metricsQuery = `
        WITH daily_positions AS (
          SELECT 
            latitude, longitude, accuracy, speed, timestamp,
            LAG(latitude) OVER (ORDER BY timestamp) as prev_lat,
            LAG(longitude) OVER (ORDER BY timestamp) as prev_lng,
            LAG(timestamp) OVER (ORDER BY timestamp) as prev_time
          FROM gps_locations 
          WHERE livreur_id = $1 
            AND DATE(timestamp) = $2
            AND accuracy <= 100  -- Seulement positions précises pour calculs
          ORDER BY timestamp
        ),
        distance_calculations AS (
          SELECT 
            COUNT(*) as position_count,
            MIN(timestamp) as start_time,
            MAX(timestamp) as end_time,
            SUM(
              CASE 
                WHEN prev_lat IS NOT NULL AND prev_lng IS NOT NULL 
                THEN calculate_gps_distance(prev_lat, prev_lng, latitude, longitude) / 1000.0
                ELSE 0 
              END
            ) as total_distance_km,
            AVG(NULLIF(speed * 3.6, 0)) as avg_speed_kmh,  -- Convertir m/s en km/h
            MAX(speed * 3.6) as max_speed_kmh
          FROM daily_positions
        )
        SELECT 
          COALESCE(total_distance_km, 0) as total_distance_km,
          COALESCE(EXTRACT(EPOCH FROM (end_time - start_time)) / 60.0, 0) as total_time_minutes,
          COALESCE(avg_speed_kmh, 0) as average_speed_kmh,
          COALESCE(max_speed_kmh, 0) as max_speed_kmh,
          -- Calculs d'efficacité
          CASE 
            WHEN avg_speed_kmh > 0 AND avg_speed_kmh <= 40
            THEN LEAST(100, (avg_speed_kmh / 25.0) * 100)
            ELSE 50 
          END as fuel_efficiency_score,
          CASE 
            WHEN total_distance_km > 0 
            THEN LEAST(100, GREATEST(20, total_distance_km * 10))
            ELSE 0 
          END as route_efficiency_score
        FROM distance_calculations
      `;

      const result = await db.query(metricsQuery, [livreur_id, today]);
      const metrics = result.rows[0];

      if (!metrics) return;

      // Insérer ou mettre à jour les métriques
      const upsertQuery = `
        INSERT INTO gps_daily_metrics (
          livreur_id, tracking_date, total_distance_km, total_time_minutes,
          active_time_minutes, average_speed_kmh, max_speed_kmh, 
          fuel_efficiency_score, route_efficiency_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (livreur_id, tracking_date) 
        DO UPDATE SET
          total_distance_km = EXCLUDED.total_distance_km,
          total_time_minutes = EXCLUDED.total_time_minutes,
          active_time_minutes = EXCLUDED.active_time_minutes,
          average_speed_kmh = EXCLUDED.average_speed_kmh,
          max_speed_kmh = EXCLUDED.max_speed_kmh,
          fuel_efficiency_score = EXCLUDED.fuel_efficiency_score,
          route_efficiency_score = EXCLUDED.route_efficiency_score
      `;

      await db.query(upsertQuery, [
        livreur_id,
        today,
        parseFloat(metrics.total_distance_km),
        Math.round(parseFloat(metrics.total_time_minutes)), // Convert to integer
        Math.round(parseFloat(metrics.total_time_minutes) * 0.8), // Convert to integer
        parseFloat(metrics.average_speed_kmh),
        parseFloat(metrics.max_speed_kmh),
        parseFloat(metrics.fuel_efficiency_score),
        parseFloat(metrics.route_efficiency_score)
      ]);

      console.log(`✅ Métriques mises à jour pour le livreur ${livreur_id} - ${today}`);

    } catch (error) {
      console.error('❌ Erreur lors du calcul des métriques quotidiennes:', error);
      // Ne pas faire échouer l'enregistrement GPS si le calcul des métriques échoue
    }
  }

  // Obtenir toutes les dernières positions (pour managers/admins)
  static async getAllLatestPositions(req, res) {
    try {
      const positions = await GpsLocation.getAllLatestPositions();

      res.json({
        success: true,
        data: positions,
        count: positions.length
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des positions:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  }

  // Obtenir la dernière position d'un livreur spécifique
  static async getLocationByLivreur(req, res) {
    try {
      const { livreurId } = req.params;

      // Vérifier que le livreur existe
      const livreur = await User.findById(livreurId);
      if (!livreur || livreur.role !== 'LIVREUR') {
        return res.status(404).json({
          success: false,
          message: 'Livreur non trouvé'
        });
      }

      const location = await GpsLocation.getLatestPosition(livreurId);

      if (!location) {
        return res.status(404).json({
          success: false,
          message: 'Aucune position GPS trouvée pour ce livreur'
        });
      }

      res.json({
        success: true,
        data: location.toJSON()
      });

    } catch (error) {
      console.error('Erreur lors de la récupération de la position:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  }

  // Obtenir l'historique des positions d'un livreur
  static async getLocationHistory(req, res) {
    try {
      const { livreurId } = req.params;
      const { startDate, endDate, limit = 1000 } = req.query;

      // Vérifier les permissions
      if (req.user.role === 'LIVREUR' && req.user.id !== livreurId) {
        return res.status(403).json({
          success: false,
          message: 'Vous ne pouvez consulter que votre propre historique'
        });
      }

      const start = startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const history = await GpsLocation.getLocationHistory(livreurId, start, end, parseInt(limit));

      res.json({
        success: true,
        data: history.map(loc => loc.toJSON()),
        count: history.length,
        period: { startDate: start, endDate: end }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération de l\'historique:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  }

  // Calculer la distance parcourue par un livreur
  static async calculateDistance(req, res) {
    try {
      const { livreurId } = req.params;
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate) : new Date().setHours(0, 0, 0, 0);
      const end = endDate ? new Date(endDate) : new Date().setHours(23, 59, 59, 999);

      const distanceMeters = await GpsLocation.calculateTotalDistance(livreurId, start, end);
      const distanceKm = distanceMeters / 1000;

      // Obtenir les statistiques du trajet
      const stats = await GpsLocation.getTrajectoryStats(livreurId, new Date(start).toISOString().split('T')[0]);

      res.json({
        success: true,
        data: {
          distance_meters: Math.round(distanceMeters),
          distance_km: Math.round(distanceKm * 100) / 100,
          trajectory_stats: stats,
          period: { startDate: start, endDate: end }
        }
      });

    } catch (error) {
      console.error('Erreur lors du calcul de distance:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  }

  // Activer/désactiver le suivi GPS
  static async toggleTracking(req, res) {
    try {
      const { enabled, permission_granted } = req.body;
      const livreur_id = req.user.id;

      // Seuls les livreurs peuvent modifier leur propre suivi
      if (req.user.role !== 'LIVREUR') {
        return res.status(403).json({
          success: false,
          message: 'Seuls les livreurs peuvent modifier leur suivi GPS'
        });
      }

      const settings = await GpsSettings.toggleTracking(livreur_id, enabled, permission_granted);

      res.json({
        success: true,
        message: `Suivi GPS ${enabled ? 'activé' : 'désactivé'}`,
        data: settings.toJSON()
      });

    } catch (error) {
      console.error('Erreur lors de la modification du suivi:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  }

  // Obtenir les paramètres GPS d'un livreur
  static async getSettings(req, res) {
    try {
      const livreur_id = req.user.role === 'LIVREUR' ? req.user.id : req.params.livreurId;

      if (!livreur_id) {
        return res.status(400).json({
          success: false,
          message: 'ID livreur requis'
        });
      }

      const settings = await GpsSettings.getByLivreurId(livreur_id);

      res.json({
        success: true,
        data: settings.toJSON(),
        config: gpsConfig
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des paramètres:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  }

  // Mettre à jour l'intervalle de suivi
  static async updateInterval(req, res) {
    try {
      const { interval } = req.body;
      const livreur_id = req.user.id;

      if (req.user.role !== 'LIVREUR') {
        return res.status(403).json({
          success: false,
          message: 'Seuls les livreurs peuvent modifier leur intervalle'
        });
      }

      // Valider l'intervalle
      if (interval < gpsConfig.tracking.minInterval || interval > gpsConfig.tracking.maxInterval) {
        return res.status(400).json({
          success: false,
          message: `Intervalle invalide (${gpsConfig.tracking.minInterval}-${gpsConfig.tracking.maxInterval}ms)`
        });
      }

      const settings = await GpsSettings.updateInterval(livreur_id, interval);

      res.json({
        success: true,
        message: 'Intervalle de suivi mis à jour',
        data: settings.toJSON()
      });

    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'intervalle:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  }

  // Obtenir les livreurs hors ligne
  static async getOfflineLivreurs(req, res) {
    try {
      const { minutes = 5 } = req.query;
      const offlineLivreurs = await GpsLocation.getOfflineLivreurs(parseInt(minutes));

      res.json({
        success: true,
        data: offlineLivreurs,
        count: offlineLivreurs.length,
        threshold_minutes: parseInt(minutes)
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des livreurs hors ligne:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  }

  // Supprimer l'historique GPS d'un livreur
  static async deleteHistory(req, res) {
    try {
      const { livreurId } = req.params;
      const { beforeDate } = req.query;

      // Seuls les admins peuvent supprimer l'historique
      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Seuls les administrateurs peuvent supprimer l\'historique GPS'
        });
      }

      const deletedCount = await GpsLocation.deleteHistory(
        livreurId, 
        beforeDate ? new Date(beforeDate) : null
      );

      res.json({
        success: true,
        message: 'Historique GPS supprimé',
        deleted_count: deletedCount
      });

    } catch (error) {
      console.error('Erreur lors de la suppression de l\'historique:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  }

  // Obtenir les statistiques GPS générales
  static async getStats(req, res) {
    try {
      const gpsStats = await GpsSettings.getStats();
      const offlineLivreurs = await GpsLocation.getOfflineLivreurs();

      res.json({
        success: true,
        data: {
          ...gpsStats,
          offline_livreurs: offlineLivreurs.length,
          online_livreurs: parseInt(gpsStats.tracking_enabled) - offlineLivreurs.length
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  }

  // Nettoyer les anciennes données GPS
  static async cleanupOldData(req, res) {
    try {
      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Seuls les administrateurs peuvent nettoyer les données'
        });
      }

      const deletedCount = await GpsLocation.cleanupOldData();

      res.json({
        success: true,
        message: 'Nettoyage des anciennes données effectué',
        deleted_count: deletedCount
      });

    } catch (error) {
      console.error('Erreur lors du nettoyage:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  }
}

module.exports = GpsController;