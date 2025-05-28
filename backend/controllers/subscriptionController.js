const Subscription = require('../models/Subscription');
const Order = require('../models/Order');

class SubscriptionController {
  // Créer une nouvelle carte d'abonnement
  static async createSubscription(req, res) {
    try {
      const { client_name, phone_number, total_deliveries, expiry_months, address, price } = req.body;
      const created_by = req.user.id;

      const subscription = await Subscription.create({
        client_name,
        phone_number,
        total_deliveries,
        created_by,
        expiry_months,
        address,
        price
      });

      res.status(201).json({
        success: true,
        message: 'Carte d\'abonnement créée avec succès',
        subscription
      });
    } catch (error) {
      console.error('Erreur lors de la création de la carte:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la création de la carte d\'abonnement',
        error: error.message
      });
    }
  }

  // Obtenir toutes les cartes d'abonnement
  static async getAllSubscriptions(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      const subscriptions = await Subscription.findAll(limit, offset);
      const stats = await Subscription.getStats();

      res.json({
        success: true,
        subscriptions,
        stats,
        pagination: {
          page,
          limit,
          hasMore: subscriptions.length === limit
        }
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des cartes:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des cartes d\'abonnement',
        error: error.message
      });
    }
  }

  // Obtenir une carte par ID
  static async getSubscriptionById(req, res) {
    try {
      const { id } = req.params;
      const subscription = await Subscription.findById(id);

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'Carte d\'abonnement non trouvée'
        });
      }

      res.json({
        success: true,
        subscription
      });
    } catch (error) {
      console.error('Erreur lors de la récupération de la carte:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de la carte',
        error: error.message
      });
    }
  }

  // Obtenir une carte par numéro
  static async getSubscriptionByCardNumber(req, res) {
    try {
      const { cardNumber } = req.params;
      const subscription = await Subscription.findByCardNumber(cardNumber);

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'Carte d\'abonnement non trouvée'
        });
      }

      res.json({
        success: true,
        subscription
      });
    } catch (error) {
      console.error('Erreur lors de la récupération de la carte:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de la carte',
        error: error.message
      });
    }
  }

  // Obtenir les cartes d'un client par téléphone
  static async getSubscriptionsByPhone(req, res) {
    try {
      const { phoneNumber } = req.params;
      const activeOnly = req.query.active === 'true';

      let subscriptions;
      if (activeOnly) {
        subscriptions = await Subscription.findActiveByPhoneNumber(phoneNumber);
      } else {
        subscriptions = await Subscription.findByPhoneNumber(phoneNumber);
      }

      res.json({
        success: true,
        subscriptions,
        count: subscriptions.length
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des cartes:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des cartes du client',
        error: error.message
      });
    }
  }

  // Utiliser une livraison (lors de la création d'une commande MLC)
  static async useDelivery(req, res) {
    try {
      const { cardId } = req.params;
      const subscription = await Subscription.useDelivery(cardId);

      res.json({
        success: true,
        message: 'Livraison utilisée avec succès',
        subscription
      });
    } catch (error) {
      console.error('Erreur lors de l\'utilisation de la livraison:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Créer une commande MLC avec déduction automatique
  static async createMLCOrderWithSubscription(req, res) {
    try {
      const { client_name, phone_number, address, description, course_price, card_number } = req.body;
      const created_by = req.user.id;

      // Vérifier si une carte est spécifiée
      let subscription = null;
      if (card_number) {
        subscription = await Subscription.findByCardNumber(card_number);
        if (!subscription || !subscription.isUsable()) {
          return res.status(400).json({
            success: false,
            message: 'Carte d\'abonnement non valide ou expirée'
          });
        }
      } else {
        // Chercher une carte active pour ce client
        const activeSubscriptions = await Subscription.findActiveByPhoneNumber(phone_number);
        if (activeSubscriptions.length > 0) {
          subscription = activeSubscriptions[0]; // Utiliser la plus ancienne
        }
      }

      // Créer la commande
      const order = await Order.create({
        client_name,
        phone_number,
        address,
        description,
        amount: null, // MLC n'a pas de montant panier
        course_price: course_price || 0,
        order_type: 'MLC',
        created_by,
        subscription_id: subscription ? subscription.id : null
      });

      // Si une carte est trouvée, utiliser une livraison
      if (subscription) {
        try {
          const updatedSubscription = await Subscription.useDelivery(subscription.id);
          
          res.status(201).json({
            success: true,
            message: 'Commande MLC créée et livraison déduite de la carte',
            order,
            subscription: updatedSubscription,
            subscription_used: true
          });
        } catch (subscriptionError) {
          // Si l'utilisation de la carte échoue, la commande reste créée
          res.status(201).json({
            success: true,
            message: 'Commande MLC créée mais erreur lors de la déduction de la carte',
            order,
            subscription_error: subscriptionError.message,
            subscription_used: false
          });
        }
      } else {
        res.status(201).json({
          success: true,
          message: 'Commande MLC créée (aucune carte d\'abonnement trouvée)',
          order,
          subscription_used: false
        });
      }
    } catch (error) {
      console.error('Erreur lors de la création de la commande MLC:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la création de la commande MLC',
        error: error.message
      });
    }
  }

  // Rechercher des cartes
  static async searchSubscriptions(req, res) {
    try {
      const { q } = req.query;
      if (!q || q.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Le terme de recherche doit contenir au moins 2 caractères'
        });
      }

      const subscriptions = await Subscription.search(q.trim());

      res.json({
        success: true,
        subscriptions,
        count: subscriptions.length
      });
    } catch (error) {
      console.error('Erreur lors de la recherche:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la recherche',
        error: error.message
      });
    }
  }

  // Obtenir les statistiques des abonnements
  static async getSubscriptionStats(req, res) {
    try {
      const stats = await Subscription.getStats();
      const expiringSoon = await Subscription.getExpiringSoon(30);

      res.json({
        success: true,
        stats,
        expiring_soon: expiringSoon,
        expiring_count: expiringSoon.length
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques',
        error: error.message
      });
    }
  }

  // Obtenir les cartes qui expirent bientôt
  static async getExpiringSoon(req, res) {
    try {
      const days = parseInt(req.query.days) || 30;
      const subscriptions = await Subscription.getExpiringSoon(days);
      
      res.json({
        success: true,
        subscriptions,
        expiring_count: subscriptions.length
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des cartes:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des cartes',
        error: error.message
      });
    }
  }

  // Obtenir les cartes actives
  static async getActiveSubscriptions(req, res) {
    try {
      const subscriptions = await Subscription.findActive();
      
      res.json({
        success: true,
        subscriptions
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des cartes actives:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des cartes actives',
        error: error.message
      });
    }
  }

  // Mettre à jour une carte
  static async updateSubscription(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;
      // If ADMIN, set modified_by
      if (req.user && req.user.role === 'ADMIN') {
        updates.modified_by = req.user.id;
      }
      const subscription = await Subscription.update(id, updates);
      res.json({
        success: true,
        message: 'Carte d\'abonnement mise à jour avec succès',
        subscription
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour de la carte',
        error: error.message
      });
    }
  }

  // Désactiver une carte
  static async deactivateSubscription(req, res) {
    try {
      const { id } = req.params;
      const subscription = await Subscription.deactivate(id);

      res.json({
        success: true,
        message: 'Carte d\'abonnement désactivée avec succès',
        subscription
      });
    } catch (error) {
      console.error('Erreur lors de la désactivation:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la désactivation de la carte',
        error: error.message
      });
    }
  }

  // Réactiver une carte
  static async reactivateSubscription(req, res) {
    try {
      const { id } = req.params;
      const subscription = await Subscription.reactivate(id);

      res.json({
        success: true,
        message: 'Carte d\'abonnement réactivée avec succès',
        subscription
      });
    } catch (error) {
      console.error('Erreur lors de la réactivation:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Vérifier la validité d'une carte
  static async checkCardValidity(req, res) {
    try {
      const { cardNumber } = req.params;
      const subscription = await Subscription.findByCardNumber(cardNumber);

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'Carte non trouvée',
          valid: false
        });
      }

      const isValid = subscription.isUsable();
      const status = subscription.getStatus();

      res.json({
        success: true,
        valid: isValid,
        status,
        subscription: {
          id: subscription.id,
          card_number: subscription.card_number,
          client_name: subscription.client_name,
          remaining_deliveries: subscription.remaining_deliveries,
          expiry_date: subscription.expiry_date
        }
      });
    } catch (error) {
      console.error('Erreur lors de la vérification:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification de la carte',
        error: error.message
      });
    }
  }
}

module.exports = SubscriptionController; 