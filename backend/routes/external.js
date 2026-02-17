const express = require('express');
const router = express.Router();
const db = require('../models/database');
const OpenAI = require('openai');
const DailySentimentAnalyzer = require('../utils/sentimentAnalyzer');
const ExternalMataAuditController = require('../controllers/externalMataAuditController');
const { validateApiKey } = require('../middleware/apiKeyAuth');

// GET /api/external/mlc/livreurStats/daily - Statistiques journalières des livreurs
router.get('/mlc/livreurStats/daily', async (req, res) => {
  try {
    let { date, seuilMata, seuilMlc, seuilMataPanier } = req.query;

    // Date par défaut: aujourd'hui si non fournie
    if (!date) {
      date = new Date().toISOString().split('T')[0];
    }

    // Validation du format de date
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        error: 'Format de date invalide. Utilisez YYYY-MM-DD'
      });
    }

    // Seuil MATA par défaut: 1000 si non fourni
    if (!seuilMata) {
      seuilMata = 1000;
    } else {
      seuilMata = parseFloat(seuilMata);
      if (isNaN(seuilMata) || seuilMata < 0) {
        return res.status(400).json({
          error: 'Le seuil MATA doit être un nombre positif'
        });
      }
    }

    // Seuil MLC par défaut: 1750 si non fourni
    if (!seuilMlc) {
      seuilMlc = 1750;
    } else {
      seuilMlc = parseFloat(seuilMlc);
      if (isNaN(seuilMlc) || seuilMlc < 0) {
        return res.status(400).json({
          error: 'Le seuil MLC doit être un nombre positif'
        });
      }
    }

    // Seuil MATA panier par défaut: 10000 si non fourni
    if (!seuilMataPanier) {
      seuilMataPanier = 10000;
    } else {
      seuilMataPanier = parseFloat(seuilMataPanier);
      if (isNaN(seuilMataPanier) || seuilMataPanier < 0) {
        return res.status(400).json({
          error: 'Le seuil MATA panier doit être un nombre positif'
        });
      }
    }

    // Requête pour récupérer les statistiques de summary (global)
    const summaryQuery = `
      WITH order_stats AS (
        SELECT 
          COUNT(*) as total_courses,
          COUNT(DISTINCT o.id) as total_commandes,
          SUM(CASE WHEN o.order_type = 'MATA' THEN 1 ELSE 0 END) as courses_mata,
          -- Calcul du montant total MATA en excluant les commandes internes pour panier_moyen et panier_total_jour
          SUM(CASE WHEN o.order_type = 'MATA' AND o.interne = false THEN COALESCE(o.amount, 0) ELSE 0 END) as total_amount_mata_clients,
          -- Nombre de commandes MATA clients (non internes)
          SUM(CASE WHEN o.order_type = 'MATA' AND o.interne = false THEN 1 ELSE 0 END) as courses_mata_clients,
          SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NOT NULL THEN 1 ELSE 0 END) as courses_mlc_avec_abonnement,
          SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL THEN 1 ELSE 0 END) as courses_mlc_sans_abonnement,
          SUM(CASE WHEN o.order_type = 'MATA' AND o.course_price > $2 THEN 1 ELSE 0 END) as courses_mata_sup,
          SUM(CASE WHEN o.order_type = 'MLC' AND o.course_price > $3 THEN 1 ELSE 0 END) as courses_mlc_sup,
          SUM(CASE WHEN o.order_type = 'MATA' AND o.interne = false AND COALESCE(o.amount, 0) < $4 THEN 1 ELSE 0 END) as courses_mata_panier_inf_seuil,
          -- Statistiques pour les commandes AUTRE
          SUM(CASE WHEN o.order_type = 'AUTRE' THEN 1 ELSE 0 END) as courses_autre_nombre,
          SUM(CASE WHEN o.order_type = 'AUTRE' THEN COALESCE(o.course_price, 0) ELSE 0 END) as courses_autre_prix,
          -- Zones pour MLC sans abonnement
          SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price = 1000 THEN 1 ELSE 0 END) as mlc_zone1,
          SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price = 1750 THEN 1 ELSE 0 END) as mlc_zone2,
          SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price = 2500 THEN 1 ELSE 0 END) as mlc_zone3,
          SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price NOT IN (1000, 1750, 2500) THEN 1 ELSE 0 END) as mlc_autre_zone
        FROM orders o
        JOIN users u ON o.created_by = u.id
        WHERE DATE(o.created_at) = $1 AND u.role = 'LIVREUR' AND u.is_active = true
      ),
      -- Statistiques des extras pour MLC avec abonnement
      mlc_extras_stats AS (
        SELECT 
          COUNT(*) as nombre_extras
        FROM orders o
        JOIN users u ON o.created_by = u.id
        JOIN subscriptions s ON o.subscription_id = s.id
        WHERE DATE(o.created_at) = $1 
          AND o.order_type = 'MLC' 
          AND o.subscription_id IS NOT NULL
          AND u.role = 'LIVREUR' AND u.is_active = true
          AND o.course_price > (s.price / s.total_deliveries)
      ),
      expense_stats AS (
        SELECT 
          COALESCE(SUM(e.carburant), 0) as total_carburant,
          COALESCE(SUM(e.reparations), 0) as total_reparations,
          COALESCE(SUM(e.police), 0) as total_police,
          COALESCE(SUM(e.autres), 0) as total_autres,
          COALESCE(SUM(e.km_parcourus), 0) as total_km
        FROM expenses e
        JOIN users u ON e.livreur_id = u.id
        WHERE e.expense_date = $1 AND u.role = 'LIVREUR' AND u.is_active = true
      ),
      mata_point_vente_stats AS (
        SELECT 
          o.point_de_vente,
          COUNT(*) as nombre_courses,
          COUNT(CASE WHEN o.interne = true THEN 1 END) as nombre_courses_internes
        FROM orders o
        JOIN users u ON o.created_by = u.id
        WHERE DATE(o.created_at) = $1 
          AND o.order_type = 'MATA' 
          AND u.role = 'LIVREUR' AND u.is_active = true
          AND o.point_de_vente IS NOT NULL
        GROUP BY o.point_de_vente
      )
      SELECT 
        os.*,
        COALESCE(mes.nombre_extras, 0) as mlc_extras,
        es.*,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'point_de_vente', mpvs.point_de_vente,
            'nombre_courses', mpvs.nombre_courses,
            'nombre_courses_internes', mpvs.nombre_courses_internes
          )
        ) FILTER (WHERE mpvs.point_de_vente IS NOT NULL) as mata_par_point_vente
      FROM order_stats os
      CROSS JOIN expense_stats es
      LEFT JOIN mlc_extras_stats mes ON true
      LEFT JOIN mata_point_vente_stats mpvs ON true
      GROUP BY os.total_courses, os.total_commandes, os.courses_mata, os.total_amount_mata_clients, os.courses_mata_clients,
               os.courses_mlc_avec_abonnement, os.courses_mlc_sans_abonnement,
               os.courses_mata_sup, os.courses_mlc_sup, os.courses_mata_panier_inf_seuil,
               os.courses_autre_nombre, os.courses_autre_prix,
               os.mlc_zone1, os.mlc_zone2, os.mlc_zone3, os.mlc_autre_zone, mes.nombre_extras,
               es.total_carburant, es.total_reparations, es.total_police, es.total_autres, es.total_km
    `;

    // Requête pour récupérer les détails par livreur
    const detailsQuery = `
      SELECT 
        u.id as livreur_id,
        u.username as livreur_nom,
        COUNT(o.id) as total_courses,
        COUNT(DISTINCT o.id) as total_commandes,
        SUM(CASE WHEN o.order_type = 'MATA' THEN 1 ELSE 0 END) as courses_mata,
        -- Calcul du montant total MATA en excluant les commandes internes pour panier_moyen et panier_total_jour
        SUM(CASE WHEN o.order_type = 'MATA' AND o.interne = false THEN COALESCE(o.amount, 0) ELSE 0 END) as total_amount_mata_clients,
        -- Nombre de commandes MATA clients (non internes)
        SUM(CASE WHEN o.order_type = 'MATA' AND o.interne = false THEN 1 ELSE 0 END) as courses_mata_clients,
        SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NOT NULL THEN 1 ELSE 0 END) as courses_mlc_avec_abonnement,
        SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL THEN 1 ELSE 0 END) as courses_mlc_sans_abonnement,
        SUM(CASE WHEN o.order_type = 'MATA' AND o.course_price > $2 THEN 1 ELSE 0 END) as courses_mata_sup,
        SUM(CASE WHEN o.order_type = 'MLC' AND o.course_price > $3 THEN 1 ELSE 0 END) as courses_mlc_sup,
        SUM(CASE WHEN o.order_type = 'MATA' AND o.interne = false AND COALESCE(o.amount, 0) < $4 THEN 1 ELSE 0 END) as courses_mata_panier_inf_seuil,
        -- Statistiques pour les commandes AUTRE par livreur
        SUM(CASE WHEN o.order_type = 'AUTRE' THEN 1 ELSE 0 END) as courses_autre_nombre,
        SUM(CASE WHEN o.order_type = 'AUTRE' THEN COALESCE(o.course_price, 0) ELSE 0 END) as courses_autre_prix,
        -- Zones pour MLC sans abonnement par livreur
        SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price = 1000 THEN 1 ELSE 0 END) as mlc_zone1,
        SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price = 1750 THEN 1 ELSE 0 END) as mlc_zone2,
        SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price = 2500 THEN 1 ELSE 0 END) as mlc_zone3,
        SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price NOT IN (1000, 1750, 2500) THEN 1 ELSE 0 END) as mlc_autre_zone,
        -- Calcul des revenus et bénéfices
        COALESCE(SUM(o.course_price), 0) as total_revenus,
        COALESCE(e.carburant, 0) + COALESCE(e.reparations, 0) + COALESCE(e.police, 0) + COALESCE(e.autres, 0) as total_depenses,
        COALESCE(SUM(o.course_price), 0) - (COALESCE(e.carburant, 0) + COALESCE(e.reparations, 0) + COALESCE(e.police, 0) + COALESCE(e.autres, 0)) as benefice,
        COALESCE(e.carburant, 0) as depenses_carburant,
        COALESCE(e.reparations, 0) as depenses_reparations,
        COALESCE(e.police, 0) as depenses_police,
        COALESCE(e.autres, 0) as depenses_autres,
        COALESCE(e.km_parcourus, 0) as km_parcourus,
        JSON_AGG(
          CASE WHEN o.order_type = 'MATA' AND o.point_de_vente IS NOT NULL THEN
            JSON_BUILD_OBJECT(
              'point_de_vente', o.point_de_vente,
              'nombre_courses', 1,
              'interne', o.interne
            )
          END
        ) FILTER (WHERE o.order_type = 'MATA' AND o.point_de_vente IS NOT NULL) as mata_details_points_vente
      FROM users u
      LEFT JOIN orders o ON u.id = o.created_by AND DATE(o.created_at) = $1
      LEFT JOIN expenses e ON u.id = e.livreur_id AND e.expense_date = $1
      WHERE u.role = 'LIVREUR' AND u.is_active = true
      GROUP BY u.id, u.username, e.carburant, e.reparations, e.police, e.autres, e.km_parcourus
      ORDER BY u.username
    `;

    // Requête séparée pour les extras par livreur (plus complexe à cause de la jointure avec subscriptions)
    const extrasQuery = `
      SELECT 
        u.id as livreur_id,
        COUNT(*) as nombre_extras
      FROM orders o
      JOIN users u ON o.created_by = u.id
      JOIN subscriptions s ON o.subscription_id = s.id
      WHERE DATE(o.created_at) = $1 
        AND o.order_type = 'MLC' 
        AND o.subscription_id IS NOT NULL
        AND u.role = 'LIVREUR' AND u.is_active = true
        AND o.course_price > (s.price / s.total_deliveries)
      GROUP BY u.id
    `;

    // Requête pour récupérer les statistiques par type par livreur
    const typeStatsQuery = `
      SELECT 
        u.username as livreur_nom,
        CASE 
          WHEN o.order_type = 'MLC' AND o.subscription_id IS NOT NULL THEN 'MLC avec abonnement'
          WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL THEN 'MLC simple'
          WHEN o.order_type = 'MATA' AND o.interne = true THEN 'MATA interne'
          WHEN o.order_type = 'MATA' AND (o.interne = false OR o.interne IS NULL) THEN 'MATA client'
          ELSE o.order_type
        END as order_type,
        COUNT(*) as count,
        SUM(o.course_price) as total_amount
      FROM orders o
      JOIN users u ON o.created_by = u.id
      WHERE DATE(o.created_at) = $1
        AND u.role = 'LIVREUR' AND u.is_active = true
      GROUP BY u.username,
        CASE 
          WHEN o.order_type = 'MLC' AND o.subscription_id IS NOT NULL THEN 'MLC avec abonnement'
          WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL THEN 'MLC simple'
          WHEN o.order_type = 'MATA' AND o.interne = true THEN 'MATA interne'
          WHEN o.order_type = 'MATA' AND (o.interne = false OR o.interne IS NULL) THEN 'MATA client'
          ELSE o.order_type
        END
      ORDER BY u.username
    `;

    const [summaryResult, detailsResult, extrasResult, typeStatsResult] = await Promise.all([
      db.query(summaryQuery, [date, seuilMata, seuilMlc, seuilMataPanier]),
      db.query(detailsQuery, [date, seuilMata, seuilMlc, seuilMataPanier]),
      db.query(extrasQuery, [date]),
      db.query(typeStatsQuery, [date])
    ]);

    const summary = summaryResult.rows[0] || {};
    const details = detailsResult.rows || [];
    const extrasData = extrasResult.rows || [];
    const typeStatsData = typeStatsResult.rows || [];

    // Créer un map des extras par livreur
    const extrasMap = new Map();
    extrasData.forEach(item => {
      extrasMap.set(item.livreur_id, parseInt(item.nombre_extras));
    });

    // Créer un map des statistiques par type par livreur
    const typeStatsMap = new Map();
    typeStatsData.forEach(item => {
      if (!typeStatsMap.has(item.livreur_nom)) {
        typeStatsMap.set(item.livreur_nom, {});
      }
      const typeLabel = item.order_type === 'AUTRE' ? 'Autres' : item.order_type;
      typeStatsMap.get(item.livreur_nom)[typeLabel] = {
        count: parseInt(item.count) || 0,
        total_amount: parseFloat(item.total_amount) || 0
      };
    });

    // Traitement des détails par livreur
    const processedDetails = details.map(livreur => {
      // Traitement des points de vente MATA
      let mataParPointVente = [];
      if (livreur.mata_details_points_vente) {
        const pointsVenteMap = new Map();
        const pointsVenteInternesMap = new Map();
        
        livreur.mata_details_points_vente.forEach(item => {
          if (item && item.point_de_vente) {
            const existingCount = pointsVenteMap.get(item.point_de_vente) || 0;
            pointsVenteMap.set(item.point_de_vente, existingCount + 1);
            
            // Compter les commandes internes par point de vente
            if (item.interne === true) {
              const existingInternesCount = pointsVenteInternesMap.get(item.point_de_vente) || 0;
              pointsVenteInternesMap.set(item.point_de_vente, existingInternesCount + 1);
            }
          }
        });
        
        mataParPointVente = Array.from(pointsVenteMap.entries()).map(([point_de_vente, nombre_courses]) => ({
          point_de_vente,
          nombre_courses,
          nombre_courses_internes: pointsVenteInternesMap.get(point_de_vente) || 0
        }));
      }

      return {
        livreur_id: livreur.livreur_id,
        livreur_nom: livreur.livreur_nom,
        total_courses: parseInt(livreur.total_courses) || 0,
        total_commandes: parseInt(livreur.total_commandes) || 0,
        courses_mata: {
          total: parseInt(livreur.courses_mata) || 0,
          panier_moyen: (parseInt(livreur.courses_mata_clients) > 0) ? (parseFloat(livreur.total_amount_mata_clients) / parseInt(livreur.courses_mata_clients)) : 0,
          panier_total_jour: parseFloat(livreur.total_amount_mata_clients) || 0,
          par_point_vente: mataParPointVente,
          courses_sup: parseInt(livreur.courses_mata_sup) || 0,
          panier_inf_seuil: parseInt(livreur.courses_mata_panier_inf_seuil) || 0
        },
        courses_mlc: {
          total: (parseInt(livreur.courses_mlc_avec_abonnement) || 0) + (parseInt(livreur.courses_mlc_sans_abonnement) || 0),
          avec_abonnement: {
            total: parseInt(livreur.courses_mlc_avec_abonnement) || 0,
            nombre_extras: extrasMap.get(livreur.livreur_id) || 0
          },
          sans_abonnement: {
            total: parseInt(livreur.courses_mlc_sans_abonnement) || 0,
            par_zone: {
              zone1_1750: parseInt(livreur.mlc_zone1) || 0,
              zone2_2000: parseInt(livreur.mlc_zone2) || 0,
              zone3_3000: parseInt(livreur.mlc_zone3) || 0,
              autre: parseInt(livreur.mlc_autre_zone) || 0
            }
          },
          courses_sup: parseInt(livreur.courses_mlc_sup) || 0
        },
        courses_autre: {
          nombre: parseInt(livreur.courses_autre_nombre) || 0,
          prix_total: parseFloat(livreur.courses_autre_prix) || 0
        },
        depenses: {
          total: parseFloat(livreur.total_depenses) || 0,
          carburant: parseFloat(livreur.depenses_carburant) || 0,
          reparations: parseFloat(livreur.depenses_reparations) || 0,
          police: parseFloat(livreur.depenses_police) || 0,
          autres: parseFloat(livreur.depenses_autres) || 0
        },
        km_parcourus: parseFloat(livreur.km_parcourus) || 0,
        revenus: parseFloat(livreur.total_revenus) || 0,
        benefice: parseFloat(livreur.benefice) || 0,
        statsByType: typeStatsMap.get(livreur.livreur_nom) || {}
      };
    });

    // Créer le classement par bénéfice (trié par bénéfice décroissant)
    const classement = processedDetails
      .filter(livreur => livreur.total_courses > 0 || livreur.benefice !== 0) // Exclure les livreurs sans activité
      .sort((a, b) => b.benefice - a.benefice) // Tri par bénéfice décroissant
      .map((livreur, index) => ({
        rang: index + 1,
        livreur_id: livreur.livreur_id,
        livreur_nom: livreur.livreur_nom,
        total_courses: livreur.total_courses,
        revenus: livreur.revenus,
        depenses_totales: livreur.depenses.total,
        benefice: livreur.benefice
      }));

    // Correction des totaux du summary basés sur les détails individuels pour assurer la cohérence
    const correctedSummaryDepenses = {
      total: processedDetails.reduce((sum, d) => sum + d.depenses.total, 0),
      carburant: processedDetails.reduce((sum, d) => sum + d.depenses.carburant, 0),
      reparations: processedDetails.reduce((sum, d) => sum + d.depenses.reparations, 0),
      police: processedDetails.reduce((sum, d) => sum + d.depenses.police, 0),
      autres: processedDetails.reduce((sum, d) => sum + d.depenses.autres, 0)
    };

    const correctedSummaryKm = processedDetails.reduce((sum, d) => sum + d.km_parcourus, 0);

    // Analyse de sentiment MATA (date la plus récente)
    console.log('🤖 Démarrage de l\'analyse de sentiment...');
    const sentimentAnalysis = await DailySentimentAnalyzer.analyzeDailySentiment(date);
    console.log('✅ Analyse de sentiment terminée:', sentimentAnalysis ? 'Données disponibles' : 'Aucune donnée');

    // Enrichir les par_point_vente avec les données de sentiment
    let enrichedParPointVente = summary.mata_par_point_vente || [];
    if (sentimentAnalysis && sentimentAnalysis._parPointVenteData) {
      enrichedParPointVente = enrichedParPointVente.map(pv => {
        const sentimentData = sentimentAnalysis._parPointVenteData.find(
          s => s.point_de_vente === pv.point_de_vente
        );
        if (sentimentData && sentimentData.sentimentAnalysis) {
          return {
            ...pv,
            sentimentAnalysis: sentimentData.sentimentAnalysis
          };
        }
        return pv;
      });
    }

    // Préparer sentimentAnalysis global (SANS par_point_vente pour éviter duplication)
    let sentimentAnalysisGlobal = null;
    if (sentimentAnalysis) {
      sentimentAnalysisGlobal = {
        date_analyse: sentimentAnalysis.date_analyse,
        sentiment_global: sentimentAnalysis.sentiment_global,
        sentiment_score: sentimentAnalysis.sentiment_score,
        sentiment_description: sentimentAnalysis.sentiment_description,
        statistiques: sentimentAnalysis.statistiques,
        notes_detaillees: sentimentAnalysis.notes_detaillees
      };
    }

    // Construction de la réponse finale
    const response = {
      date: date,
      seuil_mata: seuilMata,
      seuil_mlc: seuilMlc,
      seuil_mata_panier: seuilMataPanier,
      summary: {
        total_courses: parseInt(summary.total_courses) || 0,
        total_commandes: parseInt(summary.total_commandes) || 0,
        courses_mata: {
          total: parseInt(summary.courses_mata) || 0,
          panier_moyen: (parseInt(summary.courses_mata_clients) > 0) ? (parseFloat(summary.total_amount_mata_clients) / parseInt(summary.courses_mata_clients)) : 0,
          panier_total_jour: parseFloat(summary.total_amount_mata_clients) || 0,
          ...(sentimentAnalysisGlobal && { sentimentAnalysis: sentimentAnalysisGlobal }),
          par_point_vente: enrichedParPointVente,
          courses_sup: parseInt(summary.courses_mata_sup) || 0,
          panier_inf_seuil: parseInt(summary.courses_mata_panier_inf_seuil) || 0
        },
        courses_mlc: {
          total: (parseInt(summary.courses_mlc_avec_abonnement) || 0) + (parseInt(summary.courses_mlc_sans_abonnement) || 0),
          avec_abonnement: {
            total: parseInt(summary.courses_mlc_avec_abonnement) || 0,
            nombre_extras: parseInt(summary.mlc_extras) || 0
          },
          sans_abonnement: {
            total: parseInt(summary.courses_mlc_sans_abonnement) || 0,
            par_zone: {
              zone1_1750: parseInt(summary.mlc_zone1) || 0,
              zone2_2000: parseInt(summary.mlc_zone2) || 0,
              zone3_3000: parseInt(summary.mlc_zone3) || 0,
              autre: parseInt(summary.mlc_autre_zone) || 0
            }
          },
          courses_sup: parseInt(summary.courses_mlc_sup) || 0
        },
        courses_autre: {
          nombre: parseInt(summary.courses_autre_nombre) || 0,
          prix_total: parseFloat(summary.courses_autre_prix) || 0
        },
        depenses: correctedSummaryDepenses,
        km_parcourus: correctedSummaryKm
      },
      classement: classement,
      details: processedDetails
    };

    res.json(response);

  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques journalières:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/external/mlc/livreurStats/monthtodate - Statistiques cumulées mensuelles des livreurs
router.get('/mlc/livreurStats/monthtodate', async (req, res) => {
  try {
    let { month, seuilMata, seuilMlc, seuilMataPanier } = req.query;

    // Gestion de la période du mois
    let startDate, endDate;
    
    if (!month) {
      // Mois courant par défaut : du 1er jour du mois jusqu'à aujourd'hui
      const today = new Date();
      startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      endDate = today.toISOString().split('T')[0];
      month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    } else {
      // Validation du format de mois (YYYY-MM)
      const monthRegex = /^\d{4}-\d{2}$/;
      if (!monthRegex.test(month)) {
        return res.status(400).json({
          error: 'Format de mois invalide. Utilisez YYYY-MM'
        });
      }
      
      const [year, monthNum] = month.split('-').map(Number);
      if (monthNum < 1 || monthNum > 12) {
        return res.status(400).json({
          error: 'Mois invalide. Utilisez un mois entre 01 et 12'
        });
      }
      
      // Calculer les dates de début et fin du mois spécifié
      startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
      const today = new Date();
      
      // Si le mois est le mois courant, prendre jusqu'à aujourd'hui, sinon jusqu'à la fin du mois
      if (year === today.getFullYear() && monthNum === today.getMonth() + 1) {
        endDate = today.toISOString().split('T')[0];
      } else {
        // Dernier jour du mois
        const lastDay = new Date(year, monthNum, 0).getDate();
        endDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      }
    }

    // Seuil MATA par défaut: 1000 si non fourni
    if (!seuilMata) {
      seuilMata = 1000;
    } else {
      seuilMata = parseFloat(seuilMata);
      if (isNaN(seuilMata) || seuilMata < 0) {
        return res.status(400).json({
          error: 'Le seuil MATA doit être un nombre positif'
        });
      }
    }

    // Seuil MLC par défaut: 1750 si non fourni
    if (!seuilMlc) {
      seuilMlc = 1750;
    } else {
      seuilMlc = parseFloat(seuilMlc);
      if (isNaN(seuilMlc) || seuilMlc < 0) {
        return res.status(400).json({
          error: 'Le seuil MLC doit être un nombre positif'
        });
      }
    }

    // Seuil MATA panier par défaut: 10000 si non fourni
    if (!seuilMataPanier) {
      seuilMataPanier = 10000;
    } else {
      seuilMataPanier = parseFloat(seuilMataPanier);
      if (isNaN(seuilMataPanier) || seuilMataPanier < 0) {
        return res.status(400).json({
          error: 'Le seuil MATA panier doit être un nombre positif'
        });
      }
    }

    // Requête pour récupérer les statistiques de summary (global) - VERSION MENSUELLE
    const summaryQuery = `
      WITH order_stats AS (
        SELECT 
          COUNT(*) as total_courses,
          COUNT(DISTINCT o.id) as total_commandes,
          SUM(CASE WHEN o.order_type = 'MATA' THEN 1 ELSE 0 END) as courses_mata,
          SUM(CASE WHEN o.order_type = 'MATA' THEN COALESCE(o.amount, 0) ELSE 0 END) as total_amount_mata, -- Ajout
          SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NOT NULL THEN 1 ELSE 0 END) as courses_mlc_avec_abonnement,
          SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL THEN 1 ELSE 0 END) as courses_mlc_sans_abonnement,
          SUM(CASE WHEN o.order_type = 'MATA' AND o.course_price > $3 THEN 1 ELSE 0 END) as courses_mata_sup,
          SUM(CASE WHEN o.order_type = 'MLC' AND o.course_price > $4 THEN 1 ELSE 0 END) as courses_mlc_sup,
          SUM(CASE WHEN o.order_type = 'MATA' AND COALESCE(o.amount, 0) < $5 THEN 1 ELSE 0 END) as courses_mata_panier_inf_seuil,
          -- Statistiques pour les commandes AUTRE
          SUM(CASE WHEN o.order_type = 'AUTRE' THEN 1 ELSE 0 END) as courses_autre_nombre,
          SUM(CASE WHEN o.order_type = 'AUTRE' THEN COALESCE(o.course_price, 0) ELSE 0 END) as courses_autre_prix,
          -- Zones pour MLC sans abonnement
          SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price = 1000 THEN 1 ELSE 0 END) as mlc_zone1,
          SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price = 1750 THEN 1 ELSE 0 END) as mlc_zone2,
          SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price = 2500 THEN 1 ELSE 0 END) as mlc_zone3,
          SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price NOT IN (1000,1750,2500) THEN 1 ELSE 0 END) as mlc_autre_zone
        FROM orders o
        JOIN users u ON o.created_by = u.id
        WHERE DATE(o.created_at) BETWEEN $1 AND $2 AND u.role = 'LIVREUR' AND u.is_active = true
      ),
      -- Statistiques des extras pour MLC avec abonnement
      mlc_extras_stats AS (
        SELECT 
          COUNT(*) as nombre_extras
        FROM orders o
        JOIN users u ON o.created_by = u.id
        JOIN subscriptions s ON o.subscription_id = s.id
        WHERE DATE(o.created_at) BETWEEN $1 AND $2
          AND o.order_type = 'MLC' 
          AND o.subscription_id IS NOT NULL
          AND u.role = 'LIVREUR' AND u.is_active = true
          AND o.course_price > (s.price / s.total_deliveries)
      ),
      expense_stats AS (
        SELECT 
          COALESCE(SUM(e.carburant), 0) as total_carburant,
          COALESCE(SUM(e.reparations), 0) as total_reparations,
          COALESCE(SUM(e.police), 0) as total_police,
          COALESCE(SUM(e.autres), 0) as total_autres,
          COALESCE(SUM(e.km_parcourus), 0) as total_km
        FROM expenses e
        JOIN users u ON e.livreur_id = u.id
        WHERE e.expense_date BETWEEN $1 AND $2 AND u.role = 'LIVREUR' AND u.is_active = true
      ),
      mata_point_vente_stats AS (
        SELECT 
          o.point_de_vente,
          COUNT(*) as nombre_courses
        FROM orders o
        JOIN users u ON o.created_by = u.id
        WHERE DATE(o.created_at) BETWEEN $1 AND $2
          AND o.order_type = 'MATA' 
          AND u.role = 'LIVREUR' AND u.is_active = true
          AND o.point_de_vente IS NOT NULL
        GROUP BY o.point_de_vente
      )
      SELECT 
        os.*,
        COALESCE(mes.nombre_extras, 0) as mlc_extras,
        es.*,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'point_de_vente', mpvs.point_de_vente,
            'nombre_courses', mpvs.nombre_courses
          )
        ) FILTER (WHERE mpvs.point_de_vente IS NOT NULL) as mata_par_point_vente
      FROM order_stats os
      CROSS JOIN expense_stats es
      LEFT JOIN mlc_extras_stats mes ON true
      LEFT JOIN mata_point_vente_stats mpvs ON true
      GROUP BY os.total_courses, os.total_commandes, os.courses_mata, os.total_amount_mata,
               os.courses_mlc_avec_abonnement, os.courses_mlc_sans_abonnement,
               os.courses_mata_sup, os.courses_mlc_sup, os.courses_mata_panier_inf_seuil,
               os.courses_autre_nombre, os.courses_autre_prix,
               os.mlc_zone1, os.mlc_zone2, os.mlc_zone3, os.mlc_autre_zone, mes.nombre_extras,
               es.total_carburant, es.total_reparations, es.total_police, es.total_autres, es.total_km
    `;

    // Requête pour récupérer les détails par livreur - VERSION MENSUELLE
    const detailsQuery = `
      SELECT 
        u.id as livreur_id,
        u.username as livreur_nom,
        COUNT(o.id) as total_courses,
        COUNT(DISTINCT o.id) as total_commandes,
        SUM(CASE WHEN o.order_type = 'MATA' THEN 1 ELSE 0 END) as courses_mata,
        SUM(CASE WHEN o.order_type = 'MATA' THEN COALESCE(o.amount, 0) ELSE 0 END) as total_amount_mata, -- Ajout
        SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NOT NULL THEN 1 ELSE 0 END) as courses_mlc_avec_abonnement,
        SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL THEN 1 ELSE 0 END) as courses_mlc_sans_abonnement,
        SUM(CASE WHEN o.order_type = 'MATA' AND o.course_price > $3 THEN 1 ELSE 0 END) as courses_mata_sup,
        SUM(CASE WHEN o.order_type = 'MLC' AND o.course_price > $4 THEN 1 ELSE 0 END) as courses_mlc_sup,
        SUM(CASE WHEN o.order_type = 'MATA' AND COALESCE(o.amount, 0) < $5 THEN 1 ELSE 0 END) as courses_mata_panier_inf_seuil,
        -- Statistiques pour les commandes AUTRE par livreur
        SUM(CASE WHEN o.order_type = 'AUTRE' THEN 1 ELSE 0 END) as courses_autre_nombre,
        SUM(CASE WHEN o.order_type = 'AUTRE' THEN COALESCE(o.course_price, 0) ELSE 0 END) as courses_autre_prix,
        -- Zones pour MLC sans abonnement par livreur
        SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price = 1000 THEN 1 ELSE 0 END) as mlc_zone1,
        SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price = 1750 THEN 1 ELSE 0 END) as mlc_zone2,
        SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price = 2500 THEN 1 ELSE 0 END) as mlc_zone3,
        SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price NOT IN (1000,1750,2500) THEN 1 ELSE 0 END) as mlc_autre_zone,
        -- Calcul des revenus et bénéfices
        COALESCE(SUM(o.course_price), 0) as total_revenus,
        COALESCE(SUM(e.carburant), 0) + COALESCE(SUM(e.reparations), 0) + COALESCE(SUM(e.police), 0) + COALESCE(SUM(e.autres), 0) as total_depenses,
        COALESCE(SUM(o.course_price), 0) - (COALESCE(SUM(e.carburant), 0) + COALESCE(SUM(e.reparations), 0) + COALESCE(SUM(e.police), 0) + COALESCE(SUM(e.autres), 0)) as benefice,
        COALESCE(SUM(e.carburant), 0) as depenses_carburant,
        COALESCE(SUM(e.reparations), 0) as depenses_reparations,
        COALESCE(SUM(e.police), 0) as depenses_police,
        COALESCE(SUM(e.autres), 0) as depenses_autres,
        COALESCE(SUM(e.km_parcourus), 0) as km_parcourus,
        JSON_AGG(
          CASE WHEN o.order_type = 'MATA' AND o.point_de_vente IS NOT NULL THEN
            JSON_BUILD_OBJECT(
              'point_de_vente', o.point_de_vente,
              'nombre_courses', 1
            )
          END
        ) FILTER (WHERE o.order_type = 'MATA' AND o.point_de_vente IS NOT NULL) as mata_details_points_vente
      FROM users u
      LEFT JOIN orders o ON u.id = o.created_by AND DATE(o.created_at) BETWEEN $1 AND $2
      LEFT JOIN expenses e ON u.id = e.livreur_id AND e.expense_date BETWEEN $1 AND $2
      WHERE u.role = 'LIVREUR' AND u.is_active = true
      GROUP BY u.id, u.username
      ORDER BY u.username
    `;

    // Requête séparée pour les extras par livreur (plus complexe à cause de la jointure avec subscriptions)
    const extrasQuery = `
      SELECT 
        u.id as livreur_id,
        COUNT(*) as nombre_extras
      FROM orders o
      JOIN users u ON o.created_by = u.id
      JOIN subscriptions s ON o.subscription_id = s.id
      WHERE DATE(o.created_at) BETWEEN $1 AND $2
        AND o.order_type = 'MLC' 
        AND o.subscription_id IS NOT NULL
        AND u.role = 'LIVREUR' AND u.is_active = true
        AND o.course_price > (s.price / s.total_deliveries)
      GROUP BY u.id
    `;

    // Requête pour récupérer les statistiques par type par livreur (mensuel)
    const typeStatsQuery = `
      SELECT 
        u.username as livreur_nom,
        CASE 
          WHEN o.order_type = 'MLC' AND o.subscription_id IS NOT NULL THEN 'MLC avec abonnement'
          WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL THEN 'MLC simple'
          WHEN o.order_type = 'MATA' AND o.interne = true THEN 'MATA interne'
          WHEN o.order_type = 'MATA' AND (o.interne = false OR o.interne IS NULL) THEN 'MATA client'
          ELSE o.order_type
        END as order_type,
        COUNT(*) as count,
        SUM(o.course_price) as total_amount
      FROM orders o
      JOIN users u ON o.created_by = u.id
      WHERE DATE(o.created_at) BETWEEN $1 AND $2
        AND u.role = 'LIVREUR' AND u.is_active = true
      GROUP BY u.username,
        CASE 
          WHEN o.order_type = 'MLC' AND o.subscription_id IS NOT NULL THEN 'MLC avec abonnement'
          WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL THEN 'MLC simple'
          WHEN o.order_type = 'MATA' AND o.interne = true THEN 'MATA interne'
          WHEN o.order_type = 'MATA' AND (o.interne = false OR o.interne IS NULL) THEN 'MATA client'
          ELSE o.order_type
        END
      ORDER BY u.username
    `;

    const [summaryResult, detailsResult, extrasResult, typeStatsResult] = await Promise.all([
      db.query(summaryQuery, [startDate, endDate, seuilMata, seuilMlc, seuilMataPanier]),
      db.query(detailsQuery, [startDate, endDate, seuilMata, seuilMlc, seuilMataPanier]),
      db.query(extrasQuery, [startDate, endDate]),
      db.query(typeStatsQuery, [startDate, endDate])
    ]);

    const summary = summaryResult.rows[0] || {};
    const details = detailsResult.rows || [];
    const extrasData = extrasResult.rows || [];
    const typeStatsData = typeStatsResult.rows || [];

    // Créer un map des extras par livreur
    const extrasMap = new Map();
    extrasData.forEach(item => {
      extrasMap.set(item.livreur_id, parseInt(item.nombre_extras));
    });

    // Créer un map des statistiques par type par livreur
    const typeStatsMap = new Map();
    typeStatsData.forEach(item => {
      if (!typeStatsMap.has(item.livreur_nom)) {
        typeStatsMap.set(item.livreur_nom, {});
      }
      const typeLabel = item.order_type === 'AUTRE' ? 'Autres' : item.order_type;
      typeStatsMap.get(item.livreur_nom)[typeLabel] = {
        count: parseInt(item.count) || 0,
        total_amount: parseFloat(item.total_amount) || 0
      };
    });

    // Traitement des détails par livreur (même logique que l'endpoint daily)
    const processedDetails = details.map(livreur => {
      // Traitement des points de vente MATA
      let mataParPointVente = [];
      if (livreur.mata_details_points_vente) {
        const pointsVenteMap = new Map();
        livreur.mata_details_points_vente.forEach(item => {
          if (item && item.point_de_vente) {
            const existingCount = pointsVenteMap.get(item.point_de_vente) || 0;
            pointsVenteMap.set(item.point_de_vente, existingCount + 1);
          }
        });
        
        mataParPointVente = Array.from(pointsVenteMap.entries()).map(([point_de_vente, nombre_courses]) => ({
          point_de_vente,
          nombre_courses
        }));
      }

      return {
        livreur_id: livreur.livreur_id,
        livreur_nom: livreur.livreur_nom,
        total_courses: parseInt(livreur.total_courses) || 0,
        total_commandes: parseInt(livreur.total_commandes) || 0,
        courses_mata: {
          total: parseInt(livreur.courses_mata) || 0,
          panier_moyen: (parseInt(livreur.courses_mata) > 0) ? (parseFloat(livreur.total_amount_mata) / parseInt(livreur.courses_mata)) : 0,
          panier_total_jour: parseFloat(livreur.total_amount_mata) || 0,
          par_point_vente: mataParPointVente,
          courses_sup: parseInt(livreur.courses_mata_sup) || 0,
          panier_inf_seuil: parseInt(livreur.courses_mata_panier_inf_seuil) || 0
        },
        courses_mlc: {
          total: (parseInt(livreur.courses_mlc_avec_abonnement) || 0) + (parseInt(livreur.courses_mlc_sans_abonnement) || 0),
          avec_abonnement: {
            total: parseInt(livreur.courses_mlc_avec_abonnement) || 0,
            nombre_extras: extrasMap.get(livreur.livreur_id) || 0
          },
          sans_abonnement: {
            total: parseInt(livreur.courses_mlc_sans_abonnement) || 0,
            par_zone: {
              zone1_1750: parseInt(livreur.mlc_zone1) || 0,
              zone2_2000: parseInt(livreur.mlc_zone2) || 0,
              zone3_3000: parseInt(livreur.mlc_zone3) || 0,
              autre: parseInt(livreur.mlc_autre_zone) || 0
            }
          },
          courses_sup: parseInt(livreur.courses_mlc_sup) || 0
        },
        courses_autre: {
          nombre: parseInt(livreur.courses_autre_nombre) || 0,
          prix_total: parseFloat(livreur.courses_autre_prix) || 0
        },
        depenses: {
          total: parseFloat(livreur.total_depenses) || 0,
          carburant: parseFloat(livreur.depenses_carburant) || 0,
          reparations: parseFloat(livreur.depenses_reparations) || 0,
          police: parseFloat(livreur.depenses_police) || 0,
          autres: parseFloat(livreur.depenses_autres) || 0
        },
        km_parcourus: parseFloat(livreur.km_parcourus) || 0,
        revenus: parseFloat(livreur.total_revenus) || 0,
        benefice: parseFloat(livreur.benefice) || 0,
        statsByType: typeStatsMap.get(livreur.livreur_nom) || {}
      };
    });

    // Créer le classement par bénéfice (trié par bénéfice décroissant)
    const classement = processedDetails
      .filter(livreur => livreur.total_courses > 0 || livreur.benefice !== 0) // Exclure les livreurs sans activité
      .sort((a, b) => b.benefice - a.benefice) // Tri par bénéfice décroissant
      .map((livreur, index) => ({
        rang: index + 1,
        livreur_id: livreur.livreur_id,
        livreur_nom: livreur.livreur_nom,
        total_courses: livreur.total_courses,
        revenus: livreur.revenus,
        depenses_totales: livreur.depenses.total,
        benefice: livreur.benefice
      }));

    // Correction des totaux du summary basés sur les détails individuels pour assurer la cohérence
    const correctedSummaryDepenses = {
      total: processedDetails.reduce((sum, d) => sum + d.depenses.total, 0),
      carburant: processedDetails.reduce((sum, d) => sum + d.depenses.carburant, 0),
      reparations: processedDetails.reduce((sum, d) => sum + d.depenses.reparations, 0),
      police: processedDetails.reduce((sum, d) => sum + d.depenses.police, 0),
      autres: processedDetails.reduce((sum, d) => sum + d.depenses.autres, 0)
    };

    const correctedSummaryKm = processedDetails.reduce((sum, d) => sum + d.km_parcourus, 0);

    // Construction de la réponse finale
    const response = {
      month: month,
      periode: {
        debut: startDate,
        fin: endDate
      },
      seuil_mata: seuilMata,
      seuil_mlc: seuilMlc,
      seuil_mata_panier: seuilMataPanier,
      summary: {
        total_courses: parseInt(summary.total_courses) || 0,
        total_commandes: parseInt(summary.total_commandes) || 0,
        courses_mata: {
          total: parseInt(summary.courses_mata) || 0,
          panier_moyen: (parseInt(summary.courses_mata) > 0) ? (parseFloat(summary.total_amount_mata) / parseInt(summary.courses_mata)) : 0,
          panier_total_jour: parseFloat(summary.total_amount_mata) || 0,
          par_point_vente: summary.mata_par_point_vente || [],
          courses_sup: parseInt(summary.courses_mata_sup) || 0,
          panier_inf_seuil: parseInt(summary.courses_mata_panier_inf_seuil) || 0
        },
        courses_mlc: {
          total: (parseInt(summary.courses_mlc_avec_abonnement) || 0) + (parseInt(summary.courses_mlc_sans_abonnement) || 0),
          avec_abonnement: {
            total: parseInt(summary.courses_mlc_avec_abonnement) || 0,
            nombre_extras: parseInt(summary.mlc_extras) || 0
          },
          sans_abonnement: {
            total: parseInt(summary.courses_mlc_sans_abonnement) || 0,
            par_zone: {
              zone1_1750: parseInt(summary.mlc_zone1) || 0,
              zone2_2000: parseInt(summary.mlc_zone2) || 0,
              zone3_3000: parseInt(summary.mlc_zone3) || 0,
              autre: parseInt(summary.mlc_autre_zone) || 0
            }
          },
          courses_sup: parseInt(summary.courses_mlc_sup) || 0
        },
        courses_autre: {
          nombre: parseInt(summary.courses_autre_nombre) || 0,
          prix_total: parseFloat(summary.courses_autre_prix) || 0
        },
        depenses: correctedSummaryDepenses,
        km_parcourus: correctedSummaryKm
      },
      classement: classement,
      details: processedDetails
    };

    res.json(response);

  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques mensuelles:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/external/v1/orders/mlc-table - Tableau MLC avec statistiques temporelles
router.get('/v1/orders/mlc-table', async (req, res) => {
  try {
    let { startDate, endDate, statDay, type } = req.query;

    // Validation du paramètre type
    if (type && !['statOnly', 'All'].includes(type)) {
      return res.status(400).json({
        error: 'Le paramètre type doit être "statOnly" ou "All"'
      });
    }

    // Si type n'est pas fourni, utiliser "All" par défaut
    if (!type) {
      type = 'All';
    }

    // Validation du format de date
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    // Gestion des dates par défaut
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.slice(0, 7); // YYYY-MM
    const firstDayOfMonth = `${currentMonth}-01`;

    // Si seulement statDay est fourni
    if (statDay && !startDate && !endDate) {
      if (!dateRegex.test(statDay)) {
        return res.status(400).json({
          error: 'Format de date invalide pour statDay. Utilisez YYYY-MM-DD'
        });
      }
      startDate = firstDayOfMonth;
      endDate = today;
    } else {
      // Si pas de dates fournies, utiliser les valeurs par défaut
      if (!startDate) startDate = firstDayOfMonth;
      if (!endDate) endDate = today;
      if (!statDay) statDay = today;
    }

    // Validation des formats de date
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate) || !dateRegex.test(statDay)) {
      return res.status(400).json({
        error: 'Format de date invalide. Utilisez YYYY-MM-DD'
      });
    }

    // Validation des dates
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
        error: 'La date de début ne peut pas être postérieure à la date de fin'
      });
    }

    console.log(`📊 External MLC Table API - startDate: ${startDate}, endDate: ${endDate}, statDay: ${statDay}, type: ${type}`);

    // Initialiser OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Fonction pour générer une interprétation IA des données
    const generateInterpretation = async (clients, periodType, dateRange, comparisonData = null) => {
      try {
        if (!clients || clients.length === 0) {
          return `Aucune donnée disponible pour la période ${periodType} (${dateRange}).`;
        }

        // Préparer un résumé des données pour l'IA
        const totalClients = clients.length;
        const totalCommandes = clients.reduce((sum, client) => sum + client.total_commandes, 0);
        const totalCourses = clients.reduce((sum, client) => sum + (client.total_courses || 0), 0);
        const totalSupplements = clients.reduce((sum, client) => sum + (client.somme_supplements || 0), 0);
        const mlcAbonnement = clients.reduce((sum, client) => sum + client.mlc_abonnement, 0);
        const mlcSimple = clients.reduce((sum, client) => sum + client.mlc_simple, 0);
        const clientsAvecPacks = clients.filter(client => client.pack_restant).length;

        let prompt = `Analyse les données suivantes de livraison MLC pour la période ${periodType} (${dateRange}) et fournis une interprétation concise en 3 lignes maximum :

- ${totalClients} clients actifs
- ${totalCommandes} commandes totales
- ${totalCourses.toLocaleString()} FCFA de chiffre d'affaires
- ${totalSupplements.toLocaleString()} FCFA de suppléments
- ${mlcAbonnement} commandes avec abonnement, ${mlcSimple} commandes simples
- ${clientsAvecPacks} clients avec des packs actifs`;

        // Ajouter la comparaison si c'est pour la semaine
        if (periodType === 'semaine' && comparisonData) {
          const monthCommandes = comparisonData.reduce((sum, client) => sum + client.total_commandes, 0);
          const monthCourses = comparisonData.reduce((sum, client) => sum + (client.total_courses || 0), 0);
          const monthClients = comparisonData.length;
          
          const commandesPercent = monthCommandes > 0 ? ((totalCommandes / monthCommandes) * 100).toFixed(1) : 0;
          const coursesPercent = monthCourses > 0 ? ((totalCourses / monthCourses) * 100).toFixed(1) : 0;
          const clientsPercent = monthClients > 0 ? ((totalClients / monthClients) * 100).toFixed(1) : 0;

          prompt += `

COMPARAISON AVEC LE MOIS :
- Cette semaine représente ${commandesPercent}% des commandes mensuelles (${totalCommandes}/${monthCommandes})
- Cette semaine représente ${coursesPercent}% du CA mensuel (${totalCourses.toLocaleString()}/${monthCourses.toLocaleString()} FCFA)
- Cette semaine représente ${clientsPercent}% des clients mensuels (${totalClients}/${monthClients})`;
        }

        prompt += `

Fournis une analyse concise des tendances et points clés, incluant la comparaison si disponible.`;

        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "Tu es un analyste de données spécialisé dans l'analyse de performance de livraison. Fournis des interprétations concises et pertinentes en français, en incluant des comparaisons quand disponibles."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          max_tokens: 200,
          temperature: 0.7
        });

        // Décoder les caractères Unicode (comme \u0027 pour l'apostrophe)
        const decodedContent = completion.choices[0].message.content.trim()
          .replace(/\\u([0-9a-fA-F]{4})/g, (match, code) => String.fromCharCode(parseInt(code, 16)))
          .replace(/\\'/g, "'")
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');
        
        return decodedContent;
      } catch (error) {
        console.error('❌ Erreur génération interprétation IA:', error);
        // Fallback avec analyse basique
        const totalClients = clients.length;
        const totalCommandes = clients.reduce((sum, client) => sum + client.total_commandes, 0);
        const totalCourses = clients.reduce((sum, client) => sum + (client.total_courses || 0), 0);
        const clientsAvecPacks = clients.filter(client => client.pack_restant).length;
        
        let fallback = `Période ${periodType}: ${totalClients} clients actifs, ${totalCommandes} commandes totales, ${totalCourses.toLocaleString()} FCFA de CA. ${clientsAvecPacks} clients avec packs actifs.`;
        
        // Ajouter comparaison pour la semaine
        if (periodType === 'semaine' && comparisonData) {
          const monthCommandes = comparisonData.reduce((sum, client) => sum + client.total_commandes, 0);
          const monthCourses = comparisonData.reduce((sum, client) => sum + (client.total_courses || 0), 0);
          const commandesPercent = monthCommandes > 0 ? ((totalCommandes / monthCommandes) * 100).toFixed(1) : 0;
          const coursesPercent = monthCourses > 0 ? ((totalCourses / monthCourses) * 100).toFixed(1) : 0;
          fallback += ` Cette semaine représente ${commandesPercent}% des commandes mensuelles et ${coursesPercent}% du CA mensuel.`;
        }
        
        return fallback;
      }
    };

    // Fonction pour calculer les données clients pour une période donnée
    const getClientData = async (start, end, isStatPeriod = false) => {
      const query = `
        WITH client_stats AS (
          SELECT 
            o.phone_number,
            MIN(o.client_name) as client_name,
            COUNT(*) as total_orders,
            MAX(o.created_at) as last_order_date,
            SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NOT NULL THEN 1 ELSE 0 END) as mlc_abonnement_count,
            SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL THEN 1 ELSE 0 END) as mlc_simple_count,
            SUM(CASE WHEN o.order_type = 'MLC' AND o.course_price > (
              CASE 
                WHEN o.subscription_id IS NOT NULL THEN 
                  (SELECT s.price / s.total_deliveries FROM subscriptions s WHERE s.id = o.subscription_id)
                ELSE 0
              END
            ) THEN 1 ELSE 0 END) as supplement_count,
            SUM(COALESCE(o.course_price, 0)) as total_courses,
            SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NOT NULL AND o.course_price > (
              SELECT s.price / s.total_deliveries FROM subscriptions s WHERE s.id = o.subscription_id
            ) THEN o.course_price - (SELECT s.price / s.total_deliveries FROM subscriptions s WHERE s.id = o.subscription_id) ELSE 0 END) as total_supplements
          FROM orders o
          WHERE DATE(o.created_at) BETWEEN $1 AND $2
            AND o.order_type = 'MLC'
            AND o.client_name != 'COMMANDE INTERNE'
            AND o.phone_number != '0000000000'
          GROUP BY o.phone_number
        ),
        active_packs AS (
          SELECT 
            s.phone_number,
            s.id as subscription_id,
            s.total_deliveries,
            s.used_deliveries,
            (s.total_deliveries - s.used_deliveries) as remaining_deliveries,
            s.is_active
          FROM subscriptions s
          WHERE s.is_active = true
            AND s.used_deliveries < s.total_deliveries
        ),
        livreur_stats AS (
          SELECT 
            o.phone_number,
            u.username as livreur_name,
            COUNT(*) as commandes_count
          FROM orders o
          JOIN users u ON o.created_by = u.id
          WHERE DATE(o.created_at) BETWEEN $1 AND $2
            AND o.order_type = 'MLC'
            AND o.client_name != 'COMMANDE INTERNE'
            AND o.phone_number != '0000000000'
          GROUP BY o.phone_number, u.username
        )
        SELECT 
          cs.phone_number,
          cs.client_name,
          cs.total_orders,
          cs.last_order_date,
          cs.mlc_abonnement_count,
          cs.mlc_simple_count,
          cs.supplement_count,
          cs.total_courses,
          cs.total_supplements,
          CASE 
            WHEN ap.subscription_id IS NOT NULL THEN 
              CONCAT(ap.remaining_deliveries, '/', ap.total_deliveries)
            ELSE NULL
          END as active_pack_info,
          JSON_OBJECT_AGG(ls.livreur_name, ls.commandes_count) FILTER (WHERE ls.livreur_name IS NOT NULL) as repartition_livreur
        FROM client_stats cs
        LEFT JOIN active_packs ap ON cs.phone_number = ap.phone_number
        LEFT JOIN livreur_stats ls ON cs.phone_number = ls.phone_number
        GROUP BY cs.phone_number, cs.client_name, cs.total_orders, cs.last_order_date, 
                 cs.mlc_abonnement_count, cs.mlc_simple_count, cs.supplement_count, 
                 cs.total_courses, cs.total_supplements, ap.subscription_id, ap.remaining_deliveries, ap.total_deliveries
        ORDER BY cs.client_name ASC
      `;

      const result = await db.query(query, [start, end]);
      return result.rows.map(row => ({
        nom: row.client_name,
        telephone: row.phone_number,
        total_commandes: parseInt(row.total_orders),
        date_derniere_commande: row.last_order_date ? row.last_order_date.toString().split('T')[0] : null,
        mlc_abonnement: parseInt(row.mlc_abonnement_count),
        mlc_simple: parseInt(row.mlc_simple_count),
        nombre_supplement: parseInt(row.supplement_count),
        pack_restant: row.active_pack_info,
        total_courses: row.total_courses ? parseFloat(row.total_courses) : null,
        somme_supplements: row.total_supplements ? parseFloat(row.total_supplements) : null,
        repartition_livreur: row.repartition_livreur || {}
      }));
    };

    // Fonction pour calculer le lundi précédent d'une date
    const getPreviousMonday = (date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajuster quand dimanche
      const monday = new Date(d.setDate(diff));
      return monday.toISOString().split('T')[0];
    };

    // Fonction pour calculer le premier jour du mois d'une date
    const getFirstDayOfMonth = (date) => {
      const d = new Date(date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    };

    // Calculer les différentes périodes pour les stats
    const statDayStart = statDay;
    const statDayEnd = statDay;
    const statWeekStart = getPreviousMonday(statDay);
    const statWeekEnd = statDay;
    const statMonthStart = getFirstDayOfMonth(statDay);
    const statMonthEnd = statDay;

    // Récupérer les données pour chaque période
    const [mainClients, statDayClients, statWeekClients, statMonthClients] = await Promise.all([
      type === 'All' ? getClientData(startDate, endDate) : Promise.resolve([]),
      getClientData(statDayStart, statDayEnd, false), // statDay : données du jour uniquement
      getClientData(statWeekStart, statWeekEnd, true), // statWeek : données de toute la semaine
      getClientData(statMonthStart, statMonthEnd, true) // statMonth : données de tout le mois
    ]);

    // Générer les interprétations IA pour statWeek et statMonth
    const [interpretationWeek, interpretationMonth] = await Promise.all([
      generateInterpretation(statWeekClients, 'semaine', `${statWeekStart} à ${statWeekEnd}`, statMonthClients), // Passer les données mensuelles pour comparaison
      generateInterpretation(statMonthClients, 'mois', `${statMonthStart} à ${statMonthEnd}`)
    ]);

    // Construire la réponse
    const response = {};

    if (type === 'All') {
      response.dateDebut = startDate;
      response.dateFin = endDate;
      response.clients = mainClients;
    }

    response.stats = {
      statDay: {
        dateDebut: statDayStart,
        dateFin: statDayEnd,
        clients: statDayClients
      },
      statWeek: {
        dateDebut: statWeekStart,
        dateFin: statWeekEnd,
        clients: statWeekClients,
        interpretationWeek: interpretationWeek
      },
      statMonth: {
        dateDebut: statMonthStart,
        dateFin: statMonthEnd,
        clients: statMonthClients,
        interpretationMonth: interpretationMonth
      }
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Erreur API externe MLC Table:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      details: error.message
    });
  }
});

// GET /api/external/livreurs/actifs - Liste des livreurs actifs (nécessite x-api-key)
router.get('/livreurs/actifs', validateApiKey, async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        username,
        full_name,
        role,
        is_active,
        created_at
      FROM users
      WHERE role = 'LIVREUR' AND is_active = true
      ORDER BY username
    `;
    
    const result = await db.query(query);
    
    res.json({
      success: true,
      count: result.rows.length,
      livreurs: result.rows
    });
  } catch (error) {
    console.error('❌ Erreur récupération livreurs actifs:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des livreurs actifs',
      details: error.message
    });
  }
});

// GET/POST /api/external/mata/audit/client - Audit client avec analyse de sentiment (nécessite x-api-key)
router.get('/mata/audit/client', validateApiKey, ExternalMataAuditController.getClientAudit);
router.post('/mata/audit/client', validateApiKey, ExternalMataAuditController.getClientAudit);

// POST /api/external/clients/credits/use - Utiliser/déduire un crédit client (nécessite x-api-key)
const ClientCreditsController = require('../controllers/clientCreditsController');
router.post('/clients/credits/use', validateApiKey, ClientCreditsController.useClientCredit);

// POST /api/external/clients/credits/refund - Rembourser un crédit (nécessite x-api-key)
router.post('/clients/credits/refund', validateApiKey, ClientCreditsController.refundClientCredit);

// GET /api/external/clients/credits/history/:phone_number - Historique des transactions (nécessite x-api-key)
router.get('/clients/credits/history/:phone_number', validateApiKey, ClientCreditsController.getClientCreditHistory);

// DELETE /api/external/clients/credits/:phone_number - Supprimer le crédit d'un client (nécessite x-api-key)
router.delete('/clients/credits/:phone_number', validateApiKey, ClientCreditsController.deleteClientCredit);

module.exports = router; 