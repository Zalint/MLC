# 🔬 Guide - Analyse Approfondie Client MATA avec IA

## 📋 Table des Matières
1. [Vue d'ensemble](#vue-densemble)
2. [Accès à la fonctionnalité](#accès-à-la-fonctionnalité)
3. [Utilisation](#utilisation)
4. [Endpoints Analytics Disponibles](#endpoints-analytics-disponibles)
5. [Exemples de Questions](#exemples-de-questions)
6. [Interprétation des Résultats](#interprétation-des-résultats)
7. [Export des Données](#export-des-données)
8. [Architecture Technique](#architecture-technique)
9. [Sécurité](#sécurité)
10. [Dépannage](#dépannage)

---

## 🎯 Vue d'ensemble

L'**Analyse Approfondie Client MATA avec IA** est une fonctionnalité avancée qui permet de poser des questions en langage naturel sur vos données clients MATA. L'intelligence artificielle (OpenAI) :

1. **Comprend votre question** et détermine l'analyse appropriée
2. **Récupère les données** via des endpoints sécurisés prédéfinis
3. **Interprète les résultats** et fournit des insights actionnables

### ✨ Avantages

- ✅ **Langage naturel** : Posez vos questions comme si vous parliez à un collègue
- ✅ **Sécurisé** : Aucun SQL dynamique, uniquement des endpoints GET prédéfinis
- ✅ **Intelligent** : Interprétation contextuelle des résultats par IA
- ✅ **Exportable** : Téléchargez les résultats en Excel
- ✅ **Rapide** : Analyses optimisées avec questions suggérées

---

## 🔐 Accès à la Fonctionnalité

### Permissions Requises
- **Rôle minimum** : Manager ou Admin
- **Accès** : Page "Tableau MATA mensuel"

### Comment y Accéder

1. Connectez-vous à l'application
2. Naviguez vers l'onglet **"Tableau MATA mensuel"**
3. Cliquez sur le bouton **"🔬 Analyse Approfondie"** (bouton bleu/violet)

---

## 🚀 Utilisation

### Étape 1 : Ouvrir le Modal

Cliquez sur le bouton **"🔬 Analyse Approfondie"** dans la section "Détail des commandes MATA".

### Étape 2 : Choisir une Question

#### Option A : Questions Suggérées (Recommandé)

Six boutons de questions pré-configurées sont disponibles :

- **👤 Clients à 1 commande** : Identifie les clients qui n'ont commandé qu'une seule fois
- **⏰ Inactifs 30 jours** : Liste les clients qui n'ont pas commandé depuis 30 jours
- **🏆 Top 10 clients** : Affiche les 10 meilleurs clients par chiffre d'affaires
- **🆕 Nouveaux clients** : Nouveaux clients du mois en cours
- **⚠️ Risque de churn** : Clients à risque de partir (inactifs depuis 45+ jours)
- **😞 Clients insatisfaits** : Clients avec note de satisfaction < 6

#### Option B : Question Personnalisée

Saisissez votre propre question dans la zone de texte (max 500 caractères).

**Exemples de questions personnalisées :**
- "Quels clients ont dépensé plus de 100 000 FCFA ?"
- "Clients qui commandent le plus souvent"
- "Distribution des clients par point de vente"
- "Clients qui ont commandé un vendredi à Ngor"

### Étape 3 : Lancer l'Analyse

Cliquez sur **"🔍 Analyser"** ou appuyez sur **Ctrl + Enter**.

### Étape 4 : Consulter les Résultats

L'IA affichera :

1. **📊 Résumé** : Vue d'ensemble en 2-3 phrases
2. **💡 Insights clés** : Patterns et tendances identifiés
3. **✅ Recommandation** : Action concrète à entreprendre
4. **📋 Résultats détaillés** : Tableau complet des données

---

## 📊 Endpoints Analytics Disponibles

### 1. **Clients à Commande Unique**
- **Question type** : "Clients qui n'ont commandé qu'une fois"
- **Données retournées** : Nom, téléphone, date commande, montant, point de vente, source

### 2. **Clients Inactifs**
- **Question type** : "Clients inactifs depuis X jours"
- **Paramètre** : Nombre de jours (défaut: 30)
- **Données retournées** : Nom, téléphone, dernière commande, jours d'inactivité, total commandes

### 3. **Top Clients**
- **Question type** : "Top N meilleurs clients"
- **Paramètres** : Nombre de clients (défaut: 10), période (all ou mois)
- **Données retournées** : Nom, téléphone, nombre commandes, montant total, panier moyen

### 4. **Nouveaux Clients**
- **Question type** : "Nouveaux clients du mois"
- **Paramètre** : Mois (YYYY-MM)
- **Données retournées** : Nom, téléphone, première commande, montant, point de vente, source

### 5. **Taux de Rétention**
- **Question type** : "Taux de rétention mensuel"
- **Paramètres** : Mois de début, mois de fin
- **Données retournées** : Clients par mois, clients revenus, taux de rétention %

### 6. **Distribution par Point de Vente**
- **Question type** : "Clients par point de vente"
- **Données retournées** : Point de vente, clients uniques, commandes, CA, panier moyen

### 7. **Clients à Forte Valeur**
- **Question type** : "Clients qui ont dépensé plus de X FCFA"
- **Paramètre** : Montant minimum (défaut: 100 000)
- **Données retournées** : Nom, téléphone, commandes, total dépensé, panier moyen

### 8. **Clients Fréquents**
- **Question type** : "Clients qui commandent souvent"
- **Paramètre** : Nombre minimum de commandes (défaut: 5)
- **Données retournées** : Nom, téléphone, nombre commandes, total dépensé, jours entre commandes

### 9. **Risque de Churn**
- **Question type** : "Clients à risque de partir"
- **Paramètre** : Seuil de jours (défaut: 45)
- **Données retournées** : Nom, téléphone, dernière commande, jours inactivité, niveau de risque

### 10. **Satisfaction Client**
- **Question type** : "Clients satisfaits/insatisfaits"
- **Paramètres** : Note min/max (0-10)
- **Données retournées** : Nom, téléphone, notes moyennes, niveau de satisfaction

### 11. **Distribution par Jour de Semaine**
- **Question type** : "Quel jour de la semaine les clients commandent-ils le plus ?"
- **Données retournées** : Jour, nombre commandes, clients uniques, CA

### 12. **Valeur Vie Client (CLV)**
- **Question type** : "Meilleurs clients par valeur vie"
- **Paramètre** : Top N (défaut: 20)
- **Données retournées** : Nom, téléphone, commandes, CA total, durée relation, valeur mensuelle

### 13. **Détails Complets (Fallback)**
- **Question type** : Questions complexes nécessitant tous les détails
- **Paramètres** : Date début, date fin
- **Données retournées** : Tous les champs disponibles (client, commande, notes, etc.)

---

## 💡 Exemples de Questions

### Questions Simples (Endpoints Spécifiques)

```
✅ "Quels clients n'ont commandé qu'une fois ?"
   → Endpoint: /one-time-customers

✅ "Clients inactifs depuis 30 jours"
   → Endpoint: /inactive-customers?days=30

✅ "Top 10 meilleurs clients"
   → Endpoint: /top-customers?limit=10

✅ "Clients qui ont dépensé plus de 100 000 FCFA"
   → Endpoint: /high-value-customers?min_amount=100000

✅ "Clients qui commandent au moins 5 fois"
   → Endpoint: /frequent-customers?min_orders=5

✅ "Clients à risque de churn"
   → Endpoint: /churn-risk?threshold_days=45

✅ "Clients avec note inférieure à 6"
   → Endpoint: /customer-satisfaction?min_rating=0&max_rating=6

✅ "Distribution des clients par point de vente"
   → Endpoint: /customers-by-point-vente
```

### Questions Complexes (Endpoint Fallback)

```
✅ "Clients qui ont commandé le vendredi"
   → Endpoint: /orders-detailed (avec filtrage post-traitement)

✅ "Clients qui ont commandé à Ngor en septembre"
   → Endpoint: /orders-detailed (avec filtrage post-traitement)

✅ "Clients découverts via TikTok avec note > 8"
   → Endpoint: /orders-detailed (avec filtrage post-traitement)
```

### Questions Non Supportées

```
❌ "Supprimer tous les clients"
   → REFUSÉ (pas de DELETE)

❌ "Modifier les montants des commandes"
   → REFUSÉ (pas de UPDATE)

❌ "Créer un nouveau client"
   → REFUSÉ (pas de CREATE)
```

---

## 📈 Interprétation des Résultats

### Structure de la Réponse IA

#### 1. Résumé
Une vue d'ensemble concise des résultats (2-3 phrases).

**Exemple :**
> "J'ai trouvé 45 clients qui n'ont commandé qu'une seule fois ce mois-ci. Ces clients représentent 22% de votre base client et un potentiel de 3,2 millions FCFA si vous arrivez à les fidéliser."

#### 2. Insights Clés
2-3 observations importantes (patterns, tendances, anomalies).

**Exemple :**
- "65% de ces clients ont découvert MATA via les réseaux sociaux (TikTok/Facebook)"
- "Le panier moyen de ces clients (71 000 FCFA) est supérieur à la moyenne globale"
- "80% ont commandé le weekend, suggérant une clientèle occasionnelle"

#### 3. Recommandation
Action concrète et actionnable basée sur les données.

**Exemple :**
> "Mettre en place une campagne de relance automatique par SMS 7 jours après la première commande avec un code promo de 10% pour encourager la deuxième commande. Ciblez particulièrement les clients weekend avec des offres valables en semaine."

#### 4. Tableau de Données
Données complètes formatées pour une lecture facile.

### Légende des Indicateurs

| Indicateur | Signification |
|------------|---------------|
| 🆕 Nouveau | Première commande |
| 🔄 Récurrent | A déjà commandé |
| ⚠️ Risque Élevé | Churn imminent |
| 🟠 Risque Moyen | Surveiller |
| 🟢 Risque Faible | Client actif |
| 😊 Très satisfait | Note ≥ 9 |
| 🙂 Satisfait | Note 7-8 |
| 😐 Neutre | Note 5-6 |
| 😞 Insatisfait | Note < 5 |

---

## 📥 Export des Données

### Format d'Export
- **Format** : CSV (compatible Excel)
- **Encodage** : UTF-8 avec BOM
- **Séparateur** : Point-virgule (;)

### Comment Exporter

1. Après avoir reçu les résultats d'analyse
2. Cliquez sur **"📥 Exporter Excel"** en haut à droite
3. Le fichier se télécharge automatiquement

### Nom du Fichier
```
Analyse_[question_résumée]_[YYYY-MM-DD].csv
```

**Exemple :**
```
Analyse_Clients_inactifs_30j_2025-10-11.csv
```

### Contenu du Fichier

Toutes les colonnes du tableau de résultats sont exportées :
- Noms de colonnes en français (première ligne)
- Données formatées (nombres avec séparateurs, devises, badges)
- Tri identique à l'affichage

---

## 🏗️ Architecture Technique

### Flux de Traitement

```
┌─────────────────────────────────────────────────────────────┐
│  1. FRONTEND: Question posée par l'utilisateur              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  2. ORCHESTRATEUR: POST /orders/mata-deep-analysis          │
│     - Envoie la question à OpenAI                           │
│     - OpenAI retourne l'endpoint approprié + paramètres     │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  3. VALIDATION: Vérification de la whitelist                │
│     - Endpoint fait partie des 13 autorisés ?               │
│     - Paramètres valides ?                                  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  4. ANALYTICS API: GET /mata-analytics/[endpoint]           │
│     - Exécution de la requête SQL prédéfinie                │
│     - Retour des données brutes                             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  5. INTERPRÉTATION: OpenAI analyse les résultats            │
│     - Résumé                                                │
│     - Insights                                              │
│     - Recommandation                                        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  6. FRONTEND: Affichage des résultats enrichis              │
└─────────────────────────────────────────────────────────────┘
```

### Technologies Utilisées

**Backend :**
- Node.js + Express.js
- PostgreSQL (requêtes READ ONLY)
- OpenAI API (GPT-4o-mini)
- Axios (appels HTTP internes)

**Frontend :**
- Vanilla JavaScript
- Fetch API
- CSS3 (animations, gradients)

---

## 🔒 Sécurité

### Mesures de Sécurité Implémentées

#### 1. Aucun SQL Dynamique
❌ **Pas de risque d'injection SQL**
- Toutes les requêtes SQL sont prédéfinies dans le code
- L'IA ne génère JAMAIS de SQL
- L'IA choisit uniquement un endpoint existant

#### 2. Whitelist Stricte
✅ **13 endpoints autorisés uniquement**
- L'orchestrateur valide que l'endpoint suggéré par l'IA existe
- Tout endpoint hors liste est rejeté

#### 3. GET Uniquement
✅ **Lecture seule**
- Aucune modification de données possible
- Pas de DELETE, UPDATE, INSERT

#### 4. Validation des Paramètres
✅ **Types et limites validés**
- Nombres : min/max vérifiés
- Dates : format YYYY-MM-DD validé
- Limites : max 5000 résultats

#### 5. Rate Limiting
✅ **Protection contre les abus**
- 10 requêtes par minute par utilisateur
- Timeout de 30 secondes par analyse

#### 6. Authentification Requise
✅ **Managers et Admins uniquement**
- Middleware `requireManagerOrAdmin`
- Token JWT vérifié

#### 7. Transactions READ ONLY
✅ **Base de données protégée**
- Connexion en lecture seule
- Isolation des transactions

#### 8. Logs Complets
✅ **Traçabilité**
- Toutes les questions sont loggées
- Endpoints appelés enregistrés
- Erreurs tracées

---

## 🛠️ Dépannage

### Problème : "Service d'IA non configuré"

**Cause :** La clé API OpenAI n'est pas définie dans le fichier `.env`.

**Solution :**
1. Vérifiez que `OPENAI_API_KEY` existe dans `.env`
2. Redémarrez le serveur backend
3. Contactez l'administrateur si le problème persiste

---

### Problème : "Question non comprise"

**Cause :** La question est trop vague ou ne correspond à aucun endpoint.

**Solution :**
1. Reformulez votre question plus simplement
2. Utilisez les questions suggérées
3. Exemples de reformulation :
   - ❌ "Montrez-moi des choses sur les clients"
   - ✅ "Quels sont les 10 meilleurs clients ?"

---

### Problème : "Aucun résultat trouvé"

**Cause :** Les critères de recherche ne retournent aucune donnée.

**Solution :**
1. Élargissez vos critères (ex: 30 jours → 60 jours)
2. Changez la période analysée
3. Vérifiez que des données MATA existent pour la période

---

### Problème : "Timeout lors de l'analyse"

**Cause :** L'analyse prend trop de temps (> 30 secondes).

**Solution :**
1. Réduisez la période analysée
2. Limitez le nombre de résultats
3. Réessayez plus tard si le serveur est surchargé

---

### Problème : Modal ne s'affiche pas

**Cause :** Problème de cache CSS ou JavaScript.

**Solution :**
1. Videz le cache du navigateur (Ctrl + F5)
2. Vérifiez que `deep-analysis.js` est bien chargé (F12 → Console)
3. Vérifiez qu'il n'y a pas d'erreurs JavaScript

---

### Problème : "Erreur 401 Unauthorized"

**Cause :** Votre session a expiré ou vous n'avez pas les permissions.

**Solution :**
1. Reconnectez-vous à l'application
2. Vérifiez que votre compte a le rôle Manager ou Admin
3. Contactez l'administrateur pour une élévation de privilèges

---

## 📞 Support

### Contact

En cas de problème technique non résolu :
1. Notez le message d'erreur exact
2. Notez la question que vous avez posée
3. Notez la date et l'heure
4. Contactez l'équipe support

### Logs pour Debug

Les administrateurs peuvent consulter les logs backend pour diagnostiquer :
```bash
# Logs de l'orchestrateur
🤖 Deep Analysis - Question: [votre question]
🎯 Endpoint choisi: [endpoint]
📊 Paramètres: [params]

# Logs OpenAI
🤖 OpenAI mapping response: [réponse JSON]
🤖 OpenAI interpretation: [interprétation]
```

---

## 📝 Notes de Version

### v1.0.0 (Octobre 2025)
- ✨ Version initiale
- 🔬 13 endpoints analytics prédéfinis
- 🤖 Intégration OpenAI GPT-4o-mini
- 🎯 Questions suggérées
- 📥 Export Excel
- 🔒 Sécurité renforcée (GET only, whitelist, READ ONLY)

---

## 🎓 Bonnes Pratiques

### Pour des Analyses Efficaces

1. **Commencez par les questions suggérées** pour comprendre les possibilités
2. **Soyez spécifique** dans vos questions personnalisées
3. **Utilisez des critères mesurables** (montants, jours, nombres)
4. **Exportez les résultats** pour analyse approfondie dans Excel
5. **Agissez sur les recommandations IA** rapidement

### Exemples de Workflow

#### Workflow 1 : Fidélisation
```
1. "Clients à 1 commande" → Identifier les clients occasionnels
2. Analyser leurs caractéristiques (source, jour, panier)
3. "Clients à risque de churn" → Identifier ceux qui risquent de partir
4. Mettre en place des actions de relance ciblées
5. Suivre l'évolution avec "Taux de rétention mensuel"
```

#### Workflow 2 : Maximiser le CA
```
1. "Top 10 clients" → Identifier les VIP
2. "Clients à forte valeur" → Élargir la base VIP
3. Analyser leurs habitudes (jour, point de vente)
4. Reproduire les conditions de succès
5. "Valeur vie client" → Suivre l'évolution
```

#### Workflow 3 : Satisfaction
```
1. "Clients insatisfaits" → Identifier les problèmes
2. Analyser les commentaires et notes détaillés
3. Mettre en place des actions correctives
4. "Distribution par satisfaction" → Suivre l'amélioration
5. "Taux de rétention" → Mesurer l'impact
```

---

**🎉 Profitez de l'analyse approfondie pour mieux comprendre et fidéliser vos clients MATA !**

