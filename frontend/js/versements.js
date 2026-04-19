// ===== MODULE VERSEMENTS LIVREURS =====

const VersementsModule = (() => {

  let paymentModes = [];
  let livreurs = [];

  // ── Initialisation ──────────────────────────────────────────────────────────

  async function init() {
    await Promise.all([loadVersementModes(), loadLivreurs()]);
    bindFormEvents();
    bindFilterEvents();
    attachRoleFilterListeners();
    setDefaultDates();
    loadVersements();
  }

  async function loadVersementModes() {
    try {
      const data = await ApiClient.request('/config/versement-modes');
      paymentModes = data.modes || [];
    } catch {
      paymentModes = [
        { label: 'Wave',         value: 'WAVE',         hasComment: false },
        { label: 'Orange Money', value: 'ORANGE_MONEY', hasComment: false },
        { label: 'Cash',         value: 'CASH',         hasComment: false },
        { label: 'Autre',        value: 'AUTRE',        hasComment: true  }
      ];
    }
    renderModeRadios();
  }

  async function loadLivreurs() {
    try {
      // Charger TOUS les utilisateurs actifs (livreurs, managers, admins) pour permettre
      // d'assigner un versement a n'importe quel utilisateur
      const data = await ApiClient.request('/users/active');
      // Mapper au format attendu (id, username)
      livreurs = (data.users || []).map(u => ({ id: u.id, username: u.username, role: u.role }));
    } catch {
      livreurs = [];
    }
    renderLivreurSelects();
  }

  // ── Rendu des modes de versement (radios) ────────────────────────────────────

  function renderModeRadios() {
    const container = document.getElementById('versement-mode-radios');
    if (!container) return;

    container.innerHTML = paymentModes.map((mode, i) => `
      <label class="versement-mode-radio">
        <input type="radio" name="versement-mode" value="${mode.value}"
               data-has-comment="${mode.hasComment}"
               ${i === 0 ? 'checked' : ''}>
        <span class="versement-mode-label">${mode.label}</span>
      </label>
    `).join('');

    container.querySelectorAll('input[name="versement-mode"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const commentGroup = document.getElementById('versement-commentaire-group');
        const hasComment = radio.dataset.hasComment === 'true';
        if (commentGroup) commentGroup.style.display = hasComment ? 'block' : 'none';
        const input = document.getElementById('versement-commentaire');
        if (input && !hasComment) input.value = '';
      });
    });

    const first = container.querySelector('input[name="versement-mode"]');
    if (first) first.dispatchEvent(new Event('change'));
  }

  function getActiveRoleFilters() {
    const boxes = document.querySelectorAll('.versement-role-filter:checked');
    if (boxes.length === 0) return null; // Aucun filtre = tous
    return Array.from(boxes).map(b => b.value);
  }

  function renderLivreurSelects() {
    const activeFilters = getActiveRoleFilters();

    [
      document.getElementById('versement-livreur-select'),
      document.getElementById('versement-filter-livreur')
    ].forEach(select => {
      if (!select) return;
      const savedValue = select.value;
      const isFilter = select.id === 'versement-filter-livreur';

      // Le select du formulaire utilise les filtres de role, le filtre historique liste tout
      const filtered = (!isFilter && activeFilters)
        ? livreurs.filter(l => activeFilters.includes(l.role || 'LIVREUR'))
        : livreurs;

      select.innerHTML = isFilter
        ? '<option value="">-- Tous --</option>'
        : '<option value="">-- Sélectionner un utilisateur --</option>';
      filtered.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.id;
        opt.textContent = l.role && l.role !== 'LIVREUR' ? `${l.username} (${l.role})` : l.username;
        select.appendChild(opt);
      });
      if (savedValue) select.value = savedValue;
    });
  }

  // Ecouter les changements de checkboxes de role
  function attachRoleFilterListeners() {
    document.querySelectorAll('.versement-role-filter').forEach(cb => {
      cb.addEventListener('change', renderLivreurSelects);
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

    const dateInput = document.getElementById('versement-date');
    if (dateInput && !dateInput.value) dateInput.value = todayStr;

    const startInput = document.getElementById('versement-filter-start');
    if (startInput && !startInput.value) startInput.value = firstOfMonth;

    const endInput = document.getElementById('versement-filter-end');
    if (endInput && !endInput.value) endInput.value = todayStr;
  }

  // ── Formulaire d'enregistrement ──────────────────────────────────────────────

  function bindFormEvents() {
    const form = document.getElementById('versement-form');
    if (!form) return;
    if (form.dataset.bound === '1') return;
    form.dataset.bound = '1';
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await submitVersement();
    });
  }

  async function submitVersement() {
    const date        = document.getElementById('versement-date')?.value;
    const livreurId   = document.getElementById('versement-livreur-select')?.value;
    const modeEl      = document.querySelector('input[name="versement-mode"]:checked');
    const mode        = modeEl?.value;
    const commentaire = document.getElementById('versement-commentaire')?.value?.trim();
    const notes       = document.getElementById('versement-notes')?.value?.trim();
    const montant     = document.getElementById('versement-montant')?.value;

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

    const btn = document.getElementById('versement-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement...'; }

    try {
      await ApiClient.request('/versements', {
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
      document.getElementById('versement-form')?.reset();
      renderModeRadios();
      setDefaultDates();
      ApiClient.requestCache?.clear();
      loadVersements();
    } catch (err) {
      console.error(err);
      ToastManager.error(err.message || 'Erreur lors de l\'enregistrement');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Enregistrer'; }
    }
  }

  // ── Tableau de consultation ───────────────────────────────────────────────────

  function bindFilterEvents() {
    const filterBtn = document.getElementById('versement-filter-btn');
    const exportBtn = document.getElementById('versement-export-btn');
    if (filterBtn && !filterBtn.dataset.bound) {
      filterBtn.dataset.bound = '1';
      filterBtn.addEventListener('click', loadVersements);
    }
    if (exportBtn && !exportBtn.dataset.bound) {
      exportBtn.dataset.bound = '1';
      exportBtn.addEventListener('click', exportVersements);
    }
  }

  async function loadVersements() {
    const startDate = document.getElementById('versement-filter-start')?.value;
    const endDate   = document.getElementById('versement-filter-end')?.value;
    const livreurId = document.getElementById('versement-filter-livreur')?.value;

    if (!startDate || !endDate) {
      ToastManager.error('Veuillez sélectionner une plage de dates');
      return;
    }

    const tableBody = document.getElementById('versements-table-body');
    const totalEl   = document.getElementById('versements-total');
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Chargement...</td></tr>';

    try {
      let endpoint = `/versements?startDate=${startDate}&endDate=${endDate}`;
      if (livreurId) endpoint += `&livreur_id=${livreurId}`;

      const data = await ApiClient.request(endpoint);
      renderVersementsTable(data.payments || []);

      const total = data.total || 0;
      if (totalEl) totalEl.textContent = formatAmount(total) + ' FCFA';
    } catch (err) {
      console.error('Erreur chargement versements:', err);
      if (tableBody) tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-error">Erreur de chargement</td></tr>';
    }
  }

  function renderVersementsTable(payments) {
    const tbody = document.getElementById('versements-table-body');
    if (!tbody) return;

    if (payments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Aucun versement trouvé</td></tr>';
      return;
    }

    const modeLabels = { WAVE: 'Wave', ORANGE_MONEY: 'Orange Money', CASH: 'Espèces', AUTRE: 'Autre' };
    const modeBadges = { WAVE: 'badge-wave', ORANGE_MONEY: 'badge-om', CASH: 'badge-cash', AUTRE: 'badge-autre' };
    const role = window.AppState?.user?.role;
    const isAdmin   = role === 'ADMIN';
    const isManager = role === 'MANAGER';

    tbody.innerHTML = payments.map(p => {
      const datePart = p.payment_date ? String(p.payment_date).substring(0, 10) : null;
      const date = datePart
        ? new Date(datePart + 'T00:00:00').toLocaleDateString('fr-FR')
        : '—';
      const modeLabel = modeLabels[p.mode] || escHtml(p.mode);
      const modeBadgeClass = modeBadges[p.mode] || 'badge-autre';

      const diffHours = p.created_at
        ? (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60)
        : 0;
      const within48h = diffHours <= 48;

      let actionCell = '—';
      if (isAdmin) {
        actionCell = `<button class="btn-delete-versement" data-id="${p.id}" title="Supprimer">✕</button>`;
      } else if (isManager && within48h) {
        actionCell = `<button class="btn-delete-versement" data-id="${p.id}" title="Supprimer">✕</button>`;
      } else if (isManager && !within48h) {
        actionCell = `<button class="btn-delete-versement btn-delete-disabled" disabled title="Délai de 48h dépassé">✕</button>`;
      }

      return `<tr>
        <td data-label="Date">${date}</td>
        <td data-label="Livreur"><strong>${escHtml(p.livreur_username || '—')}</strong></td>
        <td data-label="Mode"><span class="versement-badge ${modeBadgeClass}">${modeLabel}</span></td>
        <td data-label="Commentaire" class="text-muted">${escHtml(p.commentaire || '—')}</td>
        <td data-label="Notes">${escHtml(p.notes || '—')}</td>
        <td data-label="Montant" class="text-right font-bold">${formatAmount(p.montant)} FCFA</td>
        <td data-label="Actions" class="text-center">${actionCell}</td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('.btn-delete-versement').forEach(btn => {
      btn.addEventListener('click', () => deleteVersement(btn.dataset.id));
    });
  }

  async function deleteVersement(id) {
    if (!confirm('Confirmer la suppression de ce versement ?')) return;
    try {
      await ApiClient.request(`/versements/${id}`, { method: 'DELETE' });
      ToastManager.success('Versement supprimé');
      ApiClient.requestCache?.clear();
      loadVersements();
    } catch (err) {
      ToastManager.error(err.message || 'Erreur lors de la suppression');
    }
  }

  // ── Export Excel ─────────────────────────────────────────────────────────────

  async function exportVersements() {
    const startDate = document.getElementById('versement-filter-start')?.value;
    const endDate   = document.getElementById('versement-filter-end')?.value;
    const livreurId = document.getElementById('versement-filter-livreur')?.value;

    if (!startDate || !endDate) {
      ToastManager.error('Veuillez sélectionner une plage de dates');
      return;
    }

    try {
      let url = `${window.API_BASE_URL}/versements/export?startDate=${startDate}&endDate=${endDate}`;
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

window.VersementsModule = VersementsModule;
