# 📝 MODIFICATIONS DU SYSTÈME DE POINTAGE - MULTI-SCOOTERS

## Date: 10/02/2026

---

## ✅ CE QUI A ÉTÉ MODIFIÉ

### 1. **Base de données** ✅
- ✅ Colonne `scooter_id` ajoutée (VARCHAR(50), facultatif)
- ✅ Contrainte unique changée: `(user_id, date)` → `(user_id, scooter_id, date)`
- ✅ Index ajoutés pour performance
- 📄 Fichier: `migration_add_scooter_id_to_timesheets.sql`

### 2. **Backend - Modèle** ✅
- ✅ Ajout du champ `scooter_id` dans le constructeur
- ✅ Nouvelle méthode: `findByUserScooterAndDate(userId, scooterId, date)`
- ✅ Nouvelle méthode: `findAllByUserAndDate(userId, date)` → Retourne TOUS les pointages d'un livreur pour un jour
- ✅ Modification `findAllActiveLivreursWithTimesheets(date)` → Retourne format: 
  ```javascript
  [{
    user_id, 
    username, 
    timesheets: [...],  // Tableau de tous les pointages
    total_km_journee: 135.5,
    nb_pointages: 2,
    status: 'complete'|'partial'|'missing'
  }]
  ```
- ✅ Modification `getStatsForDate(date)` → Calcule correctement avec plusieurs pointages
- 📄 Fichier: `backend/models/Timesheet.js`

### 3. **Backend - Controller** ✅
- ✅ Fonction helper: `canLivreurModifyTimesheet(timesheet, userRole)` 
  - Livreur: 15 minutes max après création
  - Manager/Admin: Toujours autorisé
  
- ✅ `getTodayTimesheet()` → Retourne maintenant:
  ```javascript
  {
    success: true,
    data: [...],  // Tableau de pointages
    total_km_journee: 135.5,
    nb_pointages: 2,
    date: "2026-02-10"
  }
  ```

- ✅ `startActivity()` → Accepte `scooter_id` (optionnel)
  - Vérifie contrainte unique par (user_id, scooter_id, date)
  
- ✅ `endActivity()` → Utilise `timesheet_id` au lieu de `date`
  - Body: `{ timesheet_id, km, photo }`
  - Vérifie les 15 minutes pour livreurs
  
- ✅ `startActivityForUser()` (Manager) → Accepte `scooter_id`
- ✅ `endActivityForUser()` (Manager) → Utilise `timesheet_id`
- ✅ `updateStartActivity()` → Vérifie les 15 minutes pour livreurs
- ✅ `updateEndActivity()` → Vérifie les 15 minutes pour livreurs
- ✅ `deleteTimesheet()` → Vérifie les 15 minutes pour livreurs (remplace "aujourd'hui seulement")
- 📄 Fichier: `backend/controllers/timesheetController.js`

---

## 🚧 CE QUI RESTE À FAIRE

### 4. **Frontend - Livreur** 🚧
**Modifications nécessaires:**

#### a) `timesheets-livreur.js`

**Variables globales:**
```javascript
// AVANT
let todayTimesheet = null;  // Un seul pointage

// APRÈS
let todayTimesheets = [];  // Tableau de pointages
let selectedTimesheetForEnd = null;  // Pointage sélectionné pour pointer la fin
```

**`loadTodayTimesheet()`:**
```javascript
// AVANT: data.data était un objet ou null
todayTimesheet = data.data;

// APRÈS: data.data est un tableau
todayTimesheets = data.data || [];
totalKmJournee = data.total_km_journee || 0;
nbPointages = data.nb_pointages || 0;
```

**`renderTimesheetWidget()`:**

Afficher une LISTE de tous les pointages avec boutons par pointage:

```html
<div class="timesheets-list">
  <!-- Pour chaque pointage -->
  <div class="timesheet-item">
    <div class="scooter-badge">🛵 Scooter: SCOOTER-005</div>
    
    <div class="timesheet-details">
      <div>🟢 Début: 08:30 - 12,345 km</div>
      <div>🔴 Fin: 14:00 - 12,400 km</div>
      <div class="km-total">📊 55 km</div>
    </div>
    
    <div class="actions">
      <button data-timesheet-id="xxx">✏️</button>
      <button data-timesheet-id="xxx">🗑️</button>
    </div>
  </div>
</div>

<div class="total-journee">
  <strong>Total journée: 135 km</strong> (2 pointages)
</div>

<div class="actions-global">
  <button id="btn-add-new-pointage">➕ Nouveau pointage</button>
</div>
```

**Modal "Début d'activité":**

Ajouter champ scooter_id:
```html
<label>🛵 N° Scooter (facultatif)</label>
<input type="text" id="start-scooter-id" placeholder="Ex: SCOOTER-005" />
```

**Modal "Fin d'activité":**

Utiliser `timesheet_id` au lieu de `date`:
```javascript
// AVANT
FormData.append('date', date);

// APRÈS
FormData.append('timesheet_id', selectedTimesheetForEnd.id);
```

**`submitStartActivity()`:**
```javascript
formData.append('scooter_id', document.getElementById('start-scooter-id').value);
// POST /api/timesheets/start
```

**`submitEndActivity()`:**
```javascript
// Récupérer le timesheet_id du pointage sélectionné
const timesheetId = selectedTimesheetForEnd.id;
formData.append('timesheet_id', timesheetId);
// POST /api/timesheets/end
```

#### b) `index.html`

Ajouter dans le modal "Début d'activité":
```html
<div class="form-group">
  <label for="start-scooter-id">🛵 N° Scooter (facultatif)</label>
  <input type="text" id="start-scooter-id" 
         placeholder="Ex: SCOOTER-005" 
         class="form-control" />
  <small class="form-text">Laissez vide si vous n'utilisez pas de scooter identifié</small>
</div>
```

### 5. **Frontend - Manager** 🚧
**Modifications nécessaires:**

#### a) `timesheets-manager.js`

**`renderAllTimesheetsTable()`:**

Pour chaque livreur, afficher TOUS ses pointages:

```html
<table>
  <tr class="livreur-row">
    <td rowspan="3">
      <strong>👤 Aliou</strong><br/>
      <small>Total: 135 km (2 pointages)</small>
    </td>
  </tr>
  <tr class="pointage-row">
    <td>🛵 SCOOTER-005</td>
    <td>08:30 - 12,345 km</td>
    <td>14:00 - 12,400 km</td>
    <td>55 km</td>
    <td>✅ Complet</td>
    <td><button>👁️</button> <button>📝</button></td>
  </tr>
  <tr class="pointage-row">
    <td>🛵 SCOOTER-007</td>
    <td>14:30 - 8,500 km</td>
    <td>18:00 - 8,580 km</td>
    <td>80 km</td>
    <td>✅ Complet</td>
    <td><button>👁️</button> <button>📝</button></td>
  </tr>
</table>
```

**Structure des données:**
```javascript
// API retourne:
data: [
  {
    user_id: "xxx",
    username: "Aliou",
    timesheets: [
      { id, scooter_id: "SCOOTER-005", start_km, end_km, total_km, ... },
      { id, scooter_id: "SCOOTER-007", start_km, end_km, total_km, ... }
    ],
    total_km_journee: 135,
    nb_pointages: 2,
    status: "complete"
  }
]
```

**Modal "Pointer pour un livreur":**

Ajouter champ scooter_id:
```html
<label>🛵 N° Scooter (facultatif)</label>
<input type="text" id="manager-scooter-id" />
```

**`submitStartForUser()` et `submitEndForUser()`:**
```javascript
// Pour début
formData.append('scooter_id', document.getElementById('manager-scooter-id').value);

// Pour fin (utiliser timesheet_id au lieu de user_id + date)
formData.append('timesheet_id', selectedTimesheet.id);
```

---

## 📊 NOUVEAUX COMPORTEMENTS

### Pour LIVREURS:

1. **Pointage début:**
   - Peut pointer plusieurs fois par jour (différents scooters)
   - Champ `scooter_id` facultatif
   - Contrainte: 1 seul pointage par (livreur + scooter + date)

2. **Pointage fin:**
   - Sélectionner quel pointage "début" terminer
   - Validation: end_km >= start_km
   - Contrainte 15 minutes: Ne peut modifier/supprimer après 15 min

3. **Modification:**
   - Possible seulement dans les 15 minutes après création
   - Message: "Délai de 15 minutes écoulé (créé il y a X minutes)"

4. **Affichage:**
   - Liste de tous les pointages du jour
   - Total km journée affiché en bas
   - Badge "🛵 Scooter: XXX" si scooter_id renseigné

### Pour MANAGERS:

1. **Vue d'ensemble:**
   - Voir TOUS les pointages de chaque livreur
   - Total km par livreur (somme de tous ses scooters)
   - Nombre de pointages affiché

2. **Actions:**
   - Peut pointer pour un livreur (avec scooter_id optionnel)
   - Peut modifier/supprimer à tout moment (pas de limite 15 min)
   - Peut pointer la fin pour un pointage spécifique (via timesheet_id)

3. **Statistiques:**
   - Total livreurs actifs
   - Complets: tous les pointages du livreur sont complets
   - Partiels: au moins un pointage sans fin
   - Manquants: aucun pointage
   - Total km: somme de tous les km de tous les livreurs

---

## 🎯 EXEMPLES D'UTILISATION

### Exemple 1: Livreur utilise 1 seul scooter toute la journée

```
1. Matin (08:30):
   - Pointer début: km=12,345, scooter="SCOOTER-005"
   
2. Soir (18:00):
   - Pointer fin du pointage SCOOTER-005: km=12,400
   
Résultat: 55 km parcourus avec SCOOTER-005
```

### Exemple 2: Livreur change de scooter en cours de journée

```
1. Matin (08:30):
   - Pointer début: km=12,345, scooter="SCOOTER-005"
   
2. Midi (14:00):
   - Pointer fin SCOOTER-005: km=12,400 → 55 km
   - Pointer début: km=8,500, scooter="SCOOTER-007"
   
3. Soir (18:00):
   - Pointer fin SCOOTER-007: km=8,580 → 80 km
   
Résultat: 135 km parcourus (55 + 80)
```

### Exemple 3: Deux livreurs utilisent le même scooter

```
Livreur Aliou (matin):
- Début: 08:30, km=12,345, scooter="SCOOTER-005"
- Fin: 14:00, km=12,400 → 55 km

Livreur Diaby (après-midi):
- Début: 14:30, km=12,400, scooter="SCOOTER-005"
- Fin: 18:00, km=12,480 → 80 km

✅ AUTORISÉ: Même scooter, mais livreurs différents
```

### Exemple 4: Livreur essaie de repointer avec le même scooter

```
1. Matin (08:30):
   - Pointer début: km=12,345, scooter="SCOOTER-005"
   
2. 10 minutes plus tard (08:40):
   - Essaie de repointer début avec scooter="SCOOTER-005"
   
❌ ERREUR: "Un pointage existe déjà pour cette date et ce scooter"

Solution: Modifier le pointage existant (dans les 15 min)
```

### Exemple 5: Livreur essaie de modifier après 15 minutes

```
1. Matin (08:30):
   - Pointer début: km=12,345, scooter="SCOOTER-005"
   
2. 20 minutes plus tard (08:50):
   - Essaie de modifier le km de début
   
❌ ERREUR: "Vous ne pouvez plus modifier ce pointage. Délai de 15 minutes écoulé (créé il y a 20 minutes)."

Solution: Appeler un manager pour correction
```

---

## 🔧 COMMANDES POUR APPLIQUER LES MODIFICATIONS

### 1. Exécuter la migration SQL:

```bash
psql -U votre_user -d votre_database -f migration_add_scooter_id_to_timesheets.sql
```

### 2. Redémarrer le serveur backend:

```bash
cd backend
npm start
```

### 3. Vider le cache du navigateur:

```
Ctrl + Shift + R (ou Cmd + Shift + R sur Mac)
```

### 4. Tester l'API:

```bash
# Pointer début avec scooter
curl -X POST http://localhost:4000/api/v1/timesheets/start \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "date=2026-02-10" \
  -F "km=12345" \
  -F "scooter_id=SCOOTER-005" \
  -F "photo=@compteur.jpg"

# Pointer fin (avec timesheet_id)
curl -X POST http://localhost:4000/api/v1/timesheets/end \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "timesheet_id=xxx-xxx-xxx" \
  -F "km=12400" \
  -F "photo=@compteur.jpg"
```

---

## ✅ CHECKLIST DE MISE EN PRODUCTION

- [x] Migration SQL exécutée
- [x] Modèle Timesheet.js modifié
- [x] Controller modifié
- [ ] Frontend livreur modifié
- [ ] Frontend manager modifié
- [ ] Tests fonctionnels:
  - [ ] Livreur: pointer début avec scooter
  - [ ] Livreur: pointer début sans scooter
  - [ ] Livreur: pointer fin
  - [ ] Livreur: changer de scooter en cours de journée
  - [ ] Livreur: tester délai 15 minutes
  - [ ] Manager: voir tous les pointages d'un livreur
  - [ ] Manager: pointer pour un livreur avec scooter
  - [ ] Manager: modifier à tout moment
  - [ ] Deux livreurs avec même scooter
  - [ ] Statistiques correctes

---

## 📞 CONTACT & SUPPORT

En cas de problème:
1. Vérifier les logs backend (console serveur)
2. Vérifier la console navigateur (F12)
3. Vérifier que la migration SQL a bien été exécutée:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'delivery_timesheets' AND column_name = 'scooter_id';
   ```

---

**Date de création**: 10/02/2026  
**Auteur**: Claude AI  
**Version**: 1.0
