# 📍 Guide - Configuration des Heures de Tracking GPS

## 🎯 Vue d'ensemble

Le système permet maintenant de **configurer les heures de tracking GPS par livreur** avec des restrictions horaires personnalisables.

## ✅ Configuration par défaut

- **Heures** : 9h00 - 21h00 (fuseau horaire Dakar)
- **Jours** : Lundi à Dimanche (0,1,2,3,4,5,6)
- **Timezone** : Africa/Dakar (GMT+0)
- **Statut** : Activé par défaut

## 🔧 Fonctionnement technique

### Backend - Vérification automatique

Quand un livreur envoie sa position GPS :

1. ✅ **Vérification du jour** : Est-ce un jour autorisé ?
2. ✅ **Vérification de l'heure** : Dans la plage configurée ?
3. ✅ **Vérification de l'activation** : GPS activé pour ce livreur ?

Si **UNE** condition échoue → **Position GPS refusée** avec code `TRACKING_HOURS_RESTRICTED`

### Configuration des colonnes

```sql
-- Nouvelles colonnes ajoutées à la table users
tracking_start_hour INTEGER DEFAULT 9           -- Heure de début (0-23)
tracking_end_hour INTEGER DEFAULT 21            -- Heure de fin (0-23)  
tracking_timezone VARCHAR(50) DEFAULT 'Africa/Dakar'  -- Fuseau horaire
tracking_enabled_days VARCHAR(20) DEFAULT '0,1,2,3,4,5,6'  -- Jours actifs
gps_tracking_active BOOLEAN DEFAULT true        -- Activation individuelle
```

## 🎨 Interface utilisateur

### Page "Suivi GPS" - Section "Configuration des heures de tracking"

#### Pour les managers/admins :

1. **Sélection du livreur** : Dropdown avec statut et heures actuelles
2. **Configuration des heures** : 
   - Heure de début (0-23h)
   - Heure de fin (0-23h)
3. **Sélection des jours** : Checkboxes Lundi-Dimanche
4. **Activation/Désactivation** : Toggle pour le tracking GPS
5. **Boutons** : Sauvegarder / Réinitialiser

#### Affichage du statut :
- 🟢 `Nom Livreur (9h-21h)` = Actif
- 🔴 `Nom Livreur (9h-21h)` = Désactivé

## 📡 Endpoints API

### Récupérer toutes les configurations
```
GET /api/v1/gps/tracking-configs
Authorization: Bearer <token>
```

### Récupérer une configuration spécifique  
```
GET /api/v1/gps/tracking-config/:livreur_id
Authorization: Bearer <token>
```

### Mettre à jour une configuration
```
PUT /api/v1/gps/tracking-config/:livreur_id
Authorization: Bearer <token>
Content-Type: application/json

{
  "tracking_start_hour": 8,
  "tracking_end_hour": 22,
  "tracking_enabled_days": [1,2,3,4,5],
  "gps_tracking_active": true
}
```

## 🧪 Test et validation

### Vérifier le fonctionnement

1. **Console backend** : Les logs montrent les vérifications
```
⏰ Heure actuelle à Dakar: 21:54 (21h)
📅 Jour actuel: 5 (Vendredi)
🕒 Plage horaire autorisée: 9h - 21h
🔴 Tracking GPS non autorisé en dehors des heures (21h)
```

2. **Interface frontend** : 
   - Aller sur "Suivi GPS" 
   - Section "⏰ Configuration des heures de tracking"
   - Tester les modifications

### Scénarios de test

- ✅ **En heures** : 10h un mardi → Position acceptée
- ❌ **Hors heures** : 22h un mardi → Position refusée  
- ❌ **Jour interdit** : 10h un dimanche → Position refusée
- ❌ **GPS désactivé** : N'importe quand → Position refusée

## 🔄 Migration et mise en production

### Déjà fait ✅
- ✅ Colonnes ajoutées à la base de données
- ✅ Valeurs par défaut configurées pour tous les livreurs
- ✅ Backend fonctionnel avec vérification automatique
- ✅ Interface de configuration opérationnelle

### À faire si besoin
- Ajuster les heures par défaut selon les besoins
- Modifier la timezone si nécessaire
- Configurer des plages différentes par livreur

## 🛠️ Personnalisation

### Exemple : Livreur de nuit
```javascript
// Modifier via l'interface ou l'API
{
  "tracking_start_hour": 20,      // 20h
  "tracking_end_hour": 6,         // 6h (du lendemain)
  "tracking_enabled_days": [0,1,2,3,4,5,6], // Tous les jours
  "gps_tracking_active": true
}
```

### Exemple : Livreur weekend  
```javascript
{
  "tracking_start_hour": 9,
  "tracking_end_hour": 18,
  "tracking_enabled_days": [6,0], // Samedi et Dimanche seulement
  "gps_tracking_active": true
}
```

## 🚨 Gestion des erreurs

### Côté livreur (app mobile)
- Code retour `403` avec `TRACKING_HOURS_RESTRICTED`
- Message : "Tracking GPS non autorisé en dehors des heures configurées"

### Côté manager  
- Interface montre le statut en temps réel
- Logs détaillés dans la console

## 📞 Support

### Debugging
1. Vérifier les logs backend pour les vérifications horaires
2. Tester l'API directement avec Postman/curl
3. Vérifier la configuration dans l'interface web

### Rollback si nécessaire
Les colonnes utilisent `COALESCE` donc même si elles sont supprimées, le système fonctionnera avec les valeurs par défaut.

---

**🎉 La fonctionnalité est maintenant complète et opérationnelle !** 