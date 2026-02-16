-- ========================================
-- AJOUT DU SYSTÈME DE TAGS CLIENTS
-- Version: 1.0
-- Description: Ajoute une colonne client_tag à la table client_credits
-- Tags disponibles: STANDARD, VIP, VVIP
-- ========================================

-- ========================================
-- ÉTAPE 1 : AJOUTER LA COLONNE client_tag
-- ========================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'client_credits' 
        AND column_name = 'client_tag'
    ) THEN
        ALTER TABLE client_credits 
        ADD COLUMN client_tag VARCHAR(20) DEFAULT 'STANDARD' CHECK (client_tag IN ('STANDARD', 'VIP', 'VVIP'));
        
        RAISE NOTICE '✅ Colonne client_tag ajoutée avec succès';
    ELSE
        RAISE NOTICE 'ℹ️  Colonne client_tag existe déjà';
    END IF;
END $$;

-- ========================================
-- ÉTAPE 2 : CRÉER L'INDEX
-- ========================================

CREATE INDEX IF NOT EXISTS idx_client_credits_tag ON client_credits(client_tag);

-- ========================================
-- ÉTAPE 3 : AJOUTER LE COMMENTAIRE
-- ========================================

COMMENT ON COLUMN client_credits.client_tag IS 'Tag du client: STANDARD (défaut), VIP, VVIP';

-- ========================================
-- ÉTAPE 4 : METTRE À JOUR LA VUE valid_client_credits
-- ========================================

DROP VIEW IF EXISTS valid_client_credits CASCADE;

CREATE VIEW valid_client_credits AS
SELECT 
  id,
  phone_number,
  credit_amount,
  expiration_days,
  created_at,
  expires_at,
  created_by,
  updated_at,
  notes,
  version,
  client_tag,
  EXTRACT(DAY FROM (expires_at - CURRENT_TIMESTAMP)) AS days_remaining
FROM client_credits
WHERE expires_at > CURRENT_TIMESTAMP
ORDER BY expires_at ASC;

COMMENT ON VIEW valid_client_credits IS 'Vue des crédits clients valides (non expirés) avec jours restants et tags';

-- ========================================
-- ÉTAPE 5 : METTRE À JOUR LA VUE credit_transactions_history
-- ========================================

DROP VIEW IF EXISTS credit_transactions_history CASCADE;

CREATE VIEW credit_transactions_history AS
SELECT 
  t.id,
  t.phone_number,
  t.transaction_type,
  t.amount,
  t.balance_before,
  t.balance_after,
  t.order_id,
  t.notes,
  t.created_by,
  t.created_at,
  cc.client_tag,
  CASE 
    WHEN t.transaction_type = 'CREDIT' THEN '✅ Attribution'
    WHEN t.transaction_type = 'DEBIT' THEN '💳 Utilisation'
    WHEN t.transaction_type = 'REFUND' THEN '🔄 Remboursement'
    ELSE t.transaction_type
  END as transaction_label
FROM client_credit_transactions t
LEFT JOIN client_credits cc ON t.phone_number = cc.phone_number
ORDER BY t.created_at DESC;

COMMENT ON VIEW credit_transactions_history IS 'Vue de l''historique des transactions avec labels lisibles et tags clients';

-- ========================================
-- ÉTAPE 6 : VÉRIFICATION
-- ========================================

-- Vérifier que la colonne a été ajoutée
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'client_credits' AND column_name = 'client_tag'
    ) THEN '✅ Colonne client_tag créée avec succès'
    ELSE '❌ Erreur: Colonne client_tag non créée'
  END as status;

-- Vérifier l'index
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'client_credits' AND indexname = 'idx_client_credits_tag'
    ) THEN '✅ Index idx_client_credits_tag créé'
    ELSE '❌ Erreur: Index non créé'
  END as index_status;

-- Afficher la structure de la colonne
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'client_credits' 
  AND column_name = 'client_tag';

-- Statistiques des tags existants
SELECT 
  client_tag,
  COUNT(*) as count,
  SUM(credit_amount) as total_credits
FROM client_credits
GROUP BY client_tag
ORDER BY 
  CASE client_tag
    WHEN 'VVIP' THEN 1
    WHEN 'VIP' THEN 2
    WHEN 'STANDARD' THEN 3
    ELSE 4
  END;

-- ========================================
-- MESSAGE FINAL
-- ========================================

SELECT '🎉 Installation du système de tags terminée!' as status;
SELECT 'ℹ️  Tags disponibles: STANDARD (défaut), VIP, VVIP' as info;
SELECT 'ℹ️  Redémarrez le backend pour appliquer les changements API' as next_step;
