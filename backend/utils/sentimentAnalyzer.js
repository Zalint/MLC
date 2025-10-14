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
            ROUND(AVG(price_rating), 1) as price_rating_avg
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
            ROUND(AVG(price_rating), 1) as price_rating_global
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
            'price_rating', price_rating_global
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
              'price_rating', price_rating_avg
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

      // Étape 3: Calculer le sentiment global
      const sentimentGlobal = this.calculateSentiment(globalData.note_moyenne);
      const sentimentScore = Math.round((globalData.note_moyenne / 10) * 100);

      // Étape 4: Générer la description IA pour le sentiment global
      const sentimentDescription = await this.generateSentimentDescription(
        globalData,
        pointsVenteData,
        analysisDate
      );

      // Étape 5: Calculer les sentiments par point de vente
      const parPointVente = await Promise.all(
        pointsVenteData.map(async (pv) => {
          const pvSentiment = this.calculateSentiment(pv.note_moyenne);
          const pvDescription = await this.generatePointVenteDescription(pv, analysisDate);

          // Déterminer la date d'analyse pour ce point de vente
          let pvAnalysisDate = analysisDate; // Par défaut, la date actuelle
          
          // Si données insuffisantes (< 2 commentaires), chercher la date la plus récente avec des commentaires significatifs
          if (pv.nombre_commentaires < 2) {
            const historicalDate = await this.findMostRecentMeaningfulDate(pv.point_de_vente, requestedDate);
            if (historicalDate) {
              pvAnalysisDate = historicalDate;
            }
          }

          return {
            point_de_vente: pv.point_de_vente,
            sentiment: pvSentiment,
            nombre_evaluations: parseInt(pv.nombre_evaluations),
            note_moyenne: parseFloat(pv.note_moyenne),
            sentimentAnalysis: {
              date_analyse: pvAnalysisDate,
              sentiment: pvSentiment,
              sentiment_score: Math.round((pv.note_moyenne / 10) * 100),
              sentiment_description: pvDescription,
              nombre_evaluations: parseInt(pv.nombre_evaluations),
              nombre_commentaires: parseInt(pv.nombre_commentaires)
            }
          };
        })
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

      const prompt = `Tu es un analyste de satisfaction client pour un service de livraison MATA.

ANALYSE BASÉE PRINCIPALEMENT SUR LES COMMENTAIRES CLIENTS du ${analysisDate} :

Commentaires clients (SOURCE PRINCIPALE) :
"${commentaires}"

Contexte chiffré :
- ${totalCommandes} commandes totales, ${totalEvaluees} évaluées (${tauxEvaluation}%)
- Note moyenne : ${noteMoyenne}/10
- Service : ${globalData.service_rating || 'N/A'}/10, Qualité : ${globalData.quality_rating || 'N/A'}/10, Prix : ${globalData.price_rating || 'N/A'}/10

Points de vente :
${pointsVenteResume || 'Données insuffisantes'}

CONSIGNE CRITIQUE : Analyse le CONTENU TEXTUEL des commentaires clients pour détecter les problèmes et critiques. IGNORE les notes numériques. PRIORISE ET METS EN AVANT toute mention de :
- Plaintes (retard, délai, lenteur, attente)
- Problèmes de qualité (froid, abîmé, manquant)
- Insatisfaction du service (impoli, désagréable, mal servi)
- Déceptions ou suggestions d'amélioration
MÊME si la note est bonne (7-8/10), si le commentaire mentionne un problème, METS-LE EN AVANT. C'est crucial pour progresser. Génère UNE phrase de 40 mots maximum qui PRIORISE les critiques identifiées dans les commentaires.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Tu es un analyste de données spécialisé en satisfaction client orienté AMÉLIORATION CONTINUE. Tu analyses UNIQUEMENT les commentaires textuels des clients pour identifier les problèmes et axes d'amélioration. Tu IGNORES les notes numériques. Tu PRIORISES les critiques, plaintes et insatisfactions car c'est ce qui permet de progresser. Si un client mentionne un problème même mineur, tu le mets en avant. Tu génères des résumés concis et directs en français."
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
      const commentaires = pointVenteData.commentaires 
        ? pointVenteData.commentaires.split(' | ').filter(c => c && c.length > 5).slice(0, 10).join(' | ')
        : 'Aucun commentaire';

      const prompt = `Analyse la satisfaction client du point de vente "${pointVenteData.point_de_vente}" le ${analysisDate}.

COMMENTAIRES CLIENTS (BASE TON ANALYSE SUR CECI) :
"${commentaires}"

Contexte chiffré (IGNORE-LE) :
- Note : ${noteMoyenne}/10 (${nbEval} évaluations)
- Service : ${pointVenteData.service_rating || 'N/A'}/10, Qualité : ${pointVenteData.quality_rating || 'N/A'}/10, Prix : ${pointVenteData.price_rating || 'N/A'}/10

CONSIGNE CRITIQUE : Analyse uniquement le CONTENU TEXTUEL des commentaires. IGNORE les notes numériques. PRIORISE les problèmes mentionnés :
- Retards, délais, attente
- Qualité (froid, abîmé, manquant)
- Service (impoli, désagréable)
- Toute insatisfaction ou critique
MÊME avec une bonne note, si un problème est mentionné, METS-LE EN AVANT. Génère UNE phrase de 30 mots maximum qui PRIORISE les critiques identifiées.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Tu es un analyste orienté AMÉLIORATION CONTINUE. Tu analyses UNIQUEMENT les commentaires textuels pour identifier les problèmes et axes d'amélioration. Tu IGNORES les notes. Tu PRIORISES les critiques et plaintes car c'est ce qui permet de progresser. Tu génères des résumés concis et directs en français."
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

