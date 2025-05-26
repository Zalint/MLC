# Tableau de Bord MATA Mensuel

## Description
Le tableau de bord MATA mensuel est une nouvelle fonctionnalité spécialement conçue pour les managers afin de visualiser et gérer toutes les commandes MATA d'un mois donné avec des informations détaillées et des commentaires éditables.

## Fonctionnalités

### 📊 Statistiques Mensuelles MATA
- **Nombre total de commandes MATA** du mois
- **Montant total des commandes** (pas des courses) en FCFA
- **Nombre de livreurs actifs** ayant effectué au moins une commande MATA

### 📅 Sélecteur de Mois
- Sélection du mois à afficher (mois actuel par défaut)
- Possibilité de consulter les mois précédents
- Interface intuitive avec sélecteur de mois HTML5

### 📋 Tableau Détaillé des Commandes MATA
Tableau complet présentant toutes les commandes MATA du mois avec les colonnes suivantes :
- **Date** : Date de la commande (du 1er au dernier jour du mois)
- **Numéro de téléphone** : Contact du client
- **Nom** : Nom du client
- **Adresse** : Adresse de livraison
- **Montant commande (FCFA)** : Montant du panier (pas le prix de la course)
- **Livreur** : Nom du livreur qui a pris la commande
- **Commentaire** : Colonne éditable pour ajouter des notes
- **Actions** : Boutons pour modifier les commentaires

### ✏️ Commentaires Éditables
- **Modification en ligne** : Clic sur "Modifier" pour éditer un commentaire
- **Sauvegarde instantanée** : Bouton "Sauver" pour enregistrer les modifications
- **Annulation** : Bouton "Annuler" pour revenir à l'état précédent
- **Interface intuitive** : Passage automatique entre mode lecture et édition

## Utilisation

1. **Connexion** en tant que Manager ou Admin
2. **Cliquer** sur "Tableau MATA mensuel" dans le menu
3. **Sélectionner** le mois souhaité (optionnel)
4. **Consulter** les statistiques et le tableau détaillé
5. **Modifier les commentaires** :
   - Cliquer sur "Modifier" dans la colonne Actions
   - Saisir ou modifier le commentaire
   - Cliquer sur "Sauver" ou "Annuler"
6. **Exporter en Excel** pour analyse approfondie
7. **Actualiser** les données si nécessaire

## Architecture Technique

### Backend
- **Routes** : 
  - `GET /api/v1/orders/mata-monthly-dashboard?month=YYYY-MM`
  - `GET /api/v1/orders/mata-monthly-export?month=YYYY-MM`
  - `PUT /api/v1/orders/:id/comment`
- **Contrôleur** : `OrderController` avec nouvelles méthodes MATA
- **Validation** : Commentaires limités à 1000 caractères

### Frontend
- **Classe** : `MataMonthlyDashboardManager`
- **Page** : `mata-monthly-dashboard-page`
- **Navigation** : Accessible aux managers/admins uniquement

### Base de Données
- **Nouvelle colonne** : `commentaire TEXT` dans la table `orders`
- **Requêtes optimisées** : Filtrage par `order_type = 'MATA'` 