// Configuration de l'API - utilise la variable globale de main.js

class GpsAnalyticsManager {
  constructor() {
    this.currentData = {};
    this.charts = {};
    this.init();
  }

  init() {
    console.log('📊 GPS Analytics Manager - Initialisation...');
    
    // Ajouter un indicateur visuel temporaire pour confirmer que nous sommes sur la bonne page
    const pageTitle = document.querySelector('#gps-analytics-page .page-header h2');
    if (pageTitle) {
      pageTitle.style.backgroundColor = '#90EE90';
      pageTitle.style.padding = '10px';
      pageTitle.style.borderRadius = '5px';
      pageTitle.textContent = '📊 Analytics GPS Avancés (ACTIF)';
      console.log('📊 Titre de la page modifié pour confirmation');
    }
    
    this.bindEvents();
    this.loadInitialData();
  }

  bindEvents() {
    // Bouton calculer métriques
    document.getElementById('calculate-metrics')?.addEventListener('click', () => {
      this.calculateMetrics();
    });

    // Bouton actualiser tout
    document.getElementById('refresh-all')?.addEventListener('click', () => {
      this.loadInitialData();
    });

    // Boutons d'actualisation individuels
    document.getElementById('refresh-overview')?.addEventListener('click', () => {
      this.loadOverview();
    });

    document.getElementById('refresh-performance')?.addEventListener('click', () => {
      this.loadDailyPerformance();
    });

    document.getElementById('refresh-trends')?.addEventListener('click', () => {
      this.loadWeeklyTrends();
    });

    document.getElementById('refresh-rankings')?.addEventListener('click', () => {
      this.loadRankings();
    });

    // Changement de filtres
    document.getElementById('period-select')?.addEventListener('change', () => {
      this.loadDailyPerformance();
      this.loadWeeklyTrends();
    });

    document.getElementById('livreur-filter')?.addEventListener('change', () => {
      this.loadDailyPerformance();
    });

    document.getElementById('month-selector')?.addEventListener('change', () => {
      this.loadRankings();
    });

    // Boutons d'export
    document.getElementById('export-performance')?.addEventListener('click', () => {
      this.exportData('daily_performance');
    });

    document.getElementById('export-trends')?.addEventListener('click', () => {
      this.exportData('weekly_trends');
    });
  }

  async loadInitialData() {
    try {
      console.log('📊 Chargement des analytics GPS avec délais...');
      console.log('📊 Configuration:', {
        API_BASE_URL: window.API_BASE_URL,
        token: localStorage.getItem('token') ? 'présent' : 'absent',
        user: AppState.user?.username
      });
      
      // Load data sequentially with delays to prevent rate limiting
      await this.loadLivreurs();
      await new Promise(resolve => setTimeout(resolve, 300));
      
      await this.loadOverview();
      await new Promise(resolve => setTimeout(resolve, 300));
      
      await this.loadDailyPerformance();
      await new Promise(resolve => setTimeout(resolve, 300));
      
      await this.loadWeeklyTrends();
      await new Promise(resolve => setTimeout(resolve, 300));
      
      await this.loadRankings();
      
      console.log('✅ Analytics GPS chargés avec succès');
    } catch (error) {
      console.error('❌ Erreur lors du chargement des analytics:', error);
      this.showError('Erreur lors du chargement des analytics GPS');
    }
  }

  async loadLivreurs() {
    try {
      const response = await ApiClient.getLivreurs();
      const livreurFilter = document.getElementById('livreur-filter');
      
      if (livreurFilter && response.users) {
        livreurFilter.innerHTML = '<option value="">Tous les livreurs</option>';
        response.users.forEach(livreur => {
          const option = document.createElement('option');
          option.value = livreur.id;
          option.textContent = livreur.username;
          livreurFilter.appendChild(option);
        });
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des livreurs:', error);
    }
  }

  async loadOverview() {
    try {
      console.log('📊 Chargement aperçu GPS...');
      const period = document.getElementById('period-select')?.value || '30';
      const response = await ApiClient.request(`/analytics/gps/overview?period=${period}`);
      console.log('📊 Aperçu chargé:', response);
      this.renderOverview(response.data);
    } catch (error) {
      console.error('❌ Erreur overview:', error);
      this.renderOverviewError();
    }
  }

  async loadDailyPerformance() {
    try {
      const period = document.getElementById('period-select')?.value || '30';
      const livreurId = document.getElementById('livreur-filter')?.value || '';
      
      let url = `/analytics/gps/daily-performance?period=${period}`;
      if (livreurId) url += `&livreurId=${livreurId}`;
      
      const response = await ApiClient.request(url);
      this.renderDailyPerformance(response.data);
    } catch (error) {
      console.error('❌ Erreur performances:', error);
      this.renderPerformanceError();
    }
  }

  async loadWeeklyTrends() {
    try {
      const weeks = Math.ceil(parseInt(document.getElementById('period-select')?.value || '30') / 7);
      const response = await ApiClient.request(`/analytics/gps/weekly-trends?weeks=${weeks}`);
      this.renderWeeklyTrends(response.data);
    } catch (error) {
      console.error('❌ Erreur tendances:', error);
      this.renderTrendsError();
    }
  }

  async loadRankings() {
    try {
      const month = document.getElementById('month-selector')?.value || '';
      let url = '/analytics/gps/rankings';
      if (month) url += `?month=${month}`;
      
      const response = await ApiClient.request(url);
      this.renderRankings(response.data);
    } catch (error) {
      console.error('❌ Erreur classement:', error);
      this.renderRankingsError();
    }
  }

  renderOverview(data) {
    console.log('📊 Rendu de l\'aperçu avec les données:', data);
    const container = document.getElementById('overview-content');
    console.log('📊 Container trouvé:', !!container);
    if (!container) {
      console.error('❌ Container overview-content non trouvé!');
      return;
    }

    const globalStats = data.global_stats || {};
    const topPerformers = data.top_performers || [];
    const efficiency = data.efficiency_distribution || [];
    
    console.log('📊 Données à afficher:', { globalStats, topPerformers, efficiency });

    container.innerHTML = `
      <div class="analytics-overview">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">🚚</div>
            <div class="stat-content">
              <h3>${globalStats.active_livreurs || 0}</h3>
              <p>Livreurs actifs</p>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📏</div>
            <div class="stat-content">
              <h3>${Math.round(globalStats.total_distance || 0)} km</h3>
              <p>Distance totale</p>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">🚀</div>
            <div class="stat-content">
              <h3>${Math.round(globalStats.avg_speed || 0)} km/h</h3>
              <p>Vitesse moyenne</p>
            </div>
          </div>
        </div>

        <div class="top-performers">
          <h4>🏆 Top Performers</h4>
          <div class="performers-list">
            ${topPerformers.map((performer, index) => `
              <div class="performer-card">
                <div class="performer-rank">${index + 1}</div>
                <div class="performer-info">
                  <strong>${performer.username}</strong>
                  <span>${Math.round(performer.avg_score)}% efficacité</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    
    console.log('📊 HTML généré et inséré dans le container');
  }

  renderDailyPerformance(data) {
    const container = document.getElementById('performance-content');
    if (!container) return;

    if (!data || data.length === 0) {
      container.innerHTML = `
        <div class="table-empty-state">
          <div class="empty-icon">📅</div>
          <h4>Aucune donnée de performance</h4>
          <p>Il n'y a pas encore de données de performance GPS pour la période sélectionnée.</p>
        </div>
      `;
      return;
    }

    const tableHTML = `
      <div class="analytics-table-container">
        <div class="table-header-section">
          <div>
            <h3 class="table-title">Performances Quotidiennes</h3>
            <p class="table-subtitle">${data.length} enregistrement(s) trouvé(s)</p>
          </div>
        </div>
        <table class="analytics-table">
          <thead>
            <tr>
              <th>📅 Date</th>
              <th>👤 Livreur</th>
              <th>📏 Distance (km)</th>
              <th>⏱️ Temps (min)</th>
              <th>🚀 Vitesse moy.</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(record => `
              <tr>
                <td>${new Date(record.tracking_date).toLocaleDateString('fr-FR')}</td>
                <td>${record.livreur_username}</td>
                <td class="data-distance">
                  <span class="table-metric-indicator">
                    <span class="metric-icon distance"></span>
                    ${Math.round(record.total_distance_km * 100) / 100}
                  </span>
                </td>
                <td class="data-time">
                  <span class="table-metric-indicator">
                    <span class="metric-icon time"></span>
                    ${record.total_time_minutes}
                  </span>
                </td>
                <td class="data-speed">
                  <span class="table-metric-indicator">
                    <span class="metric-icon speed"></span>
                    ${Math.round(record.average_speed_kmh * 10) / 10} km/h
                  </span>
                </td>
              
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = tableHTML;
  }

  renderWeeklyTrends(data) {
    const container = document.getElementById('trends-content');
    if (!container) return;

    if (!data || data.length === 0) {
      container.innerHTML = `
        <div class="table-empty-state">
          <div class="empty-icon">📈</div>
          <h4>Aucune donnée de tendance</h4>
          <p>Il n'y a pas encore de données de tendances hebdomadaires pour la période sélectionnée.</p>
        </div>
      `;
      return;
    }

    const tableHTML = `
      <div class="analytics-table-container">
        <div class="table-header-section">
          <div>
            <h3 class="table-title">Tendances Hebdomadaires</h3>
            <p class="table-subtitle">${data.length} semaine(s) analysée(s)</p>
          </div>
        </div>
        <table class="analytics-table">
          <thead>
            <tr>
              <th>📅 Semaine</th>
              <th>👤 Livreur</th>
              <th>📊 Jours travaillés</th>
              <th>📏 Distance totale (km)</th>
              <th>📈 Distance moy./jour</th>
              <th>⭐ Efficacité moyenne</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(record => `
              <tr>
                <td>${new Date(record.week_start).toLocaleDateString('fr-FR')}</td>
                <td>${record.livreur_username}</td>
                <td>
                  <span class="table-metric-indicator">
                    <span class="metric-icon time"></span>
                    ${record.days_worked}
                  </span>
                </td>
                <td class="data-distance">
                  <span class="table-metric-indicator">
                    <span class="metric-icon distance"></span>
                    ${Math.round(record.total_distance_km * 100) / 100}
                  </span>
                </td>
                <td class="data-distance">
                  <span class="table-metric-indicator">
                    <span class="metric-icon distance"></span>
                    ${Math.round(record.avg_daily_distance_km * 100) / 100}
                  </span>
                </td>
                <td class="data-efficiency">
                  <span class="performance-badge ${this.getPerformanceBadgeClass(record.avg_route_efficiency)}">
                    ${Math.round(record.avg_route_efficiency)}%
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = tableHTML;
  }

  renderRankings(data) {
    const container = document.getElementById('rankings-content');
    if (!container) return;

    if (!data || data.length === 0) {
      container.innerHTML = `
        <div class="table-empty-state">
          <div class="empty-icon">🏆</div>
          <h4>Aucune donnée de classement</h4>
          <p>Il n'y a pas encore de données de classement pour le mois sélectionné. Les classements sont générés automatiquement basés sur les performances GPS.</p>
        </div>
      `;
      return;
    }

    // Afficher le podium pour les 3 premiers
    const podium = data.slice(0, 3);
    const others = data.slice(3);

    const podiumHTML = `
      <div class="podium">
        ${podium.map((livreur, index) => `
          <div class="podium-card rank-${index + 1}">
            <div class="podium-rank">${index + 1}</div>
            <div class="podium-info">
              <h4>${livreur.livreur_username}</h4>
              <p>Score: ${Math.round(livreur.global_score)}</p>
              <p>Efficacité: ${Math.round(livreur.avg_efficiency)}%</p>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    const tableHTML = others.length > 0 ? `
      <div class="analytics-table-container">
        <div class="table-header-section">
          <div>
            <h3 class="table-title">Classement Complet</h3>
            <p class="table-subtitle">Positions 4-${data.length} • ${others.length} livreur(s)</p>
          </div>
        </div>
        <table class="analytics-table">
          <thead>
            <tr>
              <th>🏅 Rang</th>
              <th>👤 Livreur</th>
              <th>📊 Score global</th>
              <th>⭐ Efficacité</th>
              <th>📏 Distance totale</th>
              <th>📅 Jours travaillés</th>
            </tr>
          </thead>
          <tbody>
            ${others.map((livreur, index) => `
              <tr>
                <td>
                  <span class="table-metric-indicator">
                    <span style="background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%); width: 20px; height: 20px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 11px;">${index + 4}</span>
                  </span>
                </td>
                <td>${livreur.livreur_username}</td>
                <td class="data-efficiency">
                  <span class="table-metric-indicator">
                    <span class="metric-icon efficiency"></span>
                    ${Math.round(livreur.global_score)}
                  </span>
                </td>
                <td class="data-efficiency">
                  <span class="performance-badge ${this.getPerformanceBadgeClass(livreur.avg_efficiency)}">
                    ${Math.round(livreur.avg_efficiency)}%
                  </span>
                </td>
                <td class="data-distance">
                  <span class="table-metric-indicator">
                    <span class="metric-icon distance"></span>
                    ${Math.round(livreur.total_distance * 100) / 100} km
                  </span>
                </td>
                <td class="data-time">
                  <span class="table-metric-indicator">
                    <span class="metric-icon time"></span>
                    ${livreur.days_worked}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '';

    container.innerHTML = podiumHTML + tableHTML;
  }

  async calculateMetrics() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await ApiClient.request(`/analytics/gps/calculate-metrics?date=${today}`, {
        method: 'POST'
      });
      
      ToastManager.success(`Métriques calculées pour ${response.data.processed_livreurs} livreurs`);
      this.loadInitialData(); // Recharger les données
    } catch (error) {
      console.error('❌ Erreur calcul métriques:', error);
      ToastManager.error('Erreur lors du calcul des métriques');
    }
  }

  async exportData(type) {
    try {
      const period = document.getElementById('period-select')?.value || '30';
      const livreurId = document.getElementById('livreur-filter')?.value || '';
      
      let url = `/analytics/gps/export?type=${type}&period=${period}`;
      if (livreurId) url += `&livreurId=${livreurId}`;
      
      // Utiliser fetch direct pour gérer le blob
      const response = await fetch(`${window.API_BASE_URL}${url}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) throw new Error('Erreur lors de l\'export');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = downloadUrl;
      a.download = `analytics_${type}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);

      ToastManager.success('Export réalisé avec succès');
    } catch (error) {
      console.error('❌ Erreur export:', error);
      ToastManager.error('Erreur lors de l\'export');
    }
  }

  getPerformanceBadgeClass(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'average';
    return 'poor';
  }

  renderOverviewError() {
    const container = document.getElementById('overview-content');
    if (container) {
      container.innerHTML = `
        <div class="analytics-error">
          <p>❌ Erreur lors du chargement de l'aperçu</p>
          <small>Vérifiez que les données GPS analytics sont disponibles et que le serveur backend fonctionne.</small>
          <br><br>
          <button onclick="window.gpsAnalyticsManager?.loadOverview()" class="btn btn-secondary btn-sm">
            🔄 Réessayer
          </button>
        </div>
      `;
    }
  }

  renderPerformanceError() {
    const container = document.getElementById('performance-content');
    if (container) {
      container.innerHTML = `
        <div class="analytics-error">
          <p>❌ Erreur lors du chargement des performances</p>
          <button onclick="window.gpsAnalyticsManager?.loadDailyPerformance()" class="btn btn-secondary btn-sm">
            🔄 Réessayer
          </button>
        </div>
      `;
    }
  }

  renderTrendsError() {
    const container = document.getElementById('trends-content');
    if (container) {
      container.innerHTML = `
        <div class="analytics-error">
          <p>❌ Erreur lors du chargement des tendances</p>
          <button onclick="window.gpsAnalyticsManager?.loadWeeklyTrends()" class="btn btn-secondary btn-sm">
            🔄 Réessayer
          </button>
        </div>
      `;
    }
  }

  renderRankingsError() {
    const container = document.getElementById('rankings-content');
    if (container) {
      container.innerHTML = `
        <div class="analytics-error">
          <p>❌ Erreur lors du chargement du classement</p>
          <button onclick="window.gpsAnalyticsManager?.loadRankings()" class="btn btn-secondary btn-sm">
            🔄 Réessayer
          </button>
        </div>
      `;
    }
  }

  showError(message) {
    ToastManager.error(message);
  }
}

// Initialiser automatiquement quand la page GPS Analytics est affichée
let gpsAnalyticsManager;

// Export pour utilisation externe
window.GpsAnalyticsManager = GpsAnalyticsManager; 