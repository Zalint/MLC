-- Migration pour ajouter la configuration des heures de tracking GPS par livreur
-- Exécuter ce script pour ajouter les colonnes de configuration horaire

-- Ajouter les colonnes de configuration des heures de tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS tracking_start_hour INTEGER DEFAULT 9;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tracking_end_hour INTEGER DEFAULT 21;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tracking_timezone VARCHAR(50) DEFAULT 'Africa/Dakar';
ALTER TABLE users ADD COLUMN IF NOT EXISTS tracking_enabled_days VARCHAR(20) DEFAULT '1,2,3,4,5,6'; -- Lundi à Samedi
ALTER TABLE users ADD COLUMN IF NOT EXISTS gps_tracking_active BOOLEAN DEFAULT true;

-- Commenter les nouvelles colonnes
COMMENT ON COLUMN users.tracking_start_hour IS 'Heure de début du tracking GPS (0-23)';
COMMENT ON COLUMN users.tracking_end_hour IS 'Heure de fin du tracking GPS (0-23)';
COMMENT ON COLUMN users.tracking_timezone IS 'Fuseau horaire pour le tracking (ex: Africa/Dakar)';
COMMENT ON COLUMN users.tracking_enabled_days IS 'Jours de tracking actifs (1=Lundi, 7=Dimanche)';
COMMENT ON COLUMN users.gps_tracking_active IS 'Activation/désactivation du tracking GPS pour ce livreur';

-- Mise à jour des livreurs existants avec les valeurs par défaut
UPDATE users 
SET 
    tracking_start_hour = 9,
    tracking_end_hour = 21,
    tracking_timezone = 'Africa/Dakar',
    tracking_enabled_days = '1,2,3,4,5,6',
    gps_tracking_active = true
WHERE role = 'LIVREUR' 
    AND tracking_start_hour IS NULL;

-- Créer un index pour optimiser les requêtes de vérification horaire
CREATE INDEX IF NOT EXISTS idx_users_tracking_config 
ON users(role, gps_tracking_active, tracking_start_hour, tracking_end_hour);

-- Afficher le résultat
SELECT 
    username,
    role,
    tracking_start_hour,
    tracking_end_hour,
    tracking_timezone,
    tracking_enabled_days,
    gps_tracking_active
FROM users 
WHERE role = 'LIVREUR'
ORDER BY username; 