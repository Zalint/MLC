# 🚀 Quick Start - Source Connaissance & Analyse Sentiment

## ⚡ Mise en Production en 3 Minutes

### Étape 1 : Base de Données (1 min)
```bash
psql -U postgres -d matix_livreur_preprod -f add_source_connaissance_column.sql
```

### Étape 2 : Installer OpenAI (30 sec)
```bash
cd backend
npm install openai
```

### Étape 3 : Redémarrer (30 sec)
```bash
# Backend
npm restart

# Frontend : Rafraîchir le navigateur (Ctrl+F5)
```

---

## ✅ C'est Prêt !

### Accès aux Fonctionnalités

1. **Colonne Source de Connaissance**
   - 📍 Tableau MATA Mensuel
   - 🎯 Colonne entre "Interne" et "Commentaire"
   - ✏️ Bouton "Modifier Source" dans Actions

2. **Analyse de Sentiment IA**
   - 📍 Tableau MATA Mensuel
   - 🔍 Bouton "Analyse Sentiment" en haut
   - 🤖 Modal avec analyse complète

---

## 🧪 Test Rapide

```bash
# 1. Vérifier la colonne
psql -U postgres -d matix_livreur_preprod -c "\d orders" | grep source

# 2. Tester (Manager/Admin seulement)
- Se connecter
- Aller dans Tableau MATA Mensuel
- Cliquer sur "Modifier Source" → Sélectionner une source → Sauver
- Cliquer sur "🔍 Analyse Sentiment" → Vérifier le modal
```

---

## 💡 Configuration OpenAI (Optionnel)

Votre `.env` contient déjà :
```env
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini
```

✅ **Vous êtes prêt !**

💰 **Coût** : ~$0.0004 par analyse (négligeable)

⚠️ **Si pas de clé OpenAI** : Le système fonctionne en mode analyse basique (sans IA)

---

## 📚 Documentation Complète

- `GUIDE_SOURCE_CONNAISSANCE_ET_ANALYSE_SENTIMENT.md` - Guide complet
- `RESUME_IMPLEMENTATION_COMPLETE.md` - Détails techniques

---

## 🆘 Problème ?

**Colonne n'existe pas** → Exécutez la migration SQL  
**Bouton invisible** → Connectez-vous en Manager/Admin  
**Erreur OpenAI** → L'analyse basique fonctionne automatiquement

---

✨ **C'est tout !** Les deux fonctionnalités sont maintenant disponibles.

