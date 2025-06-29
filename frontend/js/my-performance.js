// Configuration de l'API - utilise la variable globale de main.js

class MyPerformanceManager {
  constructor() {
    this.chart = null;
    this.refreshInterval = null;
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadMyPerformance();
    this.startAutoRefresh();
  }

  bindEvents() {
    // Bouton de refresh
    document.getElementById('refresh-my-performance')?.addEventListener('click', () => {
      this.loadMyPerformance();
    });

    // Changement de période
    document.getElementById('my-period-select')?.addEventListener('change', (e) => {
      this.loadMyPerformance(e.target.value);
    });

    // Export personnel
    document.getElementById('export-my-performance')?.addEventListener('click', () => {
      this.exportMyData();
    });
  }

  startAutoRefresh() {
    // Actualiser toutes les 5 minutes pour éviter le rate limiting
    this.refreshInterval = setInterval(() => {
      console.log('🔄 Auto-refresh des performances GPS...');
      this.loadMyPerformance();
    }, 300000); // 5 minutes
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  async loadMyPerformance(period = '7') {
    try {
      console.log('📊 Chargement des performances avec délais...');
      
      // Load data sequentially with delays to prevent rate limiting
      await this.loadMyStats(period);
      await new Promise(resolve => setTimeout(resolve, 300)); // 300ms delay
      
      await this.loadMyHistory(period);
      await new Promise(resolve => setTimeout(resolve, 300)); // 300ms delay
      
      await this.loadMyChart(period);
      await new Promise(resolve => setTimeout(resolve, 300)); // 300ms delay
      
      await this.loadMyRecommendations();
      
      console.log('✅ Performances chargées avec succès');

    } catch (error) {
      console.error('❌ Erreur lors du chargement des performances:', error);
      this.showError('Erreur lors du chargement de vos performances');
    }
  }

  async loadMyStats(period = '7') {
    try {
      let url = '/analytics/gps/daily-performance?';
      
      if (period === 'today') {
        const today = new Date().toISOString().split('T')[0];
        url += `date=${today}`;
      } else {
        url += `period=${period}`;
      }

      const data = await ApiClient.request(url);
      this.renderMyStats(data.data, period);

    } catch (error) {
      console.error('❌ Erreur stats personnelles:', error);
      // Afficher des données par défaut en cas d'erreur
      this.renderMyStats([], period);
    }
  }

  async loadMyHistory(period = '7') {
    try {
      const data = await ApiClient.request(`/analytics/gps/daily-performance?period=${period}`);
      this.renderMyHistory(data.data);

    } catch (error) {
      console.error('❌ Erreur historique:', error);
      // Afficher un message d'erreur dans l'interface
      this.renderMyHistory([]);
    }
  }

  async loadMyChart(period = '7') {
    try {
      const data = await ApiClient.request(`/analytics/gps/daily-performance?period=${period}`);
      this.createMyChart(data.data);

    } catch (error) {
      console.error('❌ Erreur graphique:', error);
      // Créer un graphique vide en cas d'erreur
      this.createMyChart([]);
    }
  }

  renderMyStats(data, period) {
    const today = new Date().toISOString().split('T')[0];
    let totalDistance = 0;
    let totalTime = 0;
    let avgSpeed = 0;
    let avgEfficiency = 0;
    let recordCount = 0;

    if (period === 'today') {
      // Statistiques du jour
      const todayData = data.filter(d => d.tracking_date === today);
      if (todayData.length > 0) {
        const dayData = todayData[0];
        totalDistance = dayData.total_distance_km || 0;
        totalTime = dayData.total_time_minutes || 0;
        avgSpeed = dayData.average_speed_kmh || 0;
        avgEfficiency = dayData.route_efficiency_score || 0;
      }
    } else {
      // Statistiques sur la période
      data.forEach(d => {
        totalDistance += d.total_distance_km || 0;
        totalTime += d.total_time_minutes || 0;
        avgSpeed += d.average_speed_kmh || 0;
        avgEfficiency += d.route_efficiency_score || 0;
        recordCount++;
      });

      if (recordCount > 0) {
        avgSpeed = avgSpeed / recordCount;
        avgEfficiency = avgEfficiency / recordCount;
      }
    }

    // Mettre à jour l'affichage
    document.getElementById('my-distance-today').textContent = `${Math.round(totalDistance * 100) / 100} km`;
    document.getElementById('my-time-today').textContent = `${Math.round(totalTime / 60 * 10) / 10}h`;
    document.getElementById('my-speed-avg').textContent = `${Math.round(avgSpeed * 10) / 10} km/h`;
    document.getElementById('my-efficiency-score').textContent = `${Math.round(avgEfficiency)}%`;
  }

  renderMyHistory(data) {
    const container = document.getElementById('my-history-content');
    if (!container) return;

    if (data.length === 0) {
      container.innerHTML = '<div class="analytics-empty"><p>📅 Aucun historique GPS disponible</p></div>';
      return;
    }

    const tableHTML = `
      <table class="analytics-table">
        <thead>
          <tr>
            <th>📅 Date</th>
            <th>📏 Distance (km)</th>
            <th>⏱️ Temps (h)</th>
            <th>🚀 Vitesse moy.</th>
            <th>⭐ Efficacité</th>
            <th>📊 Évaluation</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(record => `
            <tr>
              <td>${new Date(record.tracking_date).toLocaleDateString('fr-FR')}</td>
              <td>${Math.round(record.total_distance_km * 100) / 100}</td>
              <td>${Math.round(record.total_time_minutes / 60 * 10) / 10}</td>
              <td>${Math.round(record.average_speed_kmh * 10) / 10} km/h</td>
              <td>
                <span class="performance-badge ${this.getPerformanceBadgeClass(record.route_efficiency_score)}">
                  ${Math.round(record.route_efficiency_score)}%
                </span>
              </td>
              <td>
                <span class="performance-badge ${this.getPerformanceBadgeClass(record.route_efficiency_score)}">
                  ${record.performance_rating}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    container.innerHTML = tableHTML;
  }

  createMyChart(data) {
    const ctx = document.getElementById('my-performance-chart');
    if (!ctx) return;

    // Préparer les données pour le graphique
    const sortedData = data.sort((a, b) => new Date(a.tracking_date) - new Date(b.tracking_date));
    const labels = sortedData.map(d => new Date(d.tracking_date).toLocaleDateString('fr-FR'));
    const efficiencyData = sortedData.map(d => Math.round(d.route_efficiency_score));
    const distanceData = sortedData.map(d => Math.round(d.total_distance_km * 100) / 100);

    // Détruire le graphique existant
    if (this.chart) {
      this.chart.destroy();
    }

    // Créer le nouveau graphique
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Score d\'efficacité (%)',
            data: efficiencyData,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.1,
            yAxisID: 'y'
          },
          {
            label: 'Distance (km)',
            data: distanceData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.1,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Score d\'efficacité (%)'
            },
            min: 0,
            max: 100
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Distance (km)'
            },
            grid: {
              drawOnChartArea: false,
            },
          }
        },
        plugins: {
          legend: {
            position: 'top'
          },
          title: {
            display: true,
            text: 'Mon évolution quotidienne'
          }
        }
      }
    });
  }

  async loadMyRecommendations() {
    try {
      // Générer des recommandations basées sur les performances
      const data = await ApiClient.request('/analytics/gps/daily-performance?period=7');
      this.generateRecommendations(data.data);

    } catch (error) {
      console.error('❌ Erreur recommandations:', error);
      // Afficher des recommandations par défaut
      this.generateRecommendations([]);
    }
  }

  generateRecommendations(data) {
    const container = document.getElementById('personal-recommendations');
    if (!container || data.length === 0) return;

    const avgEfficiency = data.reduce((sum, d) => sum + d.route_efficiency_score, 0) / data.length;
    const avgSpeed = data.reduce((sum, d) => sum + d.average_speed_kmh, 0) / data.length;
    const avgDistance = data.reduce((sum, d) => sum + d.total_distance_km, 0) / data.length;

    let recommendations = [];

    if (avgEfficiency < 50) {
      recommendations.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Efficacité à améliorer',
        message: 'Votre score d\'efficacité moyen est de ' + Math.round(avgEfficiency) + '%. Essayez d\'optimiser vos trajets.'
      });
    } else if (avgEfficiency > 80) {
      recommendations.push({
        type: 'success',
        icon: '🌟',
        title: 'Excellente efficacité !',
        message: 'Bravo ! Votre score de ' + Math.round(avgEfficiency) + '% est excellent. Continuez comme ça !'
      });
    }

    if (avgSpeed < 15) {
      recommendations.push({
        type: 'info',
        icon: '🐌',
        title: 'Vitesse à optimiser',
        message: 'Votre vitesse moyenne de ' + Math.round(avgSpeed) + ' km/h pourrait être améliorée.'
      });
    } else if (avgSpeed > 35) {
      recommendations.push({
        type: 'warning',
        icon: '🚨',
        title: 'Attention à la vitesse',
        message: 'Vitesse moyenne élevée (' + Math.round(avgSpeed) + ' km/h). Pensez à la sécurité.'
      });
    }

    if (avgDistance < 10) {
      recommendations.push({
        type: 'info',
        icon: '📏',
        title: 'Distance quotidienne',
        message: 'Distance moyenne de ' + Math.round(avgDistance) + ' km. Vous pourriez augmenter votre activité.'
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        type: 'success',
        icon: '✅',
        title: 'Performances équilibrées',
        message: 'Vos performances sont dans la bonne moyenne. Continuez vos efforts !'
      });
    }

    const html = recommendations.map(rec => `
      <div class="analytics-alert ${rec.type}">
        <strong>${rec.icon} ${rec.title}:</strong> ${rec.message}
      </div>
    `).join('');

    container.innerHTML = html;
  }

  async exportMyData() {
    try {
      const period = document.getElementById('my-period-select')?.value || '7';
      
      // Pour l'export, on utilise fetch direct pour gérer le blob
      const response = await fetch(`${window.API_BASE_URL}/analytics/gps/export?type=daily_performance&period=${period}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) throw new Error('Erreur lors de l\'export');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `mes_performances_gps_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);

      this.showSuccess('Export réalisé avec succès');

    } catch (error) {
      console.error('❌ Erreur export:', error);
      this.showError('Erreur lors de l\'export');
    }
  }

  getPerformanceBadgeClass(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'average';
    return 'poor';
  }

  showSuccess(message) {
    console.log('✅', message);
    // TODO: Implémenter un système de notification
  }

  showError(message) {
    console.error('❌', message);
    // TODO: Implémenter un système de notification
  }
}

// Initialiser quand la page est chargée
let myPerformanceManager;
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('my-performance-page')) {
    myPerformanceManager = new MyPerformanceManager();
  }
}); 