-- ========================================
-- SCRIPT D'AUTO-TAGGING DES CLIENTS MATA
-- Version: 1.0
-- Description: Tague automatiquement les clients selon des critères
-- ========================================

-- ========================================
-- CRITÈRES DE TAGGING
-- ========================================
-- VVIP : 30+ commandes OU 1,000,000+ FCFA dépensés
-- VIP  : 10+ commandes OU 500,000+ FCFA dépensés
-- STANDARD : Autres
-- ========================================

BEGIN;

-- ========================================
-- ÉTAPE 1 : CRÉER UNE TABLE TEMPORAIRE DES STATISTIQUES
-- ========================================

CREATE TEMP TABLE IF NOT EXISTS client_stats AS
SELECT 
  phone_number,
  COUNT(*) as total_orders,
  SUM(amount) as total_spent,
  MAX(created_at) as last_order_date
FROM orders
WHERE order_type = 'MATA'
  AND phone_number IS NOT NULL
  AND phone_number != ''
GROUP BY phone_number;

-- ========================================
-- ÉTAPE 2 : AFFICHER LES STATISTIQUES AVANT TAGGING
-- ========================================

SELECT '📊 STATISTIQUES AVANT AUTO-TAGGING' as step;

SELECT 
  COALESCE(client_tag, 'STANDARD') as tag_actuel,
  COUNT(*) as nombre_clients
FROM client_credits
GROUP BY client_tag
ORDER BY 
  CASE COALESCE(client_tag, 'STANDARD')
    WHEN 'VVIP' THEN 1
    WHEN 'VIP' THEN 2
    WHEN 'STANDARD' THEN 3
  END;

-- ========================================
-- ÉTAPE 3 : IDENTIFIER LES CLIENTS À TAGUER
-- ========================================

SELECT '🔍 ANALYSE DES CLIENTS' as step;

WITH tagged_clients AS (
  SELECT 
    cs.phone_number,
    cs.total_orders,
    cs.total_spent,
    cs.last_order_date,
    CASE 
      WHEN cs.total_orders >= 30 OR cs.total_spent >= 1000000 THEN 'VVIP'
      WHEN cs.total_orders >= 10 OR cs.total_spent >= 500000 THEN 'VIP'
      ELSE 'STANDARD'
    END as suggested_tag
  FROM client_stats cs
)
SELECT 
  suggested_tag,
  COUNT(*) as nombre_clients,
  AVG(total_orders)::DECIMAL(10,1) as avg_orders,
  AVG(total_spent)::DECIMAL(10,0) as avg_spent
FROM tagged_clients
GROUP BY suggested_tag
ORDER BY 
  CASE suggested_tag
    WHEN 'VVIP' THEN 1
    WHEN 'VIP' THEN 2
    WHEN 'STANDARD' THEN 3
  END;

-- ========================================
-- ÉTAPE 4 : AUTO-TAGGING - VVIP (30+ commandes OU 1M+ FCFA)
-- ========================================

SELECT '👑 TAGGING VVIP...' as step;

UPDATE client_credits cc
SET client_tag = 'VVIP'
FROM client_stats cs
WHERE cc.phone_number = cs.phone_number
  AND (cs.total_orders >= 30 OR cs.total_spent >= 1000000)
  AND COALESCE(cc.client_tag, 'STANDARD') != 'VVIP';

-- Afficher les clients VVIP
SELECT 
  COUNT(*) as clients_vvip_tagges,
  string_agg(phone_number, ', ' ORDER BY total_orders DESC) as exemples
FROM (
  SELECT cc.phone_number, cs.total_orders
  FROM client_credits cc
  JOIN client_stats cs ON cc.phone_number = cs.phone_number
  WHERE cc.client_tag = 'VVIP'
  LIMIT 5
) subq;

-- ========================================
-- ÉTAPE 5 : AUTO-TAGGING - VIP (10+ commandes OU 500k+ FCFA)
-- ========================================

SELECT '⭐ TAGGING VIP...' as step;

UPDATE client_credits cc
SET client_tag = 'VIP'
FROM client_stats cs
WHERE cc.phone_number = cs.phone_number
  AND (cs.total_orders >= 10 OR cs.total_spent >= 500000)
  AND COALESCE(cc.client_tag, 'STANDARD') NOT IN ('VVIP', 'VIP');

-- Afficher les clients VIP
SELECT 
  COUNT(*) as clients_vip_tagges,
  string_agg(phone_number, ', ' ORDER BY total_orders DESC) as exemples
FROM (
  SELECT cc.phone_number, cs.total_orders
  FROM client_credits cc
  JOIN client_stats cs ON cc.phone_number = cs.phone_number
  WHERE cc.client_tag = 'VIP'
  LIMIT 5
) subq;

-- ========================================
-- ÉTAPE 6 : STATISTIQUES APRÈS TAGGING
-- ========================================

SELECT '📊 STATISTIQUES APRÈS AUTO-TAGGING' as step;

SELECT 
  COALESCE(client_tag, 'STANDARD') as tag,
  COUNT(*) as nombre_clients,
  SUM(credit_amount)::DECIMAL(10,0) as total_credits,
  AVG(credit_amount)::DECIMAL(10,0) as credit_moyen
FROM client_credits
GROUP BY client_tag
ORDER BY 
  CASE COALESCE(client_tag, 'STANDARD')
    WHEN 'VVIP' THEN 1
    WHEN 'VIP' THEN 2
    WHEN 'STANDARD' THEN 3
  END;

-- ========================================
-- ÉTAPE 7 : TOP 10 CLIENTS VVIP
-- ========================================

SELECT '🏆 TOP 10 CLIENTS VVIP' as step;

SELECT 
  cc.phone_number,
  cs.total_orders as commandes,
  cs.total_spent::DECIMAL(10,0) as total_depense,
  cc.credit_amount::DECIMAL(10,0) as credit_actuel,
  cc.client_tag
FROM client_credits cc
JOIN client_stats cs ON cc.phone_number = cs.phone_number
WHERE cc.client_tag = 'VVIP'
ORDER BY cs.total_spent DESC
LIMIT 10;

-- ========================================
-- ÉTAPE 8 : TOP 20 CLIENTS VIP
-- ========================================

SELECT '⭐ TOP 20 CLIENTS VIP' as step;

SELECT 
  cc.phone_number,
  cs.total_orders as commandes,
  cs.total_spent::DECIMAL(10,0) as total_depense,
  cc.credit_amount::DECIMAL(10,0) as credit_actuel,
  cc.client_tag
FROM client_credits cc
JOIN client_stats cs ON cc.phone_number = cs.phone_number
WHERE cc.client_tag = 'VIP'
ORDER BY cs.total_spent DESC
LIMIT 20;

-- ========================================
-- ÉTAPE 9 : CLIENTS PROCHES DU STATUT VIP
-- ========================================

SELECT '📈 CLIENTS PROCHES DU STATUT VIP (7-9 commandes)' as step;

SELECT 
  cs.phone_number,
  cs.total_orders as commandes,
  cs.total_spent::DECIMAL(10,0) as total_depense,
  (10 - cs.total_orders) as commandes_manquantes,
  COALESCE(cc.client_tag, 'STANDARD') as tag_actuel
FROM client_stats cs
LEFT JOIN client_credits cc ON cs.phone_number = cc.phone_number
WHERE cs.total_orders BETWEEN 7 AND 9
  AND cs.total_spent < 500000
ORDER BY cs.total_orders DESC, cs.total_spent DESC
LIMIT 15;

-- ========================================
-- ÉTAPE 10 : VALIDATION ET COMMIT
-- ========================================

-- Afficher le résumé des changements
SELECT '✅ RÉSUMÉ DES CHANGEMENTS' as step;

WITH before_counts AS (
  SELECT 
    'Avant' as periode,
    COUNT(*) FILTER (WHERE client_tag = 'VVIP') as vvip,
    COUNT(*) FILTER (WHERE client_tag = 'VIP') as vip,
    COUNT(*) FILTER (WHERE COALESCE(client_tag, 'STANDARD') = 'STANDARD') as standard,
    COUNT(*) as total
  FROM client_credits
)
SELECT * FROM before_counts;

-- Nettoyage de la table temporaire
DROP TABLE IF EXISTS client_stats;

-- Message de confirmation
SELECT '🎉 AUTO-TAGGING TERMINÉ AVEC SUCCÈS!' as status;
SELECT 'ℹ️  Vérifiez les résultats ci-dessus avant de faire COMMIT' as info;
SELECT 'ℹ️  Pour annuler : ROLLBACK;  Pour confirmer : COMMIT;' as action;

-- ========================================
-- COMMIT OU ROLLBACK
-- ========================================
-- Décommentez l'une des lignes suivantes :

-- COMMIT;   -- Pour confirmer les changements
-- ROLLBACK; -- Pour annuler les changements

-- ========================================
-- NOTES D'UTILISATION
-- ========================================
-- 1. Ce script utilise une transaction (BEGIN...COMMIT)
-- 2. Vérifiez les résultats avant de faire COMMIT
-- 3. Pour tester sans appliquer : faites ROLLBACK à la fin
-- 4. Les critères sont personnalisables (lignes 13-15)
-- 
-- PERSONNALISATION DES CRITÈRES :
-- Pour changer les seuils, modifiez les valeurs dans les UPDATE :
--   - VVIP : total_orders >= 30 OR total_spent >= 1000000
--   - VIP  : total_orders >= 10 OR total_spent >= 500000
-- 
-- EXEMPLE D'EXÉCUTION :
--   psql -U matix_user -d matix_livreur -f auto_tag_clients.sql
-- ========================================
