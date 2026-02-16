# 🏷️ Système de Tags Clients - Installation Rapide

## 📦 Fichiers créés

Voici les fichiers qui ont été créés pour le système de tags :

1. **`add_client_tags.sql`** - Script SQL de migration
2. **`CLIENT_TAGS_GUIDE.md`** - Documentation complète
3. **`deploy_client_tags.ps1`** - Script PowerShell de déploiement automatique
4. **`test_client_tags.html`** - Interface de test web
5. **`README_CLIENT_TAGS.md`** - Ce fichier (guide d'installation rapide)

## 🚀 Installation en 3 étapes

### Étape 1 : Exécuter la migration SQL

**Option A - Script PowerShell (recommandé) :**
```powershell
.\deploy_client_tags.ps1
```

**Option B - Manuellement :**
```bash
# Avec psql
psql -h localhost -U matix_user -d matix_livreur -f add_client_tags.sql

# Ou via pgAdmin / DBeaver : ouvrir et exécuter add_client_tags.sql
```

### Étape 2 : Redémarrer le backend

```bash
cd backend
npm restart

# Ou avec PM2
pm2 restart matix-backend
```

### Étape 3 : Tester

Ouvrir `test_client_tags.html` dans votre navigateur pour tester les fonctionnalités.

---

## ✅ Vérification rapide

Vérifiez que tout fonctionne :

```sql
-- Vérifier que la colonne existe
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'client_credits' AND column_name = 'client_tag';

-- Afficher les statistiques
SELECT 
  COALESCE(client_tag, 'STANDARD') as tag,
  COUNT(*) as count
FROM client_credits
GROUP BY client_tag;
```

---

## 📝 Utilisation rapide

### Attribuer un crédit avec tag VIP

**API Request :**
```bash
curl -X POST http://localhost:3000/api/v1/clients/credits \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "773289936",
    "credit_amount": 50000,
    "expiration_days": 30,
    "client_tag": "VIP",
    "notes": "Client fidèle"
  }'
```

### Récupérer l'audit avec tag

```bash
curl -X GET "http://localhost:3000/api/external/mata/audit/client?phone_number=773289936" \
  -H "x-api-key: YOUR_API_KEY"
```

La réponse inclura maintenant :
```json
{
  "client_info": {
    "name": "Abdoulaye Boucher",
    "phone_number": "773289936",
    "client_tag": "VIP",
    "credit": {
      "amount": 370000,
      "client_tag": "VIP",
      ...
    }
  }
}
```

---

## 🎨 Tags disponibles

| Tag | Description | Usage suggéré |
|-----|-------------|---------------|
| `STANDARD` | Client normal (par défaut) | Clients occasionnels |
| `VIP` | Client important | Clients fidèles, commandes régulières |
| `VVIP` | Client très important | Gros clients, priorité maximale |

---

## 🔧 Modifications du code

Les fichiers backend suivants ont été modifiés :

### 1. `backend/controllers/externalMataAuditController.js`
- ✅ Ajout du champ `client_tag` dans la requête SQL du crédit
- ✅ Inclusion du `client_tag` dans `clientInfo.credit`
- ✅ Ajout de `clientInfo.client_tag` au niveau client

### 2. `backend/controllers/clientCreditsController.js`
- ✅ Ajout du paramètre `client_tag` dans `setClientCredit()`
- ✅ Validation du tag (STANDARD, VIP, VVIP uniquement)
- ✅ Inclusion du tag dans toutes les requêtes SQL pertinentes
- ✅ Ajout du tag dans `getMataClientsList()`
- ✅ Ajout du tag dans `getClientCredit()`

---

## 📊 Prochaines étapes (Frontend)

Pour afficher les tags dans l'interface :

```javascript
// Exemple de badge selon le tag
const tagBadges = {
  'VVIP': { icon: '👑', color: '#FF1493', label: 'VVIP' },
  'VIP': { icon: '⭐', color: '#FFD700', label: 'VIP' },
  'STANDARD': { icon: '', color: '#E0E0E0', label: '' }
};

// Affichage
function displayClientTag(tag) {
  const badge = tagBadges[tag] || tagBadges['STANDARD'];
  return `<span style="background: ${badge.color}; padding: 4px 12px; border-radius: 12px;">
    ${badge.icon} ${badge.label}
  </span>`;
}
```

### Intégration dans Tableau MATA Mensuel

Dans votre interface `TABLEAU MATA MENSUEL` :

1. Ajouter une colonne "Tag" dans la liste des clients
2. Filtrer par VIP/VVIP
3. Afficher des badges colorés
4. Trier par priorité (VVIP > VIP > STANDARD)

---

## 🐛 Dépannage

### Erreur : "column client_tag does not exist"
➡️ Le script SQL n'a pas été exécuté. Lancez `add_client_tags.sql`

### Le tag n'apparaît pas dans l'API
➡️ Redémarrez le backend après avoir exécuté la migration

### Erreur : "client_tag must be STANDARD, VIP or VVIP"
➡️ Vérifiez l'orthographe du tag (majuscules requises)

---

## 📖 Documentation complète

Pour plus de détails, consultez **`CLIENT_TAGS_GUIDE.md`** qui contient :
- Exemples SQL avancés
- Requêtes de statistiques
- Scripts d'auto-tagging
- Suggestions d'interface
- Cas d'usage détaillés

---

## 💡 Suggestions d'amélioration future

1. **Auto-tagging** : Script automatique pour taguer VIP selon le nombre de commandes
2. **Nouveaux tags** : GOLD, PLATINUM, etc.
3. **API dédiée** : `GET /api/v1/clients/tags/stats` pour les statistiques
4. **Historique** : Tracer les changements de tags
5. **Notifications** : Alerter quand un client devient VIP

---

## 📞 Support

En cas de problème, vérifiez :
1. ✅ La migration SQL a été exécutée sans erreur
2. ✅ Le backend a été redémarré
3. ✅ Les fichiers `clientCreditsController.js` et `externalMataAuditController.js` ont été mis à jour
4. ✅ Testez avec `test_client_tags.html`

---

**Version:** 1.0  
**Date:** 2026-02-02  
**Auteur:** Système de gestion Matix Livreur
