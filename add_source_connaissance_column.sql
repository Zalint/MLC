-- Migration pour ajouter la colonne "Comment nous avez-vous connu ?"
-- À exécuter sur la base de données

-- Ajouter la colonne source_connaissance à la table orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS source_connaissance VARCHAR(100);

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN orders.source_connaissance IS 'Comment le client nous a connu (réseaux sociaux, bouche-à-oreille, publicité, etc.)';

-- Créer un index pour les requêtes de filtrage et analyses
CREATE INDEX IF NOT EXISTS idx_orders_source_connaissance ON orders(source_connaissance) 
WHERE order_type = 'MATA' AND source_connaissance IS NOT NULL;

-- Vérifier la structure de la table
SELECT column_name, data_type, character_maximum_length, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name = 'source_connaissance'
ORDER BY column_name;

