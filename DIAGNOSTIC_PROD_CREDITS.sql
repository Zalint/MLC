-- ========================================
-- DIAGNOSTIC - Vérifier l'état des tables de crédits en PROD
-- ========================================

-- 1. Vérifier si les tables existent
SELECT 
  table_name, 
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('client_credits', 'client_credit_transactions')
ORDER BY table_name;

-- 2. Vérifier les colonnes de client_credits
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'client_credits'
ORDER BY ordinal_position;

-- 3. Vérifier si la colonne version existe
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'client_credits' 
      AND column_name = 'version'
    ) THEN '✅ Colonne version existe'
    ELSE '❌ Colonne version MANQUANTE'
  END as status_version;

-- 4. Vérifier les triggers
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE event_object_table IN ('client_credits', 'client_credit_transactions')
ORDER BY event_object_table, trigger_name;

-- 5. Vérifier les fonctions
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%client_credit%'
ORDER BY routine_name;

-- 6. Compter les crédits existants (si table existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_credits') THEN
    RAISE NOTICE 'Nombre de crédits: %', (SELECT COUNT(*) FROM client_credits);
  ELSE
    RAISE NOTICE '❌ Table client_credits n''existe pas';
  END IF;
END $$;

