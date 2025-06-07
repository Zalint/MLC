const express = require('express');
const router = express.Router();
const db = require('../models/database');

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

    // Seuil MATA par défaut: 1500 si non fourni
    if (!seuilMata) {
      seuilMata = 1500;
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
          SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NOT NULL THEN 1 ELSE 0 END) as courses_mlc_avec_abonnement,
          SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL THEN 1 ELSE 0 END) as courses_mlc_sans_abonnement,
          SUM(CASE WHEN o.order_type = 'MATA' AND o.course_price > $2 THEN 1 ELSE 0 END) as courses_mata_sup,
          SUM(CASE WHEN o.order_type = 'MLC' AND o.course_price > $3 THEN 1 ELSE 0 END) as courses_mlc_sup,
          SUM(CASE WHEN o.order_type = 'MATA' AND COALESCE(o.amount, 0) < $4 THEN 1 ELSE 0 END) as courses_mata_panier_inf_seuil,
          -- Statistiques pour les commandes AUTRE
          SUM(CASE WHEN o.order_type = 'AUTRE' THEN 1 ELSE 0 END) as courses_autre_nombre,
          SUM(CASE WHEN o.order_type = 'AUTRE' THEN COALESCE(o.course_price, 0) ELSE 0 END) as courses_autre_prix,
          -- Zones pour MLC sans abonnement
          SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price = 1750 THEN 1 ELSE 0 END) as mlc_zone1,
          SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price = 2000 THEN 1 ELSE 0 END) as mlc_zone2,
          SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price = 3000 THEN 1 ELSE 0 END) as mlc_zone3,
          SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price NOT IN (1750, 2000, 3000) THEN 1 ELSE 0 END) as mlc_autre_zone
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
          COUNT(*) as nombre_courses
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
            'nombre_courses', mpvs.nombre_courses
          )
        ) FILTER (WHERE mpvs.point_de_vente IS NOT NULL) as mata_par_point_vente
      FROM order_stats os
      CROSS JOIN expense_stats es
      LEFT JOIN mlc_extras_stats mes ON true
      LEFT JOIN mata_point_vente_stats mpvs ON true
      GROUP BY os.total_courses, os.total_commandes, os.courses_mata, 
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
        SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NOT NULL THEN 1 ELSE 0 END) as courses_mlc_avec_abonnement,
        SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL THEN 1 ELSE 0 END) as courses_mlc_sans_abonnement,
        SUM(CASE WHEN o.order_type = 'MATA' AND o.course_price > $2 THEN 1 ELSE 0 END) as courses_mata_sup,
        SUM(CASE WHEN o.order_type = 'MLC' AND o.course_price > $3 THEN 1 ELSE 0 END) as courses_mlc_sup,
        SUM(CASE WHEN o.order_type = 'MATA' AND COALESCE(o.amount, 0) < $4 THEN 1 ELSE 0 END) as courses_mata_panier_inf_seuil,
        -- Statistiques pour les commandes AUTRE par livreur
        SUM(CASE WHEN o.order_type = 'AUTRE' THEN 1 ELSE 0 END) as courses_autre_nombre,
        SUM(CASE WHEN o.order_type = 'AUTRE' THEN COALESCE(o.course_price, 0) ELSE 0 END) as courses_autre_prix,
        -- Zones pour MLC sans abonnement par livreur
        SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price = 1750 THEN 1 ELSE 0 END) as mlc_zone1,
        SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price = 2000 THEN 1 ELSE 0 END) as mlc_zone2,
        SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price = 3000 THEN 1 ELSE 0 END) as mlc_zone3,
        SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price NOT IN (1750, 2000, 3000) THEN 1 ELSE 0 END) as mlc_autre_zone,
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
              'nombre_courses', 1
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

    const [summaryResult, detailsResult, extrasResult] = await Promise.all([
      db.query(summaryQuery, [date, seuilMata, seuilMlc, seuilMataPanier]),
      db.query(detailsQuery, [date, seuilMata, seuilMlc, seuilMataPanier]),
      db.query(extrasQuery, [date])
    ]);

    const summary = summaryResult.rows[0] || {};
    const details = detailsResult.rows || [];
    const extrasData = extrasResult.rows || [];

    // Créer un map des extras par livreur
    const extrasMap = new Map();
    extrasData.forEach(item => {
      extrasMap.set(item.livreur_id, parseInt(item.nombre_extras));
    });

    // Traitement des détails par livreur
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
        benefice: parseFloat(livreur.benefice) || 0
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
        depenses: {
          total: (parseFloat(summary.total_carburant) || 0) + 
                 (parseFloat(summary.total_reparations) || 0) + 
                 (parseFloat(summary.total_police) || 0) + 
                 (parseFloat(summary.total_autres) || 0),
          carburant: parseFloat(summary.total_carburant) || 0,
          reparations: parseFloat(summary.total_reparations) || 0,
          police: parseFloat(summary.total_police) || 0,
          autres: parseFloat(summary.total_autres) || 0
        },
        km_parcourus: parseFloat(summary.total_km) || 0
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

    // Seuil MATA par défaut: 1500 si non fourni
    if (!seuilMata) {
      seuilMata = 1500;
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
          SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NOT NULL THEN 1 ELSE 0 END) as courses_mlc_avec_abonnement,
          SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL THEN 1 ELSE 0 END) as courses_mlc_sans_abonnement,
          SUM(CASE WHEN o.order_type = 'MATA' AND o.course_price > $3 THEN 1 ELSE 0 END) as courses_mata_sup,
          SUM(CASE WHEN o.order_type = 'MLC' AND o.course_price > $4 THEN 1 ELSE 0 END) as courses_mlc_sup,
          SUM(CASE WHEN o.order_type = 'MATA' AND COALESCE(o.amount, 0) < $5 THEN 1 ELSE 0 END) as courses_mata_panier_inf_seuil,
          -- Statistiques pour les commandes AUTRE
          SUM(CASE WHEN o.order_type = 'AUTRE' THEN 1 ELSE 0 END) as courses_autre_nombre,
          SUM(CASE WHEN o.order_type = 'AUTRE' THEN COALESCE(o.course_price, 0) ELSE 0 END) as courses_autre_prix,
          -- Zones pour MLC sans abonnement
          SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price = 1750 THEN 1 ELSE 0 END) as mlc_zone1,
          SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price = 2000 THEN 1 ELSE 0 END) as mlc_zone2,
          SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price = 3000 THEN 1 ELSE 0 END) as mlc_zone3,
          SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price NOT IN (1750, 2000, 3000) THEN 1 ELSE 0 END) as mlc_autre_zone
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
      GROUP BY os.total_courses, os.total_commandes, os.courses_mata, 
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
        SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NOT NULL THEN 1 ELSE 0 END) as courses_mlc_avec_abonnement,
        SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL THEN 1 ELSE 0 END) as courses_mlc_sans_abonnement,
        SUM(CASE WHEN o.order_type = 'MATA' AND o.course_price > $3 THEN 1 ELSE 0 END) as courses_mata_sup,
        SUM(CASE WHEN o.order_type = 'MLC' AND o.course_price > $4 THEN 1 ELSE 0 END) as courses_mlc_sup,
        SUM(CASE WHEN o.order_type = 'MATA' AND COALESCE(o.amount, 0) < $5 THEN 1 ELSE 0 END) as courses_mata_panier_inf_seuil,
        -- Statistiques pour les commandes AUTRE par livreur
        SUM(CASE WHEN o.order_type = 'AUTRE' THEN 1 ELSE 0 END) as courses_autre_nombre,
        SUM(CASE WHEN o.order_type = 'AUTRE' THEN COALESCE(o.course_price, 0) ELSE 0 END) as courses_autre_prix,
        -- Zones pour MLC sans abonnement par livreur
        SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price = 1750 THEN 1 ELSE 0 END) as mlc_zone1,
        SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price = 2000 THEN 1 ELSE 0 END) as mlc_zone2,
        SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price = 3000 THEN 1 ELSE 0 END) as mlc_zone3,
        SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL AND o.course_price NOT IN (1750, 2000, 3000) THEN 1 ELSE 0 END) as mlc_autre_zone,
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

    const [summaryResult, detailsResult, extrasResult] = await Promise.all([
      db.query(summaryQuery, [startDate, endDate, seuilMata, seuilMlc, seuilMataPanier]),
      db.query(detailsQuery, [startDate, endDate, seuilMata, seuilMlc, seuilMataPanier]),
      db.query(extrasQuery, [startDate, endDate])
    ]);

    const summary = summaryResult.rows[0] || {};
    const details = detailsResult.rows || [];
    const extrasData = extrasResult.rows || [];

    // Créer un map des extras par livreur
    const extrasMap = new Map();
    extrasData.forEach(item => {
      extrasMap.set(item.livreur_id, parseInt(item.nombre_extras));
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
        benefice: parseFloat(livreur.benefice) || 0
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
        depenses: {
          total: (parseFloat(summary.total_carburant) || 0) + 
                 (parseFloat(summary.total_reparations) || 0) + 
                 (parseFloat(summary.total_police) || 0) + 
                 (parseFloat(summary.total_autres) || 0),
          carburant: parseFloat(summary.total_carburant) || 0,
          reparations: parseFloat(summary.total_reparations) || 0,
          police: parseFloat(summary.total_police) || 0,
          autres: parseFloat(summary.total_autres) || 0
        },
        km_parcourus: parseFloat(summary.total_km) || 0
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

module.exports = router; 