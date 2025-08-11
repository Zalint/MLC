# 🧪 Guide de Test - Fonctionnalité Contacts (Mode Mock)

## 📋 Vue d'ensemble

Ce guide explique comment tester la fonctionnalité de sélection de contacts et de pré-remplissage automatique en mode test (mock), sans dépendre de l'API Contacts du navigateur.

## 🎯 Objectifs du test

1. **Tester le sélecteur de contacts** : Vérifier que le modal s'ouvre correctement
2. **Tester la recherche** : Vérifier la recherche dans les contacts et la base de données
3. **Tester le pré-remplissage** : Vérifier que les champs se remplissent automatiquement
4. **Tester le flux complet** : Vérifier l'intégration de bout en bout

## 🚀 Démarrage rapide

### Étape 1 : Ajouter les clients de test

Exécutez le script SQL pour ajouter des clients de test dans la base de données :

```sql
-- Exécuter le fichier add_test_clients.sql
```

### Étape 2 : Accéder à la page de test

Ouvrez votre navigateur et allez à :
```
http://localhost:3000/test_contacts_complete.html
```

### Étape 3 : Tester les fonctionnalités

Utilisez les boutons de test automatique ou suivez le guide manuel ci-dessous.

## 📱 Tests manuels détaillés

### Test 1 : Sélecteur de contacts

1. **Ouvrir le formulaire** : Allez dans "Nouvelle commande"
2. **Cliquer sur le bouton 📱** : À côté du champ "Nom du client"
3. **Vérifier** : Le modal doit s'ouvrir avec deux sections :
   - 📱 Contacts du téléphone (Mode Test)
   - 💾 Clients existants

**Résultat attendu** : ✅ Modal ouvert avec succès

### Test 2 : Chargement des contacts

1. **Dans le modal**, cliquer sur "Charger les contacts (Test)"
2. **Vérifier** : La liste des contacts de test doit s'afficher :
   - Jean Dupont (773920001)
   - Marie Martin (773920002)
   - Pierre Durand (773920003)
   - etc.

**Résultat attendu** : ✅ 8 contacts de test affichés

### Test 3 : Recherche dans les contacts

1. **Dans le champ de recherche** des contacts, taper "Jean"
2. **Vérifier** : Seul "Jean Dupont" doit apparaître
3. **Tester avec un numéro** : Taper "773920002"
4. **Vérifier** : Seule "Marie Martin" doit apparaître

**Résultat attendu** : ✅ Recherche fonctionnelle

### Test 4 : Recherche dans la base de données

1. **Dans le champ de recherche** des clients, taper "Test"
2. **Vérifier** : Tous les clients de test doivent apparaître
3. **Tester avec un nom spécifique** : Taper "Marie"
4. **Vérifier** : Seule "Marie Martin (Test)" doit apparaître

**Résultat attendu** : ✅ Recherche en base fonctionnelle

### Test 5 : Sélection d'un contact

1. **Cliquer sur "Sélectionner"** à côté de "Jean Dupont"
2. **Vérifier** : 
   - Le modal se ferme
   - Le nom "Jean Dupont" est rempli dans le formulaire
   - Le téléphone "773920001" est rempli

**Résultat attendu** : ✅ Contact sélectionné et formulaire rempli

### Test 6 : Pré-remplissage automatique

1. **Sélectionner le type de commande** : "MATA"
2. **Vérifier** : Les champs appropriés s'affichent
3. **Sélectionner un contact** qui existe en base (ex: Jean Dupont)
4. **Vérifier** : Les champs se pré-remplissent automatiquement :
   - Adresse destination : "Sicap Liberté 2, Dakar"
   - Point de vente : "O.Foire"
   - Adresse : "123 Rue de la Paix, Dakar"

**Résultat attendu** : ✅ Pré-remplissage automatique fonctionnel

### Test 7 : Test avec différents types de commande

#### Test MATA :
1. Sélectionner "MATA"
2. Sélectionner "Jean Dupont (Test)"
3. **Vérifier** : Adresse destination et point de vente pré-remplis

#### Test MLC :
1. Sélectionner "MLC"
2. Sélectionner "Marie Martin (Test)"
3. **Vérifier** : Adresse source et destination pré-remplies

#### Test AUTRE :
1. Sélectionner "AUTRE"
2. Sélectionner "Pierre Durand (Test)"
3. **Vérifier** : Adresse source et destination pré-remplies

**Résultat attendu** : ✅ Pré-remplissage adapté au type de commande

### Test 8 : Recherche automatique par téléphone

1. **Taper directement un numéro** : "773920001"
2. **Cliquer en dehors du champ** (événement blur)
3. **Vérifier** : Le pré-remplissage se déclenche automatiquement

**Résultat attendu** : ✅ Recherche automatique fonctionnelle

## 🔧 Tests automatiques

La page de test inclut des boutons pour automatiser les tests :

### Bouton "📱 Tester le sélecteur de contacts"
- Ouvre le modal de sélection
- Vérifie que l'interface s'affiche correctement

### Bouton "🔄 Tester le pré-remplissage automatique"
- Remplit un numéro de test
- Déclenche le pré-remplissage
- Vérifie les résultats

### Bouton "✅ Test complet du flux"
- Exécute un scénario complet :
  1. Sélection du type de commande
  2. Ouverture du sélecteur
  3. Chargement des contacts
  4. Sélection d'un contact
  5. Vérification du pré-remplissage

### Bouton "🔄 Réinitialiser le formulaire"
- Vide tous les champs
- Remet l'interface dans son état initial

## 📊 Logs de débogage

La page affiche des logs en temps réel dans la section "📊 Logs de débogage" :

- **Messages d'initialisation** : Chargement de la page
- **Actions utilisateur** : Clics, saisies, sélections
- **Résultats des opérations** : Succès, erreurs, avertissements
- **Données de test** : Contacts chargés, recherches effectuées

## 🐛 Dépannage

### Problème : Le modal ne s'ouvre pas
**Solution** : Vérifier la console du navigateur pour les erreurs JavaScript

### Problème : Les contacts ne se chargent pas
**Solution** : Vérifier que le mode mock est activé (`mockMode = true`)

### Problème : Le pré-remplissage ne fonctionne pas
**Solution** : Vérifier que les clients de test sont dans la base de données

### Problème : La recherche ne fonctionne pas
**Solution** : Vérifier que les données mock sont correctement définies

## 📝 Données de test

### Contacts mock (simulation téléphone) :
- Jean Dupont (773920001)
- Marie Martin (773920002)
- Pierre Durand (773920003)
- Sophie Bernard (773920004)
- Michel Petit (773920005)
- Claire Moreau (773920006)
- André Leroy (773920007)
- Isabelle Roux (773920008)

### Clients mock (base de données) :
- Jean Dupont (Test) - MATA - O.Foire
- Marie Martin (Test) - MLC - Point E
- Pierre Durand (Test) - AUTRE - Plateau
- Sophie Bernard (Test) - MATA - Sacre Coeur
- Michel Petit (Test) - MLC - UCAD
- Claire Moreau (Test) - AUTRE - Yoff
- André Leroy (Test) - MATA - Mbao
- Isabelle Roux (Test) - MLC - Gueule Tapée

## ✅ Critères de succès

Le test est réussi si :

1. ✅ Le modal de sélection s'ouvre correctement
2. ✅ Les contacts de test se chargent
3. ✅ La recherche fonctionne dans les deux sections
4. ✅ La sélection d'un contact remplit le formulaire
5. ✅ Le pré-remplissage automatique fonctionne selon le type de commande
6. ✅ La recherche automatique par téléphone fonctionne
7. ✅ Aucune erreur JavaScript dans la console
8. ✅ L'interface est responsive et utilisable

## 🔄 Intégration avec l'application principale

Une fois les tests validés, la fonctionnalité peut être activée dans l'application principale :

1. **Désactiver le mode mock** : `ContactManager.mockMode = false`
2. **Tester avec l'API Contacts réelle** sur un navigateur compatible
3. **Vérifier la compatibilité** sur différents appareils

## 📱 Compatibilité navigateur

### API Contacts supportée :
- Chrome Mobile (Android)
- Safari Mobile (iOS 13+)
- Edge Mobile

### Fallback automatique :
- Si l'API n'est pas disponible → Mode mock activé
- Si l'accès est refusé → Mode mock activé
- Si erreur → Mode mock activé

## 🎯 Prochaines étapes

1. **Tester sur mobile** : Vérifier la compatibilité tactile
2. **Optimiser les performances** : Réduire les temps de chargement
3. **Ajouter des animations** : Améliorer l'expérience utilisateur
4. **Tests de charge** : Vérifier avec de nombreux contacts
5. **Tests d'accessibilité** : Vérifier la compatibilité lecteurs d'écran 