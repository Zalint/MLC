const db = require('../models/database');

/**
 * Controller pour gérer les commandes en cours
 * Ces commandes sont reçues via une API externe protégée par x-api-key
 */

/**
 * POST /api/external/commande-en-cours
 * Reçoit une nouvelle commande en cours et la stocke dans la base de données
 */
const createCommandeEnCours = async (req, res) => {
  try {
    const {
      commande_id,
      livreur_id,
      livreur_nom,
      client,
      articles,
      total,
      point_vente,
      date_commande,
      statut
    } = req.body;

    // Validation des données obligatoires
    if (!commande_id || !livreur_id || !livreur_nom || !client || !articles || !total || !point_vente || !date_commande || !statut) {
      return res.status(400).json({
        success: false,
        error: 'Données manquantes. Tous les champs sont obligatoires.',
        required_fields: ['commande_id', 'livreur_id', 'livreur_nom', 'client', 'articles', 'total', 'point_vente', 'date_commande', 'statut']
      });
    }

    // Validation du client
    if (!client.nom || !client.telephone || !client.adresse) {
      return res.status(400).json({
        success: false,
        error: 'Données client manquantes (nom, telephone, adresse requis)'
      });
    }

    // Validation des articles
    if (!Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Au moins un article est requis'
      });
    }

    for (const article of articles) {
      if (!article.produit || !article.quantite || !article.prix) {
        return res.status(400).json({
          success: false,
          error: 'Chaque article doit contenir produit, quantite et prix'
        });
      }
    }

    // Vérifier que le livreur existe dans la base de données
    // On accepte le username comme livreur_id (plus simple pour l'API externe)
    const livreurCheckQuery = `
      SELECT id, username, is_active FROM users 
      WHERE username = $1 AND role = 'LIVREUR'
    `;
    const livreurResult = await db.query(livreurCheckQuery, [livreur_id]);

    if (livreurResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: `Livreur avec le nom "${livreur_id}" n'existe pas ou n'est pas un livreur valide`
      });
    }

    const livreur = livreurResult.rows[0];
    
    // Vérifier que le livreur est actif
    if (!livreur.is_active) {
      return res.status(400).json({
        success: false,
        error: `Le livreur "${livreur.username}" est inactif et ne peut pas recevoir de commandes`
      });
    }

    // On stocke le username comme livreur_id (pas l'UUID)
    // Plus simple pour l'API externe et le filtrage
    const livreurIdReel = livreur.username;  // Username, pas UUID
    const livreurNomReel = livreur.username;

    // Vérifier si la commande existe déjà (pour éviter les doublons)
    const checkQuery = `
      SELECT id FROM commandes_en_cours WHERE commande_id = $1
    `;
    const checkResult = await db.query(checkQuery, [commande_id]);

    if (checkResult.rows.length > 0) {
      // Mettre à jour la commande existante
      const updateQuery = `
        UPDATE commandes_en_cours
        SET 
          livreur_id = $2,
          livreur_nom = $3,
          client_nom = $4,
          client_telephone = $5,
          client_adresse = $6,
          articles = $7,
          total = $8,
          point_vente = $9,
          date_commande = $10,
          statut = $11,
          updated_at = NOW()
        WHERE commande_id = $1
        RETURNING *
      `;

      const result = await db.query(updateQuery, [
        commande_id,
        livreurIdReel,  // Utiliser l'ID réel de la base
        livreurNomReel, // Utiliser le nom réel de la base
        client.nom,
        client.telephone,
        client.adresse,
        JSON.stringify(articles),
        total,
        point_vente,
        date_commande,
        statut
      ]);

      console.log(`✅ Commande en cours mise à jour: ${commande_id}`);

      return res.status(200).json({
        success: true,
        message: 'Commande en cours mise à jour avec succès',
        data: result.rows[0]
      });
    }

    // Insérer une nouvelle commande en cours
    const insertQuery = `
      INSERT INTO commandes_en_cours (
        commande_id,
        livreur_id,
        livreur_nom,
        client_nom,
        client_telephone,
        client_adresse,
        articles,
        total,
        point_vente,
        date_commande,
        statut
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const result = await db.query(insertQuery, [
      commande_id,
      livreurIdReel,  // Utiliser l'ID réel de la base
      livreurNomReel, // Utiliser le nom réel de la base
      client.nom,
      client.telephone,
      client.adresse,
      JSON.stringify(articles),
      total,
      point_vente,
      date_commande,
      statut
    ]);

    console.log(`✅ Nouvelle commande en cours créée: ${commande_id}`);

    return res.status(201).json({
      success: true,
      message: 'Commande en cours créée avec succès',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Erreur lors de la création de la commande en cours:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/v1/commandes-en-cours
 * Récupère les commandes en cours
 * - Livreurs : Voient uniquement leurs commandes assignées
 * - Managers/Admins : Voient toutes les commandes
 */
const getCommandesEnCours = async (req, res) => {
  try {
    const { statut, livreur_id, point_vente } = req.query;
    const user = req.user; // Utilisateur authentifié depuis le middleware JWT

    let query = `
      SELECT 
        id,
        commande_id,
        livreur_id,
        livreur_nom,
        client_nom,
        client_telephone,
        client_adresse,
        articles,
        total,
        point_vente,
        date_commande,
        statut,
        created_at,
        updated_at
      FROM commandes_en_cours
      WHERE 1=1
    `;

    const params = [];
    let paramCounter = 1;

    // Si l'utilisateur est un livreur, filtrer automatiquement par son ID
    if (user && user.role === 'LIVREUR') {
      // Pour les livreurs, on filtre par leur username (qui est stocké dans livreur_id)
      query += ` AND livreur_id = $${paramCounter}`;
      params.push(user.username); // Utiliser username (plus simple)
      paramCounter++;
    }

    // Filtrer par statut
    if (statut) {
      query += ` AND statut = $${paramCounter}`;
      params.push(statut);
      paramCounter++;
    }

    // Filtrer par livreur (seulement pour managers/admins)
    if (livreur_id && user && (user.role === 'MANAGER' || user.role === 'ADMIN')) {
      query += ` AND livreur_id = $${paramCounter}`;
      params.push(livreur_id);
      paramCounter++;
    }

    // Filtrer par point de vente
    if (point_vente) {
      query += ` AND point_vente = $${paramCounter}`;
      params.push(point_vente);
      paramCounter++;
    }

    query += ` ORDER BY date_commande DESC, created_at DESC`;

    const result = await db.query(query, params);

    // Parser les articles JSON pour chaque commande
    const commandes = result.rows.map(row => ({
      ...row,
      articles: typeof row.articles === 'string' ? JSON.parse(row.articles) : row.articles
    }));

    return res.status(200).json({
      success: true,
      count: commandes.length,
      data: commandes
    });

  } catch (error) {
    console.error('❌ Erreur lors de la récupération des commandes en cours:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * DELETE /api/v1/commandes-en-cours/:id
 * Supprime une commande en cours (quand elle est terminée ou annulée)
 * Accessible uniquement aux managers et admins
 */
const deleteCommandeEnCours = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // Vérifier que l'utilisateur est manager ou admin
    if (user.role !== 'MANAGER' && user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé. Seuls les managers et admins peuvent supprimer des commandes.'
      });
    }

    const deleteQuery = `
      DELETE FROM commandes_en_cours
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(deleteQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Commande en cours non trouvée'
      });
    }

    console.log(`✅ Commande en cours supprimée: ${result.rows[0].commande_id}`);

    return res.status(200).json({
      success: true,
      message: 'Commande en cours supprimée avec succès',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Erreur lors de la suppression de la commande en cours:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * PATCH /api/v1/commandes-en-cours/:id/statut
 * Met à jour le statut d'une commande en cours
 * Les livreurs peuvent mettre à jour uniquement leurs propres commandes
 */
const updateStatutCommande = async (req, res) => {
  try {
    const { id } = req.params;
    const { statut } = req.body;
    const user = req.user;

    if (!statut) {
      return res.status(400).json({
        success: false,
        error: 'Le statut est requis'
      });
    }

    // Vérifier si l'utilisateur est un livreur
    if (user.role === 'LIVREUR') {
      // Vérifier que la commande appartient au livreur
      const checkQuery = `
        SELECT livreur_id FROM commandes_en_cours WHERE id = $1
      `;
      const checkResult = await db.query(checkQuery, [id]);
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Commande non trouvée'
        });
      }
      
      if (checkResult.rows[0].livreur_id !== user.username) {
        return res.status(403).json({
          success: false,
          error: 'Vous ne pouvez modifier que vos propres commandes'
        });
      }
    }

    const updateQuery = `
      UPDATE commandes_en_cours
      SET statut = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await db.query(updateQuery, [statut, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Commande en cours non trouvée'
      });
    }

    console.log(`✅ Statut de commande en cours mis à jour: ${result.rows[0].commande_id} -> ${statut}`);

    return res.status(200).json({
      success: true,
      message: 'Statut mis à jour avec succès',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour du statut:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * PATCH /api/v1/commandes-en-cours/:id/reassign
 * Réassigner une commande à un autre livreur (MANAGER/ADMIN uniquement)
 */
const reassignCommande = async (req, res) => {
  try {
    const { id } = req.params;
    const { nouveau_livreur_id } = req.body;
    const { role } = req.user;

    // Vérifier que l'utilisateur est MANAGER ou ADMIN
    if (role !== 'MANAGER' && role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Seuls les managers et admins peuvent réassigner des commandes'
      });
    }

    if (!nouveau_livreur_id) {
      return res.status(400).json({
        success: false,
        error: 'nouveau_livreur_id est requis'
      });
    }

    // Vérifier que le nouveau livreur existe et est actif
    const livreurCheckQuery = `
      SELECT id, username, is_active FROM users 
      WHERE (id::text = $1 OR username = $1) AND role = 'LIVREUR'
    `;
    const livreurResult = await db.query(livreurCheckQuery, [nouveau_livreur_id]);

    if (livreurResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: `Livreur avec l'identifiant "${nouveau_livreur_id}" n'existe pas ou n'est pas un livreur valide`
      });
    }

    const livreur = livreurResult.rows[0];
    
    if (!livreur.is_active) {
      return res.status(400).json({
        success: false,
        error: `Le livreur "${livreur.username}" est inactif et ne peut pas recevoir de commandes`
      });
    }

    // Mettre à jour la commande avec le nouveau livreur
    const updateQuery = `
      UPDATE commandes_en_cours
      SET 
        livreur_id = $1,
        livreur_nom = $2,
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;

    const result = await db.query(updateQuery, [livreur.id, livreur.username, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Commande non trouvée'
      });
    }

    console.log(`✅ Commande ${result.rows[0].commande_id} réassignée à ${livreur.username}`);

    return res.status(200).json({
      success: true,
      message: `Commande réassignée à ${livreur.username} avec succès`,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Erreur lors de la réassignation:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la réassignation'
    });
  }
};

module.exports = {
  createCommandeEnCours,
  getCommandesEnCours,
  deleteCommandeEnCours,
  updateStatutCommande,
  reassignCommande
};

