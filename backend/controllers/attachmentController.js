const Attachment = require('../models/Attachment');
const Order = require('../models/Order');
const multer = require('multer');
const path = require('path');
const {
  loadConfig,
  getUploadPath,
  validateFile,
  checkPermission,
  generateFileName,
  sanitizeFileName,
  ensureDirectory,
  deleteFile,
  getFileExtension
} = require('../utils/attachmentHelper');

let config = null;

// Initialiser la configuration au démarrage
(async () => {
  config = await loadConfig();
})();

// Configuration de multer pour l'upload
const storage = multer.memoryStorage(); // On stocke temporairement en mémoire

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 2 // Max 2 fichiers
  }
}).array('attachments', 2);

/**
 * Middleware pour uploader des fichiers
 */
const uploadMiddleware = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Fichier trop volumineux. Maximum 10 Mo par fichier.'
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: 'Trop de fichiers. Maximum 2 fichiers par commande.'
        });
      }
      return res.status(400).json({
        success: false,
        message: `Erreur d'upload: ${err.message}`
      });
    } else if (err) {
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'upload des fichiers.'
      });
    }
    next();
  });
};

/**
 * Upload des pièces jointes pour une commande
 * POST /api/orders/:orderId/attachments
 */
const uploadAttachments = async (req, res) => {
  try {
    const { orderId } = req.params;
    const files = req.files;
    const userId = req.user?.username || 'unknown';
    const userRole = (req.user?.role || 'livreur').toLowerCase();
    
    console.log('📎 uploadAttachments - User:', req.user?.username, 'Role:', req.user?.role, '→', userRole);

    if (!config) {
      config = await loadConfig();
    }

    // Vérifier que des fichiers ont été envoyés
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier à uploader.'
      });
    }

    // Récupérer la commande
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande introuvable.'
      });
    }

    // Vérifier les permissions
    const hasPermission = checkPermission(userRole, order.created_at, config);
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez plus l\'autorisation de modifier les pièces jointes (délai de 24h dépassé).'
      });
    }

    // Vérifier le nombre de fichiers déjà uploadés
    const existingCount = await Attachment.countByOrderId(orderId);
    const maxFiles = config.attachments.file_limits.max_files_per_order;
    
    if (existingCount + files.length > maxFiles) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${maxFiles} fichiers par commande. Vous avez déjà ${existingCount} fichier(s).`
      });
    }

    // Valider chaque fichier
    for (const file of files) {
      const validation = validateFile(file, config);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error
        });
      }
    }

    // Déterminer le chemin de stockage
    const uploadPath = getUploadPath(order);
    await ensureDirectory(uploadPath);

    // Sauvegarder les fichiers
    const uploadedAttachments = [];
    const fs = require('fs').promises;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const extension = getFileExtension(file.originalname);
      const fileName = generateFileName(orderId, existingCount + i + 1, extension);
      const filePath = path.join(uploadPath, fileName);

      // Écrire le fichier sur le disque
      await fs.writeFile(filePath, file.buffer);

      // Enregistrer les métadonnées en base de données
      const attachment = await Attachment.create({
        order_id: orderId,
        file_name: fileName,
        original_name: file.originalname,
        file_path: filePath,
        file_type: file.mimetype,
        file_size: file.size,
        uploaded_by: userId
      });

      uploadedAttachments.push(attachment);
    }

    res.status(201).json({
      success: true,
      message: `${files.length} fichier(s) uploadé(s) avec succès.`,
      data: uploadedAttachments
    });

  } catch (error) {
    console.error('Erreur lors de l\'upload des pièces jointes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'upload des pièces jointes.'
    });
  }
};

/**
 * Récupérer toutes les pièces jointes d'une commande
 * GET /api/orders/:orderId/attachments
 */
const getAttachments = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userRole = (req.user?.role || 'livreur').toLowerCase();

    console.log('📎 getAttachments - OrderID:', orderId);
    console.log('📎 getAttachments - User:', req.user?.username, 'Role:', req.user?.role, '→', userRole);

    if (!config) {
      config = await loadConfig();
    }

    // Récupérer la commande
    const order = await Order.findById(orderId);
    if (!order) {
      console.log('❌ getAttachments - Commande introuvable:', orderId);
      return res.status(404).json({
        success: false,
        message: 'Commande introuvable.'
      });
    }

    console.log('📎 getAttachments - Commande trouvée, created_at:', order.created_at);

    // Vérifier les permissions de visualisation
    const hasPermission = checkPermission(userRole, order.created_at, config);
    console.log('📎 getAttachments - Permission:', hasPermission, '(role:', userRole, ')');
    
    if (!hasPermission) {
      console.log('❌ getAttachments - Permission refusée pour role:', userRole);
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez plus l\'autorisation de voir les pièces jointes (délai de 24h dépassé).'
      });
    }

    // Récupérer les pièces jointes
    const attachments = await Attachment.findByOrderId(orderId);

    res.json({
      success: true,
      data: attachments
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des pièces jointes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des pièces jointes.'
    });
  }
};

/**
 * Télécharger une pièce jointe
 * GET /api/orders/attachments/:attachmentId
 */
const downloadAttachment = async (req, res) => {
  try {
    const { attachmentId } = req.params;
    const userRole = (req.user?.role || 'livreur').toLowerCase();
    
    console.log('📎 downloadAttachment - User:', req.user?.username, 'Role:', req.user?.role, '→', userRole);

    if (!config) {
      config = await loadConfig();
    }

    // Récupérer la pièce jointe avec les infos de la commande
    const attachment = await Attachment.findByIdWithOrder(attachmentId);
    
    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'Pièce jointe introuvable.'
      });
    }

    // Vérifier les permissions
    const hasPermission = checkPermission(userRole, attachment.order_created_at, config);
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez plus l\'autorisation d\'accéder à cette pièce jointe.'
      });
    }

    // Vérifier que le fichier existe
    const fs = require('fs').promises;
    try {
      await fs.access(attachment.file_path);
    } catch {
      return res.status(404).json({
        success: false,
        message: 'Fichier introuvable sur le serveur.'
      });
    }

    // Envoyer le fichier
    res.download(attachment.file_path, attachment.original_name);

  } catch (error) {
    console.error('Erreur lors du téléchargement de la pièce jointe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du téléchargement.'
    });
  }
};

/**
 * Supprimer une pièce jointe
 * DELETE /api/orders/attachments/:attachmentId
 */
const deleteAttachment = async (req, res) => {
  try {
    const { attachmentId } = req.params;
    const userRole = (req.user?.role || 'livreur').toLowerCase();
    
    console.log('📎 deleteAttachment - User:', req.user?.username, 'Role:', req.user?.role, '→', userRole);

    if (!config) {
      config = await loadConfig();
    }

    // Récupérer la pièce jointe avec les infos de la commande
    const attachment = await Attachment.findByIdWithOrder(attachmentId);
    
    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'Pièce jointe introuvable.'
      });
    }

    // Vérifier les permissions
    const hasPermission = checkPermission(userRole, attachment.order_created_at, config);
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez plus l\'autorisation de supprimer cette pièce jointe (délai de 24h dépassé).'
      });
    }

    // Supprimer le fichier physique
    const fileDeleted = await deleteFile(attachment.file_path);
    if (!fileDeleted) {
      console.warn(`Le fichier ${attachment.file_path} n'a pas pu être supprimé du disque.`);
    }

    // Supprimer l'entrée en base de données
    await Attachment.delete(attachmentId);

    res.json({
      success: true,
      message: 'Pièce jointe supprimée avec succès.'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression de la pièce jointe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la suppression.'
    });
  }
};

module.exports = {
  uploadMiddleware,
  uploadAttachments,
  getAttachments,
  downloadAttachment,
  deleteAttachment
};

