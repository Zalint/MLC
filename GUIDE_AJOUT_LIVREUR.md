# 🚚 Guide : Ajout de Livreur par les Managers

## 📋 Vue d'ensemble

La fonctionnalité d'ajout de livreur permet aux **MANAGERS** et **ADMINISTRATEURS** de créer de nouveaux comptes livreurs avec nom d'utilisateur et mot de passe. Cette fonctionnalité est **déjà implémentée** et fonctionnelle dans l'application.

## 🔐 Prérequis

### Connexion requise
- Vous devez être connecté avec un compte **MANAGER** ou **ADMIN**
- Les livreurs ordinaires n'ont pas accès à cette fonctionnalité

### Comptes managers par défaut
```
SALIOU    - Manager123!
OUSMANE   - Manager123!
DIDI      - Manager123!
AMARY     - Manager123!
Password123
```

## 📍 Comment accéder à la fonctionnalité

### Étape 1 : Connexion
1. Ouvrez l'application : `http://localhost:3000`
2. Connectez-vous avec un compte manager
3. Vérifiez que votre rôle s'affiche comme "MANAGER" dans l'en-tête

### Étape 2 : Navigation
1. Dans la barre de navigation, cliquez sur **"🚚 Gestion livreurs"**
2. Vous arrivez sur la page de gestion des livreurs

### Étape 3 : Ajout d'un nouveau livreur
1. Cliquez sur le bouton **"➕ Nouveau livreur"** (en haut à droite)
2. Une modal s'ouvre avec le formulaire de création

## 📝 Formulaire de création

### Champs requis
- **Nom d'utilisateur** : Identifiant unique pour le livreur
- **Mot de passe** : Mot de passe sécurisé (minimum 8 caractères)
- **Statut** : Actif ou Inactif (par défaut : Actif)

### Validation du mot de passe
Le mot de passe doit contenir :
- Au moins 8 caractères
- Une lettre minuscule
- Une lettre majuscule  
- Un chiffre
- Un caractère spécial (@$!%*?&)

### Exemple de mot de passe valide
```
Livreur123!
MonMotDePasse2024@
Secure$Pass1
```

## 🔧 Fonctionnalités disponibles

### Création
- ✅ Nom d'utilisateur et mot de passe
- ✅ Validation sécurisée
- ✅ Statut configurable (Actif/Inactif)
- ✅ Rôle automatiquement assigné à "LIVREUR"

### Gestion
- ✅ Modification du nom d'utilisateur
- ✅ Activation/Désactivation
- ✅ Suppression (ADMIN uniquement)
- ✅ Visualisation de la liste complète

### Sécurité
- ✅ Mot de passe hashé avec bcrypt (12 rounds)
- ✅ Validation côté client et serveur
- ✅ Vérification d'unicité du nom d'utilisateur
- ✅ Contrôle des permissions par rôle

## 🎯 Processus complet

### 1. Préparation
```bash
# Démarrer les serveurs
npm start
```

### 2. Connexion Manager
```
URL: http://localhost:3000
Utilisateur: SALIOU
Mot de passe: Manager123!
```

### 3. Navigation vers Gestion Livreurs
- Cliquer sur "🚚 Gestion livreurs" dans la navigation
- Vérifier que le bouton "➕ Nouveau livreur" est visible

### 4. Création du livreur
```
Nom d'utilisateur: NouveauLivreur
Mot de passe: Livreur123!
Statut: Actif
```

### 5. Confirmation
- Message de succès affiché
- Livreur ajouté à la liste
- Le nouveau livreur peut se connecter immédiatement

## 🚨 Résolution des problèmes

### Le bouton "Nouveau livreur" n'apparaît pas
**Causes possibles :**
1. Vous n'êtes pas connecté en tant que MANAGER/ADMIN
2. Les serveurs ne sont pas démarrés
3. Problème de permissions

**Solutions :**
1. Vérifiez votre rôle dans l'en-tête (doit afficher "MANAGER" ou "ADMIN")
2. Redémarrez les serveurs : `npm start`
3. Reconnectez-vous avec un compte manager

### Erreur lors de la création
**Causes possibles :**
1. Nom d'utilisateur déjà existant
2. Mot de passe non conforme
3. Problème de connexion au backend

**Solutions :**
1. Choisissez un nom d'utilisateur unique
2. Respectez les critères du mot de passe
3. Vérifiez que le backend fonctionne (port 4000)

### Page livreurs inaccessible
**Causes possibles :**
1. Navigation masquée pour les livreurs
2. Problème de chargement de la page

**Solutions :**
1. Connectez-vous avec un compte manager
2. Actualisez la page (F5)

## 📊 Architecture technique

### Backend
```
Route: POST /api/v1/users
Contrôleur: UserController.createUser()
Middleware: requireManagerOrAdmin, validateUserCreation
Validation: Nom unique, mot de passe fort, rôle valide
```

### Frontend
```
Classe: LivreurManager.createLivreur()
Modal: Formulaire de création
API: ApiClient.createUser()
Validation: Côté client + serveur
```

### Base de données
```sql
INSERT INTO users (username, password_hash, role, is_active)
VALUES ('NouveauLivreur', '$2b$12$...', 'LIVREUR', true);
```

## 📱 Interface utilisateur

### Navigation
```
Header: Matix Livreur | SALIOU MANAGER 🚪
Nav: [📊 Tableau de bord] [🚚 Gestion livreurs] [👥 Utilisateurs]
```

### Page Gestion Livreurs
```
Titre: Gestion des livreurs
Actions: [➕ Nouveau livreur] [👁️ Voir tous] [✅ Actifs seulement]
Liste: Tableau avec nom, statut, actions (Modifier, Activer/Désactiver)
```

### Modal de création
```
Titre: Nouveau livreur
Champs: Nom d'utilisateur*, Mot de passe*, Statut
Boutons: [Créer le livreur] [Annuler]
```

## ✅ Test de la fonctionnalité

### Test rapide
1. Ouvrez `test_add_livreur.html` dans votre navigateur
2. Remplissez le formulaire avec des données valides
3. Cliquez sur "Créer le Livreur"
4. Vérifiez le message de succès

### Test complet
1. Démarrez l'application complète
2. Connectez-vous en tant que manager
3. Naviguez vers Gestion livreurs
4. Créez un nouveau livreur
5. Déconnectez-vous et connectez-vous avec le nouveau compte

## 📞 Support

Si vous rencontrez des problèmes :
1. Vérifiez que les serveurs sont démarrés
2. Consultez la console du navigateur (F12)
3. Vérifiez les logs du serveur backend
4. Assurez-vous d'être connecté avec les bonnes permissions

---

**Note :** Cette fonctionnalité est entièrement opérationnelle et sécurisée. Elle respecte les meilleures pratiques de sécurité avec hashage des mots de passe et validation stricte des données. 