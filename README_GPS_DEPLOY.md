# 🗺️ DÉPLOIEMENT GPS MATIX LIVREUR - GUIDE RENDER

## 🚀 ÉTAPES DE DÉPLOIEMENT

### 1️⃣ BASE DE DONNÉES
```bash
# Exécuter le script SQL sur Render
psql $DATABASE_URL -f deploy-gps-render.sql
```

### 2️⃣ BACKEND - Vérifier app.js
```javascript
// Ajouter dans backend/app.js
const gpsRoutes = require('./routes/gps');
app.use('/api/gps', gpsRoutes);
```

### 3️⃣ FRONTEND - Télécharger Leaflet
1. Aller sur https://leafletjs.com/download.html
2. Télécharger la version 1.9.4
3. Placer dans `frontend/assets/leaflet/`:
   - `leaflet.js`
   - `leaflet.css` 
   - `images/` (dossier avec les icônes)

### 4️⃣ FRONTEND - Intégrer dans index.html
```html
<!-- Dans <head> -->
<link rel="stylesheet" href="assets/leaflet/leaflet.css" />

<!-- Avant </body> -->
<script src="assets/leaflet/leaflet.js"></script>
<script src="js/gps-manager.js"></script>
<script src="js/gps-livreur.js"></script>
<script src="js/gps-analytics.js"></script>
<script src="js/gps-tracking-manager.js"></script>

<!-- Ajouter section GPS -->
<div id="gps-section" class="dashboard-section" style="display: none;">
    <h2>🗺️ Suivi GPS</h2>
    <div id="gps-map" style="height: 400px;"></div>
    <div id="gps-list"></div>
</div>

<!-- Ajouter navigation -->
<li><a href="#" onclick="showSection('gps')">🗺️ GPS</a></li>
```

### 5️⃣ VARIABLES D'ENVIRONNEMENT RENDER
```
GPS_TRACKING_ENABLED=true
GPS_DEFAULT_INTERVAL=30000
GPS_MAX_ACCURACY=100
```

## 🧪 TESTS POST-DÉPLOIEMENT

### Test base de données
```sql
-- Se connecter à Render
psql $DATABASE_URL

-- Vérifier les tables
\dt gps_*

-- Tester la fonction GPS
SELECT calculate_gps_distance(14.6928, -17.4467, 14.7028, -17.4567);

-- Voir les livreurs
SELECT u.username, gs.tracking_enabled 
FROM gps_settings gs 
JOIN users u ON gs.livreur_id = u.id;
```

### Test API
```bash
# Remplacer YOUR_APP par votre nom Render
curl -X GET https://YOUR_APP.onrender.com/api/gps/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test Frontend
```javascript
// Console navigateur (F12)
console.log(typeof L); // Doit afficher "object"
ApiClient.getGpsStats().then(console.log);
```

## 📱 ACTIVATION GPS LIVREURS

### Pour chaque livreur :
1. Se connecter avec le compte livreur
2. Aller dans les paramètres
3. Activer "Autoriser le suivi GPS"
4. Donner les permissions navigateur

### Ou via base de données :
```sql
-- Activer le GPS pour un livreur spécifique
UPDATE gps_settings 
SET tracking_enabled = true 
WHERE livreur_id IN (
    SELECT id FROM users WHERE username = 'NOM_LIVREUR'
);
```

## 🔧 DÉPANNAGE COURANT

### ❌ "Function calculate_gps_distance does not exist"
```bash
psql $DATABASE_URL -f deploy-gps-render.sql
```

### ❌ Leaflet ne se charge pas
```html
<!-- Utiliser CDN temporairement -->
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
```

### ❌ GPS ne s'enregistre pas
1. Vérifier `tracking_enabled = true` dans `gps_settings`
2. Vérifier permissions géolocalisation navigateur
3. Vérifier authentification JWT

## 📋 CHECKLIST FINAL

- [ ] Script SQL exécuté sans erreurs
- [ ] Tables GPS créées (3 tables)
- [ ] Routes GPS dans app.js
- [ ] Assets Leaflet uploadés
- [ ] Interface GPS dans index.html
- [ ] Variables environnement configurées
- [ ] Test API réussi
- [ ] Test carte Leaflet réussi
- [ ] Au moins 1 livreur avec GPS activé

## 🎯 ENDPOINTS GPS PRINCIPAUX

- `POST /api/gps/location` - Enregistrer position
- `GET /api/gps/stats` - Statistiques
- `GET /api/gps/analytics/daily` - Analytics quotidiennes
- `POST /api/gps/settings/toggle` - Activer/désactiver

## 📞 SUPPORT

- **Logs Render** : Dashboard → Logs tab
- **Base de données** : `psql $DATABASE_URL`
- **Frontend** : Console navigateur (F12)

---
*Guide rapide pour déployer le système GPS complet sur Render* 