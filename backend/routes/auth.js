const express = require('express');
const router = express.Router();

const AuthController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { 
  validateLogin, 
  validatePasswordChange,
  sanitizeInput 
} = require('../middleware/validation');

// Route de connexion
router.post('/login', sanitizeInput, validateLogin, AuthController.login);

// Route de déconnexion
router.post('/logout', AuthController.logout);

// Route pour vérifier l'authentification
router.get('/check', authenticateToken, AuthController.checkAuth);

// Route pour obtenir le profil utilisateur
router.get('/profile', authenticateToken, AuthController.getProfile);

// Route pour changer le mot de passe
router.post('/change-password', 
  authenticateToken, 
  sanitizeInput, 
  validatePasswordChange, 
  AuthController.changePassword
);

// Route pour rafraîchir le token
router.post('/refresh', authenticateToken, AuthController.refreshToken);

module.exports = router; 