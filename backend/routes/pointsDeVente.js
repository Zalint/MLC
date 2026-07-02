const express = require('express');
const router = express.Router();
const { authenticateToken, requireManagerOrAdmin, requireViewer } = require('../middleware/auth');
const db = require('../models/database');

// GET / — tous les utilisateurs authentifiés (pour les formulaires) : points actifs uniquement
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, value, label, sort_order, is_active FROM points_de_vente WHERE is_active = true ORDER BY sort_order ASC, label ASC'
    );
    res.json({ points: rows });
  } catch (err) {
    console.error('Erreur GET points_de_vente:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /all — admin/viewer : inclut les points inactifs
router.get('/all', authenticateToken, requireViewer, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM points_de_vente ORDER BY sort_order ASC, label ASC');
    res.json({ points: rows });
  } catch (err) {
    console.error('Erreur GET points_de_vente/all:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST / — créer un point de vente (manager/admin)
router.post('/', authenticateToken, requireManagerOrAdmin, async (req, res) => {
  try {
    const { value, label, sort_order } = req.body;
    if (!value || !value.trim()) {
      return res.status(400).json({ error: 'La valeur est requise' });
    }
    const v = value.trim();
    const l = (label && label.trim()) ? label.trim() : v;
    const { rows } = await db.query(
      `INSERT INTO points_de_vente (value, label, sort_order) VALUES ($1, $2, $3) RETURNING *`,
      [v, l, sort_order || 0]
    );
    res.status(201).json({ point: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ce point de vente existe déjà' });
    }
    console.error('Erreur POST points_de_vente:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /:id — modifier (renommer / label / ordre / activer-désactiver) (manager/admin)
router.put('/:id', authenticateToken, requireManagerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { value, label, sort_order, is_active } = req.body;
    if (!value || !value.trim()) {
      return res.status(400).json({ error: 'La valeur est requise' });
    }
    const v = value.trim();
    const l = (label && label.trim()) ? label.trim() : v;
    const { rows } = await db.query(
      `UPDATE points_de_vente SET value=$1, label=$2, sort_order=$3, is_active=$4, updated_at=NOW() WHERE id=$5 RETURNING *`,
      [v, l, sort_order || 0, is_active !== false, id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Point de vente non trouvé' });
    }
    res.json({ point: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ce point de vente existe déjà' });
    }
    console.error('Erreur PUT points_de_vente:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /:id — supprimer (manager/admin)
router.delete('/:id', authenticateToken, requireManagerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM points_de_vente WHERE id=$1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Point de vente non trouvé' });
    }
    res.json({ message: 'Point de vente supprimé' });
  } catch (err) {
    console.error('Erreur DELETE points_de_vente:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
