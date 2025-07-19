# 📊 Guide d'Export Excel - Récapitulatif par livreur

## 🎯 Fonctionnalité

Le bouton **"Export Excel"** permet d'exporter le récapitulatif mensuel par livreur au format Excel (.xlsx) avec toutes les informations détaillées : commandes, courses, dépenses, kilométrage et bénéfices.

## 📍 Localisation

Le bouton se trouve dans la page **"Tableau de bord mensuel"** :
- **Menu** → **Tableau de bord mensuel**
- **Section** : "Récapitulatif par livreur"
- **Position** : En haut à droite de la section

## 🔧 Utilisation

### 1. Accès à la fonctionnalité
1. Se connecter en tant que **Manager** ou **Admin**
2. Aller dans **"Tableau de bord mensuel"**
3. Sélectionner le mois souhaité (optionnel)
4. Le bouton **"Export Excel"** apparaît automatiquement

### 2. Export des données
1. **Cliquer** sur le bouton **"Export Excel"**
2. Le navigateur télécharge automatiquement le fichier
3. **Nom du fichier** : `recapitulatif_livreurs_YYYY-MM.xlsx`

## 📋 Contenu du fichier Excel

### **Colonnes incluses :**
- **Date** : Date de la journée (format DD/MM)
- **Livreur** : Nom du livreur
- **Commandes** : Nombre de commandes du jour
- **Courses (FCFA)** : Montant total des courses
- **Carburant (FCFA)** : Dépenses carburant
- **Réparations (FCFA)** : Dépenses réparations
- **Police (FCFA)** : Dépenses police
- **Autres (FCFA)** : Autres dépenses
- **Total Dépenses (FCFA)** : Somme de toutes les dépenses
- **Km Parcourus** : Kilométrage déclaré
- **GPS Km** : Kilométrage calculé par GPS
- **Bénéfice (FCFA)** : Courses - Dépenses

### **Formatage spécial :**
- **En-têtes** : Fond vert (#009E60), texte blanc, gras
- **Bénéfices positifs** : Fond vert clair, texte vert foncé
- **Bénéfices négatifs** : Fond rouge clair, texte rouge foncé
- **Lignes de total** : Fond jaune, texte gras
- **Bordures** : Toutes les cellules ont des bordures fines

### **Structure des données :**
1. **Données journalières** : Une ligne par livreur par jour
2. **Totaux par livreur** : Ligne de total pour chaque livreur
3. **Calculs automatiques** : Bénéfices et totaux calculés automatiquement

## 🔐 Permissions

- **Accès** : Managers et Admins uniquement
- **Authentification** : Token JWT requis
- **Erreur 403** : Si l'utilisateur n'a pas les permissions

## 🛠️ Dépannage

### **Erreur "Token d'authentification manquant"**
- ✅ Vérifier que vous êtes connecté
- ✅ Reconnectez-vous si nécessaire
- ✅ Vérifier que vous avez le rôle Manager ou Admin

### **Erreur "Accès refusé"**
- ✅ Seuls les Managers et Admins peuvent exporter
- ✅ Vérifier votre rôle dans le profil

### **Fichier vide ou données manquantes**
- ✅ Vérifier qu'il y a des données pour le mois sélectionné
- ✅ Essayer un autre mois
- ✅ Vérifier que les livreurs ont des commandes/dépenses

### **Erreur de téléchargement**
- ✅ Vérifier les paramètres de téléchargement du navigateur
- ✅ Désactiver temporairement les bloqueurs de publicités
- ✅ Essayer un autre navigateur

## 📊 Exemple de données exportées

```
Date    | Livreur | Cmd | Courses | Carburant | Réparations | Police | Autres | Total Dép. | Km | GPS Km | Bénéfice
--------|---------|-----|---------|-----------|-------------|--------|--------|-----------|----|--------|----------
01/01   | Saliou  | 5   | 15000   | 2000      | 0           | 0      | 500    | 2500      | 45 | 42.5   | 12500
01/01   | Moussa  | 3   | 9000    | 1500      | 0           | 0      | 200    | 1700      | 30 | 28.3   | 7300
TOTAL   | Saliou  | 25  | 75000   | 10000     | 500         | 0      | 2500   | 13000     | 225| 212.5  | 62000
TOTAL   | Moussa  | 18  | 54000   | 7500      | 0           | 0      | 1000   | 8500      | 150| 141.5  | 45500
```

## 🔄 Mise à jour

- **Données en temps réel** : L'export utilise les données actuelles
- **Rechargement** : Cliquer sur "Actualiser" avant l'export si nécessaire
- **Cache** : Les données sont mises à jour automatiquement

## 📞 Support

En cas de problème :
1. Vérifier la console du navigateur (F12)
2. Vérifier les logs du serveur
3. Contacter l'administrateur système 