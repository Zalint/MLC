# 🔍 Visualisation du Tag Client dans l'API Audit

## 📍 Emplacements du `client_tag` dans la réponse

Le `client_tag` apparaît à **2 endroits** dans la réponse de l'API `/api/external/mata/audit/client`:

---

## 1️⃣ Dans `client_info.client_tag` (niveau client)

```json
{
  "success": true,
  "client_info": {
    "name": "Abdoulaye Boucher",
    "phone_number": "773289936",
    "client_tag": "VIP",  // ← ICI (niveau client)
    "first_order": "2025-01-05",
    "last_order": "2026-02-01",
    "total_orders": 31,
    "credit": { ... }
  }
}
```

---

## 2️⃣ Dans `client_info.credit.client_tag` (niveau crédit)

```json
{
  "success": true,
  "client_info": {
    "name": "Abdoulaye Boucher",
    "phone_number": "773289936",
    "client_tag": "VIP",
    "credit": {
      "amount": 370000,
      "current_balance": 370000,
      "expires_at": "2026-03-15T00:00:00.000Z",
      "is_expired": false,
      "days_remaining": 41,
      "client_tag": "VIP"  // ← ICI (dans l'objet crédit)
    }
  }
}
```

---

## 🎯 Cas d'usage Frontend

### Afficher le badge client

```javascript
// Récupérer l'audit
const response = await fetch('/api/external/mata/audit/client?phone_number=773289936', {
  headers: { 'x-api-key': 'YOUR_API_KEY' }
});
const data = await response.json();

// Accéder au tag
const clientTag = data.client_info.client_tag; // "VIP"

// Afficher le badge
const badges = {
  'VVIP': { icon: '👑', color: '#FF1493', label: 'VVIP' },
  'VIP': { icon: '⭐', color: '#FFD700', label: 'VIP' },
  'STANDARD': { icon: '👤', color: '#E0E0E0', label: 'Standard' }
};

const badge = badges[clientTag];
console.log(`${badge.icon} Client ${badge.label}`);
// Affiche: ⭐ Client VIP
```

---

## 📊 Exemple complet de réponse

Voir le fichier: **`exemple_reponse_audit_avec_tag.json`**

Structure complète:
```
{
  "success": true,
  "client_info": {
    "name": "...",
    "phone_number": "...",
    "client_tag": "VIP",           ← TAG ICI
    "total_orders": 31,
    "credit": {
      "amount": 370000,
      "client_tag": "VIP"          ← TAG ICI AUSSI
    }
  },
  "orders_history": [ ... ],
  "sentiment_analysis": { ... },
  "statistics": { ... }
}
```

---

## 🧪 Tester en Direct

### Option 1: Avec curl

```bash
curl -X GET "http://localhost:3000/api/external/mata/audit/client?phone_number=773289936&skip_sentiment=true" \
  -H "x-api-key: YOUR_API_KEY" \
  | jq '.client_info.client_tag'
```

**Résultat attendu:**
```
"VIP"
```

### Option 2: Avec le fichier test HTML

1. Ouvrir `test_client_tags.html` dans le navigateur
2. Aller à la section **"2️⃣ Récupérer l'audit client avec tag"**
3. Entrer un numéro de téléphone
4. Cliquer sur "Récupérer Audit"
5. Le tag s'affichera en gros avec un emoji

---

## 💡 Valeurs possibles du tag

| Valeur | Affichage suggéré | CSS |
|--------|-------------------|-----|
| `"STANDARD"` | 👤 Standard | `background: #E0E0E0; color: #666;` |
| `"VIP"` | ⭐ VIP | `background: #FFD700; color: #000;` |
| `"VVIP"` | 👑 VVIP | `background: #FF1493; color: #FFF;` |

---

## 🔧 Code Backend Modifié

### Dans `externalMataAuditController.js` (ligne 112-152)

```javascript
// Récupérer le crédit client (avec gestion expiration et tag)
const creditQuery = `
  SELECT 
    credit_amount,
    expires_at,
    expiration_days,
    created_at,
    version,
    client_tag,  // ← AJOUTÉ ICI
    CASE 
      WHEN expires_at > CURRENT_TIMESTAMP THEN credit_amount
      ELSE 0
    END as current_balance,
    ...
  FROM client_credits
  WHERE phone_number = $1
`;

// Construire la réponse
if (creditResult.rows.length > 0) {
  const credit = creditResult.rows[0];
  clientInfo.credit = {
    amount: parseFloat(credit.credit_amount),
    current_balance: parseFloat(credit.current_balance),
    version: credit.version,
    expires_at: credit.expires_at,
    expiration_days: credit.expiration_days,
    is_expired: credit.is_expired,
    days_remaining: credit.days_remaining,
    created_at: credit.created_at,
    client_tag: credit.client_tag || 'STANDARD'  // ← AJOUTÉ ICI
  };
  clientInfo.client_tag = credit.client_tag || 'STANDARD';  // ← AJOUTÉ ICI
} else {
  clientInfo.credit = null;
  clientInfo.client_tag = 'STANDARD';  // ← AJOUTÉ ICI (défaut)
}
```

---

## ✅ Checklist de Vérification

Après avoir déployé, vérifiez que:

- [ ] La colonne `client_tag` existe dans la table `client_credits`
- [ ] Le backend a été redémarré
- [ ] L'API retourne le champ `client_info.client_tag`
- [ ] L'API retourne le champ `client_info.credit.client_tag`
- [ ] Les valeurs sont: `"STANDARD"`, `"VIP"` ou `"VVIP"`

---

## 🆘 Dépannage

### Le tag n'apparaît pas dans la réponse

1. **Vérifier la migration:**
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name='client_credits' AND column_name='client_tag';
   ```
   Doit retourner 1 ligne.

2. **Vérifier qu'un client a un tag:**
   ```sql
   SELECT phone_number, client_tag FROM client_credits LIMIT 5;
   ```

3. **Redémarrer le backend:**
   ```bash
   cd backend && npm restart
   ```

4. **Tester avec skip_sentiment pour aller plus vite:**
   ```bash
   curl "http://localhost:3000/api/external/mata/audit/client?phone_number=773289936&skip_sentiment=true" \
     -H "x-api-key: YOUR_API_KEY"
   ```

---

## 📱 Exemple d'Interface

```html
<div class="client-header">
  <h2>Abdoulaye Boucher</h2>
  <span class="badge badge-vip">⭐ VIP</span>
</div>

<style>
.badge-vip {
  background: linear-gradient(135deg, #FFD700, #FFA500);
  color: #000;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: bold;
  box-shadow: 0 2px 5px rgba(255, 215, 0, 0.3);
}

.badge-vvip {
  background: linear-gradient(135deg, #FF1493, #C71585);
  color: #FFF;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: bold;
  box-shadow: 0 2px 5px rgba(255, 20, 147, 0.3);
}
</style>
```

---

**Fichier d'exemple complet:** `exemple_reponse_audit_avec_tag.json`  
**Test interactif:** `test_client_tags.html`
