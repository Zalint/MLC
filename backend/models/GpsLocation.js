const { v4: uuidv4 } = require('uuid');
const db = require('./database');

class GpsLocation {
  constructor(data) {
    this.id = data.id;
    this.livreur_id = data.livreur_id;
    this.latitude = data.latitude;
    this.longitude = data.longitude;
    this.accuracy = data.accuracy;
    this.is_active = data.is_active;
    this.battery_level = data.battery_level;
    this.speed = data.speed;
    this.timestamp = data.timestamp;
    this.created_at = data.created_at;
  }

  // Enregistrer une nouvelle position GPS
  static async create({ livreur_id, latitude, longitude, accuracy, is_active = true, battery_level, speed, timestamp }) {
    const id = uuidv4();
    const positionTimestamp = timestamp ? new Date(timestamp) : new Date();
    
    const query = `
      INSERT INTO gps_locations (id, livreur_id, latitude, longitude, accuracy, is_active, battery_level, speed, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    try {
      const result = await db.query(query, [
        id, livreur_id, latitude, longitude, accuracy, is_active, battery_level, speed, positionTimestamp
      ]);
      return new GpsLocation(result.rows[0]);
    } catch (error) {
      console.error('Erreur lors de la création de la position GPS:', error);
      throw error;
    }
  }

  // Obtenir la dernière position d'un livreur
  static async getLatestPosition(livreur_id) {
    const query = `
      SELECT * FROM gps_locations 
      WHERE livreur_id = $1 
      ORDER BY timestamp DESC 
      LIMIT 1
    `;
    
    const result = await db.query(query, [livreur_id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new GpsLocation(result.rows[0]);
  }

  // Obtenir toutes les dernières positions des livreurs actifs
  static async getAllLatestPositions() {
    const query = `
      SELECT * FROM latest_gps_positions
      ORDER BY seconds_ago ASC
    `;
    
    const result = await db.query(query);
    return result.rows;
  }

  // Obtenir l'historique des positions d'un livreur pour une période
  static async getLocationHistory(livreur_id, startDate, endDate, limit = 1000) {
    const query = `
      SELECT gl.*, u.username as livreur_username
      FROM gps_locations gl
      JOIN users u ON gl.livreur_id = u.id
      WHERE gl.livreur_id = $1 
        AND gl.timestamp >= $2 
        AND gl.timestamp <= $3
      ORDER BY gl.timestamp DESC
      LIMIT $4
    `;
    
    const result = await db.query(query, [livreur_id, startDate, endDate, limit]);
    return result.rows.map(row => new GpsLocation(row));
  }

  // Obtenir l'historique des positions pour une date spécifique
  static async getLocationsByDate(livreur_id, date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return this.getLocationHistory(livreur_id, startOfDay, endOfDay);
  }

  // Calculer la distance totale parcourue par un livreur sur une période
  static async calculateTotalDistance(livreur_id, startDate, endDate) {
    const query = `
      WITH ordered_positions AS (
        SELECT latitude, longitude, timestamp
        FROM gps_locations
        WHERE livreur_id = $1 
          AND timestamp >= $2 
          AND timestamp <= $3
          AND accuracy <= 100  -- Filtrer les positions imprécises
        ORDER BY timestamp ASC
      ),
      distances AS (
        SELECT 
          calculate_gps_distance(
            LAG(latitude) OVER (ORDER BY timestamp),
            LAG(longitude) OVER (ORDER BY timestamp),
            latitude,
            longitude
          ) as distance
        FROM ordered_positions
      )
      SELECT COALESCE(SUM(distance), 0) as total_distance_meters
      FROM distances
      WHERE distance IS NOT NULL AND distance < 1000  -- Filtrer les sauts > 1km
    `;
    
    const result = await db.query(query, [livreur_id, startDate, endDate]);
    return parseFloat(result.rows[0].total_distance_meters) || 0;
  }

  // Obtenir les statistiques de trajet pour un livreur
  static async getTrajectoryStats(livreur_id, date) {
    const query = `
      SELECT * FROM gps_trajectory_analysis
      WHERE livreur_id = $1 AND tracking_date = $2
    `;
    
    const result = await db.query(query, [livreur_id, date]);
    return result.rows[0] || null;
  }

  // Nettoyer les anciennes positions GPS
  static async cleanupOldData() {
    const query = 'SELECT cleanup_old_gps_data() as deleted_count';
    const result = await db.query(query);
    return result.rows[0].deleted_count;
  }

  // Supprimer l'historique d'un livreur spécifique
  static async deleteHistory(livreur_id, beforeDate = null) {
    let query = 'DELETE FROM gps_locations WHERE livreur_id = $1';
    const params = [livreur_id];
    
    if (beforeDate) {
      query += ' AND timestamp < $2';
      params.push(beforeDate);
    }
    
    query += ' RETURNING COUNT(*) as deleted_count';
    
    const result = await db.query(query, params);
    return result.rowCount;
  }

  // Obtenir les livreurs hors ligne (pas de position récente)
  static async getOfflineLivreurs(minutesThreshold = 5) {
    const query = `
      SELECT DISTINCT u.id, u.username, gs.tracking_enabled,
             EXTRACT(EPOCH FROM (NOW() - MAX(gl.timestamp)))/60 as minutes_offline
      FROM users u
      LEFT JOIN gps_locations gl ON u.id = gl.livreur_id
      LEFT JOIN gps_settings gs ON u.id = gs.livreur_id
      WHERE u.role = 'LIVREUR' 
        AND u.is_active = true
        AND gs.tracking_enabled = true
      GROUP BY u.id, u.username, gs.tracking_enabled
      HAVING MAX(gl.timestamp) < NOW() - INTERVAL '${minutesThreshold} minutes'
         OR MAX(gl.timestamp) IS NULL
      ORDER BY minutes_offline DESC NULLS LAST
    `;
    
    const result = await db.query(query);
    return result.rows;
  }

  // Convertir en JSON pour l'API
  toJSON() {
    return {
      id: this.id,
      livreur_id: this.livreur_id,
      latitude: parseFloat(this.latitude),
      longitude: parseFloat(this.longitude),
      accuracy: this.accuracy ? parseFloat(this.accuracy) : null,
      is_active: this.is_active,
      battery_level: this.battery_level,
      speed: this.speed ? parseFloat(this.speed) : null,
      timestamp: this.timestamp,
      created_at: this.created_at
    };
  }
}

module.exports = GpsLocation; 