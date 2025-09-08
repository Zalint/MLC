// ===== GESTIONNAIRE DU TABLEAU MLC =====
class MlcTableManager {
    static isLoaded = false;
    static currentData = [];
    static currentFilters = {
        startDate: '',
        endDate: ''
    };

    // Initialiser le gestionnaire
    static async init() {
        console.log('🔄 Initialisation du gestionnaire Tableau MLC...');
        
        // Définir les dates par défaut
        this.setDefaultDates();
        
        // Configurer les événements
        this.setupEventListeners();
        
        // Charger les données initiales
        await this.loadMlcTable();
        
        this.isLoaded = true;
        console.log('✅ Gestionnaire Tableau MLC initialisé');
    }

    // Définir les dates par défaut (1er du mois en cours à aujourd'hui)
    static setDefaultDates() {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1; // getMonth() retourne 0-11, on veut 1-12
        
        // Utiliser des chaînes de dates explicites pour éviter les problèmes de timezone
        const firstDayOfMonth = `${year}-${month.toString().padStart(2, '0')}-01`;
        const todayString = today.toISOString().split('T')[0];
        
        const startDateInput = document.getElementById('mlc-start-date');
        const endDateInput = document.getElementById('mlc-end-date');
        
        if (startDateInput && endDateInput) {
            startDateInput.value = firstDayOfMonth;
            endDateInput.value = todayString;
            
            this.currentFilters.startDate = firstDayOfMonth;
            this.currentFilters.endDate = todayString;
        }
    }

    // Configurer les événements
    static setupEventListeners() {
        // Bouton d'actualisation
        const refreshBtn = document.getElementById('refresh-mlc-table');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadMlcTable());
        }

        // Bouton d'application des filtres
        const applyFiltersBtn = document.getElementById('apply-mlc-filters');
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => this.applyFilters());
        }

        // Changement des dates
        const startDateInput = document.getElementById('mlc-start-date');
        const endDateInput = document.getElementById('mlc-end-date');
        
        if (startDateInput) {
            startDateInput.addEventListener('change', (e) => {
                this.currentFilters.startDate = e.target.value;
            });
        }
        
        if (endDateInput) {
            endDateInput.addEventListener('change', (e) => {
                this.currentFilters.endDate = e.target.value;
            });
        }
    }

    // Appliquer les filtres
    static async applyFilters() {
        console.log('🔍 Application des filtres:', this.currentFilters);
        await this.loadMlcTable();
    }

    // Charger les données du tableau MLC
    static async loadMlcTable() {
        try {
            const container = document.getElementById('mlc-table-container');
            if (!container) return;

            // Afficher le loading
            container.innerHTML = `
                <div class="loading-message">
                    <p>📊 Chargement du tableau MLC...</p>
                </div>
            `;

            // Vérifier que les dates sont définies
            if (!this.currentFilters.startDate || !this.currentFilters.endDate) {
                this.setDefaultDates();
            }

            // Appeler l'API
            const response = await ApiClient.getMlcTable(
                this.currentFilters.startDate,
                this.currentFilters.endDate
            );

            if (response.success) {
                this.currentData = response.data;
                this.displayMlcTable(response.data, response.period);
            } else {
                throw new Error(response.message || 'Erreur lors du chargement des données');
            }

        } catch (error) {
            console.error('❌ Erreur lors du chargement du tableau MLC:', error);
            this.showError('Erreur lors du chargement des données: ' + error.message);
        }
    }

    // Afficher le tableau MLC
    static displayMlcTable(data, period) {
        const container = document.getElementById('mlc-table-container');
        if (!container) return;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="no-data-message">
                    <p>📭 Aucune donnée MLC trouvée pour la période sélectionnée</p>
                    <p><strong>Période:</strong> ${Utils.formatDisplayDate(period.startDate)} - ${Utils.formatDisplayDate(period.endDate)}</p>
                </div>
            `;
            return;
        }

        const tableHTML = `
            <div class="mlc-table-info">
                <p><strong>Période:</strong> ${Utils.formatDisplayDate(period.startDate)} - ${Utils.formatDisplayDate(period.endDate)}</p>
                <p><strong>Nombre de clients:</strong> ${data.length}</p>
            </div>
            
            <div class="table-responsive">
                <table class="table mlc-table">
                    <thead>
                        <tr>
                            <th>Nom du client</th>
                            <th>Numéro de téléphone</th>
                            <th>Total des commandes</th>
                            <th>Date dernière commande</th>
                            <th>MLC abonnement</th>
                            <th>MLC simple</th>
                            <th>Ajouter supplément</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(client => this.createClientRow(client)).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = tableHTML;

        // Configurer les événements des boutons de détails
        this.setupDetailsButtons();
    }

    // Créer une ligne de client
    static createClientRow(client) {
        const lastOrderDate = client.last_order_date ? 
            Utils.formatDisplayDate(client.last_order_date.split('T')[0]) : 
            'N/A';

        return `
            <tr>
                <td>${Utils.escapeHtml(client.client_name)}</td>
                <td>${Utils.escapeHtml(client.phone_number)}</td>
                <td class="text-center">${client.total_orders}</td>
                <td class="text-center">${lastOrderDate}</td>
                <td class="text-center">${client.mlc_abonnement_count}</td>
                <td class="text-center">${client.mlc_simple_count}</td>
                <td class="text-center">${client.supplement_count}</td>
                <td class="text-center">
                    <button class="btn btn-primary btn-sm btn-details" 
                            data-phone="${Utils.escapeHtml(client.phone_number)}"
                            data-name="${Utils.escapeHtml(client.client_name)}">
                        <span class="icon">👁️</span>
                        Détails
                    </button>
                </td>
            </tr>
        `;
    }

    // Configurer les boutons de détails
    static setupDetailsButtons() {
        const detailButtons = document.querySelectorAll('.btn-details');
        detailButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const phoneNumber = e.target.closest('.btn-details').dataset.phone;
                const clientName = e.target.closest('.btn-details').dataset.name;
                await this.showClientDetails(phoneNumber, clientName);
            });
        });
    }

    // Afficher les détails d'un client
    static async showClientDetails(phoneNumber, clientName) {
        try {
            console.log('🔍 Affichage des détails pour:', phoneNumber, clientName);

            // Appeler l'API pour obtenir les détails
            const response = await ApiClient.getMlcClientDetails(
                phoneNumber,
                this.currentFilters.startDate,
                this.currentFilters.endDate
            );

            if (response.success) {
                this.displayClientDetailsModal(response.data);
            } else {
                throw new Error(response.message || 'Erreur lors du chargement des détails');
            }

        } catch (error) {
            console.error('❌ Erreur lors du chargement des détails:', error);
            ToastManager.error('Erreur lors du chargement des détails: ' + error.message);
        }
    }

    // Afficher la modal de détails
    static displayClientDetailsModal(data) {
        const { phoneNumber, clientNames, orders, period } = data;

        // Créer le contenu de la modal
        const content = `
            <div class="client-details">
                <div class="details-header">
                    <h4>Détails des commandes MLC</h4>
                    <p><strong>Numéro de téléphone:</strong> ${Utils.escapeHtml(phoneNumber)}</p>
                    <p><strong>Période:</strong> ${Utils.formatDisplayDate(period.startDate)} - ${Utils.formatDisplayDate(period.endDate)}</p>
                    
                    ${clientNames.length > 1 ? `
                        <div class="client-names-section">
                            <h5>Noms associés à ce numéro:</h5>
                            <ul class="client-names-list">
                                ${clientNames.map(name => `<li>${Utils.escapeHtml(name)}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>

                <div class="details-summary">
                    <div class="summary-item">
                        <span class="label">Nombre de commandes:</span>
                        <span class="value">${orders.length}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Total courses:</span>
                        <span class="value">${Utils.formatAmount(orders.reduce((sum, order) => sum + (order.course_price || 0), 0))}</span>
                    </div>
                </div>

                <div class="details-table">
                    ${orders.length > 0 ? `
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Date/Heure</th>
                                    <th>Client</th>
                                    <th>Adresse</th>
                                    <th>Description</th>
                                    <th>Prix course</th>
                                    <th>Type</th>
                                    <th>Livreur</th>
                                    <th>Supplément</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${orders.map(order => this.createOrderDetailRow(order)).join('')}
                            </tbody>
                        </table>
                    ` : `
                        <p class="no-orders">Aucune commande trouvée pour cette période.</p>
                    `}
                </div>
            </div>
        `;

        ModalManager.show(`Détails - ${Utils.escapeHtml(clientNames[0] || 'Client')}`, content, { large: true });
    }

    // Créer une ligne de détail de commande
    static createOrderDetailRow(order) {
        const orderDate = new Date(order.created_at);
        const dateTime = `${Utils.formatDisplayDate(orderDate.toISOString().split('T')[0])} ${orderDate.toLocaleTimeString()}`;
        
        const orderType = order.subscription_id ? 'MLC Abonnement' : 'MLC Simple';
        const hasSupplement = order.has_supplement ? 'Oui' : 'Non';
        const supplementClass = order.has_supplement ? 'has-supplement' : '';

        return `
            <tr class="${supplementClass}">
                <td>${dateTime}</td>
                <td>${Utils.escapeHtml(order.client_name)}</td>
                <td>${Utils.escapeHtml(order.address || 'N/A')}</td>
                <td>${Utils.escapeHtml(order.description || 'N/A')}</td>
                <td class="text-right">${Utils.formatAmount(order.course_price || 0)}</td>
                <td>
                    <span class="order-type-badge ${orderType.toLowerCase().replace(' ', '-')}">
                        ${orderType}
                    </span>
                </td>
                <td>${Utils.escapeHtml(order.livreur_name || 'N/A')}</td>
                <td class="text-center">
                    <span class="supplement-indicator ${order.has_supplement ? 'yes' : 'no'}">
                        ${hasSupplement}
                    </span>
                </td>
            </tr>
        `;
    }

    // Afficher une erreur
    static showError(message) {
        const container = document.getElementById('mlc-table-container');
        if (container) {
            container.innerHTML = `
                <div class="error-message">
                    <p>❌ ${Utils.escapeHtml(message)}</p>
                    <button class="btn btn-primary btn-sm" onclick="MlcTableManager.loadMlcTable()">
                        Réessayer
                    </button>
                </div>
            `;
        }
    }

    // Nettoyer les ressources
    static cleanup() {
        this.isLoaded = false;
        this.currentData = [];
        this.currentFilters = { startDate: '', endDate: '' };
    }
}

// Les méthodes API sont maintenant définies dans main.js
