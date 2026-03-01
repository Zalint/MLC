const db = require('../models/database');
const ExcelJS = require('exceljs');
const { v4: uuidv4 } = require('uuid');

class PaymentsController {

  // GET /api/v1/payments
  static async getPayments(req, res) {
    try {
      const { startDate, endDate, livreur_id } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Les dates de début et de fin sont requises' });
      }

      let query = `
        SELECT
          v.id,
          v.payment_date,
          v.mode,
          v.commentaire,
          v.notes,
          v.montant,
          v.created_at,
          u.id   AS livreur_id,
          u.username AS livreur_username,
          c.username AS created_by_username
        FROM versements v
        JOIN users u ON v.livreur_id = u.id
        LEFT JOIN users c ON v.created_by = c.id
        WHERE v.payment_date BETWEEN $1 AND $2
      `;
      const params = [startDate, endDate];

      if (livreur_id) {
        params.push(livreur_id);
        query += ` AND v.livreur_id = $${params.length}`;
      }

      query += ' ORDER BY v.payment_date DESC, u.username';

      const result = await db.query(query, params);
      const total = result.rows.reduce((sum, r) => sum + parseFloat(r.montant || 0), 0);

      res.json({ success: true, payments: result.rows, total });
    } catch (error) {
      console.error('Erreur récupération versements:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des versements' });
    }
  }

  // POST /api/v1/payments
  static async createPayment(req, res) {
    try {
      const { payment_date, livreur_id, mode, commentaire, notes, montant } = req.body;

      if (!payment_date || !livreur_id || !mode || !montant) {
        return res.status(400).json({ error: 'Date, livreur, mode et montant sont requis' });
      }

      if (parseFloat(montant) <= 0) {
        return res.status(400).json({ error: 'Le montant doit être supérieur à 0' });
      }

      const livreurRes = await db.query('SELECT id FROM users WHERE id = $1 AND is_active = true', [livreur_id]);
      if (livreurRes.rows.length === 0) {
        return res.status(404).json({ error: 'Livreur introuvable' });
      }

      const id = uuidv4();
      const result = await db.query(
        `INSERT INTO versements (id, payment_date, livreur_id, mode, commentaire, notes, montant, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [id, payment_date, livreur_id, mode, commentaire || null, notes || null, Math.round(parseFloat(montant)), req.user.id]
      );

      res.status(201).json({ success: true, message: 'Versement enregistré avec succès', payment: result.rows[0] });
    } catch (error) {
      console.error('Erreur création versement:', error);
      res.status(500).json({ error: 'Erreur lors de l\'enregistrement du versement' });
    }
  }

  // DELETE /api/v1/payments/:id
  static async deletePayment(req, res) {
    try {
      const { id } = req.params;

      const found = await db.query('SELECT id, created_at FROM versements WHERE id = $1', [id]);
      if (found.rows.length === 0) {
        return res.status(404).json({ error: 'Versement introuvable' });
      }

      // Les managers ne peuvent supprimer que dans les 48h suivant la création
      if (req.user.role === 'MANAGER') {
        const createdAt = new Date(found.rows[0].created_at);
        const diffHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
        if (diffHours > 48) {
          return res.status(403).json({
            error: 'Suppression impossible : le délai de 48h est dépassé. Contactez un administrateur.'
          });
        }
      }

      await db.query('DELETE FROM versements WHERE id = $1', [id]);
      res.json({ success: true, message: 'Versement supprimé' });
    } catch (error) {
      console.error('Erreur suppression versement:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression du versement' });
    }
  }

  // GET /api/v1/payments/export
  static async exportPayments(req, res) {
    try {
      const { startDate, endDate, livreur_id } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Les dates de début et de fin sont requises' });
      }

      let query = `
        SELECT
          v.payment_date,
          u.username AS livreur,
          v.mode,
          v.commentaire,
          v.notes,
          v.montant
        FROM versements v
        JOIN users u ON v.livreur_id = u.id
        WHERE v.payment_date BETWEEN $1 AND $2
      `;
      const params = [startDate, endDate];

      if (livreur_id) {
        params.push(livreur_id);
        query += ` AND v.livreur_id = $${params.length}`;
      }

      query += ' ORDER BY v.payment_date ASC, u.username';

      const result = await db.query(query, params);
      const rows = result.rows;

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Versements');

      sheet.columns = [
        { header: 'Date',           key: 'payment_date', width: 14 },
        { header: 'Livreur',        key: 'livreur',      width: 20 },
        { header: 'Mode',           key: 'mode',         width: 16 },
        { header: 'Commentaire',    key: 'commentaire',  width: 25 },
        { header: 'Notes',          key: 'notes',        width: 35 },
        { header: 'Montant (FCFA)', key: 'montant',      width: 16 }
      ];

      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      const modeLabels = { WAVE: 'Wave', ORANGE_MONEY: 'Orange Money', CASH: 'Cash', AUTRE: 'Autre' };

      rows.forEach(row => {
        const dateVal = row.payment_date instanceof Date
          ? row.payment_date.toISOString().split('T')[0]
          : row.payment_date;

        sheet.addRow({
          payment_date: dateVal,
          livreur:      row.livreur,
          mode:         modeLabels[row.mode] || row.mode,
          commentaire:  row.commentaire || '',
          notes:        row.notes || '',
          montant:      parseFloat(row.montant)
        });
      });

      const total = rows.reduce((s, r) => s + parseFloat(r.montant || 0), 0);
      const totalRow = sheet.addRow({
        payment_date: '', livreur: '', mode: '', commentaire: '', notes: 'TOTAL',
        montant: total
      });
      totalRow.font = { bold: true };
      totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } };

      sheet.eachRow(row => {
        row.eachCell(cell => {
          cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
          };
        });
      });

      const filename = `versements_${startDate}_${endDate}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('Erreur export versements:', error);
      res.status(500).json({ error: 'Erreur lors de l\'export Excel' });
    }
  }
}

module.exports = PaymentsController;
