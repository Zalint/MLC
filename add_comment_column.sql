-- Ajouter une colonne commentaire à la table orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS commentaire TEXT;

-- Créer un index pour améliorer les performances si nécessaire
CREATE INDEX IF NOT EXISTS idx_orders_commentaire ON orders(commentaire) WHERE commentaire IS NOT NULL; 