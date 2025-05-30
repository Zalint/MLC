-- Migration pour ajouter la colonne km à la table orders
-- Date: 2024-12-30

-- Ajouter la colonne km à la table orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS km DECIMAL(10,2) DEFAULT 0;

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN orders.km IS 'Nombre de kilomètres parcourus pour cette commande';

-- Créer un index pour améliorer les performances des requêtes sur les km
CREATE INDEX IF NOT EXISTS idx_orders_km ON orders(km);

-- Mettre à jour les enregistrements existants avec une valeur par défaut
UPDATE orders SET km = 0 WHERE km IS NULL; 