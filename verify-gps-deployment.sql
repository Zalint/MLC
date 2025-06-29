-- =====================================================
-- SCRIPT DE VÉRIFICATION GPS POST-DÉPLOIEMENT
-- =====================================================
-- À exécuter après le déploiement pour vérifier que tout fonctionne
-- =====================================================

\echo '🔍 === VÉRIFICATION DU DÉPLOIEMENT GPS ==='

-- 1. VÉRIFIER LES EXTENSIONS
\echo '1. Vérification des extensions...'
SELECT 
    extname as extension_name,
    extversion as version
FROM pg_extension 
WHERE extname = 'uuid-ossp';

-- 2. VÉRIFIER LES TABLES GPS
\echo '2. Vérification des tables GPS...'
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'gps_%'
ORDER BY table_name;

-- 3. VÉRIFIER LES FONCTIONS GPS
\echo '3. Vérification des fonctions GPS...'
SELECT 
    proname as function_name,
    pronargs as nb_arguments
FROM pg_proc 
WHERE proname IN ('calculate_gps_distance', 'calculate_daily_metrics', 'cleanup_old_gps_data');

-- 4. TESTER LA FONCTION DE CALCUL GPS
\echo '4. Test de la fonction de calcul GPS...'
SELECT 
    calculate_gps_distance(14.6928, -17.4467, 14.7028, -17.4567) as distance_meters,
    ROUND(calculate_gps_distance(14.6928, -17.4467, 14.7028, -17.4567) / 1000.0, 2) as distance_km;

-- 5. VÉRIFIER LES INDEX
\echo '5. Vérification des index GPS...'
SELECT 
    schemaname,
    tablename,
    indexname
FROM pg_indexes 
WHERE tablename LIKE 'gps_%'
ORDER BY tablename, indexname;

-- 6. VÉRIFIER LES VUES
\echo '6. Vérification des vues GPS...'
SELECT 
    viewname,
    definition IS NOT NULL as has_definition
FROM pg_views 
WHERE viewname LIKE '%gps%' OR viewname LIKE '%position%'
ORDER BY viewname;

-- 7. VÉRIFIER LES LIVREURS ET LEURS PARAMÈTRES GPS
\echo '7. État des paramètres GPS des livreurs...'
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
\echo '8. Statistiques des données GPS...'
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
\echo '9. Livreurs sans paramètres GPS...'
SELECT 
    u.username,
    u.id
FROM users u
WHERE u.role = 'LIVREUR' 
  AND u.is_active = true
  AND u.id NOT IN (SELECT livreur_id FROM gps_settings WHERE livreur_id IS NOT NULL);

-- 10. TEST DU CALCUL DES MÉTRIQUES
\echo '10. Test du calcul des métriques quotidiennes...'
SELECT calculate_daily_metrics(CURRENT_DATE) as livreurs_processed;

-- 11. VÉRIFIER LES CONTRAINTES ET CLÉS ÉTRANGÈRES
\echo '11. Vérification des contraintes...'
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_name LIKE 'gps_%'
  AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE')
ORDER BY tc.table_name, tc.constraint_type;

-- 12. RÉSUMÉ FINAL
\echo '12. === RÉSUMÉ FINAL ==='

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
\echo '13. === RECOMMANDATIONS ==='
\echo 'Si tout est OK :'
\echo '✅ 3 tables GPS créées'
\echo '✅ 2 fonctions GPS fonctionnelles'  
\echo '✅ Tous les livreurs ont des paramètres GPS'
\echo ''
\echo 'Prochaines étapes :'
\echo '1. Tester les endpoints API GPS'
\echo '2. Vérifier l''interface frontend'
\echo '3. Activer le GPS pour les livreurs souhaités'
\echo '4. Tester l''enregistrement de positions GPS'

\echo '🎉 Vérification terminée!' 