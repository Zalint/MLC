# 📱 Guide d'utilisation - Fonctionnalité Contacts

## Vue d'ensemble

La fonctionnalité d'accès aux contacts permet aux livreurs d'accéder à leurs contacts téléphoniques et à la base de données clients pour faciliter la saisie de commandes.

## 🎯 Fonctionnalités

### 1. Accès aux contacts du téléphone
- **Bouton contacts** : Un bouton 📱 à côté du champ "Nom du client"
- **Sélection de contact** : Choisir un contact depuis la liste du téléphone
- **Remplissage automatique** : Le nom et le téléphone sont automatiquement remplis

### 2. Recherche dans la base de données
- **Recherche de clients** : Trouver des clients existants par nom ou téléphone
- **Historique des commandes** : Voir le nombre de commandes et la dernière date
- **Pré-remplissage intelligent** : Remplir automatiquement les adresses selon le type de commande

### 3. Pré-remplissage automatique
- **Par numéro de téléphone** : Saisir un numéro → recherche automatique des informations
- **Selon le type de commande** :
  - **MATA** : Adresse destination + Point de vente
  - **MLC/AUTRE** : Adresse source + Adresse destination
- **Exclusions** : Montant du panier et point de vente restent à saisir manuellement

## 📋 Utilisation étape par étape

### Méthode 1 : Sélection depuis les contacts

1. **Ouvrir le formulaire de nouvelle commande**
2. **Cliquer sur le bouton 📱** à côté du champ "Nom du client"
3. **Autoriser l'accès aux contacts** (première utilisation)
4. **Rechercher un contact** dans la liste
5. **Sélectionner le contact** → remplissage automatique
6. **Vérifier les informations pré-remplies**

### Méthode 2 : Recherche dans la base

1. **Ouvrir le sélecteur de contacts** (bouton 📱)
2. **Utiliser la section "Clients existants"**
3. **Saisir un nom ou numéro de téléphone**
4. **Sélectionner le client** → remplissage automatique

### Méthode 3 : Saisie directe du téléphone

1. **Saisir directement le numéro de téléphone**
2. **Quitter le champ** (perte de focus)
3. **Recherche automatique** des informations client
4. **Pré-remplissage** si le client existe

## 🔧 Configuration requise

### Navigateur compatible
- **Mobile** : Chrome Android, Safari iOS (version récente)
- **Desktop** : Fonctionnalité limitée (pas d'accès aux contacts)

### Autorisations nécessaires
- **Contacts** : Autorisation d'accès aux contacts du téléphone
- **Réseau** : Connexion internet pour la recherche en base

## 📊 Types de commandes et pré-remplissage

### Commande MATA
- ✅ **Rempli automatiquement** :
  - Nom du client
  - Numéro de téléphone
  - Adresse destination
  - Point de vente
- ❌ **À saisir manuellement** :
  - Montant du panier

### Commande MLC/AUTRE
- ✅ **Rempli automatiquement** :
  - Nom du client
  - Numéro de téléphone
  - Adresse source
  - Adresse destination
- ❌ **À saisir manuellement** :
  - Prix de la course (selon zone)

## 🚨 Limitations et notes importantes

### API Contacts
- **Disponibilité** : Variable selon le navigateur
- **Autorisation** : Nécessaire à chaque utilisation
- **Fallback** : Recherche en base si contacts non disponibles

### Base de données
- **Recherche** : Minimum 2 caractères requis
- **Limite** : 10 résultats maximum par recherche
- **Historique** : Basé sur les commandes existantes

### Pré-remplissage
- **Conditionnel** : Seulement si le client existe en base
- **Type de commande** : Adapté selon MATA/MLC/AUTRE
- **Sécurité** : Pas de modification des données existantes

## 🛠️ Dépannage

### Problème : "API Contacts non disponible"
**Solution** : Utiliser la recherche en base de données uniquement

### Problème : "Aucun contact trouvé"
**Solutions** :
- Vérifier l'autorisation d'accès aux contacts
- Utiliser la recherche en base
- Saisir manuellement les informations

### Problème : "Client non trouvé en base"
**Solutions** :
- Créer une nouvelle commande
- Vérifier l'orthographe du nom/numéro
- Utiliser les contacts du téléphone

### Problème : Pré-remplissage incomplet
**Solutions** :
- Vérifier que le type de commande est sélectionné
- Saisir manuellement les champs manquants
- Vérifier les données en base

## 📱 Test de la fonctionnalité

### Page de test
Ouvrir `test_contacts_feature.html` pour tester :
- ✅ Disponibilité de l'API Contacts
- ✅ Recherche de clients
- ✅ Recherche par téléphone
- ✅ Interface du formulaire

### Tests recommandés
1. **Test API Contacts** : Vérifier la compatibilité
2. **Test recherche** : Essayer différents termes
3. **Test pré-remplissage** : Vérifier l'auto-complétion
4. **Test formulaire** : Utiliser le bouton contacts

## 🔄 Mise à jour et maintenance

### Ajout de nouveaux clients
- Les nouveaux clients sont automatiquement disponibles
- Pas de configuration supplémentaire requise

### Amélioration des données
- Les informations se mettent à jour automatiquement
- Basé sur les dernières commandes du client

### Compatibilité
- Fonctionne avec les versions existantes
- Pas d'impact sur les autres fonctionnalités

## 📞 Support

En cas de problème :
1. Vérifier la compatibilité du navigateur
2. Tester avec la page de test
3. Consulter les logs de la console
4. Contacter l'équipe technique si nécessaire

---

**Note** : Cette fonctionnalité améliore significativement l'expérience utilisateur en réduisant le temps de saisie et en minimisant les erreurs de saisie. 