# 📊 Guide d'Export Excel - Détail des commandes MATA

## 🎯 Fonctionnalité

Le bouton **"Export Excel"** permet d'exporter toutes les commandes MATA d'un mois donné au format Excel (.xlsx) avec toutes les informations détaillées.

## 📍 Localisation

Le bouton se trouve dans la page **"Tableau MATA mensuel"** :
- **Menu** → **Tableau MATA mensuel**
- **Section** : "Détail des commandes MATA"
- **Position** : En haut à droite du tableau

## 🔧 Utilisation

### 1. Accès à la fonctionnalité
1. Se connecter en tant que **Manager** ou **Admin**
2. Aller dans **"Tableau MATA mensuel"**
3. Sélectionner le mois souhaité (optionnel)
4. Le bouton **"Export Excel"** apparaît automatiquement s'il y a des données

### 2. Export des données
1. **Cliquer** sur le bouton **"Export Excel"**
2. Le navigateur télécharge automatiquement le fichier
3. **Nom du fichier** : `mata_mensuel_YYYY-MM.xlsx`

## 📋 Contenu du fichier Excel

### 📊 En-têtes du tableau
| Colonne | Description |
|---------|-------------|
| **Date** | Date de la commande (format DD/MM/YYYY) |
| **Numéro de téléphone** | Contact du client |
| **Nom** | Nom du client |
| **Adresse source** | Adresse de départ |
| **Adresse destination** | Adresse de livraison |
| **Point de vente** | Point de vente MATA |
| **Montant commande (FCFA)** | Montant du panier |
| **Livreur** | Nom du livreur |
| **Commentaire** | Commentaires ajoutés |
| **Service livraison** | Note sur 10 (ou NA) |
| **Qualité produits** | Note sur 10 (ou NA) |
| **Niveau prix** | Note sur 10 (ou NA) |
| **Note moyenne** | Moyenne des 3 notes (ou NA) |

### 🎨 Formatage du fichier
- **Titre** : "Tableau de Bord Mensuel MATA - YYYY-MM"
- **En-têtes** : Fond vert (#009E60), texte blanc
- **Bordures** : Toutes les cellules ont des bordures
- **Largeurs** : Colonnes optimisées pour la lisibilité
- **Ligne de total** : Fond jaune avec le total des montants

## 🔐 Permissions

### ✅ Accès autorisé
- **Managers** : Export de toutes les commandes MATA
- **Admins** : Export de toutes les commandes MATA

### ❌ Accès restreint
- **Livreurs** : Export uniquement de leurs propres commandes MATA
- **Utilisateurs non connectés** : Pas d'accès

## 🚀 Fonctionnalités avancées

### 📅 Filtrage par mois
- Le fichier exporté correspond au mois sélectionné
- **Format** : YYYY-MM (ex: 2025-01 pour janvier 2025)
- **Défaut** : Mois actuel si aucun mois sélectionné

### 📊 Calculs automatiques
- **Note moyenne** : Calculée automatiquement (moyenne des 3 notes)
- **Total des montants** : Somme de toutes les commandes du mois
- **Nombre de commandes** : Comptage automatique

### 🎯 Gestion des données manquantes
- **Notes** : Affichées "NA" si non renseignées
- **Adresses** : Affichées vides si non renseignées
- **Commentaires** : Affichés vides si non renseignés

## 🔧 Dépannage

### ❌ Bouton non visible
**Problème** : Le bouton "Export Excel" n'apparaît pas
**Solutions** :
1. Vérifier que vous êtes connecté en tant que Manager/Admin
2. Vérifier qu'il y a des commandes MATA pour le mois sélectionné
3. Recharger la page

### ❌ Erreur de téléchargement
**Problème** : Le fichier ne se télécharge pas
**Solutions** :
1. Vérifier la connexion internet
2. Désactiver le bloqueur de popups
3. Vérifier l'espace disque disponible

### ❌ Fichier corrompu
**Problème** : Le fichier Excel ne s'ouvre pas
**Solutions** :
1. Vérifier que le fichier est complet (taille > 0)
2. Essayer d'ouvrir avec un autre logiciel
3. Réessayer l'export

## 📱 Compatibilité

### 💻 Logiciels compatibles
- **Microsoft Excel** (2016, 2019, 365)
- **LibreOffice Calc**
- **Google Sheets** (import)
- **Numbers** (Mac)

### 🌐 Navigateurs supportés
- **Chrome** (recommandé)
- **Firefox**
- **Safari**
- **Edge**

## 🎯 Cas d'usage

### 📈 Reporting mensuel
- Export des données pour analyse
- Partage avec la direction
- Archivage des données

### 📊 Analyse des performances
- Suivi des notes de satisfaction
- Analyse des points de vente
- Évaluation des livreurs

### 💰 Suivi financier
- Calcul des revenus MATA
- Analyse des montants de paniers
- Reporting comptable

## 🔄 Mise à jour

### 📅 Fréquence
- **Données** : Mises à jour en temps réel
- **Fonctionnalité** : Pas de mise à jour nécessaire
- **Format** : Compatible avec les versions récentes d'Excel

### 🆕 Évolutions futures
- Export avec graphiques intégrés
- Filtres avancés (par livreur, point de vente)
- Export automatique programmé
- Intégration avec d'autres outils

---

## 📞 Support

En cas de problème avec l'export Excel :
1. Vérifier ce guide
2. Tester avec un autre navigateur
3. Contacter l'administrateur système 