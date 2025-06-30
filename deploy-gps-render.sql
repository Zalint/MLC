-- =====================================================
-- MATIX LIVREUR - DÉPLOIEMENT GPS SUR RENDER
-- =====================================================
-- Script complet pour déployer le système GPS
-- =====================================================

-- 🚀 DÉBUT DU DÉPLOIEMENT GPS SUR RENDER
SELECT '🚀 Début du déploiement GPS sur Render...' as deployment_start;

-- 1. EXTENSION UUID (requis pour les clés primaires)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
SELECT '✅ Extension UUID activée' as step_1_complete;

-- 2. FONCTION DE CALCUL GPS (Haversine)
CREATE OR REPLACE FUNCTION calculate_gps_distance(
    lat1 DECIMAL, lon1 DECIMAL, 
    lat2 DECIMAL, lon2 DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
    R DECIMAL := 6371000; -- Rayon de la Terre en mètres
    dLat DECIMAL;
    dLon DECIMAL;
    a DECIMAL;
    c DECIMAL;
BEGIN
    -- Protection contre les valeurs NULL
    IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
        RETURN 0;
    END IF;
    
    dLat := RADIANS(lat2 - lat1);
    dLon := RADIANS(lon2 - lon1);
    
    a := SIN(dLat/2) * SIN(dLat/2) + 
         COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * 
         SIN(dLon/2) * SIN(dLon/2);
    c := 2 * ATAN2(SQRT(a), SQRT(1-a));
    
    RETURN R * c; -- Distance en mètres
END;
$$ LANGUAGE plpgsql;
SELECT '✅ Fonction calculate_gps_distance créée' as step_2_complete;

-- 3. TABLE DES POSITIONS GPS
CREATE TABLE IF NOT EXISTS gps_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    livreur_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(8, 2) DEFAULT NULL,
    is_active BOOLEAN DEFAULT true,
    battery_level INTEGER DEFAULT NULL,
    speed DECIMAL(5, 2) DEFAULT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
SELECT '✅ Table gps_locations créée' as step_3_complete;

-- 4. TABLE DES PARAMÈTRES GPS
CREATE TABLE IF NOT EXISTS gps_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    livreur_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tracking_enabled BOOLEAN DEFAULT false,
    tracking_interval INTEGER DEFAULT 30000,
    last_permission_granted TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    permission_version VARCHAR(10) DEFAULT '1.0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
SELECT '✅ Table gps_settings créée' as step_4_complete;

-- 5. TABLE DES MÉTRIQUES QUOTIDIENNES
CREATE TABLE IF NOT EXISTS gps_daily_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    livreur_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tracking_date DATE NOT NULL,
    total_distance_km DECIMAL(8, 2) DEFAULT 0,
    total_time_minutes INTEGER DEFAULT 0,
    active_time_minutes INTEGER DEFAULT 0,
    average_speed_kmh DECIMAL(5, 2) DEFAULT 0,
    max_speed_kmh DECIMAL(5, 2) DEFAULT 0,
    total_stops INTEGER DEFAULT 0,
    longest_stop_minutes INTEGER DEFAULT 0,
    fuel_efficiency_score DECIMAL(5, 2) DEFAULT 0,
    route_efficiency_score DECIMAL(5, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(livreur_id, tracking_date)
);
SELECT '✅ Table gps_daily_metrics créée' as step_5_complete;

-- 6. INDEX POUR PERFORMANCES
CREATE INDEX IF NOT EXISTS idx_gps_locations_livreur_id ON gps_locations(livreur_id);
CREATE INDEX IF NOT EXISTS idx_gps_locations_timestamp ON gps_locations(timestamp);
CREATE INDEX IF NOT EXISTS idx_gps_locations_active ON gps_locations(is_active);
CREATE INDEX IF NOT EXISTS idx_gps_locations_livreur_timestamp ON gps_locations(livreur_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_gps_settings_livreur_id ON gps_settings(livreur_id);
CREATE INDEX IF NOT EXISTS idx_gps_settings_enabled ON gps_settings(tracking_enabled);

CREATE INDEX IF NOT EXISTS idx_gps_daily_metrics_livreur_date ON gps_daily_metrics(livreur_id, tracking_date);
CREATE INDEX IF NOT EXISTS idx_gps_daily_metrics_date ON gps_daily_metrics(tracking_date);
SELECT '✅ Index créés' as step_6_complete;

-- 7. VUE DES DERNIÈRES POSITIONS
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
SELECT '✅ Vue latest_gps_positions créée' as step_7_complete;

-- 8. VUE DES PERFORMANCES QUOTIDIENNES
CREATE OR REPLACE VIEW gps_daily_performance AS
SELECT 
    gdm.livreur_id,
    u.username as livreur_username,
    gdm.tracking_date,
    gdm.total_distance_km,
    gdm.total_time_minutes,
    gdm.active_time_minutes,
    gdm.average_speed_kmh,
    gdm.max_speed_kmh,
    gdm.route_efficiency_score,
    gdm.fuel_efficiency_score,
    CASE 
        WHEN gdm.route_efficiency_score >= 80 THEN 'Excellent'
        WHEN gdm.route_efficiency_score >= 65 THEN 'Très bon'
        WHEN gdm.route_efficiency_score >= 50 THEN 'Bon'
        WHEN gdm.route_efficiency_score >= 35 THEN 'Moyen'
        ELSE 'À améliorer'
    END as performance_rating
FROM gps_daily_metrics gdm
JOIN users u ON gdm.livreur_id = u.id
WHERE u.role = 'LIVREUR' AND u.is_active = true;
SELECT '✅ Vue gps_daily_performance créée' as step_8_complete;

-- 9. FONCTION DE CALCUL DES MÉTRIQUES QUOTIDIENNES
CREATE OR REPLACE FUNCTION calculate_daily_metrics(target_date DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER AS $$
DECLARE
    livreur_record RECORD;
    daily_stats RECORD;
    total_processed INTEGER := 0;
BEGIN
    FOR livreur_record IN 
        SELECT id, username FROM users 
        WHERE role = 'LIVREUR' AND is_active = true
    LOOP
        WITH ordered_positions AS (
            SELECT 
                latitude, longitude, timestamp, speed,
                LAG(latitude) OVER (ORDER BY timestamp) as prev_lat,
                LAG(longitude) OVER (ORDER BY timestamp) as prev_lng
            FROM gps_locations
            WHERE livreur_id = livreur_record.id 
                AND DATE(timestamp) = target_date
                AND accuracy <= 100
            ORDER BY timestamp
        ),
        position_stats AS (
            SELECT 
                COUNT(*) as position_count,
                COALESCE(EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp)))/60, 0) as total_minutes,
                COALESCE(AVG(speed), 0) as average_speed_kmh,
                COALESCE(MAX(speed), 0) as max_speed_kmh
            FROM ordered_positions
        ),
        distance_calc AS (
            SELECT 
                COALESCE(
                    SUM(
                        CASE 
                            WHEN prev_lat IS NOT NULL AND prev_lng IS NOT NULL
                            THEN calculate_gps_distance(prev_lat, prev_lng, latitude, longitude) / 1000.0
                            ELSE 0 
                        END
                    ), 0
                ) as total_distance_km
            FROM ordered_positions
        )
        SELECT INTO daily_stats
            ps.position_count,
            ps.total_minutes,
            ps.average_speed_kmh,
            ps.max_speed_kmh,
            dc.total_distance_km,
            CASE 
                WHEN ps.average_speed_kmh > 0 AND ps.average_speed_kmh <= 40
                THEN LEAST(100, (ps.average_speed_kmh / 25.0) * 100)
                ELSE 50 
            END as fuel_efficiency_score,
            CASE 
                WHEN ps.position_count >= 50 AND ps.total_minutes >= 240
                THEN LEAST(100, (ps.position_count / 100.0) * 100)
                ELSE 30
            END as route_efficiency_score
        FROM position_stats ps, distance_calc dc;

        INSERT INTO gps_daily_metrics (
            livreur_id, tracking_date, total_distance_km, total_time_minutes,
            active_time_minutes, average_speed_kmh, max_speed_kmh, total_stops,
            longest_stop_minutes, fuel_efficiency_score, route_efficiency_score
        ) VALUES (
            livreur_record.id, 
            target_date, 
            COALESCE(daily_stats.total_distance_km, 0),
            COALESCE(daily_stats.total_minutes, 0),
            COALESCE(daily_stats.total_minutes * 0.8, 0),
            COALESCE(daily_stats.average_speed_kmh, 0),
            COALESCE(daily_stats.max_speed_kmh, 0),
            0, 0,
            COALESCE(daily_stats.fuel_efficiency_score, 50),
            COALESCE(daily_stats.route_efficiency_score, 30)
        ) ON CONFLICT (livreur_id, tracking_date) 
        DO UPDATE SET
            total_distance_km = EXCLUDED.total_distance_km,
            total_time_minutes = EXCLUDED.total_time_minutes,
            active_time_minutes = EXCLUDED.active_time_minutes,
            average_speed_kmh = EXCLUDED.average_speed_kmh,
            max_speed_kmh = EXCLUDED.max_speed_kmh,
            fuel_efficiency_score = EXCLUDED.fuel_efficiency_score,
            route_efficiency_score = EXCLUDED.route_efficiency_score;

        total_processed := total_processed + 1;
    END LOOP;

    RETURN total_processed;
END;
$$ LANGUAGE plpgsql;
SELECT '✅ Fonction calculate_daily_metrics créée' as step_9_complete;

-- 10. FONCTION DE NETTOYAGE
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
SELECT '✅ Fonction cleanup_old_gps_data créée' as step_10_complete;

-- 11. INITIALISATION DES PARAMÈTRES GPS POUR TOUS LES LIVREURS
INSERT INTO gps_settings (livreur_id, tracking_enabled, tracking_interval)
SELECT id, false, 30000
FROM users 
WHERE role = 'LIVREUR' 
  AND is_active = true
  AND id NOT IN (
    SELECT livreur_id FROM gps_settings 
    WHERE livreur_id IS NOT NULL
  );
SELECT '✅ Paramètres GPS initialisés pour tous les livreurs' as step_11_complete;

-- 12. VÉRIFICATIONS FINALES
SELECT '🔍 Vérifications finales...' as step_12_start;

-- Compter les tables créées
SELECT 
    COUNT(CASE WHEN table_name = 'gps_locations' THEN 1 END) as gps_locations,
    COUNT(CASE WHEN table_name = 'gps_settings' THEN 1 END) as gps_settings,
    COUNT(CASE WHEN table_name = 'gps_daily_metrics' THEN 1 END) as gps_daily_metrics
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'gps_%';

-- Compter les livreurs avec paramètres GPS
SELECT 
    COUNT(*) as total_livreurs,
    COUNT(CASE WHEN gs.tracking_enabled = true THEN 1 END) as tracking_enabled,
    COUNT(CASE WHEN gs.tracking_enabled = false THEN 1 END) as tracking_disabled
FROM users u
LEFT JOIN gps_settings gs ON u.id = gs.livreur_id
WHERE u.role = 'LIVREUR' AND u.is_active = true;

-- Tester la fonction GPS
SELECT calculate_gps_distance(14.6928, -17.4467, 14.7028, -17.4567) as test_distance_meters;

SELECT '🎉 Déploiement GPS terminé avec succès!' as deployment_complete;
SELECT 'Prochaines étapes:' as next_steps_title;
SELECT '1. Vérifier que les routes GPS sont actives dans app.js' as next_step_1;
SELECT '2. Uploader les assets Leaflet dans frontend/assets/' as next_step_2;
SELECT '3. Tester les endpoints GPS' as next_step_3;
SELECT '4. Activer le suivi pour les livreurs souhaités' as next_step_4; 