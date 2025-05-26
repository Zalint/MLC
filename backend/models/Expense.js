const { v4: uuidv4 } = require('uuid');
const db = require('./database');

class Expense {
  constructor(data) {
    this.id = data.id;
    this.livreur_id = data.livreur_id;
    this.expense_date = data.expense_date;
    this.carburant = data.carburant || 0;
    this.reparations = data.reparations || 0;
    this.police = data.police || 0;
    this.autres = data.autres || 0;
    this.km_parcourus = data.km_parcourus || 0;
    this.commentaire = data.commentaire;
    this.created_by = data.created_by;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.livreur_username = data.livreur_username; // Joint avec users
    this.creator_username = data.creator_username; // Joint avec users
  }

  // Créer ou mettre à jour une dépense
  static async createOrUpdate({ livreur_id, expense_date, carburant, reparations, police, autres, km_parcourus, commentaire, created_by }) {
    const id = uuidv4();
    
    const query = `
      INSERT INTO expenses (id, livreur_id, expense_date, carburant, reparations, police, autres, km_parcourus, commentaire, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (livreur_id, expense_date)
      DO UPDATE SET
        carburant = EXCLUDED.carburant,
        reparations = EXCLUDED.reparations,
        police = EXCLUDED.police,
        autres = EXCLUDED.autres,
        km_parcourus = EXCLUDED.km_parcourus,
        commentaire = EXCLUDED.commentaire,
        updated_at = NOW()
      RETURNING *
    `;
    
    const result = await db.query(query, [
      id, livreur_id, expense_date, carburant || 0, reparations || 0, police || 0, autres || 0, km_parcourus || 0, commentaire, created_by
    ]);
    
    return new Expense(result.rows[0]);
  }

  // Trouver une dépense par ID
  static async findById(id) {
    const query = `
      SELECT e.*, 
             u1.username as livreur_username,
             u2.username as creator_username
      FROM expenses e
      LEFT JOIN users u1 ON e.livreur_id = u1.id
      LEFT JOIN users u2 ON e.created_by = u2.id
      WHERE e.id = $1
    `;
    
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new Expense(result.rows[0]);
  }

  // Trouver une dépense par livreur et date
  static async findByLivreurAndDate(livreur_id, expense_date) {
    const query = `
      SELECT e.*, 
             u1.username as livreur_username,
             u2.username as creator_username
      FROM expenses e
      LEFT JOIN users u1 ON e.livreur_id = u1.id
      LEFT JOIN users u2 ON e.created_by = u2.id
      WHERE e.livreur_id = $1 AND e.expense_date = $2
    `;
    
    const result = await db.query(query, [livreur_id, expense_date]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new Expense(result.rows[0]);
  }

  // Obtenir toutes les dépenses pour une date donnée
  static async findByDate(expense_date) {
    const query = `
      SELECT e.*, 
             u1.username as livreur_username,
             u2.username as creator_username
      FROM expenses e
      LEFT JOIN users u1 ON e.livreur_id = u1.id
      LEFT JOIN users u2 ON e.created_by = u2.id
      WHERE e.expense_date = $1
      ORDER BY u1.username
    `;
    
    const result = await db.query(query, [expense_date]);
    return result.rows.map(row => new Expense(row));
  }

  // Obtenir toutes les dépenses pour un livreur
  static async findByLivreur(livreur_id, limit = 50, offset = 0) {
    const query = `
      SELECT e.*, 
             u1.username as livreur_username,
             u2.username as creator_username
      FROM expenses e
      LEFT JOIN users u1 ON e.livreur_id = u1.id
      LEFT JOIN users u2 ON e.created_by = u2.id
      WHERE e.livreur_id = $1
      ORDER BY e.expense_date DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await db.query(query, [livreur_id, limit, offset]);
    return result.rows.map(row => new Expense(row));
  }

  // Obtenir les dépenses par plage de dates
  static async findByDateRange(startDate, endDate) {
    const query = `
      SELECT e.*, 
             u1.username as livreur_username,
             u2.username as creator_username
      FROM expenses e
      LEFT JOIN users u1 ON e.livreur_id = u1.id
      LEFT JOIN users u2 ON e.created_by = u2.id
      WHERE e.expense_date BETWEEN $1 AND $2
      ORDER BY e.expense_date DESC, u1.username
    `;
    
    const result = await db.query(query, [startDate, endDate]);
    return result.rows.map(row => new Expense(row));
  }

  // Obtenir le récapitulatif des dépenses par livreur pour une date
  static async getSummaryByDate(expense_date) {
    const query = `
      SELECT 
        u.id as livreur_id,
        u.username as livreur,
        COALESCE(e.carburant, 0) as carburant,
        COALESCE(e.reparations, 0) as reparations,
        COALESCE(e.police, 0) as police,
        COALESCE(e.autres, 0) as autres,
        COALESCE(e.carburant, 0) + COALESCE(e.reparations, 0) + COALESCE(e.police, 0) + COALESCE(e.autres, 0) as total,
        COALESCE(e.km_parcourus, 0) as km_parcourus,
        e.commentaire,
        e.id as expense_id
      FROM users u
      LEFT JOIN expenses e ON u.id = e.livreur_id AND e.expense_date = $1
      WHERE u.role = 'LIVREUR'
      ORDER BY u.username
    `;
    
    const result = await db.query(query, [expense_date]);
    return result.rows;
  }

  // Obtenir le récapitulatif mensuel des dépenses par livreur
  static async getMonthlySummaryByDate(month) {
    const targetMonth = month || new Date().toISOString().slice(0, 7); // Format YYYY-MM
    
    const query = `
      SELECT 
        u.id as livreur_id,
        u.username as livreur,
        COALESCE(SUM(e.carburant), 0) as carburant,
        COALESCE(SUM(e.reparations), 0) as reparations,
        COALESCE(SUM(e.police), 0) as police,
        COALESCE(SUM(e.autres), 0) as autres,
        COALESCE(SUM(e.carburant), 0) + COALESCE(SUM(e.reparations), 0) + COALESCE(SUM(e.police), 0) + COALESCE(SUM(e.autres), 0) as total,
        COALESCE(SUM(e.km_parcourus), 0) as km_parcourus,
        COUNT(e.id) as jours_avec_depenses
      FROM users u
      LEFT JOIN expenses e ON u.id = e.livreur_id 
        AND TO_CHAR(e.expense_date, 'YYYY-MM') = $1
      WHERE u.role = 'LIVREUR'
      GROUP BY u.id, u.username
      ORDER BY u.username
    `;
    
    const result = await db.query(query, [targetMonth]);
    return result.rows;
  }

  // Obtenir les dépenses mensuelles par jour (pour le tableau détaillé)
  static async getMonthlyExpensesByDay(month) {
    const targetMonth = month || new Date().toISOString().slice(0, 7); // Format YYYY-MM
    
    // Créer les dates du mois en JavaScript pour compatibilité
    const year = parseInt(targetMonth.split('-')[0]);
    const monthNum = parseInt(targetMonth.split('-')[1]);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    
    // Récupérer d'abord tous les livreurs
    const livreursQuery = `
      SELECT id as livreur_id, username as livreur
      FROM users 
      WHERE role = 'LIVREUR'
      ORDER BY username
    `;
    const livreursResult = await db.query(livreursQuery);
    const livreurs = livreursResult.rows;
    
    // Récupérer les dépenses du mois
    const expensesQuery = `
      SELECT 
        e.expense_date as date,
        u.id as livreur_id,
        u.username as livreur,
        COALESCE(e.carburant, 0) as carburant,
        COALESCE(e.reparations, 0) as reparations,
        COALESCE(e.police, 0) as police,
        COALESCE(e.autres, 0) as autres,
        COALESCE(e.carburant, 0) + COALESCE(e.reparations, 0) + COALESCE(e.police, 0) + COALESCE(e.autres, 0) as total,
        COALESCE(e.km_parcourus, 0) as km_parcourus
      FROM expenses e
      JOIN users u ON e.livreur_id = u.id
      WHERE TO_CHAR(e.expense_date, 'YYYY-MM') = $1
        AND u.role = 'LIVREUR'
      ORDER BY e.expense_date, u.username
    `;
    
    const expensesResult = await db.query(expensesQuery, [targetMonth]);
    const expensesData = expensesResult.rows;
    
    // Créer un map pour accès rapide
    const expensesMap = {};
    expensesData.forEach(expense => {
      if (expense.date) {
        // Convertir la date en format YYYY-MM-DD
        const dateStr = expense.date instanceof Date ? 
          expense.date.toISOString().split('T')[0] : 
          expense.date;
        const key = `${dateStr}_${expense.livreur_id}`;
        expensesMap[key] = expense;
      }
    });
    
    // Générer toutes les combinaisons date/livreur
    const result = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${monthNum.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      
      livreurs.forEach(livreur => {
        const key = `${dateStr}_${livreur.livreur_id}`;
        const expenseData = expensesMap[key];
        
        result.push({
          date: dateStr,
          livreur_id: livreur.livreur_id,
          livreur: livreur.livreur,
          carburant: expenseData ? parseFloat(expenseData.carburant) : 0,
          reparations: expenseData ? parseFloat(expenseData.reparations) : 0,
          police: expenseData ? parseFloat(expenseData.police) : 0,
          autres: expenseData ? parseFloat(expenseData.autres) : 0,
          total: expenseData ? parseFloat(expenseData.total) : 0,
          km_parcourus: expenseData ? parseFloat(expenseData.km_parcourus) : 0
        });
      });
    }
    
    return result;
  }

  // Mettre à jour une dépense
  static async update(id, updates) {
    const allowedFields = ['carburant', 'reparations', 'police', 'autres', 'km_parcourus', 'commentaire'];
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
      UPDATE expenses 
      SET ${setClause.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Dépense non trouvée');
    }
    
    return new Expense(result.rows[0]);
  }

  // Supprimer une dépense
  static async delete(id) {
    const query = 'DELETE FROM expenses WHERE id = $1 RETURNING *';
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('Dépense non trouvée');
    }
    
    return new Expense(result.rows[0]);
  }

  // Calculer le total des dépenses
  getTotal() {
    return (parseFloat(this.carburant) || 0) + 
           (parseFloat(this.reparations) || 0) + 
           (parseFloat(this.police) || 0) + 
           (parseFloat(this.autres) || 0);
  }

  // Formater le montant pour l'affichage
  static formatAmount(amount) {
    if (!amount) return '0 FCFA';
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + ' FCFA';
  }

  // Formater la date pour l'affichage
  getFormattedDate() {
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(this.expense_date));
  }
}

module.exports = Expense; 