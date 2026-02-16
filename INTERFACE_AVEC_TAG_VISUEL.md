# 🎨 Interface avec Tag Client - Vue Visuelle

## 📱 Carte Client AVANT les modifications

```
┌─────────────────────────────────────────────────────────────────┐
│ 📱 776251781                               1,900 FCFA            │
│ 👤 Ait salou                               ⏱️ 29 jours restants │
│ 📦 24 commandes   260,850 FCFA                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Montant du crédit (FCFA)  | Délai (jours) | 💾 Sauvegarder      │
│ [  1900.00  ]             | [    30    ]  | [🗑️ Supprimer ]     │
│                                            | [📜 Historique]     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📱 Carte Client APRÈS les modifications

```
┌─────────────────────────────────────────────────────────────────┐
│ 📱 776251781                               1,900 FCFA            │
│ 👤 Ait salou                               ⏱️ 29 jours restants │
│ 📦 24 commandes   260,850 FCFA                                   │
│                                                                   │
│ ⭐ VIP  ← NOUVEAU BADGE (coloré)                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Montant du crédit | Délai (jours) | 🏷️ Tag Client | Actions    │
│ [  1900.00  ]     | [    30    ]  | [⭐ VIP ▼]  | 💾 Sauvegar. │
│                                                   | 🗑️ Supprimer │
│                                                   | 📜 Historique│
│                      ▲                    ▲                       │
│                      │                    │                       │
│                   EXISTANT          NOUVEAU CHAMP                 │
└─────────────────────────────────────────────────────────────────┘

Options du sélecteur 🏷️ Tag Client :
┌──────────────┐
│ 👤 STANDARD  │
│ ⭐ VIP       │ ← sélectionné
│ 👑 VVIP      │
└──────────────┘
```

---

## 🎨 Apparence des Badges

### Badge STANDARD (gris)
```
┌─────────────┐
│ 👤 Standard │  Background: #E0E0E0  Color: #666
└─────────────┘
```

### Badge VIP (or)
```
┌─────────┐
│ ⭐ VIP  │  Background: #FFD700  Color: #000
└─────────┘
```

### Badge VVIP (rose vif)
```
┌──────────┐
│ 👑 VVIP  │  Background: #FF1493  Color: #FFF
└──────────┘
```

---

## 📱 Vue Mobile (< 768px)

En mode mobile, les champs passent en colonne unique:

```
┌───────────────────────────┐
│ 📱 776251781              │
│ 👤 Ait salou              │
│ 📦 24 commandes           │
│    260,850 FCFA           │
│                           │
│ ⭐ VIP                    │
├───────────────────────────┤
│                           │
│ Montant du crédit (FCFA)  │
│ [       1900.00       ]   │
│                           │
│ ⏱️ Délai d'expiration     │
│ [         30          ]   │
│                           │
│ 🏷️ Tag Client            │
│ [     ⭐ VIP  ▼      ]    │
│                           │
│ [ 💾 Sauvegarder ]        │
│                           │
│ [ 🗑️ Supprimer ]          │
│                           │
│ [ 📜 Historique ]         │
└───────────────────────────┘
```

---

## 🎬 Scénario d'utilisation

### 1. Ouvrir la page Crédits Clients

```
Tableau MATA Mensuel
    │
    ├─ [Bouton: Crédits Clients] ← Cliquer ici
    │
    └─ Page Crédits Clients s'ouvre
```

### 2. Trouver un client

```
🔍 Rechercher par numéro ou nom
[  Ait salou  ] [❌]

Résultats: 1 client trouvé

┌─────────────────────────┐
│ 📱 776251781            │ ← Votre client
│ 👤 Ait salou            │
│ ⭐ VIP                  │
└─────────────────────────┘
```

### 3. Modifier le tag

```
1. Cliquer sur le sélecteur "🏷️ Tag Client"
   
   ┌──────────────┐
   │ 👤 STANDARD  │
   │ ⭐ VIP       │ ← Actuellement sélectionné
   │ 👑 VVIP      │ ← Cliquer pour changer en VVIP
   └──────────────┘

2. Le sélecteur change:
   [👑 VVIP ▼]

3. Cliquer sur "💾 Sauvegarder"

4. Toast de confirmation:
   ✅ Crédit de 1,900 FCFA attribué à 776251781

5. Le badge se met à jour:
   👑 VVIP  ← Maintenant VVIP au lieu de VIP!
```

---

## 🎨 Code HTML Généré (exemple)

```html
<!-- Badge (en haut de la carte) -->
<div style="margin-top: 0.75rem;">
  <span style="
    display: inline-block;
    padding: 0.4rem 0.8rem;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 600;
    background: #FFD700;
    color: #000;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  ">
    ⭐ VIP
  </span>
</div>

<!-- Sélecteur (dans le formulaire) -->
<div class="form-group">
  <label for="client-tag-776251781">🏷️ Tag Client</label>
  <select 
    id="client-tag-776251781" 
    class="form-control"
    style="padding: 0.5rem; border-radius: 4px; border: 1px solid #ddd;"
  >
    <option value="STANDARD">👤 STANDARD</option>
    <option value="VIP" selected>⭐ VIP</option>
    <option value="VVIP">👑 VVIP</option>
  </select>
</div>
```

---

## 📊 Grille du formulaire

### Desktop (> 768px)
```
┌──────────┬─────────┬───────────┬──────────┬──────────┬───────────┐
│ Montant  │ Délai   │ Tag       │ Sauveg.  │ Suppr.   │ Historique│
│ (2fr)    │ (1fr)   │ (1fr)     │ (auto)   │ (auto)   │ (auto)    │
└──────────┴─────────┴───────────┴──────────┴──────────┴───────────┘
   Large     Moyen     Moyen       Bouton     Bouton     Bouton
```

### Mobile (< 768px)
```
┌─────────────────────┐
│ Montant             │
│ (1fr - pleine larg.)│
├─────────────────────┤
│ Délai               │
│ (1fr - pleine larg.)│
├─────────────────────┤
│ Tag                 │
│ (1fr - pleine larg.)│
├─────────────────────┤
│ Sauvegarder         │
├─────────────────────┤
│ Supprimer           │
├─────────────────────┤
│ Historique          │
└─────────────────────┘
```

---

## ✨ Animations et Interactions

### Hover sur le badge
```
Normal:   ⭐ VIP
          └─ shadow: 0 2px 4px rgba(0,0,0,0.1)

Hover:    ⭐ VIP
          └─ shadow: 0 4px 8px rgba(0,0,0,0.2)
          └─ légère élévation (optionnel)
```

### Sélecteur ouvert
```
[⭐ VIP ▼]  ← État fermé

Clic ↓

┌──────────────┐
│ [⭐ VIP ▼]  │  ← État ouvert
├──────────────┤
│ 👤 STANDARD  │ ← Hover: background clair
│ ⭐ VIP       │ ← Sélectionné: background bleu
│ 👑 VVIP      │ ← Normal
└──────────────┘
```

---

## 🚀 Test rapide

```bash
# 1. Ouvrir les DevTools (F12)
# 2. Aller dans Console
# 3. Taper:

document.querySelector('#client-tag-776251781').value
// Devrait afficher: "VIP"

document.querySelector('#client-tag-776251781').value = 'VVIP'
// Change le tag en VVIP

// 4. Cliquer sur Sauvegarder
// 5. Vérifier la console:
💾 Sauvegarde crédit: 776251781 - 1900 FCFA - 30 jours - Tag: VVIP
```

---

## 📖 Fichiers associés

- **Code source:** `frontend/js/client-credits.js`
- **Guide détaillé:** `GUIDE_TAG_UI.md`
- **Documentation API:** `CLIENT_TAGS_GUIDE.md`
- **Migration SQL:** `add_client_tags.sql`

---

**🎨 L'interface est maintenant prête!** Rechargez avec CTRL+F5 pour voir les changements.
