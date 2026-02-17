const Timesheet = require('../models/Timesheet');
const User = require('../models/User');
const multer = require('multer');
const ExcelJS = require('exceljs');
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
 * Vérifier si un pointage peut être modifié par un livreur
 * Règle: Les livreurs ne peuvent modifier que dans les 15 minutes après création
 * Les managers peuvent modifier à tout moment
 */
function canLivreurModifyTimesheet(timesheet, userRole) {
  if (userRole === 'MANAGER' || userRole === 'ADMIN') {
    return { allowed: true };
  }
  
  // Pour les livreurs: vérifier le délai de 15 minutes
  const DELAY_MINUTES = 15;
  const now = new Date();
  const createdAt = new Date(timesheet.created_at);
  const minutesSinceCreation = (now - createdAt) / (1000 * 60);
  
  if (minutesSinceCreation > DELAY_MINUTES) {
    return {
      allowed: false,
      message: `Vous ne pouvez plus modifier ce pointage. Délai de ${DELAY_MINUTES} minutes écoulé (créé il y a ${Math.floor(minutesSinceCreation)} minutes).`
    };
  }
  
  return { allowed: true };
}

/**
 * Récupérer les pointages du jour pour le livreur connecté
 * GET /api/timesheets/today?date=YYYY-MM-DD (date optionnelle)
 * Retourne TOUS les pointages du jour (plusieurs scooters possibles)
 */
const getTodayTimesheet = async (req, res) => {
  try {
    const userId = req.user.id;
    // Accepter une date en paramètre, sinon utiliser aujourd'hui
    const targetDate = req.query.date || formatLocalDate(new Date());
    
    // Récupérer TOUS les pointages du jour
    const timesheets = await Timesheet.findAllByUserAndDate(userId, targetDate);
    
    // Calculer le total km de la journée
    const totalKmJournee = timesheets.reduce((sum, t) => {
      return sum + (t.total_km ? parseFloat(t.total_km) : 0);
    }, 0);
    
    res.json({
      success: true,
      data: timesheets, // Tableau de pointages
      total_km_journee: totalKmJournee,
      nb_pointages: timesheets.length,
      date: targetDate
    });
  } catch (error) {
    console.error('Erreur getTodayTimesheet:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des pointages.'
    });
  }
};

/**
 * Pointer le début d'activité (pour soi-même)
 * POST /api/timesheets/start
 * Body: FormData { date, km, scooter_id (optionnel), photo }
 */
const startActivity = async (req, res) => {
  try {
    const userId = req.user.id;
    const { date, km, scooter_id } = req.body;
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

    // Vérifier qu'il n'y a pas de pointage en cours (sans fin) pour cette date
    const hasOngoing = await Timesheet.hasOngoingPointage(userId, date);
    if (hasOngoing) {
      return res.status(400).json({
        success: false,
        message: 'Vous avez un pointage en cours. Veuillez pointer la fin avant de commencer un nouveau.'
      });
    }

    // Vérifier qu'il n'y a pas de pointage en cours pour ce scooter (permet réutilisation après pointage fin)
    const scooterIdOrNull = scooter_id || null;
    const existing = await Timesheet.findByUserScooterAndDate(userId, scooterIdOrNull, date, true);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: scooter_id 
          ? `Vous avez déjà un pointage en cours avec le scooter ${scooter_id}. Pointez la fin avant d'en commencer un nouveau.`
          : 'Vous avez déjà un pointage en cours. Pointez la fin avant d\'en commencer un nouveau.'
      });
    }

    // Vérifier si le scooter est déjà utilisé par un autre livreur
    if (scooter_id) {
      const scooterCheck = await Timesheet.isScooterUsedByOthers(scooter_id, date, userId);
      if (scooterCheck.isUsed) {
        return res.status(400).json({
          success: false,
          message: `Le scooter ${scooter_id} est déjà utilisé par ${scooterCheck.username} aujourd'hui.`
        });
      }
    }

    // Upload de la photo
    const { filePath, fileName } = await uploadTimesheetPhoto(photo, userId, date, 'start');

    // Créer le pointage
    let timesheet;
    try {
      timesheet = await Timesheet.create({
        userId,
        scooterId: scooterIdOrNull,
        date,
        startTime: new Date(),
        startKm: kmNumber,
        startPhotoPath: filePath,
        startPhotoName: fileName
      });
    } catch (error) {
      // Catch DB unique constraint violation (pointage en cours pour ce scooter)
      if (error.code === '23505' && (error.constraint === 'unique_user_scooter_date' || error.constraint === 'idx_unique_user_scooter_date_ongoing')) {
        return res.status(409).json({
          success: false,
          message: scooter_id 
            ? `Vous avez déjà un pointage en cours avec le scooter ${scooter_id}.`
            : 'Vous avez déjà un pointage en cours.'
        });
      }
      throw error;
    }

    console.log(`✅ ${req.user.username} a pointé le début: ${kmNumber} km${scooter_id ? ` (Scooter: ${scooter_id})` : ''}`);

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
 * Body: FormData { timesheet_id, km, photo }
 */
const endActivity = async (req, res) => {
  try {
    const userId = req.user.id;
    const { timesheet_id, km } = req.body;
    const photo = req.file;

    console.log('🔍 endActivity - Données reçues:', {
      userId,
      timesheet_id,
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
    if (!timesheet_id || !km || !photo) {
      console.log('❌ Validation échouée:', { 
        hasTimesheetId: !!timesheet_id, 
        hasKm: !!km, 
        hasPhoto: !!photo 
      });
      return res.status(400).json({
        success: false,
        message: 'ID du pointage, kilométrage et photo sont requis.'
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

    // Récupérer le pointage existant par ID
    console.log('🔍 Recherche timesheet ID:', timesheet_id);
    const timesheet = await Timesheet.findById(timesheet_id);
    console.log('🔍 Timesheet trouvé:', timesheet ? {
      id: timesheet.id,
      user_id: timesheet.user_id,
      scooter_id: timesheet.scooter_id,
      hasEndTime: !!timesheet.end_time,
      startKm: timesheet.start_km,
      endKm: timesheet.end_km
    } : null);
    
    if (!timesheet) {
      console.log('❌ Aucun timesheet trouvé avec cet ID');
      return res.status(404).json({
        success: false,
        message: 'Pointage introuvable.'
      });
    }

    // Vérifier que c'est bien le pointage de l'utilisateur connecté
    if (timesheet.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez pointer la fin que pour vos propres pointages.'
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

    // Upload de la photo (utiliser timesheet.date au lieu de date)
    const { filePath, fileName } = await uploadTimesheetPhoto(photo, userId, timesheet.date, 'end');

    // Mettre à jour le pointage
    const updatedTimesheet = await Timesheet.updateEnd(timesheet.id, {
      endTime: new Date(),
      endKm: kmNumber,
      endPhotoPath: filePath,
      endPhotoName: fileName
    });

    console.log(`✅ ${req.user.username} a pointé la fin: ${kmNumber} km (Total: ${updatedTimesheet.total_km} km)${timesheet.scooter_id ? ` Scooter: ${timesheet.scooter_id}` : ''}`);

    res.json({
      success: true,
      message: `Fin d'activité enregistrée. Vous avez parcouru ${updatedTimesheet.total_km} km${timesheet.scooter_id ? ` avec le scooter ${timesheet.scooter_id}` : ''}.`,
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
 * Body: FormData { user_id, date, km, scooter_id (optionnel), photo }
 */
const startActivityForUser = async (req, res) => {
  try {
    const managerId = req.user.id;
    const managerUsername = req.user.username;
    const { user_id, date, km, scooter_id } = req.body;
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

    // Vérifier que le livreur n'a pas de pointage en cours (sans fin) pour cette date
    const hasOngoing = await Timesheet.hasOngoingPointage(user_id, date);
    if (hasOngoing) {
      return res.status(400).json({
        success: false,
        message: `${targetUser.username} a un pointage en cours. Veuillez pointer la fin avant de commencer un nouveau.`
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

    // Vérifier qu'il n'y a pas de pointage en cours pour ce scooter (permet réutilisation après pointage fin)
    const scooterIdOrNull = scooter_id || null;
    const existing = await Timesheet.findByUserScooterAndDate(user_id, scooterIdOrNull, date, true);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: scooter_id 
          ? `${targetUser.username} a déjà un pointage en cours avec le scooter ${scooter_id}.`
          : `${targetUser.username} a déjà un pointage en cours.`
      });
    }

    // Vérifier si le scooter est déjà utilisé par un autre livreur
    if (scooter_id) {
      const scooterCheck = await Timesheet.isScooterUsedByOthers(scooter_id, date, user_id);
      if (scooterCheck.isUsed) {
        return res.status(400).json({
          success: false,
          message: `Le scooter ${scooter_id} est déjà utilisé par ${scooterCheck.username} pour cette date.`
        });
      }
    }

    // Upload de la photo
    const { filePath, fileName } = await uploadTimesheetPhoto(photo, user_id, date, 'start');

    // Créer le pointage
    let timesheet;
    try {
      timesheet = await Timesheet.create({
        userId: user_id,
        scooterId: scooterIdOrNull,
        date,
        startTime: new Date(),
        startKm: kmNumber,
        startPhotoPath: filePath,
        startPhotoName: fileName
      });
    } catch (error) {
      // Catch DB unique constraint violation (pointage en cours pour ce scooter)
      if (error.code === '23505' && (error.constraint === 'unique_user_scooter_date' || error.constraint === 'idx_unique_user_scooter_date_ongoing')) {
        return res.status(409).json({
          success: false,
          message: scooter_id 
            ? `${targetUser.username} a déjà un pointage en cours avec le scooter ${scooter_id}.`
            : `${targetUser.username} a déjà un pointage en cours.`
        });
      }
      throw error;
    }

    // Log d'audit
    console.log(`📝 AUDIT: Manager ${managerUsername} a pointé le début pour ${targetUser.username} le ${date} (${kmNumber} km)${scooter_id ? ` Scooter: ${scooter_id}` : ''}`);

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
 * Body: FormData { timesheet_id, km, photo }
 */
const endActivityForUser = async (req, res) => {
  try {
    const managerId = req.user.id;
    const managerUsername = req.user.username;
    const { timesheet_id, km } = req.body;
    const photo = req.file;

    // Validations
    if (!timesheet_id || !km || !photo) {
      return res.status(400).json({
        success: false,
        message: 'ID du pointage, kilométrage et photo sont requis.'
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

    // Récupérer le pointage existant par ID
    const timesheet = await Timesheet.findById(timesheet_id);
    
    if (!timesheet) {
      return res.status(404).json({
        success: false,
        message: 'Pointage introuvable.'
      });
    }

    // Vérifier que l'utilisateur cible existe
    const targetUser = await User.findById(timesheet.user_id);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur introuvable.'
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
    const { filePath, fileName } = await uploadTimesheetPhoto(photo, timesheet.user_id, timesheet.date, 'end');

    // Mettre à jour le pointage
    const updatedTimesheet = await Timesheet.updateEnd(timesheet.id, {
      endTime: new Date(),
      endKm: kmNumber,
      endPhotoPath: filePath,
      endPhotoName: fileName
    });

    // Log d'audit
    console.log(`📝 AUDIT: Manager ${managerUsername} a pointé la fin pour ${targetUser.username} le ${timesheet.date} (${kmNumber} km, Total: ${updatedTimesheet.total_km} km)${timesheet.scooter_id ? ` Scooter: ${timesheet.scooter_id}` : ''}`);

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

    // Si c'est un livreur, vérifier les 15 minutes
    if (userRole === 'LIVREUR') {
      const modifyCheck = canLivreurModifyTimesheet(timesheet, userRole);
      if (!modifyCheck.allowed) {
        return res.status(403).json({
          success: false,
          message: `Impossible de supprimer. ${modifyCheck.message}`
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
    
    // Vérifier le délai de 15 minutes pour les livreurs
    if (isOwner && userRole === 'LIVREUR') {
      const modifyCheck = canLivreurModifyTimesheet(timesheet, userRole);
      if (!modifyCheck.allowed) {
        return res.status(403).json({
          success: false,
          message: modifyCheck.message
        });
      }
    }
    
    // Les managers et admins peuvent modifier à tout moment

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
    
    // Vérifier le délai de 15 minutes pour les livreurs (règle anti-tricherie)
    // IMPORTANT: Cette règle s'applique uniquement lors de la MODIFICATION
    if (isOwner && userRole === 'LIVREUR') {
      const modifyCheck = canLivreurModifyTimesheet(timesheet, userRole);
      if (!modifyCheck.allowed) {
        return res.status(403).json({
          success: false,
          message: modifyCheck.message
        });
      }
    }
    
    // Les managers et admins peuvent modifier à tout moment

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

/**
 * Obtenir les scooters utilisés pour une date
 * GET /api/timesheets/used-scooters?date=YYYY-MM-DD
 */
const getUsedScooters = async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date requise.'
      });
    }

    // Strict date validation (YYYY-MM-DD format)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        success: false,
        message: 'Format de date invalide. Utilisez YYYY-MM-DD.'
      });
    }

    // Additional validation: check if it's a valid date and reject overflowed dates
    const [year, month, day] = date.split('-').map(Number);
    const parsedDate = new Date(year, month - 1, day);
    
    if (isNaN(parsedDate.getTime()) || 
        parsedDate.getFullYear() !== year || 
        parsedDate.getMonth() !== month - 1 || 
        parsedDate.getDate() !== day) {
      return res.status(400).json({
        success: false,
        message: 'Date invalide.'
      });
    }

    const usedScooters = await Timesheet.getUsedScootersForDate(date);

    res.status(200).json({
      success: true,
      data: usedScooters
    });

  } catch (error) {
    console.error('Erreur getUsedScooters:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de la récupération des scooters utilisés.'
    });
  }
};

/**
 * Obtenir les pointages pour une plage de dates
 * GET /api/timesheets/date-range?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
const getTimesheetsForDateRange = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Date de début et date de fin requises.'
      });
    }

    // Valider le format des dates
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(start_date) || !dateRegex.test(end_date)) {
      return res.status(400).json({
        success: false,
        message: 'Format de date invalide. Utilisez YYYY-MM-DD.'
      });
    }

    // Vérifier que start_date <= end_date
    if (new Date(start_date) > new Date(end_date)) {
      return res.status(400).json({
        success: false,
        message: 'La date de début doit être antérieure ou égale à la date de fin.'
      });
    }

    // Récupérer les données groupées par livreur
    const data = await Timesheet.getTimesheetsForDateRange(start_date, end_date);
    
    // Récupérer les statistiques globales
    const stats = await Timesheet.getStatsForDateRange(start_date, end_date);

    res.json({
      success: true,
      data: data,
      stats: stats,
      start_date: start_date,
      end_date: end_date
    });

  } catch (error) {
    console.error('Erreur getTimesheetsForDateRange:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des pointages.'
    });
  }
};

/**
 * Exporter les pointages du jour en Excel
 * GET /api/timesheets/export?date=YYYY-MM-DD
 */
const exportTimesheetsToExcel = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || formatLocalDate(new Date());

    // Récupérer tous les livreurs avec leur pointage
    const data = await Timesheet.findAllActiveLivreursWithTimesheets(targetDate);
    
    // Récupérer les statistiques
    const stats = await Timesheet.getStatsForDate(targetDate);

    // Créer un nouveau classeur Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Pointages');

    // Définir les colonnes
    worksheet.columns = [
      { header: 'Livreur', key: 'username', width: 20 },
      { header: 'Scooter', key: 'scooter_id', width: 15 },
      { header: 'Début', key: 'start_time', width: 20 },
      { header: 'KM Début', key: 'start_km', width: 12 },
      { header: 'Fin', key: 'end_time', width: 20 },
      { header: 'KM Fin', key: 'end_km', width: 12 },
      { header: 'Kms parcourus', key: 'total_km', width: 15 },
      { header: 'Durée', key: 'duration', width: 15 },
      { header: 'Statut', key: 'status', width: 15 }
    ];

    // Styliser l'en-tête
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4A90E2' }
    };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Fonction pour formater la date/heure
    const formatDateTime = (dateTimeString) => {
      if (!dateTimeString) return '-';
      const dt = new Date(dateTimeString);
      return dt.toLocaleString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    };

    // Fonction pour calculer la durée
    const calculateDuration = (startTime, endTime) => {
      if (!startTime || !endTime) return '-';
      const start = new Date(startTime);
      const end = new Date(endTime);
      const diff = end - start;
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      return `${hours}h ${minutes}min`;
    };

    // Fonction pour formater le statut
    const formatStatus = (status) => {
      switch (status) {
        case 'complete': return 'Complet';
        case 'partial': return 'En cours';
        case 'missing': return 'Non pointé';
        default: return status;
      }
    };

    // Ajouter les données
    data.forEach(row => {
      worksheet.addRow({
        username: row.username,
        scooter_id: row.scooter_id || '-',
        start_time: formatDateTime(row.start_time),
        start_km: row.start_km !== null ? row.start_km : '-',
        end_time: formatDateTime(row.end_time),
        end_km: row.end_km !== null ? row.end_km : '-',
        total_km: row.total_km !== null ? `${row.total_km} km` : '-',
        duration: calculateDuration(row.start_time, row.end_time),
        status: formatStatus(row.status)
      });
    });

    // Appliquer des bordures à toutes les cellules
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // Ajouter les statistiques en bas
    const lastRow = worksheet.lastRow.number;
    worksheet.addRow([]);
    worksheet.addRow(['Statistiques du jour']);
    worksheet.getRow(lastRow + 2).font = { bold: true, size: 14 };
    worksheet.addRow([]);
    worksheet.addRow(['Total pointages:', stats.totalTimesheets]);
    worksheet.addRow(['Patrouille couverte:', `${stats.percentageCovered}%`]);
    worksheet.addRow(['Km moyen:', stats.averageKm ? `${stats.averageKm} km` : '-']);
    worksheet.addRow(['Non-pointés:', stats.notPointedCount]);
    worksheet.addRow(['Taux de pointage:', `${stats.pointageRate}%`]);

    // Définir le nom du fichier
    const filename = `Pointages_${targetDate}.xlsx`;

    // Envoyer le fichier
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Erreur exportTimesheetsToExcel:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'export Excel.'
    });
  }
};

/**
 * Exporter les pointages d'une plage de dates en Excel (avec 3 onglets)
 * GET /api/timesheets/export-range?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
const exportTimesheetsRangeToExcel = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Date de début et date de fin requises.'
      });
    }

    // Récupérer les données groupées par livreur
    const data = await Timesheet.getTimesheetsForDateRange(start_date, end_date);
    
    // Récupérer les statistiques globales
    const stats = await Timesheet.getStatsForDateRange(start_date, end_date);

    // Créer un nouveau classeur Excel
    const workbook = new ExcelJS.Workbook();

    // ==================== ONGLET 1 : RÉSUMÉ PAR LIVREUR ====================
    const summarySheet = workbook.addWorksheet('Résumé');

    summarySheet.columns = [
      { header: 'Livreur', key: 'username', width: 20 },
      { header: 'Total jours', key: 'total_days', width: 12 },
      { header: 'Jours complets', key: 'days_complete', width: 15 },
      { header: 'Jours partiels', key: 'days_partial', width: 15 },
      { header: 'Jours manquants', key: 'days_missing', width: 18 },
      { header: 'Total KM', key: 'total_km', width: 12 },
      { header: 'Moy. KM/jour', key: 'avg_km_per_day', width: 15 },
      { header: 'Taux présence', key: 'presence_rate', width: 15 }
    ];

    // Styliser l'en-tête
    summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2C5282' }
    };
    summarySheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Ajouter les données
    data.forEach(livreur => {
      const presenceRate = livreur.total_days > 0 
        ? ((livreur.days_complete + livreur.days_partial) / livreur.total_days * 100).toFixed(1)
        : 0;

      summarySheet.addRow({
        username: livreur.username,
        total_days: livreur.total_days,
        days_complete: livreur.days_complete,
        days_partial: livreur.days_partial,
        days_missing: livreur.days_missing,
        total_km: `${livreur.total_km} km`,
        avg_km_per_day: `${livreur.avg_km_per_day} km`,
        presence_rate: `${presenceRate}%`
      });
    });

    // Bordures
    summarySheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // ==================== ONGLET 2 : DÉTAILS JOUR PAR JOUR ====================
    const detailsSheet = workbook.addWorksheet('Détails');

    detailsSheet.columns = [
      { header: 'Livreur', key: 'username', width: 20 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Scooter', key: 'scooter_id', width: 12 },
      { header: 'Début', key: 'start_time', width: 18 },
      { header: 'KM Début', key: 'start_km', width: 12 },
      { header: 'Fin', key: 'end_time', width: 18 },
      { header: 'KM Fin', key: 'end_km', width: 12 },
      { header: 'KM parcourus', key: 'total_km', width: 15 },
      { header: 'Durée', key: 'duration', width: 12 },
      { header: 'Statut', key: 'status', width: 12 }
    ];

    // Styliser l'en-tête
    detailsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    detailsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4A90E2' }
    };
    detailsSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Fonction pour formater la date/heure
    const formatDateTime = (dateTimeString) => {
      if (!dateTimeString) return '-';
      const dt = new Date(dateTimeString);
      return dt.toLocaleString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    };

    // Fonction pour formater la date seule
    const formatDate = (dateString) => {
      if (!dateString) return '-';
      const dt = new Date(dateString);
      return dt.toLocaleDateString('fr-FR');
    };

    // Fonction pour calculer la durée
    const calculateDuration = (startTime, endTime) => {
      if (!startTime || !endTime) return '-';
      const start = new Date(startTime);
      const end = new Date(endTime);
      const diff = end - start;
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      return `${hours}h${minutes.toString().padStart(2, '0')}`;
    };

    // Fonction pour formater le statut
    const formatStatus = (status) => {
      switch (status) {
        case 'complete': return 'Complet';
        case 'partial': return 'En cours';
        case 'missing': return 'Non pointé';
        default: return status;
      }
    };

    // Ajouter toutes les lignes de détails
    data.forEach(livreur => {
      livreur.timesheets.forEach(ts => {
        detailsSheet.addRow({
          username: livreur.username,
          date: formatDate(ts.date),
          scooter_id: ts.scooter_id || '-',
          start_time: formatDateTime(ts.start_time),
          start_km: ts.start_km !== null ? ts.start_km : '-',
          end_time: formatDateTime(ts.end_time),
          end_km: ts.end_km !== null ? ts.end_km : '-',
          total_km: ts.total_km !== null ? `${ts.total_km} km` : '-',
          duration: calculateDuration(ts.start_time, ts.end_time),
          status: formatStatus(ts.status)
        });
      });
    });

    // Bordures
    detailsSheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // ==================== ONGLET 3 : STATISTIQUES ====================
    const statsSheet = workbook.addWorksheet('Statistiques');

    // Titre
    statsSheet.mergeCells('A1:B1');
    statsSheet.getCell('A1').value = `Statistiques de la période du ${formatDate(start_date)} au ${formatDate(end_date)}`;
    statsSheet.getCell('A1').font = { bold: true, size: 14 };
    statsSheet.getCell('A1').alignment = { horizontal: 'center' };

    // Statistiques globales
    statsSheet.addRow([]);
    statsSheet.addRow(['Indicateur', 'Valeur']);
    statsSheet.getRow(3).font = { bold: true };
    statsSheet.getRow(3).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' }
    };

    statsSheet.addRow(['Total pointages attendus', stats.total_expected]);
    statsSheet.addRow(['Total pointages effectués', stats.total_timesheets]);
    statsSheet.addRow(['Pointages complets', stats.complete_timesheets]);
    statsSheet.addRow(['Pointages partiels', stats.partial_timesheets]);
    statsSheet.addRow(['Pointages manquants', stats.missing_timesheets]);
    statsSheet.addRow(['Taux de pointage', `${stats.pointage_rate}%`]);
    statsSheet.addRow([]);
    statsSheet.addRow(['Total kilomètres parcourus', `${stats.total_km} km`]);
    statsSheet.addRow(['Moyenne kilomètres par pointage', `${stats.avg_km} km`]);

    // Largeur des colonnes
    statsSheet.getColumn(1).width = 30;
    statsSheet.getColumn(2).width = 20;

    // Bordures
    for (let i = 3; i <= statsSheet.lastRow.number; i++) {
      statsSheet.getRow(i).eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    }

    // Définir le nom du fichier
    const filename = `Pointages_${start_date}_au_${end_date}.xlsx`;

    // Envoyer le fichier
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Erreur exportTimesheetsRangeToExcel:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'export Excel.'
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
  updateEndActivity,
  getUsedScooters,
  exportTimesheetsToExcel,
  getTimesheetsForDateRange,
  exportTimesheetsRangeToExcel
};
