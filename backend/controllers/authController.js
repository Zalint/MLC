const User = require('../models/User');
const { generateToken, setAuthCookie, clearAuthCookie } = require('../middleware/auth');

class AuthController {
  // Connexion utilisateur
  static async login(req, res) {
    try {
      console.log('🔐 LOGIN ATTEMPT:', {
        body: req.body,
        username: req.body?.username,
        passwordLength: req.body?.password?.length
      });

      const { username, password } = req.body;

      // Clear any existing auth cookie first to prevent conflicts
      console.log('🧹 Clearing any existing auth cookie...');
      clearAuthCookie(res);

      // Rechercher l'utilisateur
      console.log('🔍 Searching for user:', username);
      const user = await User.findByUsername(username);
      
      if (!user) {
        console.log('❌ User not found:', username);
        return res.status(401).json({
          error: 'Nom d\'utilisateur ou mot de passe incorrect'
        });
      }

      console.log('✅ User found:', {
        id: user.id,
        username: user.username,
        role: user.role,
        hasPasswordHash: !!user.password_hash
      });

      // Vérifier le mot de passe
      console.log('🔑 Verifying password...');
      const isValidPassword = await user.verifyPassword(password);
      console.log('🔑 Password verification result:', isValidPassword);
      
      if (!isValidPassword) {
        console.log('❌ Invalid password for user:', username);
        return res.status(401).json({
          error: 'Nom d\'utilisateur ou mot de passe incorrect'
        });
      }

      // Générer le token JWT
      console.log('🎫 Generating JWT token...');
      const token = generateToken(user.id);
      console.log('🎫 Token generated successfully');
      
      // Définir le cookie sécurisé
      console.log('🍪 Setting auth cookie...');
      setAuthCookie(res, token);

      // Réponse de succès avec token pour les mobiles qui ne supportent pas les cookies
      console.log('✅ Login successful for user:', username);
      res.json({
        message: 'Connexion réussie',
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          allowed_order_types: user.allowed_order_types || null
        },
        token: token // Include token for mobile fallback
      });

    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      console.error('🚨 LOGIN ERROR DETAILS:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      res.status(500).json({
        error: process.env.NODE_ENV === 'production'
          ? 'Erreur interne du serveur'
          : error.message
      });
    }
  }

  // Déconnexion utilisateur
  static async logout(req, res) {
    try {
      // Supprimer le cookie d'authentification
      clearAuthCookie(res);
      
      res.json({
        message: 'Déconnexion réussie'
      });

    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Vérifier le statut d'authentification
  static async checkAuth(req, res) {
    try {
      // L'utilisateur est déjà disponible grâce au middleware authenticateToken
      res.json({
        authenticated: true,
        user: {
          id: req.user.id,
          username: req.user.username,
          role: req.user.role,
          allowed_order_types: req.user.allowed_order_types || null
        }
      });

    } catch (error) {
      console.error('Erreur lors de la vérification d\'authentification:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Changer le mot de passe
  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      // Récupérer l'utilisateur actuel
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          error: 'Utilisateur non trouvé'
        });
      }

      // Vérifier le mot de passe actuel
      const isValidCurrentPassword = await user.verifyPassword(currentPassword);
      
      if (!isValidCurrentPassword) {
        return res.status(400).json({
          error: 'Mot de passe actuel incorrect'
        });
      }

      // Vérifier que le nouveau mot de passe est différent
      const isSamePassword = await user.verifyPassword(newPassword);
      
      if (isSamePassword) {
        return res.status(400).json({
          error: 'Le nouveau mot de passe doit être différent de l\'actuel'
        });
      }

      // Changer le mot de passe
      await User.changePassword(userId, newPassword);

      // Générer un nouveau token (pour invalider l'ancien)
      const newToken = generateToken(userId);
      setAuthCookie(res, newToken);

      res.json({
        message: 'Mot de passe modifié avec succès'
      });

    } catch (error) {
      console.error('Erreur lors du changement de mot de passe:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Obtenir les informations du profil utilisateur
  static async getProfile(req, res) {
    try {
      const user = await User.findById(req.user.id);
      
      if (!user) {
        return res.status(404).json({
          error: 'Utilisateur non trouvé'
        });
      }

      res.json({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          created_at: user.created_at,
          updated_at: user.updated_at
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération du profil:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }

  // Rafraîchir le token (optionnel, pour étendre la session)
  static async refreshToken(req, res) {
    try {
      const userId = req.user.id;
      
      // Générer un nouveau token
      const newToken = generateToken(userId);
      setAuthCookie(res, newToken);

      res.json({
        message: 'Token rafraîchi avec succès'
      });

    } catch (error) {
      console.error('Erreur lors du rafraîchissement du token:', error);
      res.status(500).json({
        error: 'Erreur interne du serveur'
      });
    }
  }
}

module.exports = AuthController; 