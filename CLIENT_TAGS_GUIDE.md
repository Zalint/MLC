# 🏷️ Guide du Système de Tags Clients

## Vue d'ensemble

Le système de tags permet de catégoriser les clients MATA selon leur importance :
- **STANDARD** : Client normal (par défaut)
- **VIP** : Client important
- **VVIP** : Client très important (priorité maximale)

---

## 📋 Installation

### 1. Exécuter le script SQL

```bash
psql -U matix_user -d matix_livreur -f add_client_tags.sql
```

Ou via un client SQL (pgAdmin, DBeaver, etc.) en exécutant le contenu de `add_client_tags.sql`.

### 2. Redémarrer le backend

```bash
cd backend
npm restart
# ou
pm2 restart matix-backend
```

---

## 🔌 API

### 1. Attribuer/Mettre à jour un crédit avec tag

**Endpoint:** `POST /api/v1/clients/credits`

**Headers:**
```json
{
  "Authorization": "Bearer YOUR_JWT_TOKEN",
  "Content-Type": "application/json"
}

```

**Body:**
```json
{
  "phone_number": "773289936",
  "credit_amount": 50000,
  "expiration_days": 30,
  "client_tag": "VIP",
  "notes": "Client fidèle - commandes régulières"
}
```

**Réponse:**
```json
{
  "success": true,
  "message": "Crédit attribué avec succès",
  "credit": {
    "id": 12,
    "phone_number": "773289936",
    "credit_amount": 50000,
    "client_tag": "VIP",
    "expires_at": "2026-03-04T10:30:00.000Z",
    "expiration_days": 30,
    "created_by": "admin",
    "version": 1
  }
}
```

---

### 2. Récupérer l'audit client avec tag

**Endpoint:** `GET /api/external/mata/audit/client?phone_number=773289936`

**Headers:**
```json
{
  "x-api-key": "YOUR_API_KEY"
}
```

**Réponse:**
```json
{
  "success": true,
  "phone_number": "773289936",
  "client_info": {
    "name": "Abdoulaye Boucher",
    "phone_number": "773289936",
    "client_tag": "VIP",
    "first_order": "2025-01-05",
    "last_order": "2026-02-01",
    "total_orders": 31,
    "credit": {
      "amount": 370000,
      "current_balance": 370000,
      "expires_at": "2026-03-15T00:00:00.000Z",
      "is_expired": false,
      "days_remaining": 41,
      "client_tag": "VIP"
    }
  },
  "orders_history": [...],
  "sentiment_analysis": {...},
  "statistics": {...}
}
```

---

### 3. Liste des clients MATA avec tags

**Endpoint:** `GET /api/v1/clients/mata-list`

**Réponse:**
```json
{
  "success": true,
  "count": 708,
  "clients": [
    {
      "phone_number": "773289936",
      "primary_name": "Abdoulaye Boucher",
      "client_tag": "VIP",
      "total_orders": 31,
      "total_spent": 1045100,
      "current_credit": 370000,
      "days_remaining": 41
    },
    {
      "phone_number": "774593305",
      "primary_name": "4 kg boeuf",
      "client_tag": "STANDARD",
      "total_orders": 1,
      "total_spent": 14800,
      "current_credit": 0,
      "days_remaining": 0
    }
  ]
}
```

---

## 🗄️ Requêtes SQL Utiles

### Lister les clients par tag

```sql
SELECT 
  phone_number,
  credit_amount,
  client_tag,
  expires_at
FROM client_credits
WHERE client_tag = 'VIP'
ORDER BY credit_amount DESC;
```

### Statistiques par tag

```sql
SELECT 
  client_tag,
  COUNT(*) as nombre_clients,
  SUM(credit_amount) as total_credits,
  AVG(credit_amount) as credit_moyen
FROM client_credits
GROUP BY client_tag
ORDER BY 
  CASE client_tag
    WHEN 'VVIP' THEN 1
    WHEN 'VIP' THEN 2
    WHEN 'STANDARD' THEN 3
  END;
```

### Mettre à jour un tag manuellement

```sql
UPDATE client_credits 
SET client_tag = 'VVIP'
WHERE phone_number = '773289936';
```

### Clients VIP/VVIP avec crédit actif

```sql
SELECT 
  phone_number,
  credit_amount,
  client_tag,
  EXTRACT(DAY FROM (expires_at - CURRENT_TIMESTAMP))::INTEGER as jours_restants
FROM client_credits
WHERE client_tag IN ('VIP', 'VVIP')
  AND expires_at > CURRENT_TIMESTAMP
ORDER BY credit_amount DESC;
```

---

## 📊 Cas d'Usage

### 1. Identifier les VIP automatiquement

Vous pouvez créer un script pour taguer automatiquement les clients selon des critères :

```sql
-- Taguer VIP les clients avec plus de 10 commandes ou 500k FCFA de total
UPDATE client_credits cc
SET client_tag = 'VIP'
FROM (
  SELECT 
    phone_number,
    COUNT(*) as total_orders,
    SUM(amount) as total_spent
  FROM orders
  WHERE order_type = 'MATA'
  GROUP BY phone_number
  HAVING COUNT(*) >= 10 OR SUM(amount) >= 500000
) stats
WHERE cc.phone_number = stats.phone_number
  AND cc.client_tag = 'STANDARD';
```

### 2. Filtrer dans l'interface

Frontend peut filtrer les clients par tag :

```javascript
// Récupérer tous les clients
const response = await fetch('/api/v1/clients/mata-list');
const { clients } = await response.json();

// Filtrer les VIP
const vipClients = clients.filter(c => c.client_tag === 'VIP' || c.client_tag === 'VVIP');

// Afficher avec badge
clients.forEach(client => {
  const badge = {
    'VVIP': '👑 VVIP',
    'VIP': '⭐ VIP',
    'STANDARD': ''
  }[client.client_tag];
  
  console.log(`${client.primary_name} ${badge}`);
});
```

---

## 🎨 Suggestions d'Affichage Frontend

### Badges de couleur

```javascript
const tagColors = {
  'VVIP': { bg: '#FF1493', color: '#FFF', icon: '👑' },  // Rose vif
  'VIP': { bg: '#FFD700', color: '#000', icon: '⭐' },    // Or
  'STANDARD': { bg: '#E0E0E0', color: '#666', icon: '' }  // Gris
};
```

### Exemple HTML

```html
<div class="client-card">
  <span class="client-name">Abdoulaye Boucher</span>
  <span class="badge badge-vip">⭐ VIP</span>
  <span class="credit">370,000 FCFA</span>
</div>
```

### CSS

```css
.badge-vvip {
  background: #FF1493;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: bold;
}

.badge-vip {
  background: #FFD700;
  color: black;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: bold;
}
```

---

## ✅ Checklist de Déploiement

- [ ] Exécuter `add_client_tags.sql` sur la base de données
- [ ] Vérifier que la colonne `client_tag` existe dans `client_credits`
- [ ] Redémarrer le backend
- [ ] Tester l'API `/api/v1/clients/credits` avec `client_tag`
- [ ] Tester l'API `/api/external/mata/audit/client` pour voir le tag
- [ ] Mettre à jour le frontend pour afficher les badges
- [ ] (Optionnel) Créer un script pour taguer automatiquement les clients existants

---

## 🔧 Maintenance

### Ajouter un nouveau tag (ex: GOLD)

```sql
-- Modifier la contrainte
ALTER TABLE client_credits 
DROP CONSTRAINT client_credits_client_tag_check;

ALTER TABLE client_credits 
ADD CONSTRAINT client_credits_client_tag_check 
CHECK (client_tag IN ('STANDARD', 'VIP', 'VVIP', 'GOLD'));

-- Mettre à jour le backend (clientCreditsController.js)
// Ligne 136 : Ajouter 'GOLD' dans la validation
if (client_tag && !['STANDARD', 'VIP', 'VVIP', 'GOLD'].includes(client_tag)) {
  ...
}
```

---

## 📞 Support

Pour toute question ou problème, contactez l'équipe technique.

**Version:** 1.0  
**Date:** 2026-02-02
