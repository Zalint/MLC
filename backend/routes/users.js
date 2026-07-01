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

// Autorise MANAGER/ADMIN/READONLY et les chefs livreurs (LIVREUR + is_chef_livreur).
// Utilisé uniquement pour la liste des livreurs actifs (modale de réassignation),
// sans élargir l'accès à la liste complète des utilisateurs.
const requireViewerOrChefLivreur = (req, res, next) => {
  const u = req.user;
  if (u && (['MANAGER', 'ADMIN', 'READONLY'].includes(u.role) || (u.role === 'LIVREUR' && u.is_chef_livreur === true))) {
    return next();
  }
  return res.status(403).json({ error: 'Permissions insuffisantes' });
};

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// Routes de lecture accessibles aux managers, admins et readonly
router.get('/', requireViewer, UserController.getAllUsers);
router.get('/stats', requireViewer, UserController.getUserStats);
router.get('/role/:role', requireViewer, UserController.getUsersByRole);
router.get('/livreurs', requireViewer, UserController.getAllLivreurs);
router.get('/livreurs/active', requireViewerOrChefLivreur, UserController.getActiveLivreurs);
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