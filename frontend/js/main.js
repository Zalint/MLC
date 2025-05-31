// ===== CONFIGURATION ET CONSTANTES =====
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:4000/api/v1'
  : 'https://matix-livreur-backend.onrender.com/api/v1';

// État global de l'application
const AppState = {
  user: null,
  currentPage: 'login',
  orders: [],
  users: [],
  livreurs: [],
  currentOrdersPage: 1,
  totalOrdersPages: 1,
  isLoading: false
};

// ===== UTILITAIRES =====
class Utils {
  // Formater une date
  static formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Formater un montant
  static formatAmount(amount) {
    if (!amount) return '0 FCFA';
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + ' FCFA';
  }

  // Valider un numéro de téléphone français
  static validatePhoneNumber(phone) {
    // Accepter tous les formats numériques (avec ou sans espaces, tirets, parenthèses)
    // Exemples: 773929671, 002211234678855411, +33123456789, 0033 1 23 45 67 89
    const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');
    const phoneRegex = /^\d{6,20}$/; // Entre 6 et 20 chiffres
    return phoneRegex.test(cleanPhone);
  }

  // Debounce function
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Escape HTML
  static escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  static formatDisplayDate(dateString) { // YYYY-MM-DD to DD/MM/YYYY
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  }
}

// ===== GESTION DES TOASTS =====
class ToastManager {
  static show(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div>${Utils.escapeHtml(message)}</div>
    `;

    container.appendChild(toast);

    // Auto-remove after duration
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, duration);

    // Remove on click
    toast.addEventListener('click', () => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    });
  }

  static success(message) {
    this.show(message, 'success');
  }

  static error(message) {
    this.show(message, 'error');
  }

  static warning(message) {
    this.show(message, 'warning');
  }

  static info(message) {
    this.show(message, 'info');
  }
}

// ===== GESTION DES MODALES =====
class ModalManager {
  static show(title, content, options = {}) {
    const overlay = document.getElementById('modal-overlay');
    const modal = overlay.querySelector('.modal');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');

    modalTitle.textContent = title;
    modalContent.innerHTML = content;
    
    // Ajouter la classe large si spécifiée
    if (options.large) {
      modal.classList.add('large');
    } else {
      modal.classList.remove('large');
    }
    
    overlay.classList.remove('hidden');

    // Focus management
    const firstFocusable = overlay.querySelector('input, button, select, textarea');
    if (firstFocusable) {
      firstFocusable.focus();
    }
  }

  static hide() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.add('hidden');
  }

  static confirm(title, message, onConfirm) {
    const content = `
      <p>${Utils.escapeHtml(message)}</p>
      <div class="form-actions">
        <button type="button" class="btn btn-danger" id="confirm-yes">Confirmer</button>
        <button type="button" class="btn btn-secondary" id="confirm-no">Annuler</button>
      </div>
    `;

    this.show(title, content);

    document.getElementById('confirm-yes').addEventListener('click', () => {
      this.hide();
      onConfirm();
    });

    document.getElementById('confirm-no').addEventListener('click', () => {
      this.hide();
    });
  }
}

// ===== API CLIENT =====
class ApiClient {
  static getStoredToken() {
    try {
      return localStorage.getItem('auth_token');
    } catch (e) {
      return null;
    }
  }

  static setStoredToken(token) {
    try {
      if (token) {
        localStorage.setItem('auth_token', token);
      } else {
        localStorage.removeItem('auth_token');
      }
    } catch (e) {
      console.warn('Could not store token in localStorage:', e);
    }
  }

  static async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Add Authorization header if we have a stored token (for mobile fallback)
    const storedToken = this.getStoredToken();
    if (storedToken) {
      headers['Authorization'] = `Bearer ${storedToken}`;
    }

    const config = {
      credentials: 'include',
      headers,
      ...options
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erreur HTTP: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Auth endpoints
  static async login(username, password) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    
    // Store token if provided (for mobile fallback)
    if (response.token) {
      this.setStoredToken(response.token);
    }
    
    return response;
  }

  static async logout() {
    const response = await this.request('/auth/logout', { method: 'POST' });
    
    // Clear stored token
    this.setStoredToken(null);
    
    return response;
  }

  static async checkAuth() {
    return this.request('/auth/check');
  }

  static async changePassword(currentPassword, newPassword, confirmPassword) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
    });
  }

  static async getProfile() {
    return this.request('/auth/profile');
  }

  // Orders endpoints
  static async getOrders(page = 1, limit = 20) {
    return this.request(`/orders?page=${page}&limit=${limit}`);
  }

  static async getOrdersByDate(date) {
    return this.request(`/orders/by-date?date=${date}`);
  }

  static async getLastUserOrders(limit = 5) {
    return this.request(`/orders/last?limit=${limit}`);
  }

  static async getTodayOrdersSummary(date) {
    const dateParam = date ? `?date=${date}` : '';
    return this.request(`/orders/summary${dateParam}`);
  }

  static async getMonthlyOrdersSummary(month) {
    const monthParam = month ? `?month=${month}` : '';
    return this.request(`/orders/monthly-summary${monthParam}`);
  }

  static async exportMonthlyToExcel(month) {
    const monthParam = month ? `?month=${month}` : '';
    const url = `${API_BASE_URL}/orders/monthly-export${monthParam}`;
    window.open(url, '_blank');
  }

  static async createOrder(orderData) {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
  }

  static async updateOrder(id, orderData) {
    return this.request(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(orderData)
    });
  }

  static async deleteOrder(id) {
    return this.request(`/orders/${id}`, { method: 'DELETE' });
  }

  static async exportOrders(startDate, endDate) {
    const url = `${API_BASE_URL}/orders/export?startDate=${startDate}&endDate=${endDate}`;
    window.open(url, '_blank');
  }

  static async getLivreurOrderDetails(livreurId, date) {
    return this.request(`/orders/livreur/${livreurId}/details?date=${date}`);
  }

  static async exportLivreurDetails(livreurId, date) {
    const url = `${API_BASE_URL}/orders/livreur/${livreurId}/export?date=${date}`;
    window.open(url, '_blank');
  }

  // MATA Monthly Dashboard endpoints
  static async getMataMonthlyDashboard(month) {
    return this.request(`/orders/mata-monthly-dashboard?month=${month}`);
  }

  static async updateMataOrderComment(orderId, commentaire) {
    return this.request(`/orders/${orderId}/comment`, {
      method: 'PUT',
      body: JSON.stringify({ commentaire })
    });
  }

  static async exportMataMonthlyToExcel(month) {
    const url = `${API_BASE_URL}/orders/mata-monthly-export?month=${month}`;
    window.open(url, '_blank');
  }

  static async updateMataOrderRating(orderId, ratingType, ratingValue) {
    return this.request(`/orders/${orderId}/rating`, {
      method: 'PUT',
      body: JSON.stringify({ 
        ratingType, 
        ratingValue 
      })
    });
  }

  // Users endpoints
  static async getUsers() {
    return this.request('/users');
  }

  static async getLivreurs() {
    return this.request('/users/livreurs');
  }

  static async getActiveLivreurs() {
    return this.request('/users/livreurs/active');
  }

  static async createUser(userData) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  static async updateUser(id, userData) {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    });
  }

  static async toggleUserActive(id) {
    return this.request(`/users/${id}/toggle-active`, {
      method: 'PATCH'
    });
  }

  static async deleteUser(id) {
    return this.request(`/users/${id}`, { method: 'DELETE' });
  }

  // Expenses endpoints
  static async getExpensesSummary(date) {
    return this.request(`/expenses/summary?date=${date}`);
  }

  static async getExpensesByDate(date) {
    return this.request(`/expenses/by-date?date=${date}`);
  }

  static async getExpensesByLivreur(livreurId, page = 1, limit = 20) {
    return this.request(`/expenses/livreur/${livreurId}?page=${page}&limit=${limit}`);
  }

  static async getExpenseByLivreurAndDate(livreurId, date) {
    return this.request(`/expenses/livreur/${livreurId}/date/${date}`);
  }

  static async createOrUpdateExpense(expenseData) {
    return this.request('/expenses', {
      method: 'POST',
      body: JSON.stringify(expenseData)
    });
  }

  static async updateExpense(id, expenseData) {
    return this.request(`/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(expenseData)
    });
  }

  static async deleteExpense(id) {
    return this.request(`/expenses/${id}`, { method: 'DELETE' });
  }

  // Subscriptions endpoints
  static async getSubscriptions(page = 1, limit = 20) {
    return this.request(`/subscriptions?page=${page}&limit=${limit}`);
  }

  static async getSubscriptionStats() {
    return this.request('/subscriptions/stats');
  }

  static async searchSubscriptions(query) {
    return this.request(`/subscriptions/search?q=${encodeURIComponent(query)}`);
  }

  static async getSubscriptionByCardNumber(cardNumber) {
    return this.request(`/subscriptions/card/${cardNumber}`);
  }

  static async getSubscriptionsByPhone(phoneNumber, activeOnly = false) {
    return this.request(`/subscriptions/phone/${phoneNumber}?active=${activeOnly}`);
  }

  static async checkCardValidity(cardNumber) {
    return this.request(`/subscriptions/check/${cardNumber}`);
  }

  static async createSubscription(subscriptionData) {
    return this.request('/subscriptions', {
      method: 'POST',
      body: JSON.stringify(subscriptionData)
    });
  }

  static async updateSubscription(id, subscriptionData) {
    return this.request(`/subscriptions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(subscriptionData)
    });
  }

  static async deactivateSubscription(id) {
    return this.request(`/subscriptions/${id}/deactivate`, {
      method: 'PATCH'
    });
  }

  static async reactivateSubscription(id) {
    return this.request(`/subscriptions/${id}/reactivate`, {
      method: 'PATCH'
    });
  }

  static async createMLCOrderWithSubscription(orderData) {
    return this.request('/subscriptions/mlc-order', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
  }

  static async getExpiringSoonSubscriptions(days = 30) {
    return this.request(`/subscriptions/expiring-soon?days=${days}`);
  }

  static async getActiveSubscriptions() {
    return this.request('/subscriptions/active');
  }

  // Analytics endpoints
  static async getAnalyticsGlobal(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/analytics/global?${queryString}`);
  }

  static async getAnalyticsByType(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/analytics/by-type?${queryString}`);
  }

  static async getAnalyticsRanking(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/analytics/ranking?${queryString}`);
  }

  static async getAnalyticsLivreurDetails(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/analytics/livreur-details?${queryString}`);
  }

  static async getAnalyticsComparison(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/analytics/compare?${queryString}`);
  }

  static async getScoreWeights() {
    return this.request('/analytics/score-weights');
  }

  static async updateScoreWeights(weights) {
    return this.request('/analytics/score-weights', {
      method: 'PUT',
      body: JSON.stringify(weights)
    });
  }

  // Salaries endpoints
  static async getSalaries(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/salaries?${queryString}`);
  }

  static async getCurrentSalaries() {
    return this.request('/salaries/current');
  }

  static async createSalary(salaryData) {
    return this.request('/salaries', {
      method: 'POST',
      body: JSON.stringify(salaryData)
    });
  }

  static async updateSalary(id, salaryData) {
    return this.request(`/salaries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(salaryData)
    });
  }

  static async deleteSalary(id) {
    return this.request(`/salaries/${id}`, { method: 'DELETE' });
  }

  // Analytics API methods
  static async getAnalyticsGlobal(params = {}) {
    return await this.request('/api/analytics/global', { params });
  }

  static async getAnalyticsByType(params = {}) {
    return await this.request('/api/analytics/by-type', { params });
  }

  static async getAnalyticsRanking(params = {}) {
    return await this.request('/api/analytics/ranking', { params });
  }

  static async getAnalyticsLivreurDetails(params = {}) {
    return await this.request('/api/analytics/livreur-details', { params });
  }

  static async getScoreWeights() {
    return await this.request('/api/analytics/score-weights');
  }

  static async updateScoreWeights(weights) {
    return await this.request('/api/analytics/score-weights', {
      method: 'PUT',
      body: weights
    });
  }
}

// ===== GESTIONNAIRE DE PAGES =====
class PageManager {
  static showPage(pageId) {
    // Cacher toutes les pages
    document.querySelectorAll('.page').forEach(page => {
      page.classList.remove('active');
    });

    // Afficher la page demandée
    const targetPage = document.getElementById(`${pageId}-page`);
    if (targetPage) {
      targetPage.classList.add('active');
      AppState.currentPage = pageId;
    }

    // Mettre à jour la navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });

    const activeNavItem = document.querySelector(`[data-page="${pageId}"]`);
    if (activeNavItem) {
      activeNavItem.classList.add('active');
    }

    // Charger les données de la page
    this.loadPageData(pageId);
  }

  static async loadPageData(pageId) {
    try {
      switch (pageId) {
        case 'dashboard':
          await DashboardManager.loadDashboard();
          break;
        case 'monthly-dashboard':
          await MonthlyDashboardManager.loadMonthlyDashboard();
          break;
        case 'mata-monthly-dashboard':
          await MataMonthlyDashboardManager.loadMataMonthlyDashboard();
          break;
        case 'new-order':
          await OrderManager.loadLastUserOrders();
          // Affichage du champ livreur pour managers/admins
          const livreurGroup = document.getElementById('livreur-select-group');
          if (AppState.user && (AppState.user.role === 'MANAGER' || AppState.user.role === 'ADMIN')) {
            livreurGroup.style.display = 'block';
            // Charger la liste des livreurs actifs
            const select = document.getElementById('livreur-select');
            select.innerHTML = '<option value="">Sélectionner un livreur</option>';
            try {
              const response = await ApiClient.getActiveLivreurs();
              (response.livreurs || []).forEach(livreur => {
                select.innerHTML += `<option value="${livreur.id}">${Utils.escapeHtml(livreur.username)}</option>`;
              });
            } catch (error) {
              ToastManager.error('Erreur lors du chargement des livreurs');
            }
          } else {
            livreurGroup.style.display = 'none';
          }
          break;
        case 'orders':
          await OrderManager.loadOrders();
          break;
        case 'expenses':
          await ExpenseManager.loadExpenses();
          break;
        case 'users':
          if (AppState.user && (AppState.user.role === 'MANAGER' || AppState.user.role === 'ADMIN')) {
            await UserManager.loadUsers();
          }
          break;
        case 'subscriptions':
          if (AppState.user && (AppState.user.role === 'MANAGER' || AppState.user.role === 'ADMIN')) {
            await SubscriptionManager.loadSubscriptions();
          }
          break;
        case 'analytics':
          if (AppState.user && (AppState.user.role === 'MANAGER' || AppState.user.role === 'ADMIN')) {
            await AnalyticsManager.loadAnalytics();
          }
          break;
        case 'livreurs':
          if (AppState.user && (AppState.user.role === 'MANAGER' || AppState.user.role === 'ADMIN')) {
            await LivreurManager.loadLivreurs();
          }
          break;
        case 'profile':
          await ProfileManager.loadProfile();
          break;
      }
    } catch (error) {
      console.error(`Erreur lors du chargement de la page ${pageId}:`, error);
      ToastManager.error('Erreur lors du chargement des données');
    }
  }
}

// ===== GESTIONNAIRE D'AUTHENTIFICATION =====
class AuthManager {
  static async init() {
    try {
      const response = await ApiClient.checkAuth();
      if (response.authenticated) {
        AppState.user = response.user;
        this.showAuthenticatedUI();
        PageManager.showPage('dashboard');
      } else {
        this.showLoginUI();
      }
    } catch (error) {
      console.error('Erreur lors de la vérification d\'authentification:', error);
      this.showLoginUI();
    }
  }

  static async login(username, password) {
    try {
      // Clear any existing tokens first to prevent conflicts
      console.log('🧹 Clearing any existing tokens before login...');
      ApiClient.setStoredToken(null);
      
      const response = await ApiClient.login(username, password);
      AppState.user = response.user;
      this.showAuthenticatedUI();
      PageManager.showPage('dashboard');
      ToastManager.success('Connexion réussie');
    } catch (error) {
      throw error;
    }
  }

  static async logout() {
    try {
      await ApiClient.logout();
      AppState.user = null;
      this.showLoginUI();
      ToastManager.info('Déconnexion réussie');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      // Forcer la déconnexion côté client même en cas d'erreur
      ApiClient.setStoredToken(null);
      AppState.user = null;
      this.showLoginUI();
    }
  }

  static showLoginUI() {
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('header').classList.add('hidden');
    document.getElementById('navigation').classList.add('hidden');
    document.getElementById('main-content').classList.add('hidden');
    
    PageManager.showPage('login');
    document.getElementById('main-content').classList.remove('hidden');
  }

  static showAuthenticatedUI() {
    console.log('🎯 Showing authenticated UI...');
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('header').classList.remove('hidden');
    document.getElementById('navigation').classList.remove('hidden');
    document.getElementById('main-content').classList.remove('hidden');

    // Force navigation visibility
    const navigation = document.getElementById('navigation');
    navigation.style.display = 'block';
    navigation.style.position = 'fixed';
    navigation.style.top = '80px';
    navigation.style.left = '0';
    navigation.style.right = '0';
    navigation.style.zIndex = '999';
    console.log('🎯 Navigation element:', navigation);
    console.log('🎯 Navigation classes:', navigation.className);

    // Mettre à jour les informations utilisateur
    document.getElementById('username').textContent = AppState.user.username;
    const roleElement = document.getElementById('user-role');
    roleElement.textContent = AppState.user.role;
    roleElement.className = `role-badge ${AppState.user.role}`;

    // Afficher/masquer les éléments selon le rôle
    const navUsers = document.getElementById('nav-users');
    const navSubscriptions = document.getElementById('nav-subscriptions');
    const navAnalytics = document.getElementById('nav-analytics');
    const navLivreurs = document.getElementById('nav-livreurs');
    const navExpenses = document.getElementById('nav-expenses');
    const navMonthlyDashboard = document.getElementById('nav-monthly-dashboard');
    const navMataMonthlyDashboard = document.getElementById('nav-mata-monthly-dashboard');
    const exportExcel = document.getElementById('export-excel');
    const statLivreurs = document.getElementById('stat-livreurs');
    const managerSummary = document.getElementById('manager-summary-section');

    if (AppState.user.role === 'MANAGER' || AppState.user.role === 'ADMIN') {
      if (navUsers) {
        navUsers.classList.remove('hidden');
        navUsers.style.display = 'flex';
      }
      if (navSubscriptions) {
        navSubscriptions.classList.remove('hidden');
        navSubscriptions.style.display = 'flex';
      }
      if (navAnalytics) {
        navAnalytics.classList.remove('hidden');
        navAnalytics.style.display = 'flex';
      }
      if (navLivreurs) {
        navLivreurs.classList.remove('hidden');
        navLivreurs.style.display = 'flex';
        navLivreurs.style.visibility = 'visible';
        navLivreurs.style.opacity = '1';
        // Force l'affichage du bouton Gestion livreurs pour les managers
        console.log('🎯 Forçage affichage bouton Gestion livreurs pour manager/admin');
        console.log('🎯 État du bouton navLivreurs:', {
          element: navLivreurs,
          classList: navLivreurs.className,
          style: navLivreurs.style.cssText,
          isVisible: navLivreurs.offsetWidth > 0 && navLivreurs.offsetHeight > 0
        });
      }
      if (navExpenses) {
        navExpenses.classList.remove('hidden');
        navExpenses.style.display = 'flex';
      }
      if (navMonthlyDashboard) {
        navMonthlyDashboard.classList.remove('hidden');
        navMonthlyDashboard.style.display = 'flex';
      }
      if (navMataMonthlyDashboard) {
        navMataMonthlyDashboard.classList.remove('hidden');
        navMataMonthlyDashboard.style.display = 'flex';
      }
      if (exportExcel) exportExcel.classList.remove('hidden');
      if (statLivreurs) statLivreurs.classList.remove('hidden');
      if (managerSummary) managerSummary.classList.remove('hidden');
      
      // Vérification supplémentaire pour forcer l'affichage des éléments manager
      setTimeout(() => {
        this.ensureManagerElementsVisible();
      }, 100);
    } else {
      if (navUsers) {
        navUsers.classList.add('hidden');
        navUsers.style.display = 'none';
      }
      if (navSubscriptions) {
        navSubscriptions.classList.add('hidden');
        navSubscriptions.style.display = 'none';
      }
      if (navAnalytics) {
        navAnalytics.classList.add('hidden');
        navAnalytics.style.display = 'none';
      }
      if (navLivreurs) {
        navLivreurs.classList.add('hidden');
        navLivreurs.style.display = 'none';
      }
      if (navExpenses) {
        navExpenses.classList.add('hidden');
        navExpenses.style.display = 'none';
      }
      if (navMonthlyDashboard) {
        navMonthlyDashboard.classList.add('hidden');
        navMonthlyDashboard.style.display = 'none';
      }
      if (navMataMonthlyDashboard) {
        navMataMonthlyDashboard.classList.add('hidden');
        navMataMonthlyDashboard.style.display = 'none';
      }
      if (exportExcel) exportExcel.classList.add('hidden');
      if (statLivreurs) statLivreurs.classList.add('hidden');
      if (managerSummary) managerSummary.classList.add('hidden');
    }
  }

  static ensureManagerElementsVisible() {
    if (AppState.user && (AppState.user.role === 'MANAGER' || AppState.user.role === 'ADMIN')) {
      console.log('🎯 Vérification supplémentaire des éléments manager...');
      
      const navLivreurs = document.getElementById('nav-livreurs');
      if (navLivreurs) {
        // Force l'affichage avec toutes les méthodes possibles
        navLivreurs.classList.remove('hidden');
        navLivreurs.style.display = 'flex';
        navLivreurs.style.visibility = 'visible';
        navLivreurs.style.opacity = '1';
        navLivreurs.removeAttribute('hidden');
        
        console.log('🎯 État final du bouton Gestion livreurs:', {
          classList: navLivreurs.className,
          style: navLivreurs.style.cssText,
          isVisible: navLivreurs.offsetWidth > 0 && navLivreurs.offsetHeight > 0,
          computedStyle: window.getComputedStyle(navLivreurs).display
        });
      }
      
      // Vérifier aussi les autres éléments
      const elementsToCheck = [
        'nav-users',
        'nav-subscriptions',
        'nav-analytics',
        'nav-expenses', 
        'nav-monthly-dashboard',
        'nav-mata-monthly-dashboard'
      ];
      
      elementsToCheck.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
          element.classList.remove('hidden');
          element.style.display = 'flex';
          element.style.visibility = 'visible';
          element.style.opacity = '1';
          element.removeAttribute('hidden');
        }
      });

      // Forcer l'affichage des boutons d'action de la page livreurs
      const livreurActionButtons = [
        'add-livreur-btn',
        'show-all-livreurs', 
        'show-active-livreurs'
      ];
      
      livreurActionButtons.forEach(id => {
        const button = document.getElementById(id);
        if (button) {
          button.classList.remove('hidden');
          button.style.display = 'inline-flex';
          button.style.visibility = 'visible';
          button.style.opacity = '1';
          button.removeAttribute('hidden');
          console.log(`🎯 Bouton ${id} forcé à s'afficher`);
        }
      });
    }
  }
}

// ===== GESTIONNAIRE DU TABLEAU DE BORD =====
class DashboardManager {
  static async loadDashboard() {
    try {
      // Get date from the new date filter, default to today (client-side)
      let selectedDate = document.getElementById('dashboard-date-filter')?.value;
      const today = new Date().toISOString().split('T')[0];

      if (!selectedDate) {
        selectedDate = today;
        // Optionally set the date input to this default
        const dateFilterInput = document.getElementById('dashboard-date-filter');
        if (dateFilterInput) {
          dateFilterInput.value = selectedDate;
        }
      }

      // Charger les commandes pour la date sélectionnée (pour les cartes du haut)
      const ordersResponse = await ApiClient.getOrdersByDate(selectedDate);
      const orders = ordersResponse.orders || [];

      // Calculer les statistiques
      const totalOrders = orders.length;
      const totalAmount = orders.reduce((sum, order) => sum + (parseFloat(order.course_price) || 0), 0);

      // Mettre à jour les statistiques
      const totalOrdersElement = document.getElementById('total-orders-today');
      const totalAmountElement = document.getElementById('total-amount-today');
      const ordersTodayLabelElement = document.getElementById('orders-today-label'); // Assuming an ID for the label "Commandes aujourd'hui"
      
      if (totalOrdersElement) totalOrdersElement.textContent = totalOrders;
      if (totalAmountElement) totalAmountElement.textContent = Utils.formatAmount(totalAmount);
      if (ordersTodayLabelElement) {
        ordersTodayLabelElement.textContent = selectedDate === today ? "Commandes aujourd'hui" : `Commandes (${Utils.formatDisplayDate(selectedDate)})`;
      }


      // Remove the subtitle display - cleaner interface


      // Charger les dernières commandes (ceci reste indépendant de la date sélectionnée pour le moment)
      // Si vous souhaitez que "Dernières commandes" dépende aussi de la date, il faudrait une nouvelle API ou modifier l'existante
      const recentOrdersResponse = await ApiClient.getLastUserOrders(5); // This usually means latest overall, not for a specific day
      this.displayRecentOrders(recentOrdersResponse.orders || []);

      // Pour les managers/admins, charger le récapitulatif pour la date sélectionnée
      const managerSummarySection = document.getElementById('manager-summary-section');
      const statDepensesCard = document.getElementById('stat-depenses');
      const statLivreursCard = document.getElementById('stat-livreurs');
      
      if (AppState.user && (AppState.user.role === 'MANAGER' || AppState.user.role === 'ADMIN')) {
        if (managerSummarySection) managerSummarySection.classList.remove('hidden');
        if (statDepensesCard) statDepensesCard.classList.remove('hidden');
        if (statLivreursCard) statLivreursCard.classList.remove('hidden');
        
        const summaryResponse = await ApiClient.getTodayOrdersSummary(selectedDate); // Pass selectedDate
        this.displayManagerSummary(summaryResponse.summary || []);
        
        const activeLivreurs = summaryResponse.summary?.filter(item => item.nombre_commandes > 0).length || 0;
        const activeLivreursElement = document.getElementById('active-livreurs');
        if (activeLivreursElement) activeLivreursElement.textContent = activeLivreurs;

        // Afficher les dépenses totales
        const totalExpensesElement = document.getElementById('total-expenses-today');
        if (totalExpensesElement) {
          totalExpensesElement.textContent = Utils.formatAmount(summaryResponse.total_depenses || 0);
        }

      } else {
        if (managerSummarySection) managerSummarySection.classList.add('hidden');
        if (statDepensesCard) statDepensesCard.classList.add('hidden');
        if (statLivreursCard) statLivreursCard.classList.add('hidden');
      }

    } catch (error) {
      console.error('Erreur lors du chargement du tableau de bord:', error);
      ToastManager.error('Erreur lors du chargement du tableau de bord');
    }
  }

  static displayRecentOrders(orders) {
    const container = document.getElementById('recent-orders-list');
    
    if (orders.length === 0) {
      container.innerHTML = '<p class="text-center">Aucune commande récente</p>';
      return;
    }

    container.innerHTML = orders.map(order => `
      <div class="order-card">
        <div class="order-header">
          <div class="order-title">${Utils.escapeHtml(order.client_name)}</div>
          <div class="order-meta">${Utils.formatDate(order.created_at)}
            ${(order.order_type === 'MLC' && order.is_subscription) ? '<span class="badge badge-subscription">🎫 Abonnement</span>' : ''}
          </div>
        </div>
        <div class="order-details">
          <p><strong>Téléphone:</strong> ${Utils.escapeHtml(order.phone_number)}</p>
          ${order.address ? `<p><strong>Adresse:</strong> ${Utils.escapeHtml(order.address)}</p>` : ''}
          <p><strong>Prix de la course:</strong> <span class="order-amount">${Utils.formatAmount(order.course_price)}</span></p>
          ${order.order_type === 'MATA' && order.amount ? `<p><strong>Montant du panier:</strong> <span class="order-amount">${Utils.formatAmount(order.amount)}</span></p>` : ''}
          <p><strong>Type:</strong> <span class="order-type ${order.order_type}">${order.order_type}</span></p>
        </div>
      </div>
    `).join('');
  }

  static displayManagerSummary(summary) {
    const container = document.getElementById('summary-table-container');
    
    if (summary.length === 0) {
      container.innerHTML = '<p class="text-center">Aucune donnée disponible</p>';
      return;
    }

    container.innerHTML = `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Livreur</th>
              <th>Commandes</th>
              <th>Courses</th>
              <th>Dépenses</th>
              <th>Km parcourus</th>
              <th>Détails</th>
            </tr>
          </thead>
          <tbody>
            ${summary.map(item => `
              <tr>
                <td>${Utils.escapeHtml(item.livreur)}</td>
                <td>${item.nombre_commandes}</td>
                <td>${Utils.formatAmount(item.total_montant)}</td>
                <td>${Utils.formatAmount(item.total_depenses)}</td>
                <td><strong>${item.km_parcourus || 0} km</strong></td>
                <td>
                  ${parseInt(item.nombre_commandes) > 0 ? `
                    <button class="btn btn-sm btn-primary livreur-details-btn" 
                            data-livreur-id="${item.livreur_id}" 
                            data-livreur-name="${Utils.escapeHtml(item.livreur)}"
                            title="Voir les détails des courses">
                      <span class="icon">📋</span>
                      Détails
                    </button>
                  ` : 'Aucune commande'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Ajouter les event listeners pour les boutons de détails
    this.setupDetailsEventListeners();
  }

  static setupDetailsEventListeners() {
    document.querySelectorAll('.livreur-details-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const livreurId = e.currentTarget.dataset.livreurId;
        const livreurName = e.currentTarget.dataset.livreurName;
        const selectedDate = document.getElementById('dashboard-date-filter')?.value || new Date().toISOString().split('T')[0];
        
        await this.showLivreurDetails(livreurId, livreurName, selectedDate);
      });
    });
  }

  static async showLivreurDetails(livreurId, livreurName, date) {
    try {
      const response = await ApiClient.getLivreurOrderDetails(livreurId, date);
      const { orders, summary } = response;

      const content = `
        <div class="livreur-details">
          <div class="details-header">
            <h4>Détails des courses - ${Utils.escapeHtml(livreurName)}</h4>
            <p><strong>Date:</strong> ${Utils.formatDisplayDate(date)}</p>
            <div class="details-summary">
              <div class="summary-item">
                <span class="label">Nombre de courses:</span>
                <span class="value">${summary.total_orders}</span>
              </div>
              <div class="summary-item">
                <span class="label">Total courses:</span>
                <span class="value">${Utils.formatAmount(summary.total_courses)}</span>
              </div>
              ${summary.total_panier > 0 ? `
                <div class="summary-item">
                  <span class="label">Total panier:</span>
                  <span class="value">${Utils.formatAmount(summary.total_panier)}</span>
                </div>
              ` : ''}
              <div class="summary-item total">
                <span class="label">Total général:</span>
                <span class="value">${Utils.formatAmount(summary.total_general)}</span>
              </div>
            </div>
          </div>
          
          <div class="details-actions">
            <button id="export-livreur-details" class="btn btn-primary btn-sm" 
                    data-livreur-id="${livreurId}" data-date="${date}">
              <span class="icon">📊</span>
              Exporter Excel
            </button>
          </div>

          <div class="details-table">
            ${orders.length > 0 ? `
              <table class="table">
                <thead>
                  <tr>
                    <th>Heure</th>
                    <th>Client</th>
                    <th>Téléphone</th>
                    <th>Type</th>
                    <th>Prix course</th>
                    ${orders.some(o => o.amount) ? '<th>Montant panier</th>' : ''}
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  ${orders.map(order => `
                    <tr>
                      <td>${new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td>${Utils.escapeHtml(order.client_name)}</td>
                      <td>${Utils.escapeHtml(order.phone_number)}</td>
                      <td><span class="order-type ${order.order_type}">${order.order_type}</span></td>
                      <td>${Utils.formatAmount(order.course_price)}</td>
                      ${orders.some(o => o.amount) ? `<td>${order.amount ? Utils.formatAmount(order.amount) : '-'}</td>` : ''}
                      <td>${order.description ? Utils.escapeHtml(order.description) : '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<p class="text-center">Aucune commande trouvée pour cette date</p>'}
          </div>
        </div>
      `;

      ModalManager.show(`Détails des courses - ${livreurName}`, content, { large: true });

      // Ajouter l'event listener pour l'export Excel
      document.getElementById('export-livreur-details')?.addEventListener('click', (e) => {
        const livreurId = e.currentTarget.dataset.livreurId;
        const date = e.currentTarget.dataset.date;
        ApiClient.exportLivreurDetails(livreurId, date);
        ToastManager.success('Export Excel en cours...');
      });

    } catch (error) {
      console.error('Erreur lors du chargement des détails:', error);
      ToastManager.error('Erreur lors du chargement des détails du livreur');
    }
  }
}

// ===== GESTIONNAIRE DE TABLEAU DE BORD MENSUEL =====
class MonthlyDashboardManager {
  static async loadMonthlyDashboard() {
    try {
      AppState.isLoading = true;
      
      // Obtenir le mois sélectionné ou le mois actuel
      const monthInput = document.getElementById('monthly-dashboard-date-filter');
      const selectedMonth = monthInput.value || new Date().toISOString().slice(0, 7);
      
      // Mettre à jour le champ de date si nécessaire
      if (!monthInput.value) {
        monthInput.value = selectedMonth;
      }

      // Charger les données mensuelles
      const response = await ApiClient.getMonthlyOrdersSummary(selectedMonth);
      
      // Mettre à jour les statistiques
      this.updateMonthlyStats(response);
      
      // Afficher le tableau détaillé par jour
      this.displayMonthlyDetailedTable(response.dailyData, response.dailyExpenses, selectedMonth);
      
    } catch (error) {
      console.error('Erreur lors du chargement du tableau de bord mensuel:', error);
      ToastManager.error('Erreur lors du chargement des données mensuelles');
    } finally {
      AppState.isLoading = false;
    }
  }

  static updateMonthlyStats(data) {
    // Mettre à jour les cartes de statistiques
    document.getElementById('monthly-total-orders').textContent = data.total_commandes || 0;
    document.getElementById('monthly-total-amount').textContent = Utils.formatAmount(data.total_montant || 0);
    document.getElementById('monthly-total-expenses').textContent = Utils.formatAmount(data.total_depenses || 0);
    document.getElementById('monthly-active-livreurs').textContent = data.total_livreurs || 0;

    // Mettre à jour le label avec le mois
    const monthInput = document.getElementById('monthly-dashboard-date-filter');
    const selectedMonth = monthInput.value;
    if (selectedMonth) {
      const [year, month] = selectedMonth.split('-');
      const monthNames = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
      ];
      const monthName = monthNames[parseInt(month) - 1];
      document.getElementById('monthly-orders-label').textContent = `Commandes - ${monthName} ${year}`;
    }
  }

    static displayMonthlyDetailedTable(dailyData, dailyExpenses, month) {
    const container = document.getElementById('monthly-summary-table-container');
    
    if (!dailyData || dailyData.length === 0) {
      container.innerHTML = '<p class="no-data">Aucune donnée disponible pour ce mois.</p>';
      return;
    }

    // Obtenir la liste des livreurs et des dates
    const livreurs = [...new Set(dailyData.map(item => item.livreur))].sort();
    const dates = [...new Set(dailyData.map(item => item.date))].sort();

    // Créer des maps pour un accès rapide aux données
    const ordersMap = {};
    const expensesMap = {};

    dailyData.forEach(item => {
      const key = `${item.date}_${item.livreur}`;
      ordersMap[key] = item;
    });

    dailyExpenses.forEach(item => {
      const key = `${item.date}_${item.livreur}`;
      expensesMap[key] = item;
    });

    // Créer les en-têtes du tableau (structure verticale)
    const headers = `
      <th class="date-column">Date</th>
      <th class="livreur-column">Livreur</th>
      <th class="sub-header">Cmd</th>
      <th class="sub-header">Courses</th>
      <th class="sub-header">Carburant</th>
      <th class="sub-header">Réparations</th>
      <th class="sub-header">Police</th>
      <th class="sub-header">Autres</th>
      <th class="sub-header">Total Dép.</th>
      <th class="sub-header">Km</th>
      <th class="sub-header">Bénéfice</th>
    `;

    // Créer les lignes de données (une ligne par date/livreur)
    let rows = '';
    dates.forEach(date => {
      const formattedDate = new Date(date).toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit' 
      });
      
      livreurs.forEach(livreur => {
        const orderKey = `${date}_${livreur}`;
        const expenseKey = `${date}_${livreur}`;
        
        const orderData = ordersMap[orderKey] || { nombre_commandes: 0, total_montant: 0 };
        const expenseData = expensesMap[expenseKey] || { carburant: 0, reparations: 0, police: 0, autres: 0, km_parcourus: 0 };
        
        const totalDepenses = (expenseData.carburant || 0) + (expenseData.reparations || 0) + (expenseData.police || 0) + (expenseData.autres || 0);
        const benefice = (orderData.total_montant || 0) - totalDepenses;
        
        rows += `
          <tr>
            <td class="date-cell">${formattedDate}</td>
            <td class="livreur-cell">${Utils.escapeHtml(livreur)}</td>
            <td class="data-cell">${orderData.nombre_commandes || 0}</td>
            <td class="data-cell">${orderData.total_montant ? Utils.formatAmount(orderData.total_montant).replace(' FCFA', '') : '0'}</td>
            <td class="data-cell">${expenseData.carburant ? Utils.formatAmount(expenseData.carburant).replace(' FCFA', '') : '0'}</td>
            <td class="data-cell">${expenseData.reparations ? Utils.formatAmount(expenseData.reparations).replace(' FCFA', '') : '0'}</td>
            <td class="data-cell">${expenseData.police ? Utils.formatAmount(expenseData.police).replace(' FCFA', '') : '0'}</td>
            <td class="data-cell">${expenseData.autres ? Utils.formatAmount(expenseData.autres).replace(' FCFA', '') : '0'}</td>
            <td class="data-cell total-depenses">${totalDepenses ? Utils.formatAmount(totalDepenses).replace(' FCFA', '') : '0'}</td>
            <td class="data-cell">${expenseData.km_parcourus || 0}</td>
            <td class="data-cell benefice ${benefice >= 0 ? 'benefice-positif' : 'benefice-negatif'}">${Utils.formatAmount(benefice).replace(' FCFA', '')}</td>
          </tr>
        `;
      });
    });

    // Créer les lignes de totaux par livreur
    let totalRows = '';
    livreurs.forEach(livreur => {
      const livreurOrders = dailyData.filter(item => item.livreur === livreur);
      const livreurExpenses = dailyExpenses.filter(item => item.livreur === livreur);
      
      const totalCommandes = livreurOrders.reduce((sum, item) => sum + parseInt(item.nombre_commandes || 0), 0);
      const totalMontant = livreurOrders.reduce((sum, item) => sum + parseFloat(item.total_montant || 0), 0);
      const totalCarburant = livreurExpenses.reduce((sum, item) => sum + parseFloat(item.carburant || 0), 0);
      const totalReparations = livreurExpenses.reduce((sum, item) => sum + parseFloat(item.reparations || 0), 0);
      const totalPolice = livreurExpenses.reduce((sum, item) => sum + parseFloat(item.police || 0), 0);
      const totalAutres = livreurExpenses.reduce((sum, item) => sum + parseFloat(item.autres || 0), 0);
      const totalDepensesLivreur = totalCarburant + totalReparations + totalPolice + totalAutres;
      const totalKm = livreurExpenses.reduce((sum, item) => sum + parseFloat(item.km_parcourus || 0), 0);
      const totalBenefice = totalMontant - totalDepensesLivreur;
      
      totalRows += `
        <tr class="total-row">
          <td class="total-cell"><strong>TOTAL</strong></td>
          <td class="total-cell"><strong>${Utils.escapeHtml(livreur)}</strong></td>
          <td class="total-cell"><strong>${totalCommandes}</strong></td>
          <td class="total-cell"><strong>${totalMontant ? Utils.formatAmount(totalMontant).replace(' FCFA', '') : '0'}</strong></td>
          <td class="total-cell"><strong>${totalCarburant ? Utils.formatAmount(totalCarburant).replace(' FCFA', '') : '0'}</strong></td>
          <td class="total-cell"><strong>${totalReparations ? Utils.formatAmount(totalReparations).replace(' FCFA', '') : '0'}</strong></td>
          <td class="total-cell"><strong>${totalPolice ? Utils.formatAmount(totalPolice).replace(' FCFA', '') : '0'}</strong></td>
          <td class="total-cell"><strong>${totalAutres ? Utils.formatAmount(totalAutres).replace(' FCFA', '') : '0'}</strong></td>
          <td class="total-cell total-depenses"><strong>${totalDepensesLivreur ? Utils.formatAmount(totalDepensesLivreur).replace(' FCFA', '') : '0'}</strong></td>
          <td class="total-cell"><strong>${totalKm}</strong></td>
          <td class="total-cell benefice ${totalBenefice >= 0 ? 'benefice-positif' : 'benefice-negatif'}"><strong>${Utils.formatAmount(totalBenefice).replace(' FCFA', '')}</strong></td>
        </tr>
      `;
    });

    const table = `
      <div class="monthly-detailed-table-container">
        <table class="monthly-detailed-table">
          <thead>
            <tr class="main-header">
              ${headers}
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
          <tfoot>
            ${totalRows}
          </tfoot>
        </table>
      </div>
      <style>
        .monthly-detailed-table-container {
          margin-top: 1rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          max-height: 70vh;
          overflow-y: auto;
          position: relative;
        }
        .monthly-detailed-table {
          border: 1px solid #ddd;
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
        }
        .monthly-detailed-table th,
        .monthly-detailed-table td {
          border: 1px solid #ddd;
          padding: 4px 6px;
          text-align: center;
        }
        .monthly-detailed-table thead {
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .main-header th {
          background-color: #009E60;
          color: white;
          font-weight: bold;
          position: sticky;
          top: 0;
          z-index: 11;
        }
        .sub-header {
          background-color: #f0f0f0;
          font-weight: bold;
          font-size: 10px;
        }
        .date-column, .date-cell {
          background-color: #f8f9fa;
          font-weight: bold;
          min-width: 80px;
          position: sticky;
          left: 0;
          z-index: 5;
        }
        .livreur-column, .livreur-cell {
          background-color: #e3f2fd;
          font-weight: bold;
          min-width: 120px;
          position: sticky;
          left: 80px;
          z-index: 5;
        }
        .date-column {
          z-index: 12;
        }
        .livreur-column {
          z-index: 12;
        }
        .data-cell {
          font-size: 11px;
        }
        .total-cell {
          background-color: #fff3cd;
          font-weight: bold;
        }
        .total-depenses {
          background-color: #ffeaa7 !important;
          font-weight: bold;
        }
        .benefice {
          font-weight: bold;
        }
        .benefice-positif {
          background-color: #d4edda !important;
          color: #155724;
        }
        .benefice-negatif {
          background-color: #f8d7da !important;
          color: #721c24;
        }
        .total-row {
          border-top: 2px solid #009E60;
          position: sticky;
          bottom: 0;
          z-index: 8;
        }
        .total-row .date-cell,
        .total-row .livreur-cell {
          position: sticky;
          bottom: 0;
          z-index: 9;
        }
        /* Améliorer la visibilité des bordures pour les colonnes fixes */
        .date-cell {
          border-right: 2px solid #009E60;
        }
        .livreur-cell {
          border-right: 2px solid #009E60;
        }
      </style>
    `;

    container.innerHTML = table;
  }



  static setupEventListeners() {
    // Gestionnaire pour le changement de mois
    const monthInput = document.getElementById('monthly-dashboard-date-filter');
    if (monthInput) {
      monthInput.addEventListener('change', () => {
        this.loadMonthlyDashboard();
      });
    }

    // Gestionnaire pour le bouton d'actualisation
    const refreshBtn = document.getElementById('refresh-monthly-dashboard');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadMonthlyDashboard();
      });
    }

    // Gestionnaire pour l'export Excel mensuel
    const exportBtn = document.getElementById('export-monthly-excel');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const monthInput = document.getElementById('monthly-dashboard-date-filter');
        const selectedMonth = monthInput.value || new Date().toISOString().slice(0, 7);
        ApiClient.exportMonthlyToExcel(selectedMonth);
        ToastManager.success('Export Excel en cours...');
      });
    }
  }
}

// ===== GESTIONNAIRE DE TABLEAU DE BORD MATA MENSUEL =====
class MataMonthlyDashboardManager {
  static async loadMataMonthlyDashboard() {
    try {
      AppState.isLoading = true;
      
      // Obtenir le mois sélectionné ou le mois actuel
      const monthInput = document.getElementById('mata-monthly-date-filter');
      const selectedMonth = monthInput.value || new Date().toISOString().slice(0, 7);
      
      // Mettre à jour le champ de date si nécessaire
      if (!monthInput.value) {
        monthInput.value = selectedMonth;
      }

      // Charger les données MATA mensuelles
      const response = await ApiClient.getMataMonthlyDashboard(selectedMonth);
      
      // Mettre à jour les statistiques
      this.updateMataStats(response.statistics, selectedMonth);
      
      // Afficher le tableau des commandes MATA
      this.displayMataOrdersTable(response.orders, selectedMonth);
      
    } catch (error) {
      console.error('Erreur lors du chargement du tableau de bord MATA mensuel:', error);
      ToastManager.error('Erreur lors du chargement des données MATA mensuelles');
    } finally {
      AppState.isLoading = false;
    }
  }

  static updateMataStats(statistics, month) {
    // Mettre à jour les cartes de statistiques
    document.getElementById('mata-total-orders').textContent = statistics.total_commandes || 0;
    document.getElementById('mata-total-amount').textContent = Utils.formatAmount(statistics.total_montant || 0);
    document.getElementById('mata-active-livreurs').textContent = statistics.livreurs_actifs || 0;

    // Mettre à jour le label avec le mois
    if (month) {
      const [year, monthNum] = month.split('-');
      const monthNames = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
      ];
      const monthName = monthNames[parseInt(monthNum) - 1];
      document.getElementById('mata-orders-label').textContent = `Commandes MATA - ${monthName} ${year}`;
    }
  }

  static displayMataOrdersTable(orders, month) {
    const container = document.getElementById('mata-orders-table-container');
    
    if (!orders || orders.length === 0) {
      container.innerHTML = '<p class="no-data">Aucune commande MATA trouvée pour ce mois.</p>';
      return;
    }

    // Debug: log des données reçues
    console.log('🔍 Debug orders data:', orders.slice(0, 2)); // Log des 2 premières commandes
    if (orders.length > 0) {
      console.log('🔍 Debug first order ratings:', {
        service_rating: orders[0].service_rating,
        quality_rating: orders[0].quality_rating,
        price_rating: orders[0].price_rating,
        types: {
          service: typeof orders[0].service_rating,
          quality: typeof orders[0].quality_rating,
          price: typeof orders[0].price_rating
        }
      });
    }

    // Créer le tableau avec les colonnes demandées
    const table = `
      <div class="mata-table-container">
        <table class="mata-orders-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Numéro de téléphone</th>
              <th>Nom</th>
              <th>Adresse source</th>
              <th>Adresse destination</th>
              <th>Montant commande (FCFA)</th>
              <th>Livreur</th>
              <th>Commentaire</th>
              <th>Service livraison</th>
              <th>Qualité produits</th>
              <th>Niveau prix</th>
              <th>Note moyenne</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${orders.map(order => {
              // Calculer la note moyenne avec traitement sécurisé des valeurs
              const serviceRating = (order.service_rating !== null && order.service_rating !== undefined && order.service_rating !== '') ? parseFloat(order.service_rating) : null;
              const qualityRating = (order.quality_rating !== null && order.quality_rating !== undefined && order.quality_rating !== '') ? parseFloat(order.quality_rating) : null;
              const priceRating = (order.price_rating !== null && order.price_rating !== undefined && order.price_rating !== '') ? parseFloat(order.price_rating) : null;
              
              // Debug spécifique pour cette commande
              if (order.service_rating || order.quality_rating || order.price_rating) {
                console.log(`🔍 Order ${order.id} ratings:`, {
                  raw: { service: order.service_rating, quality: order.quality_rating, price: order.price_rating },
                  parsed: { service: serviceRating, quality: qualityRating, price: priceRating }
                });
              }
              
              let averageRating = 'NA';
              if (serviceRating !== null && qualityRating !== null && priceRating !== null && 
                  !isNaN(serviceRating) && !isNaN(qualityRating) && !isNaN(priceRating)) {
                const calculated = ((serviceRating + qualityRating + priceRating) / 3);
                averageRating = calculated.toFixed(1);
                console.log(`🔍 Order ${order.id} average calculation: ${serviceRating} + ${qualityRating} + ${priceRating} / 3 = ${calculated} → ${averageRating}`);
              }
              
              return `
              <tr data-order-id="${order.id}">
                <td>${new Date(order.date).toLocaleDateString('fr-FR')}</td>
                <td>${Utils.escapeHtml(order.phone_number)}</td>
                <td>${Utils.escapeHtml(order.client_name)}</td>
                <td>${order.adresse_source ? Utils.escapeHtml(order.adresse_source) : '-'}</td>
                <td>${order.adresse_destination ? Utils.escapeHtml(order.adresse_destination) : '-'}</td>
                <td>${Utils.formatAmount(order.montant_commande || 0)}</td>
                <td>${Utils.escapeHtml(order.livreur)}</td>
                <td>
                  <div class="comment-cell">
                    <span class="comment-display" ${!order.commentaire ? 'style="color: #999; font-style: italic;"' : ''}>
                      ${order.commentaire ? Utils.escapeHtml(order.commentaire) : 'Aucun commentaire'}
                    </span>
                    <textarea class="comment-edit hidden" rows="2" placeholder="Ajouter un commentaire...">${order.commentaire || ''}</textarea>
                  </div>
                </td>
                <td class="rating-cell">
                  <div class="rating-display">
                    <span class="rating-value" ${serviceRating === null ? 'style="color: #999; font-style: italic;"' : ''}>
                      ${serviceRating !== null ? serviceRating + '/10' : 'NA'}
                    </span>
                    <button class="btn-edit-rating" data-type="service" data-order-id="${order.id}" title="Modifier la note">✏️</button>
                  </div>
                  <div class="rating-edit-group hidden">
                    <input type="number" class="rating-edit" min="0" max="10" step="0.1" value="${serviceRating || ''}" data-type="service">
                    <div class="rating-buttons">
                      <button class="btn btn-xs btn-success save-rating-btn" data-type="service" data-order-id="${order.id}">✓</button>
                      <button class="btn btn-xs btn-secondary cancel-rating-btn" data-type="service" data-order-id="${order.id}">✗</button>
                    </div>
                  </div>
                </td>
                <td class="rating-cell">
                  <div class="rating-display">
                    <span class="rating-value" ${qualityRating === null ? 'style="color: #999; font-style: italic;"' : ''}>
                      ${qualityRating !== null ? qualityRating + '/10' : 'NA'}
                    </span>
                    <button class="btn-edit-rating" data-type="quality" data-order-id="${order.id}" title="Modifier la note">✏️</button>
                  </div>
                  <div class="rating-edit-group hidden">
                    <input type="number" class="rating-edit" min="0" max="10" step="0.1" value="${qualityRating || ''}" data-type="quality">
                    <div class="rating-buttons">
                      <button class="btn btn-xs btn-success save-rating-btn" data-type="quality" data-order-id="${order.id}">✓</button>
                      <button class="btn btn-xs btn-secondary cancel-rating-btn" data-type="quality" data-order-id="${order.id}">✗</button>
                    </div>
                  </div>
                </td>
                <td class="rating-cell">
                  <div class="rating-display">
                    <span class="rating-value" ${priceRating === null ? 'style="color: #999; font-style: italic;"' : ''}>
                      ${priceRating !== null ? priceRating + '/10' : 'NA'}
                    </span>
                    <button class="btn-edit-rating" data-type="price" data-order-id="${order.id}" title="Modifier la note">✏️</button>
                  </div>
                  <div class="rating-edit-group hidden">
                    <input type="number" class="rating-edit" min="0" max="10" step="0.1" value="${priceRating || ''}" data-type="price">
                    <div class="rating-buttons">
                      <button class="btn btn-xs btn-success save-rating-btn" data-type="price" data-order-id="${order.id}">✓</button>
                      <button class="btn btn-xs btn-secondary cancel-rating-btn" data-type="price" data-order-id="${order.id}">✗</button>
                    </div>
                  </div>
                </td>
                <td class="average-rating-cell">
                  <span class="average-rating ${averageRating !== 'NA' ? (averageRating >= 7 ? 'good' : averageRating >= 5 ? 'average' : 'poor') : ''}">
                    ${averageRating}${averageRating !== 'NA' ? '/10' : ''}
                  </span>
                </td>
                <td>
                  <div class="action-buttons">
                    <button class="btn btn-sm btn-secondary edit-comment-btn" data-order-id="${order.id}">
                      <span class="icon">✏️</span>
                      Modifier
                    </button>
                    <button class="btn btn-sm btn-success save-comment-btn hidden" data-order-id="${order.id}">
                      <span class="icon">💾</span>
                      Sauver
                    </button>
                    <button class="btn btn-sm btn-secondary cancel-comment-btn hidden" data-order-id="${order.id}">
                      <span class="icon">❌</span>
                      Annuler
                    </button>
                  </div>
                </td>
              </tr>
            `;
            }).join('')}
          </tbody>
        </table>
      </div>
      <style>
        .mata-table-container {
          margin-top: 1rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          max-height: 70vh;
          overflow-y: auto;
          position: relative;
        }
        .mata-orders-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 12px;
        }
        .mata-orders-table th,
        .mata-orders-table td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
          vertical-align: top;
        }
        .mata-orders-table thead {
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .mata-orders-table th {
          background-color: #009E60;
          color: white;
          font-weight: bold;
          position: sticky;
          top: 0;
          z-index: 11;
        }
        .mata-orders-table tbody tr:nth-child(even) {
          background-color: #f8f9fa;
        }
        .mata-orders-table tbody tr:hover {
          background-color: #e3f2fd;
        }
        .comment-cell {
          min-width: 200px;
          max-width: 300px;
        }
        .comment-display {
          display: block;
          word-wrap: break-word;
        }
        .comment-edit {
          width: 100%;
          resize: vertical;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 4px;
        }
        .rating-cell {
          min-width: 100px;
          text-align: center;
        }
        .rating-display {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .rating-value {
          font-weight: 600;
          min-width: 40px;
        }
        .btn-edit-rating {
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px 4px;
          border-radius: 3px;
          font-size: 12px;
          opacity: 0.7;
          transition: opacity 0.2s;
        }
        .btn-edit-rating:hover {
          opacity: 1;
          background-color: #f0f0f0;
        }
        .rating-edit {
          width: 60px;
          padding: 4px;
          border: 1px solid #2563eb;
          border-radius: 4px;
          text-align: center;
        }
        .rating-edit-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
          align-items: center;
        }
        .rating-buttons {
          display: flex;
          gap: 4px;
        }
        .btn-xs {
          padding: 2px 6px;
          font-size: 10px;
          min-width: 20px;
          height: 24px;
        }
        .average-rating-cell {
          text-align: center;
          font-weight: bold;
        }
        .average-rating.good {
          color: #16a34a;
          background-color: #dcfce7;
          padding: 4px 8px;
          border-radius: 12px;
        }
        .average-rating.average {
          color: #ca8a04;
          background-color: #fef3c7;
          padding: 4px 8px;
          border-radius: 12px;
        }
        .average-rating.poor {
          color: #dc2626;
          background-color: #fee2e2;
          padding: 4px 8px;
          border-radius: 12px;
        }
        .action-buttons {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 120px;
        }
        .mata-orders-table td:nth-child(1) { min-width: 80px; }
        .mata-orders-table td:nth-child(2) { min-width: 120px; }
        .mata-orders-table td:nth-child(3) { min-width: 150px; }
        .mata-orders-table td:nth-child(4) { min-width: 200px; }
        .mata-orders-table td:nth-child(5) { min-width: 200px; }
        .mata-orders-table td:nth-child(6) { min-width: 120px; text-align: right; }
        .mata-orders-table td:nth-child(7) { min-width: 100px; }
        .mata-orders-table td:nth-child(8) { min-width: 200px; }
        .mata-orders-table td:nth-child(9) { min-width: 100px; }
        .mata-orders-table td:nth-child(10) { min-width: 100px; }
        .mata-orders-table td:nth-child(11) { min-width: 100px; }
        .mata-orders-table td:nth-child(12) { min-width: 100px; }
        .mata-orders-table td:nth-child(13) { min-width: 150px; }
      </style>
    `;

    container.innerHTML = table;
    
    // Ajouter les event listeners pour l'édition des commentaires et des notes
    this.setupCommentEditListeners();
    this.setupRatingEditListeners();
  }

  static setupCommentEditListeners() {
    // Boutons "Modifier"
    document.querySelectorAll('.edit-comment-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const orderId = e.currentTarget.dataset.orderId;
        this.startEditComment(orderId);
      });
    });

    // Boutons "Sauver"
    document.querySelectorAll('.save-comment-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const orderId = e.currentTarget.dataset.orderId;
        await this.saveComment(orderId);
      });
    });

    // Boutons "Annuler"
    document.querySelectorAll('.cancel-comment-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const orderId = e.currentTarget.dataset.orderId;
        this.cancelEditComment(orderId);
      });
    });
  }

  static startEditComment(orderId) {
    const row = document.querySelector(`tr[data-order-id="${orderId}"]`);
    const commentDisplay = row.querySelector('.comment-display');
    const commentEdit = row.querySelector('.comment-edit');
    const editBtn = row.querySelector('.edit-comment-btn');
    const saveBtn = row.querySelector('.save-comment-btn');
    const cancelBtn = row.querySelector('.cancel-comment-btn');

    // Masquer l'affichage et le bouton modifier
    commentDisplay.classList.add('hidden');
    editBtn.classList.add('hidden');

    // Afficher l'édition et les boutons sauver/annuler
    commentEdit.classList.remove('hidden');
    saveBtn.classList.remove('hidden');
    cancelBtn.classList.remove('hidden');

    // Focus sur le textarea
    commentEdit.focus();
  }

  static async saveComment(orderId) {
    try {
      const row = document.querySelector(`tr[data-order-id="${orderId}"]`);
      const commentEdit = row.querySelector('.comment-edit');
      const newComment = commentEdit.value.trim();

      // Sauvegarder via l'API
      await ApiClient.updateMataOrderComment(orderId, newComment);

      // Mettre à jour l'affichage
      const commentDisplay = row.querySelector('.comment-display');
      if (newComment) {
        commentDisplay.textContent = newComment;
        commentDisplay.style.color = '';
        commentDisplay.style.fontStyle = '';
      } else {
        commentDisplay.textContent = 'Aucun commentaire';
        commentDisplay.style.color = '#999';
        commentDisplay.style.fontStyle = 'italic';
      }

      // Revenir au mode affichage
      this.cancelEditComment(orderId);

      ToastManager.success('Commentaire mis à jour avec succès');

    } catch (error) {
      console.error('Erreur lors de la sauvegarde du commentaire:', error);
      ToastManager.error('Erreur lors de la sauvegarde du commentaire');
    }
  }

  static cancelEditComment(orderId) {
    const row = document.querySelector(`tr[data-order-id="${orderId}"]`);
    const commentDisplay = row.querySelector('.comment-display');
    const commentEdit = row.querySelector('.comment-edit');
    const editBtn = row.querySelector('.edit-comment-btn');
    const saveBtn = row.querySelector('.save-comment-btn');
    const cancelBtn = row.querySelector('.cancel-comment-btn');

    // Afficher l'affichage et le bouton modifier
    commentDisplay.classList.remove('hidden');
    editBtn.classList.remove('hidden');

    // Masquer l'édition et les boutons sauver/annuler
    commentEdit.classList.add('hidden');
    saveBtn.classList.add('hidden');
    cancelBtn.classList.add('hidden');

    // Restaurer la valeur originale
    const originalComment = commentDisplay.textContent === 'Aucun commentaire' ? '' : commentDisplay.textContent;
    commentEdit.value = originalComment;
  }

  static setupRatingEditListeners() {
    // Boutons "Modifier"
    document.querySelectorAll('.btn-edit-rating').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const orderId = e.currentTarget.dataset.orderId;
        const type = e.currentTarget.dataset.type;
        this.startEditRating(orderId, type);
      });
    });

    // Boutons "Sauver"
    document.querySelectorAll('.save-rating-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const orderId = e.currentTarget.dataset.orderId;
        const type = e.currentTarget.dataset.type;
        await this.saveRating(orderId, type);
      });
    });

    // Boutons "Annuler"
    document.querySelectorAll('.cancel-rating-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const orderId = e.currentTarget.dataset.orderId;
        const type = e.currentTarget.dataset.type;
        this.cancelEditRating(orderId, type);
      });
    });
  }

  static startEditRating(orderId, type) {
    const row = document.querySelector(`tr[data-order-id="${orderId}"]`);
    const ratingCell = row.querySelector(`.rating-cell:has(.btn-edit-rating[data-type="${type}"])`);
    const ratingDisplay = ratingCell.querySelector('.rating-display');
    const ratingEditGroup = ratingCell.querySelector('.rating-edit-group');

    // Masquer l'affichage et afficher l'édition
    ratingDisplay.classList.add('hidden');
    ratingEditGroup.classList.remove('hidden');

    // Focus sur l'input
    const ratingInput = ratingEditGroup.querySelector('.rating-edit');
    ratingInput.focus();
  }

  static async saveRating(orderId, type) {
    try {
      const row = document.querySelector(`tr[data-order-id="${orderId}"]`);
      const ratingCell = row.querySelector(`.rating-cell:has(.btn-edit-rating[data-type="${type}"])`);
      const ratingEdit = ratingCell.querySelector('.rating-edit');
      const newRating = parseFloat(ratingEdit.value);

      // Validation
      if (ratingEdit.value !== '' && (isNaN(newRating) || newRating < 0 || newRating > 10)) {
        ToastManager.error('La note doit être entre 0 et 10');
        return;
      }

      // Sauvegarder via l'API
      await ApiClient.updateMataOrderRating(orderId, type, ratingEdit.value === '' ? null : newRating);

      // Mettre à jour l'affichage
      const ratingValue = ratingCell.querySelector('.rating-value');
      if (ratingEdit.value !== '') {
        ratingValue.textContent = newRating + '/10';
        ratingValue.style.color = '';
        ratingValue.style.fontStyle = '';
      } else {
        ratingValue.textContent = 'NA';
        ratingValue.style.color = '#999';
        ratingValue.style.fontStyle = 'italic';
      }

      // Recalculer et mettre à jour la note moyenne
      this.updateAverageRating(orderId);

      // Revenir au mode affichage
      this.cancelEditRating(orderId, type);

      ToastManager.success('Note mise à jour avec succès');

    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la note:', error);
      ToastManager.error('Erreur lors de la sauvegarde de la note');
    }
  }

  static cancelEditRating(orderId, type) {
    const row = document.querySelector(`tr[data-order-id="${orderId}"]`);
    const ratingCell = row.querySelector(`.rating-cell:has(.btn-edit-rating[data-type="${type}"])`);
    const ratingDisplay = ratingCell.querySelector('.rating-display');
    const ratingEditGroup = ratingCell.querySelector('.rating-edit-group');

    // Afficher l'affichage et masquer l'édition
    ratingDisplay.classList.remove('hidden');
    ratingEditGroup.classList.add('hidden');

    // Restaurer la valeur originale dans l'input
    const ratingValue = ratingCell.querySelector('.rating-value');
    const ratingEdit = ratingCell.querySelector('.rating-edit');
    const originalValue = ratingValue.textContent === 'NA' ? '' : ratingValue.textContent.replace('/10', '');
    ratingEdit.value = originalValue;
  }

  static updateAverageRating(orderId) {
    const row = document.querySelector(`tr[data-order-id="${orderId}"]`);
    const ratingCells = row.querySelectorAll('.rating-cell');
    
    let serviceRating = null;
    let qualityRating = null;
    let priceRating = null;

    // Récupérer les valeurs actuelles avec traitement sécurisé
    ratingCells.forEach(cell => {
      const btn = cell.querySelector('.btn-edit-rating');
      if (btn) {
        const type = btn.dataset.type;
        const value = cell.querySelector('.rating-value').textContent;
        if (value !== 'NA' && value.trim() !== '') {
          const numValue = parseFloat(value.replace('/10', ''));
          if (!isNaN(numValue)) {
            if (type === 'service') serviceRating = numValue;
            else if (type === 'quality') qualityRating = numValue;
            else if (type === 'price') priceRating = numValue;
          }
        }
      }
    });

    // Calculer la moyenne
    let averageRating = 'NA';
    if (serviceRating !== null && qualityRating !== null && priceRating !== null) {
      averageRating = ((serviceRating + qualityRating + priceRating) / 3).toFixed(1);
    }

    // Mettre à jour l'affichage de la moyenne
    const averageCell = row.querySelector('.average-rating-cell');
    const averageSpan = averageCell.querySelector('.average-rating');
    
    averageSpan.textContent = averageRating + (averageRating !== 'NA' ? '/10' : '');
    
    // Mettre à jour la classe CSS pour la couleur
    averageSpan.className = 'average-rating';
    if (averageRating !== 'NA') {
      if (averageRating >= 7) averageSpan.classList.add('good');
      else if (averageRating >= 5) averageSpan.classList.add('average');
      else averageSpan.classList.add('poor');
    }
  }

  static setupEventListeners() {
    // Gestionnaire pour le changement de mois
    const monthInput = document.getElementById('mata-monthly-date-filter');
    if (monthInput) {
      monthInput.addEventListener('change', () => {
        this.loadMataMonthlyDashboard();
      });
    }

    // Gestionnaire pour le bouton d'actualisation
    const refreshBtn = document.getElementById('refresh-mata-monthly-dashboard');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadMataMonthlyDashboard();
      });
    }

    // Gestionnaire pour l'export Excel MATA mensuel
    const exportBtn = document.getElementById('export-mata-monthly-excel');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const monthInput = document.getElementById('mata-monthly-date-filter');
        const selectedMonth = monthInput.value || new Date().toISOString().slice(0, 7);
        ApiClient.exportMataMonthlyToExcel(selectedMonth);
        ToastManager.success('Export Excel MATA en cours...');
      });
    }

    // Gestionnaire pour l'export Excel MATA mensuel (bouton au-dessus du tableau)
    const exportTableBtn = document.getElementById('export-mata-monthly-excel-table');
    if (exportTableBtn) {
      exportTableBtn.addEventListener('click', () => {
        const monthInput = document.getElementById('mata-monthly-date-filter');
        const selectedMonth = monthInput.value || new Date().toISOString().slice(0, 7);
        ApiClient.exportMataMonthlyToExcel(selectedMonth);
        ToastManager.success('Export Excel MATA en cours...');
      });
    }
  }

  static updateTypeAnalysis(typeStats) {
    const container = document.getElementById('type-analysis-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    typeStats.forEach(type => {
      const typeCard = document.createElement('div');
      typeCard.className = 'stat-card';
      typeCard.innerHTML = `
        <div class="stat-icon">${this.getTypeIcon(type.type)}</div>
        <div class="stat-content">
          <h3>${type.count}</h3>
          <p>${this.getTypeName(type.type)}</p>
          <small>${Utils.formatAmount(type.revenue)} • ${type.totalKm || 0} km</small>
        </div>
      `;
      container.appendChild(typeCard);
    });
  }
}

// ===== GESTIONNAIRE DES COMMANDES =====
class OrderManager {
  static async loadOrders(page = 1) {
    try {
      const response = await ApiClient.getOrders(page, 20);
      AppState.orders = response.orders || [];
      AppState.currentOrdersPage = response.pagination?.page || 1;
      AppState.totalOrdersPages = response.pagination?.totalPages || 1;

      this.displayOrders();
      this.updatePagination();
      this.setupOrderEventListeners();
    } catch (error) {
      console.error('Erreur lors du chargement des commandes:', error);
      ToastManager.error('Erreur lors du chargement des commandes');
    }
  }

  static async loadOrdersByDate(date) {
    try {
      const response = await ApiClient.getOrdersByDate(date);
      AppState.orders = response.orders || [];
      this.displayOrders();
      this.setupOrderEventListeners();
      
      // Masquer la pagination pour les filtres par date
      document.getElementById('orders-pagination').classList.add('hidden');
    } catch (error) {
      console.error('Erreur lors du chargement des commandes par date:', error);
      ToastManager.error('Erreur lors du chargement des commandes');
    }
  }

  static async loadLastUserOrders() {
    try {
      const response = await ApiClient.getLastUserOrders(5);
      this.displayUserRecentOrders(response.orders || []);
    } catch (error) {
      console.error('Erreur lors du chargement des dernières commandes:', error);
    }
  }

  static displayOrders() {
    const container = document.getElementById('orders-list');
    
    if (AppState.orders.length === 0) {
      container.innerHTML = '<p class="text-center">Aucune commande trouvée</p>';
      return;
    }

    container.innerHTML = AppState.orders.map(order => `
      <div class="order-card">
        <div class="order-header">
          <div>
            <div class="order-title">${Utils.escapeHtml(order.client_name)}</div>
            <div class="order-meta">
              ${Utils.formatDate(order.created_at)}
              ${order.creator_username ? ` • Par ${Utils.escapeHtml(order.creator_username)}` : ''}
              ${(order.order_type === 'MLC' && order.is_subscription) ? '<span class="badge badge-subscription">🎫 Abonnement</span>' : ''}
            </div>
          </div>
          <div class="order-actions">
            ${this.canEditOrder(order) ? `
              <button class="btn btn-sm btn-secondary order-edit-btn" data-order-id="${order.id}">
                <span class="icon">✏️</span>
                Modifier
              </button>
            ` : ''}
            ${(AppState.user && AppState.user.role === 'ADMIN') ? `
              <button class="btn btn-sm btn-danger order-delete-btn" data-order-id="${order.id}">
                <span class="icon">🗑️</span>
                Supprimer
              </button>
            ` : ''}
          </div>
        </div>
        <div class="order-body">
          <div class="order-info">
            <span>📞 ${Utils.escapeHtml(order.phone_number)}</span>
            <span>📍 ${Utils.escapeHtml(order.address)}</span>
          </div>
          <div class="order-description">${Utils.escapeHtml(order.description || '')}</div>
          <div class="order-prices">
            <span class="order-price">Course : <b>${Utils.formatAmount(order.course_price)}</b></span>
            ${order.order_type === 'MATA' ? `<span class="order-amount">Montant : <b>${Utils.formatAmount(order.amount)}</b></span>` : ''}
          </div>
          <div class="order-type">Type : <b>${Utils.escapeHtml(order.order_type)}</b></div>
        </div>
      </div>
    `).join('');
  }

  static displayUserRecentOrders(orders) {
    const container = document.getElementById('user-recent-orders');
    
    if (orders.length === 0) {
      container.innerHTML = '<p class="text-center">Aucune commande récente</p>';
      return;
    }

    container.innerHTML = orders.map(order => `
      <div class="order-card">
        <div class="order-header">
          <div class="order-title">${Utils.escapeHtml(order.client_name)}</div>
          <div class="order-meta">${Utils.formatDate(order.created_at)}</div>
        </div>
        <div class="order-details">
          <p><strong>Téléphone:</strong> ${Utils.escapeHtml(order.phone_number)}</p>
          <p><strong>Prix de la course:</strong> <span class="order-amount">${Utils.formatAmount(order.course_price)}</span></p>
          ${order.order_type === 'MATA' && order.amount ? `<p><strong>Montant du panier:</strong> <span class="order-amount">${Utils.formatAmount(order.amount)}</span></p>` : ''}
          <p><strong>Type:</strong> <span class="order-type ${order.order_type}">${order.order_type}</span>
            ${order.order_type === 'MLC' && order.is_subscription ? '<span class="badge-abonnement" style="margin-left:8px;background:#2563eb;color:#fff;padding:2px 8px;border-radius:8px;font-size:0.8em;vertical-align:middle;">🎫 Abonnement</span>' : ''}
          </p>
        </div>
      </div>
    `).join('');
  }

  static updatePagination() {
    const pagination = document.getElementById('orders-pagination');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');

    if (AppState.totalOrdersPages <= 1) {
      pagination.classList.add('hidden');
      return;
    }

    pagination.classList.remove('hidden');
    pageInfo.textContent = `Page ${AppState.currentOrdersPage} sur ${AppState.totalOrdersPages}`;
    
    prevBtn.disabled = AppState.currentOrdersPage <= 1;
    nextBtn.disabled = AppState.currentOrdersPage >= AppState.totalOrdersPages;
  }

  static setupOrderEventListeners() {
    // Boutons d'édition des commandes
    document.querySelectorAll('.order-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const orderId = e.currentTarget.dataset.orderId;
        this.editOrder(orderId);
      });
    });

    // Boutons de suppression des commandes
    document.querySelectorAll('.order-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const orderId = e.currentTarget.dataset.orderId;
        ModalManager.confirm(
          'Supprimer la commande',
          'Êtes-vous sûr de vouloir supprimer cette commande ? Cette action est irréversible.',
          () => {
            this.deleteOrder(orderId);
          }
        );
      });
    });
  }

  static canEditOrder(order) {
    if (AppState.user.role === 'ADMIN') return true;
    if (AppState.user.role === 'MANAGER') return true;
    if (AppState.user.role === 'LIVREUR' && order.created_by === AppState.user.id) return true;
    return false;
  }

  static canDeleteOrder(order) {
    const today = new Date().toISOString().split('T')[0];
    const orderDate = new Date(order.created_at).toISOString().split('T')[0];
    
    if (AppState.user.role === 'ADMIN') return true;
    if (['SALIOU', 'OUSMANE'].includes(AppState.user.username)) return true;
    if (AppState.user.role === 'MANAGER' && orderDate === today) return true;
    if (AppState.user.role === 'LIVREUR' && order.created_by === AppState.user.id && orderDate === today) return true;
    
    return false;
  }

  static async createOrder(formData) {
    try {
      await ApiClient.createOrder(formData);
      ToastManager.success('Commande créée avec succès');
      
      // Réinitialiser le formulaire
      document.getElementById('new-order-form').reset();
      
      // Recharger les dernières commandes
      await this.loadLastUserOrders();
      
      return true;
    } catch (error) {
      console.error('Erreur lors de la création de la commande:', error);
      throw error;
    }
  }

  static async editOrder(orderId) {
    try {
      const order = AppState.orders.find(o => o.id === orderId);
      if (!order) {
        ToastManager.error('Commande non trouvée');
        return;
      }

      const content = `
        <form id="edit-order-form">
          <div class="form-group">
            <label for="edit-client-name">Nom du client *</label>
            <input type="text" id="edit-client-name" name="client_name" value="${Utils.escapeHtml(order.client_name)}" required>
          </div>
          <div class="form-group">
            <label for="edit-phone-number">Numéro de téléphone *</label>
            <input type="tel" id="edit-phone-number" name="phone_number" value="${Utils.escapeHtml(order.phone_number)}" required>
          </div>
          <div class="form-group" id="edit-adresse-source-group">
            <label for="edit-adresse-source">Adresse source</label>
            <textarea id="edit-adresse-source" name="adresse_source" rows="2" placeholder="Adresse de départ">${order.adresse_source ? Utils.escapeHtml(order.adresse_source) : ''}</textarea>
          </div>
          <div class="form-group" id="edit-adresse-destination-group">
            <label for="edit-adresse-destination">Adresse destination *</label>
            <textarea id="edit-adresse-destination" name="adresse_destination" rows="2" placeholder="Adresse d'arrivée" required>${order.adresse_destination ? Utils.escapeHtml(order.adresse_destination) : ''}</textarea>
          </div>
          <div class="form-group" id="edit-point-vente-group" style="display: none;">
            <label for="edit-point-vente">Point de vente *</label>
            <select id="edit-point-vente" name="point_de_vente">
              <option value="">Sélectionner un point de vente</option>
              <option value="O.Foire" ${order.point_de_vente === 'O.Foire' ? 'selected' : ''}>O.Foire</option>
              <option value="Mbao" ${order.point_de_vente === 'Mbao' ? 'selected' : ''}>Mbao</option>
              <option value="Keur Massar" ${order.point_de_vente === 'Keur Massar' ? 'selected' : ''}>Keur Massar</option>
            </select>
          </div>
          <div class="form-group" id="edit-description-group">
            <label for="edit-description">Description</label>
            <textarea id="edit-description" name="description" rows="4">${order.description ? Utils.escapeHtml(order.description) : ''}</textarea>
          </div>
          <div class="form-group">
            <label for="edit-order-type">Type de commande *</label>
            <select id="edit-order-type" name="order_type" required>
              <option value="MATA" ${order.order_type === 'MATA' ? 'selected' : ''}>MATA</option>
              <option value="MLC" ${order.order_type === 'MLC' ? 'selected' : ''}>MLC</option>
              <option value="AUTRE" ${order.order_type === 'AUTRE' ? 'selected' : ''}>AUTRE</option>
            </select>
          </div>
          <div class="form-group" id="edit-course-price-group" style="display: ${order.order_type ? 'block' : 'none'};">
            <label for="edit-course-price">Prix de la course (FCFA)</label>
            <input type="number" id="edit-course-price" name="course_price" step="0.01" min="0" value="${order.course_price || (order.order_type === 'MATA' ? 1500 : '')}" ${order.order_type === 'MATA' ? 'readonly' : ''}>
          </div>
          <div class="form-group" id="edit-amount-group" style="display: ${order.order_type === 'MATA' ? 'block' : 'none'};">
            <label for="edit-amount">Montant du panier (FCFA)</label>
            <input type="number" id="edit-amount" name="amount" step="0.01" min="0" value="${order.amount || ''}">
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Sauvegarder</button>
            <button type="button" class="btn btn-secondary modal-cancel-btn">Annuler</button>
          </div>
        </form>
      `;

      ModalManager.show('Modifier la commande', content);

      // Hide old address field if present
      const oldAddressField = document.getElementById('edit-address');
      if (oldAddressField) oldAddressField.parentElement.style.display = 'none';

      // Show/hide point de vente and set required logic
      const orderTypeSelect = document.getElementById('edit-order-type');
      const adresseSourceGroup = document.getElementById('edit-adresse-source-group');
      const adresseDestinationGroup = document.getElementById('edit-adresse-destination-group');
      const pointVenteGroup = document.getElementById('edit-point-vente-group');
      const pointVenteSelect = document.getElementById('edit-point-vente');
      const adresseSourceInput = document.getElementById('edit-adresse-source');
      const adresseDestinationInput = document.getElementById('edit-adresse-destination');
      const adresseSourceLabel = adresseSourceGroup.querySelector('label');

      function updateEditOrderFields() {
        const type = orderTypeSelect.value;
        if (type === 'MLC' || type === 'AUTRE') {
          adresseSourceGroup.style.display = '';
          adresseDestinationGroup.style.display = '';
          pointVenteGroup.style.display = 'none';
          adresseSourceInput.required = true;
          adresseDestinationInput.required = true;
          if (adresseSourceLabel) adresseSourceLabel.innerHTML = 'Adresse source <span style="color:red">*</span>';
          if (pointVenteSelect) pointVenteSelect.required = false;
        } else if (type === 'MATA') {
          adresseSourceGroup.style.display = '';
          adresseDestinationGroup.style.display = '';
          pointVenteGroup.style.display = '';
          adresseSourceInput.required = false;
          adresseDestinationInput.required = true;
          if (adresseSourceLabel) adresseSourceLabel.innerHTML = 'Adresse source';
          if (pointVenteSelect) pointVenteSelect.required = true;
        } else {
          adresseSourceGroup.style.display = '';
          adresseDestinationGroup.style.display = '';
          pointVenteGroup.style.display = 'none';
          adresseSourceInput.required = false;
          adresseDestinationInput.required = false;
          if (adresseSourceLabel) adresseSourceLabel.innerHTML = 'Adresse source';
          if (pointVenteSelect) pointVenteSelect.required = false;
        }
      }
      orderTypeSelect.addEventListener('change', updateEditOrderFields);
      updateEditOrderFields();

      // Gestionnaire pour le bouton d'annulation
      document.querySelector('.modal-cancel-btn').addEventListener('click', () => {
        ModalManager.hide();
      });

      document.getElementById('edit-order-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const orderData = Object.fromEntries(formData.entries());
        if (orderData.course_price) orderData.course_price = parseFloat(orderData.course_price);
        if (orderData.amount) orderData.amount = parseFloat(orderData.amount);
        if (orderData.order_type === 'MLC' || orderData.order_type === 'AUTRE') {
          if (!orderData.amount || isNaN(orderData.amount) || orderData.amount <= 0) {
            delete orderData.amount;
          }
        }
        if (orderData.subscription_id === '') {
          delete orderData.subscription_id;
        }
        if (!Utils.validatePhoneNumber(orderData.phone_number)) {
          ToastManager.error('Numéro de téléphone invalide (doit contenir entre 6 et 20 chiffres)');
          return;
        }
        try {
          await ApiClient.updateOrder(orderId, orderData);
          ModalManager.hide();
          ToastManager.success('Commande modifiée avec succès');
          await this.loadOrders(AppState.currentOrdersPage);
        } catch (error) {
          ToastManager.error(error.message || 'Erreur lors de la modification');
        }
      });
    } catch (error) {
      console.error('Erreur lors de l\'édition de la commande:', error);
      ToastManager.error('Erreur lors de l\'édition de la commande');
    }
  }

  static async deleteOrder(orderId) {
    ModalManager.confirm(
      'Supprimer la commande',
      'Êtes-vous sûr de vouloir supprimer cette commande ? Cette action est irréversible.',
      async () => {
        try {
          await ApiClient.deleteOrder(orderId);
          ToastManager.success('Commande supprimée avec succès');
          await this.loadOrders(AppState.currentOrdersPage);
          // Rafraîchir la liste des abonnements si la page active est 'subscriptions'
          if (AppState.currentPage === 'subscriptions') {
            await SubscriptionManager.loadSubscriptions();
          }
        } catch (error) {
          ToastManager.error(error.message || 'Erreur lors de la suppression');
        }
      }
    );
  }
}

// ===== GESTIONNAIRE DES DÉPENSES =====
class ExpenseManager {
  static async loadExpenses() {
    try {
      // Obtenir la date sélectionnée ou utiliser aujourd'hui par défaut
      let selectedDate = document.getElementById('expenses-date-filter')?.value;
      const today = new Date().toISOString().split('T')[0];

      if (!selectedDate) {
        selectedDate = today;
        const dateFilterInput = document.getElementById('expenses-date-filter');
        if (dateFilterInput) {
          dateFilterInput.value = selectedDate;
        }
      }

      // Mettre à jour le titre de la page avec la date sélectionnée
      this.updatePageTitle(selectedDate);

      // Charger le récapitulatif des dépenses
      const response = await ApiClient.getExpensesSummary(selectedDate);
      this.displayExpensesSummary(response.summary || []);

      // Configurer les event listeners
      this.setupEventListeners();

      // Vérifier que le champ de date est bien interactif
      this.ensureDateFieldIsClickable();

    } catch (error) {
      console.error('Erreur lors du chargement des dépenses:', error);
      ToastManager.error('Erreur lors du chargement des dépenses');
    }
  }

  static displayExpensesSummary(summary) {
    const container = document.getElementById('expenses-summary');
    
    if (summary.length === 0) {
      const selectedDate = document.getElementById('expenses-date-filter')?.value;
      const formattedDate = selectedDate ? Utils.formatDisplayDate(selectedDate) : '';
      container.innerHTML = `
        <div class="text-center" style="padding: 2rem; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 1.1rem; margin-bottom: 0.5rem;">📊 Aucune donnée disponible</p>
          <p style="color: #9ca3af; font-size: 0.9rem;">pour la date du ${formattedDate}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Livreur</th>
              <th>Carburant</th>
              <th>Réparations</th>
              <th>Police</th>
              <th>Autres</th>
              <th>Total</th>
              <th>Km parcourus</th>
              <th>Commentaire</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${summary.map(item => `
              <tr>
                <td>${Utils.escapeHtml(item.livreur)}</td>
                <td>${Utils.formatAmount(item.carburant)}</td>
                <td>${Utils.formatAmount(item.reparations)}</td>
                <td>${Utils.formatAmount(item.police)}</td>
                <td>${Utils.formatAmount(item.autres)}</td>
                <td><strong>${Utils.formatAmount(item.total)}</strong></td>
                <td><strong>${item.km_parcourus || 0} km</strong></td>
                <td>${item.commentaire ? Utils.escapeHtml(item.commentaire) : '-'}</td>
                <td>
                  <button class="btn btn-sm btn-primary expense-edit-btn" data-livreur-id="${item.livreur_id}" data-expense-id="${item.expense_id || ''}">
                    <span class="icon">✏️</span>
                    ${item.expense_id ? 'Modifier' : 'Ajouter'}
                  </button>
                  ${item.expense_id ? `
                    <button class="btn btn-sm btn-danger expense-delete-btn" data-expense-id="${item.expense_id}">
                      <span class="icon">🗑️</span>
                      Supprimer
                    </button>
                  ` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  static setupEventListeners() {
    // Filtre par date
    const dateFilter = document.getElementById('expenses-date-filter');
    if (dateFilter) {
      // Supprimer les anciens event listeners
      dateFilter.removeEventListener('change', this.handleDateChange);
      dateFilter.removeEventListener('click', this.handleDateClick);
      dateFilter.removeEventListener('focus', this.handleDateFocus);
      
      // Ajouter les nouveaux event listeners
      dateFilter.addEventListener('change', this.handleDateChange.bind(this));
      dateFilter.addEventListener('click', this.handleDateClick.bind(this));
      dateFilter.addEventListener('focus', this.handleDateFocus.bind(this));
      
      // S'assurer que le champ est interactif
      dateFilter.style.pointerEvents = 'auto';
      dateFilter.style.cursor = 'pointer';
      
      console.log('✅ Event listeners configurés pour le champ de date des dépenses');
    }

    // Configurer le bouton d'aide pour le sélecteur de date
    const datePickerHelper = document.getElementById('date-picker-helper');
    if (datePickerHelper) {
      datePickerHelper.addEventListener('click', () => {
        console.log('🆘 Bouton d\'aide cliqué');
        const dateFilter = document.getElementById('expenses-date-filter');
        if (dateFilter) {
          dateFilter.focus();
          dateFilter.click();
          if (dateFilter.showPicker) {
            try {
              dateFilter.showPicker();
            } catch (e) {
              console.warn('showPicker non supporté:', e);
            }
          }
        }
      });
      console.log('✅ Bouton d\'aide configuré');
    } else {
      console.warn('⚠️ Champ de date des dépenses non trouvé');
    }

    // Bouton nouvelle dépense
    const addExpenseBtn = document.getElementById('add-expense-btn');
    if (addExpenseBtn) {
      addExpenseBtn.removeEventListener('click', this.showAddExpenseModal);
      addExpenseBtn.addEventListener('click', this.showAddExpenseModal.bind(this));
    }

    // Boutons d'édition des dépenses
    document.querySelectorAll('.expense-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const livreurId = e.currentTarget.dataset.livreurId;
        const selectedDate = document.getElementById('expenses-date-filter').value;
        this.editExpense(livreurId, selectedDate);
      });
    });

    // Boutons de suppression des dépenses
    document.querySelectorAll('.expense-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const expenseId = e.currentTarget.dataset.expenseId;
        this.deleteExpense(expenseId);
      });
    });
  }

  static handleDateChange() {
    console.log('📅 Date changée dans le menu des dépenses');
    
    // Afficher un indicateur de chargement
    const container = document.getElementById('expenses-summary');
    if (container) {
      container.innerHTML = '<div class="text-center"><p>Chargement des données...</p></div>';
    }
    
    // Recharger les données
    this.loadExpenses();
  }

  static handleDateClick() {
    console.log('🖱️ Clic sur le champ de date des dépenses');
    const dateFilter = document.getElementById('expenses-date-filter');
    if (dateFilter) {
      // Forcer l'ouverture du sélecteur de date
      dateFilter.showPicker && dateFilter.showPicker();
    }
  }

  static handleDateFocus() {
    console.log('🎯 Focus sur le champ de date des dépenses');
    const dateFilter = document.getElementById('expenses-date-filter');
    if (dateFilter) {
      dateFilter.style.borderColor = 'var(--primary-color)';
    }
  }

  static showAddExpenseModal() {
    // Cette fonction sera appelée pour ajouter une nouvelle dépense
    // Pour l'instant, on peut la laisser vide ou rediriger vers l'édition d'un livreur spécifique
    ToastManager.info('Sélectionnez un livreur dans le tableau pour ajouter/modifier ses dépenses');
  }

  static async editExpense(livreurId, date) {
    try {
      // Récupérer les informations du livreur
      const usersResponse = await ApiClient.getUsers();
      const livreur = usersResponse.users.find(u => u.id === livreurId);
      
      if (!livreur) {
        ToastManager.error('Livreur non trouvé');
        return;
      }

      // Récupérer les dépenses existantes pour ce livreur et cette date
      let existingExpense = null;
      try {
        const expenseResponse = await ApiClient.getExpenseByLivreurAndDate(livreurId, date);
        existingExpense = expenseResponse.expense;
      } catch (error) {
        // Pas de dépense existante, c'est normal
      }

      const content = `
        <form id="expense-form">
          <div class="form-group">
            <label>Livreur</label>
            <input type="text" value="${Utils.escapeHtml(livreur.username)}" readonly class="form-control">
            <input type="hidden" name="livreur_id" value="${livreurId}">
            <input type="hidden" name="expense_date" value="${date}">
          </div>
          
          <div class="form-group">
            <label>Date</label>
            <input type="date" value="${date}" readonly class="form-control">
          </div>
          
          <div class="form-group">
            <label for="carburant">Carburant (FCFA)</label>
            <input type="number" id="carburant" name="carburant" step="0.01" min="0" 
                   value="${existingExpense ? existingExpense.carburant : 0}" class="form-control">
          </div>
          
          <div class="form-group">
            <label for="reparations">Réparations (FCFA)</label>
            <input type="number" id="reparations" name="reparations" step="0.01" min="0" 
                   value="${existingExpense ? existingExpense.reparations : 0}" class="form-control">
          </div>
          
          <div class="form-group">
            <label for="police">Police (FCFA)</label>
            <input type="number" id="police" name="police" step="0.01" min="0" 
                   value="${existingExpense ? existingExpense.police : 0}" class="form-control">
          </div>
          
          <div class="form-group">
            <label for="autres">Autres (FCFA)</label>
            <input type="number" id="autres" name="autres" step="0.01" min="0" 
                   value="${existingExpense ? existingExpense.autres : 0}" class="form-control">
          </div>
          
          <div class="form-group">
            <label for="km_parcourus">Kilomètres parcourus</label>
            <input type="number" id="km_parcourus" name="km_parcourus" step="0.1" min="0" 
                   value="${existingExpense ? existingExpense.km_parcourus : 0}" class="form-control" 
                   placeholder="Nombre de kilomètres parcourus">
          </div>
          
          <div class="form-group">
            <label for="commentaire">Commentaire</label>
            <textarea id="commentaire" name="commentaire" rows="3" class="form-control" 
                      placeholder="Commentaire optionnel...">${existingExpense ? existingExpense.commentaire || '' : ''}</textarea>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">
              ${existingExpense ? 'Mettre à jour' : 'Enregistrer'}
            </button>
            <button type="button" class="btn btn-secondary modal-cancel-btn">Annuler</button>
          </div>
        </form>
      `;

      ModalManager.show(`Dépenses - ${livreur.username}`, content);

      // Gestionnaire pour le bouton d'annulation
      document.querySelector('.modal-cancel-btn').addEventListener('click', () => {
        ModalManager.hide();
      });

      document.getElementById('expense-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const expenseData = Object.fromEntries(formData.entries());

        try {
          await ApiClient.createOrUpdateExpense(expenseData);
          ModalManager.hide();
          ToastManager.success('Dépenses enregistrées avec succès');
          await this.loadExpenses();
        } catch (error) {
          ToastManager.error(error.message || 'Erreur lors de l\'enregistrement');
        }
      });

    } catch (error) {
      console.error('Erreur lors de l\'édition des dépenses:', error);
      ToastManager.error('Erreur lors de l\'édition des dépenses');
    }
  }

  static async deleteExpense(expenseId) {
    ModalManager.confirm(
      'Supprimer les dépenses',
      'Êtes-vous sûr de vouloir supprimer ces dépenses ? Cette action est irréversible.',
      async () => {
        try {
          await ApiClient.deleteExpense(expenseId);
          ToastManager.success('Dépenses supprimées avec succès');
          await this.loadExpenses();
        } catch (error) {
          ToastManager.error(error.message || 'Erreur lors de la suppression');
        }
      }
    );
  }

  static updatePageTitle(selectedDate) {
    const pageHeader = document.querySelector('#expenses-page .page-header h2');
    if (pageHeader) {
      const today = new Date().toISOString().split('T')[0];
      const formattedDate = Utils.formatDisplayDate(selectedDate);
      
      if (selectedDate === today) {
        pageHeader.textContent = 'Gestion des dépenses - Aujourd\'hui';
      } else {
        pageHeader.textContent = `Gestion des dépenses - ${formattedDate}`;
      }
    }
  }

  static ensureDateFieldIsClickable() {
    const dateFilter = document.getElementById('expenses-date-filter');
    if (dateFilter) {
      // Forcer les styles pour s'assurer que le champ est cliquable
      dateFilter.style.pointerEvents = 'auto';
      dateFilter.style.cursor = 'pointer';
      dateFilter.style.position = 'relative';
      dateFilter.style.zIndex = '10';
      dateFilter.style.backgroundColor = '#ffffff';
      dateFilter.style.border = '1px solid #d1d5db';
      
      // Ajouter un event listener de test
      dateFilter.addEventListener('mouseenter', function() {
        this.style.borderColor = '#2563eb';
        console.log('🖱️ Survol du champ de date détecté');
      });
      
      dateFilter.addEventListener('mouseleave', function() {
        this.style.borderColor = '#d1d5db';
      });
      
      console.log('✅ Champ de date configuré comme cliquable');
      console.log('📍 Position du champ:', dateFilter.getBoundingClientRect());
    } else {
      console.error('❌ Impossible de trouver le champ de date des dépenses');
    }
  }
}

// ===== GESTIONNAIRE DES UTILISATEURS =====
class UserManager {
  static async loadUsers() {
    try {
      const response = await ApiClient.getUsers();
      AppState.users = response.users || [];
      this.displayUsers();
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
      ToastManager.error('Erreur lors du chargement des utilisateurs');
    }
  }

  static displayUsers() {
    const container = document.getElementById('users-list');
    
    if (AppState.users.length === 0) {
      container.innerHTML = '<p class="text-center">Aucun utilisateur trouvé</p>';
      return;
    }

    container.innerHTML = AppState.users.map(user => `
      <div class="user-card">
        <div class="user-header">
          <div>
            <div class="user-title">${Utils.escapeHtml(user.username)}</div>
            <div class="user-meta">
              <span class="role-badge ${user.role}">${user.role}</span>
              • Créé le ${Utils.formatDate(user.created_at)}
            </div>
          </div>
          <div class="user-actions">
            ${this.canEditUser(user) ? `
              <button class="btn btn-sm btn-secondary edit-user-btn" data-user-id="${user.id}">
                <span class="icon">✏️</span>
                Modifier
              </button>
            ` : ''}
            ${this.canDeleteUser(user) ? `
              <button class="btn btn-sm btn-danger delete-user-btn" data-user-id="${user.id}">
                <span class="icon">🗑️</span>
                Supprimer
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `).join('');

    // Ajouter les event listeners après avoir créé le HTML
    this.setupUserEventListeners();
  }

  static setupUserEventListeners() {
    // Boutons édition
    document.querySelectorAll('.edit-user-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const userId = e.currentTarget.dataset.userId;
        this.editUser(userId);
      });
    });

    // Boutons suppression
    document.querySelectorAll('.delete-user-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const userId = e.currentTarget.dataset.userId;
        this.deleteUser(userId);
      });
    });
  }

  static canEditUser(user) {
    if (AppState.user.role === 'ADMIN') return true;
    if (AppState.user.role === 'MANAGER' && user.role !== 'ADMIN') return true;
    return false;
  }

  static canDeleteUser(user) {
    if (AppState.user.id === user.id) return false; // Ne peut pas se supprimer soi-même
    return AppState.user.role === 'ADMIN';
  }

  static async createUser() {
    const content = `
      <form id="create-user-form">
        <div class="form-group">
          <label for="create-username">Nom d'utilisateur *</label>
          <input type="text" id="create-username" name="username" required>
        </div>
        
        <div class="form-group">
          <label for="create-password">Mot de passe *</label>
          <input type="password" id="create-password" name="password" required>
        </div>
        
        <div class="form-group">
          <label for="create-role">Rôle *</label>
          <select id="create-role" name="role" required>
            <option value="">Sélectionner un rôle</option>
            <option value="LIVREUR">LIVREUR</option>
            <option value="MANAGER">MANAGER</option>
            ${AppState.user.role === 'ADMIN' ? '<option value="ADMIN">ADMIN</option>' : ''}
          </select>
        </div>
        
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Créer</button>
          <button type="button" class="btn btn-secondary modal-cancel-btn">Annuler</button>
        </div>
      </form>
    `;

    ModalManager.show('Nouvel utilisateur', content);

    // Gestionnaire pour le bouton d'annulation
    document.querySelector('.modal-cancel-btn').addEventListener('click', () => {
      ModalManager.hide();
    });

    document.getElementById('create-user-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(e.target);
      const userData = Object.fromEntries(formData.entries());

      try {
        await ApiClient.createUser(userData);
        ModalManager.hide();
        ToastManager.success('Utilisateur créé avec succès');
        await this.loadUsers();
      } catch (error) {
        ToastManager.error(error.message || 'Erreur lors de la création');
      }
    });
  }

  static async editUser(userId) {
    try {
      const user = AppState.users.find(u => u.id === userId);
      if (!user) {
        ToastManager.error('Utilisateur non trouvé');
        return;
      }

      const content = `
        <form id="edit-user-form">
          <div class="form-group">
            <label for="edit-username">Nom d'utilisateur *</label>
            <input type="text" id="edit-username" name="username" value="${Utils.escapeHtml(user.username)}" required>
          </div>
          
          <div class="form-group">
            <label for="edit-role">Rôle *</label>
            <select id="edit-role" name="role" required>
              <option value="LIVREUR" ${user.role === 'LIVREUR' ? 'selected' : ''}>LIVREUR</option>
              <option value="MANAGER" ${user.role === 'MANAGER' ? 'selected' : ''}>MANAGER</option>
              ${AppState.user.role === 'ADMIN' ? `<option value="ADMIN" ${user.role === 'ADMIN' ? 'selected' : ''}>ADMIN</option>` : ''}
            </select>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Sauvegarder</button>
            <button type="button" class="btn btn-secondary modal-cancel-btn">Annuler</button>
          </div>
        </form>
      `;

      ModalManager.show('Modifier l\'utilisateur', content);

      // Gestionnaire pour le bouton d'annulation
      document.querySelector('.modal-cancel-btn').addEventListener('click', () => {
        ModalManager.hide();
      });

      document.getElementById('edit-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const userData = Object.fromEntries(formData.entries());

        try {
          await ApiClient.updateUser(userId, userData);
          ModalManager.hide();
          ToastManager.success('Utilisateur modifié avec succès');
          await this.loadUsers();
        } catch (error) {
          ToastManager.error(error.message || 'Erreur lors de la modification');
        }
      });

    } catch (error) {
      console.error('Erreur lors de l\'édition de l\'utilisateur:', error);
      ToastManager.error('Erreur lors de l\'édition de l\'utilisateur');
    }
  }

  static async deleteUser(userId) {
    const user = AppState.users.find(u => u.id === userId);
    if (!user) return;

    ModalManager.confirm(
      'Supprimer l\'utilisateur',
      `Êtes-vous sûr de vouloir supprimer l'utilisateur "${user.username}" ? Cette action est irréversible.`,
      async () => {
        try {
          await ApiClient.deleteUser(userId);
          ToastManager.success('Utilisateur supprimé avec succès');
          await this.loadUsers();
        } catch (error) {
          ToastManager.error(error.message || 'Erreur lors de la suppression');
        }
      }
    );
  }
}

// ===== GESTIONNAIRE DE LIVREURS =====
class LivreurManager {
  static async loadLivreurs(showActiveOnly = false) {
    try {
      const response = showActiveOnly ? 
        await ApiClient.getActiveLivreurs() : 
        await ApiClient.getLivreurs();
      
      AppState.livreurs = response.livreurs || [];
      this.displayLivreurs();
      this.updateStats();
      
      // Forcer l'affichage des boutons d'action
      this.ensureActionButtonsVisible();
    } catch (error) {
      console.error('Erreur lors du chargement des livreurs:', error);
      ToastManager.error('Erreur lors du chargement des livreurs');
    }
  }

  static ensureActionButtonsVisible() {
    console.log('🎯 Vérification des boutons d\'action de la page livreurs...');
    
    // Vérifier si la page header existe
    const pageHeader = document.querySelector('#livreurs-page .page-header');
    if (!pageHeader) {
      console.error('❌ Page header de la page livreurs non trouvée');
      return;
    }
    
    // Vérifier si la section page-actions existe
    let pageActions = document.querySelector('#livreurs-page .page-actions');
    if (!pageActions) {
      console.log('🔧 Création de la section page-actions...');
      pageActions = document.createElement('div');
      pageActions.className = 'page-actions';
      pageHeader.appendChild(pageActions);
    }
    
    const actionButtons = [
      { id: 'add-livreur-btn', text: '➕ Nouveau livreur', class: 'btn btn-primary btn-sm' },
      { id: 'show-all-livreurs', text: '👁️ Voir tous', class: 'btn btn-secondary btn-sm' },
      { id: 'show-active-livreurs', text: '✅ Actifs seulement', class: 'btn btn-secondary btn-sm' }
    ];
    
    actionButtons.forEach(buttonConfig => {
      let button = document.getElementById(buttonConfig.id);
      
      if (!button) {
        console.log(`🔧 Création du bouton ${buttonConfig.id}...`);
        button = document.createElement('button');
        button.id = buttonConfig.id;
        button.className = buttonConfig.class;
        button.innerHTML = `<span class="icon">${buttonConfig.text.split(' ')[0]}</span> ${buttonConfig.text.substring(2)}`;
        pageActions.appendChild(button);
        
        // Ajouter l'event listener
        if (buttonConfig.id === 'add-livreur-btn') {
          button.addEventListener('click', () => this.createLivreur());
        } else if (buttonConfig.id === 'show-all-livreurs') {
          button.addEventListener('click', () => this.loadLivreurs(false));
        } else if (buttonConfig.id === 'show-active-livreurs') {
          button.addEventListener('click', () => this.loadLivreurs(true));
        }
      }
      
      // Forcer l'affichage
      button.classList.remove('hidden');
      button.style.display = 'inline-flex';
      button.style.visibility = 'visible';
      button.style.opacity = '1';
      button.removeAttribute('hidden');
      
      console.log(`✅ Bouton ${buttonConfig.id} rendu visible:`, {
        element: button,
        classList: button.className,
        style: button.style.cssText,
        isVisible: button.offsetWidth > 0 && button.offsetHeight > 0
      });
    });
  }

  static updateStats() {
    const totalLivreurs = AppState.livreurs.length;
    const activeLivreurs = AppState.livreurs.filter(l => l.is_active).length;
    const inactiveLivreurs = totalLivreurs - activeLivreurs;

    document.getElementById('total-livreurs').textContent = totalLivreurs;
    document.getElementById('active-livreurs-count').textContent = activeLivreurs;
    document.getElementById('inactive-livreurs-count').textContent = inactiveLivreurs;
  }

  static displayLivreurs() {
    const container = document.getElementById('livreurs-list');
    
    // FORCE ADD BUTTON AT THE TOP - IMPOSSIBLE TO MISS!
    const addButtonHtml = `
      <div style="background: linear-gradient(135deg, #2563eb, #3b82f6); padding: 20px; border-radius: 12px; margin-bottom: 20px; text-align: center; box-shadow: 0 8px 25px rgba(37, 99, 235, 0.3);">
        <button id="super-add-livreur-btn" style="
          background: #ffffff; 
          color: #2563eb; 
          border: none; 
          padding: 15px 30px; 
          font-size: 18px; 
          font-weight: bold; 
          border-radius: 8px; 
          cursor: pointer; 
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
          transition: all 0.3s ease;
        ">
          ➕ AJOUTER UN NOUVEAU LIVREUR
        </button>
        <p style="color: white; margin-top: 10px; font-size: 14px;">Cliquez ici pour créer un nouveau livreur</p>
      </div>
    `;
    
    if (AppState.livreurs.length === 0) {
      container.innerHTML = addButtonHtml + '<p class="text-center">Aucun livreur trouvé</p>';
      return;
    }

    container.innerHTML = addButtonHtml + AppState.livreurs.map(livreur => `
      <div class="livreur-card ${!livreur.is_active ? 'inactive' : ''}">
        <div class="livreur-header">
          <div>
            <div class="livreur-title">
              ${Utils.escapeHtml(livreur.username)}
              <span class="status-badge ${livreur.is_active ? 'active' : 'inactive'}">
                ${livreur.is_active ? '✅ Actif' : '❌ Inactif'}
              </span>
            </div>
            <div class="livreur-meta">
              <span class="role-badge ${livreur.role}">${livreur.role}</span>
              • Créé le ${Utils.formatDate(livreur.created_at)}
            </div>
          </div>
          <div class="livreur-actions">
            <button class="btn btn-sm ${livreur.is_active ? 'btn-warning' : 'btn-success'} toggle-livreur-btn" 
                    data-livreur-id="${livreur.id}">
              <span class="icon">${livreur.is_active ? '⏸️' : '▶️'}</span>
              ${livreur.is_active ? 'Désactiver' : 'Activer'}
            </button>
            ${this.canEditLivreur(livreur) ? `
              <button class="btn btn-sm btn-secondary edit-livreur-btn" data-livreur-id="${livreur.id}">
                <span class="icon">✏️</span>
                Modifier
              </button>
            ` : ''}
            ${this.canDeleteLivreur(livreur) ? `
              <button class="btn btn-sm btn-danger delete-livreur-btn" data-livreur-id="${livreur.id}">
                <span class="icon">🗑️</span>
                Supprimer
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `).join('');

    // Ajouter les event listeners après avoir créé le HTML
    this.setupLivreurEventListeners();
    
    // SUPER IMPORTANT: Add event listener for the BIG ADD BUTTON
    const superAddBtn = document.getElementById('super-add-livreur-btn');
    if (superAddBtn) {
      superAddBtn.addEventListener('click', () => {
        console.log('🎯 SUPER ADD BUTTON CLICKED!');
        this.createLivreur();
      });
      
      // Add hover effects without inline handlers (CSP compliant)
      superAddBtn.addEventListener('mouseenter', () => {
        superAddBtn.style.transform = 'scale(1.05)';
      });
      
      superAddBtn.addEventListener('mouseleave', () => {
        superAddBtn.style.transform = 'scale(1)';
      });
      
      console.log('✅ SUPER ADD BUTTON EVENT LISTENERS ADDED!');
    }
  }

  static setupLivreurEventListeners() {
    // Boutons toggle statut
    document.querySelectorAll('.toggle-livreur-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const livreurId = e.currentTarget.dataset.livreurId;
        this.toggleLivreurStatus(livreurId);
      });
    });

    // Boutons édition
    document.querySelectorAll('.edit-livreur-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const livreurId = e.currentTarget.dataset.livreurId;
        this.editLivreur(livreurId);
      });
    });

    // Boutons suppression
    document.querySelectorAll('.delete-livreur-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const livreurId = e.currentTarget.dataset.livreurId;
        this.deleteLivreur(livreurId);
      });
    });
  }

  static canEditLivreur(livreur) {
    if (AppState.user.role === 'ADMIN') return true;
    if (AppState.user.role === 'MANAGER' && livreur.role !== 'ADMIN') return true;
    return false;
  }

  static canDeleteLivreur(livreur) {
    if (AppState.user.id === livreur.id) return false; // Ne peut pas se supprimer soi-même
    return AppState.user.role === 'ADMIN';
  }

  static async toggleLivreurStatus(livreurId) {
    try {
      const livreur = AppState.livreurs.find(l => l.id === livreurId);
      if (!livreur) {
        ToastManager.error('Livreur non trouvé');
        return;
      }

      const action = livreur.is_active ? 'désactiver' : 'activer';
      
      ModalManager.confirm(
        `${action.charAt(0).toUpperCase() + action.slice(1)} le livreur`,
        `Êtes-vous sûr de vouloir ${action} le livreur "${livreur.username}" ?`,
        async () => {
          try {
            await ApiClient.toggleUserActive(livreurId);
            ToastManager.success(`Livreur ${action === 'activer' ? 'activé' : 'désactivé'} avec succès`);
            await this.loadLivreurs();
          } catch (error) {
            ToastManager.error(error.message || `Erreur lors de la modification du statut`);
          }
        }
      );
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error);
      ToastManager.error('Erreur lors du changement de statut');
    }
  }

  static async createLivreur() {
    const content = `
      <form id="create-livreur-form">
        <div class="form-group">
          <label for="create-livreur-username">Nom d'utilisateur *</label>
          <input type="text" id="create-livreur-username" name="username" required>
        </div>
        
        <div class="form-group">
          <label for="create-livreur-password">Mot de passe *</label>
          <input type="password" id="create-livreur-password" name="password" required>
          <small style="color: #6b7280; font-size: 0.8rem; margin-top: 4px; display: block;">
            Le mot de passe doit contenir au moins 8 caractères avec:<br>
            • Une majuscule (A-Z)<br>
            • Une minuscule (a-z)<br>
            • Un chiffre (0-9)<br>
            • Un caractère spécial (@$!%*?&)
          </small>
        </div>
        
        <div class="form-group">
          <label for="create-livreur-active">Statut</label>
          <select id="create-livreur-active" name="is_active">
            <option value="true">Actif</option>
            <option value="false">Inactif</option>
          </select>
        </div>
        
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Créer le livreur</button>
          <button type="button" class="btn btn-secondary modal-cancel-btn">Annuler</button>
        </div>
      </form>
    `;

    ModalManager.show('Nouveau livreur', content);

    // Gestionnaire pour le bouton d'annulation
    document.querySelector('.modal-cancel-btn').addEventListener('click', () => {
      ModalManager.hide();
    });

    document.getElementById('create-livreur-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(e.target);
      const userData = Object.fromEntries(formData.entries());
      
      // Forcer le rôle à LIVREUR
      userData.role = 'LIVREUR';
      userData.is_active = userData.is_active === 'true';

      try {
        await ApiClient.createUser(userData);
        ModalManager.hide();
        ToastManager.success('Livreur créé avec succès');
        await this.loadLivreurs();
      } catch (error) {
        console.error('Erreur création livreur:', error);
        
        // Show specific validation errors if available
        if (error.message.includes('Données invalides')) {
          ToastManager.error('Erreur de validation: Vérifiez que le mot de passe respecte tous les critères requis');
        } else {
          ToastManager.error(error.message || 'Erreur lors de la création');
        }
      }
    });
  }

  static async editLivreur(livreurId) {
    try {
      const livreur = AppState.livreurs.find(l => l.id === livreurId);
      if (!livreur) {
        ToastManager.error('Livreur non trouvé');
        return;
      }

      const content = `
        <form id="edit-livreur-form">
          <div class="form-group">
            <label for="edit-livreur-username">Nom d'utilisateur *</label>
            <input type="text" id="edit-livreur-username" name="username" value="${Utils.escapeHtml(livreur.username)}" required>
          </div>
          
          <div class="form-group">
            <label for="edit-livreur-active">Statut</label>
            <select id="edit-livreur-active" name="is_active">
              <option value="true" ${livreur.is_active ? 'selected' : ''}>Actif</option>
              <option value="false" ${!livreur.is_active ? 'selected' : ''}>Inactif</option>
            </select>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Sauvegarder</button>
            <button type="button" class="btn btn-secondary modal-cancel-btn">Annuler</button>
          </div>
        </form>
      `;

      ModalManager.show('Modifier le livreur', content);

      // Gestionnaire pour le bouton d'annulation
      document.querySelector('.modal-cancel-btn').addEventListener('click', () => {
        ModalManager.hide();
      });

      document.getElementById('edit-livreur-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const userData = Object.fromEntries(formData.entries());
        userData.is_active = userData.is_active === 'true';

        try {
          await ApiClient.updateUser(livreurId, userData);
          ModalManager.hide();
          ToastManager.success('Livreur modifié avec succès');
          await this.loadLivreurs();
        } catch (error) {
          ToastManager.error(error.message || 'Erreur lors de la modification');
        }
      });

    } catch (error) {
      console.error('Erreur lors de l\'édition du livreur:', error);
      ToastManager.error('Erreur lors de l\'édition du livreur');
    }
  }

  static async deleteLivreur(livreurId) {
    const livreur = AppState.livreurs.find(l => l.id === livreurId);
    if (!livreur) return;

    ModalManager.confirm(
      'Supprimer le livreur',
      `Êtes-vous sûr de vouloir supprimer le livreur "${livreur.username}" ? Cette action est irréversible.`,
      async () => {
        try {
          await ApiClient.deleteUser(livreurId);
          ToastManager.success('Livreur supprimé avec succès');
          await this.loadLivreurs();
        } catch (error) {
          ToastManager.error(error.message || 'Erreur lors de la suppression');
        }
      }
    );
  }
}

// ===== GESTIONNAIRE D'ABONNEMENTS =====
class SubscriptionManager {
  static subscriptions = [];
  static stats = {};
  static searchTimeout = null;

  static async loadSubscriptions() {
    try {
      const [subscriptionsResponse, statsResponse] = await Promise.all([
        ApiClient.getSubscriptions(),
        ApiClient.getSubscriptionStats()
      ]);

      this.subscriptions = subscriptionsResponse.subscriptions || [];
      this.stats = statsResponse.stats || {};

      this.updateStats();
      this.displaySubscriptions();
      this.setupEventListeners();
    } catch (error) {
      console.error('Erreur lors du chargement des abonnements:', error);
      ToastManager.error('Erreur lors du chargement des abonnements');
    }
  }

  static updateStats() {
    const elements = {
      'total-subscriptions': this.stats.total_cards || 0,
      'active-subscriptions': this.stats.active_cards || 0,
      'completed-subscriptions': this.stats.completed_cards || 0,
      'expiring-subscriptions': this.stats.expiring_soon || 0
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    });
  }

  static displaySubscriptions() {
    const container = document.getElementById('subscriptions-list');
    
    if (this.subscriptions.length === 0) {
      container.innerHTML = '<p class="text-center">Aucune carte d\'abonnement trouvée</p>';
      return;
    }

    container.innerHTML = this.subscriptions.map(subscription => {
      const progressPercentage = (subscription.used_deliveries / subscription.total_deliveries) * 100;
      const progressClass = progressPercentage >= 80 ? 'low' : progressPercentage >= 50 ? 'medium' : 'high';
      const statusClass = this.getStatusClass(subscription);
      const statusText = this.getStatusText(subscription);

      return `
        <div class="subscription-card ${statusClass}">
          <div class="subscription-header">
            <div>
              <div class="subscription-title">${Utils.escapeHtml(subscription.client_name)}</div>
              <div class="subscription-card-number">${subscription.card_number}</div>
              <div class="subscription-meta">
                <span>📞 ${Utils.escapeHtml(subscription.phone_number)}</span>
                <span class="subscription-status ${statusClass}">${statusText}</span>
              </div>
            </div>
            <div class="subscription-actions">
              ${this.canEditSubscription(subscription) ? `
                <button class="btn btn-sm btn-secondary edit-subscription-btn" 
                        data-subscription-id="${subscription.id}"
                        title="Modifier">
                  <span class="icon">✏️</span>
                </button>
              ` : ''}
              ${subscription.is_active ? `
                <button class="btn btn-sm btn-warning deactivate-subscription-btn" 
                        data-subscription-id="${subscription.id}"
                        title="Désactiver">
                  <span class="icon">⏸️</span>
                </button>
              ` : `
                <button class="btn btn-sm btn-success reactivate-subscription-btn" 
                        data-subscription-id="${subscription.id}"
                        title="Réactiver">
                  <span class="icon">▶️</span>
                </button>
              `}
              <button class="btn btn-sm btn-primary check-card-btn" 
                      data-card-number="${subscription.card_number}"
                      title="Vérifier la carte">
                <span class="icon">🔍</span>
              </button>
            </div>
          </div>
          <div class="subscription-details">
            <div class="subscription-detail">
              <span class="label">Livraisons</span>
              <div class="deliveries-progress">
                <div class="progress-bar">
                  <div class="progress-fill ${progressClass}" style="width: ${progressPercentage}%"></div>
                </div>
                <span class="progress-text">${subscription.used_deliveries}/${subscription.total_deliveries}</span>
              </div>
            </div>
            <div class="subscription-detail">
              <span class="label">Restantes</span>
              <span class="value">${subscription.remaining_deliveries}</span>
            </div>
            <div class="subscription-detail">
              <span class="label">Prix de la carte</span>
              <span class="value">${subscription.price ? Utils.formatAmount(subscription.price) : '-'}</span>
            </div>
            <div class="subscription-detail">
              <span class="label">Adresse</span>
              <span class="value">${subscription.address ? Utils.escapeHtml(subscription.address) : '-'}</span>
            </div>
            <div class="subscription-detail">
              <span class="label">Achat</span>
              <span class="value">${Utils.formatDisplayDate(subscription.purchase_date)}</span>
            </div>
            <div class="subscription-detail">
              <span class="label">Expiration</span>
              <span class="value">${Utils.formatDisplayDate(subscription.expiry_date)}</span>
            </div>
            <div class="subscription-detail">
              <span class="label">Créé par</span>
              <span class="value">${Utils.escapeHtml(subscription.created_by || 'N/A')}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.setupSubscriptionEventListeners();
  }

  static getStatusClass(subscription) {
    if (!subscription.is_active) return 'inactive';
    if (subscription.remaining_deliveries === 0) return 'completed';
    if (new Date(subscription.expiry_date) < new Date()) return 'expired';
    return 'active';
  }

  static getStatusText(subscription) {
    if (!subscription.is_active) return 'Inactive';
    if (subscription.remaining_deliveries === 0) return 'Terminée';
    if (new Date(subscription.expiry_date) < new Date()) return 'Expirée';
    return 'Active';
  }

  static canEditSubscription(subscription) {
    return AppState.user && (AppState.user.role === 'MANAGER' || AppState.user.role === 'ADMIN');
  }

  static setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('subscription-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
          this.handleSearch(e.target.value);
        }, 300);
      });
    }

    // Add subscription button
    const addBtn = document.getElementById('add-subscription-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showCreateSubscriptionModal());
    }

    // Add subscription main button (bloc bleu)
    const addBtnMain = document.getElementById('add-subscription-btn-main');
    if (addBtnMain) {
      addBtnMain.addEventListener('click', () => this.showCreateSubscriptionModal());
    }

    // Refresh button
    const refreshBtn = document.getElementById('refresh-subscriptions');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadSubscriptions());
    }
  }

  static setupSubscriptionEventListeners() {
    // Edit subscription buttons
    document.querySelectorAll('.edit-subscription-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const subscriptionId = e.currentTarget.dataset.subscriptionId;
        this.editSubscription(subscriptionId);
      });
    });

    // Deactivate subscription buttons
    document.querySelectorAll('.deactivate-subscription-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const subscriptionId = e.currentTarget.dataset.subscriptionId;
        this.deactivateSubscription(subscriptionId);
      });
    });

    // Reactivate subscription buttons
    document.querySelectorAll('.reactivate-subscription-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const subscriptionId = e.currentTarget.dataset.subscriptionId;
        this.reactivateSubscription(subscriptionId);
      });
    });

    // Check card buttons
    document.querySelectorAll('.check-card-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cardNumber = e.currentTarget.dataset.cardNumber;
        this.checkCardValidity(cardNumber);
      });
    });
  }

  static async handleSearch(query) {
    if (!query.trim()) {
      await this.loadSubscriptions();
      return;
    }

    try {
      const response = await ApiClient.searchSubscriptions(query);
      this.subscriptions = response.subscriptions || [];
      this.displaySubscriptions();
    } catch (error) {
      console.error('Erreur lors de la recherche:', error);
      ToastManager.error('Erreur lors de la recherche');
    }
  }

  static showCreateSubscriptionModal() {
    const content = `
      <form id="create-subscription-form" class="subscription-form">
        <div class="form-group">
          <label for="subscription-client-name">Nom du client *</label>
          <input type="text" id="subscription-client-name" name="client_name" required>
        </div>
        <div class="form-group">
          <label for="subscription-phone-number">Numéro de téléphone *</label>
          <input type="tel" id="subscription-phone-number" name="phone_number" required 
                 placeholder="Ex: 773920000">
        </div>
        <div class="form-group">
          <label for="subscription-address">Adresse</label>
          <textarea id="subscription-address" name="address" rows="2" placeholder="Adresse du client (optionnel)"></textarea>
        </div>
        <div class="form-group">
          <label for="subscription-total-deliveries">Nombre de livraisons</label>
          <input type="number" id="subscription-total-deliveries" name="total_deliveries" 
                 value="10" min="1" max="50" required>
        </div>
        <div class="form-group">
          <label for="subscription-expiry-months">Durée de validité (mois)</label>
          <input type="number" id="subscription-expiry-months" name="expiry_months" 
                 value="6" min="1" max="24" required>
        </div>
        <div class="form-group">
          <label for="subscription-price">Prix de la carte (FCFA)</label>
          <input type="number" id="subscription-price" name="price" min="0" step="0.01" placeholder="Ex: 15000" required>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">
            <span class="icon">🎫</span>
            Créer la carte
          </button>
          <button type="button" class="btn btn-secondary" onclick="ModalManager.hide()">
            Annuler
          </button>
        </div>
      </form>
    `;

    ModalManager.show('Nouvelle carte d\'abonnement MLC', content);

    document.getElementById('create-subscription-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.createSubscription(new FormData(e.target));
    });
  }

  static async createSubscription(formData) {
    try {
      const subscriptionData = {
        client_name: formData.get('client_name'),
        phone_number: formData.get('phone_number'),
        total_deliveries: parseInt(formData.get('total_deliveries')),
        expiry_months: parseInt(formData.get('expiry_months')),
        address: formData.get('address'),
        price: formData.get('price') ? parseFloat(formData.get('price')) : null
      };

      const response = await ApiClient.createSubscription(subscriptionData);
      
      if (response.success) {
        ToastManager.success(`Carte créée avec succès: ${response.subscription.card_number}`);
        ModalManager.hide();
        await this.loadSubscriptions();
      } else {
        ToastManager.error(response.message || 'Erreur lors de la création');
      }
    } catch (error) {
      console.error('Erreur lors de la création:', error);
      ToastManager.error('Erreur lors de la création de la carte');
    }
  }

  static async editSubscription(subscriptionId) {
    try {
      const subscription = this.subscriptions.find(s => s.id === subscriptionId);
      if (!subscription) return;
      const isAdmin = AppState.user && AppState.user.role === 'ADMIN';
      const content = `
        <form id="edit-subscription-form" class="subscription-form">
          <div class="form-group">
            <label for="edit-subscription-client-name">Nom du client *</label>
            <input type="text" id="edit-subscription-client-name" name="client_name" 
                   value="${Utils.escapeHtml(subscription.client_name)}" required>
          </div>
          <div class="form-group">
            <label for="edit-subscription-phone-number">Numéro de téléphone *</label>
            <input type="tel" id="edit-subscription-phone-number" name="phone_number" 
                   value="${Utils.escapeHtml(subscription.phone_number)}" required>
          </div>
          <div class="form-group">
            <label for="edit-subscription-address">Adresse</label>
            <textarea id="edit-subscription-address" name="address" rows="2" placeholder="Adresse du client (optionnel)">${subscription.address ? Utils.escapeHtml(subscription.address) : ''}</textarea>
          </div>
          <div class="form-group">
            <label>Numéro de carte</label>
            <input type="text" value="${subscription.card_number}" disabled class="subscription-card-number" style="${subscription.modified_by ? 'font-style:italic;' : ''}">
          </div>
          <div class="form-group">
            <label>Nombre de livraisons</label>
            <input type="number" name="total_deliveries" value="${subscription.total_deliveries}" ${isAdmin ? '' : 'disabled'}>
          </div>
          <div class="form-group">
            <label>Livraisons utilisées</label>
            <input type="number" name="used_deliveries" value="${subscription.used_deliveries}" ${isAdmin ? '' : 'disabled'} min="0" max="50">
          </div>
          <div class="form-group">
            <label>Livraisons restantes</label>
            <input type="number" name="remaining_deliveries" value="${subscription.remaining_deliveries}" ${isAdmin ? '' : 'disabled'} min="0" max="50">
          </div>
          <div class="form-group">
            <label for="edit-subscription-price">Prix de la carte (FCFA)</label>
            <input type="number" id="edit-subscription-price" name="price" min="0" step="0.01" value="${subscription.price ? subscription.price : ''}" required>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">
              <span class="icon">💾</span>
              Sauvegarder
            </button>
            <button type="button" class="btn btn-secondary" onclick="ModalManager.hide()">
              Annuler
            </button>
          </div>
        </form>
      `;
      ModalManager.show('Modifier la carte d\'abonnement', content);
      document.getElementById('edit-subscription-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.updateSubscription(subscriptionId, new FormData(e.target));
      });
    } catch (error) {
      console.error('Erreur lors de l\'édition:', error);
      ToastManager.error('Erreur lors de l\'édition');
    }
  }

  static async updateSubscription(subscriptionId, formData) {
    try {
      const total_deliveries = formData.get('total_deliveries') !== null ? parseInt(formData.get('total_deliveries')) : null;
      const used_deliveries = formData.get('used_deliveries') !== null ? parseInt(formData.get('used_deliveries')) : null;
      const remaining_deliveries = formData.get('remaining_deliveries') !== null ? parseInt(formData.get('remaining_deliveries')) : null;
      // Validation: total_deliveries = used_deliveries + remaining_deliveries
      if (
        total_deliveries !== null &&
        used_deliveries !== null &&
        remaining_deliveries !== null &&
        (total_deliveries !== used_deliveries + remaining_deliveries)
      ) {
        ToastManager.error('Le nombre de livraisons doit être égal à la somme des livraisons utilisées et restantes.');
        return;
      }
      const subscriptionData = {
        client_name: formData.get('client_name'),
        phone_number: formData.get('phone_number'),
        address: formData.get('address'),
        price: formData.get('price') ? parseFloat(formData.get('price')) : null
      };
      if (AppState.user && AppState.user.role === 'ADMIN') {
        subscriptionData.used_deliveries = used_deliveries;
        subscriptionData.remaining_deliveries = remaining_deliveries;
        subscriptionData.total_deliveries = total_deliveries;
      }
      const response = await ApiClient.updateSubscription(subscriptionId, subscriptionData);
      if (response.success) {
        ToastManager.success('Carte mise à jour avec succès');
        ModalManager.hide();
        await this.loadSubscriptions();
      } else {
        ToastManager.error(response.message || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      ToastManager.error('Erreur lors de la mise à jour');
    }
  }

  static async deactivateSubscription(subscriptionId) {
    const subscription = this.subscriptions.find(s => s.id === subscriptionId);
    if (!subscription) return;

    ModalManager.confirm(
      'Désactiver la carte',
      `Êtes-vous sûr de vouloir désactiver la carte ${subscription.card_number} de ${subscription.client_name} ?`,
      async () => {
        try {
          const response = await ApiClient.deactivateSubscription(subscriptionId);
          if (response.success) {
            ToastManager.success('Carte désactivée avec succès');
            await this.loadSubscriptions();
          } else {
            ToastManager.error(response.message || 'Erreur lors de la désactivation');
          }
        } catch (error) {
          console.error('Erreur lors de la désactivation:', error);
          ToastManager.error('Erreur lors de la désactivation');
        }
      }
    );
  }

  static async reactivateSubscription(subscriptionId) {
    try {
      const response = await ApiClient.reactivateSubscription(subscriptionId);
      if (response.success) {
        ToastManager.success('Carte réactivée avec succès');
        await this.loadSubscriptions();
      } else {
        ToastManager.error(response.message || 'Erreur lors de la réactivation');
      }
    } catch (error) {
      console.error('Erreur lors de la réactivation:', error);
      ToastManager.error('Erreur lors de la réactivation');
    }
  }

  static async checkCardValidity(cardNumber) {
    try {
      const response = await ApiClient.checkCardValidity(cardNumber);
      
      const statusIcon = response.valid ? '✅' : '❌';
      const statusText = response.valid ? 'Valide' : 'Invalide';
      
      let details = `<p><strong>Statut:</strong> ${statusIcon} ${statusText}</p>`;
      
      if (response.subscription) {
        const sub = response.subscription;
        details += `
          <p><strong>Client:</strong> ${Utils.escapeHtml(sub.client_name)}</p>
          <p><strong>Téléphone:</strong> ${Utils.escapeHtml(sub.phone_number)}</p>
          <p><strong>Livraisons restantes:</strong> ${sub.remaining_deliveries}/${sub.total_deliveries}</p>
          <p><strong>Expiration:</strong> ${Utils.formatDisplayDate(sub.expiry_date)}</p>
        `;
      }
      
      ModalManager.show(`Vérification de la carte ${cardNumber}`, details);
      
      if (response.valid) {
        ToastManager.success('Carte valide');
      } else {
        ToastManager.warning('Carte invalide ou expirée');
      }
    } catch (error) {
      console.error('Erreur lors de la vérification:', error);
      ToastManager.error('Erreur lors de la vérification');
    }
  }
}

// ===== GESTIONNAIRE DE PROFIL =====
class ProfileManager {
  static async loadProfile() {
    try {
      const response = await ApiClient.getProfile();
      const user = response.user;

      document.getElementById('profile-username').textContent = user.username;
      const roleElement = document.getElementById('profile-role');
      roleElement.textContent = user.role;
      roleElement.className = `role-badge ${user.role}`;
      document.getElementById('profile-created').textContent = Utils.formatDate(user.created_at);

    } catch (error) {
      console.error('Erreur lors du chargement du profil:', error);
      ToastManager.error('Erreur lors du chargement du profil');
    }
  }

  static showChangePasswordModal() {
    const content = `
      <form id="change-password-form">
        <div class="form-group">
          <label for="current-password">Mot de passe actuel *</label>
          <div class="password-input">
            <input type="password" id="current-password" name="currentPassword" required>
            <button type="button" class="password-toggle" data-target="current-password">
              <span class="icon">👁️</span>
            </button>
          </div>
        </div>
        
        <div class="form-group">
          <label for="new-password">Nouveau mot de passe *</label>
          <div class="password-input">
            <input type="password" id="new-password" name="newPassword" required>
            <button type="button" class="password-toggle" data-target="new-password">
              <span class="icon">👁️</span>
            </button>
          </div>
          <small>Le mot de passe doit contenir au moins 8 caractères avec une majuscule, une minuscule, un chiffre et un caractère spécial.</small>
        </div>
        
        <div class="form-group">
          <label for="confirm-password">Confirmer le nouveau mot de passe *</label>
          <div class="password-input">
            <input type="password" id="confirm-password" name="confirmPassword" required>
            <button type="button" class="password-toggle" data-target="confirm-password">
              <span class="icon">👁️</span>
            </button>
          </div>
        </div>
        
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Changer le mot de passe</button>
          <button type="button" class="btn btn-secondary modal-cancel-btn">Annuler</button>
        </div>
      </form>
    `;

    ModalManager.show('Changer le mot de passe', content);

    // Gestionnaire pour le bouton d'annulation
    document.querySelector('.modal-cancel-btn').addEventListener('click', () => {
      ModalManager.hide();
    });

    // Ajouter les event listeners pour les toggles de mot de passe
    document.querySelectorAll('.password-toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        const targetId = e.currentTarget.dataset.target;
        const input = document.getElementById(targetId);
        const icon = e.currentTarget.querySelector('.icon');
        
        if (input.type === 'password') {
          input.type = 'text';
          icon.textContent = '🙈';
        } else {
          input.type = 'password';
          icon.textContent = '👁️';
        }
      });
    });

    document.getElementById('change-password-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData.entries());

      // Validation côté client
      if (data.newPassword !== data.confirmPassword) {
        ToastManager.error('Les mots de passe ne correspondent pas');
        return;
      }

      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
      if (!passwordRegex.test(data.newPassword) || data.newPassword.length < 8) {
        ToastManager.error('Le mot de passe ne respecte pas les critères de sécurité');
        return;
      }

      try {
        await ApiClient.changePassword(data.currentPassword, data.newPassword, data.confirmPassword);
        ModalManager.hide();
        ToastManager.success('Mot de passe modifié avec succès');
      } catch (error) {
        ToastManager.error(error.message || 'Erreur lors du changement de mot de passe');
      }
    });
  }
}

// ===== GESTIONNAIRE D'ANALYTICS =====
class AnalyticsManager {
  static async loadAnalytics() {
    try {
      await this.loadLivreursForFilters();
      this.initializeDateFilters();
      await this.loadAnalyticsData();
      this.setupEventListeners();
    } catch (error) {
      console.error('Erreur chargement analytics:', error);
      ToastManager.error('Erreur lors du chargement des analytics');
    }
  }

  static initializeDateFilters() {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const startDateInput = document.getElementById('analytics-date-start');
    const endDateInput = document.getElementById('analytics-date-end');
    
    if (startDateInput) startDateInput.value = Utils.formatDate(firstDayOfMonth);
    if (endDateInput) endDateInput.value = Utils.formatDate(today);
  }

  static async loadLivreursForFilters() {
    try {
      const livreurs = await ApiClient.getLivreurs();
      const select = document.getElementById('analytics-livreur-filter');
      
      if (select && livreurs) {
        select.innerHTML = '<option value="">Tous les livreurs</option>';
        livreurs.forEach(livreur => {
          if (livreur.active) {
            select.innerHTML += `<option value="${livreur.id}">${Utils.escapeHtml(livreur.username)}</option>`;
          }
        });
      }
    } catch (error) {
      console.error('Erreur chargement livreurs:', error);
    }
  }

  static async loadAnalyticsData() {
    try {
      const filters = this.getFilters();
      
      // Charger les données en parallèle
      const [globalStats, typeStats, rankings, details] = await Promise.all([
        ApiClient.getAnalyticsGlobal(filters),
        ApiClient.getAnalyticsByType(filters),
        ApiClient.getAnalyticsRanking(filters),
        ApiClient.getAnalyticsLivreurDetails(filters)
      ]);
      
      this.updateGlobalStats(globalStats);
      this.updateTypeAnalysis(typeStats);
      this.updateRankings(rankings);
      this.updateLivreurDetails(details);
      
    } catch (error) {
      console.error('Erreur chargement données:', error);
      ToastManager.error('Erreur lors du chargement des données');
    }
  }

  static getFilters() {
    return {
      startDate: document.getElementById('analytics-date-start')?.value,
      endDate: document.getElementById('analytics-date-end')?.value,
      livreurId: document.getElementById('analytics-livreur-filter')?.value,
      orderType: document.getElementById('analytics-type-filter')?.value
    };
  }

  static updateGlobalStats(stats) {
    if (!stats) return;
    
    document.getElementById('analytics-total-orders')?.textContent = stats.totalOrders;
    document.getElementById('analytics-total-revenue')?.textContent = Utils.formatAmount(stats.totalRevenue);
    document.getElementById('analytics-total-expenses')?.textContent = Utils.formatAmount(stats.totalExpenses);
    document.getElementById('analytics-total-km')?.textContent = `${stats.totalKm} km`;
    document.getElementById('analytics-total-profit')?.textContent = Utils.formatAmount(stats.totalProfit);
    document.getElementById('analytics-fuel-expenses')?.textContent = Utils.formatAmount(stats.fuelExpenses);
  }

  static updateTypeAnalysis(typeStats) {
    if (!typeStats?.length) return;
    
    const container = document.getElementById('type-analysis-container');
    if (!container) return;
    
    container.innerHTML = typeStats.map(stat => `
      <div class="stat-card">
        <div class="stat-icon">${this.getTypeIcon(stat.type)}</div>
        <div class="stat-content">
          <h4>${this.getTypeName(stat.type)}</h4>
          <p>${stat.count} courses</p>
          <p>${Utils.formatAmount(stat.revenue)}</p>
        </div>
      </div>
    `).join('');
  }

  static updateRankings(rankings) {
    if (!rankings) return;
    
    this.updateRankingList('global-ranking', rankings.global, 'global');
    this.updateRankingList('orders-ranking', rankings.orders, 'orders');
    this.updateRankingList('revenue-ranking', rankings.revenue, 'revenue');
  }

  static updateRankingList(containerId, data, type) {
    const container = document.getElementById(containerId);
    if (!container || !data) return;
    
    container.innerHTML = '';
    
    if (data.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #666;">Aucune donnée disponible</p>';
      return;
    }
    
    data.forEach((item, index) => {
      const rank = index + 1;
      const medal = rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `${rank}.`;
      
      const rankItem = document.createElement('div');
      rankItem.className = 'ranking-item';
      rankItem.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem;
        margin-bottom: 0.5rem;
        background: ${rank <= 3 ? '#f8f9fa' : 'white'};
        border: 1px solid #e0e0e0;
        border-radius: 4px;
      `;
      
      let value = '';
      switch (type) {
        case 'orders':
          value = `${item.totalorders} courses`;
          break;
        case 'revenue':
          value = Utils.formatAmount(item.totalrevenue);
          break;
        case 'km':
          value = `${item.totalkm || 0} km`;
          break;
        default: // global
          value = `Score: ${Math.round(item.globalscore || 0)}`;
      }
      
      rankItem.innerHTML = `
        <span style="font-weight: bold;">${medal} ${Utils.escapeHtml(item.username)}</span>
        <span style="color: #666;">${value}</span>
      `;
      
      container.appendChild(rankItem);
    });
  }

  static updateLivreurDetails(details) {
    const container = document.getElementById('livreur-details-container');
    if (!container || !details?.length) return;
    
    container.innerHTML = '';
    
    const table = document.createElement('table');
    table.className = 'data-table';
    table.style.cssText = 'width: 100%; border-collapse: collapse; margin-top: 1rem;';
    
    table.innerHTML = `
      <thead>
        <tr style="background: #f8f9fa;">
          <th style="padding: 0.75rem; border: 1px solid #dee2e6; text-align: left;">Livreur</th>
          <th style="padding: 0.75rem; border: 1px solid #dee2e6; text-align: right;">Courses</th>
          <th style="padding: 0.75rem; border: 1px solid #dee2e6; text-align: right;">Revenus</th>
          <th style="padding: 0.75rem; border: 1px solid #dee2e6; text-align: right;">Dépenses</th>
          <th style="padding: 0.75rem; border: 1px solid #dee2e6; text-align: right;">Bénéfice net</th>
          <th style="padding: 0.75rem; border: 1px solid #dee2e6; text-align: right;">Kilomètres</th>
        </tr>
      </thead>
      <tbody>
        ${details.map(livreur => `
          <tr>
            <td style="padding: 0.75rem; border: 1px solid #dee2e6; font-weight: bold;">${Utils.escapeHtml(livreur.username)}</td>
            <td style="padding: 0.75rem; border: 1px solid #dee2e6; text-align: right;">${livreur.totalorders || 0}</td>
            <td style="padding: 0.75rem; border: 1px solid #dee2e6; text-align: right;">${Utils.formatAmount(livreur.totalrevenue)}</td>
            <td style="padding: 0.75rem; border: 1px solid #dee2e6; text-align: right;">${Utils.formatAmount(livreur.totalExpenses)}</td>
            <td style="padding: 0.75rem; border: 1px solid #dee2e6; text-align: right; color: ${livreur.netProfit >= 0 ? 'green' : 'red'};">${Utils.formatAmount(livreur.netProfit)}</td>
            <td style="padding: 0.75rem; border: 1px solid #dee2e6; text-align: right;">${livreur.totalKm || 0} km</td>
          </tr>
        `).join('')}
      </tbody>
    `;
    
    container.appendChild(table);
  }

  static async compareDeliverers() {
    try {
      const livreur1 = document.getElementById('compare-livreur1')?.value;
      const livreur2 = document.getElementById('compare-livreur2')?.value;
      
      if (!livreur1 || !livreur2) {
        ToastManager.warning('Veuillez sélectionner deux livreurs à comparer');
        return;
      }
      
      if (livreur1 === livreur2) {
        ToastManager.warning('Veuillez sélectionner deux livreurs différents');
        return;
      }
      
      const filters = this.getFilters();
      const comparison = await ApiClient.getAnalyticsComparison({
        ...filters,
        livreur1,
        livreur2
      });
      
      this.displayComparison(comparison);
      
    } catch (error) {
      console.error('Erreur comparaison:', error);
      ToastManager.error('Erreur lors de la comparaison');
    }
  }

  static displayComparison(comparison) {
    const container = document.getElementById('comparison-results');
    if (!container || !comparison) return;
    
    container.innerHTML = `
      <div style="margin-top: 1rem;">
        <h4 style="margin-bottom: 1rem;">Résultats de la comparaison</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
          ${Object.entries(comparison).map(([metric, values]) => `
            <div class="stat-card">
              <div class="stat-content">
                <h5>${metric}</h5>
                <div style="display: flex; justify-content: space-between; margin-top: 0.5rem;">
                  <span>${values.livreur1}</span>
                  <span>vs</span>
                  <span>${values.livreur2}</span>
                </div>
                <div style="text-align: center; margin-top: 0.5rem; color: ${values.difference >= 0 ? 'green' : 'red'};">
                  Différence: ${values.difference}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  static setupEventListeners() {
    // Filtres
    const applyFiltersBtn = document.getElementById('apply-analytics-filters');
    if (applyFiltersBtn) {
      applyFiltersBtn.addEventListener('click', () => this.loadAnalyticsData());
    }
    
    // Comparaison
    const compareBtn = document.getElementById('compare-livreurs-btn');
    if (compareBtn) {
      compareBtn.addEventListener('click', () => this.compareDeliverers());
    }
    
    // Export Excel
    const exportBtn = document.getElementById('export-analytics-excel');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        try {
          const filters = this.getFilters();
          const response = await ApiClient.exportAnalytics(filters);
          
          // Télécharger le fichier
          const blob = new Blob([response], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'analytics.xlsx';
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          
          ToastManager.success('Export Excel réussi');
        } catch (error) {
          console.error('Erreur export:', error);
          ToastManager.error('Erreur lors de l\'export Excel');
        }
      });
    }
    
    // Actualiser
    const refreshBtn = document.getElementById('refresh-analytics');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadAnalyticsData());
    }
  }

  static getTypeIcon(type) {
    switch (type) {
      case 'MATA': return '🛒';
      case 'MLC': return '🎫';
      case 'MLC_SUBSCRIPTION': return '📅';
      default: return '📦';
    }
  }

  static getTypeName(type) {
    switch (type) {
      case 'MATA': return 'MATA';
      case 'MLC': return 'MLC classique';
      case 'MLC_SUBSCRIPTION': return 'MLC abonnement';
      default: return 'Autre';
    }
  }
}

// ===== GESTIONNAIRE PRINCIPAL DE L'APPLICATION =====
class App {
  static async init() {
    try {
      console.log('🚀 Initialisation de l\'application...');
      
      // Configurer les event listeners de navigation
      this.setupNavigationListeners();
      
      // Démarrer l'authentification
      await AuthManager.init();
      
      console.log('✅ Application initialisée avec succès');
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation de l\'application:', error);
      ToastManager.error('Erreur lors du démarrage de l\'application');
    }
  }

  static setupNavigationListeners() {
    // Configurer les boutons de navigation
    document.querySelectorAll('.nav-item').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const pageId = button.dataset.page;
        if (pageId) {
          PageManager.showPage(pageId);
        }
      });
    });

    // Configurer les autres event listeners globaux
    this.setupGlobalListeners();
  }

  static setupGlobalListeners() {
    // Bouton de déconnexion
    document.getElementById('logout-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      AuthManager.logout();
    });

    // Fermeture de modal avec échap
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        ModalManager.hide();
      }
    });

    // Fermeture de modal avec overlay
    document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') {
        ModalManager.hide();
      }
    });

    // Bouton de fermeture de modal
    document.getElementById('modal-close')?.addEventListener('click', () => {
      ModalManager.hide();
    });

    // Gestion du formulaire de connexion
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username-input').value.trim();
        const password = document.getElementById('password-input').value;
        
        if (!username || !password) {
          ToastManager.error('Veuillez remplir tous les champs');
          return;
        }

        try {
          document.getElementById('login-btn').disabled = true;
          document.getElementById('login-btn').textContent = 'Connexion...';
          
          await AuthManager.login(username, password);
        } catch (error) {
          ToastManager.error(error.message || 'Erreur de connexion');
        } finally {
          document.getElementById('login-btn').disabled = false;
          document.getElementById('login-btn').textContent = 'Se connecter';
        }
      });
    }

    // Gestion du formulaire de commande
    const orderForm = document.getElementById('order-form');
    if (orderForm) {
      orderForm.addEventListener('submit', async (e) => {
                e.preventDefault();
        const formData = new FormData(e.target);
        try {
          await OrderManager.createOrder(formData);
        } catch (error) {
          ToastManager.error(error.message || 'Erreur lors de la création de la commande');
        }
      });
    }
  }
}

// ===== DÉMARRAGE DE L'APPLICATION =====
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// Exposer certaines fonctions globalement pour les event handlers inline
window.OrderManager = OrderManager;
window.UserManager = UserManager;
window.LivreurManager = LivreurManager;
window.ExpenseManager = ExpenseManager;
window.MonthlyDashboardManager = MonthlyDashboardManager;
window.MataMonthlyDashboardManager = MataMonthlyDashboardManager;
window.SubscriptionManager = SubscriptionManager;
window.AnalyticsManager = AnalyticsManager;
window.ModalManager = ModalManager; 