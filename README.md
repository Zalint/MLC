# Matix Livreur - Système de Prise de Commandes

Système de prise de commandes/livraisons simple, sécurisé et accessible depuis un smartphone.

## Architecture

- **Front-End Server** : Node.js + Express (port 3000) - Fichiers statiques
- **Back-End API Server** : Node.js + Express (port 4000) - API REST + PostgreSQL

## Prérequis

- Node.js 20+
- PostgreSQL 15+
- npm

## Installation

1. **Cloner le projet**
```bash
git clone <repository-url>
cd matix-livreur
```

2. **Installer les dépendances**
```bash
npm run setup
```

3. **Configuration PostgreSQL**

Créer une base de données PostgreSQL :
```sql
CREATE DATABASE matix_livreur;
CREATE USER matix_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE matix_livreur TO matix_user;
```

4. **Configuration des variables d'environnement**

Copier `.env.sample` vers `.env` et configurer :
```bash
cp .env.sample .env
```

Éditer `.env` avec vos paramètres :
```
# Base de données
DB_HOST=localhost
DB_PORT=5432
DB_NAME=matix_livreur
DB_USER=matix_user
DB_PASSWORD=your_password

# Serveurs
FRONTEND_PORT=3000
BACKEND_PORT=4000

# Sécurité
JWT_SECRET=your_jwt_secret_key_here
SESSION_SECRET=your_session_secret_here

# Environnement
NODE_ENV=development
```

5. **Initialiser la base de données**
```bash
# Exécuter les migrations
psql -h localhost -U matix_user -d matix_livreur -f backend/scripts/migrate.sql

# Insérer les données de test
psql -h localhost -U matix_user -d matix_livreur -f backend/scripts/seed.sql
```

## Démarrage

### Démarrage des deux serveurs
```bash
npm start
```

### Démarrage séparé
```bash
# Front-end (port 3000)
npm run dev:front

# Back-end (port 4000)
npm run dev:back
```

## Tests

```bash
npm test
```

## Comptes par défaut

### Livreurs
- **Utilisateurs** : Mane, Diaby, Diallo, Aliou, Livreur 1, Livreur 2
- **Mot de passe** : `Password123!`

### Managers
- **Utilisateurs** : SALIOU, OUSMANE, DIDI, AMARY
- **Mot de passe** : `Manager123!`

## API Documentation

### Authentification
- `POST /api/v1/auth/login` - Connexion
- `POST /api/v1/auth/logout` - Déconnexion
- `POST /api/v1/auth/change-password` - Changer mot de passe

### Utilisateurs
- `GET /api/v1/users` - Liste des utilisateurs (MANAGER/ADMIN)
- `POST /api/v1/users` - Créer utilisateur (MANAGER/ADMIN)
- `PUT /api/v1/users/:id` - Modifier utilisateur (MANAGER/ADMIN)
- `DELETE /api/v1/users/:id` - Supprimer utilisateur (ADMIN)

### Commandes
- `GET /api/v1/orders` - Liste des commandes
- `POST /api/v1/orders` - Créer commande
- `PUT /api/v1/orders/:id` - Modifier commande
- `DELETE /api/v1/orders/:id` - Supprimer commande
- `GET /api/v1/orders/export` - Export Excel (MANAGER/ADMIN)

## Structure du Projet

```
/frontend
  index.html
  /css
    styles.css
  /js
    main.js
  /assets
  server.js

/backend
  /controllers
  /models
  /routes
  /middleware
  app.js
  /scripts
    migrate.sql
    seed.sql
```

## Charte Graphique

- **Couleur primaire** : Vert #009E60
- **Couleur secondaire** : Bleu #0072CE
- **Police** : -apple-system, Roboto, Arial, sans-serif

## Sécurité

- Mots de passe hashés avec bcrypt (12 rounds)
- JWT en cookies HttpOnly
- Validation des entrées avec express-validator
- Rate limiting avec express-rate-limit 