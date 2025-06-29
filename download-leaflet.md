# 📥 TÉLÉCHARGEMENT LEAFLET POUR GPS

## 🌐 Option 1 : Téléchargement manuel (recommandé)

1. **Aller sur le site officiel :**
   https://leafletjs.com/download.html

2. **Télécharger la version 1.9.4 :**
   - Cliquer sur "Download Leaflet 1.9.4"
   - Télécharger le fichier ZIP

3. **Extraire dans votre projet :**
   ```
   frontend/assets/leaflet/
   ├── leaflet.js
   ├── leaflet.css
   └── images/
       ├── marker-icon.png
       ├── marker-icon-2x.png
       └── marker-shadow.png
   ```

## 🔗 Option 2 : CDN (temporaire pour tests)

```html
<!-- Dans index.html pour tester rapidement -->
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
```

## 📂 Structure finale attendue

```
frontend/
├── assets/
│   └── leaflet/
│       ├── leaflet.js              # 147 KB
│       ├── leaflet.css             # 13 KB
│       └── images/
│           ├── marker-icon.png     # 2.5 KB
│           ├── marker-icon-2x.png  # 4.0 KB
│           └── marker-shadow.png   # 1.7 KB
├── js/
│   ├── gps-manager.js
│   ├── gps-livreur.js
│   ├── gps-analytics.js
│   └── gps-tracking-manager.js
└── index.html
```

## ✅ Vérification installation

1. **Ouvrir la console navigateur (F12)**
2. **Taper :** `console.log(typeof L)`
3. **Résultat attendu :** `"object"`

## 🚨 Si Leaflet ne se charge pas

### Problème 1 : Fichiers manquants
```bash
# Vérifier que les fichiers existent
ls frontend/assets/leaflet/
```

### Problème 2 : Chemins incorrects dans index.html
```html
<!-- Vérifier les chemins relatifs -->
<link rel="stylesheet" href="assets/leaflet/leaflet.css" />
<script src="assets/leaflet/leaflet.js"></script>
```

### Problème 3 : Utiliser CDN temporairement
```html
<!-- Remplacer par CDN pour tester -->
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
```

## 📱 Test rapide de la carte

```javascript
// Ajouter dans la console pour tester
var map = L.map('gps-map').setView([14.6928, -17.4467], 13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
var marker = L.marker([14.6928, -17.4467]).addTo(map);
```

## 🎯 Intégration finale dans index.html

```html
<!DOCTYPE html>
<html>
<head>
    <!-- Autres CSS -->
    <link rel="stylesheet" href="assets/leaflet/leaflet.css" />
</head>
<body>
    <!-- Interface GPS -->
    <div id="gps-section" class="dashboard-section" style="display: none;">
        <h2>🗺️ Suivi GPS</h2>
        <div id="gps-map" style="height: 400px; width: 100%;"></div>
    </div>

    <!-- Scripts avant </body> -->
    <script src="assets/leaflet/leaflet.js"></script>
    <script src="js/gps-manager.js"></script>
    <script src="js/gps-livreur.js"></script>
    <script src="js/gps-analytics.js"></script>
    <script src="js/gps-tracking-manager.js"></script>
</body>
</html>
```

---
*Une fois Leaflet installé, votre système GPS aura une carte interactive fonctionnelle !* 