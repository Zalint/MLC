// ===== MODULE PAIEMENTS LIVREURS =====

const PaymentsModule = (() => {

  let paymentModes = [];
  let livreurs = [];

  // ── Initialisation ──────────────────────────────────────────────────────────

  async function init() {
    await Promise.all([loadPaymentModes(), loadLivreurs()]);
    bindFormEvents();
    bindFilterEvents();
    setDefaultDates();
    loadPayments();
  }

  async function loadPaymentModes() {
    try {
      const data = await ApiClient.request('/config/payment-modes');
      paymentModes = data.modes || [];
    } catch {
      paymentModes = [
        { label: 'Wave',         value: 'WAVE',         hasComment: false },
        { label: 'Orange Money', value: 'ORANGE_MONEY', hasComment: false },
        { label: 'Autre',        value: 'AUTRE',        hasComment: true  }
      ];
    }
    renderModeRadios();
  }

  async function loadLivreurs() {
    try {
      const data = await ApiClient.request('/users/livreurs/active');
      livreurs = data.livreurs || [];
    } catch {
      livreurs = [];
    }
    renderLivreurSelects();
  }

  // ── Rendu des modes de paiement (radios) ────────────────────────────────────

  function renderModeRadios() {
    const container = document.getElementById('payment-mode-radios');
    if (!container) return;

    container.innerHTML = paymentModes.map((mode, i) => `
      <label class="payment-mode-radio">
        <input type="radio" name="payment-mode" value="${mode.value}"
               data-has-comment="${mode.hasComment}"
               ${i === 0 ? 'checked' : ''}>
        <span class="payment-mode-label">${mode.label}</span>
      </label>
    `).join('');

    container.querySelectorAll('input[name="payment-mode"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const hasComment = radio.dataset.hasComment === 'true';
        const commentGroup = document.getElementById('payment-commentaire-group');
        if (commentGroup) {
          commentGroup.style.display = hasComment ? 'block' : 'none';
          const input = document.getElementById('payment-commentaire');
          if (input) input.required = hasComment;
        }
      });
    });

    // Déclencher pour l'état initial
    const first = container.querySelector('input[name="payment-mode"]');
    if (first) first.dispatchEvent(new Event('change'));
  }

  // ── Rendu des listes déroulantes livreurs ────────────────────────────────────

  function renderLivreurSelects() {
    const selects = [
      document.getElementById('payment-livreur-select'),
      document.getElementById('payment-filter-livreur')
    ];

    selects.forEach(sel => {
      if (!sel) return;
      const isFilter = sel.id === 'payment-filter-livreur';
      const placeholder = isFilter ? '-- Tous les livreurs --' : '-- Sélectionner un livreur --';
      sel.innerHTML = `<option value="">${placeholder}</option>` +
        livreurs.map(l => `<option value="${l.id}">${l.username}</option>`).join('');
    });
  }

  // ── Dates par défaut (1er du mois → aujourd'hui) ────────────────────────────

  function setDefaultDates() {
    const today = new Date();
    const yyyy  = today.getFullYear();
    const mm    = String(today.getMonth() + 1).padStart(2, '0');
    const dd    = String(today.getDate()).padStart(2, '0');
    const todayStr      = `${yyyy}-${mm}-${dd}`;
    const firstOfMonth  = `${yyyy}-${mm}-01`;

    const dateInput = document.getElementById('payment-date');
    if (dateInput && !dateInput.value) dateInput.value = todayStr;

    const startInput = document.getElementById('payment-filter-start');
    if (startInput && !startInput.value) startInput.value = firstOfMonth;

    const endInput = document.getElementById('payment-filter-end');
    if (endInput && !endInput.value) endInput.value = todayStr;
  }

  // ── Formulaire d'enregistrement ──────────────────────────────────────────────

  function bindFormEvents() {
    const form = document.getElementById('payment-form');
    if (!form) return;
    // Éviter de rebinder si déjà fait
    if (form.dataset.bound === '1') return;
    form.dataset.bound = '1';
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await submitPayment();
    });
  }

  async function submitPayment() {
    const date        = document.getElementById('payment-date')?.value;
    const livreurId   = document.getElementById('payment-livreur-select')?.value;
    const modeEl      = document.querySelector('input[name="payment-mode"]:checked');
    const mode        = modeEl?.value;
    const commentaire = document.getElementById('payment-commentaire')?.value?.trim();
    const notes       = document.getElementById('payment-notes')?.value?.trim();
    const montant     = document.getElementById('payment-montant')?.value;

    if (!date || !livreurId || !mode || !montant) {
      ToastManager.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    if (parseFloat(montant) <= 0) {
      ToastManager.error('Le montant doit être supérieur à 0');
      return;
    }
    const hasComment = modeEl?.dataset.hasComment === 'true';
    if (hasComment && !commentaire) {
      ToastManager.error('Le commentaire est requis pour ce mode de versement');
      return;
    }

    const btn = document.getElementById('payment-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement...'; }

    try {
      await ApiClient.request('/payments', {
        method: 'POST',
        body: JSON.stringify({
          payment_date: date,
          livreur_id:   livreurId,
          mode,
          commentaire:  commentaire || null,
          notes:        notes || null,
          montant:      parseFloat(montant)
        })
      });

      ToastManager.success('Versement enregistré avec succès');
      document.getElementById('payment-form')?.reset();
      renderModeRadios();
      setDefaultDates();
      // Invalider le cache pour forcer le rechargement du tableau
      ApiClient.requestCache?.clear();
      loadPayments();
    } catch (err) {
      console.error(err);
      ToastManager.error(err.message || 'Erreur lors de l\'enregistrement');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Enregistrer'; }
    }
  }

  // ── Tableau de consultation ───────────────────────────────────────────────────

  function bindFilterEvents() {
    const filterBtn = document.getElementById('payment-filter-btn');
    const exportBtn = document.getElementById('payment-export-btn');
    if (filterBtn && !filterBtn.dataset.bound) {
      filterBtn.dataset.bound = '1';
      filterBtn.addEventListener('click', loadPayments);
    }
    if (exportBtn && !exportBtn.dataset.bound) {
      exportBtn.dataset.bound = '1';
      exportBtn.addEventListener('click', exportPayments);
    }
  }

  async function loadPayments() {
    const startDate = document.getElementById('payment-filter-start')?.value;
    const endDate   = document.getElementById('payment-filter-end')?.value;
    const livreurId = document.getElementById('payment-filter-livreur')?.value;

    if (!startDate || !endDate) {
      ToastManager.error('Veuillez sélectionner une plage de dates');
      return;
    }

    const tableBody = document.getElementById('payments-table-body');
    const totalEl   = document.getElementById('payments-total');
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Chargement...</td></tr>';

    try {
      let endpoint = `/payments?startDate=${startDate}&endDate=${endDate}`;
      if (livreurId) endpoint += `&livreur_id=${livreurId}`;

      const data = await ApiClient.request(endpoint);
      renderPaymentsTable(data.payments || []);

      const total = data.total || 0;
      if (totalEl) totalEl.textContent = formatAmount(total) + ' FCFA';
    } catch (err) {
      console.error('Erreur chargement paiements:', err);
      if (tableBody) tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-error">Erreur de chargement</td></tr>';
    }
  }

  function renderPaymentsTable(payments) {
    const tbody = document.getElementById('payments-table-body');
    if (!tbody) return;

    if (payments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Aucun versement trouvé</td></tr>';
      return;
    }

    const modeLabels = { WAVE: 'Wave', ORANGE_MONEY: 'Orange Money', CASH: 'Cash', AUTRE: 'Autre' };
    const modeBadges = { WAVE: 'badge-wave', ORANGE_MONEY: 'badge-om', CASH: 'badge-cash', AUTRE: 'badge-autre' };
    const role = window.AppState?.user?.role;
    const isAdmin   = role === 'ADMIN';
    const isManager = role === 'MANAGER';

    tbody.innerHTML = payments.map(p => {
      const datePart = p.payment_date ? String(p.payment_date).substring(0, 10) : null;
      const date = datePart
        ? new Date(datePart + 'T00:00:00').toLocaleDateString('fr-FR')
        : '—';
      const modeLabel = modeLabels[p.mode] || p.mode;
      const modeBadgeClass = modeBadges[p.mode] || 'badge-autre';

      // Calcul du délai depuis la création (en heures)
      const diffHours = p.created_at
        ? (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60)
        : 0;
      const within48h = diffHours <= 48;

      let actionCell = '—';
      if (isAdmin) {
        // Admin : toujours le bouton de suppression
        actionCell = `<button class="btn-delete-payment" data-id="${p.id}" title="Supprimer">✕</button>`;
      } else if (isManager && within48h) {
        // Manager : bouton actif uniquement dans les 48h
        actionCell = `<button class="btn-delete-payment" data-id="${p.id}" title="Supprimer">✕</button>`;
      } else if (isManager && !within48h) {
        // Manager : délai dépassé — bouton grisé avec tooltip
        actionCell = `<button class="btn-delete-payment btn-delete-disabled" disabled title="Délai de 48h dépassé">✕</button>`;
      }

      return `<tr>
        <td>${date}</td>
        <td><strong>${escHtml(p.livreur_username || '—')}</strong></td>
        <td><span class="payment-badge ${modeBadgeClass}">${modeLabel}</span></td>
        <td class="text-muted">${escHtml(p.commentaire || '—')}</td>
        <td>${escHtml(p.notes || '—')}</td>
        <td class="text-right font-bold">${formatAmount(p.montant)} FCFA</td>
        <td class="text-center">${actionCell}</td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('.btn-delete-payment').forEach(btn => {
      btn.addEventListener('click', () => deletePayment(btn.dataset.id));
    });
  }

  async function deletePayment(id) {
    if (!confirm('Confirmer la suppression de ce versement ?')) return;
    try {
      await ApiClient.request(`/payments/${id}`, { method: 'DELETE' });
      ToastManager.success('Versement supprimé');
      ApiClient.requestCache?.clear();
      loadPayments();
    } catch (err) {
      ToastManager.error(err.message || 'Erreur lors de la suppression');
    }
  }

  // ── Export Excel ─────────────────────────────────────────────────────────────

  async function exportPayments() {
    const startDate = document.getElementById('payment-filter-start')?.value;
    const endDate   = document.getElementById('payment-filter-end')?.value;
    const livreurId = document.getElementById('payment-filter-livreur')?.value;

    if (!startDate || !endDate) {
      ToastManager.error('Veuillez sélectionner une plage de dates');
      return;
    }

    try {
      let url = `${window.API_BASE_URL}/payments/export?startDate=${startDate}&endDate=${endDate}`;
      if (livreurId) url += `&livreur_id=${livreurId}`;

      const token = ApiClient.getStoredToken ? ApiClient.getStoredToken() : null;
      const res = await fetch(url, {
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (!res.ok) throw new Error('Erreur export');

      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = `versements_${startDate}_${endDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(a.href);
      document.body.removeChild(a);
      ToastManager.success('Export Excel téléchargé');
    } catch (err) {
      console.error(err);
      ToastManager.error('Erreur lors de l\'export Excel');
    }
  }

  // ── Utilitaires ───────────────────────────────────────────────────────────────

  function formatAmount(amount) {
    if (!amount) return '0';
    return new Intl.NumberFormat('fr-FR').format(parseFloat(amount));
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { init };
})();

window.PaymentsModule = PaymentsModule;
