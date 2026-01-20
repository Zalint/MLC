// Contrôleur pour gérer les crédits clients MATA

const db = require('../models/database');
const { normalizePhoneNumber, buildPhoneSearchClause } = require('../utils/phoneNormalizer');

class ClientCreditsController {
  /**
   * GET /api/v1/clients/mata-list
   * Récupère la liste de tous les clients MATA distincts avec leurs noms alternatifs
   */
  static async getMataClientsList(req, res) {
    try {
      const query = `
        WITH client_names AS (
          SELECT 
            phone_number,
            client_name,
            COUNT(*) as usage_count,
            MIN(created_at) as first_use,
            MAX(created_at) as last_use
          FROM orders
          WHERE order_type = 'MATA'
            AND phone_number IS NOT NULL
            AND phone_number != ''
            AND client_name IS NOT NULL
            AND client_name != ''
          GROUP BY phone_number, client_name
        ),
        primary_names AS (
          SELECT DISTINCT ON (phone_number)
            phone_number,
            client_name as primary_name
          FROM client_names
          ORDER BY phone_number, client_name ASC
        ),
        alternative_names AS (
          SELECT 
            phone_number,
            array_agg(DISTINCT client_name ORDER BY client_name) as all_names,
            COUNT(DISTINCT client_name) as name_count
          FROM client_names
          GROUP BY phone_number
        ),
        total_orders AS (
          SELECT 
            phone_number,
            COUNT(*) as total_orders,
            SUM(amount) as total_spent,
            MAX(created_at) as last_order_date
          FROM orders
          WHERE order_type = 'MATA'
            AND phone_number IS NOT NULL
            AND phone_number != ''
          GROUP BY phone_number
        )
        SELECT 
          pn.phone_number,
          pn.primary_name,
          an.all_names as alternative_names,
          an.name_count,
          tot.total_orders,
          COALESCE(tot.total_spent, 0) as total_spent,
          tot.last_order_date,
          cc.credit_amount,
          cc.expires_at,
          cc.expiration_days,
          CASE 
            WHEN cc.expires_at > CURRENT_TIMESTAMP THEN cc.credit_amount
            ELSE 0
          END as current_credit,
          CASE 
            WHEN cc.expires_at > CURRENT_TIMESTAMP THEN false
            ELSE true
          END as is_expired,
          CASE 
            WHEN cc.expires_at > CURRENT_TIMESTAMP THEN EXTRACT(DAY FROM (cc.expires_at - CURRENT_TIMESTAMP))::INTEGER
            ELSE 0
          END as days_remaining
        FROM primary_names pn
        LEFT JOIN alternative_names an ON pn.phone_number = an.phone_number
        LEFT JOIN total_orders tot ON pn.phone_number = tot.phone_number
        LEFT JOIN client_credits cc ON pn.phone_number = cc.phone_number
        ORDER BY pn.primary_name ASC
      `;

      const result = await db.query(query);
      
      return res.json({
        success: true,
        count: result.rows.length,
        clients: result.rows
      });

    } catch (error) {
      console.error('❌ Erreur getMataClientsList:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des clients',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * POST /api/v1/clients/credits
   * Attribue ou met à jour un crédit pour un client
   */
  static async setClientCredit(req, res) {
    try {
      const { phone_number, credit_amount, expiration_days, notes } = req.body;
      const userId = req.user.id;

      // Validation
      if (!phone_number) {
        return res.status(400).json({
          success: false,
          error: 'phone_number est requis'
        });
      }

      if (!credit_amount || credit_amount < 0) {
        return res.status(400).json({
          success: false,
          error: 'credit_amount doit être un montant positif'
        });
      }

      if (!expiration_days || expiration_days < 1) {
        return res.status(400).json({
          success: false,
          error: 'expiration_days doit être au moins 1 jour'
        });
      }

      // Normaliser le numéro de téléphone
      const phoneInfo = normalizePhoneNumber(phone_number);
      const normalizedPhone = phoneInfo ? phoneInfo.normalized : phone_number;

      // Calculer la date d'expiration
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(expiration_days));

      // Vérifier si le client existe dans orders
      const clientCheckQuery = `
        SELECT COUNT(*) as order_count
        FROM orders
        WHERE phone_number = $1 AND order_type = 'MATA'
      `;
      const clientCheck = await db.query(clientCheckQuery, [phone_number]);

      if (clientCheck.rows[0].order_count === 0) {
        return res.status(404).json({
          success: false,
          error: 'Ce numéro n\'a aucune commande MATA'
        });
      }

      // Upsert (INSERT ou UPDATE)
      const upsertQuery = `
        INSERT INTO client_credits (
          phone_number,
          credit_amount,
          expiration_days,
          expires_at,
          created_by,
          notes
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (phone_number) 
        DO UPDATE SET
          credit_amount = EXCLUDED.credit_amount,
          expiration_days = EXCLUDED.expiration_days,
          expires_at = EXCLUDED.expires_at,
          created_by = EXCLUDED.created_by,
          notes = EXCLUDED.notes,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      const result = await db.query(upsertQuery, [
        phone_number,
        credit_amount,
        expiration_days,
        expiresAt,
        userId,
        notes || null
      ]);

      console.log(`✅ Crédit attribué: ${phone_number} - ${credit_amount} FCFA - ${expiration_days} jours`);

      return res.json({
        success: true,
        message: 'Crédit attribué avec succès',
        credit: result.rows[0]
      });

    } catch (error) {
      console.error('❌ Erreur setClientCredit:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'attribution du crédit',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * GET /api/v1/clients/credits/:phone_number
   * Récupère le crédit d'un client spécifique
   */
  static async getClientCredit(req, res) {
    try {
      const { phone_number } = req.params;

      const query = `
        SELECT 
          *,
          CASE 
            WHEN expires_at > CURRENT_TIMESTAMP THEN credit_amount
            ELSE 0
          END as current_credit,
          CASE 
            WHEN expires_at > CURRENT_TIMESTAMP THEN false
            ELSE true
          END as is_expired,
          CASE 
            WHEN expires_at > CURRENT_TIMESTAMP THEN EXTRACT(DAY FROM (expires_at - CURRENT_TIMESTAMP))::INTEGER
            ELSE 0
          END as days_remaining
        FROM client_credits
        WHERE phone_number = $1
      `;

      const result = await db.query(query, [phone_number]);

      if (result.rows.length === 0) {
        return res.json({
          success: true,
          has_credit: false,
          credit: null
        });
      }

      return res.json({
        success: true,
        has_credit: true,
        credit: result.rows[0]
      });

    } catch (error) {
      console.error('❌ Erreur getClientCredit:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération du crédit'
      });
    }
  }

  /**
   * DELETE /api/v1/clients/credits/:phone_number
   * Supprime le crédit d'un client
   */
  static async deleteClientCredit(req, res) {
    try {
      const { phone_number } = req.params;

      const deleteQuery = `
        DELETE FROM client_credits
        WHERE phone_number = $1
        RETURNING *
      `;

      const result = await db.query(deleteQuery, [phone_number]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Aucun crédit trouvé pour ce numéro'
        });
      }

      console.log(`✅ Crédit supprimé: ${phone_number}`);

      return res.json({
        success: true,
        message: 'Crédit supprimé avec succès',
        deleted_credit: result.rows[0]
      });

    } catch (error) {
      console.error('❌ Erreur deleteClientCredit:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la suppression du crédit'
      });
    }
  }
}

module.exports = ClientCreditsController;

