-- ========================================
-- INSTALLATION COMPLÈTE - SYSTÈME DE CRÉDITS CLIENTS MATA
-- Version PRODUCTION - Gère tous les cas
-- ========================================

-- ========================================
-- ÉTAPE 1 : CRÉER LA TABLE client_credits
-- ========================================

CREATE TABLE IF NOT EXISTS client_credits (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(50) NOT NULL UNIQUE,
  credit_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  expiration_days INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_by VARCHAR(100),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);

-- Ajouter la colonne version si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'client_credits' 
        AND column_name = 'version'
    ) THEN
        ALTER TABLE client_credits 
        ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
        RAISE NOTICE '✅ Colonne version ajoutée';
    ELSE
        RAISE NOTICE 'ℹ️  Colonne version existe déjà';
    END IF;
END $$;

-- Commentaires
COMMENT ON TABLE client_credits IS 'Crédits attribués aux clients MATA avec date d''expiration et versionnage';
COMMENT ON COLUMN client_credits.phone_number IS 'Numéro de téléphone du client (clé unique)';
COMMENT ON COLUMN client_credits.credit_amount IS 'Montant du crédit en FCFA';
COMMENT ON COLUMN client_credits.expiration_days IS 'Nombre de jours avant expiration';
COMMENT ON COLUMN client_credits.expires_at IS 'Date d''expiration du crédit';
COMMENT ON COLUMN client_credits.version IS 'Numéro de version pour Optimistic Locking (évite les race conditions)';

-- ========================================
-- ÉTAPE 2 : CRÉER LES INDEX
-- ========================================

CREATE INDEX IF NOT EXISTS idx_client_credits_phone ON client_credits(phone_number);
CREATE INDEX IF NOT EXISTS idx_client_credits_expires_at ON client_credits(expires_at);
CREATE INDEX IF NOT EXISTS idx_client_credits_version ON client_credits(version);

-- ========================================
-- ÉTAPE 3 : CRÉER LES TRIGGERS
-- ========================================

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_client_credits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour incrémenter la version
CREATE OR REPLACE FUNCTION increment_client_credits_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer les triggers
DROP TRIGGER IF EXISTS trigger_update_client_credits_updated_at ON client_credits;
CREATE TRIGGER trigger_update_client_credits_updated_at
  BEFORE UPDATE ON client_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_client_credits_updated_at();

DROP TRIGGER IF EXISTS trigger_increment_client_credits_version ON client_credits;
CREATE TRIGGER trigger_increment_client_credits_version
  BEFORE UPDATE ON client_credits
  FOR EACH ROW
  EXECUTE FUNCTION increment_client_credits_version();

-- ========================================
-- ÉTAPE 4 : CRÉER LA VUE valid_client_credits
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
  EXTRACT(DAY FROM (expires_at - CURRENT_TIMESTAMP)) AS days_remaining
FROM client_credits
WHERE expires_at > CURRENT_TIMESTAMP
ORDER BY expires_at ASC;

COMMENT ON VIEW valid_client_credits IS 'Vue des crédits clients valides (non expirés) avec jours restants';

-- ========================================
-- ÉTAPE 5 : CRÉER LA TABLE client_credit_transactions
-- ========================================

CREATE TABLE IF NOT EXISTS client_credit_transactions (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(50) NOT NULL,
  transaction_type VARCHAR(20) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  balance_before DECIMAL(10,2) NOT NULL DEFAULT 0,
  balance_after DECIMAL(10,2) NOT NULL DEFAULT 0,
  order_id VARCHAR(100),
  notes TEXT,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Commentaires
COMMENT ON TABLE client_credit_transactions IS 'Historique de toutes les transactions de crédits clients';
COMMENT ON COLUMN client_credit_transactions.transaction_type IS 'Type: CREDIT, DEBIT, REFUND';

-- ========================================
-- ÉTAPE 6 : CRÉER LES INDEX DE L'HISTORIQUE
-- ========================================

CREATE INDEX IF NOT EXISTS idx_credit_transactions_phone ON client_credit_transactions(phone_number);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_order_id ON client_credit_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON client_credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_date ON client_credit_transactions(created_at DESC);

-- ========================================
-- ÉTAPE 7 : CRÉER LA VUE credit_transactions_history
-- ========================================

CREATE OR REPLACE VIEW credit_transactions_history AS
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
  CASE 
    WHEN t.transaction_type = 'CREDIT' THEN '✅ Attribution'
    WHEN t.transaction_type = 'DEBIT' THEN '💳 Utilisation'
    WHEN t.transaction_type = 'REFUND' THEN '🔄 Remboursement'
    ELSE t.transaction_type
  END as transaction_label
FROM client_credit_transactions t
ORDER BY t.created_at DESC;

COMMENT ON VIEW credit_transactions_history IS 'Vue de l''historique des transactions avec labels lisibles';

-- ========================================
-- ÉTAPE 8 : VÉRIFICATION FINALE
-- ========================================

-- Vérifier les tables
SELECT '✅ Tables créées:' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('client_credits', 'client_credit_transactions');

-- Vérifier la colonne version
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'client_credits' AND column_name = 'version'
    ) THEN '✅ Colonne version OK'
    ELSE '❌ Colonne version MANQUANTE'
  END as status_version;

-- Vérifier les triggers
SELECT '✅ Triggers créés:' as status;
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE event_object_table = 'client_credits';

-- Message final
SELECT '🎉 Installation terminée avec succès!' as status;
SELECT 'ℹ️  Redémarrez le backend pour appliquer les changements' as next_step;

