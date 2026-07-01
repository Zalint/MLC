const express = require('express');
const router = express.Router();
const { authenticateToken, requireManagerOrAdmin } = require('../middleware/auth');
const db = require('../models/database');
const orderTypesConfig = require('../config/order-types.json');

// Liste des types de commandes valides (depuis order-types.json)
const validOrderTypes = [
  ...orderTypesConfig.coreTypes,
  ...orderTypesConfig.extensions.map(e => e.value)
];

// Normalise une valeur de prix : '' / null / undefined -> null (champ libre), sinon nombre
function normalizePrice(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

// GET /api/v1/order-type-prices/current
// Prix courants (un par type) pour pré-remplir les formulaires. Public : valeurs non sensibles,
// et le frontend charge cette config au chargement de la page (avant login), comme les autres /config.
router.get('/current', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT order_type, default_price, hors_zone_supplement,
             TO_CHAR(effective_from, 'YYYY-MM-DD') AS effective_from
      FROM (
        SELECT DISTINCT ON (order_type)
          order_type, default_price, hors_zone_supplement, effective_from, id
        FROM order_type_prices
        WHERE effective_from <= CURRENT_DATE
        ORDER BY order_type, effective_from DESC, id DESC
      ) t
    `);
    const current = {};
    rows.forEach(r => {
      current[r.order_type] = {
        default_price: r.default_price,
        hors_zone_supplement: r.hors_zone_supplement,
        effective_from: r.effective_from
      };
    });
    res.json({ current });
  } catch (err) {
    console.error('Erreur GET order-type-prices/current:', err);
    res.status(500).json({ error: 'Erreur lors du chargement des prix' });
  }
});

// GET /api/v1/order-type-prices/history
// Historique complet des changements (admin/manager).
router.get('/history', authenticateToken, requireManagerOrAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT otp.id, otp.order_type, otp.default_price, otp.hors_zone_supplement,
             TO_CHAR(otp.effective_from, 'YYYY-MM-DD') AS effective_from,
             otp.created_at, otp.comment,
             u.username AS created_by_username
      FROM order_type_prices otp
      LEFT JOIN users u ON otp.created_by = u.id
      ORDER BY otp.order_type ASC, otp.effective_from DESC, otp.id DESC
    `);
    res.json({ history: rows });
  } catch (err) {
    console.error('Erreur GET order-type-prices/history:', err);
    res.status(500).json({ error: 'Erreur lors du chargement de l\'historique' });
  }
});

// POST /api/v1/order-type-prices
// Enregistre un changement de prix (admin/manager). Append-only : chaque changement crée une
// nouvelle ligne datée (effective_from), ce qui préserve l'historique et les rapports passés.
router.post('/', authenticateToken, requireManagerOrAdmin, async (req, res) => {
  try {
    const { order_type, default_price, hors_zone_supplement, effective_from, comment } = req.body;

    if (!order_type || !validOrderTypes.includes(order_type)) {
      return res.status(400).json({ error: `Type de commande invalide : ${order_type}` });
    }

    const dp = normalizePrice(default_price);
    const hzs = normalizePrice(hors_zone_supplement);
    if (Number.isNaN(dp) || (dp !== null && dp < 0)) {
      return res.status(400).json({ error: 'Le prix par défaut doit être un nombre positif, ou vide' });
    }
    if (Number.isNaN(hzs) || (hzs !== null && hzs < 0)) {
      return res.status(400).json({ error: 'Le supplément hors-zone doit être un nombre positif, ou vide' });
    }

    // Date d'effet : par défaut aujourd'hui. Une date future planifie le changement.
    let eff = effective_from;
    if (!eff) {
      eff = new Date().toISOString().slice(0, 10);
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(eff)) {
      return res.status(400).json({ error: 'La date d\'effet doit être au format AAAA-MM-JJ' });
    }

    const { rows } = await db.query(
      `INSERT INTO order_type_prices (order_type, default_price, hors_zone_supplement, effective_from, created_by, comment)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [order_type, dp, hzs, eff, req.user.id, comment || null]
    );
    res.status(201).json({ price: rows[0] });
  } catch (err) {
    console.error('Erreur POST order-type-prices:', err);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement du prix' });
  }
});

// DELETE /api/v1/order-type-prices/:id
// Supprime une entrée d'historique (admin/manager) — pour corriger une saisie erronée.
// Attention : supprimer une entrée déjà appliquée modifie les rapports concernés.
router.delete('/:id', authenticateToken, requireManagerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM order_type_prices WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Entrée non trouvée' });
    }
    res.json({ message: 'Entrée supprimée' });
  } catch (err) {
    console.error('Erreur DELETE order-type-prices:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

module.exports = router;
