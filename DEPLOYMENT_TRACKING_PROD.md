# 🚀 DÉPLOIEMENT PRODUCTION - Configuration Heures Tracking GPS

## 📋 Vue d'ensemble

Ce déploiement ajoute la **configuration des heures de tracking GPS** avec :
- ⏰ Heures configurables par livreur (9h-21h par défaut)
- 🗓️ Jours de tracking 7j/7 (Dimanche à Samedi)
- 🌍 Timezone par livreur (Africa/Dakar par défaut)
- 🔧 Interface Manager/Admin pour configuration

---

## 🗃️ 1. MIGRATION BASE DE DONNÉES

### **Étape 1 : Ajouter les colonnes de tracking**

```sql
-- ===== MIGRATION TRACKING CONFIG =====
-- Date: 2025-01-18
-- Description: Ajout configuration heures tracking GPS

-- Ajouter les nouvelles colonnes
ALTER TABLE users ADD COLUMN IF NOT EXISTS tracking_start_hour INTEGER DEFAULT 9;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tracking_end_hour INTEGER DEFAULT 21;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tracking_timezone VARCHAR(50) DEFAULT 'Africa/Dakar';
ALTER TABLE users ADD COLUMN IF NOT EXISTS tracking_enabled_days VARCHAR(20) DEFAULT '0,1,2,3,4,5,6';
ALTER TABLE users ADD COLUMN IF NOT EXISTS gps_tracking_active BOOLEAN DEFAULT true;

-- Mettre à jour les livreurs existants avec les valeurs par défaut
UPDATE users 
SET 
  tracking_start_hour = 9,
  tracking_end_hour = 21,
  tracking_timezone = 'Africa/Dakar',
  tracking_enabled_days = '0,1,2,3,4,5,6',
  gps_tracking_active = true
WHERE role = 'LIVREUR' 
  AND tracking_start_hour IS NULL;

-- Créer un index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_users_tracking_config 
ON users(role, gps_tracking_active, tracking_start_hour, tracking_end_hour);

-- Vérification post-migration
SELECT 
  username,
  tracking_start_hour,
  tracking_end_hour,
  tracking_timezone,
  tracking_enabled_days,
  gps_tracking_active
FROM users 
WHERE role = 'LIVREUR' 
ORDER BY username;
```

---

## 🔧 2. DÉPLOIEMENT APPLICATION

### **Étape 2 : Déployer les fichiers modifiés**

**Fichiers Backend à déployer :**
```bash
backend/controllers/gpsController.js    # Logique tracking config
backend/routes/gps.js                  # Routes API tracking
```

**Fichiers Frontend à déployer :**
```bash
frontend/js/gps-tracking-manager.js    # Interface configuration
frontend/css/style.css                 # Styles UI tracking
frontend/index.html                    # Section configuration
```

### **Étape 3 : Commandes de déploiement**

**Pour Render/Heroku :**
```bash
# 1. Commit des changements
git add .
git commit -m "feat: Configuration heures tracking GPS 7j/7"

# 2. Push vers production
git push origin master

# 3. Vérifier le déploiement
# (Render redémarre automatiquement)
```

**Pour serveur VPS :**
```bash
# 1. Se connecter au serveur
ssh user@your-server.com

# 2. Aller dans le dossier application
cd /path/to/matix-livreur

# 3. Pull des changements
git pull origin master

# 4. Installer les dépendances (si nécessaire)
npm install

# 5. Redémarrer l'application
pm2 restart matix-backend
# ou
systemctl restart matix-livreur
```

---

## 🗄️ 3. EXÉCUTION SQL EN PRODUCTION

### **Option A : Via interface admin PostgreSQL**
```sql
-- Copier-coller le script SQL de l'Étape 1
-- dans pgAdmin, DBeaver, ou interface web
```

### **Option B : Via ligne de commande**
```bash
# Se connecter à la base de données production
psql -h HOST -U USERNAME -d DATABASE_NAME

# Exécuter le script
\i migration_tracking_config.sql

# Ou directement
psql -h HOST -U USERNAME -d DATABASE_NAME -f migration_tracking_config.sql
```

### **Option C : Via script Node.js**
```javascript
// migrate_prod_tracking.js
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false } // Pour Render/Heroku
});

async function migrate() {
  try {
    console.log('🚀 Début migration tracking config...');
    
    // Exécuter les ALTER TABLE...
    // (copier le SQL de l'Étape 1)
    
    console.log('✅ Migration terminée !');
  } catch (error) {
    console.error('❌ Erreur migration:', error);
  } finally {
    await pool.end();
  }
}

migrate();
```

---

## ✅ 4. VÉRIFICATIONS POST-DÉPLOIEMENT

### **Test 1 : Structure base de données**
```sql
-- Vérifier que les colonnes existent
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name LIKE 'tracking_%'
ORDER BY column_name;
```

### **Test 2 : Données livreurs**
```sql
-- Vérifier la configuration des livreurs
SELECT 
  username,
  CONCAT(tracking_start_hour, 'h-', tracking_end_hour, 'h') as horaires,
  tracking_enabled_days as jours,
  gps_tracking_active as actif
FROM users 
WHERE role = 'LIVREUR' 
ORDER BY username;
```

### **Test 3 : API endpoints**
```bash
# Test connexion Manager
curl -X POST http://your-domain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"manager","password":"your-password"}'

# Test endpoint tracking configs (avec token obtenu)
curl -X GET http://your-domain.com/api/v1/gps/tracking-configs \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### **Test 4 : Interface utilisateur**
1. ✅ Se connecter en tant que Manager/Admin
2. ✅ Aller sur page "GPS Tracking"
3. ✅ Vérifier section "Configuration des heures de tracking"
4. ✅ Voir la liste des 8 livreurs avec status 🟢
5. ✅ Tester modification d'une configuration

---

## 🚨 5. ROLLBACK (en cas de problème)

### **Rollback base de données :**
```sql
-- Supprimer les colonnes ajoutées
ALTER TABLE users DROP COLUMN IF EXISTS tracking_start_hour;
ALTER TABLE users DROP COLUMN IF EXISTS tracking_end_hour;
ALTER TABLE users DROP COLUMN IF EXISTS tracking_timezone;
ALTER TABLE users DROP COLUMN IF EXISTS tracking_enabled_days;
ALTER TABLE users DROP COLUMN IF EXISTS gps_tracking_active;

-- Supprimer l'index
DROP INDEX IF EXISTS idx_users_tracking_config;
```

### **Rollback application :**
```bash
# Revenir au commit précédent
git reset --hard PREVIOUS_COMMIT_HASH
git push --force origin master
```

---

## 📊 6. MONITORING POST-DÉPLOIEMENT

### **Logs à surveiller :**
- ✅ Pas d'erreur 500 sur `/api/v1/gps/tracking-configs`
- ✅ Fonction `isTrackingAllowed()` fonctionne correctement
- ✅ GPS positions acceptées entre 9h-21h
- ✅ GPS positions rejetées en dehors des heures

### **Métriques importantes :**
- ✅ Nombre de configurations chargées : **8 livreurs**
- ✅ Heures par défaut : **9h-21h**
- ✅ Jours actifs : **0,1,2,3,4,5,6** (7j/7)
- ✅ Tracking activé : **true** pour tous

---

## 🎯 Prêt pour déploiement !

**📋 Checklist finale :**
- [ ] Backup base de données
- [ ] Script SQL préparé
- [ ] Files backend/frontend prêts
- [ ] Tests unitaires OK
- [ ] Plan de rollback prêt

**🚀 GO/NO-GO pour PROD !** 