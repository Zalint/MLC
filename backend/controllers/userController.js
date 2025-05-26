const User = require('../models/User');

class UserController {
  // Obtenir tous les utilisateurs
  static async getAllUsers(req, res) {
    try {
      const users = await User.findAll();
      
      res.json({
        users: users.map(user => user.toJSON()),
        total: users.length
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des utilisateurs:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Obtenir un utilisateur par ID
  static async getUserById(req, res) {
    try {
      const { id } = req.params;
      
      const user = await User.findById(id);
      
      if (!user) {
        return res.status(404).json({
          error: 'Utilisateur non trouvé'
        });
      }

      res.json({
        user: user.toJSON()
      });

    } catch (error) {
      console.error('Erreur lors de la récupération de l\'utilisateur:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Obtenir les utilisateurs par rôle
  static async getUsersByRole(req, res) {
    try {
      const { role } = req.params;
      
      // Vérifier que le rôle est valide
      const validRoles = ['LIVREUR', 'MANAGER', 'ADMIN'];
      if (!validRoles.includes(role.toUpperCase())) {
        return res.status(400).json({
          error: 'Rôle invalide',
          validRoles
        });
      }

      const users = await User.findByRole(role.toUpperCase());
      
      res.json({
        users: users.map(user => user.toJSON()),
        role: role.toUpperCase(),
        total: users.length
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des utilisateurs par rôle:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Créer un nouvel utilisateur
  static async createUser(req, res) {
    try {
      const { username, password, role } = req.body;

      // Vérifier que l'utilisateur actuel a les permissions
      if (req.user.role === 'MANAGER' && role === 'ADMIN') {
        return res.status(403).json({
          error: 'Les managers ne peuvent pas créer d\'administrateurs'
        });
      }

      const newUser = await User.create({
        username,
        password,
        role
      });

      res.status(201).json({
        message: 'Utilisateur créé avec succès',
        user: newUser.toJSON()
      });

    } catch (error) {
      console.error('Erreur lors de la création de l\'utilisateur:', error);
      
      if (error.message === 'Ce nom d\'utilisateur existe déjà') {
        return res.status(409).json({
          error: error.message
        });
      }
      
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Mettre à jour un utilisateur
  static async updateUser(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Vérifier que l'utilisateur existe
      const existingUser = await User.findById(id);
      if (!existingUser) {
        return res.status(404).json({
          error: 'Utilisateur non trouvé'
        });
      }

      // Vérifications de permissions
      if (req.user.role === 'MANAGER') {
        // Les managers ne peuvent pas modifier les admins
        if (existingUser.role === 'ADMIN') {
          return res.status(403).json({
            error: 'Les managers ne peuvent pas modifier les administrateurs'
          });
        }
        
        // Les managers ne peuvent pas promouvoir quelqu'un admin
        if (updates.role === 'ADMIN') {
          return res.status(403).json({
            error: 'Les managers ne peuvent pas promouvoir quelqu\'un administrateur'
          });
        }
      }

      // Un utilisateur ne peut pas modifier son propre rôle
      if (req.user.id === id && updates.role && updates.role !== req.user.role) {
        return res.status(403).json({
          error: 'Vous ne pouvez pas modifier votre propre rôle'
        });
      }

      const updatedUser = await User.update(id, updates);

      res.json({
        message: 'Utilisateur mis à jour avec succès',
        user: updatedUser.toJSON()
      });

    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
      
      if (error.message === 'Ce nom d\'utilisateur existe déjà') {
        return res.status(409).json({
          error: error.message
        });
      }
      
      if (error.message === 'Utilisateur non trouvé') {
        return res.status(404).json({
          error: error.message
        });
      }
      
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Supprimer un utilisateur
  static async deleteUser(req, res) {
    try {
      const { id } = req.params;

      // Vérifier que l'utilisateur existe
      const existingUser = await User.findById(id);
      if (!existingUser) {
        return res.status(404).json({
          error: 'Utilisateur non trouvé'
        });
      }

      // Un utilisateur ne peut pas se supprimer lui-même
      if (req.user.id === id) {
        return res.status(403).json({
          error: 'Vous ne pouvez pas supprimer votre propre compte'
        });
      }

      // Seuls les admins peuvent supprimer des utilisateurs
      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({
          error: 'Seuls les administrateurs peuvent supprimer des utilisateurs'
        });
      }

      const deletedUser = await User.delete(id);

      res.json({
        message: 'Utilisateur supprimé avec succès',
        user: deletedUser.toJSON()
      });

    } catch (error) {
      console.error('Erreur lors de la suppression de l\'utilisateur:', error);
      
      if (error.message === 'Utilisateur non trouvé') {
        return res.status(404).json({
          error: error.message
        });
      }
      
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Réinitialiser le mot de passe d'un utilisateur (admin seulement)
  static async resetUserPassword(req, res) {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      // Seuls les admins peuvent réinitialiser les mots de passe
      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({
          error: 'Seuls les administrateurs peuvent réinitialiser les mots de passe'
        });
      }

      // Vérifier que l'utilisateur existe
      const existingUser = await User.findById(id);
      if (!existingUser) {
        return res.status(404).json({
          error: 'Utilisateur non trouvé'
        });
      }

      await User.changePassword(id, newPassword);

      res.json({
        message: 'Mot de passe réinitialisé avec succès'
      });

    } catch (error) {
      console.error('Erreur lors de la réinitialisation du mot de passe:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Obtenir les statistiques des utilisateurs
  static async getUserStats(req, res) {
    try {
      const allUsers = await User.findAll();
      
      const stats = {
        total: allUsers.length,
        byRole: {
          LIVREUR: allUsers.filter(u => u.role === 'LIVREUR').length,
          MANAGER: allUsers.filter(u => u.role === 'MANAGER').length,
          ADMIN: allUsers.filter(u => u.role === 'ADMIN').length
        },
        recentUsers: allUsers
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 5)
          .map(user => user.toJSON())
      };

      res.json(stats);

    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Obtenir tous les livreurs
  static async getAllLivreurs(req, res) {
    try {
      const livreurs = await User.findByRole('LIVREUR');
      
      res.json({
        livreurs: livreurs.map(user => user.toJSON()),
        total: livreurs.length
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des livreurs:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Obtenir les livreurs actifs seulement
  static async getActiveLivreurs(req, res) {
    try {
      const activeLivreurs = await User.findActiveLivreurs();
      
      res.json({
        livreurs: activeLivreurs.map(user => user.toJSON()),
        total: activeLivreurs.length
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des livreurs actifs:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Activer/désactiver un utilisateur
  static async toggleUserActive(req, res) {
    try {
      const { id } = req.params;

      // Vérifier que l'utilisateur existe
      const existingUser = await User.findById(id);
      if (!existingUser) {
        return res.status(404).json({
          error: 'Utilisateur non trouvé'
        });
      }

      // Vérifications de permissions
      if (req.user.role === 'MANAGER') {
        // Les managers ne peuvent pas modifier les admins
        if (existingUser.role === 'ADMIN') {
          return res.status(403).json({
            error: 'Les managers ne peuvent pas modifier les administrateurs'
          });
        }
      }

      // Un utilisateur ne peut pas se désactiver lui-même
      if (req.user.id === id) {
        return res.status(403).json({
          error: 'Vous ne pouvez pas désactiver votre propre compte'
        });
      }

      // Inverser le statut actuel
      const newActiveStatus = !existingUser.is_active;
      const updatedUser = await User.update(id, { is_active: newActiveStatus });

      res.json({
        message: `Utilisateur ${newActiveStatus ? 'activé' : 'désactivé'} avec succès`,
        user: updatedUser.toJSON()
      });

    } catch (error) {
      console.error('Erreur lors de la modification du statut:', error);
      
      if (error.message === 'Utilisateur non trouvé') {
        return res.status(404).json({
          error: error.message
        });
      }
      
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }
}

module.exports = UserController; 