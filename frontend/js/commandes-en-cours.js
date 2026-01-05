/**
 * Gestion des commandes en cours
 * Affiche les commandes reçues via l'API externe
 */

// Variables globales
let commandesEnCoursData = [];
let currentFilters = {
  statut: 'en_livraison', // Par défaut, afficher uniquement les commandes en livraison
  livreur_id: '',
  point_vente: ''
};

/**
 * Récupérer le rôle de l'utilisateur courant
 */
function getUserRole() {
  const roleElement = document.getElementById('user-role');
  return roleElement ? roleElement.textContent.trim() : null;
}

/**
 * Initialiser la page des commandes en cours
 */
function initCommandesEnCours() {
  console.log('📦 Initialisation de la page Commandes En Cours');
  
  // Charger les données initiales
  loadCommandesEnCours();
  
  // Event listeners pour les filtres
  document.getElementById('apply-commandes-filters')?.addEventListener('click', applyFilters);
  document.getElementById('clear-commandes-filters')?.addEventListener('click', clearFilters);
  document.getElementById('refresh-commandes-en-cours')?.addEventListener('click', loadCommandesEnCours);
  
  // Auto-refresh toutes les 30 secondes
  setInterval(() => {
    if (document.getElementById('commandes-en-cours-page')?.classList.contains('active')) {
      loadCommandesEnCours(false); // false = pas de message de toast
    }
  }, 30000);
}

/**
 * Charger les commandes en cours depuis l'API
 */
async function loadCommandesEnCours(showToast = true) {
  try {
    const container = document.getElementById('commandes-en-cours-container');
    if (!container) return;
    
    // Afficher le loader
    container.innerHTML = '<div class="loading-message"><p>🔄 Chargement des commandes en cours...</p></div>';
    
    // Construire l'URL avec les filtres
    const params = new URLSearchParams();
    if (currentFilters.statut) params.append('statut', currentFilters.statut);
    if (currentFilters.livreur_id) params.append('livreur_id', currentFilters.livreur_id);
    if (currentFilters.point_vente) params.append('point_vente', currentFilters.point_vente);
    
    // Utiliser ApiClient.request pour inclure automatiquement le token JWT
    const result = await ApiClient.request(`/commandes-en-cours?${params.toString()}`);
    commandesEnCoursData = result.data || [];
    
    // Mettre à jour les statistiques
    updateStatistics();
    
    // Afficher les commandes
    displayCommandesEnCours();
    
    if (showToast && window.ToastManager) {
      ToastManager.success(`✅ ${commandesEnCoursData.length} commande(s) chargée(s)`);
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du chargement des commandes:', error);
    document.getElementById('commandes-en-cours-container').innerHTML = `
      <div class="alert alert-danger">
        <p>❌ Erreur lors du chargement des commandes en cours</p>
        <p>${error.message}</p>
      </div>
    `;
  }
}

/**
 * Afficher les commandes en cours
 */
function displayCommandesEnCours() {
  const container = document.getElementById('commandes-en-cours-container');
  if (!container) return;
  
  if (commandesEnCoursData.length === 0) {
    container.innerHTML = `
      <div class="alert alert-info">
        <p>📦 Aucune commande en cours pour le moment</p>
      </div>
    `;
    return;
  }
  
  // Grouper les commandes par statut
  const grouped = {
    en_livraison: [],
    livree: [],
    annulee: []
  };
  
  commandesEnCoursData.forEach(commande => {
    if (grouped[commande.statut]) {
      grouped[commande.statut].push(commande);
    }
  });
  
  let html = '';
  
  // Afficher les commandes en livraison
  if (grouped.en_livraison.length > 0) {
    html += `
      <div class="commandes-section">
        <h3 style="color: #2563eb; margin-bottom: 1rem;">🚚 En Livraison (${grouped.en_livraison.length})</h3>
        <div class="commandes-grid">
          ${grouped.en_livraison.map(cmd => renderCommandeCard(cmd)).join('')}
        </div>
      </div>
    `;
  }
  
  // Afficher les commandes livrées
  if (grouped.livree.length > 0) {
    html += `
      <div class="commandes-section" style="margin-top: 2rem;">
        <h3 style="color: #16a34a; margin-bottom: 1rem;">✅ Livrées (${grouped.livree.length})</h3>
        <div class="commandes-grid">
          ${grouped.livree.map(cmd => renderCommandeCard(cmd)).join('')}
        </div>
      </div>
    `;
  }
  
  // Afficher les commandes annulées
  if (grouped.annulee.length > 0) {
    html += `
      <div class="commandes-section" style="margin-top: 2rem;">
        <h3 style="color: #dc2626; margin-bottom: 1rem;">❌ Annulées (${grouped.annulee.length})</h3>
        <div class="commandes-grid">
          ${grouped.annulee.map(cmd => renderCommandeCard(cmd)).join('')}
        </div>
      </div>
    `;
  }
  
  container.innerHTML = html;
  
  // Ajouter les event listeners pour les boutons d'action
  addCommandeActionListeners();
}

/**
 * Rendre une carte de commande
 */
function renderCommandeCard(commande) {
  const statutColors = {
    en_livraison: '#2563eb',
    livree: '#16a34a',
    annulee: '#dc2626'
  };
  
  const statutLabels = {
    en_livraison: '🚚 En Livraison',
    livree: '✅ Livrée',
    annulee: '❌ Annulée'
  };
  
  const dateCommande = new Date(commande.date_commande);
  const dateFormatted = dateCommande.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // Calculer le nombre d'articles
  const articlesCount = commande.articles.reduce((sum, article) => sum + article.quantite, 0);
  
  return `
    <div class="commande-card" data-id="${commande.id}" data-statut="${commande.statut}">
      <div class="commande-header">
        <div class="commande-id">
          <strong>📦 ${commande.commande_id}</strong>
        </div>
        <div class="commande-statut" style="background-color: ${statutColors[commande.statut]}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold;">
          ${statutLabels[commande.statut]}
        </div>
      </div>
      
      <div class="commande-body">
        <div class="info-row">
          <span class="info-label">🚚 Livreur:</span>
          <span class="info-value"><strong>${commande.livreur_nom}</strong> (${commande.livreur_id})</span>
        </div>
        
        <div class="info-row">
          <span class="info-label">👤 Client:</span>
          <span class="info-value">${commande.client_nom}</span>
        </div>
        
        <div class="info-row">
          <span class="info-label">📞 Téléphone:</span>
          <span class="info-value"><a href="tel:${commande.client_telephone}">${commande.client_telephone}</a></span>
        </div>
        
        <div class="info-row">
          <span class="info-label">📍 Adresse:</span>
          <span class="info-value">${commande.client_adresse}</span>
        </div>
        
        <div class="info-row">
          <span class="info-label">🏪 Point de vente:</span>
          <span class="info-value">${commande.point_vente}</span>
        </div>
        
        <div class="info-row">
          <span class="info-label">📅 Date:</span>
          <span class="info-value">${dateFormatted}</span>
        </div>
        
        <div class="articles-section">
          <div class="articles-header">
            <strong>📦 Articles (${articlesCount}):</strong>
          </div>
          <ul class="articles-list">
            ${commande.articles.map(article => `
              <li>
                <span>${article.produit}</span>
                <span>x${article.quantite}</span>
                <span class="article-price">${article.prix.toLocaleString()} FCFA</span>
              </li>
            `).join('')}
          </ul>
        </div>
        
        <div class="commande-total">
          <span class="total-label">Total:</span>
          <span class="total-value">${commande.total.toLocaleString()} FCFA</span>
        </div>
      </div>
      
      <div class="commande-actions">
        ${commande.statut === 'en_livraison' ? `
          ${getUserRole() === 'LIVREUR' ? `
            <button class="btn btn-primary btn-sm prendre-livraison" data-id="${commande.id}">
              <span class="icon">📦</span> Prendre la livraison
            </button>
          ` : `
            <button class="btn btn-warning btn-sm reassign-livreur" data-id="${commande.id}">
              <span class="icon">🔄</span> Réassigner livreur
            </button>
          `}
          <button class="btn btn-danger btn-sm mark-annulee" data-id="${commande.id}">
            <span class="icon">❌</span> Annuler
          </button>
        ` : ''}
        ${getUserRole() === 'MANAGER' || getUserRole() === 'ADMIN' ? `
          <button class="btn btn-secondary btn-sm delete-commande" data-id="${commande.id}">
            <span class="icon">🗑️</span> Supprimer
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Ajouter les event listeners pour les actions
 */
function addCommandeActionListeners() {
  console.log('🔧 addCommandeActionListeners appelé');
  
  // Prendre la livraison (livreur)
  const prendreLivraisonBtns = document.querySelectorAll('.prendre-livraison');
  console.log(`🔧 Boutons "prendre-livraison" trouvés: ${prendreLivraisonBtns.length}`);
  
  prendreLivraisonBtns.forEach(btn => {
    console.log(`🔧 Attachement event listener sur bouton ID: ${btn.dataset.id}`);
    btn.addEventListener('click', async (e) => {
      console.log('🎯 CLICK sur Prendre livraison, ID:', e.currentTarget.dataset.id);
      const id = e.currentTarget.dataset.id;
      await prendreLivraison(id);
    });
  });
  
  // Réassigner livreur (manager/admin)
  document.querySelectorAll('.reassign-livreur').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      await showReassignModal(id);
    });
  });
  
  // Marquer comme annulée
  document.querySelectorAll('.mark-annulee').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      
      // Utiliser le modal moderne au lieu de confirm()
      if (window.ModalManager) {
        window.ModalManager.confirm(
          'Annuler la commande',
          'Êtes-vous sûr de vouloir annuler cette commande ?',
          async () => {
            await updateStatut(id, 'annulee');
          },
          {
            type: 'warning',
            confirmText: 'Oui, annuler',
            cancelText: 'Non, garder'
          }
        );
      } else {
        // Fallback vers confirm natif si ModalManager n'est pas disponible
        if (confirm('Êtes-vous sûr de vouloir annuler cette commande ?')) {
          await updateStatut(id, 'annulee');
        }
      }
    });
  });
  
  // Supprimer
  document.querySelectorAll('.delete-commande').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      
      // Utiliser le modal moderne au lieu de confirm()
      if (window.ModalManager) {
        window.ModalManager.confirm(
          'Supprimer la commande',
          'Êtes-vous sûr de vouloir supprimer définitivement cette commande ?',
          async () => {
            await deleteCommande(id);
          },
          {
            type: 'danger',
            icon: '🗑️',
            confirmText: 'Oui, supprimer',
            cancelText: 'Non, garder'
          }
        );
      } else {
        // Fallback vers confirm natif si ModalManager n'est pas disponible
        if (confirm('Êtes-vous sûr de vouloir supprimer cette commande ?')) {
          await deleteCommande(id);
        }
      }
    });
  });
}

/**
 * Prendre la livraison (livreur) - Ouvre le formulaire de nouvelle commande pré-rempli
 */
async function prendreLivraison(id) {
  console.log('🚀 [prendreLivraison] DÉBUT - ID:', id);
  try {
    console.log('🔍 [prendreLivraison] Recherche de la commande dans commandesEnCoursData');
    console.log('📦 [prendreLivraison] commandesEnCoursData length:', commandesEnCoursData.length);
    console.log('📦 [prendreLivraison] commandesEnCoursData:', commandesEnCoursData);
    
    // Trouver la commande dans les données (conversion en number pour comparaison)
    const commande = commandesEnCoursData.find(c => c.id == id);
    console.log('📦 [prendreLivraison] ID recherché:', id, 'Type:', typeof id);
    console.log('📦 [prendreLivraison] Commande trouvée:', !!commande);
    
    if (!commande) {
      console.error('❌ [prendreLivraison] Commande introuvable');
      if (window.ToastManager) {
        ToastManager.error('Commande non trouvée');
      }
      return;
    }

    console.log('✅ [prendreLivraison] Commande complète:', commande);

    // Nettoyer le numéro de téléphone (enlever espaces, +, tirets)
    let cleanPhone = commande.client_telephone.replace(/[\s\+\-\(\)]/g, '');
    console.log('📞 [prendreLivraison] Téléphone original:', commande.client_telephone);
    console.log('📞 [prendreLivraison] Téléphone nettoyé:', cleanPhone);
    
    // Si le numéro commence par 221 (code Sénégal), on le retire
    if (cleanPhone.startsWith('221')) {
      cleanPhone = cleanPhone.substring(3);
      console.log('📞 [prendreLivraison] Téléphone sans code pays:', cleanPhone);
    }
    // Si le numéro commence par 33 (code France), on le retire
    else if (cleanPhone.startsWith('33')) {
      cleanPhone = cleanPhone.substring(2);
      console.log('📞 [prendreLivraison] Téléphone sans code pays:', cleanPhone);
    }
    // Si le numéro commence par 1 (code USA) et a plus de 10 chiffres, on le retire
    else if (cleanPhone.startsWith('1') && cleanPhone.length > 10) {
      cleanPhone = cleanPhone.substring(1);
      console.log('📞 [prendreLivraison] Téléphone sans code pays:', cleanPhone);
    }

    // Construire la description avec les détails des articles
    const description = `Commande ${commande.commande_id}\n` +
      `Articles:\n${commande.articles.map(a => `- ${a.produit} x${a.quantite} (${a.prix.toLocaleString()} FCFA)`).join('\n')}`;
    
    console.log('📝 [prendreLivraison] Description créée:', description);

    // Pré-remplir le formulaire de nouvelle commande MATA
    const orderData = {
      order_type: 'MATA',
      client_name: commande.client_nom,
      phone_number: cleanPhone, // Utiliser le numéro nettoyé
      source_address: commande.point_vente, // Point de vente = adresse source
      destination_address: commande.client_adresse,
      point_vente: commande.point_vente, // Point de vente pour le dropdown
      course_price: 1500, // Prix standard d'une course MATA
      basket_amount: commande.total, // Montant du panier = total des articles
      comment: description,
      commande_en_cours_id: id // Pour marquer comme livrée après création
    };

    console.log('📋 [prendreLivraison] orderData créé:', JSON.stringify(orderData, null, 2));

    // Sauvegarder les données dans le sessionStorage pour pré-remplir le formulaire
    sessionStorage.setItem('prefilledOrderData', JSON.stringify(orderData));
    console.log('💾 [prendreLivraison] Données sauvegardées dans sessionStorage');
    
    // Vérifier que les données ont bien été sauvegardées
    const saved = sessionStorage.getItem('prefilledOrderData');
    console.log('✅ [prendreLivraison] Vérification sessionStorage:', !!saved);

    // Naviguer vers la page de nouvelle commande
    console.log('🔍 [prendreLivraison] typeof PageManager:', typeof PageManager);
    
    if (typeof PageManager !== 'undefined') {
      console.log('🚀 [prendreLivraison] AVANT PageManager.showPage("new-order")');
      PageManager.showPage('new-order');
      console.log('✅ [prendreLivraison] APRÈS PageManager.showPage("new-order")');
    } else {
      console.error('❌ [prendreLivraison] PageManager NON DÉFINI !');
    }

    if (typeof ToastManager !== 'undefined') {
      console.log('💬 [prendreLivraison] Affichage du toast');
      ToastManager.info('Formulaire pré-rempli. Vérifiez les informations et sauvegardez.');
    } else {
      console.error('❌ [prendreLivraison] ToastManager NON DÉFINI !');
    }
    
    console.log('🎯 [prendreLivraison] FIN COMPLÈTE');

  } catch (error) {
    console.error('❌ [prendreLivraison] ERREUR ATTRAPÉE:', error);
    console.error('❌ [prendreLivraison] Stack:', error.stack);
    if (window.ToastManager) {
      ToastManager.error(`❌ ${error.message}`);
    }
  }
}

/**
 * Afficher modal de réassignation (manager/admin)
 */
async function showReassignModal(id) {
  try {
    // Récupérer la liste des livreurs actifs
    const response = await ApiClient.request('/users?role=LIVREUR&active=true');
    const livreurs = response.data || [];

    if (livreurs.length === 0) {
      if (window.ToastManager) {
        ToastManager.warning('Aucun livreur actif disponible');
      }
      return;
    }

    // Trouver la commande
    const commande = commandesEnCoursData.find(c => c.id === id);

    // Créer le contenu de la modal
    const modalContent = `
      <div class="reassign-modal-content">
        <h3>Réassigner la commande</h3>
        <p><strong>Commande:</strong> ${commande.commande_id}</p>
        <p><strong>Livreur actuel:</strong> ${commande.livreur_nom}</p>
        <div class="form-group">
          <label for="nouveau-livreur">Nouveau livreur:</label>
          <select id="nouveau-livreur" class="form-control">
            <option value="">-- Sélectionnez un livreur --</option>
            ${livreurs.map(l => `
              <option value="${l.id}" ${l.id === commande.livreur_id ? 'selected' : ''}>
                ${l.username}
              </option>
            `).join('')}
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" id="confirm-reassign">Confirmer</button>
          <button class="btn btn-secondary" id="cancel-reassign">Annuler</button>
        </div>
      </div>
    `;

    // Afficher la modal (utiliser le système de modal existant)
    if (window.ModalManager) {
      window.ModalManager.show('Réassigner livreur', modalContent);
      
      // Event listeners pour les boutons
      document.getElementById('confirm-reassign')?.addEventListener('click', async () => {
        const nouveauLivreurId = document.getElementById('nouveau-livreur').value;
        
        if (!nouveauLivreurId) {
          if (window.ToastManager) {
            ToastManager.error('Veuillez sélectionner un livreur');
          }
          return;
        }

        await reassignCommande(id, nouveauLivreurId);
        window.ModalManager.hide();
      });

      document.getElementById('cancel-reassign')?.addEventListener('click', () => {
        window.ModalManager.hide();
      });
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
    if (window.ToastManager) {
      ToastManager.error(`❌ ${error.message}`);
    }
  }
}

/**
 * Réassigner une commande à un autre livreur
 */
async function reassignCommande(id, nouveauLivreurId) {
  try {
    await ApiClient.request(`/commandes-en-cours/${id}/reassign`, {
      method: 'PATCH',
      body: JSON.stringify({ nouveau_livreur_id: nouveauLivreurId })
    });
    
    if (window.ToastManager) {
      ToastManager.success(`✅ Commande réassignée avec succès`);
    }
    await loadCommandesEnCours(false);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    if (window.ToastManager) {
      ToastManager.error(`❌ ${error.message}`);
    }
  }
}

/**
 * Mettre à jour le statut d'une commande
 */
async function updateStatut(id, statut) {
  try {
    // Utiliser ApiClient.request pour inclure automatiquement le token JWT
    await ApiClient.request(`/commandes-en-cours/${id}/statut`, {
      method: 'PATCH',
      body: JSON.stringify({ statut })
    });
    
    if (window.ToastManager) {
      ToastManager.success(`✅ Statut mis à jour avec succès`);
    }
    
    // Recharger les commandes pour mettre à jour l'affichage
    await loadCommandesEnCours(false);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    if (window.ToastManager) {
      ToastManager.error(`❌ ${error.message}`);
    }
    // Toujours recharger même en cas d'erreur pour être sûr
    try {
      await loadCommandesEnCours(false);
    } catch (reloadError) {
      console.error('❌ Erreur lors du rechargement:', reloadError);
    }
  }
}

/**
 * Supprimer une commande
 */
async function deleteCommande(id) {
  try {
    // Utiliser ApiClient.request pour inclure automatiquement le token JWT
    await ApiClient.request(`/commandes-en-cours/${id}`, {
      method: 'DELETE'
    });
    
    if (window.ToastManager) {
      ToastManager.success(`✅ Commande supprimée avec succès`);
    }
    
    // Recharger les commandes pour mettre à jour l'affichage
    await loadCommandesEnCours(false);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    if (window.ToastManager) {
      ToastManager.error(`❌ ${error.message}`);
    }
    // Toujours recharger même en cas d'erreur pour être sûr
    try {
      await loadCommandesEnCours(false);
    } catch (reloadError) {
      console.error('❌ Erreur lors du rechargement:', reloadError);
    }
  }
}

/**
 * Mettre à jour les statistiques
 */
function updateStatistics() {
  const total = commandesEnCoursData.length;
  const enLivraison = commandesEnCoursData.filter(c => c.statut === 'en_livraison').length;
  const livrees = commandesEnCoursData.filter(c => c.statut === 'livree').length;
  const montantTotal = commandesEnCoursData.reduce((sum, c) => sum + parseFloat(c.total), 0);
  
  document.getElementById('total-commandes-en-cours').textContent = total;
  document.getElementById('total-en-livraison').textContent = enLivraison;
  document.getElementById('total-livrees').textContent = livrees;
  document.getElementById('montant-total-en-cours').textContent = `${montantTotal.toLocaleString()} FCFA`;
}

/**
 * Appliquer les filtres
 */
function applyFilters() {
  currentFilters.statut = document.getElementById('filter-statut')?.value || '';
  currentFilters.livreur_id = document.getElementById('filter-livreur')?.value || '';
  currentFilters.point_vente = document.getElementById('filter-point-vente')?.value || '';
  
  loadCommandesEnCours();
}

/**
 * Effacer les filtres
 */
function clearFilters() {
  document.getElementById('filter-statut').value = 'en_livraison';
  document.getElementById('filter-livreur').value = '';
  document.getElementById('filter-point-vente').value = '';
  
  currentFilters = {
    statut: 'en_livraison',
    livreur_id: '',
    point_vente: ''
  };
  
  loadCommandesEnCours();
}

// Initialiser quand la page se charge
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCommandesEnCours);
} else {
  initCommandesEnCours();
}

// Ajouter les styles CSS dynamiquement
const styles = `
<style>
.commandes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1.5rem;
  padding: 1rem 0;
}

.commande-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.commande-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.commande-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f3f4f6;
}

.commande-id {
  font-size: 16px;
  color: #111827;
}

.commande-body {
  margin-bottom: 1rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid #f3f4f6;
}

.info-label {
  font-weight: 600;
  color: #6b7280;
  font-size: 14px;
}

.info-value {
  color: #111827;
  font-size: 14px;
  text-align: right;
  max-width: 60%;
}

.info-value a {
  color: #2563eb;
  text-decoration: none;
}

.info-value a:hover {
  text-decoration: underline;
}

.articles-section {
  margin: 1rem 0;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
}

.articles-header {
  margin-bottom: 0.5rem;
  color: #374151;
}

.articles-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.articles-list li {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  font-size: 14px;
  color: #6b7280;
}

.article-price {
  font-weight: 600;
  color: #2563eb;
}

.commande-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border-radius: 8px;
  margin-top: 1rem;
}

.total-label {
  color: white;
  font-weight: 600;
  font-size: 16px;
}

.total-value {
  color: white;
  font-weight: 700;
  font-size: 20px;
}

.commande-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}

.commande-actions .btn {
  flex: 1;
  min-width: 120px;
}

.commandes-section {
  margin-bottom: 2rem;
}

@media (max-width: 768px) {
  .commandes-grid {
    grid-template-columns: 1fr;
  }
  
  .commande-actions {
    flex-direction: column;
  }
  
  .commande-actions .btn {
    width: 100%;
  }
}
</style>
`;

// Injecter les styles dans le head
if (!document.getElementById('commandes-en-cours-styles')) {
  const styleElement = document.createElement('div');
  styleElement.id = 'commandes-en-cours-styles';
  styleElement.innerHTML = styles;
  document.head.appendChild(styleElement);
}

