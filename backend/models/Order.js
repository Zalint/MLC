const { v4: uuidv4 } = require('uuid');
const db = require('./database');

class Order {
  constructor(data) {
    this.id = data.id;
    this.client_name = data.client_name;
    this.phone_number = data.phone_number;
    this.address = data.address;
    this.description = data.description;
    this.amount = data.amount;
    this.course_price = data.course_price;
    this.order_type = data.order_type;
    this.created_by = data.created_by;
    this.created_at = data.created_at;
    this.creator_username = data.creator_username; // Joint avec users
    this.subscription_id = data.subscription_id || null;
    this.adresse_source = data.adresse_source;
    this.adresse_destination = data.adresse_destination;
    this.point_de_vente = data.point_de_vente;
    this.interne = data.interne || false;
  }

  // Créer une nouvelle commande
  static async create({ client_name, phone_number, adresse_source, adresse_destination, point_de_vente, address, description, amount, course_price, order_type, created_by, subscription_id, interne }) {
    const id = uuidv4();
    
    const query = `
      INSERT INTO orders (id, client_name, phone_number, adresse_source, adresse_destination, point_de_vente, address, description, amount, course_price, order_type, created_by, subscription_id, interne)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;
    
    const result = await db.query(query, [
      id, client_name, phone_number, adresse_source, adresse_destination, point_de_vente, address, description, amount || null, course_price || 0, order_type, created_by, subscription_id || null, interne || false
    ]);
    
    return new Order(result.rows[0]);
  }

  // Trouver une commande par ID
  static async findById(id) {
    const query = `
      SELECT o.*, u.username as creator_username
      FROM orders o
      LEFT JOIN users u ON o.created_by = u.id
      WHERE o.id = $1
    `;
    
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new Order(result.rows[0]);
  }

  // Obtenir toutes les commandes avec pagination
  static async findAll(limit = 50, offset = 0) {
    const query = `
      SELECT o.*, u.username as creator_username
      FROM orders o
      LEFT JOIN users u ON o.created_by = u.id
      ORDER BY o.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const result = await db.query(query, [limit, offset]);
    return result.rows.map(row => new Order(row));
  }

  // Obtenir les commandes par utilisateur
  static async findByUser(userId, limit = 50, offset = 0) {
    const query = `
      SELECT o.*, u.username as creator_username
      FROM orders o
      LEFT JOIN users u ON o.created_by = u.id
      WHERE o.created_by = $1
      ORDER BY o.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await db.query(query, [userId, limit, offset]);
    return result.rows.map(row => new Order(row));
  }

  // Obtenir les dernières commandes d'un utilisateur
  static async findLastByUser(userId, limit = 5) {
    const query = `
      SELECT o.*, u.username as creator_username
      FROM orders o
      LEFT JOIN users u ON o.created_by = u.id
      WHERE o.created_by = $1
      ORDER BY o.created_at DESC
      LIMIT $2
    `;
    
    const result = await db.query(query, [userId, limit]);
    return result.rows.map(row => new Order(row));
  }

  // Obtenir les commandes par date
  static async findByDate(date) {
    const query = `
      SELECT o.*, u.username as creator_username
      FROM orders o
      LEFT JOIN users u ON o.created_by = u.id
      WHERE DATE(o.created_at) = $1
      ORDER BY o.created_at DESC
    `;
    
    const result = await db.query(query, [date]);
    return result.rows.map(row => new Order(row));
  }

  // Obtenir les commandes d'un utilisateur pour une date donnée
  static async findByUserAndDate(userId, date) {
    const query = `
      SELECT o.*, u.username as creator_username
      FROM orders o
      LEFT JOIN users u ON o.created_by = u.id
      WHERE o.created_by = $1 AND DATE(o.created_at) = $2
      ORDER BY o.created_at ASC
    `;
    
    const result = await db.query(query, [userId, date]);
    return result.rows.map(row => new Order(row));
  }

  // Obtenir les commandes par plage de dates
  static async findByDateRange(startDate, endDate) {
    const query = `
      SELECT o.*, u.username as creator_username
      FROM orders o
      LEFT JOIN users u ON o.created_by = u.id
      WHERE DATE(o.created_at) BETWEEN $1 AND $2
      ORDER BY o.created_at DESC
    `;
    
    const result = await db.query(query, [startDate, endDate]);
    return result.rows.map(row => new Order(row));
  }

  // Rechercher des clients par nom ou numéro de téléphone
  static async searchClients(searchTerm, limit = 10) {
    const query = `
      SELECT DISTINCT 
        client_name,
        phone_number,
        address,
        adresse_source,
        adresse_destination,
        point_de_vente,
        COUNT(*) as order_count,
        MAX(created_at) as last_order_date
      FROM orders 
      WHERE (client_name ILIKE $1 OR phone_number ILIKE $1)
        AND client_name != 'COMMANDE INTERNE'
        AND phone_number != '0000000000'
      GROUP BY client_name, phone_number, address, adresse_source, adresse_destination, point_de_vente
      ORDER BY last_order_date DESC
      LIMIT $2
    `;
    
    const result = await db.query(query, [`%${searchTerm}%`, limit]);
    return result.rows;
  }

  // Trouver un client par numéro de téléphone exact
  static async findClientByPhone(phoneNumber) {
    const query = `
      SELECT DISTINCT 
        client_name,
        phone_number,
        address,
        adresse_source,
        adresse_destination,
        point_de_vente,
        COUNT(*) as order_count,
        MAX(created_at) as last_order_date
      FROM orders 
      WHERE phone_number = $1
        AND client_name != 'COMMANDE INTERNE'
        AND phone_number != '0000000000'
      GROUP BY client_name, phone_number, address, adresse_source, adresse_destination, point_de_vente
      ORDER BY last_order_date DESC
      LIMIT 1
    `;
    
    const result = await db.query(query, [phoneNumber]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  // Obtenir les commandes du jour par utilisateur (pour managers)
  static async getTodayOrdersByUser(date = null) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const query = `
      SELECT 
        u.id as livreur_id,
        u.username as livreur,
        COUNT(o.id) as nombre_commandes,
        COALESCE(SUM(o.course_price), 0) as total_montant,
        STRING_AGG(
          CONCAT(o.client_name, ' (', o.order_type, ')'), 
          ', ' ORDER BY o.created_at
        ) as details
      FROM users u
      LEFT JOIN orders o ON u.id = o.created_by AND DATE(o.created_at) = $1
      WHERE u.role = 'LIVREUR' AND u.is_active = true
      GROUP BY u.id, u.username
      ORDER BY nombre_commandes DESC, u.username
    `;
    
    const result = await db.query(query, [targetDate]);
    return result.rows;
  }

  // Obtenir les commandes mensuelles par utilisateur (pour managers)
  static async getMonthlyOrdersByUser(month = null) {
    const targetMonth = month || new Date().toISOString().slice(0, 7); // Format YYYY-MM
    
    const query = `
      SELECT 
        u.id as livreur_id,
        u.username as livreur,
        COUNT(o.id) as nombre_commandes,
        COALESCE(SUM(o.course_price), 0) as total_montant,
        COUNT(DISTINCT DATE(o.created_at)) as jours_actifs
      FROM users u
      LEFT JOIN orders o ON u.id = o.created_by 
        AND TO_CHAR(o.created_at, 'YYYY-MM') = $1
      WHERE u.role = 'LIVREUR' AND u.is_active = true
      GROUP BY u.id, u.username
      ORDER BY nombre_commandes DESC, u.username
    `;
    
    const result = await db.query(query, [targetMonth]);
    return result.rows;
  }

  // Obtenir les détails mensuels par jour (pour le tableau détaillé)
  static async getMonthlyDetailsByDay(month = null) {
    const targetMonth = month || new Date().toISOString().slice(0, 7); // Format YYYY-MM
    
    // Créer les dates du mois en JavaScript pour compatibilité
    const year = parseInt(targetMonth.split('-')[0]);
    const monthNum = parseInt(targetMonth.split('-')[1]);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    
    // Récupérer d'abord tous les livreurs actifs
    const livreursQuery = `
      SELECT id as livreur_id, username as livreur
      FROM users 
      WHERE role = 'LIVREUR' AND is_active = true
      ORDER BY username
    `;
    const livreursResult = await db.query(livreursQuery);
    const livreurs = livreursResult.rows;
    
    // Récupérer les commandes du mois
    const ordersQuery = `
      SELECT 
        TO_CHAR(o.created_at, 'YYYY-MM-DD') as date,
        u.id as livreur_id,
        u.username as livreur,
        COUNT(o.id) as nombre_commandes,
        COALESCE(SUM(o.course_price), 0) as total_montant
      FROM orders o
      JOIN users u ON o.created_by = u.id
      WHERE TO_CHAR(o.created_at, 'YYYY-MM') = $1
        AND u.role = 'LIVREUR' AND u.is_active = true
      GROUP BY TO_CHAR(o.created_at, 'YYYY-MM-DD'), u.id, u.username
      ORDER BY TO_CHAR(o.created_at, 'YYYY-MM-DD'), u.username
    `;
    
    const ordersResult = await db.query(ordersQuery, [targetMonth]);
    const ordersData = ordersResult.rows;
    
    // Créer un map pour accès rapide
    const ordersMap = {};
    ordersData.forEach(order => {
      if (order.date) {
        // Convertir la date en format YYYY-MM-DD
        const dateStr = order.date instanceof Date ? 
          order.date.toISOString().split('T')[0] : 
          order.date;
        const key = `${dateStr}_${order.livreur_id}`;
        ordersMap[key] = order;
      }
    });
    
    // Générer toutes les combinaisons date/livreur
    const result = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${monthNum.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      
      livreurs.forEach(livreur => {
        const key = `${dateStr}_${livreur.livreur_id}`;
        const orderData = ordersMap[key];
        
        result.push({
          date: dateStr,
          livreur_id: livreur.livreur_id,
          livreur: livreur.livreur,
          nombre_commandes: orderData ? parseInt(orderData.nombre_commandes) : 0,
          total_montant: orderData ? parseFloat(orderData.total_montant) : 0
        });
      });
    }
    
    return result;
  }

  // Obtenir les statistiques par type de commande
  static async getStatsByType(startDate, endDate) {
    const query = `
      SELECT 
        CASE 
          WHEN order_type = 'MLC' AND subscription_id IS NOT NULL THEN 'MLC avec abonnement'
          WHEN order_type = 'MLC' AND subscription_id IS NULL THEN 'MLC simple'
          WHEN order_type = 'MATA' AND interne = true THEN 'MATA interne'
          WHEN order_type = 'MATA' AND (interne = false OR interne IS NULL) THEN 'MATA client'
          ELSE order_type
        END as order_type,
        COUNT(*) as count,
        COALESCE(SUM(course_price), 0) as total_amount
      FROM orders
      WHERE DATE(created_at) BETWEEN $1 AND $2
      GROUP BY 
        CASE 
          WHEN order_type = 'MLC' AND subscription_id IS NOT NULL THEN 'MLC avec abonnement'
          WHEN order_type = 'MLC' AND subscription_id IS NULL THEN 'MLC simple'
          WHEN order_type = 'MATA' AND interne = true THEN 'MATA interne'
          WHEN order_type = 'MATA' AND (interne = false OR interne IS NULL) THEN 'MATA client'
          ELSE order_type
        END
      ORDER BY count DESC
    `;
    
    const result = await db.query(query, [startDate, endDate]);
    return result.rows;
  }

  // Obtenir les statistiques par type de commande par livreur pour un mois donné
  static async getStatsByTypeByUser(month) {
    const query = `
      SELECT 
        u.username as livreur,
        CASE 
          WHEN o.order_type = 'MLC' AND o.subscription_id IS NOT NULL THEN 'MLC avec abonnement'
          WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL THEN 'MLC simple'
          WHEN o.order_type = 'MATA' AND o.interne = true THEN 'MATA interne'
          WHEN o.order_type = 'MATA' AND (o.interne = false OR o.interne IS NULL) THEN 'MATA client'
          ELSE o.order_type
        END as order_type,
        COUNT(*) as count,
        COALESCE(SUM(o.course_price), 0) as total_amount
      FROM orders o
      JOIN users u ON o.created_by = u.id
      WHERE TO_CHAR(o.created_at, 'YYYY-MM') = $1
      GROUP BY u.username, 
        CASE 
          WHEN o.order_type = 'MLC' AND o.subscription_id IS NOT NULL THEN 'MLC avec abonnement'
          WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL THEN 'MLC simple'
          WHEN o.order_type = 'MATA' AND o.interne = true THEN 'MATA interne'
          WHEN o.order_type = 'MATA' AND (o.interne = false OR o.interne IS NULL) THEN 'MATA client'
          ELSE o.order_type
        END
      ORDER BY u.username, count DESC
    `;
    
    const result = await db.query(query, [month]);
    return result.rows;
  }

  // Obtenir les statistiques par type de commande pour un livreur spécifique pour une date donnée
  static async getStatsByTypeByUserAndDate(userId, date) {
    const query = `
      SELECT 
        CASE 
          WHEN order_type = 'MLC' AND subscription_id IS NOT NULL THEN 'MLC avec abonnement'
          WHEN order_type = 'MLC' AND subscription_id IS NULL THEN 'MLC simple'
          WHEN order_type = 'MATA' AND interne = true THEN 'MATA interne'
          WHEN order_type = 'MATA' AND (interne = false OR interne IS NULL) THEN 'MATA client'
          ELSE order_type
        END as order_type,
        COUNT(*) as count,
        COALESCE(SUM(course_price), 0) as total_amount
      FROM orders
      WHERE created_by = $1 AND TO_CHAR(created_at, 'YYYY-MM-DD') = $2
      GROUP BY 
        CASE 
          WHEN order_type = 'MLC' AND subscription_id IS NOT NULL THEN 'MLC avec abonnement'
          WHEN order_type = 'MLC' AND subscription_id IS NULL THEN 'MLC simple'
          WHEN order_type = 'MATA' AND interne = true THEN 'MATA interne'
          WHEN order_type = 'MATA' AND (interne = false OR interne IS NULL) THEN 'MATA client'
          ELSE order_type
        END
      ORDER BY count DESC
    `;
    
    const result = await db.query(query, [userId, date]);
    return result.rows;
  }

  // Obtenir les statistiques par type de commande pour un livreur spécifique pour un mois donné
  static async getStatsByTypeByUserAndMonth(userId, month) {
    const query = `
      SELECT 
        CASE 
          WHEN order_type = 'MLC' AND subscription_id IS NOT NULL THEN 'MLC avec abonnement'
          WHEN order_type = 'MLC' AND subscription_id IS NULL THEN 'MLC simple'
          WHEN order_type = 'MATA' AND interne = true THEN 'MATA interne'
          WHEN order_type = 'MATA' AND (interne = false OR interne IS NULL) THEN 'MATA client'
          ELSE order_type
        END as order_type,
        COUNT(*) as count,
        COALESCE(SUM(course_price), 0) as total_amount
      FROM orders
      WHERE created_by = $1 AND TO_CHAR(created_at, 'YYYY-MM') = $2
      GROUP BY 
        CASE 
          WHEN order_type = 'MLC' AND subscription_id IS NOT NULL THEN 'MLC avec abonnement'
          WHEN order_type = 'MLC' AND subscription_id IS NULL THEN 'MLC simple'
          WHEN order_type = 'MATA' AND interne = true THEN 'MATA interne'
          WHEN order_type = 'MATA' AND (interne = false OR interne IS NULL) THEN 'MATA client'
          ELSE order_type
        END
      ORDER BY count DESC
    `;
    
    const result = await db.query(query, [userId, month]);
    return result.rows;
  }

  // Obtenir les détails par point de vente pour les commandes MATA d'une date donnée
  static async getMataStatsByPointDeVente(date) {
    const query = `
      SELECT 
        point_de_vente,
        COUNT(*) as count
      FROM orders
      WHERE order_type = 'MATA' 
        AND DATE(created_at) = $1
        AND point_de_vente IS NOT NULL 
        AND TRIM(point_de_vente) <> ''
      GROUP BY point_de_vente
      ORDER BY count DESC
    `;
    
    const result = await db.query(query, [date]);
    return result.rows;
  }

  // Obtenir les détails par point de vente pour les commandes MATA d'un utilisateur spécifique pour une date donnée
  static async getMataStatsByPointDeVenteByUser(userId, date) {
    const query = `
      SELECT 
        point_de_vente,
        COUNT(*) as count
      FROM orders
      WHERE order_type = 'MATA' 
        AND created_by = $1 
        AND DATE(created_at) = $2
        AND point_de_vente IS NOT NULL 
        AND TRIM(point_de_vente) <> ''
      GROUP BY point_de_vente
      ORDER BY count DESC
    `;
    
    const result = await db.query(query, [userId, date]);
    return result.rows;
  }

  // Obtenir, pour un mois donné, les stats par type (normalisées) pour chaque couple (date, livreur)
  static async getDailyTypeStatsByMonth(month) {
    const query = `
      SELECT 
        TO_CHAR(o.created_at, 'YYYY-MM-DD') as date,
        u.username as livreur,
        CASE 
          WHEN o.order_type = 'MLC' AND o.subscription_id IS NOT NULL THEN 'MLC avec abonnement'
          WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL THEN 'MLC simple'
          WHEN o.order_type = 'MATA' AND o.interne = true THEN 'MATA interne'
          WHEN o.order_type = 'MATA' AND (o.interne = false OR o.interne IS NULL) THEN 'MATA client'
          ELSE o.order_type
        END as order_type,
        COUNT(*) as count
      FROM orders o
      JOIN users u ON o.created_by = u.id
      WHERE TO_CHAR(o.created_at, 'YYYY-MM') = $1
        AND u.role = 'LIVREUR' AND u.is_active = true
      GROUP BY TO_CHAR(o.created_at, 'YYYY-MM-DD'), u.username,
        CASE 
          WHEN o.order_type = 'MLC' AND o.subscription_id IS NOT NULL THEN 'MLC avec abonnement'
          WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL THEN 'MLC simple'
          WHEN o.order_type = 'MATA' AND o.interne = true THEN 'MATA interne'
          WHEN o.order_type = 'MATA' AND (o.interne = false OR o.interne IS NULL) THEN 'MATA client'
          ELSE o.order_type
        END
      ORDER BY TO_CHAR(o.created_at, 'YYYY-MM-DD'), u.username, COUNT(*) DESC
    `;
    const result = await db.query(query, [month]);
    return result.rows;
  }

  // Mettre à jour une commande
  static async update(id, updates) {
    const allowedFields = ['client_name', 'phone_number', 'adresse_source', 'adresse_destination', 'point_de_vente', 'address', 'description', 'amount', 'course_price', 'order_type', 'commentaire', 'service_rating', 'quality_rating', 'price_rating', 'commercial_service_rating', 'average_rating'];
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    // Construire la clause SET dynamiquement
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClause.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClause.length === 0) {
      throw new Error('Aucun champ valide à mettre à jour');
    }

    values.push(id); // ID pour la clause WHERE
    
    const query = `
      UPDATE orders 
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Commande non trouvée');
    }
    
    return new Order(result.rows[0]);
  }

  // Supprimer une commande
  static async delete(id) {
    const query = 'DELETE FROM orders WHERE id = $1 RETURNING *';
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('Commande non trouvée');
    }
    
    return new Order(result.rows[0]);
  }

  // Supprimer les commandes d'un utilisateur pour une date donnée
  static async deleteUserOrdersForDate(userId, date) {
    const query = `
      DELETE FROM orders 
      WHERE created_by = $1 AND DATE(created_at) = $2
      RETURNING *
    `;
    
    const result = await db.query(query, [userId, date]);
    return result.rows.map(row => new Order(row));
  }

  // Vérifier si une commande appartient à un utilisateur
  static async belongsToUser(orderId, userId) {
    const query = 'SELECT created_by FROM orders WHERE id = $1';
    const result = await db.query(query, [orderId]);
    
    if (result.rows.length === 0) {
      return false;
    }
    
    return result.rows[0].created_by === userId;
  }

  // Vérifier si une commande a été créée aujourd'hui
  static async isCreatedToday(orderId) {
    const today = new Date().toISOString().split('T')[0];
    const query = 'SELECT id FROM orders WHERE id = $1 AND DATE(created_at) = $2';
    const result = await db.query(query, [orderId, today]);
    
    return result.rows.length > 0;
  }

  // Compter le nombre total de commandes
  static async count() {
    const query = 'SELECT COUNT(*) as total FROM orders';
    const result = await db.query(query);
    return parseInt(result.rows[0].total);
  }

  // Compter les commandes par utilisateur
  static async countByUser(userId) {
    const query = 'SELECT COUNT(*) as total FROM orders WHERE created_by = $1';
    const result = await db.query(query, [userId]);
    return parseInt(result.rows[0].total);
  }

  // Formater le montant pour l'affichage
  getFormattedAmount() {
    if (!this.amount) return '0,00 €';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(this.amount);
  }

  // Formater la date pour l'affichage
  getFormattedDate() {
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(this.created_at));
  }

  // Obtenir les statistiques par type de commande pour tous les livreurs pour une date donnée
  static async getStatsByTypeByUserAndDateAll(date) {
    const query = `
      SELECT 
        u.username as livreur,
        CASE 
          WHEN o.order_type = 'MLC' AND o.subscription_id IS NOT NULL THEN 'MLC avec abonnement'
          WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL THEN 'MLC simple'
          WHEN o.order_type = 'MATA' AND o.interne = true THEN 'MATA interne'
          WHEN o.order_type = 'MATA' AND (o.interne = false OR o.interne IS NULL) THEN 'MATA client'
          ELSE o.order_type
        END as order_type,
        COUNT(*) as count,
        COALESCE(SUM(o.course_price), 0) as total_amount
      FROM orders o
      JOIN users u ON o.created_by = u.id
      WHERE TO_CHAR(o.created_at, 'YYYY-MM-DD') = $1
        AND u.role = 'LIVREUR' AND u.is_active = true
      GROUP BY u.username, 
        CASE 
          WHEN o.order_type = 'MLC' AND o.subscription_id IS NOT NULL THEN 'MLC avec abonnement'
          WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL THEN 'MLC simple'
          WHEN o.order_type = 'MATA' AND o.interne = true THEN 'MATA interne'
          WHEN o.order_type = 'MATA' AND (o.interne = false OR o.interne IS NULL) THEN 'MATA client'
          ELSE o.order_type
        END
      ORDER BY u.username, count DESC
    `;
    
    const result = await db.query(query, [date]);
    return result.rows;
  }
}

module.exports = Order; 