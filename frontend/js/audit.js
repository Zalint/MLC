// Gestion de la page d'audit

class AuditManager {
    static currentPage = 1;
    static limit = 50;
    static filters = {};

    static async waitForAuth() {
        // Attendre que localStorage.getItem('user') soit défini (max 5 secondes)
        for (let i = 0; i < 50; i++) {
            const user = localStorage.getItem('user');
            if (user) {
                console.log('✅ Utilisateur trouvé dans localStorage');
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        console.warn('⚠️ Timeout en attendant l\'authentification');
    }

    static async init() {
        console.log('📊 Initialisation de la page d\'audit');

        // Attendre que l'authentification soit vérifiée
        await this.waitForAuth();

        // Vérifier les permissions (managers et admins uniquement)
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user || (user.role !== 'MANAGER' && user.role !== 'ADMIN')) {
            alert('Accès refusé. Cette page est réservée aux managers et administrateurs.');
            window.location.href = 'index.html';
            return;
        }

        // Afficher les informations utilisateur
        document.getElementById('user-name').textContent = user.username;
        document.getElementById('user-role-badge').textContent = user.role;

        // Event listeners
        document.getElementById('apply-filters').addEventListener('click', () => this.applyFilters());
        document.getElementById('reset-filters').addEventListener('click', () => this.resetFilters());
        document.getElementById('prev-page').addEventListener('click', () => this.previousPage());
        document.getElementById('next-page').addEventListener('click', () => this.nextPage());
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());

        // Charger les données
        await this.loadLogs();
    }

    static applyFilters() {
        this.filters = {
            user_role: document.getElementById('filter-user-role').value,
            start_date: document.getElementById('filter-start-date').value,
            end_date: document.getElementById('filter-end-date').value,
            client_phone: document.getElementById('filter-client-phone').value
        };
        
        this.currentPage = 1;
        this.loadLogs();
    }

    static resetFilters() {
        document.getElementById('filter-user-role').value = '';
        document.getElementById('filter-start-date').value = '';
        document.getElementById('filter-end-date').value = '';
        document.getElementById('filter-client-phone').value = '';
        
        this.filters = {};
        this.currentPage = 1;
        this.loadLogs();
    }

    static async loadLogs() {
        try {
            const container = document.getElementById('logs-container');
            container.innerHTML = '<div class="loading">Chargement...</div>';

            // Construire l'URL avec les filtres
            const params = new URLSearchParams({
                limit: this.limit,
                offset: (this.currentPage - 1) * this.limit
            });

            if (this.filters.user_role) params.append('user_role', this.filters.user_role);
            if (this.filters.start_date) params.append('start_date', this.filters.start_date);
            if (this.filters.end_date) params.append('end_date', this.filters.end_date);
            if (this.filters.client_phone) params.append('client_phone', this.filters.client_phone);

            const response = await fetch(`${window.API_BASE_URL}/audit/client-history/logs?${params}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Erreur lors du chargement des logs');
            }

            const data = await response.json();
            
            // Mettre à jour les statistiques
            this.updateStats(data.statistics);
            
            // Afficher les logs
            this.displayLogs(data.logs, data.total);
            
            // Mettre à jour la pagination
            this.updatePagination(data.total);

        } catch (error) {
            console.error('❌ Erreur:', error);
            const container = document.getElementById('logs-container');
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <p>Erreur lors du chargement des données</p>
                </div>
            `;
        }
    }

    static updateStats(stats) {
        document.getElementById('stat-total').textContent = stats.total_accesses || 0;
        
        const avgSeconds = parseFloat(stats.avg_duration_seconds) || 0;
        const avgMinutes = Math.floor(avgSeconds / 60);
        const avgSecs = Math.floor(avgSeconds % 60);
        document.getElementById('stat-avg-duration').textContent = 
            avgSeconds > 0 ? `${avgMinutes}m ${avgSecs}s` : '-';
        
        document.getElementById('stat-users').textContent = stats.unique_users || 0;
        document.getElementById('stat-clients').textContent = stats.unique_clients || 0;
    }

    static displayLogs(logs, total) {
        const container = document.getElementById('logs-container');

        if (logs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <p>Aucun log d'audit trouvé</p>
                </div>
            `;
            return;
        }

        const table = `
            <table class="logs-table">
                <thead>
                    <tr>
                        <th>Date/Heure</th>
                        <th>Utilisateur</th>
                        <th>Rôle</th>
                        <th>Client</th>
                        <th>Téléphone</th>
                        <th>Durée</th>
                        <th>Nb Cmd</th>
                        <th>Montant</th>
                    </tr>
                </thead>
                <tbody>
                    ${logs.map(log => this.renderLogRow(log)).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = table;
    }

    static renderLogRow(log) {
        const openedAt = new Date(log.opened_at);
        const date = openedAt.toLocaleDateString('fr-FR');
        const time = openedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        // Durée
        let durationText = 'En cours';
        let durationClass = '';
        
        if (log.duration_seconds !== null) {
            const minutes = Math.floor(log.duration_seconds / 60);
            const seconds = log.duration_seconds % 60;
            durationText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
            
            // Classe CSS selon la catégorie
            if (log.duration_category === 'Rapide') durationClass = 'duration-rapide';
            else if (log.duration_category === 'Normal') durationClass = 'duration-normal';
            else if (log.duration_category === 'Long') durationClass = 'duration-long';
            else if (log.duration_category === 'Très long') durationClass = 'duration-tres-long';
        }

        // Rôle badge
        const roleClass = `role-${log.user_role.toLowerCase()}`;

        return `
            <tr>
                <td>
                    <div>${date}</div>
                    <div style="font-size: 12px; color: #999;">${time}</div>
                </td>
                <td><strong>${log.username}</strong></td>
                <td><span class="role-badge ${roleClass}">${log.user_role}</span></td>
                <td>${log.client_name}</td>
                <td>${log.client_phone}</td>
                <td><span class="duration-badge ${durationClass}">${durationText}</span></td>
                <td>${log.orders_count}</td>
                <td>${this.formatAmount(log.total_amount)} FCFA</td>
            </tr>
        `;
    }

    static updatePagination(total) {
        const totalPages = Math.ceil(total / this.limit);
        
        if (totalPages <= 1) {
            document.getElementById('pagination').style.display = 'none';
            return;
        }

        document.getElementById('pagination').style.display = 'flex';
        document.getElementById('page-info').textContent = `Page ${this.currentPage} sur ${totalPages}`;
        
        document.getElementById('prev-page').disabled = this.currentPage === 1;
        document.getElementById('next-page').disabled = this.currentPage === totalPages;
    }

    static previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.loadLogs();
        }
    }

    static nextPage() {
        this.currentPage++;
        this.loadLogs();
    }

    static formatAmount(amount) {
        if (!amount) return '0';
        return parseFloat(amount).toLocaleString('fr-FR');
    }

    static logout() {
        localStorage.clear();
        window.location.href = 'login.html';
    }
}

// Initialiser au chargement de la page
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AuditManager.init());
} else {
    AuditManager.init();
}

