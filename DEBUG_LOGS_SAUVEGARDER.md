# 🔍 Guide: Voir les logs de débogage

## 📋 Logs ajoutés dans `saveCredit()`

J'ai ajouté des logs détaillés à chaque étape de la fonction pour identifier le problème.

---

## 🚀 Comment voir les logs

### Étape 1: Ouvrir la console DevTools

1. Dans votre navigateur, appuyer sur **F12**
2. Aller dans l'onglet **"Console"**
3. Vider la console (icône 🚫 ou CTRL+L)

### Étape 2: Recharger la page

1. Appuyer sur **CTRL + SHIFT + F5** (rechargement complet avec vidage cache)
2. Aller sur "Crédits Clients"
3. Chercher un client (ex: "774593305")

### Étape 3: Cliquer sur "Sauvegarder"

1. Changer le tag (ex: STANDARD → VIP)
2. Cliquer sur "💾 Sauvegarder"
3. **Regarder la console**

---

## 📊 Logs attendus

### Cas 1: Changement de tag uniquement (sans montant)

```
🚀 ========== DÉBUT saveCredit ==========
📞 Téléphone: 774593305
🔍 Éléments trouvés: {amountInput: true, daysInput: true, tagSelect: true}
📊 Valeurs lues: {
  creditAmount: NaN,
  creditAmountRaw: "",
  expirationDays: NaN,
  expirationDaysRaw: "30",
  clientTag: "VIP"
}
✅ Validation: {
  hasAmount: false,
  hasDays: true,
  isNaN_amount: true,
  isNaN_days: false
}
🔶 CAS 2: Mise à jour tag uniquement (aucun montant/délai)
🏷️ Mise à jour tag uniquement: 774593305 - Tag: VIP
👤 Client trouvé: {phone_number: "774593305", ...}
📋 Valeurs utilisées: {
  existingAmount: 1000,
  existingDays: 30,
  clientTag: "VIP"
}
📡 Envoi requête API...
✅ Réponse API reçue: {success: true, ...}
🎉 Succès! Affichage du toast...
🔄 Rechargement de la liste des clients...
✅ Liste rechargée
🏁 ========== FIN saveCredit ==========
```

### Cas 2: Attribution d'un crédit

```
🚀 ========== DÉBUT saveCredit ==========
📞 Téléphone: 774593305
🔍 Éléments trouvés: {amountInput: true, daysInput: true, tagSelect: true}
📊 Valeurs lues: {
  creditAmount: 5000,
  creditAmountRaw: "5000",
  expirationDays: 30,
  expirationDaysRaw: "30",
  clientTag: "VIP"
}
✅ Validation: {
  hasAmount: true,
  hasDays: true,
  isNaN_amount: false,
  isNaN_days: false
}
🔷 CAS 1: Attribuer un crédit (au moins un champ rempli)
💾 Sauvegarde crédit + tag: 774593305 - 5000 FCFA - 30 jours - Tag: VIP
📡 Envoi requête API...
✅ Réponse API reçue: {success: true, ...}
🎉 Succès! Affichage du toast...
🔄 Rechargement de la liste des clients...
✅ Liste rechargée
🏁 ========== FIN saveCredit ==========
```

---

## 🐛 Problèmes possibles et leurs logs

### Problème 1: Fonction non appelée

**Symptôme:** Aucun log dans la console quand vous cliquez sur "Sauvegarder"

**Cause possible:**
- Event listener non attaché
- Bouton désactivé
- JavaScript non chargé

**Debug:**
```javascript
// Dans la console, taper:
document.querySelectorAll('.btn-save-credit').length
// Si = 0, les boutons n'existent pas
```

### Problème 2: Éléments non trouvés

**Logs:**
```
🔍 Éléments trouvés: {amountInput: false, daysInput: true, tagSelect: true}
```

**Cause:** Un des éléments HTML n'existe pas

**Debug:**
```javascript
// Vérifier manuellement
document.getElementById('credit-amount-774593305')
document.getElementById('client-tag-774593305')
```

### Problème 3: Tag non récupéré

**Logs:**
```
📊 Valeurs lues: {
  clientTag: "STANDARD"  // Toujours STANDARD même si vous avez sélectionné VIP
}
```

**Cause:** Le select ne fonctionne toujours pas

**Debug:**
```javascript
const select = document.querySelector('.client-tag-select');
console.log('Value:', select.value);
console.log('Options:', Array.from(select.options).map(o => ({value: o.value, selected: o.selected})));
```

### Problème 4: Erreur API

**Logs:**
```
❌ ========== ERREUR saveCredit ==========
❌ Type: Error
❌ Message: column cc.client_tag does not exist
```

**Cause:** Migration SQL non exécutée

**Solution:** Exécuter `add_client_tags.sql` et redémarrer le backend

### Problème 5: Réponse API non-success

**Logs:**
```
⚠️ Réponse non-success: {success: false, error: "..."}
```

**Cause:** Erreur backend

**Debug:** Regarder les logs du backend

---

## 🔧 Commandes de debug utiles

### Vérifier que la fonction existe

```javascript
typeof saveCredit
// Doit retourner: "function"
```

### Appeler la fonction manuellement

```javascript
saveCredit('774593305')
```

### Vérifier les event listeners

```javascript
document.querySelectorAll('.btn-save-credit').forEach((btn, i) => {
  console.log(`Bouton ${i}:`, btn.dataset.phone);
});
```

### Voir tous les selects de tag

```javascript
document.querySelectorAll('.client-tag-select').forEach((select, i) => {
  console.log(`Select ${i}:`, {
    id: select.id,
    value: select.value,
    disabled: select.disabled
  });
});
```

---

## 📸 Capturer les logs

### Pour m'envoyer les logs:

1. Ouvrir la console (F12)
2. Cliquer sur "Sauvegarder"
3. Attendre que tous les logs apparaissent
4. **Clic droit** dans la console → "Save as..." ou copier tout le texte
5. M'envoyer le fichier ou le texte copié

Ou faire une capture d'écran de la console.

---

## 🎯 Ce que je cherche dans les logs

1. **La fonction est-elle appelée?**
   - Si vous voyez `🚀 ========== DÉBUT saveCredit ==========`, oui

2. **Les éléments sont-ils trouvés?**
   - `🔍 Éléments trouvés` doit avoir tous `true`

3. **Quelles valeurs sont lues?**
   - `📊 Valeurs lues` me montre ce qui est dans les champs

4. **Quel cas est déclenché?**
   - `🔷 CAS 1` ou `🔶 CAS 2`

5. **Y a-t-il une erreur API?**
   - Chercher `❌ ERREUR` ou `⚠️ Réponse non-success`

---

## 🚀 Prochaines étapes

1. **Recharger la page** avec CTRL+SHIFT+F5
2. **Ouvrir la console** (F12)
3. **Cliquer sur Sauvegarder**
4. **Copier tous les logs** qui apparaissent
5. **M'envoyer les logs** pour que je puisse diagnostiquer

---

**Les logs détaillés vont nous dire exactement où est le problème!** 🔍
