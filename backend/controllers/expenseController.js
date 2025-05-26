const Expense = require('../models/Expense');
const User = require('../models/User');

class ExpenseController {
  // Obtenir les dépenses par date
  static async getExpensesByDate(req, res) {
    try {
      const { date } = req.query;
      
      if (!date) {
        return res.status(400).json({
          error: 'La date est requise'
        });
      }

      const expenses = await Expense.findByDate(date);
      
      res.json({
        success: true,
        expenses
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des dépenses:', error);
      res.status(500).json({
        error: 'Erreur lors de la récupération des dépenses'
      });
    }
  }

  // Obtenir le récapitulatif des dépenses par livreur pour une date
  static async getExpensesSummary(req, res) {
    try {
      const { date } = req.query;
      
      if (!date) {
        return res.status(400).json({
          error: 'La date est requise'
        });
      }

      const summary = await Expense.getSummaryByDate(date);
      
      res.json({
        success: true,
        summary
      });
    } catch (error) {
      console.error('Erreur lors de la récupération du récapitulatif:', error);
      res.status(500).json({
        error: 'Erreur lors de la récupération du récapitulatif'
      });
    }
  }

  // Obtenir les dépenses d'un livreur
  static async getExpensesByLivreur(req, res) {
    try {
      const { livreurId } = req.params;
      const { page = 1, limit = 20 } = req.query;
      
      const offset = (page - 1) * limit;
      const expenses = await Expense.findByLivreur(livreurId, parseInt(limit), offset);
      
      res.json({
        success: true,
        expenses,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des dépenses du livreur:', error);
      res.status(500).json({
        error: 'Erreur lors de la récupération des dépenses'
      });
    }
  }

  // Créer ou mettre à jour une dépense
  static async createOrUpdateExpense(req, res) {
    try {
      const { livreur_id, expense_date, carburant, reparations, police, autres, km_parcourus, commentaire } = req.body;
      
      // Validation des données
      if (!livreur_id || !expense_date) {
        return res.status(400).json({
          error: 'Le livreur et la date sont requis'
        });
      }

      // Vérifier que le livreur existe et est bien un livreur
      const livreur = await User.findById(livreur_id);
      if (!livreur) {
        return res.status(404).json({
          error: 'Livreur non trouvé'
        });
      }

      if (livreur.role !== 'LIVREUR') {
        return res.status(400).json({
          error: 'L\'utilisateur doit être un livreur'
        });
      }

      // Vérifier les permissions
      const currentUser = req.user;
      if (currentUser.role === 'LIVREUR' && currentUser.id !== livreur_id) {
        return res.status(403).json({
          error: 'Vous ne pouvez modifier que vos propres dépenses'
        });
      }

      const expense = await Expense.createOrUpdate({
        livreur_id,
        expense_date,
        carburant: parseFloat(carburant) || 0,
        reparations: parseFloat(reparations) || 0,
        police: parseFloat(police) || 0,
        autres: parseFloat(autres) || 0,
        km_parcourus: parseFloat(km_parcourus) || 0,
        commentaire,
        created_by: currentUser.id
      });

      res.json({
        success: true,
        message: 'Dépense enregistrée avec succès',
        expense
      });
    } catch (error) {
      console.error('Erreur lors de la création/mise à jour de la dépense:', error);
      res.status(500).json({
        error: 'Erreur lors de l\'enregistrement de la dépense'
      });
    }
  }

  // Obtenir une dépense spécifique
  static async getExpenseById(req, res) {
    try {
      const { id } = req.params;
      
      const expense = await Expense.findById(id);
      
      if (!expense) {
        return res.status(404).json({
          error: 'Dépense non trouvée'
        });
      }

      res.json({
        success: true,
        expense
      });
    } catch (error) {
      console.error('Erreur lors de la récupération de la dépense:', error);
      res.status(500).json({
        error: 'Erreur lors de la récupération de la dépense'
      });
    }
  }

  // Obtenir une dépense par livreur et date
  static async getExpenseByLivreurAndDate(req, res) {
    try {
      const { livreurId, date } = req.params;
      
      const expense = await Expense.findByLivreurAndDate(livreurId, date);
      
      if (!expense) {
        return res.json({
          success: true,
          expense: null
        });
      }

      res.json({
        success: true,
        expense
      });
    } catch (error) {
      console.error('Erreur lors de la récupération de la dépense:', error);
      res.status(500).json({
        error: 'Erreur lors de la récupération de la dépense'
      });
    }
  }

  // Mettre à jour une dépense
  static async updateExpense(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const expense = await Expense.findById(id);
      if (!expense) {
        return res.status(404).json({
          error: 'Dépense non trouvée'
        });
      }

      // Vérifier les permissions
      const currentUser = req.user;
      if (currentUser.role === 'LIVREUR' && currentUser.id !== expense.livreur_id) {
        return res.status(403).json({
          error: 'Vous ne pouvez modifier que vos propres dépenses'
        });
      }

      const updatedExpense = await Expense.update(id, updates);
      
      res.json({
        success: true,
        message: 'Dépense mise à jour avec succès',
        expense: updatedExpense
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la dépense:', error);
      res.status(500).json({
        error: 'Erreur lors de la mise à jour de la dépense'
      });
    }
  }

  // Supprimer une dépense
  static async deleteExpense(req, res) {
    try {
      const { id } = req.params;
      
      const expense = await Expense.findById(id);
      if (!expense) {
        return res.status(404).json({
          error: 'Dépense non trouvée'
        });
      }

      // Vérifier les permissions
      const currentUser = req.user;
      if (currentUser.role === 'LIVREUR' && currentUser.id !== expense.livreur_id) {
        return res.status(403).json({
          error: 'Vous ne pouvez supprimer que vos propres dépenses'
        });
      }

      await Expense.delete(id);
      
      res.json({
        success: true,
        message: 'Dépense supprimée avec succès'
      });
    } catch (error) {
      console.error('Erreur lors de la suppression de la dépense:', error);
      res.status(500).json({
        error: 'Erreur lors de la suppression de la dépense'
      });
    }
  }

  // Obtenir les dépenses par plage de dates
  static async getExpensesByDateRange(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          error: 'Les dates de début et de fin sont requises'
        });
      }

      const expenses = await Expense.findByDateRange(startDate, endDate);
      
      res.json({
        success: true,
        expenses
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des dépenses:', error);
      res.status(500).json({
        error: 'Erreur lors de la récupération des dépenses'
      });
    }
  }
}

module.exports = ExpenseController; 