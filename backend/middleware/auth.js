const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

// Middleware d'authentification
const authenticateToken = async (req, res, next) => {
  try {
    // Récupérer le token depuis les cookies ou l'en-tête Authorization
    let token = req.cookies.auth_token;
    
    // Fallback: vérifier l'en-tête Authorization pour les mobiles
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    if (!token) {
      return res.status(401).json({
        error: 'Token d\'authentification manquant'
      });
    }

    // Vérifier et décoder le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Récupérer l'utilisateur depuis la base de données
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        error: 'Utilisateur non trouvé'
      });
    }

    console.log('🔍 Auth middleware - User loaded:', {
      id: user.id,
      username: user.username,
      role: user.role,
      roleType: typeof user.role,
      isActive: user.is_active,
      userConstructor: user.constructor.name,
      hasIsManagerOrAdminMethod: typeof user.isManagerOrAdmin === 'function'
    });

    // Ajouter l'utilisateur à la requête
    req.user = user;
    next();
    
  } catch (error) {
    console.error('Erreur d\'authentification:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Token invalide'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expiré'
      });
    }
    
    return res.status(500).json({
      error: 'Erreur d\'authentification'
    });
  }
};

// Middleware de vérification de rôle
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentification requise'
      });
    }

    // Convertir en tableau si c'est une chaîne
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Permissions insuffisantes',
        required: allowedRoles,
        current: req.user.role
      });
    }

    next();
  };
};

// Middleware pour les managers et admins
const requireManagerOrAdmin = requireRole(['MANAGER', 'ADMIN']);

// Middleware pour les admins uniquement
const requireAdmin = requireRole(['ADMIN']);

// Middleware pour vérifier si l'utilisateur peut supprimer toutes les commandes
const requireDeleteAllPermission = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentification requise'
    });
  }

  if (!req.user.canDeleteAllOrders()) {
    return res.status(403).json({
      error: 'Permissions insuffisantes pour supprimer toutes les commandes'
    });
  }

  next();
};

// Middleware pour vérifier la propriété d'une ressource
const requireOwnership = (resourceIdParam = 'id') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[resourceIdParam];
      
      // Les managers et admins peuvent accéder à toutes les ressources
      if (req.user.isManagerOrAdmin()) {
        return next();
      }

      // Pour les livreurs, vérifier la propriété selon le type de ressource
      if (req.route.path.includes('/orders')) {
        const Order = require('../models/Order');
        const belongsToUser = await Order.belongsToUser(resourceId, req.user.id);
        
        if (!belongsToUser) {
          return res.status(403).json({
            error: 'Accès non autorisé à cette commande'
          });
        }
      }

      next();
    } catch (error) {
      console.error('Erreur de vérification de propriété:', error);
      return res.status(500).json({
        error: 'Erreur de vérification des permissions'
      });
    }
  };
};

// Générer un token JWT
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { 
      expiresIn: '24h',
      issuer: 'matix-livreur',
      audience: 'matix-livreur-users'
    }
  );
};

// Définir un cookie d'authentification sécurisé
const setAuthCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: isProduction, // HTTPS en production
    sameSite: isProduction ? 'lax' : 'lax', // 'lax' for better mobile compatibility
    maxAge: 24 * 60 * 60 * 1000, // 24 heures
    path: '/'
  });
};

// Supprimer le cookie d'authentification
const clearAuthCookie = (res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'lax' : 'lax',
    path: '/'
  });
};

module.exports = {
  authenticateToken,
  requireRole,
  requireManagerOrAdmin,
  requireAdmin,
  requireDeleteAllPermission,
  requireOwnership,
  generateToken,
  setAuthCookie,
  clearAuthCookie
}; 