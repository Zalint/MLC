-- =====================================================
-- PRODUCTION FIX: GPS DAILY METRICS
-- =====================================================
-- This script fixes the missing daily metrics issue on production
-- The problem: automatic metrics calculation was failing due to 
-- decimal-to-integer conversion errors
-- =====================================================

-- First, let's see what we're working with
SELECT 'Current state of daily metrics (last 7 days):' as step_1;
SELECT tracking_date, COUNT(*) as livreur_count, SUM(total_distance_km) as total_distance
FROM gps_daily_metrics 
WHERE tracking_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY tracking_date
ORDER BY tracking_date DESC;

-- Check recent GPS data availability
SELECT 'Recent GPS data availability:' as step_2;
SELECT DATE(timestamp) as date, COUNT(*) as gps_entries, AVG(accuracy) as avg_accuracy
FROM gps_locations 
WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(timestamp)
ORDER BY date DESC;

-- Update the calculate_daily_metrics function to handle data types properly
SELECT 'Updating calculate_daily_metrics function...' as step_3;
CREATE OR REPLACE FUNCTION calculate_daily_metrics(target_date DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER AS $$
DECLARE
    livreur_record RECORD;
    total_processed INTEGER := 0;
    daily_stats RECORD;
    accuracy_threshold_meters INTEGER := 100; -- Global 100m accuracy filter
BEGIN
    -- Process all active delivery drivers
    FOR livreur_record IN 
        SELECT id, username FROM users WHERE role = 'LIVREUR' AND is_active = true
    LOOP
        -- Calculate metrics for this driver and date
        -- IMPORTANT: Only use positions with accuracy <= 100m for calculations
        WITH filtered_positions AS (
            SELECT 
                latitude, longitude, timestamp, speed, accuracy
            FROM gps_locations 
            WHERE livreur_id = livreur_record.id 
              AND DATE(timestamp) = target_date
              AND (accuracy IS NULL OR accuracy <= accuracy_threshold_meters) -- 100m accuracy filter
            ORDER BY timestamp ASC
        ),
        position_analysis AS (
            SELECT 
                COUNT(*) as position_count,
                MIN(timestamp) as start_time,
                MAX(timestamp) as end_time,
                -- Calculate distance only between consecutive high-accuracy positions
                SUM(CASE 
                    WHEN LAG(latitude) OVER (ORDER BY timestamp) IS NOT NULL 
                    THEN LEAST(2000, -- Cap unrealistic jumps at 2km
                        calculate_gps_distance(
                            LAG(latitude) OVER (ORDER BY timestamp),
                            LAG(longitude) OVER (ORDER BY timestamp),
                            latitude, longitude
                        ) / 1000.0) -- Convert to km
                    ELSE 0 
                END) as total_distance_km,
                AVG(NULLIF(speed * 3.6, 0)) as avg_speed_kmh, -- m/s to km/h
                MAX(speed * 3.6) as max_speed_kmh,
                COUNT(CASE WHEN speed IS NOT NULL AND speed < 2 THEN 1 END) as slow_points
            FROM filtered_positions
        )
        SELECT 
            COALESCE(pa.total_distance_km, 0) as total_distance_km,
            COALESCE(EXTRACT(EPOCH FROM (pa.end_time - pa.start_time)) / 60.0, 0) as total_time_minutes,
            COALESCE(pa.avg_speed_kmh, 0) as average_speed_kmh,
            COALESCE(pa.max_speed_kmh, 0) as max_speed_kmh,
            GREATEST(1, pa.slow_points / 10) as estimated_stops,
            -- Improved efficiency calculations
            CASE 
                WHEN pa.avg_speed_kmh > 0 AND pa.avg_speed_kmh <= 50
                THEN LEAST(100, GREATEST(0, (pa.avg_speed_kmh / 25.0) * 100))
                WHEN pa.avg_speed_kmh > 50
                THEN GREATEST(0, 100 - (pa.avg_speed_kmh - 50) * 2)
                ELSE 50 
            END as fuel_efficiency_score,
            CASE 
                WHEN pa.total_distance_km > 0.05 -- Minimum meaningful distance for 100m accuracy
                THEN LEAST(100, GREATEST(0, 
                    (pa.total_distance_km * 15) + 25
                ))
                ELSE 0 
            END as route_efficiency_score
        INTO daily_stats
        FROM position_analysis pa;

        -- Only insert metrics if we have meaningful data
        IF daily_stats.total_distance_km > 0.05 OR daily_stats.total_time_minutes > 5 THEN
            INSERT INTO gps_daily_metrics (
                livreur_id, tracking_date, total_distance_km, total_time_minutes,
                active_time_minutes, average_speed_kmh, max_speed_kmh, total_stops,
                longest_stop_minutes, fuel_efficiency_score, route_efficiency_score
            ) VALUES (
                livreur_record.id, target_date, 
                ROUND(daily_stats.total_distance_km::numeric, 2),
                ROUND(daily_stats.total_time_minutes::numeric)::INTEGER, -- FIXED: proper integer conversion
                ROUND(daily_stats.total_time_minutes::numeric * 0.8)::INTEGER, -- FIXED: proper integer conversion
                ROUND(daily_stats.average_speed_kmh::numeric, 2),
                ROUND(daily_stats.max_speed_kmh::numeric, 2),
                daily_stats.estimated_stops,
                ROUND(daily_stats.total_time_minutes::numeric / 4)::INTEGER, -- FIXED: proper integer conversion
                ROUND(daily_stats.fuel_efficiency_score::numeric, 2),
                ROUND(daily_stats.route_efficiency_score::numeric, 2)
            ) ON CONFLICT (livreur_id, tracking_date) 
            DO UPDATE SET
                total_distance_km = EXCLUDED.total_distance_km,
                total_time_minutes = EXCLUDED.total_time_minutes,
                active_time_minutes = EXCLUDED.active_time_minutes,
                average_speed_kmh = EXCLUDED.average_speed_kmh,
                max_speed_kmh = EXCLUDED.max_speed_kmh,
                total_stops = EXCLUDED.total_stops,
                longest_stop_minutes = EXCLUDED.longest_stop_minutes,
                fuel_efficiency_score = EXCLUDED.fuel_efficiency_score,
                route_efficiency_score = EXCLUDED.route_efficiency_score;

            total_processed := total_processed + 1;
        END IF;
    END LOOP;

    RETURN total_processed;
END;
$$ LANGUAGE plpgsql;

-- Now regenerate metrics for the last 7 days
SELECT 'Regenerating daily metrics for last 7 days...' as step_4;

-- Calculate for each of the last 7 days
SELECT calculate_daily_metrics(CURRENT_DATE) as today_processed;
SELECT calculate_daily_metrics(CURRENT_DATE - 1) as yesterday_processed;
SELECT calculate_daily_metrics(CURRENT_DATE - 2) as day_2_processed;
SELECT calculate_daily_metrics(CURRENT_DATE - 3) as day_3_processed;
SELECT calculate_daily_metrics(CURRENT_DATE - 4) as day_4_processed;
SELECT calculate_daily_metrics(CURRENT_DATE - 5) as day_5_processed;
SELECT calculate_daily_metrics(CURRENT_DATE - 6) as day_6_processed;

-- Show the results
SELECT 'Results - Daily metrics generated:' as step_5;
SELECT 
    dm.tracking_date, 
    u.username, 
    dm.total_distance_km, 
    dm.total_time_minutes, 
    dm.average_speed_kmh,
    dm.route_efficiency_score
FROM gps_daily_metrics dm
JOIN users u ON dm.livreur_id = u.id
WHERE dm.tracking_date >= CURRENT_DATE - INTERVAL '7 days'
  AND u.role = 'LIVREUR'
ORDER BY dm.tracking_date DESC, u.username;

-- Verification query
SELECT 'Verification - Count by date:' as step_6;
SELECT tracking_date, COUNT(*) as metrics_count
FROM gps_daily_metrics 
WHERE tracking_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY tracking_date
ORDER BY tracking_date DESC; 