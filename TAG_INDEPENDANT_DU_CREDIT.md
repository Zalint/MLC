# 🏷️ Tag Client: Indépendant du Crédit

## ✅ Principe

Le **tag VIP/VVIP** est un **statut permanent du client** (lié au numéro de téléphone), **complètement indépendant** du crédit (bon).

---

## 🎯 Comportements

### 1. Tag SANS crédit

Un client peut être VIP/VVIP **sans avoir de crédit actif**:

```
Client: 774593305
Tag: ⭐ VIP
Crédit: 0 FCFA (ou aucun)

→ Le client reste VIP même sans crédit
```

### 2. Crédit expiré ou à 0

Un client VIP avec crédit expiré **reste VIP**:

```
Client: 773289936
Tag: 👑 VVIP
Crédit: 0 FCFA (expiré)

→ Le client reste VVIP
→ Le tag n'est PAS supprimé
```

### 3. Changement de tag

Vous pouvez changer le tag **sans toucher au crédit**:

```
AVANT:
- Tag: 👤 STANDARD
- Crédit: 50,000 FCFA (20 jours restants)

Action: Changer tag → ⭐ VIP

APRÈS:
- Tag: ⭐ VIP
- Crédit: 50,000 FCFA (20 jours restants) ← INCHANGÉ
```

---

## 🔧 Ce qui a été corrigé

### Backend (`clientCreditsController.js`)

**AVANT (bug):**
```javascript
// Exigeait toujours un crédit pour sauvegarder
if (!credit_amount || credit_amount < 0) {
  return error('credit_amount requis');
}
```

**APRÈS (corrigé):**
```javascript
// Deux cas possibles:
const isUpdatingCredit = credit_amount && credit_amount > 0;
const isUpdatingTagOnly = !isUpdatingCredit && client_tag;

// CAS 1: Crédit + tag
if (isUpdatingCredit) {
  // INSERT/UPDATE crédit complet
}

// CAS 2: Tag seul
else if (isUpdatingTagOnly) {
  // UPDATE juste du tag (sans toucher au crédit)
}
```

### Frontend (`client-credits.js`)

**AVANT (bug):**
```javascript
// Créait un crédit fictif de 1000 FCFA
const existingAmount = client.credit_amount || 1000; // ❌
```

**APRÈS (corrigé):**
```javascript
// Envoie juste le tag, pas de crédit
body: JSON.stringify({
  phone_number: phone,
  client_tag: clientTag
  // Pas de credit_amount ✅
})
```

---

## 📊 Base de données

### Structure

La table `client_credits` contient:

```sql
CREATE TABLE client_credits (
  phone_number VARCHAR(50) PRIMARY KEY,
  credit_amount DECIMAL(10,2) DEFAULT 0,  -- Peut être 0
  client_tag VARCHAR(20) DEFAULT 'STANDARD',
  expires_at TIMESTAMP,
  ...
);
```

### Cas possibles

| Crédit | Tag | Situation | Valide? |
|--------|-----|-----------|---------|
| 50,000 | VIP | Client VIP avec crédit actif | ✅ |
| 0 | VIP | Client VIP sans crédit | ✅ |
| NULL | VVIP | Pas de ligne, juste tag | ✅ (créé avec crédit=0) |
| 10,000 | STANDARD | Client standard avec crédit | ✅ |

---

## 🎬 Scénarios d'utilisation

### Scénario 1: Promouvoir un client en VIP

```
Client: 774593305 (4 kg boeuf)
- 25 commandes
- Aucun crédit actif

Action:
1. Laisser "Montant du crédit" vide
2. Sélectionner: ⭐ VIP
3. Sauvegarder

Résultat:
✅ Tag: ⭐ VIP
✅ Crédit: Toujours 0 (pas de crédit créé)
✅ Le client est maintenant VIP de façon permanente
```

### Scénario 2: Attribuer un crédit à un VIP existant

```
Client: 774593305 (déjà VIP)
- Tag: ⭐ VIP
- Crédit: 0 FCFA

Action:
1. Montant: 20000
2. Délai: 45 jours
3. Tag: ⭐ VIP (garder)
4. Sauvegarder

Résultat:
✅ Tag: ⭐ VIP (reste VIP)
✅ Crédit: 20,000 FCFA (nouveau crédit)
✅ Expiration: Dans 45 jours
```

### Scénario 3: Le crédit expire mais le client reste VIP

```
Client: 773289936 (VVIP)
- Tag: 👑 VVIP
- Crédit: 50,000 FCFA (expire demain)

Après expiration:
✅ Tag: 👑 VVIP (reste VVIP)
✅ Crédit: 0 FCFA (expiré)
✅ Le statut VVIP est permanent
```

### Scénario 4: Rétrograder un VVIP en VIP

```
Client: 779909084
- Tag: 👑 VVIP
- Crédit: 150,000 FCFA

Action:
1. Laisser montant/délai vides
2. Sélectionner: ⭐ VIP (rétrograder)
3. Sauvegarder

Résultat:
✅ Tag: ⭐ VIP (rétrogradé)
✅ Crédit: 150,000 FCFA (inchangé)
```

---

## 🧪 Tests

### Test 1: Tag sans créer de crédit

```sql
-- AVANT
SELECT * FROM client_credits WHERE phone_number = '774593305';
-- Résultat: 0 ligne (ou crédit expiré)

-- Action: Mettre tag VIP via l'interface

-- APRÈS
SELECT phone_number, credit_amount, client_tag 
FROM client_credits 
WHERE phone_number = '774593305';

-- Résultat attendu:
-- phone_number | credit_amount | client_tag
-- 774593305    | 0             | VIP
```

### Test 2: Conserver le crédit en changeant le tag

```sql
-- AVANT
SELECT phone_number, credit_amount, client_tag 
FROM client_credits 
WHERE phone_number = '773289936';

-- Résultat:
-- 773289936 | 50000 | STANDARD

-- Action: Changer tag STANDARD → VVIP (sans montant)

-- APRÈS
SELECT phone_number, credit_amount, client_tag 
FROM client_credits 
WHERE phone_number = '773289936';

-- Résultat attendu:
-- 773289936 | 50000 | VVIP  ← Crédit conservé!
```

---

## 📋 Logs Backend

### CAS 1: Tag seul

```
🏷️ Mise à jour tag uniquement: 774593305 -> VIP
✅ Tag mis à jour: 774593305 - Tag: VIP
```

### CAS 2: Crédit + Tag

```
💰 Mise à jour crédit + tag: 773289936 - 10000 FCFA - VIP
✅ Crédit attribué: 773289936 - 10000 FCFA - 30 jours - Tag: VIP
```

---

## 📊 Statistiques

Maintenant vous pouvez faire des stats par tag, indépendamment du crédit:

```sql
-- Nombre de clients VIP/VVIP (avec ou sans crédit)
SELECT 
  client_tag,
  COUNT(*) as nombre_clients
FROM client_credits
GROUP BY client_tag;

-- Résultat:
-- STANDARD | 650
-- VIP      | 45
-- VVIP     | 13

-- Clients VIP avec crédit actif
SELECT 
  COUNT(*) as vip_avec_credit
FROM client_credits
WHERE client_tag IN ('VIP', 'VVIP')
  AND credit_amount > 0
  AND expires_at > CURRENT_TIMESTAMP;

-- Clients VIP sans crédit
SELECT 
  COUNT(*) as vip_sans_credit
FROM client_credits
WHERE client_tag IN ('VIP', 'VVIP')
  AND (credit_amount = 0 OR expires_at <= CURRENT_TIMESTAMP);
```

---

## ✅ Résumé

| Avant | Après |
|-------|-------|
| ❌ Tag nécessite un crédit | ✅ Tag indépendant du crédit |
| ❌ Créait crédit fictif de 1000 | ✅ Pas de crédit si non voulu |
| ❌ Tag supprimé si crédit expire | ✅ Tag permanent |
| ❌ Pas de VIP sans crédit | ✅ VIP sans crédit possible |

---

## 🚀 Déploiement

1. **Backend modifié:** `backend/controllers/clientCreditsController.js`
2. **Frontend modifié:** `frontend/js/client-credits.js`
3. **Redémarrer le backend:** `cd backend && npm restart`
4. **Recharger le frontend:** CTRL+SHIFT+F5

---

**🎉 Le tag est maintenant un vrai statut client, indépendant du crédit!**
