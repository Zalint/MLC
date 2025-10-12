const fs = require('fs').promises;
const path = require('path');

// Charger la configuration
let config = null;

async function loadConfig() {
  if (!config) {
    const configPath = path.join(__dirname, '../documents/config.json');
    const configData = await fs.readFile(configPath, 'utf8');
    config = JSON.parse(configData);
  }
  return config;
}

/**
 * Formate une date selon le format spécifié
 * @param {Date|string} date - La date à formater
 * @param {string} format - Le format désiré (YYYYMMDD, DD-MM-YYYY, etc.)
 * @returns {string} - La date formatée
 */
function formatDate(date, format = 'YYYYMMDD') {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  switch (format) {
    case 'YYYYMMDD':
      return `${year}${month}${day}`;
    case 'DD-MM-YYYY':
      return `${day}-${month}-${year}`;
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'DD/MM/YY':
      return `${day}/${month}/${String(year).slice(-2)}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    default:
      return `${year}${month}${day}`;
  }
}

/**
 * Détermine le chemin de stockage selon le type de commande
 * @param {Object} order - L'objet commande
 * @returns {string} - Le chemin relatif du dossier
 */
function getUploadPath(order) {
  const date = formatDate(order.created_at, 'YYYYMMDD');
  const basePath = 'backend/documents';
  
  let mainFolder = order.order_type; // 'MATA', 'MLC', 'Autres'
  let subFolder = '';
  
  // Déterminer le sous-dossier selon les règles
  if (mainFolder === 'MATA') {
    subFolder = order.interne ? 'interne' : 'externe';
  } else if (mainFolder === 'MLC') {
    subFolder = order.subscription_id ? 'Abonnement' : 'Simple';
  }
  
  // Construire le chemin
  if (subFolder) {
    return path.join(basePath, mainFolder, subFolder, date);
  } else {
    return path.join(basePath, mainFolder, date);
  }
}

/**
 * Valide un fichier selon les critères de la configuration
 * @param {Object} file - L'objet fichier (multer)
 * @param {Object} config - La configuration
 * @returns {Object} - { valid: boolean, error: string|null }
 */
function validateFile(file, config) {
  const { max_file_size_bytes } = config.attachments.file_limits;
  const { mime_types } = config.attachments.allowed_formats;
  
  // Vérifier la taille
  if (file.size > max_file_size_bytes) {
    const maxSizeMB = config.attachments.file_limits.max_file_size_mb;
    return {
      valid: false,
      error: `Fichier trop volumineux. Maximum: ${maxSizeMB} Mo`
    };
  }
  
  // Vérifier le type MIME
  if (!mime_types.includes(file.mimetype)) {
    return {
      valid: false,
      error: `Format non autorisé. Formats acceptés: ${mime_types.join(', ')}`
    };
  }
  
  return { valid: true, error: null };
}

/**
 * Vérifie si un utilisateur peut effectuer une action sur les pièces jointes
 * @param {string} userRole - Rôle de l'utilisateur (admin, manager, livreur)
 * @param {Date} orderCreatedAt - Date de création de la commande
 * @param {Object} config - La configuration
 * @returns {boolean}
 */
function checkPermission(userRole, orderCreatedAt, config) {
  const roleConfig = config.attachments.permissions.roles[userRole];
  
  if (!roleConfig) {
    return false;
  }
  
  // Si pas de restriction de temps (admin, manager)
  if (roleConfig.time_restriction_hours === null) {
    return true;
  }
  
  // Vérifier la restriction de temps (livreur)
  const now = new Date();
  const orderDate = new Date(orderCreatedAt);
  const hoursSinceCreation = (now - orderDate) / (1000 * 60 * 60);
  
  return hoursSinceCreation <= roleConfig.time_restriction_hours;
}

/**
 * Génère un nom de fichier unique
 * @param {number} orderId - ID de la commande
 * @param {number} index - Index du fichier
 * @param {string} extension - Extension du fichier
 * @returns {string} - Nom du fichier
 */
function generateFileName(orderId, index, extension) {
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  return `${orderId}_${timestamp}_${index}${extension}`;
}

/**
 * Sanitize un nom de fichier (enlève les caractères spéciaux)
 * @param {string} filename - Nom original du fichier
 * @returns {string} - Nom sanitizé
 */
function sanitizeFileName(filename) {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
}

/**
 * Crée un dossier s'il n'existe pas (récursif)
 * @param {string} dirPath - Chemin du dossier
 */
async function ensureDirectory(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Supprime un fichier physique
 * @param {string} filePath - Chemin du fichier
 * @returns {boolean} - true si supprimé, false sinon
 */
async function deleteFile(filePath) {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    console.error(`Erreur lors de la suppression du fichier ${filePath}:`, error);
    return false;
  }
}

/**
 * Obtient les informations d'extension d'un fichier
 * @param {string} filename - Nom du fichier
 * @returns {string} - Extension avec le point (ex: .pdf)
 */
function getFileExtension(filename) {
  return path.extname(filename).toLowerCase();
}

module.exports = {
  loadConfig,
  formatDate,
  getUploadPath,
  validateFile,
  checkPermission,
  generateFileName,
  sanitizeFileName,
  ensureDirectory,
  deleteFile,
  getFileExtension
};

