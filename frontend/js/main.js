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
  static async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
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
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  }

  static async logout() {
    return this.request('/auth/logout', { method: 'POST' });
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
    const navLivreurs = document.getElementById('nav-livreurs');
    const navExpenses = document.getElementById('nav-expenses');
    const navMonthlyDashboard = document.getElementById('nav-monthly-dashboard');
    const navMataMonthlyDashboard = document.getElementById('nav-mata-monthly-dashboard');
    const exportExcel = document.getElementById('export-excel');
    const statLivreurs = document.getElementById('stat-livreurs');
    const managerSummary = document.getElementById('manager-summary-section');

    if (AppState.user.role === 'MANAGER' || AppState.user.role === 'ADMIN') {
      if (navUsers) navUsers.classList.remove('hidden');
      if (navLivreurs) navLivreurs.classList.remove('hidden');
      if (navExpenses) navExpenses.classList.remove('hidden');
      if (navMonthlyDashboard) navMonthlyDashboard.classList.remove('hidden');
      if (navMataMonthlyDashboard) navMataMonthlyDashboard.classList.remove('hidden');
      if (exportExcel) exportExcel.classList.remove('hidden');
      if (statLivreurs) statLivreurs.classList.remove('hidden');
      if (managerSummary) managerSummary.classList.remove('hidden');
    } else {
      if (navUsers) navUsers.classList.add('hidden');
      if (navLivreurs) navLivreurs.classList.add('hidden');
      if (navExpenses) navExpenses.classList.add('hidden');
      if (navMonthlyDashboard) navMonthlyDashboard.classList.add('hidden');
      if (navMataMonthlyDashboard) navMataMonthlyDashboard.classList.add('hidden');
      if (exportExcel) exportExcel.classList.add('hidden');
      if (statLivreurs) statLivreurs.classList.add('hidden');
      if (managerSummary) managerSummary.classList.add('hidden');
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
          <div class="order-meta">${Utils.formatDate(order.created_at)}</div>
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

    // Créer le tableau avec les colonnes demandées
    const table = `
      <div class="mata-table-container">
        <table class="mata-orders-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Numéro de téléphone</th>
              <th>Nom</th>
              <th>Adresse</th>
              <th>Montant commande (FCFA)</th>
              <th>Livreur</th>
              <th>Commentaire</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${orders.map(order => `
              <tr data-order-id="${order.id}">
                <td>${new Date(order.date).toLocaleDateString('fr-FR')}</td>
                <td>${Utils.escapeHtml(order.phone_number)}</td>
                <td>${Utils.escapeHtml(order.client_name)}</td>
                <td>${order.address ? Utils.escapeHtml(order.address) : '-'}</td>
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
                <td>
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
                </td>
              </tr>
            `).join('')}
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
        .mata-orders-table td:nth-child(1) { min-width: 80px; }
        .mata-orders-table td:nth-child(2) { min-width: 120px; }
        .mata-orders-table td:nth-child(3) { min-width: 150px; }
        .mata-orders-table td:nth-child(4) { min-width: 200px; }
        .mata-orders-table td:nth-child(5) { min-width: 120px; text-align: right; }
        .mata-orders-table td:nth-child(6) { min-width: 100px; }
        .mata-orders-table td:nth-child(7) { min-width: 200px; }
        .mata-orders-table td:nth-child(8) { min-width: 150px; }
      </style>
    `;

    container.innerHTML = table;
    
    // Ajouter les event listeners pour l'édition des commentaires
    this.setupCommentEditListeners();
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
            </div>
          </div>
          <div class="order-actions">
            ${this.canEditOrder(order) ? `
              <button class="btn btn-sm btn-secondary order-edit-btn" data-order-id="${order.id}">
                <span class="icon">✏️</span>
                Modifier
              </button>
            ` : ''}
            ${this.canDeleteOrder(order) ? `
              <button class="btn btn-sm btn-danger order-delete-btn" data-order-id="${order.id}">
                <span class="icon">🗑️</span>
                Supprimer
              </button>
            ` : ''}
          </div>
        </div>
        <div class="order-details">
          <p><strong>Téléphone:</strong> ${Utils.escapeHtml(order.phone_number)}</p>
          ${order.address ? `<p><strong>Adresse:</strong> ${Utils.escapeHtml(order.address)}</p>` : ''}
          ${order.description ? `<p><strong>Description:</strong> ${Utils.escapeHtml(order.description)}</p>` : ''}
          <p><strong>Prix de la course:</strong> <span class="order-amount">${Utils.formatAmount(order.course_price)}</span></p>
          ${order.order_type === 'MATA' && order.amount ? `<p><strong>Montant du panier:</strong> <span class="order-amount">${Utils.formatAmount(order.amount)}</span></p>` : ''}
          <p><strong>Type:</strong> <span class="order-type ${order.order_type}">${order.order_type}</span></p>
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
          <p><strong>Type:</strong> <span class="order-type ${order.order_type}">${order.order_type}</span></p>
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
        this.deleteOrder(orderId);
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
          
          <div class="form-group">
            <label for="edit-address">Adresse</label>
            <textarea id="edit-address" name="address" rows="3">${order.address ? Utils.escapeHtml(order.address) : ''}</textarea>
          </div>
          
          <div class="form-group">
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
            <input type="number" id="edit-course-price" name="course_price" step="0.01" min="0" 
                   value="${order.course_price || (order.order_type === 'MATA' ? 1500 : '')}" 
                   ${order.order_type === 'MATA' ? 'readonly' : ''}>
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

      // Gestionnaire pour le bouton d'annulation
      document.querySelector('.modal-cancel-btn').addEventListener('click', () => {
        ModalManager.hide();
      });

      // Gestion du changement de type de commande dans le modal d'édition
      document.getElementById('edit-order-type').addEventListener('change', (e) => {
        const orderType = e.target.value;
        const coursePriceGroup = document.getElementById('edit-course-price-group');
        const amountGroup = document.getElementById('edit-amount-group');
        const coursePriceInput = document.getElementById('edit-course-price');
        
        if (orderType === 'MATA') {
          coursePriceGroup.style.display = 'block';
          amountGroup.style.display = 'block';
          coursePriceInput.value = '1500';
          coursePriceInput.readOnly = true;
        } else if (orderType === 'MLC' || orderType === 'AUTRE') {
          coursePriceGroup.style.display = 'block';
          amountGroup.style.display = 'none';
          coursePriceInput.value = '';
          coursePriceInput.readOnly = false;
        } else {
          coursePriceGroup.style.display = 'none';
          amountGroup.style.display = 'none';
        }
      });

      document.getElementById('edit-order-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const orderData = Object.fromEntries(formData.entries());
        
        // Convertir les montants en nombres
        if (orderData.course_price) {
          orderData.course_price = parseFloat(orderData.course_price);
        }
        if (orderData.amount) {
          orderData.amount = parseFloat(orderData.amount);
        }
        
        // Pour MLC et AUTRE, ne pas envoyer amount (seulement course_price)
        if (orderData.order_type === 'MLC' || orderData.order_type === 'AUTRE') {
          delete orderData.amount; // Ne pas envoyer amount pour MLC/AUTRE
        }
        
        // Validation
        if (!Utils.validatePhoneNumber(orderData.phone_number)) {
          ToastManager.error('Numéro de téléphone invalide (doit contenir entre 6 et 20 chiffres)');
          return;
        }

        console.log('Données à envoyer:', orderData); // Debug

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
    } catch (error) {
      console.error('Erreur lors du chargement des livreurs:', error);
      ToastManager.error('Erreur lors du chargement des livreurs');
    }
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
    
    if (AppState.livreurs.length === 0) {
      container.innerHTML = '<p class="text-center">Aucun livreur trouvé</p>';
      return;
    }

    container.innerHTML = AppState.livreurs.map(livreur => `
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
        ToastManager.error(error.message || 'Erreur lors de la création');
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

// ===== INITIALISATION DE L'APPLICATION =====
class App {
  static async init() {
    this.setupEventListeners();
    await AuthManager.init();
  }

  static setupEventListeners() {
    // Formulaire de connexion
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(e.target);
      const username = formData.get('username');
      const password = formData.get('password');

      try {
        await AuthManager.login(username, password);
      } catch (error) {
        const errorElement = document.getElementById('login-error');
        errorElement.textContent = error.message || 'Erreur de connexion';
        errorElement.classList.remove('hidden');
      }
    });

    // Bouton de déconnexion
    document.getElementById('logout-btn').addEventListener('click', async () => {
      await AuthManager.logout();
    });

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const page = item.dataset.page;
        if (page) {
          PageManager.showPage(page);
        }
      });
    });

    // Gestion du type de commande pour afficher/masquer les champs
    document.getElementById('order-type').addEventListener('change', (e) => {
      const orderType = e.target.value;
      const coursePriceGroup = document.getElementById('course-price-group');
      const amountGroup = document.getElementById('amount-group');
      const coursePriceInput = document.getElementById('course-price');
      const coursePriceLabel = coursePriceGroup.querySelector('label');
      
      if (orderType === 'MATA') {
        coursePriceGroup.style.display = 'block';
        amountGroup.style.display = 'block';
        coursePriceInput.value = '1500';
        coursePriceInput.readOnly = true;
        coursePriceLabel.textContent = 'Prix de la course (FCFA)';
      } else if (orderType === 'MLC' || orderType === 'AUTRE') {
        coursePriceGroup.style.display = 'block';
        amountGroup.style.display = 'none';
        coursePriceInput.value = '';
        coursePriceInput.readOnly = false;
        coursePriceLabel.textContent = 'Prix de la course (FCFA)';
      } else {
        coursePriceGroup.style.display = 'none';
        amountGroup.style.display = 'none';
      }
    });

    // Formulaire nouvelle commande
    document.getElementById('new-order-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(e.target);
      const orderData = Object.fromEntries(formData.entries());

      // Convertir les montants en nombres
      if (orderData.course_price) {
        orderData.course_price = parseFloat(orderData.course_price);
      }
      if (orderData.amount) {
        orderData.amount = parseFloat(orderData.amount);
      }

      // Pour MLC et AUTRE, ne pas envoyer amount (seulement course_price)
      if (orderData.order_type === 'MLC' || orderData.order_type === 'AUTRE') {
        delete orderData.amount; // Ne pas envoyer amount pour MLC/AUTRE
      }

      // Validation côté client
      if (!Utils.validatePhoneNumber(orderData.phone_number)) {
        ToastManager.error('Numéro de téléphone invalide (doit contenir entre 6 et 20 chiffres)');
        return;
      }

      console.log('Données nouvelle commande à envoyer:', orderData); // Debug

      try {
        await OrderManager.createOrder(orderData);
      } catch (error) {
        ToastManager.error(error.message || 'Erreur lors de la création de la commande');
      }
    });

    // Filtre par date pour les commandes
    document.getElementById('orders-date-filter').addEventListener('change', (e) => {
      const date = e.target.value;
      if (date) {
        OrderManager.loadOrdersByDate(date);
      } else {
        OrderManager.loadOrders();
      }
    });

    // Pagination des commandes
    document.getElementById('prev-page').addEventListener('click', () => {
      if (AppState.currentOrdersPage > 1) {
        OrderManager.loadOrders(AppState.currentOrdersPage - 1);
      }
    });

    document.getElementById('next-page').addEventListener('click', () => {
      if (AppState.currentOrdersPage < AppState.totalOrdersPages) {
        OrderManager.loadOrders(AppState.currentOrdersPage + 1);
      }
    });

    // Export Excel
    document.getElementById('export-excel').addEventListener('click', () => {
      const today = new Date().toISOString().split('T')[0];
      const startDate = prompt('Date de début (YYYY-MM-DD):', today);
      if (!startDate) return;
      
      const endDate = prompt('Date de fin (YYYY-MM-DD):', today);
      if (!endDate) return;

      try {
        ApiClient.exportOrders(startDate, endDate);
        ToastManager.success('Export en cours...');
      } catch (error) {
        ToastManager.error('Erreur lors de l\'export');
      }
    });

    // Boutons utilisateurs
    document.getElementById('add-user-btn').addEventListener('click', () => {
      UserManager.createUser();
    });

    // Boutons livreurs
    document.getElementById('add-livreur-btn').addEventListener('click', () => {
      LivreurManager.createLivreur();
    });

    document.getElementById('show-all-livreurs').addEventListener('click', () => {
      LivreurManager.loadLivreurs(false);
    });

    document.getElementById('show-active-livreurs').addEventListener('click', () => {
      LivreurManager.loadLivreurs(true);
    });

    // Bouton changement de mot de passe
    document.getElementById('change-password-btn').addEventListener('click', () => {
      ProfileManager.showChangePasswordModal();
    });

    document.getElementById('change-password-link').addEventListener('click', () => {
      ProfileManager.showChangePasswordModal();
    });

    // Actualiser le dashboard
    document.getElementById('refresh-dashboard').addEventListener('click', () => {
      DashboardManager.loadDashboard();
    });

    // Nouveau: Event listener pour le filtre de date du dashboard
    const dashboardDateFilter = document.getElementById('dashboard-date-filter');
    if (dashboardDateFilter) {
      dashboardDateFilter.addEventListener('change', () => {
        DashboardManager.loadDashboard();
      });
    }

    // Event listeners pour le tableau de bord mensuel
    MonthlyDashboardManager.setupEventListeners();

    // Event listeners pour le tableau de bord MATA mensuel
    MataMonthlyDashboardManager.setupEventListeners();

    // Fermeture des modales
    document.getElementById('modal-close').addEventListener('click', () => {
      ModalManager.hide();
    });

    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        ModalManager.hide();
      }
    });

    // Toggles de mot de passe
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

    // Initialiser la date d'aujourd'hui dans le filtre
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('orders-date-filter').value = today;

    // Gestion des erreurs globales
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Erreur non gérée:', event.reason);
      ToastManager.error('Une erreur inattendue s\'est produite');
    });

    // Gestion de la perte de connexion
    window.addEventListener('online', () => {
      ToastManager.success('Connexion rétablie');
    });

    window.addEventListener('offline', () => {
      ToastManager.warning('Connexion perdue');
    });
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
window.ModalManager = ModalManager; 