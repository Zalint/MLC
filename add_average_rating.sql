-- Ajouter la colonne average_rating manquante
ALTER TABLE orders ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,1) CHECK (average_rating >= 0 AND average_rating <= 10);

-- Ajouter un commentaire pour documenter la colonne  
COMMENT ON COLUMN orders.average_rating IS 'Note moyenne calculée (0-10)';
 
-- Vérifier que la colonne a été ajoutée
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name = 'average_rating'; 