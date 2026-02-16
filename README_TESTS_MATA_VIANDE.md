# Tests API Commandes En Cours - Mata Viande

Ce dossier contient des scripts de test pour l'API des commandes en cours (Mata viande).

## 📋 Données de test

**Commande n°1118** - TEST TEST SALIOU
- **Client**: TEST TEST SALIOU (773929671)
- **Adresse**: 43 Rue Vineuse
- **Point de vente**: O.Foire
- **Livreur assigné**: OSF (ou Massaer pour les tests)
- **Date**: 2026-01-31
- **Total**: 11 200 FCFA

**Articles commandés**:
1. viande de boeuf - 1 x 3 800 FCFA
2. viande de veau - 1 x 4 000 FCFA
3. Poulet entier (1.5 kilos minimum) - 1 x 3 400 FCFA

## 🧪 Scripts de test disponibles

### 1. `test_mata_viande_commande.js`
Script Node.js complet avec tests unitaires et tests d'intégration.

**Caractéristiques**:
- ✅ Test de transformation des données
- ✅ Test de création de commande (API externe)
- ✅ Test de récupération des commandes (API authentifiée)
- ✅ Test de mise à jour du statut
- ✅ Validation automatique de la structure

**Utilisation**:
```bash
# 1. Configurer l'API_KEY dans le fichier
# 2. Lancer les tests
node test_mata_viande_commande.js
```

**Test unitaire seulement** (sans appel API):
```bash
node test_mata_viande_commande.js
# Affiche uniquement la transformation des données
```

### 2. `test_mata_viande_commande.ps1`
Script PowerShell pour Windows.

**Utilisation**:
```powershell
# 1. Configurer l'API_KEY dans le fichier
# 2. Lancer le script
.\test_mata_viande_commande.ps1
```

### 3. `test_mata_viande_commande.sh`
Script Bash pour Linux/Mac.

**Utilisation**:
```bash
# 1. Rendre le script exécutable
chmod +x test_mata_viande_commande.sh

# 2. Configurer l'API_KEY dans le fichier
# 3. Lancer le script
./test_mata_viande_commande.sh
```

## 🔧 Configuration

### Étape 1: Obtenir votre clé API

La clé API est stockée dans votre fichier `.env` :
```env
EXTERNAL_API_KEY=votre_cle_api_ici
```

### Étape 2: Configurer l'URL de l'API

Par défaut, l'URL est `http://localhost:3000/api`

Pour tester en production :
```javascript
const API_BASE_URL = 'https://votre-domaine.com/api';
```

### Étape 3: Vérifier que le livreur existe

Le livreur "Massaer" doit exister dans votre base de données. Si ce n'est pas le cas, modifiez dans les scripts :
```javascript
livreur_id: "NomDuLivreur"
```

## 📊 Structure de l'API

### Endpoint: POST `/api/external/commande-en-cours`

**Headers requis**:
```
Content-Type: application/json
x-api-key: VOTRE_CLE_API
```

**Body requis**:
```json
{
  "commande_id": "1118",
  "livreur_id": "Massaer",
  "livreur_nom": "Massaer",
  "client": {
    "nom": "TEST TEST SALIOU",
    "telephone": "773929671",
    "adresse": "43 Rue Vineuse"
  },
  "articles": [
    {
      "produit": "viande de boeuf",
      "quantite": 1,
      "prix": 3800
    }
  ],
  "total": 11200,
  "point_vente": "O.Foire",
  "date_commande": "2026-01-31",
  "statut": "en_attente"
}
```

**Statuts possibles**:
- `en_attente` - Commande reçue, pas encore assignée
- `en_livraison` - Livreur en route
- `livre` - Commande livrée avec succès
- `annule` - Commande annulée

### Endpoint: GET `/api/v1/commandes-en-cours`

**Headers requis**:
```
Authorization: Bearer VOTRE_TOKEN_JWT
Content-Type: application/json
```

**Query parameters**:
```
?date=2026-01-31&statut=en_attente&point_vente=O.Foire
```

## 🔍 Vérification des résultats

### Dans la base de données

```sql
-- Vérifier que la commande a été créée
SELECT * FROM commandes_en_cours 
WHERE commande_id = '1118';

-- Vérifier toutes les commandes du jour
SELECT 
  commande_id,
  client_nom,
  livreur_nom,
  total,
  statut,
  created_at
FROM commandes_en_cours 
WHERE date_commande = '2026-01-31'
ORDER BY created_at DESC;
```

### Dans l'interface web

1. Connectez-vous à l'application Matix Livreur
2. Allez dans "Commandes en cours"
3. Filtrez par date: 2026-01-31
4. Vérifiez que la commande n°1118 apparaît

## 🐛 Dépannage

### Erreur: "Livreur avec le nom 'Massaer' n'existe pas"

**Solution**: Vérifiez que le livreur existe dans la table `users`:
```sql
SELECT id, username, role, is_active FROM users 
WHERE username = 'Massaer' AND role = 'LIVREUR';
```

Si le livreur n'existe pas, créez-le ou changez le nom dans les scripts de test.

### Erreur: "Invalid API key"

**Solution**: Vérifiez que votre clé API est correcte dans le fichier `.env` du backend.

### Erreur: "Cannot connect to localhost:3000"

**Solution**: Vérifiez que le serveur backend est démarré:
```bash
cd backend
npm run dev:back
```

### Erreur: "Unauthorized" (401)

**Solution**: Pour les endpoints protégés (`/api/v1/*`), vous devez fournir un token JWT valide. Connectez-vous d'abord via l'API d'authentification pour obtenir un token.

## 📝 Logs et debugging

Les logs du serveur montreront :
```
✅ Commande en cours créée: 1118
📦 Commande assignée au livreur: Massaer
```

Pour activer les logs détaillés, ajoutez dans votre `.env`:
```env
DEBUG=true
LOG_LEVEL=debug
```

## 🎯 Tests automatisés avec Jest

Pour intégrer ces tests dans votre suite Jest :

```javascript
// backend/tests/commandes-en-cours.test.js
const { transformOrderData, testDataTransformation } = require('../../test_mata_viande_commande');

describe('Commandes En Cours API', () => {
  test('transforme correctement les données brutes', () => {
    expect(testDataTransformation()).toBe(true);
  });
  
  // Ajoutez d'autres tests...
});
```

## 📚 Documentation API complète

Pour plus d'informations sur l'API, consultez :
- `backend/controllers/commandeEnCoursController.js` - Logique métier
- `backend/routes/commandesEnCours.js` - Définition des routes
- `frontend/js/commandes-en-cours.js` - Interface utilisateur

## ✅ Checklist avant de tester

- [ ] Le serveur backend est démarré
- [ ] La base de données est accessible
- [ ] L'API_KEY est configurée
- [ ] Le livreur "Massaer" existe dans la base
- [ ] Le point de vente "O.Foire" est valide
- [ ] Les dépendances npm sont installées (`axios`)

## 🚀 Tests en production

**⚠️ ATTENTION**: Ne pas utiliser ces scripts directement en production sans :
1. Changer les données de test (nom, téléphone, adresse)
2. Vérifier que les commandes de test ne perturbent pas les vraies commandes
3. Avoir un plan de nettoyage des données de test

Pour tester en production de manière sûre :
```javascript
// Utiliser un préfixe pour les tests
commande_id: "TEST_1118",
client: {
  nom: "[TEST] CLIENT DE TEST",
  // ...
}
```

Puis nettoyer après :
```sql
DELETE FROM commandes_en_cours 
WHERE commande_id LIKE 'TEST_%' 
AND created_at < NOW() - INTERVAL '1 day';
```
