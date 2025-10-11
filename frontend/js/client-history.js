// Gestion de l'historique des commandes client

class ClientHistoryManager {
  
  static currentPhone = null;
  static currentClientName = null;

  // Initialiser les événements
  static init() {
    console.log('📋 Initialisation du gestionnaire d'historique client');
    
    // Event delegation pour les boutons "Détails" (car ils sont créés dynamiquement)
    document.addEventListener('click', (e) => {
      if (e.target.closest('.btn-client-history')) {
        const btn = e.target.closest('.btn-client-history');
        const phone = btn.dataset.phone;
        const clientName = btn.dataset.clientName;
        this.showClientHistory(phone, clientName);
      }

      // Fermer le modal
      if (e.target.id === 'close-history-modal' || e.target.id === 'history-modal-overlay') {
        this.closeHistoryModal();
      }

      // Appliquer les filtres de date
      if (e.target.id === 'apply-history-filters') {
        this.applyDateFilters();
      }

      // Réinitialiser les filtres
      if (e.target.id === 'reset-history-filters') {
        this.resetDateFilters();
      }
    });
  }

  // Afficher l'historique d'un client
  static async showClientHistory(phone, clientName) {
    this.currentPhone = phone;
    this.currentClientName = clientName;

    try {
      // Afficher un modal de chargement
      this.showLoadingModal(clientName);

      // Récupérer l'historique du backend
      const url = `${window.API_BASE_URL}/orders/client-history?phone_number=${encodeURIComponent(phone)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors du chargement de l\'historique');
      }

      const data = await response.json();
      console.log('📋 Historique reçu:', data);

      // Afficher le modal avec les données
      this.displayHistoryModal(data);

    } catch (error) {
      console.error('❌ Erreur lors du chargement de l\'historique:', error);
      this.closeHistoryModal();
      
      if (typeof ToastManager !== 'undefined') {
        ToastManager.error('Erreur lors du chargement de l\'historique');
      } else {
        alert('Erreur lors du chargement de l\'historique');
      }
    }
  }

  // Modal de chargement
  static showLoadingModal(clientName) {
    const modal = `
      <div id="history-modal-overlay" class="history-modal-overlay">
        <div class="history-modal loading">
          <div class="loading-spinner-container">
            <div class="loading-spinner"></div>
            <p>Chargement de l'historique de ${clientName}...</p>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modal);
  }

  // Afficher le modal avec l'historique
  static displayHistoryModal(data) {
    // Retirer le modal de chargement
    this.closeHistoryModal();

    const { client_name, phone_number, statistics, orders } = data;

    const modalHTML = `
      <div id="history-modal-overlay" class="history-modal-overlay">
        <div class="history-modal">
          <div class="history-modal-header">
            <h2>📋 Historique des commandes - ${client_name || 'Client'}</h2>
            <div class="modal-header-actions">
              <button id="close-history-modal" class="btn-close-modal">✕</button>
            </div>
          </div>
          
          <div class="history-modal-body">
            
            <!-- Informations client -->
            <div class="client-info-section">
              <div class="client-info-card">
                <h3>👤 Informations Client</h3>
                <p><strong>Nom:</strong> ${client_name || 'Non renseigné'}</p>
                <p><strong>Téléphone:</strong> ${phone_number}</p>
                <p><strong>Première commande:</strong> ${statistics.first_order_date ? new Date(statistics.first_order_date).toLocaleDateString('fr-FR') : 'N/A'}</p>
                <p><strong>Dernière commande:</strong> ${statistics.last_order_date ? new Date(statistics.last_order_date).toLocaleDateString('fr-FR') : 'N/A'}</p>
              </div>
              <div class="client-info-card">
                <h3>📊 Statistiques</h3>
                <p><strong>Total commandes:</strong> ${statistics.total_orders}</p>
                <p><strong>Montant total:</strong> ${this.formatAmount(statistics.total_amount)} FCFA</p>
                <p><strong>Panier moyen:</strong> ${this.formatAmount(statistics.avg_amount)} FCFA</p>
              </div>
            </div>

            <!-- Filtres de date -->
            <div class="history-filters">
              <h3>🔍 Filtrer par date</h3>
              <div class="filter-inputs">
                <div class="filter-group">
                  <label for="history-start-date">Date de début:</label>
                  <input type="date" id="history-start-date" class="form-control">
                </div>
                <div class="filter-group">
                  <label for="history-end-date">Date de fin:</label>
                  <input type="date" id="history-end-date" class="form-control">
                </div>
                <div class="filter-actions">
                  <button id="apply-history-filters" class="btn btn-primary">Appliquer</button>
                  <button id="reset-history-filters" class="btn btn-secondary">Réinitialiser</button>
                </div>
              </div>
            </div>

            <!-- Tableau des commandes -->
            <div class="history-orders-section">
              <h3>📦 Commandes (${orders.length})</h3>
              <div class="history-table-container" id="history-orders-table">
                ${this.renderOrdersTable(orders)}
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  // Rendre le tableau des commandes
  static renderOrdersTable(orders) {
    if (orders.length === 0) {
      return '<p class="no-data">Aucune commande trouvée pour cette période.</p>';
    }

    return `
      <table class="history-orders-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Point de vente</th>
            <th>Montant (FCFA)</th>
            <th>Livreur</th>
            <th>Commentaire</th>
            <th>Note moyenne</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(order => {
            // Calculer la note moyenne
            const ratings = [
              order.service_rating,
              order.quality_rating,
              order.price_rating,
              order.commercial_service_rating
            ].filter(r => r !== null).map(r => parseFloat(r));
            
            const avgRating = ratings.length > 0 ? 
              (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : 'N/A';

            return `
              <tr>
                <td>${new Date(order.date).toLocaleDateString('fr-FR')}</td>
                <td>${order.point_de_vente || '-'}</td>
                <td>${this.formatAmount(order.montant_commande)}</td>
                <td>${order.livreur || '-'}</td>
                <td class="comment-cell">${order.commentaire || '-'}</td>
                <td class="rating-cell">
                  <span class="rating-badge ${avgRating !== 'N/A' ? (avgRating >= 7 ? 'good' : avgRating >= 5 ? 'average' : 'poor') : ''}">
                    ${avgRating}${avgRating !== 'N/A' ? '/10' : ''}
                  </span>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  // Appliquer les filtres de date
  static async applyDateFilters() {
    const startDate = document.getElementById('history-start-date').value;
    const endDate = document.getElementById('history-end-date').value;

    try {
      let url = `${window.API_BASE_URL}/orders/client-history?phone_number=${encodeURIComponent(this.currentPhone)}`;
      
      if (startDate) {
        url += `&start_date=${startDate}`;
      }
      if (endDate) {
        url += `&end_date=${endDate}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors du filtrage');
      }

      const data = await response.json();
      
      // Mettre à jour seulement le tableau
      const tableContainer = document.getElementById('history-orders-table');
      if (tableContainer) {
        tableContainer.innerHTML = this.renderOrdersTable(data.orders);
      }

      if (typeof ToastManager !== 'undefined') {
        ToastManager.success('Filtres appliqués avec succès');
      }

    } catch (error) {
      console.error('❌ Erreur lors du filtrage:', error);
      if (typeof ToastManager !== 'undefined') {
        ToastManager.error('Erreur lors du filtrage');
      } else {
        alert('Erreur lors du filtrage');
      }
    }
  }

  // Réinitialiser les filtres
  static resetDateFilters() {
    document.getElementById('history-start-date').value = '';
    document.getElementById('history-end-date').value = '';
    this.applyDateFilters();
  }

  // Fermer le modal
  static closeHistoryModal() {
    const modal = document.getElementById('history-modal-overlay');
    if (modal) {
      modal.remove();
    }
  }

  // Formater un montant
  static formatAmount(amount) {
    if (!amount) return '0';
    return parseFloat(amount).toLocaleString('fr-FR');
  }
}

// Initialiser au chargement de la page
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ClientHistoryManager.init());
} else {
  ClientHistoryManager.init();
}

