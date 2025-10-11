// Gestion de l'analyse de sentiment et de la source de connaissance pour MATA

class MataSentimentManager {
  
  // Stocker les données du modal pour l'export
  static currentAnalysisData = null;

  // Initialiser les événements
  static init() {
    console.log('🤖 Initialisation du gestionnaire de sentiment MATA');
    
    // Bouton d'analyse de sentiment
    const sentimentBtn = document.getElementById('mata-sentiment-analysis-btn');
    if (sentimentBtn) {
      sentimentBtn.addEventListener('click', () => this.showSentimentAnalysis());
    }

    // Délégation d'événements pour l'édition
    document.addEventListener('click', (e) => {
      // Bouton modifier (commentaire + source)
      if (e.target.closest('.btn-edit-order')) {
        const orderId = e.target.closest('.btn-edit-order').dataset.orderId;
        this.enableOrderEdit(orderId);
      }
      
      // Bouton sauvegarder (commentaire + source)
      if (e.target.closest('.btn-save-order')) {
        const orderId = e.target.closest('.btn-save-order').dataset.orderId;
        this.saveOrderEdits(orderId);
      }
      
      // Bouton annuler (commentaire + source)
      if (e.target.closest('.btn-cancel-order')) {
        const orderId = e.target.closest('.btn-cancel-order').dataset.orderId;
        this.cancelOrderEdit(orderId);
      }

      // Fermer le modal
      if (e.target.id === 'close-sentiment-modal' || e.target.id === 'sentiment-modal-overlay') {
        this.closeSentimentModal();
      }

      // Exporter l'analyse en texte
      if (e.target.id === 'export-sentiment-text-btn' || e.target.closest('#export-sentiment-text-btn')) {
        this.exportSentimentAsText();
      }
    });

    // Gestion du changement de sélection dans le dropdown source
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('source-edit')) {
        const row = e.target.closest('tr');
        const autreInput = row.querySelector('.source-autre-input');
        if (e.target.value === 'Autre') {
          autreInput.classList.remove('hidden');
          autreInput.focus();
        } else {
          autreInput.classList.add('hidden');
        }
      }
    });
  }

  // Activer l'édition complète (commentaire + source)
  static enableOrderEdit(orderId) {
    const row = document.querySelector(`tr[data-order-id="${orderId}"]`);
    if (!row) return;

    // Ne pas permettre l'édition des commandes internes
    if (row.classList.contains('internal-order')) {
      return;
    }

    // Activer l'édition du commentaire
    const commentCell = row.querySelector('.comment-cell');
    const commentDisplay = commentCell.querySelector('.comment-display');
    const commentEdit = commentCell.querySelector('.comment-edit');
    
    commentDisplay.classList.add('hidden');
    commentEdit.classList.remove('hidden');

    // Activer l'édition de la source
    const sourceCell = row.querySelector('.source-connaissance-cell');
    const sourceDisplay = sourceCell.querySelector('.source-display');
    const selectEdit = sourceCell.querySelector('.source-edit');
    const autreInput = sourceCell.querySelector('.source-autre-input');
    
    sourceDisplay.classList.add('hidden');
    selectEdit.classList.remove('hidden');
    
    // Si "Autre" est sélectionné, afficher l'input
    if (selectEdit.value === 'Autre') {
      autreInput.classList.remove('hidden');
    }

    // Modifier les boutons d'action
    const actionsCell = row.querySelector('.mata-actions');
    const editBtn = actionsCell.querySelector('.btn-edit-order');
    const saveBtn = actionsCell.querySelector('.btn-save-order');
    const cancelBtn = actionsCell.querySelector('.btn-cancel-order');
    
    if (editBtn) editBtn.classList.add('hidden');
    if (saveBtn) saveBtn.classList.remove('hidden');
    if (cancelBtn) cancelBtn.classList.remove('hidden');
  }

  // Sauvegarder la source de connaissance
  static async saveSourceConnaissance(orderId) {
    const row = document.querySelector(`tr[data-order-id="${orderId}"]`);
    if (!row) return;

    const sourceCell = row.querySelector('.source-connaissance-cell');
    const selectEdit = sourceCell.querySelector('.source-edit');
    const autreInput = sourceCell.querySelector('.source-autre-input');
    
    // Déterminer la valeur finale
    let sourceValue = selectEdit.value;
    if (sourceValue === 'Autre' && autreInput.value.trim()) {
      sourceValue = autreInput.value.trim();
    } else if (sourceValue === 'Autre') {
      if (typeof ToastManager !== 'undefined') {
        ToastManager.warning('Veuillez préciser la source si vous sélectionnez "Autre"');
      } else {
        alert('Veuillez préciser la source si vous sélectionnez "Autre"');
      }
      return;
    } else if (sourceValue === '') {
      sourceValue = null;
    }

    try {
      const response = await fetch(`${window.API_BASE_URL}/orders/${orderId}/source-connaissance`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ source_connaissance: sourceValue })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la mise à jour');
      }

      const result = await response.json();
      
      // Mettre à jour l'affichage
      const display = sourceCell.querySelector('.source-display');
      display.textContent = sourceValue || 'Non renseigné';
      if (!sourceValue) {
        display.style.color = '#999';
        display.style.fontStyle = 'italic';
      } else {
        display.style.color = '';
        display.style.fontStyle = '';
      }

      // Revenir au mode affichage
      this.cancelSourceEdit(orderId);
      
      if (typeof ToastManager !== 'undefined') {
        ToastManager.success('Source de connaissance mise à jour avec succès');
      }

    } catch (error) {
      console.error('Erreur lors de la mise à jour de la source de connaissance:', error);
      if (typeof ToastManager !== 'undefined') {
        ToastManager.error(error.message || 'Erreur lors de la mise à jour');
      } else {
        alert(error.message || 'Erreur lors de la mise à jour');
      }
    }
  }

  // Annuler l'édition de la source de connaissance
  static cancelSourceEdit(orderId) {
    const row = document.querySelector(`tr[data-order-id="${orderId}"]`);
    if (!row) return;

    const sourceCell = row.querySelector('.source-connaissance-cell');
    const display = sourceCell.querySelector('.source-display');
    const selectEdit = sourceCell.querySelector('.source-edit');
    const autreInput = sourceCell.querySelector('.source-autre-input');
    const actionsCell = row.querySelector('.mata-actions');
    
    // Masquer les contrôles d'édition
    display.classList.remove('hidden');
    selectEdit.classList.add('hidden');
    autreInput.classList.add('hidden');

    // Remettre les boutons d'origine
    const editBtn = actionsCell.querySelector('.btn-edit-source');
    const saveBtn = actionsCell.querySelector('.btn-save-source');
    const cancelBtn = actionsCell.querySelector('.btn-cancel-source');
    
    if (editBtn) editBtn.classList.remove('hidden');
    if (saveBtn) saveBtn.classList.add('hidden');
    if (cancelBtn) cancelBtn.classList.add('hidden');
  }

  // Sauvegarder toutes les modifications (commentaire + source)
  static async saveOrderEdits(orderId) {
    const row = document.querySelector(`tr[data-order-id="${orderId}"]`);
    if (!row) return;

    // Préparer les données de la source
    const sourceCell = row.querySelector('.source-connaissance-cell');
    const selectEdit = sourceCell.querySelector('.source-edit');
    const autreInput = sourceCell.querySelector('.source-autre-input');
    
    let sourceValue = selectEdit.value;
    if (sourceValue === 'Autre' && autreInput.value.trim()) {
      sourceValue = autreInput.value.trim();
    } else if (sourceValue === 'Autre') {
      if (typeof ToastManager !== 'undefined') {
        ToastManager.warning('Veuillez préciser la source si vous sélectionnez "Autre"');
      } else {
        alert('Veuillez préciser la source si vous sélectionnez "Autre"');
      }
      return;
    } else if (sourceValue === '') {
      sourceValue = null;
    }

    // Préparer les données du commentaire
    const commentCell = row.querySelector('.comment-cell');
    const commentEdit = commentCell.querySelector('.comment-edit');
    const commentValue = commentEdit.value.trim() || null;

    try {
      // Sauvegarder la source
      const sourceResponse = await fetch(`${window.API_BASE_URL}/orders/${orderId}/source-connaissance`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ source_connaissance: sourceValue })
      });

      if (!sourceResponse.ok) {
        const errorData = await sourceResponse.json();
        throw new Error(`Erreur source: ${errorData.error || sourceResponse.statusText}`);
      }

      // Sauvegarder le commentaire
      const commentResponse = await fetch(`${window.API_BASE_URL}/orders/${orderId}/comment`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ commentaire: commentValue })
      });

      if (!commentResponse.ok) {
        const errorData = await commentResponse.json();
        throw new Error(`Erreur commentaire: ${errorData.error || commentResponse.statusText}`);
      }

      // Mettre à jour l'affichage de la source
      const sourceDisplay = sourceCell.querySelector('.source-display');
      sourceDisplay.textContent = sourceValue || 'Non renseigné';
      if (!sourceValue) {
        sourceDisplay.style.color = '#999';
        sourceDisplay.style.fontStyle = 'italic';
      } else {
        sourceDisplay.style.color = '';
        sourceDisplay.style.fontStyle = '';
      }

      // Mettre à jour l'affichage du commentaire
      const commentDisplay = commentCell.querySelector('.comment-display');
      commentDisplay.textContent = commentValue || 'Aucun commentaire';
      if (!commentValue) {
        commentDisplay.style.color = '#999';
        commentDisplay.style.fontStyle = 'italic';
      } else {
        commentDisplay.style.color = '';
        commentDisplay.style.fontStyle = '';
      }

      // Revenir au mode affichage
      this.cancelOrderEdit(orderId);
      
      if (typeof ToastManager !== 'undefined') {
        ToastManager.success('Modifications sauvegardées avec succès');
      }

    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      if (typeof ToastManager !== 'undefined') {
        ToastManager.error('Erreur lors de la sauvegarde');
      } else {
        alert('Erreur lors de la sauvegarde');
      }
    }
  }

  // Annuler toutes les modifications (commentaire + source)
  static cancelOrderEdit(orderId) {
    const row = document.querySelector(`tr[data-order-id="${orderId}"]`);
    if (!row) return;

    // Annuler commentaire
    const commentCell = row.querySelector('.comment-cell');
    const commentDisplay = commentCell.querySelector('.comment-display');
    const commentEdit = commentCell.querySelector('.comment-edit');
    
    commentDisplay.classList.remove('hidden');
    commentEdit.classList.add('hidden');

    // Annuler source
    const sourceCell = row.querySelector('.source-connaissance-cell');
    const sourceDisplay = sourceCell.querySelector('.source-display');
    const selectEdit = sourceCell.querySelector('.source-edit');
    const autreInput = sourceCell.querySelector('.source-autre-input');
    
    sourceDisplay.classList.remove('hidden');
    selectEdit.classList.add('hidden');
    autreInput.classList.add('hidden');

    // Remettre les boutons d'origine
    const actionsCell = row.querySelector('.mata-actions');
    const editBtn = actionsCell.querySelector('.btn-edit-order');
    const saveBtn = actionsCell.querySelector('.btn-save-order');
    const cancelBtn = actionsCell.querySelector('.btn-cancel-order');
    
    if (editBtn) editBtn.classList.remove('hidden');
    if (saveBtn) saveBtn.classList.add('hidden');
    if (cancelBtn) cancelBtn.classList.add('hidden');
  }

  // Afficher le modal d'analyse de sentiment
  static async showSentimentAnalysis() {
    const monthInput = document.getElementById('mata-monthly-date-filter');
    const month = monthInput ? monthInput.value : new Date().toISOString().slice(0, 7);
    
    console.log('🗓️ Mois sélectionné pour l\'analyse:', month);

    // Afficher le modal de chargement
    this.showLoadingModal();

    try {
      const response = await fetch(
        `${window.API_BASE_URL}/orders/mata-sentiment-analysis?month=${month}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Erreur lors du chargement de l\'analyse');
      }

      const data = await response.json();
      console.log('📊 Données reçues pour l\'analyse:', data);
      this.displaySentimentModal(data);

    } catch (error) {
      console.error('❌ Erreur lors de l\'analyse de sentiment:', error);
      if (typeof ToastManager !== 'undefined') {
        ToastManager.error(error.message || 'Erreur lors de l\'analyse');
      } else {
        alert(error.message || 'Erreur lors de l\'analyse');
      }
      this.closeSentimentModal();
    }
  }

  // Afficher le modal de chargement
  static showLoadingModal() {
    const existingModal = document.getElementById('sentiment-modal-overlay');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'sentiment-modal-overlay';
    modal.className = 'sentiment-modal-overlay';
    modal.innerHTML = `
      <div class="sentiment-modal">
        <div class="sentiment-modal-content">
            <div class="loading-spinner">
            <div class="spinner"></div>
            <p>🤖 Analyse de satisfaction en cours...</p>
            <small>Veuillez patienter, l'Intelligence Artificielle analyse les commentaires et notes de vos clients</small>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // Afficher le modal d'analyse
  static displaySentimentModal(data) {
    console.log('🎨 Affichage du modal avec les données:', data);
    
    // Supprimer tout modal existant (modal de chargement)
    const existingModal = document.getElementById('sentiment-modal-overlay');
    if (existingModal) {
      console.log('🗑️ Suppression du modal existant (chargement)');
      existingModal.remove();
    }
    
    // Attendre un instant pour que le DOM soit mis à jour
    setTimeout(() => {
      this._renderSentimentModal(data);
    }, 50);
  }

  // Méthode privée pour rendre le modal
  static _renderSentimentModal(data) {
    console.log('🎨 Rendu du modal de résultats');
    
    // Stocker les données pour l'export
    this.currentAnalysisData = data;
    
    const { month, statistics, average_ratings, ai_analysis, by_point_vente, by_source_connaissance } = data;
    
    // Vérifier si on a des données
    if (statistics.total_orders === 0) {
      this.showNoDataModal(month);
      return;
    }
    
    // Formater le mois
    const [year, monthNum] = month.split('-');
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const monthName = monthNames[parseInt(monthNum) - 1];
    
    // Déterminer la couleur du sentiment et utiliser la description de l'IA
    let sentimentColor = '#666';
    let sentimentEmoji = '😐';
    
    if (ai_analysis.sentiment_global === 'POSITIF') {
      sentimentColor = '#10b981';
      sentimentEmoji = '😊';
    } else if (ai_analysis.sentiment_global === 'NEGATIF') {
      sentimentColor = '#ef4444';
      sentimentEmoji = '😞';
    }
    
    // Utiliser la description générée par l'IA
    const sentimentMessage = ai_analysis.sentiment_description || 'Analyse de satisfaction en cours...';

    // Créer le HTML du modal
    const modalHTML = `
      <div id="sentiment-modal-overlay" class="sentiment-modal-overlay">
        <div class="sentiment-modal">
          <div class="sentiment-modal-header">
            <h2>🔍 Analyse de Satisfaction Client avec Intelligence Artificielle - ${monthName} ${year}</h2>
            <div class="modal-header-actions">
              <button id="export-sentiment-text-btn" class="btn-export-sentiment" title="Exporter en texte">
                📄 Exporter
              </button>
              <button id="close-sentiment-modal" class="btn-close-modal">✕</button>
            </div>
          </div>
          
          <div class="sentiment-modal-body">
            
            <!-- Statistiques globales -->
            <div class="sentiment-section">
              <h3>📊 Statistiques Globales</h3>
              <div class="stats-grid-sentiment">
                <div class="stat-box">
                  <div class="stat-value">${statistics.total_orders}</div>
                  <div class="stat-label">Commandes totales</div>
                </div>
                <div class="stat-box">
                  <div class="stat-value">${statistics.orders_with_comments}</div>
                  <div class="stat-label">Avec commentaires (${statistics.comment_percentage}%)</div>
                </div>
                <div class="stat-box">
                  <div class="stat-value">${statistics.orders_with_ratings}</div>
                  <div class="stat-label">Avec notes (${statistics.rating_percentage}%)</div>
                </div>
              </div>
            </div>

            <!-- Notes moyennes -->
            ${average_ratings && average_ratings.global_average ? `
            <div class="sentiment-section">
              <h3>⭐ Notes Moyennes</h3>
              <div class="ratings-grid">
                ${average_ratings.service_rating ? `
                <div class="rating-bar">
                  <div class="rating-label">Service livraison</div>
                  <div class="rating-bar-container">
                    <div class="rating-bar-fill" style="width: ${(parseFloat(average_ratings.service_rating)/10)*100}%"></div>
                    <span class="rating-value">${average_ratings.service_rating}/10</span>
                  </div>
                </div>
                ` : ''}
                ${average_ratings.quality_rating ? `
                <div class="rating-bar">
                  <div class="rating-label">Qualité produits</div>
                  <div class="rating-bar-container">
                    <div class="rating-bar-fill" style="width: ${(parseFloat(average_ratings.quality_rating)/10)*100}%"></div>
                    <span class="rating-value">${average_ratings.quality_rating}/10</span>
                  </div>
                </div>
                ` : ''}
                ${average_ratings.price_rating ? `
                <div class="rating-bar">
                  <div class="rating-label">Niveau prix</div>
                  <div class="rating-bar-container">
                    <div class="rating-bar-fill" style="width: ${(parseFloat(average_ratings.price_rating)/10)*100}%"></div>
                    <span class="rating-value">${average_ratings.price_rating}/10</span>
                  </div>
                </div>
                ` : ''}
                ${average_ratings.commercial_service_rating ? `
                <div class="rating-bar">
                  <div class="rating-label">Service commercial</div>
                  <div class="rating-bar-container">
                    <div class="rating-bar-fill" style="width: ${(parseFloat(average_ratings.commercial_service_rating)/10)*100}%"></div>
                    <span class="rating-value">${average_ratings.commercial_service_rating}/10</span>
                  </div>
                </div>
                ` : ''}
              </div>
            </div>
            ` : ''}

            <!-- Analyse IA -->
            <div class="sentiment-section">
              <h3>🤖 Analyse par Intelligence Artificielle des Retours Clients</h3>
              <div class="sentiment-global" style="border-color: ${sentimentColor}">
                <div class="sentiment-emoji">${sentimentEmoji}</div>
                <div class="sentiment-text">
                  <strong>Satisfaction globale des clients : <span style="color: ${sentimentColor}">${ai_analysis.sentiment_global}</span></strong>
                  <div class="sentiment-score">Score de satisfaction : ${ai_analysis.sentiment_score}%</div>
                  <div class="sentiment-description" style="margin-top: 1rem; line-height: 1.6; color: #374151;">
                    ${sentimentMessage}
                  </div>
                </div>
              </div>

              ${ai_analysis.points_forts && ai_analysis.points_forts.length > 0 ? `
              <div class="analysis-box points-forts">
                <h4>💪 Points Forts</h4>
                <ul>
                  ${ai_analysis.points_forts.map(point => `<li>${point}</li>`).join('')}
                </ul>
              </div>
              ` : ''}

              ${ai_analysis.points_amelioration && ai_analysis.points_amelioration.length > 0 ? `
              <div class="analysis-box points-amelioration">
                <h4>🔧 Points d'Amélioration</h4>
                <ul>
                  ${ai_analysis.points_amelioration.map(point => `<li>${point}</li>`).join('')}
                </ul>
              </div>
              ` : ''}

              ${ai_analysis.recommandations && ai_analysis.recommandations.length > 0 ? `
              <div class="analysis-box recommandations">
                <h4>🎯 Recommandations</h4>
                <ol>
                  ${ai_analysis.recommandations.map(reco => `<li>${reco}</li>`).join('')}
                </ol>
              </div>
              ` : ''}
            </div>

            <!-- Par point de vente -->
            ${by_point_vente && by_point_vente.length > 0 ? `
            <div class="sentiment-section">
              <h3>📍 Satisfaction Client par Point de Vente</h3>
              <div class="point-vente-list">
                ${by_point_vente.map(pv => `
                  <div class="point-vente-item">
                    <div class="pv-name">${pv.point_vente}</div>
                    <div class="pv-stats">
                      <span class="pv-count">${pv.count} commande${pv.count > 1 ? 's' : ''}</span>
                      ${pv.average_rating ? `<span class="pv-rating">⭐ ${pv.average_rating}/10</span>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
            ` : ''}

            <!-- Par source de connaissance -->
            ${by_source_connaissance && by_source_connaissance.length > 0 ? `
            <div class="sentiment-section">
              <h3>🎯 Canaux d'Acquisition des Clients (Comment nous ont-ils connus ?)</h3>
              <div class="source-list">
                ${by_source_connaissance.map(src => `
                  <div class="source-item">
                    <div class="source-name">${src.source}</div>
                    <div class="source-count">${src.count} client${src.count > 1 ? 's' : ''}</div>
                    <div class="source-percentage">${((src.count / statistics.total_orders) * 100).toFixed(1)}%</div>
                  </div>
                `).join('')}
              </div>
            </div>
            ` : ''}

          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Debug : Vérifier que le modal a été inséré
    const insertedModal = document.getElementById('sentiment-modal-overlay');
    console.log('✅ Modal résultats inséré dans le DOM:', insertedModal ? 'OUI' : 'NON');
    
    // Vérifier combien de modals existent
    const allModals = document.querySelectorAll('#sentiment-modal-overlay, .sentiment-modal-overlay');
    console.log('🔍 Nombre de modals dans le DOM:', allModals.length);
    
    if (insertedModal) {
      const computedStyle = window.getComputedStyle(insertedModal);
      console.log('✅ Modal style display:', computedStyle.display);
      console.log('✅ Modal z-index:', computedStyle.zIndex);
      console.log('✅ Modal position:', computedStyle.position);
      console.log('✅ Modal className:', insertedModal.className);
      
      // FORCER les styles inline pour garantir la visibilité de l'overlay
      insertedModal.style.position = 'fixed';
      insertedModal.style.top = '0';
      insertedModal.style.left = '0';
      insertedModal.style.right = '0';
      insertedModal.style.bottom = '0';
      insertedModal.style.zIndex = '10000';
      insertedModal.style.display = 'flex';
      insertedModal.style.justifyContent = 'center';
      insertedModal.style.alignItems = 'center';
      insertedModal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      console.log('✅ Styles inline forcés sur l\'overlay');
      
      // FORCER les styles sur le contenu du modal (.sentiment-modal)
      const modalContent = insertedModal.querySelector('.sentiment-modal');
      if (modalContent) {
        modalContent.style.backgroundColor = '#ffffff';
        modalContent.style.borderRadius = '12px';
        modalContent.style.maxWidth = '95vw';
        modalContent.style.maxHeight = '90vh';
        modalContent.style.width = '1400px';
        modalContent.style.display = 'flex';
        modalContent.style.flexDirection = 'column';
        modalContent.style.boxShadow = '0 20px 60px rgba(0,0,0,0.3)';
        modalContent.style.overflow = 'hidden';
        console.log('✅ Styles inline forcés sur le contenu du modal');
      } else {
        console.error('❌ Element .sentiment-modal introuvable !');
      }
    }
    
    // Attacher les event listeners après l'insertion
    if (insertedModal) {
      const closeBtn = insertedModal.querySelector('#close-sentiment-modal');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.closeSentimentModal());
        console.log('✅ Bouton de fermeture attaché');
      }
      
      // Fermer si clic sur l'overlay
      insertedModal.addEventListener('click', (e) => {
        if (e.target.id === 'sentiment-modal-overlay') {
          this.closeSentimentModal();
        }
      });
    }
  }

  // Afficher modal sans données
  static showNoDataModal(month) {
    const [year, monthNum] = month.split('-');
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const monthName = monthNames[parseInt(monthNum) - 1];
    
    const modalHTML = `
      <div id="sentiment-modal-overlay" class="sentiment-modal-overlay">
        <div class="sentiment-modal">
          <div class="sentiment-modal-header">
            <h2>🔍 Analyse de Satisfaction Client - ${monthName} ${year}</h2>
            <button id="close-sentiment-modal" class="btn-close-modal">✕</button>
          </div>
          
          <div class="sentiment-modal-body">
            <div class="sentiment-section" style="text-align: center; padding: 3rem;">
              <div style="font-size: 4rem; margin-bottom: 1rem;">📭</div>
              <h3 style="color: #6b7280; margin-bottom: 1rem;">Aucune Donnée Disponible</h3>
              <p style="color: #9ca3af; line-height: 1.6;">
                Aucune commande MATA n'a été trouvée pour <strong>${monthName} ${year}</strong>.
              </p>
              <p style="color: #9ca3af; margin-top: 1rem;">
                Sélectionnez un autre mois pour voir l'analyse de satisfaction client.
              </p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Attacher l'event listener pour le bouton de fermeture
    const insertedModal = document.getElementById('sentiment-modal-overlay');
    if (insertedModal) {
      const closeBtn = insertedModal.querySelector('#close-sentiment-modal');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.closeSentimentModal());
      }
      insertedModal.addEventListener('click', (e) => {
        if (e.target.id === 'sentiment-modal-overlay') {
          this.closeSentimentModal();
        }
      });
    }
  }

  // Fermer le modal
  static closeSentimentModal() {
    console.log('❌ Fermeture du modal sentiment');
    const modal = document.getElementById('sentiment-modal-overlay');
    if (modal) {
      modal.remove();
      console.log('✅ Modal fermé et supprimé du DOM');
    } else {
      console.log('⚠️ Aucun modal à fermer');
    }
  }

  // Exporter l'analyse de sentiment en texte
  static exportSentimentAsText() {
    if (!this.currentAnalysisData) {
      console.error('❌ Aucune donnée d\'analyse disponible pour l\'export');
      return;
    }

    const data = this.currentAnalysisData;
    const { month, statistics, average_ratings, ai_analysis, by_point_vente, by_source_connaissance } = data;
    
    // Formater le mois
    const [year, monthNum] = month.split('-');
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const monthName = monthNames[parseInt(monthNum) - 1];

    // Générer le contenu texte
    let textContent = `═══════════════════════════════════════════════════════════════════════
ANALYSE DE SATISFACTION CLIENT AVEC INTELLIGENCE ARTIFICIELLE
Service de Livraison MATA - ${monthName} ${year}
═══════════════════════════════════════════════════════════════════════

📊 STATISTIQUES GLOBALES
──────────────────────────────────────────────────────────────────────
• Commandes totales : ${statistics.total_orders}
• Avec commentaires : ${statistics.orders_with_comments} (${statistics.comment_percentage}%)
• Avec notes : ${statistics.orders_with_ratings} (${statistics.rating_percentage}%)

📈 NOTES MOYENNES
──────────────────────────────────────────────────────────────────────
`;

    if (average_ratings.service_rating) {
      textContent += `• Service de livraison : ${average_ratings.service_rating}/10\n`;
    }
    if (average_ratings.quality_rating) {
      textContent += `• Qualité des produits : ${average_ratings.quality_rating}/10\n`;
    }
    if (average_ratings.price_rating) {
      textContent += `• Niveau de prix : ${average_ratings.price_rating}/10\n`;
    }
    if (average_ratings.commercial_service_rating) {
      textContent += `• Service commercial : ${average_ratings.commercial_service_rating}/10\n`;
    }
    if (average_ratings.global_average) {
      textContent += `• Moyenne globale : ${average_ratings.global_average}/10\n`;
    }

    textContent += `\n🤖 ANALYSE PAR INTELLIGENCE ARTIFICIELLE
──────────────────────────────────────────────────────────────────────
Sentiment global : ${ai_analysis.sentiment_global}
Score de satisfaction : ${ai_analysis.sentiment_score}%

${ai_analysis.sentiment_description}

💪 POINTS FORTS
`;

    if (ai_analysis.points_forts && ai_analysis.points_forts.length > 0) {
      ai_analysis.points_forts.forEach((point, index) => {
        textContent += `${index + 1}. ${point}\n`;
      });
    } else {
      textContent += `Aucun point fort identifié.\n`;
    }

    textContent += `\n🔧 POINTS D'AMÉLIORATION
`;

    if (ai_analysis.points_amelioration && ai_analysis.points_amelioration.length > 0) {
      ai_analysis.points_amelioration.forEach((point, index) => {
        textContent += `${index + 1}. ${point}\n`;
      });
    } else {
      textContent += `Aucun point d'amélioration identifié.\n`;
    }

    textContent += `\n💡 RECOMMANDATIONS
`;

    if (ai_analysis.recommandations && ai_analysis.recommandations.length > 0) {
      ai_analysis.recommandations.forEach((point, index) => {
        textContent += `${index + 1}. ${point}\n`;
      });
    } else {
      textContent += `Aucune recommandation disponible.\n`;
    }

    // Satisfaction par point de vente
    if (by_point_vente && by_point_vente.length > 0) {
      textContent += `\n📍 SATISFACTION CLIENT PAR POINT DE VENTE
──────────────────────────────────────────────────────────────────────
`;
      by_point_vente.forEach(pv => {
        textContent += `• ${pv.point_vente} : ${pv.count} commande${pv.count > 1 ? 's' : ''}`;
        if (pv.average_rating) {
          textContent += ` - Note moyenne : ${pv.average_rating}/10`;
        }
        textContent += `\n`;
      });
    }

    // Canaux d'acquisition
    if (by_source_connaissance && by_source_connaissance.length > 0) {
      textContent += `\n🎯 CANAUX D'ACQUISITION DES CLIENTS
──────────────────────────────────────────────────────────────────────
`;
      by_source_connaissance.forEach(src => {
        const percentage = ((src.count / statistics.total_orders) * 100).toFixed(1);
        textContent += `• ${src.source} : ${src.count} client${src.count > 1 ? 's' : ''} (${percentage}%)\n`;
      });
    }

    textContent += `\n═══════════════════════════════════════════════════════════════════════
Rapport généré le ${new Date().toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}
Service de Livraison MATA - Analyse par Intelligence Artificielle
═══════════════════════════════════════════════════════════════════════
`;

    // Télécharger le fichier
    this.downloadTextFile(textContent, `Analyse_Satisfaction_MATA_${monthName}_${year}.txt`);
  }

  // Télécharger un fichier texte
  static downloadTextFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    
    console.log(`✅ Fichier exporté : ${filename}`);
    
    if (typeof ToastManager !== 'undefined') {
      ToastManager.success('Analyse exportée avec succès');
    }
  }
}

// Initialiser au chargement de la page
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => MataSentimentManager.init());
} else {
  MataSentimentManager.init();
}

