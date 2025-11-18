// Contrôleur pour l'API externe d'audit client MATA

const db = require('../models/database');
const { buildPhoneSearchClause, normalizePhoneNumber } = require('../utils/phoneNormalizer');
const { analyzeClientSentiment } = require('../services/sentimentAnalysisService');

class ExternalMataAuditController {
  /**
   * Récupère l'historique complet d'un client avec analyse de sentiment
   * GET /api/external/mata/audit/client?phone_number=XXX
   * POST /api/external/mata/audit/client (Body: { phone_number })
   * Header: x-api-key
   */
  static async getClientAudit(req, res) {
    try {
      // Accepter le numéro depuis query (GET) ou body (POST)
      const phone_number = req.query.phone_number || req.body.phone_number;

      if (!phone_number) {
        return res.status(400).json({
          success: false,
          error: 'phone_number est requis'
        });
      }

      console.log('📞 Recherche client avec numéro:', phone_number);

      // Normaliser le numéro de téléphone
      const phoneInfo = normalizePhoneNumber(phone_number);
      
      if (!phoneInfo) {
        return res.status(400).json({
          success: false,
          error: 'Format de numéro de téléphone invalide'
        });
      }

      console.log('📞 Numéro normalisé:', phoneInfo.normalized, '- Pays:', phoneInfo.country);

      // Construire la requête SQL avec toutes les variantes
      const { clause, params, normalized, country } = buildPhoneSearchClause(phone_number);

      // Récupérer l'historique du client
      const query = `
        SELECT 
          o.id,
          TO_CHAR(DATE(o.created_at), 'YYYY-MM-DD') as date,
          o.phone_number,
          o.client_name,
          o.adresse_source,
          COALESCE(NULLIF(o.adresse_destination, ''), o.address) as adresse_destination,
          o.point_de_vente,
          o.amount as montant_commande,
          o.order_type,
          o.commentaire,
          o.service_rating,
          o.quality_rating,
          o.price_rating,
          o.commercial_service_rating,
          o.source_connaissance,
          o.interne,
          u.username as livreur,
          o.created_at
        FROM orders o
        LEFT JOIN users u ON o.created_by = u.id
        WHERE ${clause}
          AND o.order_type = 'MATA'
        ORDER BY o.created_at DESC
      `;

      const result = await db.query(query, params);
      const orders = result.rows;

      if (orders.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Aucune commande trouvée pour ce numéro',
          phone_number: phone_number,
          normalized_phone: normalized,
          country: country
        });
      }

      // Informations client
      const clientInfo = {
        name: orders[0].client_name,
        phone_number: orders[0].phone_number,
        normalized_phone: normalized,
        country: country,
        first_order: orders[orders.length - 1].date,
        last_order: orders[0].date,
        total_orders: orders.length
      };

      // Statistiques
      const statistics = {
        total_orders: orders.length,
        total_amount: orders.reduce((sum, o) => sum + (parseFloat(o.montant_commande) || 0), 0),
        avg_amount: orders.length > 0 
          ? orders.reduce((sum, o) => sum + (parseFloat(o.montant_commande) || 0), 0) / orders.length 
          : 0,
        avg_rating: calculateGlobalAverageRating(orders)
      };

      // Analyse de sentiment avec OpenAI
      console.log('🤖 Analyse de sentiment en cours avec OpenAI...');
      const sentimentAnalysis = await analyzeClientSentiment(orders, clientInfo);
      console.log('✅ Analyse de sentiment terminée');

      // Formater les commandes pour la réponse
      const formattedOrders = orders.map(order => ({
        date: order.date,
        point_de_vente: order.point_de_vente,
        montant: parseFloat(order.montant_commande),
        livreur: order.livreur,
        commentaire: order.commentaire || null,
        source_connaissance: order.source_connaissance || null,
        ratings: {
          service: order.service_rating ? parseFloat(order.service_rating) : null,
          quality: order.quality_rating ? parseFloat(order.quality_rating) : null,
          price: order.price_rating ? parseFloat(order.price_rating) : null,
          commercial_service: order.commercial_service_rating ? parseFloat(order.commercial_service_rating) : null,
          average: calculateOrderAverageRating(order)
        },
        adresse_source: order.adresse_source,
        adresse_destination: order.adresse_destination
      }));

      // Réponse complète
      res.json({
        success: true,
        phone_number: phone_number,
        normalized_phone: normalized,
        country: country,
        client_info: clientInfo,
        orders_history: formattedOrders,
        sentiment_analysis: sentimentAnalysis,
        statistics: statistics,
        generated_at: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur dans getClientAudit:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur interne du serveur',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

/**
 * Calcule la note moyenne d'une commande
 */
function calculateOrderAverageRating(order) {
  const ratings = [
    order.service_rating,
    order.quality_rating,
    order.price_rating,
    order.commercial_service_rating
  ].filter(r => r !== null && r !== undefined).map(r => parseFloat(r));

  if (ratings.length === 0) return null;
  return parseFloat((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2));
}

/**
 * Calcule la note moyenne globale de toutes les commandes
 */
function calculateGlobalAverageRating(orders) {
  const allRatings = orders.map(order => calculateOrderAverageRating(order))
    .filter(rating => rating !== null);

  if (allRatings.length === 0) return null;
  return parseFloat((allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(2));
}

module.exports = ExternalMataAuditController;

