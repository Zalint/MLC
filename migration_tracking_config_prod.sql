-- ===== MIGRATION TRACKING CONFIG PRODUCTION =====
-- Date: 2025-01-18
-- Description: Ajout configuration heures tracking GPS 7j/7
-- Version: 1.0

BEGIN;

-- 1. Ajouter les nouvelles colonnes de tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS tracking_start_hour INTEGER DEFAULT 9;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tracking_end_hour INTEGER DEFAULT 21;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tracking_timezone VARCHAR(50) DEFAULT 'Africa/Dakar';
ALTER TABLE users ADD COLUMN IF NOT EXISTS tracking_enabled_days VARCHAR(20) DEFAULT '0,1,2,3,4,5,6';
ALTER TABLE users ADD COLUMN IF NOT EXISTS gps_tracking_active BOOLEAN DEFAULT true;

-- 2. Mettre à jour tous les livreurs existants avec configuration 7j/7
UPDATE users 
SET 
  tracking_start_hour = 9,
  tracking_end_hour = 21,
  tracking_timezone = 'Africa/Dakar',
  tracking_enabled_days = '0,1,2,3,4,5,6',
  gps_tracking_active = true
WHERE role = 'LIVREUR' 
  AND (tracking_start_hour IS NULL OR tracking_enabled_days != '0,1,2,3,4,5,6');

-- 3. Créer un index pour optimiser les requêtes de tracking
CREATE INDEX IF NOT EXISTS idx_users_tracking_config 
ON users(role, gps_tracking_active, tracking_start_hour, tracking_end_hour);

-- 4. Vérification des données après migration
DO $$
DECLARE
    livreur_count INTEGER;
    config_count INTEGER;
BEGIN
    -- Compter les livreurs
    SELECT COUNT(*) INTO livreur_count 
    FROM users 
    WHERE role = 'LIVREUR';
    
    -- Compter les configurations valides
    SELECT COUNT(*) INTO config_count 
    FROM users 
    WHERE role = 'LIVREUR' 
      AND tracking_start_hour IS NOT NULL 
      AND tracking_end_hour IS NOT NULL
      AND tracking_enabled_days = '0,1,2,3,4,5,6';
    
    -- Afficher les résultats
    RAISE NOTICE '✅ Migration terminée:';
    RAISE NOTICE '📊 Livreurs total: %', livreur_count;
    RAISE NOTICE '⚙️ Configurations 7j/7: %', config_count;
    
    -- Vérifier que tous les livreurs ont été configurés
    IF livreur_count = config_count THEN
        RAISE NOTICE '🎯 SUCCESS: Tous les livreurs configurés 7j/7 !';
    ELSE
        RAISE WARNING '⚠️ ATTENTION: % livreurs non configurés', (livreur_count - config_count);
    END IF;
END $$;

-- 5. Afficher la configuration finale
SELECT 
  '📋 CONFIGURATION FINALE' as status,
  username,
  CONCAT(tracking_start_hour, 'h-', tracking_end_hour, 'h') as horaires,
  tracking_enabled_days as jours_actifs,
  CASE 
    WHEN tracking_enabled_days = '0,1,2,3,4,5,6' THEN '✅ 7j/7'
    ELSE '⚠️ Partiel'
  END as statut_jours,
  CASE 
    WHEN gps_tracking_active THEN '🟢 Actif'
    ELSE '🔴 Inactif'
  END as statut_gps
FROM users 
WHERE role = 'LIVREUR' 
ORDER BY username;

COMMIT;

-- Message final
SELECT '🚀 MIGRATION TRACKING CONFIG TERMINÉE AVEC SUCCÈS !' as message; 