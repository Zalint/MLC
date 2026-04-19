const express = require('express');
const router = express.Router();

const UserController = require('../controllers/userController');
const {
  authenticateToken,
  requireManagerOrAdmin,
  requireAdmin,
  requireViewer
} = require('../middleware/auth');
const {
  validateUserCreation,
  validateUserUpdate,
  validateUUID,
  validatePasswordChange,
  validateAdminPasswordReset,
  sanitizeInput
} = require('../middleware/validation');

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// Routes de lecture accessibles aux managers, admins et readonly
router.get('/', requireViewer, UserController.getAllUsers);
router.get('/stats', requireViewer, UserController.getUserStats);
router.get('/role/:role', requireViewer, UserController.getUsersByRole);
router.get('/livreurs', requireViewer, UserController.getAllLivreurs);
router.get('/livreurs/active', requireViewer, UserController.getActiveLivreurs);
router.get('/active', requireViewer, UserController.getAllActiveUsers);
router.get('/:id', requireViewer, validateUUID, UserController.getUserById);

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

// Réinitialisation de mot de passe (managers/admins avec code secret)
router.post('/:id/reset-password',
  requireManagerOrAdmin,
  validateUUID,
  sanitizeInput,
  validateAdminPasswordReset,
  UserController.resetUserPassword
);

module.exports = router;