-- Migration pour ajouter les colonnes de notation MATA
-- À exécuter sur la base de données

-- Ajouter les colonnes de notation à la table orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_rating DECIMAL(3,1) CHECK (service_rating >= 0 AND service_rating <= 10);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS quality_rating DECIMAL(3,1) CHECK (quality_rating >= 0 AND quality_rating <= 10);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS price_rating DECIMAL(3,1) CHECK (price_rating >= 0 AND price_rating <= 10);

-- Ajouter des commentaires pour documenter les colonnes
COMMENT ON COLUMN orders.service_rating IS 'Note du service de livraison (0-10)';
COMMENT ON COLUMN orders.quality_rating IS 'Note de la qualité des produits (0-10)';
COMMENT ON COLUMN orders.price_rating IS 'Note du niveau des prix pratiqués (0-10)';

-- Créer un index pour les requêtes de filtrage par notes
CREATE INDEX IF NOT EXISTS idx_orders_ratings ON orders(service_rating, quality_rating, price_rating) 
WHERE order_type = 'MATA';

-- Vérifier la structure de la table
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('service_rating', 'quality_rating', 'price_rating')
ORDER BY column_name; 