-- ========================================
-- SQL DE PRODUCTION - SYSTÈME DE CRÉDITS CLIENTS MATA
-- Date: 21 janvier 2026
-- Version: 2.0 (avec Optimistic Locking)
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
  notes TEXT,
  version INTEGER NOT NULL DEFAULT 1  -- Optimistic Locking
);

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

-- Index pour recherche rapide par téléphone
CREATE INDEX IF NOT EXISTS idx_client_credits_phone ON client_credits(phone_number);

-- Index pour trouver les crédits expirés
CREATE INDEX IF NOT EXISTS idx_client_credits_expires_at ON client_credits(expires_at);

-- Index sur version pour Optimistic Locking
CREATE INDEX IF NOT EXISTS idx_client_credits_version ON client_credits(version);

-- ========================================
-- ÉTAPE 3 : CRÉER LES TRIGGERS
-- ========================================

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_client_credits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_client_credits_updated_at
  BEFORE UPDATE ON client_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_client_credits_updated_at();

-- Trigger pour auto-incrémenter la version lors des UPDATE
CREATE OR REPLACE FUNCTION increment_client_credits_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
-- ÉTAPE 5 : CRÉER LA TABLE client_credit_transactions (HISTORIQUE)
-- ========================================

CREATE TABLE IF NOT EXISTS client_credit_transactions (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(50) NOT NULL,
  transaction_type VARCHAR(20) NOT NULL, -- 'CREDIT' (attribution) ou 'DEBIT' (utilisation) ou 'REFUND' (remboursement)
  amount DECIMAL(10,2) NOT NULL,
  balance_before DECIMAL(10,2) NOT NULL DEFAULT 0,
  balance_after DECIMAL(10,2) NOT NULL DEFAULT 0,
  order_id VARCHAR(100),
  notes TEXT,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Commentaires
COMMENT ON TABLE client_credit_transactions IS 'Historique de toutes les transactions de crédits clients (attributions et utilisations)';
COMMENT ON COLUMN client_credit_transactions.transaction_type IS 'Type: CREDIT (attribution), DEBIT (utilisation), REFUND (remboursement)';
COMMENT ON COLUMN client_credit_transactions.amount IS 'Montant de la transaction en FCFA';
COMMENT ON COLUMN client_credit_transactions.balance_before IS 'Solde avant la transaction';
COMMENT ON COLUMN client_credit_transactions.balance_after IS 'Solde après la transaction';
COMMENT ON COLUMN client_credit_transactions.order_id IS 'ID de la commande associée (pour les débits et remboursements)';
COMMENT ON COLUMN client_credit_transactions.created_by IS 'Manager/Admin qui a effectué la transaction ou SYSTEM';

-- ========================================
-- ÉTAPE 6 : CRÉER LES INDEX DE L'HISTORIQUE
-- ========================================

-- Index pour recherche rapide par téléphone
CREATE INDEX IF NOT EXISTS idx_credit_transactions_phone ON client_credit_transactions(phone_number);

-- Index pour recherche par order_id
CREATE INDEX IF NOT EXISTS idx_credit_transactions_order_id ON client_credit_transactions(order_id);

-- Index pour recherche par type de transaction
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON client_credit_transactions(transaction_type);

-- Index pour recherche par date
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
-- ÉTAPE 8 : VÉRIFICATION (optionnel)
-- ========================================

-- Vérifier que les tables existent
SELECT 
  table_name, 
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('client_credits', 'client_credit_transactions')
ORDER BY table_name;

-- Vérifier les colonnes de client_credits
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'client_credits'
ORDER BY ordinal_position;

-- Vérifier les index
SELECT 
  indexname, 
  indexdef
FROM pg_indexes
WHERE tablename IN ('client_credits', 'client_credit_transactions')
ORDER BY tablename, indexname;

-- ========================================
-- NOTES DE MIGRATION
-- ========================================

/*
1. Ce script est IDEMPOTENT (peut être exécuté plusieurs fois sans erreur)

2. Si les tables existent déjà SANS le champ 'version':
   - La colonne version sera ajoutée avec DEFAULT 1
   - Les crédits existants auront version=1
   
3. Les triggers s'appliqueront automatiquement aux nouveaux UPDATE

4. IMPORTANT: Après exécution, redémarrer l'application backend pour charger les nouveaux controllers

5. BACKUP: Toujours faire un backup avant d'exécuter en production:
   pg_dump -U your_user -d your_database > backup_before_credits_$(date +%Y%m%d).sql

6. ROLLBACK (si nécessaire):
   DROP TABLE IF EXISTS client_credit_transactions CASCADE;
   DROP TABLE IF EXISTS client_credits CASCADE;
   DROP VIEW IF EXISTS credit_transactions_history CASCADE;
   DROP VIEW IF EXISTS valid_client_credits CASCADE;
*/

-- ========================================
-- FIN DU SCRIPT
-- ========================================

SELECT 'Migration terminée avec succès!' AS status;

