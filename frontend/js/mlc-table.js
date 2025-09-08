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

        // Bouton d'export Excel
        const exportExcelBtn = document.getElementById('export-mlc-table-excel');
        if (exportExcelBtn) {
            exportExcelBtn.addEventListener('click', () => this.exportMlcTableToExcel());
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
                            <th>Pack (restant)</th>
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

        // Formater l'affichage du pack en cours
        const packInfo = client.active_pack_info ? 
            `<span class="badge badge-pack">${client.active_pack_info}</span>` : 
            '<span class="text-muted">-</span>';

        return `
            <tr>
                <td>${Utils.escapeHtml(client.client_name)}</td>
                <td>${Utils.escapeHtml(client.phone_number)}</td>
                <td class="text-center">${client.total_orders}</td>
                <td class="text-center">${lastOrderDate}</td>
                <td class="text-center">${client.mlc_abonnement_count}</td>
                <td class="text-center">${client.mlc_simple_count}</td>
                <td class="text-center">${client.supplement_count}</td>
                <td class="text-center">${packInfo}</td>
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
                this.displayClientDetailsModal(response.data, clientName);
            } else {
                throw new Error(response.message || 'Erreur lors du chargement des détails');
            }

        } catch (error) {
            console.error('❌ Erreur lors du chargement des détails:', error);
            ToastManager.error('Erreur lors du chargement des détails: ' + error.message);
        }
    }

    // Afficher la modal de détails
    static displayClientDetailsModal(data, displayName) {
        const { phoneNumber, clientNames, orders, period, activeCard } = data;

        // Calculer les statistiques par livreur
        const livreurStats = {};
        orders.forEach(order => {
            const livreur = order.livreur_name || 'Non assigné';
            if (!livreurStats[livreur]) {
                livreurStats[livreur] = 0;
            }
            livreurStats[livreur]++;
        });

        // Calculer le total correct des courses
        const totalCourses = orders.reduce((sum, order) => {
            const price = parseFloat(order.course_price) || 0;
            return sum + price;
        }, 0);

        // Calculer la somme des suppléments
        const totalSupplements = orders.reduce((sum, order) => {
            if (order.has_supplement && order.subscription_id) {
                // Le supplément est la différence entre le prix payé et le prix de base de l'abonnement
                const basePrice = parseFloat(order.subscription_price) / parseFloat(order.total_deliveries);
                const paidPrice = parseFloat(order.course_price) || 0;
                const supplement = paidPrice - basePrice;
                return sum + (supplement > 0 ? supplement : 0);
            }
            return sum;
        }, 0);
        
        // Debug: afficher les détails du calcul
        console.log('🔍 Debug calcul total courses:');
        console.log('- Nombre de commandes:', orders.length);
        console.log('- Prix individuels (strings):', orders.map(o => o.course_price));
        console.log('- Prix convertis (numbers):', orders.map(o => parseFloat(o.course_price) || 0));
        console.log('- Total calculé:', totalCourses);

        // Créer le contenu de la modal
        const content = `
            <div class="client-details">
                <div class="details-header">
                    <div class="header-top">
                        <h4>Détails - ${Utils.escapeHtml(displayName || 'Client')}</h4>
                        <button id="export-mlc-details-excel" class="btn btn-primary btn-sm">
                            <span class="icon">📊</span>
                            Export Excel
                        </button>
                    </div>
                    <p><strong>Numéro de téléphone:</strong> ${Utils.escapeHtml(phoneNumber)}</p>
                    <p><strong>Période:</strong> ${Utils.formatDisplayDate(period.startDate)} - ${Utils.formatDisplayDate(period.endDate)}</p>
                    
                    ${activeCard ? `
                        <div class="active-card-toggle">
                            <button id="toggle-active-card" class="btn btn-secondary btn-sm">
                                <span class="icon">📋</span>
                                Afficher la carte active
                            </button>
                        </div>
                        <div class="active-card-info" style="display: none;">
                            <h5>📋 Carte active</h5>
                            <div class="card-details">
                                <div class="card-header">
                                    <span class="card-number">${Utils.escapeHtml(activeCard.card_number)}</span>
                                    <span class="card-status active">ACTIVE</span>
                                </div>
                                <div class="card-stats">
                                    <div class="stat-item">
                                        <span class="label">Livraisons:</span>
                                        <div class="progress-bar">
                                            <div class="progress-fill" style="width: ${(activeCard.used_deliveries / activeCard.total_deliveries) * 100}%"></div>
                                        </div>
                                        <span class="value">${activeCard.used_deliveries}/${activeCard.total_deliveries}</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="label">Restantes:</span>
                                        <span class="value">${activeCard.remaining_deliveries}</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="label">Prix de la carte:</span>
                                        <span class="value">${Utils.formatAmount(activeCard.price)} FCFA</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="label">Adresse:</span>
                                        <span class="value">${Utils.escapeHtml(activeCard.address || 'Non renseignée')}</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="label">Achat:</span>
                                        <span class="value">${Utils.formatDisplayDate(activeCard.purchase_date.split('T')[0])}</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="label">Expiration:</span>
                                        <span class="value">${Utils.formatDisplayDate(activeCard.expiry_date.split('T')[0])}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${clientNames.length > 1 ? `
                        <div class="client-names-toggle">
                            <button id="toggle-client-names" class="btn btn-secondary btn-sm">
                                <span class="icon">👥</span>
                                Afficher les noms associés (${clientNames.length})
                            </button>
                        </div>
                        <div class="client-names-section" style="display: none;">
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
                    <span class="value" id="total-courses-display">${Utils.formatAmount(totalCourses)} FCFA</span>
                </div>
                <div class="summary-item">
                    <span class="label">Somme des suppléments:</span>
                    <span class="value" id="total-supplements-display">${Utils.formatAmount(totalSupplements)} FCFA</span>
                </div>
                </div>

                <div class="livreur-stats">
                    <h5>Répartition par livreur:</h5>
                    <div class="livreur-stats-grid">
                        ${Object.entries(livreurStats).map(([livreur, count]) => `
                            <div class="livreur-stat-item">
                                <span class="livreur-name">${Utils.escapeHtml(livreur)}</span>
                                <span class="livreur-count">${count} course${count > 1 ? 's' : ''}</span>
                            </div>
                        `).join('')}
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

        ModalManager.show('Détails client', content, { large: true });

        // Vérifier que le total affiché est correct
        setTimeout(() => {
            const totalDisplay = document.getElementById('total-courses-display');
            if (totalDisplay) {
                console.log('🔍 Total affiché dans le DOM:', totalDisplay.textContent);
                console.log('🔍 Total calculé:', Utils.formatAmount(totalCourses));
            }
        }, 100);

        // Ajouter les gestionnaires d'événements
        this.setupClientDetailsEventListeners(data);
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

    // Configurer les gestionnaires d'événements pour les détails client
    static setupClientDetailsEventListeners(data) {
        // Toggle des noms associés
        const toggleButton = document.getElementById('toggle-client-names');
        const namesSection = document.querySelector('.client-names-section');
        
        if (toggleButton && namesSection) {
            toggleButton.addEventListener('click', () => {
                const isVisible = namesSection.style.display !== 'none';
                namesSection.style.display = isVisible ? 'none' : 'block';
                toggleButton.innerHTML = isVisible ? 
                    `<span class="icon">👥</span> Afficher les noms associés (${data.clientNames.length})` :
                    `<span class="icon">👥</span> Masquer les noms associés (${data.clientNames.length})`;
            });
        }

        // Toggle de la carte active
        const toggleCardButton = document.getElementById('toggle-active-card');
        const cardSection = document.querySelector('.active-card-info');
        
        if (toggleCardButton && cardSection) {
            toggleCardButton.addEventListener('click', () => {
                const isVisible = cardSection.style.display !== 'none';
                cardSection.style.display = isVisible ? 'none' : 'block';
                toggleCardButton.innerHTML = isVisible ? 
                    `<span class="icon">📋</span> Afficher la carte active` :
                    `<span class="icon">📋</span> Masquer la carte active`;
            });
        }

        // Export Excel
        const exportButton = document.getElementById('export-mlc-details-excel');
        if (exportButton) {
            exportButton.addEventListener('click', () => {
                this.exportClientDetailsToExcel(data);
            });
        }
    }

    // Exporter les détails client en Excel
    static async exportClientDetailsToExcel(data) {
        try {
            const { phoneNumber, clientNames, orders, period } = data;
            
            // Préparer les données pour l'export
            const exportData = {
                phoneNumber,
                clientNames,
                orders,
                period,
                totalCourses: orders.reduce((sum, order) => sum + (order.course_price || 0), 0),
                totalOrders: orders.length
            };

            // Appeler l'API d'export (même approche que mata-monthly-export)
            const url = `http://localhost:4000/api/v1/orders/export-mlc-client-details?phoneNumber=${encodeURIComponent(phoneNumber)}&startDate=${period.startDate}&endDate=${period.endDate}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `details-mlc-${phoneNumber}-${period.startDate}-${period.endDate}.xlsx`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                ToastManager.success('Export Excel généré avec succès');
            } else {
                throw new Error('Erreur lors de l\'export');
            }
        } catch (error) {
            console.error('Erreur export Excel:', error);
            ToastManager.error('Erreur lors de l\'export Excel');
        }
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

    // Exporter le tableau MLC en Excel
    static async exportMlcTableToExcel() {
        try {
            console.log('📊 Export Excel du tableau MLC...');
            
            // Vérifier que les dates sont définies
            if (!this.currentFilters.startDate || !this.currentFilters.endDate) {
                Utils.showNotification('Veuillez sélectionner une période', 'error');
                return;
            }

            // Construire l'URL avec les paramètres
            const url = `http://localhost:4000/api/v1/orders/export-mlc-table?startDate=${this.currentFilters.startDate}&endDate=${this.currentFilters.endDate}`;
            
            // Faire la requête
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            // Télécharger le fichier
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            
            // Nom du fichier avec la période
            const startDate = this.currentFilters.startDate.replace(/-/g, '');
            const endDate = this.currentFilters.endDate.replace(/-/g, '');
            link.download = `tableau_mlc_${startDate}_${endDate}.xlsx`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);

            Utils.showNotification('Export Excel réussi !', 'success');
            
        } catch (error) {
            console.error('Erreur export Excel:', error);
            Utils.showNotification('Erreur lors de l\'export Excel', 'error');
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
