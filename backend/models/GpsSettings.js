const { v4: uuidv4 } = require('uuid');
const db = require('./database');

class GpsSettings {
  constructor(data) {
    this.id = data.id;
    this.livreur_id = data.livreur_id;
    this.tracking_enabled = data.tracking_enabled;
    this.tracking_interval = data.tracking_interval;
    this.last_permission_granted = data.last_permission_granted;
    this.permission_version = data.permission_version;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Créer ou mettre à jour les paramètres GPS d'un livreur
  static async createOrUpdate({ livreur_id, tracking_enabled, tracking_interval, permission_granted = false }) {
    const query = `
      INSERT INTO gps_settings (id, livreur_id, tracking_enabled, tracking_interval, last_permission_granted)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (livreur_id) 
      DO UPDATE SET 
        tracking_enabled = EXCLUDED.tracking_enabled,
        tracking_interval = EXCLUDED.tracking_interval,
        last_permission_granted = CASE 
          WHEN EXCLUDED.last_permission_granted IS NOT NULL 
          THEN EXCLUDED.last_permission_granted 
          ELSE gps_settings.last_permission_granted 
        END,
        updated_at = NOW()
      RETURNING *
    `;
    
    const id = uuidv4();
    const permissionTimestamp = permission_granted ? new Date() : null;
    
    try {
      const result = await db.query(query, [
        id, livreur_id, tracking_enabled, tracking_interval, permissionTimestamp
      ]);
      return new GpsSettings(result.rows[0]);
    } catch (error) {
      console.error('Erreur lors de la création/mise à jour des paramètres GPS:', error);
      throw error;
    }
  }

  // Obtenir les paramètres GPS d'un livreur
  static async getByLivreurId(livreur_id) {
    const query = 'SELECT * FROM gps_settings WHERE livreur_id = $1';
    const result = await db.query(query, [livreur_id]);
    
    if (result.rows.length === 0) {
      // Créer des paramètres par défaut si ils n'existent pas
      return this.createOrUpdate({ 
        livreur_id, 
        tracking_enabled: false, 
        tracking_interval: 30000 
      });
    }
    
    return new GpsSettings(result.rows[0]);
  }

  // Activer/désactiver le suivi GPS pour un livreur
  static async toggleTracking(livreur_id, enabled, permission_granted = false) {
    const query = `
      UPDATE gps_settings 
      SET tracking_enabled = $2,
          last_permission_granted = CASE 
            WHEN $3 = true THEN NOW() 
            ELSE last_permission_granted 
          END,
          updated_at = NOW()
      WHERE livreur_id = $1
      RETURNING *
    `;
    
    const result = await db.query(query, [livreur_id, enabled, permission_granted]);
    
    if (result.rows.length === 0) {
      // Créer si n'existe pas
      return this.createOrUpdate({ 
        livreur_id, 
        tracking_enabled: enabled, 
        tracking_interval: 30000,
        permission_granted 
      });
    }
    
    return new GpsSettings(result.rows[0]);
  }

  // Mettre à jour l'intervalle de suivi
  static async updateInterval(livreur_id, interval) {
    const query = `
      UPDATE gps_settings 
      SET tracking_interval = $2, updated_at = NOW()
      WHERE livreur_id = $1
      RETURNING *
    `;
    
    const result = await db.query(query, [livreur_id, interval]);
    
    if (result.rows.length === 0) {
      throw new Error('Paramètres GPS non trouvés pour ce livreur');
    }
    
    return new GpsSettings(result.rows[0]);
  }

  // Obtenir tous les livreurs avec le suivi activé
  static async getEnabledLivreurs() {
    const query = `
      SELECT gs.*, u.username as livreur_username
      FROM gps_settings gs
      JOIN users u ON gs.livreur_id = u.id
      WHERE gs.tracking_enabled = true 
        AND u.role = 'LIVREUR' 
        AND u.is_active = true
      ORDER BY u.username
    `;
    
    const result = await db.query(query);
    return result.rows.map(row => ({
      ...new GpsSettings(row).toJSON(),
      livreur_username: row.livreur_username
    }));
  }

  // Obtenir les statistiques des paramètres GPS
  static async getStats() {
    const query = `
      SELECT 
        COUNT(*) as total_livreurs,
        COUNT(CASE WHEN tracking_enabled = true THEN 1 END) as tracking_enabled,
        COUNT(CASE WHEN tracking_enabled = false THEN 1 END) as tracking_disabled,
        COUNT(CASE WHEN last_permission_granted IS NOT NULL THEN 1 END) as permissions_granted,
        AVG(tracking_interval) as avg_interval
      FROM gps_settings gs
      JOIN users u ON gs.livreur_id = u.id
      WHERE u.role = 'LIVREUR' AND u.is_active = true
    `;
    
    const result = await db.query(query);
    return result.rows[0];
  }

  // Supprimer les paramètres d'un livreur
  static async delete(livreur_id) {
    const query = 'DELETE FROM gps_settings WHERE livreur_id = $1 RETURNING *';
    const result = await db.query(query, [livreur_id]);
    
    if (result.rows.length === 0) {
      throw new Error('Paramètres GPS non trouvés');
    }
    
    return new GpsSettings(result.rows[0]);
  }

  // Initialiser les paramètres pour tous les livreurs sans paramètres
  static async initializeForAllLivreurs() {
    const query = `
      INSERT INTO gps_settings (livreur_id, tracking_enabled, tracking_interval)
      SELECT u.id, false, 30000
      FROM users u
      WHERE u.role = 'LIVREUR' 
        AND u.is_active = true
        AND u.id NOT IN (SELECT livreur_id FROM gps_settings)
    `;
    
    const result = await db.query(query);
    return result.rowCount;
  }

  // Convertir en JSON pour l'API
  toJSON() {
    return {
      id: this.id,
      livreur_id: this.livreur_id,
      tracking_enabled: this.tracking_enabled,
      tracking_interval: this.tracking_interval,
      last_permission_granted: this.last_permission_granted,
      permission_version: this.permission_version,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

module.exports = GpsSettings; 