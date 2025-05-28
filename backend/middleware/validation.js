const { body, param, query, validationResult } = require('express-validator');

// Middleware pour gérer les erreurs de validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Données invalides',
      details: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  
  next();
};

// Validation pour la connexion
const validateLogin = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Le nom d\'utilisateur est requis')
    .isLength({ min: 2, max: 50 })
    .withMessage('Le nom d\'utilisateur doit contenir entre 2 et 50 caractères'),
    
  body('password')
    .notEmpty()
    .withMessage('Le mot de passe est requis')
    .isLength({ min: 6 })
    .withMessage('Le mot de passe doit contenir au moins 6 caractères'),
    
  handleValidationErrors
];

// Validation pour le changement de mot de passe
const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Le mot de passe actuel est requis'),
    
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Le nouveau mot de passe doit contenir au moins 8 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Le nouveau mot de passe doit contenir au moins une minuscule, une majuscule, un chiffre et un caractère spécial'),
    
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('La confirmation du mot de passe ne correspond pas');
      }
      return true;
    }),
    
  handleValidationErrors
];

// Validation pour la création d'utilisateur
const validateUserCreation = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Le nom d\'utilisateur est requis')
    .isLength({ min: 2, max: 50 })
    .withMessage('Le nom d\'utilisateur doit contenir entre 2 et 50 caractères')
    .matches(/^[a-zA-Z0-9\s]+$/)
    .withMessage('Le nom d\'utilisateur ne peut contenir que des lettres, chiffres et espaces'),
    
  body('password')
    .isLength({ min: 8 })
    .withMessage('Le mot de passe doit contenir au moins 8 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Le mot de passe doit contenir au moins une minuscule, une majuscule, un chiffre et un caractère spécial'),
    
  body('role')
    .isIn(['LIVREUR', 'MANAGER', 'ADMIN'])
    .withMessage('Le rôle doit être LIVREUR, MANAGER ou ADMIN'),
    
  handleValidationErrors
];

// Validation pour la mise à jour d'utilisateur
const validateUserUpdate = [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Le nom d\'utilisateur doit contenir entre 2 et 50 caractères')
    .matches(/^[a-zA-Z0-9\s]+$/)
    .withMessage('Le nom d\'utilisateur ne peut contenir que des lettres, chiffres et espaces'),
    
  body('role')
    .optional()
    .isIn(['LIVREUR', 'MANAGER', 'ADMIN'])
    .withMessage('Le rôle doit être LIVREUR, MANAGER ou ADMIN'),
    
  handleValidationErrors
];

// Validation pour la création de commande
const validateOrderCreation = [
  body('client_name')
    .trim()
    .notEmpty()
    .withMessage('Le nom du client est requis')
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom du client doit contenir entre 2 et 100 caractères'),
    
  body('phone_number')
    .trim()
    .notEmpty()
    .withMessage('Le numéro de téléphone est requis')
    .custom((value) => {
      // Accepter tous les formats numériques (avec ou sans espaces, tirets, parenthèses)
      const cleanPhone = value.replace(/[\s\-\(\)\+]/g, '');
      if (!/^\d{6,20}$/.test(cleanPhone)) {
        throw new Error('Le numéro de téléphone doit contenir entre 6 et 20 chiffres');
      }
      return true;
    }),
    
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('L\'adresse ne peut pas dépasser 500 caractères'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('La description ne peut pas dépasser 1000 caractères'),
    
  body('amount')
    .optional()
    .default(0)
    .trim()
    .isFloat({ min: 0, max: 1000000 })
    .withMessage('Le montant doit être un nombre positif inférieur à 1 000 000'),
    
  body('order_type')
    .isIn(['MATA', 'MLC', 'AUTRE'])
    .withMessage('Le type de commande doit être MATA, MLC ou AUTRE'),
    
  handleValidationErrors
];

// Validation pour la mise à jour de commande
const validateOrderUpdate = [
  body('client_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom du client doit contenir entre 2 et 100 caractères'),
    
  body('phone_number')
    .optional()
    .trim()
    .custom((value) => {
      if (value) {
        // Accepter tous les formats numériques (avec ou sans espaces, tirets, parenthèses)
        const cleanPhone = value.replace(/[\s\-\(\)\+]/g, '');
        if (!/^\d{6,20}$/.test(cleanPhone)) {
          throw new Error('Le numéro de téléphone doit contenir entre 6 et 20 chiffres');
        }
      }
      return true;
    }),
    
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('L\'adresse ne peut pas dépasser 500 caractères'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('La description ne peut pas dépasser 1000 caractères'),
    
  body('amount')
    .optional()
    .default(0)
    .trim()
    .isFloat({ min: 0, max: 1000000 })
    .withMessage('Le montant doit être un nombre positif inférieur à 1 000 000'),
    
  body('order_type')
    .optional()
    .isIn(['MATA', 'MLC', 'AUTRE'])
    .withMessage('Le type de commande doit être MATA, MLC ou AUTRE'),
    
  body('commentaire')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Le commentaire ne peut pas dépasser 1000 caractères'),
    
  handleValidationErrors
];

// Validation pour les paramètres UUID
const validateUUID = [
  param('id')
    .isUUID()
    .withMessage('L\'ID doit être un UUID valide'),
    
  handleValidationErrors
];

// Validation pour les paramètres livreurId
const validateLivreurId = [
  param('livreurId')
    .isUUID()
    .withMessage('L\'ID du livreur doit être un UUID valide'),
    
  handleValidationErrors
];

// Validation pour les dates
const validateDate = [
  query('date')
    .optional()
    .isISO8601()
    .withMessage('La date doit être au format ISO 8601 (YYYY-MM-DD)'),
    
  handleValidationErrors
];

// Validation pour les plages de dates
const validateDateRange = [
  query('startDate')
    .isISO8601()
    .withMessage('La date de début doit être au format ISO 8601 (YYYY-MM-DD)'),
    
  query('endDate')
    .isISO8601()
    .withMessage('La date de fin doit être au format ISO 8601 (YYYY-MM-DD)')
    .custom((value, { req }) => {
      const startDate = new Date(req.query.startDate);
      const endDate = new Date(value);
      
      if (endDate < startDate) {
        throw new Error('La date de fin doit être postérieure à la date de début');
      }
      
      // Limiter à 1 an maximum
      const oneYearLater = new Date(startDate);
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
      
      if (endDate > oneYearLater) {
        throw new Error('La plage de dates ne peut pas dépasser 1 an');
      }
      
      return true;
    }),
    
  handleValidationErrors
];

// Validation pour la pagination
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Le numéro de page doit être un entier positif'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('La limite doit être un entier entre 1 et 100'),
    
  handleValidationErrors
];

// Sanitisation des données d'entrée
const sanitizeInput = (req, res, next) => {
  // Supprimer les espaces en début et fin pour tous les champs string
  for (const key in req.body) {
    if (typeof req.body[key] === 'string') {
      req.body[key] = req.body[key].trim();
    }
  }
  
  next();
};

// Validation pour la création d'abonnement
const validateSubscriptionCreation = [
  body('client_name')
    .trim()
    .notEmpty()
    .withMessage('Le nom du client est requis')
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom du client doit contenir entre 2 et 100 caractères'),
    
  body('phone_number')
    .trim()
    .notEmpty()
    .withMessage('Le numéro de téléphone est requis')
    .custom((value) => {
      const cleanPhone = value.replace(/[\s\-\(\)\+]/g, '');
      if (!/^\d{6,20}$/.test(cleanPhone)) {
        throw new Error('Le numéro de téléphone doit contenir entre 6 et 20 chiffres');
      }
      return true;
    }),
    
  body('total_deliveries')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Le nombre de livraisons doit être entre 1 et 50'),
    
  body('expiry_months')
    .optional()
    .isInt({ min: 1, max: 24 })
    .withMessage('La durée d\'expiration doit être entre 1 et 24 mois'),
    
  handleValidationErrors
];

// Validation pour la mise à jour d'abonnement
const validateSubscriptionUpdate = [
  body('client_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom du client doit contenir entre 2 et 100 caractères'),
    
  body('phone_number')
    .optional()
    .trim()
    .custom((value) => {
      if (value) {
        const cleanPhone = value.replace(/[^\d]/g, '');
        if (!/^\d{6,20}$/.test(cleanPhone)) {
          throw new Error('Le numéro de téléphone doit contenir entre 6 et 20 chiffres');
        }
      }
      return true;
    }),
    
  body('expiry_date')
    .optional()
    .isISO8601()
    .withMessage('La date d\'expiration doit être au format ISO 8601')
    .custom((value) => {
      const expiryDate = new Date(value);
      const now = new Date();
      if (expiryDate <= now) {
        throw new Error('La date d\'expiration doit être dans le futur');
      }
      return true;
    }),
    
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('Le statut actif doit être un booléen'),
    
  body('used_deliveries')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('Le nombre de livraisons utilisées doit être entre 0 et 50'),
    
  body('remaining_deliveries')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('Le nombre de livraisons restantes doit être entre 0 et 50'),
    
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Le prix doit être un nombre positif'),
    
  handleValidationErrors
];

// Validation pour la création de commande MLC avec abonnement
const validateMLCOrderCreation = [
  body('client_name')
    .trim()
    .notEmpty()
    .withMessage('Le nom du client est requis')
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom du client doit contenir entre 2 et 100 caractères'),
    
  body('phone_number')
    .trim()
    .notEmpty()
    .withMessage('Le numéro de téléphone est requis')
    .custom((value) => {
      const cleanPhone = value.replace(/[\s\-\(\)\+]/g, '');
      if (!/^\d{6,20}$/.test(cleanPhone)) {
        throw new Error('Le numéro de téléphone doit contenir entre 6 et 20 chiffres');
      }
      return true;
    }),
    
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('L\'adresse ne peut pas dépasser 500 caractères'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('La description ne peut pas dépasser 1000 caractères'),
    
  body('course_price')
    .optional()
    .isFloat({ min: 0, max: 999999.99 })
    .withMessage('Le prix de la course doit être un nombre positif'),
    
  body('card_number')
    .optional()
    .trim()
    .matches(/^MLC-\d{4}-\d{4}$/)
    .withMessage('Le numéro de carte doit être au format MLC-YYYY-NNNN'),
    
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateLogin,
  validatePasswordChange,
  validateUserCreation,
  validateUserUpdate,
  validateOrderCreation,
  validateOrderUpdate,
  validateSubscriptionCreation,
  validateSubscriptionUpdate,
  validateMLCOrderCreation,
  validateUUID,
  validateLivreurId,
  validateDate,
  validateDateRange,
  validatePagination,
  sanitizeInput
}; 