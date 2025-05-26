const express = require('express');
const router = express.Router();

const UserController = require('../controllers/userController');
const { 
  authenticateToken, 
  requireManagerOrAdmin, 
  requireAdmin 
} = require('../middleware/auth');
const { 
  validateUserCreation,
  validateUserUpdate,
  validateUUID,
  validatePasswordChange,
  sanitizeInput 
} = require('../middleware/validation');

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// Routes pour les managers et admins
router.get('/', requireManagerOrAdmin, UserController.getAllUsers);
router.get('/stats', requireManagerOrAdmin, UserController.getUserStats);
router.get('/role/:role', requireManagerOrAdmin, UserController.getUsersByRole);
router.get('/livreurs', requireManagerOrAdmin, UserController.getAllLivreurs);
router.get('/livreurs/active', requireManagerOrAdmin, UserController.getActiveLivreurs);
router.get('/:id', requireManagerOrAdmin, validateUUID, UserController.getUserById);

// Création d'utilisateur (managers et admins)
router.post('/', 
  requireManagerOrAdmin, 
  sanitizeInput, 
  validateUserCreation, 
  UserController.createUser
);

// Mise à jour d'utilisateur (managers et admins)
router.put('/:id', 
  requireManagerOrAdmin, 
  validateUUID, 
  sanitizeInput, 
  validateUserUpdate, 
  UserController.updateUser
);

// Activer/désactiver un livreur (managers et admins)
router.patch('/:id/toggle-active', 
  requireManagerOrAdmin, 
  validateUUID, 
  UserController.toggleUserActive
);

// Suppression d'utilisateur (admins seulement)
router.delete('/:id', 
  requireAdmin, 
  validateUUID, 
  UserController.deleteUser
);

// Réinitialisation de mot de passe (admins seulement)
router.post('/:id/reset-password', 
  requireAdmin, 
  validateUUID, 
  sanitizeInput,
  validatePasswordChange,
  UserController.resetUserPassword
);

module.exports = router;