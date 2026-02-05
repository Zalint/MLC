// ===== CONFIGURATION ET CONSTANTES =====
const isLocalHost = (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '0.0.0.0' ||
  /^192\.168\./.test(window.location.hostname)
);
const API_BASE_URL = isLocalHost
  ? 'http://localhost:4000/api/v1'
  : 'https://matix-livreur-backend.onrender.com/api/v1';

// Make API_BASE_URL available globally
window.API_BASE_URL = API_BASE_URL;

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

// Exposer AppState sur window pour les autres modules
window.AppState = AppState;

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
    if (amount === null || amount === undefined) return '0';
    const num = parseFloat(amount);
    const formatted = num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    // Enlever .00 si c'est un nombre entier
    return formatted.replace(/\.00$/, '');
  }

  // Valider un numéro de téléphone selon les contraintes de la base de données
  static validatePhoneNumber(phone) {
    if (!phone || phone.trim() === '') {
      return false;
    }

    // Nettoyer le numéro (supprimer espaces, +, -, etc.)
    const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');
    
    // Vérifier que ce ne sont que des chiffres
    if (!/^\d+$/.test(cleanPhone)) {
      return false;
    }

    // Formats acceptés selon les contraintes de la DB:
    // 1. Numéros sénégalais: 9 chiffres (n'importe quelle combinaison)
    // 2. Numéros français: 11 chiffres commençant par 33
    // 3. Valeur par défaut: 0000000000
    
    if (cleanPhone === '0000000000') {
      return true; // Valeur par défaut autorisée
    }
    
    if (cleanPhone.length === 9 && /^[0-9]{9}$/.test(cleanPhone)) {
      return true; // Numéro sénégalais valide (9 chiffres quelconques)
    }
    
    if (cleanPhone.length === 11 && /^[0-9]{11}$/.test(cleanPhone)) {
      return true; // Numéro international valide (11 chiffres quelconques)
    }
    
    return false;
  }

  // Obtenir le message d'erreur spécifique pour un numéro de téléphone invalide
  static getPhoneNumberErrorMessage(phone) {
    if (!phone || phone.trim() === '') {
      return 'Le numéro de téléphone est requis';
    }

    const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');
    
    if (!/^\d+$/.test(cleanPhone)) {
      return 'Le numéro ne doit contenir que des chiffres (pas d\'espaces, +, -, etc.)';
    }
    
    if (cleanPhone.length === 9) {
      // 9 chiffres acceptés pour le Sénégal (n'importe quelle combinaison)
      return 'Format invalide';
    } else if (cleanPhone.length === 11) {
      // 11 chiffres acceptés pour l'international (n'importe quelle combinaison)
      return 'Format invalide';
    } else {
      return 'Format invalide: 9 chiffres pour le Sénégal (ex: 775059793) ou 11 chiffres pour la France (ex: 33762051319) ou les USA (ex: 12125551234)';
    }
    
    return 'Numéro de téléphone invalide';
  }

  // Nettoyer et formater un numéro de téléphone pour l'affichage
  static formatPhoneNumber(phone) {
    if (!phone) return '';
    
    const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');
    
    if (cleanPhone === '0000000000') {
      return 'Non renseigné';
    }
    
    if (cleanPhone.length === 9 && /^[0-9]{9}$/.test(cleanPhone)) {
      // Format sénégalais: 77 50 59 793
      return cleanPhone.replace(/(\d{2})(\d{2})(\d{2})(\d{3})/, '$1 $2 $3 $4');
    }
    
    if (cleanPhone.length === 11 && /^[0-9]{11}$/.test(cleanPhone)) {
      // Format international simple: 33762051319
      return cleanPhone;
    }
    
    return phone; // Retourner tel quel si format non reconnu
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
    if (text === null || text === undefined) {
      return '';
    }
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
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

  static confirm(title, message, onConfirm, options = {}) {
    const iconMap = {
      danger: '⚠️',
      warning: '⚠️',
      info: 'ℹ️',
      question: '❓'
    };
    
    const icon = options.icon || iconMap[options.type] || '❓';
    const confirmText = options.confirmText || 'Confirmer';
    const cancelText = options.cancelText || 'Annuler';
    const confirmClass = options.type === 'danger' ? 'btn-danger' : 'btn-primary';
    
    const content = `
      <div style="text-align: center; padding: 1rem 0;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">${icon}</div>
        <p style="font-size: 1.1rem; color: #333; margin-bottom: 1.5rem;">${Utils.escapeHtml(message)}</p>
      </div>
      <div class="form-actions" style="display: flex; gap: 0.5rem; justify-content: center;">
        <button type="button" class="btn ${confirmClass}" id="confirm-yes" style="min-width: 120px;">
          ${confirmText}
        </button>
        <button type="button" class="btn btn-secondary" id="confirm-no" style="min-width: 120px;">
          ${cancelText}
        </button>
      </div>
    `;

    this.show(title, content);

    // Gérer la confirmation
    const confirmHandler = () => {
      this.hide();
      onConfirm();
      cleanup();
    };
    
    // Gérer l'annulation
    const cancelHandler = () => {
      this.hide();
      if (options.onCancel) {
        options.onCancel();
      }
      cleanup();
    };
    
    // Nettoyer les event listeners
    const cleanup = () => {
      document.getElementById('confirm-yes')?.removeEventListener('click', confirmHandler);
      document.getElementById('confirm-no')?.removeEventListener('click', cancelHandler);
    };

    document.getElementById('confirm-yes').addEventListener('click', confirmHandler);
    document.getElementById('confirm-no').addEventListener('click', cancelHandler);
    
    // Fermer avec Escape
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        cancelHandler();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  }
}

// ===== API CLIENT WITH RATE LIMITING =====
class ApiClient {
  static requestQueue = [];
  static isProcessingQueue = false;
  static lastRequestTime = 0;
  static minRequestInterval = 100; // Minimum 100ms between requests
  static requestCache = new Map(); // Cache for duplicate requests
  static cacheTimeout = 5000; // Cache for 5 seconds

  static getStoredToken() {
    try {
      return localStorage.getItem('token');
    } catch (error) {
      console.error('❌ Erreur lors de la récupération du token:', error);
      return null;
    }
  }

  static setStoredToken(token) {
    try {
      if (token) {
        localStorage.setItem('token', token);
        console.log('✅ Token stocké avec succès');
      } else {
        localStorage.removeItem('token');
        console.log('✅ Token supprimé');
      }
    } catch (error) {
      console.error('❌ Erreur lors du stockage du token:', error);
    }
  }

  // Queue requests to prevent rate limiting
  static async queueRequest(requestFn) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ requestFn, resolve, reject });
      this.processQueue();
    });
  }

  static async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const { requestFn, resolve, reject } = this.requestQueue.shift();
      
      // Ensure minimum interval between requests
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      
      if (timeSinceLastRequest < this.minRequestInterval) {
        await new Promise(r => setTimeout(r, this.minRequestInterval - timeSinceLastRequest));
      }

      try {
        const result = await requestFn();
        resolve(result);
      } catch (error) {
        reject(error);
      }

      this.lastRequestTime = Date.now();
    }

    this.isProcessingQueue = false;
  }

  static async request(endpoint, options = {}) {
    // Create cache key for GET requests
    const method = options.method || 'GET';
    const cacheKey = method === 'GET' ? `${method}:${endpoint}` : null;
    
    // Check cache for GET requests
    if (cacheKey && this.requestCache.has(cacheKey)) {
      const cached = this.requestCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log(`📦 Using cached response for ${endpoint}`);
        return Promise.resolve(cached.data);
      } else {
        this.requestCache.delete(cacheKey);
      }
    }

    const requestFn = async () => {
      const url = `${window.API_BASE_URL}${endpoint}`;
      const token = this.getStoredToken();

      const config = {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
          ...options.headers
        },
        ...options
      };

      if (config.method !== 'GET' && options.body) {
        config.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      }

      console.log(`🌐 API Request: ${config.method} ${url}`);
      
      const response = await fetch(url, config);
      
      // Handle 429 specifically
      if (response.status === 429) {
        console.warn('⚠️ Rate limit hit, waiting before retry...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        // Retry once
        console.log(`🔄 Retrying: ${config.method} ${url}`);
        const retryResponse = await fetch(url, config);
        
        if (!retryResponse.ok) {
          const errorText = await retryResponse.text();
          throw new Error(errorText || `HTTP ${retryResponse.status}`);
        }
        
        const retryData = await retryResponse.json();
        
        // Cache successful GET responses
        if (cacheKey && retryResponse.ok) {
          this.requestCache.set(cacheKey, {
            data: retryData,
            timestamp: Date.now()
          });
        }
        
        return retryData;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error ${response.status}:`, errorText);
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const responseData = await response.json();
      
      // Cache successful GET responses
      if (cacheKey && response.ok) {
        this.requestCache.set(cacheKey, {
          data: responseData,
          timestamp: Date.now()
        });
      }

      return responseData;
    };

    // Queue the request to prevent rate limiting
    return this.queueRequest(requestFn);
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
  
  static async getOrder(orderId) {
    return this.request(`/orders/${orderId}`);
  }

  static async getLastUserOrders(limit = 5) {
    return this.request(`/orders/last?limit=${limit}`);
  }

  static async getTodayOrdersSummary(date) {
    const endpoint = date ? `/orders/summary?date=${date}` : '/orders/summary';
    return await this.request(endpoint);
  }

  static async getDashboardData(date) {
    const endpoint = date ? `/orders/dashboard-data?date=${date}` : '/orders/dashboard-data';
    return await this.request(endpoint);
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

  // MLC Table endpoints
  static async getMlcTable(startDate, endDate) {
    return this.request(`/orders/mlc-table?startDate=${startDate}&endDate=${endDate}`);
  }

  static async getMlcClientDetails(phoneNumber, startDate, endDate) {
    return this.request(`/orders/mlc-table/client-details?phoneNumber=${encodeURIComponent(phoneNumber)}&startDate=${startDate}&endDate=${endDate}`);
  }

  static async updateMataOrderComment(orderId, commentaire) {
    return this.request(`/orders/${orderId}/comment`, {
      method: 'PUT',
      body: JSON.stringify({ commentaire })
    });
  }

  static async exportMataMonthlyToExcel(month) {
    try {
      const url = `${window.API_BASE_URL}/orders/mata-monthly-export?month=${month}`;
      const token = this.getStoredToken();

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      // Récupérer le blob de la réponse
      const blob = await response.blob();
      
      // Créer un lien de téléchargement
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `mata_mensuel_${month}.xlsx`;
      document.body.appendChild(a);
      a.click();
      
      // Nettoyer
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      
      ToastManager.success('Export Excel MATA téléchargé avec succès !');
    } catch (error) {
      console.error('Erreur lors de l\'export Excel MATA:', error);
      ToastManager.error('Erreur lors de l\'export Excel');
    }
  }

  static async exportMonthlySummaryToExcel(month) {
    try {
      const url = `${window.API_BASE_URL}/orders/monthly-summary-export?month=${month}`;
      const token = this.getStoredToken();

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      // Récupérer le blob de la réponse
      const blob = await response.blob();
      
      // Créer un lien de téléchargement
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `recapitulatif_livreurs_${month}.xlsx`;
      document.body.appendChild(a);
      a.click();
      
      // Nettoyer
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      
      ToastManager.success('Export Excel récapitulatif téléchargé avec succès !');
    } catch (error) {
      console.error('Erreur lors de l\'export Excel récapitulatif:', error);
      ToastManager.error('Erreur lors de l\'export Excel récapitulatif');
    }
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

  // GPS Analytics
  static async getMonthlyGpsSummary(month) {
    return this.request(`/analytics/gps/monthly-summary?month=${month}`);
  }

  static async getDailyGpsSummary(month) {
    return this.request(`/analytics/gps/daily-summary?month=${month}`);
  }

  // Rechercher des clients
  static async searchClients(query, limit = 10) {
    return this.request(`/orders/search-clients?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  // Obtenir les informations d'un client par numéro de téléphone
  static async getClientByPhone(phoneNumber) {
    return this.request(`/orders/client/${encodeURIComponent(phoneNumber)}`);
  }

  static async getTodayOrdersSummary(date) {
    return this.request(`/orders/today-summary?date=${date}`);
  }
}

// ===== GESTIONNAIRE DE PAGES =====
class PageManager {
  static showPage(pageId) {
    console.log('🔄 Changement de page vers:', pageId);
    
    // Si on est en train de montrer la page de login, s'assurer que seule cette page est visible
    if (pageId === 'login') {
      document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
        page.style.display = 'none';
      });
      
      const loginPage = document.getElementById('login-page');
      if (loginPage) {
        loginPage.classList.add('active');
        loginPage.style.display = 'block';
      }
      AppState.currentPage = pageId;
      return; // Ne pas charger de données pour la page login
    }
    
    // Pour toutes les autres pages, cacher toutes les pages d'abord
    document.querySelectorAll('.page').forEach(page => {
      page.classList.remove('active');
      page.style.display = 'none';
    });

    // Afficher la page demandée
    const targetPage = document.getElementById(`${pageId}-page`);
    console.log('🔄 Page cible trouvée:', !!targetPage, targetPage);
    if (targetPage) {
      targetPage.classList.add('active');
      targetPage.style.display = 'block';
      AppState.currentPage = pageId;
      console.log('🔄 Page activée:', pageId);
    } else {
      console.error('❌ Page non trouvée:', `${pageId}-page`);
    }

    // Mettre à jour la navigation (seulement si pas en mode login)
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
          
          // Vérifier s'il y a des données pré-remplies depuis "Prendre la livraison"
          const prefilledData = sessionStorage.getItem('prefilledOrderData');
          if (prefilledData) {
            try {
              const orderData = JSON.parse(prefilledData);
              OrderManager.prefillOrderForm(orderData);
              sessionStorage.removeItem('prefilledOrderData'); // Nettoyer après utilisation
            } catch (error) {
              console.error('Erreur lors du pré-remplissage:', error);
            }
          }
          
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
        case 'mlc-table':
          if (AppState.user && (AppState.user.role === 'MANAGER' || AppState.user.role === 'ADMIN')) {
            await MlcTableManager.init();
          }
          break;
        case 'commandes-en-cours':
          // Les livreurs voient seulement leurs commandes, les managers/admins voient tout
          if (window.loadCommandesEnCours) {
            await window.loadCommandesEnCours();
          }
          break;
        case 'livreurs':
          if (AppState.user && (AppState.user.role === 'MANAGER' || AppState.user.role === 'ADMIN')) {
            await LivreurManager.loadLivreurs();
          }
          break;
        case 'gps-tracking':
          if (AppState.user && (AppState.user.role === 'MANAGER' || AppState.user.role === 'ADMIN')) {
            console.log('🗺️ === INITIALISATION PAGE GPS TRACKING ===');
            console.log('🗺️ Utilisateur:', AppState.user);
            console.log('🗺️ Rôle:', AppState.user.role);
            
            // Vérifier l'état de l'environnement
            console.log('🌍 État de l\'environnement:', {
              GpsTrackingManager: typeof window.GpsTrackingManager,
              Leaflet: typeof L,
              ApiClient: typeof window.ApiClient,
              API_BASE_URL: window.API_BASE_URL
            });
            
            // Vérifier les éléments DOM critiques AVANT l'initialisation
            const gpsMap = document.getElementById('gps-map');
            const gpsRefreshBtn = document.getElementById('gps-refresh-btn');
            const gpsContainer = document.querySelector('.gps-container');
            
            console.log('🗺️ Éléments DOM GPS avant init:', {
              'gps-map': {
                exists: !!gpsMap,
                dimensions: gpsMap ? {
                  width: gpsMap.offsetWidth,
                  height: gpsMap.offsetHeight,
                  clientWidth: gpsMap.clientWidth,
                  clientHeight: gpsMap.clientHeight,
                  scrollWidth: gpsMap.scrollWidth,
                  scrollHeight: gpsMap.scrollHeight
                } : null,
                computedStyle: gpsMap ? {
                  display: window.getComputedStyle(gpsMap).display,
                  width: window.getComputedStyle(gpsMap).width,
                  height: window.getComputedStyle(gpsMap).height,
                  position: window.getComputedStyle(gpsMap).position
                } : null
              },
              'gps-refresh-btn': !!gpsRefreshBtn,
              'gps-container': !!gpsContainer
            });
            
            if (window.GpsTrackingManager) {
              console.log('🗺️ Classe GpsTrackingManager trouvée, début initialisation...');
              try {
                await window.GpsTrackingManager.init();
                console.log('🗺️ === GPS TRACKING INITIALISÉ AVEC SUCCÈS ===');
                
                // Vérifier l'état APRÈS l'initialisation
                setTimeout(() => {
                  console.log('🗺️ Vérification post-initialisation:', {
                    mapInitialized: !!window.GpsTrackingManager.map,
                    mapContainer: gpsMap ? {
                      finalWidth: gpsMap.offsetWidth,
                      finalHeight: gpsMap.offsetHeight,
                      finalDisplay: window.getComputedStyle(gpsMap).display
                    } : null,
                    markersCount: Object.keys(window.GpsTrackingManager.markers || {}).length
                  });
                }, 1000);
                
              } catch (error) {
                console.error('❌ === ERREUR INITIALISATION GPS TRACKING ===');
                console.error('❌ Type d\'erreur:', typeof error, error.constructor.name);
                console.error('❌ Message:', error.message);
                console.error('❌ Stack trace:', error.stack);
                console.error('❌ Error object:', error);
              }
            } else {
              console.error('❌ Classe GpsTrackingManager non trouvée!');
              console.error('❌ Scripts disponibles dans window:', Object.keys(window).filter(key => key.toLowerCase().includes('gps')));
            }
          } else {
            console.log('🗺️ Accès GPS tracking refusé - utilisateur non autorisé');
            console.log('🗺️ Utilisateur actuel:', AppState.user);
          }
          break;
        case 'audit':
          if (AppState.user && (AppState.user.role === 'MANAGER' || AppState.user.role === 'ADMIN')) {
            console.log('📊 Redirection vers Audit...');
            window.location.href = 'audit.html';
          } else {
            alert('Accès non autorisé');
          }
          break;
        case 'gps-analytics':
          if (AppState.user && (AppState.user.role === 'MANAGER' || AppState.user.role === 'ADMIN')) {
            console.log('📊 Initialisation GPS Analytics...');
            console.log('📊 Vérification des dépendances:', {
              GpsAnalyticsManager: !!window.GpsAnalyticsManager,
              ApiClient: !!window.ApiClient,
              ToastManager: !!window.ToastManager
            });
            
            if (window.GpsAnalyticsManager) {
              console.log('📊 Classe GpsAnalyticsManager trouvée, création d\'une nouvelle instance...');
              try {
                window.gpsAnalyticsManager = new window.GpsAnalyticsManager();
                console.log('📊 Instance créée avec succès:', window.gpsAnalyticsManager);
              } catch (error) {
                console.error('❌ Erreur lors de la création de l\'instance GPS Analytics:', error);
                ToastManager.error('Erreur lors de l\'initialisation des analytics GPS');
              }
            } else {
              console.error('❌ Classe GpsAnalyticsManager non trouvée!');
              // Essayer de charger après un délai
              setTimeout(() => {
                if (window.GpsAnalyticsManager) {
                  console.log('📊 Classe trouvée après délai, création de l\'instance...');
                  try {
                    window.gpsAnalyticsManager = new window.GpsAnalyticsManager();
                    console.log('📊 Instance créée après délai:', window.gpsAnalyticsManager);
                  } catch (error) {
                    console.error('❌ Erreur lors de la création différée:', error);
                  }
                } else {
                  console.error('❌ Classe toujours non trouvée après délai');
                  ToastManager.error('Erreur: Script GPS Analytics non chargé');
                }
              }, 500);
            }
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
    
    // Hide all pages first to ensure clean state
    document.querySelectorAll('.page').forEach(page => {
      page.classList.remove('active');
      page.style.display = 'none';
    });
    
    // Show only login page
    const loginPage = document.getElementById('login-page');
    if (loginPage) {
      loginPage.classList.add('active');
      loginPage.style.display = 'block';
    }
    
    // Show main content only after properly setting up login page
    document.getElementById('main-content').classList.remove('hidden');
    AppState.currentPage = 'login';
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
      
      // Affichage du menu Tableau MLC pour managers/admins
      const navMlcTable = document.getElementById('nav-mlc-table');
      if (navMlcTable) {
        navMlcTable.classList.remove('hidden');
        navMlcTable.style.display = 'flex';
      }
      
      // Affichage du menu Commandes En Cours pour managers/admins
      const navCommandesEnCours = document.getElementById('nav-commandes-en-cours');
      if (navCommandesEnCours) {
        navCommandesEnCours.classList.remove('hidden');
        navCommandesEnCours.style.display = 'flex';
      }

      // Affichage du menu Audit pour managers/admins
      const navAudit = document.getElementById('nav-audit');
      if (navAudit) {
        navAudit.classList.remove('hidden');
        navAudit.style.display = 'flex';
      }
      
      // Affichage des menus GPS pour managers/admins
      const navGpsTracking = document.getElementById('nav-gps-tracking');
      const navGpsAnalytics = document.getElementById('nav-gps-analytics');
      if (navGpsTracking) {
        navGpsTracking.classList.remove('hidden');
        navGpsTracking.style.display = 'flex';
      }
      if (navGpsAnalytics) {
        navGpsAnalytics.classList.remove('hidden');
        navGpsAnalytics.style.display = 'flex';
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
      
      // Cacher aussi les menus GPS pour non-managers
      const navGpsTracking = document.getElementById('nav-gps-tracking');
      const navGpsAnalytics = document.getElementById('nav-gps-analytics');
      if (navGpsTracking) {
        navGpsTracking.classList.add('hidden');
        navGpsTracking.style.display = 'none';
      }
      if (navGpsAnalytics) {
        navGpsAnalytics.classList.add('hidden');
        navGpsAnalytics.style.display = 'none';
      }
      
      // Afficher "Mes Performances" pour les livreurs
      const navMyPerformance = document.getElementById('nav-my-performance');
      if (navMyPerformance && AppState.user.role === 'LIVREUR') {
        navMyPerformance.classList.remove('hidden');
        navMyPerformance.style.display = 'flex';
      } else if (navMyPerformance) {
        navMyPerformance.classList.add('hidden');
        navMyPerformance.style.display = 'none';
      }
      
      // Afficher "Commandes en cours" pour les livreurs
      const navCommandesEnCoursLivreur = document.getElementById('nav-commandes-en-cours');
      if (navCommandesEnCoursLivreur && AppState.user.role === 'LIVREUR') {
        navCommandesEnCoursLivreur.classList.remove('hidden');
        navCommandesEnCoursLivreur.style.display = 'flex';
      }

      // Afficher l'interface GPS pour les livreurs dans le profil
      const gpsLivreurSection = document.getElementById('gps-livreur-section');
      if (gpsLivreurSection && AppState.user.role === 'LIVREUR') {
        gpsLivreurSection.style.display = 'block';
        
        // Initialiser l'interface GPS livreur si ce n'est pas déjà fait
        setTimeout(() => {
          if (window.GpsLivreurManager && !window.gpsLivreurManager) {
            window.gpsLivreurManager = new window.GpsLivreurManager();
            console.log('📍 Interface GPS livreur initialisée pour', AppState.user.username);
          }
        }, 500);
      } else if (gpsLivreurSection) {
        gpsLivreurSection.style.display = 'none';
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
        'nav-expenses', 
        'nav-monthly-dashboard',
        'nav-mata-monthly-dashboard',
        'nav-gps-tracking',
        'nav-gps-analytics'
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
  static isLoaded = false;
  static badgeStylesInjected = false;

  static injectBadgeStylesOnce() {
    if (!this.badgeStylesInjected) {
      const styleElement = document.createElement('style');
      styleElement.id = 'badge-styles';
      styleElement.textContent = `
        .badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.8em;
          font-weight: bold;
          color: white;
          min-width: 20px;
          text-align: center;
        }
        .badge-mata {
          background-color: #28a745;
        }
        .badge-mlc {
          background-color: #007bff;
        }
      `;
      document.head.appendChild(styleElement);
      this.badgeStylesInjected = true;
    }
  }

  static async loadDashboard() {
    try {
      AppState.isLoading = true;
      
      // Injecter les styles des badges une seule fois
      this.injectBadgeStylesOnce();
      
      // Initialize today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      const selectedDate = document.getElementById('dashboard-date-filter')?.value || today;

      // Optionally set the date input to this default
      const dateFilterInput = document.getElementById('dashboard-date-filter');
      if (dateFilterInput && !dateFilterInput.value) {
        dateFilterInput.value = selectedDate;
      }

      // Charger les données du tableau de bord
      const dashboardData = await ApiClient.getDashboardData(selectedDate);
      
      // Mettre à jour les statistiques de base
      const totalOrdersElement = document.getElementById('total-orders-today');
      const totalAmountElement = document.getElementById('total-amount-today');
      const ordersTodayLabelElement = document.getElementById('orders-today-label');
      
      if (totalOrdersElement) totalOrdersElement.textContent = dashboardData.basicStats.totalOrders;
      if (totalAmountElement) totalAmountElement.textContent = Utils.formatAmount(dashboardData.basicStats.totalAmount);
      if (ordersTodayLabelElement) {
        ordersTodayLabelElement.textContent = selectedDate === today ? "Commandes aujourd'hui" : `Commandes (${Utils.formatDisplayDate(selectedDate)})`;
      }

      // Mettre à jour Dépenses et Bénéfice
      const totalExpensesElement = document.getElementById('total-expenses-today');
      const totalBeneficeElement = document.getElementById('total-benefice-today');
      let depenses = 0;
      let benefice = 0;
      if (dashboardData.user.isManagerOrAdmin && dashboardData.managerData) {
        depenses = dashboardData.managerData.totalDepenses || 0;
        benefice = (dashboardData.basicStats.totalAmount || 0) - depenses;
      } else {
        depenses = dashboardData.basicStats.totalExpenses || 0;
        benefice = (dashboardData.basicStats.totalAmount || 0) - depenses;
      }
      if (totalExpensesElement) totalExpensesElement.textContent = Utils.formatAmount(depenses);
      if (totalBeneficeElement) {
        totalBeneficeElement.textContent = Utils.formatAmount(benefice);
        totalBeneficeElement.style.color = benefice >= 0 ? '#059669' : '#dc2626';
      }

      // Afficher les dernières commandes
      this.displayRecentOrders(dashboardData.recentOrders || []);
      // Gérer l'affichage des sections selon le rôle
      const managerSummarySection = document.getElementById('manager-summary-section');
      const ordersByTypeSection = document.getElementById('orders-by-type-section');
      const monthlyOrdersByTypeSection = document.getElementById('monthly-orders-by-type-section');
      const statDepensesCard = document.getElementById('stat-depenses');
      const statLivreursCard = document.getElementById('stat-livreurs');
      
      // 🎯 Afficher les statistiques par type pour TOUS les utilisateurs
      this.displayOrdersByType(dashboardData.statsByType || [], dashboardData.mataPointsDeVente || []);
      
      // 🎯 Afficher le cumul mensuel SEULEMENT pour les livreurs (pas pour managers/admins)
      if (!dashboardData.user.isManagerOrAdmin) {
        this.displayMonthlyOrdersByType(dashboardData.monthlyStatsByType || []);
      } else {
        // Cacher la section pour les managers/admins
        const monthlySection = document.getElementById('monthly-orders-by-type-section');
        if (monthlySection) {
          monthlySection.classList.add('hidden');
        }
      }
      
      console.log('🔍 StatsByType (jour):', dashboardData.statsByType);
      console.log('🔍 MonthlyStatsByType (cumul mensuel):', dashboardData.monthlyStatsByType);
      
      if (dashboardData.user.isManagerOrAdmin && dashboardData.managerData) {
        // Afficher les sections managers seulement
        if (managerSummarySection) managerSummarySection.classList.remove('hidden');
        if (statDepensesCard) statDepensesCard.classList.remove('hidden');
        if (statLivreursCard) statLivreursCard.classList.remove('hidden');
        
        // Afficher le récapitulatif par livreur
        this.displayManagerSummary(dashboardData.managerData.summary || []);
        
        console.log('🔍 StatsByType data (manager):', dashboardData.statsByType);
        
        // Mettre à jour les stats managers
        const activeLivreursElement = document.getElementById('active-livreurs');
        if (activeLivreursElement) {
          activeLivreursElement.textContent = dashboardData.managerData.activeLivreurs;
        }

        const totalExpensesElement = document.getElementById('total-expenses-today');
        if (totalExpensesElement) {
          totalExpensesElement.textContent = Utils.formatAmount(dashboardData.managerData.totalDepenses || 0);
        }

      } else {
        // Cacher seulement les sections spécifiques aux managers
        if (managerSummarySection) managerSummarySection.classList.add('hidden');
        // if (statDepensesCard) statDepensesCard.classList.add('hidden'); // NE PLUS CACHER pour livreur
        if (statLivreursCard) statLivreursCard.classList.add('hidden');
        
        console.log('🔍 StatsByType data (livreur):', dashboardData.statsByType);
      }

      // Afficher les widgets de pointage selon le rôle
      this.displayTimesheetWidgets();

    } catch (error) {
      console.error('Erreur lors du chargement du tableau de bord:', error);
      ToastManager.error('Erreur lors du chargement du tableau de bord');
    }
  }

  static displayTimesheetWidgets() {
    console.log('📊 displayTimesheetWidgets appelé, user:', AppState.user);
    
    const widgetLivreur = document.getElementById('timesheet-widget-livreur');
    const widgetManager = document.getElementById('timesheet-manager-widget');

    if (AppState.user) {
      if (AppState.user.role === 'LIVREUR') {
        // Afficher widget livreur
        console.log('🚴 Initialisation widget LIVREUR');
        if (widgetLivreur) widgetLivreur.style.display = 'block';
        if (widgetManager) widgetManager.style.display = 'none';
        
        // Initialiser le manager livreur
        if (window.TimesheetsLivreurManager) {
          console.log('🚴 Appel TimesheetsLivreurManager.init()');
          window.TimesheetsLivreurManager.init();
        } else {
          console.error('❌ TimesheetsLivreurManager non disponible');
        }
      } else if (AppState.user.role === 'MANAGER' || AppState.user.role === 'ADMIN') {
        // Afficher widget manager
        console.log('📊 Initialisation widget MANAGER');
        if (widgetLivreur) widgetLivreur.style.display = 'none';
        if (widgetManager) widgetManager.style.display = 'block';
        
        // Initialiser le manager view
        if (window.TimesheetsManagerView) {
          console.log('📊 Appel TimesheetsManagerView.init()');
          window.TimesheetsManagerView.init();
        } else {
          console.error('❌ TimesheetsManagerView non disponible');
        }
      }
    } else {
      console.warn('⚠️ AppState.user non défini');
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
          <p><strong>Type:</strong> <span class="order-type ${order.order_type}">${order.order_type}</span>
            ${order.interne ? '<span class="badge-internal" style="background:#dc2626;color:#fff;padding:2px 8px;border-radius:8px;font-size:0.8em;margin-left:8px;">🏢 Interne</span>' : ''}
          </p>
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
              <th>🛒 MATA</th>
              <th>📦 MLC</th>
              <th>Courses</th>
              <th>Dépenses</th>
              <th>Bénéfice</th>
              <th>Km parcourus</th>
              <th>Détails</th>
            </tr>
          </thead>
          <tbody>
            ${summary.map(item => {
              const profit = parseFloat(item.total_montant) - parseFloat(item.total_depenses);
              const profitClass = profit >= 0 ? 'text-green-600' : 'text-red-600';
              
              // Calcul des commandes MATA et MLC
              const statsByType = item.statsByType || {};
              const mataClientCount = statsByType['MATA client'] ? parseInt(statsByType['MATA client'].count) : 0;
              const mataInterneCount = statsByType['MATA interne'] ? parseInt(statsByType['MATA interne'].count) : 0;
              const mataCount = mataClientCount + mataInterneCount;
              const mlcSimpleCount = statsByType['MLC simple'] ? parseInt(statsByType['MLC simple'].count) : 0;
              const mlcAbonnementCount = statsByType['MLC avec abonnement'] ? parseInt(statsByType['MLC avec abonnement'].count) : 0;
              const mlcTotalCount = mlcSimpleCount + mlcAbonnementCount;
              
              return `
                <tr>
                  <td>${Utils.escapeHtml(item.livreur)}</td>
                  <td>${item.nombre_commandes}</td>
                  <td class="text-center"><span class="badge badge-mata">${mataCount}</span></td>
                  <td class="text-center"><span class="badge badge-mlc">${mlcTotalCount}</span></td>
                  <td>${Utils.formatAmount(item.total_montant)}</td>
                  <td>${Utils.formatAmount(item.total_depenses)}</td>
                  <td class="${profitClass}">${Utils.formatAmount(profit)}</td>
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
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Ajouter les event listeners pour les boutons de détails
    this.setupDetailsEventListeners();
  }

  static displayOrdersByType(statsByType, mataPointsDeVente = []) {
    const container = document.getElementById('orders-by-type-container');
    const section = document.getElementById('orders-by-type-section');
    
    if (!container) {
      console.error('❌ orders-by-type-container not found!');
      return;
    }
    
    // S'assurer que la section est visible
    if (section) {
      section.classList.remove('hidden');
    }
    
    if (!statsByType || statsByType.length === 0) {
      container.innerHTML = '<p class="text-center">Aucune commande pour cette période</p>';
      return;
    }

    console.log('🎯 Rendering stats:', statsByType.length, 'items');

    // Mapping des types avec leurs icônes et classes CSS
    const typeMapping = {
      'MATA client': { icon: '🛒', class: 'mata-client' },
      'MATA interne': { icon: '🏢', class: 'mata-interne' },
      'MLC avec abonnement': { icon: '🎫', class: 'mlc-avec-abonnement' },
      'MLC simple': { icon: '📦', class: 'mlc-simple' },
      'AUTRE': { icon: '📋', class: 'autre' }
    };

    // Afficher uniquement les cartes par type (plus de résumé à gauche)
    container.innerHTML = statsByType.map(stat => {
      const type = stat.order_type;
      const mapping = typeMapping[type] || { icon: '📦', class: '' };
      
      // Ajouter les détails par point de vente pour MATA
      let pointsDeVenteDetails = '';
      if (type && type.startsWith('MATA') && mataPointsDeVente && mataPointsDeVente.length > 0) {
        const pointsDeVenteText = mataPointsDeVente
          .map(point => `${Utils.escapeHtml(point.point_de_vente)}: ${point.count}`)
          .join(', ');
        pointsDeVenteDetails = `
          <div class="mata-points-vente" style="margin-top: 8px; font-size: 0.85em; color: rgba(255,255,255,0.9); line-height: 1.2;">
            ${pointsDeVenteText}
          </div>
        `;
      }
      
      return `
        <div class="order-type-card ${mapping.class}">
          <div class="order-type-icon">${mapping.icon}</div>
          <div class="order-type-label">${type}</div>
          <div class="order-type-count">${stat.count}</div>
          <div class="order-type-amount">${Utils.formatAmount(stat.total_amount).replace(' FCFA', '')}</div>
          ${pointsDeVenteDetails}
        </div>
      `;
    }).join('');
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
                      <td>${Utils.escapeHtml(order.client_name)}
                        ${order.interne ? '<span class="badge-internal" style="background:#dc2626;color:#fff;padding:2px 6px;border-radius:6px;font-size:0.7em;margin-left:4px;">🏢</span>' : ''}
                      </td>
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

  static displayMonthlyOrdersByType(monthlyStatsByType) {
    const container = document.getElementById('monthly-orders-by-type-container');
    const section = document.getElementById('monthly-orders-by-type-section');
    
    if (!container) {
      console.error('❌ monthly-orders-by-type-container not found!');
      return;
    }
    
    // S'assurer que la section est visible
    if (section) {
      section.classList.remove('hidden');
      console.log('🎯 Monthly section made visible');
    }
    
    if (!monthlyStatsByType || monthlyStatsByType.length === 0) {
      container.innerHTML = '<p class="text-center">Aucune commande ce mois-ci</p>';
      return;
    }

    // Mapping des types avec leurs icônes et classes CSS
    const typeMapping = {
      'MATA client': { icon: '🛒', class: 'mata-client' },
      'MATA interne': { icon: '🏢', class: 'mata-interne' },
      'MLC avec abonnement': { icon: '🎫', class: 'mlc-avec-abonnement' },
      'MLC simple': { icon: '📦', class: 'mlc-simple' },
      'AUTRE': { icon: '📋', class: 'autre' }
    };

    container.innerHTML = monthlyStatsByType.map(stat => {
      const mapping = typeMapping[stat.order_type] || { icon: '❓', class: 'autre' };
      return `
        <div class="order-type-card ${mapping.class}">
          <div class="order-type-icon">${mapping.icon}</div>
          <div class="order-type-content">
            <h4>${stat.order_type}</h4>
            <div class="order-type-stats">
              <span class="order-count">${stat.count} commande${stat.count > 1 ? 's' : ''}</span>
              <span class="order-amount">${Utils.formatAmount(stat.total_amount)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
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

      
      // Charger les données GPS mensuelles (avec gestion d'erreur)
      let gpsResponse = { data: [] };
      let dailyGpsResponse = { data: [] };
      try {
        gpsResponse = await ApiClient.getMonthlyGpsSummary(selectedMonth);
        dailyGpsResponse = await ApiClient.getDailyGpsSummary(selectedMonth);
      } catch (error) {
        console.warn('Données GPS non disponibles:', error);
        ToastManager.warning('Les données GPS ne sont pas disponibles pour ce mois');
      }
      
      // Mettre à jour les statistiques
      this.updateMonthlyStats(response);
      
      // Afficher la répartition par type de commande pour le mois
      this.displayMonthlyOrdersByType(response.monthlyStatsByType || []);
      
      // Afficher la répartition par type par livreur avec données GPS
      this.displayMonthlySummaryByType(response.summary || [], gpsResponse.data || []);
      
      // Afficher le tableau détaillé par jour avec données GPS
      this.displayMonthlyDetailedTable(
        response.dailyData,
        response.dailyExpenses,
        selectedMonth,
        dailyGpsResponse.data || [],
        response.summary || [],
        response.dailyTypeStats || []
      );
      
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
    
    // Carte Bénéfice du mois
    const benefice = (data.total_montant || 0) - (data.total_depenses || 0);
    const beneficeElem = document.getElementById('monthly-total-benefice');
    if (beneficeElem) {
      beneficeElem.textContent = Utils.formatAmount(benefice);
      beneficeElem.style.color = benefice >= 0 ? '#059669' : '#dc2626';
    }
    
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

  static displayMonthlyDetailedTable(dailyData, dailyExpenses, month, dailyGpsData = [], summary = [], dailyTypeStats = []) {
    const container = document.getElementById('monthly-summary-table-container');
    
    if (!dailyData || dailyData.length === 0) {
      container.innerHTML = '<p class="no-data">Aucune donnée disponible pour ce mois.</p>';
      return;
    }

    // Obtenir la liste des livreurs et des dates (pour totaux)
    const livreurs = [...new Set(dailyData.map(item => item.livreur))].sort();
    const dates = [...new Set(dailyData.map(item => item.date))].sort();

    // Créer des maps pour un accès rapide aux données
    const ordersMap = {};
    const expensesMap = {};
    const gpsMap = {};

    dailyData.forEach(item => {
      const key = `${item.date}_${item.livreur}`;
      ordersMap[key] = item;
    });

    dailyExpenses.forEach(item => {
      const key = `${item.date}_${item.livreur}`;
      expensesMap[key] = item;
    });

    dailyGpsData.forEach(item => {
      // Convertir la date au format YYYY-MM-DD pour correspondre au format des autres données
      const gpsDate = new Date(item.tracking_date);
      // Utiliser la date locale pour éviter les problèmes de timezone
      const year = gpsDate.getFullYear();
      const month = String(gpsDate.getMonth() + 1).padStart(2, '0');
      const day = String(gpsDate.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      const key = `${formattedDate}_${item.livreur_username}`;
      gpsMap[key] = item;
    });

    // Créer les en-têtes du tableau (structure verticale)
    const headers = `
      <th class="date-column">Date</th>
      <th class="livreur-column">Livreur</th>
      <th class="sub-header">Type</th>
      <th class="sub-header">Cmd</th>
      <th class="sub-header">Courses</th>
      <th class="sub-header">Supplément inclus</th>
      <th class="sub-header">Carburant</th>
      <th class="sub-header">Réparations</th>
      <th class="sub-header">Police</th>
      <th class="sub-header">Autres</th>
      <th class="sub-header">Total Dép.</th>
      <th class="sub-header">Km</th>
      <th class="sub-header">GPS Km</th>
      <th class="sub-header">Bénéfice</th>
    `;

    // Calculer la liste des paires (date, livreur) réellement présentes pour éviter de rendre des lignes vides
    const keysSet = new Set([
      ...Object.keys(ordersMap),
      ...Object.keys(expensesMap),
      ...Object.keys(gpsMap)
    ]);
    const dateToLivreurs = {};
    const rowDates = new Set();
    keysSet.forEach(key => {
      const underscoreIndex = key.lastIndexOf('_');
      if (underscoreIndex > 0) {
        const dateKey = key.slice(0, underscoreIndex);
        const livreurKey = key.slice(underscoreIndex + 1);
        if (!dateToLivreurs[dateKey]) dateToLivreurs[dateKey] = new Set();
        dateToLivreurs[dateKey].add(livreurKey);
        rowDates.add(dateKey);
      }
    });

    // Créer les lignes de données (plusieurs lignes par date/livreur/type)
    const rowParts = [];
    // Construire map (date, livreur, type) -> count
    const typeDataMap = {};

    (dailyTypeStats || []).forEach(row => {
      const dateKey = (row.date instanceof Date) ? row.date.toISOString().split('T')[0] : (row.date || '').toString().slice(0,10);
      const livreurKey = (row.livreur || '').trim();
      const label = row.order_type === 'AUTRE' ? 'AUTRES' : row.order_type;
      const key = `${dateKey}_${livreurKey}_${label}`;
      typeDataMap[key] = {
        type: label,
        count: parseInt(row.count) || 0,
        total_amount: parseFloat(row.total_amount) || 0,
        total_supplements: parseFloat(row.total_supplements) || 0,
        supplement_types: row.supplement_types || null,
        count_with_supplements: parseInt(row.count_with_supplements) || 0
      };
    });

    // Pour chaque date, livreur et type avec des données
    Array.from(rowDates).sort().forEach(date => {
      const formattedDate = new Date(date).toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit' 
      });
      
      const livreursForDate = dateToLivreurs[date] ? Array.from(dateToLivreurs[date]).sort() : [];
      livreursForDate.forEach(livreur => {
        const expenseKey = `${date}_${livreur}`;
        const gpsKey = `${date}_${livreur}`;
        const expenseData = expensesMap[expenseKey] || { carburant: 0, reparations: 0, police: 0, autres: 0, km_parcourus: 0 };
        const gpsData = gpsMap[gpsKey] || { total_distance_km: 0 };
        
        // Trouver tous les types pour ce livreur/date
        const allTypes = ['MLC simple', 'MLC avec abonnement', 'MATA client', 'MATA interne', 'AUTRES', 'AUTRE'];
        const typesForThisLivreurDate = allTypes.filter(type => {
          const typeKey = `${date}_${livreur}_${type}`;
          const typeInfo = typeDataMap[typeKey];
          return typeInfo && typeInfo.count > 0;
        });

        typesForThisLivreurDate.forEach((type, index) => {
          const typeKey = `${date}_${livreur}_${type}`;
          const typeInfo = typeDataMap[typeKey];
          
          // Afficher les dépenses seulement sur la première ligne de ce livreur/date
          const isFirstLineForLivreurDate = index === 0;
          const displayCarburant = isFirstLineForLivreurDate ? (expenseData.carburant || 0) : 0;
          const displayReparations = isFirstLineForLivreurDate ? (expenseData.reparations || 0) : 0;
          const displayPolice = isFirstLineForLivreurDate ? (expenseData.police || 0) : 0;
          const displayAutres = isFirstLineForLivreurDate ? (expenseData.autres || 0) : 0;
          const displayTotalDepenses = isFirstLineForLivreurDate ? ((expenseData.carburant || 0) + (expenseData.reparations || 0) + (expenseData.police || 0) + (expenseData.autres || 0)) : 0;
          const displayKmParcourus = isFirstLineForLivreurDate ? (expenseData.km_parcourus || 0) : 0;
          const displayGpsKm = isFirstLineForLivreurDate ? (gpsData.total_distance_km ? Math.round(gpsData.total_distance_km * 100) / 100 : 0) : 0;
          
          // Pour le montant, utiliser UNIQUEMENT les données exactes de l'API
          const typeAmount = typeInfo.total_amount || 0;
          
          // Pour le bénéfice, on utilise le montant du type moins les dépenses totales (seulement sur la première ligne)
          const benefice = typeAmount - displayTotalDepenses;
          
          // Formater l'affichage des suppléments avec type et montant
          let supplementDisplay = '';
          if (typeInfo.total_supplements > 0 && typeInfo.supplement_types) {
            supplementDisplay = typeInfo.supplement_types;
          } else if (typeInfo.total_supplements > 0) {
            supplementDisplay = `+${Utils.formatAmount(typeInfo.total_supplements).replace(' FCFA', '')}`;
          } else {
            supplementDisplay = '-';
          }
          
          rowParts.push(`
            <tr>
              <td class="date-cell">${formattedDate}</td>
              <td class="livreur-cell">${Utils.escapeHtml(livreur)}</td>
              <td class="data-cell">${typeInfo.type}</td>
              <td class="data-cell">${typeInfo.count}</td>
              <td class="data-cell">${typeAmount ? Utils.formatAmount(typeAmount).replace(' FCFA', '') : '0'}</td>
              <td class="data-cell supplement-cell">${supplementDisplay}</td>
              <td class="data-cell">${displayCarburant ? Utils.formatAmount(displayCarburant).replace(' FCFA', '') : '0'}</td>
              <td class="data-cell">${displayReparations ? Utils.formatAmount(displayReparations).replace(' FCFA', '') : '0'}</td>
              <td class="data-cell">${displayPolice ? Utils.formatAmount(displayPolice).replace(' FCFA', '') : '0'}</td>
              <td class="data-cell">${displayAutres ? Utils.formatAmount(displayAutres).replace(' FCFA', '') : '0'}</td>
              <td class="data-cell total-depenses">${displayTotalDepenses ? Utils.formatAmount(displayTotalDepenses).replace(' FCFA', '') : '0'}</td>
              <td class="data-cell">${displayKmParcourus}</td>
              <td class="data-cell gps-km-cell">${displayGpsKm}</td>
              <td class="data-cell benefice ${benefice >= 0 ? 'benefice-positif' : 'benefice-negatif'}">${Utils.formatAmount(benefice).replace(' FCFA', '')}</td>
            </tr>
          `);
        });
      });
    });

    const RENDER_LIMIT = 500;
    const hasMoreRows = rowParts.length > RENDER_LIMIT;
    const initialRows = hasMoreRows ? rowParts.slice(0, RENDER_LIMIT).join('') : rowParts.join('');

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
      const totalGpsKm = dailyGpsData
        .filter(item => item.livreur_username === livreur)
        .reduce((sum, item) => sum + parseFloat(item.total_distance_km || 0), 0);
      const totalBenefice = totalMontant - totalDepensesLivreur;
      
      // Calculer la somme totale des suppléments pour ce livreur
      let totalSupplements = 0;
      Object.keys(typeDataMap).forEach(key => {
        if (key.includes(`_${livreur}_`)) {
          const typeInfo = typeDataMap[key];
          totalSupplements += typeInfo.total_supplements || 0;
        }
      });
      
      const supplementTotalDisplay = totalSupplements > 0 ? `+${Utils.formatAmount(totalSupplements).replace(' FCFA', '')}` : '-';
      
      totalRows += `
        <tr class="total-row">
          <td class="total-cell"><strong>TOTAL</strong></td>
          <td class="total-cell"><strong>${Utils.escapeHtml(livreur)}</strong></td>
          <td class="total-cell"><strong>-</strong></td>
          <td class="total-cell"><strong>${totalCommandes}</strong></td>
          <td class="total-cell"><strong>${totalMontant ? Utils.formatAmount(totalMontant).replace(' FCFA', '') : '0'}</strong></td>
          <td class="total-cell supplement-total"><strong>${supplementTotalDisplay}</strong></td>
          <td class="total-cell"><strong>${totalCarburant ? Utils.formatAmount(totalCarburant).replace(' FCFA', '') : '0'}</strong></td>
          <td class="total-cell"><strong>${totalReparations ? Utils.formatAmount(totalReparations).replace(' FCFA', '') : '0'}</strong></td>
          <td class="total-cell"><strong>${totalPolice ? Utils.formatAmount(totalPolice).replace(' FCFA', '') : '0'}</strong></td>
          <td class="total-cell"><strong>${totalAutres ? Utils.formatAmount(totalAutres).replace(' FCFA', '') : '0'}</strong></td>
          <td class="total-cell total-depenses"><strong>${totalDepensesLivreur ? Utils.formatAmount(totalDepensesLivreur).replace(' FCFA', '') : '0'}</strong></td>
          <td class="total-cell"><strong>${totalKm}</strong></td>
          <td class="total-cell gps-total-cell"><strong>${Math.round(totalGpsKm * 100) / 100}</strong></td>
          <td class="total-cell benefice ${totalBenefice >= 0 ? 'benefice-positif' : 'benefice-negatif'}"><strong>${Utils.formatAmount(totalBenefice).replace(' FCFA', '')}</strong></td>
        </tr>
      `;
    });

    // Filtre Type et Livreur (client-side)
    const filterHtml = `
      <div class="table-filters" style="padding:8px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <div style="display:flex;gap:8px;align-items:center;">
          <label for="type-filter" style="font-weight:600;">Type:</label>
          <select id="type-filter" class="form-control" style="max-width:220px;">
            <option value="">Tous</option>
            <option value="MLC simple">MLC simple</option>
            <option value="MLC avec abonnement">MLC abonnement</option>
            <option value="MATA client">MATA client</option>
            <option value="MATA interne">MATA interne</option>
            <option value="AUTRES">Autres</option>
          </select>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <label for="livreur-filter" style="font-weight:600;">Livreur:</label>
          <select id="livreur-filter" class="form-control" style="max-width:200px;">
            <option value="">Tous</option>
            ${livreurs.map(livreur => `<option value="${Utils.escapeHtml(livreur)}">${Utils.escapeHtml(livreur)}</option>`).join('')}
          </select>
        </div>
      </div>`;

    const table = `
      <div class="monthly-detailed-table-container">
        ${filterHtml}
        <table class="monthly-detailed-table">
          <thead>
            <tr class="main-header">
              ${headers}
            </tr>
          </thead>
          <tbody>
            ${initialRows}
          </tbody>
          <tfoot>
            ${totalRows}
          </tfoot>
        </table>
        ${hasMoreRows ? `
          <div class="table-actions" style="padding:8px;text-align:center;">
            <button id="show-all-monthly-rows" class="btn btn-sm btn-outline-secondary">Afficher toutes les lignes (${rowParts.length})</button>
          </div>
        ` : ''}
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
        /* Styles pour la colonne GPS */
        .gps-km-cell {
          background-color: #e8f5e8 !important;
          color: #2b6cb0;
          font-weight: bold;
        }
        .gps-total-cell {
          background-color: #d4edda !important;
          color: #155724;
          font-weight: bold;
        }
      </style>
    `;

    container.innerHTML = table;

    const showAllBtn = document.getElementById('show-all-monthly-rows');
    if (showAllBtn) {
      showAllBtn.addEventListener('click', () => {
        const tbody = container.querySelector('.monthly-detailed-table tbody');
        if (tbody) {
          tbody.innerHTML = rowParts.join('');
          showAllBtn.remove();
        }
      });
    }

    // Configuration des filtres (type et livreur)
    const typeFilter = document.getElementById('type-filter');
    const livreurFilter = document.getElementById('livreur-filter');
    
    const applyFilters = () => {
      const typeValue = typeFilter ? typeFilter.value : '';
      const livreurValue = livreurFilter ? livreurFilter.value : '';
      const tbody = container.querySelector('.monthly-detailed-table tbody');
      if (!tbody) return;
      
      const rows = Array.from(tbody.querySelectorAll('tr'));
      rows.forEach(tr => {
        const typeCell = tr.children[2]; // Colonne Type
        const livreurCell = tr.children[1]; // Colonne Livreur
        
        if (!typeCell || !livreurCell) return;
        
        const typeText = (typeCell.textContent || '').trim();
        const livreurText = (livreurCell.textContent || '').trim();
        
        // Vérifier les deux filtres
        const typeMatch = !typeValue || typeValue === '' || typeText === typeValue;
        const livreurMatch = !livreurValue || livreurValue === '' || livreurText === livreurValue;
        
        // Afficher seulement si les deux critères sont respectés
        tr.style.display = typeMatch && livreurMatch ? '' : 'none';
      });
    };
    
    if (typeFilter) {
      typeFilter.addEventListener('change', applyFilters);
    }
    if (livreurFilter) {
      livreurFilter.addEventListener('change', applyFilters);
    }
  }

  static displayMonthlyOrdersByType(monthlyStatsByType) {
    const container = document.getElementById('monthly-orders-by-type-container');
    
    if (!monthlyStatsByType || monthlyStatsByType.length === 0) {
      container.innerHTML = '<p class="text-center">Aucune commande pour ce mois</p>';
      return;
    }

    // Mapping des types avec leurs icônes et classes CSS
    const typeMapping = {
      'MATA client': { icon: '🛒', class: 'mata-client' },
      'MATA interne': { icon: '🏢', class: 'mata-interne' },
      'MLC avec abonnement': { icon: '🎫', class: 'mlc-avec-abonnement' },
      'MLC simple': { icon: '📦', class: 'mlc-simple' },
      'AUTRE': { icon: '📋', class: 'autre' }
    };

    container.innerHTML = monthlyStatsByType.map(stat => {
      const mapping = typeMapping[stat.order_type] || { icon: '❓', class: 'autre' };
      return `
        <div class="order-type-card ${mapping.class}">
          <div class="order-type-icon">${mapping.icon}</div>
          <div class="order-type-name">${stat.order_type}</div>
          <div class="order-type-count">${stat.count}</div>
          <div class="order-type-amount">${Utils.formatAmount(stat.total_amount)}</div>
        </div>
      `;
    }).join('');
  }

  static displayMonthlySummaryByType(summary, gpsData = []) {
    const container = document.getElementById('monthly-summary-by-type-container');
    
    if (summary.length === 0) {
      container.innerHTML = '<p class="text-center">Aucune donnée disponible</p>';
      return;
    }

    // Créer un map des données GPS par nom de livreur
    const gpsMap = {};
    gpsData.forEach(gps => {
      gpsMap[gps.livreur_username] = gps;
    });

    // Calculer le bénéfice pour chaque livreur et ajouter les données GPS
    const enrichedSummary = summary.map(item => ({
      ...item,
      benefice: (parseFloat(item.total_montant) || 0) - (parseFloat(item.total_depenses) || 0),
      gpsData: gpsMap[item.livreur] || null
    }));

    container.innerHTML = `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Livreur</th>
              <th>Total Cmd</th>
              <th>Total Courses</th>
              <th>Type</th>
              <th>Distance GPS (km)</th>
              <th>Dépenses</th>
              <th>Bénéfice</th>
            </tr>
          </thead>
          <tbody>
            ${enrichedSummary.map(item => {
              const statsByType = item.statsByType || {};
              // Déterminer le type dominant
              const candidates = ['MLC avec abonnement','MLC simple','MATA client','MATA interne','AUTRE'];
              let best = null; let bestCount = -1;
              candidates.forEach(k => {
                const c = statsByType[k] ? parseInt(statsByType[k].count) || 0 : 0;
                if (c > bestCount) { best = k; bestCount = c; }
              });
              const typeLabel = best === 'AUTRE' ? 'AUTRES' : (best || '-');
              return `
                <tr>
                  <td><strong>${Utils.escapeHtml(item.livreur)}</strong></td>
                  <td>${item.nombre_commandes}</td>
                  <td>${Utils.formatAmount(item.total_montant)}</td>
                  <td class="stats-cell">${typeLabel}</td>
                  <td class="gps-distance-cell">
                    ${item.gpsData ? `<span class="gps-distance">📍 ${Math.round(item.gpsData.total_distance_km * 100) / 100}</span>` : '<span class="no-gps-data">-</span>'}
                  </td>
                  <td>${Utils.formatAmount(item.total_depenses)}</td>
                  <td class="benefice ${item.benefice >= 0 ? 'benefice-positif' : 'benefice-negatif'}">${Utils.formatAmount(item.benefice)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      <style>
        .stats-cell {
          text-align: center;
          vertical-align: middle;
        }
        .stats-cell .count {
          font-weight: bold;
          color: #333;
          font-size: 1.1em;
        }
        .stats-cell .amount {
          font-size: 0.85em;
          color: #666;
        }
        .stats-cell .no-data {
          color: #999;
          font-style: italic;
        }
        .benefice-positif {
          background-color: #d4edda !important;
          color: #155724;
          font-weight: bold;
        }
        .benefice-negatif {
          background-color: #f8d7da !important;
          color: #721c24;
          font-weight: bold;
        }
        .gps-distance-cell {
          text-align: center;
          vertical-align: middle;
        }
        .gps-distance {
          font-weight: bold;
          color: #2b6cb0;
          font-size: 1.1em;
        }
        .no-gps-data {
          color: #999;
          font-style: italic;
        }
        .table-filters {
          background-color: #f8f9fa;
          border-radius: 6px;
          margin-bottom: 1rem;
        }
        .table-filters select {
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 6px 12px;
          font-size: 14px;
        }
        .table-filters label {
          margin-bottom: 0;
          color: #495057;
        }
      </style>
    `;
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

    // Gestionnaire pour l'export Excel récapitulatif par livreur
    const exportSummaryBtn = document.getElementById('export-monthly-summary-excel');
    if (exportSummaryBtn) {
      exportSummaryBtn.addEventListener('click', () => {
        const monthInput = document.getElementById('monthly-dashboard-date-filter');
        const selectedMonth = monthInput.value || new Date().toISOString().slice(0, 7);
        ApiClient.exportMonthlySummaryToExcel(selectedMonth);
        ToastManager.success('Export Excel récapitulatif en cours...');
      });
    }
  }
}
// ===== GESTIONNAIRE DE TABLEAU DE BORD MATA MENSUEL =====
class MataMonthlyDashboardManager {
  static allOrders = [];

  static async loadMataMonthlyDashboard() {
    try {
      AppState.isLoading = true;
      
      // Afficher le spinner
      this.showSpinner();
      
      // Obtenir le mois sélectionné ou le mois actuel
      const monthInput = document.getElementById('mata-monthly-date-filter');
      const selectedMonth = monthInput.value || new Date().toISOString().slice(0, 7);
      
      // Mettre à jour le champ de date si nécessaire
      if (!monthInput.value) {
        monthInput.value = selectedMonth;
      }

      // Charger les données MATA mensuelles
      const response = await ApiClient.getMataMonthlyDashboard(selectedMonth);
      
      // Stocker toutes les commandes pour le filtrage
      this.allOrders = response.orders || [];
      
      // Peupler le filtre des points de vente
      this.populatePointVenteFilter();
      
      // Appliquer le filtrage et afficher les données
      this.applyFilters();
      
    } catch (error) {
      console.error('Erreur lors du chargement du tableau de bord MATA mensuel:', error);
      ToastManager.error('Erreur lors du chargement des données MATA');
    } finally {
      AppState.isLoading = false;
      // Masquer le spinner
      this.hideSpinner();
    }
  }

  static showSpinner() {
    const spinner = document.getElementById('mata-monthly-spinner');
    const content = document.querySelector('.mata-monthly-dashboard-content .stats-grid');
    if (spinner) {
      spinner.style.display = 'block';
    }
    if (content) {
      content.style.display = 'none';
    }
  }

  static hideSpinner() {
    const spinner = document.getElementById('mata-monthly-spinner');
    const content = document.querySelector('.mata-monthly-dashboard-content .stats-grid');
    if (spinner) {
      spinner.style.display = 'none';
    }
    if (content) {
      content.style.display = 'block';
    }
  }

  static populatePointVenteFilter() {
    const pointVenteFilter = document.getElementById('mata-point-vente-filter');
    const livreurFilter = document.getElementById('mata-livreur-filter');
    
    // Extraire tous les points de vente uniques
    const pointsDeVente = [...new Set(this.allOrders
      .map(order => order.point_de_vente)
      .filter(pointVente => pointVente && pointVente.trim() !== '')
    )].sort();
    
    // Extraire tous les livreurs uniques
    const livreurs = [...new Set(this.allOrders
      .map(order => order.livreur)
      .filter(livreur => livreur && livreur.trim() !== '')
    )].sort();
    
    // Réinitialiser le filtre point de vente
    pointVenteFilter.innerHTML = '<option value="">Tous les points de vente</option>';
    
    // Ajouter les options point de vente
    pointsDeVente.forEach(pointVente => {
      const option = document.createElement('option');
      option.value = pointVente;
      option.textContent = pointVente;
      pointVenteFilter.appendChild(option);
    });
    
    // Réinitialiser le filtre livreur
    livreurFilter.innerHTML = '<option value="">Tous les livreurs</option>';
    
    // Ajouter les options livreur
    livreurs.forEach(livreur => {
      const option = document.createElement('option');
      option.value = livreur;
      option.textContent = livreur;
      livreurFilter.appendChild(option);
    });
  }

  static applyFilters() {
    const pointVenteFilter = document.getElementById('mata-point-vente-filter');
    const selectedPointVente = pointVenteFilter.value;
    const livreurFilter = document.getElementById('mata-livreur-filter');
    const selectedLivreur = livreurFilter.value;
    const interneFilter = document.getElementById('mata-interne-filter');
    const selectedInterne = interneFilter ? interneFilter.value : '';
    const dateFilter = document.getElementById('mata-date-range-filter');
    const selectedDate = dateFilter.value;
    const phoneFilter = document.getElementById('mata-phone-filter');
    const phoneSearch = phoneFilter.value.trim();
    
    // Filtrer les commandes
    let filteredOrders = this.allOrders;
    
    // Filtrer par point de vente
    if (selectedPointVente) {
      filteredOrders = filteredOrders.filter(order => 
        order.point_de_vente === selectedPointVente
      );
    }
    
    // Filtrer par livreur
    if (selectedLivreur) {
      filteredOrders = filteredOrders.filter(order => 
        order.livreur === selectedLivreur
      );
    }
    
    // Filtrer par commande interne
    if (selectedInterne === 'oui') {
      filteredOrders = filteredOrders.filter(order => order.interne === true);
    } else if (selectedInterne === 'non') {
      filteredOrders = filteredOrders.filter(order => !order.interne);
    }
    
    // Filtrer par date
    if (selectedDate) {
      filteredOrders = filteredOrders.filter(order => {
        // Comparer directement les chaînes de dates pour éviter les problèmes de fuseau horaire
        let orderDate = order.date;
        
        // Si order.date est un objet Date, le convertir en format YYYY-MM-DD
        if (orderDate instanceof Date) {
          const year = orderDate.getFullYear();
          const month = String(orderDate.getMonth() + 1).padStart(2, '0');
          const day = String(orderDate.getDate()).padStart(2, '0');
          orderDate = `${year}-${month}-${day}`;
        } else if (typeof orderDate === 'string') {
          // Si c'est déjà une chaîne, extraire juste la partie date (YYYY-MM-DD)
          orderDate = orderDate.split('T')[0]; // Enlever l'heure si présente
        }
        
        return orderDate === selectedDate;
      });
    }
    
    // Filtrer par numéro de téléphone
    if (phoneSearch) {
      filteredOrders = filteredOrders.filter(order => 
        order.phone_number && order.phone_number.toLowerCase().includes(phoneSearch.toLowerCase())
      );
    }
    
    // Calculer les statistiques filtrées (en excluant les commandes internes)
    const externalFilteredOrders = filteredOrders.filter(order => !order.interne);
    const filteredStats = {
      total_commandes: externalFilteredOrders.length,
      total_montant: externalFilteredOrders.reduce((sum, order) => sum + (parseFloat(order.montant_commande) || 0), 0),
      livreurs_actifs: [...new Set(externalFilteredOrders.map(order => order.livreur))].length
    };
    
    // Mettre à jour l'affichage
    this.updateMataStats(filteredStats, new Date().toISOString().slice(0, 7));
    this.displayMataOrdersTable(filteredOrders, new Date().toISOString().slice(0, 7));
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
    
    // Afficher/masquer le bouton d'export selon s'il y a des données
    const exportBtn = document.getElementById('export-mata-monthly-excel-table');
    if (exportBtn) {
      if (orders && orders.length > 0) {
        exportBtn.style.display = 'inline-flex';
      } else {
        exportBtn.style.display = 'none';
      }
    }
    
    if (!orders || orders.length === 0) {
      container.innerHTML = '<p class="no-data">Aucune commande MATA trouvée pour ce mois.</p>';
      return;
    }

    // Debug: log des données reçues
    console.log('🔍 Debug orders data:', orders.slice(0, 2)); // Log des 2 premières commandes
    console.log('🔍 Debug point_de_vente values:', orders.map(o => ({ client_name: o.client_name, point_de_vente: o.point_de_vente })).slice(0, 5));
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
              <th>Nom du client</th>
              <th>Adresse de départ</th>
              <th>Adresse de destination</th>
              <th>Point de vente</th>
              <th>Montant commande (FCFA)</th>
              <th>Livreur assigné</th>
              <th>Type client</th>
              <th>Commande interne</th>
              <th>Comment nous avez-vous connu ?</th>
              <th>Commentaire client</th>
              <th>Note Service de livraison</th>
              <th>Note Qualité des produits</th>
              <th>Note Niveau de prix</th>
              <th>Note Service Commercial</th>
              <th>Note globale moyenne</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${orders.map(order => {
              // Calculer la note moyenne avec traitement sécurisé des valeurs
              const serviceRating = (order.service_rating !== null && order.service_rating !== undefined && order.service_rating !== '') ? parseFloat(order.service_rating) : null;
              const qualityRating = (order.quality_rating !== null && order.quality_rating !== undefined && order.quality_rating !== '') ? parseFloat(order.quality_rating) : null;
              const priceRating = (order.price_rating !== null && order.price_rating !== undefined && order.price_rating !== '') ? parseFloat(order.price_rating) : null;
              const commercialRating = (order.commercial_service_rating !== null && order.commercial_service_rating !== undefined && order.commercial_service_rating !== '') ? parseFloat(order.commercial_service_rating) : null;
              
              // Debug spécifique pour cette commande
              if (order.service_rating || order.quality_rating || order.price_rating || order.commercial_service_rating) {
                console.log(`🔍 Order ${order.id} ratings:`, {
                  raw: { service: order.service_rating, quality: order.quality_rating, price: order.price_rating, commercial: order.commercial_service_rating },
                  parsed: { service: serviceRating, quality: qualityRating, price: priceRating, commercial: commercialRating }
                });
              }
              
              let averageRating = 'NA';
              // Gestion de la transition : calcul sur 3 ou 4 colonnes selon les données disponibles
              if (serviceRating !== null && qualityRating !== null && priceRating !== null && 
                  !isNaN(serviceRating) && !isNaN(qualityRating) && !isNaN(priceRating)) {
                
                if (commercialRating !== null && !isNaN(commercialRating)) {
                  // Calcul sur 4 colonnes (après migration)
                  const calculated = ((serviceRating + qualityRating + priceRating + commercialRating) / 4);
                  averageRating = calculated.toFixed(1);
                  console.log(`🔍 Order ${order.id} average calculation (4 cols): ${serviceRating} + ${qualityRating} + ${priceRating} + ${commercialRating} / 4 = ${calculated} → ${averageRating}`);
                } else {
                  // Calcul sur 3 colonnes (avant migration)
                  const calculated = ((serviceRating + qualityRating + priceRating) / 3);
                  averageRating = calculated.toFixed(1);
                  console.log(`🔍 Order ${order.id} average calculation (3 cols): ${serviceRating} + ${qualityRating} + ${priceRating} / 3 = ${calculated} → ${averageRating}`);
                }
              }
              
              return `
              <tr data-order-id="${order.id}" class="${order.interne ? 'internal-order' : ''}">
                <td>${new Date(order.date).toLocaleDateString('fr-FR')}</td>
                <td>${Utils.escapeHtml(order.phone_number)}</td>
                <td>${Utils.escapeHtml(order.client_name)}</td>
                <td>${order.adresse_source ? Utils.escapeHtml(order.adresse_source) : '-'}</td>
                <td>${order.adresse_destination ? Utils.escapeHtml(order.adresse_destination) : '-'}</td>
                <td>${order.point_de_vente ? Utils.escapeHtml(order.point_de_vente) : '-'}</td>
                <td>${Utils.formatAmount(order.montant_commande || 0)}</td>
                <td>${Utils.escapeHtml(order.livreur)}</td>
                <td>
                  <span class="client-type-badge ${order.is_new_client ? 'new-client' : 'recurring-client'}" title="${order.is_new_client ? 'Première commande' : `${order.orders_this_month_count} commande(s) ce mois, ${order.total_orders_count} commande(s) au total`}">
                    ${order.is_new_client ? '🆕 Nouveau' : `🔄 Récurrent (${order.orders_this_month_count}/${order.total_orders_count})`}
                  </span>
                </td>
                <td>
                  <span class="interne-badge ${order.interne ? 'interne-yes' : 'interne-no'}">
                    ${order.interne ? 'Oui' : 'Non'}
                  </span>
                </td>
                <td>
                  <div class="source-connaissance-cell">
                    <span class="source-display" ${!order.source_connaissance ? 'style="color: #999; font-style: italic;"' : ''}>
                      ${order.source_connaissance ? Utils.escapeHtml(order.source_connaissance) : 'Non renseigné'}
                    </span>
                    <select class="source-edit hidden" data-order-id="${order.id}">
                      <option value="">-- Sélectionner --</option>
                      <option value="Bouche-à-oreille" ${order.source_connaissance === 'Bouche-à-oreille' ? 'selected' : ''}>Bouche-à-oreille</option>
                      <option value="Réseaux sociaux (Facebook)" ${order.source_connaissance === 'Réseaux sociaux (Facebook)' ? 'selected' : ''}>Réseaux sociaux (Facebook)</option>
                      <option value="Réseaux sociaux (Instagram)" ${order.source_connaissance === 'Réseaux sociaux (Instagram)' ? 'selected' : ''}>Réseaux sociaux (Instagram)</option>
                      <option value="Réseaux sociaux (TikTok)" ${order.source_connaissance === 'Réseaux sociaux (TikTok)' ? 'selected' : ''}>Réseaux sociaux (TikTok)</option>
                      <option value="Réseaux sociaux (WhatsApp)" ${order.source_connaissance === 'Réseaux sociaux (WhatsApp)' ? 'selected' : ''}>Réseaux sociaux (WhatsApp)</option>
                      <option value="Publicité en ligne" ${order.source_connaissance === 'Publicité en ligne' ? 'selected' : ''}>Publicité en ligne</option>
                      <option value="Publicité physique" ${order.source_connaissance === 'Publicité physique' ? 'selected' : ''}>Publicité physique</option>
                      <option value="Site web" ${order.source_connaissance === 'Site web' ? 'selected' : ''}>Site web</option>
                      <option value="Client régulier" ${order.source_connaissance === 'Client régulier' ? 'selected' : ''}>Client régulier</option>
                      <option value="Recommandation" ${order.source_connaissance === 'Recommandation' ? 'selected' : ''}>Recommandation</option>
                      <option value="Enseigne mata" ${order.source_connaissance === 'Enseigne mata' ? 'selected' : ''}>Enseigne mata</option>
                      <option value="Autre" ${order.source_connaissance && !['Bouche-à-oreille', 'Réseaux sociaux (Facebook)', 'Réseaux sociaux (Instagram)', 'Réseaux sociaux (TikTok)', 'Réseaux sociaux (WhatsApp)', 'Publicité en ligne', 'Publicité physique', 'Site web', 'Client régulier', 'Recommandation', 'Enseigne mata'].includes(order.source_connaissance) ? 'selected' : ''}>Autre</option>
                    </select>
                    <input type="text" class="source-autre-input hidden" placeholder="Préciser..." value="${order.source_connaissance && !['Bouche-à-oreille', 'Réseaux sociaux (Facebook)', 'Réseaux sociaux (Instagram)', 'Réseaux sociaux (TikTok)', 'Réseaux sociaux (WhatsApp)', 'Publicité en ligne', 'Publicité physique', 'Site web', 'Client régulier', 'Recommandation', 'Enseigne mata'].includes(order.source_connaissance) ? order.source_connaissance : ''}" />
                  </div>
                </td>
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
                    ${!order.interne ? `<button class="btn-edit-rating" data-type="service" data-order-id="${order.id}" title="Modifier la note">✏️</button>` : ''}
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
                    ${!order.interne ? `<button class="btn-edit-rating" data-type="quality" data-order-id="${order.id}" title="Modifier la note">✏️</button>` : ''}
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
                    ${!order.interne ? `<button class="btn-edit-rating" data-type="price" data-order-id="${order.id}" title="Modifier la note">✏️</button>` : ''}
                  </div>
                  <div class="rating-edit-group hidden">
                    <input type="number" class="rating-edit" min="0" max="10" step="0.1" value="${priceRating || ''}" data-type="price">
                    <div class="rating-buttons">
                      <button class="btn btn-xs btn-success save-rating-btn" data-type="price" data-order-id="${order.id}">✓</button>
                      <button class="btn btn-xs btn-secondary cancel-rating-btn" data-type="price" data-order-id="${order.id}">✗</button>
                    </div>
                  </div>
                </td>
                <td class="rating-cell">
                  <div class="rating-display">
                    <span class="rating-value" ${commercialRating === null ? 'style="color: #999; font-style: italic;"' : ''}>
                      ${commercialRating !== null ? commercialRating + '/10' : 'NA'}
                    </span>
                    ${!order.interne ? `<button class="btn-edit-rating" data-type="commercial" data-order-id="${order.id}" title="Modifier la note">✏️</button>` : ''}
                  </div>
                  <div class="rating-edit-group hidden">
                    <input type="number" class="rating-edit" min="0" max="10" step="0.1" value="${commercialRating || ''}" data-type="commercial">
                    <div class="rating-buttons">
                      <button class="btn btn-xs btn-success save-rating-btn" data-type="commercial" data-order-id="${order.id}">✓</button>
                      <button class="btn btn-xs btn-secondary cancel-rating-btn" data-type="commercial" data-order-id="${order.id}">✗</button>
                    </div>
                  </div>
                </td>
                <td class="average-rating-cell">
                  <span class="average-rating ${averageRating !== 'NA' ? (averageRating >= 7 ? 'good' : averageRating >= 5 ? 'average' : 'poor') : ''}">
                    ${averageRating}${averageRating !== 'NA' ? '/10' : ''}
                  </span>
                </td>
                <td class="mata-actions">
                  <div class="action-buttons">
                    <button class="btn btn-sm btn-info btn-client-history" data-phone="${order.phone_number}" data-client-name="${Utils.escapeHtml(order.client_name)}" title="Voir l'historique des commandes">
                      <span class="icon">📋</span>
                      Détails
                    </button>
                    <button class="btn btn-sm btn-success btn-view-attachments hidden" data-order-id="${order.id}" title="Voir les pièces jointes">
                      <span class="icon">📎</span>
                      Pièces jointes
                    </button>
                  ${order.interne ? `
                    <span class="internal-notice" style="color: #999; font-style: italic; font-size: 0.85rem;">Commande interne</span>
                  ` : `
                    <button class="btn btn-sm btn-primary btn-edit-order" data-order-id="${order.id}">
                      <span class="icon">✏️</span>
                      Modifier
                    </button>
                    <button class="btn btn-sm btn-success btn-save-order hidden" data-order-id="${order.id}">
                      <span class="icon">💾</span>
                      Sauvegarder
                    </button>
                    <button class="btn btn-sm btn-secondary btn-cancel-order hidden" data-order-id="${order.id}">
                      <span class="icon">❌</span>
                      Annuler
                    </button>
                  `}
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
        }
        .interne-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: bold;
          text-align: center;
          min-width: 40px;
        }
        .interne-yes {
          background-color: #ff6b6b;
          color: white;
        }
        .interne-no {
          background-color: #51cf66;
          color: white;
        }
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
        .mata-orders-table td:nth-child(6) { min-width: 120px; }
        .mata-orders-table td:nth-child(7) { min-width: 120px; text-align: right; }
        .mata-orders-table td:nth-child(8) { min-width: 100px; }
        .mata-orders-table td:nth-child(9) { min-width: 200px; }
        .mata-orders-table td:nth-child(10) { min-width: 100px; }
        .mata-orders-table td:nth-child(11) { min-width: 100px; }
        .mata-orders-table td:nth-child(12) { min-width: 100px; }
        .mata-orders-table td:nth-child(13) { min-width: 100px; }
        .mata-orders-table td:nth-child(14) { min-width: 150px; }
      </style>
    `;

    container.innerHTML = table;
    
    // Ajouter les event listeners pour l'édition des commentaires et des notes
    this.setupCommentEditListeners();
    this.setupRatingEditListeners();
    
    // Charger les boutons de pièces jointes
    this.loadMataAttachmentsButtons();
  }
  
  static async loadMataAttachmentsButtons() {
    const buttons = document.querySelectorAll('.btn-view-attachments');
    
    for (const button of buttons) {
      const orderId = button.dataset.orderId;
      if (typeof AttachmentsManager !== 'undefined') {
        const count = await AttachmentsManager.getAttachmentsCount(orderId);
        if (count > 0) {
          button.classList.remove('hidden');
          button.innerHTML = `<span class="icon">📎</span> Pièces jointes (${count})`;
          
          // Ajouter l'événement de clic
          button.addEventListener('click', (e) => {
            e.stopPropagation();
            OrderManager.viewOrderDetails(orderId);
          });
        }
      }
    }
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
    let commercialRating = null;

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
            else if (type === 'commercial') commercialRating = numValue;
          }
        }
      }
    });

    // Calculer la moyenne avec gestion de la transition
    let averageRating = 'NA';
    if (serviceRating !== null && qualityRating !== null && priceRating !== null) {
      if (commercialRating !== null) {
        // Calcul sur 4 colonnes (après migration)
        averageRating = ((serviceRating + qualityRating + priceRating + commercialRating) / 4).toFixed(1);
      } else {
        // Calcul sur 3 colonnes (avant migration)
        averageRating = ((serviceRating + qualityRating + priceRating) / 3).toFixed(1);
      }
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

    // Gestionnaire pour le filtre par point de vente
    const pointVenteFilter = document.getElementById('mata-point-vente-filter');
    if (pointVenteFilter) {
      pointVenteFilter.addEventListener('change', () => {
        this.applyFilters();
      });
    }

    // Gestionnaire pour le filtre par livreur
    const livreurFilter = document.getElementById('mata-livreur-filter');
    if (livreurFilter) {
      livreurFilter.addEventListener('change', () => {
        this.applyFilters();
      });
    }

    // Gestionnaire pour le filtre par commande interne
    const interneFilter = document.getElementById('mata-interne-filter');
    if (interneFilter) {
      interneFilter.addEventListener('change', () => {
        this.applyFilters();
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

    // Gestionnaire pour le filtre par date
    const dateFilterEl = document.getElementById('mata-date-range-filter');
    if (dateFilterEl) {
      dateFilterEl.addEventListener('change', () => {
        this.applyFilters();
      });
    }

    // Gestionnaire pour le filtre par téléphone (avec debounce pour éviter trop de requêtes)
    const phoneFilterEl = document.getElementById('mata-phone-filter');
    if (phoneFilterEl) {
      phoneFilterEl.addEventListener('input', Utils.debounce(() => {
        this.applyFilters();
      }, 300));
    }

    // Gestionnaire pour le bouton "Effacer filtres"
    const clearFiltersBtn = document.getElementById('mata-clear-filters');
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => {
        // Réinitialiser tous les filtres
        const pointVenteFilter = document.getElementById('mata-point-vente-filter');
        const livreurFilter = document.getElementById('mata-livreur-filter');
        const interneFilter = document.getElementById('mata-interne-filter');
        const dateFilter = document.getElementById('mata-date-range-filter');
        const phoneFilter = document.getElementById('mata-phone-filter');
        
        if (pointVenteFilter) pointVenteFilter.value = '';
        if (livreurFilter) livreurFilter.value = '';
        if (interneFilter) interneFilter.value = '';
        if (dateFilter) dateFilter.value = '';
        if (phoneFilter) phoneFilter.value = '';
        
        // Réappliquer les filtres (qui seront vides maintenant)
        this.applyFilters();
      });
    }
  }
}

// ===== GESTIONNAIRE DES COMMANDES =====
class OrderManager {
  /**
   * Pré-remplir le formulaire de commande avec des données
   */
  static prefillOrderForm(orderData) {
    try {
      // Sélectionner le type de commande
      if (orderData.order_type) {
        const orderTypeSelect = document.getElementById('order-type');
        if (orderTypeSelect) {
          orderTypeSelect.value = orderData.order_type;
          orderTypeSelect.dispatchEvent(new Event('change')); // Trigger les events pour afficher les bons champs
        }
      }

      // Remplir les champs
      if (orderData.client_name) {
        document.getElementById('client-name').value = orderData.client_name;
      }
      if (orderData.phone_number) {
        document.getElementById('phone-number').value = orderData.phone_number;
      }
      if (orderData.source_address) {
        document.getElementById('adresse-source').value = orderData.source_address;
      }
      if (orderData.destination_address) {
        document.getElementById('adresse-destination').value = orderData.destination_address;
      }
      
      // Pré-remplir le point de vente si fourni
      if (orderData.point_vente) {
        try {
          const pointVenteSelect = document.getElementById('point-vente');
          if (pointVenteSelect) {
            // Vérifier que la valeur existe dans les options
            const optionExists = Array.from(pointVenteSelect.options).some(
              option => option.value === orderData.point_vente
            );
            if (optionExists) {
              pointVenteSelect.value = orderData.point_vente;
              console.log('✅ Point de vente pré-rempli:', orderData.point_vente);
            } else {
              console.warn('⚠️ Point de vente non trouvé dans les options:', orderData.point_vente);
            }
          }
        } catch (error) {
          console.error('Erreur lors du pré-remplissage du point de vente:', error);
          // On continue même en cas d'erreur (fail silently)
        }
      }
      
      if (orderData.course_price) {
        document.getElementById('course-price').value = orderData.course_price;
      }
      if (orderData.basket_amount) {
        const amountField = document.getElementById('amount');
        const amountGroup = document.getElementById('amount-group');
        if (amountField) {
          amountField.value = orderData.basket_amount;
          // Afficher le champ si c'est une commande MATA
          if (amountGroup && orderData.order_type === 'MATA') {
            amountGroup.style.display = 'block';
          }
        }
      }
      if (orderData.comment) {
        document.getElementById('description').value = orderData.comment;
      }

      // Sauvegarder l'ID de la commande en cours pour la marquer comme livrée après
      if (orderData.commande_en_cours_id) {
        sessionStorage.setItem('commande_en_cours_to_complete', orderData.commande_en_cours_id);
      }

      // Afficher un message
      if (window.ToastManager) {
        ToastManager.success('Formulaire pré-rempli depuis la commande en cours');
      }

    } catch (error) {
      console.error('Erreur lors du pré-remplissage du formulaire:', error);
    }
  }

  static async loadOrders(page = 1) {
    try {
      const response = await ApiClient.getOrders(page, 20);
      AppState.orders = response.orders || [];
      AppState.currentOrdersPage = response.pagination?.page || 1;
      AppState.totalOrdersPages = response.pagination?.totalPages || 1;

      this.displayOrders();
      this.updatePagination();
      this.setupOrderEventListeners();
      
      // Peupler le filtre des livreurs
      this.populateLivreurFilter();
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

  static async loadOrdersWithFilters() {
    try {
      const dateFilter = document.getElementById('orders-date-filter').value;
      const livreurFilter = document.getElementById('orders-livreur-filter').value;
      const typeFilter = document.getElementById('orders-type-filter').value;

      let response;
      if (dateFilter) {
        response = await ApiClient.getOrdersByDate(dateFilter);
      } else {
        response = await ApiClient.getOrders(1, 20);
      }

      let orders = response.orders || [];

      // Appliquer le filtre par livreur
      if (livreurFilter) {
        orders = orders.filter(order => order.creator_username === livreurFilter);
      }

      // Appliquer le filtre par type
      if (typeFilter) {
        orders = orders.filter(order => order.order_type === typeFilter);
      }

      AppState.orders = orders;
      this.displayOrders();
      this.setupOrderEventListeners();
      
      // Masquer la pagination pour les filtres
      document.getElementById('orders-pagination').classList.add('hidden');
    } catch (error) {
      console.error('Erreur lors du chargement des commandes avec filtres:', error);
      ToastManager.error('Erreur lors du chargement des commandes');
    }
  }

  static async populateLivreurFilter() {
    try {
      const response = await ApiClient.getActiveLivreurs();
      const livreurs = response.livreurs || [];

      const livreurFilter = document.getElementById('orders-livreur-filter');
      if (livreurFilter) {
        // Garder l'option "Tous les livreurs"
        livreurFilter.innerHTML = '<option value="">Tous les livreurs</option>';
        
        // Ajouter les options livreur
        livreurs.forEach(livreur => {
          const option = document.createElement('option');
          option.value = livreur.username;
          option.textContent = livreur.username;
          livreurFilter.appendChild(option);
        });
      }
    } catch (error) {
      console.error('Erreur lors du chargement des livreurs:', error);
    }
  }

  static clearFilters() {
    document.getElementById('orders-date-filter').value = '';
    document.getElementById('orders-livreur-filter').value = '';
    document.getElementById('orders-type-filter').value = '';
    this.loadOrders();
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

    // Ajouter un message d'information pour les livreurs
    let infoMessage = '';
    if (AppState.user && AppState.user.role === 'LIVREUR') {
      infoMessage = `
        <div class="alert alert-info" style="background-color: #dbeafe; border: 1px solid #3b82f6; border-radius: 8px; padding: 12px; margin-bottom: 20px; color: #1e40af;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">ℹ️</span>
            <span><strong>Information:</strong> Vous pouvez supprimer uniquement vos commandes créées aujourd'hui. Après aujourd'hui, la suppression ne sera plus possible.</span>
          </div>
        </div>
      `;
    }

    container.innerHTML = infoMessage + AppState.orders.map(order => `
      <div class="order-card" data-order-id="${order.id}">
        <div class="order-header">
          <div>
            <div class="order-title">${Utils.escapeHtml(order.client_name)}</div>
            <div class="order-meta">
              ${Utils.formatDate(order.created_at)}
              ${order.creator_username ? ` • Par ${Utils.escapeHtml(order.creator_username)}` : ''}
              ${(order.order_type === 'MLC' && order.is_subscription) ? '<span class="badge badge-subscription">🎫 Abonnement</span>' : ''}
              <span class="attachments-badge" data-order-id="${order.id}"></span>
            </div>
          </div>
          <div class="order-actions">
            <button class="btn btn-sm btn-info order-view-btn" data-order-id="${order.id}">
              <span class="icon">👁️</span>
              Détails
            </button>
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
        <div class="order-body">
          <div class="order-info">
            <span>📞 ${Utils.escapeHtml(order.phone_number)}</span>
            <span>📍 ${Utils.escapeHtml(order.address)}</span>
            ${order.interne ? '<span class="badge-internal" style="background:#dc2626;color:#fff;padding:2px 8px;border-radius:8px;font-size:0.8em;margin-left:8px;">🏢 Interne</span>' : ''}
          </div>
          <div class="order-description">${Utils.escapeHtml(order.description || '')}</div>
          <div class="order-prices">
            <span class="order-price">Course : <b>${Utils.formatAmount(order.course_price)}</b></span>
            ${order.order_type === 'MATA' ? `<span class="order-amount">Montant : <b>${Utils.formatAmount(order.amount)}</b></span>` : ''}
          </div>
          <div class="order-type">Type : <b>${Utils.escapeHtml(order.order_type)}</b></div>
          ${order.order_type === 'MATA' && order.phone_number && !order.interne ? `
            <button class="btn btn-info-outline btn-client-history-card" data-phone="${Utils.escapeHtml(order.phone_number)}" data-client-name="${Utils.escapeHtml(order.client_name)}" style="margin-top: 10px;">
              📋 Voir l'historique de ce client
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');
    
    // Charger les badges de pièces jointes
    this.loadAttachmentsBadges();
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
            ${order.interne ? '<span class="badge-internal" style="margin-left:8px;background:#dc2626;color:#fff;padding:2px 8px;border-radius:8px;font-size:0.8em;vertical-align:middle;">🏢 Interne</span>' : ''}
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

  static async loadAttachmentsBadges() {
    const badges = document.querySelectorAll('.attachments-badge');
    
    for (const badge of badges) {
      const orderId = badge.dataset.orderId;
      if (typeof AttachmentsManager !== 'undefined') {
        const count = await AttachmentsManager.getAttachmentsCount(orderId);
        if (count > 0) {
          badge.innerHTML = AttachmentsManager.getAttachmentBadge(count);
        }
      }
    }
  }

  static async viewOrderDetails(orderId) {
    // Chercher d'abord dans AppState.orders
    // Note: orderId peut être un UUID (string) ou un integer selon le contexte
    let order = AppState.orders.find(o => o.id === orderId || o.id === parseInt(orderId));
    
    // Si pas trouvé, récupérer depuis l'API
    if (!order) {
      try {
        const response = await ApiClient.getOrder(orderId);
        console.log('🔍 viewOrderDetails - Réponse API:', response);
        
        // La réponse du backend est { order: {...} }
        order = response.order || response.data || response;
        
        if (!order || !order.id) {
          console.error('❌ viewOrderDetails - Structure invalide:', response);
          throw new Error('Commande non trouvée');
        }
        
        console.log('✅ viewOrderDetails - Commande récupérée:', order.id, '-', order.client_name);
      } catch (error) {
        console.error('❌ viewOrderDetails - Erreur:', error);
        ToastManager.error('Commande introuvable');
        return;
      }
    }

    // Créer la modal
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 700px;">
        <div class="modal-header">
          <h3>📦 Commande de ${Utils.escapeHtml(order.client_name)}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
          <div class="order-details-full">
            <div class="detail-group">
              <h3>📋 Informations générales</h3>
              <p><strong>Client:</strong> ${Utils.escapeHtml(order.client_name)}</p>
              <p><strong>Téléphone:</strong> ${Utils.escapeHtml(order.phone_number)}</p>
              <p><strong>Type:</strong> ${Utils.escapeHtml(order.order_type)} 
                ${order.interne ? '<span class="badge-internal" style="background:#dc2626;color:#fff;padding:2px 8px;border-radius:8px;font-size:0.8em;">🏢 Interne</span>' : ''}
              </p>
              <p><strong>Date:</strong> ${Utils.formatDate(order.created_at)}</p>
              ${order.creator_username ? `<p><strong>Créé par:</strong> ${Utils.escapeHtml(order.creator_username)}</p>` : ''}
            </div>

            <div class="detail-group">
              <h3> Montants</h3>
              <p><strong>Prix de la course:</strong> ${Utils.formatAmount(order.course_price)}</p>
              ${order.order_type === 'MATA' && order.amount ? `<p><strong>Montant du panier:</strong> ${Utils.formatAmount(order.amount)}</p>` : ''}
            </div>

            ${order.address ? `
              <div class="detail-group">
                <h3>📍 Adresse</h3>
                <p>${Utils.escapeHtml(order.address)}</p>
              </div>
            ` : ''}

            ${order.description ? `
              <div class="detail-group">
                <h3>📝 Description</h3>
                <p>${Utils.escapeHtml(order.description)}</p>
              </div>
            ` : ''}

            <div id="order-attachments-container" class="detail-group">
              <h3>📎 Pièces jointes</h3>
              <div style="text-align: center; padding: 20px;">
                <div class="spinner"></div>
                <p>Chargement...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Fermer la modal
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });

    // Charger les pièces jointes
    const attachmentsContainer = modal.querySelector('#order-attachments-container');
    if (typeof AttachmentsManager !== 'undefined') {
      await AttachmentsManager.renderOrderAttachments(orderId, attachmentsContainer);
    } else {
      attachmentsContainer.innerHTML = '<h3>📎 Pièces jointes</h3><p>Module de pièces jointes non disponible</p>';
    }
  }

  static setupOrderEventListeners() {
    // Boutons de visualisation des détails
    document.querySelectorAll('.order-view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const orderId = e.currentTarget.dataset.orderId;
        this.viewOrderDetails(orderId);
      });
    });

    // Boutons d'édition des commandes
    document.querySelectorAll('.order-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const orderId = e.currentTarget.dataset.orderId;
        this.editOrder(orderId);
      });
    });

    // Boutons pour voir l'historique du client (dans les cartes de commandes)
    document.querySelectorAll('.btn-client-history-card').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const phoneNumber = e.currentTarget.dataset.phone;
        const clientName = e.currentTarget.dataset.clientName;
        
        if (phoneNumber && phoneNumber !== '0000000000') {
          ClientHistoryManager.showClientHistory(phoneNumber, clientName);
        } else {
          ToastManager.warning('Numéro de téléphone non disponible');
        }
      });
    });

    // Boutons de suppression des commandes
    document.querySelectorAll('.order-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const orderId = e.currentTarget.dataset.orderId;
        
        // Récupérer les informations de la commande
        const order = AppState.orders.find(o => o.id === orderId);
        if (!order) {
          ToastManager.error('Commande non trouvée');
          return;
        }
        
        // Créer le contenu de la modale avec les détails de la commande
        const modalContent = `
          <p style="margin-bottom: 20px; color: #374151;">Êtes-vous sûr de vouloir supprimer cette commande ? Cette action est irréversible.</p>
          
          <div style="background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <h4 style="margin: 0 0 16px 0; color: #495057; font-size: 16px;">📋 Détails de la commande</h4>
            
            <div style="margin-bottom: 12px;">
              <strong>👤 Client :</strong> ${Utils.escapeHtml(order.client_name)}
            </div>
            
            <div style="margin-bottom: 12px;">
              <strong>📞 Téléphone :</strong> ${Utils.escapeHtml(order.phone_number)}
            </div>
            
            ${order.creator_username ? `
              <div style="margin-bottom: 12px;">
                <strong>👨‍💼 Livreur :</strong> 
                <span style="background-color: #e3f2fd; color: #1565c0; padding: 4px 8px; border-radius: 4px; font-weight: bold;">
                  ${Utils.escapeHtml(order.creator_username)}
                </span>
              </div>
            ` : ''}
            
            <div style="margin-bottom: 12px;">
              <strong>📦 Type :</strong> 
              <span style="background-color: ${order.order_type === 'MATA' ? '#d4edda' : order.order_type === 'MLC' ? '#cce5ff' : '#fff3cd'}; 
                           color: ${order.order_type === 'MATA' ? '#155724' : order.order_type === 'MLC' ? '#004085' : '#856404'}; 
                           padding: 4px 8px; border-radius: 4px; font-weight: bold;">
                ${order.order_type}
              </span>
            </div>
            
            <div style="margin-bottom: 12px;">
              <strong>🏷️ Course :</strong> 
              <span style="color: #28a745; font-weight: bold; font-size: 16px;">
                ${Utils.formatAmount(order.course_price)}
              </span>
            </div>
            
            ${order.order_type === 'MATA' && order.amount ? `
              <div style="margin-bottom: 12px;">
                <strong>🛒 Montant panier :</strong> 
                <span style="color: #28a745; font-weight: bold;">
                  ${Utils.formatAmount(order.amount)}
                </span>
              </div>
            ` : ''}
            
            ${(order.order_type === 'MLC' && order.is_subscription) ? `
              <div style="margin-bottom: 12px;">
                <strong>🎫 Mode :</strong> 
                <span style="background-color: #007bff; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;">
                  Abonnement
                </span>
              </div>
            ` : ''}
            
            <div style="border-top: 1px solid #dee2e6; padding-top: 12px; margin-top: 12px;">
              <strong>📅 Créée le :</strong> ${Utils.formatDate(order.created_at)}
            </div>
          </div>
          
          <div class="form-actions">
            <button type="button" class="btn btn-danger" id="confirm-delete-order">Confirmer</button>
            <button type="button" class="btn btn-secondary" id="cancel-delete-order">Annuler</button>
          </div>
        `;
        
        // Afficher la modale
        ModalManager.show('Supprimer la commande', modalContent);
        
        // Ajouter les event listeners pour les boutons
        document.getElementById('confirm-delete-order').addEventListener('click', () => {
          ModalManager.hide();
          this.deleteOrder(orderId);
        });
        
        document.getElementById('cancel-delete-order').addEventListener('click', () => {
          ModalManager.hide();
        });
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

  // Validation en temps réel des champs de numéro de téléphone
  static validatePhoneNumberField(input, phoneNumber, isInternal = false) {
    // Supprimer les anciens messages d'erreur et de succès
    const existingError = input.parentNode.querySelector('.phone-validation-error');
    const existingSuccess = input.parentNode.querySelector('.phone-validation-success');
    if (existingError) existingError.remove();
    if (existingSuccess) existingSuccess.remove();

    // Supprimer les classes d'erreur et de succès
    input.classList.remove('error', 'valid');

    if (!phoneNumber) {
      return; // Pas de validation si le champ est vide
    }

    // Pas de validation pour les commandes internes
    if (isInternal) {
      return;
    }

    if (!Utils.validatePhoneNumber(phoneNumber)) {
      // Ajouter la classe d'erreur
      input.classList.add('error');
      
      // Créer le message d'erreur
      const errorDiv = document.createElement('div');
      errorDiv.className = 'phone-validation-error';
      errorDiv.textContent = Utils.getPhoneNumberErrorMessage(phoneNumber);
      
      // Insérer le message d'erreur après le champ
      input.parentNode.insertBefore(errorDiv, input.nextSibling);
    } else {
      // Ajouter la classe de succès
      input.classList.add('valid');
      
      // Créer le message de succès
      const successDiv = document.createElement('div');
      successDiv.className = 'phone-validation-success';
      successDiv.textContent = 'Format valide';
      
      // Insérer le message de succès après le champ
      input.parentNode.insertBefore(successDiv, input.nextSibling);
    }
  }

  static async createOrder(formData) {
    try {
      const response = await ApiClient.createOrder(formData);
      console.log('📦 createOrder - Réponse API:', response);
      
      const newOrderId = response.data?.id || response.order?.id || response.id;
      console.log('📦 createOrder - Order ID:', newOrderId);
      
      // Uploader les pièces jointes si présentes
      if (typeof AttachmentsManager !== 'undefined') {
        const selectedFiles = AttachmentsManager.getSelectedFiles();
        console.log('📦 createOrder - Fichiers sélectionnés:', selectedFiles.length);
        
        if (newOrderId && selectedFiles.length > 0) {
          console.log('📎 Lancement de l\'upload des pièces jointes...');
          const uploadResult = await AttachmentsManager.uploadFiles(newOrderId);
          console.log('📎 Résultat upload:', uploadResult);
          
          if (!uploadResult.success && uploadResult.error) {
            ToastManager.warning(`Commande créée, mais erreur lors de l'upload des fichiers: ${uploadResult.error}`);
          } else if (uploadResult.success) {
            console.log('✅ Pièces jointes uploadées avec succès');
          }
        } else {
          console.log('ℹ️ Pas d\'upload:', { newOrderId, filesCount: selectedFiles.length });
        }
      } else {
        console.log('⚠️ AttachmentsManager non disponible');
      }
      
      ToastManager.success('Commande créée avec succès');
      
      // Si cette commande vient d'une "commande en cours", la marquer comme livrée
      const commandeEnCoursId = sessionStorage.getItem('commande_en_cours_to_complete');
      if (commandeEnCoursId) {
        try {
          await ApiClient.request(`/commandes-en-cours/${commandeEnCoursId}/statut`, {
            method: 'PATCH',
            body: JSON.stringify({ statut: 'livree' })
          });
          sessionStorage.removeItem('commande_en_cours_to_complete');
          console.log('✅ Commande en cours marquée comme livrée');
        } catch (error) {
          console.error('Erreur lors de la mise à jour de la commande en cours:', error);
        }
      }
      
      // Réinitialiser le formulaire
      document.getElementById('new-order-form').reset();
      
      // Réinitialiser les pièces jointes
      if (typeof AttachmentsManager !== 'undefined') {
        AttachmentsManager.reset();
      }
      
      // Réinitialiser les groupes de supplément et hors zone MATA  
      const supplementToggleGroup = document.getElementById('supplement-toggle-group');
      const supplementOptionsGroup = document.getElementById('supplement-options-group');
      const supplementCustomGroup = document.getElementById('supplement-custom-group');
      const mataHorsZoneGroup = document.getElementById('mata-hors-zone-group');
      const interneToggleGroup = document.getElementById('interne-toggle-group');
      const mlcZoneGroup = document.getElementById('mlc-zone-group');
      const mlcCustomPriceGroup = document.getElementById('mlc-custom-price-group');
      const zoneInfo = document.getElementById('zone-info');
      
      if (supplementToggleGroup) supplementToggleGroup.style.display = 'none';
      if (supplementOptionsGroup) supplementOptionsGroup.style.display = 'none';
      if (supplementCustomGroup) supplementCustomGroup.style.display = 'none';
      if (mataHorsZoneGroup) mataHorsZoneGroup.style.display = 'none';
      if (interneToggleGroup) interneToggleGroup.style.display = 'none';
      if (mlcZoneGroup) mlcZoneGroup.style.display = 'none';
      if (mlcCustomPriceGroup) mlcCustomPriceGroup.style.display = 'none';
      if (zoneInfo) zoneInfo.style.display = 'none';
      
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
               <option value="Keur Massar" ${order.point_de_vente === 'Sacre Coeur' ? 'selected' : ''}>Sacre Coeur</option>
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
            <input type="number" id="edit-course-price" name="course_price" step="0.01" min="0" value="${order.course_price || (order.order_type === 'MATA' ? 1000 : '')}" ${order.order_type === 'MATA' ? 'readonly' : ''}>
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

      // Ajouter la validation en temps réel pour le numéro de téléphone
      const editPhoneInput = document.getElementById('edit-phone-number');
      if (editPhoneInput) {
        editPhoneInput.addEventListener('input', (e) => {
          const phoneNumber = e.target.value.trim();
          const isInternal = order.interne === true || order.interne === 'true';
          OrderManager.validatePhoneNumberField(e.target, phoneNumber, isInternal);
        });
      }

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
        // Validation du numéro de téléphone (sauf pour les commandes internes)
        if (!orderData.interne && !Utils.validatePhoneNumber(orderData.phone_number)) {
          ToastManager.error(Utils.getPhoneNumberErrorMessage(orderData.phone_number));
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
  static currentFilter = 'all';
  static filteredSubscriptions = [];

  static async loadSubscriptions() {
    try {
      const [subscriptionsResponse, statsResponse] = await Promise.all([
        ApiClient.getSubscriptions(),
        ApiClient.getSubscriptionStats()
      ]);

      this.subscriptions = subscriptionsResponse.subscriptions || [];
      this.stats = statsResponse.stats || {};

      this.updateStats();
      this.applyFilter('all'); // Initialize with all subscriptions
      this.setupEventListeners();
    } catch (error) {
      console.error('Erreur lors du chargement des abonnements:', error);
      ToastManager.error('Erreur lors du chargement des abonnements');
    }
  }

  static updateStats() {
    // Calculate stats from the actual subscription data
    const now = new Date();
    let activeCount = 0;
    let completedCount = 0;
    let inactiveCount = 0;
    let expiringCount = 0;

    this.subscriptions.forEach(subscription => {
      if (!subscription.is_active) {
        inactiveCount++;
      } else if (subscription.remaining_deliveries === 0) {
        completedCount++;
      } else if (subscription.remaining_deliveries > 0 && new Date(subscription.expiry_date) > now) {
        activeCount++;
        // Check if expiring soon (within 30 days)
        const daysUntilExpiry = Math.ceil((new Date(subscription.expiry_date) - now) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry <= 30) {
          expiringCount++;
        }
      }
    });

    const elements = {
      'total-subscriptions': this.subscriptions.length,
      'active-subscriptions': activeCount,
      'completed-subscriptions': completedCount,
      'inactive-subscriptions': inactiveCount,
      'expiring-subscriptions': expiringCount
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    });

    // Update filter counts
    this.updateFilterCounts();
  }

  static updateFilterCounts() {
    if (!Array.isArray(this.subscriptions) || this.subscriptions.length === 0) {
      document.getElementById('count-all').textContent = '0';
      document.getElementById('count-active').textContent = '0';
      document.getElementById('count-completed').textContent = '0';
      document.getElementById('count-inactive').textContent = '0';
      return;
    }

    const now = new Date();
    let activeCount = 0;
    let completedCount = 0;
    let inactiveCount = 0;

    this.subscriptions.forEach(subscription => {
      if (!subscription.is_active) {
        inactiveCount++;
      } else if (subscription.remaining_deliveries === 0) {
        completedCount++;
      } else if (subscription.remaining_deliveries > 0 && new Date(subscription.expiry_date) > now) {
        activeCount++;
      }
    });

    document.getElementById('count-all').textContent = this.subscriptions.length;
    document.getElementById('count-active').textContent = activeCount;
    document.getElementById('count-completed').textContent = completedCount;
    document.getElementById('count-inactive').textContent = inactiveCount;
  }

  static applyFilter(filter) {
    this.currentFilter = filter;
    
    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-filter="${filter}"]`).classList.add('active');

    // Filter subscriptions
    if (filter === 'all') {
      this.filteredSubscriptions = [...this.subscriptions];
    } else {
      const now = new Date();
      this.filteredSubscriptions = this.subscriptions.filter(subscription => {
        switch (filter) {
          case 'active':
            return subscription.is_active && 
                   subscription.remaining_deliveries > 0 && 
                   new Date(subscription.expiry_date) > now;
          case 'completed':
            return subscription.is_active && subscription.remaining_deliveries === 0;
          case 'inactive':
            return !subscription.is_active;
          default:
            return true;
        }
      });
    }

    this.displaySubscriptions();
  }

  static getFilterLabel(filter) {
    const labels = {
      'all': 'd\'abonnement',
      'active': 'active',
      'completed': 'terminée',
      'inactive': 'inactive'
    };
    return labels[filter] || 'd\'abonnement';
  }

  static displaySubscriptions() {
    const container = document.getElementById('subscriptions-list');
    
    // Use filtered subscriptions if available, otherwise use all subscriptions
    const subscriptionsToDisplay = this.filteredSubscriptions.length > 0 ? this.filteredSubscriptions : this.subscriptions;
    
    if (subscriptionsToDisplay.length === 0) {
      const filterMessage = this.currentFilter === 'all' ? 
        'Aucune carte d\'abonnement trouvée' : 
        `Aucune carte ${this.getFilterLabel(this.currentFilter)} trouvée`;
      container.innerHTML = `<p class="text-center">${filterMessage}</p>`;
      return;
    }

    container.innerHTML = subscriptionsToDisplay.map(subscription => {
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

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const filter = e.currentTarget.getAttribute('data-filter');
        this.applyFilter(filter);
      });
    });
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
      this.filteredSubscriptions = []; // Clear filters when searching
      this.currentFilter = 'all';
      this.updateFilterCounts();
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
                 placeholder="Sénégal: 775059793 | France: 33762051319">
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

    // Ajouter la validation en temps réel pour le numéro de téléphone
    const subscriptionPhoneInput = document.getElementById('subscription-phone-number');
    if (subscriptionPhoneInput) {
      subscriptionPhoneInput.addEventListener('input', (e) => {
        const phoneNumber = e.target.value.trim();
        OrderManager.validatePhoneNumberField(e.target, phoneNumber);
      });
    }

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

      // Validation du numéro de téléphone
      if (!Utils.validatePhoneNumber(subscriptionData.phone_number)) {
        ToastManager.error(Utils.getPhoneNumberErrorMessage(subscriptionData.phone_number));
        return;
      }

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

      // Ajouter la validation en temps réel pour le numéro de téléphone
      const editSubscriptionPhoneInput = document.getElementById('edit-subscription-phone-number');
      if (editSubscriptionPhoneInput) {
        editSubscriptionPhoneInput.addEventListener('input', (e) => {
          const phoneNumber = e.target.value.trim();
          OrderManager.validatePhoneNumberField(e.target, phoneNumber);
        });
      }

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

      // Validation du numéro de téléphone
      if (!Utils.validatePhoneNumber(subscriptionData.phone_number)) {
        ToastManager.error(Utils.getPhoneNumberErrorMessage(subscriptionData.phone_number));
        return;
      }
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

      // Initialiser l'interface GPS pour les livreurs
      if (user.role === 'LIVREUR') {
        const gpsLivreurSection = document.getElementById('gps-livreur-section');
        if (gpsLivreurSection) {
          gpsLivreurSection.style.display = 'block';
          
          // Attendre un peu pour que le DOM soit prêt
          setTimeout(() => {
            if (window.GpsLivreurManager && !window.gpsLivreurManager) {
              try {
                window.gpsLivreurManager = new window.GpsLivreurManager();
                console.log('📍 Interface GPS livreur initialisée depuis le profil pour', user.username);
              } catch (error) {
                console.error('❌ Erreur initialisation GPS livreur:', error);
              }
            } else if (window.gpsLivreurManager) {
              console.log('📍 Interface GPS livreur déjà initialisée');
            } else {
              console.log('⚠️ GpsLivreurManager non disponible');
            }
          }, 1000);
        }
      }

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
    console.log('🚀 Initialisation de l\'application Matix Livreur...');
    
    this.setupEventListeners();
    await AuthManager.init();
    
    // Initialiser le système GPS si l'utilisateur est connecté
    if (AppState.user) {
      setTimeout(() => {
        if (typeof GpsManager !== 'undefined') {
          GpsManager.init();
        }
      }, 1000);
    }
    
    console.log('✅ Application initialisée avec succès');
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
      const subscriptionToggleGroup = document.getElementById('subscription-toggle-group');
      const subscriptionSelectGroup = document.getElementById('subscription-select-group');
      const supplementToggleGroup = document.getElementById('supplement-toggle-group');
      const supplementOptionsGroup = document.getElementById('supplement-options-group');
      const supplementCustomGroup = document.getElementById('supplement-custom-group');
      const mataHorsZoneGroup = document.getElementById('mata-hors-zone-group');
      const mlcZoneGroup = document.getElementById('mlc-zone-group');
      const mlcCustomPriceGroup = document.getElementById('mlc-custom-price-group');
      const coursePriceInput = document.getElementById('course-price');
      
      // Réinitialiser les suppléments et zones
      document.getElementById('add-supplement').checked = false;
      document.getElementById('mata-hors-zone').checked = false;
      document.getElementById('interne-toggle').checked = false;
      document.getElementById('mlc-zone').value = '';
      supplementToggleGroup.style.display = 'none';
      supplementOptionsGroup.style.display = 'none';
      supplementCustomGroup.style.display = 'none';
      mataHorsZoneGroup.style.display = 'none';
      document.getElementById('interne-toggle-group').style.display = 'none';
      mlcZoneGroup.style.display = 'none';
      document.getElementById('zone-info').style.display = 'none';
      
      // Réafficher les champs client et téléphone par défaut
      const clientNameGroup = document.querySelector('.form-group:has(#client-name)');
      const phoneNumberGroup = document.querySelector('.form-group:has(#phone-number)');
      const clientNameInput = document.getElementById('client-name');
      const phoneNumberInput = document.getElementById('phone-number');
      if (clientNameGroup) clientNameGroup.style.display = 'block';
      if (phoneNumberGroup) phoneNumberGroup.style.display = 'block';
      if (clientNameInput) clientNameInput.required = true;
      if (phoneNumberInput) phoneNumberInput.required = true;
      
      if (orderType === 'MATA') {
        coursePriceGroup.style.display = 'block';
        amountGroup.style.display = 'block';
        subscriptionToggleGroup.style.display = 'none';
        subscriptionSelectGroup.style.display = 'none';
        mataHorsZoneGroup.style.display = 'block';
        document.getElementById('interne-toggle-group').style.display = 'block';
        coursePriceInput.value = '1000';
        coursePriceInput.readOnly = true;
        
        // Afficher le groupe du bouton historique pour MATA
        const historyButtonGroup = document.getElementById('client-history-button-group');
        if (historyButtonGroup) {
          historyButtonGroup.style.display = 'block';
          // Le bouton sera activé/désactivé automatiquement par toggleClientHistoryButton
        }
      } else if (orderType === 'MLC') {
        coursePriceGroup.style.display = 'block';
        amountGroup.style.display = 'none';
        subscriptionToggleGroup.style.display = 'block';
        coursePriceInput.value = '';
        coursePriceInput.readOnly = false;
        
        // Vérifier l'état du toggle d'abonnement pour afficher les zones si nécessaire
        const useSubscription = document.getElementById('use-subscription').checked;
        if (!useSubscription) {
          mlcZoneGroup.style.display = 'block';
          coursePriceInput.readOnly = true; // Lecture seule car géré par les zones
        }
      } else {
        coursePriceGroup.style.display = 'block';
        amountGroup.style.display = 'none';
        subscriptionToggleGroup.style.display = 'none';
        subscriptionSelectGroup.style.display = 'none';
        coursePriceInput.value = '';
        coursePriceInput.readOnly = false;
        
        // Masquer le bouton historique pour les types non-MATA
        const historyButtonGroup = document.getElementById('client-history-button-group');
        if (historyButtonGroup) {
          historyButtonGroup.style.display = 'none';
        }
      }
    });

    // Gestion du toggle d'abonnement
    document.getElementById('use-subscription').addEventListener('change', async (e) => {
      const useSubscription = e.target.checked;
      const subscriptionSelectGroup = document.getElementById('subscription-select-group');
      const supplementToggleGroup = document.getElementById('supplement-toggle-group');
      const supplementOptionsGroup = document.getElementById('supplement-options-group');
      const supplementCustomGroup = document.getElementById('supplement-custom-group');
      const mlcZoneGroup = document.getElementById('mlc-zone-group');
      const mlcCustomPriceGroup = document.getElementById('mlc-custom-price-group');
      const coursePriceInput = document.getElementById('course-price');
      
      if (useSubscription) {
        subscriptionSelectGroup.style.display = 'block';
        supplementToggleGroup.style.display = 'block';
        mlcZoneGroup.style.display = 'none';
        document.getElementById('zone-info').style.display = 'none';
        coursePriceInput.value = '1000';
        coursePriceInput.readOnly = true;
        
        // Charger les abonnements actifs
        try {
          const response = await ApiClient.getActiveSubscriptions();
          const select = document.getElementById('subscription-select');
          select.innerHTML = '<option value="">Sélectionner un abonnement...</option>';
          
          response.subscriptions.forEach(sub => {
            const option = document.createElement('option');
            option.value = sub.id;
            option.textContent = `${sub.card_number} - ${sub.client_name} (${sub.remaining_deliveries} livraisons restantes)`;
            option.dataset.clientName = sub.client_name;
            option.dataset.phoneNumber = sub.phone_number;
            option.dataset.price = sub.price;
            option.dataset.totalDeliveries = sub.total_deliveries;
            option.dataset.address = sub.address || '';
            select.appendChild(option);
          });
        } catch (error) {
          console.error('Erreur lors du chargement des abonnements:', error);
          ToastManager.error('Erreur lors du chargement des abonnements');
        }
      } else {
        subscriptionSelectGroup.style.display = 'none';
        supplementToggleGroup.style.display = 'none';
        supplementOptionsGroup.style.display = 'none';
        supplementCustomGroup.style.display = 'none';
        mlcZoneGroup.style.display = 'block';
        document.getElementById('add-supplement').checked = false;
        coursePriceInput.value = '';
        coursePriceInput.readOnly = true; // Lecture seule car géré par les zones
      }
    });
    
    // Gestion du toggle de supplément
    document.getElementById('add-supplement').addEventListener('change', (e) => {
      const addSupplement = e.target.checked;
      const supplementOptionsGroup = document.getElementById('supplement-options-group');
      const supplementCustomGroup = document.getElementById('supplement-custom-group');
      
      if (addSupplement) {
        supplementOptionsGroup.style.display = 'block';
      } else {
        supplementOptionsGroup.style.display = 'none';
        supplementCustomGroup.style.display = 'none';
        // Décocher tous les boutons radio
        document.querySelectorAll('input[name="supplement_amount"]').forEach(radio => {
          radio.checked = false;
        });
        document.getElementById('supplement-custom-amount').value = '';
      }
    });
    
    // Gestion du toggle "hors zone" pour MATA
    document.getElementById('mata-hors-zone').addEventListener('change', (e) => {
      const isHorsZone = e.target.checked;
      const coursePriceInput = document.getElementById('course-price');
      
      if (isHorsZone) {
        // Ajouter 1000 FCFA au prix par défaut de 1000
        coursePriceInput.value = '2000';
      } else {
        // Remettre le prix par défaut de MATA
        coursePriceInput.value = '1000';
      }
    });

    // Gestion du toggle "Interne" pour MATA
    document.getElementById('interne-toggle').addEventListener('change', (e) => {
      const isInterne = e.target.checked;
      const clientNameGroup = document.querySelector('.form-group:has(#client-name)');
      const phoneNumberGroup = document.querySelector('.form-group:has(#phone-number)');
      const clientNameInput = document.getElementById('client-name');
      const phoneNumberInput = document.getElementById('phone-number');
      
      if (isInterne) {
        // Masquer les champs client et téléphone
        clientNameGroup.style.display = 'none';
        phoneNumberGroup.style.display = 'none';
        // Définir les valeurs par défaut pour les commandes internes
        clientNameInput.value = 'COMMANDE INTERNE';
        phoneNumberInput.value = '0000000000';
        
        // Masquer le bouton historique pour les commandes internes
        const historyButtonGroup = document.getElementById('client-history-button-group');
        if (historyButtonGroup) {
          historyButtonGroup.style.display = 'none';
        }
        clientNameInput.required = false;
        phoneNumberInput.required = false;
      } else {
        // Afficher les champs client et téléphone
        clientNameGroup.style.display = 'block';
        phoneNumberGroup.style.display = 'block';
        // Les rendre requis
        clientNameInput.required = true;
        phoneNumberInput.required = true;
        
        // Réafficher le bouton historique si c'est une commande MATA
        const orderType = document.getElementById('order-type').value;
        const historyButtonGroup = document.getElementById('client-history-button-group');
        if (orderType === 'MATA' && historyButtonGroup) {
          historyButtonGroup.style.display = 'block';
          toggleClientHistoryButton(); // Vérifier l'état du téléphone
        }
      }
    });

    // ===== GESTION DU BOUTON HISTORIQUE CLIENT =====
    
    // Fonction pour gérer l'affichage et l'activation du bouton historique
    function toggleClientHistoryButton() {
      const orderType = document.getElementById('order-type').value;
      const phoneInput = document.getElementById('phone-number');
      const interneCheckbox = document.getElementById('interne-toggle');
      const historyButtonGroup = document.getElementById('client-history-button-group');
      const historyButton = document.getElementById('voir-historique-btn');
      
      if (!historyButtonGroup || !historyButton) return;
      
      const phoneValue = phoneInput.value.trim();
      const isInterne = interneCheckbox.checked;
      
      // Afficher le bouton SEULEMENT pour les commandes MATA non internes
      if (orderType === 'MATA' && !isInterne) {
        historyButtonGroup.style.display = 'block';
        
        // Activer/désactiver selon si le téléphone est rempli
        if (phoneValue.length > 0 && phoneValue !== '0000000000') {
          historyButton.disabled = false;
        } else {
          historyButton.disabled = true;
        }
      } else {
        // Masquer pour les autres types ou commandes internes
        historyButtonGroup.style.display = 'none';
      }
    }
    
    // Appeler toggleClientHistoryButton lors du changement de type de commande
    const originalOrderTypeListener = document.getElementById('order-type');
    originalOrderTypeListener.addEventListener('change', toggleClientHistoryButton);
    
    // Écouter les changements sur le champ téléphone
    document.getElementById('phone-number').addEventListener('input', toggleClientHistoryButton);
    
    // Écouter les changements sur le toggle interne
    document.getElementById('interne-toggle').addEventListener('change', toggleClientHistoryButton);
    
    // Ajouter le gestionnaire de clic sur le bouton historique
    document.getElementById('voir-historique-btn').addEventListener('click', () => {
      const phoneInput = document.getElementById('phone-number');
      const clientNameInput = document.getElementById('client-name');
      const phoneNumber = phoneInput.value.trim();
      const clientName = clientNameInput.value.trim();
      
      if (phoneNumber && phoneNumber !== '0000000000') {
        // Appeler la fonction existante pour afficher l'historique
        ClientHistoryManager.showClientHistory(phoneNumber, clientName);
      } else {
        ToastManager.warning('Veuillez saisir un numéro de téléphone valide');
      }
    });

    // Gestion de la sélection des zones MLC
    document.getElementById('mlc-zone').addEventListener('change', (e) => {
      const selectedZone = e.target.value;
      const selectedOption = e.target.selectedOptions[0];
      const coursePriceInput = document.getElementById('course-price');
      const zoneInfo = document.getElementById('zone-info');
      
      // Masquer toutes les infos de zones
      document.querySelectorAll('.zone-detail').forEach(detail => {
        detail.style.display = 'none';
      });
      
      if (selectedZone) {
        // Afficher l'info de la zone sélectionnée
        const zoneInfoElement = document.getElementById(`${selectedZone}-info`);
        if (zoneInfoElement) {
          zoneInfoElement.style.display = 'block';
          zoneInfo.style.display = 'block';
        }
        
        if (selectedZone === 'zone4') {
          // Zone 4 : prix libre - rendre le champ éditable
          coursePriceInput.value = '';
          coursePriceInput.readOnly = false;
          coursePriceInput.placeholder = 'Entrer le prix de la course';
          coursePriceInput.required = true;
        } else {
          // Zones 1, 2, 3 : prix prédéfini
          const price = selectedOption.dataset.price;
          coursePriceInput.value = price;
          coursePriceInput.readOnly = true;
          coursePriceInput.placeholder = '';
          coursePriceInput.required = false;
        }
      } else {
        // Aucune zone sélectionnée
        zoneInfo.style.display = 'none';
        coursePriceInput.value = '';
        coursePriceInput.readOnly = true;
        coursePriceInput.placeholder = '';
        coursePriceInput.required = false;
      }
    });
    
    // Gestion des boutons radio de supplément
    document.querySelectorAll('input[name="supplement_amount"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const supplementCustomGroup = document.getElementById('supplement-custom-group');
        const supplementCustomAmount = document.getElementById('supplement-custom-amount');
        
        if (e.target.value === 'other') {
          supplementCustomGroup.style.display = 'block';
          supplementCustomAmount.required = true;
        } else {
          supplementCustomGroup.style.display = 'none';
          supplementCustomAmount.required = false;
          supplementCustomAmount.value = '';
        }
      });
    });

    // Gestion de la sélection d'un abonnement
    document.getElementById('subscription-select').addEventListener('change', (e) => {
      const selectedOption = e.target.selectedOptions[0];
      if (selectedOption.value) {
        document.getElementById('client-name').value = selectedOption.dataset.clientName;
        document.getElementById('phone-number').value = selectedOption.dataset.phoneNumber;
        document.getElementById('address').value = selectedOption.dataset.address;
        // Calcul automatique du prix de la course
        const price = parseFloat(selectedOption.dataset.price);
        const totalDeliveries = parseInt(selectedOption.dataset.totalDeliveries);
        if (price && totalDeliveries) {
          const coursePrice = Math.round(price / totalDeliveries);
          document.getElementById('course-price').value = coursePrice;
        }
      }
    });

    // Gestion du bouton de sélection de contacts
    const selectContactBtn = document.getElementById('select-contact-btn');
    if (selectContactBtn) {
      console.log('✅ Bouton de sélection de contacts trouvé et configuré');
      selectContactBtn.addEventListener('click', () => {
        console.log('🖱️ Clic sur le bouton de sélection de contacts');
        ContactManager.showContactSelector();
      });
    } else {
      console.error('❌ Bouton de sélection de contacts non trouvé');
    }

    // Recherche automatique de client lors de la saisie du numéro de téléphone
    const phoneNumberInput = document.getElementById('phone-number');
    if (phoneNumberInput) {
      // Validation en temps réel
      phoneNumberInput.addEventListener('input', (e) => {
        const phoneNumber = e.target.value.trim();
        const isInternal = document.getElementById('interne') && document.getElementById('interne').checked;
        this.validatePhoneNumberField(e.target, phoneNumber, isInternal);
      });

      phoneNumberInput.addEventListener('blur', async (e) => {
        const phoneNumber = e.target.value.trim();
        if (phoneNumber && Utils.validatePhoneNumber(phoneNumber)) {
          // Vérifier si le nom du client est déjà rempli
          const clientNameInput = document.getElementById('client-name');
          if (!clientNameInput.value.trim()) {
            // Rechercher automatiquement les informations du client
            await ContactManager.autoFillClientInfo(phoneNumber);
          }
        }
      });
    }

    // Gestion de la soumission du formulaire
    document.getElementById('new-order-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Obtenir le bouton et le texte
      const submitBtn = document.getElementById('submit-order-btn');
      const submitText = document.getElementById('submit-order-text');
      
      // Vérifier si une commande est déjà en cours de création
      if (submitBtn.disabled) {
        ToastManager.warning('Une commande est déjà en cours de création, veuillez patienter...');
        return;
      }
      
      // Désactiver le bouton et afficher le spinner
      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.6';
      submitBtn.style.cursor = 'not-allowed';
      submitText.innerHTML = '<span class="spinner" style="display: inline-block; width: 16px; height: 16px; border: 2px solid #ffffff; border-radius: 50%; border-top-color: transparent; animation: spin 0.6s linear infinite; margin-right: 8px;"></span>Création en cours...';
      
      const formData = new FormData(e.target);
      const orderData = Object.fromEntries(formData.entries());
      
      // Fonction pour réactiver le bouton
      const resetButton = () => {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
        submitText.textContent = 'Créer la commande';
      };
      
      // Validation du numéro de téléphone (sauf pour les commandes internes)
      if (!orderData.interne && !Utils.validatePhoneNumber(orderData.phone_number)) {
        ToastManager.error(Utils.getPhoneNumberErrorMessage(orderData.phone_number));
        resetButton();
        return;
      }
      
      // Validation côté client : managers/admins doivent sélectionner un livreur
      if (AppState.user && (AppState.user.role === 'MANAGER' || AppState.user.role === 'ADMIN')) {
        if (!orderData.created_by) {
          ToastManager.error('Vous devez sélectionner un livreur pour cette commande');
          resetButton();
          return;
        }
      }
      
      // Convertir les montants en nombres
      if (orderData.course_price) {
        orderData.course_price = parseFloat(orderData.course_price);
      }
      if (orderData.amount) {
        orderData.amount = parseFloat(orderData.amount);
      }
      
      // Traitement des données de supplément pour MLC avec abonnement
      if (orderData.order_type === 'MLC' && orderData.use_subscription === 'on' && orderData.add_supplement === 'on') {
        let supplementAmount = 0;
        
        if (orderData.supplement_amount === 'other') {
          supplementAmount = parseFloat(orderData.supplement_custom_amount) || 0;
        } else if (orderData.supplement_amount) {
          supplementAmount = parseFloat(orderData.supplement_amount);
        }
        
        if (supplementAmount > 0) {
          orderData.supplement_amount = supplementAmount;
          // Ajouter le supplément au prix de la course
          orderData.course_price = (orderData.course_price || 0) + supplementAmount;
        }
        
        // Nettoyer les champs non nécessaires
        delete orderData.supplement_custom_amount;
      }
      
      // Traitement du supplément "hors zone" pour MATA
      if (orderData.order_type === 'MATA' && orderData.mata_hors_zone === 'on') {
        // Le prix est déjà ajusté dans l'interface (1000 + 1000 = 2000)
        // Pas besoin de traitement supplémentaire côté client
        orderData.hors_zone = true;
      }
      
      // Traitement de la commande interne pour MATA
      if (orderData.order_type === 'MATA' && orderData.interne === 'on') {
        // Les champs client_name et phone_number sont gérés côté serveur
        // Pas besoin de traitement supplémentaire côté client
      }
      
      // Traitement des zones MLC sans abonnement
      if (orderData.order_type === 'MLC' && !orderData.use_subscription && orderData.mlc_zone) {
        // Pour toutes les zones (y compris Zone 4), le prix est dans course_price
        // Enregistrer l'information de la zone
        orderData.delivery_zone = orderData.mlc_zone;
        // Nettoyer le champ de zone du formulaire
        delete orderData.mlc_zone;
      }
      
      // Pour MLC avec abonnement, utiliser la route spéciale
      if (orderData.order_type === 'MLC' && orderData.use_subscription === 'on' && orderData.subscription_id) {
        try {
          const response = await ApiClient.createMLCOrderWithSubscription(orderData);
          if (response.success) {
            console.log('📦 createMLCOrder - Réponse API:', response);
            
            const newOrderId = response.data?.id || response.order?.id || response.id;
            console.log('📦 createMLCOrder - Order ID:', newOrderId);
            
            // Uploader les pièces jointes si présentes
            if (typeof AttachmentsManager !== 'undefined') {
              const selectedFiles = AttachmentsManager.getSelectedFiles();
              console.log('📦 createMLCOrder - Fichiers sélectionnés:', selectedFiles.length);
              
              if (newOrderId && selectedFiles.length > 0) {
                console.log('📎 Lancement de l\'upload des pièces jointes...');
                const uploadResult = await AttachmentsManager.uploadFiles(newOrderId);
                console.log('📎 Résultat upload:', uploadResult);
                
                if (!uploadResult.success && uploadResult.error) {
                  ToastManager.warning(`Commande créée, mais erreur lors de l'upload des fichiers: ${uploadResult.error}`);
                } else if (uploadResult.success) {
                  console.log('✅ Pièces jointes uploadées avec succès');
                }
              } else {
                console.log('ℹ️ Pas d\'upload:', { newOrderId, filesCount: selectedFiles.length });
              }
            }
            
            ToastManager.success('Commande créée avec succès');
            document.getElementById('new-order-form').reset();
            
            // Réinitialiser les pièces jointes
            if (typeof AttachmentsManager !== 'undefined') {
              AttachmentsManager.reset();
            }
            // Réinitialiser les groupes de supplément
            if (document.getElementById('supplement-toggle-group')) {
              document.getElementById('supplement-toggle-group').style.display = 'none';
          }
          
          if (document.getElementById('supplement-options-group')) {
              document.getElementById('supplement-options-group').style.display = 'none';
          }
          
          if (document.getElementById('supplement-custom-group')) {
              document.getElementById('supplement-custom-group').style.display = 'none';
          }
          
          if (document.getElementById('mata-hors-zone-group')) {
              document.getElementById('mata-hors-zone-group').style.display = 'none';
          }
          
          if (document.getElementById('interne-toggle-group')) {
              document.getElementById('interne-toggle-group').style.display = 'none';
          }
          
          if (document.getElementById('mlc-zone-group')) {
              document.getElementById('mlc-zone-group').style.display = 'none';
          }
          
          if (document.getElementById('mlc-custom-price-group')) {
              document.getElementById('mlc-custom-price-group').style.display = 'none';
          }
          
          if (document.getElementById('zone-info')) {
              document.getElementById('zone-info').style.display = 'none';
          }
          
            await OrderManager.loadLastUserOrders();
            
            // Réactiver le bouton après succès
            resetButton();
          } else {
            ToastManager.error(response.message || 'Erreur lors de la création de la commande');
            resetButton();
          }
        } catch (error) {
          console.error('Erreur lors de la création de la commande:', error);
          ToastManager.error('Erreur lors de la création de la commande');
          resetButton();
        }
        return;
      }
      
      // Pour les autres types de commandes, utiliser la route normale
      try {
        await OrderManager.createOrder(orderData);
        resetButton();
      } catch (error) {
        console.error('Erreur lors de la création de la commande:', error);
        ToastManager.error('Erreur lors de la création de la commande');
        resetButton();
      }
    });

    // Filtres pour les commandes
    document.getElementById('orders-date-filter').addEventListener('change', () => {
      OrderManager.loadOrdersWithFilters();
    });

    document.getElementById('orders-livreur-filter').addEventListener('change', () => {
      OrderManager.loadOrdersWithFilters();
    });

    document.getElementById('orders-type-filter').addEventListener('change', () => {
      OrderManager.loadOrdersWithFilters();
    });

    document.getElementById('clear-orders-filters').addEventListener('click', () => {
      OrderManager.clearFilters();
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

    // Gestion des onglets de profil
    const profileTabs = document.querySelectorAll('.profile-tab');
    const profileTabContents = document.querySelectorAll('.profile-tab-content');
    
    profileTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        
        // Retirer la classe active de tous les onglets
        profileTabs.forEach(t => t.classList.remove('active'));
        profileTabContents.forEach(content => content.classList.remove('active'));
        
        // Ajouter la classe active à l'onglet cliqué
        tab.classList.add('active');
        document.getElementById(`profile-tab-${targetTab}`).classList.add('active');
      });
    });

    // Bouton changement de mot de passe (uniquement dans l'onglet sécurité)
    const changePasswordButton = document.getElementById('change-password-btn-main');
    if (changePasswordButton) {
      changePasswordButton.addEventListener('click', () => {
        ProfileManager.showChangePasswordModal();
      });
    }

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
      dashboardDateFilter.addEventListener('change', async () => {
        try {
          console.log('📅 Changement de date dashboard détecté');
          await DashboardManager.loadDashboard();
          
          // Recharger aussi le résumé des pointages si l'utilisateur est manager
          const isManagerOrAdmin = AppState.user?.role === 'MANAGER' || AppState.user?.role === 'ADMIN';
          console.log('👤 Est Manager/Admin?', isManagerOrAdmin, '- User:', AppState.user);
          
          if (isManagerOrAdmin) {
            const timesheetWidget = document.getElementById('timesheet-manager-widget');
            const isWidgetVisible = timesheetWidget && timesheetWidget.style.display !== 'none';
            console.log('📊 Widget visible?', isWidgetVisible);
            
            if (isWidgetVisible && typeof TimesheetsManagerView !== 'undefined' && TimesheetsManagerView.reloadSummary) {
              console.log('🔄 Rechargement du résumé des pointages...');
              await TimesheetsManagerView.reloadSummary();
              console.log('✅ Résumé des pointages rechargé');
            }
          }
        } catch (error) {
          console.error('❌ Erreur lors du changement de date:', error);
          if (typeof ToastManager !== 'undefined') {
            ToastManager.error('Erreur lors du rechargement des données');
          }
        }
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

    // Affichage du champ livreur pour managers/admins
    if (AppState.user && (AppState.user.role === 'MANAGER' || AppState.user.role === 'ADMIN')) {
      const livreurGroup = document.getElementById('livreur-select-group');
      livreurGroup.style.display = 'block';
      // Charger la liste des livreurs
      ApiClient.getLivreurs().then(response => {
        const select = document.getElementById('livreur-select');
        select.innerHTML = '<option value="">Sélectionner un livreur</option>';
        (response.livreurs || []).forEach(livreur => {
          select.innerHTML += `<option value="${livreur.id}">${Utils.escapeHtml(livreur.username)}</option>`;
        });
      });
    } else {
      // Pour les livreurs : cacher le champ et supprimer l'attribut required
      const livreurGroup = document.getElementById('livreur-select-group');
      const livreurSelect = document.getElementById('livreur-select');
      
      livreurGroup.style.display = 'none';
      livreurSelect.removeAttribute('required');
      
      // Automatiquement assigner la commande au livreur connecté
      if (AppState.user && AppState.user.id) {
        livreurSelect.value = AppState.user.id;
      }
    }

    // --- Order form dynamic fields logic ---
    const orderTypeSelect = document.getElementById('order-type');
    const adresseSourceGroup = document.getElementById('adresse-source-group');
    const adresseDestinationGroup = document.getElementById('adresse-destination-group');
    const pointVenteGroup = document.getElementById('point-vente-group');
    const addressGroup = document.getElementById('address-group');
    const pointVenteSelect = document.getElementById('point-vente');

    orderTypeSelect.addEventListener('change', function() {
        const type = this.value;
        const adresseSourceLabel = document.querySelector('label[for="adresse-source"]');
        if (type === 'MLC' || type === 'AUTRE') {
            adresseSourceGroup.style.display = '';
            adresseDestinationGroup.style.display = '';
            pointVenteGroup.style.display = 'none';
            addressGroup.style.display = 'none';
            document.getElementById('adresse-source').required = true;
            document.getElementById('adresse-destination').required = true;
            if (adresseSourceLabel) adresseSourceLabel.innerHTML = 'Adresse source <span style="color:red">*</span>';
            if (pointVenteSelect) pointVenteSelect.required = false;
        } else if (type === 'MATA') {
            adresseSourceGroup.style.display = '';
            adresseDestinationGroup.style.display = '';
            pointVenteGroup.style.display = '';
            addressGroup.style.display = 'none';
            document.getElementById('adresse-source').required = false;
            document.getElementById('adresse-destination').required = true;
            if (adresseSourceLabel) adresseSourceLabel.innerHTML = 'Adresse source';
            if (pointVenteSelect) pointVenteSelect.required = true;
        } else {
            // Default: show adresse source/destination, hide old Adresse
            adresseSourceGroup.style.display = '';
            adresseDestinationGroup.style.display = '';
            pointVenteGroup.style.display = 'none';
            addressGroup.style.display = 'none';
            document.getElementById('adresse-source').required = false;
            document.getElementById('adresse-destination').required = false;
            if (adresseSourceLabel) adresseSourceLabel.innerHTML = 'Adresse source';
            if (pointVenteSelect) pointVenteSelect.required = false;
        }
    });

    // On page load, trigger change to set correct fields
    if (orderTypeSelect) orderTypeSelect.dispatchEvent(new Event('change'));

    // --- Form validation on submit ---
    document.getElementById('new-order-form').addEventListener('submit', function(e) {
        const type = orderTypeSelect.value;
        if ((type === 'MLC' || type === 'AUTRE')) {
            if (!document.getElementById('adresse-source').value.trim() || !document.getElementById('adresse-destination').value.trim()) {
                e.preventDefault();
                ToastManager.error('Adresse source et destination sont obligatoires pour ce type de commande.');
                return false;
            }
        }
        if (type === 'MATA') {
            if (!pointVenteSelect.value) {
                e.preventDefault();
                ToastManager.error('Le point de vente est obligatoire pour MATA.');
                return false;
            }
        }
        // Validation pour MLC sans abonnement (zones)
        if (type === 'MLC' && !document.getElementById('use-subscription').checked) {
            const mlcZone = document.getElementById('mlc-zone').value;
            if (!mlcZone) {
                e.preventDefault();
                ToastManager.error('Vous devez sélectionner une zone de livraison pour MLC.');
                return false;
            }
            // Validation pour Zone 4 (prix libre)
            if (mlcZone === 'zone4') {
                const coursePrice = document.getElementById('course-price').value;
                if (!coursePrice || parseFloat(coursePrice) <= 0) {
                    e.preventDefault();
                    ToastManager.error('Vous devez saisir un prix valide pour la Zone 4.');
                    return false;
                }
            }
        }
    });
  }
}

// ===== DÉMARRAGE DE L'APPLICATION =====
document.addEventListener('DOMContentLoaded', () => {
  App.init();
  
  // Vérifier l'API Contacts après l'initialisation
  setTimeout(() => {
    console.log('📱 Vérification de l\'API Contacts...');
    try {
      if (typeof ContactManager !== 'undefined' && ContactManager.isContactsApiAvailable()) {
        console.log('✅ API Contacts disponible');
      } else {
        console.log('⚠️ API Contacts non disponible - utilisation de la recherche en base uniquement');
      }
    } catch (error) {
      console.log('⚠️ ContactManager non encore initialisé');
    }
  }, 100);
});

// Exposer certaines fonctions globalement pour les event handlers inline
window.OrderManager = OrderManager;
window.UserManager = UserManager;
window.LivreurManager = LivreurManager;
window.ExpenseManager = ExpenseManager;
window.ApiClient = ApiClient;

// Créer un objet apiClient compatible avec l'ancienne syntaxe
window.apiClient = {
  get: (url) => ApiClient.request(url),
  post: (url, data) => ApiClient.request(url, { method: 'POST', body: JSON.stringify(data) }),
  put: (url, data) => ApiClient.request(url, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (url) => ApiClient.request(url, { method: 'DELETE' })
};
window.MonthlyDashboardManager = MonthlyDashboardManager;
window.MataMonthlyDashboardManager = MataMonthlyDashboardManager;
window.SubscriptionManager = SubscriptionManager;
window.ModalManager = ModalManager;

// ===== GESTIONNAIRE DE CONTACTS =====
class ContactManager {
  static contacts = [];
  static searchTimeout = null;
  static mockMode = false; // Mode production - utiliser la vraie API Contacts

  // Vérifier si l'API Contacts est disponible
  static isContactsApiAvailable() {
    return 'contacts' in navigator && 'ContactsManager' in window;
  }

  // Demander l'accès aux contacts
  static async requestContactsPermission() {
    if (!this.isContactsApiAvailable()) {
      console.log('⚠️ API Contacts non disponible');
      ToastManager.error('L\'API Contacts n\'est pas disponible sur ce navigateur');
      return [];
    }

    try {
      console.log('📱 Demande d\'accès aux contacts du téléphone...');
      const props = ['name', 'tel'];
      const opts = { multiple: true };
      const contacts = await navigator.contacts.select(props, opts);
      this.contacts = contacts;
      console.log(`✅ ${contacts.length} contacts récupérés`);
      return contacts;
    } catch (error) {
      console.error('Erreur lors de l\'accès aux contacts:', error);
      ToastManager.error('Impossible d\'accéder aux contacts: ' + error.message);
      return [];
    }
  }

  // Obtenir des contacts de test (mock)
  static getMockContacts() {
    const mockContacts = [
      { 
        name: ['Jean Dupont'], 
        tel: ['773920001'],
        adresse_source: 'Rue de la Paix, Dakar',
        adresse_destination: 'Avenue Georges Bush, Dakar'
      },
      { 
        name: ['Marie Martin'], 
        tel: ['773920002'],
        adresse_source: 'Corniche Ouest, Dakar',
        adresse_destination: 'Plateau, Dakar'
      },
      { 
        name: ['Pierre Durand'], 
        tel: ['773920003'],
        adresse_source: 'Almadies, Dakar',
        adresse_destination: 'Médina, Dakar'
      },
      { 
        name: ['Sophie Bernard'], 
        tel: ['773920004'],
        adresse_source: 'Yoff, Dakar',
        adresse_destination: 'Ouakam, Dakar'
      },
      { 
        name: ['Michel Petit'], 
        tel: ['773920005'],
        adresse_source: 'Mermoz, Dakar',
        adresse_destination: 'Fann, Dakar'
      },
      { 
        name: ['Claire Moreau'], 
        tel: ['773920006'],
        adresse_source: 'Point E, Dakar',
        adresse_destination: 'Sacré Cœur, Dakar'
      },
      { 
        name: ['André Leroy'], 
        tel: ['773920007'],
        adresse_source: 'Hann, Dakar',
        adresse_destination: 'Gueule Tapée, Dakar'
      },
      { 
        name: ['Isabelle Roux'], 
        tel: ['773920008'],
        adresse_source: 'Pikine, Dakar',
        adresse_destination: 'Thiaroye, Dakar'
      }
    ];
    
    this.contacts = mockContacts;
    return mockContacts;
  }

  // Rechercher dans les contacts locaux
  static searchLocalContacts(query) {
    if (!this.contacts.length) return [];
    
    const searchTerm = query.toLowerCase();
    return this.contacts.filter(contact => {
      const name = contact.name ? contact.name[0] : '';
      const phone = contact.tel ? contact.tel[0] : '';
      
      return name.toLowerCase().includes(searchTerm) || 
             phone.includes(searchTerm);
    });
  }

  // Rechercher des clients dans la base de données
  static async searchDatabaseClients(query) {
    try {
      const response = await ApiClient.searchClients(query, 5);
      return response.clients || [];
    } catch (error) {
      console.error('Erreur lors de la recherche de clients:', error);
      return [];
    }
  }

  // Obtenir les informations d'un client par téléphone
  static async getClientInfo(phoneNumber) {
    try {
      const response = await ApiClient.getClientByPhone(phoneNumber);
      return response.client || null;
    } catch (error) {
      console.error('Erreur lors de la récupération des informations client:', error);
      return null;
    }
  }

  // Afficher le modal de sélection de contact
  static async showContactSelector() {
    console.log('🔍 ContactManager.showContactSelector() appelé');
    
    try {
      const content = `
        <div class="contact-selector">
          <!--<div class="contact-search-section">
            <h3>📱 Contacts du téléphone</h3>
            <div class="form-group">
              <input type="text" id="contact-search" placeholder="Rechercher dans vos contacts..." class="form-control">
            </div>
            <div id="local-contacts-list" class="contacts-list">
              <p class="no-results">Cliquez sur "Charger les contacts" pour commencer</p>
            </div>
          </div>-->
          
          <div class="contact-search-section">
            <h3>💾 Numeros clients existants</h3>
            <div class="form-group">
              <input type="text" id="client-search" placeholder="Rechercher un numero exemple 773000000..." class="form-control">
            </div>
            <div id="database-clients-list" class="clients-list">
              <p class="no-results">Tapez pour rechercher des clients</p>
            </div>
          </div>
          
          <div class="contact-actions">
            <button type="button" id="access-contacts-btn" class="btn btn-primary">
              <span class="icon">📱</span>
              Accéder aux contacts du téléphone
            </button>
            <button type="button" class="btn btn-secondary" onclick="ModalManager.hide()">
              Annuler
            </button>
          </div>
        </div>
      `;

      ModalManager.show('Sélectionner un contact', content);
      this.setupContactSelectorEvents();
      console.log('✅ Modal de sélection de contacts affiché');
    } catch (error) {
      console.error('❌ Erreur lors de l\'affichage du sélecteur de contacts:', error);
      ToastManager.error('Erreur lors de l\'ouverture du sélecteur de contacts');
    }
  }

  // Configurer les événements du sélecteur de contacts
  static setupContactSelectorEvents() {
    // Bouton d'accès aux contacts
    const accessContactsBtn = document.getElementById('access-contacts-btn');
    if (accessContactsBtn) {
      accessContactsBtn.addEventListener('click', async () => {
        try {
          accessContactsBtn.disabled = true;
          accessContactsBtn.textContent = 'Chargement...';
          
          await this.requestContactsPermission();
          
          if (this.mockMode) {
            ToastManager.success('Contacts de test chargés avec succès');
          } else {
            ToastManager.success('Contacts chargés avec succès');
          }
          
          // Afficher les contacts chargés
          this.displayLocalContacts(this.contacts);
          
          // Activer la recherche locale si des contacts sont disponibles
          const contactSearch = document.getElementById('contact-search');
          if (contactSearch && this.contacts.length > 0) {
            contactSearch.placeholder = 'Rechercher dans vos contacts...';
          } else if (contactSearch) {
            contactSearch.placeholder = 'Chargez d\'abord vos contacts...';
            contactSearch.disabled = true;
          }
        } catch (error) {
          ToastManager.error('Impossible d\'accéder aux contacts: ' + error.message);
        } finally {
          accessContactsBtn.disabled = false;
          accessContactsBtn.innerHTML = `<span class="icon">📱</span> Accéder aux contacts du téléphone`;
        }
      });
    }

    // Recherche dans les contacts locaux
    const contactSearch = document.getElementById('contact-search');
    if (contactSearch) {
      contactSearch.addEventListener('input', Utils.debounce((e) => {
        const query = e.target.value.trim();
        if (query.length >= 2) {
          const results = this.searchLocalContacts(query);
          this.displayLocalContacts(results);
        } else {
          this.displayLocalContacts([]);
        }
      }, 300));
    }

    // Recherche dans la base de données
    const clientSearch = document.getElementById('client-search');
    if (clientSearch) {
      clientSearch.addEventListener('input', Utils.debounce(async (e) => {
        const query = e.target.value.trim();
        if (query.length >= 2) {
          const results = await this.searchDatabaseClients(query);
          this.displayDatabaseClients(results);
        } else {
          this.displayDatabaseClients([]);
        }
      }, 300));
    }
  }

  // Afficher les contacts locaux
  static displayLocalContacts(contacts) {
    const container = document.getElementById('local-contacts-list');
    if (!container) return;

    if (!contacts || contacts.length === 0) {
      container.innerHTML = '<p class="no-results">Aucun contact disponible. Cliquez sur "Accéder aux contacts du téléphone" pour charger vos contacts.</p>';
      return;
    }

    container.innerHTML = contacts.map(contact => {
      const name = contact.name ? contact.name[0] : 'Sans nom';
      const phone = contact.tel ? contact.tel[0] : 'Pas de téléphone';
      
      return `
        <div class="contact-item" data-phone="${phone}" data-name="${name}">
          <div class="contact-info">
            <div class="contact-name">${Utils.escapeHtml(name)}</div>
            <div class="contact-phone">${Utils.escapeHtml(phone)}</div>
          </div>
          <button type="button" class="btn btn-sm btn-primary select-contact-btn">
            Sélectionner
          </button>
        </div>
      `;
    }).join('');

    // Ajouter les événements de sélection
    container.querySelectorAll('.select-contact-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const contactItem = e.target.closest('.contact-item');
        const name = contactItem.dataset.name;
        const phone = contactItem.dataset.phone;
        
        this.selectContact(name, phone);
      });
    });
  }

  // Afficher les clients de la base de données
  static displayDatabaseClients(clients) {
    const container = document.getElementById('database-clients-list');
    if (!container) return;

    if (clients.length === 0) {
      container.innerHTML = '<p class="no-results">Aucun client trouvé</p>';
      return;
    }

    container.innerHTML = clients.map(client => {
      const lastOrderDate = client.last_order_date ? 
        new Date(client.last_order_date).toLocaleDateString('fr-FR') : 'Jamais';
      
      return `
        <div class="client-item" data-phone="${client.phone_number}" data-name="${client.client_name}">
          <div class="client-info">
            <div class="client-name">${Utils.escapeHtml(client.client_name)}</div>
            <div class="client-phone">${Utils.escapeHtml(client.phone_number)}</div>
            <div class="client-details">
              <small>${client.order_count} commande(s) - Dernière: ${lastOrderDate}</small>
            </div>
          </div>
          <button type="button" class="btn btn-sm btn-primary select-client-btn">
            Sélectionner
          </button>
        </div>
      `;
    }).join('');

    // Ajouter les événements de sélection
    container.querySelectorAll('.select-client-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const clientItem = e.target.closest('.client-item');
        const name = clientItem.dataset.name;
        const phone = clientItem.dataset.phone;
        
        this.selectClient(name, phone);
      });
    });
  }

  // Sélectionner un contact local
  static selectContact(name, phone) {
    // Remplir les champs du formulaire
    const clientNameInput = document.getElementById('client-name');
    const phoneInput = document.getElementById('phone-number');
    
    if (clientNameInput) clientNameInput.value = name;
    if (phoneInput) phoneInput.value = phone;
    
    // Fermer le modal
    ModalManager.hide();
    
    // Rechercher automatiquement les informations du client dans la base
    this.autoFillClientInfo(phone);
  }

  // Sélectionner un client de la base de données
  static async selectClient(name, phone) {
    // Remplir les champs du formulaire
    const clientNameInput = document.getElementById('client-name');
    const phoneInput = document.getElementById('phone-number');
    
    if (clientNameInput) clientNameInput.value = name;
    if (phoneInput) phoneInput.value = phone;
    
    // Fermer le modal
    ModalManager.hide();
    
    // Pré-remplir avec les informations du client
    await this.autoFillClientInfo(phone);
  }

  // Pré-remplir automatiquement les informations du client
  static async autoFillClientInfo(phoneNumber) {
    try {
      const client = await this.getClientInfo(phoneNumber);
      if (!client) return;

      // Pré-remplir les champs selon le type de commande
      const orderType = document.getElementById('order-type').value;
      
      if (orderType === 'MATA') {
        // Pour MATA, pré-remplir l'adresse destination et le point de vente
        if (client.adresse_destination) {
          const adresseDestInput = document.getElementById('adresse-destination');
          if (adresseDestInput) adresseDestInput.value = client.adresse_destination;
        }
        
        if (client.point_de_vente) {
          const pointVenteSelect = document.getElementById('point-vente');
          if (pointVenteSelect) pointVenteSelect.value = client.point_de_vente;
        }
      } else if (orderType === 'MLC' || orderType === 'AUTRE') {
        // Pour MLC/AUTRE, pré-remplir les adresses source et destination
        if (client.adresse_source) {
          const adresseSourceInput = document.getElementById('adresse-source');
          if (adresseSourceInput) adresseSourceInput.value = client.adresse_source;
        }
        
        if (client.adresse_destination) {
          const adresseDestInput = document.getElementById('adresse-destination');
          if (adresseDestInput) adresseDestInput.value = client.adresse_destination;
        }
      }

      // Pré-remplir l'adresse générale si disponible
      if (client.address) {
        const addressInput = document.getElementById('address');
        if (addressInput) addressInput.value = client.address;
      }

      ToastManager.success('Informations client pré-remplies');
    } catch (error) {
      console.error('Erreur lors du pré-remplissage:', error);
    }
  }
}


// Exposer ContactManager globalement
window.ContactManager = ContactManager;