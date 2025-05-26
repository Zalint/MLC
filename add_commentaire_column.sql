-- Script SQL pour ajouter la colonne commentaire à la table orders
-- À exécuter directement dans PostgreSQL

-- Ajouter la colonne commentaire si elle n'existe pas déjà
ALTER TABLE orders ADD COLUMN IF NOT EXISTS commentaire TEXT;

-- Créer un index pour améliorer les performances des recherches sur les commentaires
CREATE INDEX IF NOT EXISTS idx_orders_commentaire ON orders(commentaire) WHERE commentaire IS NOT NULL;

-- Vérifier que la colonne a été ajoutée
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'orders' AND column_name = 'commentaire';

-- Afficher un message de confirmation
SELECT 'Colonne commentaire ajoutée avec succès à la table orders' AS message; 