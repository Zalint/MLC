const Order = require('../models/Order');
const Expense = require('../models/Expense');
const ExcelJS = require('exceljs');

class OrderController {
  // Créer une nouvelle commande
  static async createOrder(req, res) {
    try {
      const { client_name, phone_number, adresse_source, adresse_destination, point_de_vente, address, description, amount, course_price, order_type, created_by } = req.body;
      
      // Déterminer qui est le créateur de la commande
      let actualCreatedBy = req.user.id; // Par défaut, l'utilisateur connecté
      
      // Si l'utilisateur est manager/admin, il DOIT spécifier un livreur
      if (req.user.role === 'MANAGER' || req.user.role === 'ADMIN') {
        if (!created_by) {
          return res.status(400).json({
            error: 'Vous devez sélectionner un livreur pour cette commande'
          });
        }
        
        // Vérifier que le livreur spécifié existe et est bien un livreur actif
        const User = require('../models/User');
        const targetUser = await User.findById(created_by);
        
        if (!targetUser) {
          return res.status(400).json({
            error: 'Le livreur sélectionné n\'existe pas'
          });
        }
        
        if (targetUser.role !== 'LIVREUR') {
          return res.status(400).json({
            error: 'L\'utilisateur sélectionné n\'est pas un livreur'
          });
        }
        
        if (!targetUser.is_active) {
          return res.status(400).json({
            error: 'Le livreur sélectionné n\'est pas actif'
          });
        }
        
        actualCreatedBy = created_by; // Assigner la commande au livreur sélectionné
      }
      // Pour les livreurs, ils créent leurs propres commandes
      else if (req.user.role === 'LIVREUR') {
        actualCreatedBy = req.user.id;
      }

      const newOrder = await Order.create({
        client_name,
        phone_number,
        adresse_source,
        adresse_destination,
        point_de_vente,
        address,
        description,
        amount,
        course_price,
        order_type,
        created_by: actualCreatedBy
      });

      res.status(201).json({
        message: 'Commande créée avec succès',
        order: newOrder
      });

    } catch (error) {
      console.error('Erreur lors de la création de la commande:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Obtenir toutes les commandes (avec pagination)
  static async getAllOrders(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const offset = (page - 1) * limit;

      console.log('🔍 getAllOrders - User Details:', {
        id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        is_active: req.user.is_active,
        isManagerOrAdmin: req.user.isManagerOrAdmin(),
        userObjectType: typeof req.user,
        userConstructor: req.user.constructor.name
      });

      let orders;
      
      // Si l'utilisateur n'est pas manager/admin, ne montrer que ses commandes
      if (!req.user.isManagerOrAdmin()) {
        console.log('🔒 Filtering orders for non-manager user:', req.user.username, 'with ID:', req.user.id);
        orders = await Order.findByUser(req.user.id, limit, offset);
        console.log('🔒 Found', orders.length, 'orders for user', req.user.username);
      } else {
        console.log('👑 Showing all orders for manager/admin:', req.user.username);
        orders = await Order.findAll(limit, offset);
        console.log('👑 Found', orders.length, 'total orders in system');
      }

      const total = !req.user.isManagerOrAdmin() 
        ? await Order.countByUser(req.user.id)
        : await Order.count();

      console.log('📊 Orders result:', {
        totalOrders: orders.length,
        totalInDB: total,
        userRole: req.user.role,
        isManagerOrAdmin: req.user.isManagerOrAdmin(),
        environment: process.env.NODE_ENV || 'development'
      });

      // Additional debugging: log first few orders to see who created them
      if (orders.length > 0) {
        console.log('📋 Sample orders (first 3):', orders.slice(0, 3).map(order => ({
          id: order.id,
          client_name: order.client_name,
          created_by: order.created_by,
          creator_username: order.creator_username,
          created_at: order.created_at
        })));
      }

      res.json({
        orders: orders.map(order => ({
          ...order,
          is_subscription: !!order.subscription_id
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des commandes:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Obtenir une commande par ID
  static async getOrderById(req, res) {
    try {
      const { id } = req.params;
      
      const order = await Order.findById(id);
      
      if (!order) {
        return res.status(404).json({
          error: 'Commande non trouvée'
        });
      }

      // Vérifier les permissions
      if (!req.user.isManagerOrAdmin() && order.created_by !== req.user.id) {
        return res.status(403).json({
          error: 'Accès non autorisé à cette commande'
        });
      }

      res.json({
        order: order ? { ...order, is_subscription: !!order.subscription_id } : null
      });

    } catch (error) {
      console.error('Erreur lors de la récupération de la commande:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Obtenir les dernières commandes d'un utilisateur
  static async getLastUserOrders(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 5;
      const userId = req.user.id;

      const orders = await Order.findLastByUser(userId, limit);

      res.json({
        orders: orders.map(order => ({
          ...order,
          is_subscription: !!order.subscription_id
        })),
        total: orders.length
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des dernières commandes:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Obtenir les commandes par date
  static async getOrdersByDate(req, res) {
    try {
      const date = req.query.date || new Date().toISOString().split('T')[0];
      
      let orders;
      
      // Si l'utilisateur n'est pas manager/admin, filtrer par ses commandes
      if (!req.user.isManagerOrAdmin()) {
        const allUserOrders = await Order.findByUser(req.user.id);
        orders = allUserOrders.filter(order => 
          order.created_at.toISOString().split('T')[0] === date
        );
      } else {
        orders = await Order.findByDate(date);
      }

      res.json({
        orders: orders.map(order => ({
          ...order,
          is_subscription: !!order.subscription_id
        })),
        date,
        total: orders.length
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des commandes par date:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Obtenir le récapitulatif des commandes du jour par livreur (pour managers)
  static async getTodayOrdersSummary(req, res) {
    try {
      const date = req.query.date || new Date().toISOString().split('T')[0];
      
      const summary = await Order.getTodayOrdersByUser(date);
      const expensesSummary = await Expense.getSummaryByDate(date);
      
      // Ajouter les statistiques par type de commande
      const statsByType = await Order.getStatsByType(date, date);

      // Récupérer les statistiques par type pour chaque livreur
      const statsByTypeByUser = await Order.getStatsByTypeByUserAndDateAll(date);

      // Créer un map des dépenses et kilomètres par livreur pour faciliter la jointure
      const expensesMap = {};
      const kmMap = {};
      expensesSummary.forEach(expense => {
        expensesMap[expense.livreur] = expense.total || 0;
        kmMap[expense.livreur] = expense.km_parcourus || 0;
      });

      // Créer un map des stats par type par livreur
      const statsByTypeMap = {};
      statsByTypeByUser.forEach(stat => {
        if (!statsByTypeMap[stat.livreur]) {
          statsByTypeMap[stat.livreur] = {};
        }
        statsByTypeMap[stat.livreur][stat.order_type] = {
          count: stat.count,
          total_amount: stat.total_amount
        };
      });

      // Ajouter les dépenses totales et kilomètres à chaque livreur dans le récapitulatif
      const enrichedSummary = summary.map(item => ({
        ...item,
        total_depenses: expensesMap[item.livreur] || 0,
        km_parcourus: kmMap[item.livreur] || 0,
        statsByType: statsByTypeMap[item.livreur] || {}
      }));

      res.json({
        summary: enrichedSummary,
        statsByType,
        date,
        total_livreurs: summary.length,
        total_commandes: summary.reduce((sum, item) => sum + parseInt(item.nombre_commandes), 0),
        total_montant: summary.reduce((sum, item) => sum + parseFloat(item.total_montant || 0), 0),
        total_depenses: expensesSummary.reduce((sum, item) => sum + parseFloat(item.total || 0), 0)
      });

    } catch (error) {
      console.error('Erreur lors de la récupération du récapitulatif:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Obtenir le récapitulatif mensuel des commandes par livreur (pour managers)
  static async getMonthlyOrdersSummary(req, res) {
    try {
      const month = req.query.month || new Date().toISOString().slice(0, 7); // Format YYYY-MM
      
      console.log('🔍 getMonthlyOrdersSummary - month:', month);

      // Récupérer les données détaillées par jour
      const dailyData = await Order.getMonthlyDetailsByDay(month);
      const dailyExpenses = await Expense.getMonthlyExpensesByDay(month);

      // Calculer les totaux pour les statistiques
      const summary = await Order.getMonthlyOrdersByUser(month);
      const expensesSummary = await Expense.getMonthlySummaryByDate(month);

      // Calculer les dates de début et fin du mois
      const startDate = `${month}-01`;
      const year = parseInt(month.split('-')[0]);
      const monthNum = parseInt(month.split('-')[1]);
      const lastDay = new Date(year, monthNum, 0).getDate();
      const endDate = `${month}-${lastDay.toString().padStart(2, '0')}`;

      // Récupérer les statistiques par type pour le mois entier
      const monthlyStatsByType = await Order.getStatsByType(startDate, endDate);

      // Récupérer les statistiques par type pour chaque livreur
      const statsByTypeByUser = await Order.getStatsByTypeByUser(month);

      console.log('🔍 statsByTypeByUser data:', statsByTypeByUser.slice(0, 5)); // Log des 5 premiers résultats

      // Créer un map des dépenses et kilomètres par livreur pour faciliter la jointure
      const expensesMap = {};
      const kmMap = {};
      expensesSummary.forEach(expense => {
        expensesMap[expense.livreur] = expense.total || 0;
        kmMap[expense.livreur] = expense.km_parcourus || 0;
      });

      // Créer un map des stats par type par livreur
      const statsByTypeMap = {};
      statsByTypeByUser.forEach(stat => {
        if (!statsByTypeMap[stat.livreur]) {
          statsByTypeMap[stat.livreur] = {};
        }
        statsByTypeMap[stat.livreur][stat.order_type] = {
          count: stat.count,
          total_amount: stat.total_amount
        };
      });

      console.log('🔍 statsByTypeMap constructed:', statsByTypeMap);

      // Ajouter les dépenses totales et kilomètres à chaque livreur dans le récapitulatif
      const enrichedSummary = summary.map(item => ({
        ...item,
        total_depenses: expensesMap[item.livreur] || 0,
        km_parcourus: kmMap[item.livreur] || 0,
        statsByType: statsByTypeMap[item.livreur] || {}
      }));

      res.json({
        summary: enrichedSummary,
        dailyData,
        dailyExpenses,
        monthlyStatsByType,
        month,
        total_livreurs: summary.length,
        total_commandes: summary.reduce((sum, item) => sum + parseInt(item.nombre_commandes), 0),
        total_montant: summary.reduce((sum, item) => sum + parseFloat(item.total_montant || 0), 0),
        total_depenses: expensesSummary.reduce((sum, item) => sum + parseFloat(item.total || 0), 0)
      });

    } catch (error) {
      console.error('Erreur lors de la récupération du récapitulatif mensuel:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Mettre à jour une commande
  static async updateOrder(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Vérifier que la commande existe
      const existingOrder = await Order.findById(id);
      if (!existingOrder) {
        return res.status(404).json({
          error: 'Commande non trouvée'
        });
      }

      // Vérifier les permissions
      if (!req.user.isManagerOrAdmin() && existingOrder.created_by !== req.user.id) {
        return res.status(403).json({
          error: 'Vous ne pouvez modifier que vos propres commandes'
        });
      }

      const updatedOrder = await Order.update(id, updates);

      res.json({
        message: 'Commande mise à jour avec succès',
        order: updatedOrder
      });

    } catch (error) {
      console.error('Erreur lors de la mise à jour de la commande:', error);
      
      if (error.message === 'Commande non trouvée') {
        return res.status(404).json({
          error: error.message
        });
      }
      
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Supprimer une commande
  static async deleteOrder(req, res) {
    try {
      const { id } = req.params;
      console.log(`[DELETE] Attempting to delete order with id: ${id}`);

      // Vérifier que la commande existe
      const existingOrder = await Order.findById(id);
      if (!existingOrder) {
        console.warn(`[DELETE] Order not found: ${id}`);
        return res.status(404).json({
          error: 'Commande non trouvée'
        });
      }

      // Vérifications de permissions selon le rôle
      if (!req.user.isManagerOrAdmin()) {
        if (existingOrder.created_by !== req.user.id) {
          console.warn(`[DELETE] User ${req.user.username} not allowed to delete order ${id}`);
          return res.status(403).json({
            error: 'Vous ne pouvez supprimer que vos propres commandes'
          });
        }
        const isToday = await Order.isCreatedToday(id);
        if (!isToday) {
          console.warn(`[DELETE] User ${req.user.username} tried to delete non-today order ${id}`);
          return res.status(403).json({
            error: 'Vous ne pouvez supprimer que vos commandes du jour'
          });
        }
      } else if (req.user.role === 'MANAGER') {
        const isToday = await Order.isCreatedToday(id);
        if (!isToday) {
          console.warn(`[DELETE] Manager tried to delete non-today order ${id}`);
          return res.status(403).json({
            error: 'Vous ne pouvez supprimer que les commandes du jour'
          });
        }
      }

      // Les admins et utilisateurs spéciaux (SALIOU, OUSMANE) peuvent tout supprimer
      let deletedOrder;
      try {
        deletedOrder = await Order.delete(id);
        console.log(`[DELETE] Order deleted: ${id}`);
      } catch (dbError) {
        console.error(`[DELETE] DB error when deleting order ${id}:`, dbError);
        if (dbError.message && dbError.message.includes('violates foreign key constraint')) {
          return res.status(409).json({
            error: 'Impossible de supprimer la commande à cause de dépendances en base de données.'
          });
        }
        return res.status(500).json({
          error: dbError.message || 'Erreur lors de la suppression en base de données.'
        });
      }

      // Si la commande était liée à un abonnement, restaurer une livraison
      if (deletedOrder.subscription_id) {
        try {
          const Subscription = require('../models/Subscription');
          await Subscription.restoreDelivery(deletedOrder.subscription_id);
          console.log(`[DELETE] Subscription delivery restored for card: ${deletedOrder.subscription_id}`);
        } catch (restoreError) {
          console.error('Erreur lors de la restauration de la livraison abonnement:', restoreError);
        }
      }

      res.json({
        message: 'Commande supprimée avec succès',
        order: deletedOrder
      });
    } catch (error) {
      console.error('Erreur lors de la suppression de la commande:', error);
      if (error.message === 'Commande non trouvée') {
        return res.status(404).json({
          error: error.message
        });
      }
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Supprimer toutes les commandes d'un utilisateur pour une date (livreurs)
  static async deleteUserOrdersForDate(req, res) {
    try {
      const date = req.query.date || new Date().toISOString().split('T')[0];
      const userId = req.user.id;

      // Seuls les non-managers peuvent utiliser cette fonction pour leurs propres commandes
      if (req.user.isManagerOrAdmin()) {
        return res.status(403).json({
          error: 'Cette fonction est réservée aux livreurs'
        });
      }

      const deletedOrders = await Order.deleteUserOrdersForDate(userId, date);

      res.json({
        message: `${deletedOrders.length} commande(s) supprimée(s) pour le ${date}`,
        deletedOrders,
        date
      });

    } catch (error) {
      console.error('Erreur lors de la suppression des commandes:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Exporter les commandes en Excel
  static async exportToExcel(req, res) {
    try {
      const { startDate, endDate } = req.query;

      // Récupérer les commandes pour la plage de dates
      const orders = await Order.findByDateRange(startDate, endDate);

      // Créer un nouveau classeur Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Commandes');

      // Définir les colonnes
      worksheet.columns = [
        { header: 'ID', key: 'id', width: 36 },
        { header: 'Date/Heure', key: 'created_at', width: 20 },
        { header: 'Livreur', key: 'creator_username', width: 15 },
        { header: 'Client', key: 'client_name', width: 25 },
        { header: 'Téléphone', key: 'phone_number', width: 15 },
        { header: 'Adresse', key: 'address', width: 40 },
        { header: 'Description', key: 'description', width: 50 },
        { header: 'Prix de la course (FCFA)', key: 'course_price', width: 18 },
        { header: 'Montant du panier (FCFA)', key: 'amount', width: 20 },
        { header: 'Type', key: 'order_type', width: 10 }
      ];

      // Styliser l'en-tête
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF009E60' } // Vert de la charte
      };
      worksheet.getRow(1).font.color = { argb: 'FFFFFFFF' };

      // Ajouter les données
      orders.forEach(order => {
        worksheet.addRow({
          id: order.id,
          created_at: new Date(order.created_at).toLocaleString('fr-FR'),
          creator_username: order.creator_username || 'N/A',
          client_name: order.client_name,
          phone_number: order.phone_number,
          address: order.address || '',
          description: order.description || '',
          course_price: order.course_price || 0,
          amount: order.amount || '',
          order_type: order.order_type
        });
      });

      // Ajouter des bordures
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });

      // Ajouter une ligne de total
      const totalRow = worksheet.addRow({
        id: '',
        created_at: '',
        creator_username: '',
        client_name: '',
        phone_number: '',
        address: '',
        description: 'TOTAL',
        course_price: orders.reduce((sum, order) => sum + (parseFloat(order.course_price) || 0), 0),
        amount: '',
        order_type: `${orders.length} commandes`
      });
      
      totalRow.font = { bold: true };
      totalRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0F0F0' }
      };

      // Définir les en-têtes de réponse
      const filename = `commandes_${startDate}_${endDate}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Écrire le fichier dans la réponse
      await workbook.xlsx.write(res);
      res.end();

    } catch (error) {
      console.error('Erreur lors de l\'export Excel:', error);
      res.status(500).json({
        error: 'Erreur lors de l\'export Excel'
      });
    }
  }

  // DEBUG: Endpoint temporaire pour diagnostiquer les problèmes de rôles
  static async debugUserRole(req, res) {
    try {
      console.log('🔍 DEBUG: User role debugging endpoint called');
      
      const debugInfo = {
        user: {
          id: req.user.id,
          username: req.user.username,
          role: req.user.role,
          roleType: typeof req.user.role,
          is_active: req.user.is_active,
          constructor: req.user.constructor.name
        },
        methods: {
          hasIsManagerOrAdmin: typeof req.user.isManagerOrAdmin === 'function',
          isManagerOrAdminResult: req.user.isManagerOrAdmin ? req.user.isManagerOrAdmin() : 'method not available',
          hasRole: typeof req.user.hasRole === 'function',
          isAdmin: typeof req.user.isAdmin === 'function'
        },
        environment: {
          nodeEnv: process.env.NODE_ENV,
          platform: process.platform
        },
        roleChecks: {
          isManager: req.user.role === 'MANAGER',
          isAdmin: req.user.role === 'ADMIN',
          isLivreur: req.user.role === 'LIVREUR',
          manualManagerOrAdmin: req.user.role === 'MANAGER' || req.user.role === 'ADMIN'
        }
      };

      console.log('🔍 DEBUG Info:', debugInfo);
      
      res.json({
        message: 'Debug information for user role',
        debug: debugInfo
      });

    } catch (error) {
      console.error('🚨 DEBUG endpoint error:', error);
      res.status(500).json({
        error: 'Debug endpoint error',
        details: error.message
      });
    }
  }

  // Obtenir les statistiques des commandes
  static async getOrderStats(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate || new Date().toISOString().split('T')[0];
      const end = endDate || start;

      const orders = await Order.findByDateRange(start, end);
      const statsByType = await Order.getStatsByType(start, end);

      const stats = {
        period: { startDate: start, endDate: end },
        total_orders: orders.length,
        total_amount: orders.reduce((sum, order) => sum + (parseFloat(order.course_price) || 0), 0),
        by_type: statsByType,
        by_user: {}
      };

      // Grouper par utilisateur
      orders.forEach(order => {
        const username = order.creator_username || 'Inconnu';
        if (!stats.by_user[username]) {
          stats.by_user[username] = {
            count: 0,
            total_amount: 0
          };
        }
        stats.by_user[username].count++;
        stats.by_user[username].total_amount += parseFloat(order.course_price) || 0;
      });

      res.json(stats);

    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Obtenir les détails des courses d'un livreur pour une date donnée
  static async getLivreurOrderDetails(req, res) {
    try {
      const { livreurId } = req.params;
      const date = req.query.date || new Date().toISOString().split('T')[0];

      console.log('🔍 getLivreurOrderDetails - livreurId:', livreurId, 'date:', date);

      // Récupérer les commandes du livreur pour la date
      const orders = await Order.findByUserAndDate(livreurId, date);

      // Récupérer les informations du livreur
      const User = require('../models/User');
      const livreur = await User.findById(livreurId);

      if (!livreur) {
        return res.status(404).json({
          error: 'Livreur non trouvé'
        });
      }

      // Calculer les totaux
      const totalCourses = orders.reduce((sum, order) => sum + (parseFloat(order.course_price) || 0), 0);
      const totalPanier = orders.reduce((sum, order) => sum + (parseFloat(order.amount) || 0), 0);

      res.json({
        livreur: {
          id: livreur.id,
          username: livreur.username
        },
        date,
        orders,
        summary: {
          total_orders: orders.length,
          total_courses: totalCourses,
          total_panier: totalPanier,
          total_general: totalCourses + totalPanier
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des détails du livreur:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Exporter les détails des courses d'un livreur en Excel
  static async exportLivreurDetailsToExcel(req, res) {
    try {
      const { livreurId } = req.params;
      const date = req.query.date || new Date().toISOString().split('T')[0];

      // Récupérer les commandes du livreur pour la date
      const orders = await Order.findByUserAndDate(livreurId, date);

      // Récupérer les informations du livreur
      const User = require('../models/User');
      const livreur = await User.findById(livreurId);

      if (!livreur) {
        return res.status(404).json({
          error: 'Livreur non trouvé'
        });
      }

      // Créer un nouveau classeur Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(`Détails ${livreur.username}`);

      // Ajouter le titre
      worksheet.mergeCells('A1:M1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `Détails des courses - ${livreur.username} - ${new Date(date).toLocaleDateString('fr-FR')}`;
      titleCell.font = { bold: true, size: 16 };
      titleCell.alignment = { horizontal: 'center' };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF009E60' }
      };
      titleCell.font.color = { argb: 'FFFFFFFF' };

      // Ajouter une ligne vide
      worksheet.addRow([]);

      // Définir les colonnes
      worksheet.columns = [
        { header: 'Heure', key: 'time', width: 12 },
        { header: 'Client', key: 'client_name', width: 25 },
        { header: 'Téléphone', key: 'phone_number', width: 15 },
        { header: 'Adresse', key: 'address', width: 40 },
        { header: 'Description', key: 'description', width: 50 },
        { header: 'Type', key: 'order_type', width: 10 },
        { header: 'Prix course (FCFA)', key: 'course_price', width: 18 },
        { header: 'Montant panier (FCFA)', key: 'amount', width: 20 }
      ];

      // Styliser l'en-tête
      const headerRow = worksheet.getRow(3);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0F0F0' }
      };

      // Ajouter les données
      orders.forEach(order => {
        worksheet.addRow({
          time: new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          client_name: order.client_name,
          phone_number: order.phone_number,
          address: order.address || '',
          description: order.description || '',
          order_type: order.order_type,
          course_price: order.course_price || 0,
          amount: order.amount || ''
        });
      });

      // Ajouter des bordures
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber >= 3) { // Commencer après le titre
          row.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
          });
        }
      });

      // Ajouter une ligne de total
      const totalCourses = orders.reduce((sum, order) => sum + (parseFloat(order.course_price) || 0), 0);
      const totalPanier = orders.reduce((sum, order) => sum + (parseFloat(order.amount) || 0), 0);

      const totalRow = worksheet.addRow({
        time: '',
        client_name: '',
        phone_number: '',
        address: '',
        description: 'TOTAL',
        order_type: `${orders.length} courses`,
        course_price: totalCourses,
        amount: totalPanier
      });
      
      totalRow.font = { bold: true };
      totalRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFF00' }
      };

      // Définir les en-têtes de réponse
      const filename = `details_${livreur.username}_${date}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Écrire le fichier dans la réponse
      await workbook.xlsx.write(res);
      res.end();

    } catch (error) {
      console.error('Erreur lors de l\'export Excel des détails:', error);
      res.status(500).json({
        error: 'Erreur lors de l\'export Excel'
      });
    }
  }

  // Exporter le récapitulatif mensuel en Excel
  static async exportMonthlyToExcel(req, res) {
    try {
      const month = req.query.month || new Date().toISOString().slice(0, 7);
      
      // Récupérer les données détaillées
      const dailyData = await Order.getMonthlyDetailsByDay(month);
      const dailyExpenses = await Expense.getMonthlyExpensesByDay(month);

      // Créer un nouveau classeur Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Récapitulatif Mensuel');

      // Obtenir la liste des livreurs et des dates
      const livreurs = [...new Set(dailyData.map(item => item.livreur))].sort();
      const dates = [...new Set(dailyData.map(item => item.date))].sort();

      // Créer les en-têtes (structure verticale)
      const columnHeaders = [
        'Date', 'Livreur', 'Commandes', 'Courses (FCFA)', 
        'Carburant', 'Réparations', 'Police', 'Autres', 
        'Total Dépenses', 'Km', 'Bénéfice (FCFA)'
      ];

      // Ajouter le titre
      worksheet.mergeCells('A1:M1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `Récapitulatif Mensuel - ${month}`;
      titleCell.font = { bold: true, size: 16 };
      titleCell.alignment = { horizontal: 'center' };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF009E60' }
      };
      titleCell.font.color = { argb: 'FFFFFFFF' };

      // Ajouter une ligne vide
      worksheet.addRow([]);

      // Définir et ajouter explicitement les en-têtes
      const mataHeaders = [
        'Date',
        'Numéro de téléphone', 
        'Nom',
        'Adresse source',
        'Adresse destination',
        'Point de vente',
        'Montant commande (FCFA)',
        'Livreur',
        'Commentaire',
        'Service livraison',
        'Qualité produits', 
        'Niveau prix',
        'Note moyenne'
      ];
      
      const headerRow = worksheet.addRow(mataHeaders);
      
      // Styliser l'en-tête
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF009E60' }
      };

      // Définir les largeurs des colonnes
      worksheet.columns = [
        { width: 12 },  // Date
        { width: 18 },  // Numéro de téléphone
        { width: 25 },  // Nom
        { width: 30 },  // Adresse source
        { width: 30 },  // Adresse destination
        { width: 20 },  // Point de vente
        { width: 20 },  // Montant commande (FCFA)
        { width: 15 },  // Livreur
        { width: 50 },  // Commentaire
        { width: 15 },  // Service livraison
        { width: 15 },  // Qualité produits
        { width: 15 },  // Niveau prix
        { width: 15 }   // Note moyenne
      ];

      // Créer des maps pour un accès rapide aux données
      const ordersMap = {};
      const expensesMap = {};

      dailyData.forEach(item => {
        const key = `${item.date}_${item.livreur}`;
        ordersMap[key] = item;
      });

      dailyExpenses.forEach(item => {
        const key = `${item.date}_${item.livreur}`;
        expensesMap[key] = item;
      });

      // Ajouter les données (une ligne par date/livreur)
      dates.forEach(date => {
        livreurs.forEach(livreur => {
          const orderKey = `${date}_${livreur}`;
          const expenseKey = `${date}_${livreur}`;
          
          const orderData = ordersMap[orderKey] || { nombre_commandes: 0, total_montant: 0 };
          const expenseData = expensesMap[expenseKey] || { carburant: 0, reparations: 0, police: 0, autres: 0, km_parcourus: 0 };
          const totalDepenses = (expenseData.carburant || 0) + (expenseData.reparations || 0) + (expenseData.police || 0) + (expenseData.autres || 0);
          const benefice = (orderData.total_montant || 0) - totalDepenses;
          
          const row = [
            new Date(date).toLocaleDateString('fr-FR'),
            livreur,
            orderData.nombre_commandes || 0,
            orderData.total_montant || 0,
            expenseData.carburant || 0,
            expenseData.reparations || 0,
            expenseData.police || 0,
            expenseData.autres || 0,
            totalDepenses,
            expenseData.km_parcourus || 0,
            benefice
          ];
          
          worksheet.addRow(row);
        });
      });

      // Ajouter des bordures
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber >= 3) { // Commencer après le titre
          row.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
          });
        }
      });

      // Ajouter les lignes de totaux par livreur
      livreurs.forEach(livreur => {
        const livreurOrders = dailyData.filter(item => item.livreur === livreur);
        const livreurExpenses = dailyExpenses.filter(item => item.livreur === livreur);
        
        const totalCommandes = livreurOrders.reduce((sum, item) => sum + parseInt(item.nombre_commandes || 0), 0);
        const totalMontant = livreurOrders.reduce((sum, item) => sum + parseFloat(item.total_montant || 0), 0);
        const totalCarburant = livreurExpenses.reduce((sum, item) => sum + parseFloat(item.carburant || 0), 0);
        const totalReparations = livreurExpenses.reduce((sum, item) => sum + parseFloat(item.reparations || 0), 0);
        const totalPolice = livreurExpenses.reduce((sum, item) => sum + parseFloat(item.police || 0), 0);
        const totalAutres = livreurExpenses.reduce((sum, item) => sum + parseFloat(item.autres || 0), 0);
        const totalDepensesLivreur = totalCarburant + totalReparations + totalPolice + totalAutres;
        const totalKm = livreurExpenses.reduce((sum, item) => sum + parseFloat(item.km_parcourus || 0), 0);
        const totalBenefice = totalMontant - totalDepensesLivreur;
        
        const totalRow = [
          'TOTAL',
          livreur,
          totalCommandes,
          totalMontant,
          totalCarburant,
          totalReparations,
          totalPolice,
          totalAutres,
          totalDepensesLivreur,
          totalKm,
          totalBenefice
        ];

        const totalRowExcel = worksheet.addRow(totalRow);
        totalRowExcel.font = { bold: true };
        totalRowExcel.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFF00' }
        };
      });

      // Ajuster la largeur des colonnes
      worksheet.columns = [
        { width: 12 }, // Date
        { width: 15 }, // Livreur
        { width: 10 }, // Commandes
        { width: 15 }, // Courses
        { width: 12 }, // Carburant
        { width: 12 }, // Réparations
        { width: 10 }, // Police
        { width: 10 }, // Autres
        { width: 15 }, // Total Dépenses
        { width: 8 },  // Km
        { width: 15 }  // Bénéfice
      ];

      // Définir les en-têtes de réponse
      const filename = `recapitulatif_mensuel_${month}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Écrire le fichier dans la réponse
      await workbook.xlsx.write(res);
      res.end();

    } catch (error) {
      console.error('Erreur lors de l\'export Excel mensuel:', error);
      res.status(500).json({
        error: 'Erreur lors de l\'export Excel mensuel'
      });
    }
  }

  // Obtenir le tableau de bord mensuel spécifique aux commandes MATA
  static async getMataMonthlyDashboard(req, res) {
    try {
      const month = req.query.month || new Date().toISOString().slice(0, 7); // Format YYYY-MM
      const orderType = 'MATA'; // Could be made configurable via environment variable if needed
      
      console.log('🔍 getMataMonthlyDashboard - month:', month, 'user role:', req.user.role, 'orderType:', orderType);

      // Build query based on user permissions
      const baseQuery = `
        SELECT 
          o.id,
          TO_CHAR(DATE(o.created_at), 'YYYY-MM-DD') as date,
          o.phone_number,
          o.client_name,
          o.adresse_source,
          COALESCE(NULLIF(o.adresse_destination, ''), o.address) as adresse_destination,
          o.point_de_vente,
          o.amount as montant_commande,
          o.commentaire,
          o.service_rating,
          o.quality_rating,
          o.price_rating,
          u.username as livreur,
          o.created_at
        FROM orders o
        JOIN users u ON o.created_by = u.id
        WHERE o.order_type = $1
          AND TO_CHAR(o.created_at, 'YYYY-MM') = $2
      `;

      let query;
      let queryParams;

      if (req.user.isManagerOrAdmin()) {
        // Managers and Admins can see ALL orders of this type
        query = baseQuery + ' ORDER BY o.created_at ASC';
        queryParams = [orderType, month];
      } else {
        // Other users can only see their own orders of this type
        query = baseQuery + ' AND o.created_by = $3 ORDER BY o.created_at ASC';
        queryParams = [orderType, month, req.user.id];
      }
      
      const db = require('../models/database');
      const result = await db.query(query, queryParams);
      const mataOrders = result.rows;

      // Debug: Log what we're getting from the database
      console.log('🔍 Debug - First MATA order from DB:', mataOrders[0]);
      console.log('🔍 Debug - Point de vente values:', mataOrders.map(o => ({ id: o.id, client_name: o.client_name, point_de_vente: o.point_de_vente })).slice(0, 5));

      // Calculer les statistiques
      const totalCommandes = mataOrders.length;
      const totalMontant = mataOrders.reduce((sum, order) => sum + (parseFloat(order.montant_commande) || 0), 0);
      const livreursUniques = [...new Set(mataOrders.map(order => order.livreur))].length;

      res.json({
        orders: mataOrders,
        month,
        statistics: {
          total_commandes: totalCommandes,
          total_montant: totalMontant,
          livreurs_actifs: livreursUniques
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération du tableau de bord MATA mensuel:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Mettre à jour le commentaire d'une commande MATA
  static async updateMataOrderComment(req, res) {
    try {
      const { id } = req.params;
      const { commentaire } = req.body;

      // Vérifier que la commande existe et est de type MATA
      const existingOrder = await Order.findById(id);
      if (!existingOrder) {
        return res.status(404).json({
          error: 'Commande non trouvée'
        });
      }

      if (existingOrder.order_type !== 'MATA') {
        return res.status(400).json({
          error: 'Cette fonction est réservée aux commandes MATA'
        });
      }

      // Mettre à jour uniquement le commentaire
      const updatedOrder = await Order.update(id, { commentaire });

      res.json({
        message: 'Commentaire mis à jour avec succès',
        order: updatedOrder
      });

    } catch (error) {
      console.error('Erreur lors de la mise à jour du commentaire:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Mettre à jour les notes d'une commande MATA
  static async updateMataOrderRating(req, res) {
    try {
      const { id } = req.params;
      const { ratingType, ratingValue } = req.body;

      // Validation des types de notes acceptés
      const validRatingTypes = ['service', 'quality', 'price'];
      if (!validRatingTypes.includes(ratingType)) {
        return res.status(400).json({
          error: 'Type de note invalide. Types acceptés: service, quality, price'
        });
      }

      // Validation de la valeur de la note
      if (ratingValue !== null && (typeof ratingValue !== 'number' || ratingValue < 0 || ratingValue > 10)) {
        return res.status(400).json({
          error: 'La note doit être un nombre entre 0 et 10, ou null'
        });
      }

      // Vérifier que la commande existe et est de type MATA
      const existingOrder = await Order.findById(id);
      if (!existingOrder) {
        return res.status(404).json({
          error: 'Commande non trouvée'
        });
      }

      if (existingOrder.order_type !== 'MATA') {
        return res.status(400).json({
          error: 'Cette fonction est réservée aux commandes MATA'
        });
      }

      // Mapper le type de note au nom de colonne
      const ratingColumnMap = {
        'service': 'service_rating',
        'quality': 'quality_rating',
        'price': 'price_rating'
      };

      const columnName = ratingColumnMap[ratingType];
      
      // Mettre à jour uniquement la note spécifiée
      const updateData = {};
      updateData[columnName] = ratingValue;
      
      const updatedOrder = await Order.update(id, updateData);

      res.json({
        message: 'Note mise à jour avec succès',
        order: updatedOrder
      });

    } catch (error) {
      console.error('Erreur lors de la mise à jour de la note:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Exporter le tableau de bord MATA mensuel en Excel
  static async exportMataMonthlyToExcel(req, res) {
    try {
      const month = req.query.month || new Date().toISOString().slice(0, 7);
      const orderType = 'MATA'; // Could be made configurable via environment variable if needed
      
      // Build query based on user permissions (same logic as getMataMonthlyDashboard)
      const baseQuery = `
        SELECT 
          o.id,
          TO_CHAR(DATE(o.created_at), 'YYYY-MM-DD') as date,
          o.phone_number,
          o.client_name,
          o.adresse_source,
          COALESCE(NULLIF(o.adresse_destination, ''), o.address) as adresse_destination,
          o.point_de_vente,
          o.amount as montant_commande,
          o.commentaire,
          o.service_rating,
          o.quality_rating,
          o.price_rating,
          u.username as livreur,
          o.created_at
        FROM orders o
        JOIN users u ON o.created_by = u.id
        WHERE o.order_type = $1
          AND TO_CHAR(o.created_at, 'YYYY-MM') = $2
      `;

      let query;
      let queryParams;

      if (req.user.isManagerOrAdmin()) {
        // Managers and Admins can export ALL orders of this type
        query = baseQuery + ' ORDER BY o.created_at ASC';
        queryParams = [orderType, month];
      } else {
        // Other users can only export their own orders of this type
        query = baseQuery + ' AND o.created_by = $3 ORDER BY o.created_at ASC';
        queryParams = [orderType, month, req.user.id];
      }
      
      const db = require('../models/database');
      const result = await db.query(query, queryParams);
      const mataOrders = result.rows;

      // Créer un nouveau classeur Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Commandes MATA Mensuel');

      // Ajouter le titre
      worksheet.mergeCells('A1:M1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `Tableau de Bord Mensuel MATA - ${month}`;
      titleCell.font = { bold: true, size: 16 };
      titleCell.alignment = { horizontal: 'center' };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF009E60' }
      };
      titleCell.font.color = { argb: 'FFFFFFFF' };

      // Ajouter une ligne vide
      worksheet.addRow([]);

      // Définir et ajouter explicitement les en-têtes
      const mataHeaders = [
        'Date',
        'Numéro de téléphone', 
        'Nom',
        'Adresse source',
        'Adresse destination',
        'Point de vente',
        'Montant commande (FCFA)',
        'Livreur',
        'Commentaire',
        'Service livraison',
        'Qualité produits', 
        'Niveau prix',
        'Note moyenne'
      ];
      
      const headerRow = worksheet.addRow(mataHeaders);
      
      // Styliser l'en-tête
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF009E60' }
      };

      // Définir les largeurs des colonnes
      worksheet.columns = [
        { width: 12 },  // Date
        { width: 18 },  // Numéro de téléphone
        { width: 25 },  // Nom
        { width: 30 },  // Adresse source
        { width: 30 },  // Adresse destination
        { width: 20 },  // Point de vente
        { width: 20 },  // Montant commande (FCFA)
        { width: 15 },  // Livreur
        { width: 50 },  // Commentaire
        { width: 15 },  // Service livraison
        { width: 15 },  // Qualité produits
        { width: 15 },  // Niveau prix
        { width: 15 }   // Note moyenne
      ];

      // Ajouter les données
      mataOrders.forEach(order => {
        // Calculer la note moyenne avec traitement sécurisé des valeurs
        const serviceRating = (order.service_rating !== null && order.service_rating !== undefined && order.service_rating !== '') ? parseFloat(order.service_rating) : null;
        const qualityRating = (order.quality_rating !== null && order.quality_rating !== undefined && order.quality_rating !== '') ? parseFloat(order.quality_rating) : null;
        const priceRating = (order.price_rating !== null && order.price_rating !== undefined && order.price_rating !== '') ? parseFloat(order.price_rating) : null;
        
        let averageRating = 'NA';
        if (serviceRating !== null && qualityRating !== null && priceRating !== null && 
            !isNaN(serviceRating) && !isNaN(qualityRating) && !isNaN(priceRating)) {
          averageRating = ((serviceRating + qualityRating + priceRating) / 3).toFixed(1);
        }
        
        worksheet.addRow([
          new Date(order.date).toLocaleDateString('fr-FR'),
          order.phone_number,
          order.client_name,
          order.adresse_source || '',
          order.adresse_destination || '',
          order.point_de_vente || '',
          order.montant_commande || 0,
          order.livreur,
          order.commentaire || '',
          serviceRating !== null ? serviceRating + '/10' : 'NA',
          qualityRating !== null ? qualityRating + '/10' : 'NA',
          priceRating !== null ? priceRating + '/10' : 'NA',
          averageRating !== 'NA' ? averageRating + '/10' : averageRating
        ]);
      });

      // Ajouter des bordures
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber >= 3) { // Commencer après le titre
          row.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
          });
        }
      });

      // Ajouter une ligne de total
      const totalMontant = mataOrders.reduce((sum, order) => sum + (parseFloat(order.montant_commande) || 0), 0);
      const totalRow = worksheet.addRow([
        '',                              // Date
        '',                              // Numéro de téléphone
        '',                              // Nom
        'TOTAL',                         // Adresse source
        '',                              // Adresse destination
        '',                              // Point de vente
        totalMontant,                    // Montant commande
        `${mataOrders.length} commandes`, // Livreur
        '',                              // Commentaire
        '',                              // Service livraison
        '',                              // Qualité produits
        '',                              // Niveau prix
        ''                               // Note moyenne
      ]);
      
      totalRow.font = { bold: true };
      totalRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFF00' }
      };

      // Définir les en-têtes de réponse
      const filename = `mata_mensuel_${month}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Écrire le fichier dans la réponse
      await workbook.xlsx.write(res);
      res.end();

    } catch (error) {
      console.error('Erreur lors de l\'export Excel MATA mensuel:', error);
      res.status(500).json({
        error: 'Erreur lors de l\'export Excel MATA mensuel'
      });
    }
  }

  // Obtenir toutes les données du tableau de bord en une seule requête optimisée
  static async getDashboardData(req, res) {
    try {
      const date = req.query.date || new Date().toISOString().split('T')[0];
      const userId = req.user.id;
      const userRole = req.user.role;
      const isManagerOrAdmin = userRole === 'MANAGER' || userRole === 'ADMIN';
      
      // Données de base filtrées selon le rôle
      let orders;
      if (isManagerOrAdmin) {
        // Managers/Admins voient toutes les commandes de la date
        orders = await Order.findByDate(date) || [];
      } else {
        // Livreurs ne voient que leurs propres commandes
        orders = await Order.findByUserAndDate(userId, date) || [];
      }
      
      // Calculer les statistiques de base (maintenant filtrées selon le rôle)
      const totalOrders = orders.length;
      const totalAmount = orders.reduce((sum, order) => sum + (parseFloat(order.course_price) || 0), 0);
      
      // Dernières commandes utilisateur (toujours filtrées par utilisateur)
      const recentOrders = await Order.findLastByUser(userId, 5);
      
      // Statistiques par type pour tous les utilisateurs
      let statsByType = [];
      let monthlyStatsByType = [];
      
      if (isManagerOrAdmin) {
        // Pour managers/admins : toutes les commandes
        statsByType = await Order.getStatsByType(date, date);
        
        // Cumul mensuel pour managers
        const currentMonth = date.slice(0, 7); // YYYY-MM
        const year = parseInt(currentMonth.split('-')[0]);
        const monthNum = parseInt(currentMonth.split('-')[1]);
        const lastDay = new Date(year, monthNum, 0).getDate();
        const monthStartDate = `${currentMonth}-01`;
        const monthEndDate = `${currentMonth}-${lastDay.toString().padStart(2, '0')}`;
        monthlyStatsByType = await Order.getStatsByType(monthStartDate, monthEndDate);
      } else {
        // Pour livreurs : seulement leurs commandes
        statsByType = await Order.getStatsByTypeByUserAndDate(userId, date);
        
        // Cumul mensuel pour le livreur
        const currentMonth = date.slice(0, 7); // YYYY-MM
        monthlyStatsByType = await Order.getStatsByTypeByUserAndMonth(userId, currentMonth);
      }
      
      // Récupérer les détails par point de vente pour les commandes MATA
      let mataPointsDeVente = [];
      if (isManagerOrAdmin) {
        mataPointsDeVente = await Order.getMataStatsByPointDeVente(date);
      } else {
        mataPointsDeVente = await Order.getMataStatsByPointDeVenteByUser(userId, date);
      }
      
      // Données avancées pour managers/admins seulement
      let managerData = null;
      if (isManagerOrAdmin) {
        const Expense = require('../models/Expense');
        
        // Récupérer toutes les données managers en parallèle
        const [summary, expensesSummary] = await Promise.all([
          Order.getTodayOrdersByUser(date),
          Expense.getSummaryByDate(date)
        ]);
        
        // Récupérer les statistiques par type pour chaque livreur
        const statsByTypeByUser = await Order.getStatsByTypeByUserAndDateAll(date);
        
        // Créer un map des dépenses et kilomètres par livreur
        const expensesMap = {};
        const kmMap = {};
        expensesSummary.forEach(expense => {
          expensesMap[expense.livreur] = expense.total || 0;
          kmMap[expense.livreur] = expense.km_parcourus || 0;
        });
        
        // Créer un map des stats par type par livreur
        const statsByTypeMap = {};
        statsByTypeByUser.forEach(stat => {
          if (!statsByTypeMap[stat.livreur]) {
            statsByTypeMap[stat.livreur] = {};
          }
          statsByTypeMap[stat.livreur][stat.order_type] = {
            count: stat.count,
            total_amount: stat.total_amount
          };
        });
        
        // Enrichir le récapitulatif avec les dépenses
        const enrichedSummary = summary.map(item => ({
          ...item,
          total_depenses: expensesMap[item.livreur] || 0,
          km_parcourus: kmMap[item.livreur] || 0,
          statsByType: statsByTypeMap[item.livreur] || {}
        }));
        
        managerData = {
          summary: enrichedSummary,
          statsByType,
          totalLivreurs: summary.length,
          totalCommandes: summary.reduce((sum, item) => sum + parseInt(item.nombre_commandes), 0),
          totalMontant: summary.reduce((sum, item) => sum + parseFloat(item.total_montant || 0), 0),
          totalDepenses: expensesSummary.reduce((sum, item) => sum + parseFloat(item.total || 0), 0),
          activeLivreurs: summary.filter(item => item.nombre_commandes > 0).length
        };
      }
      
      // Réponse consolidée
      let totalExpenses = 0;
      if (isManagerOrAdmin) {
        totalExpenses = managerData ? managerData.totalDepenses : 0;
      } else {
        // Pour livreur : récupérer la dépense du jour
        try {
          const expense = await Expense.findByLivreurAndDate(userId, date);
          totalExpenses = expense ? expense.getTotal() : 0;
        } catch (error) {
          console.error('Error fetching expenses for delivery user:', error);
          totalExpenses = 0;
        }
      }
      const responseData = {
        date,
        user: {
          role: userRole,
          isManagerOrAdmin
        },
        basicStats: {
          totalOrders,
          totalAmount,
          totalExpenses
        },
        recentOrders,
        statsByType, // Statistiques du jour (pour tous les utilisateurs)
        monthlyStatsByType, // Cumul mensuel (pour tous les utilisateurs)
        managerData,
        mataPointsDeVente
      };
      
      res.json(responseData);
      
    } catch (error) {
      console.error('Erreur lors de la récupération des données du tableau de bord:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Export Excel du récapitulatif par livreur
  static async exportMonthlySummaryToExcel(req, res) {
    try {
      const month = req.query.month || new Date().toISOString().slice(0, 7);
      
      // Vérifier les permissions
      if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') {
        return res.status(403).json({
          error: 'Accès refusé. Seuls les managers et admins peuvent exporter les données.'
        });
      }

      // Récupérer les données du récapitulatif mensuel
      const [monthlyData, dailyExpenses] = await Promise.all([
        Order.getMonthlyDetailsByDay(month),
        Expense.getMonthlyExpensesByDay(month)
      ]);

      // Récupérer les données GPS directement depuis la base de données
      const db = require('../models/database');
      let dailyGpsData = [];
      try {
        const gpsQuery = `
          SELECT 
            gdm.livreur_id,
            u.username as livreur_username,
            gdm.tracking_date,
            gdm.total_distance_km
          FROM gps_daily_metrics gdm
          JOIN users u ON gdm.livreur_id = u.id
          WHERE DATE_TRUNC('month', gdm.tracking_date) = DATE_TRUNC('month', $1::date)
          ORDER BY gdm.tracking_date DESC, u.username
        `;
        const gpsResult = await db.query(gpsQuery, [month + '-01']);
        dailyGpsData = gpsResult.rows;
      } catch (error) {
        console.warn('Erreur lors de la récupération des données GPS:', error);
        dailyGpsData = [];
      }

      // Créer le workbook Excel
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Récapitulatif par livreur');

      // Définir les colonnes
      worksheet.columns = [
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Livreur', key: 'livreur', width: 20 },
        { header: 'Commandes', key: 'commandes', width: 12 },
        { header: 'Courses (FCFA)', key: 'courses', width: 15 },
        { header: 'Carburant (FCFA)', key: 'carburant', width: 15 },
        { header: 'Réparations (FCFA)', key: 'reparations', width: 15 },
        { header: 'Police (FCFA)', key: 'police', width: 15 },
        { header: 'Autres (FCFA)', key: 'autres', width: 15 },
        { header: 'Total Dépenses (FCFA)', key: 'total_depenses', width: 18 },
        { header: 'Km Parcourus', key: 'km_parcourus', width: 15 },
        { header: 'GPS Km', key: 'gps_km', width: 12 },
        { header: 'Bénéfice (FCFA)', key: 'benefice', width: 15 }
      ];

      // Style des en-têtes
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF009E60' }
      };
      worksheet.getRow(1).alignment = { horizontal: 'center' };

      // Obtenir la liste des livreurs et des dates
      const livreurs = [...new Set(monthlyData.map(item => item.livreur))].sort();
      const dates = [...new Set(monthlyData.map(item => item.date))].sort();

      // Créer des maps pour un accès rapide aux données
      const ordersMap = {};
      const expensesMap = {};
      const gpsMap = {};

      monthlyData.forEach(item => {
        const key = `${item.date}_${item.livreur}`;
        ordersMap[key] = item;
      });

      dailyExpenses.forEach(item => {
        const key = `${item.date}_${item.livreur}`;
        expensesMap[key] = item;
      });

      dailyGpsData.forEach(item => {
        const gpsDate = new Date(item.tracking_date);
        const year = gpsDate.getFullYear();
        const month = String(gpsDate.getMonth() + 1).padStart(2, '0');
        const day = String(gpsDate.getDate()).padStart(2, '0');
        const formattedDate = `${year}-${month}-${day}`;
        const key = `${formattedDate}_${item.livreur_username}`;
        gpsMap[key] = item;
      });

      // Ajouter les données ligne par ligne
      dates.forEach(date => {
        const formattedDate = new Date(date).toLocaleDateString('fr-FR', { 
          day: '2-digit', 
          month: '2-digit' 
        });
        
        livreurs.forEach(livreur => {
          const orderKey = `${date}_${livreur}`;
          const expenseKey = `${date}_${livreur}`;
          const gpsKey = `${date}_${livreur}`;
          
          const orderData = ordersMap[orderKey] || { nombre_commandes: 0, total_montant: 0 };
          const expenseData = expensesMap[expenseKey] || { carburant: 0, reparations: 0, police: 0, autres: 0, km_parcourus: 0 };
          const gpsData = gpsMap[gpsKey] || { total_distance_km: 0 };
          
          const totalDepenses = (expenseData.carburant || 0) + (expenseData.reparations || 0) + (expenseData.police || 0) + (expenseData.autres || 0);
          const benefice = (orderData.total_montant || 0) - totalDepenses;
          
          const row = worksheet.addRow({
            date: formattedDate,
            livreur: livreur,
            commandes: orderData.nombre_commandes || 0,
            courses: orderData.total_montant || 0,
            carburant: expenseData.carburant || 0,
            reparations: expenseData.reparations || 0,
            police: expenseData.police || 0,
            autres: expenseData.autres || 0,
            total_depenses: totalDepenses,
            km_parcourus: expenseData.km_parcourus || 0,
            gps_km: gpsData.total_distance_km ? Math.round(gpsData.total_distance_km * 100) / 100 : 0,
            benefice: benefice
          });

          // Colorer les bénéfices
          if (benefice >= 0) {
            row.getCell('benefice').fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFD4EDDA' }
            };
            row.getCell('benefice').font = { color: { argb: 'FF155724' }, bold: true };
          } else {
            row.getCell('benefice').fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF8D7DA' }
            };
            row.getCell('benefice').font = { color: { argb: 'FF721C24' }, bold: true };
          }
        });
      });

      // Ajouter les totaux par livreur
      livreurs.forEach(livreur => {
        const livreurOrders = monthlyData.filter(item => item.livreur === livreur);
        const livreurExpenses = dailyExpenses.filter(item => item.livreur === livreur);
        
        const totalCommandes = livreurOrders.reduce((sum, item) => sum + parseInt(item.nombre_commandes || 0), 0);
        const totalMontant = livreurOrders.reduce((sum, item) => sum + parseFloat(item.total_montant || 0), 0);
        const totalCarburant = livreurExpenses.reduce((sum, item) => sum + parseFloat(item.carburant || 0), 0);
        const totalReparations = livreurExpenses.reduce((sum, item) => sum + parseFloat(item.reparations || 0), 0);
        const totalPolice = livreurExpenses.reduce((sum, item) => sum + parseFloat(item.police || 0), 0);
        const totalAutres = livreurExpenses.reduce((sum, item) => sum + parseFloat(item.autres || 0), 0);
        const totalDepensesLivreur = totalCarburant + totalReparations + totalPolice + totalAutres;
        const totalKm = livreurExpenses.reduce((sum, item) => sum + parseFloat(item.km_parcourus || 0), 0);
        const totalGpsKm = dailyGpsData
          .filter(item => item.livreur_username === livreur)
          .reduce((sum, item) => sum + parseFloat(item.total_distance_km || 0), 0);
        const totalBenefice = totalMontant - totalDepensesLivreur;
        
        const totalRow = worksheet.addRow({
          date: 'TOTAL',
          livreur: livreur,
          commandes: totalCommandes,
          courses: totalMontant,
          carburant: totalCarburant,
          reparations: totalReparations,
          police: totalPolice,
          autres: totalAutres,
          total_depenses: totalDepensesLivreur,
          km_parcourus: totalKm,
          gps_km: Math.round(totalGpsKm * 100) / 100,
          benefice: totalBenefice
        });

        // Style des lignes de total
        totalRow.font = { bold: true };
        totalRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFF00' }
        };

        // Colorer les bénéfices totaux
        if (totalBenefice >= 0) {
          totalRow.getCell('benefice').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD4EDDA' }
          };
          totalRow.getCell('benefice').font = { color: { argb: 'FF155724' }, bold: true };
        } else {
          totalRow.getCell('benefice').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8D7DA' }
          };
          totalRow.getCell('benefice').font = { color: { argb: 'FF721C24' }, bold: true };
        }
      });

      // Ajouter des bordures
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber >= 2) {
          row.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
          });
        }
      });

      // Définir les en-têtes de réponse
      const filename = `recapitulatif_livreurs_${month}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Écrire le fichier dans la réponse
      await workbook.xlsx.write(res);
      res.end();

    } catch (error) {
      console.error('Erreur lors de l\'export Excel récapitulatif par livreur:', error);
      res.status(500).json({
        error: 'Erreur lors de l\'export Excel récapitulatif par livreur'
      });
    }
  }
}

module.exports = OrderController; 