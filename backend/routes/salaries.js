const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { authenticateToken, requireManagerOrAdmin } = require('../middleware/auth');

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// GET /api/salaries - Obtenir l'historique des salaires
router.get('/', requireManagerOrAdmin, async (req, res) => {
    try {
        const { livreurId } = req.query;
        
        let whereClause = '1=1';
        let params = [];
        
        if (livreurId) {
            whereClause += ' AND salaries.user_id = $1';
            params.push(livreurId);
        }
        
        const result = await db.query(`
            SELECT 
                salaries.*,
                users.username as livreur_name,
                users_manager.username as created_by_name
            FROM salaries
            LEFT JOIN users ON salaries.user_id = users.id
            LEFT JOIN users as users_manager ON salaries.created_by = users_manager.id
            WHERE ${whereClause}
            ORDER BY salaries.effective_date DESC, salaries.created_at DESC
        `, params);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Erreur lors de la récupération des salaires:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// GET /api/salaries/current - Obtenir les salaires actuels de tous les livreurs
router.get('/current', requireManagerOrAdmin, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                users.id,
                users.username,
                s1.amount as current_salary,
                s1.effective_date,
                s1.created_at
            FROM users
            LEFT JOIN salaries s1 ON users.id = s1.user_id
            LEFT JOIN salaries s2 ON (users.id = s2.user_id 
                AND (s1.effective_date < s2.effective_date 
                    OR (s1.effective_date = s2.effective_date AND s1.created_at < s2.created_at)))
            WHERE users.role = 'LIVREUR' AND s2.id IS NULL
            ORDER BY users.username
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Erreur lors de la récupération des salaires actuels:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// POST /api/salaries - Ajouter un nouveau salaire
router.post('/', requireManagerOrAdmin, async (req, res) => {
    try {
        console.log('📋 Données reçues pour créer un salaire:', req.body);
        const { user_id, amount, effective_date, comment } = req.body;
        
        console.log('📋 Valeurs extraites:', {
            user_id,
            user_id_type: typeof user_id,
            amount,
            amount_type: typeof amount,
            effective_date,
            effective_date_type: typeof effective_date,
            comment
        });
        
        if (!user_id || !amount || !effective_date) {
            console.log('❌ Validation échouée - champs manquants:', {
                user_id: !!user_id,
                amount: !!amount,
                effective_date: !!effective_date
            });
            return res.status(400).json({ error: 'Tous les champs requis doivent être remplis' });
        }
        
        // Vérifier que l'utilisateur est un livreur
        const userResult = await db.query('SELECT role FROM users WHERE id = $1', [user_id]);
        if (userResult.rows.length === 0 || userResult.rows[0].role !== 'LIVREUR') {
            return res.status(400).json({ error: 'L\'utilisateur spécifié n\'est pas un livreur' });
        }
        
        // Insérer le nouveau salaire
        const insertResult = await db.query(`
            INSERT INTO salaries (user_id, amount, effective_date, comment, created_by, created_at)
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            RETURNING id
        `, [user_id, amount, effective_date, comment || null, req.user.id]);
        
        if (insertResult.rows.length > 0) {
            const newSalaryResult = await db.query(`
                SELECT 
                    salaries.*,
                    users.username as livreur_name,
                    users_manager.username as created_by_name
                FROM salaries
                LEFT JOIN users ON salaries.user_id = users.id
                LEFT JOIN users as users_manager ON salaries.created_by = users_manager.id
                WHERE salaries.id = $1
            `, [insertResult.rows[0].id]);
            
            res.status(201).json({
                message: 'Salaire ajouté avec succès',
                salary: newSalaryResult.rows[0]
            });
        } else {
            res.status(500).json({ error: 'Erreur lors de l\'ajout du salaire' });
        }
    } catch (error) {
        console.error('Erreur lors de l\'ajout du salaire:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// PUT /api/salaries/:id - Modifier un salaire (uniquement le commentaire)
router.put('/:id', requireManagerOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { comment } = req.body;
        
        const updateResult = await db.query(
            'UPDATE salaries SET comment = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [comment || null, id]
        );
        
        if (updateResult.rowCount > 0) {
            const updatedSalaryResult = await db.query(`
                SELECT 
                    salaries.*,
                    users.username as livreur_name,
                    users_manager.username as created_by_name
                FROM salaries
                LEFT JOIN users ON salaries.user_id = users.id
                LEFT JOIN users as users_manager ON salaries.created_by = users_manager.id
                WHERE salaries.id = $1
            `, [id]);
            
            res.json({
                message: 'Salaire modifié avec succès',
                salary: updatedSalaryResult.rows[0]
            });
        } else {
            res.status(404).json({ error: 'Salaire non trouvé' });
        }
    } catch (error) {
        console.error('Erreur lors de la modification du salaire:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// DELETE /api/salaries/:id - Supprimer un salaire
router.delete('/:id', requireManagerOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const deleteResult = await db.query('DELETE FROM salaries WHERE id = $1', [id]);
        
        if (deleteResult.rowCount > 0) {
            res.json({ message: 'Salaire supprimé avec succès' });
        } else {
            res.status(404).json({ error: 'Salaire non trouvé' });
        }
    } catch (error) {
        console.error('Erreur lors de la suppression du salaire:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

module.exports = router; 