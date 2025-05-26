const request = require('supertest');
const app = require('../app');
const User = require('../models/User');

describe('Authentication', () => {
  let testUser;
  let authCookie;

  beforeAll(async () => {
    // Créer un utilisateur de test
    testUser = await User.create({
      username: 'testuser',
      password: 'TestPassword123!',
      role: 'LIVREUR'
    });
  });

  afterAll(async () => {
    // Nettoyer après les tests
    if (testUser) {
      await User.delete(testUser.id);
    }
  });

  describe('POST /api/v1/auth/login', () => {
    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Connexion réussie');
      expect(response.body.user).toHaveProperty('username', 'testuser');
      expect(response.body.user).toHaveProperty('role', 'LIVREUR');
      
      // Vérifier que le cookie est défini
      expect(response.headers['set-cookie']).toBeDefined();
      authCookie = response.headers['set-cookie'][0];
    });

    test('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Nom d\'utilisateur ou mot de passe incorrect');
    });

    test('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'nonexistent',
          password: 'TestPassword123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Nom d\'utilisateur ou mot de passe incorrect');
    });

    test('should validate input data', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: '',
          password: ''
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Données invalides');
    });
  });

  describe('GET /api/v1/auth/check', () => {
    test('should return user info when authenticated', async () => {
      const response = await request(app)
        .get('/api/v1/auth/check')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.authenticated).toBe(true);
      expect(response.body.user).toHaveProperty('username', 'testuser');
    });

    test('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/v1/auth/check');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token d\'authentification manquant');
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    test('should change password with valid data', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Cookie', authCookie)
        .send({
          currentPassword: 'TestPassword123!',
          newPassword: 'NewPassword123!',
          confirmPassword: 'NewPassword123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Mot de passe modifié avec succès');
    });

    test('should reject wrong current password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Cookie', authCookie)
        .send({
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewPassword123!',
          confirmPassword: 'NewPassword123!'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Mot de passe actuel incorrect');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    test('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Déconnexion réussie');
    });
  });
});

describe('User Model', () => {
  let testUser;

  afterEach(async () => {
    if (testUser) {
      await User.delete(testUser.id);
      testUser = null;
    }
  });

  test('should create user with valid data', async () => {
    testUser = await User.create({
      username: 'newuser',
      password: 'Password123!',
      role: 'LIVREUR'
    });

    expect(testUser).toHaveProperty('id');
    expect(testUser.username).toBe('newuser');
    expect(testUser.role).toBe('LIVREUR');
    expect(testUser.password_hash).toBeDefined();
    expect(testUser.password_hash).not.toBe('Password123!'); // Should be hashed
  });

  test('should reject duplicate username', async () => {
    testUser = await User.create({
      username: 'duplicateuser',
      password: 'Password123!',
      role: 'LIVREUR'
    });

    await expect(User.create({
      username: 'duplicateuser',
      password: 'Password123!',
      role: 'MANAGER'
    })).rejects.toThrow('Ce nom d\'utilisateur existe déjà');
  });

  test('should verify password correctly', async () => {
    testUser = await User.create({
      username: 'passwordtest',
      password: 'Password123!',
      role: 'LIVREUR'
    });

    const isValid = await testUser.verifyPassword('Password123!');
    const isInvalid = await testUser.verifyPassword('WrongPassword');

    expect(isValid).toBe(true);
    expect(isInvalid).toBe(false);
  });

  test('should find user by username', async () => {
    testUser = await User.create({
      username: 'findtest',
      password: 'Password123!',
      role: 'LIVREUR'
    });

    const foundUser = await User.findByUsername('findtest');
    expect(foundUser).toBeDefined();
    expect(foundUser.username).toBe('findtest');

    const notFound = await User.findByUsername('nonexistent');
    expect(notFound).toBeNull();
  });

  test('should check user permissions correctly', async () => {
    const livreur = await User.create({
      username: 'livreur',
      password: 'Password123!',
      role: 'LIVREUR'
    });

    const manager = await User.create({
      username: 'manager',
      password: 'Password123!',
      role: 'MANAGER'
    });

    const admin = await User.create({
      username: 'admin',
      password: 'Password123!',
      role: 'ADMIN'
    });

    expect(livreur.hasRole('LIVREUR')).toBe(true);
    expect(livreur.isManagerOrAdmin()).toBe(false);
    expect(livreur.isAdmin()).toBe(false);

    expect(manager.hasRole('MANAGER')).toBe(true);
    expect(manager.isManagerOrAdmin()).toBe(true);
    expect(manager.isAdmin()).toBe(false);

    expect(admin.hasRole('ADMIN')).toBe(true);
    expect(admin.isManagerOrAdmin()).toBe(true);
    expect(admin.isAdmin()).toBe(true);

    // Nettoyer
    await User.delete(livreur.id);
    await User.delete(manager.id);
    await User.delete(admin.id);
  });
}); 