-- =====================================================
-- MATIX LIVREUR - GPS TRACKING SYSTEM
-- =====================================================
-- Script pour ajouter le système de suivi GPS des livreurs
-- =====================================================

-- Table pour stocker les positions GPS des livreurs
CREATE TABLE IF NOT EXISTS gps_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    livreur_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(8, 2) DEFAULT NULL, -- Précision en mètres
    is_active BOOLEAN DEFAULT true, -- Le livreur est-il en service
    battery_level INTEGER DEFAULT NULL, -- Niveau de batterie (optionnel)
    speed DECIMAL(5, 2) DEFAULT NULL, -- Vitesse en km/h (optionnel)
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_gps_locations_livreur_id ON gps_locations(livreur_id);
CREATE INDEX IF NOT EXISTS idx_gps_locations_timestamp ON gps_locations(timestamp);
CREATE INDEX IF NOT EXISTS idx_gps_locations_active ON gps_locations(is_active);
CREATE INDEX IF NOT EXISTS idx_gps_locations_livreur_timestamp ON gps_locations(livreur_id, timestamp DESC);

-- Table pour les paramètres de suivi GPS des livreurs
CREATE TABLE IF NOT EXISTS gps_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    livreur_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tracking_enabled BOOLEAN DEFAULT false,
    tracking_interval INTEGER DEFAULT 30000, -- Intervalle en millisecondes
    last_permission_granted TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    permission_version VARCHAR(10) DEFAULT '1.0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les paramètres GPS
CREATE INDEX IF NOT EXISTS idx_gps_settings_livreur_id ON gps_settings(livreur_id);
CREATE INDEX IF NOT EXISTS idx_gps_settings_enabled ON gps_settings(tracking_enabled);

-- Vue pour les dernières positions de chaque livreur
CREATE OR REPLACE VIEW latest_gps_positions AS
SELECT DISTINCT ON (gl.livreur_id)
    gl.id,
    gl.livreur_id,
    u.username as livreur_username,
    gl.latitude,
    gl.longitude,
    gl.accuracy,
    gl.is_active,
    gl.battery_level,
    gl.speed,
    gl.timestamp,
    gs.tracking_enabled,
    EXTRACT(EPOCH FROM (NOW() - gl.timestamp)) as seconds_ago
FROM gps_locations gl
JOIN users u ON gl.livreur_id = u.id
LEFT JOIN gps_settings gs ON gl.livreur_id = gs.livreur_id
WHERE u.role = 'LIVREUR' AND u.is_active = true
ORDER BY gl.livreur_id, gl.timestamp DESC;

-- Vue pour l'historique des trajets avec calculs de distance
CREATE OR REPLACE VIEW gps_trajectory_analysis AS
SELECT 
    gl.livreur_id,
    u.username as livreur_username,
    DATE(gl.timestamp) as tracking_date,
    COUNT(*) as position_count,
    MIN(gl.timestamp) as first_position_time,
    MAX(gl.timestamp) as last_position_time,
    EXTRACT(EPOCH FROM (MAX(gl.timestamp) - MIN(gl.timestamp)))/3600 as tracking_hours,
    AVG(gl.accuracy) as avg_accuracy,
    MAX(gl.speed) as max_speed,
    AVG(gl.speed) as avg_speed
FROM gps_locations gl
JOIN users u ON gl.livreur_id = u.id
WHERE u.role = 'LIVREUR'
GROUP BY gl.livreur_id, u.username, DATE(gl.timestamp)
ORDER BY tracking_date DESC, livreur_username;

-- Fonction pour nettoyer les anciennes positions GPS (> 30 jours)
CREATE OR REPLACE FUNCTION cleanup_old_gps_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM gps_locations 
    WHERE timestamp < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour calculer la distance entre deux points GPS (en mètres)
CREATE OR REPLACE FUNCTION calculate_gps_distance(
    lat1 DECIMAL, lon1 DECIMAL, 
    lat2 DECIMAL, lon2 DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
    earth_radius DECIMAL := 6371000; -- Rayon de la Terre en mètres
    dlat DECIMAL;
    dlon DECIMAL;
    a DECIMAL;
    c DECIMAL;
    distance DECIMAL;
BEGIN
    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);
    
    a := sin(dlat/2) * sin(dlat/2) + 
         cos(radians(lat1)) * cos(radians(lat2)) * 
         sin(dlon/2) * sin(dlon/2);
    
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    distance := earth_radius * c;
    
    RETURN distance;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour le timestamp updated_at dans gps_settings
CREATE TRIGGER update_gps_settings_updated_at
    BEFORE UPDATE ON gps_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insertion des paramètres GPS par défaut pour les livreurs existants
INSERT INTO gps_settings (livreur_id, tracking_enabled)
SELECT id, false
FROM users 
WHERE role = 'LIVREUR' 
  AND id NOT IN (SELECT livreur_id FROM gps_settings);

-- Vérification de l'installation
SELECT 'GPS Tracking System installed successfully!' as status;
SELECT 'Tables created: gps_locations, gps_settings' as info;
SELECT 'Views created: latest_gps_positions, gps_trajectory_analysis' as views;
SELECT 'Functions created: cleanup_old_gps_data, calculate_gps_distance' as functions; 