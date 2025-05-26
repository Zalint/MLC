# Tableau de Bord Mensuel

## Description
Le tableau de bord mensuel est une nouvelle fonctionnalité destinée aux managers et administrateurs pour visualiser les performances mensuelles de l'équipe de livreurs.

## Fonctionnalités

### 📊 Statistiques Mensuelles
- **Nombre total de commandes** du mois
- **Montant total des courses** en FCFA
- **Total des dépenses** du mois
- **Nombre de livreurs actifs** ayant effectué au moins une commande

### 📅 Sélecteur de Mois
- Sélection du mois à afficher (mois actuel par défaut)
- Possibilité de consulter les mois précédents
- Interface intuitive avec sélecteur de mois HTML5

### 📋 Tableau Détaillé par Jour
Tableau complet présentant :
- **Dates du mois** (du 1er au dernier jour) en première colonne
- **Pour chaque livreur** : 7 colonnes détaillées
  - Nombre de commandes
  - Montant des courses (FCFA)
  - Carburant (FCFA)
  - Réparations (FCFA)
  - Police (FCFA)
  - Autres dépenses (FCFA)
  - Kilomètres parcourus
- **Ligne de totaux** en bas du tableau

### 🔒 Contrôle d'Accès
- Accessible uniquement aux **MANAGERS** et **ADMINS**
- Menu automatiquement masqué pour les livreurs
- Authentification requise

## Interface Utilisateur

### Navigation
Un nouveau menu "📈 Tableau de bord mensuel" apparaît dans la barre de navigation pour les utilisateurs autorisés.

### Affichage des Données
- **Cartes de statistiques** en haut de page avec icônes visuelles
- **Tableau détaillé** avec dates en lignes et livreurs en colonnes
- **Export Excel** complet avec toutes les données
- **Gestion des données vides** : affichage de "0" si aucune donnée
- **Actualisation** via bouton dédié

### Responsive Design
- Interface adaptée aux différentes tailles d'écran
- Tableaux avec défilement horizontal si nécessaire
- Boutons et contrôles optimisés pour mobile

## Architecture Technique

### Backend
- **Routes** : 
  - `GET /api/v1/orders/monthly-summary?month=YYYY-MM` - Données du tableau
  - `GET /api/v1/orders/monthly-export?month=YYYY-MM` - Export Excel
- **Contrôleur** : 
  - `OrderController.getMonthlyOrdersSummary()` - Données détaillées
  - `OrderController.exportMonthlyToExcel()` - Export Excel
- **Modèles** : 
  - `Order.getMonthlyDetailsByDay()` - Commandes par jour
  - `Expense.getMonthlyExpensesByDay()` - Dépenses par jour

### Frontend
- **Classe** : `MonthlyDashboardManager`
- **Page** : `monthly-dashboard-page`
- **Navigation** : `nav-monthly-dashboard`

### Base de Données
Utilise des requêtes SQL avancées avec :
- `DATE_TRUNC('month', ...)` pour grouper par mois
- `generate_series()` pour créer toutes les dates du mois
- `CROSS JOIN` pour avoir une ligne par livreur/jour
- `LEFT JOIN` pour récupérer les données existantes

## Utilisation

1. **Connexion** en tant que Manager ou Admin
2. **Cliquer** sur "Tableau de bord mensuel" dans le menu
3. **Sélectionner** le mois souhaité (optionnel)
4. **Consulter** les statistiques et le tableau détaillé
5. **Exporter en Excel** pour analyse approfondie
6. **Actualiser** les données si nécessaire

## Évolutions Futures

### Détails Mensuels par Livreur
- Vue détaillée jour par jour pour un livreur
- Graphiques de performance
- Export Excel mensuel

### Graphiques et Visualisations
- Graphiques en barres pour les performances
- Évolution temporelle des métriques
- Comparaisons mois par mois

### Filtres Avancés
- Filtrage par type de commande
- Filtrage par livreur spécifique
- Plages de dates personnalisées

## Notes Techniques

### Gestion des Données Vides
- Affichage de "0" pour les métriques sans données
- Message informatif si aucun livreur n'a de commandes
- Gestion gracieuse des erreurs de chargement

### Performance
- Requêtes optimisées avec agrégations SQL
- Chargement asynchrone des données
- Cache côté client pour éviter les rechargements inutiles

### Sécurité
- Validation des permissions côté backend
- Sanitisation des entrées utilisateur
- Protection contre les injections SQL

## Installation et Configuration

Aucune configuration supplémentaire requise. La fonctionnalité est automatiquement disponible après :
1. Mise à jour du code backend et frontend
2. Redémarrage des serveurs
3. Connexion avec un compte Manager/Admin

## Support

Pour toute question ou problème :
- Vérifier les logs du serveur backend
- Consulter la console du navigateur pour les erreurs frontend
- S'assurer que l'utilisateur a les bonnes permissions 