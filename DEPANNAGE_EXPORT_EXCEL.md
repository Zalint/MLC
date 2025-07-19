# 🔧 Dépannage - Export Excel MATA

## ❌ Erreur : "Token d'authentification manquant"

### 🔍 **Diagnostic :**
Cette erreur indique que l'authentification JWT n'est pas correctement transmise lors de l'export Excel.

### 🛠️ **Solutions :**

#### **1. Vérifier la connexion**
- ✅ Vous devez être **connecté** en tant que Manager ou Admin
- ✅ Vérifiez que vous n'êtes pas déconnecté automatiquement
- ✅ Reconnectez-vous si nécessaire

#### **2. Vérifier le token dans le navigateur**
1. **Ouvrir la console** (F12)
2. **Taper** : `localStorage.getItem('authToken')`
3. **Résultat attendu** : Une chaîne de caractères longue (le token JWT)
4. **Si null/undefined** : Reconnectez-vous

#### **3. Vérifier les cookies/session**
- ✅ Vérifiez que les cookies ne sont pas bloqués
- ✅ Désactivez temporairement les bloqueurs de publicités
- ✅ Essayez en navigation privée

#### **4. Vérifier la console d'erreurs**
1. **Ouvrir la console** (F12)
2. **Cliquer** sur le bouton "Export Excel"
3. **Vérifier** les erreurs dans la console
4. **Signaler** les erreurs spécifiques

---

## 🔍 **Autres problèmes courants :**

### **❌ Bouton non visible**
**Symptôme** : Le bouton "Export Excel" n'apparaît pas
**Solutions** :
- ✅ Vérifier qu'il y a des données MATA pour le mois sélectionné
- ✅ Recharger la page
- ✅ Vérifier les permissions (Manager/Admin)

### **❌ Erreur de téléchargement**
**Symptôme** : Le fichier ne se télécharge pas
**Solutions** :
- ✅ Vérifier l'espace disque disponible
- ✅ Désactiver le bloqueur de popups
- ✅ Vérifier la connexion internet

### **❌ Fichier corrompu**
**Symptôme** : Le fichier Excel ne s'ouvre pas
**Solutions** :
- ✅ Vérifier la taille du fichier (> 0 bytes)
- ✅ Essayer avec un autre logiciel (LibreOffice, Google Sheets)
- ✅ Réessayer l'export

### **❌ Erreur 500 serveur**
**Symptôme** : Erreur interne du serveur
**Solutions** :
- ✅ Vérifier que le serveur backend fonctionne
- ✅ Contacter l'administrateur système
- ✅ Vérifier les logs du serveur
- ✅ Redémarrer l'application backend
- ✅ Vérifier les tables de base de données (GPS, dépenses)

---

## 🧪 **Tests de diagnostic :**

### **Test 1 : Vérifier l'authentification**
```javascript
// Dans la console du navigateur
console.log('Token:', localStorage.getItem('authToken'));
```

### **Test 2 : Vérifier l'API**
```javascript
// Dans la console du navigateur
fetch('/api/v1/auth/check', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
  }
}).then(r => r.json()).then(console.log);
```

### **Test 3 : Vérifier les données MATA**
```javascript
// Dans la console du navigateur
fetch('/api/v1/orders/mata-monthly-dashboard?month=2025-07', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
  }
}).then(r => r.json()).then(console.log);
```

---

## 📞 **Support technique :**

### **Informations à fournir :**
1. **Rôle utilisateur** : Manager/Admin/Livreur
2. **Mois sélectionné** : YYYY-MM
3. **Nombre de commandes** : Affiché dans les statistiques
4. **Erreur exacte** : Message d'erreur complet
5. **Console d'erreurs** : Screenshot des erreurs
6. **Navigateur** : Chrome/Firefox/Safari/Edge
7. **Version** : Version du navigateur

### **Logs à vérifier :**
- **Console navigateur** : Erreurs JavaScript
- **Réseau** : Requêtes API échouées
- **Application** : Logs côté serveur

---

## 🔄 **Solutions de contournement :**

### **Si l'export ne fonctionne pas :**
1. **Utiliser l'export mensuel général** (si disponible)
2. **Copier les données** du tableau manuellement
3. **Utiliser l'API directement** avec un outil comme Postman
4. **Contacter l'administrateur** pour un export manuel

### **Export manuel via API :**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -o mata_export.xlsx \
     "https://your-api.com/api/v1/orders/mata-monthly-export?month=2025-07"
```

---

## ✅ **Vérification finale :**

Après correction, vérifiez que :
- ✅ Vous êtes connecté en tant que Manager/Admin
- ✅ Il y a des données MATA pour le mois
- ✅ Le bouton "Export Excel" est visible
- ✅ Le clic déclenche le téléchargement
- ✅ Le fichier Excel s'ouvre correctement
- ✅ Les données sont complètes et correctes 