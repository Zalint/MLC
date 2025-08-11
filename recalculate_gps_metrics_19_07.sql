-- ===== RECALCUL MÉTRIQUES GPS 19/07/2025 =====
-- Script pour recalculer les métriques avec le nouveau filtre 200m
-- Date: 2025-07-20
-- Usage: Exécuter côté serveur PROD

BEGIN;

-- 1. Supprimer les métriques existantes du 19/07/2025
DELETE FROM gps_daily_metrics 
WHERE tracking_date = '2025-07-19';

-- 2. Recalculer les métriques avec le nouveau filtre 200m
INSERT INTO gps_daily_metrics (
    livreur_id,
    tracking_date,
    total_distance_km,
    total_time_minutes,
    active_time_minutes,
    average_speed_kmh,
    max_speed_kmh,
    total_stops,
    longest_stop_minutes,
    fuel_efficiency_score,
    route_efficiency_score,
    created_at
)
SELECT 
    gl.livreur_id,
    DATE(gl.timestamp) as tracking_date,
    
    -- Distance totale (avec filtre 200m)
    COALESCE(SUM(
        CASE 
            WHEN gl.accuracy <= 200 AND gl_next.latitude IS NOT NULL 
            THEN calculate_gps_distance(
                gl.latitude, gl.longitude, 
                gl_next.latitude, gl_next.longitude
            ) / 1000.0
            ELSE 0 
        END
    ), 0) as total_distance_km,
    
    -- Temps total en minutes
    COALESCE(EXTRACT(EPOCH FROM (
        MAX(gl.timestamp) - MIN(gl.timestamp)
    )) / 60, 0)::INTEGER as total_time_minutes,
    
    -- Temps actif (positions avec précision <= 200m)
    COUNT(CASE WHEN gl.accuracy <= 200 THEN 1 END) * 0.5 as active_time_minutes,
    
    -- Vitesse moyenne (km/h)
    CASE 
        WHEN COUNT(CASE WHEN gl.accuracy <= 200 THEN 1 END) > 1 
        THEN COALESCE(SUM(
            CASE 
                WHEN gl.accuracy <= 200 AND gl_next.latitude IS NOT NULL 
                THEN calculate_gps_distance(
                    gl.latitude, gl.longitude, 
                    gl_next.latitude, gl_next.longitude
                ) / 1000.0
                ELSE 0 
            END
        ) * 60 / NULLIF(EXTRACT(EPOCH FROM (
            MAX(gl.timestamp) - MIN(gl.timestamp)
        )), 0), 0)
        ELSE 0 
    END as average_speed_kmh,
    
    -- Vitesse maximale
    COALESCE(MAX(gl.speed), 0) as max_speed_kmh,
    
    -- Nombre d'arrêts (positions consécutives à moins de 50m)
    COUNT(CASE 
        WHEN gl.accuracy <= 200 AND gl_next.latitude IS NOT NULL 
        AND calculate_gps_distance(
            gl.latitude, gl.longitude, 
            gl_next.latitude, gl_next.longitude
        ) < 50 
        THEN 1 
    END) as total_stops,
    
    -- Plus long arrêt (en minutes)
    COALESCE(MAX(
        CASE 
            WHEN gl.accuracy <= 200 AND gl_next.latitude IS NOT NULL 
            AND calculate_gps_distance(
                gl.latitude, gl.longitude, 
                gl_next.latitude, gl_next.longitude
            ) < 50 
            THEN EXTRACT(EPOCH FROM (gl_next.timestamp - gl.timestamp)) / 60
            ELSE 0 
        END
    ), 0)::INTEGER as longest_stop_minutes,
    
    -- Score d'efficacité carburant (basé sur la vitesse moyenne et les arrêts)
    CASE 
        WHEN COUNT(CASE WHEN gl.accuracy <= 200 THEN 1 END) > 10 
        THEN LEAST(100, GREATEST(0, 
            50 -             (COUNT(CASE 
                WHEN gl.accuracy <= 200 AND gl_next.latitude IS NOT NULL 
                AND calculate_gps_distance(
                    gl.latitude, gl.longitude, 
                    gl_next.latitude, gl_next.longitude
                ) < 50 
                THEN 1 
            END) * 2) + 
            (CASE 
                WHEN COUNT(CASE WHEN gl.accuracy <= 200 THEN 1 END) > 1 
                THEN COALESCE(SUM(
                    CASE 
                        WHEN gl.accuracy <= 200 AND gl_next.latitude IS NOT NULL 
                        THEN calculate_gps_distance(
                            gl.latitude, gl.longitude, 
                            gl_next.latitude, gl_next.longitude
                        ) / 1000.0
                        ELSE 0 
                    END
                ) * 60 / NULLIF(EXTRACT(EPOCH FROM (
                    MAX(gl.timestamp) - MIN(gl.timestamp)
                )), 0), 0)
                ELSE 0 
            END * 10)
        ))
        ELSE 50 
    END as fuel_efficiency_score,
    
    -- Score d'efficacité de route (basé sur la distance parcourue vs temps)
    CASE 
        WHEN COUNT(CASE WHEN gl.accuracy <= 200 THEN 1 END) > 10 
        THEN LEAST(100, GREATEST(0, 
            (COALESCE(SUM(
                CASE 
                    WHEN gl.accuracy <= 200 AND gl_next.latitude IS NOT NULL 
                    THEN calculate_gps_distance(
                        gl.latitude, gl.longitude, 
                        gl_next.latitude, gl_next.longitude
                    ) / 1000.0
                    ELSE 0 
                END
            ), 0) * 20) + 
            (COUNT(CASE WHEN gl.accuracy <= 200 THEN 1 END) * 0.1)
        ))
        ELSE 30 
    END as route_efficiency_score,
    
    NOW() as created_at

FROM gps_locations gl
LEFT JOIN gps_locations gl_next ON (
    gl.livreur_id = gl_next.livreur_id 
    AND gl_next.timestamp = (
        SELECT MIN(timestamp) 
        FROM gps_locations gl2 
        WHERE gl2.livreur_id = gl.livreur_id 
        AND gl2.timestamp > gl.timestamp
        AND DATE(gl2.timestamp) = DATE(gl.timestamp)
    )
)
WHERE DATE(gl.timestamp) = '2025-07-19'
GROUP BY gl.livreur_id, DATE(gl.timestamp);

-- 3. Vérification des résultats
SELECT 
    u.username,
    gdm.tracking_date,
    gdm.total_distance_km,
    gdm.total_time_minutes,
    gdm.active_time_minutes,
    gdm.average_speed_kmh,
    gdm.max_speed_kmh,
    gdm.fuel_efficiency_score,
    gdm.route_efficiency_score
FROM gps_daily_metrics gdm
JOIN users u ON gdm.livreur_id = u.id
WHERE gdm.tracking_date = '2025-07-19'
ORDER BY gdm.total_distance_km DESC;

-- 4. Statistiques de comparaison
SELECT 
    'AVANT (100m filter)' as periode,
    COUNT(*) as livreurs,
    AVG(total_distance_km) as distance_moyenne,
    AVG(average_speed_kmh) as vitesse_moyenne
FROM gps_daily_metrics 
WHERE tracking_date = '2025-07-19'

UNION ALL

SELECT 
    'APRÈS (200m filter)' as periode,
    COUNT(*) as livreurs,
    AVG(total_distance_km) as distance_moyenne,
    AVG(average_speed_kmh) as vitesse_moyenne
FROM gps_daily_metrics 
WHERE tracking_date = '2025-07-19';

COMMIT;

-- Message de confirmation
SELECT '✅ Métriques GPS recalculées pour le 19/07/2025 avec filtre 200m' as resultat; 