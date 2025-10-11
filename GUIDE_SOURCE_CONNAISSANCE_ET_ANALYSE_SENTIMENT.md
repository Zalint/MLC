# 📋 Guide - Source de Connaissance et Analyse de Sentiment IA

## 🎯 Résumé des Nouvelles Fonctionnalités

Ce guide décrit les deux nouvelles fonctionnalités ajoutées au Tableau MATA Mensuel :

1. **Colonne "Source de connaissance"** - Permet de tracker comment les clients ont connu votre service
2. **Analyse de Sentiment IA** - Analyse automatique des commentaires et notes avec OpenAI

---

## 📦 Installation et Configuration

### Étape 1 : Migration Base de Données

Exécutez la migration SQL pour ajouter la nouvelle colonne :

```bash
# Depuis le répertoire racine du projet
psql -U your_user -d matix_livreur_preprod -f add_source_connaissance_column.sql
```

Ou via pgAdmin / interface de base de données, exécutez le contenu de `add_source_connaissance_column.sql`.

### Étape 2 : Installation des Dépendances

Le package OpenAI doit être installé :

```bash
cd backend
npm install openai
```

### Étape 3 : Configuration .env

Vérifiez que votre fichier `.env` contient les variables OpenAI :

```env
# OpenAI Configuration (pour analyse de sentiment)
OPENAI_API_KEY=sk-proj-votre-cle-ici
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=1000
OPENAI_TEMPERATURE=0.3
```

**Modèles recommandés** :
- `gpt-4o-mini` - Le plus économique (~$0.15 par million de tokens)
- `gpt-3.5-turbo` - Également très économique (~$0.50 par million de tokens)
- `gpt-4o` - Plus performant mais plus cher

### Étape 4 : Redémarrage du Serveur

```bash
# Backend
cd backend
npm start

# Frontend (si nécessaire)
cd frontend
# Rafraîchir le navigateur
```

---

## 🚀 Utilisation

### 1. Colonne "Source de connaissance"

#### Accès
- Accessible dans **Tableau MATA mensuel**
- Visible pour tous les managers et admins
- Colonne entre "Interne" et "Commentaire"

#### Fonctionnement

**Affichage** :
- Si renseigné : affiche la source (ex: "Bouche-à-oreille")
- Si non renseigné : affiche "Non renseigné" en gris italique

**Édition** :
1. Dans la colonne "Actions", cliquez sur le bouton **bleu** "Modifier"
2. Un menu déroulant apparaît avec les options :
   - Bouche-à-oreille
   - Réseaux sociaux (Facebook)
   - Réseaux sociaux (Instagram)
   - Réseaux sociaux (WhatsApp)
   - Publicité en ligne
   - Publicité physique
   - Site web
   - Client régulier
   - Recommandation
   - Autre

3. Si vous sélectionnez "Autre", un champ texte apparaît pour saisir une source personnalisée
4. Cliquez sur **✓** (vert) pour sauvegarder ou **✗** (gris) pour annuler

**API Endpoint** :
```
PUT /api/v1/orders/:id/source-connaissance
Authorization: Bearer <token>
Content-Type: application/json

{
  "source_connaissance": "Bouche-à-oreille"
}
```

---

### 2. Analyse de Sentiment IA

#### Accès
- Bouton **"🔍 Analyse Sentiment"** en haut du tableau MATA
- À côté du bouton "Export Excel"
- Accessible uniquement aux Managers et Admins

#### Fonctionnement

1. **Cliquez sur "🔍 Analyse Sentiment"**
   - Un spinner de chargement apparaît
   - L'IA analyse les données du mois sélectionné

2. **Modal d'Analyse s'Affiche avec** :

   **📊 Statistiques Globales**
   - Nombre total de commandes
   - Commandes avec commentaires (%)
   - Commandes avec notes (%)

   **⭐ Notes Moyennes**
   - Service livraison
   - Qualité produits
   - Niveau prix
   - Service commercial
   - Barres de progression visuelles

   **🤖 Analyse IA des Commentaires**
   - Sentiment global : POSITIF / NEUTRE / NÉGATIF
   - Score de sentiment (0-100%)
   - 💪 Points Forts identifiés (3-5 points)
   - 🔧 Points d'Amélioration (3-5 points)
   - 🎯 Recommandations actionnables (3-4 points)

   **📍 Par Point de Vente**
   - Nombre de commandes par point de vente
   - Note moyenne par point de vente

   **🎯 Sources d'Acquisition Client**
   - Répartition des clients par source de connaissance
   - Pourcentage par source

3. **Fermer le Modal**
   - Cliquez sur la croix (✕) en haut à droite
   - Ou cliquez en dehors du modal

#### API Endpoint

```
GET /api/v1/orders/mata-sentiment-analysis?month=2025-10
Authorization: Bearer <token>

Response:
{
  "success": true,
  "month": "2025-10",
  "statistics": {
    "total_orders": 150,
    "orders_with_comments": 45,
    "orders_with_ratings": 120,
    "comment_percentage": "30.0",
    "rating_percentage": "80.0"
  },
  "average_ratings": {
    "service_rating": "8.5",
    "quality_rating": "7.8",
    "price_rating": "6.5",
    "commercial_service_rating": "9.1",
    "global_average": "8.0"
  },
  "ai_analysis": {
    "sentiment_global": "POSITIF",
    "sentiment_score": 85,
    "points_forts": [
      "Rapidité de livraison très appréciée",
      "Livreurs courtois et professionnels",
      "Produits frais et de qualité"
    ],
    "points_amelioration": [
      "Quelques retards signalés",
      "Prix jugés légèrement élevés"
    ],
    "recommandations": [
      "Maintenir la qualité du service livraison",
      "Communiquer sur la valeur-prix",
      "Former les livreurs sur la ponctualité"
    ]
  },
  "by_point_vente": [...],
  "by_source_connaissance": [...]
}
```

---

## 💰 Coûts OpenAI

### Estimation avec gpt-4o-mini

**Coût par analyse** :
- 100 commandes avec 50 commentaires moyens (~50 mots chacun)
- Input : ~2 500 tokens
- Output : ~500 tokens
- **Coût total : ~$0.003 par analyse** (0.3 centime)

**Coût mensuel estimé** :
- 1 analyse par jour : ~$0.09/mois
- 1 analyse par mois : ~$0.003/mois

### Optimisations Intégrées

1. **Limite de commentaires** : Max 50 commentaires analysés par appel
2. **Fallback automatique** : Si OpenAI échoue, analyse basique sans IA
3. **Pas de clé API** : Fonctionne sans OpenAI (analyse basique)
4. **Modèle paramétrable** : Changez le modèle via `.env`

---

## 🔧 Configuration Avancée

### Modifier le Modèle OpenAI

Dans `.env` :

```env
# Pour plus de qualité (mais plus cher)
OPENAI_MODEL=gpt-4o

# Pour plus d'économie
OPENAI_MODEL=gpt-3.5-turbo
```

### Ajuster les Paramètres

```env
# Tokens maximum pour la réponse (plus = plus long mais plus cher)
OPENAI_MAX_TOKENS=1500

# Température (0-1, plus bas = plus cohérent, plus haut = plus créatif)
OPENAI_TEMPERATURE=0.5
```

---

## 🛠️ Résolution de Problèmes

### Problème : "Colonne source_connaissance n'existe pas"

**Solution** : Exécutez la migration SQL
```bash
psql -U user -d matix_livreur_preprod -f add_source_connaissance_column.sql
```

### Problème : "OPENAI_API_KEY non configurée"

**Solution** : L'analyse fonctionnera en mode basique sans IA. Pour activer l'IA :
1. Obtenez une clé API sur https://platform.openai.com/api-keys
2. Ajoutez-la dans `.env`
3. Redémarrez le serveur

### Problème : "Erreur lors de l'analyse IA"

**Solutions** :
1. Vérifiez que la clé API est valide
2. Vérifiez votre solde OpenAI sur https://platform.openai.com/usage
3. Le système bascule automatiquement vers l'analyse basique en cas d'erreur
4. Consultez les logs backend pour plus de détails

### Problème : Le bouton "Analyse Sentiment" ne s'affiche pas

**Solution** :
1. Vérifiez que vous êtes connecté en tant que Manager ou Admin
2. Vérifiez que le fichier `mata-sentiment.js` est bien chargé
3. Ouvrez la console du navigateur (F12) pour voir les erreurs

---

## 📊 Fichiers Modifiés

### Backend
- ✅ `backend/controllers/orderController.js` - Nouveaux endpoints
- ✅ `backend/routes/orders.js` - Nouvelles routes
- ✅ `add_source_connaissance_column.sql` - Migration SQL

### Frontend
- ✅ `frontend/index.html` - Bouton d'analyse
- ✅ `frontend/js/main.js` - Affichage colonne source_connaissance
- ✅ `frontend/js/mata-sentiment.js` - Gestion analyse et édition
- ✅ `frontend/css/style.css` - Styles du modal et de la colonne

### Configuration
- ✅ `env.sample` - Variables OpenAI

---

## 📈 Avantages Business

### Source de Connaissance
- **Marketing** : Identifier les canaux d'acquisition les plus efficaces
- **Budget** : Optimiser les investissements publicitaires
- **Stratégie** : Comprendre comment les clients découvrent vos services

### Analyse de Sentiment
- **Qualité** : Détecter rapidement les points d'amélioration
- **Satisfaction** : Suivre l'évolution du sentiment client
- **Décision** : Obtenir des recommandations actionnables
- **Gain de temps** : Analyse automatique vs lecture manuelle de tous les commentaires

---

## 🔒 Sécurité et Permissions

- **Authentification** : Bearer token requis
- **Autorisation** : Managers et Admins uniquement
- **Rate limiting** : Respecte les limites existantes
- **Données** : Les commentaires ne sont jamais stockés chez OpenAI (API stateless)
- **Clé API** : Stockée de manière sécurisée dans `.env` (non versionné)

---

## 📞 Support

Pour toute question ou problème :
1. Consultez les logs backend : `backend/logs/`
2. Consultez la console navigateur (F12)
3. Vérifiez ce guide
4. Contactez l'équipe technique

---

**Version** : 1.0  
**Date** : Octobre 2025  
**Auteur** : Matix Livreur Tech Team

