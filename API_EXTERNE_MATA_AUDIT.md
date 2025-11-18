# 📡 API Externe - Audit Client MATA

API REST pour récupérer l'historique complet d'un client avec analyse de sentiment automatique via OpenAI.

---

## 🔐 Authentication

Utilise une clé API via le header `x-api-key`.

```bash
x-api-key: your-secret-api-key-here
```

---

## 📍 Endpoint

```
GET  /api/external/mata/audit/client?phone_number=XXX
POST /api/external/mata/audit/client
```

**Méthodes supportées** : GET et POST

---

## 📥 Request

### Option 1: GET (Recommandé - Plus simple)

**URL** : `/api/external/mata/audit/client?phone_number=773929671`

**Headers** :
```
x-api-key: your-secret-api-key-here
```

### Option 2: POST

**Headers** :
```
Content-Type: application/json
x-api-key: your-secret-api-key-here
```

**Body** :
```json
{
  "phone_number": "773929671"
}
```

### Formats de numéro acceptés

| Format | Exemple | Description |
|--------|---------|-------------|
| Local Sénégal | `773929671` | Sans indicatif pays |
| International SN | `221773929671` | Avec indicatif 221 |
| Avec 00 | `00221773929671` | Format international avec 00 |
| Avec + | `+221773929671` | Format E.164 |
| Local France | `679854465` | Sans 0 initial |
| National France | `0679854465` | Avec 0 initial |
| International FR | `33679854465` | Avec indicatif 33 |
| USA | `14436273965` | Indicatif 1 |

**L'API normalise automatiquement tous ces formats !**

---

## 📤 Response

### Success (200)

```json
{
  "success": true,
  "phone_number": "773929671",
  "normalized_phone": "221773929671",
  "country": "SN",
  "client_info": {
    "name": "Mme Sall",
    "phone_number": "773929671",
    "normalized_phone": "221773929671",
    "country": "SN",
    "first_order": "2025-01-15",
    "last_order": "2025-11-17",
    "total_orders": 12
  },
  "orders_history": [
    {
      "date": "2025-11-17",
      "point_de_vente": "Mbao",
      "montant": 15000,
      "livreur": "Mane",
      "commentaire": "satisfait, livraison rapide",
      "source_connaissance": "Recommandation",
      "ratings": {
        "service": 9,
        "quality": 8,
        "price": 8,
        "commercial_service": 9,
        "average": 8.5
      },
      "adresse_source": "Pikine",
      "adresse_destination": "Guédiawaye"
    }
  ],
  "sentiment_analysis": {
    "overall_sentiment": "positive",
    "sentiment_score": 0.75,
    "confidence": 0.85,
    "positive_comments": 8,
    "neutral_comments": 3,
    "negative_comments": 1,
    "keywords": {
      "positive": ["satisfait", "rapide", "bon", "excellent"],
      "negative": ["retard"],
      "neutral": ["recommandation"]
    },
    "recommendations": "Client très satisfait. Maintenir la qualité de service. Attention aux délais lors des périodes de forte activité.",
    "summary": "Client fidèle et globalement très satisfait des services. Quelques retards occasionnels mais toujours bien gérés.",
    "total_comments_analyzed": 12,
    "analyzed_at": "2025-11-17T15:30:00Z",
    "model_used": "gpt-4o-mini"
  },
  "statistics": {
    "total_orders": 12,
    "total_amount": 155000,
    "avg_amount": 12916.67,
    "avg_rating": 8.2
  },
  "generated_at": "2025-11-17T15:30:00Z"
}
```

### Error (404)
```json
{
  "success": false,
  "error": "Aucune commande trouvée pour ce numéro",
  "phone_number": "773929671",
  "normalized_phone": "221773929671",
  "country": "SN"
}
```

### Error (401)
```json
{
  "success": false,
  "error": "x-api-key header manquant"
}
```

### Error (403)
```json
{
  "success": false,
  "error": "Clé API invalide"
}
```

---

## 🧪 Test avec cURL

### GET (plus simple)
```bash
curl -H "x-api-key: your-secret-api-key-here" \
  "http://localhost:4000/api/external/mata/audit/client?phone_number=773929671"
```

### POST
```bash
curl -X POST http://localhost:4000/api/external/mata/audit/client \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secret-api-key-here" \
  -d '{"phone_number": "773929671"}'
```

### PowerShell (Windows)
```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/external/mata/audit/client?phone_number=773929671" `
  -Headers @{"x-api-key"="your-secret-api-key-here"} `
  -Method Get
```

---

## 🧪 Test avec le script Node.js

```bash
# Tester un numéro spécifique
node test_external_api_EXAMPLE.js 773929671

# Tester tous les formats
node test_external_api_EXAMPLE.js all
```

**Note**: La clé API est lue depuis `.env` pour la sécurité.

---

## ⚙️ Configuration

### 1. Ajouter dans `.env`

```env
# Clé API pour l'accès externe (GARDEZ CETTE CLÉ SECRÈTE!)
EXTERNAL_API_KEY=your-secret-key-here

# Configuration OpenAI (déjà présente)
OPENAI_API_KEY=your-openai-key
OPENAI_MODEL=gpt-4o-mini
```

### 2. Générer une clé API sécurisée

```bash
# Avec Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Ou avec OpenSSL
openssl rand -hex 32
```

⚠️ **IMPORTANT**: Ne JAMAIS committer `.env` ou des fichiers contenant des clés API réelles !

---

## 🔍 Analyse de Sentiment

L'API utilise **OpenAI GPT-4o-mini** pour analyser les commentaires des clients et fournir :

- ✅ Sentiment global (positive/neutral/negative)
- ✅ Score de sentiment (-1 à 1)
- ✅ Répartition des commentaires (positifs/neutres/négatifs)
- ✅ Mots-clés extraits
- ✅ Recommandations personnalisées
- ✅ Résumé de la satisfaction client

**Fallback** : Si OpenAI échoue, une analyse basique est effectuée automatiquement.

---

## 🚀 Use Cases

### 1. Intégration CRM
Récupérer automatiquement l'historique client lors d'un appel téléphonique.

### 2. Webhook
Déclencher une analyse après chaque nouvelle commande.

### 3. Tableau de bord externe
Afficher les clients satisfaits/insatisfaits dans un dashboard tiers.

### 4. Automatisation
Scripts automatiques pour identifier les clients à risque.

---

## 🔒 Sécurité

- ✅ Authentification par clé API
- ✅ Clé stockée dans `.env` (jamais dans le code)
- ✅ Rate limiting recommandé en production
- ✅ HTTPS obligatoire en production
- ✅ Validation des entrées

---

## 📊 Limites

- Maximum ~50 commandes analysées par requête (optimisation OpenAI)
- Timeout OpenAI : 30 secondes
- Rate limit : À configurer selon vos besoins

---

## 🐛 Troubleshooting

### "x-api-key header manquant"
→ Ajouter le header `x-api-key` à votre requête

### "Clé API invalide"
→ Vérifier que `EXTERNAL_API_KEY` est bien configurée dans `.env`

### "Aucune commande trouvée"
→ Vérifier que le numéro existe dans la base de données

### "Erreur OpenAI"
→ Vérifier que `OPENAI_API_KEY` est valide
→ L'API utilisera l'analyse basique en fallback

---

## 📝 Changelog

### v1.0.0 (2025-11-17)
- ✅ Endpoint initial
- ✅ Normalisation automatique des numéros
- ✅ Analyse de sentiment avec OpenAI
- ✅ Support multi-pays (SN, FR, US)

