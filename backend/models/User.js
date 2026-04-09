const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

class User {
  constructor(data) {
    this.id = data.id;
    this.username = data.username;
    this.password_hash = data.password_hash;
    this.role = data.role;
    this.is_active = data.is_active;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.allowed_order_types = data.allowed_order_types || null;
  }

  // Créer un nouvel utilisateur
  static async create({ username, password, role, is_active = true }) {
    const id = uuidv4();
    const password_hash = await bcrypt.hash(password, 12);
    
    const query = `
      INSERT INTO users (id, username, password_hash, role, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    try {
      const result = await db.query(query, [id, username, password_hash, role, is_active]);
      return new User(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') { // Violation de contrainte unique
        throw new Error('Ce nom d\'utilisateur existe déjà');
      }
      throw error;
    }
  }

  // Trouver un utilisateur par nom d'utilisateur
  static async findByUsername(username) {
    console.log('🔍 findByUsername called with:', username);
    const query = 'SELECT * FROM users WHERE username = $1';
    console.log('🔍 Executing query:', query, 'with params:', [username]);
    const result = await db.query(query, [username]);
    console.log('🔍 Query result:', {
      rowCount: result.rows.length,
      foundUser: result.rows.length > 0 ? result.rows[0].username : 'none'
    });
    
    if (result.rows.length === 0) {
      console.log('🔍 No user found for username:', username);
      return null;
    }
    
    console.log('🔍 Creating User instance for:', result.rows[0].username);
    return new User(result.rows[0]);
  }

  // Trouver un utilisateur par ID
  static async findById(id) {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new User(result.rows[0]);
  }

  // Obtenir tous les utilisateurs
  static async findAll() {
    const query = 'SELECT * FROM users ORDER BY role, username';
    const result = await db.query(query);
    
    return result.rows.map(row => new User(row));
  }

  // Obtenir les utilisateurs par rôle
  static async findByRole(role) {
    const query = 'SELECT * FROM users WHERE role = $1 ORDER BY username';
    const result = await db.query(query, [role]);
    
    return result.rows.map(row => new User(row));
  }

  // Obtenir les livreurs actifs seulement
  static async findActiveLivreurs() {
    const query = 'SELECT * FROM users WHERE role = $1 AND is_active = true ORDER BY username';
    const result = await db.query(query, ['LIVREUR']);
    
    return result.rows.map(row => new User(row));
  }

  // Mettre à jour un utilisateur
  static async update(id, updates) {
    const allowedFields = ['username', 'role', 'is_active', 'allowed_order_types'];
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    // Construire la clause SET dynamiquement
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClause.push(`${key} = $${paramIndex}`);
        // JSONB columns need JSON.stringify
        values.push(key === 'allowed_order_types' && value !== null ? JSON.stringify(value) : value);
        paramIndex++;
      }
    }

    if (setClause.length === 0) {
      throw new Error('Aucun champ valide à mettre à jour');
    }

    values.push(id); // ID pour la clause WHERE
    
    const query = `
      UPDATE users 
      SET ${setClause.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    try {
      const result = await db.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('Utilisateur non trouvé');
      }
      
      return new User(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') {
        throw new Error('Ce nom d\'utilisateur existe déjà');
      }
      throw error;
    }
  }

  // Changer le mot de passe
  static async changePassword(id, newPassword) {
    const password_hash = await bcrypt.hash(newPassword, 12);
    
    const query = `
      UPDATE users 
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, username, role
    `;
    
    const result = await db.query(query, [password_hash, id]);
    
    if (result.rows.length === 0) {
      throw new Error('Utilisateur non trouvé');
    }
    
    return result.rows[0];
  }

  // Supprimer un utilisateur
  static async delete(id) {
    const query = 'DELETE FROM users WHERE id = $1 RETURNING *';
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('Utilisateur non trouvé');
    }
    
    return new User(result.rows[0]);
  }

  // Vérifier le mot de passe
  async verifyPassword(password) {
    console.log('🔐 verifyPassword called with:', {
      passwordLength: password?.length,
      hashExists: !!this.password_hash,
      hashPrefix: this.password_hash?.substring(0, 10)
    });
    
    try {
      const result = await bcrypt.compare(password, this.password_hash);
      console.log('🔐 bcrypt.compare result:', result);
      return result;
    } catch (error) {
      console.error('🚨 bcrypt.compare error:', error);
      throw error;
    }
  }

  // Méthode pour obtenir les données publiques (sans le hash du mot de passe)
  toJSON() {
    const { password_hash, ...publicData } = this;
    return publicData;
  }

  // Vérifier si l'utilisateur a un rôle spécifique
  hasRole(role) {
    return this.role === role;
  }

  // Vérifier si l'utilisateur est un manager ou admin
  isManagerOrAdmin() {
    console.log('🔍 isManagerOrAdmin called for user:', {
      username: this.username,
      role: this.role,
      roleType: typeof this.role,
      isManager: this.role === 'MANAGER',
      isAdmin: this.role === 'ADMIN',
      result: this.role === 'MANAGER' || this.role === 'ADMIN'
    });
    return this.role === 'MANAGER' || this.role === 'ADMIN';
  }

  // Vérifier si l'utilisateur est admin
  isAdmin() {
    return this.role === 'ADMIN';
  }

  // Vérifier si l'utilisateur peut supprimer toutes les commandes
  canDeleteAllOrders() {
    return this.role === 'ADMIN' || ['SALIOU', 'OUSMANE'].includes(this.username);
  }
}

module.exports = User; 