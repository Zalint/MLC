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

      // NOUVEAU: Vérifier les heures de tracking configurées
      const trackingAllowed = await isTrackingAllowed(livreur_id);
      if (!trackingAllowed) {
        return res.status(403).json({
          success: false,
          message: 'Tracking GPS non autorisé en dehors des heures configurées',
          code: 'TRACKING_HOURS_RESTRICTED'
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

// Get daily trace for a specific livreur and date
const getDailyTrace = async (req, res) => {
  try {
    const { livreur_id, date } = req.params;
    
    // Validate parameters
    if (!livreur_id || !date) {
      return res.status(400).json({ 
        success: false, 
        message: 'livreur_id et date sont requis' 
      });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Format de date invalide. Utilisez YYYY-MM-DD' 
      });
    }

    console.log(`📍 Récupération tracé pour livreur ${livreur_id} le ${date}`);

    // Get GPS points for the specific day
    const traceQuery = `
      SELECT 
        latitude,
        longitude,
        timestamp,
        accuracy,
        speed,
        EXTRACT(EPOCH FROM timestamp) as timestamp_epoch
      FROM gps_locations 
      WHERE livreur_id = $1 
        AND DATE(timestamp) = $2
        AND accuracy <= 100
      ORDER BY timestamp ASC
    `;

    const traceResult = await db.query(traceQuery, [livreur_id, date]);
    const gpsPoints = traceResult.rows;

    if (gpsPoints.length === 0) {
      return res.json({
        success: true,
        message: 'Aucun point GPS trouvé pour cette date',
        data: {
          livreur_id: parseInt(livreur_id),
          date: date,
          points: [],
          summary: null
        }
      });
    }

    // Calculate summary statistics
    const firstPoint = gpsPoints[0];
    const lastPoint = gpsPoints[gpsPoints.length - 1];
    
    // Calculate total distance using consecutive points
    let totalDistance = 0;
    for (let i = 1; i < gpsPoints.length; i++) {
      const prev = gpsPoints[i - 1];
      const curr = gpsPoints[i];
      const distance = calculateDistance(
        parseFloat(prev.latitude),
        parseFloat(prev.longitude),
        parseFloat(curr.latitude),
        parseFloat(curr.longitude)
      );
      totalDistance += distance;
    }

    // Calculate duration in minutes
    const startTime = new Date(firstPoint.timestamp);
    const endTime = new Date(lastPoint.timestamp);
    const durationMinutes = Math.round((endTime - startTime) / 1000 / 60);

    // Calculate average speed
    const averageSpeed = durationMinutes > 0 ? (totalDistance / durationMinutes * 60) : 0;

    // Calculate max speed from recorded speeds
    const maxSpeed = Math.max(...gpsPoints.map(p => parseFloat(p.speed) || 0));

    const summary = {
      total_distance_km: Math.round(totalDistance * 100) / 100,
      duration_minutes: durationMinutes,
      start_time: firstPoint.timestamp,
      end_time: lastPoint.timestamp,
      total_points: gpsPoints.length,
      average_speed_kmh: Math.round(averageSpeed * 100) / 100,
      max_speed_kmh: Math.round(maxSpeed * 100) / 100
    };

    console.log(`✅ Tracé récupéré: ${gpsPoints.length} points, ${summary.total_distance_km}km`);

    res.json({
      success: true,
      data: {
        livreur_id: parseInt(livreur_id),
        date: date,
        points: gpsPoints,
        summary: summary
      }
    });

  } catch (error) {
    console.error('❌ Erreur lors de la récupération du tracé:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de la récupération du tracé' 
    });
  }
};

// Helper function to calculate distance between two GPS points (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
};

// Get available livreurs with GPS data
const getAvailableLivreurs = async (req, res) => {
  try {
    console.log('📋 Récupération des livreurs disponibles avec données GPS');

    const livreursQuery = `
      SELECT DISTINCT 
        u.id,
        u.username,
        COUNT(gl.id) as total_points,
        MAX(DATE(gl.timestamp)) as last_gps_date,
        MIN(DATE(gl.timestamp)) as first_gps_date
      FROM users u
      INNER JOIN gps_locations gl ON u.id = gl.livreur_id
      WHERE u.role = 'LIVREUR'
        AND gl.timestamp >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY u.id, u.username
      ORDER BY last_gps_date DESC, u.username ASC
    `;

    const result = await db.query(livreursQuery);
    
    console.log(`✅ ${result.rows.length} livreurs trouvés avec données GPS`);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('❌ Erreur lors de la récupération des livreurs:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de la récupération des livreurs' 
    });
  }
};

// Vérifier si le tracking GPS est autorisé pour un livreur à l'heure actuelle
const isTrackingAllowed = async (livreur_id) => {
  try {
    // Récupérer la configuration de tracking du livreur (avec fallback si colonnes n'existent pas)
    const configQuery = `
      SELECT 
        id,
        username,
        COALESCE(tracking_start_hour, 9) as tracking_start_hour,
        COALESCE(tracking_end_hour, 21) as tracking_end_hour,
        COALESCE(tracking_timezone, 'Africa/Dakar') as tracking_timezone,
        COALESCE(tracking_enabled_days, '0,1,2,3,4,5,6') as tracking_enabled_days,
        COALESCE(gps_tracking_active, true) as gps_tracking_active
      FROM users 
      WHERE id = $1 AND role = 'LIVREUR'
    `;
    
    const configResult = await db.query(configQuery, [livreur_id]);
    
    if (configResult.rows.length === 0) {
      console.log(`⚠️ Livreur ${livreur_id} non trouvé ou n'est pas un livreur`);
      return false;
    }
    
    const config = configResult.rows[0];
    
    // Vérifier si le tracking GPS est activé pour ce livreur
    if (!config.gps_tracking_active) {
      console.log(`🔴 Tracking GPS désactivé pour le livreur ${livreur_id}`);
      return false;
    }
    
    // Obtenir l'heure actuelle dans le fuseau horaire du livreur (Dakar par défaut)
    const now = new Date();
    const dakarTime = new Date(now.toLocaleString("en-US", {timeZone: config.tracking_timezone || "Africa/Dakar"}));
    const currentHour = dakarTime.getHours();
    const currentDay = dakarTime.getDay(); // 0=Dimanche, 1=Lundi, ..., 6=Samedi
    
    console.log(`⏰ Heure actuelle à Dakar: ${dakarTime.toLocaleString()} (${currentHour}h)`);
    console.log(`📅 Jour actuel: ${currentDay} (0=Dimanche, 1=Lundi...)`);
    
    // Vérifier si aujourd'hui est un jour de tracking autorisé
    const enabledDays = config.tracking_enabled_days.split(',').map(d => parseInt(d.trim()));
    if (!enabledDays.includes(currentDay)) {
      console.log(`📅 Tracking non autorisé le ${['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][currentDay]}`);
      return false;
    }
    
    // Vérifier si l'heure actuelle est dans la plage autorisée
    const startHour = config.tracking_start_hour;
    const endHour = config.tracking_end_hour;
    
    console.log(`🕒 Plage horaire autorisée: ${startHour}h - ${endHour}h`);
    
    if (currentHour >= startHour && currentHour < endHour) {
      console.log(`✅ Tracking GPS autorisé pour le livreur ${livreur_id}`);
      return true;
    } else {
      console.log(`🔴 Tracking GPS non autorisé en dehors des heures (${currentHour}h)`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification du tracking:', error);
    return false;
  }
};

// Récupérer la configuration de tracking d'un livreur
const getTrackingConfig = async (req, res) => {
  try {
    const { livreur_id } = req.params;
    
    console.log(`📋 Récupération config tracking pour livreur ${livreur_id}`);
    
    const configQuery = `
      SELECT 
        id,
        username,
        COALESCE(tracking_start_hour, 9) as tracking_start_hour,
        COALESCE(tracking_end_hour, 21) as tracking_end_hour,
        COALESCE(tracking_timezone, 'Africa/Dakar') as tracking_timezone,
        COALESCE(tracking_enabled_days, '0,1,2,3,4,5,6') as tracking_enabled_days,
        COALESCE(gps_tracking_active, true) as gps_tracking_active
      FROM users 
      WHERE id = $1 AND role = 'LIVREUR'
    `;
    
    const result = await db.query(configQuery, [livreur_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Livreur non trouvé'
      });
    }
    
    const config = result.rows[0];
    
    // Convertir les jours en array
    config.tracking_enabled_days = config.tracking_enabled_days.split(',').map(d => parseInt(d.trim()));
    
    console.log(`✅ Config récupérée pour ${config.username}`);
    
    res.json({
      success: true,
      data: config
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération de la config:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération de la configuration'
    });
  }
};

// Mettre à jour la configuration de tracking d'un livreur
const updateTrackingConfig = async (req, res) => {
  try {
    const { livreur_id } = req.params;
    const { 
      tracking_start_hour, 
      tracking_end_hour, 
      tracking_timezone, 
      tracking_enabled_days, 
      gps_tracking_active 
    } = req.body;
    
    console.log(`🔧 Mise à jour config tracking pour livreur ${livreur_id}`);
    console.log(`📊 Nouvelles valeurs:`, req.body);
    
    // Validations
    if (tracking_start_hour !== undefined && (tracking_start_hour < 0 || tracking_start_hour > 23)) {
      return res.status(400).json({
        success: false,
        message: 'L\'heure de début doit être entre 0 et 23'
      });
    }
    
    if (tracking_end_hour !== undefined && (tracking_end_hour < 0 || tracking_end_hour > 23)) {
      return res.status(400).json({
        success: false,
        message: 'L\'heure de fin doit être entre 0 et 23'
      });
    }
    
    if (tracking_enabled_days && (!Array.isArray(tracking_enabled_days) || tracking_enabled_days.some(d => d < 0 || d > 6))) {
      return res.status(400).json({
        success: false,
        message: 'Les jours doivent être un array de nombres entre 0 et 6'
      });
    }
    
    // Construire la requête de mise à jour dynamiquement
    const updates = [];
    const values = [];
    let valueIndex = 1;
    
    if (tracking_start_hour !== undefined) {
      updates.push(`tracking_start_hour = $${valueIndex++}`);
      values.push(tracking_start_hour);
    }
    
    if (tracking_end_hour !== undefined) {
      updates.push(`tracking_end_hour = $${valueIndex++}`);
      values.push(tracking_end_hour);
    }
    
    if (tracking_timezone !== undefined) {
      updates.push(`tracking_timezone = $${valueIndex++}`);
      values.push(tracking_timezone);
    }
    
    if (tracking_enabled_days !== undefined) {
      updates.push(`tracking_enabled_days = $${valueIndex++}`);
      values.push(tracking_enabled_days.join(','));
    }
    
    if (gps_tracking_active !== undefined) {
      updates.push(`gps_tracking_active = $${valueIndex++}`);
      values.push(gps_tracking_active);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour'
      });
    }
    
    // Ajouter updated_at
    updates.push(`updated_at = NOW()`);
    values.push(livreur_id);
    
    const updateQuery = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${valueIndex} AND role = 'LIVREUR'
      RETURNING 
        id,
        username,
        tracking_start_hour,
        tracking_end_hour,
        tracking_timezone,
        tracking_enabled_days,
        gps_tracking_active
    `;
    
    console.log(`🔍 Requête SQL:`, updateQuery);
    console.log(`🔍 Valeurs:`, values);
    
    const result = await db.query(updateQuery, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Livreur non trouvé'
      });
    }
    
    const updatedConfig = result.rows[0];
    
    // Convertir les jours en array
    updatedConfig.tracking_enabled_days = updatedConfig.tracking_enabled_days.split(',').map(d => parseInt(d.trim()));
    
    console.log(`✅ Config mise à jour pour ${updatedConfig.username}`);
    
    res.json({
      success: true,
      message: 'Configuration de tracking mise à jour',
      data: updatedConfig
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour de la config:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la mise à jour de la configuration'
    });
  }
};

// Récupérer la configuration de tracking de tous les livreurs
const getAllTrackingConfigs = async (req, res) => {
  try {
    console.log('📋 Récupération de toutes les configs de tracking');
    
    const configQuery = `
      SELECT 
        id,
        username,
        COALESCE(tracking_start_hour, 9) as tracking_start_hour,
        COALESCE(tracking_end_hour, 21) as tracking_end_hour,
        COALESCE(tracking_timezone, 'Africa/Dakar') as tracking_timezone,
        COALESCE(tracking_enabled_days, '0,1,2,3,4,5,6') as tracking_enabled_days,
        COALESCE(gps_tracking_active, true) as gps_tracking_active,
        created_at,
        updated_at
      FROM users 
      WHERE role = 'LIVREUR'
      ORDER BY username ASC
    `;
    
    const result = await db.query(configQuery);
    
    // Convertir les jours en array pour chaque livreur
    const configs = result.rows.map(config => ({
      ...config,
      tracking_enabled_days: config.tracking_enabled_days.split(',').map(d => parseInt(d.trim()))
    }));
    
    console.log(`✅ ${configs.length} configurations récupérées`);
    
    res.json({
      success: true,
      data: configs
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des configs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des configurations'
    });
  }
};

module.exports = {
  recordLocation: GpsController.recordLocation,
  updateDailyMetrics: GpsController.updateDailyMetrics,
  getAllLatestPositions: GpsController.getAllLatestPositions,
  getLocationByLivreur: GpsController.getLocationByLivreur,
  getLocationHistory: GpsController.getLocationHistory,
  calculateDistance: GpsController.calculateDistance,
  toggleTracking: GpsController.toggleTracking,
  getSettings: GpsController.getSettings,
  updateInterval: GpsController.updateInterval,
  getOfflineLivreurs: GpsController.getOfflineLivreurs,
  deleteHistory: GpsController.deleteHistory,
  getStats: GpsController.getStats,
  cleanupOldData: GpsController.cleanupOldData,
  getDailyTrace,
  getAvailableLivreurs,
  isTrackingAllowed,
  getTrackingConfig,
  updateTrackingConfig,
  getAllTrackingConfigs
};