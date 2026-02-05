// Gestion de l'historique des commandes client

class ClientHistoryManager {
  
  static currentPhone = null;
  static currentClientName = null;
  static currentAuditLogId = null;
  static auditStartTime = null;

  // Initialiser les événements
  static init() {
    console.log('📋 ==========================================');
    console.log('📋 INITIALISATION CLIENT HISTORY MANAGER');
    console.log('📋 ==========================================');
    
    // Vérifier que la page est bien chargée
    console.log('📋 Document ready state:', document.readyState);
    console.log('📋 API_BASE_URL:', window.API_BASE_URL);
    
    // Délégation d'événements pour les boutons dynamiques
    document.addEventListener('click', (e) => {
      // Log seulement pour les clics sur les boutons pertinents
      const target = e.target;
      const closest = target.closest('.btn-client-history');
      
      if (closest) {
        console.log('📋 ==========================================');
        console.log('📋 CLICK DÉTECTÉ SUR BOUTON DÉTAILS!');
        console.log('📋 Target:', target);
        console.log('📋 Closest button:', closest);
        console.log('📋 ==========================================');
      }
      
      // Bouton Détails client
      if (e.target.closest('.btn-client-history')) {
        console.log('📋 ✅ ✅ ✅ BOUTON DÉTAILS CLIENT DÉTECTÉ!');
        e.preventDefault();
        e.stopPropagation();
        
        const btn = e.target.closest('.btn-client-history');
        const phone = btn.dataset.phone;
        const clientName = btn.dataset.clientName;
        
        console.log('📋 Données récupérées:', {
          phone: phone,
          clientName: clientName,
          btn: btn
        });
        
        if (!phone) {
          console.error('📋 ❌ ERREUR: Pas de numéro de téléphone!');
          if (typeof ToastManager !== 'undefined') {
            ToastManager.error('Erreur: Numéro de téléphone manquant');
          }
          return;
        }
        
        console.log('📋 🚀 Appel de showClientHistory...');
        this.showClientHistory(phone, clientName);
      }

      // Fermer le modal
      if (e.target.id === 'close-history-modal' || e.target.id === 'history-modal-overlay') {
        console.log('📋 Fermeture du modal');
        this.closeHistoryModal();
      }

      // Appliquer les filtres de date
      if (e.target.id === 'apply-history-filters') {
        console.log('📋 Application des filtres');
        this.applyDateFilters();
      }

      // Réinitialiser les filtres
      if (e.target.id === 'reset-history-filters') {
        console.log('📋 Réinitialisation des filtres');
        this.resetDateFilters();
      }
    });

    // 📊 AUDIT: Fermer le log si l'utilisateur quitte/rafraîchit la page
    window.addEventListener('beforeunload', () => {
      if (this.currentAuditLogId) {
        // Utiliser sendBeacon pour envoyer la requête même si la page se ferme
        const durationSeconds = Math.floor((Date.now() - this.auditStartTime) / 1000);
        const data = JSON.stringify({ duration_seconds: durationSeconds });
        
        navigator.sendBeacon(
          `${window.API_BASE_URL}/audit/client-history/${this.currentAuditLogId}/close`,
          new Blob([data], { type: 'application/json' })
        );
      }
    });
    
    console.log('📋 ✅ Event listeners installés');
  }

  // Afficher l'historique d'un client
  static async showClientHistory(phone, clientName) {
    console.log('📋 ==========================================');
    console.log('📋 showClientHistory APPELÉ');
    console.log('📋 Phone:', phone);
    console.log('📋 Client Name:', clientName);
    console.log('📋 ==========================================');
    
    this.currentPhone = phone;
    this.currentClientName = clientName;

    try {
      console.log('📋 Étape 1: Affichage du modal de chargement...');
      // Afficher un modal de chargement
      this.showLoadingModal(clientName);
      console.log('📋 ✅ Modal de chargement affiché');

      // Récupérer l'historique du backend
      const url = `${window.API_BASE_URL}/orders/client-history?phone_number=${encodeURIComponent(phone)}`;
      console.log('📋 Étape 2: Appel API...');
      console.log('📋 URL:', url);
      console.log('📋 Token:', localStorage.getItem('token') ? 'Présent' : 'MANQUANT');
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📋 Étape 3: Réponse reçue');
      console.log('📋 Response status:', response.status);
      console.log('📋 Response OK:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('📋 ❌ Erreur réponse:', errorText);
        throw new Error(`Erreur ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('📋 Étape 4: Données reçues');
      console.log('📋 Data:', data);
      console.log('📋 Nombre de commandes:', data.orders?.length || 0);

      // Afficher le modal avec les données
      console.log('📋 Étape 5: Affichage du modal avec données...');
      this.displayHistoryModal(data);
      console.log('📋 ✅ Modal affiché avec succès');

      // 📊 AUDIT: Enregistrer l'ouverture de l'historique
      await this.trackAuditOpen(phone, clientName || 'Client', data.orders?.length || 0, data.statistics?.total_amount || 0);

    } catch (error) {
      console.error('📋 ❌❌❌ ERREUR DANS showClientHistory:', error);
      console.error('📋 Error stack:', error.stack);
      this.closeHistoryModal();
      
      if (typeof ToastManager !== 'undefined') {
        ToastManager.error('Erreur lors du chargement de l\'historique: ' + error.message);
      } else {
        alert('Erreur lors du chargement de l\'historique: ' + error.message);
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

    // Vérifier si au moins une commande a source_connaissance renseigné
    const hasSourceConnaissance = orders.some(order => order.source_connaissance && order.source_connaissance.trim() !== '');

    return `
      <table class="history-orders-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Point de vente</th>
            <th>Montant (FCFA)</th>
            <th>Livreur</th>
            ${hasSourceConnaissance ? '<th>Comment nous avez-vous connu ?</th>' : ''}
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
                ${hasSourceConnaissance ? `<td>${order.source_connaissance || 'Non renseigné'}</td>` : ''}
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
  static async closeHistoryModal() {
    // 📊 AUDIT: Enregistrer la fermeture de l'historique
    await this.trackAuditClose();

    const modal = document.getElementById('history-modal-overlay');
    if (modal) {
      modal.remove();
    }
  }

  // 📊 AUDIT: Enregistrer l'ouverture de l'historique
  static async trackAuditOpen(clientPhone, clientName, ordersCount, totalAmount) {
    try {
      this.auditStartTime = Date.now();
      
      const response = await fetch(`${window.API_BASE_URL}/audit/client-history/open`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_name: clientName,
          client_phone: clientPhone,
          orders_count: ordersCount,
          total_amount: totalAmount
        })
      });

      if (response.ok) {
        const data = await response.json();
        this.currentAuditLogId = data.log_id;
        console.log('📊 Audit: Ouverture enregistrée', data.log_id);
      }
    } catch (error) {
      console.error('❌ Erreur audit ouverture:', error);
      // Ne pas bloquer l'affichage si l'audit échoue
    }
  }

  // 📊 AUDIT: Enregistrer la fermeture de l'historique
  static async trackAuditClose() {
    if (!this.currentAuditLogId || !this.auditStartTime) {
      return; // Pas de log à fermer
    }

    try {
      const durationSeconds = Math.floor((Date.now() - this.auditStartTime) / 1000);
      
      await fetch(`${window.API_BASE_URL}/audit/client-history/${this.currentAuditLogId}/close`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          duration_seconds: durationSeconds
        })
      });

      console.log('📊 Audit: Fermeture enregistrée', durationSeconds, 'secondes');
      
      // Réinitialiser
      this.currentAuditLogId = null;
      this.auditStartTime = null;
    } catch (error) {
      console.error('❌ Erreur audit fermeture:', error);
      // Ne pas bloquer la fermeture si l'audit échoue
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

