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
          COALESCE(cc.client_tag, 'STANDARD') as client_tag,
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
      const { phone_number, credit_amount, expiration_days, notes, client_tag } = req.body;
      const userId = req.user.id;

      // Validation
      if (!phone_number) {
        return res.status(400).json({
          success: false,
          error: 'phone_number est requis'
        });
      }

      // Validation du tag client
      if (client_tag && !['STANDARD', 'VIP', 'VVIP'].includes(client_tag)) {
        return res.status(400).json({
          success: false,
          error: 'client_tag doit être STANDARD, VIP ou VVIP'
        });
      }

      // Déterminer si c'est une mise à jour de crédit ou juste de tag
      const isUpdatingCredit = credit_amount && credit_amount > 0;
      const isUpdatingTagOnly = !isUpdatingCredit && client_tag;

      // Si on met à jour un crédit, valider les champs requis
      if (isUpdatingCredit) {
        if (!expiration_days || expiration_days < 1) {
          return res.status(400).json({
            success: false,
            error: 'expiration_days doit être au moins 1 jour'
          });
        }
      }

      // Si aucun crédit ni tag, erreur
      if (!isUpdatingCredit && !isUpdatingTagOnly) {
        return res.status(400).json({
          success: false,
          error: 'credit_amount ou client_tag est requis'
        });
      }

      // Normaliser le numéro de téléphone
      const phoneInfo = normalizePhoneNumber(phone_number);
      const normalizedPhone = phoneInfo ? phoneInfo.normalized : phone_number;

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

      let result;
      let balanceBefore = 0;

      // CAS 1: Mise à jour du tag uniquement (sans crédit)
      if (isUpdatingTagOnly) {
        console.log(`🏷️ Mise à jour tag uniquement: ${phone_number} -> ${client_tag}`);
        
        // Essayer de mettre à jour le tag sur une ligne existante
        const updateTagQuery = `
          UPDATE client_credits
          SET client_tag = $1, updated_at = CURRENT_TIMESTAMP
          WHERE phone_number = $2
          RETURNING *
        `;
        
        result = await db.query(updateTagQuery, [client_tag, phone_number]);
        
        // Si la ligne n'existe pas, la créer avec juste le tag (crédit à 0)
        if (result.rows.length === 0) {
          const insertTagQuery = `
            INSERT INTO client_credits (
              phone_number,
              credit_amount,
              expiration_days,
              expires_at,
              created_by,
              client_tag
            ) VALUES ($1, 0, 30, NOW() + INTERVAL '30 days', $2, $3)
            RETURNING *
          `;
          result = await db.query(insertTagQuery, [phone_number, userId, client_tag]);
        }
      } 
      // CAS 2: Mise à jour du crédit + tag
      else {
        console.log(`💰 Mise à jour crédit + tag: ${phone_number} - ${credit_amount} FCFA - ${client_tag}`);
        
        // Calculer la date d'expiration
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(expiration_days));

        // Récupérer le crédit précédent pour l'historique
        const previousCreditQuery = `
          SELECT credit_amount FROM client_credits WHERE phone_number = $1
        `;
        const previousCredit = await db.query(previousCreditQuery, [phone_number]);
        balanceBefore = previousCredit.rows.length > 0 ? parseFloat(previousCredit.rows[0].credit_amount) : 0;

        // Upsert (INSERT ou UPDATE)
        const upsertQuery = `
          INSERT INTO client_credits (
            phone_number,
            credit_amount,
            expiration_days,
            expires_at,
            created_by,
            notes,
            client_tag
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (phone_number) 
          DO UPDATE SET
            credit_amount = EXCLUDED.credit_amount,
            expiration_days = EXCLUDED.expiration_days,
            expires_at = EXCLUDED.expires_at,
            created_by = EXCLUDED.created_by,
            notes = EXCLUDED.notes,
            client_tag = EXCLUDED.client_tag,
            updated_at = CURRENT_TIMESTAMP
          RETURNING *
        `;

        result = await db.query(upsertQuery, [
          phone_number,
          credit_amount,
          expiration_days,
          expiresAt,
          userId,
          notes ? notes : null,
          client_tag || 'STANDARD'
        ]);
      }

      // Enregistrer la transaction dans l'historique (uniquement si c'est un crédit)
      if (isUpdatingCredit) {
        const transactionQuery = `
          INSERT INTO client_credit_transactions (
            phone_number,
            transaction_type,
            amount,
            balance_before,
            balance_after,
            order_id,
            notes,
            created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `;
        
        await db.query(transactionQuery, [
          phone_number,
          'CREDIT',
          credit_amount,
          balanceBefore,
          credit_amount,
          null,
          notes || null,
          userId
        ]);

        console.log(`✅ Crédit attribué: ${phone_number} - ${credit_amount} FCFA - ${expiration_days} jours - Tag: ${client_tag || 'STANDARD'}`);
      } else {
        console.log(`✅ Tag mis à jour: ${phone_number} - Tag: ${client_tag}`);
      }

      return res.json({
        success: true,
        message: isUpdatingCredit ? 'Crédit attribué avec succès' : `Tag ${client_tag} attribué avec succès`,
        credit: result.rows[0],
        tag_only: isUpdatingTagOnly
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
          COALESCE(client_tag, 'STANDARD') as client_tag,
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

  /**
   * POST /api/v1/clients/credits/use
   * POST /api/external/clients/credits/use
   * Déduit un montant du crédit d'un client
   */
  static async useClientCredit(req, res) {
    try {
      const { phone_number, amount_used, order_id, notes, version } = req.body;

      // Validation
      if (!phone_number) {
        return res.status(400).json({
          success: false,
          error: 'phone_number est requis'
        });
      }

      if (!amount_used || amount_used <= 0) {
        return res.status(400).json({
          success: false,
          error: 'amount_used doit être un montant positif'
        });
      }

      // Version est maintenant requise pour éviter les race conditions
      if (version === undefined || version === null) {
        return res.status(400).json({
          success: false,
          error: 'version est requise pour éviter les conflits. Veuillez relire le crédit avant utilisation.'
        });
      }

      // Récupérer le crédit actuel du client
      const creditQuery = `
        SELECT 
          *,
          CASE 
            WHEN expires_at > CURRENT_TIMESTAMP THEN credit_amount
            ELSE 0
          END as current_balance,
          CASE 
            WHEN expires_at > CURRENT_TIMESTAMP THEN false
            ELSE true
          END as is_expired
        FROM client_credits
        WHERE phone_number = $1
      `;

      const creditResult = await db.query(creditQuery, [phone_number]);

      // Vérifier si le client a un crédit
      if (creditResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Aucun crédit trouvé pour ce client',
          phone_number: phone_number
        });
      }

      const credit = creditResult.rows[0];

      // 🔒 OPTIMISTIC LOCKING: Vérifier la version
      if (credit.version !== parseInt(version)) {
        return res.status(409).json({
          success: false,
          error: 'CREDIT_VERSION_MISMATCH',
          message: 'Le crédit a été modifié par une autre transaction. Veuillez relire le crédit et réessayer.',
          phone_number: phone_number,
          current_version: credit.version,
          current_balance: parseFloat(credit.current_balance),
          retry: true
        });
      }

      // Vérifier si le crédit est expiré
      if (credit.is_expired) {
        return res.status(400).json({
          success: false,
          error: 'Le crédit de ce client est expiré',
          phone_number: phone_number,
          expired_at: credit.expires_at
        });
      }

      // Vérifier si le crédit est suffisant
      const currentBalance = parseFloat(credit.current_balance);
      const amountToUse = parseFloat(amount_used);

      if (currentBalance < amountToUse) {
        return res.status(400).json({
          success: false,
          error: 'Crédit insuffisant',
          phone_number: phone_number,
          current_balance: currentBalance,
          amount_requested: amountToUse,
          shortage: amountToUse - currentBalance
        });
      }

      // Calculer le nouveau solde
      const newBalance = currentBalance - amountToUse;

      // Mettre à jour le crédit
      let updateQuery;
      let updateParams;

      if (newBalance <= 0) {
        // Si le solde est 0 ou négatif, supprimer le crédit
        updateQuery = `
          DELETE FROM client_credits
          WHERE phone_number = $1
          RETURNING *
        `;
        updateParams = [phone_number];
      } else {
        // Sinon, mettre à jour le montant et incrémenter la version
        if (notes) {
          updateQuery = `
            UPDATE client_credits
            SET 
              credit_amount = $1,
              updated_at = CURRENT_TIMESTAMP,
              notes = $2,
              version = version + 1
            WHERE phone_number = $3 AND version = $4
            RETURNING *
          `;
          updateParams = [newBalance, notes, phone_number, version];
        } else {
          updateQuery = `
            UPDATE client_credits
            SET 
              credit_amount = $1,
              updated_at = CURRENT_TIMESTAMP,
              version = version + 1
            WHERE phone_number = $2 AND version = $3
            RETURNING *
          `;
          updateParams = [newBalance, phone_number, version];
        }
      }

      const updateResult = await db.query(updateQuery, updateParams);

      // Vérifier que l'UPDATE a bien affecté une ligne (sinon conflit de version)
      if (updateResult.rows.length === 0) {
        return res.status(409).json({
          success: false,
          error: 'CREDIT_VERSION_MISMATCH',
          message: 'Le crédit a été modifié par une autre transaction pendant le traitement. Veuillez réessayer.',
          phone_number: phone_number,
          retry: true
        });
      }

      const updatedCredit = updateResult.rows[0];

      // Enregistrer la transaction dans l'historique
      const transactionQuery = `
        INSERT INTO client_credit_transactions (
          phone_number,
          transaction_type,
          amount,
          balance_before,
          balance_after,
          order_id,
          notes,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `;
      
      await db.query(transactionQuery, [
        phone_number,
        'DEBIT',
        amountToUse,
        currentBalance,
        newBalance > 0 ? newBalance : 0,
        order_id || null,
        notes || null,
        'SYSTEM'
      ]);

      console.log(`✅ Crédit utilisé: ${phone_number} - ${amountToUse} FCFA déduit (solde: ${newBalance} FCFA) [v${credit.version} → v${updatedCredit.version}]`);

      return res.json({
        success: true,
        message: newBalance <= 0 ? 'Crédit entièrement utilisé' : 'Crédit utilisé avec succès',
        transaction: {
          phone_number: phone_number,
          amount_used: amountToUse,
          previous_balance: currentBalance,
          new_balance: newBalance > 0 ? newBalance : 0,
          previous_version: credit.version,
          new_version: updatedCredit.version,
          order_id: order_id || null,
          timestamp: new Date().toISOString(),
          transaction_id: `CRED_${Date.now()}`
        },
        credit: newBalance > 0 ? updatedCredit : null
      });

    } catch (error) {
      console.error('❌ Erreur useClientCredit:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'utilisation du crédit',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * POST /api/v1/clients/credits/refund
   * POST /api/external/clients/credits/refund
   * Rembourse/annule une utilisation de crédit (ex: commande supprimée)
   */
  static async refundClientCredit(req, res) {
    try {
      const { phone_number, amount, order_id, notes, version } = req.body;

      // Validation
      if (!phone_number) {
        return res.status(400).json({
          success: false,
          error: 'phone_number est requis'
        });
      }

      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'amount doit être un montant positif'
        });
      }

      // Récupérer le crédit actuel du client
      const creditQuery = `
        SELECT 
          *,
          CASE 
            WHEN expires_at > CURRENT_TIMESTAMP THEN credit_amount
            ELSE 0
          END as current_balance,
          CASE 
            WHEN expires_at > CURRENT_TIMESTAMP THEN false
            ELSE true
          END as is_expired
        FROM client_credits
        WHERE phone_number = $1
      `;

      const creditResult = await db.query(creditQuery, [phone_number]);

      let currentBalance = 0;
      let expirationDays = 30; // Par défaut
      let expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expirationDays);

      // Si le client a déjà un crédit
      if (creditResult.rows.length > 0) {
        const credit = creditResult.rows[0];
        currentBalance = parseFloat(credit.current_balance);
        expirationDays = credit.expiration_days;
        
        // Si le crédit n'est pas expiré, garder la même date d'expiration
        if (!credit.is_expired) {
          expiresAt = new Date(credit.expires_at);
        }
      }

      const amountToRefund = parseFloat(amount);
      const newBalance = currentBalance + amountToRefund;

      // Mettre à jour ou créer le crédit
      const upsertQuery = `
        INSERT INTO client_credits (
          phone_number,
          credit_amount,
          expiration_days,
          expires_at,
          created_by
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (phone_number) 
        DO UPDATE SET
          credit_amount = EXCLUDED.credit_amount,
          expires_at = EXCLUDED.expires_at,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      const updateResult = await db.query(upsertQuery, [
        phone_number,
        newBalance,
        expirationDays,
        expiresAt,
        'SYSTEM'
      ]);

      // Enregistrer la transaction dans l'historique
      const transactionQuery = `
        INSERT INTO client_credit_transactions (
          phone_number,
          transaction_type,
          amount,
          balance_before,
          balance_after,
          order_id,
          notes,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `;
      
      await db.query(transactionQuery, [
        phone_number,
        'REFUND',
        amountToRefund,
        currentBalance,
        newBalance,
        order_id || null,
        notes || 'Remboursement crédit',
        'SYSTEM'
      ]);

      console.log(`✅ Crédit remboursé: ${phone_number} + ${amountToRefund} FCFA (solde: ${newBalance} FCFA)`);

      return res.json({
        success: true,
        message: 'Crédit remboursé avec succès',
        transaction: {
          phone_number: phone_number,
          amount_refunded: amountToRefund,
          previous_balance: currentBalance,
          new_balance: newBalance,
          order_id: order_id || null,
          timestamp: new Date().toISOString()
        },
        credit: updateResult.rows[0]
      });

    } catch (error) {
      console.error('❌ Erreur refundClientCredit:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors du remboursement du crédit',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * GET /api/v1/clients/credits/history/:phone_number
   * GET /api/external/clients/credits/history/:phone_number
   * Récupère l'historique des transactions de crédit d'un client
   */
  static async getClientCreditHistory(req, res) {
    try {
      const { phone_number } = req.params;
      const { limit = 50 } = req.query;

      const query = `
        SELECT 
          id,
          phone_number,
          transaction_type,
          amount,
          balance_before,
          balance_after,
          order_id,
          notes,
          created_by,
          created_at,
          CASE 
            WHEN transaction_type = 'CREDIT' THEN 'Attribution'
            WHEN transaction_type = 'DEBIT' THEN 'Utilisation'
            WHEN transaction_type = 'REFUND' THEN 'Remboursement'
            ELSE transaction_type
          END as transaction_label
        FROM client_credit_transactions
        WHERE phone_number = $1
        ORDER BY created_at DESC
        LIMIT $2
      `;

      const result = await db.query(query, [phone_number, parseInt(limit)]);

      return res.json({
        success: true,
        phone_number: phone_number,
        count: result.rows.length,
        transactions: result.rows
      });

    } catch (error) {
      console.error('❌ Erreur getClientCreditHistory:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération de l\'historique',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = ClientCreditsController;

