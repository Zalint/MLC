const Timesheet = require('../models/Timesheet');
const User = require('../models/User');
const multer = require('multer');
const {
  uploadTimesheetPhoto,
  deleteTimesheetPhoto,
  validateTimesheetPhoto,
  fileExists
} = require('../utils/timesheetUploadHelper');

// Configuration de multer pour l'upload en mémoire
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 1 // Max 1 fichier par pointage
  }
}).single('photo');

/**
 * Middleware pour uploader UNE photo
 */
const uploadPhotoMiddleware = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Photo trop volumineuse. Maximum 10 Mo.'
        });
      }
      return res.status(400).json({
        success: false,
        message: `Erreur d'upload: ${err.message}`
      });
    } else if (err) {
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'upload de la photo.'
      });
    }
    next();
  });
};

// ============================================
// ROUTES LIVREURS
// ============================================

/**
 * Formater une date en YYYY-MM-DD en utilisant le timezone local (pas UTC)
 */
function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Récupérer le pointage du jour pour le livreur connecté
 * GET /api/timesheets/today?date=YYYY-MM-DD (date optionnelle)
 */
const getTodayTimesheet = async (req, res) => {
  try {
    const userId = req.user.id;
    // Accepter une date en paramètre, sinon utiliser aujourd'hui
    const targetDate = req.query.date || formatLocalDate(new Date());
    
    const timesheet = await Timesheet.findByUserAndDate(userId, targetDate);
    
    res.json({
      success: true,
      data: timesheet,
      date: targetDate // Retourner la date utilisée
    });
  } catch (error) {
    console.error('Erreur getTodayTimesheet:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du pointage.'
    });
  }
};

/**
 * Pointer le début d'activité (pour soi-même)
 * POST /api/timesheets/start
 * Body: FormData { date, km, photo }
 */
const startActivity = async (req, res) => {
  try {
    const userId = req.user.id;
    const { date, km } = req.body;
    const photo = req.file;

    // Validations
    if (!date || !km || !photo) {
      return res.status(400).json({
        success: false,
        message: 'Date, kilométrage et photo sont requis.'
      });
    }

    // Valider le km
    const kmNumber = parseFloat(km);
    if (isNaN(kmNumber) || kmNumber < 0) {
      return res.status(400).json({
        success: false,
        message: 'Kilométrage invalide.'
      });
    }

    // Valider la date (aujourd'hui uniquement pour livreur)
    const today = formatLocalDate(new Date());
    if (date !== today && req.user.role === 'LIVREUR') {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pointer que pour aujourd\'hui.'
      });
    }

    // Vérifier qu'il n'existe pas déjà un pointage
    const existing = await Timesheet.findByUserAndDate(userId, date);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà pointé le début pour cette date.'
      });
    }

    // Upload de la photo
    const { filePath, fileName } = await uploadTimesheetPhoto(photo, userId, date, 'start');

    // Créer le pointage
    const timesheet = await Timesheet.create({
      userId,
      date,
      startTime: new Date(),
      startKm: kmNumber,
      startPhotoPath: filePath,
      startPhotoName: fileName
    });

    console.log(`✅ ${req.user.username} a pointé le début: ${kmNumber} km`);

    res.status(201).json({
      success: true,
      message: 'Début d\'activité enregistré avec succès.',
      data: timesheet
    });

  } catch (error) {
    console.error('Erreur startActivity:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de l\'enregistrement du pointage.'
    });
  }
};

/**
 * Pointer la fin d'activité (pour soi-même)
 * POST /api/timesheets/end
 * Body: FormData { date, km, photo }
 */
const endActivity = async (req, res) => {
  try {
    const userId = req.user.id;
    const { date, km } = req.body;
    const photo = req.file;

    console.log('🔍 endActivity - Données reçues:', {
      userId,
      date,
      km,
      hasPhoto: !!photo,
      photoDetails: photo ? { 
        fieldname: photo.fieldname,
        originalname: photo.originalname,
        mimetype: photo.mimetype,
        size: photo.size 
      } : null,
      bodyKeys: Object.keys(req.body)
    });

    // Validations
    if (!date || !km || !photo) {
      console.log('❌ Validation échouée:', { 
        hasDate: !!date, 
        hasKm: !!km, 
        hasPhoto: !!photo 
      });
      return res.status(400).json({
        success: false,
        message: 'Date, kilométrage et photo sont requis.'
      });
    }

    // Valider le km
    const kmNumber = parseFloat(km);
    if (isNaN(kmNumber) || kmNumber < 0) {
      return res.status(400).json({
        success: false,
        message: 'Kilométrage invalide.'
      });
    }

    // Récupérer le pointage existant
    console.log('🔍 Recherche timesheet pour:', { userId, date });
    const timesheet = await Timesheet.findByUserAndDate(userId, date);
    console.log('🔍 Timesheet trouvé:', timesheet ? {
      id: timesheet.id,
      hasEndTime: !!timesheet.end_time,
      startKm: timesheet.start_km,
      endKm: timesheet.end_km
    } : null);
    
    if (!timesheet) {
      console.log('❌ Aucun timesheet trouvé pour cette date');
      return res.status(404).json({
        success: false,
        message: 'Aucun début d\'activité trouvé pour cette date. Veuillez d\'abord pointer le début.'
      });
    }

    if (timesheet.end_time) {
      console.log('❌ Fin d\'activité déjà pointée');
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà pointé la fin pour cette date.'
      });
    }

    // Vérifier que end_km >= start_km
    console.log('🔍 Vérification km:', { 
      endKm: kmNumber, 
      startKm: timesheet.start_km,
      isValid: kmNumber >= timesheet.start_km 
    });
    
    if (kmNumber < timesheet.start_km) {
      console.log('❌ Erreur: km de fin < km de début');
      return res.status(400).json({
        success: false,
        message: `Le kilométrage de fin (${kmNumber}) doit être supérieur ou égal au kilométrage de début (${timesheet.start_km}).`
      });
    }

    // Upload de la photo
    const { filePath, fileName } = await uploadTimesheetPhoto(photo, userId, date, 'end');

    // Mettre à jour le pointage
    const updatedTimesheet = await Timesheet.updateEnd(timesheet.id, {
      endTime: new Date(),
      endKm: kmNumber,
      endPhotoPath: filePath,
      endPhotoName: fileName
    });

    console.log(`✅ ${req.user.username} a pointé la fin: ${kmNumber} km (Total: ${updatedTimesheet.total_km} km)`);

    res.json({
      success: true,
      message: `Fin d'activité enregistrée. Vous avez parcouru ${updatedTimesheet.total_km} km aujourd'hui.`,
      data: updatedTimesheet
    });

  } catch (error) {
    console.error('Erreur endActivity:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de l\'enregistrement de la fin d\'activité.'
    });
  }
};

// ============================================
// ROUTES MANAGERS
// ============================================

/**
 * Récupérer TOUS les pointages pour une date (manager uniquement)
 * GET /api/timesheets/all?date=2026-02-05
 */
const getAllTimesheetsForDate = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || formatLocalDate(new Date());

    // Récupérer tous les livreurs avec leur pointage
    const data = await Timesheet.findAllActiveLivreursWithTimesheets(targetDate);
    
    // Récupérer les statistiques
    const stats = await Timesheet.getStatsForDate(targetDate);

    res.json({
      success: true,
      data: data,
      stats: stats,
      date: targetDate
    });

  } catch (error) {
    console.error('Erreur getAllTimesheetsForDate:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des pointages.'
    });
  }
};

/**
 * Pointer le début pour UN livreur (manager uniquement)
 * POST /api/timesheets/start-for-user
 * Body: FormData { user_id, date, km, photo }
 */
const startActivityForUser = async (req, res) => {
  try {
    const managerId = req.user.id;
    const managerUsername = req.user.username;
    const { user_id, date, km } = req.body;
    const photo = req.file;

    // Validations
    if (!user_id || !date || !km || !photo) {
      return res.status(400).json({
        success: false,
        message: 'ID utilisateur, date, kilométrage et photo sont requis.'
      });
    }

    // Vérifier que l'utilisateur cible existe et est un livreur
    const targetUser = await User.findById(user_id);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur introuvable.'
      });
    }

    if (targetUser.role !== 'LIVREUR') {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pointer que pour un livreur.'
      });
    }

    // Valider le km
    const kmNumber = parseFloat(km);
    if (isNaN(kmNumber) || kmNumber < 0) {
      return res.status(400).json({
        success: false,
        message: 'Kilométrage invalide.'
      });
    }

    // Vérifier qu'il n'existe pas déjà un pointage
    const existing = await Timesheet.findByUserAndDate(user_id, date);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `${targetUser.username} a déjà pointé le début pour cette date.`
      });
    }

    // Upload de la photo
    const { filePath, fileName } = await uploadTimesheetPhoto(photo, user_id, date, 'start');

    // Créer le pointage
    const timesheet = await Timesheet.create({
      userId: user_id,
      date,
      startTime: new Date(),
      startKm: kmNumber,
      startPhotoPath: filePath,
      startPhotoName: fileName
    });

    // Log d'audit
    console.log(`📝 AUDIT: Manager ${managerUsername} a pointé le début pour ${targetUser.username} le ${date} (${kmNumber} km)`);

    res.status(201).json({
      success: true,
      message: `Début d'activité enregistré pour ${targetUser.username}.`,
      data: timesheet
    });

  } catch (error) {
    console.error('Erreur startActivityForUser:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de l\'enregistrement du pointage.'
    });
  }
};

/**
 * Pointer la fin pour UN livreur (manager uniquement)
 * POST /api/timesheets/end-for-user
 * Body: FormData { user_id, date, km, photo }
 */
const endActivityForUser = async (req, res) => {
  try {
    const managerId = req.user.id;
    const managerUsername = req.user.username;
    const { user_id, date, km } = req.body;
    const photo = req.file;

    // Validations
    if (!user_id || !date || !km || !photo) {
      return res.status(400).json({
        success: false,
        message: 'ID utilisateur, date, kilométrage et photo sont requis.'
      });
    }

    // Vérifier que l'utilisateur cible existe
    const targetUser = await User.findById(user_id);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur introuvable.'
      });
    }

    // Valider le km
    const kmNumber = parseFloat(km);
    if (isNaN(kmNumber) || kmNumber < 0) {
      return res.status(400).json({
        success: false,
        message: 'Kilométrage invalide.'
      });
    }

    // Récupérer le pointage existant
    const timesheet = await Timesheet.findByUserAndDate(user_id, date);
    
    if (!timesheet) {
      return res.status(404).json({
        success: false,
        message: `Aucun début d'activité trouvé pour ${targetUser.username} à cette date.`
      });
    }

    if (timesheet.end_time) {
      return res.status(400).json({
        success: false,
        message: `${targetUser.username} a déjà pointé la fin pour cette date.`
      });
    }

    // Vérifier que end_km >= start_km
    if (kmNumber < timesheet.start_km) {
      return res.status(400).json({
        success: false,
        message: `Le kilométrage de fin (${kmNumber}) doit être >= au km de début (${timesheet.start_km}).`
      });
    }

    // Upload de la photo
    const { filePath, fileName } = await uploadTimesheetPhoto(photo, user_id, date, 'end');

    // Mettre à jour le pointage
    const updatedTimesheet = await Timesheet.updateEnd(timesheet.id, {
      endTime: new Date(),
      endKm: kmNumber,
      endPhotoPath: filePath,
      endPhotoName: fileName
    });

    // Log d'audit
    console.log(`📝 AUDIT: Manager ${managerUsername} a pointé la fin pour ${targetUser.username} le ${date} (${kmNumber} km, Total: ${updatedTimesheet.total_km} km)`);

    res.json({
      success: true,
      message: `Fin d'activité enregistrée pour ${targetUser.username} (${updatedTimesheet.total_km} km parcourus).`,
      data: updatedTimesheet
    });

  } catch (error) {
    console.error('Erreur endActivityForUser:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de l\'enregistrement de la fin d\'activité.'
    });
  }
};

// ============================================
// ROUTES COMMUNES
// ============================================

/**
 * Télécharger une photo de pointage
 * GET /api/timesheets/:id/photo/:type (type = start|end)
 */
const downloadPhoto = async (req, res) => {
  try {
    const { id, type } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!['start', 'end'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type invalide (start ou end).'
      });
    }

    // Récupérer le pointage
    const timesheet = await Timesheet.findById(id);
    
    if (!timesheet) {
      return res.status(404).json({
        success: false,
        message: 'Pointage introuvable.'
      });
    }

    // Vérifier les permissions
    const isOwner = timesheet.user_id === userId;
    const isManager = ['MANAGER', 'ADMIN'].includes(userRole);

    if (!isOwner && !isManager) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas l\'autorisation de voir cette photo.'
      });
    }

    // Récupérer le chemin de la photo
    const photoPath = type === 'start' ? timesheet.start_photo_path : timesheet.end_photo_path;
    const photoName = type === 'start' ? timesheet.start_photo_name : timesheet.end_photo_name;

    if (!photoPath) {
      return res.status(404).json({
        success: false,
        message: 'Aucune photo disponible.'
      });
    }

    // Sécurité: Valider le chemin pour prévenir les attaques par traversée de répertoire
    const path = require('path');
    const { UPLOAD_BASE_PATH } = require('../utils/timesheetUploadHelper');
    
    const resolvedPhotoPath = path.resolve(photoPath);
    const resolvedUploadDir = path.resolve(UPLOAD_BASE_PATH);
    
    if (!resolvedPhotoPath.startsWith(resolvedUploadDir + path.sep)) {
      console.error('⚠️ Tentative de path traversal détectée:', photoPath);
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé.'
      });
    }

    // Vérifier que le fichier existe
    const exists = await fileExists(resolvedPhotoPath);
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: 'Fichier introuvable sur le serveur.'
      });
    }

    // Envoyer le fichier
    res.download(resolvedPhotoPath, photoName);

  } catch (error) {
    console.error('Erreur downloadPhoto:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement de la photo.'
    });
  }
};

/**
 * Récupérer l'historique des pointages
 * GET /api/timesheets?start_date=2026-02-01&end_date=2026-02-28&user_id=xxx
 * Manager: peut filter par user_id
 * Livreur: ne voit que ses propres pointages
 */
const getTimesheets = async (req, res) => {
  try {
    const { start_date, end_date, user_id } = req.query;
    const currentUserId = req.user.id;
    const userRole = req.user.role;

    // Dates par défaut: ce mois (utiliser des chaînes de dates explicites pour éviter les problèmes de timezone)
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const lastDay = new Date(year, month, 0).getDate();
    const defaultStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const defaultEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const startDate = start_date || defaultStart;
    const endDate = end_date || defaultEnd;

    // Déterminer l'utilisateur cible
    let targetUserId = currentUserId;
    
    if (user_id && ['MANAGER', 'ADMIN'].includes(userRole)) {
      // Manager peut voir les pointages d'un autre utilisateur
      targetUserId = user_id;
    }

    // Récupérer les pointages
    const timesheets = await Timesheet.findByUserBetweenDates(targetUserId, startDate, endDate);

    res.json({
      success: true,
      data: timesheets,
      start_date: startDate,
      end_date: endDate
    });

  } catch (error) {
    console.error('Erreur getTimesheets:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des pointages.'
    });
  }
};

/**
 * Supprimer un pointage
 * DELETE /api/timesheets/:id
 * Permissions: 
 * - Manager/Admin: peut supprimer n'importe quel pointage
 * - Livreur: peut supprimer uniquement son propre pointage du jour même
 */
const deleteTimesheet = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Récupérer le pointage
    const timesheet = await Timesheet.findById(id);
    
    if (!timesheet) {
      return res.status(404).json({
        success: false,
        message: 'Pointage introuvable.'
      });
    }

    // Vérifier les permissions
    const isManager = ['MANAGER', 'ADMIN'].includes(userRole);
    const isOwner = timesheet.user_id === userId;
    
    if (!isManager && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas l\'autorisation de supprimer ce pointage.'
      });
    }

    // Si c'est un livreur, vérifier que c'est pour aujourd'hui seulement
    if (userRole === 'LIVREUR') {
      const today = formatLocalDate(new Date());
      // Gérer le cas où timesheet.date est un Date object ou une string
      const timesheetDate = timesheet.date instanceof Date 
        ? formatLocalDate(timesheet.date)
        : (typeof timesheet.date === 'string' ? timesheet.date.split('T')[0] : timesheet.date);
      
      if (timesheetDate !== today) {
        return res.status(403).json({
          success: false,
          message: 'Vous ne pouvez supprimer que le pointage du jour même.'
        });
      }
    }

    // Supprimer les photos physiques
    if (timesheet.start_photo_path) {
      await deleteTimesheetPhoto(timesheet.start_photo_path);
    }
    if (timesheet.end_photo_path) {
      await deleteTimesheetPhoto(timesheet.end_photo_path);
    }

    // Supprimer le pointage
    await Timesheet.delete(id);

    console.log(`🗑️ ${req.user.username} (${userRole}) a supprimé le pointage ${id} de ${timesheet.date}`);

    res.json({
      success: true,
      message: 'Pointage supprimé avec succès.'
    });

  } catch (error) {
    console.error('Erreur deleteTimesheet:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du pointage.'
    });
  }
};

/**
 * Mettre à jour un pointage (corrections)
 * PUT /api/timesheets/:id
 */
const updateTimesheet = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Récupérer le pointage
    const timesheet = await Timesheet.findById(id);
    
    if (!timesheet) {
      return res.status(404).json({
        success: false,
        message: 'Pointage introuvable.'
      });
    }

    // Vérifier les permissions
    const isOwner = timesheet.user_id === userId;
    const isManager = ['MANAGER', 'ADMIN'].includes(userRole);

    if (!isOwner && !isManager) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas l\'autorisation de modifier ce pointage.'
      });
    }

    // Whitelist des champs éditables (protection contre mass-assignment)
    const allowedFields = ['start_km', 'end_km', 'start_photo_path', 'start_photo_name', 'end_photo_path', 'end_photo_name'];
    const safeUpdates = {};
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        safeUpdates[field] = req.body[field];
      }
    }

    // Mettre à jour
    const updatedTimesheet = await Timesheet.update(id, safeUpdates);

    console.log(`📝 ${req.user.username} a modifié le pointage ${id}`);

    res.json({
      success: true,
      message: 'Pointage mis à jour avec succès.',
      data: updatedTimesheet
    });

  } catch (error) {
    console.error('Erreur updateTimesheet:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de la mise à jour du pointage.'
    });
  }
};

/**
 * Modifier le début d'activité
 * PUT /api/timesheets/:id/start
 * Body: FormData { km, photo (optionnel) }
 */
const updateStartActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { km } = req.body;
    const photo = req.file;

    console.log('🔧 updateStartActivity:', { id, userId, km, hasNewPhoto: !!photo });

    // Validations
    if (!km) {
      return res.status(400).json({
        success: false,
        message: 'Kilométrage requis.'
      });
    }

    const kmNumber = parseFloat(km);
    if (isNaN(kmNumber) || kmNumber < 0) {
      return res.status(400).json({
        success: false,
        message: 'Kilométrage invalide.'
      });
    }

    // Récupérer le pointage
    const timesheet = await Timesheet.findById(id);
    
    if (!timesheet) {
      return res.status(404).json({
        success: false,
        message: 'Pointage introuvable.'
      });
    }

    // Vérifier les permissions
    const userRole = req.user.role;
    const isOwner = timesheet.user_id === userId;
    const isManager = userRole === 'MANAGER';
    const isAdmin = userRole === 'ADMIN';
    
    if (!isOwner && !isManager && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez modifier que vos propres pointages.'
      });
    }
    
    // Si manager, vérifier que le pointage a moins de 72h
    if (isManager && !isOwner) {
      const timesheetDate = timesheet.date instanceof Date 
        ? formatLocalDate(timesheet.date)
        : (typeof timesheet.date === 'string' ? timesheet.date.split('T')[0] : timesheet.date);
      
      const pointageTime = new Date(timesheetDate).getTime();
      const now = new Date().getTime();
      const hoursDiff = (now - pointageTime) / (1000 * 60 * 60);
      
      if (hoursDiff > 72) {
        return res.status(403).json({
          success: false,
          message: 'Les managers ne peuvent modifier que les pointages de moins de 72 heures.'
        });
      }
    }
    // Les admins peuvent modifier sans limite de temps

    // Si nouvelle photo, uploader
    let photoPath = timesheet.start_photo_path;
    let photoName = timesheet.start_photo_name;
    
    if (photo) {
      // Supprimer l'ancienne photo
      if (timesheet.start_photo_path) {
        await deleteTimesheetPhoto(timesheet.start_photo_path);
      }
      
      const upload = await uploadTimesheetPhoto(photo, userId, timesheet.date, 'start');
      photoPath = upload.filePath;
      photoName = upload.fileName;
    }

    // Mettre à jour
    const updated = await Timesheet.updateStart(id, {
      startTime: timesheet.start_time, // Garder la même heure
      startKm: kmNumber,
      startPhotoPath: photoPath,
      startPhotoName: photoName
    });

    console.log(`✅ ${req.user.username} a modifié le début d'activité: ${kmNumber} km`);

    res.json({
      success: true,
      message: 'Début d\'activité modifié avec succès.',
      data: updated
    });

  } catch (error) {
    console.error('Erreur updateStartActivity:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de la modification.'
    });
  }
};

/**
 * Modifier la fin d'activité
 * PUT /api/timesheets/:id/end
 * Body: FormData { km, photo (optionnel) }
 */
const updateEndActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { km } = req.body;
    const photo = req.file;

    console.log('🔧 updateEndActivity:', { id, userId, km, hasNewPhoto: !!photo });

    // Validations
    if (!km) {
      return res.status(400).json({
        success: false,
        message: 'Kilométrage requis.'
      });
    }

    const kmNumber = parseFloat(km);
    if (isNaN(kmNumber) || kmNumber < 0) {
      return res.status(400).json({
        success: false,
        message: 'Kilométrage invalide.'
      });
    }

    // Récupérer le pointage
    const timesheet = await Timesheet.findById(id);
    
    if (!timesheet) {
      return res.status(404).json({
        success: false,
        message: 'Pointage introuvable.'
      });
    }

    // Vérifier les permissions
    const userRole = req.user.role;
    const isOwner = timesheet.user_id === userId;
    const isManager = userRole === 'MANAGER';
    const isAdmin = userRole === 'ADMIN';
    
    if (!isOwner && !isManager && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez modifier que vos propres pointages.'
      });
    }
    
    // Si manager, vérifier que le pointage a moins de 72h
    if (isManager && !isOwner) {
      const timesheetDate = timesheet.date instanceof Date 
        ? formatLocalDate(timesheet.date)
        : (typeof timesheet.date === 'string' ? timesheet.date.split('T')[0] : timesheet.date);
      
      const pointageTime = new Date(timesheetDate).getTime();
      const now = new Date().getTime();
      const hoursDiff = (now - pointageTime) / (1000 * 60 * 60);
      
      if (hoursDiff > 72) {
        return res.status(403).json({
          success: false,
          message: 'Les managers ne peuvent modifier que les pointages de moins de 72 heures.'
        });
      }
    }
    // Les admins peuvent modifier sans limite de temps

    // Vérifier que end_km >= start_km
    if (kmNumber < timesheet.start_km) {
      return res.status(400).json({
        success: false,
        message: `Le kilométrage de fin (${kmNumber}) doit être >= au kilométrage de début (${timesheet.start_km}).`
      });
    }

    // Si nouvelle photo, uploader
    let photoPath = timesheet.end_photo_path;
    let photoName = timesheet.end_photo_name;
    
    if (photo) {
      // Supprimer l'ancienne photo
      if (timesheet.end_photo_path) {
        await deleteTimesheetPhoto(timesheet.end_photo_path);
      }
      
      const upload = await uploadTimesheetPhoto(photo, userId, timesheet.date, 'end');
      photoPath = upload.filePath;
      photoName = upload.fileName;
    }

    // Mettre à jour
    const updated = await Timesheet.updateEnd(id, {
      endTime: timesheet.end_time, // Garder la même heure
      endKm: kmNumber,
      endPhotoPath: photoPath,
      endPhotoName: photoName
    });

    console.log(`✅ ${req.user.username} a modifié la fin d'activité: ${kmNumber} km (Total: ${updated.total_km} km)`);

    res.json({
      success: true,
      message: `Fin d'activité modifiée. Total: ${updated.total_km} km.`,
      data: updated
    });

  } catch (error) {
    console.error('Erreur updateEndActivity:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de la modification.'
    });
  }
};

module.exports = {
  uploadPhotoMiddleware,
  getTodayTimesheet,
  startActivity,
  endActivity,
  getAllTimesheetsForDate,
  startActivityForUser,
  endActivityForUser,
  downloadPhoto,
  getTimesheets,
  deleteTimesheet,
  updateTimesheet,
  updateStartActivity,
  updateEndActivity
};
