# 🏷️ Le Tag Client dans l'API Audit - Vue Simplifiée

## 📍 Où se trouve le tag?

Le `client_tag` apparaît à **2 endroits** dans la réponse JSON:

---

## ✅ Emplacement 1: `client_info.client_tag`

```json
{
  "client_info": {
    "client_tag": "VIP"   ← ICI
  }
}
```

---

## ✅ Emplacement 2: `client_info.credit.client_tag`

```json
{
  "client_info": {
    "credit": {
      "client_tag": "VIP"   ← ICI AUSSI
    }
  }
}
```

---

## 🧪 Comment tester MAINTENANT

### Windows (PowerShell)

```powershell
.\test_audit_tag.ps1 -PhoneNumber "773289936" -ApiKey "VOTRE_CLE_API"
```

### Linux / Mac

```bash
chmod +x test_audit_tag.sh
./test_audit_tag.sh 773289936 http://localhost:3000 VOTRE_CLE_API
```

### Curl direct

```bash
curl -H "x-api-key: VOTRE_CLE_API" \
  "http://localhost:3000/api/external/mata/audit/client?phone_number=773289936&skip_sentiment=true" \
  | jq '.client_info.client_tag'
```

**Résultat attendu:** `"VIP"` ou `"VVIP"` ou `"STANDARD"`

---

## 📱 Dans votre navigateur

1. Ouvrir `test_client_tags.html`
2. Aller à la section **"2️⃣ Récupérer l'audit client avec tag"**
3. Entrer votre API Key
4. Entrer un numéro de téléphone
5. Cliquer sur "Récupérer Audit"
6. **Le tag s'affichera en gros avec emoji** 👑⭐👤

---

## 📊 Exemple de réponse complète

Voir le fichier: **`exemple_reponse_audit_avec_tag.json`**

Structure résumée:
```json
{
  "success": true,
  "client_info": {
    "name": "Abdoulaye Boucher",
    "phone_number": "773289936",
    
    "client_tag": "VIP",  ← REGARDEZ ICI
    
    "total_orders": 31,
    "credit": {
      "amount": 370000,
      "current_balance": 370000,
      
      "client_tag": "VIP"  ← ET ICI
    }
  }
}
```

---

## 🎯 Valeurs possibles

| Tag | Signification |
|-----|---------------|
| `"STANDARD"` | Client normal 👤 |
| `"VIP"` | Client important ⭐ |
| `"VVIP"` | Client très important 👑 |

---

## ⚡ Tester en 10 secondes

```powershell
# Remplacez YOUR_API_KEY par votre vraie clé
.\test_audit_tag.ps1 -ApiKey "YOUR_API_KEY"
```

Le script va:
- ✅ Faire l'appel API
- ✅ Extraire le tag
- ✅ L'afficher en couleur avec emoji
- ✅ Sauvegarder la réponse complète dans un fichier JSON

---

## 🆘 Si le tag ne s'affiche pas

1. **Vérifier la migration:**
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name='client_credits' AND column_name='client_tag';
   ```

2. **Redémarrer le backend:**
   ```bash
   cd backend && npm restart
   ```

3. **Vérifier un client:**
   ```sql
   SELECT phone_number, client_tag FROM client_credits LIMIT 5;
   ```

---

## 📖 Documentation complète

- **Vue détaillée:** `VISUALISATION_TAG_API.md`
- **Exemple JSON:** `exemple_reponse_audit_avec_tag.json`
- **Guide complet:** `CLIENT_TAGS_GUIDE.md`
- **Test interactif:** Ouvrir `test_client_tags.html`

---

**C'est simple!** Le tag est déjà dans la réponse API. Lancez `test_audit_tag.ps1` pour le voir. 🚀
