// Configuration globale pour les tests
require('dotenv').config({ path: '.env.test' });

// Configuration de la base de données de test
process.env.DB_NAME = process.env.DB_NAME || 'matix_livreur_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-for-testing-only';

// Augmenter le timeout pour les tests de base de données
jest.setTimeout(10000);

// Mock console.log pour les tests (optionnel)
if (process.env.NODE_ENV === 'test') {
  console.log = jest.fn();
  console.error = jest.fn();
} 