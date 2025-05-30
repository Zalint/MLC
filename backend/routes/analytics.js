const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { authenticateToken, requireManagerOrAdmin } = require('../middleware/auth');
const fs = require('fs').promises;
const path = require('path');

// 🎯 Fichier de configuration des pondérations
const SCORE_WEIGHTS_FILE = path.join(__dirname, '../config/score-weights.json');

// 🎯 Pondérations pour le calcul du score global (chargées depuis le fichier)
let SCORE_WEIGHTS = {
    COURSES: 0.4,           // Points par course
    PROFIT: 0.0002,         // Points par FCFA de bénéfice
    REVENUE: 0.0001         // Points par FCFA de revenu (pour compatibilité)
};

// Charger les pondérations depuis le fichier au démarrage
async function loadScoreWeights() {
    try {
        const data = await fs.readFile(SCORE_WEIGHTS_FILE, 'utf8');
        const config = JSON.parse(data);
        SCORE_WEIGHTS.COURSES = config.COURSES;
        SCORE_WEIGHTS.PROFIT = config.PROFIT;
        console.log('🎯 Pondérations chargées depuis le fichier:', SCORE_WEIGHTS);
    } catch (error) {
        console.log('⚠️ Fichier de pondérations non trouvé, utilisation des valeurs par défaut');
        await saveScoreWeights(SCORE_WEIGHTS.COURSES, SCORE_WEIGHTS.PROFIT, 'SYSTEM');
    }
}

// Sauvegarder les pondérations dans le fichier
async function saveScoreWeights(courses, profit, updatedBy = 'USER') {
    try {
        const config = {
            COURSES: courses,
            PROFIT: profit,
            lastUpdated: new Date().toISOString(),
            updatedBy: updatedBy
        };
        
        await fs.writeFile(SCORE_WEIGHTS_FILE, JSON.stringify(config, null, 2));
        console.log('💾 Pondérations sauvegardées:', config);
        return true;
    } catch (error) {
        console.error('❌ Erreur lors de la sauvegarde des pondérations:', error);
        return false;
    }
}

// Initialiser les pondérations au chargement du module
loadScoreWeights();

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// GET /api/analytics/summary - Statistiques globales (alias pour /global)
router.get('/summary', requireManagerOrAdmin, async (req, res) => {
    try {
        const { startDate, endDate, livreurId, orderType } = req.query;
        
        let orderWhereClause = '1=1';
        let expenseWhereClause = '1=1';
        let orderParams = [];
        let expenseParams = [];
        
        if (startDate) {
            orderWhereClause += ` AND DATE(orders.created_at) >= $1`;
            expenseWhereClause += ` AND DATE(expenses.expense_date) >= $1`;
            orderParams.push(startDate);
            expenseParams.push(startDate);
        }
        
        if (endDate) {
            orderWhereClause += ` AND DATE(orders.created_at) <= $${orderParams.length + 1}`;
            expenseWhereClause += ` AND DATE(expenses.expense_date) <= $${expenseParams.length + 1}`;
            orderParams.push(endDate);
            expenseParams.push(endDate);
        }
        
        if (livreurId) {
            orderWhereClause += ` AND orders.created_by = $${orderParams.length + 1}`;
            expenseWhereClause += ` AND expenses.livreur_id = $${expenseParams.length + 1}`;
            orderParams.push(livreurId);
            expenseParams.push(livreurId);
        }
        
        if (orderType) {
            if (orderType === 'MLC_SUBSCRIPTION') {
                orderWhereClause += ` AND orders.order_type = 'MLC' AND orders.subscription_id IS NOT NULL`;
            } else if (orderType === 'MLC') {
                orderWhereClause += ` AND orders.order_type = 'MLC' AND orders.subscription_id IS NULL`;
            } else {
                orderWhereClause += ` AND orders.order_type = $${orderParams.length + 1}`;
                orderParams.push(orderType);
            }
        }

        // Statistiques des commandes
        const ordersResult = await db.query(`
            SELECT 
                COUNT(*) as totalOrders,
                COALESCE(SUM(course_price), 0) as totalRevenue,
                COALESCE(AVG(course_price), 0) as avgOrderValue,
                COUNT(DISTINCT created_by) as activeLivreurs
            FROM orders 
            WHERE ${orderWhereClause}
        `, orderParams);

        const ordersStats = ordersResult.rows[0];

        // Statistiques des dépenses et kilomètres
        const expensesResult = await db.query(`
            SELECT 
                COALESCE(SUM(carburant + reparations + police + autres), 0) as totalExpenses,
                COALESCE(SUM(carburant), 0) as fuelExpenses,
                COALESCE(SUM(km_parcourus), 0) as totalKm
            FROM expenses 
            WHERE ${expenseWhereClause}
        `, expenseParams);

        const expensesStats = expensesResult.rows[0];

        // Bénéfices nets
        const totalProfit = (parseFloat(ordersStats?.totalrevenue) || 0) - (parseFloat(expensesStats?.totalexpenses) || 0);

        res.json({
            totalOrders: parseInt(ordersStats?.totalorders) || 0,
            totalRevenue: parseFloat(ordersStats?.totalrevenue) || 0,
            avgOrderValue: parseFloat(ordersStats?.avgordervalue) || 0,
            activeLivreurs: parseInt(ordersStats?.activelivreurs) || 0,
            totalKm: parseFloat(expensesStats?.totalkm) || 0,
            totalExpenses: parseFloat(expensesStats?.totalexpenses) || 0,
            fuelExpenses: parseFloat(expensesStats?.fuelexpenses) || 0,
            totalProfit: totalProfit
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques globales:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// GET /api/analytics/global - Statistiques globales
router.get('/global', requireManagerOrAdmin, async (req, res) => {
    try {
        const { startDate, endDate, livreurId, orderType } = req.query;
        
        let orderWhereClause = '1=1';
        let expenseWhereClause = '1=1';
        let orderParams = [];
        let expenseParams = [];
        
        if (startDate) {
            orderWhereClause += ` AND DATE(orders.created_at) >= $1`;
            expenseWhereClause += ` AND DATE(expenses.expense_date) >= $1`;
            orderParams.push(startDate);
            expenseParams.push(startDate);
        }
        
        if (endDate) {
            orderWhereClause += ` AND DATE(orders.created_at) <= $${orderParams.length + 1}`;
            expenseWhereClause += ` AND DATE(expenses.expense_date) <= $${expenseParams.length + 1}`;
            orderParams.push(endDate);
            expenseParams.push(endDate);
        }
        
        if (livreurId) {
            orderWhereClause += ` AND orders.created_by = $${orderParams.length + 1}`;
            expenseWhereClause += ` AND expenses.livreur_id = $${expenseParams.length + 1}`;
            orderParams.push(livreurId);
            expenseParams.push(livreurId);
        }
        
        if (orderType) {
            if (orderType === 'MLC_SUBSCRIPTION') {
                orderWhereClause += ` AND orders.order_type = 'MLC' AND orders.subscription_id IS NOT NULL`;
            } else if (orderType === 'MLC') {
                orderWhereClause += ` AND orders.order_type = 'MLC' AND orders.subscription_id IS NULL`;
            } else {
                orderWhereClause += ` AND orders.order_type = $${orderParams.length + 1}`;
                orderParams.push(orderType);
            }
        }

        // Statistiques des commandes
        const ordersResult = await db.query(`
            SELECT 
                COUNT(*) as totalOrders,
                COALESCE(SUM(course_price), 0) as totalRevenue
            FROM orders 
            WHERE ${orderWhereClause}
        `, orderParams);

        const ordersStats = ordersResult.rows[0];

        // Statistiques des dépenses et kilomètres
        const expensesResult = await db.query(`
            SELECT 
                COALESCE(SUM(carburant + reparations + police + autres), 0) as totalExpenses,
                COALESCE(SUM(carburant), 0) as fuelExpenses,
                COALESCE(SUM(km_parcourus), 0) as totalKm
            FROM expenses 
            WHERE ${expenseWhereClause}
        `, expenseParams);

        const expensesStats = expensesResult.rows[0];

        // Bénéfices nets
        const totalProfit = (parseFloat(ordersStats?.totalrevenue) || 0) - (parseFloat(expensesStats?.totalexpenses) || 0);

        res.json({
            totalOrders: parseInt(ordersStats?.totalorders) || 0,
            totalRevenue: parseFloat(ordersStats?.totalrevenue) || 0,
            totalKm: parseFloat(expensesStats?.totalkm) || 0,
            totalExpenses: parseFloat(expensesStats?.totalexpenses) || 0,
            fuelExpenses: parseFloat(expensesStats?.fuelexpenses) || 0,
            totalProfit: totalProfit
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques globales:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// GET /api/analytics/by-type - Analyse par type de course
router.get('/by-type', requireManagerOrAdmin, async (req, res) => {
    try {
        const { startDate, endDate, livreurId } = req.query;
        
        let whereClause = '1=1';
        let params = [];
        let paramIndex = 1;
        
        if (startDate) {
            whereClause += ` AND DATE(orders.created_at) >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }
        
        if (endDate) {
            whereClause += ` AND DATE(orders.created_at) <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }
        
        if (livreurId) {
            whereClause += ` AND orders.created_by = $${paramIndex}`;
            params.push(livreurId);
            paramIndex++;
        }

        const result = await db.query(`
            SELECT 
                CASE 
                    WHEN order_type = 'MLC' AND subscription_id IS NOT NULL THEN 'MLC_SUBSCRIPTION'
                    ELSE order_type 
                END as type,
                COUNT(*) as count,
                COALESCE(SUM(course_price), 0) as revenue,
                0 as totalKm
            FROM orders 
            WHERE ${whereClause}
            GROUP BY 
                CASE 
                    WHEN order_type = 'MLC' AND subscription_id IS NOT NULL THEN 'MLC_SUBSCRIPTION'
                    ELSE order_type 
                END
            ORDER BY count DESC
        `, params);

        res.json(result.rows);
    } catch (error) {
        console.error('Erreur lors de l\'analyse par type:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// GET /api/analytics/ranking - Classements des livreurs
router.get('/ranking', requireManagerOrAdmin, async (req, res) => {
    try {
        const { startDate, endDate, orderType } = req.query;
        
        let whereClause = '1=1';
        let params = [];
        let paramIndex = 1;
        
        if (startDate) {
            whereClause += ` AND DATE(orders.created_at) >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }
        
        if (endDate) {
            whereClause += ` AND DATE(orders.created_at) <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }
        
        if (orderType) {
            if (orderType === 'MLC_SUBSCRIPTION') {
                whereClause += ` AND orders.order_type = 'MLC' AND orders.subscription_id IS NOT NULL`;
            } else if (orderType === 'MLC') {
                whereClause += ` AND orders.order_type = 'MLC' AND orders.subscription_id IS NULL`;
            } else {
                whereClause += ` AND orders.order_type = $${paramIndex}`;
                params.push(orderType);
                paramIndex++;
            }
        }

        // Classement global (combinant plusieurs métriques)
        // Requête avec sous-requête pour calculer dépenses et bénéfice net
        const globalResult = await db.query(`
            WITH livreur_stats AS (
                SELECT 
                    users.id,
                    users.username,
                    COUNT(orders.id) as total_orders,
                    COALESCE(SUM(orders.course_price), 0) as total_revenue
                FROM users 
                LEFT JOIN orders ON users.id = orders.created_by
                WHERE users.role = 'LIVREUR' AND ${whereClause}
                GROUP BY users.id, users.username
                HAVING COUNT(orders.id) > 0
            ),
            livreur_expenses AS (
                SELECT 
                    users.id,
                    COALESCE(SUM(expenses.carburant + expenses.reparations + expenses.police + expenses.autres), 0) as total_expenses
                FROM users 
                LEFT JOIN expenses ON users.id = expenses.livreur_id
                WHERE users.role = 'LIVREUR'
                ${startDate ? `AND DATE(expenses.expense_date) >= $${params.indexOf(startDate) + 1}` : ''}
                ${endDate ? `AND DATE(expenses.expense_date) <= $${params.indexOf(endDate) + 1}` : ''}
                GROUP BY users.id
            )
            SELECT 
                ls.username,
                ls.id,
                ls.total_orders as totalOrders,
                ls.total_revenue as totalRevenue,
                COALESCE(le.total_expenses, 0) as totalExpenses,
                (ls.total_revenue - COALESCE(le.total_expenses, 0)) as netProfit,
                0 as totalKm,
                COALESCE(ls.total_revenue / ls.total_orders, 0) as avgOrderValue,
                -- Score global basé sur courses et bénéfice net
                (ls.total_orders * ${SCORE_WEIGHTS.COURSES} + 
                 (ls.total_revenue - COALESCE(le.total_expenses, 0)) * ${SCORE_WEIGHTS.PROFIT}) as globalScore
            FROM livreur_stats ls
            LEFT JOIN livreur_expenses le ON ls.id = le.id
            ORDER BY globalScore DESC
            LIMIT 10
        `, params);

        // Classement par nombre de courses
        const ordersResult = await db.query(`
            SELECT 
                users.username,
                users.id,
                COUNT(orders.id) as totalOrders,
                COALESCE(SUM(orders.course_price), 0) as totalRevenue
            FROM users 
            LEFT JOIN orders ON users.id = orders.created_by
            WHERE users.role = 'LIVREUR' AND ${whereClause}
            GROUP BY users.id, users.username
            HAVING COUNT(orders.id) > 0
            ORDER BY totalOrders DESC
            LIMIT 10
        `, params);

        // Classement par revenus
        const revenueResult = await db.query(`
            SELECT 
                users.username,
                users.id,
                COUNT(orders.id) as totalOrders,
                COALESCE(SUM(orders.course_price), 0) as totalRevenue
            FROM users 
            LEFT JOIN orders ON users.id = orders.created_by
            WHERE users.role = 'LIVREUR' AND ${whereClause}
            GROUP BY users.id, users.username
            HAVING COALESCE(SUM(orders.course_price), 0) > 0
            ORDER BY totalRevenue DESC
            LIMIT 10
        `, params);

        // Classement par kilomètres - requête séparée
        let kmWhereClause = '1=1';
        let kmParams = [];
        let kmParamIndex = 1;
        
        if (startDate) {
            kmWhereClause += ` AND DATE(expenses.expense_date) >= $${kmParamIndex}`;
            kmParams.push(startDate);
            kmParamIndex++;
        }
        
        if (endDate) {
            kmWhereClause += ` AND DATE(expenses.expense_date) <= $${kmParamIndex}`;
            kmParams.push(endDate);
            kmParamIndex++;
        }

        const kmResult = await db.query(`
            SELECT 
                users.username,
                users.id,
                COALESCE(SUM(expenses.km_parcourus), 0) as totalKm,
                COUNT(DISTINCT orders.id) as totalOrders
            FROM users 
            LEFT JOIN expenses ON users.id = expenses.livreur_id
            LEFT JOIN orders ON users.id = orders.created_by
            WHERE users.role = 'LIVREUR' AND ${kmWhereClause}
            GROUP BY users.id, users.username
            HAVING COALESCE(SUM(expenses.km_parcourus), 0) > 0
            ORDER BY totalKm DESC
            LIMIT 10
        `, kmParams);

        // Classement par bénéfice net avec salaire
        const netProfitWithSalaryResult = await db.query(`
            WITH livreur_stats AS (
                SELECT 
                    users.id,
                    users.username,
                    COUNT(orders.id) as total_orders,
                    COALESCE(SUM(orders.course_price), 0) as total_revenue
                FROM users 
                LEFT JOIN orders ON users.id = orders.created_by
                WHERE users.role = 'LIVREUR' AND ${whereClause}
                GROUP BY users.id, users.username
            ),
            livreur_expenses AS (
                SELECT 
                    users.id,
                    COALESCE(SUM(expenses.carburant + expenses.reparations + expenses.police + expenses.autres), 0) as total_expenses
                FROM users 
                LEFT JOIN expenses ON users.id = expenses.livreur_id
                WHERE users.role = 'LIVREUR'
                ${startDate ? `AND DATE(expenses.expense_date) >= $${params.indexOf(startDate) + 1}` : ''}
                ${endDate ? `AND DATE(expenses.expense_date) <= $${params.indexOf(endDate) + 1}` : ''}
                GROUP BY users.id
            ),
            livreur_salaries AS (
                SELECT 
                    users.id,
                    COALESCE(
                        (SELECT amount 
                         FROM salaries 
                         WHERE user_id = users.id 
                         ORDER BY effective_date DESC, created_at DESC 
                         LIMIT 1), 0
                    ) as current_salary
                FROM users 
                WHERE users.role = 'LIVREUR'
            )
            SELECT 
                ls.username,
                ls.id,
                ls.total_orders as totalOrders,
                ls.total_revenue as totalRevenue,
                COALESCE(le.total_expenses, 0) as totalExpenses,
                (ls.total_revenue - COALESCE(le.total_expenses, 0)) as netProfit,
                lsal.current_salary as currentSalary,
                -- Calculer le nombre de jours du mois en cours
                EXTRACT(DAY FROM DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day') as daysInMonth,
                -- Calculer le nombre de jours dans la période
                CASE 
                    WHEN $${params.length + 1}::date IS NOT NULL AND $${params.length + 2}::date IS NOT NULL THEN
                        ($${params.length + 2}::date - $${params.length + 1}::date) + 1
                    ELSE 
                        EXTRACT(DAY FROM DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')
                END as periodDays,
                -- Calculer le coût du salaire pour la période
                (lsal.current_salary / 
                 EXTRACT(DAY FROM DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')
                ) * 
                CASE 
                    WHEN $${params.length + 1}::date IS NOT NULL AND $${params.length + 2}::date IS NOT NULL THEN
                        ($${params.length + 2}::date - $${params.length + 1}::date) + 1
                    ELSE 
                        EXTRACT(DAY FROM DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')
                END as periodSalaryCost,
                -- Bénéfice net avec salaire
                (ls.total_revenue - COALESCE(le.total_expenses, 0) - 
                 (lsal.current_salary / 
                  EXTRACT(DAY FROM DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')
                 ) * 
                 CASE 
                     WHEN $${params.length + 1}::date IS NOT NULL AND $${params.length + 2}::date IS NOT NULL THEN
                         ($${params.length + 2}::date - $${params.length + 1}::date) + 1
                     ELSE 
                         EXTRACT(DAY FROM DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')
                 END
                ) as netProfitWithSalary
            FROM livreur_stats ls
            LEFT JOIN livreur_expenses le ON ls.id = le.id
            LEFT JOIN livreur_salaries lsal ON ls.id = lsal.id
            WHERE ls.total_orders > 0
            ORDER BY netProfitWithSalary DESC
            LIMIT 10
        `, [...params, startDate || null, endDate || null]);

        res.json({
            global: globalResult.rows,
            orders: ordersResult.rows,
            revenue: revenueResult.rows,
            km: kmResult.rows,
            netProfitWithSalary: netProfitWithSalaryResult.rows
        });
    } catch (error) {
        console.error('Erreur lors du calcul des classements:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// GET /api/analytics/livreur-details - Détails par livreur
router.get('/livreur-details', requireManagerOrAdmin, async (req, res) => {
    try {
        console.log('🔍 Route livreur-details appelée avec query:', req.query);
        const { startDate, endDate } = req.query;
        
        let whereClause = '1=1';
        let params = [];
        let paramIndex = 1;
        
        if (startDate) {
            whereClause += ` AND DATE(orders.created_at) >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }
        
        if (endDate) {
            whereClause += ` AND DATE(orders.created_at) <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }

        console.log('🔍 whereClause construit:', whereClause);
        console.log('🔍 params:', params);

        // Test pour voir s'il y a des commandes dans la base
        const testOrdersResult = await db.query(`
            SELECT 
                COUNT(*) as total_orders,
                MIN(created_at) as earliest_order,
                MAX(created_at) as latest_order
            FROM orders
        `);
        console.log('🔍 Test - Total commandes dans la base:', testOrdersResult.rows[0]);

        // Test pour voir les commandes par livreur
        const testLivreurOrdersResult = await db.query(`
            SELECT 
                users.username,
                COUNT(orders.id) as order_count,
                SUM(orders.course_price) as total_revenue
            FROM users 
            LEFT JOIN orders ON users.id = orders.created_by
            WHERE users.role = 'LIVREUR'
            GROUP BY users.id, users.username
            ORDER BY order_count DESC
        `);
        console.log('🔍 Test - Commandes par livreur (sans filtres):');
        testLivreurOrdersResult.rows.forEach(row => {
            console.log(`   ${row.username}: ${row.order_count} commandes, ${row.total_revenue} FCFA`);
        });

        const sqlQuery = `
            SELECT 
                users.id,
                users.username,
                COUNT(orders.id) as totalOrders,
                COALESCE(SUM(orders.course_price), 0) as totalRevenue,
                COALESCE(AVG(orders.course_price), 0) as avgOrderValue,
                COALESCE(SUM(CASE WHEN orders.order_type = 'MATA' THEN 1 ELSE 0 END), 0) as mataOrders,
                COALESCE(SUM(CASE WHEN orders.order_type = 'MLC' AND orders.subscription_id IS NULL THEN 1 ELSE 0 END), 0) as mlcOrders,
                COALESCE(SUM(CASE WHEN orders.order_type = 'MLC' AND orders.subscription_id IS NOT NULL THEN 1 ELSE 0 END), 0) as mlcSubscriptionOrders,
                COALESCE(SUM(CASE WHEN orders.order_type = 'AUTRE' THEN 1 ELSE 0 END), 0) as autreOrders
            FROM users 
            LEFT JOIN orders ON users.id = orders.created_by 
                ${params.length > 0 ? `AND ${whereClause}` : ''}
            WHERE users.role = 'LIVREUR'
            GROUP BY users.id, users.username
            ORDER BY totalRevenue DESC
        `;

        console.log('🔍 Requête SQL complète:', sqlQuery);
        console.log('🔍 Paramètres de la requête:', params);

        const result = await db.query(sqlQuery, params);

        console.log('🔍 Résultats de la base de données:');
        console.log('🔍 Nombre de lignes retournées:', result.rows.length);
        result.rows.forEach((row, index) => {
            console.log(`🔍 Livreur ${index + 1}:`, {
                username: row.username,
                totalOrders: row.totalorders,
                totalRevenue: row.totalrevenue,
                avgOrderValue: row.avgordervalue
            });
        });

        const livreurDetails = result.rows;

        // Ajouter les dépenses et kilomètres par livreur
        for (let livreur of livreurDetails) {
            let expenseWhereClause = '1=1';
            let expenseParams = [livreur.id];
            let expenseParamIndex = 2;
            
            if (startDate) {
                expenseWhereClause += ` AND DATE(expenses.expense_date) >= $${expenseParamIndex}`;
                expenseParams.push(startDate);
                expenseParamIndex++;
            }
            
            if (endDate) {
                expenseWhereClause += ` AND DATE(expenses.expense_date) <= $${expenseParamIndex}`;
                expenseParams.push(endDate);
                expenseParamIndex++;
            }

            const expensesResult = await db.query(`
                SELECT 
                    COALESCE(SUM(carburant + reparations + police + autres), 0) as totalExpenses,
                    COALESCE(SUM(carburant), 0) as fuelExpenses,
                    COALESCE(SUM(police), 0) as policeExpenses,
                    COALESCE(SUM(reparations), 0) as repairExpenses,
                    COALESCE(SUM(km_parcourus), 0) as totalKm
                FROM expenses 
                WHERE livreur_id = $1 AND ${expenseWhereClause}
            `, expenseParams);
            
            // Récupérer le salaire actuel du livreur
            const salaryResult = await db.query(`
                SELECT amount 
                FROM salaries 
                WHERE user_id = $1 
                ORDER BY effective_date DESC, created_at DESC 
                LIMIT 1
            `, [livreur.id]);
            
            const expenses = expensesResult.rows[0];
            const currentSalary = salaryResult.rows.length > 0 ? parseFloat(salaryResult.rows[0].amount) : 0;
            
            // Calculer le nombre de jours dans la période sélectionnée
            let periodDays = 1;
            if (startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                periodDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1; // +1 pour inclure le jour de fin
            } else if (startDate) {
                const start = new Date(startDate);
                const today = new Date();
                periodDays = Math.ceil((today - start) / (1000 * 60 * 60 * 24)) + 1;
            } else if (endDate) {
                // Si seulement endDate, assumons le mois en cours par défaut
                const currentDate = new Date();
                const daysInCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
                periodDays = daysInCurrentMonth;
            } else {
                // Aucune date spécifiée, assumons le mois en cours par défaut
                const currentDate = new Date();
                const daysInCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
                periodDays = daysInCurrentMonth;
            }
            
            // Calculer le nombre de jours du mois en cours pour le salaire journalier
            const currentDate = new Date();
            const daysInCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
            
            // Calculer le salaire journalier lissé (salaire mensuel / nombre de jours du mois)
            const dailySalary = currentSalary / daysInCurrentMonth;
            const periodSalaryCost = dailySalary * periodDays;
            
            livreur.totalExpenses = parseFloat(expenses?.totalexpenses) || 0;
            livreur.fuelExpenses = parseFloat(expenses?.fuelexpenses) || 0;
            livreur.policeExpenses = parseFloat(expenses?.policeexpenses) || 0;
            livreur.repairExpenses = parseFloat(expenses?.repairexpenses) || 0;
            livreur.totalKm = parseFloat(expenses?.totalkm) || 0;
            livreur.netProfit = parseFloat(livreur.totalrevenue) - livreur.totalExpenses;
            
            // Nouveaux champs pour le salaire
            livreur.currentSalary = currentSalary;
            livreur.dailySalary = dailySalary;
            livreur.periodSalaryCost = periodSalaryCost;
            livreur.netProfitWithSalary = livreur.netProfit - periodSalaryCost;
        }

        console.log('🔍 Données finales envoyées au frontend:');
        livreurDetails.forEach((livreur, index) => {
            console.log(`🔍 ${livreur.username}:`, {
                totalOrders: livreur.totalorders,
                totalRevenue: livreur.totalrevenue,
                totalExpenses: livreur.totalExpenses,
                netProfit: livreur.netProfit
            });
        });

        res.json(livreurDetails);
    } catch (error) {
        console.error('Erreur lors de la récupération des détails par livreur:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// GET /api/analytics/compare - Comparaison entre deux livreurs
router.get('/compare', requireManagerOrAdmin, async (req, res) => {
    try {
        const { livreur1Id, livreur2Id, startDate, endDate } = req.query;
        
        if (!livreur1Id || !livreur2Id) {
            return res.status(400).json({ error: 'Les IDs des deux livreurs sont requis' });
        }

        const getStats = async (livreurId) => {
            let orderWhereClause = '1=1';
            let orderParams = [livreurId];
            let orderParamIndex = 2;
            
            if (startDate) {
                orderWhereClause += ` AND DATE(orders.created_at) >= $${orderParamIndex}`;
                orderParams.push(startDate);
                orderParamIndex++;
            }
            
            if (endDate) {
                orderWhereClause += ` AND DATE(orders.created_at) <= $${orderParamIndex}`;
                orderParams.push(endDate);
                orderParamIndex++;
            }

            const orderResult = await db.query(`
                SELECT 
                    users.username,
                    COUNT(orders.id) as totalOrders,
                    COALESCE(SUM(orders.course_price), 0) as totalRevenue,
                    COALESCE(AVG(orders.course_price), 0) as avgOrderValue
                FROM users 
                LEFT JOIN orders ON users.id = orders.created_by 
                    ${orderParams.length > 1 ? `AND ${orderWhereClause}` : ''}
                WHERE users.id = $1
                GROUP BY users.id, users.username
            `, orderParams);

            const orderStats = orderResult.rows[0];

            let expenseWhereClause = '1=1';
            let expenseParams = [livreurId];
            let expenseParamIndex = 2;
            
            if (startDate) {
                expenseWhereClause += ` AND DATE(expenses.expense_date) >= $${expenseParamIndex}`;
                expenseParams.push(startDate);
                expenseParamIndex++;
            }
            
            if (endDate) {
                expenseWhereClause += ` AND DATE(expenses.expense_date) <= $${expenseParamIndex}`;
                expenseParams.push(endDate);
                expenseParamIndex++;
            }

            const expensesResult = await db.query(`
                SELECT 
                    COALESCE(SUM(carburant + reparations + police + autres), 0) as totalExpenses,
                    COALESCE(SUM(carburant), 0) as fuelExpenses,
                    COALESCE(SUM(km_parcourus), 0) as totalKm
                FROM expenses 
                WHERE livreur_id = $1 AND ${expenseWhereClause}
            `, expenseParams);

            const expenses = expensesResult.rows[0];

            return {
                ...orderStats,
                totalExpenses: parseFloat(expenses?.totalexpenses) || 0,
                fuelExpenses: parseFloat(expenses?.fuelexpenses) || 0,
                totalKm: parseFloat(expenses?.totalkm) || 0,
                netProfit: (parseFloat(orderStats?.totalrevenue) || 0) - (parseFloat(expenses?.totalexpenses) || 0)
            };
        };

        const livreur1Stats = await getStats(livreur1Id);
        const livreur2Stats = await getStats(livreur2Id);

        res.json({
            livreur1: livreur1Stats,
            livreur2: livreur2Stats
        });
    } catch (error) {
        console.error('Erreur lors de la comparaison des livreurs:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// GET /api/analytics/score-weights - Obtenir les pondérations actuelles
router.get('/score-weights', requireManagerOrAdmin, (req, res) => {
    res.json({
        weights: SCORE_WEIGHTS,
        formula: `Score = (Nombre de courses × ${SCORE_WEIGHTS.COURSES}) + (Bénéfice net × ${SCORE_WEIGHTS.PROFIT})`,
        description: {
            COURSES: `Chaque course rapporte ${SCORE_WEIGHTS.COURSES} points`,
            PROFIT: `Chaque FCFA de bénéfice net rapporte ${SCORE_WEIGHTS.PROFIT} points`,
            example: `Exemple: 5 courses + 10000 FCFA de bénéfice = (5 × ${SCORE_WEIGHTS.COURSES}) + (10000 × ${SCORE_WEIGHTS.PROFIT}) = ${5 * SCORE_WEIGHTS.COURSES + 10000 * SCORE_WEIGHTS.PROFIT} points`
        }
    });
});

// PUT /api/analytics/score-weights - Modifier les pondérations
router.put('/score-weights', requireManagerOrAdmin, async (req, res) => {
    try {
        const { courses, profit } = req.body;
        
        // Validation des valeurs
        if (typeof courses !== 'number' || typeof profit !== 'number') {
            return res.status(400).json({ error: 'Les pondérations doivent être des nombres' });
        }
        
        if (courses < 0 || profit < 0) {
            return res.status(400).json({ error: 'Les pondérations ne peuvent pas être négatives' });
        }
        
        if (courses > 10 || profit > 1) {
            return res.status(400).json({ error: 'Valeurs trop élevées. Max: courses=10, profit=1' });
        }
        
        // Mettre à jour les pondérations en mémoire
        SCORE_WEIGHTS.COURSES = courses;
        SCORE_WEIGHTS.PROFIT = profit;
        
        // Sauvegarder dans le fichier
        const username = req.user ? req.user.username : 'UNKNOWN';
        const saved = await saveScoreWeights(courses, profit, username);
        
        if (!saved) {
            return res.status(500).json({ error: 'Erreur lors de la sauvegarde des pondérations' });
        }
        
        console.log('🎯 Pondérations mises à jour par', username, ':', SCORE_WEIGHTS);
        
        res.json({
            success: true,
            message: 'Pondérations mises à jour avec succès',
            weights: SCORE_WEIGHTS,
            formula: `Score = (Nombre de courses × ${SCORE_WEIGHTS.COURSES}) + (Bénéfice net × ${SCORE_WEIGHTS.PROFIT})`,
            description: {
                COURSES: `Chaque course rapporte ${SCORE_WEIGHTS.COURSES} points`,
                PROFIT: `Chaque FCFA de bénéfice net rapporte ${SCORE_WEIGHTS.PROFIT} points`,
                example: `Exemple: 5 courses + 10000 FCFA de bénéfice = (5 × ${SCORE_WEIGHTS.COURSES}) + (10000 × ${SCORE_WEIGHTS.PROFIT}) = ${5 * SCORE_WEIGHTS.COURSES + 10000 * SCORE_WEIGHTS.PROFIT} points`
            }
        });
        
    } catch (error) {
        console.error('Erreur lors de la mise à jour des pondérations:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

module.exports = router; 