-- Ajout du champ version pour gérer l'Optimistic Locking
-- Évite les race conditions lors d'utilisations simultanées du crédit

-- Ajouter la colonne version
ALTER TABLE client_credits 
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Créer un index sur version pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_client_credits_version ON client_credits(version);

-- Ajouter un commentaire
COMMENT ON COLUMN client_credits.version IS 'Numéro de version pour Optimistic Locking (évite les race conditions)';

-- Fonction trigger pour auto-incrémenter la version lors des UPDATE
CREATE OR REPLACE FUNCTION increment_client_credits_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour auto-incrémenter la version
DROP TRIGGER IF EXISTS trigger_increment_client_credits_version ON client_credits;
CREATE TRIGGER trigger_increment_client_credits_version
  BEFORE UPDATE ON client_credits
  FOR EACH ROW
  EXECUTE FUNCTION increment_client_credits_version();

-- Supprimer et recréer la vue pour inclure la version
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

