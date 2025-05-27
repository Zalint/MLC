const { v4: uuidv4 } = require('uuid');
const db = require('./database');

class Subscription {
  constructor(data) {
    this.id = data.id;
    this.client_name = data.client_name;
    this.phone_number = data.phone_number;
    this.card_number = data.card_number;
    this.total_deliveries = data.total_deliveries || 10;
    this.used_deliveries = data.used_deliveries || 0;
    this.remaining_deliveries = data.remaining_deliveries || 10;
    this.purchase_date = data.purchase_date;
    this.expiry_date = data.expiry_date;
    this.is_active = data.is_active !== false;
    this.created_by = data.created_by;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.creator_username = data.creator_username;
    this.address = data.address;
    this.price = data.price;
  }

  // Créer une nouvelle carte d'abonnement
  static async create({ client_name, phone_number, total_deliveries = 10, created_by, expiry_months = 6, address = null, price = null }) {
    const id = uuidv4();
    const card_number = await this.generateCardNumber();
    const purchase_date = new Date();
    const expiry_date = new Date();
    expiry_date.setMonth(expiry_date.getMonth() + expiry_months);
    
    const query = `
      INSERT INTO subscriptions (
        id, client_name, phone_number, card_number, total_deliveries, 
        used_deliveries, remaining_deliveries, purchase_date, expiry_date, 
        is_active, created_by, address, price
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    
    const result = await db.query(query, [
      id, client_name, phone_number, card_number, total_deliveries,
      0, total_deliveries, purchase_date, expiry_date, true, created_by, address, price
    ]);
    
    return new Subscription(result.rows[0]);
  }

  // Générer un numéro de carte unique
  static async generateCardNumber() {
    let cardNumber;
    let exists = true;
    
    while (exists) {
      // Format: MLC-YYYY-NNNN (ex: MLC-2024-0001)
      const year = new Date().getFullYear();
      const randomNum = Math.floor(Math.random() * 9999) + 1;
      cardNumber = `MLC-${year}-${randomNum.toString().padStart(4, '0')}`;
      
      const checkQuery = 'SELECT id FROM subscriptions WHERE card_number = $1';
      const result = await db.query(checkQuery, [cardNumber]);
      exists = result.rows.length > 0;
    }
    
    return cardNumber;
  }

  // Trouver une carte par ID
  static async findById(id) {
    const query = `
      SELECT s.*, u.username as creator_username
      FROM subscriptions s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.id = $1
    `;
    
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new Subscription(result.rows[0]);
  }

  // Trouver une carte par numéro
  static async findByCardNumber(cardNumber) {
    const query = `
      SELECT s.*, u.username as creator_username
      FROM subscriptions s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.card_number = $1
    `;
    
    const result = await db.query(query, [cardNumber]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new Subscription(result.rows[0]);
  }

  // Trouver les cartes d'un client par téléphone
  static async findByPhoneNumber(phoneNumber) {
    const query = `
      SELECT s.*, u.username as creator_username
      FROM subscriptions s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.phone_number = $1
      ORDER BY s.created_at DESC
    `;
    
    const result = await db.query(query, [phoneNumber]);
    return result.rows.map(row => new Subscription(row));
  }

  // Trouver les cartes actives d'un client
  static async findActiveByPhoneNumber(phoneNumber) {
    const query = `
      SELECT s.*, u.username as creator_username
      FROM subscriptions s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.phone_number = $1 
        AND s.is_active = true 
        AND s.remaining_deliveries > 0
        AND s.expiry_date > NOW()
      ORDER BY s.created_at ASC
    `;
    
    const result = await db.query(query, [phoneNumber]);
    return result.rows.map(row => new Subscription(row));
  }

  // Trouver toutes les cartes actives
  static async findActive() {
    const query = `
      SELECT s.*, u.username as creator_username
      FROM subscriptions s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.is_active = true 
        AND s.remaining_deliveries > 0
        AND s.expiry_date > NOW()
      ORDER BY s.created_at ASC
    `;
    
    const result = await db.query(query);
    return result.rows.map(row => new Subscription(row));
  }

  // Obtenir toutes les cartes avec pagination
  static async findAll(limit = 50, offset = 0) {
    const query = `
      SELECT s.*, u.username as creator_username
      FROM subscriptions s
      LEFT JOIN users u ON s.created_by = u.id
      ORDER BY s.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const result = await db.query(query, [limit, offset]);
    return result.rows.map(row => new Subscription(row));
  }

  // Utiliser une livraison de la carte
  static async useDelivery(cardId) {
    const query = `
      UPDATE subscriptions 
      SET used_deliveries = used_deliveries + 1,
          remaining_deliveries = remaining_deliveries - 1,
          updated_at = NOW()
      WHERE id = $1 
        AND remaining_deliveries > 0 
        AND is_active = true
        AND expiry_date > NOW()
      RETURNING *
    `;
    
    const result = await db.query(query, [cardId]);
    
    if (result.rows.length === 0) {
      throw new Error('Carte non trouvée, expirée ou sans livraisons restantes');
    }
    
    const subscription = new Subscription(result.rows[0]);
    
    // Désactiver la carte si toutes les livraisons sont utilisées
    if (subscription.remaining_deliveries === 0) {
      await this.deactivate(cardId);
    }
    
    return subscription;
  }

  // Désactiver une carte
  static async deactivate(cardId) {
    const query = `
      UPDATE subscriptions 
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await db.query(query, [cardId]);
    
    if (result.rows.length === 0) {
      throw new Error('Carte non trouvée');
    }
    
    return new Subscription(result.rows[0]);
  }

  // Réactiver une carte
  static async reactivate(cardId) {
    const query = `
      UPDATE subscriptions 
      SET is_active = true, updated_at = NOW()
      WHERE id = $1 AND remaining_deliveries > 0 AND expiry_date > NOW()
      RETURNING *
    `;
    
    const result = await db.query(query, [cardId]);
    
    if (result.rows.length === 0) {
      throw new Error('Carte non trouvée ou conditions non remplies pour la réactivation');
    }
    
    return new Subscription(result.rows[0]);
  }

  // Obtenir les statistiques des abonnements
  static async getStats() {
    const query = `
      SELECT 
        COUNT(*) as total_cards,
        COUNT(CASE WHEN is_active = true AND remaining_deliveries > 0 AND expiry_date > NOW() THEN 1 END) as active_cards,
        COUNT(CASE WHEN remaining_deliveries = 0 THEN 1 END) as completed_cards,
        COUNT(CASE WHEN expiry_date <= NOW() THEN 1 END) as expired_cards,
        SUM(total_deliveries) as total_deliveries_sold,
        SUM(used_deliveries) as total_deliveries_used,
        SUM(remaining_deliveries) as total_deliveries_remaining
      FROM subscriptions
    `;
    
    const result = await db.query(query);
    return result.rows[0];
  }

  // Obtenir les cartes qui expirent bientôt
  static async getExpiringSoon(days = 30) {
    const query = `
      SELECT s.*, u.username as creator_username
      FROM subscriptions s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.is_active = true 
        AND s.remaining_deliveries > 0
        AND s.expiry_date > NOW()
        AND s.expiry_date <= NOW() + INTERVAL '${days} days'
      ORDER BY s.expiry_date ASC
    `;
    
    const result = await db.query(query);
    return result.rows.map(row => new Subscription(row));
  }

  // Rechercher des cartes
  static async search(searchTerm, limit = 20) {
    const query = `
      SELECT s.*, u.username as creator_username
      FROM subscriptions s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.client_name ILIKE $1 
        OR s.phone_number ILIKE $1 
        OR s.card_number ILIKE $1
      ORDER BY s.created_at DESC
      LIMIT $2
    `;
    
    const result = await db.query(query, [`%${searchTerm}%`, limit]);
    return result.rows.map(row => new Subscription(row));
  }

  // Mettre à jour une carte
  static async update(id, updates) {
    const allowedFields = ['client_name', 'phone_number', 'expiry_date', 'is_active', 'address', 'price'];
    const setClause = [];
    const values = [];
    let paramIndex = 1;

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

    setClause.push('updated_at = NOW()');
    values.push(id);
    
    const query = `
      UPDATE subscriptions 
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Carte d\'abonnement non trouvée');
    }
    
    return new Subscription(result.rows[0]);
  }

  // Supprimer une carte (soft delete en désactivant)
  static async delete(id) {
    return this.deactivate(id);
  }

  // Vérifier si la carte est utilisable
  isUsable() {
    const now = new Date();
    return this.is_active && 
           this.remaining_deliveries > 0 && 
           new Date(this.expiry_date) > now;
  }

  // Obtenir le statut de la carte
  getStatus() {
    if (!this.is_active) return 'INACTIVE';
    if (this.remaining_deliveries === 0) return 'COMPLETED';
    if (new Date(this.expiry_date) <= new Date()) return 'EXPIRED';
    return 'ACTIVE';
  }

  // Formater la date d'expiration
  getFormattedExpiryDate() {
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(this.expiry_date));
  }

  // Formater la date d'achat
  getFormattedPurchaseDate() {
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(this.purchase_date));
  }
}

module.exports = Subscription; 