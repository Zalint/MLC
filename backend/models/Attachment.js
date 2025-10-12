const pool = require('./database');

class Attachment {
  /**
   * Créer une nouvelle pièce jointe
   */
  static async create(attachmentData) {
    const { order_id, file_name, original_name, file_path, file_type, file_size, uploaded_by } = attachmentData;
    
    const query = `
      INSERT INTO order_attachments 
      (order_id, file_name, original_name, file_path, file_type, file_size, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const values = [order_id, file_name, original_name, file_path, file_type, file_size, uploaded_by];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Récupérer toutes les pièces jointes d'une commande
   */
  static async findByOrderId(orderId) {
    const query = `
      SELECT * FROM order_attachments 
      WHERE order_id = $1 
      ORDER BY uploaded_at DESC
    `;
    
    const result = await pool.query(query, [orderId]);
    return result.rows;
  }

  /**
   * Récupérer une pièce jointe par son ID
   */
  static async findById(attachmentId) {
    const query = `
      SELECT * FROM order_attachments 
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [attachmentId]);
    return result.rows[0];
  }

  /**
   * Supprimer une pièce jointe
   */
  static async delete(attachmentId) {
    const query = `
      DELETE FROM order_attachments 
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [attachmentId]);
    return result.rows[0];
  }

  /**
   * Compter le nombre de pièces jointes pour une commande
   */
  static async countByOrderId(orderId) {
    const query = `
      SELECT COUNT(*) as count 
      FROM order_attachments 
      WHERE order_id = $1
    `;
    
    const result = await pool.query(query, [orderId]);
    return parseInt(result.rows[0].count);
  }

  /**
   * Récupérer une pièce jointe avec les infos de la commande
   */
  static async findByIdWithOrder(attachmentId) {
    const query = `
      SELECT 
        oa.*,
        o.order_type,
        o.interne,
        o.subscription_id,
        o.created_at as order_created_at
      FROM order_attachments oa
      JOIN orders o ON oa.order_id = o.id
      WHERE oa.id = $1
    `;
    
    const result = await pool.query(query, [attachmentId]);
    return result.rows[0];
  }
}

module.exports = Attachment;

