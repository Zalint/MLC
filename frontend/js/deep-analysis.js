/**
 * 🔬 Deep Analysis Manager
 * 
 * Gère l'analyse approfondie pilotée par IA:
 * - Modal de saisie de question
 * - Questions suggérées (quick actions)
 * - Affichage des résultats avec interprétation IA
 * - Export des résultats
 */

class DeepAnalysisManager {
  static currentAnalysisData = null;
  
  /**
   * Initialiser les event listeners
   */
  static init() {
    console.log('🔬 ==========================================');
    console.log('🔬 INITIALISATION DEEP ANALYSIS MANAGER');
    console.log('🔬 ==========================================');
    
    // Vérifier que la page est bien chargée
    console.log('🔬 Document ready state:', document.readyState);
    console.log('🔬 API_BASE_URL:', window.API_BASE_URL);
    
    // Délégation d'événements pour les boutons dynamiques
    document.addEventListener('click', (e) => {
      // Bouton "Analyse Approfondie"
      if (e.target.closest('#btn-mata-deep-analysis')) {
        console.log('🔬 ✅ BOUTON ANALYSE APPROFONDIE CLIQUÉ!');
        e.preventDefault();
        e.stopPropagation();
        this.showAnalysisModal();
      }
      
      // Fermer le modal d'analyse
      if (e.target.closest('.deep-analysis-modal-close') || 
          (e.target.classList.contains('deep-analysis-modal-overlay') && !e.target.closest('.deep-analysis-modal'))) {
        this.closeAnalysisModal();
      }
      
      // Questions suggérées (quick actions)
      if (e.target.closest('.deep-analysis-quick-btn')) {
        const btn = e.target.closest('.deep-analysis-quick-btn');
        const question = btn.dataset.question;
        console.log('🔬 Question suggérée:', question);
        document.getElementById('deep-analysis-question-input').value = question;
      }
      
      // Bouton "Analyser"
      if (e.target.closest('#btn-submit-deep-analysis')) {
        e.preventDefault();
        e.stopPropagation();
        const question = document.getElementById('deep-analysis-question-input').value.trim();
        if (question) {
          this.performAnalysis(question);
        } else {
          this._showToast('Veuillez saisir une question', 'warning');
        }
      }
      
      // Bouton "Export Excel" dans les résultats
      if (e.target.closest('#btn-export-deep-analysis-excel')) {
        e.preventDefault();
        e.stopPropagation();
        this.exportToExcel();
      }
      
      // Bouton "Nouvelle question"
      if (e.target.closest('#btn-new-deep-analysis-question')) {
        e.preventDefault();
        e.stopPropagation();
        this.showAnalysisModal();
      }
      
      // Clic sur les badges de variations de noms
      if (e.target.closest('.name-variations-badge')) {
        e.preventDefault();
        e.stopPropagation();
        const badge = e.target.closest('.name-variations-badge');
        const names = badge.dataset.names;
        this.showNameVariations(names);
      }
    });
    
    console.log('🔬 ✅ Event listeners installés');
  }
  
  /**
   * Afficher le modal de saisie de question
   */
  static showAnalysisModal() {
    console.log('🔬 showAnalysisModal appelé');
    
    const modalHTML = `
      <div class="deep-analysis-modal-overlay" style="display: flex !important; position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; background-color: rgba(0, 0, 0, 0.7) !important; z-index: 10000 !important; justify-content: center !important; align-items: center !important; padding: 1rem;">
        <div class="deep-analysis-modal" style="background: white !important; border-radius: 12px !important; max-width: 700px !important; width: 100% !important; max-height: 90vh !important; overflow-y: auto !important; box-shadow: 0 10px 40px rgba(0,0,0,0.3) !important; position: relative !important;">
          <div class="deep-analysis-modal-header">
            <h2>🔬 Analyse Approfondie avec IA</h2>
            <button class="deep-analysis-modal-close">&times;</button>
          </div>
          
          <div class="deep-analysis-modal-body">
            <div class="deep-analysis-intro">
              <p>💡 <strong>Posez une question en langage naturel</strong> sur vos clients MATA.</p>
              <p>L'intelligence artificielle va analyser vos données et vous fournir une réponse détaillée.</p>
            </div>
            
            <div class="deep-analysis-quick-actions">
              <h3>💡 Questions suggérées:</h3>
              <div class="quick-buttons-grid">
                <button class="deep-analysis-quick-btn" data-question="Quels clients n'ont commandé qu'une seule fois ?">
                  👤 Clients à 1 commande
                </button>
                <button class="deep-analysis-quick-btn" data-question="Clients inactifs depuis 30 jours">
                  ⏰ Inactifs 30 jours
                </button>
                <button class="deep-analysis-quick-btn" data-question="Top 10 meilleurs clients">
                  🏆 Top 10 clients
                </button>
                <button class="deep-analysis-quick-btn" data-question="Nouveaux clients du mois">
                  🆕 Nouveaux clients
                </button>
                <button class="deep-analysis-quick-btn" data-question="Clients à risque de churn">
                  ⚠️ Risque de churn
                </button>
                <button class="deep-analysis-quick-btn" data-question="Clients avec note de satisfaction inférieure à 6">
                  😞 Clients insatisfaits
                </button>
                <button class="deep-analysis-quick-btn" data-question="Clients avec un panier total inférieur à 10000 FCFA">
                  💰 Panier < 10k
                </button>
                <button class="deep-analysis-quick-btn" data-question="Clients avec un panier total supérieur à 30000 FCFA">
                  💎 Panier > 30k
                </button>
              </div>
            </div>
            
            <div class="deep-analysis-question-input-section">
              <h3>❓ Votre question:</h3>
              <textarea 
                id="deep-analysis-question-input" 
                class="deep-analysis-question-input"
                placeholder="Ex: Quels sont les clients qui commandent le plus souvent ? Clients qui ont commandé plus de 100 000 FCFA ? Clients qui commandent le vendredi à Ngor ?"
                rows="3"
                maxlength="500"
              ></textarea>
              <div class="char-counter">
                <span id="question-char-count">0</span>/500 caractères
              </div>
            </div>
            
            <div class="deep-analysis-actions">
              <button id="btn-submit-deep-analysis" class="btn btn-primary btn-lg">
                <span class="icon">🔍</span>
                Analyser
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Insérer le modal dans le DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Focus sur le textarea
    setTimeout(() => {
      const textarea = document.getElementById('deep-analysis-question-input');
      if (textarea) {
        textarea.focus();
        
        // Compteur de caractères
        textarea.addEventListener('input', (e) => {
          const count = e.target.value.length;
          document.getElementById('question-char-count').textContent = count;
        });
        
        // Soumettre avec Ctrl+Enter
        textarea.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            document.getElementById('btn-submit-deep-analysis').click();
          }
        });
      }
    }, 100);
    
    console.log('🔬 ✅ Modal d\'analyse affiché');
  }
  
  /**
   * Fermer le modal d'analyse
   */
  static closeAnalysisModal() {
    const modal = document.querySelector('.deep-analysis-modal-overlay');
    if (modal) {
      modal.remove();
    }
  }
  
  /**
   * Afficher les variations de noms pour un client
   */
  static showNameVariations(names) {
    const nameList = names.split(', ');
    
    const variationsHTML = `
      <div class="name-variations-popup-overlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0, 0, 0, 0.5); z-index: 15000; display: flex; justify-content: center; align-items: center; padding: 1rem;">
        <div class="name-variations-popup" style="background: white; border-radius: 12px; padding: 2rem; max-width: 500px; width: 100%; box-shadow: 0 10px 40px rgba(0,0,0,0.3); position: relative;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 2px solid #6366f1; padding-bottom: 0.75rem;">
            <h3 style="margin: 0; color: #1f2937; font-size: 1.25rem;">📝 Variations de nom (${nameList.length})</h3>
            <button class="name-variations-close" style="background: none; border: none; font-size: 2rem; color: #9ca3af; cursor: pointer; padding: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; line-height: 1;" title="Fermer">&times;</button>
          </div>
          
          <div style="max-height: 400px; overflow-y: auto;">
            <ul style="list-style: none; padding: 0; margin: 0;">
              ${nameList.map((name, index) => `
                <li style="padding: 0.75rem 1rem; background: ${index % 2 === 0 ? '#f9fafb' : '#ffffff'}; border-left: 3px solid #6366f1; margin-bottom: 0.5rem; border-radius: 4px; font-size: 1rem; color: #1f2937;">
                  <span style="color: #6366f1; font-weight: bold; margin-right: 0.5rem;">${index + 1}.</span>
                  ${this._escapeHtml(name.trim())}
                </li>
              `).join('')}
            </ul>
          </div>
          
          <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; text-align: center;">
            <button class="name-variations-close btn btn-secondary" style="padding: 0.5rem 1.5rem;">Fermer</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', variationsHTML);
    
    // Écouteurs pour fermer le popup
    const popup = document.querySelector('.name-variations-popup-overlay');
    const closeButtons = document.querySelectorAll('.name-variations-close');
    
    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => popup.remove());
    });
    
    // Cliquer sur l'overlay pour fermer
    popup.addEventListener('click', (e) => {
      if (e.target === popup) {
        popup.remove();
      }
    });
    
    console.log('👁️ Affichage des variations de noms:', nameList);
  }
  
  /**
   * Effectuer l'analyse approfondie
   */
  static async performAnalysis(question) {
    console.log('🔬 performAnalysis - Question:', question);
    
    // Fermer le modal de saisie
    this.closeAnalysisModal();
    
    // Afficher le modal de chargement
    this.showLoadingModal(question);
    
    try {
      // Utiliser ApiClient pour gérer automatiquement l'authentification
      const data = await ApiClient.request('/orders/mata-deep-analysis', {
        method: 'POST',
        body: { question }
      });
      
      console.log('🔬 Analysis data:', data);
      
      // Stocker les données pour export
      this.currentAnalysisData = data;
      
      // Afficher les résultats
      setTimeout(() => {
        this.displayResults(data);
      }, 300);
      
    } catch (error) {
      console.error('❌ Error in performAnalysis:', error);
      
      // Fermer le modal de chargement
      this.closeLoadingModal();
      
      // Extraire le message d'erreur et la suggestion
      let errorMessage = 'Une erreur est survenue lors de l\'analyse';
      let suggestion = null;
      
      try {
        // Si l'erreur contient un objet JSON stringifié
        if (error.message && error.message.includes('{')) {
          const errorObj = JSON.parse(error.message);
          errorMessage = errorObj.error || errorMessage;
          suggestion = errorObj.suggestion;
        } else {
          errorMessage = error.message || errorMessage;
        }
      } catch (e) {
        // Si le parsing JSON échoue, utiliser le message brut
        errorMessage = error.message || errorMessage;
      }
      
      // Afficher un modal d'erreur avec suggestion si disponible
      if (suggestion) {
        this.showErrorModal(errorMessage, suggestion);
      } else {
        this._showToast(`❌ ${errorMessage}`, 'error');
      }
    }
  }
  
  /**
   * Afficher un modal d'erreur avec suggestion
   */
  static showErrorModal(errorMessage, suggestion) {
    const errorHTML = `
      <div class="deep-analysis-modal-overlay" style="display: flex !important; position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; background-color: rgba(0, 0, 0, 0.7) !important; z-index: 10000 !important; justify-content: center !important; align-items: center !important; padding: 1rem;">
        <div class="deep-analysis-modal" style="background: white !important; border-radius: 12px !important; padding: 2.5rem !important; text-align: center !important; max-width: 550px !important; box-shadow: 0 10px 40px rgba(0,0,0,0.3) !important;">
          <div style="font-size: 4rem; margin-bottom: 1rem;">❌</div>
          <h3 style="margin-bottom: 1rem; font-size: 1.5rem; color: #dc2626;">Erreur</h3>
          <p style="color: #1f2937; margin-bottom: 1.5rem; font-size: 1.05rem; font-weight: 500;">${this._escapeHtml(errorMessage)}</p>
          
          ${suggestion ? `
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; text-align: left;">
              <p style="margin: 0; color: #92400e; font-size: 0.95rem;"><strong>💡 Suggestion:</strong></p>
              <p style="margin: 0.5rem 0 0 0; color: #78350f; font-size: 0.9rem;">${this._escapeHtml(suggestion)}</p>
            </div>
          ` : ''}
          
          <button class="deep-analysis-modal-close btn btn-primary" style="padding: 0.75rem 2rem; font-size: 1rem;">
            Réessayer
          </button>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', errorHTML);
    
    // Écouteur pour fermer et rouvrir le modal de saisie
    const closeBtn = document.querySelector('.deep-analysis-modal-close');
    closeBtn.addEventListener('click', () => {
      document.querySelector('.deep-analysis-modal-overlay').remove();
      this.showAnalysisModal();
    });
  }
  
  /**
   * Afficher le modal de chargement avec spinner animé
   */
  static showLoadingModal(question) {
    const loadingHTML = `
      <div class="deep-analysis-modal-overlay" style="display: flex !important; position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; background-color: rgba(0, 0, 0, 0.7) !important; z-index: 10000 !important; justify-content: center !important; align-items: center !important;">
        <div class="deep-analysis-modal" style="background: white !important; border-radius: 12px !important; padding: 3rem !important; text-align: center !important; max-width: 500px !important;">
          <div class="spinner" style="border: 6px solid #e5e7eb; border-top: 6px solid #6366f1; border-right: 6px solid #8b5cf6; border-radius: 50%; width: 80px; height: 80px; animation: spin 1s linear infinite; margin: 0 auto 2rem; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);"></div>
          <h3 style="margin-bottom: 1rem; font-size: 1.5rem; color: #1f2937;">🤖 Analyse en cours...</h3>
          <p style="color: #6b7280; margin-bottom: 1rem; font-size: 1.05rem;">L'intelligence artificielle analyse votre question :</p>
          <p style="font-style: italic; color: #1f2937; background: #f9fafb; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; font-weight: 600; border-left: 4px solid #6366f1;">"${this._escapeHtml(question)}"</p>
          <p style="color: #9ca3af; font-size: 0.9rem;">⏱️ Cela peut prendre quelques secondes...</p>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', loadingHTML);
  }
  
  /**
   * Fermer le modal de chargement
   */
  static closeLoadingModal() {
    const modal = document.querySelector('.deep-analysis-modal-overlay');
    if (modal) {
      modal.remove();
    }
  }
  
  /**
   * Afficher les résultats de l'analyse
   */
  static displayResults(data) {
    console.log('🔬 displayResults - data:', data);
    
    // Fermer le modal de chargement
    this.closeLoadingModal();
    
    const { question, result_count, interpretation, data: results, endpoint_used } = data;
    
    // Créer le HTML des résultats
    const resultsHTML = `
      <div class="deep-analysis-modal-overlay" style="display: flex !important; position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; background-color: rgba(0, 0, 0, 0.7) !important; z-index: 10000 !important; justify-content: center !important; align-items: center !important; padding: 1rem; overflow-y: auto !important;">
        <div class="deep-analysis-modal deep-analysis-results-modal" style="background: white !important; border-radius: 12px !important; max-width: 1200px !important; width: 100% !important; max-height: 90vh !important; overflow-y: auto !important; box-shadow: 0 10px 40px rgba(0,0,0,0.3) !important; position: relative !important; margin: 2rem auto;">
          <div class="deep-analysis-modal-header">
            <h2>🔬 Résultats de l'Analyse</h2>
            <button class="deep-analysis-modal-close">&times;</button>
          </div>
          
          <div class="deep-analysis-modal-body">
            <!-- Question posée -->
            <div class="analysis-question-section">
              <h3>❓ Votre question:</h3>
              <p class="analysis-question">"${this._escapeHtml(question)}"</p>
            </div>
            
            <!-- Interprétation IA -->
            <div class="analysis-interpretation-section">
              <h3>🤖 Interprétation IA</h3>
              
              <div class="interpretation-summary">
                <h4>📊 Résumé</h4>
                <p>${this._escapeHtml(interpretation.summary)}</p>
              </div>
              
              ${interpretation.insights && interpretation.insights.length > 0 ? `
                <div class="interpretation-insights">
                  <h4>💡 Insights clés</h4>
                  <ul>
                    ${interpretation.insights.map(insight => `<li>${this._escapeHtml(insight)}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
              
              ${interpretation.recommendation ? `
                <div class="interpretation-recommendation">
                  <h4>✅ Recommandation</h4>
                  <p>${this._escapeHtml(interpretation.recommendation)}</p>
                </div>
              ` : ''}
            </div>
            
            <!-- Résultats détaillés -->
            <div class="analysis-results-section">
              <div class="results-header">
                <h3>📋 Résultats détaillés (${result_count} ${result_count > 1 ? 'résultats' : 'résultat'})</h3>
                <button id="btn-export-deep-analysis-excel" class="btn btn-sm btn-success">
                  <span class="icon">📥</span>
                  Exporter Excel
                </button>
              </div>
              
              ${results.length > 0 ? this._renderResultsTable(results) : '<p>Aucun résultat à afficher.</p>'}
            </div>
            
            <!-- Actions -->
            <div class="analysis-actions-section">
              <button id="btn-new-deep-analysis-question" class="btn btn-primary">
                <span class="icon">🔍</span>
                Nouvelle question
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', resultsHTML);
    
    console.log('🔬 ✅ Résultats affichés');
  }
  
  /**
   * Générer le tableau HTML des résultats
   */
  static _renderResultsTable(results) {
    if (results.length === 0) {
      return '<p style="text-align: center; color: #999; padding: 2rem;">Aucun résultat trouvé.</p>';
    }
    
    // Déterminer les colonnes à afficher (basé sur la première ligne)
    const firstRow = results[0];
    const columns = Object.keys(firstRow);
    
    // Créer le tableau
    const tableHTML = `
      <div class="deep-analysis-table-wrapper">
        <table class="deep-analysis-results-table">
          <thead>
            <tr>
              ${columns.map(col => `<th>${this._formatColumnName(col)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${results.map((row, idx) => `
              <tr class="${idx % 2 === 0 ? 'even' : 'odd'}">
                ${columns.map(col => `<td>${this._formatCellValue(col, row[col])}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    
    return tableHTML;
  }
  
  /**
   * Formater le nom de colonne (transformer snake_case en Titre)
   */
  static _formatColumnName(columnName) {
    const nameMap = {
      'client_name': 'Nom du client',
      'phone_number': 'Téléphone',
      'all_client_names': 'Variations de nom',
      'total_orders': 'Total commandes',
      'total_spent': 'Total dépensé',
      'total_amount': 'Montant total',
      'avg_order_amount': 'Panier moyen',
      'order_date': 'Date commande',
      'last_order_date': 'Dernière commande',
      'first_order_date': 'Première commande',
      'point_de_vente': 'Point de vente',
      'source_connaissance': 'Source',
      'days_since_last_order': 'Jours inactivité',
      'churn_risk_level': 'Risque churn',
      'avg_rating': 'Note moyenne',
      'satisfaction_level': 'Satisfaction',
      'unique_customers': 'Clients uniques',
      'total_revenue': 'Chiffre d\'affaires',
      'day_of_week': 'Jour de la semaine',
      'lifetime_value': 'Valeur vie client'
    };
    
    return nameMap[columnName] || columnName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  
  /**
   * Formater la valeur d'une cellule
   */
  static _formatCellValue(columnName, value) {
    if (value === null || value === undefined) {
      return '<span style="color: #ccc;">-</span>';
    }
    
    // Formater les variations de noms
    if (columnName === 'all_client_names') {
      const names = String(value).split(', ');
      if (names.length === 1) {
        return `<span style="color: #10b981; font-style: italic;">✓ Nom unique</span>`;
      }
      return `<span class="name-variations-badge" style="font-size: 0.85rem; color: #6366f1; background: #eef2ff; padding: 0.25rem 0.5rem; border-radius: 4px; display: inline-block; cursor: pointer;" data-names="${this._escapeHtml(value)}" title="Cliquez pour voir les variations">${names.length} variations 👁️</span>`;
    }
    
    // Formater les montants (colonnes contenant "amount", "spent", "revenue", "value")
    if (['total_spent', 'total_amount', 'avg_order_amount', 'total_revenue', 'lifetime_value', 'amount'].includes(columnName)) {
      return `<span class="currency">${parseInt(value).toLocaleString('fr-FR')} FCFA</span>`;
    }
    
    // Formater les risques de churn
    if (columnName === 'churn_risk_level') {
      const colors = {
        'Élevé': 'red',
        'Moyen': 'orange',
        'Faible': 'green'
      };
      return `<span class="badge" style="background-color: ${colors[value] || 'gray'}; color: white; padding: 0.25rem 0.5rem; border-radius: 4px;">${value}</span>`;
    }
    
    // Formater la satisfaction
    if (columnName === 'satisfaction_level') {
      const colors = {
        'Très satisfait': 'green',
        'Satisfait': 'lightgreen',
        'Neutre': 'orange',
        'Insatisfait': 'red'
      };
      return `<span class="badge" style="background-color: ${colors[value] || 'gray'}; color: white; padding: 0.25rem 0.5rem; border-radius: 4px;">${value}</span>`;
    }
    
    // Formater les notes
    if (columnName.includes('rating') || columnName === 'avg_rating') {
      const rating = parseFloat(value);
      return `<span class="rating" style="font-weight: bold; color: ${rating >= 8 ? 'green' : rating >= 6 ? 'orange' : 'red'};">${rating.toFixed(1)}/10</span>`;
    }
    
    return this._escapeHtml(String(value));
  }
  
  /**
   * Exporter les résultats en Excel
   */
  static exportToExcel() {
    if (!this.currentAnalysisData || !this.currentAnalysisData.data) {
      this._showToast('Aucune donnée à exporter', 'warning');
      return;
    }
    
    const { question, data, result_count } = this.currentAnalysisData;
    
    // Créer un nom de fichier sécurisé
    const sanitizedQuestion = question.substring(0, 50).replace(/[^a-z0-9]/gi, '_');
    const filename = `Analyse_${sanitizedQuestion}_${new Date().toISOString().split('T')[0]}.csv`;
    
    // Générer le CSV
    if (data.length === 0) {
      this._showToast('Aucune donnée à exporter', 'warning');
      return;
    }
    
    const columns = Object.keys(data[0]);
    const csvContent = [
      // Header
      columns.map(col => this._formatColumnName(col)).join(';'),
      // Rows
      ...data.map(row => 
        columns.map(col => {
          let value = row[col];
          if (value === null || value === undefined) return '';
          // Échapper les guillemets et retours à la ligne
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(';')
      )
    ].join('\n');
    
    // Télécharger le fichier
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    
    this._showToast('Export Excel réussi !', 'success');
  }
  
  /**
   * Échapper le HTML pour éviter les injections XSS
   */
  static _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Afficher un toast (notification)
   */
  static _showToast(message, type = 'info') {
    // Utiliser ToastManager si disponible
    if (typeof ToastManager !== 'undefined') {
      if (type === 'success') ToastManager.success(message);
      else if (type === 'error') ToastManager.error(message);
      else if (type === 'warning') ToastManager.warning(message);
      else ToastManager.info(message);
    } else {
      // Fallback: alert simple
      alert(message);
    }
  }
}

// Initialiser au chargement de la page
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => DeepAnalysisManager.init());
} else {
  DeepAnalysisManager.init();
}

