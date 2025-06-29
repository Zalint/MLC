-- =====================================================
-- MATIX LIVREUR - GPS ANALYTICS AVANCÉS
-- =====================================================
-- Extension pour les analytics et rapports GPS
-- =====================================================

-- Table pour stocker les métriques quotidiennes calculées
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

-- Index pour les métriques quotidiennes
CREATE INDEX IF NOT EXISTS idx_gps_daily_metrics_livreur_date ON gps_daily_metrics(livreur_id, tracking_date);
CREATE INDEX IF NOT EXISTS idx_gps_daily_metrics_date ON gps_daily_metrics(tracking_date);

-- Table pour les zones géographiques
CREATE TABLE IF NOT EXISTS gps_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_name VARCHAR(100) NOT NULL,
    zone_type VARCHAR(50) NOT NULL, -- 'delivery_area', 'rest_stop', 'depot', 'restricted'
    center_latitude DECIMAL(10, 8) NOT NULL,
    center_longitude DECIMAL(11, 8) NOT NULL,
    radius_meters INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table pour tracker les entrées/sorties de zones
CREATE TABLE IF NOT EXISTS gps_zone_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    livreur_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    zone_id UUID NOT NULL REFERENCES gps_zones(id) ON DELETE CASCADE,
    event_type VARCHAR(20) NOT NULL, -- 'enter', 'exit'
    event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    location_id UUID REFERENCES gps_locations(id) ON DELETE SET NULL,
    duration_minutes INTEGER DEFAULT NULL, -- Pour les événements 'exit'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les événements de zone
CREATE INDEX IF NOT EXISTS idx_gps_zone_events_livreur ON gps_zone_events(livreur_id);
CREATE INDEX IF NOT EXISTS idx_gps_zone_events_timestamp ON gps_zone_events(event_timestamp);

-- Vue pour les métriques de performance quotidiennes
CREATE OR REPLACE VIEW gps_daily_performance AS
SELECT 
    dm.livreur_id,
    u.username as livreur_username,
    dm.tracking_date,
    dm.total_distance_km,
    dm.total_time_minutes,
    dm.active_time_minutes,
    dm.average_speed_kmh,
    dm.max_speed_kmh,
    dm.total_stops,
    dm.longest_stop_minutes,
    dm.fuel_efficiency_score,
    dm.route_efficiency_score,
    -- Calculs additionnels
    CASE 
        WHEN dm.total_time_minutes > 0 
        THEN ROUND((dm.active_time_minutes::DECIMAL / dm.total_time_minutes * 100), 2)
        ELSE 0 
    END as activity_percentage,
    -- Classification de performance
    CASE 
        WHEN dm.route_efficiency_score >= 80 THEN 'Excellent'
        WHEN dm.route_efficiency_score >= 60 THEN 'Bon'
        WHEN dm.route_efficiency_score >= 40 THEN 'Moyen'
        ELSE 'À améliorer'
    END as performance_rating
FROM gps_daily_metrics dm
JOIN users u ON dm.livreur_id = u.id
WHERE u.role = 'LIVREUR' AND u.is_active = true
ORDER BY dm.tracking_date DESC, dm.route_efficiency_score DESC;

-- Vue pour les tendances hebdomadaires
CREATE OR REPLACE VIEW gps_weekly_trends AS
SELECT 
    dm.livreur_id,
    u.username as livreur_username,
    DATE_TRUNC('week', dm.tracking_date) as week_start,
    COUNT(*) as days_worked,
    SUM(dm.total_distance_km) as total_distance_km,
    AVG(dm.total_distance_km) as avg_daily_distance_km,
    SUM(dm.total_time_minutes) as total_time_minutes,
    AVG(dm.average_speed_kmh) as avg_speed_kmh,
    MAX(dm.max_speed_kmh) as max_speed_kmh,
    AVG(dm.fuel_efficiency_score) as avg_fuel_efficiency,
    AVG(dm.route_efficiency_score) as avg_route_efficiency
FROM gps_daily_metrics dm
JOIN users u ON dm.livreur_id = u.id
WHERE u.role = 'LIVREUR' AND u.is_active = true
GROUP BY dm.livreur_id, u.username, DATE_TRUNC('week', dm.tracking_date)
ORDER BY week_start DESC, avg_route_efficiency DESC;

-- Vue pour le classement des livreurs
CREATE OR REPLACE VIEW gps_livreur_rankings AS
WITH monthly_stats AS (
    SELECT 
        dm.livreur_id,
        u.username as livreur_username,
        DATE_TRUNC('month', dm.tracking_date) as month,
        AVG(dm.route_efficiency_score) as avg_efficiency,
        SUM(dm.total_distance_km) as total_distance,
        AVG(dm.fuel_efficiency_score) as avg_fuel_efficiency,
        COUNT(*) as days_worked
    FROM gps_daily_metrics dm
    JOIN users u ON dm.livreur_id = u.id
    WHERE u.role = 'LIVREUR' AND u.is_active = true
    GROUP BY dm.livreur_id, u.username, DATE_TRUNC('month', dm.tracking_date)
)
SELECT 
    livreur_id,
    livreur_username,
    month,
    avg_efficiency,
    total_distance,
    avg_fuel_efficiency,
    days_worked,
    -- Classements
    ROW_NUMBER() OVER (PARTITION BY month ORDER BY avg_efficiency DESC) as efficiency_rank,
    ROW_NUMBER() OVER (PARTITION BY month ORDER BY total_distance DESC) as distance_rank,
    ROW_NUMBER() OVER (PARTITION BY month ORDER BY avg_fuel_efficiency DESC) as fuel_rank,
    -- Score global pondéré
    (avg_efficiency * 0.4 + avg_fuel_efficiency * 0.3 + LEAST(100, total_distance/NULLIF(days_worked,0)*2) * 0.3) as global_score
FROM monthly_stats
ORDER BY month DESC, global_score DESC;

-- Fonction pour calculer les métriques quotidiennes
CREATE OR REPLACE FUNCTION calculate_daily_metrics(target_date DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER AS $$
DECLARE
    livreur_record RECORD;
    total_processed INTEGER := 0;
    daily_stats RECORD;
BEGIN
    -- Parcourir tous les livreurs actifs
    FOR livreur_record IN 
        SELECT id, username FROM users WHERE role = 'LIVREUR' AND is_active = true
    LOOP
        -- Calculer les métriques pour ce livreur et cette date
        WITH position_analysis AS (
            SELECT 
                COUNT(*) as position_count,
                MIN(timestamp) as start_time,
                MAX(timestamp) as end_time,
                SUM(CASE 
                    WHEN LAG(latitude) OVER (ORDER BY timestamp) IS NOT NULL 
                    THEN calculate_gps_distance(
                        LAG(latitude) OVER (ORDER BY timestamp),
                        LAG(longitude) OVER (ORDER BY timestamp),
                        latitude, longitude
                    ) / 1000.0
                    ELSE 0 
                END) as total_distance_km,
                AVG(NULLIF(speed, 0)) as avg_speed,
                MAX(speed) as max_speed
            FROM gps_locations 
            WHERE livreur_id = livreur_record.id 
              AND DATE(timestamp) = target_date
        )
        SELECT 
            COALESCE(pa.total_distance_km, 0) as total_distance_km,
            COALESCE(EXTRACT(EPOCH FROM (pa.end_time - pa.start_time)) / 60.0, 0) as total_time_minutes,
            COALESCE(pa.avg_speed, 0) as average_speed_kmh,
            COALESCE(pa.max_speed, 0) as max_speed_kmh,
            -- Calculs d'efficacité simplifiés
            CASE 
                WHEN pa.avg_speed > 0 AND pa.avg_speed <= 40
                THEN LEAST(100, (pa.avg_speed / 25.0) * 100)
                ELSE 50 
            END as fuel_efficiency_score,
            CASE 
                WHEN pa.total_distance_km > 0 AND pa.total_distance_km <= 200
                THEN LEAST(100, pa.total_distance_km * 2)
                ELSE 50 
            END as route_efficiency_score
        INTO daily_stats
        FROM position_analysis pa;

        -- Insérer ou mettre à jour les métriques
        INSERT INTO gps_daily_metrics (
            livreur_id, tracking_date, total_distance_km, total_time_minutes,
            active_time_minutes, average_speed_kmh, max_speed_kmh, total_stops,
            longest_stop_minutes, fuel_efficiency_score, route_efficiency_score
        ) VALUES (
            livreur_record.id, target_date, 
            daily_stats.total_distance_km,
            daily_stats.total_time_minutes,
            daily_stats.total_time_minutes * 0.8, -- Estimation du temps actif
            daily_stats.average_speed_kmh,
            daily_stats.max_speed_kmh,
            0, -- À calculer plus précisément si nécessaire
            0, -- À calculer plus précisément si nécessaire
            daily_stats.fuel_efficiency_score,
            daily_stats.route_efficiency_score
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

-- Insérer quelques zones par défaut (à adapter selon votre zone géographique)
INSERT INTO gps_zones (zone_name, zone_type, center_latitude, center_longitude, radius_meters) VALUES
    ('Centre-ville Dakar', 'delivery_area', 14.7167, -17.4677, 5000),
    ('Plateau', 'delivery_area', 14.6928, -17.4467, 2000),
    ('Almadies', 'delivery_area', 14.7500, -17.5000, 3000),
    ('Dépôt principal', 'depot', 14.7000, -17.4500, 500),
    ('Zone de repos', 'rest_stop', 14.7100, -17.4600, 200)
ON CONFLICT DO NOTHING;

-- Vérification de l'installation
SELECT 'GPS Analytics System installed successfully!' as status; 