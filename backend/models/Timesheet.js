const db = require('./database');
const { v4: uuidv4 } = require('uuid');

class Timesheet {
  constructor(data) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.scooter_id = data.scooter_id; // Nouveau champ
    this.date = data.date;
    this.start_time = data.start_time;
    this.start_km = data.start_km;
    this.start_photo_path = data.start_photo_path;
    this.start_photo_name = data.start_photo_name;
    this.end_time = data.end_time;
    this.end_km = data.end_km;
    this.end_photo_path = data.end_photo_path;
    this.end_photo_name = data.end_photo_name;
    this.total_km = data.total_km;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  /**
   * Créer un nouveau pointage (début d'activité)
   */
  static async create({ userId, scooterId, date, startTime, startKm, startPhotoPath, startPhotoName }) {
    const id = uuidv4();
    
    const query = `
      INSERT INTO delivery_timesheets (
        id, user_id, scooter_id, date, start_time, start_km, start_photo_path, start_photo_name
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    try {
      const result = await db.query(query, [
        id,
        userId,
        scooterId,
        date,
        startTime,
        startKm,
        startPhotoPath,
        startPhotoName
      ]);
      
      console.log('✅ Pointage créé:', result.rows[0].id, scooterId ? `(Scooter: ${scooterId})` : '');
      return new Timesheet(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') { // Violation contrainte unique
        throw new Error(`Un pointage existe déjà pour cette date${scooterId ? ' et ce scooter' : ''}`);
      }
      throw error;
    }
  }

  /**
   * Trouver un pointage spécifique par utilisateur, scooter et date
   */
  static async findByUserScooterAndDate(userId, scooterId, date) {
    const query = `
      SELECT * FROM delivery_timesheets
      WHERE user_id = $1 
      AND (scooter_id = $2 OR (scooter_id IS NULL AND $2 IS NULL))
      AND date = $3
    `;
    
    const result = await db.query(query, [userId, scooterId, date]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new Timesheet(result.rows[0]);
  }

  /**
   * NOUVEAU: Trouver TOUS les pointages d'un utilisateur pour une date donnée
   * Retourne un tableau de pointages (peut être vide)
   */
  static async findAllByUserAndDate(userId, date) {
    const query = `
      SELECT * FROM delivery_timesheets
      WHERE user_id = $1 AND date = $2
      ORDER BY start_time ASC
    `;
    
    const result = await db.query(query, [userId, date]);
    return result.rows.map(row => new Timesheet(row));
  }

  /**
   * DEPRECATED: Ancienne méthode pour compatibilité
   * Retourne le PREMIER pointage trouvé (pour rétrocompatibilité)
   */
  static async findByUserAndDate(userId, date) {
    const query = `
      SELECT * FROM delivery_timesheets
      WHERE user_id = $1 AND date = $2
      ORDER BY created_at ASC
      LIMIT 1
    `;
    
    const result = await db.query(query, [userId, date]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new Timesheet(result.rows[0]);
  }

  /**
   * Mettre à jour le début d'activité
   */
  static async updateStart(id, { startTime, startKm, startPhotoPath, startPhotoName }) {
    const query = `
      UPDATE delivery_timesheets
      SET 
        start_time = $1,
        start_km = $2,
        start_photo_path = $3,
        start_photo_name = $4,
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `;
    
    const result = await db.query(query, [
      startTime,
      startKm,
      startPhotoPath,
      startPhotoName,
      id
    ]);
    
    if (result.rows.length === 0) {
      throw new Error('Pointage introuvable');
    }
    
    console.log('✅ Pointage mis à jour (début):', result.rows[0].id);
    return new Timesheet(result.rows[0]);
  }

  /**
   * Mettre à jour la fin d'activité
   */
  static async updateEnd(id, { endTime, endKm, endPhotoPath, endPhotoName }) {
    const query = `
      UPDATE delivery_timesheets
      SET 
        end_time = $1,
        end_km = $2,
        end_photo_path = $3,
        end_photo_name = $4,
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `;
    
    const result = await db.query(query, [
      endTime,
      endKm,
      endPhotoPath,
      endPhotoName,
      id
    ]);
    
    if (result.rows.length === 0) {
      throw new Error('Pointage introuvable');
    }
    
    console.log('✅ Pointage mis à jour (fin):', result.rows[0].id, '- Total km:', result.rows[0].total_km);
    return new Timesheet(result.rows[0]);
  }

  /**
   * Trouver un pointage par ID
   */
  static async findById(id) {
    const query = `
      SELECT * FROM delivery_timesheets
      WHERE id = $1
    `;
    
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new Timesheet(result.rows[0]);
  }

  /**
   * Trouver les pointages d'un utilisateur entre deux dates
   */
  static async findByUserBetweenDates(userId, startDate, endDate) {
    const query = `
      SELECT * FROM delivery_timesheets
      WHERE user_id = $1 
        AND date >= $2 
        AND date <= $3
      ORDER BY date DESC
    `;
    
    const result = await db.query(query, [userId, startDate, endDate]);
    return result.rows.map(row => new Timesheet(row));
  }

  /**
   * Trouver tous les pointages pour une date (MANAGER)
   */
  static async findAllForDate(date) {
    const query = `
      SELECT dt.*, u.username
      FROM delivery_timesheets dt
      JOIN users u ON dt.user_id = u.id
      WHERE dt.date = $1
      ORDER BY u.username
    `;
    
    const result = await db.query(query, [date]);
    return result.rows.map(row => ({
      ...new Timesheet(row),
      username: row.username
    }));
  }

  /**
   * NOUVEAU: Trouver tous les livreurs actifs avec TOUS leurs pointages pour une date (MANAGER)
   * Retourne un tableau avec un élément par livreur, contenant tous ses pointages du jour
   * Format: [{ user_id, username, timesheets: [...], total_km_journee, status }]
   */
  static async findAllActiveLivreursWithTimesheets(date) {
    const query = `
      SELECT 
        u.id as user_id,
        u.username,
        dt.id as timesheet_id,
        dt.scooter_id,
        dt.date,
        dt.start_time,
        dt.start_km,
        dt.start_photo_path,
        dt.start_photo_name,
        dt.end_time,
        dt.end_km,
        dt.end_photo_path,
        dt.end_photo_name,
        dt.total_km,
        dt.created_at,
        dt.updated_at,
        CASE 
          WHEN dt.start_time IS NOT NULL AND dt.end_time IS NOT NULL THEN 'complete'
          WHEN dt.start_time IS NOT NULL THEN 'partial'
          ELSE 'missing'
        END as status
      FROM users u
      LEFT JOIN delivery_timesheets dt ON u.id = dt.user_id AND dt.date = $1
      WHERE u.role = 'LIVREUR' AND u.is_active = true
      ORDER BY u.username, dt.start_time ASC
    `;
    
    const result = await db.query(query, [date]);
    
    // Grouper les résultats par livreur
    const livreurMap = new Map();
    
    result.rows.forEach(row => {
      if (!livreurMap.has(row.user_id)) {
        livreurMap.set(row.user_id, {
          user_id: row.user_id,
          username: row.username,
          timesheets: [],
          total_km_journee: 0,
          nb_pointages: 0,
          status: 'missing' // Par défaut
        });
      }
      
      const livreur = livreurMap.get(row.user_id);
      
      // Si le livreur a un pointage pour cette date
      if (row.timesheet_id) {
        livreur.timesheets.push({
          id: row.timesheet_id,
          user_id: row.user_id,
          scooter_id: row.scooter_id,
          date: row.date,
          start_time: row.start_time,
          start_km: row.start_km,
          start_photo_path: row.start_photo_path,
          start_photo_name: row.start_photo_name,
          end_time: row.end_time,
          end_km: row.end_km,
          end_photo_path: row.end_photo_path,
          end_photo_name: row.end_photo_name,
          total_km: row.total_km,
          created_at: row.created_at,
          updated_at: row.updated_at,
          status: row.status
        });
        
        // Cumuler les km
        if (row.total_km) {
          livreur.total_km_journee += parseFloat(row.total_km);
        }
        
        livreur.nb_pointages++;
        
        // Déterminer le statut global du livreur
        if (livreur.timesheets.some(t => t.status === 'partial')) {
          livreur.status = 'partial';
        } else if (livreur.timesheets.every(t => t.status === 'complete')) {
          livreur.status = 'complete';
        }
      }
    });
    
    return Array.from(livreurMap.values());
  }

  /**
   * Supprimer un pointage
   */
  static async delete(id) {
    const query = `
      DELETE FROM delivery_timesheets
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('Pointage introuvable');
    }
    
    console.log('🗑️ Pointage supprimé:', id);
    return new Timesheet(result.rows[0]);
  }

  /**
   * Mettre à jour un pointage (pour corrections)
   */
  static async update(id, updates) {
    const allowedFields = ['start_km', 'end_km', 'start_photo_path', 'start_photo_name', 'end_photo_path', 'end_photo_name'];
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClause.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClause.length === 0) {
      throw new Error('Aucun champ valide à mettre à jour');
    }

    values.push(id);
    
    const query = `
      UPDATE delivery_timesheets 
      SET ${setClause.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Pointage introuvable');
    }
    
    console.log('📝 Pointage mis à jour:', id);
    return new Timesheet(result.rows[0]);
  }

  /**
   * Obtenir les statistiques pour une date (MANAGER)
   * Prend en compte plusieurs pointages par livreur
   */
  static async getStatsForDate(date) {
    const query = `
      WITH livreur_status AS (
        SELECT 
          u.id as user_id,
          CASE 
            WHEN COUNT(dt.id) = 0 THEN 'missing'
            WHEN COUNT(dt.id) FILTER (WHERE dt.end_time IS NULL) > 0 THEN 'partial'
            ELSE 'complete'
          END as status,
          COALESCE(SUM(dt.total_km), 0) as total_km
        FROM users u
        LEFT JOIN delivery_timesheets dt ON u.id = dt.user_id AND dt.date = $1
        WHERE u.role = 'LIVREUR' AND u.is_active = true
        GROUP BY u.id
      )
      SELECT 
        COUNT(*) as total_livreurs,
        COUNT(*) FILTER (WHERE status = 'complete') as complets,
        COUNT(*) FILTER (WHERE status = 'partial') as en_cours,
        COUNT(*) FILTER (WHERE status = 'missing') as non_pointes,
        SUM(total_km) as total_km
      FROM livreur_status
    `;
    
    const result = await db.query(query, [date]);
    return result.rows[0];
  }
}

module.exports = Timesheet;
