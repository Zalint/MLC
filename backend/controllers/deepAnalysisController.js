/**
 * 🤖 Deep Analysis Controller (Orchestrateur IA)
 * 
 * Orchestre l'analyse approfondie en utilisant OpenAI pour:
 * 1. Convertir la question en langage naturel → endpoint approprié
 * 2. Appeler l'endpoint MATA Analytics correspondant
 * 3. Interpréter les résultats avec OpenAI
 * 4. Retourner une réponse enrichie au frontend
 */

const axios = require('axios'); // Pour les appels OpenAI uniquement

class DeepAnalysisController {
  /**
   * Endpoint principal: Analyse approfondie pilotée par IA
   * POST /api/v1/orders/mata-deep-analysis
   * Body: { question: "Quels clients n'ont commandé qu'une fois?" }
   */
  static async performDeepAnalysis(req, res) {
    const startTime = Date.now(); // Début du chronomètre
    
    try {
      const { question } = req.body;
      
      // Validation
      if (!question || typeof question !== 'string' || question.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Une question valide est requise'
        });
      }
      
      if (question.length > 500) {
        return res.status(400).json({
          success: false,
          error: 'La question est trop longue (max 500 caractères)'
        });
      }
      
      console.log('🤖 Deep Analysis - Question:', question);
      
      // Vérifier si OpenAI est configuré
      if (!process.env.OPENAI_API_KEY) {
        return res.status(503).json({
          success: false,
          error: 'Service d\'IA non configuré. Veuillez contacter l\'administrateur.'
        });
      }
      
      // ÉTAPE 1: Demander à OpenAI quel endpoint utiliser
      const endpointMapping = await DeepAnalysisController._mapQuestionToEndpoint(question);
      
      if (!endpointMapping.success) {
        return res.status(400).json({
          success: false,
          error: endpointMapping.error,
          suggestion: endpointMapping.suggestion
        });
      }
      
      console.log('🎯 Endpoint choisi:', endpointMapping.endpoint);
      console.log('📊 Paramètres:', endpointMapping.params);
      
      // ÉTAPE 2: Appeler l'endpoint MATA Analytics
      const analyticsData = await DeepAnalysisController._callAnalyticsEndpoint(
        endpointMapping.endpoint,
        endpointMapping.params,
        req.user
      );
      
      if (!analyticsData.success) {
        console.error('❌ Analytics endpoint error:', analyticsData.error);
        return res.status(500).json({
          success: false,
          error: analyticsData.error || 'Erreur lors de la récupération des données'
        });
      }
      
      // ÉTAPE 3: Interpréter les résultats avec OpenAI
      const interpretation = await DeepAnalysisController._interpretResults(
        question,
        endpointMapping,
        analyticsData
      );
      
      // ÉTAPE 4: Retourner la réponse enrichie
      res.json({
        success: true,
        question: question,
        endpoint_used: endpointMapping.endpoint,
        result_count: analyticsData.result_count || 0,
        interpretation: interpretation,
        data: analyticsData.data || [],
        metadata: {
          execution_time_ms: Date.now() - startTime,
          ...analyticsData.metadata
        }
      });
      
    } catch (error) {
      console.error('❌ Error in performDeepAnalysis:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'analyse approfondie',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * Mapper une question en langage naturel vers un endpoint
   * Utilise OpenAI pour déterminer l'endpoint le plus approprié
   */
  static async _mapQuestionToEndpoint(question) {
    try {
      const currentYear = new Date().getFullYear();
      const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
      const currentDate = new Date().toISOString().split('T')[0];
      const twoYearsAgo = `${currentYear - 2}-01-01`;
      
      const systemPrompt = `Tu es un assistant d'analyse de données pour un service de livraison de viande (MATA).

CONTEXTE TEMPOREL:
- Date du jour: ${currentDate}
- Année en cours: ${currentYear}
- Mois en cours: ${currentYear}-${currentMonth}
- Par défaut, cherche sur les 2 dernières années: de ${twoYearsAgo} à ${currentDate}
- IMPORTANT: N'utilise JAMAIS d'années passées (2023, 2022) sauf si explicitement demandé

ENDPOINTS DISPONIBLES (GET uniquement):

1. /mata-analytics/one-time-customers
   Usage: Clients qui n'ont commandé qu'une seule fois
   Params: month (optionnel, format: YYYY-MM)

2. /mata-analytics/inactive-customers
   Usage: Clients inactifs depuis X jours
   Params: days (défaut: 30), min_amount (optionnel), max_amount (optionnel)
   Exemples: "clients inactifs depuis 30 jours avec panier > 20000"

3. /mata-analytics/top-customers
   Usage: Top N clients par montant total dépensé
   Params: limit (défaut: 10), period (all ou YYYY-MM), min_amount (optionnel), max_amount (optionnel)
   Exemples: "top 10 clients avec panier entre 20000 et 100000"

4. /mata-analytics/new-customers
   Usage: Nouveaux clients d'une période donnée
   Params: month (format: YYYY-MM)

5. /mata-analytics/customer-retention
   Usage: Taux de rétention mensuel
   Params: start_month, end_month (format: YYYY-MM)

6. /mata-analytics/customers-by-point-vente
   Usage: Distribution des clients par point de vente
   Params: month (optionnel)

7. /mata-analytics/high-value-customers
   Usage: Clients avec dépenses totales élevées
   Params: min_amount (défaut: 100000)

8. /mata-analytics/frequent-customers
   Usage: Clients qui commandent souvent
   Params: min_orders (défaut: 5)

9. /mata-analytics/churn-risk
   Usage: Clients à risque de partir (inactifs récemment)
   Params: threshold_days (défaut: 45)

10. /mata-analytics/customer-satisfaction
    Usage: Clients par niveau de satisfaction (notes)
    Params: min_rating (0-10), max_rating (0-10), min_amount (optionnel), max_amount (optionnel)
    Exemples: "clients satisfaits (rating > 8) avec panier > 50000"

11. /mata-analytics/customers-by-day-of-week
    Usage: Distribution par jour de la semaine
    Params: month (optionnel)

12. /mata-analytics/customer-lifetime-value
    Usage: Valeur vie client (CLV) - meilleurs clients par valeur totale
    Params: top (défaut: 20), min_amount (optionnel), max_amount (optionnel)
    Exemples: "top 20 clients avec CLV entre 50000 et 200000"

13. /mata-analytics/orders-detailed (⭐ FALLBACK)
    Usage: Détails complets des commandes sur une période
    Params: start_date (YYYY-MM-DD), end_date (YYYY-MM-DD), limit (max: 5000), phone_number (optionnel)
    Exemples: "toutes les commandes du 773929671" → utilise phone_number='773929671'
    Utilisé pour: questions générales nécessitant tous les détails OU historique d'un client spécifique

STRATÉGIE:
1. Si la question correspond à un endpoint spécifique (1-12), utilise-le
2. Si la question est générale/complexe, utilise orders-detailed (13)
3. Retourne UNIQUEMENT un JSON valide sans markdown

RÈGLES POUR LES DATES:
- Si aucune période n'est mentionnée → utilise les 2 dernières années (${twoYearsAgo} à ${currentDate})
- "ce mois" → ${currentYear}-${currentMonth}
- "cette année" → ${currentYear}-01-01 à ${currentDate}
- "année dernière" → ${currentYear - 1}-01-01 à ${currentYear - 1}-12-31
- JAMAIS utiliser 2023, 2022 ou années antérieures sauf si explicitement demandé

RÈGLES POUR LES MONTANTS (panier/dépenses):
- "panier < X" ou "inférieur à X" → utilise top-customers avec max_amount=X
- "panier > X" ou "supérieur à X" → utilise high-value-customers avec min_amount=X
- "panier entre X et Y" → utilise top-customers avec min_amount=X, max_amount=Y
- Le "panier total" = la somme de toutes les commandes d'un client

EXEMPLES:

Q: "Quels clients n'ont commandé qu'une fois ?"
→ {
    "endpoint": "/mata-analytics/one-time-customers",
    "params": {},
    "explanation": "Endpoint dédié pour les clients avec une seule commande"
  }

Q: "Clients inactifs depuis 30 jours"
→ {
    "endpoint": "/mata-analytics/inactive-customers",
    "params": {"days": 30},
    "explanation": "Recherche des clients sans commande depuis 30 jours"
  }

Q: "Top 10 meilleurs clients"
→ {
    "endpoint": "/mata-analytics/top-customers",
    "params": {"limit": 10, "period": "all"},
    "explanation": "Top 10 clients par montant total"
  }

Q: "Clients qui ont commandé plus de 100000 FCFA"
→ {
    "endpoint": "/mata-analytics/high-value-customers",
    "params": {"min_amount": 100000},
    "explanation": "Clients à forte valeur avec minimum 100k FCFA"
  }

Q: "Clients avec un panier total inférieur à 10000 FCFA"
→ {
    "endpoint": "/mata-analytics/top-customers",
    "params": {"limit": 100, "period": "all", "max_amount": 10000},
    "explanation": "Clients avec dépenses totales inférieures à 10k FCFA"
  }

Q: "Clients avec un panier total supérieur à 30000 FCFA"
→ {
    "endpoint": "/mata-analytics/high-value-customers",
    "params": {"min_amount": 30000},
    "explanation": "Clients avec dépenses totales supérieures à 30k FCFA"
  }

Q: "Clients inactifs depuis 30 jours avec un panier supérieur à 50000"
→ {
    "endpoint": "/mata-analytics/inactive-customers",
    "params": {"days": 30, "min_amount": 50000},
    "explanation": "Clients inactifs avec dépenses totales > 50k FCFA"
  }

Q: "Top 10 clients avec panier entre 20000 et 100000"
→ {
    "endpoint": "/mata-analytics/top-customers",
    "params": {"limit": 10, "period": "all", "min_amount": 20000, "max_amount": 100000},
    "explanation": "Top 10 clients dans la fourchette 20k-100k FCFA"
  }

Q: "Clients qui commandent le vendredi à Ngor" (question complexe)
→ {
    "endpoint": "/mata-analytics/orders-detailed",
    "params": {
      "start_date": "${twoYearsAgo}",
      "end_date": "${currentDate}",
      "limit": 5000
    },
    "explanation": "Question complexe nécessitant filtrage multiple (jour + point vente)",
    "post_processing": "Filtrer: day_of_week='Vendredi' ET point_de_vente='Ngor'"
  }

Q: "Toutes les commandes du numéro 773929671" (historique complet d'un client)
→ {
    "endpoint": "/mata-analytics/orders-detailed",
    "params": {
      "start_date": "${twoYearsAgo}",
      "end_date": "${currentDate}",
      "limit": 5000,
      "phone_number": "773929671"
    },
    "explanation": "Historique complet du client 773929671 sur les 2 dernières années"
  }

Si aucun endpoint ne correspond ou question incompréhensible:
{
  "endpoint": null,
  "error": "Question non supportée",
  "suggestion": "Reformulez votre question. Exemples: 'Clients à 1 commande', 'Top 10 clients', 'Clients inactifs 30 jours'"
}

Réponds UNIQUEMENT en JSON valide (pas de markdown, pas de \`\`\`json).`;

      const userPrompt = `Question: "${question}"`;
      
      const openaiResponse = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3, // Plus bas pour être plus déterministe
          max_tokens: 500
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10 secondes
        }
      );
      
      const aiResponse = openaiResponse.data.choices[0].message.content.trim();
      console.log('🤖 OpenAI mapping response:', aiResponse);
      
      // Parser la réponse JSON
      let mapping;
      try {
        // Nettoyer la réponse si elle contient du markdown
        const cleanedResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        mapping = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError);
        return {
          success: false,
          error: 'Erreur lors de l\'analyse de la question',
          suggestion: 'Reformulez votre question de manière plus simple'
        };
      }
      
      // Vérifier si l'endpoint est null (question non supportée)
      if (!mapping.endpoint) {
        return {
          success: false,
          error: mapping.error || 'Question non comprise',
          suggestion: mapping.suggestion || 'Reformulez votre question'
        };
      }
      
      // Valider que l'endpoint fait partie de la whitelist
      const validEndpoints = [
        '/mata-analytics/one-time-customers',
        '/mata-analytics/inactive-customers',
        '/mata-analytics/top-customers',
        '/mata-analytics/new-customers',
        '/mata-analytics/customer-retention',
        '/mata-analytics/customers-by-point-vente',
        '/mata-analytics/high-value-customers',
        '/mata-analytics/frequent-customers',
        '/mata-analytics/churn-risk',
        '/mata-analytics/customer-satisfaction',
        '/mata-analytics/customers-by-day-of-week',
        '/mata-analytics/customer-lifetime-value',
        '/mata-analytics/orders-detailed'
      ];
      
      if (!validEndpoints.includes(mapping.endpoint)) {
        console.error('❌ Invalid endpoint from AI:', mapping.endpoint);
        return {
          success: false,
          error: 'Endpoint non valide suggéré par l\'IA',
          suggestion: 'Reformulez votre question'
        };
      }
      
      return {
        success: true,
        endpoint: mapping.endpoint,
        params: mapping.params || {},
        explanation: mapping.explanation,
        post_processing: mapping.post_processing
      };
      
    } catch (error) {
      console.error('❌ Error in _mapQuestionToEndpoint:', error);
      
      if (error.response?.status === 401) {
        return {
          success: false,
          error: 'Clé API OpenAI invalide',
          suggestion: 'Contactez l\'administrateur'
        };
      }
      
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return {
          success: false,
          error: 'Timeout lors de la connexion à l\'IA',
          suggestion: 'Réessayez dans quelques instants'
        };
      }
      
      return {
        success: false,
        error: 'Erreur lors de l\'analyse de la question',
        suggestion: 'Réessayez ou reformulez votre question'
      };
    }
  }
  
  /**
   * Appeler l'endpoint MATA Analytics approprié
   * Appel direct du controller au lieu d'un appel HTTP
   */
  static async _callAnalyticsEndpoint(endpoint, params, user) {
    try {
      const MataAnalyticsController = require('./mataAnalyticsController');
      
      console.log('📡 Calling analytics controller:', endpoint, params);
      
      // Créer des objets req/res simulés pour appeler le controller directement
      const mockReq = {
        query: params,
        user: user
      };
      
      const mockRes = {
        data: null,
        status: 200,
        json: function(data) {
          this.data = data;
          return this;
        },
        status: function(code) {
          this.statusCode = code;
          return this;
        }
      };
      
      // Mapper l'endpoint vers la méthode du controller
      const endpointMap = {
        '/mata-analytics/one-time-customers': 'getOneTimeCustomers',
        '/mata-analytics/inactive-customers': 'getInactiveCustomers',
        '/mata-analytics/top-customers': 'getTopCustomers',
        '/mata-analytics/new-customers': 'getNewCustomers',
        '/mata-analytics/customer-retention': 'getCustomerRetention',
        '/mata-analytics/customers-by-point-vente': 'getCustomersByPointVente',
        '/mata-analytics/high-value-customers': 'getHighValueCustomers',
        '/mata-analytics/frequent-customers': 'getFrequentCustomers',
        '/mata-analytics/churn-risk': 'getChurnRisk',
        '/mata-analytics/customer-satisfaction': 'getCustomerSatisfaction',
        '/mata-analytics/customers-by-day-of-week': 'getCustomersByDayOfWeek',
        '/mata-analytics/customer-lifetime-value': 'getCustomerLifetimeValue',
        '/mata-analytics/orders-detailed': 'getOrdersDetailed'
      };
      
      const methodName = endpointMap[endpoint];
      if (!methodName || !MataAnalyticsController[methodName]) {
        return {
          success: false,
          error: 'Endpoint non trouvé'
        };
      }
      
      // Appeler la méthode du controller
      await MataAnalyticsController[methodName](mockReq, mockRes);
      
      return mockRes.data;
      
    } catch (error) {
      console.error('❌ Error calling analytics controller:', error.message);
      console.error('❌ Stack:', error.stack);
      return {
        success: false,
        error: error.message || 'Erreur lors de la récupération des données'
      };
    }
  }
  
  /**
   * Interpréter les résultats avec OpenAI
   */
  static async _interpretResults(question, endpointMapping, analyticsData) {
    try {
      // Si pas de données, retourner un message simple
      if (!analyticsData.data || analyticsData.data.length === 0) {
        return {
          summary: 'Aucun résultat trouvé pour cette analyse.',
          insights: [],
          recommendation: 'Essayez d\'élargir vos critères de recherche ou de changer la période analysée.'
        };
      }
      
      // Construire un résumé des données pour OpenAI (limité pour éviter token overflow)
      const dataSummary = {
        result_count: analyticsData.result_count,
        sample_data: analyticsData.data.slice(0, 5), // Seulement les 5 premiers
        endpoint: endpointMapping.endpoint,
        params: endpointMapping.params
      };
      
      const systemPrompt = `Tu es un analyste expert en données pour un service de livraison.
Analyse les résultats de la requête et fournis une interprétation claire et actionnable.

INSTRUCTIONS:
1. Résume les résultats en 2-3 phrases claires
2. Identifie 2-3 insights clés (patterns, tendances, anomalies)
3. Propose 1-2 recommandations actionnables

Réponds UNIQUEMENT en JSON valide:
{
  "summary": "2-3 phrases résumant les résultats",
  "insights": ["insight 1", "insight 2", "insight 3"],
  "recommendation": "Recommandation actionnable basée sur les données"
}`;

      const userPrompt = `Question initiale: "${question}"

Endpoint utilisé: ${endpointMapping.endpoint}
Explication: ${endpointMapping.explanation}

Résultats trouvés: ${analyticsData.result_count} éléments

Échantillon de données:
${JSON.stringify(dataSummary.sample_data, null, 2)}

Analyse ces résultats et fournis une interprétation.`;

      const openaiResponse = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 800
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );
      
      const aiInterpretation = openaiResponse.data.choices[0].message.content.trim();
      console.log('🤖 OpenAI interpretation:', aiInterpretation);
      
      // Parser la réponse
      const cleanedResponse = aiInterpretation.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const interpretation = JSON.parse(cleanedResponse);
      
      return interpretation;
      
    } catch (error) {
      console.error('❌ Error in _interpretResults:', error);
      
      // Fallback: interprétation basique sans IA
      return {
        summary: `${analyticsData.result_count} résultat(s) trouvé(s) pour votre recherche.`,
        insights: ['Données récupérées avec succès.'],
        recommendation: 'Consultez les détails ci-dessous pour plus d\'informations.'
      };
    }
  }
}

module.exports = DeepAnalysisController;

