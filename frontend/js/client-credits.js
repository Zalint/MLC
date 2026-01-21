/**
 * Gestion des crédits clients MATA
 * Permet d'attribuer des crédits aux clients avec date d'expiration
 */

// Empêcher la double initialisation
if (window.clientCreditsInitialized) {
  console.log('⚠️ Client credits already initialized, skipping');
} else {
  window.clientCreditsInitialized = true;

// Variables globales
let clientsData = [];

/**
 * Initialiser la gestion des crédits clients
 */
function initClientCredits() {
  console.log('💳 Initialisation de la gestion des crédits clients');

  // Event listeners pour les boutons - utiliser la délégation d'événements
  document.body.addEventListener('click', (e) => {
    if (e.target.closest('#open-client-credits')) {
      e.preventDefault();
      openClientCreditsPage();
    } else if (e.target.closest('#close-client-credits')) {
      e.preventDefault();
      closeClientCreditsPage();
    } else if (e.target.closest('#refresh-client-credits')) {
      e.preventDefault();
      loadClientCredits();
    } else if (e.target.closest('#clear-client-credits-search')) {
      e.preventDefault();
      clearClientCreditsSearch();
    }
  });

  // Event listener pour la recherche (avec délégation)
  document.body.addEventListener('input', (e) => {
    if (e.target.id === 'client-credits-search') {
      filterClientsBySearch(e.target.value);
    }
  });
}

/**
 * Ouvrir la page des crédits clients
 */
function openClientCreditsPage() {
  console.log('📂 Ouverture de la page crédits clients');
  
  // Masquer la page MATA
  document.getElementById('mata-monthly-dashboard-page').style.display = 'none';
  
  // Afficher la page crédits
  const creditsPage = document.getElementById('client-credits-page');
  creditsPage.style.display = 'block';
  creditsPage.classList.add('active');
  
  // Charger les données
  loadClientCredits();
}

/**
 * Fermer la page des crédits clients
 */
function closeClientCreditsPage() {
  console.log('📂 Fermeture de la page crédits clients');
  
  // Masquer la page crédits
  const creditsPage = document.getElementById('client-credits-page');
  creditsPage.style.display = 'none';
  creditsPage.classList.remove('active');
  
  // Réafficher la page MATA
  document.getElementById('mata-monthly-dashboard-page').style.display = 'block';
}

/**
 * Charger la liste des clients MATA avec leurs crédits
 */
async function loadClientCredits() {
  try {
    const container = document.getElementById('client-credits-container');
    container.innerHTML = '<div class="loading-message"><p>🔄 Chargement des clients...</p></div>';

    const response = await ApiClient.request('/clients/mata-list');
    clientsData = response.clients || [];

    console.log(`📊 ${clientsData.length} clients chargés`);

    // Mettre à jour les statistiques
    updateCreditsStatistics();

    // Afficher les clients
    displayClients();

  } catch (error) {
    console.error('❌ Erreur loadClientCredits:', error);
    document.getElementById('client-credits-container').innerHTML = `
      <div class="alert alert-danger">
        <p>❌ Erreur lors du chargement des clients</p>
        <p>${error.message}</p>
      </div>
    `;
  }
}

/**
 * Mettre à jour les statistiques des crédits
 */
function updateCreditsStatistics() {
  const totalClients = clientsData.length;
  const clientsWithCredit = clientsData.filter(c => c.current_credit > 0).length;
  const totalCreditsAmount = clientsData.reduce((sum, c) => sum + parseFloat(c.current_credit || 0), 0);

  document.getElementById('total-clients').textContent = totalClients;
  document.getElementById('clients-with-credit').textContent = clientsWithCredit;
  document.getElementById('total-credits-amount').textContent = totalCreditsAmount.toLocaleString() + ' FCFA';
}

/**
 * Afficher la liste des clients
 */
function displayClients() {
  const container = document.getElementById('client-credits-container');

  if (clientsData.length === 0) {
    container.innerHTML = `
      <div class="alert alert-info">
        <p>📦 Aucun client MATA trouvé</p>
      </div>
    `;
    return;
  }

  let html = '<div class="clients-credits-list">';

  clientsData.forEach(client => {
    html += renderClientCreditCard(client);
  });

  html += '</div>';

  container.innerHTML = html;

  // Ajouter les event listeners
  addClientCreditsEventListeners();

  // Appliquer le filtre de recherche s'il y en a un
  const searchInput = document.getElementById('client-credits-search');
  if (searchInput && searchInput.value.trim()) {
    filterClientsBySearch(searchInput.value);
  }
}

/**
 * Filtrer les clients par recherche (numéro ou nom)
 */
function filterClientsBySearch(searchTerm) {
  const searchLower = searchTerm.toLowerCase().trim();
  const cards = document.querySelectorAll('.client-credit-card');
  let visibleCount = 0;

  if (!searchLower) {
    // Afficher tous les clients si la recherche est vide
    cards.forEach(card => {
      card.style.display = 'block';
      visibleCount++;
    });
    document.getElementById('client-credits-search-results').style.display = 'none';
    return;
  }

  // Filtrer les clients
  cards.forEach(card => {
    const phone = card.dataset.phone || '';
    const client = clientsData.find(c => c.phone_number === phone);
    
    if (!client) {
      card.style.display = 'none';
      return;
    }

    // Rechercher dans le numéro de téléphone
    const phoneMatch = phone.toLowerCase().includes(searchLower);
    
    // Rechercher dans le nom principal
    const primaryNameMatch = (client.primary_name || '').toLowerCase().includes(searchLower);
    
    // Rechercher dans les noms alternatifs
    const alternativeNames = client.alternative_names || [];
    const alternativeNamesMatch = alternativeNames.some(name => 
      name.toLowerCase().includes(searchLower)
    );

    // Afficher si une correspondance est trouvée
    if (phoneMatch || primaryNameMatch || alternativeNamesMatch) {
      card.style.display = 'block';
      visibleCount++;
    } else {
      card.style.display = 'none';
    }
  });

  // Afficher le nombre de résultats
  const resultsDiv = document.getElementById('client-credits-search-results');
  const countSpan = document.getElementById('client-credits-search-count');
  if (resultsDiv && countSpan) {
    countSpan.textContent = visibleCount;
    resultsDiv.style.display = 'block';
  }
}

/**
 * Effacer la recherche
 */
function clearClientCreditsSearch() {
  const searchInput = document.getElementById('client-credits-search');
  if (searchInput) {
    searchInput.value = '';
    filterClientsBySearch('');
  }
}

/**
 * Rendre une carte de crédit client
 */
function renderClientCreditCard(client) {
  const hasCredit = client.current_credit > 0;
  const isExpired = client.is_expired;
  const alternativeNames = client.alternative_names || [client.primary_name];
  const nameCount = client.name_count || 1;

  return `
    <div class="client-credit-card" data-phone="${client.phone_number}">
      <div class="client-credit-header">
        <div class="client-info">
          <div class="client-phone">
            <span class="icon">📱</span>
            <strong>${client.phone_number}</strong>
          </div>
          <div class="client-name">
            <span class="icon">👤</span>
            ${client.primary_name}
            ${nameCount > 1 ? `
              <button class="btn-toggle-names btn-link" data-phone="${client.phone_number}">
                <span class="toggle-icon">▶</span>
                Voir les variantes (${nameCount})
              </button>
            ` : ''}
          </div>
          ${nameCount > 1 ? `
            <div class="alternative-names" id="names-${client.phone_number}" style="display: none; margin-top: 0.5rem; padding-left: 1.5rem; color: #666; font-size: 0.9rem;">
              ${alternativeNames.map(name => `<div>• ${name}</div>`).join('')}
            </div>
          ` : ''}
          <div class="client-stats" style="font-size: 0.85rem; color: #666; margin-top: 0.5rem;">
            <span>📦 ${client.total_orders || 0} commandes</span>
            <span style="margin-left: 1rem;"> ${parseFloat(client.total_spent || 0).toLocaleString()} FCFA</span>
          </div>
        </div>
        
        ${hasCredit && !isExpired ? `
          <div class="credit-badge credit-active">
            <div class="credit-amount">${parseFloat(client.current_credit).toLocaleString()} FCFA</div>
            <div class="credit-expires">⏱️ ${client.days_remaining} jour${client.days_remaining > 1 ? 's' : ''} restant${client.days_remaining > 1 ? 's' : ''}</div>
          </div>
        ` : hasCredit && isExpired ? `
          <div class="credit-badge credit-expired">
            <div class="credit-amount">Expiré</div>
            <div class="credit-expires">❌ Crédit expiré</div>
          </div>
        ` : ''}
      </div>

      <div class="client-credit-form">
        <div class="form-row">
          <div class="form-group">
            <label for="credit-amount-${client.phone_number}">Montant du crédit (FCFA)</label>
            <input 
              type="number" 
              id="credit-amount-${client.phone_number}" 
              class="form-control" 
              value="${hasCredit && !isExpired ? client.credit_amount : ''}"
              placeholder="Ex: 5000"
              min="0"
              step="100"
            >
          </div>

          <div class="form-group">
            <label for="credit-days-${client.phone_number}">⏱️ Délai d'expiration (jours)</label>
            <input 
              type="number" 
              id="credit-days-${client.phone_number}" 
              class="form-control" 
              value="${hasCredit && !isExpired ? client.expiration_days : '30'}"
              placeholder="Ex: 30"
              min="1"
              max="365"
            >
          </div>

          <div class="form-group">
            <label>&nbsp;</label>
            <button 
              class="btn btn-primary btn-save-credit" 
              data-phone="${client.phone_number}"
              style="width: 100%;"
            >
              <span class="icon">💾</span>
              Sauvegarder
            </button>
          </div>

          ${hasCredit ? `
            <div class="form-group">
              <label>&nbsp;</label>
              <button 
                class="btn btn-danger btn-delete-credit" 
                data-phone="${client.phone_number}"
                style="width: 100%;"
              >
                <span class="icon">🗑️</span>
                Supprimer
              </button>
            </div>
          ` : ''}

          <div class="form-group">
            <label>&nbsp;</label>
            <button 
              class="btn btn-info btn-view-history" 
              data-phone="${client.phone_number}"
              style="width: 100%;"
            >
              <span class="icon">📜</span>
              Historique
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Ajouter les event listeners pour les actions des crédits
 */
function addClientCreditsEventListeners() {
  // Toggle des noms alternatifs
  document.querySelectorAll('.btn-toggle-names').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const phone = e.currentTarget.dataset.phone;
      const namesDiv = document.getElementById(`names-${phone}`);
      const icon = e.currentTarget.querySelector('.toggle-icon');
      
      if (namesDiv.style.display === 'none') {
        namesDiv.style.display = 'block';
        icon.textContent = '▼';
        e.currentTarget.innerHTML = `<span class="toggle-icon">▼</span> Masquer les variantes`;
      } else {
        namesDiv.style.display = 'none';
        icon.textContent = '▶';
        const client = clientsData.find(c => c.phone_number === phone);
        e.currentTarget.innerHTML = `<span class="toggle-icon">▶</span> Voir les variantes (${client.name_count})`;
      }
    });
  });

  // Sauvegarder un crédit
  document.querySelectorAll('.btn-save-credit').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const phone = e.currentTarget.dataset.phone;
      await saveCredit(phone);
    });
  });

  // Supprimer un crédit
  document.querySelectorAll('.btn-delete-credit').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const phone = e.currentTarget.dataset.phone;
      
      if (window.ModalManager) {
        window.ModalManager.confirm(
          'Supprimer le crédit',
          `Êtes-vous sûr de vouloir supprimer le crédit de ce client (${phone}) ?`,
          async () => {
            await deleteCredit(phone);
          },
          {
            type: 'danger',
            confirmText: 'Oui, supprimer',
            cancelText: 'Annuler'
          }
        );
      } else {
        if (confirm(`Supprimer le crédit du client ${phone} ?`)) {
          await deleteCredit(phone);
        }
      }
    });
  });

  // Voir l'historique
  document.querySelectorAll('.btn-view-history').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const phone = e.currentTarget.dataset.phone;
      await viewCreditHistory(phone);
    });
  });
}

/**
 * Sauvegarder un crédit client
 */
async function saveCredit(phone) {
  try {
    const amountInput = document.getElementById(`credit-amount-${phone}`);
    const daysInput = document.getElementById(`credit-days-${phone}`);

    const creditAmount = parseFloat(amountInput.value);
    const expirationDays = parseInt(daysInput.value);

    // Validation
    if (!creditAmount || creditAmount <= 0) {
      if (window.ToastManager) {
        ToastManager.error('Le montant du crédit doit être supérieur à 0');
      }
      return;
    }

    if (!expirationDays || expirationDays < 1) {
      if (window.ToastManager) {
        ToastManager.error('Le délai d\'expiration doit être au moins 1 jour');
      }
      return;
    }

    console.log(`💾 Sauvegarde crédit: ${phone} - ${creditAmount} FCFA - ${expirationDays} jours`);

    const response = await ApiClient.request('/clients/credits', {
      method: 'POST',
      body: JSON.stringify({
        phone_number: phone,
        credit_amount: creditAmount,
        expiration_days: expirationDays
      })
    });

    if (response.success) {
      if (window.ToastManager) {
        ToastManager.success(`✅ Crédit de ${creditAmount.toLocaleString()} FCFA attribué à ${phone}`);
      }
      
      // Recharger la liste
      await loadClientCredits();
    }

  } catch (error) {
    console.error('❌ Erreur saveCredit:', error);
    if (window.ToastManager) {
      ToastManager.error(`❌ ${error.message}`);
    }
  }
}

/**
 * Supprimer un crédit client
 */
async function deleteCredit(phone) {
  try {
    console.log(`🗑️ Suppression crédit: ${phone}`);

    const response = await ApiClient.request(`/clients/credits/${phone}`, {
      method: 'DELETE'
    });

    if (response.success) {
      if (window.ToastManager) {
        ToastManager.success(`✅ Crédit supprimé pour ${phone}`);
      }
      
      // Recharger la liste
      await loadClientCredits();
    }

  } catch (error) {
    console.error('❌ Erreur deleteCredit:', error);
    if (window.ToastManager) {
      ToastManager.error(`❌ ${error.message}`);
    }
  }
}

/**
 * Voir l'historique des transactions d'un client
 */
async function viewCreditHistory(phone) {
  // Afficher un spinner de chargement
  const loadingModal = showLoadingModal('Chargement de l\'historique...');
  
  try {
    console.log(`📜 Chargement historique: ${phone}`);

    const response = await ApiClient.request(`/clients/credits/history/${phone}`);

    // Fermer le spinner
    if (loadingModal) loadingModal.remove();

    if (response.success) {
      displayHistoryModal(phone, response.transactions || []);
    }

  } catch (error) {
    // Fermer le spinner en cas d'erreur
    if (loadingModal) loadingModal.remove();
    
    console.error('❌ Erreur viewCreditHistory:', error);
    if (window.ToastManager) {
      ToastManager.error(`❌ ${error.message}`);
    }
  }
}

/**
 * Afficher une modal de chargement avec spinner
 */
function showLoadingModal(message) {
  const modal = document.createElement('div');
  modal.id = 'credit-loading-modal';
  modal.innerHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    ">
      <div style="
        background: white;
        border-radius: 8px;
        padding: 2rem;
        text-align: center;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      ">
        <div style="
          width: 50px;
          height: 50px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #2196f3;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem auto;
        "></div>
        <p style="margin: 0; color: #666; font-size: 1rem;">${message}</p>
      </div>
    </div>
    <style>
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  `;
  document.body.appendChild(modal);
  return modal;
}

/**
 * Afficher l'historique dans une modal
 */
function displayHistoryModal(phone, transactions) {
  const client = clientsData.find(c => c.phone_number === phone);
  const clientName = client ? client.primary_name : phone;

  let historyHTML = '';

  if (transactions.length === 0) {
    historyHTML = '<p style="text-align: center; color: #666; padding: 2rem;">Aucune transaction pour ce client</p>';
  } else {
    historyHTML = `
      <div style="max-height: 500px; overflow-y: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead style="position: sticky; top: 0; background: #f5f5f5;">
            <tr style="border-bottom: 2px solid #ddd;">
              <th style="padding: 0.75rem; text-align: left;">Date</th>
              <th style="padding: 0.75rem; text-align: left;">Type</th>
              <th style="padding: 0.75rem; text-align: right;">Montant</th>
              <th style="padding: 0.75rem; text-align: right;">Solde</th>
              <th style="padding: 0.75rem; text-align: left;">Order ID</th>
            </tr>
          </thead>
          <tbody>
            ${transactions.map(t => {
              const date = new Date(t.created_at);
              const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
              const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
              const isCredit = t.transaction_type === 'CREDIT';
              const isRefund = t.transaction_type === 'REFUND';
              const isDebit = t.transaction_type === 'DEBIT';
              
              return `
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 0.75rem; font-size: 0.9rem;">
                    <div>${dateStr}</div>
                    <div style="color: #999; font-size: 0.8rem;">${timeStr}</div>
                  </td>
                  <td style="padding: 0.75rem;">
                    <span style="
                      display: inline-block;
                      padding: 0.25rem 0.5rem;
                      border-radius: 4px;
                      font-size: 0.85rem;
                      font-weight: 500;
                      background: ${isCredit ? '#e8f5e9' : isRefund ? '#e3f2fd' : '#fff3e0'};
                      color: ${isCredit ? '#2e7d32' : isRefund ? '#1565c0' : '#e65100'};
                    ">
                      ${isCredit ? '✅ Attribution' : isRefund ? '🔄 Remboursement' : '💳 Utilisation'}
                    </span>
                  </td>
                  <td style="padding: 0.75rem; text-align: right; font-weight: 500;">
                    ${parseFloat(t.amount).toLocaleString()} F
                  </td>
                  <td style="padding: 0.75rem; text-align: right; font-size: 0.9rem; color: #666;">
                    ${parseFloat(t.balance_before).toLocaleString()} → ${parseFloat(t.balance_after).toLocaleString()} F
                  </td>
                  <td style="padding: 0.75rem; font-size: 0.85rem; color: #666;">
                    ${t.order_id || '-'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  const modalContent = `
    <div style="padding: 1rem;">
      <h3 style="margin: 0 0 0.5rem 0; color: #333;">
        📜 Historique des transactions
      </h3>
      <p style="margin: 0 0 1.5rem 0; color: #666; font-size: 0.95rem;">
        Client: <strong>${clientName}</strong> (${phone})
        <br>
        <span style="font-size: 0.9rem;">${transactions.length} transaction${transactions.length > 1 ? 's' : ''}</span>
      </p>
      ${historyHTML}
    </div>
  `;

  // Utiliser ModalManager si disponible, sinon alert
  if (window.ModalManager) {
    window.ModalManager.show(
      'Historique des transactions',
      modalContent,
      () => {
        // Recharger les crédits après fermeture de l'historique
        loadClientCredits();
      },
      { size: 'large', showCancel: false, confirmText: 'Fermer' }
    );
  } else {
    // Créer une simple modal si ModalManager n'est pas disponible
    const existingModal = document.getElementById('credit-history-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'credit-history-modal';
    modal.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      ">
        <div style="
          background: white;
          border-radius: 8px;
          max-width: 900px;
          width: 90%;
          max-height: 80vh;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        ">
          ${modalContent}
          <div style="padding: 1rem; border-top: 1px solid #eee; text-align: right;">
            <button 
              class="btn btn-secondary" 
              onclick="document.getElementById('credit-history-modal').remove(); window.clientCreditsModule && window.clientCreditsModule.loadClientCredits();"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
}

// Initialiser au chargement
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initClientCredits);
} else {
  initClientCredits();
}

// Styles CSS inline - Utiliser un ID unique pour éviter les conflits
if (!document.getElementById('client-credits-styles')) {
  const clientCreditsStyles = `
<style>
.clients-credits-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.client-credit-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  transition: box-shadow 0.3s ease;
}

.client-credit-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.client-credit-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f5f5f5;
}

.client-info {
  flex: 1;
}

.client-phone {
  font-size: 1.1rem;
  color: #333;
  margin-bottom: 0.5rem;
}

.client-name {
  font-size: 0.95rem;
  color: #666;
}

.btn-toggle-names {
  background: none;
  border: none;
  color: #2196f3;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  margin-left: 0.5rem;
  font-size: 0.85rem;
}

.btn-toggle-names:hover {
  text-decoration: underline;
}

.toggle-icon {
  font-size: 0.75rem;
  margin-right: 0.25rem;
}

.alternative-names {
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 500px;
  }
}

.credit-badge {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  text-align: right;
  min-width: 150px;
}

.credit-active {
  background: linear-gradient(135deg, #4caf50, #66bb6a);
  color: white;
}

.credit-expired {
  background: linear-gradient(135deg, #f44336, #e57373);
  color: white;
}

.credit-amount {
  font-size: 1.2rem;
  font-weight: bold;
  margin-bottom: 0.25rem;
}

.credit-expires {
  font-size: 0.85rem;
  opacity: 0.9;
}

.client-credit-form {
  margin-top: 1rem;
}

.form-row {
  display: grid;
  grid-template-columns: 2fr 1fr auto auto auto;
  gap: 1rem;
  align-items: end;
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .client-credit-header {
    flex-direction: column;
    gap: 1rem;
  }
  
  .credit-badge {
    width: 100%;
    text-align: left;
  }
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #555;
  font-size: 0.9rem;
}

.btn-link {
  background: none;
  border: none;
  color: #2196f3;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}

.btn-link:hover {
  color: #1976d2;
}
</style>
`;

  // Injecter les styles dans le head
  const styleElement = document.createElement('div');
  styleElement.id = 'client-credits-styles';
  styleElement.innerHTML = clientCreditsStyles;
  document.head.appendChild(styleElement);
}

// Exporter les fonctions pour qu'elles soient accessibles globalement
window.clientCreditsModule = {
  loadClientCredits: loadClientCredits,
  openClientCreditsPage: openClientCreditsPage
};

} // Fin de la garde window.clientCreditsInitialized