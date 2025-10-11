const Order = require('../models/Order');
const Expense = require('../models/Expense');
const ExcelJS = require('exceljs');
const OpenAI = require('openai');

class OrderController {
  // Créer une nouvelle commande
  static async createOrder(req, res) {
    try {
      const { client_name, phone_number, adresse_source, adresse_destination, point_de_vente, address, description, amount, course_price, order_type, created_by, interne } = req.body;
      
      // Debug: logger les données reçues
      console.log('🔍 Données reçues pour création de commande:', {
        client_name,
        phone_number,
        order_type,
        interne,
        interneType: typeof interne,
        interneValue: interne
      });
      
      // Gestion des commandes internes
      let finalClientName = client_name;
      let finalPhoneNumber = phone_number;
      let isInterne = false;
      
      if (interne === 'on' || interne === true || interne === 'true') {
        finalClientName = 'COMMANDE INTERNE';
        finalPhoneNumber = '0000000000';
        isInterne = true;
        console.log('🏢 Commande interne détectée, valeurs par défaut appliquées');
      }
      
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
        client_name: finalClientName,
        phone_number: finalPhoneNumber,
        adresse_source,
        adresse_destination,
        point_de_vente,
        address,
        description,
        amount,
        course_price,
        order_type,
        created_by: actualCreatedBy,
        interne: isInterne
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

      // Récupérer les stats par type par (date, livreur) pour déduction fine du type par jour
      const dailyTypeStats = await Order.getDailyTypeStatsByMonth(month);
      console.log('🔍 dailyTypeStats data:', JSON.stringify(dailyTypeStats, null, 2));

      res.json({
        summary: enrichedSummary,
        dailyData,
        dailyExpenses,
        monthlyStatsByType,
        dailyTypeStats,
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
          o.commercial_service_rating,
          u.username as livreur,
          o.interne,
          o.source_connaissance,
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

      // Enrichir chaque commande avec les informations client (nouveau/récurrent)
      const clientStats = {}; // Cache pour éviter les requêtes multiples par client
      
      for (let order of mataOrders) {
        if (order.phone_number) {
          // Utiliser le cache si déjà calculé pour ce numéro
          if (!clientStats[order.phone_number]) {
            // Compter le TOTAL de commandes pour ce numéro (tous les mois)
            const totalOrdersQuery = `
              SELECT COUNT(*) as count
              FROM orders
              WHERE phone_number = $1
                AND order_type = 'MATA'
            `;
            const totalResult = await db.query(totalOrdersQuery, [order.phone_number]);
            const totalOrders = parseInt(totalResult.rows[0].count);
            
            // Compter les commandes de ce client DANS LE MOIS ACTUEL
            const thisMonthOrdersQuery = `
              SELECT COUNT(*) as count
              FROM orders
              WHERE phone_number = $1
                AND order_type = 'MATA'
                AND TO_CHAR(created_at, 'YYYY-MM') = $2
            `;
            const thisMonthResult = await db.query(thisMonthOrdersQuery, [order.phone_number, month]);
            const thisMonthOrders = parseInt(thisMonthResult.rows[0].count);
            
            clientStats[order.phone_number] = {
              total_orders: totalOrders,
              this_month_orders: thisMonthOrders,
              is_new: totalOrders === 1 && thisMonthOrders === 1 // Nouveau si c'est sa première commande
            };
          }
          
          const stats = clientStats[order.phone_number];
          order.total_orders_count = stats.total_orders;
          order.orders_this_month_count = stats.this_month_orders;
          order.is_new_client = stats.is_new;
        } else {
          order.total_orders_count = 0;
          order.orders_this_month_count = 0;
          order.is_new_client = true;
        }
      }

      // Calculate statistics (excluding internal orders)
      const externalOrders = mataOrders.filter(order => !order.interne);
      const totalOrders = externalOrders.length;
      const totalAmount = externalOrders.reduce((sum, order) => sum + (parseFloat(order.montant_commande) || 0), 0);
      const uniqueLivreurs = [...new Set(externalOrders.map(order => order.livreur))];
      const livreursActifs = uniqueLivreurs.length;

      // Group by point de vente (excluding internal orders)
      const ordersByPointVente = {};
      externalOrders.forEach(order => {
        const pointVente = order.point_de_vente || 'Non spécifié';
        if (!ordersByPointVente[pointVente]) {
          ordersByPointVente[pointVente] = {
            count: 0,
            amount: 0,
            orders: []
          };
        }
        ordersByPointVente[pointVente].count++;
        ordersByPointVente[pointVente].amount += parseFloat(order.montant_commande) || 0;
        ordersByPointVente[pointVente].orders.push(order);
      });

      // Get unique point de vente for filter
      const uniquePointVente = [...new Set(mataOrders.map(order => order.point_de_vente).filter(Boolean))];
      const uniqueLivreursList = [...new Set(mataOrders.map(order => order.livreur))];

      res.json({
        orders: mataOrders,
        statistics: {
          total_orders: totalOrders,
          total_amount: totalAmount,
          livreurs_actifs: livreursActifs,
          avg_order_value: totalOrders > 0 ? totalAmount / totalOrders : 0
        },
        orders_by_point_vente: ordersByPointVente,
        filters: {
          point_vente: uniquePointVente,
          livreurs: uniqueLivreursList
        },
        month
      });

    } catch (error) {
      console.error('Erreur lors de la récupération du tableau de bord MATA mensuel:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Rechercher des clients
  static async searchClients(req, res) {
    try {
      const { q } = req.query;
      const limit = parseInt(req.query.limit) || 10;

      if (!q || q.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Le terme de recherche doit contenir au moins 2 caractères'
        });
      }

      const clients = await Order.searchClients(q.trim(), limit);

      res.json({
        success: true,
        clients,
        count: clients.length
      });
    } catch (error) {
      console.error('Erreur lors de la recherche de clients:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la recherche de clients',
        error: error.message
      });
    }
  }

  // Obtenir les informations d'un client par numéro de téléphone
  static async getClientByPhone(req, res) {
    try {
      const { phoneNumber } = req.params;

      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          message: 'Le numéro de téléphone est requis'
        });
      }

      const client = await Order.findClientByPhone(phoneNumber);

      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Aucun client trouvé avec ce numéro de téléphone'
        });
      }

      res.json({
        success: true,
        client
      });
    } catch (error) {
      console.error('Erreur lors de la récupération du client:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du client',
        error: error.message
      });
    }
  }

  // Obtenir le tableau MLC
  static async getMlcTable(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      // Validation des dates
      if (!startDate || !endDate) {
        return res.status(400).json({ 
          success: false, 
          message: 'Les dates de début et de fin sont requises' 
        });
      }

      console.log('🔍 getMlcTable - startDate:', startDate, 'endDate:', endDate, 'user role:', req.user.role);

      // Requête pour obtenir les statistiques des clients MLC avec les packs actifs
      const query = `
        WITH client_stats AS (
          SELECT 
            o.phone_number,
            MIN(o.client_name) as client_name, -- Premier nom par ordre alphabétique
            COUNT(*) as total_orders,
            MAX(o.created_at) as last_order_date,
            SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NOT NULL THEN 1 ELSE 0 END) as mlc_abonnement_count,
            SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL THEN 1 ELSE 0 END) as mlc_simple_count,
            SUM(CASE WHEN o.order_type = 'MLC' AND o.course_price > (
              CASE 
                WHEN o.subscription_id IS NOT NULL THEN 
                  (SELECT s.price / s.total_deliveries FROM subscriptions s WHERE s.id = o.subscription_id)
                ELSE 0
              END
            ) THEN 1 ELSE 0 END) as supplement_count
          FROM orders o
          WHERE DATE(o.created_at) BETWEEN $1 AND $2
            AND o.order_type = 'MLC'
            AND o.client_name != 'COMMANDE INTERNE'
            AND o.phone_number != '0000000000'
          GROUP BY o.phone_number
        ),
        active_packs AS (
          SELECT 
            s.phone_number,
            s.id as subscription_id,
            s.total_deliveries,
            s.used_deliveries,
            (s.total_deliveries - s.used_deliveries) as remaining_deliveries,
            s.is_active
          FROM subscriptions s
          WHERE s.is_active = true
            AND s.used_deliveries < s.total_deliveries
        )
        SELECT 
          cs.phone_number,
          cs.client_name,
          cs.total_orders,
          cs.last_order_date,
          cs.mlc_abonnement_count,
          cs.mlc_simple_count,
          cs.supplement_count,
          CASE 
            WHEN ap.subscription_id IS NOT NULL THEN 
              CONCAT(ap.remaining_deliveries, '/', ap.total_deliveries)
            ELSE NULL
          END as active_pack_info
        FROM client_stats cs
        LEFT JOIN active_packs ap ON cs.phone_number = ap.phone_number
        ORDER BY cs.client_name ASC
      `;

      const db = require('../models/database');
      const result = await db.query(query, [startDate, endDate]);
      
      res.json({
        success: true,
        data: result.rows,
        period: {
          startDate,
          endDate
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération du tableau MLC:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des données',
        error: error.message
      });
    }
  }

  // Obtenir les détails d'un client MLC
  static async getMlcClientDetails(req, res) {
    try {
      const { phoneNumber, startDate, endDate } = req.query;
      
      if (!phoneNumber || !startDate || !endDate) {
        return res.status(400).json({ 
          success: false, 
          message: 'Le numéro de téléphone et les dates sont requis' 
        });
      }

      // Requête pour obtenir tous les noms associés au numéro
      const namesQuery = `
        SELECT DISTINCT client_name
        FROM orders
        WHERE phone_number = $1
          AND client_name != 'COMMANDE INTERNE'
        ORDER BY client_name ASC
      `;

      // Requête pour obtenir les informations de la carte active
      const activeCardQuery = `
        SELECT 
          s.id,
          s.card_number,
          s.price,
          s.total_deliveries,
          s.used_deliveries,
          s.remaining_deliveries,
          s.is_active,
          s.created_at as purchase_date,
          s.expiry_date,
          s.address
        FROM subscriptions s
        WHERE s.phone_number = $1
          AND s.is_active = true
          AND s.remaining_deliveries > 0
          AND s.expiry_date > NOW()
        ORDER BY s.created_at DESC
        LIMIT 1
      `;

      // Requête pour obtenir les détails des commandes
      const ordersQuery = `
        SELECT 
          o.id,
          o.client_name,
          o.phone_number,
          o.address,
          o.description,
          o.amount,
          o.course_price,
          o.order_type,
          o.subscription_id,
          o.created_at,
          u.username as livreur_name,
          s.card_number,
          s.price as subscription_price,
          s.total_deliveries,
          CASE 
            WHEN o.subscription_id IS NOT NULL AND o.course_price > (s.price / s.total_deliveries) THEN true
            ELSE false
          END as has_supplement
        FROM orders o
        LEFT JOIN users u ON o.created_by = u.id
        LEFT JOIN subscriptions s ON o.subscription_id = s.id
        WHERE o.phone_number = $1
          AND DATE(o.created_at) BETWEEN $2 AND $3
          AND o.order_type = 'MLC'
          AND o.client_name != 'COMMANDE INTERNE'
        ORDER BY o.created_at DESC
      `;

      const db = require('../models/database');
      const [namesResult, ordersResult, activeCardResult] = await Promise.all([
        db.query(namesQuery, [phoneNumber]),
        db.query(ordersQuery, [phoneNumber, startDate, endDate]),
        db.query(activeCardQuery, [phoneNumber])
      ]);

      res.json({
        success: true,
        data: {
          phoneNumber,
          clientNames: namesResult.rows.map(row => row.client_name),
          orders: ordersResult.rows,
          activeCard: activeCardResult.rows.length > 0 ? activeCardResult.rows[0] : null,
          period: {
            startDate,
            endDate
          }
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des détails du client:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des détails',
        error: error.message
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
      const validRatingTypes = ['service', 'quality', 'price', 'commercial'];
      if (!validRatingTypes.includes(ratingType)) {
        return res.status(400).json({
          error: 'Type de note invalide. Types acceptés: service, quality, price, commercial'
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
        'price': 'price_rating',
        'commercial': 'commercial_service_rating'
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

  // Mettre à jour la source de connaissance d'une commande MATA
  static async updateMataOrderSourceConnaissance(req, res) {
    try {
      const { id } = req.params;
      const { source_connaissance } = req.body;

      // Validation de la source de connaissance (optionnel, max 100 caractères)
      if (source_connaissance !== null && source_connaissance !== undefined && typeof source_connaissance !== 'string') {
        return res.status(400).json({
          error: 'La source de connaissance doit être une chaîne de caractères'
        });
      }

      if (source_connaissance && source_connaissance.length > 100) {
        return res.status(400).json({
          error: 'La source de connaissance ne peut pas dépasser 100 caractères'
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

      // Mettre à jour uniquement la source de connaissance
      const updatedOrder = await Order.update(id, { source_connaissance: source_connaissance || null });

      res.json({
        message: 'Source de connaissance mise à jour avec succès',
        order: updatedOrder
      });

    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour de la source de connaissance:', error);
      console.error('Stack:', error.stack);
      res.status(500).json({
        error: 'Erreur interne du serveur',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Obtenir l'historique des commandes d'un client par numéro de téléphone
  static async getClientOrderHistory(req, res) {
    try {
      const { phone_number } = req.query;
      const startDate = req.query.start_date;
      const endDate = req.query.end_date;

      if (!phone_number) {
        return res.status(400).json({
          error: 'Le numéro de téléphone est requis'
        });
      }

      console.log('📞 getClientOrderHistory - phone:', phone_number, 'dates:', startDate, endDate);

      const db = require('../models/database');
      
      // Construire la requête avec filtres de date optionnels
      let query = `
        SELECT 
          o.id,
          TO_CHAR(DATE(o.created_at), 'YYYY-MM-DD') as date,
          o.phone_number,
          o.client_name,
          o.adresse_source,
          COALESCE(NULLIF(o.adresse_destination, ''), o.address) as adresse_destination,
          o.point_de_vente,
          o.amount as montant_commande,
          o.order_type,
          o.commentaire,
          o.service_rating,
          o.quality_rating,
          o.price_rating,
          o.commercial_service_rating,
          o.interne,
          o.source_connaissance,
          u.username as livreur,
          o.created_at
        FROM orders o
        LEFT JOIN users u ON o.created_by = u.id
        WHERE o.phone_number = $1
          AND o.order_type = 'MATA'
      `;

      const queryParams = [phone_number];
      let paramIndex = 2;

      if (startDate) {
        query += ` AND DATE(o.created_at) >= $${paramIndex}`;
        queryParams.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        query += ` AND DATE(o.created_at) <= $${paramIndex}`;
        queryParams.push(endDate);
        paramIndex++;
      }

      query += ' ORDER BY o.created_at DESC';

      const result = await db.query(query, queryParams);
      const orders = result.rows;

      // Calculer des statistiques
      const stats = {
        total_orders: orders.length,
        total_amount: orders.reduce((sum, o) => sum + (parseFloat(o.montant_commande) || 0), 0),
        avg_amount: orders.length > 0 ? orders.reduce((sum, o) => sum + (parseFloat(o.montant_commande) || 0), 0) / orders.length : 0,
        first_order_date: orders.length > 0 ? orders[orders.length - 1].date : null,
        last_order_date: orders.length > 0 ? orders[0].date : null
      };

      res.json({
        success: true,
        phone_number,
        client_name: orders.length > 0 ? orders[0].client_name : null,
        statistics: stats,
        orders
      });

    } catch (error) {
      console.error('❌ Erreur lors de la récupération de l\'historique client:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Obtenir l'analyse de sentiment IA pour les commandes MATA d'un mois
  static async getMatasentimentAnalysis(req, res) {
    try {
      const month = req.query.month || new Date().toISOString().slice(0, 7); // Format YYYY-MM
      
      console.log('🤖 getMatasentimentAnalysis - month:', month, 'user role:', req.user.role);

      // Récupérer toutes les commandes MATA du mois
      const db = require('../models/database');
      const query = `
        SELECT 
          o.id,
          o.commentaire,
          o.service_rating,
          o.quality_rating,
          o.price_rating,
          o.commercial_service_rating,
          o.point_de_vente,
          o.source_connaissance,
          o.amount as montant_commande
        FROM orders o
        WHERE o.order_type = 'MATA'
          AND TO_CHAR(o.created_at, 'YYYY-MM') = $1
          AND (o.interne = FALSE OR o.interne IS NULL)
        ORDER BY o.created_at ASC
      `;
      
      const result = await db.query(query, [month]);
      const orders = result.rows;

      if (orders.length === 0) {
        return res.json({
          success: true,
          month,
          statistics: {
            total_orders: 0,
            orders_with_comments: 0,
            orders_with_ratings: 0,
            comment_percentage: 0,
            rating_percentage: 0
          },
          average_ratings: null,
          ai_analysis: {
            sentiment_global: 'NEUTRE',
            sentiment_score: 50,
            points_forts: [],
            points_amelioration: [],
            recommandations: ['Aucune donnée disponible pour ce mois']
          },
          by_point_vente: [],
          by_source_connaissance: []
        });
      }

      // Calculer les statistiques
      const totalOrders = orders.length;
      const ordersWithComments = orders.filter(o => o.commentaire && o.commentaire.trim()).length;
      const ordersWithRatings = orders.filter(o => 
        o.service_rating !== null || o.quality_rating !== null || 
        o.price_rating !== null || o.commercial_service_rating !== null
      ).length;

      // Calculer les moyennes des notes
      const ratings = {
        service: [],
        quality: [],
        price: [],
        commercial: []
      };

      orders.forEach(order => {
        if (order.service_rating !== null) ratings.service.push(parseFloat(order.service_rating));
        if (order.quality_rating !== null) ratings.quality.push(parseFloat(order.quality_rating));
        if (order.price_rating !== null) ratings.price.push(parseFloat(order.price_rating));
        if (order.commercial_service_rating !== null) ratings.commercial.push(parseFloat(order.commercial_service_rating));
      });

      const avgRatings = {
        service_rating: ratings.service.length > 0 ? 
          (ratings.service.reduce((a, b) => a + b, 0) / ratings.service.length).toFixed(1) : null,
        quality_rating: ratings.quality.length > 0 ? 
          (ratings.quality.reduce((a, b) => a + b, 0) / ratings.quality.length).toFixed(1) : null,
        price_rating: ratings.price.length > 0 ? 
          (ratings.price.reduce((a, b) => a + b, 0) / ratings.price.length).toFixed(1) : null,
        commercial_service_rating: ratings.commercial.length > 0 ? 
          (ratings.commercial.reduce((a, b) => a + b, 0) / ratings.commercial.length).toFixed(1) : null,
        global_average: null
      };

      // Calculer la moyenne globale
      const allRatings = [...ratings.service, ...ratings.quality, ...ratings.price, ...ratings.commercial];
      if (allRatings.length > 0) {
        avgRatings.global_average = (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1);
      }

      // Statistiques par point de vente (calculer la moyenne par commande d'abord)
      const byPointVente = {};
      orders.forEach(order => {
        const pv = order.point_de_vente || 'Non spécifié';
        if (!byPointVente[pv]) {
          byPointVente[pv] = {
            count: 0,
            orderRatings: []
          };
        }
        byPointVente[pv].count++;
        
        // Calculer la moyenne pour cette commande seulement si elle a des notes
        const orderRatings = [];
        if (order.service_rating) orderRatings.push(parseFloat(order.service_rating));
        if (order.quality_rating) orderRatings.push(parseFloat(order.quality_rating));
        if (order.price_rating) orderRatings.push(parseFloat(order.price_rating));
        if (order.commercial_service_rating) orderRatings.push(parseFloat(order.commercial_service_rating));
        
        // Si cette commande a des notes, ajouter la moyenne de la commande
        if (orderRatings.length > 0) {
          const orderAvg = orderRatings.reduce((a, b) => a + b, 0) / orderRatings.length;
          byPointVente[pv].orderRatings.push(orderAvg);
        }
      });

      const byPointVenteArray = Object.entries(byPointVente).map(([name, data]) => ({
        point_vente: name,
        count: data.count,
        average_rating: data.orderRatings.length > 0 ? 
          (data.orderRatings.reduce((a, b) => a + b, 0) / data.orderRatings.length).toFixed(1) : null
      })).sort((a, b) => b.count - a.count);

      // Statistiques par source de connaissance
      const bySourceConnaissance = {};
      orders.forEach(order => {
        const source = order.source_connaissance || 'Non renseigné';
        if (!bySourceConnaissance[source]) {
          bySourceConnaissance[source] = 0;
        }
        bySourceConnaissance[source]++;
      });

      const bySourceConnaissanceArray = Object.entries(bySourceConnaissance).map(([name, count]) => ({
        source: name,
        count
      })).sort((a, b) => b.count - a.count);

      // Analyse IA avec OpenAI
      let aiAnalysis = {
        sentiment_global: 'NEUTRE',
        sentiment_score: 50,
        points_forts: [],
        points_amelioration: [],
        recommandations: []
      };

      // Appeler OpenAI seulement si on a des commentaires ou des notes
      if (ordersWithComments > 0 || ordersWithRatings > 0) {
        try {
          // Vérifier que la clé API est disponible
          if (!process.env.OPENAI_API_KEY) {
            console.warn('⚠️ OPENAI_API_KEY non configurée, utilisation de l\'analyse basique');
            aiAnalysis = OrderController._generateBasicAnalysis(orders, avgRatings);
          } else {
            const openai = new OpenAI({
              apiKey: process.env.OPENAI_API_KEY
            });

            // Préparer les données pour l'IA
            const comments = orders
              .filter(o => o.commentaire && o.commentaire.trim())
              .map(o => o.commentaire.trim())
              .slice(0, 50); // Limiter à 50 commentaires max pour réduire les coûts

            const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
            const maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS) || 1500;
            const temperature = parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7; // Plus créatif

            const prompt = `Tu es un analyste expert en satisfaction client pour un service de livraison de viande (MATA). Analyse les retours clients suivants (mois: ${month}):

STATISTIQUES:
- ${totalOrders} commandes au total
- ${ordersWithComments} commentaires (${((ordersWithComments/totalOrders)*100).toFixed(1)}%)
- Notes moyennes: 
  ${avgRatings.service_rating ? `Service livraison: ${avgRatings.service_rating}/10` : ''}
  ${avgRatings.quality_rating ? `Qualité produits: ${avgRatings.quality_rating}/10` : ''}
  ${avgRatings.price_rating ? `Niveau prix: ${avgRatings.price_rating}/10` : ''}
  ${avgRatings.commercial_service_rating ? `Service commercial: ${avgRatings.commercial_service_rating}/10` : ''}

ABRÉVIATIONS COURANTES À COMPRENDRE:
- "Nrp" ou "NRP" = Le client ne décroche pas / ne répond pas quand notre commercial l'appelle (problème de joignabilité du CLIENT)
- "RAS" = Rien à signaler
- "Impec" = Impeccable
- "Nickel" = Parfait
- "Pb" = Problème
- "Tjs" = Toujours
- "Bcp" = Beaucoup

${comments.length > 0 ? `COMMENTAIRES CLIENTS:\n${comments.map((c, i) => `${i+1}. "${c}"`).join('\n')}` : 'Aucun commentaire disponible.'}

INSTRUCTIONS IMPORTANTES:
1. Analyse chaque commentaire en détail avec un œil d'expert
2. Identifie EXACTEMENT les problèmes mentionnés (exemples: os dans la viande, problème de nettoyage de la viande (mal nettoyée, avec résidus), prix élevé, retard de livraison, viande pas fraîche, quantité insuffisante, client injoignable par téléphone quand on l'appelle (Nrp), etc.)
3. Sois SPÉCIFIQUE et CONCRET - cite des exemples réels des commentaires
4. ÉVITE les phrases génériques et stéréotypées - sois inventif et contextuel
5. Adapte ton analyse au contexte spécifique de ce mois
6. Si un problème revient souvent, explique son IMPACT potentiel sur le business
7. Propose des recommandations INNOVANTES et ACTIONNABLES, pas juste "améliorer la qualité"
8. Utilise un ton d'analyste consultant qui comprend le business de la livraison de viande

Fournis une analyse structurée en français au format JSON strict (sans markdown):
{
  "sentiment_global": "POSITIF|NEUTRE|NEGATIF",
  "sentiment_score": <nombre entre 0 et 100>,
  "sentiment_description": "<3-5 phrases PERSONNALISÉES et CONTEXTUELLES. Raconte l'histoire de ce mois : le sentiment global, les problèmes SPÉCIFIQUES avec des détails (os, nettoyage, prix, Nrp, etc.), et l'impact potentiel. Cite des faits précis des commentaires. ÉVITE les formulations génériques.>",
  "points_forts": [<3-5 points SPÉCIFIQUES tirés des vrais commentaires. Explique POURQUOI c'est un point fort et quel impact positif ça a. Exemple: "Rapidité de livraison saluée par X clients, avec des délais respectés même aux heures de pointe, renforçant la confiance client">],
  "points_amelioration": [<3-5 points ULTRA-SPÉCIFIQUES avec le problème EXACT, le nombre de clients concernés, et l'impact business potentiel. Exemple: "Os présents dans 3-4 commandes ce mois (2% des commandes) - risque de perte de clients fidèles si non corrigé" au lieu de "qualité à améliorer">],
  "recommandations": [<3-4 recommandations INNOVANTES et ACTIONNABLES avec des actions CONCRÈTES. Évite "améliorer", "renforcer". Préfère "Mettre en place un double contrôle qualité avant emballage", "Former l'équipe au nettoyage minutieux avec checklist visuelle", "Mettre en place un système de rappel automatique du client 1h avant livraison pour réduire les Nrp (clients non joignables)">]
}

❌ ÉVITE LES PHRASES STÉRÉOTYPÉES comme:
- "Améliorer la qualité globale"
- "Renforcer la communication"  
- "Travailler sur les points d'amélioration"

✅ PRÉFÈRE LES ANALYSES INVENTIVES comme:
- "Corrélation observée entre les commandes du vendredi et les plaintes sur le nettoyage - possiblement lié à la charge de travail en fin de semaine"
- "Le taux de Nrp de 15% impacte directement la note du service commercial - investir dans un système de rappel automatique pourrait réduire ce taux de moitié"

Réponds UNIQUEMENT en JSON valide, sans markdown.`;

            console.log(`🤖 Appel OpenAI - modèle: ${model}, tokens max: ${maxTokens}`);

            const completion = await openai.chat.completions.create({
              model,
              messages: [
                {
                  role: "system",
                  content: "Tu es un analyste de données spécialisé dans l'analyse de satisfaction client pour services de livraison. Fournis des analyses précises, constructives et actionnables en français. Réponds UNIQUEMENT en JSON valide, sans markdown ni formatting."
                },
                {
                  role: "user",
                  content: prompt
                }
              ],
              max_tokens: maxTokens,
              temperature,
              response_format: { type: "json_object" }
            });

            const aiResponse = completion.choices[0].message.content.trim();
            console.log('🤖 Réponse OpenAI reçue:', aiResponse.substring(0, 200) + '...');
            
            // Parser la réponse JSON
            const parsedResponse = JSON.parse(aiResponse);
            aiAnalysis = {
              sentiment_global: parsedResponse.sentiment_global || 'NEUTRE',
              sentiment_score: parsedResponse.sentiment_score || 50,
              sentiment_description: parsedResponse.sentiment_description || 'Analyse en cours...',
              points_forts: parsedResponse.points_forts || [],
              points_amelioration: parsedResponse.points_amelioration || [],
              recommandations: parsedResponse.recommandations || []
            };
          }
        } catch (error) {
          console.error('❌ Erreur lors de l\'analyse IA:', error.message);
          // Fallback vers analyse basique
          aiAnalysis = OrderController._generateBasicAnalysis(orders, avgRatings);
        }
      } else {
        // Pas de données à analyser
        aiAnalysis.recommandations = ['Encourager les clients à laisser des commentaires et des notes pour améliorer le service'];
      }

      res.json({
        success: true,
        month,
        statistics: {
          total_orders: totalOrders,
          orders_with_comments: ordersWithComments,
          orders_with_ratings: ordersWithRatings,
          comment_percentage: ((ordersWithComments / totalOrders) * 100).toFixed(1),
          rating_percentage: ((ordersWithRatings / totalOrders) * 100).toFixed(1)
        },
        average_ratings: avgRatings,
        ai_analysis: aiAnalysis,
        by_point_vente: byPointVenteArray,
        by_source_connaissance: bySourceConnaissanceArray
      });

    } catch (error) {
      console.error('Erreur lors de l\'analyse de sentiment MATA:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur interne du serveur',
        message: error.message
      });
    }
  }

  // Méthode helper pour générer une analyse basique sans IA
  static _generateBasicAnalysis(orders, avgRatings) {
    const globalAvg = parseFloat(avgRatings.global_average) || 5;
    
    let sentiment = 'NEUTRE';
    let score = 50;
    
    if (globalAvg >= 8) {
      sentiment = 'POSITIF';
      score = Math.min(95, 50 + (globalAvg - 5) * 10);
    } else if (globalAvg < 6) {
      sentiment = 'NEGATIF';
      score = Math.max(20, 50 - (6 - globalAvg) * 10);
    } else {
      score = 50 + (globalAvg - 5) * 5;
    }

    const pointsForts = [];
    const pointsAmelioration = [];
    
    if (avgRatings.service_rating && parseFloat(avgRatings.service_rating) >= 8) {
      pointsForts.push(`Service de livraison très apprécié (${avgRatings.service_rating}/10)`);
    }
    if (avgRatings.quality_rating && parseFloat(avgRatings.quality_rating) >= 8) {
      pointsForts.push(`Excellente qualité des produits (${avgRatings.quality_rating}/10)`);
    }
    if (avgRatings.commercial_service_rating && parseFloat(avgRatings.commercial_service_rating) >= 8) {
      pointsForts.push(`Service commercial de qualité (${avgRatings.commercial_service_rating}/10)`);
    }

    if (avgRatings.price_rating && parseFloat(avgRatings.price_rating) < 7) {
      pointsAmelioration.push(`Améliorer la perception du rapport qualité-prix (${avgRatings.price_rating}/10)`);
    }
    if (avgRatings.service_rating && parseFloat(avgRatings.service_rating) < 7) {
      pointsAmelioration.push(`Renforcer la qualité du service de livraison (${avgRatings.service_rating}/10)`);
    }

    if (pointsForts.length === 0) {
      pointsForts.push('Maintenir la qualité actuelle du service');
    }
    if (pointsAmelioration.length === 0) {
      pointsAmelioration.push('Continuer à améliorer tous les aspects du service');
    }

    // Générer une description basée sur les notes
    let description = '';
    if (sentiment === 'POSITIF') {
      description = `Les clients sont globalement satisfaits avec une note moyenne de ${globalAvg}/10. La majorité des retours sont positifs et reflètent une bonne qualité de service.`;
    } else if (sentiment === 'NEGATIF') {
      description = `Attention : Les clients expriment leur insatisfaction avec une note moyenne de ${globalAvg}/10. Des clients mécontents ont été identifiés et nécessitent une attention immédiate pour améliorer leur expérience.`;
    } else {
      description = `Les retours clients sont mitigés avec une note moyenne de ${globalAvg}/10. Le service satisfait certains clients mais présente des marges d'amélioration pour d'autres.`;
    }
    
    // Ajouter mention des notes basses si nécessaire
    if (globalAvg < 6.5) {
      description += ` Des notes particulièrement basses ont été détectées, indiquant des clients insatisfaits.`;
    }

    return {
      sentiment_global: sentiment,
      sentiment_score: Math.round(score),
      sentiment_description: description,
      points_forts: pointsForts,
      points_amelioration: pointsAmelioration,
      recommandations: [
        'Maintenir les points forts identifiés',
        'Travailler sur les points d\'amélioration',
        'Encourager les retours clients pour mieux comprendre leurs besoins'
      ]
    };
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
          o.commercial_service_rating,
          u.username as livreur,
          o.interne,
          o.source_connaissance,
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

      // Enrichir chaque commande avec les informations client (même logique que getMataMonthlyDashboard)
      const clientStats = {}; // Cache pour éviter les requêtes multiples par client
      
      for (let order of mataOrders) {
        if (order.phone_number) {
          // Utiliser le cache si déjà calculé pour ce numéro
          if (!clientStats[order.phone_number]) {
            // Compter le TOTAL de commandes pour ce numéro (tous les mois)
            const totalOrdersQuery = `
              SELECT COUNT(*) as count
              FROM orders
              WHERE phone_number = $1
                AND order_type = 'MATA'
            `;
            const totalResult = await db.query(totalOrdersQuery, [order.phone_number]);
            const totalOrders = parseInt(totalResult.rows[0].count);
            
            // Compter les commandes de ce client DANS LE MOIS ACTUEL
            const thisMonthOrdersQuery = `
              SELECT COUNT(*) as count
              FROM orders
              WHERE phone_number = $1
                AND order_type = 'MATA'
                AND TO_CHAR(created_at, 'YYYY-MM') = $2
            `;
            const thisMonthResult = await db.query(thisMonthOrdersQuery, [order.phone_number, month]);
            const thisMonthOrders = parseInt(thisMonthResult.rows[0].count);
            
            clientStats[order.phone_number] = {
              total_orders: totalOrders,
              this_month_orders: thisMonthOrders,
              is_new: totalOrders === 1 && thisMonthOrders === 1
            };
          }
          
          const stats = clientStats[order.phone_number];
          order.total_orders_count = stats.total_orders;
          order.orders_this_month_count = stats.this_month_orders;
          order.is_new_client = stats.is_new;
        } else {
          order.total_orders_count = 0;
          order.orders_this_month_count = 0;
          order.is_new_client = true;
        }
      }

      // Créer un nouveau classeur Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Commandes MATA Mensuel');

      // Ajouter le titre
      worksheet.mergeCells('A1:S1');
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
        'Nom du client',
        'Adresse de départ',
        'Adresse de destination',
        'Point de vente',
        'Montant commande (FCFA)',
        'Livreur assigné',
        'Type client',
        'Commandes ce mois',
        'Commandes total',
        'Commande interne',
        'Comment nous avez-vous connu ?',
        'Commentaire client',
        'Note Service de livraison',
        'Note Qualité des produits', 
        'Note Niveau de prix',
        'Note Service Commercial',
        'Note globale moyenne'
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
        { width: 15 },  // Type client
        { width: 12 },  // Commandes ce mois
        { width: 12 },  // Commandes total
        { width: 10 },  // Interne
        { width: 25 },  // Source connaissance
        { width: 50 },  // Commentaire
        { width: 15 },  // Service livraison
        { width: 15 },  // Qualité produits
        { width: 15 },  // Niveau prix
        { width: 15 },  // Service Commercial
        { width: 15 }   // Note moyenne
      ];

      // Ajouter les données
      mataOrders.forEach(order => {
        // Calculer la note moyenne avec traitement sécurisé des valeurs
        const serviceRating = (order.service_rating !== null && order.service_rating !== undefined && order.service_rating !== '') ? parseFloat(order.service_rating) : null;
        const qualityRating = (order.quality_rating !== null && order.quality_rating !== undefined && order.quality_rating !== '') ? parseFloat(order.quality_rating) : null;
        const priceRating = (order.price_rating !== null && order.price_rating !== undefined && order.price_rating !== '') ? parseFloat(order.price_rating) : null;
        const commercialRating = (order.commercial_service_rating !== null && order.commercial_service_rating !== undefined && order.commercial_service_rating !== '') ? parseFloat(order.commercial_service_rating) : null;
        
        let averageRating = 'NA';
        // Gestion de la transition : calcul sur 3 ou 4 colonnes selon les données disponibles
        if (serviceRating !== null && qualityRating !== null && priceRating !== null && 
            !isNaN(serviceRating) && !isNaN(qualityRating) && !isNaN(priceRating)) {
          
          if (commercialRating !== null && !isNaN(commercialRating)) {
            // Calcul sur 4 colonnes (après migration)
            averageRating = ((serviceRating + qualityRating + priceRating + commercialRating) / 4).toFixed(1);
          } else {
            // Calcul sur 3 colonnes (avant migration)
            averageRating = ((serviceRating + qualityRating + priceRating) / 3).toFixed(1);
          }
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
          order.is_new_client ? 'Nouveau' : 'Récurrent',
          order.orders_this_month_count || 0,
          order.total_orders_count || 0,
          order.interne ? 'Oui' : 'Non',
          order.source_connaissance || 'Non renseigné',
          order.commentaire || '',
          serviceRating !== null ? serviceRating + '/10' : 'NA',
          qualityRating !== null ? qualityRating + '/10' : 'NA',
          priceRating !== null ? priceRating + '/10' : 'NA',
          commercialRating !== null ? commercialRating + '/10' : 'NA',
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
        '',                              // Interne
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
      const [monthlyData, dailyExpenses, dailyTypeStats] = await Promise.all([
        Order.getMonthlyDetailsByDay(month),
        Expense.getMonthlyExpensesByDay(month),
        Order.getDailyTypeStatsByMonth(month)
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
        { header: 'Type', key: 'type', width: 18 },
        { header: 'Commandes', key: 'commandes', width: 12 },
        { header: 'Courses (FCFA)', key: 'courses', width: 15 },
        { header: 'Supplément inclus', key: 'supplement', width: 25 },
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
      const typeMap = {};

      monthlyData.forEach(item => {
        const key = `${item.date}_${item.livreur}`;
        ordersMap[key] = item;
      });

      dailyExpenses.forEach(item => {
        const key = `${item.date}_${item.livreur}`;
        expensesMap[key] = item;
      });

      // Construire la map (date, livreur, type) -> count, total_amount et supplement
      dailyTypeStats.forEach(row => {
        const dateKey = row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date;
        const label = row.order_type === 'AUTRE' ? 'AUTRES' : row.order_type;
        const key = `${dateKey}_${row.livreur}_${label}`;
        typeMap[key] = {
          type: label,
          count: parseInt(row.count) || 0,
          total_amount: parseFloat(row.total_amount) || 0,
          total_supplements: parseFloat(row.total_supplements) || 0,
          supplement_types: row.supplement_types || null
        };
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

      // Ajouter les données ligne par ligne (une ligne par type de course)
      const allTypes = ['MLC simple', 'MLC avec abonnement', 'MATA client', 'MATA interne', 'AUTRES', 'AUTRE'];
      
      dates.forEach(date => {
        const formattedDate = new Date(date).toLocaleDateString('fr-FR', { 
          day: '2-digit', 
          month: '2-digit' 
        });
        
        livreurs.forEach(livreur => {
          const expenseKey = `${date}_${livreur}`;
          const gpsKey = `${date}_${livreur}`;
          
          const expenseData = expensesMap[expenseKey] || { carburant: 0, reparations: 0, police: 0, autres: 0, km_parcourus: 0 };
          const gpsData = gpsMap[gpsKey] || { total_distance_km: 0 };
          
          // Trouver tous les types pour ce livreur/date qui ont des données
          const typesForThisLivreurDate = allTypes.filter(type => {
            const typeKey = `${date}_${livreur}_${type}`;
            const typeData = typeMap[typeKey];
            return typeData && typeData.count > 0;
          });

          typesForThisLivreurDate.forEach((type, index) => {
            const typeKey = `${date}_${livreur}_${type}`;
            const typeData = typeMap[typeKey];
            
            // Afficher les dépenses seulement sur la première ligne de ce livreur/date
            const isFirstLineForLivreurDate = index === 0;
            const displayCarburant = isFirstLineForLivreurDate ? (expenseData.carburant || 0) : 0;
            const displayReparations = isFirstLineForLivreurDate ? (expenseData.reparations || 0) : 0;
            const displayPolice = isFirstLineForLivreurDate ? (expenseData.police || 0) : 0;
            const displayAutres = isFirstLineForLivreurDate ? (expenseData.autres || 0) : 0;
            const displayTotalDepenses = isFirstLineForLivreurDate ? ((expenseData.carburant || 0) + (expenseData.reparations || 0) + (expenseData.police || 0) + (expenseData.autres || 0)) : 0;
            const displayKmParcourus = isFirstLineForLivreurDate ? (expenseData.km_parcourus || 0) : 0;
            const displayGpsKm = isFirstLineForLivreurDate ? (gpsData.total_distance_km ? Math.round(gpsData.total_distance_km * 100) / 100 : 0) : 0;
            
            // Pour le bénéfice, on utilise le montant EXACT du type depuis l'API
            const courses = typeData.total_amount || 0;
            const benefice = courses - displayTotalDepenses;
            
            // Formater l'affichage du supplément
            let supplementDisplay = '';
            if (typeData.total_supplements > 0 && typeData.supplement_types) {
              supplementDisplay = typeData.supplement_types;
            } else if (typeData.total_supplements > 0) {
              supplementDisplay = `+${Math.round(typeData.total_supplements)}`;
            } else {
              supplementDisplay = '-';
            }
            
            const row = worksheet.addRow({
              date: formattedDate,
              livreur: livreur,
              type: typeData.type,
              commandes: typeData.count,
              courses: courses,
              supplement: supplementDisplay,
              carburant: displayCarburant,
              reparations: displayReparations,
              police: displayPolice,
              autres: displayAutres,
              total_depenses: displayTotalDepenses,
              km_parcourus: displayKmParcourus,
              gps_km: displayGpsKm,
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
        
        // Calculer la somme totale des suppléments pour ce livreur
        let totalSupplements = 0;
        Object.keys(typeMap).forEach(key => {
          if (key.includes(`_${livreur}_`)) {
            const typeData = typeMap[key];
            totalSupplements += typeData.total_supplements || 0;
          }
        });
        
        const supplementTotalDisplay = totalSupplements > 0 ? `+${Math.round(totalSupplements)}` : '-';
        
        const totalRow = worksheet.addRow({
          date: 'TOTAL',
          livreur: livreur,
          commandes: totalCommandes,
          courses: totalMontant,
          supplement: supplementTotalDisplay,
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

  // Export Excel des détails d'un client MLC
  static async exportMlcClientDetailsToExcel(req, res) {
    try {
      const { phoneNumber, startDate, endDate } = req.query;

      if (!phoneNumber || !startDate || !endDate) {
        return res.status(400).json({
          error: 'phoneNumber, startDate et endDate sont requis'
        });
      }

      // Récupérer les détails du client (même logique que getMlcClientDetails)
      const ordersQuery = `
        SELECT 
          o.id,
          o.client_name,
          o.phone_number,
          o.address,
          o.description,
          o.amount,
          o.course_price,
          o.order_type,
          o.subscription_id,
          o.created_at,
          u.username as creator_username,
          s.card_number,
          s.price as subscription_price,
          s.total_deliveries,
          CASE 
            WHEN o.subscription_id IS NOT NULL AND o.course_price > (s.price / s.total_deliveries) THEN true
            ELSE false
          END as has_supplement
        FROM orders o
        LEFT JOIN users u ON o.created_by = u.id
        LEFT JOIN subscriptions s ON o.subscription_id = s.id
        WHERE o.phone_number = $1
          AND DATE(o.created_at) BETWEEN $2 AND $3
          AND o.order_type = 'MLC'
          AND o.client_name != 'COMMANDE INTERNE'
        ORDER BY o.created_at DESC
      `;
      
      const db = require('../models/database');
      const result = await db.query(ordersQuery, [phoneNumber, startDate, endDate]);
      const orders = result.rows;

      if (!orders || orders.length === 0) {
        return res.status(404).json({
          error: 'Aucune commande trouvée pour ce client'
        });
      }

      // Créer un nouveau classeur Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Détails Client MLC');

      // Définir les colonnes
      worksheet.columns = [
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
          created_at: new Date(order.created_at).toLocaleString('fr-FR'),
          creator_username: order.creator_username || 'N/A',
          client_name: order.client_name,
          phone_number: order.phone_number,
          address: order.address || '',
          description: order.description || '',
          course_price: parseFloat(order.course_price) || 0,
          amount: order.amount || '',
          order_type: order.order_type
        });
      });

      // Ajouter une ligne de total
      const totalRow = orders.length + 3;
      worksheet.getCell(`G${totalRow}`).value = 'TOTAL:';
      worksheet.getCell(`G${totalRow}`).font = { bold: true };
      worksheet.getCell(`H${totalRow}`).value = orders.reduce((sum, order) => sum + (parseFloat(order.course_price) || 0), 0);
      worksheet.getCell(`H${totalRow}`).font = { bold: true };

      // Définir les en-têtes de réponse
      const fileName = `details_client_mlc_${phoneNumber}_${startDate}_${endDate}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      // Écrire le fichier dans la réponse
      await workbook.xlsx.write(res);
      res.end();

    } catch (error) {
      console.error('Erreur lors de l\'export Excel des détails client MLC:', error);
      res.status(500).json({
        error: 'Erreur lors de l\'export Excel des détails client MLC'
      });
    }
  }

  // Export Excel du tableau MLC complet
  static async exportMlcTableToExcel(req, res) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: 'Les paramètres startDate et endDate sont requis'
        });
      }

      console.log(`📊 Export Excel tableau MLC - Période: ${startDate} à ${endDate}`);

      // Utiliser la même requête que getMlcTable
      const mlcTableQuery = `
        WITH client_stats AS (
          SELECT 
            o.phone_number,
            MIN(o.client_name) as client_name, -- Premier nom par ordre alphabétique
            COUNT(*) as total_orders,
            MAX(o.created_at) as last_order_date,
            SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NOT NULL THEN 1 ELSE 0 END) as mlc_abonnement_count,
            SUM(CASE WHEN o.order_type = 'MLC' AND o.subscription_id IS NULL THEN 1 ELSE 0 END) as mlc_simple_count,
            SUM(CASE WHEN o.order_type = 'MLC' AND o.course_price > (
              CASE 
                WHEN o.subscription_id IS NOT NULL THEN 
                  (SELECT s.price / s.total_deliveries FROM subscriptions s WHERE s.id = o.subscription_id)
                ELSE 0
              END
            ) THEN 1 ELSE 0 END) as supplement_count
          FROM orders o
          WHERE DATE(o.created_at) BETWEEN $1 AND $2
            AND o.order_type = 'MLC'
            AND o.client_name != 'COMMANDE INTERNE'
            AND o.phone_number != '0000000000'
          GROUP BY o.phone_number
        ),
        active_packs AS (
          SELECT 
            s.phone_number,
            s.id as subscription_id,
            s.total_deliveries,
            s.used_deliveries,
            (s.total_deliveries - s.used_deliveries) as remaining_deliveries,
            s.is_active
          FROM subscriptions s
          WHERE s.is_active = true
            AND s.used_deliveries < s.total_deliveries
        )
        SELECT 
          cs.phone_number,
          cs.client_name,
          cs.total_orders,
          cs.last_order_date,
          cs.mlc_abonnement_count,
          cs.mlc_simple_count,
          cs.supplement_count,
          CASE 
            WHEN ap.subscription_id IS NOT NULL THEN 
              CONCAT(ap.remaining_deliveries, '/', ap.total_deliveries)
            ELSE NULL
          END as active_pack_info
        FROM client_stats cs
        LEFT JOIN active_packs ap ON cs.phone_number = ap.phone_number
        ORDER BY cs.client_name ASC
      `;

      const db = require('../models/database');
      const result = await db.query(mlcTableQuery, [startDate, endDate]);
      const clients = result.rows;

      // Créer le fichier Excel
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Tableau MLC');

      // Définir les colonnes
      worksheet.columns = [
        { header: 'Nom du client', key: 'client_name', width: 25 },
        { header: 'Numéro de téléphone', key: 'phone_number', width: 18 },
        { header: 'Total des commandes', key: 'total_orders', width: 18 },
        { header: 'Date dernière commande', key: 'last_order_date', width: 20 },
        { header: 'MLC abonnement', key: 'mlc_abonnement_count', width: 15 },
        { header: 'MLC simple', key: 'mlc_simple_count', width: 12 },
        { header: 'Ajouter supplément', key: 'supplement_count', width: 18 },
        { header: 'Pack (restant)', key: 'active_pack_info', width: 15 }
      ];

      // Style des en-têtes
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE3F2FD' }
      };

      // Ajouter les données
      clients.forEach(client => {
        const row = worksheet.addRow({
          client_name: client.client_name,
          phone_number: client.phone_number,
          total_orders: client.total_orders,
          last_order_date: new Date(client.last_order_date).toLocaleDateString('fr-FR'),
          mlc_abonnement_count: client.mlc_abonnement_count,
          mlc_simple_count: client.mlc_simple_count,
          supplement_count: client.supplement_count,
          active_pack_info: client.active_pack_info || '-'
        });
      });

      // Ajouter une ligne de totaux
      const totalRow = worksheet.addRow({
        client_name: 'TOTAL',
        phone_number: '',
        total_orders: clients.reduce((sum, client) => sum + parseInt(client.total_orders), 0),
        last_order_date: '',
        mlc_abonnement_count: clients.reduce((sum, client) => sum + parseInt(client.mlc_abonnement_count), 0),
        mlc_simple_count: clients.reduce((sum, client) => sum + parseInt(client.mlc_simple_count), 0),
        supplement_count: clients.reduce((sum, client) => sum + parseInt(client.supplement_count), 0),
        active_pack_info: ''
      });

      // Style de la ligne de totaux
      totalRow.font = { bold: true };
      totalRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3E0' }
      };

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
      const filename = `tableau_mlc_${startDate.replace(/-/g, '')}_${endDate.replace(/-/g, '')}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Écrire le fichier dans la réponse
      await workbook.xlsx.write(res);
      res.end();

    } catch (error) {
      console.error('Erreur lors de l\'export Excel du tableau MLC:', error);
      res.status(500).json({
        error: 'Erreur lors de l\'export Excel du tableau MLC'
      });
    }
  }
}

module.exports = OrderController; 