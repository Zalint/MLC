-- Migration pour ajouter la colonne km_parcourus à la table expenses
-- Date: 2024-12-19

-- Ajouter la colonne km_parcourus à la table expenses
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS km_parcourus DECIMAL(10,2) DEFAULT 0;

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN expenses.km_parcourus IS 'Nombre de kilomètres parcourus par le livreur pour cette date';

-- Créer un index pour améliorer les performances des requêtes sur les km
CREATE INDEX IF NOT EXISTS idx_expenses_km_parcourus ON expenses(km_parcourus); 