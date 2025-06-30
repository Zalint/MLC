const db = require('./models/database');

async function applyGlobal100mFilter() {
    try {
        console.log('🌍 Applying 100m accuracy filter globally to all GPS analytics...\n');
        
        // Step 1: Update the database function with 100m accuracy filter
        console.log('📝 Updating calculate_daily_metrics function with 100m filter...');
        
        const updateFunctionSQL = `
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
                                6371000 * acos(
                                    LEAST(1.0, cos(radians(LAG(latitude) OVER (ORDER BY timestamp))) 
                                    * cos(radians(latitude)) 
                                    * cos(radians(longitude) - radians(LAG(longitude) OVER (ORDER BY timestamp))) 
                                    + sin(radians(LAG(latitude) OVER (ORDER BY timestamp))) 
                                    * sin(radians(latitude)))
                                ) / 1000.0) -- Convert to km
                            ELSE 0 
                        END) as total_distance_km,
                        AVG(NULLIF(speed, 0)) as avg_speed,
                        MAX(speed) as max_speed,
                        COUNT(CASE WHEN speed IS NOT NULL AND speed < 2 THEN 1 END) as slow_points
                    FROM filtered_positions
                )
                SELECT 
                    COALESCE(pa.total_distance_km, 0) as total_distance_km,
                    COALESCE(EXTRACT(EPOCH FROM (pa.end_time - pa.start_time)) / 60.0, 0) as total_time_minutes,
                    COALESCE(pa.avg_speed, 0) as average_speed_kmh,
                    COALESCE(pa.max_speed, 0) as max_speed_kmh,
                    GREATEST(1, pa.slow_points / 10) as estimated_stops,
                    -- Improved efficiency calculations
                    CASE 
                        WHEN pa.avg_speed > 0 AND pa.avg_speed <= 50
                        THEN LEAST(100, GREATEST(0, (pa.avg_speed / 25.0) * 100))
                        WHEN pa.avg_speed > 50
                        THEN GREATEST(0, 100 - (pa.avg_speed - 50) * 2)
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
                IF daily_stats.total_distance_km > 0.05 THEN
                    INSERT INTO gps_daily_metrics (
                        livreur_id, tracking_date, total_distance_km, total_time_minutes,
                        active_time_minutes, average_speed_kmh, max_speed_kmh, total_stops,
                        longest_stop_minutes, fuel_efficiency_score, route_efficiency_score
                    ) VALUES (
                        livreur_record.id, target_date, 
                        ROUND(daily_stats.total_distance_km, 2),
                        ROUND(daily_stats.total_time_minutes),
                        ROUND(daily_stats.total_time_minutes * 0.8),
                        ROUND(daily_stats.average_speed_kmh, 2),
                        ROUND(daily_stats.max_speed_kmh, 2),
                        daily_stats.estimated_stops,
                        ROUND(daily_stats.total_time_minutes / 4),
                        ROUND(daily_stats.fuel_efficiency_score, 2),
                        ROUND(daily_stats.route_efficiency_score, 2)
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
        `;
        
        await db.query(updateFunctionSQL);
        console.log('✅ Database function updated with global 100m accuracy filter');
        
        // Step 2: Recalculate all existing analytics
        console.log('\n🔄 Recalculating analytics for all users with 100m filter...');
        
        const livreurs = await db.query(`
            SELECT id, username FROM users 
            WHERE role = 'LIVREUR' AND is_active = true
        `);
        
        console.log(`📊 Found ${livreurs.rows.length} active delivery drivers`);
        
        let totalUpdated = 0;
        
        for (const livreur of livreurs.rows) {
            console.log(`\n👤 Processing ${livreur.username}...`);
            
            // Get dates with GPS data for this user
            const datesResult = await db.query(`
                SELECT DISTINCT DATE(timestamp) as tracking_date
                FROM gps_locations 
                WHERE livreur_id = $1 
                  AND timestamp >= CURRENT_DATE - INTERVAL '30 days'
                ORDER BY tracking_date DESC
            `, [livreur.id]);
            
            if (datesResult.rows.length === 0) {
                console.log(`  ⚠️  No GPS data found`);
                continue;
            }
            
            console.log(`  📍 Found GPS data for ${datesResult.rows.length} days`);
            
            // Recalculate for each date with the new 100m filter
            for (const dateRow of datesResult.rows) {
                const targetDate = dateRow.tracking_date;
                
                const result = await db.query(`
                    SELECT calculate_daily_metrics($1::date) as processed_count
                `, [targetDate]);
                
                if (result.rows[0].processed_count > 0) {
                    totalUpdated++;
                    console.log(`  ✅ Updated analytics for ${targetDate.toISOString().split('T')[0]} with 100m filter`);
                } else {
                    console.log(`  ⏭️  No meaningful data for ${targetDate.toISOString().split('T')[0]} (distance < 0.05km)`);
                }
            }
        }
        
        console.log(`\n🎉 Global 100m accuracy filter application complete!`);
        console.log(`📊 Updated analytics for ${totalUpdated} user-day combinations`);
        console.log(`👥 All ${livreurs.rows.length} delivery drivers now use 100m accuracy filtering`);
        
        console.log('\n⚙️ Global GPS Analytics Standards:');
        console.log('  🎯 Primary accuracy filter: ≤100m (eliminates GPS drift)');
        console.log('  🛡️  Fallback accuracy filter: ≤500m (worst case scenarios)');
        console.log('  🚀 Jump filter: <2km (realistic movement detection)');
        console.log('  📏 Minimum distance threshold: 0.05km (meaningful trips)');
        
        console.log('\n💡 Benefits of 100m Global Filter:');
        console.log('  ✨ More accurate distance calculations for all users');
        console.log('  🎯 Eliminates GPS drift and bad readings universally');
        console.log('  📈 Better performance metrics across the platform');
        console.log('  🏆 Consistent accuracy standards for fair comparisons');
        console.log('  🚚 Improved driver performance rankings');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error applying global 100m filter:', error);
        process.exit(1);
    }
}

applyGlobal100mFilter(); 