# Guide du Système de Suivi des Abonnements MLC

## Vue d'ensemble

J'ai créé un système complet de suivi des abonnements pour vos clients MLC qui permet de gérer des cartes d'abonnement avec 10 livraisons chacune.

## Fonctionnalités Principales

### 1. **Cartes d'Abonnement**
- Chaque carte contient 10 livraisons par défaut (configurable)
- Numéro unique au format `MLC-YYYY-NNNN` (ex: MLC-2024-0001)
- Date d'expiration (6 mois par défaut, configurable)
- Suivi automatique des livraisons utilisées/restantes

### 2. **Gestion des Clients**
- Association des cartes aux clients via nom et téléphone
- Historique complet des cartes par client
- Recherche rapide par nom, téléphone ou numéro de carte

### 3. **Intégration avec les Commandes MLC**
- Déduction automatique lors de la création d'une commande MLC
- Vérification de la validité de la carte avant utilisation
- Possibilité de spécifier une carte ou utilisation automatique

### 4. **Statistiques et Suivi**
- Nombre total de cartes actives/expirées/complétées
- Cartes expirant bientôt (alertes)
- Statistiques d'utilisation des livraisons

## Structure de la Base de Données

### Table `subscriptions`
```sql
- id (UUID) - Identifiant unique
- client_name (VARCHAR) - Nom du client
- phone_number (VARCHAR) - Téléphone du client
- card_number (VARCHAR) - Numéro de carte unique
- total_deliveries (INTEGER) - Nombre total de livraisons (défaut: 10)
- used_deliveries (INTEGER) - Livraisons utilisées
- remaining_deliveries (INTEGER) - Livraisons restantes
- purchase_date (TIMESTAMP) - Date d'achat
- expiry_date (TIMESTAMP) - Date d'expiration
- is_active (BOOLEAN) - Statut actif/inactif
- created_by (UUID) - Créateur de la carte
- created_at/updated_at (TIMESTAMP) - Dates de création/modification
```

## API Endpoints

### Gestion des Cartes
- `GET /api/v1/subscriptions` - Liste toutes les cartes
- `POST /api/v1/subscriptions` - Créer une nouvelle carte
- `GET /api/v1/subscriptions/:id` - Détails d'une carte
- `PUT /api/v1/subscriptions/:id` - Modifier une carte
- `PATCH /api/v1/subscriptions/:id/deactivate` - Désactiver une carte

### Recherche et Consultation
- `GET /api/v1/subscriptions/search?q=terme` - Rechercher des cartes
- `GET /api/v1/subscriptions/phone/:phoneNumber` - Cartes d'un client
- `GET /api/v1/subscriptions/card/:cardNumber` - Carte par numéro
- `GET /api/v1/subscriptions/check/:cardNumber` - Vérifier validité

### Utilisation
- `POST /api/v1/subscriptions/:id/use-delivery` - Utiliser une livraison
- `POST /api/v1/subscriptions/mlc-order` - Commande MLC avec déduction auto

### Statistiques
- `GET /api/v1/subscriptions/stats` - Statistiques générales
- `GET /api/v1/subscriptions/expiring-soon` - Cartes expirant bientôt

## Installation et Configuration

### 1. Créer la Table
```bash
# Exécuter le script SQL
psql -d votre_db -f create_subscriptions_table.sql
```

### 2. Démarrer le Serveur
```bash
cd backend
npm start
```

### 3. Tester l'API
```bash
# Créer une carte d'abonnement
curl -X POST http://localhost:4000/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "client_name": "Jean Dupont",
    "phone_number": "0123456789",
    "total_deliveries": 10,
    "expiry_months": 6
  }'
```

## Utilisation Recommandée

### 1. **Création d'une Carte**
Quand un client achète un abonnement :
```javascript
const subscription = await fetch('/api/v1/subscriptions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    client_name: 'Jean Dupont',
    phone_number: '0123456789',
    total_deliveries: 10,
    expiry_months: 6
  })
});
```

### 2. **Commande MLC avec Déduction**
Lors d'une livraison MLC :
```javascript
const order = await fetch('/api/v1/subscriptions/mlc-order', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    client_name: 'Jean Dupont',
    phone_number: '0123456789',
    address: 'Adresse de livraison',
    description: 'Description de la commande',
    course_price: 1500,
    card_number: 'MLC-2024-0001' // Optionnel
  })
});
```

### 3. **Vérification de Carte**
Avant une livraison :
```javascript
const check = await fetch('/api/v1/subscriptions/check/MLC-2024-0001');
const result = await check.json();

if (result.valid) {
  console.log(`Carte valide, ${result.subscription.remaining_deliveries} livraisons restantes`);
} else {
  console.log('Carte invalide ou expirée');
}
```

## Workflow Recommandé

### Pour les Livreurs
1. **Nouvelle Commande MLC** : Saisir les informations client
2. **Vérification Automatique** : Le système cherche une carte active
3. **Déduction** : Une livraison est automatiquement déduite
4. **Confirmation** : Affichage du nombre de livraisons restantes

### Pour les Managers
1. **Vente d'Abonnement** : Créer une nouvelle carte
2. **Suivi Client** : Consulter l'historique des cartes
3. **Gestion** : Désactiver/réactiver des cartes si nécessaire
4. **Statistiques** : Suivre les ventes et utilisations

### Pour les Administrateurs
1. **Vue d'ensemble** : Statistiques complètes
2. **Maintenance** : Gestion des cartes expirées
3. **Configuration** : Ajustement des paramètres par défaut

## Avantages du Système

### ✅ **Automatisation**
- Déduction automatique lors des commandes MLC
- Génération automatique des numéros de carte
- Gestion automatique des expirations

### ✅ **Traçabilité**
- Historique complet par client
- Suivi détaillé de chaque utilisation
- Audit trail complet

### ✅ **Flexibilité**
- Nombre de livraisons configurable
- Durée d'expiration ajustable
- Possibilité de désactiver/réactiver

### ✅ **Sécurité**
- Validation stricte des données
- Contrôle d'accès par rôle
- Vérifications de cohérence

## Prochaines Étapes

1. **Interface Frontend** : Créer les pages de gestion des abonnements
2. **Notifications** : Alertes pour les cartes expirant bientôt
3. **Rapports** : Génération de rapports détaillés
4. **Mobile** : Adaptation pour l'utilisation mobile

## Support et Maintenance

- **Logs** : Tous les événements sont loggés
- **Erreurs** : Gestion robuste des erreurs
- **Performance** : Index optimisés pour les requêtes fréquentes
- **Backup** : Sauvegarde automatique des données

Ce système vous permettra de gérer efficacement vos abonnements MLC tout en offrant une expérience fluide à vos clients et livreurs. 