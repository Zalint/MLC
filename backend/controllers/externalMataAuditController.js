// Contrôleur pour l'API externe d'audit client MATA

const db = require('../models/database');
const { buildPhoneSearchClause, normalizePhoneNumber } = require('../utils/phoneNormalizer');
const { analyzeClientSentiment } = require('../services/sentimentAnalysisService');

// ⚡ Cache en mémoire pour les analyses de sentiment (économise les appels OpenAI)
const sentimentCache = new Map();

// Nettoyage automatique du cache toutes les heures
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of sentimentCache.entries()) {
    if (now - value.timestamp > 6 * 60 * 60 * 1000) { // 6 heures
      sentimentCache.delete(key);
      console.log('🧹 Cache sentiment expiré:', key);
    }
  }
}, 60 * 60 * 1000); // Vérification toutes les heures

class ExternalMataAuditController {
  /**
   * Récupère l'historique complet d'un client avec analyse de sentiment
   * GET /api/external/mata/audit/client?phone_number=XXX&skip_sentiment=true
   * POST /api/external/mata/audit/client (Body: { phone_number, skip_sentiment })
   * Header: x-api-key
   */
  static async getClientAudit(req, res) {
    const startTime = Date.now(); // ⚡ Mesure de performance
    
    try {
      // Accepter le numéro depuis query (GET) ou body (POST)
      const phone_number = req.query.phone_number || req.body.phone_number;
      const skip_sentiment = (req.query.skip_sentiment === 'true') || (req.body.skip_sentiment === true);

      if (!phone_number) {
        return res.status(400).json({
          success: false,
          error: 'phone_number est requis'
        });
      }

      console.log('📞 Recherche client avec numéro:', phone_number, skip_sentiment ? '(sans analyse)' : '(avec analyse)');

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

      // ⚡ Récupérer le crédit client (avec gestion expiration)
      const creditQuery = `
        SELECT 
          credit_amount,
          expires_at,
          expiration_days,
          created_at,
          CASE 
            WHEN expires_at > CURRENT_TIMESTAMP THEN credit_amount
            ELSE 0
          END as current_balance,
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
      
      const creditResult = await db.query(creditQuery, [orders[0].phone_number]);
      
      if (creditResult.rows.length > 0) {
        const credit = creditResult.rows[0];
        clientInfo.credit = {
          amount: parseFloat(credit.credit_amount),
          current_balance: parseFloat(credit.current_balance),
          expires_at: credit.expires_at,
          expiration_days: credit.expiration_days,
          is_expired: credit.is_expired,
          days_remaining: credit.days_remaining,
          created_at: credit.created_at
        };
      } else {
        clientInfo.credit = null;
      }

      // Statistiques
      const statistics = {
        total_orders: orders.length,
        total_amount: orders.reduce((sum, o) => sum + (parseFloat(o.montant_commande) || 0), 0),
        avg_amount: orders.length > 0 
          ? orders.reduce((sum, o) => sum + (parseFloat(o.montant_commande) || 0), 0) / orders.length 
          : 0,
        avg_rating: calculateGlobalAverageRating(orders)
      };

      // ⚡ ANALYSE DE SENTIMENT OPTIMISÉE
      let sentimentAnalysis = null;
      
      if (!skip_sentiment) {
        // Générer une clé de cache unique basée sur le téléphone, nombre de commandes et date dernière commande
        const cacheKey = `sentiment_${normalized}_${orders.length}_${orders[0].date}`;
        
        // Vérifier si l'analyse est en cache
        const cachedResult = sentimentCache.get(cacheKey);
        
        if (cachedResult && (Date.now() - cachedResult.timestamp < 6 * 60 * 60 * 1000)) {
          // Cache valide (< 6 heures)
          console.log(`⚡ Analyse depuis cache pour ${normalized} (économie d'appel OpenAI)`);
          sentimentAnalysis = {
            ...cachedResult.data,
            cached: true,
            cache_age_minutes: Math.floor((Date.now() - cachedResult.timestamp) / 60000)
          };
        } else {
          // Pas en cache ou expiré - appel OpenAI
          console.log(`🤖 Nouvelle analyse de sentiment pour ${normalized}...`);
          const analysisStartTime = Date.now();
          
          sentimentAnalysis = await analyzeClientSentiment(orders, clientInfo);
          
          const analysisTime = Date.now() - analysisStartTime;
          sentimentAnalysis.cached = false;
          sentimentAnalysis.analysis_time_ms = analysisTime;
          
          // Mettre en cache
          sentimentCache.set(cacheKey, {
            data: sentimentAnalysis,
            timestamp: Date.now()
          });
          
          console.log(`✅ Analyse terminée en ${analysisTime}ms et mise en cache`);
        }
      } else {
        // Analyse ignorée (skip_sentiment=true)
        console.log(`⚡ Analyse de sentiment ignorée pour ${normalized} (gain de temps)`);
        sentimentAnalysis = {
          skipped: true,
          message: 'Analyse de sentiment non demandée (skip_sentiment=true)',
          tip: 'Retirez le paramètre skip_sentiment pour obtenir l\'analyse complète'
        };
      }

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

      const totalTime = Date.now() - startTime;
      console.log(`✅ Réponse générée en ${totalTime}ms pour ${normalized}`);

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
        performance: {
          total_time_ms: totalTime,
          cache_size: sentimentCache.size
        },
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

