# 📊 Schéma de Base de Données - Système de Crédits Clients MATA

## Vue d'ensemble des tables

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SYSTÈME DE CRÉDITS CLIENTS                        │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌───────────────────────┐
│     orders       │         │   client_credits      │
│                  │         │                       │
│ • id            │         │ • id (PK)            │
│ • phone_number  │────────▶│ • phone_number (UK)  │
│ • client_name   │   1:1   │ • credit_amount      │
│ • order_type    │         │ • expiration_days    │
│ • amount        │         │ • expires_at         │
│ • created_at    │         │ • version  🔒        │
│ • ...           │         │ • created_at         │
└──────────────────┘         │ • updated_at         │
                             │ • created_by         │
                             │ • notes              │
                             └───────────────────────┘
                                       │
                                       │ 1:N
                                       │
                                       ▼
                      ┌──────────────────────────────────┐
                      │ client_credit_transactions       │
                      │                                  │
                      │ • id (PK)                       │
                      │ • phone_number                  │
                      │ • transaction_type              │
                      │   (CREDIT/DEBIT/REFUND)        │
                      │ • amount                        │
                      │ • balance_before                │
                      │ • balance_after                 │
                      │ • order_id                      │
                      │ • notes                         │
                      │ • created_by                    │
                      │ • created_at                    │
                      └──────────────────────────────────┘
```

---

## Tables détaillées

### 1. **orders** (Table existante)
```sql
Table: orders
├── id                  SERIAL PRIMARY KEY
├── phone_number        VARCHAR(50)  -- Lien vers client_credits
├── client_name         VARCHAR(255)
├── order_type          VARCHAR(50)  -- 'MATA', 'MLC', etc.
├── amount              DECIMAL(10,2)
├── created_at          TIMESTAMP
└── ...
```

**Relation** :
- 1 client (phone_number) peut avoir 0 ou 1 crédit actif
- Lien logique, pas de FOREIGN KEY (pour flexibilité)

---

### 2. **client_credits** (NOUVELLE TABLE)
```sql
Table: client_credits
├── id                  SERIAL PRIMARY KEY
├── phone_number        VARCHAR(50) UNIQUE NOT NULL  -- Clé business
├── credit_amount       DECIMAL(10,2) DEFAULT 0
├── expiration_days     INTEGER DEFAULT 30
├── created_at          TIMESTAMP DEFAULT NOW()
├── expires_at          TIMESTAMP NOT NULL
├── version             INTEGER DEFAULT 1  🔒 Optimistic Locking
├── updated_at          TIMESTAMP DEFAULT NOW()
├── created_by          VARCHAR(100)
├── notes               TEXT
└── INDEXES:
    ├── idx_client_credits_phone (phone_number)
    ├── idx_client_credits_expires_at (expires_at)
    └── idx_client_credits_version (version)
```

**Caractéristiques** :
- ✅ **phone_number** : Clé unique, lien logique avec `orders.phone_number`
- ✅ **version** : Incrémenté automatiquement à chaque UPDATE (Optimistic Locking)
- ✅ **expires_at** : Date d'expiration calculée automatiquement
- ✅ Triggers automatiques pour `updated_at` et `version`

**Triggers** :
1. `trigger_update_client_credits_updated_at` → Met à jour `updated_at`
2. `trigger_increment_client_credits_version` → Incrémente `version` sur UPDATE

---

### 3. **client_credit_transactions** (NOUVELLE TABLE - HISTORIQUE)
```sql
Table: client_credit_transactions
├── id                  SERIAL PRIMARY KEY
├── phone_number        VARCHAR(50) NOT NULL  -- Lien vers client_credits
├── transaction_type    VARCHAR(20) NOT NULL  -- CREDIT/DEBIT/REFUND
├── amount              DECIMAL(10,2) NOT NULL
├── balance_before      DECIMAL(10,2) DEFAULT 0
├── balance_after       DECIMAL(10,2) DEFAULT 0
├── order_id            VARCHAR(100)          -- Lien logique vers orders
├── notes               TEXT
├── created_by          VARCHAR(100)
├── created_at          TIMESTAMP DEFAULT NOW()
└── INDEXES:
    ├── idx_credit_transactions_phone (phone_number)
    ├── idx_credit_transactions_order_id (order_id)
    ├── idx_credit_transactions_type (transaction_type)
    └── idx_credit_transactions_date (created_at DESC)
```

**Types de transactions** :
- `CREDIT` : Attribution de crédit (manager)
- `DEBIT` : Utilisation de crédit (paiement commande)
- `REFUND` : Remboursement (commande annulée)

**Relations** :
- N transactions pour 1 client (phone_number)
- 1 transaction peut être liée à 1 commande (order_id)
- Historique permanent (jamais supprimé)

---

## Vues (Views)

### **valid_client_credits**
```sql
SELECT 
  id, phone_number, credit_amount, version,
  expires_at, days_remaining
FROM client_credits
WHERE expires_at > CURRENT_TIMESTAMP
ORDER BY expires_at ASC;
```
**Usage** : Liste des crédits valides (non expirés)

### **credit_transactions_history**
```sql
SELECT 
  id, phone_number, transaction_type,
  amount, balance_before, balance_after,
  order_id, created_at,
  CASE transaction_type
    WHEN 'CREDIT' THEN '✅ Attribution'
    WHEN 'DEBIT' THEN '💳 Utilisation'
    WHEN 'REFUND' THEN '🔄 Remboursement'
  END as transaction_label
FROM client_credit_transactions
ORDER BY created_at DESC;
```
**Usage** : Historique formaté avec labels lisibles

---

## Flux de données

### 1. Attribution de crédit
```
Manager (Web UI)
    ↓
POST /api/v1/clients/credits
    ↓
[1] INSERT/UPDATE client_credits
    └→ version = 1 (ou incrémenté)
    ↓
[2] INSERT client_credit_transactions
    └→ type = 'CREDIT'
        balance_before = 0
        balance_after = 5000
```

### 2. Utilisation de crédit (avec Optimistic Locking)
```
POS (Caisse)
    ↓
[1] GET /api/external/mata/audit/client
    ↓ Réponse: { credit: { amount: 5000, version: 3 } }
    ↓
[2] POST /api/external/clients/credits/use
    Body: { phone_number, amount_used: 1000, version: 3 }
    ↓
[3] SELECT * FROM client_credits WHERE phone_number = ? FOR UPDATE
    ↓
[4] Vérifier: credit.version === version_envoyée ?
    ├─ OUI → Continuer
    │   ↓
    │   UPDATE client_credits
    │   SET credit_amount = credit_amount - 1000,
    │       version = version + 1  -- 3 → 4
    │   WHERE phone_number = ? AND version = 3
    │   ↓
    │   INSERT client_credit_transactions
    │   (type='DEBIT', balance_before=5000, balance_after=4000)
    │   ↓
    │   ✅ Réponse 200: { success: true, new_version: 4 }
    │
    └─ NON → Conflit !
        ↓
        ❌ Réponse 409: {
            error: "CREDIT_VERSION_MISMATCH",
            current_version: 5,
            current_balance: 3000,
            retry: true
        }
```

### 3. Remboursement (commande annulée)
```
POS (Caisse)
    ↓
POST /api/external/clients/credits/refund
    Body: { phone_number, amount: 1000, order_id, version }
    ↓
UPDATE client_credits
SET credit_amount = credit_amount + 1000
    ↓
INSERT client_credit_transactions
(type='REFUND', balance_before=4000, balance_after=5000)
```

---

## Index Strategy

### Performance optimisée

| Table | Index | Usage |
|-------|-------|-------|
| `client_credits` | `phone_number` (UNIQUE) | Recherche client O(1) |
| `client_credits` | `expires_at` | Nettoyage crédits expirés |
| `client_credits` | `version` | Optimistic Locking |
| `client_credit_transactions` | `phone_number` | Historique client |
| `client_credit_transactions` | `order_id` | Tracer commande |
| `client_credit_transactions` | `created_at DESC` | Trier par date |

---

## Contraintes de sécurité

### Optimistic Locking (Race Condition Prevention)

```sql
UPDATE client_credits
SET 
  credit_amount = $1,
  version = version + 1
WHERE 
  phone_number = $2 
  AND version = $3  -- ← Condition critique
RETURNING *;
```

**Si `version` ne correspond pas** :
- Aucune ligne n'est mise à jour
- `RETURNING *` retourne 0 lignes
- Code 409 retourné au client
- Le POS doit relire le crédit et réessayer

---

## Maintenance

### Nettoyage des crédits expirés

```sql
-- Option 1: Soft delete (marquer expiré)
UPDATE client_credits
SET credit_amount = 0
WHERE expires_at < NOW() AND credit_amount > 0;

-- Option 2: Hard delete (supprimer)
DELETE FROM client_credits
WHERE expires_at < NOW() - INTERVAL '90 days';

-- L'historique dans client_credit_transactions reste permanent
```

### Statistiques

```sql
-- Crédits actifs
SELECT 
  COUNT(*) as total_clients,
  SUM(credit_amount) as total_credits_fcfa,
  AVG(credit_amount) as avg_credit
FROM client_credits
WHERE expires_at > NOW();

-- Transactions par type
SELECT 
  transaction_type,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM client_credit_transactions
GROUP BY transaction_type;
```

---

## 🔗 Relations logiques (sans FOREIGN KEY)

**Pourquoi pas de FOREIGN KEY ?**

1. **Flexibilité** : Un client peut avoir un crédit même sans commande
2. **Performance** : Pas de vérification à chaque INSERT/UPDATE
3. **Découplage** : Les systèmes peuvent évoluer indépendamment

**Intégrité assurée par** :
- ✅ Application (backend controllers)
- ✅ Validation au niveau API
- ✅ Transactions SQL (ACID)

---

📅 **Version** : 2.0  
🔒 **Sécurité** : Optimistic Locking activé  
📊 **Tables** : 2 nouvelles + 2 vues  
🚀 **Prêt pour la production**

