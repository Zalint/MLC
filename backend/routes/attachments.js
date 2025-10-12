const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  uploadMiddleware,
  uploadAttachments,
  getAttachments,
  downloadAttachment,
  deleteAttachment
} = require('../controllers/attachmentController');

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// Upload des pièces jointes pour une commande
// POST /api/orders/:orderId/attachments
router.post('/orders/:orderId/attachments', uploadMiddleware, uploadAttachments);

// Récupérer toutes les pièces jointes d'une commande
// GET /api/orders/:orderId/attachments
router.get('/orders/:orderId/attachments', getAttachments);

// Télécharger une pièce jointe spécifique
// GET /api/orders/attachments/:attachmentId
router.get('/orders/attachments/:attachmentId', downloadAttachment);

// Supprimer une pièce jointe
// DELETE /api/orders/attachments/:attachmentId
router.delete('/orders/attachments/:attachmentId', deleteAttachment);

module.exports = router;

