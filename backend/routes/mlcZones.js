const express = require('express');
const router = express.Router();
const { authenticateToken, requireManagerOrAdmin } = require('../middleware/auth');
const db = require('../models/database');

// GET /api/v1/mlc-zones — tous les utilisateurs authentifiés (pour le formulaire)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, label, price, is_custom_price, description, sort_order, is_active FROM mlc_zones WHERE is_active = true ORDER BY sort_order ASC'
    );
    res.json({ zones: rows });
  } catch (err) {
    console.error('Erreur GET mlc_zones:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/v1/mlc-zones/all — admin: inclut les zones inactives
router.get('/all', authenticateToken, requireManagerOrAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM mlc_zones ORDER BY sort_order ASC'
    );
    res.json({ zones: rows });
  } catch (err) {
    console.error('Erreur GET mlc_zones/all:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/v1/mlc-zones — admin: créer une zone
router.post('/', authenticateToken, requireManagerOrAdmin, async (req, res) => {
  try {
    const { name, label, price, is_custom_price, description, sort_order } = req.body;
    if (!name || !label) {
      return res.status(400).json({ error: 'Le nom et le label sont requis' });
    }
    const { rows } = await db.query(
      `INSERT INTO mlc_zones (name, label, price, is_custom_price, description, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, label, price || null, is_custom_price || false, description || null, sort_order || 0]
    );
    res.status(201).json({ zone: rows[0] });
  } catch (err) {
    console.error('Erreur POST mlc_zones:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/v1/mlc-zones/:id — admin: modifier une zone
router.put('/:id', authenticateToken, requireManagerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, label, price, is_custom_price, description, sort_order, is_active } = req.body;
    const { rows } = await db.query(
      `UPDATE mlc_zones SET name=$1, label=$2, price=$3, is_custom_price=$4, description=$5, sort_order=$6, is_active=$7, updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [name, label, price || null, is_custom_price || false, description || null, sort_order || 0, is_active !== false, id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Zone non trouvée' });
    }
    res.json({ zone: rows[0] });
  } catch (err) {
    console.error('Erreur PUT mlc_zones:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/v1/mlc-zones/:id — admin: supprimer une zone
router.delete('/:id', authenticateToken, requireManagerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM mlc_zones WHERE id=$1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Zone non trouvée' });
    }
    res.json({ message: 'Zone supprimée' });
  } catch (err) {
    console.error('Erreur DELETE mlc_zones:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
