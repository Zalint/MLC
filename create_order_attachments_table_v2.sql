-- Migration pour créer la table order_attachments (Version corrigée)
-- Système de pièces jointes pour les commandes

-- Supprimer la table si elle existe déjà (pour tests)
DROP TABLE IF EXISTS order_attachments;

CREATE TABLE order_attachments (
    id SERIAL PRIMARY KEY,
    order_id UUID NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INTEGER NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_by VARCHAR(100)
);

-- Index pour améliorer les performances
CREATE INDEX idx_order_attachments_order_id ON order_attachments(order_id);
CREATE INDEX idx_order_attachments_uploaded_at ON order_attachments(uploaded_at);

-- Commentaires pour documentation
COMMENT ON TABLE order_attachments IS 'Stocke les métadonnées des pièces jointes (images, PDFs) associées aux commandes';
COMMENT ON COLUMN order_attachments.order_id IS 'ID de la commande associée';
COMMENT ON COLUMN order_attachments.file_name IS 'Nom du fichier stocké sur le serveur';
COMMENT ON COLUMN order_attachments.original_name IS 'Nom original du fichier uploadé par l''utilisateur';
COMMENT ON COLUMN order_attachments.file_path IS 'Chemin complet du fichier sur le serveur';
COMMENT ON COLUMN order_attachments.file_type IS 'Type MIME du fichier (image/jpeg, image/png, application/pdf)';
COMMENT ON COLUMN order_attachments.file_size IS 'Taille du fichier en bytes';
COMMENT ON COLUMN order_attachments.uploaded_by IS 'Utilisateur qui a uploadé le fichier';

-- Note: La clé étrangère sera ajoutée après avoir vérifié la structure de la table orders
-- Pour l'instant, on utilise simplement un INTEGER pour order_id

