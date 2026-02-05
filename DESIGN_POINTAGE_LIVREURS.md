# 🚀 DESIGN CONCEPTUEL - SYSTÈME DE POINTAGE LIVREURS

## 📋 Vue d'ensemble

Système permettant aux livreurs de pointer leur début et fin d'activité quotidienne avec :
- **Début d'activité** : km scooter + photo justificative
- **Fin d'activité** : km scooter + photo justificative  
- **Calcul automatique** : km parcourus dans la journée
- **Date par défaut** : aujourd'hui

---

## 🎨 1. INTERFACE UTILISATEUR

### 1.1 Vue LIVREUR - Widget Personnel

**Emplacement** : Tableau de bord principal (page d'accueil)

```
┌─────────────────────────────────────────────────────────────┐
│  TABLEAU DE BORD                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [05-Feb-2026]  Commandes: 12  Courses: 8  Dépenses: 450€  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  🚴 MON POINTAGE DU JOUR                               │ │
│  │                                                        │ │
│  │  ┌─────────────────────┐  ┌──────────────────────┐   │ │
│  │  │ 🟢 DÉBUT D'ACTIVITÉ │  │ 🔴 FIN D'ACTIVITÉ    │   │ │
│  │  │                     │  │                      │   │ │
│  │  │  [POINTER]          │  │  [POINTER]           │   │ │
│  │  └─────────────────────┘  └──────────────────────┘   │ │
│  │                                                        │ │
│  │  📊 Km parcourus aujourd'hui: -- km                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Vue MANAGER - Gestion des Pointages

**Emplacement** : Tableau de bord manager (Les managers ne pointent PAS)

```
┌─────────────────────────────────────────────────────────────┐
│  TABLEAU DE BORD MANAGER                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [05-Feb-2026]  Commandes: 156  Courses: 89  Bénéfice: 2.3K€│
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  📊 POINTAGES DES LIVREURS                             │ │
│  │                                                        │ │
│  │  ┌───────────────────────────────────────────────┐   │ │
│  │  │  📅 Date: [05/02/2026 ▼]  [Aujourd'hui]       │   │ │
│  │  └───────────────────────────────────────────────┘   │ │
│  │                                                        │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │  [📊 VOIR TOUS LES POINTAGES]                   │ │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  │                                                        │ │
│  │  Résumé: 8 livreurs actifs | 6 pointés | 2 manquants │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Modal Manager - Vue de tous les pointages

**Cliquer sur "📊 VOIR TOUS LES POINTAGES"**

```
┌──────────────────────────────────────────────────────────────────────────┐
│  📊 POINTAGES DES LIVREURS - 05/02/2026                            [X]  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  📅 Filtrer par date: ┌────────────┐  [Aujourd'hui] [Hier] [Cette sem.] │
│                      │ 05/02/2026 │                                     │
│                      └────────────┘                                     │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Livreur          │ Début        │ Fin          │ Km     │ Actions  │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │ 👤 Aliou         │ ✅ 08:30     │ ✅ 17:45     │ 42 km  │ [👁️] [📝] │ │
│  │                  │ 12,345 km    │ 12,387 km    │        │          │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │ 👤 Diaby         │ ✅ 09:00     │ ⏳ En cours  │ -- km  │ [👁️] [📝] │ │
│  │                  │ 8,500 km     │ --           │        │          │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │ 👤 Khalifa       │ ✅ 08:15     │ ✅ 18:30     │ 65 km  │ [👁️] [📝] │ │
│  │                  │ 15,200 km    │ 15,265 km    │        │          │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │ 👤 Ibrahima      │ ❌ Pas pointé│ --           │ -- km  │ [➕]      │ │
│  │                  │              │              │        │          │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │ 👤 Mane          │ ✅ 10:00     │ ❌ Pas pointé│ -- km  │ [👁️] [📝] │ │
│  │                  │ 9,800 km     │ --           │        │          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  📊 Statistiques du jour:                                                │
│  • Total livreurs: 8                                                     │
│  • Pointages complets: 3 (37%)                                           │
│  • En cours: 2 (25%)                                                     │
│  • Non pointés: 3 (38%)                                                  │
│  • Km total parcourus: 107 km                                            │
│                                                                          │
│  [📥 Exporter Excel]  [🔄 Rafraîchir]  [Fermer]                         │
└──────────────────────────────────────────────────────────────────────────┘
```

**Actions disponibles** :
- **👁️** = Voir les photos (début + fin)
- **📝** = Modifier le pointage
- **➕** = Pointer pour ce livreur (si oubli)

### 1.4 Modal Manager - Pointer POUR un livreur

**Cliquer sur [➕] pour "Ibrahima"**

```
┌─────────────────────────────────────────────────────────┐
│  🟢 POINTER LE DÉBUT POUR : Ibrahima               [X]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ⚠️  Vous êtes sur le point de pointer pour un autre   │
│      utilisateur en tant que manager.                   │
│                                                         │
│  👤 Livreur sélectionné: Ibrahima                       │
│                                                         │
│  📅 Date                                                │
│  ┌─────────────────────┐                               │
│  │ 05/02/2026          │ (modifiable)                  │
│  └─────────────────────┘                               │
│                                                         │
│  🛵 Kilométrage du scooter                              │
│  ┌─────────────────────┐                               │
│  │ 7,850 km            │  (ex: 7850)                   │
│  └─────────────────────┘                               │
│                                                         │
│  📸 Photo du compteur                                   │
│  ┌─────────────────────────────────────────────┐       │
│  │  📷 Cliquez ou glissez une photo ici        │       │
│  │                                              │       │
│  │  (JPEG, PNG - max 10 Mo)                    │       │
│  └─────────────────────────────────────────────┘       │
│                                                         │
│  [PREVIEW: compteur_ibrahima_7850km.jpg]  [❌]          │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐                    │
│  │  ANNULER    │  │  VALIDER  ✓  │                    │
│  └─────────────┘  └──────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

### 1.5 Modal Livreur - "Début d'activité"

```
┌─────────────────────────────────────────────────────────┐
│  🟢 DÉBUT D'ACTIVITÉ                               [X]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📅 Date                                                │
│  ┌─────────────────────┐                               │
│  │ 05/02/2026          │ (auto-rempli avec aujourd'hui)│
│  └─────────────────────┘                               │
│                                                         │
│  🛵 Kilométrage du scooter                              │
│  ┌─────────────────────┐                               │
│  │ 12,345 km           │  (ex: 12345)                  │
│  └─────────────────────┘                               │
│                                                         │
│  📸 Photo du compteur                                   │
│  ┌─────────────────────────────────────────────┐       │
│  │  📷 Cliquez ou glissez une photo ici        │       │
│  │                                              │       │
│  │  (JPEG, PNG - max 10 Mo)                    │       │
│  └─────────────────────────────────────────────┘       │
│                                                         │
│  [PREVIEW: compteur_debut_12345km.jpg]  [❌ Supprimer] │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐                    │
│  │  ANNULER    │  │  VALIDER  ✓  │                    │
│  └─────────────┘  └──────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

### 1.6 Modal Livreur - "Fin d'activité"

```
┌─────────────────────────────────────────────────────────┐
│  🔴 FIN D'ACTIVITÉ                                 [X]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📅 Date                                                │
│  ┌─────────────────────┐                               │
│  │ 05/02/2026          │ (auto-rempli avec aujourd'hui)│
│  └─────────────────────┘                               │
│                                                         │
│  ℹ️ Début d'activité: 12,345 km à 08:30                │
│                                                         │
│  🛵 Kilométrage du scooter                              │
│  ┌─────────────────────┐                               │
│  │ 12,387 km           │  (ex: 12387)                  │
│  └─────────────────────┘                               │
│                                                         │
│  📸 Photo du compteur                                   │
│  ┌─────────────────────────────────────────────┐       │
│  │  📷 Cliquez ou glissez une photo ici        │       │
│  │                                              │       │
│  │  (JPEG, PNG - max 10 Mo)                    │       │
│  └─────────────────────────────────────────────┘       │
│                                                         │
│  [PREVIEW: compteur_fin_12387km.jpg]  [❌ Supprimer]   │
│                                                         │
│  ✅ Km parcourus: 42 km                                 │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐                    │
│  │  ANNULER    │  │  VALIDER  ✓  │                    │
│  └─────────────┘  └──────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

### 1.7 État après pointage complet

```
┌─────────────────────────────────────────────────────────┐
│  🚴 MON POINTAGE DU JOUR                                │
│                                                         │
│  ✅ Activité du 05/02/2026                              │
│                                                         │
│  🟢 Début: 08:30 - 12,345 km                            │
│  🔴 Fin:   17:45 - 12,387 km                            │
│                                                         │
│  📊 DISTANCE PARCOURUE: 42 KM                           │
│                                                         │
│  [📷 Voir photos]  [📝 Modifier]                        │
└─────────────────────────────────────────────────────────┘
```

---

## 🗄️ 2. BASE DE DONNÉES

### 2.1 Nouvelle table: `delivery_timesheets`

```sql
CREATE TABLE delivery_timesheets (
  -- Identifiants
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Date du pointage
  date DATE NOT NULL,
  
  -- Début d'activité
  start_time TIMESTAMP,
  start_km DECIMAL(10, 2),  -- Kilométrage de début
  start_photo_path VARCHAR(500),  -- Chemin vers la photo
  start_photo_name VARCHAR(255),  -- Nom original de la photo
  
  -- Fin d'activité
  end_time TIMESTAMP,
  end_km DECIMAL(10, 2),  -- Kilométrage de fin
  end_photo_path VARCHAR(500),  -- Chemin vers la photo
  end_photo_name VARCHAR(255),  -- Nom original de la photo
  
  -- Calculé
  total_km DECIMAL(10, 2) GENERATED ALWAYS AS (
    CASE 
      WHEN end_km IS NOT NULL AND start_km IS NOT NULL 
      THEN end_km - start_km 
      ELSE NULL 
    END
  ) STORED,
  
  -- Métadonnées
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Contraintes
  CONSTRAINT unique_user_date UNIQUE(user_id, date),
  CONSTRAINT valid_km_range CHECK (start_km >= 0 AND (end_km IS NULL OR end_km >= start_km))
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_timesheets_user_date ON delivery_timesheets(user_id, date DESC);
CREATE INDEX idx_timesheets_date ON delivery_timesheets(date DESC);
```

### 2.2 Dossier de stockage des photos

```
uploads/
  └── timesheets/
      └── 2026/
          └── 02/
              ├── 05/
              │   ├── user_abc123_2026-02-05_start.jpg
              │   ├── user_abc123_2026-02-05_end.jpg
              │   ├── user_def456_2026-02-05_start.jpg
              │   └── user_def456_2026-02-05_end.jpg
              └── 06/
                  └── ...
```

**Convention de nommage** :  
`user_{userId}_{date}_{type}.{ext}`

Exemple : `user_abc123_2026-02-05_start.jpg`

---

## 🔧 3. API BACKEND

### 3.1 Routes (`backend/routes/timesheets.js`)

```javascript
const express = require('express');
const router = express.Router();
const timesheetController = require('../controllers/timesheetController');
const { authenticateToken, requireManagerOrAdmin } = require('../middleware/auth');

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// ============ ROUTES LIVREURS ============

// Récupérer le pointage du jour pour le livreur connecté
// GET /api/timesheets/today
router.get('/today', timesheetController.getTodayTimesheet);

// Pointer le début d'activité (pour soi-même)
// POST /api/timesheets/start (avec FormData: date, km, photo)
router.post('/start', timesheetController.startActivity);

// Pointer la fin d'activité (pour soi-même)
// POST /api/timesheets/end (avec FormData: date, km, photo)
router.post('/end', timesheetController.endActivity);

// Télécharger une photo
// GET /api/timesheets/:id/photo/:type (type = start|end)
router.get('/:id/photo/:type', timesheetController.downloadPhoto);

// ============ ROUTES MANAGERS ============

// Récupérer TOUS les pointages d'une date (manager uniquement)
// GET /api/timesheets/all?date=2026-02-05
router.get('/all', requireManagerOrAdmin, timesheetController.getAllTimesheetsForDate);

// Pointer le début pour UN livreur spécifique (manager uniquement)
// POST /api/timesheets/start-for-user (FormData: user_id, date, km, photo)
router.post('/start-for-user', requireManagerOrAdmin, timesheetController.startActivityForUser);

// Pointer la fin pour UN livreur spécifique (manager uniquement)
// POST /api/timesheets/end-for-user (FormData: user_id, date, km, photo)
router.post('/end-for-user', requireManagerOrAdmin, timesheetController.endActivityForUser);

// Récupérer l'historique des pointages (manager: tous, livreur: seulement les siens)
// GET /api/timesheets?start_date=2026-02-01&end_date=2026-02-28&user_id=xxx (optionnel)
router.get('/', timesheetController.getTimesheets);

// Modifier un pointage (si autorisé)
// PUT /api/timesheets/:id
router.put('/:id', timesheetController.updateTimesheet);

// Supprimer un pointage (admin/manager uniquement)
// DELETE /api/timesheets/:id
router.delete('/:id', requireManagerOrAdmin, timesheetController.deleteTimesheet);

module.exports = router;
```

### 3.2 Controller (`backend/controllers/timesheetController.js`)

**Fonctions principales** :

```javascript
// ============ LIVREURS ============

// getTodayTimesheet(req, res)
// - Récupère le pointage du jour pour l'utilisateur connecté
// - Retourne null si aucun pointage

// startActivity(req, res)
// 1. Valider la date (aujourd'hui uniquement pour livreur)
// 2. Valider le km (nombre positif)
// 3. Valider la photo (JPEG/PNG, max 10Mo)
// 4. Vérifier qu'il n'existe pas déjà un pointage pour cette date
// 5. Uploader la photo
// 6. Créer l'entrée en base (user_id = req.user.id)
// 7. Retourner les données

// endActivity(req, res)
// 1. Récupérer le pointage du jour pour l'utilisateur connecté
// 2. Vérifier qu'il y a bien un début d'activité
// 3. Vérifier qu'il n'y a pas déjà de fin d'activité
// 4. Valider le km (doit être >= start_km)
// 5. Valider la photo
// 6. Uploader la photo
// 7. Mettre à jour l'entrée en base
// 8. Retourner les données avec total_km calculé

// ============ MANAGERS ============

// getAllTimesheetsForDate(req, res)
// 1. Vérifier que l'utilisateur est manager/admin
// 2. Récupérer la date (query param, défaut = aujourd'hui)
// 3. Récupérer TOUS les livreurs actifs
// 4. Pour chaque livreur, récupérer son pointage de cette date
// 5. Retourner la liste complète avec statuts:
//    - { livreur, timesheet, status: 'complete'|'partial'|'missing' }

// startActivityForUser(req, res)
// 1. Vérifier que l'utilisateur est manager/admin
// 2. Récupérer user_id du livreur cible (FormData)
// 3. Vérifier que le livreur existe et a le rôle LIVREUR
// 4. Valider date, km, photo
// 5. Vérifier qu'il n'existe pas déjà un pointage pour ce livreur à cette date
// 6. Uploader la photo (nom: user_{livreurId}_date_start.jpg)
// 7. Créer l'entrée en base (user_id = livreur cible)
// 8. Logger l'action: "Manager {managerName} a pointé pour {livreurName}"
// 9. Retourner les données

// endActivityForUser(req, res)
// 1. Vérifier que l'utilisateur est manager/admin
// 2. Récupérer user_id du livreur cible
// 3. Récupérer le pointage existant pour ce livreur
// 4. Vérifier qu'il y a un début d'activité
// 5. Valider km >= start_km
// 6. Uploader la photo
// 7. Mettre à jour l'entrée en base
// 8. Logger l'action
// 9. Retourner les données

// ============ COMMUN ============

// downloadPhoto(req, res)
// - Télécharger la photo de début ou fin
// - Vérifier les permissions:
//   * Propriétaire: OK
//   * Manager/Admin: OK
//   * Autre livreur: NON

// getTimesheets(req, res)
// - Manager: peut voir tous les pointages (avec filter user_id optionnel)
// - Livreur: ne voit que ses propres pointages
```

### 3.3 Model (`backend/models/Timesheet.js`)

```javascript
class Timesheet {
  // Méthodes principales
  static async create({ userId, date, startTime, startKm, startPhotoPath, startPhotoName })
  static async findByUserAndDate(userId, date)
  static async updateEnd(id, { endTime, endKm, endPhotoPath, endPhotoName })
  static async findById(id)
  static async findByUserBetweenDates(userId, startDate, endDate)
  static async delete(id)
  
  // Méthodes MANAGER
  static async findAllForDate(date)
  // - Retourne tous les pointages de tous les livreurs pour une date
  
  static async findAllActiveLivreursWithTimesheets(date)
  // - Retourne tous les livreurs actifs avec leur pointage (peut être null)
  // - JOIN entre users (role=LIVREUR, is_active=true) et delivery_timesheets
  // - Utilisé pour la vue manager "Tous les pointages"
}
```

### 3.4 Upload Helper (`backend/utils/timesheetUploadHelper.js`)

**Fonctions** :
- `uploadTimesheetPhoto(file, userId, date, type)` → Upload et retourne le path
- `deleteTimesheetPhoto(filePath)` → Supprime la photo
- `validateTimesheetPhoto(file)` → Valide taille et type
- `getTimesheetUploadPath(userId, date)` → Retourne le dossier de destination
- `ensureDirectory(path)` → Crée le dossier si nécessaire

---

## 🎨 4. FRONTEND

### 4.1 Fichier JS Livreur (`frontend/js/timesheets-livreur.js`)

**Composant TimesheetsLivreurManager** :

```javascript
const TimesheetsLivreurManager = (() => {
  // Variables globales
  let todayTimesheet = null;
  let startPhotoFile = null;
  let endPhotoFile = null;
  
  // Fonctions principales
  async function init() {
    // Charger le pointage du jour
    await loadTodayTimesheet();
    // Render UI
    renderTimesheetWidget();
    // Attach events
    attachEvents();
  }
  
  async function loadTodayTimesheet() {
    // GET /api/timesheets/today
  }
  
  function renderTimesheetWidget() {
    // Affiche le widget selon l'état:
    // - Aucun pointage → Boutons "Pointer début/fin"
    // - Début pointé → Affiche début + Bouton "Pointer fin"
    // - Complet → Affiche résumé avec km parcourus
  }
  
  async function openStartModal() {
    // Ouvre le modal de début d'activité
  }
  
  async function submitStartActivity() {
    // Valide et envoie POST /api/timesheets/start
  }
  
  async function openEndModal() {
    // Ouvre le modal de fin d'activité
  }
  
  async function submitEndActivity() {
    // Valide et envoie POST /api/timesheets/end
  }
  
  // API publique
  return {
    init,
    loadTodayTimesheet,
    openStartModal,
    openEndModal
  };
})();
```

### 4.2 Fichier JS Manager (`frontend/js/timesheets-manager.js`)

**Composant TimesheetsManagerView** :

```javascript
const TimesheetsManagerView = (() => {
  // Variables globales
  let currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  let allTimesheets = [];
  let selectedLivreur = null;
  let photoFile = null;
  
  // Fonctions principales
  async function init() {
    // Render le widget manager
    renderManagerWidget();
    // Attach events
    attachEvents();
  }
  
  function renderManagerWidget() {
    // Affiche le bouton "📊 Voir tous les pointages"
    // + Résumé rapide (X pointés / Y livreurs)
  }
  
  async function openAllTimesheetsModal() {
    // Charge et affiche tous les pointages pour la date sélectionnée
    await loadAllTimesheetsForDate(currentDate);
    renderAllTimesheetsTable();
    showModal('modal-all-timesheets');
  }
  
  async function loadAllTimesheetsForDate(date) {
    // GET /api/timesheets/all?date=YYYY-MM-DD
    // Récupère tous les livreurs avec leur pointage (ou null)
  }
  
  function renderAllTimesheetsTable() {
    // Génère le tableau HTML avec:
    // - Ligne par livreur
    // - Colonnes: Nom, Début, Fin, Km, Actions
    // - Statut visuel (✅/⏳/❌)
    // - Boutons: [👁️ Voir photos] [📝 Modifier] [➕ Pointer]
  }
  
  async function openPointForUserModal(livreurId, type) {
    // type = 'start' | 'end'
    // Ouvre le modal pour pointer POUR un livreur
    selectedLivreur = livreurId;
    showModal('modal-point-for-user');
  }
  
  async function submitPointForUser(type) {
    // type = 'start' | 'end'
    // Valide et envoie:
    // POST /api/timesheets/start-for-user
    // ou POST /api/timesheets/end-for-user
    // Avec FormData: user_id, date, km, photo
  }
  
  function filterByDate(date) {
    // Change la date et recharge les données
    currentDate = date;
    loadAllTimesheetsForDate(date);
  }
  
  // API publique
  return {
    init,
    openAllTimesheetsModal,
    openPointForUserModal
  };
})();
```

### 4.3 HTML dans le Dashboard (`frontend/index.html`)

**Pour les LIVREURS** :

```html
<!-- Widget Pointage -->
<div id="timesheet-widget" class="dashboard-card">
  <h3>🚴 Mon pointage du jour</h3>
  <div id="timesheet-content">
    <!-- Contenu dynamique généré par timesheets.js -->
  </div>
</div>

<!-- Modal Début d'activité -->
<div id="modal-start-activity" class="modal hidden">
  <div class="modal-content">
    <h2>🟢 Début d'activité</h2>
    <form id="form-start-activity">
      <label>Date</label>
      <input type="date" id="start-date" required />
      
      <label>Kilométrage du scooter (km)</label>
      <input type="number" step="0.01" id="start-km" required />
      
      <label>Photo du compteur</label>
      <div id="start-photo-dropzone" class="dropzone">
        📷 Cliquez ou glissez une photo ici
      </div>
      <input type="file" id="start-photo-input" accept="image/jpeg,image/png" hidden />
      <div id="start-photo-preview"></div>
      
      <div class="modal-actions">
        <button type="button" class="btn-secondary" id="btn-cancel-start">
          Annuler
        </button>
        <button type="submit" class="btn-primary">
          Valider ✓
        </button>
      </div>
    </form>
  </div>
</div>

<!-- Modal Fin d'activité -->
<div id="modal-end-activity" class="modal hidden">
  <!-- Structure similaire -->
</div>
```

**Pour les MANAGERS** :

```html
<!-- Widget Manager -->
<div id="timesheet-manager-widget" class="dashboard-card" style="display: none;">
  <h3>📊 Pointages des livreurs</h3>
  
  <div class="manager-timesheet-summary">
    <p id="timesheet-summary-text">
      <!-- Ex: "8 livreurs actifs | 6 pointés | 2 manquants" -->
    </p>
  </div>
  
  <button id="btn-view-all-timesheets" class="btn-primary btn-large">
    📊 Voir tous les pointages
  </button>
</div>

<!-- Modal Vue de tous les pointages -->
<div id="modal-all-timesheets" class="modal hidden">
  <div class="modal-content modal-large">
    <h2>📊 Pointages des livreurs</h2>
    
    <div class="filter-section">
      <label>📅 Date:</label>
      <input type="date" id="filter-timesheet-date" />
      <button class="btn-secondary btn-sm" id="btn-today">Aujourd'hui</button>
      <button class="btn-secondary btn-sm" id="btn-yesterday">Hier</button>
      <button class="btn-primary btn-sm" id="btn-refresh-timesheets">🔄 Rafraîchir</button>
    </div>
    
    <div id="timesheets-table-container">
      <!-- Table générée dynamiquement -->
    </div>
    
    <div class="stats-section">
      <h4>📊 Statistiques</h4>
      <div id="timesheet-stats">
        <!-- Stats générées dynamiquement -->
      </div>
    </div>
    
    <div class="modal-actions">
      <button class="btn-secondary" id="btn-export-excel">📥 Exporter Excel</button>
      <button class="btn-secondary" id="btn-close-all-timesheets">Fermer</button>
    </div>
  </div>
</div>

<!-- Modal Pointer pour un livreur -->
<div id="modal-point-for-user" class="modal hidden">
  <div class="modal-content">
    <h2 id="point-for-user-title">🟢 Pointer pour: <span id="livreur-name"></span></h2>
    
    <div class="alert alert-warning">
      ⚠️ Vous êtes sur le point de pointer pour un autre utilisateur en tant que manager.
    </div>
    
    <form id="form-point-for-user">
      <input type="hidden" id="point-user-id" />
      <input type="hidden" id="point-type" /> <!-- start | end -->
      
      <label>👤 Livreur</label>
      <input type="text" id="point-livreur-display" readonly />
      
      <label>📅 Date</label>
      <input type="date" id="point-date" required />
      
      <label>🛵 Kilométrage (km)</label>
      <input type="number" step="0.01" id="point-km" required />
      
      <label>📸 Photo du compteur</label>
      <div id="point-photo-dropzone" class="dropzone">
        📷 Cliquez ou glissez une photo ici
      </div>
      <input type="file" id="point-photo-input" accept="image/jpeg,image/png" hidden />
      <div id="point-photo-preview"></div>
      
      <div class="modal-actions">
        <button type="button" class="btn-secondary" id="btn-cancel-point-for-user">
          Annuler
        </button>
        <button type="submit" class="btn-primary">
          Valider ✓
        </button>
      </div>
    </form>
  </div>
</div>
```

### 4.4 CSS (`frontend/css/styles.css`)

```css
/* Widget pointage */
.timesheet-widget {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 20px;
}

.timesheet-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-top: 15px;
}

.btn-start-activity {
  background: #48bb78;
  color: white;
  border: none;
  padding: 15px;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-start-activity:hover {
  background: #38a169;
  transform: translateY(-2px);
}

.btn-end-activity {
  background: #f56565;
  /* ... */
}

.timesheet-summary {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  padding: 15px;
  border-radius: 8px;
  margin-top: 15px;
}

.km-counter {
  font-size: 32px;
  font-weight: bold;
  text-align: center;
  margin: 10px 0;
}

/* Manager View - Table des pointages */
.timesheets-table {
  width: 100%;
  border-collapse: collapse;
  margin: 20px 0;
}

.timesheets-table th {
  background: #667eea;
  color: white;
  padding: 12px;
  text-align: left;
  font-weight: 600;
}

.timesheets-table td {
  padding: 12px;
  border-bottom: 1px solid #e2e8f0;
}

.timesheets-table tr:hover {
  background: #f7fafc;
}

.timesheet-status {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.status-complete {
  background: #48bb78;
  color: white;
}

.status-partial {
  background: #ed8936;
  color: white;
}

.status-missing {
  background: #f56565;
  color: white;
}

.btn-icon {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  transition: transform 0.2s;
}

.btn-icon:hover {
  transform: scale(1.2);
}

.modal-large {
  max-width: 1200px;
  width: 95%;
}

.filter-section {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 20px;
  padding: 15px;
  background: #f7fafc;
  border-radius: 8px;
}

.stats-section {
  margin-top: 20px;
  padding: 15px;
  background: #edf2f7;
  border-radius: 8px;
}
```

---

## 🔄 5. WORKFLOW COMPLET

### 5.1 Scénario: Début de journée

```
1. Livreur arrive et ouvre l'appli
   ↓
2. Va sur "Tableau de bord"
   ↓
3. Voit le widget "Mon pointage du jour" (vide)
   ↓
4. Clique sur "🟢 POINTER LE DÉBUT"
   ↓
5. Modal s'ouvre avec:
   - Date = aujourd'hui (05/02/2026)
   - Champ km vide
   - Zone photo vide
   ↓
6. Livreur regarde son compteur: 12,345 km
   ↓
7. Entre "12345" dans le champ km
   ↓
8. Prend photo du compteur avec son téléphone
   ↓
9. Clique sur zone photo → sélectionne la photo
   ↓
10. Preview s'affiche
    ↓
11. Clique "VALIDER ✓"
    ↓
12. Frontend:
    - Valide les données
    - Crée FormData avec date, km, photo
    - POST /api/timesheets/start
    ↓
13. Backend:
    - Valide la photo (type, taille)
    - Crée le dossier uploads/timesheets/2026/02/05/
    - Upload la photo: user_abc123_2026-02-05_start.jpg
    - INSERT dans delivery_timesheets
    - Retourne les données
    ↓
14. Frontend:
    - Affiche notification "✅ Début d'activité enregistré"
    - Met à jour le widget:
      "✅ Début: 08:30 - 12,345 km"
      "Km parcourus: -- km"
      "[🔴 POINTER LA FIN]"
```

### 5.2 Scénario: Fin de journée

```
1. Livreur termine ses livraisons
   ↓
2. Ouvre l'appli → Tableau de bord
   ↓
3. Voit le widget:
   "✅ Début: 08:30 - 12,345 km"
   "[🔴 POINTER LA FIN]"
   ↓
4. Clique sur "🔴 POINTER LA FIN"
   ↓
5. Modal s'ouvre avec:
   - Date = aujourd'hui
   - Info: "Début: 12,345 km à 08:30"
   - Champ km vide
   - Zone photo vide
   ↓
6. Livreur regarde son compteur: 12,387 km
   ↓
7. Entre "12387"
   ↓
8. Upload photo du compteur
   ↓
9. Clique "VALIDER ✓"
   ↓
10. Frontend:
    - Calcule: 12387 - 12345 = 42 km
    - Affiche preview: "✅ Km parcourus: 42 km"
    - POST /api/timesheets/end
    ↓
11. Backend:
    - Récupère le pointage du jour
    - Vérifie que end_km >= start_km
    - Upload la photo: user_abc123_2026-02-05_end.jpg
    - UPDATE delivery_timesheets SET end_km, end_photo, etc.
    - Retourne avec total_km calculé (42 km)
    ↓
12. Frontend:
    - Affiche notification "✅ Fin d'activité enregistrée"
    - Met à jour le widget:
      "✅ Activité du 05/02/2026"
      "🟢 Début: 08:30 - 12,345 km"
      "🔴 Fin: 17:45 - 12,387 km"
      "📊 DISTANCE PARCOURUE: 42 KM"
      "[📷 Voir photos]"
```

---

## 🔒 6. SÉCURITÉ & VALIDATIONS

### 6.1 Backend

- ✅ Authentification requise (JWT token)
- ✅ Validation des types de fichiers (JPEG/PNG uniquement)
- ✅ Limite de taille: 10 Mo max
- ✅ Validation du kilométrage (nombre positif, end >= start)
- ✅ Un seul pointage par jour et par utilisateur
- ✅ Noms de fichiers sécurisés (pas de caractères spéciaux)
- ✅ Permissions granulaires:
  - **Livreur**: peut créer/modifier UNIQUEMENT ses propres pointages
  - **Manager**: peut voir tous les pointages + pointer pour n'importe quel livreur
  - **Admin**: tous les droits (inclus manager)
- ✅ Logs d'audit:
  - Logger quand un manager pointe pour un livreur
  - Format: "Manager {username} a pointé {type} pour {livreur} le {date}"

### 6.2 Frontend

- ✅ Validation des champs avant soumission
- ✅ Preview de la photo avant upload
- ✅ Messages d'erreur clairs
- ✅ Empêcher double soumission
- ✅ Loader pendant l'upload

---

## 📱 7. RESPONSIVE DESIGN

```css
/* Mobile */
@media (max-width: 768px) {
  .timesheet-actions {
    grid-template-columns: 1fr; /* Boutons empilés */
  }
  
  .modal-content {
    width: 95%;
    padding: 15px;
  }
}

/* Tablet */
@media (min-width: 769px) and (max-width: 1024px) {
  .timesheet-widget {
    max-width: 600px;
    margin: 0 auto;
  }
}
```

---

## 📊 8. FONCTIONNALITÉS FUTURES (Optionnelles)

### Phase 2 - Reporting Manager ⚠️ DÉJÀ INCLUS DANS LA V1

- ✅ Dashboard manager avec tous les pointages
- ✅ Filtre par date
- ✅ Statistiques: km moyens par livreur
- ⏳ Historique mensuel (optionnel)
- ⏳ Export Excel des pointages (optionnel)

### Phase 3 - Intégration

- 🔗 Lien avec les commandes (km théoriques vs réels)
- 📍 Géolocalisation automatique (si GPS activé)
- 🔔 Notifications: "N'oubliez pas de pointer!"

---

## ✅ 9. CHECKLIST D'IMPLÉMENTATION

### Base de données
- [ ] Créer la table `delivery_timesheets`
- [ ] Créer les index
- [ ] Créer le dossier `uploads/timesheets/`

### Backend
- [ ] Créer `backend/models/Timesheet.js`
- [ ] Créer `backend/controllers/timesheetController.js`
- [ ] Créer `backend/routes/timesheets.js`
- [ ] Créer `backend/utils/timesheetUploadHelper.js`
- [ ] Ajouter middleware `requireManagerOrAdmin` dans `backend/middleware/auth.js`
- [ ] Ajouter les routes dans `backend/server.js`
- [ ] Tester endpoints livreur avec Postman
- [ ] Tester endpoints manager avec Postman

### Frontend
- [ ] Créer `frontend/js/timesheets-livreur.js` (vue livreur)
- [ ] Créer `frontend/js/timesheets-manager.js` (vue manager)
- [ ] Ajouter le widget livreur dans `frontend/index.html`
- [ ] Ajouter le widget manager dans `frontend/index.html`
- [ ] Créer les modals livreur (début/fin)
- [ ] Créer les modals manager (vue tous + pointer pour user)
- [ ] Ajouter les styles CSS (livreur + manager)
- [ ] Intégrer dans le dashboard (condition selon rôle)
- [ ] Tester sur desktop/mobile

### Tests
- [ ] Tester upload photo (JPEG/PNG)
- [ ] Tester validation km (end >= start)
- [ ] Tester contrainte unique (1 pointage/jour/utilisateur)
- [ ] Tester permissions livreur (ne peut pas pointer pour un autre)
- [ ] Tester permissions manager (peut pointer pour n'importe qui)
- [ ] Tester vue manager avec 0, 5, 10 livreurs
- [ ] Tester filtre par date (manager)
- [ ] Tester responsive design (mobile/tablet/desktop)
- [ ] Tester logs d'audit (quand manager pointe pour livreur)

---

## 🎯 10. EXEMPLE DE DONNÉES

### Table `delivery_timesheets`

| id | user_id | date | start_time | start_km | end_time | end_km | total_km |
|----|---------|------|------------|----------|----------|--------|----------|
| 1  | abc123  | 2026-02-05 | 2026-02-05 08:30 | 12345.00 | 2026-02-05 17:45 | 12387.00 | 42.00 |
| 2  | abc123  | 2026-02-06 | 2026-02-06 09:00 | 12387.00 | 2026-02-06 18:00 | 12425.00 | 38.00 |
| 3  | def456  | 2026-02-05 | 2026-02-05 08:00 | 8500.00  | 2026-02-05 19:00 | 8565.00  | 65.00 |

### Requête API - POST /api/timesheets/start

**Request** :
```
FormData {
  date: "2026-02-05",
  km: "12345",
  photo: File(compteur.jpg)
}
```

**Response** :
```json
{
  "success": true,
  "message": "Début d'activité enregistré",
  "data": {
    "id": "abc-123-def-456",
    "user_id": "user-abc-123",
    "date": "2026-02-05",
    "start_time": "2026-02-05T08:30:00Z",
    "start_km": 12345.00,
    "start_photo_path": "uploads/timesheets/2026/02/05/user_abc123_2026-02-05_start.jpg",
    "start_photo_name": "compteur.jpg",
    "end_time": null,
    "end_km": null,
    "total_km": null
  }
}
```

---

## 📞 SUPPORT & QUESTIONS

Pour toute question sur ce design, contactez l'équipe technique.

**Date de création** : 05/02/2026  
**Auteur** : Équipe Matix Livreur  
**Version** : 1.0
