const path = require('path');
const fs = require('fs').promises;

// Configuration
const UPLOAD_BASE_PATH = 'uploads/timesheets';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo
const ALLOWED_TYPES = ['image/jpeg', 'image/png'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

/**
 * Obtenir le chemin de stockage pour une date donnée
 * Format: uploads/timesheets/YYYY/MM/DD/
 */
function getTimesheetUploadPath(date) {
  const dateObj = new Date(date);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  
  return path.join(UPLOAD_BASE_PATH, String(year), month, day);
}

/**
 * Générer le nom de fichier pour une photo de pointage
 * Format: user_{userId}_{date}_{type}.{ext}
 * Exemple: user_abc123_2026-02-05_start.jpg
 */
function generateTimesheetFileName(userId, date, type, extension) {
  // Nettoyer l'extension
  const cleanExt = extension.toLowerCase().replace('.', '');
  
  // Format de date: YYYY-MM-DD
  const dateStr = new Date(date).toISOString().split('T')[0];
  
  // Nettoyer le userId (enlever les caractères spéciaux)
  const cleanUserId = userId.replace(/[^a-zA-Z0-9]/g, '');
  
  return `user_${cleanUserId}_${dateStr}_${type}.${cleanExt}`;
}

/**
 * Obtenir l'extension d'un fichier
 */
function getFileExtension(filename) {
  return path.extname(filename).toLowerCase();
}

/**
 * Valider un fichier photo
 */
function validateTimesheetPhoto(file) {
  // Vérifier la taille
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `La photo est trop volumineuse (max ${MAX_FILE_SIZE / 1024 / 1024} Mo)`
    };
  }

  // Vérifier le type MIME
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    return {
      valid: false,
      error: 'Format de photo non accepté (JPEG ou PNG uniquement)'
    };
  }

  // Vérifier l'extension
  const extension = getFileExtension(file.originalname);
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `Extension ${extension} non autorisée`
    };
  }

  return { valid: true, error: null };
}

/**
 * Créer le dossier s'il n'existe pas
 */
async function ensureDirectory(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    // Le dossier n'existe pas, le créer
    await fs.mkdir(dirPath, { recursive: true });
    console.log('📁 Dossier créé:', dirPath);
  }
}

/**
 * Uploader une photo de pointage
 * @param {Object} file - Fichier multer (avec buffer)
 * @param {String} userId - ID de l'utilisateur
 * @param {String} date - Date du pointage (YYYY-MM-DD)
 * @param {String} type - 'start' ou 'end'
 * @returns {Object} { filePath, fileName }
 */
async function uploadTimesheetPhoto(file, userId, date, type) {
  // Valider le fichier
  const validation = validateTimesheetPhoto(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Obtenir le chemin de destination
  const uploadPath = getTimesheetUploadPath(date);
  await ensureDirectory(uploadPath);

  // Générer le nom de fichier
  const extension = getFileExtension(file.originalname);
  const fileName = generateTimesheetFileName(userId, date, type, extension);
  const filePath = path.join(uploadPath, fileName);

  // Écrire le fichier
  await fs.writeFile(filePath, file.buffer);
  
  console.log('📸 Photo uploadée:', filePath);
  
  return {
    filePath,
    fileName: file.originalname // Nom original pour affichage
  };
}

/**
 * Supprimer une photo de pointage
 */
async function deleteTimesheetPhoto(filePath) {
  if (!filePath) {
    return false;
  }

  try {
    await fs.access(filePath);
    await fs.unlink(filePath);
    console.log('🗑️ Photo supprimée:', filePath);
    return true;
  } catch (error) {
    console.warn('⚠️ Impossible de supprimer la photo:', filePath, error.message);
    return false;
  }
}

/**
 * Vérifier si un fichier existe
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  uploadTimesheetPhoto,
  deleteTimesheetPhoto,
  validateTimesheetPhoto,
  getTimesheetUploadPath,
  generateTimesheetFileName,
  getFileExtension,
  ensureDirectory,
  fileExists,
  UPLOAD_BASE_PATH,
  MAX_FILE_SIZE,
  ALLOWED_TYPES,
  ALLOWED_EXTENSIONS
};
