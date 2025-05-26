const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Order = require('../models/Order');

describe('Orders API', () => {
  let testUser;
  let testManager;
  let authCookie;
  let managerCookie;
  let testOrder;

  beforeAll(async () => {
    // Créer des utilisateurs de test
    testUser = await User.create({
      username: 'orderuser',
      password: 'TestPassword123!',
      role: 'LIVREUR'
    });

    testManager = await User.create({
      username: 'ordermanager',
      password: 'TestPassword123!',
      role: 'MANAGER'
    });

    // Se connecter pour obtenir les cookies
    const userLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: 'orderuser',
        password: 'TestPassword123!'
      });
    authCookie = userLogin.headers['set-cookie'][0];

    const managerLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: 'ordermanager',
        password: 'TestPassword123!'
      });
    managerCookie = managerLogin.headers['set-cookie'][0];
  });

  afterAll(async () => {
    // Nettoyer après les tests
    if (testOrder) {
      await Order.delete(testOrder.id);
    }
    if (testUser) {
      await User.delete(testUser.id);
    }
    if (testManager) {
      await User.delete(testManager.id);
    }
  });

  describe('POST /api/v1/orders', () => {
    test('should create order with valid data', async () => {
      const orderData = {
        client_name: 'Test Client',
        phone_number: '0123456789',
        address: '123 Test Street',
        description: 'Test order description',
        amount: 25.50,
        order_type: 'MATA'
      };

      const response = await request(app)
        .post('/api/v1/orders')
        .set('Cookie', authCookie)
        .send(orderData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Commande créée avec succès');
      expect(response.body.order).toHaveProperty('id');
      expect(response.body.order.client_name).toBe('Test Client');
      expect(response.body.order.order_type).toBe('MATA');
      
      testOrder = response.body.order;
    });

    test('should reject order with invalid phone number', async () => {
      const orderData = {
        client_name: 'Test Client',
        phone_number: 'invalid-phone',
        order_type: 'MATA'
      };

      const response = await request(app)
        .post('/api/v1/orders')
        .set('Cookie', authCookie)
        .send(orderData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Données invalides');
    });

    test('should reject order without required fields', async () => {
      const orderData = {
        client_name: 'Test Client'
        // Missing phone_number and order_type
      };

      const response = await request(app)
        .post('/api/v1/orders')
        .set('Cookie', authCookie)
        .send(orderData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Données invalides');
    });

    test('should reject unauthenticated requests', async () => {
      const orderData = {
        client_name: 'Test Client',
        phone_number: '0123456789',
        order_type: 'MATA'
      };

      const response = await request(app)
        .post('/api/v1/orders')
        .send(orderData);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/orders', () => {
    test('should get orders for authenticated user', async () => {
      const response = await request(app)
        .get('/api/v1/orders')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('orders');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.orders)).toBe(true);
    });

    test('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/orders?page=1&limit=5')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
    });
  });

  describe('GET /api/v1/orders/by-date', () => {
    test('should get orders by date', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const response = await request(app)
        .get(`/api/v1/orders/by-date?date=${today}`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('orders');
      expect(response.body).toHaveProperty('date', today);
    });
  });

  describe('GET /api/v1/orders/last', () => {
    test('should get last user orders', async () => {
      const response = await request(app)
        .get('/api/v1/orders/last?limit=3')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('orders');
      expect(Array.isArray(response.body.orders)).toBe(true);
    });
  });

  describe('GET /api/v1/orders/summary', () => {
    test('should get summary for managers', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const response = await request(app)
        .get(`/api/v1/orders/summary?date=${today}`)
        .set('Cookie', managerCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('date', today);
      expect(Array.isArray(response.body.summary)).toBe(true);
    });

    test('should reject non-manager requests', async () => {
      const response = await request(app)
        .get('/api/v1/orders/summary')
        .set('Cookie', authCookie);

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/v1/orders/:id', () => {
    test('should update own order', async () => {
      if (!testOrder) {
        // Créer une commande de test si elle n'existe pas
        testOrder = await Order.create({
          client_name: 'Test Client',
          phone_number: '0123456789',
          order_type: 'MATA',
          created_by: testUser.id
        });
      }

      const updateData = {
        client_name: 'Updated Client Name',
        amount: 30.00
      };

      const response = await request(app)
        .put(`/api/v1/orders/${testOrder.id}`)
        .set('Cookie', authCookie)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Commande mise à jour avec succès');
      expect(response.body.order.client_name).toBe('Updated Client Name');
    });

    test('should reject invalid order ID', async () => {
      const response = await request(app)
        .put('/api/v1/orders/invalid-id')
        .set('Cookie', authCookie)
        .send({ client_name: 'Test' });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/v1/orders/:id', () => {
    test('should delete own order created today', async () => {
      // Créer une nouvelle commande pour la supprimer
      const newOrder = await Order.create({
        client_name: 'To Delete',
        phone_number: '0123456789',
        order_type: 'MATA',
        created_by: testUser.id
      });

      const response = await request(app)
        .delete(`/api/v1/orders/${newOrder.id}`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Commande supprimée avec succès');
    });
  });

  describe('GET /api/v1/orders/export', () => {
    test('should export orders for managers', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const response = await request(app)
        .get(`/api/v1/orders/export?startDate=${today}&endDate=${today}`)
        .set('Cookie', managerCookie);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('spreadsheetml');
    });

    test('should reject non-manager export requests', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const response = await request(app)
        .get(`/api/v1/orders/export?startDate=${today}&endDate=${today}`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(403);
    });

    test('should validate date range', async () => {
      const response = await request(app)
        .get('/api/v1/orders/export?startDate=invalid&endDate=invalid')
        .set('Cookie', managerCookie);

      expect(response.status).toBe(400);
    });
  });
});

describe('Order Model', () => {
  let testUser;
  let testOrder;

  beforeAll(async () => {
    testUser = await User.create({
      username: 'ordermodeltest',
      password: 'TestPassword123!',
      role: 'LIVREUR'
    });
  });

  afterAll(async () => {
    if (testOrder) {
      await Order.delete(testOrder.id);
    }
    if (testUser) {
      await User.delete(testUser.id);
    }
  });

  test('should create order with valid data', async () => {
    testOrder = await Order.create({
      client_name: 'Model Test Client',
      phone_number: '0123456789',
      address: '123 Model Test Street',
      description: 'Model test description',
      amount: 15.75,
      order_type: 'MLC',
      created_by: testUser.id
    });

    expect(testOrder).toHaveProperty('id');
    expect(testOrder.client_name).toBe('Model Test Client');
    expect(testOrder.phone_number).toBe('0123456789');
    expect(testOrder.order_type).toBe('MLC');
    expect(testOrder.created_by).toBe(testUser.id);
  });

  test('should find order by ID', async () => {
    const foundOrder = await Order.findById(testOrder.id);
    
    expect(foundOrder).toBeDefined();
    expect(foundOrder.id).toBe(testOrder.id);
    expect(foundOrder.client_name).toBe('Model Test Client');
  });

  test('should find orders by user', async () => {
    const userOrders = await Order.findByUser(testUser.id, 10, 0);
    
    expect(Array.isArray(userOrders)).toBe(true);
    expect(userOrders.length).toBeGreaterThan(0);
    expect(userOrders[0].created_by).toBe(testUser.id);
  });

  test('should find orders by date', async () => {
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = await Order.findByDate(today);
    
    expect(Array.isArray(todayOrders)).toBe(true);
  });

  test('should update order', async () => {
    const updatedOrder = await Order.update(testOrder.id, {
      client_name: 'Updated Model Client',
      amount: 20.00
    });

    expect(updatedOrder.client_name).toBe('Updated Model Client');
    expect(parseFloat(updatedOrder.amount)).toBe(20.00);
  });

  test('should check if order belongs to user', async () => {
    const belongsToUser = await Order.belongsToUser(testOrder.id, testUser.id);
    const doesNotBelong = await Order.belongsToUser(testOrder.id, 'other-user-id');

    expect(belongsToUser).toBe(true);
    expect(doesNotBelong).toBe(false);
  });

  test('should check if order was created today', async () => {
    const isToday = await Order.isCreatedToday(testOrder.id);
    expect(isToday).toBe(true);
  });

  test('should get formatted amount', async () => {
    const formatted = testOrder.getFormattedAmount();
    expect(typeof formatted).toBe('string');
    expect(formatted).toContain('€');
  });

  test('should get formatted date', async () => {
    const formatted = testOrder.getFormattedDate();
    expect(typeof formatted).toBe('string');
    expect(formatted).toMatch(/\d{2}\/\d{2}\/\d{4}/); // Format français
  });
}); 