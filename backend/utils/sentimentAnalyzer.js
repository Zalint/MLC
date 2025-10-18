/**
 * 🤖 Daily Sentiment Analyzer for MATA Orders
 * 
 * Analyse la satisfaction client basée sur les notes et commentaires
 * Utilise OpenAI GPT-4o-mini pour générer des descriptions intelligentes
 */

const db = require('../models/database');
const OpenAI = require('openai');

class DailySentimentAnalyzer {
  /**
   * Analyse le sentiment client MATA pour une date donnée
   * Si pas de données pour cette date, cherche la date la plus récente avant
   * 
   * @param {string} requestedDate - Date demandée au format YYYY-MM-DD
   * @returns {Promise<object|null>} Objet sentimentAnalysis ou null si aucune donnée
   */
  static async analyzeDailySentiment(requestedDate) {
    try {
      console.log(`🔍 Analyse de sentiment pour la date: ${requestedDate}`);

      // Étape 1: Trouver la date la plus récente avec des évaluations
      // IMPORTANT: Formater la date en SQL pour éviter les problèmes de timezone
      const mostRecentDateQuery = `
        SELECT TO_CHAR(DATE(created_at), 'YYYY-MM-DD') as analysis_date
        FROM orders
        WHERE DATE(created_at) <= $1
          AND order_type = 'MATA'
          AND (interne = false OR interne IS NULL)
          AND (average_rating IS NOT NULL 
               OR service_rating IS NOT NULL 
               OR quality_rating IS NOT NULL 
               OR price_rating IS NOT NULL 
               OR commercial_service_rating IS NOT NULL)
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const dateResult = await db.query(mostRecentDateQuery, [requestedDate]);

      if (dateResult.rows.length === 0) {
        console.log('⚠️ Aucune donnée d\'évaluation trouvée');
        return null;
      }

      const analysisDate = dateResult.rows[0].analysis_date; // Déjà formaté par SQL
      console.log(`✅ Date d'analyse trouvée: ${analysisDate}`);

      // Étape 2: Récupérer les données de sentiment pour cette date
      const sentimentDataQuery = `
        WITH sentiment_by_point_vente AS (
          SELECT 
            point_de_vente,
            COUNT(*) FILTER (WHERE service_rating IS NOT NULL OR quality_rating IS NOT NULL OR price_rating IS NOT NULL) as nombre_evaluations,
            ROUND(AVG(
              COALESCE(average_rating, 
                (COALESCE(service_rating, 0) + COALESCE(quality_rating, 0) + COALESCE(price_rating, 0) + COALESCE(commercial_service_rating, 0)) / 
                NULLIF((CASE WHEN service_rating IS NOT NULL THEN 1 ELSE 0 END + 
                        CASE WHEN quality_rating IS NOT NULL THEN 1 ELSE 0 END + 
                        CASE WHEN price_rating IS NOT NULL THEN 1 ELSE 0 END + 
                        CASE WHEN commercial_service_rating IS NOT NULL THEN 1 ELSE 0 END), 0)
              )
            ), 1) as note_moyenne,
            COUNT(*) FILTER (WHERE commentaire IS NOT NULL AND commentaire != '') as nombre_commentaires,
            STRING_AGG(
              CASE 
                WHEN commentaire IS NOT NULL AND commentaire != '' AND LENGTH(commentaire) > 5
                THEN commentaire
              END, 
              ' | '
            ) FILTER (WHERE commentaire IS NOT NULL AND commentaire != '') as commentaires_sample,
            ROUND(AVG(service_rating), 1) as service_rating_avg,
            ROUND(AVG(quality_rating), 1) as quality_rating_avg,
            ROUND(AVG(price_rating), 1) as price_rating_avg,
            ROUND(AVG(commercial_service_rating), 1) as commercial_service_rating_avg
          FROM orders
          WHERE DATE(created_at) = $1
            AND order_type = 'MATA'
            AND (interne = false OR interne IS NULL)
          GROUP BY point_de_vente
        ),
        global_sentiment AS (
          SELECT 
            COUNT(*) as total_commandes,
            COUNT(*) FILTER (WHERE service_rating IS NOT NULL OR quality_rating IS NOT NULL OR price_rating IS NOT NULL) as total_evaluees,
            COUNT(*) FILTER (WHERE commentaire IS NOT NULL AND commentaire != '') as total_commentaires,
            ROUND(AVG(
              COALESCE(average_rating, 
                (COALESCE(service_rating, 0) + COALESCE(quality_rating, 0) + COALESCE(price_rating, 0) + COALESCE(commercial_service_rating, 0)) / 
                NULLIF((CASE WHEN service_rating IS NOT NULL THEN 1 ELSE 0 END + 
                        CASE WHEN quality_rating IS NOT NULL THEN 1 ELSE 0 END + 
                        CASE WHEN price_rating IS NOT NULL THEN 1 ELSE 0 END + 
                        CASE WHEN commercial_service_rating IS NOT NULL THEN 1 ELSE 0 END), 0)
              )
            ), 1) as note_moyenne_globale,
            STRING_AGG(
              CASE 
                WHEN commentaire IS NOT NULL AND commentaire != '' AND LENGTH(commentaire) > 5
                THEN commentaire
              END, 
              ' | '
            ) FILTER (WHERE commentaire IS NOT NULL AND commentaire != '') as commentaires_globaux,
            ROUND(AVG(service_rating), 1) as service_rating_global,
            ROUND(AVG(quality_rating), 1) as quality_rating_global,
            ROUND(AVG(price_rating), 1) as price_rating_global,
            ROUND(AVG(commercial_service_rating), 1) as commercial_service_rating_global
          FROM orders
          WHERE DATE(created_at) = $1
            AND order_type = 'MATA'
            AND (interne = false OR interne IS NULL)
        )
        SELECT 
          (SELECT json_build_object(
            'total_commandes', total_commandes,
            'total_evaluees', total_evaluees,
            'total_commentaires', total_commentaires,
            'note_moyenne', note_moyenne_globale,
            'commentaires', commentaires_globaux,
            'service_rating', service_rating_global,
            'quality_rating', quality_rating_global,
            'price_rating', price_rating_global,
            'commercial_service_rating', commercial_service_rating_global
          ) FROM global_sentiment) as global_data,
          json_agg(
            json_build_object(
              'point_de_vente', point_de_vente,
              'nombre_evaluations', nombre_evaluations,
              'note_moyenne', note_moyenne,
              'nombre_commentaires', nombre_commentaires,
              'commentaires', commentaires_sample,
              'service_rating', service_rating_avg,
              'quality_rating', quality_rating_avg,
              'price_rating', price_rating_avg,
              'commercial_service_rating', commercial_service_rating_avg
            )
          ) FILTER (WHERE point_de_vente IS NOT NULL) as points_vente_data
        FROM sentiment_by_point_vente
      `;

      const sentimentResult = await db.query(sentimentDataQuery, [analysisDate]);

      if (!sentimentResult.rows[0] || !sentimentResult.rows[0].global_data) {
        console.log('⚠️ Aucune donnée de sentiment trouvée');
        return null;
      }

      const globalData = sentimentResult.rows[0].global_data;
      const pointsVenteData = sentimentResult.rows[0].points_vente_data || [];

      // Étape 3: Calculer les sentiments par point de vente avec données historiques si nécessaire
      const parPointVente = await Promise.all(
        pointsVenteData.map(async (pv) => {
          // Déterminer la date d'analyse pour ce point de vente
          let pvAnalysisDate = analysisDate; // Par défaut, la date actuelle
          let pvData = pv; // Par défaut, utiliser les données actuelles
          
          // Si données insuffisantes (< 2 commentaires), chercher et récupérer des données historiques
          if (pv.nombre_commentaires < 2) {
            const historicalDate = await this.findMostRecentMeaningfulDate(pv.point_de_vente, requestedDate);
            if (historicalDate) {
              pvAnalysisDate = historicalDate;
              // Récupérer les données de sentiment pour cette date historique
              pvData = await this.getPointVenteSentimentData(pv.point_de_vente, historicalDate);
            }
          }

          const pvSentiment = this.calculateSentiment(pvData.note_moyenne);
          const pvDescription = await this.generatePointVenteDescription(pvData, pvAnalysisDate);

          return {
            point_de_vente: pv.point_de_vente,
            sentiment: pvSentiment,
            nombre_evaluations: parseInt(pvData.nombre_evaluations || 0),
            note_moyenne: parseFloat(pvData.note_moyenne || 0),
            sentimentAnalysis: {
              date_analyse: pvAnalysisDate,
              sentiment: pvSentiment,
              sentiment_score: Math.round(((pvData.note_moyenne || 0) / 10) * 100),
              sentiment_description: pvDescription,
              nombre_evaluations: parseInt(pvData.nombre_evaluations || 0),
              nombre_commentaires: parseInt(pvData.nombre_commentaires || 0),
              notes_detaillees: {
                service_livraison: pvData.service_rating || null,
                qualite_produits: pvData.quality_rating || null,
                niveau_prix: pvData.price_rating || null,
                service_commercial: pvData.commercial_service_rating || null,
                note_globale_moyenne: pvData.note_moyenne || null
              }
            }
          };
        })
      );

      // Étape 4: Analyser le sentiment global intelligemment via LLM basé sur les points de vente
      const globalSentimentAnalysis = await this.analyzeGlobalSentimentFromPointsVente(parPointVente, analysisDate);
      const sentimentGlobal = globalSentimentAnalysis.sentiment;
      const sentimentScore = globalSentimentAnalysis.score;

      // Étape 5: Générer la description IA pour le sentiment global
      const sentimentDescription = await this.generateSentimentDescription(
        globalData,
        pointsVenteData,
        analysisDate
      );

      // Étape 6: Construire la réponse finale
      // NOTE: par_point_vente n'est PAS inclus dans l'objet global pour éviter la duplication
      // Les données par point de vente seront intégrées directement dans par_point_vente[] par external.js
      const response = {
        date_analyse: analysisDate,
        sentiment_global: sentimentGlobal,
        sentiment_score: sentimentScore,
        sentiment_description: sentimentDescription,
        statistiques: {
          total_commandes: parseInt(globalData.total_commandes),
          total_commandes_evaluees: parseInt(globalData.total_evaluees),
          commandes_avec_commentaires: parseInt(globalData.total_commentaires),
          pourcentage_evaluation: globalData.total_commandes > 0 
            ? Math.round((globalData.total_evaluees / globalData.total_commandes) * 100) 
            : 0,
          pourcentage_commentaires: globalData.total_evaluees > 0
            ? Math.round((globalData.total_commentaires / globalData.total_evaluees) * 100)
            : 0
        },
        notes_detaillees: this.calculateGlobalNotesFromPointsVente(parPointVente),
        // Gardé séparément pour l'enrichissement dans external.js (ne sera pas dans sentimentAnalysis global)
        _parPointVenteData: parPointVente
      };

      console.log(`✅ Analyse de sentiment terminée pour ${analysisDate}`);
      return response;

    } catch (error) {
      console.error('❌ Erreur lors de l\'analyse de sentiment:', error);
      return null;
    }
  }

  /**
   * Trouve la date la plus récente où un point de vente avait des données significatives
   * @param {string} pointDeVente - Nom du point de vente
   * @param {string} beforeDate - Date limite (chercher avant cette date)
   * @returns {Promise<string|null>} Date au format YYYY-MM-DD ou null
   */
  static async findMostRecentMeaningfulDate(pointDeVente, beforeDate) {
    try {
      const query = `
        SELECT TO_CHAR(DATE(created_at), 'YYYY-MM-DD') as analysis_date,
               COUNT(*) FILTER (WHERE commentaire IS NOT NULL AND commentaire != '' AND LENGTH(commentaire) > 5) as nombre_commentaires,
               COUNT(*) FILTER (WHERE service_rating IS NOT NULL OR quality_rating IS NOT NULL OR price_rating IS NOT NULL) as nombre_evaluations
        FROM orders
        WHERE DATE(created_at) < $1
          AND order_type = 'MATA'
          AND (interne = false OR interne IS NULL)
          AND point_de_vente = $2
          AND (commentaire IS NOT NULL AND commentaire != '' AND LENGTH(commentaire) > 5)
        GROUP BY DATE(created_at)
        HAVING COUNT(*) FILTER (WHERE commentaire IS NOT NULL AND commentaire != '' AND LENGTH(commentaire) > 5) >= 2
        ORDER BY DATE(created_at) DESC
        LIMIT 1
      `;

      const result = await db.query(query, [beforeDate, pointDeVente]);

      if (result.rows.length > 0) {
        console.log(`📅 Date historique trouvée pour ${pointDeVente}: ${result.rows[0].analysis_date} (${result.rows[0].nombre_commentaires} commentaires)`);
        return result.rows[0].analysis_date;
      }

      console.log(`⚠️ Aucune date historique avec commentaires significatifs pour ${pointDeVente}`);
      return null;

    } catch (error) {
      console.error(`❌ Erreur recherche date historique pour ${pointDeVente}:`, error);
      return null;
    }
  }

  /**
   * Récupère les données de sentiment pour un point de vente spécifique à une date donnée
   * @param {string} pointDeVente - Nom du point de vente
   * @param {string} analysisDate - Date d'analyse au format YYYY-MM-DD
   * @returns {Promise<object>} Données de sentiment pour ce point de vente
   */
  static async getPointVenteSentimentData(pointDeVente, analysisDate) {
    try {
      const query = `
        SELECT 
          COUNT(*) FILTER (WHERE service_rating IS NOT NULL OR quality_rating IS NOT NULL OR price_rating IS NOT NULL) as nombre_evaluations,
          ROUND(AVG(
            COALESCE(average_rating, 
              (COALESCE(service_rating, 0) + COALESCE(quality_rating, 0) + COALESCE(price_rating, 0) + COALESCE(commercial_service_rating, 0)) / 
              NULLIF((CASE WHEN service_rating IS NOT NULL THEN 1 ELSE 0 END + 
                      CASE WHEN quality_rating IS NOT NULL THEN 1 ELSE 0 END + 
                      CASE WHEN price_rating IS NOT NULL THEN 1 ELSE 0 END + 
                      CASE WHEN commercial_service_rating IS NOT NULL THEN 1 ELSE 0 END), 0)
            )
          ), 1) as note_moyenne,
          COUNT(*) FILTER (WHERE commentaire IS NOT NULL AND commentaire != '') as nombre_commentaires,
          STRING_AGG(
            CASE 
              WHEN commentaire IS NOT NULL AND commentaire != '' AND LENGTH(commentaire) > 5
              THEN commentaire
            END, 
            ' | '
          ) FILTER (WHERE commentaire IS NOT NULL AND commentaire != '') as commentaires_sample,
          ROUND(AVG(service_rating), 1) as service_rating_avg,
          ROUND(AVG(quality_rating), 1) as quality_rating_avg,
          ROUND(AVG(price_rating), 1) as price_rating_avg,
          ROUND(AVG(commercial_service_rating), 1) as commercial_service_rating_avg
        FROM orders
        WHERE DATE(created_at) = $1
          AND order_type = 'MATA'
          AND (interne = false OR interne IS NULL)
          AND point_de_vente = $2
      `;

      const result = await db.query(query, [analysisDate, pointDeVente]);

      if (result.rows.length > 0 && result.rows[0].nombre_commentaires > 0) {
        console.log(`📊 Données historiques récupérées pour ${pointDeVente} le ${analysisDate}: ${result.rows[0].nombre_commentaires} commentaires`);
        return {
          point_de_vente: pointDeVente,
          nombre_evaluations: parseInt(result.rows[0].nombre_evaluations) || 0,
          note_moyenne: parseFloat(result.rows[0].note_moyenne) || 0,
          nombre_commentaires: parseInt(result.rows[0].nombre_commentaires) || 0,
          commentaires: result.rows[0].commentaires_sample,
          service_rating: parseFloat(result.rows[0].service_rating_avg) || null,
          quality_rating: parseFloat(result.rows[0].quality_rating_avg) || null,
          price_rating: parseFloat(result.rows[0].price_rating_avg) || null,
          commercial_service_rating: parseFloat(result.rows[0].commercial_service_rating_avg) || null
        };
      }

      console.log(`⚠️ Aucune donnée de sentiment trouvée pour ${pointDeVente} le ${analysisDate}`);
      return {
        point_de_vente: pointDeVente,
        nombre_evaluations: 0,
        note_moyenne: 0,
        nombre_commentaires: 0,
        commentaires: null
      };

    } catch (error) {
      console.error(`❌ Erreur récupération données sentiment pour ${pointDeVente} le ${analysisDate}:`, error);
      return {
        point_de_vente: pointDeVente,
        nombre_evaluations: 0,
        note_moyenne: 0,
        nombre_commentaires: 0,
        commentaires: null
      };
    }
  }

  /**
   * Analyse le sentiment global via LLM en analysant intelligemment les sentiments des points de vente
   * Le LLM comprend les nuances et contexte métier pour déterminer le sentiment global approprié
   * @param {array} parPointVente - Données des points de vente avec leurs sentiments calculés
   * @param {string} analysisDate - Date d'analyse pour contexte
   * @returns {Promise<object>} {sentiment, score} analysés par le LLM
   */
  static async analyzeGlobalSentimentFromPointsVente(parPointVente, analysisDate) {
    try {
      // Préparer le résumé des sentiments par point de vente pour le LLM
      const sentimentSummary = parPointVente.map(pv => ({
        point_de_vente: pv.point_de_vente,
        sentiment: pv.sentimentAnalysis?.sentiment || 'N/A',
        score: pv.sentimentAnalysis?.sentiment_score || 0,
        note_moyenne: pv.sentimentAnalysis?.notes_detaillees?.note_globale_moyenne || null,
        nombre_evaluations: pv.sentimentAnalysis?.nombre_evaluations || 0,
        nombre_commentaires: pv.sentimentAnalysis?.nombre_commentaires || 0,
        date_analyse: pv.sentimentAnalysis?.date_analyse || analysisDate,
        description_courte: pv.sentimentAnalysis?.sentiment_description?.substring(0, 100) || 'Aucune description'
      }));

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const prompt = `Tu es un analyste de satisfaction client pour MATA (service de livraison de viande fraîche).

DONNÉES DES POINTS DE VENTE (date: ${analysisDate}):
${sentimentSummary.map(pv => `
• ${pv.point_de_vente}: 
  - Sentiment: ${pv.sentiment} (${pv.score}%)
  - Note moyenne: ${pv.note_moyenne || 'N/A'}/10
  - Évaluations: ${pv.nombre_evaluations}, Commentaires: ${pv.nombre_commentaires}
  - Date des données: ${pv.date_analyse}
  - Résumé: ${pv.description_courte}...
`).join('')}

MISSION: Analyser ces sentiments par point de vente pour déterminer un SENTIMENT GLOBAL cohérent.

CONSIDÉRATIONS MÉTIER:
- Certains points utilisent données historiques (dates < ${analysisDate}) car pas assez de données récentes
- Pondérer selon le volume d'activité (évaluations/commentaires) 
- Les points majeurs (O.Foire, Keur Massar) ont plus d'impact que les petits points
- Tenir compte des tendances: amélioration vs dégradation

RÈGLES D'ANALYSE:
1. Si majorité POSITIF avec bonne cohérence → POSITIF global
2. Si mix POSITIF/NEUTRE → Analyser les notes et volumes pour trancher
3. Si présence NÉGATIF → Évaluer l'impact selon le volume du point
4. Donner un score entre 0-100 cohérent avec le sentiment

RÉPONSE REQUISE (JSON strict):
{
  "sentiment": "POSITIF|NEUTRE|NEGATIF|N/A",
  "score": <0-100>,
  "justification": "<25 mots expliquant la logique d'agrégation>"
}

Analyse maintenant:`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Tu es un expert analyste de données de satisfaction client. Réponds UNIQUEMENT en JSON valide."
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      });

      const responseText = completion.choices[0].message.content.trim();
      
      // Parser la réponse JSON
      try {
        const analysis = JSON.parse(responseText);
        
        console.log(`🤖 LLM analyse sentiment global: ${analysis.sentiment} (${analysis.score}%) - ${analysis.justification}`);
        
        return {
          sentiment: analysis.sentiment || 'N/A',
          score: analysis.score || 0
        };
        
      } catch (parseError) {
        console.error('❌ Erreur parsing JSON LLM sentiment global:', parseError.message);
        console.error('Réponse reçue:', responseText);
        
        // Fallback avec calcul mathématique simple
        return this.calculateFallbackGlobalSentiment(parPointVente);
      }

    } catch (error) {
      console.error('❌ Erreur LLM sentiment global:', error.message);
      return this.calculateFallbackGlobalSentiment(parPointVente);
    }
  }

  /**
   * Calcul de fallback pour sentiment global si LLM échoue
   * @param {array} parPointVente - Données des points de vente
   * @returns {object} {sentiment, score} calculés mathématiquement
   */
  static calculateFallbackGlobalSentiment(parPointVente) {
    const validSentiments = parPointVente
      .filter(pv => pv.sentimentAnalysis?.sentiment !== 'N/A')
      .map(pv => ({
        sentiment: pv.sentimentAnalysis.sentiment,
        score: pv.sentimentAnalysis.sentiment_score || 0,
        evaluations: pv.sentimentAnalysis.nombre_evaluations || 0
      }));

    if (validSentiments.length === 0) {
      return { sentiment: 'N/A', score: 0 };
    }

    // Moyenne pondérée par le nombre d'évaluations
    const totalEvaluations = validSentiments.reduce((sum, s) => sum + s.evaluations, 0);
    
    if (totalEvaluations > 0) {
      const scoresPonderes = validSentiments.reduce((sum, s) => 
        sum + (s.score * s.evaluations), 0
      );
      const scoreMoyen = scoresPonderes / totalEvaluations;
      
      return {
        sentiment: this.calculateSentiment((scoreMoyen / 100) * 10),
        score: Math.round(scoreMoyen)
      };
    } else {
      // Moyenne simple si pas d'évaluations
      const scoreMoyen = validSentiments.reduce((sum, s) => sum + s.score, 0) / validSentiments.length;
      return {
        sentiment: this.calculateSentiment((scoreMoyen / 100) * 10),
        score: Math.round(scoreMoyen)
      };
    }
  }

  /**
   * Calcule les notes détaillées globales en agrégeant les données des points de vente
   * Ignore les valeurs null pour avoir des moyennes réalistes
   * @param {array} parPointVente - Données des points de vente avec leurs notes historiques
   * @returns {object} Notes détaillées globales
   */
  static calculateGlobalNotesFromPointsVente(parPointVente) {
    const notes = {
      service_livraison: [],
      qualite_produits: [],
      niveau_prix: [],
      service_commercial: [],
      note_globale_moyenne: []
    };

    // Collecter toutes les notes non-null des points de vente
    parPointVente.forEach(pv => {
      if (pv.sentimentAnalysis && pv.sentimentAnalysis.notes_detaillees) {
        const pvNotes = pv.sentimentAnalysis.notes_detaillees;
        
        if (pvNotes.service_livraison !== null) notes.service_livraison.push(pvNotes.service_livraison);
        if (pvNotes.qualite_produits !== null) notes.qualite_produits.push(pvNotes.qualite_produits);
        if (pvNotes.niveau_prix !== null) notes.niveau_prix.push(pvNotes.niveau_prix);
        if (pvNotes.service_commercial !== null) notes.service_commercial.push(pvNotes.service_commercial);
        if (pvNotes.note_globale_moyenne !== null) notes.note_globale_moyenne.push(pvNotes.note_globale_moyenne);
      }
    });

    // Calculer les moyennes (null si aucune donnée)
    const calculateAverage = (values) => {
      if (values.length === 0) return null;
      const sum = values.reduce((acc, val) => acc + val, 0);
      return Math.round((sum / values.length) * 10) / 10; // Arrondir à 1 décimale
    };

    return {
      service_livraison: calculateAverage(notes.service_livraison),
      qualite_produits: calculateAverage(notes.qualite_produits),
      niveau_prix: calculateAverage(notes.niveau_prix),
      service_commercial: calculateAverage(notes.service_commercial),
      note_globale_moyenne: calculateAverage(notes.note_globale_moyenne)
    };
  }

  /**
   * Calcule le sentiment basé sur la note moyenne
   * @param {number} noteMoyenne - Note moyenne sur 10
   * @returns {string} POSITIF, NEUTRE, NEGATIF ou N/A
   */
  static calculateSentiment(noteMoyenne) {
    if (!noteMoyenne || noteMoyenne === 0) {
      return 'N/A';
    }
    if (noteMoyenne >= 7.5) {
      return 'POSITIF';
    } else if (noteMoyenne >= 5.0) {
      return 'NEUTRE';
    } else {
      return 'NEGATIF';
    }
  }


  /**
   * Génère une description intelligente du sentiment global via OpenAI GPT-4o-mini
   * @param {object} globalData - Données globales
   * @param {array} pointsVenteData - Données par point de vente
   * @param {string} analysisDate - Date d'analyse
   * @returns {Promise<string>} Description générée par l'IA
   */
  static async generateSentimentDescription(globalData, pointsVenteData, analysisDate) {
    try {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      // Préparer les données pour le prompt
      const totalCommandes = globalData.total_commandes;
      const noteMoyenne = globalData.note_moyenne;
      const totalEvaluees = globalData.total_evaluees;
      const tauxEvaluation = totalCommandes > 0 
        ? Math.round((totalEvaluees / totalCommandes) * 100) 
        : 0;

      // Extraits de commentaires pertinents (SOURCE PRINCIPALE)
      // On prend TOUS les commentaires disponibles (max 20) pour ne rien manquer
      const commentaires = globalData.commentaires 
        ? globalData.commentaires.split(' | ').filter(c => c && c.length > 5).slice(0, 20).join(' | ') 
        : 'Aucun commentaire disponible';

      // Résumé des points de vente avec commentaires
      const pointsVenteResume = pointsVenteData
        .filter(pv => pv.nombre_evaluations >= 2)
        .map(pv => {
          const pvComments = pv.commentaires_sample ? ` - Commentaires: "${pv.commentaires_sample.split(' | ').slice(0, 2).join(', ')}"` : '';
          return `${pv.point_de_vente} (${pv.note_moyenne}/10, ${pv.nombre_evaluations} éval.)${pvComments}`;
        })
        .join('\n');

      const prompt = `Tu es un analyste de satisfaction client pour MATA (boucherie-livraison viande fraîche).

COMMENTAIRES CLIENTS du ${analysisDate} (SOURCE UNIQUE - LIS-LES ATTENTIVEMENT) :
"${commentaires}"

Contexte chiffré :
- Note moyenne : ${noteMoyenne}/10 (${totalEvaluees}/${totalCommandes} évaluations)
- Service : ${globalData.service_rating || 'N/A'}/10, Qualité : ${globalData.quality_rating || 'N/A'}/10, Prix : ${globalData.price_rating || 'N/A'}/10

RÈGLE ABSOLUE : Mentionne UNIQUEMENT les problèmes EXPLICITEMENT écrits dans les commentaires ci-dessus.
NE PAS inventer ou déduire des problèmes qui ne sont pas mentionnés.

PROBLÈMES RÉELS À SIGNALER (si présents dans les commentaires) :
- Retards, délais excessifs
- Viande abîmée, pas fraîche, mauvaise odeur, dure
- Service impoli, désagréable
- Problèmes de quantité, poids
- Problèmes de découpe ou préparation

TERMINOLOGIE MÉTIER (si mentionné) :
- "nrp" = client non joignable par téléphone
- "Saleté/pas nettoyé" → "viande non nettoyée" (processus normal)

FORMAT DE RÉPONSE :
1. Si majoritairement positif (satisfait/très satisfait) : commence par "Satisfaction globalement positive" puis mentionne les rares problèmes spécifiques
2. Si problèmes fréquents : liste les problèmes RÉELS trouvés dans les commentaires
3. 40 mots maximum, style direct, factuel`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Tu es analyste MATA. RÈGLE CRITIQUE: Mentionne SEULEMENT les problèmes EXPLICITEMENT écrits dans les commentaires. N'invente RIEN. Si majoritairement positif, commence par 'Satisfaction positive'. Si problèmes réels, liste-les. Style direct, factuel, 40 mots max."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      });

      const description = completion.choices[0].message.content.trim();
      console.log(`🤖 Description IA générée (global): ${description.substring(0, 60)}...`);
      return description;

    } catch (error) {
      console.error('❌ Erreur génération IA (global):', error.message);
      // En cas d'erreur, retourner une description basique mais informative
      const noteMoyenne = globalData.note_moyenne;
      const sentiment = this.calculateSentiment(noteMoyenne);
      return `Satisfaction ${sentiment.toLowerCase()} avec une note moyenne de ${noteMoyenne}/10 sur ${globalData.total_evaluees} évaluations.`;
    }
  }

  /**
   * Génère une description pour un point de vente spécifique via OpenAI GPT-4o-mini
   * @param {object} pointVenteData - Données du point de vente
   * @param {string} analysisDate - Date d'analyse
   * @returns {Promise<string>} Description générée par l'IA
   */
  static async generatePointVenteDescription(pointVenteData, analysisDate) {
    try {
      // Si moins de 2 commentaires, description simple
      if (pointVenteData.nombre_commentaires < 2) {
        return `Données insuffisantes (${pointVenteData.nombre_commentaires} commentaire${pointVenteData.nombre_commentaires > 1 ? 's' : ''}).`;
      }

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const noteMoyenne = pointVenteData.note_moyenne;
      const nbEval = pointVenteData.nombre_evaluations;
      // On prend TOUS les commentaires disponibles (max 10) pour détecter toutes les critiques
      const commentaires = (pointVenteData.commentaires || pointVenteData.commentaires_sample)
        ? (pointVenteData.commentaires || pointVenteData.commentaires_sample).split(' | ').filter(c => c && c.length > 5).slice(0, 10).join(' | ')
        : 'Aucun commentaire';

      const prompt = `Analyse la satisfaction du point de vente "${pointVenteData.point_de_vente}" (${analysisDate}).

COMMENTAIRES CLIENTS (SOURCE UNIQUE - LIS-LES ATTENTIVEMENT) :
"${commentaires}"

Contexte : Note ${noteMoyenne}/10 (${nbEval} éval.) | Service: ${pointVenteData.service_rating || 'N/A'}/10 | Qualité: ${pointVenteData.quality_rating || 'N/A'}/10

RÈGLE ABSOLUE : Mentionne UNIQUEMENT les problèmes EXPLICITEMENT écrits dans les commentaires.
NE PAS inventer des problèmes absents des commentaires.

PROBLÈMES À SIGNALER (si présents) :
- Retards, viande dure/pas fraîche, service impoli, poids incorrect, découpe problématique

TERMINOLOGIE :
- "nrp" = client non joignable
- Ignorer "ritakhitt" (sans importance)

FORMAT :
1. Si majoritairement positif : commence par "Satisfaction positive" puis mentionne les rares problèmes réels
2. Si problèmes fréquents : liste les problèmes RÉELS
3. 30 mots max, style direct`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Tu es analyste MATA. RÈGLE CRITIQUE: Mentionne SEULEMENT les problèmes EXPLICITEMENT dans les commentaires. N'invente RIEN. Si commentaires positifs, dis-le. Si problèmes réels, liste-les factuellement. Style direct, 30 mots max."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 120,
        temperature: 0.7
      });

      const description = completion.choices[0].message.content.trim();
      console.log(`🤖 Description IA générée (${pointVenteData.point_de_vente}): ${description.substring(0, 50)}...`);
      return description;

    } catch (error) {
      console.error(`❌ Erreur génération IA (${pointVenteData.point_de_vente}):`, error.message);
      // Fallback avec description basique
      const noteMoyenne = pointVenteData.note_moyenne;
      const sentiment = this.calculateSentiment(noteMoyenne);
      return `Performance ${sentiment.toLowerCase()} avec ${noteMoyenne}/10 (${pointVenteData.nombre_evaluations} évaluations).`;
    }
  }
}

module.exports = DailySentimentAnalyzer;

