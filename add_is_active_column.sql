-- Ajouter la colonne is_active à la table users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Mettre à jour tous les utilisateurs existants pour qu'ils soient actifs par défaut
UPDATE users SET is_active = true WHERE is_active IS NULL;

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN users.is_active IS 'Indique si l''utilisateur est actif (true) ou désactivé (false)'; 