-- Script pour ajouter la colonne 'interne' à la table orders
-- Cette colonne indique si la commande est une commande interne (MATA)

-- Ajouter la colonne interne
ALTER TABLE orders ADD COLUMN IF NOT EXISTS interne BOOLEAN DEFAULT false;

-- Ajouter un index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_orders_interne ON orders(interne);

-- Mettre à jour les commandes existantes qui ont client_name = 'COMMANDE INTERNE'
-- pour marquer automatiquement les anciennes commandes internes
UPDATE orders 
SET interne = true 
WHERE client_name = 'COMMANDE INTERNE' 
  AND phone_number = '0000000000';

-- Afficher un résumé des modifications
SELECT 
    'Migration terminée' as status,
    COUNT(*) as total_commandes,
    COUNT(CASE WHEN interne = true THEN 1 END) as commandes_internes,
    COUNT(CASE WHEN interne = false THEN 1 END) as commandes_externes
FROM orders; 