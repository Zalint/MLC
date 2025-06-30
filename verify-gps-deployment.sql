-- =====================================================
-- SCRIPT DE VÉRIFICATION GPS POST-DÉPLOIEMENT
-- =====================================================
-- À exécuter après le déploiement pour vérifier que tout fonctionne
-- =====================================================

-- =====================================================
-- 🔍 VÉRIFICATION DU DÉPLOIEMENT GPS
-- =====================================================

-- 1. VÉRIFIER LES EXTENSIONS
SELECT '🔍 === VÉRIFICATION DU DÉPLOIEMENT GPS ===' as verification_start;
SELECT '1. Vérification des extensions...' as step_1;
SELECT 
    extname as extension_name,
    extversion as version
FROM pg_extension 
WHERE extname = 'uuid-ossp';

-- 2. VÉRIFIER LES TABLES GPS
SELECT '2. Vérification des tables GPS...' as step_2;
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'gps_%'
ORDER BY table_name;

-- 3. VÉRIFIER LES FONCTIONS GPS
SELECT '3. Vérification des fonctions GPS...' as step_3;
SELECT 
    proname as function_name,
    pronargs as nb_arguments
FROM pg_proc 
WHERE proname IN ('calculate_gps_distance', 'calculate_daily_metrics', 'cleanup_old_gps_data');

-- 4. TESTER LA FONCTION DE CALCUL GPS
SELECT '4. Test de la fonction de calcul GPS...' as step_4;
SELECT 
    calculate_gps_distance(14.6928, -17.4467, 14.7028, -17.4567) as distance_meters,
    ROUND(calculate_gps_distance(14.6928, -17.4467, 14.7028, -17.4567) / 1000.0, 2) as distance_km;

-- 5. VÉRIFIER LES INDEX
SELECT '5. Vérification des index GPS...' as step_5;
SELECT 
    schemaname,
    tablename,
    indexname
FROM pg_indexes 
WHERE tablename LIKE 'gps_%'
ORDER BY tablename, indexname;

-- 6. VÉRIFIER LES VUES
SELECT '6. Vérification des vues GPS...' as step_6;
SELECT 
    viewname,
    definition IS NOT NULL as has_definition
FROM pg_views 
WHERE viewname LIKE '%gps%' OR viewname LIKE '%position%'
ORDER BY viewname;

-- 7. VÉRIFIER LES LIVREURS ET LEURS PARAMÈTRES GPS
SELECT '7. État des paramètres GPS des livreurs...' as step_7;
SELECT 
    u.username,
    u.role,
    u.is_active,
    COALESCE(gs.tracking_enabled, false) as gps_enabled,
    gs.tracking_interval,
    gs.last_permission_granted
FROM users u
LEFT JOIN gps_settings gs ON u.id = gs.livreur_id
WHERE u.role = 'LIVREUR'
ORDER BY u.username;

-- 8. STATISTIQUES DES DONNÉES GPS
SELECT '8. Statistiques des données GPS...' as step_8;
SELECT 
    'gps_locations' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT livreur_id) as unique_livreurs,
    MIN(timestamp) as earliest_record,
    MAX(timestamp) as latest_record
FROM gps_locations
UNION ALL
SELECT 
    'gps_settings' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT livreur_id) as unique_livreurs,
    MIN(created_at) as earliest_record,
    MAX(updated_at) as latest_record
FROM gps_settings
UNION ALL
SELECT 
    'gps_daily_metrics' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT livreur_id) as unique_livreurs,
    MIN(tracking_date::timestamp) as earliest_record,
    MAX(tracking_date::timestamp) as latest_record
FROM gps_daily_metrics;

-- 9. VÉRIFIER QUE TOUS LES LIVREURS ONT DES PARAMÈTRES GPS
SELECT '9. Livreurs sans paramètres GPS...' as step_9;
SELECT 
    u.username,
    u.id
FROM users u
WHERE u.role = 'LIVREUR' 
  AND u.is_active = true
  AND u.id NOT IN (SELECT livreur_id FROM gps_settings WHERE livreur_id IS NOT NULL);

-- 10. TEST DU CALCUL DES MÉTRIQUES
SELECT '10. Test du calcul des métriques quotidiennes...' as step_10;
SELECT calculate_daily_metrics(CURRENT_DATE) as livreurs_processed;

-- 11. VÉRIFIER LES CONTRAINTES ET CLÉS ÉTRANGÈRES
SELECT '11. Vérification des contraintes...' as step_11;
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_name LIKE 'gps_%'
  AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE')
ORDER BY tc.table_name, tc.constraint_type;

-- 12. RÉSUMÉ FINAL
SELECT '12. === RÉSUMÉ FINAL ===' as step_12;

WITH verification_summary AS (
    SELECT 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE 'gps_%') as tables_count,
        (SELECT COUNT(*) FROM pg_proc WHERE proname IN ('calculate_gps_distance', 'calculate_daily_metrics')) as functions_count,
        (SELECT COUNT(*) FROM pg_views WHERE viewname LIKE '%gps%' OR viewname LIKE '%position%') as views_count,
        (SELECT COUNT(*) FROM gps_settings) as livreurs_with_gps_settings,
        (SELECT COUNT(*) FROM users WHERE role = 'LIVREUR' AND is_active = true) as total_active_livreurs,
        (SELECT COUNT(*) FROM gps_settings WHERE tracking_enabled = true) as livreurs_gps_enabled
)
SELECT 
    'Tables GPS créées: ' || tables_count || '/3' as status_tables,
    'Fonctions GPS: ' || functions_count || '/2' as status_functions,
    'Vues GPS: ' || views_count as status_views,
    'Livreurs avec paramètres GPS: ' || livreurs_with_gps_settings || '/' || total_active_livreurs as status_settings,
    'Livreurs GPS activé: ' || livreurs_gps_enabled as status_enabled
FROM verification_summary;

-- 13. RECOMMANDATIONS
SELECT '13. === RECOMMANDATIONS ===' as step_13;

SELECT 'Si tout est OK :' as recommendations_title;
SELECT '✅ 3 tables GPS créées' as check_1;
SELECT '✅ 2 fonctions GPS fonctionnelles' as check_2;
SELECT '✅ Tous les livreurs ont des paramètres GPS' as check_3;

SELECT 'Prochaines étapes :' as next_steps_title;
SELECT '1. Tester les endpoints API GPS' as next_step_1;
SELECT '2. Vérifier l''interface frontend' as next_step_2;
SELECT '3. Activer le GPS pour les livreurs souhaités' as next_step_3;
SELECT '4. Tester l''enregistrement de positions GPS' as next_step_4;

SELECT '🎉 Vérification terminée!' as verification_complete; 